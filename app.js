// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD1ApCkzPbBRNJUCkAGet9DBKb1uE9O1Bo",
  authDomain: "djen-com-minuta.firebaseapp.com",
  projectId: "djen-com-minuta",
  storageBucket: "djen-com-minuta.firebasestorage.app",
  messagingSenderId: "498664224312",
  appId: "1:498664224312:web:6de6a453d9e36138a398cd",
  measurementId: "G-MCV0ZCD3Y1"
};

// Inicializa o Firebase
let app;
try {
    app = firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.error("Erro ao inicializar o Firebase:", e);
}

const auth = app ? firebase.auth() : null;
const db = app ? firebase.firestore() : null;
const storage = app ? firebase.storage() : null;

const { useState, useEffect, useCallback, createContext, useContext, useRef } = React;
const { Bar, HorizontalBar } = window.ReactChartjs2;

// --- Função Auxiliar de Formatação de Data ---
const formatarData = (date) => {
    if (!date) return '';
    // CORREÇÃO: Usa o fuso horário UTC para a formatação.
    // Isso evita que a data mude para o dia anterior ou posterior dependendo
    // do fuso horário do navegador do usuário, um problema comum no Brasil.
    // A data é exibida como se estivesse em UTC, garantindo consistência.
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

// --- Contexto de Configurações ---
const SettingsContext = createContext(null);

const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        theme: 'system', // 'light', 'dark', 'system'
        defaultMateria: 'civel',
        defaultPrazo: 15,
        // Dados do calendário serão carregados aqui
        feriadosMap: {},
        decretosMap: {},
        instabilidadeMap: {},
        recessoForense: {
            janeiro: { inicio: 2, fim: 20 },
            dezembro: { inicio: 20, fim: 30 }
        },
        calendarLoading: true,
    });

    useEffect(() => {
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
            setSettings(JSON.parse(savedSettings));
        }
    }, []);

    const fetchCalendarData = useCallback(async () => {
        if (db) {
            setSettings(s => ({ ...s, calendarLoading: true }));
            try {
                const docRef = db.collection('configuracoes').doc('calendario');
                const doc = await docRef.get();

                if (!doc.exists) {
                    console.warn("Documento 'calendario' não encontrado na coleção 'configuracoes'.");
                    updateSettings({ feriadosMap: {}, decretosMap: {}, instabilidadeMap: {}, calendarLoading: false });
                    return;
                }

                const calendarConfig = doc.data();
                const anoCorrente = "2025"; // Usaremos 2025 para este exemplo, mas pode ser dinâmico

                const feriados = {};
                const decretos = {};
                const instabilidades = {};

                // 1. Processa feriados nacionais recorrentes
                if (calendarConfig.feriadosNacionaisRecorrentes) {
                    calendarConfig.feriadosNacionaisRecorrentes.forEach(feriado => {
                        // Formata a data para YYYY-MM-DD
                        const dataStr = `${anoCorrente}-${String(feriado.mes).padStart(2, '0')}-${String(feriado.dia).padStart(2, '0')}`;
                        feriados[dataStr] = feriado.motivo;
                    });
                }

                // 2. Processa as exceções anuais (feriados específicos, decretos, instabilidades)
                // Isso sobrescreverá feriados recorrentes se houver conflito, o que é o esperado.
                const excecoesDoAno = calendarConfig.excecoesAnuais?.[anoCorrente] || [];
                excecoesDoAno.forEach(item => {
                    if (item.data && item.motivo && item.tipo) {
                        switch (item.tipo) {
                            case 'feriado':
                                feriados[item.data] = item.motivo;
                                break;
                            case 'decreto':
                                decretos[item.data] = item.motivo;
                                break;
                            case 'instabilidade':
                                instabilidades[item.data] = item.motivo;
                                break;
                        }
                    }
                });

                // 3. Atualiza o recesso forense
                const novoRecesso = calendarConfig.recessoForense || settings.recessoForense;

                // Aplica a função exclusiva para os decretos de 19/06 e 20/06.
                aplicarRegrasEspeciaisDecretos(feriados, decretos, anoCorrente);
                updateSettings({ feriadosMap: feriados, decretosMap: decretos, instabilidadeMap: instabilidades, recessoForense: novoRecesso, calendarLoading: false });

            } catch (error) { console.error("Erro ao carregar calendário da coleção:", error); updateSettings({ calendarLoading: false }); }
        }
    }, []);

    useEffect(() => {
        // Carrega os dados do calendário do Firestore na montagem inicial
        fetchCalendarData();
    }, []);

    useEffect(() => {
        // Aplica o tema
        const root = window.document.documentElement;
        const isDark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        root.classList.toggle('dark', isDark);
    }, [settings.theme]);

    const updateSettings = (newSettings) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        localStorage.setItem('appSettings', JSON.stringify(updated));
    };

    const value = { settings, updateSettings, refreshCalendar: fetchCalendarData };
    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

/**
 * Aplica regras de negócio específicas para os decretos de 19/06 e 20/06.
 * Garante que Corpus Christi (19/06) e a suspensão subsequente (20/06)
 * sejam tratados como decretos comprováveis, independentemente de seu
 * cadastro original no banco de dados.
 * @param {object} feriados - O mapa de feriados carregado.
 * @param {object} decretos - O mapa de decretos carregado.
 */
const aplicarRegrasEspeciaisDecretos = (feriados, decretos, ano) => {
    // Remove Corpus Christi do mapa de feriados, se existir, para forçá-lo a ser um "Feriado CNJ".
    delete feriados[`${ano}-06-19`];

    // Adiciona/sobrescreve as datas no mapa de decretos com um tipo especial para garantir que exijam comprovação.
    decretos[`${ano}-06-19`] = { motivo: 'Corpus Christi', tipo: 'feriado_cnj' };
    decretos[`${ano}-06-20`] = { motivo: 'Suspensão de expediente (pós Corpus Christi)', tipo: 'feriado_cnj' };
};

// --- Contexto de Autenticação ---
const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentArea, setCurrentArea] = useState('Calculadora');

    const updateUserAndAdminStatus = async (firebaseUser) => {
        if (firebaseUser) {
            setUser(firebaseUser);
            try {
                const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
                if (userDoc.exists) {
                    setUserData(userDoc.data());
                } else {
                    // Se o documento não existe, desloga por segurança.
                    console.warn("Documento do usuário não encontrado no Firestore. Deslogando.");
                    auth.signOut();
                    setUserData(null);
                }
            } catch (error) {
                console.error("Erro ao buscar dados do usuário:", error);
                auth.signOut();
                setUserData(null);
            }
        } else {
            setUser(null);
            setUserData(null);
        }
        setLoading(false); // Garante que o loading termine em todos os casos.
    };

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }
        const unsubscribe = auth.onAuthStateChanged(updateUserAndAdminStatus);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && auth.currentUser) {
                // Força a atualização dos dados do usuário quando a aba se torna visível
                updateUserAndAdminStatus(auth.currentUser);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    const isAdmin = userData?.role === 'admin';
    const isSetorAdmin = userData?.role === 'setor_admin'; // Mantido para compatibilidade com regras
    const isIntermediate = userData?.role === 'intermediate'; // Usado na UI

    // A função de atualização é exposta para que componentes filhos possam forçar a atualização do usuário.
    const refreshUser = async () => {
        if (auth.currentUser) {
            await auth.currentUser.reload();
            // O onAuthStateChanged listener já deve pegar a mudança, mas chamamos para garantir.
            updateUserAndAdminStatus(auth.currentUser);
        }
    };
    const value = { 
        user, 
        userData,
        isAdmin,
        isSetorAdmin,
        isIntermediate,
        loading,
        refreshUser,
        currentArea,
        setCurrentArea,
        openCalendario: () => document.dispatchEvent(new CustomEvent('openCalendario'))
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const useAuth = () => {
    return useContext(AuthContext);
};


// --- Componentes ---

const ConsultaAssistidaPJE = ({ numeroProcesso, setNumeroProcesso }) => {
    const { user } = useAuth();
    const [alerta, setAlerta] = useState('');

    const logDjenUsage = () => {
        if (db && user) {
            db.collection('usageStats').add({
                userId: user.uid,
                userEmail: user.email,
                type: 'djen_consulta',
                numeroProcesso: numeroProcesso || 'Não informado',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(err => console.error("Erro ao registrar uso da consulta DJEN:", err));
        }
    };

    const handleConsulta = () => {
        setAlerta('');
        logDjenUsage(); // Registra o uso da consulta
        const hoje = new Date();
        const dataLimite = new Date('2025-05-16T00:00:00');

        if (hoje < dataLimite) {
            setAlerta('A consulta ao Diário Nacional (DJEN) só é necessária a partir de 16/05/2025. Antes dessa data, consulte a intimação diretamente no Projudi para obter a "Data de Disponibilização" e utilize na calculadora abaixo.');
            return;
        }

        if (!numeroProcesso.trim()) return;
        const numeroLimpo = numeroProcesso.replace(/\D/g, '');
        const dataFim = new Date();
        const dataInicio = new Date();
        dataInicio.setFullYear(dataInicio.getFullYear() - 2);
        const formataData = (d) => d.toISOString().split('T')[0];
        const url = `https://comunica.pje.jus.br/consulta?siglaTribunal=TJPR&dataDisponibilizacaoInicio=${formataData(dataInicio)}&dataDisponibilizacaoFim=${formataData(dataFim)}&numeroProcesso=${numeroLimpo}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
         <div className="relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
            <UserIDWatermark overlay={true} />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Consulta de Processo</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Insira o número para consultar o processo no Diário de Justiça Eletrônico Nacional.</p>
            {alerta && <div className="p-4 mb-4 text-sm text-yellow-800 rounded-lg bg-yellow-50 dark:bg-gray-800 dark:text-yellow-300" role="alert"><span className="font-medium">Atenção!</span> {alerta}</div>}
            <div className="flex items-center gap-2">
                 <input type="text" value={numeroProcesso} onChange={(e) => { setNumeroProcesso(e.target.value); setAlerta(''); }} placeholder="Número do Processo" className="flex-grow w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                 <button onClick={handleConsulta} disabled={!numeroProcesso} className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 px-5 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                    Consultar
                 </button>
            </div>
             <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-center">Após a consulta, localize a "Data de Disponibilização" para usar na calculadora de prazos abaixo.</p>
        </div>
    );
};

const CalculadoraDePrazo = ({ numeroProcesso }) => {
  const { settings, updateSettings } = useContext(SettingsContext);
  const [prazoSelecionado, setPrazoSelecionado] = useState(settings.defaultPrazo || 15);
  const [dataDisponibilizacao, setDataDisponibilizacao] = useState('');
  const [tipoPrazo, setTipoPrazo] = useState(settings.defaultMateria || 'civel');
  const [resultado, setResultado] = useState(null);

  const [diasComprovados, setDiasComprovados] = useState(new Set());
  const [dataInterposicao, setDataInterposicao] = useState('');
  const [tempestividade, setTempestividade] = useState(null);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const { userData, isAdmin } = useAuth();
  const { feriadosMap, decretosMap, instabilidadeMap, recessoForense, calendarLoading } = settings;

  const getMotivoDiaNaoUtil = (date, considerarDecretos, tipo = 'todos') => {
    const dateString = date.toISOString().split('T')[0];
    if (tipo === 'todos' || tipo === 'feriado') {
        if (feriadosMap[dateString]) return { motivo: feriadosMap[dateString], tipo: 'feriado' };
    }
    if (considerarDecretos && (tipo === 'todos' || tipo === 'decreto')) {
        if (decretosMap[dateString]) {
            // Se for um objeto (regra especial CNJ), retorna o objeto. Senão, cria um.
            if (typeof decretosMap[dateString] === 'object') {
                return decretosMap[dateString];
            }
            return { motivo: decretosMap[dateString], tipo: 'decreto' };
        }
    }
    // A instabilidade é tratada separadamente, mas pode ser verificada aqui se necessário.
    if (considerarDecretos && (tipo === 'todos' || tipo === 'instabilidade')) {
        if (instabilidadeMap[dateString]) return { motivo: instabilidadeMap[dateString], tipo: 'instabilidade' };
    }
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const { janeiro, dezembro } = recessoForense;
    if (tipo === 'todos' || tipo === 'recesso') {
        if ((month === 1 && day >= janeiro.inicio && day <= janeiro.fim) || 
            (month === 12 && day >= dezembro.inicio && day <= dezembro.fim)) 
            return { motivo: 'Recesso Forense', tipo: 'recesso' };
    }
    return null;
  };
  
  const getProximoDiaUtil = (data) => {
      const proximoDia = new Date(data.getTime());
      do {
          proximoDia.setDate(proximoDia.getDate() + 1);
      } while (proximoDia.getDay() === 0 || proximoDia.getDay() === 6 || getMotivoDiaNaoUtil(proximoDia, true, 'todos'));
      return proximoDia;
  };

  /**
   * Encontra o próximo dia útil para a publicação, prorrogando-o caso caia em fins de semana,
   * feriados, recessos ou decretos de suspensão.
   */
  const getProximoDiaUtilParaPublicacao = (data) => {
      const suspensoesEncontradas = [];
      const proximoDia = new Date(data.getTime());
      // A publicação deve ser o primeiro dia útil após a disponibilização,
      // ignorando feriados e decretos para a contagem do dia da publicação.
      // CORREÇÃO: A variável 'motivo' deve ser reavaliada a cada iteração do loop.
      let motivo;
      do {
          proximoDia.setDate(proximoDia.getDate() + 1);
          // Instabilidades são ignoradas aqui para não prorrogarem o início do prazo automaticamente.
          const motivoTemp = getMotivoDiaNaoUtil(proximoDia, true, 'feriado') || getMotivoDiaNaoUtil(proximoDia, true, 'recesso') || getMotivoDiaNaoUtil(proximoDia, true, 'decreto');
          
          // CORREÇÃO: Garante que "Feriado CNJ" não prorrogue o início do prazo.
          // Apenas feriados, recessos e decretos "normais" devem prorrogar.
          motivo = (motivoTemp && motivoTemp.tipo !== 'feriado_cnj') ? motivoTemp : null;
          // Se o dia for um decreto ou instabilidade, ele é adicionado à lista de comprováveis,
          // e o loop continua para encontrar o próximo dia útil para a publicação.
          if (motivo && motivo.tipo === 'decreto') {
              suspensoesEncontradas.push({ data: new Date(proximoDia.getTime()), ...motivo });
          }
      // O loop continua enquanto for fim de semana, feriado, recesso ou decreto.
      } while (proximoDia.getDay() === 0 || proximoDia.getDay() === 6 || motivo);
      return { proximoDia, suspensoesEncontradas };
  };

  const getProximoDiaUtilSemDecreto = (data) => {
      const proximoDia = new Date(data.getTime());
      do { proximoDia.setDate(proximoDia.getDate() + 1); } while (proximoDia.getDay() === 0 || proximoDia.getDay() === 6 || getMotivoDiaNaoUtil(proximoDia, false, 'feriado') || getMotivoDiaNaoUtil(proximoDia, false, 'recesso'));
      return proximoDia;
  };

  const calcularPrazoFinalDiasUteis = (inicioDoPrazo, prazo, comprovados = new Set(), considerarDecretos = true, considerarInstabilidades = false) => {
    let diasUteisContados = 0;
    const diasNaoUteisEncontrados = [];
    // A dataCorrente começa no mesmo dia do início do prazo.
    // O loop avançará para o dia seguinte antes de contar, iniciando a contagem corretamente.
    const dataCorrente = new Date(inicioDoPrazo.getTime());

    while (diasUteisContados < prazo - 1) { // Ajuste: conta até o penúltimo dia
        const diaDaSemana = dataCorrente.getDay();
        const dataCorrenteStr = dataCorrente.toISOString().split('T')[0];

        // A lógica de `considerarDecretos` é aplicada aqui. Se for `false`, os decretos não são considerados dias não úteis.
        // A comprovação (`comprovados`) é usada para estender o prazo final em caso de instabilidade.
        let infoDiaNaoUtil = null;

        const eFeriadoOuRecesso = getMotivoDiaNaoUtil(dataCorrente, true, 'feriado') || getMotivoDiaNaoUtil(dataCorrente, true, 'recesso');
        const eDecreto = getMotivoDiaNaoUtil(dataCorrente, true, 'decreto');
        const eInstabilidade = getMotivoDiaNaoUtil(dataCorrente, true, 'instabilidade');

        if (eFeriadoOuRecesso && !infoDiaNaoUtil) { // Só aplica se a regra especial acima não foi usada
            infoDiaNaoUtil = eFeriadoOuRecesso;
        // CORREÇÃO: Permite que 'feriado_cnj' seja contado como dia não útil se estiver comprovado.
        // A regra de não contar no loop principal se aplica apenas quando não está comprovado.
        } else if (considerarDecretos && eDecreto && comprovados.has(dataCorrenteStr) && !infoDiaNaoUtil) {
            infoDiaNaoUtil = eDecreto;
        } else if (considerarInstabilidades && eInstabilidade && comprovados.has(dataCorrenteStr) && !infoDiaNaoUtil) {
            infoDiaNaoUtil = eInstabilidade;
        }
        if (diaDaSemana === 0 || diaDaSemana === 6 || infoDiaNaoUtil) {
            // CORREÇÃO: No cálculo "com decreto", só adicionamos à lista de dias não úteis
            // os decretos e instabilidades, para não poluir o Cenário 2 com feriados.
            // CORREÇÃO 2: A lógica anterior estava invertida. Agora, se `considerarDecretos` for true,
            // adicionamos os decretos/instabilidades comprovados à lista para exibição.
            if (infoDiaNaoUtil && considerarDecretos && (infoDiaNaoUtil.tipo === 'decreto' || infoDiaNaoUtil.tipo === 'instabilidade' || infoDiaNaoUtil.tipo === 'feriado_cnj')) {
                diasNaoUteisEncontrados.push({ data: new Date(dataCorrente.getTime()), ...infoDiaNaoUtil });
            }
        } else {
            diasUteisContados++;
        }
        dataCorrente.setDate(dataCorrente.getDate() + 1); // Avança a data no final do loop
    }
    // Após encontrar o prazo final, verifica se ele caiu em um dia não útil (incluindo instabilidade comprovada).
    // Se sim, prorroga para o próximo dia útil.
    let prazoFinalAjustado = dataCorrente;
    let infoDiaFinalNaoUtil;

    // REGRA ESPECIAL: Se o prazo final cair em 19 ou 20 de junho, trata como feriado e prorroga.
    const prazoFinalStr = prazoFinalAjustado.toISOString().split('T')[0];
    if (prazoFinalStr === '2025-06-19' || prazoFinalStr === '2025-06-20') {
        // Pula para o próximo dia útil, que será 23/06/2025
        prazoFinalAjustado.setDate(23);
    }

    // Loop simplificado para prorrogar o prazo final se ele cair em um dia não útil.
    // Isso garante que o prazo final seja sempre um dia útil.
    while (
        (infoDiaFinalNaoUtil = getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'feriado') || 
                               getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'recesso') || 
                               (considerarDecretos && getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'decreto') && comprovados.has(prazoFinalAjustado.toISOString().split('T')[0])) ||
                               (considerarInstabilidades && getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'instabilidade') && comprovados.has(prazoFinalAjustado.toISOString().split('T')[0]))
        ) ||
        prazoFinalAjustado.getDay() === 0 || prazoFinalAjustado.getDay() === 6
    ) {
        prazoFinalAjustado.setDate(prazoFinalAjustado.getDate() + 1);
    }
    return { prazoFinal: prazoFinalAjustado, diasNaoUteis: diasNaoUteisEncontrados };
  };

  const logUsage = () => {
      if (db && user) {
          db.collection('usageStats').add({
              userId: user.uid,
              userEmail: user.email,
              materia: tipoPrazo,
              type: 'calculadora',
              prazo: prazoSelecionado,
              numeroProcesso: numeroProcesso || 'Não informado',
              timestamp: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(err => console.error("Erro ao registrar uso:", err));
      }
  }

  const handleCalcular = () => {
    setError('');
    setResultado(null);
    setDataInterposicao('');
    setTempestividade(null);
    setDiasComprovados(new Set()); // Reseta os dias comprovados
    if (!dataDisponibilizacao) {
        setError('Por favor, preencha a Data de Disponibilização.');
        return;
    }
    try {
        // CORREÇÃO: Constrói a data de forma mais robusta para evitar problemas de fuso horário e parsing.
        // O formato 'YYYY-MM-DD' do input[type=date] pode ser interpretado como UTC por alguns navegadores,
        // causando erros de data inválida ou cálculos incorretos.
        const [year, month, day] = dataDisponibilizacao.split('-').map(Number);
        if (!year || !month || !day) throw new Error("Formato de data incompleto.");
        const inicioDisponibilizacao = new Date(year, month - 1, day);

        const dataLimite = new Date('2025-05-16T00:00:00');

        if (inicioDisponibilizacao < dataLimite) {
            setError('Para datas anteriores a 16/05/2025, a consulta de intimação e a contagem do respectivo prazo devem ser realizadas diretamente no sistema Projudi.');
            return;
        }

        const prazoNumerico = prazoSelecionado;
        
        if (tipoPrazo === 'civel') {
            // Para cível, o início do prazo não é afetado por decretos, apenas a contagem.
            let diasNaoUteisDoInicio = [];

            // A nova função lida com a prorrogação da publicação por feriados/decretos.
            const { proximoDia: dataPublicacao, suspensoesEncontradas: suspensoesPublicacao } = getProximoDiaUtilParaPublicacao(inicioDisponibilizacao);
            diasNaoUteisDoInicio = suspensoesPublicacao;

            const { proximoDia: inicioDoPrazo, suspensoesEncontradas: suspensoesInicio } = getProximoDiaUtilParaPublicacao(dataPublicacao);
            diasNaoUteisDoInicio.push(...suspensoesInicio);

            calcularPrazoCivelComInicioDefinido(dataPublicacao, inicioDoPrazo, prazoNumerico, diasNaoUteisDoInicio);
        } else { // Lógica para Crime (dias corridos)
            // CORREÇÃO: Unifica a lógica de Crime com a de Cível para permitir a comprovação de decretos.
            const { proximoDia: dataPublicacao, suspensoesEncontradas: suspensoesPublicacao } = getProximoDiaUtilParaPublicacao(inicioDisponibilizacao);
            const { proximoDia: dataIntimacao, suspensoesEncontradas: suspensoesIntimacao } = getProximoDiaUtilParaPublicacao(dataPublicacao);
            
            const calcularPrazoCrime = (inicioPrazo, prazo, comprovados = new Set(), considerarDecretos = true) => {
                const diasNaoUteisEncontrados = [];
                const prazoFinal = new Date(dataIntimacao.getTime());
                prazoFinal.setDate(prazoFinal.getDate() + prazoNumerico - 1);
                
                let prazoFinalAjustado = new Date(prazoFinal.getTime());
                let infoDiaFinalNaoUtil;
                while (
                    (infoDiaFinalNaoUtil = getMotivoDiaNaoUtil(prazoFinalAjustado, considerarDecretos)) &&
                    (infoDiaFinalNaoUtil.tipo !== 'decreto' || comprovados.has(prazoFinalAjustado.toISOString().split('T')[0]))
                ) {
                    diasNaoUteisEncontrados.push({ data: new Date(prazoFinalAjustado.getTime()), ...infoDiaFinalNaoUtil });
                    prazoFinalAjustado.setDate(prazoFinalAjustado.getDate() + 1);
                }
                return { prazoFinal: prazoFinalAjustado, diasNaoUteis: diasNaoUteisEncontrados };
            };

            const resultadoSemDecreto = calcularPrazoCrime(dataIntimacao, prazoNumerico, new Set(), false);
            const todasSuspensoesPossiveis = new Set(Object.keys(decretosMap).concat(Object.keys(instabilidadeMap)));
            const resultadoComTodasSuspensoes = calcularPrazoCrime(dataIntimacao, prazoNumerico, todasSuspensoesPossiveis, true);

            const todasAsSuspensoesParaUI = [...suspensoesPublicacao, ...suspensoesIntimacao, ...resultadoComTodasSuspensoes.diasNaoUteis.filter(d => d.tipo === 'decreto' || d.tipo === 'instabilidade')];
            const suspensoesRelevantesMap = new Map();
            todasAsSuspensoesParaUI.forEach(suspensao => suspensoesRelevantesMap.set(suspensao.data.toISOString().split('T')[0], suspensao));
            const suspensoesRelevantes = Array.from(suspensoesRelevantesMap.values());

            setResultado({ dataPublicacao, inicioPrazo: dataIntimacao, semDecreto: resultadoSemDecreto, comDecreto: resultadoSemDecreto, suspensoesComprovaveis: suspensoesRelevantes, prazo: prazoNumerico, tipo: 'crime' });
        }
        logUsage();
    } catch(e) {
        setError('Data inválida. Use o formato DD/MM/AAAA.');
    }
  };

  const calcularPrazoCivelComInicioDefinido = (dataPublicacao, inicioDoPrazo, prazoNumerico, diasNaoUteisDoInicio = []) => {
        // Cenário 1: Calcula o prazo sem considerar decretos ou instabilidades. Usa uma função que ignora decretos para o início.
        const dataPublicacaoSemDecreto = getProximoDiaUtilSemDecreto(new Date(dataDisponibilizacao + 'T00:00:00'));
        const inicioDoPrazoSemDecreto = getProximoDiaUtilSemDecreto(dataPublicacaoSemDecreto);
        const resultadoSemDecreto = calcularPrazoFinalDiasUteis(inicioDoPrazoSemDecreto, prazoNumerico, new Set(), false, false);

        // O estado inicial do Cenário 2 (com decreto) deve ser igual ao Cenário 1.
        // CORREÇÃO: O cenário 2 inicial deve ser o mesmo que o cenário 1.
        const resultadoComDecretoInicial = { ...resultadoSemDecreto };

        // Calcula o prazo considerando TODOS os decretos (mas não instabilidades) para encontrar os que são relevantes.
        const todosDecretosPossiveis = new Set(Object.keys(decretosMap));
        const resultadoComTodosDecretos = calcularPrazoFinalDiasUteis(inicioDoPrazo, prazoNumerico, todosDecretosPossiveis, true, false);
        
        // Unifica os decretos encontrados (no início e durante o prazo), evitando duplicatas.
        const todosDecretosParaUI = [...diasNaoUteisDoInicio.filter(d => d.tipo === 'decreto'), ...resultadoComTodosDecretos.diasNaoUteis.filter(d => d.tipo === 'decreto')];
        const suspensoesRelevantesMap = new Map();
        todosDecretosParaUI.forEach(suspensao => {
            suspensoesRelevantesMap.set(suspensao.data.toISOString().split('T')[0], suspensao);
        });
        // CORREÇÃO: Adiciona os feriados CNJ à lista de comprováveis, APENAS se eles ocorrerem durante o prazo.
        Object.entries(decretosMap)
            .filter(([, val]) => typeof val === 'object' && val.tipo === 'feriado_cnj')
            .forEach(([data, val]) => {
                const dataFeriadoCnj = new Date(data + 'T00:00:00');
                // CORREÇÃO: Adiciona para comprovação apenas se estiver no MEIO do prazo.
                // Se o prazo final cair nele, a prorrogação é automática e não precisa comprovar.
                // A verificação usa `<` para não incluir o dia em que o prazo termina.
                if (dataFeriadoCnj >= inicioDoPrazo && dataFeriadoCnj <= resultadoSemDecreto.prazoFinal) {
                    suspensoesRelevantesMap.set(data, { data: dataFeriadoCnj, ...val });
                }
            });

        // NOVA LÓGICA PARA INSTABILIDADES:
        // 1. Verifica se o início do prazo caiu em uma instabilidade.
        const instabilidadeNoInicio = getMotivoDiaNaoUtil(inicioDoPrazo, true, 'instabilidade');
        if (instabilidadeNoInicio) {
            suspensoesRelevantesMap.set(inicioDoPrazo.toISOString().split('T')[0], { data: new Date(inicioDoPrazo.getTime()), ...instabilidadeNoInicio });
        }
        // 2. Verifica se o prazo final (sem considerar nada) caiu em uma instabilidade.
        const instabilidadeNoFim = getMotivoDiaNaoUtil(resultadoSemDecreto.prazoFinal, true, 'instabilidade');
        if (instabilidadeNoFim) {
            suspensoesRelevantesMap.set(resultadoSemDecreto.prazoFinal.toISOString().split('T')[0], { data: new Date(resultadoSemDecreto.prazoFinal.getTime()), ...instabilidadeNoFim });
        }

        const suspensoesRelevantes = Array.from(suspensoesRelevantesMap.values()).sort((a, b) => a.data - b.data);
        
        // Se a prorrogação automática do Feriado CNJ ocorreu, não há necessidade de mostrar dois cenários.
        // Forçamos a lista de comprováveis a ficar vazia para exibir apenas um resultado.
        const prazoFinalOriginalStr = resultadoSemDecreto.prazoFinal.toISOString().split('T')[0];
        const prorrogacaoAutomaticaCnj = prazoFinalOriginalStr === '2025-06-19' || prazoFinalOriginalStr === '2025-06-20';

        if (prorrogacaoAutomaticaCnj) {
            // Remove os feriados CNJ da lista de comprováveis, pois a prorrogação é automática.
            suspensoesRelevantes.length = 0;
        }

        setResultado({ 
            dataPublicacao, 
            inicioPrazo: inicioDoPrazo, 
            inicioPrazoOriginal: inicioDoPrazo, // Guarda o início de prazo original para recálculo
            semDecreto: resultadoSemDecreto,
            comDecreto: resultadoComDecretoInicial, // Inicialmente igual ao 'semDecreto'
            suspensoesComprovaveis: suspensoesRelevantes,
            prazo: prazoNumerico, tipo: 'civel'
        });
  };

  const handleComprovacaoChange = (dataString) => {
    let novosComprovados = new Set(diasComprovados);
    const isCorpusChristiRelated = dataString === '2025-06-19' || dataString === '2025-06-20';

    if (isCorpusChristiRelated) {
        // Se um dos dias relacionados já estiver marcado, desmarca ambos. Caso contrário, marca ambos.
        if (novosComprovados.has('2025-06-19') || novosComprovados.has('2025-06-20')) {
            novosComprovados.delete('2025-06-19');
            novosComprovados.delete('2025-06-20');
        } else {
            novosComprovados.add('2025-06-19');
            novosComprovados.add('2025-06-20');
        }
    } else {
        // Comportamento padrão para outros decretos
        novosComprovados.has(dataString) ? novosComprovados.delete(dataString) : novosComprovados.add(dataString);
    }
    setDiasComprovados(novosComprovados);

    // Recalcula o prazo com base nos dias agora comprovados
    const { prazo, tipo } = resultado;

    // CORREÇÃO: Recalcula o início do prazo e o prazo final do zero,
    // considerando os decretos atualmente comprovados.
    const getProximoDiaUtilComprovado = (data) => {
        const proximoDia = new Date(data.getTime());
        let motivo;
        do {
            proximoDia.setDate(proximoDia.getDate() + 1);
            const dataStr = proximoDia.toISOString().split('T')[0];
            motivo = getMotivoDiaNaoUtil(proximoDia, true, 'feriado') || getMotivoDiaNaoUtil(proximoDia, true, 'recesso') || (novosComprovados.has(dataStr) && getMotivoDiaNaoUtil(proximoDia, true));
        } while (proximoDia.getDay() === 0 || proximoDia.getDay() === 6 || motivo);
        return proximoDia;
    };
    const novaDataPublicacao = getProximoDiaUtilComprovado(new Date(dataDisponibilizacao + 'T00:00:00'));
    const novoInicioPrazo = getProximoDiaUtilComprovado(novaDataPublicacao);
    const novoResultado = calcularPrazoFinalDiasUteis(novoInicioPrazo, prazo, novosComprovados, true, true);

    // CORREÇÃO: Atualiza não apenas o prazo final, mas também a data de publicação,
    // o início do prazo e a lista de dias não úteis para o Cenário 2.
    setResultado(prev => ({ 
        ...prev, 
        dataPublicacao: novaDataPublicacao,
        inicioPrazo: novoInicioPrazo,
        comDecreto: novoResultado 
    }));
  };

  useEffect(() => {
    if (resultado && dataInterposicao) {
        try {
            // Converte a data de interposição para um objeto Date em UTC para evitar problemas de fuso horário.
            const [year, month, day] = dataInterposicao.split('-').map(Number);
            const dataInterposicaoObj = new Date(Date.UTC(year, month - 1, day));

            // Prazo final mais benéfico possível (considerando TODAS as suspensões comprováveis).
            const todasSuspensoesComprovaveis = new Set(resultado.suspensoesComprovaveis.map(d => d.data.toISOString().split('T')[0]));
            const prazoFinalMaximo = calcularPrazoFinalDiasUteis(resultado.inicioPrazo, resultado.prazo, todasSuspensoesComprovaveis, true, true).prazoFinal;
            prazoFinalMaximo.setUTCHours(23, 59, 59, 999);
            
            // Prazo final considerando apenas as suspensões que o usuário marcou como comprovadas.
            const prazoFinalComprovado = resultado.comDecreto.prazoFinal;
            prazoFinalComprovado.setUTCHours(23, 59, 59, 999);

            // 1. Puramente intempestivo: A data de interposição é posterior ao prazo máximo possível.
            if (dataInterposicaoObj > prazoFinalMaximo) {
                setTempestividade('puramente_intempestivo');
            // 2. Intempestivo por falta de decreto: A data de interposição é posterior ao prazo com os decretos atualmente comprovados,
            // mas ainda poderia ser tempestivo se todos os decretos possíveis fossem comprovados.
            } else if (dataInterposicaoObj > prazoFinalComprovado) {
                setTempestividade('intempestivo_falta_decreto');
            // 3. Tempestivo: A data de interposição é igual ou anterior ao prazo com os decretos comprovados.
            } else {
                setTempestividade('tempestivo');
            }

            // Reverte as alterações de hora para não afetar a exibição da data na UI.
            prazoFinalMaximo.setUTCHours(0, 0, 0, 0);
            prazoFinalComprovado.setUTCHours(0, 0, 0, 0);

        } catch (e) {
            setTempestividade(null);
        }
    } else {
        setTempestividade(null);
    }
  }, [dataInterposicao, resultado, diasComprovados]);

  // --- Funções de Geração de Minutas (conforme o código fornecido) ---

  // Template para o documento Word
  const getDocTemplate = (bodyHtml, pStyle, pCenterStyle) => `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Minuta Despacho</title></head>
      <body>
          <div style="font-family: Arial, sans-serif; font-size: 16pt; line-height: 1.5;">
              ${bodyHtml}
              <p style="${pStyle}">Intime-se. Diligências necessárias.</p>
              <br>
              <p style="${pCenterStyle}">Curitiba, data da assinatura digital.</p>
              <br><br>
              <p style="${pCenterStyle}"><b>Desembargador HAYTON LEE SWAIN FILHO</b></p>
              <p style="${pCenterStyle}">1º Vice-Presidente do Tribunal de Justiça do Estado do Paraná</p>
          </div>
      </body>
      </html>
  `;

  // Função para gerar um arquivo .doc a partir de um conteúdo HTML
  const generateDocFromHtml = (bodyHtml, outputFileName) => {
    try {
        // Estilos comuns para os parágrafos
        const pStyle = "text-align: justify; text-indent: 50px; margin-bottom: 1em;";
        const pCenterStyle = "text-align: center; margin: 0;";
        const sourceHTML = getDocTemplate(bodyHtml, pStyle, pCenterStyle);

        const blob = new Blob([sourceHTML], { type: 'application/msword' });
        saveAs(blob, outputFileName);
    } catch (err) {
        console.error("Erro ao gerar documento:", err);
        setError(`Ocorreu um erro ao gerar o arquivo. Verifique o console ou tente em outro navegador.`);
    }
  };

  const gerarMinutaIntempestividade = async () => {
    const { dataPublicacao, inicioPrazo, prazo, suspensoesComprovaveis } = resultado;
    const todasSuspensoes = new Set(suspensoesComprovaveis.map(d => d.data.toISOString().split('T')[0]));
    const prazoFinalMaximo = calcularPrazoFinalDiasUteis(inicioPrazo, prazo, todasSuspensoes, true, true).prazoFinal;
    
    const dataDispStr = formatarData(new Date(dataDisponibilizacao + 'T00:00:00'));
    const dataPubStr = formatarData(dataPublicacao);
    const inicioPrazoStr = formatarData(inicioPrazo);
    const dataInterposicaoStr = formatarData(new Date(dataInterposicao + 'T00:00:00'));

    const pStyle = "text-align: justify; text-indent: 50px; margin-bottom: 1em;";
    const corpoMinuta = `
        <p style="${pStyle}">O recurso especial não pode ser admitido, pois foi interposto sem observância do prazo previsto no artigo 1.003, § 5º, c/c artigo 219, ambos do Código de Processo Civil.</p>
        <p style="${pStyle}">Isto porque se verifica que a intimação do acórdão recorrido (<span style="color: red;">mov. x.x</span>, dos autos sob nº <span style="color: red;">${numeroProcesso || 'xxxxxx'}</span>) se deu pela disponibilização no DJEN na data de ${dataDispStr} e, considerada como data da publicação o primeiro dia útil seguinte ao da disponibilização da informação (artigos 4º, §3º, da Lei 11.419/2006, e 224, do Código de Processo Civil), ${dataPubStr}, iniciou-se a contagem do prazo no primeiro dia útil seguinte ao da publicação, isto é em ${inicioPrazoStr}.</p>
        <p style="${pStyle}">Portanto, a petição recursal apresentada em ${dataInterposicaoStr} está intempestiva, já que protocolado além do prazo legal de ${prazoSelecionado} dias.</p>
        <p style="${pStyle}">Neste sentido:</p>
        <p style="${pStyle}">"PROCESSUAL CIVIL. AGRAVO INTERNO NO AGRAVO EM RECURSO ESPECIAL. RECURSO MANEJADO SOB A ÉGIDE DO NCPC. RECURSO INTEMPESTIVO. RECURSO ESPECIAL INTERPOSTO NA VIGÊNCIA DO NCPC. RECURSO ESPECIAL APRESENTADO FORA DO PRAZO LEGAL. INTEMPESTIVIDADE. APLICAÇÃO DOS ARTS. 219 E 1.003, § 5º, AMBOS DO NCPC. ADMISSIBILIDADE DO APELO NOBRE. JUÍZO BIFÁSICO. AUSÊNCIA DE VINCULAÇÃO DO STJ. AGRAVO INTERNO NÃO PROVIDO.</p>
        <p style="${pStyle}">1. Aplica-se o NCPC a este julgamento ante os termos do Enunciado Administrativo nº 3, aprovado pelo Plenário do STJ na sessão de 9/3/2016: Aos recursos interpostos com fundamento no CPC/2015 (relativos a decisões publicadas a partir de 18 de março de 2016) serão exigidos os requisitos de admissibilidade recursal na forma do novo CPC.</p>
        <p style="${pStyle}">2. A interposição de recurso especial após o prazo legal implica o seu não conhecimento, por intempestividade, nos termos dos arts. 219 e 1.003, § 5º, ambos do NCPC.</p>
        <p style="${pStyle}">3. O juízo de admissibilidade do apelo nobre é bifásico, não ficando o STJ vinculado à decisão proferida pela Corte estadual.</p>
        <p style="${pStyle}">4. Agravo interno não provido."</p>
        <p style="${pStyle}">(AgInt no AREsp n. 2.039.729/RS, relator Ministro Moura Ribeiro, Terceira Turma, julgado em 9/5/2022, DJe de 11/5/2022.)</p>
        <p style="${pStyle}">Diante do exposto, inadmito o recurso especial interposto.</p>
    `;

    generateDocFromHtml(
        corpoMinuta,
        `Minuta_Intempestividade_${numeroProcesso.replace(/\D/g, '') || 'processo'}.doc`
    );
  };

  const gerarMinutaIntimacaoDecreto = async () => {
    const pStyle = "text-align: justify; text-indent: 50px; margin-bottom: 1em;";
    const corpoMinuta = `
        <p style="${pStyle}">Intime-se a parte Recorrente, nos termos dos artigos 1.003, § 6º c/c 224, §1, ambos do Código de Processo Civil, sob pena de ser reconhecida a intempestividade do recurso, para, no prazo de 5 (cinco) dias, comprovar a ocorrência do feriado local ou a determinação de suspensão do expediente ou do prazo recursal neste Tribunal de Justiça, por meio de documento idôneo, conforme publicado no Diário da Justiça Eletrônico (AgInt no AREsp n. 2.734.555/RJ, relator Ministro Humberto Martins, Terceira Turma, julgado em 16/12/2024, DJEN de 19/12/2024.).</p>
    `;
    generateDocFromHtml(
        corpoMinuta,
        `Minuta_Intimacao_Decreto_${numeroProcesso.replace(/\D/g, '') || 'processo'}.doc`
    );
  };

  const gerarMinutaFaltaDecreto = async () => {
    const { inicioPrazo, semDecreto } = resultado;
    const dataLeituraStr = formatarData(new Date(dataDisponibilizacao + 'T00:00:00'));
    const inicioPrazoStr = formatarData(inicioPrazo);
    const prazoFinalStr = formatarData(semDecreto.prazoFinal);

    const pStyle = "text-align: justify; text-indent: 50px; margin-bottom: 1em;";
    const corpoMinuta = `
        <p style="${pStyle}">Trata-se de recurso especial interposto em face do acórdão proferido pela <span style="color: red;">xxª Câmara Cível</span> deste Tribunal de Justiça, que negou provimento ao recurso de <span style="color: red;">xxx (mov. xx.1 - xxxx)</span>.</p>
        <p style="${pStyle}">A leitura da intimação do acórdão recorrido foi confirmada em ${dataLeituraStr} (<span style="color: red;">xxx - mov. xx</span>), de modo que o prazo de 15 (quinze) dias úteis para interposição de recursos aos Tribunais Superiores passou a fluir no dia ${inicioPrazoStr} e findou em ${prazoFinalStr}.</p>
        <p style="${pStyle}">Instada a comprovar o feriado local ou a determinação de suspensão do prazo neste Tribunal de Justiça, nos termos do artigo 1.003, § 6º, do Código de Processo Civil (despacho de <span style="color: red;">mov. xx.1</span>), a parte recorrente permaneceu inerte (certidão de decurso de prazo de <span style="color: red;">mov. xx.1</span>).</p>
        <p style="${pStyle}">Desse modo, é forçoso reconhecer a intempestividade do recurso especial, o que faço.</p>
        <p style="${pStyle}">Nesse sentido é o entendimento vigente no âmbito do Superior Tribunal de Justiça:</p>
        <p style="${pStyle}">"PROCESSUAL CIVIL. AGRAVO INTERNO NO AGRAVO EM RECURSO ESPECIAL. INTEMPESTIVIDADE DO RECURSO ESPECIAL. INCIDÊNCIA DO CPC DE 2015. FERIADO LOCAL E/OU SUSPENSÃO DE EXPEDIENTE FORENSE. QUESTÃO DE ORDEM NO ARESP 2.638.376/MG. ART. 1.003, § 6º, DO CPC/2015. INTIMAÇÃO PARA COMPROVAÇÃO POSTERIOR. DECURSO DO PRAZO. AGRAVO INTERNO DESPROVIDO. 1. A agravante foi intimada, nos termos da Questão de Ordem lavrada pela Corte Especial do Superior Tribunal de Justiça, no AREsp 2.638.376/MG, para comprovar, no prazo de 5 (cinco) dias úteis, a ocorrência de feriado local ou a suspensão de expediente forense, em consonância com a nova redação conferida pela Lei 14.939 /2024, ao art. 1.003, § 6º, do CPC, tendo deixado, contudo transcorrer in albis o prazo assinalado, conforme certidão de fl. 765. 2. Na hipótese dos autos, portanto, como não houve a juntada de documento comprobatório durante o iter processual, não é possível superar a intempestividade do apelo nobre. 3. Agravo interno a que se nega provimento." (AgInt no AREsp n. 2.710.026/MT, relator Ministro Raul Araújo, Quarta Turma, julgado em 14/4/2025, DJEN de 25/4/2025.)</p>
        <p style="${pStyle}">Diante do exposto, inadmito o recurso especial interposto.</p>
    `;

    generateDocFromHtml(
        corpoMinuta,
        `Minuta_Intempestivo_Falta_Decreto_${numeroProcesso.replace(/\D/g, '') || 'processo'}.doc`
    );
  };

  return (
    <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
        <UserIDWatermark overlay={true} />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Calculadora de Prazo Final</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Calcule o prazo final considerando as regras de contagem para cada matéria.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Matéria</label>
            <div className="flex rounded-lg shadow-sm">
              <button onClick={() => setTipoPrazo('civel')} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-l-lg ${tipoPrazo === 'civel' ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Cível</button>
              <button onClick={() => setTipoPrazo('crime')} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-r-lg border-l border-slate-300 dark:border-slate-600 ${tipoPrazo === 'crime' ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Crime</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Prazo</label>
            <div className="flex rounded-lg shadow-sm">
              <button onClick={() => setPrazoSelecionado(5)} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-l-lg ${prazoSelecionado === 5 ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>5 Dias</button>
              <button onClick={() => setPrazoSelecionado(15)} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 border-l border-slate-300 dark:border-slate-600 ${prazoSelecionado === 15 ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>15 Dias</button>
              <button onClick={() => setPrazoSelecionado(30)} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-r-lg border-l border-slate-300 dark:border-slate-600 ${prazoSelecionado === 30 ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>30 Dias</button>
            </div>
          </div>
        </div>
        <div>
            <label htmlFor="data-disponibilizacao" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Data de Disponibilização</label>
            <input
                type="date"
                id="data-disponibilizacao"
                value={dataDisponibilizacao}
                onChange={e => setDataDisponibilizacao(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
        </div>
        <div className="mt-4">
            <button onClick={handleCalcular} className="w-full flex justify-center items-center bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-md">Calcular Prazo Final</button>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 text-center">* O cálculo considera o calendário de feriados e recessos do TJPR para 2025.</p>
        {error && (
            <div className="mt-4 flex items-start gap-3 text-amber-800 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-900/30 p-4 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 3.001-1.742 3.001H4.42c-1.53 0-2.493-1.667-1.743-3.001l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                <p className="text-sm">{error}</p>
            </div>
        )}
        {resultado && (
            <div className="relative mt-6 p-4 border-t border-slate-200 dark:border-slate-700/50 animate-fade-in">
                {resultado.tipo === 'civel' && (
                    <>
                        {resultado.suspensoesComprovaveis.length > 0 ? (
                         <>
                            <div className="p-4 mb-4 text-sm text-orange-800 rounded-lg bg-orange-50 dark:bg-gray-800 dark:text-orange-400" role="alert">
                                <span className="font-medium">Atenção!</span> Foram identificadas suspensões de prazo no período que exigem comprovação nos autos. Marque abaixo as que foram comprovadas para recalcular o prazo.
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border-r md:pr-4">
                                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 text-center mb-2">Cenário 1: Sem Decreto</h3>
                                    <p className="text-center text-slate-600 dark:text-slate-300">O prazo final de {resultado.prazo} dias úteis é:</p> 
                                    <p className="text-center mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatarData(resultado.semDecreto.prazoFinal)}</p>
                                    {resultado.semDecreto.diasNaoUteis.length > 0 && <div className="mt-4 text-left"><p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Dias não úteis:</p><ul className="text-xs space-y-1"><GroupedDiasNaoUteis dias={resultado.semDecreto.diasNaoUteis} /></ul></div>}
                                </div>
                                <div className="border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 md:pl-4 pt-4 md:pt-0">
                                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 text-center mb-2">Cenário 2: Com Decreto</h3> 
                                    <p className="text-center text-slate-600 dark:text-slate-300">O prazo final, <strong>comprovando as suspensões</strong>, é:</p> 
                                    <p className="text-center mt-2 text-2xl font-bold text-green-600 dark:text-green-400">{formatarData(resultado.comDecreto.prazoFinal)}</p>
                                    
                                    {/* Mostra a seção de comprovação apenas se houver decretos comprováveis */}
                                    {resultado.suspensoesComprovaveis.length > 0 && (
                                        <div className="mt-4 text-left border-t border-slate-300 dark:border-slate-600 pt-2">
                                            <h4 className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2">Decretos que influenciaram na dilação do prazo:</h4>
                                             <div className="space-y-1">
                                                 {/* Lógica para agrupar o Feriado CNJ em uma única checkbox */}
                                                 {resultado.suspensoesComprovaveis.some(d => d.tipo === 'feriado_cnj') && (
                                                     <label className="flex items-center p-2 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700/50 transition-colors">
                                                         <input 
                                                             type="checkbox" 
                                                             checked={diasComprovados.has('2025-06-19') || diasComprovados.has('2025-06-20')} 
                                                             onChange={() => handleComprovacaoChange('2025-06-19')} 
                                                             className="h-4 w-4 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500" 
                                                         />
                                                         <span className="ml-2 text-xs text-slate-700 dark:text-slate-200">
                                                             <strong className="font-semibold">19/06 e 20/06/2025:</strong> Corpus Christi e Suspensão
                                                         </span>
                                                     </label>
                                                 )}
                                                 {/* Renderiza as outras suspensões normalmente */}
                                                 {resultado.suspensoesComprovaveis.filter(d => d.tipo !== 'feriado_cnj').map(dia => {
                                                     const dataString = dia.data.toISOString().split('T')[0];
                                                     return (
                                                         <label key={dataString} className="flex items-center p-2 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700/50 transition-colors"><input type="checkbox" checked={diasComprovados.has(dataString)} onChange={() => handleComprovacaoChange(dataString)} className="h-4 w-4 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500" /><span className="ml-2 text-xs text-slate-700 dark:text-slate-200"><strong className="font-semibold">{formatarData(dia.data)}:</strong> {dia.motivo}</span></label>
                                                     );
                                                 })}
                                             </div>
                                    </div>
                                    )}
                                </div>
                            </div>
                         </>
                        ) : (
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Resultado do Cálculo</h3>
                                <p className="text-slate-600 dark:text-slate-300">O prazo final de {resultado.prazo} dias úteis é:</p>
                                <p className="mt-2 text-3xl font-bold text-indigo-600 dark:text-indigo-400">{formatarData(resultado.semDecreto.prazoFinal)}</p>
                                {resultado.semDecreto.diasNaoUteis.length > 0 && <div className="mt-6 text-left border-t border-slate-300 dark:border-slate-600 pt-4"><p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Dias não úteis considerados no cálculo:</p><ul className="text-xs space-y-1"><GroupedDiasNaoUteis dias={resultado.semDecreto.diasNaoUteis} /></ul></div>}
                            </div>
                            
                        )}
                    </>
                )}
                {resultado && resultado.tipo === 'civel' && (userData?.role === 'intermediate' || userData?.role === 'admin') && (
                    <div className="mt-6 border-t border-slate-300 dark:border-slate-600 pt-4 animate-fade-in">
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Verificação de Tempestividade</h3>
                        <div>
                            <label htmlFor="data-interposicao" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Data de Interposição do Recurso</label>
                            <input type="date" id="data-interposicao" value={dataInterposicao} onChange={e => setDataInterposicao(e.target.value)} className="w-full md:w-1/2 px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                        </div>
                        {tempestividade && (
                            <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${tempestividade === 'tempestivo' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
                                {tempestividade === 'tempestivo' ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                )}
                                <div>
                                    <p className="font-bold">{tempestividade === 'tempestivo' ? 'RECURSO TEMPESTIVO' : 'RECURSO INTEMPESTIVO'}</p>
                                    <p className="text-sm">O recurso foi interposto {tempestividade === 'tempestivo' ? 'dentro do' : 'fora do'} prazo legal. O prazo final, considerando as suspensões selecionadas, é {formatarData(resultado.comDecreto.prazoFinal)}.</p>
                                </div>
                            </div>
                        )}
                        {tempestividade === 'puramente_intempestivo' && (
                            <div className="mt-4"><button onClick={gerarMinutaIntempestividade} className="w-full md:w-auto flex justify-center items-center bg-gradient-to-br from-red-500 to-red-600 text-white font-semibold py-2 px-5 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-md">Baixar Minuta (Intempestivo)</button></div>
                        )} 
                        {tempestividade === 'intempestivo_falta_decreto' && resultado.suspensoesComprovaveis.length > 0 && (
                            <div className="mt-4 space-y-4">
                                <div className="p-3 text-sm text-amber-800 rounded-lg bg-amber-50 dark:bg-gray-800 dark:text-amber-400" role="alert">
                                    <span className="font-medium">Atenção:</span> O recurso está intempestivo, a menos que as suspensões de prazo sejam comprovadas.
                                </div>
                                <div className="flex items-center gap-4 flex-wrap">
                                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Gerar outras minutas:</p>
                                    <div className="flex gap-3">
                                        <button onClick={gerarMinutaIntimacaoDecreto} className="flex-1 md:flex-auto justify-center flex items-center bg-gradient-to-br from-sky-500 to-sky-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-sky-600 hover:to-sky-700 transition-all duration-300 shadow-md text-sm">Intimação Decreto</button>
                                        <button onClick={gerarMinutaFaltaDecreto} className="flex-1 md:flex-auto justify-center flex items-center bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-md text-sm">Intempestivo Falta Decreto</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {resultado.tipo === 'crime' && (
                    <>
                        {resultado.decretoImpactou && ( <div className="p-4 mb-4 text-sm text-orange-800 rounded-lg bg-orange-50 dark:bg-gray-800 dark:text-orange-400" role="alert"><span className="font-medium">Atenção!</span> Foi identificado um decreto de suspensão de prazo no período. Verifique se o advogado juntou o decreto aos autos para comprovar a prorrogação.</div> )}
                        <div className={`grid grid-cols-1 ${resultado.decretoImpactou ? 'md:grid-cols-2' : ''} gap-4`}>
                            <div className={resultado.decretoImpactou ? 'border-r md:pr-4' : ''}>
                                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 text-center mb-2">{resultado.decretoImpactou ? "Cenário 1: Sem Decreto" : "Prazo Final"}</h3>
                                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-1 whitespace-nowrap">Publicação em {formatarData(resultado.dataPublicacaoSemDecreto)} / Início em {formatarData(resultado.inicioPrazoSemDecreto)}</p>
                                <p className="text-center text-slate-600 dark:text-slate-300">O prazo final de {resultado.prazo} dias úteis é:</p>
                                <p className="text-center mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatarData(resultado.semDecreto.prazoFinal)}</p>
                            </div>
                            {resultado.decretoImpactou && (
                                <div className="border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 md:pl-4 pt-4 md:pt-0">
                                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 text-center mb-2">Cenário 2: Com Decreto</h3>
                                    <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-1 whitespace-nowrap">Publicação em {formatarData(resultado.dataPublicacaoComDecreto)} / Início em {formatarData(resultado.inicioPrazoComDecreto)}</p>
                                    <p className="text-center text-slate-600 dark:text-slate-300">O prazo final de {resultado.prazo} dias úteis, <strong>comprovando o decreto</strong>, é:</p>
                                    <p className="text-center mt-2 text-2xl font-bold text-green-600 dark:text-green-400">{formatarData(resultado.comDecreto.prazoFinal)}</p>
                                    {resultado.comDecreto.diasNaoUteis.some(d => ['2025-06-19', '2025-06-20'].includes(d.data.toISOString().split('T')[0])) && (
                                        <div className="mt-4 p-3 text-xs text-blue-800 rounded-lg bg-blue-50 dark:bg-gray-800 dark:text-blue-400" role="alert"><span className="font-medium">Atenção:</span> A comprovação do feriado de Corpus Christi (19/06) e da suspensão do dia 20/06 é necessária para validar a prorrogação do prazo.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

            </div>
        )}
    </div>
  );
};

const GroupedDiasNaoUteis = ({ dias }) => {
    const groupedDias = [];
    let i = 0;
    while (i < dias.length) {
        const currentDay = dias[i];
        if (currentDay.tipo === 'recesso') {
            let j = i;
            // Agrupa dias de recesso consecutivos
            while (j + 1 < dias.length && dias[j + 1].tipo === 'recesso') {
                const date1 = new Date(dias[j].data);
                const date2 = new Date(dias[j + 1].data);
                date1.setDate(date1.getDate() + 1);
                if (date1.getTime() === date2.getTime()) {
                    j++;
                } else {
                    break;
                }
            }
            const startDate = dias[i].data;
            const endDate = dias[j].data;
            groupedDias.push({
                ...dias[i],
                id: `recesso-${i}-${j}`, 
                motivo: `Recesso Forense de ${formatarData(startDate)} até ${formatarData(endDate)}`,
                data: startDate, // Apenas para a chave
                tipo: 'recesso_grouped' // Tipo especial para renderização
            });
            i = j + 1;
        } else {
            groupedDias.push({...currentDay, id: i});
            i++;
        }
    }
    return groupedDias.map(dia => <DiaNaoUtilItem key={dia.id} dia={dia} />);
};

const DiaNaoUtilItem = ({ dia, as = 'li' }) => {
    let labelText = '';
    let labelClasses = '';

    switch (dia.tipo) {
        case 'decreto':
            labelText = 'Decreto TJPR';
            labelClasses = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            break;
        case 'feriado_cnj':
            labelText = 'Feriado CNJ';
            labelClasses = 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
            break;
        case 'instabilidade':
            labelText = 'Instabilidade';
            labelClasses = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            break;
        case 'feriado':
            labelText = 'Feriado Nacional';
            labelClasses = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            break;
        case 'recesso':
            labelText = 'Recesso';
            labelClasses = 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
            break;
        case 'recesso_grouped':
            labelText = 'Recesso';
            labelClasses = 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
            break;
    }

    const Tag = as;

    if (Tag === 'tr') {
        return (
            <tr className="border-b last:border-b-0 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{formatarData(dia.data)}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{dia.motivo}</td>
                <td className="px-4 py-3 text-right">
                    {labelText && <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${labelClasses}`}>{labelText}</span>}
                </td>
            </tr>
        );
    }

    return (
        <Tag className="flex items-center justify-between p-2 bg-slate-100/70 dark:bg-slate-900/50 rounded-md text-slate-700 dark:text-slate-200">
            <div className="flex-grow">
                {dia.tipo === 'recesso_grouped' 
                    ? <span className="text-sm">{dia.motivo}</span> 
                    : <span className="text-sm"><strong className="font-semibold text-slate-900 dark:text-white">{formatarData(dia.data)}:</strong> {dia.motivo}</span>}
            </div>
            {labelText && <span className={`ml-3 flex-shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full ${labelClasses}`}>{labelText}</span>}
        </Tag>
    );
};

const LoginPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [setorId, setSetorId] = useState(''); // Novo estado para o setor
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [rememberedUser, setRememberedUser] = useState(null);
    const [setores, setSetores] = useState([]); // Novo estado para a lista de setores
    const [isCreatingNewSector, setIsCreatingNewSector] = useState(false);

    // Busca os setores do Firestore quando o modo de registro é ativado
    useEffect(() => {
        if (!isLogin && db) {
            const fetchSetores = async () => {
                try {
                    const snapshot = await db.collection('setores').orderBy('nome').get();
                    const setoresList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setSetores(setoresList);
                } catch (err) {
                    console.error("Erro ao buscar setores para o registro:", err);
                    setError("Não foi possível carregar a lista de setores.");
                }
            };
            fetchSetores();
        }
    }, [isLogin]);
    const handlePasswordReset = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (!email) {
            setError('Por favor, insira o seu e-mail para redefinir a palavra-passe.');
            return;
        }
        const finalEmail = email.includes('@') ? email : `${email}@tjpr.jus.br`;
        try {
            await auth.sendPasswordResetEmail(finalEmail);
            setMessage('Link para redefinição de senha enviado. Verifique sua caixa de entrada e a pasta de Lixo Eletrônico/Spam.');
            setIsResettingPassword(false);
        } catch (err) {
             setError('Falha ao enviar e-mail. Verifique se o e-mail está correto e tente novamente.');
        }
    };
    
    useEffect(() => {
        const lastUserEmail = localStorage.getItem('lastUserEmail');
        if (lastUserEmail) {
            setRememberedUser(lastUserEmail);
            setEmail(lastUserEmail.split('@')[0]);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');


        if (!email.trim()) {
            setError("Por favor, insira o seu nome de utilizador.");
            return;
        }
        if (!auth) {
            setError("Serviço de autenticação não disponível.");
            return;
        }

        try {
            const finalEmail = email.includes('@') ? email : `${email}@tjpr.jus.br`;
            if (isLogin) {
                await auth.signInWithEmailAndPassword(finalEmail, password);
                localStorage.setItem('lastUserEmail', finalEmail);
            } else {
                // Validação do setor na tela de registro
                if (!setorId) {
                    setError("Por favor, selecione um setor.");
                    return;
                }

                const userCredential = await auth.createUserWithEmailAndPassword(finalEmail, password);
                await db.collection('users').doc(userCredential.user.uid).set({ 
                    email: finalEmail, 
                    role: 'basic', 
                    displayName: displayName.trim(),
                    setorId: setorId // Adiciona o setor selecionado
                });

                // 3. Executa outras tarefas (atualizar perfil e enviar e-mail)
                await userCredential.user.updateProfile({ displayName: displayName.trim() });
                await userCredential.user.sendEmailVerification();

                setMessage("Conta criada! Enviamos um link de verificação para o seu e-mail.");
            }
        } catch (err) {
            switch (err.code) {
                case 'auth/email-already-in-use': setError('Este e-mail já está registado. Tente fazer login ou redefinir a sua palavra-passe.'); break;
                case 'auth/user-not-found': setError('Nenhuma conta encontrada com este e-mail. Verifique o e-mail ou crie uma nova conta.'); break;
                case 'auth/wrong-password': setError('Palavra-passe incorreta. Tente novamente ou redefina a sua palavra-passe.'); break;
                case 'auth/weak-password': setError('A palavra-passe deve ter pelo menos 6 caracteres.'); break;
                case 'auth/invalid-email': setError('O formato do e-mail é inválido.'); break;
                default: setError('Ocorreu um erro. Tente novamente.'); 
                    console.error("Erro de autenticação:", err);
            }
        }
    };

    if (isResettingPassword) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-full max-w-md p-8 space-y-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-lg">
                    <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-slate-100">Redefinir Palavra-passe</h2>
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400">Insira o seu e-mail para receber um link de redefinição.</p>
                    <form onSubmit={handlePasswordReset} className="space-y-6">
                        <input type="email" placeholder="Email Completo (ex: seu.usuario@tjpr.jus.br)" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                        <button type="submit" className="w-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 shadow-md">Enviar Link</button>
                    </form>
                    {error && <p className="text-sm text-center text-red-500">{error}</p>}
                    {message && <p className="text-sm text-center text-green-500">{message}</p>}
                    <p className="text-center text-sm">
                        <a href="#" onClick={(e) => { e.preventDefault(); setIsResettingPassword(false); setError(''); }} className="font-medium text-indigo-600 hover:text-indigo-500">Voltar para o Login</a>
                    </p>
                </div>                
            </div>
        );
    }

    const handleSwitchAccount = (e) => {
        e.preventDefault();
        setRememberedUser(null);
        setEmail('');
        setPassword('');
        setError('');
        localStorage.removeItem('lastUserEmail');
    };

    const handleToggleMode = (e) => {
        e.preventDefault();
        const newIsLogin = !isLogin;
        setIsLogin(newIsLogin);
        setError('');
        if (!newIsLogin) { // Se estiver mudando para a tela de registro
            fetchSetores();
        }
    };

    return (
        <div className="flex items-center justify-center h-full">
            <div className="w-full max-w-md p-8 space-y-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-lg">
                {rememberedUser && isLogin ? (
                    <>
                        <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-slate-100">Bem-vindo de volta!</h2>
                        <div className="text-center p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100/50 dark:bg-slate-900/50">
                            <p className="font-medium text-slate-700 dark:text-slate-200">{rememberedUser}</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input type="password" placeholder="Palavra-passe" value={password} onChange={e => setPassword(e.target.value)} required autoFocus className="w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                            <div className="flex items-center justify-between text-sm">
                                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/>Lembrar-me</label>
                                <a href="#" onClick={(e) => { e.preventDefault(); setIsResettingPassword(true); setError(''); }} className="font-medium text-indigo-600 hover:text-indigo-500">Esqueceu a sua palavra-passe?</a>
                            </div>
                            <button type="submit" className="w-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 shadow-md">Entrar</button>
                        </form>
                        {error && <p className="text-sm text-center text-red-500 pt-2">{error}</p>}
                        {message && !error && <p className="text-sm text-center text-green-500 pt-2">{message}</p>}
                        <p className="text-center text-sm text-slate-500 dark:text-slate-400 pt-2">
                            <a href="#" onClick={handleSwitchAccount} className="font-medium text-indigo-600 hover:text-indigo-500">Não é você? Use outra conta</a>
                        </p>
                    </>
                ) : (
                    <>
                        <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-slate-100">{isLogin ? 'Login' : 'Criar Conta'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!isLogin && <input type="text" placeholder="Nome Completo" value={displayName} onChange={e => setDisplayName(e.target.value)} required className="w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />}
                            {!isLogin && 
                                <>
                                    <select value={setorId} onChange={e => setSetorId(e.target.value)} required className="w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition">
                                        <option value="" disabled>Selecione um Setor</option>
                                        {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                    </select>
                                    <p className="text-xs text-center text-slate-500 dark:text-slate-400">Se o seu setor não estiver na lista, peça para um administrador cadastrá-lo.</p>
                                </>
                            }
                            <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition">
                                <input type="text" placeholder="seu.usuario" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 bg-transparent border-0 outline-none" />
                                <span className="px-4 py-3 bg-slate-100/50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 rounded-r-lg">
                                    @tjpr.jus.br
                                </span>
                            </div>
                            <input type="password" placeholder="Palavra-passe" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                            <div className="flex items-center justify-between text-sm">
                                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/>Lembrar-me</label>
                                <a href="#" onClick={(e) => { e.preventDefault(); setIsResettingPassword(true); setError(''); }} className="font-medium text-indigo-600 hover:text-indigo-500">Esqueceu a sua palavra-passe?</a>
                            </div>
                            <button type="submit" className="w-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 shadow-md">{isLogin ? 'Entrar' : 'Registrar'}</button>
                        </form>
                        {error && <p className="text-sm text-center text-red-500 pt-2">{error}</p>}
                        {message && <p className="text-sm text-center text-green-500 pt-2">{message}</p>}
                        <p className="text-center text-sm text-slate-500 dark:text-slate-400 pt-2">
                            <a href="#" onClick={handleToggleMode} className="font-medium text-indigo-600 hover:text-indigo-500">
                                {isLogin ? 'Não tem uma conta? Crie uma aqui.' : 'Já tem uma conta? Faça login.'}
                            </a>
                        </p>
                    </>
                )}
            </div>
         </div>
    )
};

const VerifyEmailPage = () => {
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [error, setError] = useState(''); // Corrigido: 'refreshUser' vem do contexto
    const { refreshUser } = useAuth();
    const [isResending, setIsResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [initialCooldown, setInitialCooldown] = useState(60);

    useEffect(() => {
        let timer;
        if (initialCooldown > 0) {
            timer = setTimeout(() => setInitialCooldown(initialCooldown - 1), 1000);
        } else if (cooldown > 0) {
            timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [initialCooldown, cooldown]);

    const handleResend = async () => {
        if (isResending || cooldown > 0 || initialCooldown > 0) return;
        setIsResending(true);
        setMessage('');
        setError('');
        if (!user) {
            setIsResending(false);
            return;
        }
        try {
            await user.sendEmailVerification();
            setMessage('Um novo e-mail de verificação foi enviado.');
            setCooldown(30); // Inicia um cooldown de 30 segundos
        } catch (err) {
            if (err.code === 'auth/too-many-requests') {
                setError('Muitas tentativas. Por favor, aguarde um pouco antes de tentar novamente.');
            } else {
                setError('Ocorreu um erro ao reenviar o e-mail.');
            }
        } finally {
            setIsResending(false);
        }
    };
    
    const handleCheckVerification = async () => {
        setMessage('Verificando status...');
        await refreshUser();
        // O listener onAuthStateChanged vai redirecionar se o email estiver verificado.
        // Se não, mostramos uma mensagem.
        setTimeout(() => {
            if (!auth.currentUser?.emailVerified) {
                setMessage('A sua conta ainda não foi verificada. Por favor, clique no link enviado para o seu e-mail.');
            }
        }, 2000);
    };

    return (
         <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative">
            <div className="w-full max-w-md p-8 space-y-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-lg text-center">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Verifique o seu E-mail</h2>
                <p className="text-slate-600 dark:text-slate-300">
                    Enviamos um link de verificação para <strong>{user?.email}</strong>. Por favor, clique no link para ativar a sua conta.
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 p-3 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg">Se não encontrar na sua caixa de entrada, <strong>verifique a pasta de Lixo Eletrônico/Spam</strong>. O e-mail pode demorar alguns minutos para chegar.</p>
                <div className="space-y-4">
                    <button onClick={handleCheckVerification} className="w-full bg-gradient-to-br from-green-500 to-green-600 text-white font-semibold py-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300 shadow-md">Já verifiquei, atualizar status</button>
                    <button onClick={handleResend} disabled={isResending || cooldown > 0 || initialCooldown > 0} className="w-full bg-slate-500 text-white font-semibold py-3 rounded-lg hover:bg-slate-600 transition-all duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed">{isResending ? 'A enviar...' : initialCooldown > 0 ? `Aguarde ${initialCooldown}s para reenviar` : (cooldown > 0 ? `Aguarde ${cooldown}s` : 'Reenviar E-mail de Verificação')}</button>
                    <button onClick={() => auth.signOut()} className="w-full bg-slate-200 text-slate-700 font-semibold py-3 rounded-lg hover:bg-slate-300 transition-all duration-300">
                        Voltar para o Login
                    </button>
                </div>
                 {message && <p className="text-sm text-center text-green-500">{message}</p>}
                 {error && <p className="text-sm text-center text-red-500">{error}</p>}
            </div>
            <CreditsWatermark />
        </div>
    )
};

const CalendarioModal = ({ onClose }) => {
    const { settings } = useContext(SettingsContext);
    const { feriadosMap, decretosMap, instabilidadeMap, calendarLoading } = settings;

    // CORREÇÃO: A função formatData agora lida com o fato de que o 'motivo' pode ser uma string ou um objeto.
    const formatData = (map, defaultTipo) => {
        return Object.entries(map).map(([data, value]) => {
            if (typeof value === 'object' && value.motivo && value.tipo) {
                // Se for um objeto (como o Feriado CNJ), usa os dados do objeto.
                return { data, motivo: value.motivo, tipo: value.tipo };
            }
            // Caso contrário, trata como uma string simples.
            return { data, motivo: value, tipo: defaultTipo };
        });
    };

    const todosDiasNaoUteis = [
        ...formatData(feriadosMap, 'feriado'),
        ...formatData(decretosMap, 'decreto'),
        ...formatData(instabilidadeMap, 'instabilidade'),
    ].sort((a, b) => new Date(a.data) - new Date(b.data));

    const diasAgrupadosPorMes = todosDiasNaoUteis.reduce((acc, dia) => {
        const mes = new Date(dia.data + 'T00:00:00').toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
        const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);
        if (!acc[mesCapitalizado]) {
            acc[mesCapitalizado] = [];
        }
        acc[mesCapitalizado].push(dia);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Calendário de Suspensões 2025</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="overflow-y-auto px-6 pb-6">
                    <div className="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-lg mb-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Recesso Forense</h3>
                        <ul className="space-y-2">
                            <DiaNaoUtilItem dia={{ tipo: 'recesso_grouped', motivo: `Recesso de 02/01/2025 até 20/01/2025` }} />
                            <DiaNaoUtilItem dia={{ tipo: 'recesso_grouped', motivo: `Recesso de 20/12/2025 até 30/12/2025` }} />
                        </ul>
                    </div>

                    {calendarLoading ? (
                        <p className="text-center text-slate-500 dark:text-slate-400">Carregando calendário...</p>
                    ) : Object.keys(diasAgrupadosPorMes).length === 0 ? (
                        <p className="text-center text-slate-500 dark:text-slate-400">Nenhuma suspensão encontrada no calendário.</p>
                    ) : (
                        Object.entries(diasAgrupadosPorMes).map(([mes, dias]) => (
                            <div key={mes} className="mb-6">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3">{mes}</h3>
                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-700 dark:text-slate-200 uppercase bg-slate-100 dark:bg-slate-700/50">
                                            <tr><th className="px-4 py-3 w-[120px]">Data</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3 w-[180px] text-right">Tipo</th></tr>
                                        </thead>
                                        <tbody>
                                            {dias.map(dia => <DiaNaoUtilItem key={dia.data} dia={{ ...dia, data: new Date(dia.data + 'T00:00:00') }} as="tr" />)}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const CalendarioAdminPage = () => {
    const { refreshCalendar } = useContext(SettingsContext);
    const [config, setConfig] = useState(null);
    const [allEntries, setAllEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editando, setEditando] = useState(null); // Guarda o item sendo editado
    const [novaEntrada, setNovaEntrada] = useState({ data: '', motivo: '', tipo: 'feriado' });

    const fetchCalendarConfig = useCallback(async () => {
        setLoading(true);
        try {
            const docRef = db.collection('configuracoes').doc('calendario');
            const doc = await docRef.get();
            if (!doc.exists) {
                setError("Documento de configuração do calendário não encontrado.");
                setLoading(false);
                return;
            }
            const data = doc.data();
            setConfig(data);

            // Processa os dados para uma lista única para a UI
            const year = new Date().getFullYear();
            const entries = [];
            // Adiciona feriados recorrentes
            data.feriadosNacionaisRecorrentes?.forEach(f => {
                const dataStr = `${year}-${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`;
                entries.push({ id: dataStr, data: dataStr, motivo: f.motivo, tipo: 'feriado', isRecurring: true });
            });
            // Adiciona exceções anuais
            Object.keys(data.excecoesAnuais || {}).forEach(yearKey => {
                data.excecoesAnuais[yearKey].forEach(e => {
                    entries.push({ id: e.data, data: e.data, motivo: e.motivo, tipo: e.tipo, isRecurring: false });
                });
            });
            
            entries.sort((a, b) => new Date(a.data) - new Date(b.data));
            setAllEntries(entries);

        } catch (err) {
            setError('Falha ao carregar a configuração do calendário.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCalendarConfig();
    }, [fetchCalendarConfig]);

    const handleSave = async (e) => {
        e.preventDefault();
        const item = editando || novaEntrada;
        if (!item.data || !item.motivo || !item.tipo) {
            setError('Todos os campos são obrigatórios.');
            return;
        }

        setIsSaving(true);
        setError('');
        const updatedConfig = JSON.parse(JSON.stringify(config)); // Deep copy
        const year = item.data.split('-')[0];

        // Remove a entrada antiga se estiver editando
        if (editando) {
            const oldYear = editando.id.split('-')[0];
            if (updatedConfig.excecoesAnuais[oldYear]) {
                updatedConfig.excecoesAnuais[oldYear] = updatedConfig.excecoesAnuais[oldYear].filter(ex => ex.data !== editando.id);
            }
        }

        // Adiciona a nova/atualizada entrada
        if (!updatedConfig.excecoesAnuais[year]) {
            updatedConfig.excecoesAnuais[year] = [];
        }
        updatedConfig.excecoesAnuais[year].push({ data: item.data, motivo: item.motivo, tipo: item.tipo });
        updatedConfig.excecoesAnuais[year].sort((a, b) => new Date(a.data) - new Date(b.data));

        try {
            await db.collection('configuracoes').doc('calendario').set(updatedConfig);
            setNovaEntrada({ data: '', motivo: '', tipo: 'feriado' });
            setEditando(null);
            await fetchCalendarConfig(); // Recarrega tudo
            await refreshCalendar();
        } catch (err) {
            setError('Falha ao salvar a entrada.');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (itemToDelete) => {
        if (itemToDelete.isRecurring) {
            alert("Feriados nacionais recorrentes não podem ser excluídos por esta interface.");
            return;
        }
        if (!window.confirm(`Tem certeza que deseja excluir a entrada para ${itemToDelete.data}?`)) return;

        setIsSaving(true);
        const updatedConfig = JSON.parse(JSON.stringify(config));
        const year = itemToDelete.data.split('-')[0];

        if (updatedConfig.excecoesAnuais[year]) {
            updatedConfig.excecoesAnuais[year] = updatedConfig.excecoesAnuais[year].filter(ex => ex.data !== itemToDelete.data);
        }

        try {
            await db.collection('configuracoes').doc('calendario').set(updatedConfig);
            await fetchCalendarConfig();
            await refreshCalendar();
        } catch (err) {
            setError('Falha ao excluir a entrada.');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (editando) {
            setEditando(prev => ({ ...prev, [name]: value }));
        } else {
            setNovaEntrada(prev => ({ ...prev, [name]: value }));
        }
    };

    const renderForm = () => {
        const item = editando || novaEntrada;
        return (
            <form onSubmit={handleSave} className="p-6 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg space-y-4">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{editando ? `Editando ${editando.id}` : 'Adicionar Nova Data'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-medium text-slate-500">Data</label>
                        <input type="date" name="data" value={item.data} onChange={handleInputChange} disabled={!!editando} required className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 disabled:bg-slate-200 dark:disabled:bg-slate-800"/>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-medium text-slate-500">Motivo</label>
                        <input type="text" name="motivo" value={item.motivo} onChange={handleInputChange} required className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"/>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500">Tipo</label>
                        <select name="tipo" value={item.tipo} onChange={handleInputChange} required className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700">
                            <option value="feriado">Feriado</option>
                            <option value="decreto">Decreto</option>
                            <option value="instabilidade">Instabilidade</option>
                        </select>
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    {editando && <button type="button" onClick={() => setEditando(null)} className="px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancelar</button>}
                    <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                        {isSaving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
            </form>
        );
    };

    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gerenciamento do Calendário</h2>
            {renderForm()}
            <div className="space-y-8">
                {loading ? (
                    <p className="text-center text-slate-500 dark:text-slate-400">Carregando calendário...</p>
                ) : (
                    ['feriado', 'decreto', 'instabilidade'].map(tipo => {
                        const itemsFiltrados = allEntries.filter(item => item.tipo === tipo);
                        if (itemsFiltrados.length === 0) return null;

                        const titulos = { feriado: 'Feriados', decreto: 'Decretos', instabilidade: 'Instabilidades' };
                        const tituloCores = {
                            feriado: 'text-blue-700 dark:text-blue-400',
                            decreto: 'text-red-700 dark:text-red-400',
                            instabilidade: 'text-amber-600 dark:text-amber-400'
                        };

                        return (
                            <div key={tipo} className="space-y-3">
                                <h3 className={`text-xl font-bold ${tituloCores[tipo]}`}>{titulos[tipo]}</h3>
                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-200/50 dark:bg-slate-800/50">
                                            <tr>
                                                <th className="px-4 py-3">Data</th>
                                                <th className="px-4 py-3">Motivo</th>
                                                <th className="px-4 py-3 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {itemsFiltrados.map(item => (
                                                <tr key={item.id} className="border-b border-slate-200/50 dark:border-slate-700/50 last:border-b-0">
                                                    <td className="px-4 py-3 font-medium">{formatarData(new Date(item.data + 'T00:00:00'))}</td>
                                                    <td className="px-4 py-3">{item.motivo}</td>
                                                    <td className="px-4 py-3 text-right space-x-2">
                                                        {item.isRecurring ? (
                                                            <span className="text-xs text-slate-400 italic">Fixo</span>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => setEditando(item)} className="font-semibold text-indigo-600 hover:text-indigo-500">Editar</button>
                                                                <button onClick={() => handleDelete(item)} className="font-semibold text-red-600 hover:text-red-500">Excluir</button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

const Avatar = ({ user, userData, size = 'h-8 w-8' }) => {
    if (!user || !userData) return null;

    const getInitials = (name) => {
        if (!name) return '?';
        const names = name.trim().split(' ');
        if (names.length > 1) {
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    if (userData.photoURL) {
        return <img src={userData.photoURL} alt="Avatar" className={`${size} rounded-full object-cover`} />;
    }

    return (
        <div className={`${size} rounded-full flex items-center justify-center text-white font-bold text-sm`} style={{ backgroundColor: userData.avatarColor || '#6366F1' }}>
            {getInitials(userData.displayName)}
        </div>
    );
};
const AdminPage = ({ setCurrentArea }) => {
     const { user } = useAuth();
     // Estado para controlar a visão dentro da página de Admin: 'stats', 'calendar', 'users'
     const [adminSection, setAdminSection] = useState('stats'); // 'stats', 'calendar' ou 'users'

     const [stats, setStats] = useState({ total: 0, perMateria: {}, perPrazo: {}, byDay: {} });
     const [statsView, setStatsView] = useState('calculadora'); // 'calculadora' ou 'djen_consulta'
     const [allData, setAllData] = useState([]);
     const [viewData, setViewData] = useState([]);
     const [filteredData, setFilteredData] = useState([]);
     const [loading, setLoading] = useState(true);
     const [filters, setFilters] = useState({ startDate: '', endDate: '', email: 'todos', materia: 'todos', prazo: 'todos', userId: '' });
     const [allUsers, setAllUsers] = useState([]);
     const [hasSearched, setHasSearched] = useState(false);
     const [currentPage, setCurrentPage] = useState(1);
     const [selectedUserForStats, setSelectedUserForStats] = useState(null);
     // Estados para gerenciamento de usuários
     const [allUsersForManagement, setAllUsersForManagement] = useState([]);
     const [userManagementLoading, setUserManagementLoading] = useState(false);
     const [userSearchTerm, setUserSearchTerm] = useState('');
     const [editingUser, setEditingUser] = useState(null); // Para o modal de permissões
     const { userData: adminUserData } = useAuth(); // Dados do admin logado
     const [expandedSector, setExpandedSector] = useState(null);
     const [expandedUserSectors, setExpandedUserSectors] = useState(new Set());
     const [setores, setSetoresAdmin] = useState([]); // This was a typo, corrected in a previous step but good to double check.
     const [newSectorName, setNewSectorName] = useState('');

     const ITEMS_PER_PAGE = 10;
     
    useEffect(() => {
        let isMounted = true;
        if (!db) { setLoading(false); return; }
        setLoading(true);

        // Função para buscar e processar os dados de uso
        const fetchData = async () => {
            try {
                const [usageSnapshot, usersSnapshot] = await Promise.all([
                    db.collection('usageStats').orderBy('timestamp', 'desc').get(),
                    db.collection('users').get()
                ]);

                const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const usersMap = usersSnapshot.docs.reduce((acc, doc) => {
                    acc[doc.id] = doc.data();
                    return acc;
                }, {});

                let usageData = usageSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

                // Se o usuário for um admin de setor, filtra os dados de uso para seu setor.
                if (adminUserData.role === 'setor_admin' && adminUserData.setorId) {
                    const userIdsInSector = usersList
                        .filter(u => u.setorId === adminUserData.setorId)
                        .map(u => u.id);
                    usageData = usageData.filter(d => userIdsInSector.includes(d.userId));
                }

                const enrichedData = usageData.map(d => ({...d, userName: usersMap[d.userId]?.displayName || usersMap[d.userId]?.email || d.userEmail }));

                if (isMounted) {
                    setAllData(enrichedData);
                    setAllUsers([...new Set(enrichedData.map(item => item.userName))].filter(Boolean).sort());
                    setLoading(false);
                }
            } catch (err) { console.error("Firebase query error:", err); if(isMounted) setLoading(false); }
        };
        fetchData();
        return () => { isMounted = false; };
     }, []); // Executa apenas uma vez

     const fetchAllUsersForManagement = async () => {
        setUserManagementLoading(true);
        try {
            let query = db.collection('users').orderBy('displayName');
            
            // Se o usuário for um 'setor_admin', filtra para ver apenas usuários do seu setor.
            if (adminUserData.role === 'setor_admin' && adminUserData.setorId) {
                query = query.where('setorId', '==', adminUserData.setorId);
            }

            const snapshot = await query.get();
            const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllUsersForManagement(usersList);
        } catch (err) {
            console.error("Erro ao buscar usuários para gerenciamento:", err);
            if (err.code === 'permission-denied') {
                alert("Você não tem permissão para visualizar todos os usuários.");
            }
        } finally {
            setUserManagementLoading(false);
        }
    };

    const fetchSetores = async () => {
        if (!db) return;
        try {
            const snapshot = await db.collection('setores').orderBy('nome').get();
            const setoresList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSetoresAdmin(setoresList);
        } catch (err) {
            console.error("Erro ao buscar setores:", err);
        }
    };

    const handleDeleteSector = async (sectorId) => {
        if (window.confirm("Tem certeza que deseja excluir este setor? Esta ação não pode ser desfeita.")) {
            await db.collection('setores').doc(sectorId).delete();
            fetchSetores(); // Recarrega a lista
        }
    };

    const handleAddSector = async (e) => {
        e.preventDefault();
        if (!newSectorName.trim()) return;
        try {
            await db.collection('setores').add({ nome: newSectorName.trim() });
            setNewSectorName('');
            fetchSetores(); // Recarrega a lista de setores
        } catch (err) {
            console.error("Erro ao adicionar setor:", err);
            alert("Falha ao adicionar setor.");
        }
    };

    const UserManagementModal = ({ user, setores, adminUser, onClose, onSave }) => {
        const [role, setRole] = useState(user.role);
        const [setorId, setSetorId] = useState(user.setorId || '');
        const [isSaving, setIsSaving] = useState(false);

        const handleSave = async () => {
            setIsSaving(true);
            try {
                await onSave(user.id, { role, setorId });
                onClose();
            } catch (err) {
                console.error("Erro ao salvar permissões:", err);
                alert("Falha ao salvar. Verifique o console.");
            } finally {
                setIsSaving(false);
            }
        };

        const canChangeToAdmin = adminUser.role === 'admin';

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
                <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Gerenciar Usuário</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{user.displayName || user.email}</p>
                        </div>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Permissão</label>
                            <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-2 text-sm rounded-md bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700">
                                <option value="basic">Básico</option>
                                <option value="intermediate">Intermediário</option>
                                <option value="setor_admin">Chefe de Gabinete</option>
                                {canChangeToAdmin && <option value="admin">Admin Global</option>}
                            </select>
                            {!canChangeToAdmin && role === 'admin' && <p className="text-xs text-amber-600 mt-1">Você não pode rebaixar um Admin Global.</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Setor</label>
                            <select value={setorId} onChange={e => setSetorId(e.target.value)} className="w-full p-2 text-sm rounded-md bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700">
                                <option value="">Nenhum</option>
                                {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500">
                            Cancelar
                        </button>
                        <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {isSaving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const handleDeleteUser = async (userToDelete) => {
        const confirmationMessage = `Você tem certeza que deseja excluir o usuário ${userToDelete.displayName || userToDelete.email}? \n\nTodos os dados deste usuário serão apagados permanentemente e a ação não pode ser desfeita.`;
        if (window.confirm(confirmationMessage)) {
            if (!db) {
                alert("Serviço de banco de dados não disponível.");
                return;
            }
            try {
                // Exclui o documento do usuário da coleção 'users'.
                // Nota: Isso NÃO exclui o usuário do Firebase Authentication. Para isso,
                // seria necessária uma Cloud Function com o Admin SDK.
                await db.collection('users').doc(userToDelete.id).delete();
                alert("Usuário excluído com sucesso.");
                fetchAllUsersForManagement(); // Recarrega a lista de usuários
            } catch (err) {
                console.error("Erro ao excluir usuário:", err);
                alert("Falha ao excluir o usuário. Verifique o console para mais detalhes.");
            }
        }
    };

    const handleOpenUserManagementModal = (user) => {
        // Apenas admins globais podem editar outros admins globais
        if (user.role === 'admin' && adminUserData.role !== 'admin') {
            alert("Você não tem permissão para gerenciar um Administrador Global.");
            return;
        }
        setEditingUser(user);
    };

    const handleSaveUserPermissions = async (userId, data) => {
        if (!db) {
            alert("Serviço de banco de dados não disponível.");
            return;
        }
        // Atualiza o documento do usuário com a nova role e setorId
        await db.collection('users').doc(userId).update(data);
    };

    const handleCloseUserManagementModal = () => {
        setEditingUser(null);
        fetchAllUsersForManagement(); // Sempre recarrega a lista ao fechar o modal
    };

    const handleSectorChange = async (userId, newSectorId) => {
        if (!db) return;
        try {
            await db.collection('users').doc(userId).update({ setorId: newSectorId });
            fetchAllUsersForManagement(); // Recarrega para mostrar a mudança
        } catch (err) {
            console.error("Erro ao alterar setor:", err);
            alert("Falha ao alterar o setor do usuário.");
        }
    };

    const handleManualVerification = async (userId) => {
        if (window.confirm("Tem certeza que deseja verificar manualmente o e-mail deste usuário?")) {
            if (!db) return;
            try {
                await db.collection('users').doc(userId).update({ emailVerified: true });
                alert("Usuário verificado com sucesso.");
                fetchAllUsersForManagement();
            } catch (err) {
                console.error("Erro na verificação manual:", err);
                alert("Falha ao verificar o usuário.");
            }
        }
    };

    const handleManualPasswordReset = async (user) => {
        if (window.confirm(`Deseja enviar um link de redefinição de senha para ${user.email}?`)) {
            await auth.sendPasswordResetEmail(user.email);
            alert("E-mail de redefinição de senha enviado.");
        }
    };

    const toggleUserSectorExpansion = (sectorId) => {
        setExpandedUserSectors(prev => {
            const newSet = new Set(prev);
            newSet.has(sectorId) ? newSet.delete(sectorId) : newSet.add(sectorId);
            return newSet;
        });
    };

     useEffect(() => {
        if (adminSection === 'users') {
            fetchAllUsersForManagement();
            fetchSetores();
        }
     }, [adminSection, adminUserData]); // Adiciona adminUserData como dependência
     
    useEffect(() => {
        // Filtra os dados brutos com base na visualização selecionada (Calculadora ou Consulta)
        const dataForView = allData.filter(item => (item.type || 'calculadora') === statsView);
        setViewData(dataForView);
        // Reseta os filtros e resultados ao trocar de aba
        setHasSearched(false);
        setFilteredData([]);
    }, [statsView, allData]);

    const handleFilter = () => {
        let usageData = viewData.filter(item => {
            const itemDate = item.timestamp.toDate();
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                if (itemDate < startDate) return false;
            }
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                // Ajusta a data final para o fim do dia (23:59:59) para incluir todos os registros do dia selecionado.
                endDate.setHours(23, 59, 59, 999);
                if (itemDate > endDate) return false;
            }
            if(filters.materia !== 'todos' && item.materia !== filters.materia) return false;
            if(filters.prazo !== 'todos' && item.prazo != filters.prazo) return false;
            if(filters.email !== 'todos' && (item.userName !== filters.email && item.userEmail !== filters.email)) return false;
            if(filters.userId && item.userId !== filters.userId) return false;
            return true;
        });
        setCurrentPage(1);
        setSelectedUserForStats(null);
        setFilteredData(usageData);
        setHasSearched(true); // Marca que uma busca foi feita

        const summary = {
            total: usageData.length,
            perMateria: usageData.reduce((acc, curr) => { acc[curr.materia] = (acc[curr.materia] || 0) + 1; return acc; }, {}),
            perPrazo: usageData.reduce((acc, curr) => { acc[curr.prazo] = (acc[curr.prazo] || 0) + 1; return acc; }, {}),
        };

        // Lógica para o gráfico dos últimos 7 dias
        const today = new Date();
        const last7Days = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateString = formatarData(d);
            last7Days[dateString] = 0;
        }
        usageData.forEach(item => { const dateString = formatarData(item.timestamp.toDate()); if (dateString in last7Days) { last7Days[dateString]++; } });
        summary.byDay = last7Days
        setStats(summary);
    };

    const handleUserClick = (userEmail) => {
        const userData = allData.filter(item => item.userEmail === userEmail);
        const userName = userData.length > 0 ? (userData[0].userName || userEmail) : userEmail;
        setSelectedUserForStats({ email: userEmail, name: userName, data: userData }); // 'name' aqui é o userName ou email
    };

    const handleFilterChange = (e) => {
        setFilters({...filters, [e.target.name]: e.target.value });
    };
    
    const handleExport = () => {
        const dataToExport = (selectedUserForStats ? selectedUserForStats.data : filteredData).map(item => ({
            'ID Utilizador': item.userId,
            'Utilizador': item.userName || item.userEmail,
            'Matéria': item.materia,
            'Prazo (dias)': item.prazo,
            'Tipo de Uso': item.type === 'djen_consulta' ? 'Consulta DJEN' : (item.type || 'Calculadora'),
            'Número do Processo': item.numeroProcesso || '', 
            'Data': item.timestamp ? formatarData(item.timestamp.toDate()) : ''
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "RelatorioCalculos");
        XLSX.writeFile(workbook, "relatorio_calculadora_prazos.xlsx");
    };

    const topUsers = Object.entries(
        viewData.reduce((acc, curr) => {
            if(curr.userName || curr.userEmail) acc[curr.userName || curr.userEmail] = (acc[curr.userName || curr.userEmail] || 0) + 1;
            return acc;
        }, {})
    ).sort(([, a], [, b]) => b - a).slice(0, 10);

    const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

    const chartDataMateria = { labels: ['Cível', 'Crime'], datasets: [{ data: [stats.perMateria.civel || 0, stats.perMateria.crime || 0], backgroundColor: ['#6366F1', '#F59E0B'] }] };
    const chartDataPrazo = { labels: ['5 Dias', '15 Dias'], datasets: [{ data: [stats.perPrazo[5] || 0, stats.perPrazo[15] || 0], backgroundColor: ['#10B981', '#3B82F6'] }] };
    const chartDataByDay = { labels: Object.keys(stats.byDay || {}).reverse(), datasets: [{ label: 'Cálculos por Dia', data: Object.values(stats.byDay || {}).reverse(), backgroundColor: 'rgba(79, 70, 229, 0.8)' }] };
    const chartOptions = { legend: { display: false }, scales: { xAxes: [{ ticks: { beginAtZero: true } }] }};

    if(loading && adminSection === 'stats') return <div className="text-center p-8"><p>A carregar dados...</p></div>

    if (selectedUserForStats) {
        return (
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Perfil do Utilizador</h2>
                        <p className="text-slate-500 dark:text-slate-400">{selectedUserForStats.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">ID: {selectedUserForStats.data[0]?.userId}</p>
                    </div>
                    <button onClick={() => setSelectedUserForStats(null)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">&larr; Voltar ao Painel</button>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={handleExport} className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        Baixar Relatório do Utilizador
                    </button>
                </div>
                <div className="overflow-x-auto bg-slate-100/70 dark:bg-slate-900/50 rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-200/50 dark:bg-slate-800/50">
                            <tr><th className="px-6 py-3">Data</th><th className="px-6 py-3">Nº Processo</th><th className="px-6 py-3">Matéria</th><th className="px-6 py-3">Prazo</th></tr>
                        </thead>
                        <tbody>
                        {selectedUserForStats.data.map(item => (
                            <tr key={item.id} className="border-b border-slate-200/50 dark:border-slate-700/50"> 
                                <td className="px-6 py-4">{item.timestamp ? formatarData(item.timestamp.toDate()) : ''}</td>
                                <td className="px-6 py-4">{item.numeroProcesso}</td>
                                <td className="px-6 py-4">{item.materia}</td> 
                                <td className="px-6 py-4">{item.prazo} dias</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

     return(
        <div className="space-y-8">
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Painel Administrativo</h2>
                <div className="flex items-center gap-2 mt-4 border-b border-slate-200 dark:border-slate-700 pb-4">
                    {adminUserData.role === 'admin' && <button onClick={() => setAdminSection('stats')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${adminSection === 'stats' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>Estatísticas de Uso</button>}
                    <button onClick={() => setAdminSection('calendar')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${adminSection === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>Gerir Calendário</button>
                    <button onClick={() => setAdminSection('users')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${adminSection === 'users' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>Usuários e Setores</button>
                    <button onClick={() => setCurrentArea('Chamados')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors bg-amber-500 text-white hover:bg-amber-600`}>Chamados</button>
                </div>
            </div>

            {adminSection === 'stats' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Coluna Lateral */}
            <div className="lg:col-span-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 self-start">
                <h3 className="font-semibold text-lg mb-4 text-slate-800 dark:text-slate-100">Top 10 - {statsView === 'calculadora' ? 'Calculadora' : 'Consulta DJEN'}</h3>
                {topUsers.length > 0 ? (
                    <ul className="space-y-2 text-left">
                        {topUsers.map(([name, count], index) => (
                            <li key={name} className="flex items-center justify-between p-2 bg-slate-100/70 dark:bg-slate-900/50 rounded-md text-sm">
                                <span className="font-medium truncate" title={name}>{index + 1}. {name}</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0 ml-2">{count}</span>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum dado de utilização ainda.</p>}
            </div>

            {/* Conteúdo Principal */}
            <div className="lg:col-span-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Filtros de Estatísticas</h3>
                    <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => setStatsView('calculadora')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${statsView === 'calculadora' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>Calculadora</button>
                        <button onClick={() => setStatsView('djen_consulta')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${statsView === 'djen_consulta' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>Consulta DJEN</button>
                    </div>
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/50 px-3 py-1.5 rounded-lg">Total de Usos: <strong className="font-bold text-lg text-slate-700 dark:text-slate-200">{viewData.length}</strong></span>
            </div>
            
            <div className="p-4 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                    <div><label className="text-xs font-medium text-slate-500">Data Inicial</label><input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"/></div>
                    <div><label className="text-xs font-medium text-slate-500">Data Final</label><input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"/></div>
                    {statsView === 'calculadora' && <>
                        <div><label className="text-xs font-medium text-slate-500">Matéria</label><select name="materia" value={filters.materia} onChange={handleFilterChange} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"><option value="todos">Todas</option><option value="civel">Cível</option><option value="crime">Crime</option></select></div>
                        <div><label className="text-xs font-medium text-slate-500">Prazo</label><select name="prazo" value={filters.prazo} onChange={handleFilterChange} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"><option value="todos">Todos</option><option value="5">5 Dias</option><option value="15">15 Dias</option></select></div>
                    </>}
                    <div className="lg:col-span-full"><label className="text-xs font-medium text-slate-500">Utilizador</label><select name="email" value={filters.email} onChange={handleFilterChange} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"><option value="todos">Todos</option>{allUsers.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                     <label className="text-xs font-medium text-slate-500">Pesquisar por ID do Utilizador</label>
                     <div className="flex gap-4 items-center">
                        <input type="text" name="userId" placeholder="Cole o ID do utilizador aqui..." value={filters.userId} onChange={handleFilterChange} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"/>
                     </div>
                </div>
                 <div className="flex justify-end gap-2">
                     <button onClick={handleFilter} className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                        Filtrar
                     </button>
                    <button onClick={handleExport} disabled={filteredData.length === 0} className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        Baixar Relatório
                    </button>
                </div>
            </div>

            {!hasSearched ? (
                <div className="text-center p-8 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg"><p className="text-slate-500 dark:text-slate-400">Selecione os filtros e clique em "Filtrar" para ver os resultados.</p></div>
            ) : filteredData.length === 0 ? (
                <div className="text-center p-8 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg"><p className="text-slate-500 dark:text-slate-400">Nenhum resultado encontrado para os filtros selecionados.</p></div>
            ) : (
                <>
                    <div className="space-y-6">
                        <div className="p-4 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg shadow-sm h-64">
                             <h3 className="font-semibold text-center mb-2">Utilização nos Últimos 7 Dias</h3>
                             <Bar data={chartDataByDay} options={{ responsive: true, maintainAspectRatio: false }}/>
                        </div>
                        {statsView === 'calculadora' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-4 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg shadow-sm h-48"><h3 className="font-semibold text-center mb-2">Utilização por Matéria</h3><HorizontalBar data={chartDataMateria} options={{...chartOptions, maintainAspectRatio: false}}/></div>
                                <div className="p-4 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg shadow-sm h-48"><h3 className="font-semibold text-center mb-2">Utilização por Prazo</h3><HorizontalBar data={chartDataPrazo} options={{...chartOptions, maintainAspectRatio: false}}/></div>
                            </div>
                        )}
                    </div>
                     <div>
                        <h3 className="text-lg font-semibold mb-2">Resultados Filtrados ({filteredData.length})</h3>
                        <div className="overflow-x-auto bg-slate-100/70 dark:bg-slate-900/50 rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-200/50 dark:bg-slate-800/50">
                                    <tr><th className="px-4 py-3">Utilizador</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Nº Processo</th><th className="px-4 py-3">Detalhes</th><th className="px-4 py-3 text-right">Data</th></tr>
                                </thead>
                                <tbody>
                                {paginatedData.map(item => (
                                    <tr key={item.id} className="border-b border-slate-200/50 dark:border-slate-700/50"><td className="px-4 py-4 font-medium break-words"><a href="#" onClick={(e) => {e.preventDefault(); handleUserClick(item.userEmail)}} className="text-indigo-600 hover:underline">{item.userName || item.userEmail}</a></td>
                                        <td className="px-4 py-4 capitalize">{(item.type || 'calculadora').split('_')[0]}</td>
                                        <td className="px-4 py-4 break-words">{item.numeroProcesso}</td>
                                        <td className="px-4 py-4">{item.materia ? `${item.materia}, ${item.prazo} dias` : 'N/A'}</td> 
                                        <td className="px-4 py-4 text-right">{item.timestamp ? formatarData(item.timestamp.toDate()) : ''}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="flex justify-between items-center mt-4 text-sm">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 rounded-md bg-slate-200 dark:bg-slate-700 disabled:opacity-50">Anterior</button>
                                <span>Página {currentPage} de {totalPages}</span>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 rounded-md bg-slate-200 dark:bg-slate-700 disabled:opacity-50">Próxima</button>
                            </div>
                        )}
                    </div>
                </>
            )}
            </div>
        </div>
        )}
        {adminSection === 'calendar' && (
            <CalendarioAdminPage />
        )}
        {adminSection === 'users' && (<div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 space-y-6">
    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gerenciamento de Usuários e Setores</h2>
    <div className="relative">
        <input type="text" placeholder="Pesquisar por nome ou email..." value={userSearchTerm} onChange={e => setUserSearchTerm(e.target.value)} className="w-full p-3 pl-10 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700" />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
    </div>
    {/* Gerenciamento de Setores */}
    {(adminUserData.role === 'admin' || adminUserData.role === 'setor_admin') && <div className="p-4 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg space-y-4">
        {adminUserData.role === 'admin' && (
            <div className="bg-white/50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Criar Novo Setor</h3>
                <form onSubmit={handleAddSector} className="flex items-center gap-2">
                    <input type="text" placeholder="Nome do novo setor" value={newSectorName} onChange={e => setNewSectorName(e.target.value)} className="flex-grow p-2 text-sm rounded-md bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700" />
                    <button type="submit" className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Adicionar</button>
                </form>
            </div>
        )}
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 pt-2">Setores Cadastrados</h3>
        <div className="space-y-2">
            {setores.map(setor => {
                const isExpanded = expandedSector === setor.id;
                const members = allUsersForManagement.filter(u => u.setorId === setor.id);
                return (
                    <div key={setor.id} className="bg-slate-200/70 dark:bg-slate-700/50 rounded-lg p-2">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedSector(isExpanded ? null : setor.id)}>
                            <div className="flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{setor.nome}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-full px-2 py-0.5">{members.length} membros</span>
                            {adminUserData.role === 'admin' && (
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteSector(setor.id); }} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2">&times;</button>
                            )}
                            </div>
                        </div>
                        {isExpanded && (
                            <div className="mt-2 pl-4 border-l-2 border-slate-300 dark:border-slate-600">
                                {members.length > 0 ? (
                                    <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                                        {members.map(m => <li key={m.id}>{m.displayName || m.email}</li>)}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-slate-500">Nenhum membro neste setor.</p>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    </div>}

    {/* Tabela de Usuários */}
    {userManagementLoading ? (
        <p className="text-center text-slate-500 dark:text-slate-400">Carregando usuários...</p>
    ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-200/50 dark:bg-slate-800/50">
                    <tr>
                        <th className="px-4 py-3">Usuário</th>
                        <th className="px-4 py-3">Setor</th>
                        <th className="px-4 py-3 text-center">Permissão</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(
                        allUsersForManagement
                            .filter(u => u.displayName?.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()))
                            .reduce((acc, user) => {
                                const sectorId = user.setorId || 'sem-setor';
                                if (!acc[sectorId]) acc[sectorId] = [];
                                acc[sectorId].push(user);
                                return acc;
                            }, {})
                    ).sort(([sectorIdA], [sectorIdB]) => {
                        if (sectorIdA === 'sem-setor') return 1;
                        if (sectorIdB === 'sem-setor') return -1;
                        const setorA = setores.find(s => s.id === sectorIdA)?.nome || '';
                        const setorB = setores.find(s => s.id === sectorIdB)?.nome || '';
                        return setorA.localeCompare(setorB);
                    }).map(([sectorId, users]) => {
                        const sector = setores.find(s => s.id === sectorId);
                        const sectorName = sector ? sector.nome : "Usuários Sem Setor";
                        const isExpanded = expandedUserSectors.has(sectorId);
                        return (
                            <React.Fragment key={sectorId}>
                                <tr className="bg-slate-100/70 dark:bg-slate-900/50 border-b border-slate-200/50 dark:border-slate-700/50 cursor-pointer" onClick={() => toggleUserSectorExpansion(sectorId)}>
                                    <td colSpan="4" className="px-4 py-2 font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        {sectorName} ({users.length})
                                    </td>
                                </tr>
                                {isExpanded && users.map(u => (
                                    <tr key={u.id} className="border-b border-slate-200/50 dark:border-slate-700/50 last:border-b-0 animate-fade-in">
                                        <td className="px-4 py-3 font-medium">{u.displayName || 'Não definido'}<br/><span className="text-xs text-slate-500">{u.email}</span></td>
                                        <td className="px-4 py-3" style={{ minWidth: '200px' }}>
                                            <select value={u.setorId || ''} onChange={(e) => handleSectorChange(u.id, e.target.value)} className="w-full p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700">
                                                <option value="">Nenhum</option>
                                                {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                            </select><br/>
                                            <span className={`mt-1 inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${u.emailVerified ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                                                {u.emailVerified ? 'Verificado' : 'Não Verificado'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {!u.emailVerified && <button onClick={() => handleManualVerification(u.id)} className="px-2 py-1 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700">Verificar Manualmente</button>}
                                            {u.emailVerified && <button onClick={() => handleManualPasswordReset(u)} className="mt-1 px-2 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">Resetar Senha</button>}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => handleOpenUserManagementModal(u)} className="font-semibold text-indigo-600 hover:text-indigo-500">Gerenciar</button>
                                            <button onClick={() => handleDeleteUser(u)} className="font-semibold text-red-600 hover:text-red-500 ml-4">Excluir</button>
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    )}
    {editingUser && (
        <UserManagementModal 
            user={editingUser}
            setores={setores}
            adminUser={adminUserData}
            onClose={handleCloseUserManagementModal}
            onSave={handleSaveUserPermissions}
        />
    )}
</div>)}
        </div>
     );
};

const BugReportModal = ({ screenshot, onClose, onSubmit }) => {
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!description.trim()) {
            alert('Por favor, descreva o problema encontrado.');
            return;
        }
        setIsSubmitting(true);
        const success = await onSubmit(description);
        if (success) {
            onClose();
        }
        setIsSubmitting(false); // Para o loading em caso de sucesso ou falha
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Reportar um Problema</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Screenshot da Tela</label>
                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-2">
                            <img src={screenshot} alt="Screenshot da tela atual" className="w-full h-auto rounded-md" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="bug-description" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                            Descrição do Problema
                        </label>
                        <textarea
                            id="bug-description"
                            rows="4"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Por favor, detalhe o que aconteceu, o que você esperava que acontecesse e os passos para reproduzir o erro."
                            className="w-full p-3 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        ></textarea>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full flex justify-center items-center bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 shadow-md disabled:opacity-50"
                    >
                        {isSubmitting ? 'Enviando...' : 'Enviar Relatório'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const BugReportButton = () => {
    const { user } = useAuth();
    const [isReporting, setIsReporting] = useState(false);
    const [screenshot, setScreenshot] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);

    const handleReportClick = async () => {
        setIsCapturing(true);
        try {
            // Oculta o próprio botão de report para não aparecer no print
            const reportButton = document.getElementById('bug-report-button');
            if(reportButton) reportButton.style.display = 'none';

            // Verifica se o tema escuro está ativo
            const isDarkMode = document.documentElement.classList.contains('dark');

            // Captura o body inteiro para melhor contexto e define uma cor de fundo sólida
            const canvas = await html2canvas(document.body, {
                useCORS: true,
                // Define a cor de fundo com base no tema para evitar problemas com gradientes
                backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', // Cores sólidas (slate-800 e slate-100)
                scrollX: -window.scrollX,
                scrollY: -window.scrollY,
                windowWidth: document.documentElement.offsetWidth,
                windowHeight: document.documentElement.offsetHeight,
            });
            
            if(reportButton) reportButton.style.display = 'flex'; // Mostra o botão novamente

            setScreenshot(canvas.toDataURL('image/png'));
            setIsReporting(true);
        } catch (error) {
            console.error("Erro ao capturar a tela:", error);
            alert("Não foi possível capturar a tela. Tente novamente.");
        } finally {
            setIsCapturing(false);
        }
    };

    const handleSubmitReport = async (description) => {
        // A verificação do 'storage' foi removida, pois não o usaremos mais.
        if (!db || !user || !screenshot) {
            alert("Erro: Serviços de autenticação ou banco de dados não estão disponíveis.");
            return false;
        }

        try {
            // A variável 'screenshot' já contém a imagem como uma string Base64 (Data URL).
            // Vamos salvá-la diretamente no Firestore.

            // Salva o relatório no Firestore
            await db.collection('bug_reports').add({
                userId: user.uid,
                userEmail: user.email,
                description: description,
                screenshotBase64: screenshot, // Salva a string da imagem
                status: 'aberto', // 'aberto', 'resolvido'
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                pageURL: window.location.href,
                userAgent: navigator.userAgent,
            });

            alert('Relatório de problema enviado com sucesso! Agradecemos a sua colaboração.');
            return true; // Retorna sucesso

        } catch (error) {
            console.error("Erro ao enviar relatório:", error);
            alert("Ocorreu uma falha ao enviar seu relatório. Por favor, tente novamente.");
            return false; // Retorna falha
        }
    };

    return (
        <>
            <button
                id="bug-report-button"
                onClick={handleReportClick}
                disabled={isCapturing}
                className="fixed bottom-4 left-4 z-[90] bg-red-600 text-white rounded-full h-14 w-14 flex items-center justify-center shadow-lg hover:bg-red-700 transition-transform transform hover:scale-110"
                title="Reportar um problema"
            >
                {isCapturing ? (
                    <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
            </button>
            {isReporting && screenshot && (
                <BugReportModal
                    screenshot={screenshot}
                    onClose={() => setIsReporting(false)}
                    onSubmit={handleSubmitReport}
                />
            )}
        </>
    );
};

const ChamadosAdminPage = () => {
    const [chamados, setChamados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchChamados = useCallback(async () => {
        if (!db) return;
        setLoading(true);
        try {
            const reportsSnapshot = await db.collection('bug_reports').orderBy('createdAt', 'desc').get();
            const reportsList = reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const userIds = [...new Set(reportsList.map(r => r.userId))];
            if (userIds.length > 0) {
                const usersSnapshot = await db.collection('users').where(firebase.firestore.FieldPath.documentId(), 'in', userIds).get();
                const usersMap = usersSnapshot.docs.reduce((acc, doc) => {
                    acc[doc.id] = doc.data().displayName;
                    return acc;
                }, {});
                const enrichedReports = reportsList.map(r => ({ ...r, reporterName: usersMap[r.userId] || r.userEmail }));
                setChamados(enrichedReports);
            } else {
                setChamados([]);
            }
        } catch (err) {
            console.error("Erro ao buscar chamados:", err);
            setError("Falha ao carregar chamados.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchChamados();
    }, [fetchChamados]);

    const handleDeleteChamado = async (chamadoId) => {
        if (window.confirm("Tem certeza que deseja excluir este chamado permanentemente? Esta ação não pode ser desfeita.")) {
            if (!db) return;
            try {
                await db.collection('bug_reports').doc(chamadoId).delete();
                fetchChamados(); // Recarrega a lista
            } catch (err) {
                console.error("Erro ao excluir chamado:", err);
                alert("Falha ao excluir o chamado.");
            }
        }
    };

    const viewScreenshot = (base64String) => {
        const newWindow = window.open();
        if (newWindow) {
            newWindow.document.write(`
                <html>
                    <head><title>Visualizador de Screenshot</title></head>
                    <body style="margin:0; background-color:#1e293b; display:flex; justify-content:center; align-items:center;">
                        <img src="${base64String}" alt="Screenshot do Chamado" style="max-width:100%; max-height:100%; object-fit:contain;">
                    </body>
                </html>
            `);
            newWindow.document.close();
        } else {
            alert('O visualizador de imagem foi bloqueado pelo seu navegador. Por favor, habilite os pop-ups para este site.');
        }
    };

    const handleUpdateStatus = async (chamado, newStatus) => {
        if (!db) return;
        try {
            await db.collection('bug_reports').doc(chamado.id).update({ status: newStatus });
            fetchChamados();
        } catch (err) {
            console.error("Erro ao atualizar status:", err);
            alert("Falha ao atualizar o status do chamado.");
        }
    };

    if (loading) return <p>Carregando chamados...</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">Caixa de Chamados de Problemas</h2>
            <div className="space-y-4">
                {chamados.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400">Nenhum chamado encontrado.</p>
                ) : (
                    chamados.map(chamado => (
                        <div key={chamado.id} className={`p-4 rounded-lg border ${chamado.status === 'aberto' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Reportado por: <span className="font-medium text-slate-700 dark:text-slate-200">{chamado.reporterName}</span></p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">Em: {chamado.createdAt ? formatarData(chamado.createdAt.toDate()) : 'Data indisponível'}</p>
                                </div>
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${chamado.status === 'aberto' ? 'bg-amber-200 text-amber-800 dark:bg-amber-500/30 dark:text-amber-300' : 'bg-green-200 text-green-800 dark:bg-green-500/30 dark:text-green-300'}`}>
                                    {chamado.status}
                                </span>
                            </div>
                            <p className="mt-4 text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-md">{chamado.description}</p>
                            <div className="mt-4 flex flex-wrap gap-4 items-center">
                                <button onClick={() => viewScreenshot(chamado.screenshotBase64)} className="text-sm font-semibold text-indigo-600 hover:underline">
                                    Ver Screenshot
                                </button>
                                {chamado.status === 'aberto' ? (
                                    <button onClick={() => handleUpdateStatus(chamado, 'resolvido')} className="px-3 py-1 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700">Marcar como Resolvido</button>
                                ) : (
                                    <button onClick={() => handleUpdateStatus(chamado, 'aberto')} className="px-3 py-1 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700">Reabrir Chamado</button>
                                )}
                                <button onClick={() => handleDeleteChamado(chamado.id)} className="text-sm font-semibold text-red-600 hover:underline">
                                    Excluir
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const ChangelogModal = ({ onClose }) => {
    const [latestLog, setLatestLog] = useState(null);
    const [loading, setLoading] = useState(true);
    const { userData } = useAuth();

    useEffect(() => {
        const fetchChangelog = async () => {
            if (!db) return;
            try {
                const snapshot = await db.collection('changelog').orderBy('date', 'desc').limit(1).get();
                if (!snapshot.empty) {
                    const log = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                    setLatestLog(log);
                }
            } catch (err) {
                console.error("Erro ao buscar changelog:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchChangelog();
    }, []);

    const handleClose = () => {
        if (latestLog) {
            localStorage.setItem('lastSeenChangelogVersion', latestLog.id);
        }
        onClose();
    };

    const filteredChanges = latestLog?.changes?.filter(change => 
        change.roles.includes(userData.role) || change.roles.includes('all')
    ) || [];

    if (loading) return null; // Não mostra nada enquanto carrega
    if (!latestLog || filteredChanges.length === 0) {
        // Se não há log ou nenhuma mudança visível para este usuário, fecha automaticamente
        onClose();
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 text-center border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{latestLog.title}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Novidades da versão {latestLog.id} (em {formatarData(latestLog.date.toDate())})</p>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <ul className="space-y-3">
                        {filteredChanges.map((change, index) => (
                            <li key={index} className="flex items-start gap-3">
                                <span className="flex-shrink-0 mt-1 h-5 w-5 rounded-full bg-green-200 dark:bg-green-500/30 text-green-800 dark:text-green-300 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                </span>
                                <p className="text-slate-700 dark:text-slate-200">{change.description}</p>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={handleClose} className="w-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 shadow-md">
                        Entendido, fechar!
                    </button>
                </div>
            </div>
        </div>
    );
};

const NotificationsPanel = ({ notifications, onMarkAllAsRead, onClose }) => {
    return (
        <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 z-20 flex flex-col max-h-[70vh]">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Notificações</h3>
                <button onClick={onMarkAllAsRead} className="text-xs font-semibold text-indigo-600 hover:underline">Marcar todas como lidas</button>
            </div>
            <div className="overflow-y-auto">
                {notifications.length === 0 ? (
                    <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma notificação nova.</p>
                ) : (
                    <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                        {notifications.map(notif => (
                            <li key={notif.id} className={`p-4 ${!notif.read ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                                <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{notif.title}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{notif.message}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{formatarData(notif.createdAt.toDate())}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

const SettingsModal = ({ onClose }) => {
    const { settings, updateSettings } = useContext(SettingsContext);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (newPassword !== confirmPassword) {
            setError('As novas senhas não coincidem.');
            return;
        }
        if (newPassword.length < 6) {
            setError('A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setIsSaving(true);
        const user = auth.currentUser;
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);

        try {
            // Reautenticar para segurança
            await user.reauthenticateWithCredential(credential);
            // Atualizar a senha
            await user.updatePassword(newPassword);
            setMessage('Senha alterada com sucesso!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            if (err.code === 'auth/wrong-password') {
                setError('A senha atual está incorreta.');
            } else {
                setError('Ocorreu um erro ao alterar a senha. Tente novamente.');
                console.error("Erro ao alterar senha:", err);
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Configurações</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Preferências de Aparência */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Aparência</h3>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Tema</label>
                            <div className="flex rounded-lg shadow-sm border border-slate-300 dark:border-slate-600">
                                {['system', 'light', 'dark'].map(themeOption => (
                                    <button key={themeOption} onClick={() => updateSettings({ theme: themeOption })} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 first:rounded-l-lg last:rounded-r-lg ${settings.theme === themeOption ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                                        {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Preferências da Calculadora */}
                    <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Preferências da Calculadora</h3>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Matéria Padrão</label>
                            <div className="flex rounded-lg shadow-sm border border-slate-300 dark:border-slate-600">
                                <button onClick={() => updateSettings({ defaultMateria: 'civel' })} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-l-lg ${settings.defaultMateria === 'civel' ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Cível</button>
                                <button onClick={() => updateSettings({ defaultMateria: 'crime' })} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-r-lg ${settings.defaultMateria === 'crime' ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Crime</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Prazo Padrão</label>
                            <div className="flex rounded-lg shadow-sm border border-slate-300 dark:border-slate-600">
                                <button onClick={() => updateSettings({ defaultPrazo: 5 })} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-l-lg ${settings.defaultPrazo === 5 ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>5 Dias</button>
                                <button onClick={() => updateSettings({ defaultPrazo: 15 })} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-r-lg ${settings.defaultPrazo === 15 ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>15 Dias</button>
                            </div>
                        </div>
                    </div>

                    {/* Gerenciamento da Conta */}
                    <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Gerenciamento da Conta</h3>
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <h4 className="text-md font-semibold text-slate-600 dark:text-slate-300">Alterar Senha</h4>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Senha Atual</label>
                                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="w-full px-4 py-2 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nova Senha</label>
                                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="w-full px-4 py-2 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Confirmar Nova Senha</label>
                                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full px-4 py-2 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                            </div>
                            {error && <p className="text-sm text-center text-red-500">{error}</p>}
                            {message && <p className="text-sm text-center text-green-500">{message}</p>}
                            <button type="submit" disabled={isSaving} className="w-full flex justify-center items-center bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 shadow-md disabled:opacity-50">
                                {isSaving ? 'Salvando...' : 'Alterar Senha'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProfileModal = ({ user, userData, onClose, onUpdate }) => {
    if (!user) return null;
    const AVATAR_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'];
    const ReactCrop = window.ReactCrop;
    const [displayName, setDisplayName] = useState(userData?.displayName || '');
    const [avatarColor, setAvatarColor] = useState(userData?.avatarColor || AVATAR_COLORS[0]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleSave = async () => {
        if (!displayName.trim() || !avatarColor) {
            setError('O nome não pode ficar em branco.');
            return;
        }
        setIsSaving(true);
        setError('');
        setMessage('');
        try {
            const updateData = {
                displayName: displayName.trim(),
                avatarColor: avatarColor,
                // Remove a foto do perfil ao salvar, se existir
                photoURL: null 
            };

            // Atualiza o perfil do Firebase Auth e o documento do Firestore
            await user.updateProfile({ displayName: displayName.trim(), photoURL: null });
            await db.collection('users').doc(user.uid).update(updateData);

            setMessage('Perfil atualizado com sucesso!');
            onUpdate(); // Chama a função para atualizar os dados do usuário na UI
            setTimeout(() => {
                setMessage('');
                onClose();
            }, 1500);
        } catch (err) {
            setError('Não foi possível atualizar o perfil. Tente novamente.');
            console.error("Erro ao atualizar nome:", err);
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Perfil do Usuário</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-full flex justify-center items-center">
                            <Avatar user={user} userData={{...userData, displayName, avatarColor}} size="h-24 w-24" />
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                            {AVATAR_COLORS.map(color => (
                                <button key={color} onClick={() => setAvatarColor(color)} className={`h-8 w-8 rounded-full transition-transform transform hover:scale-110 ${avatarColor === color ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-800' : ''}`} style={{ backgroundColor: color }}></button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nome</label>
                        <input 
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Seu nome completo"
                            className="w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Email</label>
                        <p className="w-full px-4 py-3 bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                            {user.email}
                        </p>
                    </div>
                    
                    {error && <p className="text-sm text-center text-red-500">{error}</p>}
                    {message && <p className="text-sm text-center text-green-500">{message}</p>}

                    <button onClick={handleSave} disabled={isSaving} className="w-full flex justify-center items-center bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 shadow-md disabled:opacity-50">
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">Outras Opções</h3>
                        <button onClick={() => document.dispatchEvent(new CustomEvent('openSettings'))} className="w-full flex justify-center items-center bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.532 1.532 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                            Configurações
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Header = () => {
    const { user, userData, openCalendario } = useAuth(); // A propriedade openCalendario é disponibilizada pelo AuthContext
    const { openBugReport } = useContext(BugReportContext);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const menuRef = React.useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);

    return (
    <header className="bg-white/30 dark:bg-slate-900/30 backdrop-blur-xl shadow-sm sticky top-0 z-30 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <svg className="h-9 w-9 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18-3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Modulo Prazos - P-SEP-AR - TJPR</h1>
            </div>
             {user && (
                <div className="flex items-center gap-2 sm:gap-4 relative" ref={menuRef}>
                    <button onClick={openCalendario} className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                        Ver Calendário
                    </button>
                    <button onClick={() => setIsMenuOpen(prev => !prev)} className="rounded-full hover:ring-2 hover:ring-indigo-300 dark:hover:ring-indigo-500 transition-all"><Avatar user={user} userData={userData} /></button>
                    {isMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 py-2 z-20">
                            <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 mb-2">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{userData?.displayName || 'Usuário'}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                            </div>
                            <button onClick={() => { document.dispatchEvent(new CustomEvent('openProfile')); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                Perfil
                            </button>
                            <button onClick={() => { openBugReport(); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Reportar Problema
                            </button>
                            <button onClick={() => auth.signOut()} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" /></svg>
                                Sair
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    </header>
    );
};

const CalculatorApp = () => {
    const [numeroProcesso, setNumeroProcesso] = useState('');
    const { currentArea } = useAuth(); // Usaremos o contexto para gerenciar a área atual
    
    return (
        <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
            <ConsultaAssistidaPJE numeroProcesso={numeroProcesso} setNumeroProcesso={setNumeroProcesso} />
            <CalculadoraDePrazo numeroProcesso={numeroProcesso} />
        </div>
    );
};

const CreditsWatermark = () => (
     <div className="fixed bottom-2 right-6 text-xs text-slate-400 dark:text-slate-600 z-50 text-right pointer-events-none">
        <p>Desenvolvido por:</p>
        <p><strong>P-SEP-AR - GESTÃO 2025/2026</strong></p>
        <p>Assessoria de Recursos aos Tribunais Superiores (STF e STJ) da Secretaria Especial da Presidência</p>
        <p>Alif Pietrobelli Azevedo</p>
        <p>Elvertoni Martelli Coimbra</p>
        <p><strong className="font-extrabold text-slate-500 dark:text-slate-400">Luís Gustavo Arruda Lançoni</strong></p>
        <p>Narley Almeida de Sousa</p>
        <p>Rodrigo Louzano</p>
    </div>
);

const UserIDWatermark = ({ overlay = false }) => {
     const { user, userData } = useAuth();
     if (!user) return null;
     if (overlay) {
        return <div className="watermark-overlay">{user.uid}</div>
     }
     return (
        <div className="fixed top-[80px] left-4 text-xs text-slate-400 dark:text-slate-600 z-40 pointer-events-none">
            <p>Logado como:</p>
            <p>{userData?.displayName || user.email}</p>
            ID do Utilizador: {user.uid}
        </div>
    );
};

const BugReportContext = createContext({ openBugReport: () => {} });

const BugReportProvider = ({ children }) => {
    const { user, userData } = useAuth();
    const [isReporting, setIsReporting] = useState(false);
    const [screenshot, setScreenshot] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);

    const openBugReport = async () => {
        if (isCapturing) return;
        setIsCapturing(true);
        try {
            const isDarkMode = document.documentElement.classList.contains('dark');
            const canvas = await html2canvas(document.body, {
                useCORS: true,
                backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                scrollX: -window.scrollX,
                scrollY: -window.scrollY,
                windowWidth: document.documentElement.offsetWidth,
                windowHeight: document.documentElement.offsetHeight,
            });
            setScreenshot(canvas.toDataURL('image/png'));
            setIsReporting(true);
        } catch (error) {
            console.error("Erro ao capturar a tela:", error);
            alert("Não foi possível capturar a tela. Tente novamente.");
        } finally {
            setIsCapturing(false);
        }
    };

    const handleSubmitReport = async (description) => {
        if (!db || !user || !screenshot) {
            alert("Erro: Serviços de autenticação ou banco de dados não estão disponíveis.");
            return false;
        }
        try {
            await db.collection('bug_reports').add({
                userId: user.uid,
                userEmail: user.email,
                description: description,
                screenshotBase64: screenshot,
                status: 'aberto',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                pageURL: window.location.href,
                userAgent: navigator.userAgent,
            });

        } catch (error) {
            console.error("Erro ao enviar relatório:", error);
            alert("Ocorreu uma falha ao enviar seu relatório. Por favor, tente novamente.");
            return false;
        }
        
        alert('Relatório de problema enviado com sucesso! Agradecemos a sua colaboração.');
        return true;
    };

    return (
        <BugReportContext.Provider value={{ openBugReport }}>
            {children}
            {isReporting && screenshot && (
                <BugReportModal screenshot={screenshot} onClose={() => setIsReporting(false)} onSubmit={handleSubmitReport} />
            )}
        </BugReportContext.Provider>
    );
};
// --- Componente Principal ---
const App = () => {
  const { user, userData, isAdmin, loading, refreshUser, currentArea, setCurrentArea } = useAuth();
  const [showCalendario, setShowCalendario] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => {
    // Adiciona o estilo de animação ao head do documento uma única vez.
    const openCalendarioHandler = () => setShowCalendario(true);
    const openProfileHandler = () => setShowProfile(true);
    const openSettingsHandler = () => setShowSettings(true);
    document.addEventListener('openCalendario', openCalendarioHandler);
    document.addEventListener('openProfile', openProfileHandler);
    document.addEventListener('openSettings', openSettingsHandler);
    return () => {
        document.removeEventListener('openCalendario', openCalendarioHandler);
        document.removeEventListener('openProfile', openProfileHandler);
        document.removeEventListener('openSettings', openSettingsHandler);
    };
  }, []);

  useEffect(() => {
    // Lógica para mostrar o changelog
    // if (user && db) {
    //     const checkChangelog = async () => {
    //         const lastSeenVersion = localStorage.getItem('lastSeenChangelogVersion');
    //         const snapshot = await db.collection('changelog').orderBy('date', 'desc').limit(1).get();
    //         if (!snapshot.empty) {
    //             const latestVersionId = snapshot.docs[0].id;
    //             if (latestVersionId !== lastSeenVersion) {
    //                 setShowChangelog(true);
    //             }
    //         }
    //     };
    //     checkChangelog();
    // }
  }, []);



  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p>A carregar...</p></div>;
  }

  // Se não houver usuário, exibe a página de login em tela cheia.
  if (!user) {
    return <LoginPage />;
  }

  // Se o e-mail não for verificado, exibe a página de verificação.
  // CORREÇÃO: Verifica tanto o status do Firebase Auth quanto o campo manual no Firestore.
  // A verificação do Firestore (userData.emailVerified) é a que o admin pode alterar.
  const isVerified = user.emailVerified || userData?.emailVerified;
  if (!isVerified) {
    return <VerifyEmailPage />;
  }

  // Se o usuário estiver logado e verificado, exibe a aplicação principal.
  return (
    <div id="app-wrapper" className="h-screen flex flex-col">
        {/* 
            Alterado de `min-h-screen` para `h-screen`.
            Isso força o contêiner principal a ter exatamente a altura da tela,
            evitando que o `body` crie uma barra de rolagem.
        */}
        <Header />
        <nav className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50 sticky top-[81px] z-20">
            <div className="container mx-auto px-4">
              <div className="flex justify-center items-center space-x-2 p-2"> 
                 <button onClick={() => setCurrentArea('Calculadora')} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${currentArea === 'Calculadora' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Calculadora</button>
                 <button onClick={() => setShowCalendario(true)} className="sm:hidden px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                    Calendário
                 </button>
                 {(isAdmin || userData?.role === 'setor_admin') && <button onClick={() => setCurrentArea('Admin')} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${currentArea === 'Admin' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Admin</button>}
              </div>
            </div>
        </nav>
        <div className="flex-grow overflow-y-auto">
            <main className="container mx-auto px-4 py-8 sm:py-12">
                {currentArea === 'Calculadora' ? (
                    <CalculatorApp />
                ) : currentArea === 'Admin' && (isAdmin || userData?.role === 'setor_admin') ? (
                    <AdminPage setCurrentArea={setCurrentArea} />
                ) : currentArea === 'Chamados' && isAdmin ? (
                    <ChamadosAdminPage />
                ) : (
                    <p>Área desconhecida.</p>
                )}
            </main>
        </div>
        <footer className="p-2"><CreditsWatermark /></footer>

        {showCalendario && <CalendarioModal onClose={() => setShowCalendario(false)} />}
        {showProfile && <ProfileModal user={user} userData={userData} onClose={() => setShowProfile(false)} onUpdate={refreshUser} />} 
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        {/* {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />} */}
        <UserIDWatermark />
        <BugReportButton />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <SettingsProvider>
        <AuthProvider>
            <BugReportProvider>
                <App />
            </BugReportProvider>
        </AuthProvider>
    </SettingsProvider>
);
