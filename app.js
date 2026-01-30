const { useState, useEffect, useCallback, createContext, useContext, useRef, useMemo } = React;
const { Bar, HorizontalBar, Pie } = window.ReactChartjs2;
const usePagination = (data, itemsPerPage) => {
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const PaginationControls = () => totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 text-sm p-4">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 rounded-md bg-slate-200 dark:bg-slate-700 disabled:opacity-50">Anterior</button>
            <span>Página {currentPage} de {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 rounded-md bg-slate-200 dark:bg-slate-700 disabled:opacity-50">Próxima</button>
        </div>
    );

    return { paginatedData, PaginationControls, currentPage };
};

const UserUsageCharts = ({ userData }) => {
    const monthlyUsage = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const lastMonth = now.getMonth() - 1 < 0 ? 11 : now.getMonth() - 1;
        const lastMonthYear = now.getMonth() - 1 < 0 ? currentYear - 1 : currentYear;

        const stats = { current: { calculadora: 0, djen_consulta: 0 }, last: { calculadora: 0, djen_consulta: 0 } };

        (userData || []).forEach(item => {
            const itemDate = item.timestamp.toDate();
            const type = item.type || 'calculadora';
            if (itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear) stats.current[type]++;
            if (itemDate.getMonth() === lastMonth && itemDate.getFullYear() === lastMonthYear) stats.last[type]++;
        });
        return stats;
    }, [userData]);

    const chartData = { labels: ['Mês Anterior', 'Mês Atual'], datasets: [{ label: 'Calculadora', data: [monthlyUsage.last.calculadora, monthlyUsage.current.calculadora], backgroundColor: '#6366F1' }, { label: 'Consulta DJEN', data: [monthlyUsage.last.djen_consulta, monthlyUsage.current.djen_consulta], backgroundColor: '#F59E0B' }] };
    const chartOptions = { responsive: true, maintainAspectRatio: false, scales: { yAxes: [{ ticks: { beginAtZero: true, stepSize: 1 } }] } };

    return (
        <div className="p-4 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg shadow-sm h-64">
            <h3 className="font-semibold text-center mb-2">Uso Mensal (Mês Atual vs. Anterior)</h3>
            <Bar data={chartData} options={chartOptions} />
        </div>
    );
};

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
            dezembro: { inicio: 20, fim: 31 }
        },
        calendarLoading: true,
    });

    // CORREÇÃO: Usar useAuth para monitorar o estado do usuário
    const { user } = useAuth();

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
                const feriados = {};
                const decretos = {};
                const instabilidades = {};
                // Nota: O campo 'link' agora é suportado nos objetos de feriado/decreto

                // Define os anos relevantes: anos configurados + ano atual + próximo ano
                const anosConfigurados = Object.keys(calendarConfig.excecoesAnuais || {});
                const anoAtual = new Date().getFullYear();
                const anosRelevantes = new Set([...anosConfigurados, String(anoAtual), String(anoAtual + 1)]);

                anosRelevantes.forEach(ano => {
                    // 1. Processa feriados nacionais recorrentes para este ano
                    if (calendarConfig.feriadosNacionaisRecorrentes) {
                        calendarConfig.feriadosNacionaisRecorrentes.forEach(feriado => {
                            // Formata a data para YYYY-MM-DD
                            const dataStr = `${ano}-${String(feriado.mes).padStart(2, '0')}-${String(feriado.dia).padStart(2, '0')}`;
                            feriados[dataStr] = { motivo: feriado.motivo, tipo: 'feriado', link: feriado.link };
                        });
                    }

                    // 2. Processa as exceções anuais (feriados específicos, decretos, instabilidades) para este ano
                    const excecoesDoAno = calendarConfig.excecoesAnuais?.[ano] || [];
                    excecoesDoAno.forEach(item => {
                        if (item.data && item.motivo && item.tipo) {
                            switch (item.tipo) {
                                case 'feriado':
                                    feriados[item.data] = { motivo: item.motivo, tipo: 'feriado', link: item.link };
                                    break;
                                case 'decreto':
                                    decretos[item.data] = { motivo: item.motivo, tipo: 'decreto', link: item.link };
                                    break;
                                case 'instabilidade':
                                    instabilidades[item.data] = { motivo: item.motivo, tipo: 'instabilidade', link: item.link };
                                    break;
                            }
                        }
                    });
                });

                // 3. Atualiza o recesso forense
                const novoRecesso = calendarConfig.recessoForense || settings.recessoForense;

                // Aplica a função exclusiva para os decretos de 19/06 e 20/06.
                aplicarRegrasEspeciaisDeAgrupamento(feriados, decretos);
                updateSettings({ feriadosMap: feriados, decretosMap: decretos, instabilidadeMap: instabilidades, recessoForense: novoRecesso, calendarLoading: false });

            } catch (error) { console.error("Erro ao carregar calendário da coleção:", error); updateSettings({ calendarLoading: false }); }
        }
    }, [db, user]); // CORREÇÃO: Adicionado 'user' como dependência para rejeitar a busca após login

    const updateSettings = (newSettings) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        localStorage.setItem('appSettings', JSON.stringify(updated));
    };

    useEffect(() => {
        // Carrega os dados do calendário do Firestore assim que `db` estiver disponível E o usuário estiver logado.
        if (db && user) {
            fetchCalendarData();
        }
    }, [db, user, fetchCalendarData]);

    useEffect(() => {
        // Aplica o tema
        const root = window.document.documentElement;
        const isDark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        root.classList.toggle('dark', isDark);
    }, [settings.theme]);

    const value = { settings, updateSettings, refreshCalendar: fetchCalendarData };
    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

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
        <div className="relative bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
            <UserIDWatermark overlay={true} />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Consulta de Processo</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Insira o número para consultar o processo no Diário de Justiça Eletrônico Nacional.</p>
            {alerta && <div className="p-4 mb-4 text-sm text-yellow-800 rounded-lg bg-yellow-50 dark:bg-gray-800 dark:text-yellow-300" role="alert"><span className="font-medium">Atenção!</span> {alerta}</div>}
            <div className="flex items-center gap-2">
                <input type="text" value={numeroProcesso} onChange={(e) => { setNumeroProcesso(e.target.value); setAlerta(''); }} placeholder="Número do Processo" className="flex-grow w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />
                <button onClick={handleConsulta} disabled={!numeroProcesso} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
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
    const [showManualPrazoInput, setShowManualPrazoInput] = useState(false);
    const [ignorarRecesso, setIgnorarRecesso] = useState(false);
    const [resultado, setResultado] = useState(null);

    const [diasComprovados, setDiasComprovados] = useState(new Set());
    const [dataInterposicao, setDataInterposicao] = useState('');
    const [tempestividade, setTempestividade] = useState(null);
    const [error, setError] = useState('');
    const [customMinutaTypes, setCustomMinutaTypes] = useState([]);
    const { user, userData } = useAuth();
    const { feriadosMap, decretosMap, instabilidadeMap, recessoForense, calendarLoading } = settings;

    // Efeito para gerenciar a visibilidade do input manual de prazo
    useEffect(() => {
        // Se o tipo de prazo mudar para 'civel', esconde o input manual
        // e reseta o prazo selecionado para o padrão, caso um valor manual estivesse em uso.
        if (tipoPrazo === 'civel') {
            setShowManualPrazoInput(false);
            if (![5, 15, 30].includes(prazoSelecionado)) {
                setPrazoSelecionado(settings.defaultPrazo || 15);
            }
        }
        // Reseta a opção de ignorar recesso ao trocar de matéria
        if (tipoPrazo === 'civel') {
            setIgnorarRecesso(false);
        }
    }, [tipoPrazo, prazoSelecionado, settings.defaultPrazo]);

    // Efeito para recalcular automaticamente quando a opção "Réu preso / Maria da Penha" muda
    // Isso evita que o usuário precise clicar em "Calcular" novamente e não gera novos registros de uso
    useEffect(() => {
        // Só recalcula se já houver um resultado calculado e uma data de disponibilização
        if (!resultado || !dataDisponibilizacao || tipoPrazo !== 'crime') return;

        try {
            const inicioDisponibilizacao = new Date(dataDisponibilizacao + 'T00:00:00');
            if (isNaN(inicioDisponibilizacao.getTime())) return;

            const prazoNumerico = prazoSelecionado;
            const { proximoDia: dataPublicacaoComDecreto, suspensoesEncontradas: suspensoesPublicacaoComDecreto } = getProximoDiaUtilParaPublicacao(inicioDisponibilizacao, true);


            const { proximoDia: inicioDoPrazoComDecreto, suspensoesEncontradas: suspensoesInicioComDecreto } = getProximoDiaUtilParaPublicacao(dataPublicacaoComDecreto, true);

            const diasNaoUteisDoInicioComDecreto = [...suspensoesPublicacaoComDecreto, ...suspensoesInicioComDecreto];

            const helpers = {
                getProximoDiaUtilParaPublicacao,
                calcularPrazoFinalDiasUteis,
                calcularPrazoFinalDiasCorridos,
                getMotivoDiaNaoUtil,
                decretosMap
            };

            const resultadoCrime = calcularPrazoCrime(dataPublicacaoComDecreto, inicioDoPrazoComDecreto, prazoNumerico, diasNaoUteisDoInicioComDecreto, inicioDisponibilizacao, helpers);
            setResultado(resultadoCrime);
            // Não chama logUsage() para evitar gerar registros duplicados
        } catch (e) {
            console.error("Erro ao recalcular com ignorarRecesso:", e);
        }
    }, [ignorarRecesso]);

    const getMotivoDiaNaoUtil = (date, considerarDecretos, tipo = 'todos', comprovados = new Set()) => {
        if (!date || isNaN(date.getTime())) return null;

        const dateString = date.toISOString().split('T')[0];
        if (tipo === 'todos' || tipo === 'feriado') {
            // Agora feriadosMap pode conter objetos com link
            if (feriadosMap && feriadosMap[dateString]) return typeof feriadosMap[dateString] === 'object' ? feriadosMap[dateString] : { motivo: feriadosMap[dateString], tipo: 'feriado' };
        }
        if (considerarDecretos && (tipo === 'todos' || tipo === 'decreto')) {
            if (decretosMap && decretosMap[dateString]) {
                // Se for um objeto (regra especial CNJ), retorna o objeto. Senão, cria um.
                if (typeof decretosMap[dateString] === 'object') {
                    return decretosMap[dateString];
                }
                return { motivo: decretosMap[dateString], tipo: 'decreto' };
            }
        }
        // A instabilidade é tratada separadamente, mas pode ser verificada aqui se necessário.
        if (considerarDecretos && (tipo === 'todos' || tipo === 'instabilidade')) {
            if (instabilidadeMap && instabilidadeMap[dateString]) return typeof instabilidadeMap[dateString] === 'object' ? instabilidadeMap[dateString] : { motivo: instabilidadeMap[dateString], tipo: 'instabilidade' };
        }
        const month = date.getMonth() + 1;
        const day = date.getDate();

        // Proteção para recessoForense
        if (recessoForense) {
            const { janeiro, dezembro } = recessoForense;
            // Se a opção de ignorar recesso estiver marcada (apenas para Crime - Réu Preso/Maria da Penha), retorna null.
            if ((tipo === 'todos' || tipo === 'recesso') && !ignorarRecesso) {
                if ((janeiro && month === 1 && day >= janeiro.inicio && day <= janeiro.fim) ||
                    (dezembro && month === 12 && day >= dezembro.inicio && day <= dezembro.fim))
                    return { motivo: 'Recesso Forense', tipo: 'recesso' };
            }
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

    const getProximoDiaUtilParaPublicacao = (data, considerarDecretos = true, comprovados = new Set()) => {
        const suspensoesEncontradas = [];
        const proximoDia = new Date(data.getTime());
        // A publicação deve ser o primeiro dia útil após a disponibilização,
        // prorrogando caso caia em fim de semana, feriado, recesso ou decreto.
        let motivo;
        do {
            proximoDia.setDate(proximoDia.getDate() + 1);
            motivo = getMotivoDiaNaoUtil(proximoDia, considerarDecretos, 'todos', comprovados);
            if (motivo && motivo.tipo !== 'instabilidade') {
                suspensoesEncontradas.push({ data: new Date(proximoDia.getTime()), ...motivo });
            }
        } while (proximoDia.getDay() === 0 || proximoDia.getDay() === 6 || (motivo && motivo.tipo !== 'instabilidade'));
        return { proximoDia, suspensoesEncontradas };
    };

    /**
     * Encontra o próximo dia útil, considerando os dias comprovados pelo usuário.
     * Usado para recalcular o início do prazo quando checkboxes são marcadas.
     */
    const getProximoDiaUtilComprovado = (data, comprovados) => {
        const suspensoesEncontradas = [];
        const proximoDia = new Date(data.getTime()); // Começa a partir da data fornecida
        let motivo;
        do {
            proximoDia.setDate(proximoDia.getDate() + 1); // Avança para o próximo dia
            const dataStr = proximoDia.toISOString().split('T')[0];
            motivo = getMotivoDiaNaoUtil(proximoDia, true, 'todos', comprovados);

            const eFimDeSemana = proximoDia.getDay() === 0 || proximoDia.getDay() === 6;
            const eSuspensaoRelevante = motivo && (motivo.tipo === 'feriado' || motivo.tipo === 'recesso' || comprovados.has(dataStr));

            if (eSuspensaoRelevante) {
                suspensoesEncontradas.push({ data: new Date(proximoDia.getTime()), ...motivo });
            }
        } while (proximoDia.getDay() === 0 || proximoDia.getDay() === 6 || (motivo && (motivo.tipo === 'feriado' || motivo.tipo === 'recesso' || comprovados.has(proximoDia.toISOString().split('T')[0]))));
        return { proximoDia, suspensoesEncontradas };
    };

    /**
     * Encontra o próximo dia útil ignorando decretos e instabilidades.
     * Usado para calcular o cenário base (Cenário 1).
     */
    const getProximoDiaUtilSemDecreto = (data, settings, getMotivoDiaNaoUtil) => {
        const proximoDia = new Date(data.getTime());
        let motivo;
        do {
            proximoDia.setDate(proximoDia.getDate() + 1);
            motivo = getMotivoDiaNaoUtil(proximoDia, false, 'feriado') || getMotivoDiaNaoUtil(proximoDia, false, 'recesso');
        } while (proximoDia.getDay() === 0 || proximoDia.getDay() === 6 || motivo);
        return proximoDia;
    };

    /**
     * HELPER PARA CASCATA: Identifica a próxima suspensão comprovável na data fornecida.
     * Retorna null se a data não tiver suspensão comprovável ou se já estiver comprovada.
     */
    const getProximaSuspensaoComprovavel = (dataFinal, comprovados) => {
        const filtroComprovavel = (tipo) => tipo === 'decreto' || tipo === 'instabilidade' ||
            tipo === 'feriado_cnj' || tipo === 'suspensao_outubro';

        const dataStr = dataFinal.toISOString().split('T')[0];

        // Se a data já foi comprovada, não adicionar novamente
        if (comprovados.has(dataStr)) return null;

        // Verificar se a data tem uma suspensão comprovável
        const suspensao = getMotivoDiaNaoUtil(dataFinal, true, 'todos');
        if (suspensao && filtroComprovavel(suspensao.tipo)) {
            return { data: new Date(dataFinal.getTime()), ...suspensao };
        }

        return null;
    };

    const calcularPrazoFinalDiasUteis = (inicioDoPrazo, prazo, comprovados = new Set(), considerarDecretosNoMeio = true, considerarInstabilidadesNoMeio = false, considerarDecretosNaProrrogacao = true) => {
        let diasUteisContados = 0;
        const diasNaoUteisEncontrados = [];
        const dataCorrente = new Date(inicioDoPrazo.getTime());

        while (diasUteisContados < prazo) {
            const dataCorrenteStr = dataCorrente.toISOString().split('T')[0];

            let infoDiaNaoUtil = null;

            const eFeriadoOuRecesso = getMotivoDiaNaoUtil(dataCorrente, true, 'feriado') || getMotivoDiaNaoUtil(dataCorrente, true, 'recesso');
            const eDecreto = getMotivoDiaNaoUtil(dataCorrente, true, 'decreto');
            const eInstabilidade = getMotivoDiaNaoUtil(dataCorrente, true, 'instabilidade');

            if (eFeriadoOuRecesso) {
                infoDiaNaoUtil = eFeriadoOuRecesso;
            } else if (considerarDecretosNoMeio && eDecreto && comprovados.has(dataCorrenteStr)) {
                infoDiaNaoUtil = eDecreto;
            } else if (considerarInstabilidadesNoMeio && eInstabilidade && comprovados.has(dataCorrenteStr)) {
                infoDiaNaoUtil = eInstabilidade;
            }

            if (dataCorrente.getDay() === 0 || dataCorrente.getDay() === 6 || infoDiaNaoUtil) {
                if (infoDiaNaoUtil && (considerarDecretosNoMeio || considerarInstabilidadesNoMeio)) {
                    diasNaoUteisEncontrados.push({ data: new Date(dataCorrente.getTime()), ...infoDiaNaoUtil });
                }
            } else {
                diasUteisContados++;
            }

            if (diasUteisContados < prazo) {
                dataCorrente.setDate(dataCorrente.getDate() + 1);
            }
        }

        let prazoFinalAjustado = dataCorrente;
        let infoDiaFinalNaoUtil;
        const diasProrrogados = [];

        while (
            (infoDiaFinalNaoUtil = getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'feriado') ||
                getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'recesso') ||
                (considerarDecretosNaProrrogacao && getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'decreto')?.tipo === 'feriado_cnj') ||
                (considerarDecretosNaProrrogacao && comprovados.has(prazoFinalAjustado.toISOString().split('T')[0]) && getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'decreto')) ||
                (considerarDecretosNaProrrogacao && getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'instabilidade')) // CORREÇÃO: Instabilidades devem prorrogar o cível também.
            ) ||
            prazoFinalAjustado.getDay() === 0 || prazoFinalAjustado.getDay() === 6
        ) {
            if (infoDiaFinalNaoUtil) diasProrrogados.push({ data: new Date(prazoFinalAjustado.getTime()), ...infoDiaFinalNaoUtil });
            prazoFinalAjustado.setDate(prazoFinalAjustado.getDate() + 1);
        }
        return { prazoFinal: prazoFinalAjustado, diasNaoUteis: diasNaoUteisEncontrados, diasProrrogados };
    };

    const calcularPrazoFinalDiasCorridos = (inicioDoPrazo, prazo, comprovados = new Set(), ignorarRecesso = false, considerarDecretosNaProrrogacao = true) => {
        /**
         * Para prazos de 'crime' (dias corridos):
         * 1. O início do prazo é ajustado para o próximo dia útil (se cair em fim de semana, feriado, etc.).
         * 2. A data final é calculada somando-se os dias corridos do prazo ao início ajustado.
         * 3. A data final é prorrogada se cair em um dia não útil (fim de semana, feriado, recesso ou suspensão comprovada).
         */

        const diasNaoUteisEncontrados = [];
        const diasPotenciaisComprovaveis = [];
        let diasDeSuspensaoComprovadaNoPeriodo = 0;
        const diasNaoUteisDoInicio = []; // Adicionado para rastrear suspensões no início

        // 1. Ajusta o início do prazo para o próximo dia útil, se necessário.
        let inicioAjustado = new Date(inicioDoPrazo.getTime());
        let infoDiaInicioNaoUtil;
        // O início do prazo só deve ser prorrogado por decretos/instabilidades se eles estiverem no conjunto 'comprovados'
        // E se a flag `considerarDecretosNaProrrogacao` for verdadeira.
        // Feriados e recessos sempre prorrogam.
        // CORREÇÃO: Usar do-while para garantir que a verificação seja feita pelo menos uma vez para a data de início.
        do {
            // Lógica para ignorar recesso se a flag estiver ativa
            const motivoRecesso = getMotivoDiaNaoUtil(inicioAjustado, true, 'recesso');
            const ehRecessoValido = motivoRecesso && !ignorarRecesso;

            (infoDiaInicioNaoUtil = getMotivoDiaNaoUtil(inicioAjustado, true, 'feriado') ||
                (ehRecessoValido ? motivoRecesso : null) ||
                (considerarDecretosNaProrrogacao && comprovados.has(inicioAjustado.toISOString().split('T')[0]) && (getMotivoDiaNaoUtil(inicioAjustado, true, 'decreto') || getMotivoDiaNaoUtil(inicioAjustado, true, 'instabilidade')))
            ) ||
                (inicioAjustado.getDay() === 0 || inicioAjustado.getDay() === 6)
                ? (() => {
                    if (infoDiaInicioNaoUtil) diasNaoUteisDoInicio.push({ data: new Date(inicioAjustado.getTime()), ...infoDiaInicioNaoUtil });
                    inicioAjustado.setDate(inicioAjustado.getDate() + 1);
                })()
                : false; // Condição para sair do loop se não for dia não útil
        } while (infoDiaInicioNaoUtil || inicioAjustado.getDay() === 0 || inicioAjustado.getDay() === 6);

        // 2. Calcula a data final "bruta" somando os dias corridos.
        const dataFinalBruta = new Date(inicioAjustado.getTime());
        // CORREÇÃO: Soma os dias de suspensão comprovados no início ao prazo.
        const diasDeSuspensaoNoInicio = diasNaoUteisDoInicio.filter(d => comprovados.has(d.data.toISOString().split('T')[0])).length;
        // CORREÇÃO: Usamos 'prazo - 1' pois para dias corridos, se o dia 1 é o início, somamos 14 dias para chegar ao 15º.
        // Isso alinha com o resultado esperado do usuário (27/10 + 15 dias = 10/11).
        const diasASomar = (prazo > 0 ? prazo - 1 : 0) + diasDeSuspensaoNoInicio;
        dataFinalBruta.setDate(dataFinalBruta.getDate() + diasASomar);

        // Após o loop principal, verifica se a data final caiu em um dia não útil e prorroga se necessário.
        // CORREÇÃO: Criar uma nova instância de Date para evitar modificar dataFinalBruta
        let prazoFinalAjustado = new Date(dataFinalBruta.getTime());
        let infoDiaFinalNaoUtil;
        const diasProrrogados = [];

        // 3. Prorroga o prazo final se ele cair em um dia não útil (fim de semana, feriado, recesso).
        // A prorrogação por decreto/instabilidade também deve depender da comprovação,
        // que é o que acontece quando esta função é chamada a partir do `handleComprovacaoChange`.
        while (true) {
            // Lógica para ignorar recesso se a flag estiver ativa
            const motivoRecesso = getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'recesso');
            const ehRecessoValido = motivoRecesso && !ignorarRecesso;

            infoDiaFinalNaoUtil = getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'feriado') ||
                (ehRecessoValido ? motivoRecesso : null) ||
                (comprovados.has(prazoFinalAjustado.toISOString().split('T')[0]) && (getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'decreto') || getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'instabilidade')));

            const eFimDeSemana = prazoFinalAjustado.getDay() === 0 || prazoFinalAjustado.getDay() === 6;

            if (infoDiaFinalNaoUtil || eFimDeSemana) {
                if (infoDiaFinalNaoUtil) diasProrrogados.push({ data: new Date(prazoFinalAjustado.getTime()), ...infoDiaFinalNaoUtil });
                prazoFinalAjustado.setDate(prazoFinalAjustado.getDate() + 1);
            } else {
                break;
            }
        }


        // Retorna os dias que foram comprovados e causaram a dilação, os dias que causaram a prorrogação final, e os dias potenciais para a UI.
        return { prazoFinal: dataFinalBruta, prazoFinalProrrogado: prazoFinalAjustado, diasNaoUteis: [...diasNaoUteisEncontrados, ...diasProrrogados], diasProrrogados: diasProrrogados, diasPotenciaisComprovaveis: [...diasPotenciaisComprovaveis, ...diasNaoUteisDoInicio], diasNaoUteisDoInicio: diasNaoUteisDoInicio };
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
        console.log("--- Início do Cálculo ---");
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
            // Constrói a data adicionando 'T00:00:00' para garantir que seja interpretada como data local, evitando problemas de fuso horário.
            const inicioDisponibilizacao = new Date(dataDisponibilizacao + 'T00:00:00');

            // Adiciona uma verificação para garantir que a data construída é válida.
            if (isNaN(inicioDisponibilizacao.getTime())) {
                throw new Error("A data resultante é inválida.");
            }

            const dataLimite = new Date('2025-05-16T00:00:00');

            if (inicioDisponibilizacao < dataLimite) {
                setError('Para datas anteriores a 16/05/2025, a consulta de intimação e a contagem do respectivo prazo devem ser realizadas diretamente no sistema Projudi.');
                return;
            }

            const prazoNumerico = prazoSelecionado;

            // Lógica de Disponibilização Efetiva:
            // Se a data informada (inicioDisponibilizacao) for dia não útil, a disponibilização considera-se realizada no primeiro dia útil seguinte.
            // Para calcular isso corretamente usando a função existente, voltamos um dia e pedimos o próximo útil.
            const ontemDisp = new Date(inicioDisponibilizacao);
            ontemDisp.setDate(ontemDisp.getDate() - 1);

            // Passamos 'diasComprovados' para garantir que decretos marcados sejam considerados "não úteis" para fins de disponibilização.
            const { proximoDia: dataDispEfetiva, suspensoesEncontradas: suspensoesDispEfetiva } = getProximoDiaUtilParaPublicacao(ontemDisp, true, diasComprovados);

            // Agora calculamos a publicação a partir da Disponibilização Efetiva
            const { proximoDia: dataPublicacaoComDecreto, suspensoesEncontradas: suspensoesPublicacaoComDecreto } = getProximoDiaUtilParaPublicacao(dataDispEfetiva, true, diasComprovados);

            // Adiciona as suspensões da fase de disponibilização à lista
            if (suspensoesDispEfetiva) {
                suspensoesPublicacaoComDecreto.unshift(...suspensoesDispEfetiva);
            }

            // CORREÇÃO: Calculamos o início do prazo a partir da publicação
            // CASCATA: Para o cálculo padrão/inicial, NÃO consideramos decretos/instabilidades automaticamente no início.
            // O usuário deve marcar a checkbox para comprovar. Portanto, usamos 'false' aqui.
            const { proximoDia: inicioDoPrazoComDecreto, suspensoesEncontradas: suspensoesInicioComDecreto } = getProximoDiaUtilParaPublicacao(dataPublicacaoComDecreto, false);


            // REMOVIDO: Lógica manual de adicionar suspensões nas datas exatas de Disponibilização/Publicação
            // O usuário informou que instabilidades nessas datas não devem contar (não devem suspender o ato).
            // A função getProximoDiaUtilParaPublicacao já lida com o salto para o próximo dia útil.

            const diasNaoUteisDoInicioComDecreto = [...suspensoesPublicacaoComDecreto, ...suspensoesInicioComDecreto];

            // Agrupa as funções auxiliares para passá-las para as funções de regras
            const helpers = {
                getProximoDiaUtilParaPublicacao,
                calcularPrazoFinalDiasUteis,
                calcularPrazoFinalDiasCorridos,
                getMotivoDiaNaoUtil,
                decretosMap
            };

            let res;
            // Para 'civel', usa a lógica de dias úteis. Para 'crime', usa a lógica de dias corridos com possibilidade de comprovação.
            if (tipoPrazo === 'civel' || tipoPrazo === 'juizado_civel') {
                res = calcularPrazoCivel(
                    dataPublicacaoComDecreto,
                    inicioDoPrazoComDecreto,
                    prazoNumerico,
                    suspensoesInicioComDecreto,
                    inicioDisponibilizacao, // Recolocando inicioDisponibilizacao
                    helpers,
                    diasComprovados
                );
            } else if (tipoPrazo === 'crime' || tipoPrazo === 'juizado_crim') {
                res = calcularPrazoCrime(
                    dataPublicacaoComDecreto,
                    inicioDoPrazoComDecreto,
                    prazoNumerico,
                    suspensoesInicioComDecreto,
                    inicioDisponibilizacao, // Correção: Passando o objeto Date, não string
                    helpers,
                    diasComprovados, // Passando dias comprovados
                    ignorarRecesso // Passando a flag de recesso
                );
            }


            // Ajusta estrutura de retorno
            // --- LOGICA DE TRACE ---
            const traceSteps = [];

            // 1. Disponibilização (Input)
            traceSteps.push({
                step: 'Disponibilização',
                date: inicioDisponibilizacao,
                description: 'Data de disponibilização no Diário da Justiça'
            });

            // 2. Disponibilização Efetiva
            if (dataDispEfetiva.getTime() !== inicioDisponibilizacao.getTime()) {
                if (suspensoesDispEfetiva && suspensoesDispEfetiva.length > 0) {
                    traceSteps.push({
                        step: 'Suspensões na Disponibilização',
                        suspensoes: suspensoesDispEfetiva,
                        description: 'Não houve expediente na data informada ou anterior'
                    });
                }
                traceSteps.push({
                    step: 'Disponibilização Considerada',
                    date: dataDispEfetiva,
                    description: 'Considerada no primeiro dia útil seguinte'
                });
            } else if (suspensoesDispEfetiva && suspensoesDispEfetiva.length > 0) {
                // Caso raro onde houve suspensão mas a data efetiva é a mesma (ex: suspensão parcial ou erro de lógica anterior, mas bom garantir)
                traceSteps.push({
                    step: 'Suspensões na Disponibilização',
                    suspensoes: suspensoesDispEfetiva,
                    description: 'Não houve expediente'
                });
            }

            // 3. Publicação
            if (suspensoesPublicacaoComDecreto && suspensoesPublicacaoComDecreto.length > 0) {
                traceSteps.push({
                    step: 'Intervalo Disponibilização -> Publicação',
                    suspensoes: suspensoesPublicacaoComDecreto,
                    description: 'Dias não úteis que adiaram a publicação'
                });
            }

            traceSteps.push({
                step: 'Data da Publicação',
                date: dataPublicacaoComDecreto,
                description: 'Primeiro dia útil após a disponibilização considerada'
            });

            // 4. Início do Prazo
            if (suspensoesInicioComDecreto && suspensoesInicioComDecreto.length > 0) {
                traceSteps.push({
                    step: 'Intervalo Publicação -> Início do Prazo',
                    suspensoes: suspensoesInicioComDecreto,
                    description: 'Dias não úteis que adiaram o início da contagem'
                });
            }

            traceSteps.push({
                step: 'Início da Contagem',
                date: inicioDoPrazoComDecreto,
                description: 'O prazo começa a contar no primeiro dia útil após a publicação'
            });

            res.trace = traceSteps;

            setResultado(res);

            logUsage();
        } catch (e) {
            console.error(e);
            setError(e.message);
        }
    };

    const handleComprovacaoChange = (dataString, dataDisponibilizacaoAtual) => {
        console.log("handleComprovacaoChange chamado para:", dataString);
        let novosComprovados = new Set(diasComprovados);
        // REGRA CNJ: Agrupa a comprovação de Corpus Christi.
        if (dataString === DATA_CORPUS_CHRISTI) {
            novosComprovados = agruparComprovacaoCorpusChristi(novosComprovados);
        } else {
            // Comportamento padrão para outros decretos
            novosComprovados.has(dataString) ? novosComprovados.delete(dataString) : novosComprovados.add(dataString);
        }
        console.log("Dias comprovados (após toggle):", Array.from(novosComprovados));
        setDiasComprovados(novosComprovados);

        // Recalcula o prazo com base nos dias agora comprovados
        // CORREÇÃO: É mais seguro obter esses valores de dentro da função de atualização do estado
        // para evitar o uso de um 'resultado' obsoleto (stale closure).

        setResultado(prev => {
            if (!dataDisponibilizacaoAtual) return prev; // Proteção para não recalcular sem data

            const { prazo, tipo, semDecreto, inicioPrazo: inicioPrazoOriginal } = prev;

            // Se nenhuma checkbox estiver marcada, o "Cenário 2" deve ser exatamente igual ao "Cenário 1".
            if (novosComprovados.size === 0) {
                return {
                    ...prev,
                    comDecreto: { ...semDecreto }, // Restaura o cenário 2
                    inicioPrazo: inicioPrazoOriginal, // Restaura o início do prazo original do cálculo inicial
                    suspensoesComprovaveis: prev.suspensoesComprovaveis.filter(s => {
                        // Mantém apenas as suspensões do início e a primeira do final
                        const dataStr = s.data.toISOString().split('T')[0];
                        const inicioDisp = new Date(dataDisponibilizacaoAtual + 'T00:00:00');
                        return s.data <= semDecreto.prazoFinal || s.data <= inicioPrazoOriginal;
                    })
                };
            }

            // Se houver checkboxes marcadas, recalcula o prazo considerando os dias comprovados.
            // CORREÇÃO: O recálculo deve partir da data de disponibilização original para ser preciso.
            const inicioDisponibilizacao = new Date(dataDisponibilizacaoAtual + 'T00:00:00');
            const { proximoDia: novaDataPublicacao } = getProximoDiaUtilComprovado(inicioDisponibilizacao, novosComprovados);
            const { proximoDia: novoInicioDoPrazo } = getProximoDiaUtilComprovado(novaDataPublicacao, novosComprovados); // Correção aqui
            let novoResultadoComDecreto;

            if (tipo === 'civel') {
                novoResultadoComDecreto = calcularPrazoFinalDiasUteis(novoInicioDoPrazo, prazo, novosComprovados, true, true, true);

                // CASCATA CÍVEL: Verifica se surgiram novas suspensões
                const novasSuspensoesComprovaveis = [...prev.suspensoesComprovaveis];
                let novaSuspensaoEncontrada = null;

                // Checa Início
                const suspensaoInicio = getProximaSuspensaoComprovavel(novoInicioDoPrazo, novosComprovados);
                if (suspensaoInicio) novaSuspensaoEncontrada = suspensaoInicio;

                // Checa Final (se não achou no início)
                if (!novaSuspensaoEncontrada) {
                    const suspensaoFinal = getProximaSuspensaoComprovavel(novoResultadoComDecreto.prazoFinal, novosComprovados);
                    if (suspensaoFinal) novaSuspensaoEncontrada = suspensaoFinal;
                }

                // Checa Prorrogações do meio
                if (!novaSuspensaoEncontrada && novoResultadoComDecreto.diasProrrogados) {
                    for (const dia of novoResultadoComDecreto.diasProrrogados) {
                        const suspensaoProrrogacao = getProximaSuspensaoComprovavel(dia.data, novosComprovados);
                        if (suspensaoProrrogacao) {
                            novaSuspensaoEncontrada = suspensaoProrrogacao;
                            break;
                        }
                    }
                }

                if (novaSuspensaoEncontrada) {
                    const dataNovaStr = novaSuspensaoEncontrada.data.toISOString().split('T')[0];
                    if (!novasSuspensoesComprovaveis.some(s => s.data.toISOString().split('T')[0] === dataNovaStr)) {
                        novasSuspensoesComprovaveis.push(novaSuspensaoEncontrada);
                    }
                }

                return {
                    ...prev,
                    comDecreto: novoResultadoComDecreto,
                    suspensoesComprovaveis: novasSuspensoesComprovaveis.sort((a, b) => a.data - b.data)
                };
            } else { // Para 'crime', o recálculo é sempre em dias corridos.
                novoResultadoComDecreto = calcularPrazoFinalDiasCorridos(novoInicioDoPrazo, prazo, novosComprovados, true);

                const novasSuspensoesComprovaveis = [...prev.suspensoesComprovaveis];
                let novaSuspensaoEncontrada = null;

                // Checa Início
                const suspensaoInicio = getProximaSuspensaoComprovavel(novoInicioDoPrazo, novosComprovados);
                if (suspensaoInicio) novaSuspensaoEncontrada = suspensaoInicio;

                // Checa Final
                if (!novaSuspensaoEncontrada) {
                    const novaSuspensao = getProximaSuspensaoComprovavel(novoResultadoComDecreto.prazoFinalProrrogado, novosComprovados);
                    if (novaSuspensao) novaSuspensaoEncontrada = novaSuspensao;
                }

                // Checa Prorrogações
                if (!novaSuspensaoEncontrada && novoResultadoComDecreto.diasProrrogados) {
                    for (const dia of novoResultadoComDecreto.diasProrrogados) {
                        const suspensaoProrrogacao = getProximaSuspensaoComprovavel(dia.data, novosComprovados);
                        if (suspensaoProrrogacao) {
                            novaSuspensaoEncontrada = suspensaoProrrogacao;
                            break;
                        }
                    }
                }

                if (novaSuspensaoEncontrada) {
                    const dataNovaStr = novaSuspensaoEncontrada.data.toISOString().split('T')[0];
                    if (!novasSuspensoesComprovaveis.some(s => s.data.toISOString().split('T')[0] === dataNovaStr)) {
                        novasSuspensoesComprovaveis.push(novaSuspensaoEncontrada);
                    }
                }

                return {
                    ...prev,
                    comDecreto: novoResultadoComDecreto,
                    suspensoesComprovaveis: novasSuspensoesComprovaveis.sort((a, b) => a.data - b.data)
                };
            }
        });
    };

    const analisarTempestividade = () => {
        if (resultado && dataInterposicao) {
            try {
                // Converte a data de interposição para um objeto Date em UTC para evitar problemas de fuso horário.
                const [year, month, day] = dataInterposicao.split('-').map(Number); // '2025-09-05' -> [2025, 9, 5]
                const dataInterposicaoObj = new Date(Date.UTC(year, month - 1, day)); // Cria a data em UTC

                // Prazo final do Cenário 1 (sem nenhuma comprovação).
                const prazoFinalSemDecretoObj = resultado.semDecreto.prazoFinalProrrogado || resultado.semDecreto.prazoFinal;
                const prazoFinalSemDecreto = new Date(Date.UTC(prazoFinalSemDecretoObj.getFullYear(), prazoFinalSemDecretoObj.getMonth(), prazoFinalSemDecretoObj.getDate()));

                // Prazo final do Cenário 2 (considerando as comprovações atuais).
                const prazoFinalComDecretoObj = resultado.comDecreto.prazoFinalProrrogado || resultado.comDecreto.prazoFinal;
                const prazoFinalComDecreto = new Date(Date.UTC(prazoFinalComDecretoObj.getFullYear(), prazoFinalComDecretoObj.getMonth(), prazoFinalComDecretoObj.getDate()));

                // Calcula a diferença de dias entre a interposição e o prazo final do Cenário 1.
                const diffTime = dataInterposicaoObj.getTime() - prazoFinalSemDecreto.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // 1. Tempestivo: A interposição ocorreu dentro do prazo recalculado (Cenário 2).
                if (dataInterposicaoObj.getTime() <= prazoFinalComDecreto.getTime()) {
                    setTempestividade('tempestivo');
                    // 2. Intempestivo por 2 ou mais dias: A interposição ocorreu 2 ou mais dias após o prazo do Cenário 1.
                    // Neste caso, é puramente intempestivo, mesmo que houvesse decretos a comprovar.
                } else if (diffDays >= 2) {
                    setTempestividade('puramente_intempestivo');
                    // 3. Intempestivo por 1 dia: A interposição ocorreu exatamente 1 dia após o prazo do Cenário 1.
                    // Neste caso, o sistema deve sugerir a intimação para comprovar possíveis suspensões.
                } else if (diffDays === 1) {
                    setTempestividade('intempestivo_falta_decreto');
                    // 4. Fallback para outros casos de intempestividade.
                } else {
                    setTempestividade('puramente_intempestivo');
                }

            } catch (e) {
                setTempestividade(null);
            }
        } else {
            setTempestividade(null);
        }
    };

    useEffect(() => {
        analisarTempestividade();
    }, [dataInterposicao, resultado]); // Removido diasComprovados para evitar re-execução desnecessária

    // Efeito para enviar o resultado de volta para o sistema externo (Triagem) via postMessage
    useEffect(() => {
        if (resultado) {
            const dadosExportacao = {
                type: 'RESULTADO_CALCULO',
                payload: {
                    numeroProcesso,
                    materia: tipoPrazo,
                    prazoDias: prazoSelecionado,
                    dataDisponibilizacao,
                    dataPublicacao: resultado.dataPublicacao,
                    inicioPrazo: resultado.inicioPrazo,
                    prazoFinal: resultado.comDecreto?.prazoFinalProrrogado || resultado.comDecreto?.prazoFinal,
                    tempestividade,
                    dataInterposicao
                }
            };

            // Clona e serializa para garantir formato compatível (Dates viram Strings ISO)
            const mensagem = JSON.parse(JSON.stringify(dadosExportacao));

            // Envia para a janela pai (se Iframe) ou opener (se nova aba)
            const target = window.opener || (window.parent !== window ? window.parent : null);
            if (target) {
                target.postMessage(mensagem, '*');
            }
        }
    }, [resultado, tempestividade, numeroProcesso, tipoPrazo, prazoSelecionado, dataDisponibilizacao, dataInterposicao]);

    useEffect(() => {
        if (db) {
            const unsubscribe = db.collection('configuracoes').doc('minutas').onSnapshot(doc => {
                if (doc.exists && doc.data().tipos) {
                    setCustomMinutaTypes(doc.data().tipos.filter(t => t.id !== 'exemplo_didatico'));
                }
            });
            return () => unsubscribe();
        }
    }, []);

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
    const generateDocFromHtml = (bodyHtml, minutaType, placeholders, outputFileName, arUsuario = null) => {
        try {
            const pStyle = "text-align: justify; text-indent: 50px; margin-bottom: 1em; font-family: Arial, sans-serif; font-size: 16pt;";
            const pCenterStyle = "text-align: center; margin: 0; font-family: Arial, sans-serif; font-size: 16pt;";

            // Adiciona o rodapé padrão
            const finalHtml = `
            ${bodyHtml}
            <br>
            <p style="${pCenterStyle}">Curitiba, data da assinatura digital.</p>
            <br><br>
            <p style="${pCenterStyle}"><b>Desembargador HAYTON LEE SWAIN FILHO</b></p>
            <p style="${pCenterStyle}">1º Vice-Presidente do Tribunal de Justiça do Estado do Paraná</p>
            ${arUsuario ? `
                <br>
                <p style="font-family: Arial, sans-serif; font-size: 10pt; text-align: left; margin: 0;">${arUsuario.trim()}</p>
            ` : ''}
        `;

            const sourceHTML = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>Minuta Despacho</title>
            <style>
                p { font-family: Arial, sans-serif; font-size: 16pt; line-height: 1.5; }
            </style>
            </head>
            <body>
                <div>
                    ${finalHtml}
                </div>
            </body>
            </html>
        `;

            const blob = new Blob([sourceHTML], { type: 'application/msword' });
            saveAs(blob, outputFileName);
        } catch (err) {
            console.error("Erro ao gerar documento:", err);
            setError(`Ocorreu um erro ao gerar o arquivo. Verifique o console ou tente em outro navegador.`);
        }
    };

    // Função para buscar a minuta do Firestore ou usar o padrão
    const getMinutaContent = async (minutaType) => {
        // Se o usuário for de um setor específico, tenta buscar a minuta personalizada
        if (userData?.setorId) {
            const docId = `${userData.setorId}_${minutaType}`;
            try {
                const docRef = db.collection('minutas').doc(docId);
                const doc = await docRef.get();
                if (doc.exists) {
                    return doc.data().conteudo;
                }
            } catch (err) {
                console.error(`Erro ao buscar minuta personalizada '${docId}'. Usando padrão.`, err);
            }
        }
        // Se não houver setor, ou se a busca falhar, ou se o documento não existir, usa o padrão.
        return MINUTAS_PADRAO[minutaType];
    };

    const replacePlaceholders = (template, placeholders) => {
        return Object.entries(placeholders).reduce((acc, [key, value]) => acc.replace(new RegExp(key, 'g'), value), template);
    };

    const gerarMinutaIntempestividade = async () => {
        const { dataPublicacao, inicioPrazo, prazo, suspensoesComprovaveis } = resultado;
        const todasSuspensoes = new Set(suspensoesComprovaveis.map(d => d.data.toISOString().split('T')[0]));
        const prazoFinalMaximo = calcularPrazoFinalDiasUteis(inicioPrazo, prazo, todasSuspensoes, true, true, true).prazoFinal;

        const dataDispStr = formatarData(new Date(dataDisponibilizacao + 'T00:00:00'));
        const dataPubStr = formatarData(dataPublicacao);
        const inicioPrazoStr = formatarData(inicioPrazo);
        const dataInterposicaoStr = formatarData(new Date(dataInterposicao + 'T00:00:00'));

        const placeholders = {
            '{{numeroProcesso}}': numeroProcesso || '<span style="color: red;">[Nº Processo]</span>',
            '{{movAcordao}}': '<span style="color: red;">[Mov. Acórdão]</span>',
            '{{dataDisponibilizacao}}': dataDispStr,
            '{{dataPublicacao}}': dataPubStr,
            '{{inicioPrazo}}': inicioPrazoStr,
            '{{dataInterposicao}}': dataInterposicaoStr,
            '{{prazoDias}}': prazoSelecionado,
        };

        const template = await getMinutaContent('intempestividade');
        const corpoMinuta = replacePlaceholders(template, placeholders);

        generateDocFromHtml(
            corpoMinuta,
            'intempestividade',
            placeholders,
            `Minuta_Intempestividade_${numeroProcesso.replace(/\D/g, '') || 'processo'}.doc`
        );
    };

    const gerarMinutaIntimacaoDecreto = async () => {
        const arUsuario = window.prompt("Por favor, insira o código AR do usuário (ex: AR1234):", "");
        if (arUsuario === null || arUsuario.trim() === "") {
            // Usuário cancelou ou não inseriu nada
            return;
        }

        const template = await getMinutaContent('intimacao_decreto');
        // Esta minuta não tem placeholders, então o corpo é o próprio template.
        const corpoMinuta = template;

        generateDocFromHtml(
            corpoMinuta,
            'intimacao_decreto',
            {},
            `Minuta_Intimacao_Decreto_${numeroProcesso.replace(/\D/g, '') || 'processo'}.doc`,
            arUsuario
        );
    };

    const gerarMinutaIntimacaoDecretoCrime = async () => {
        const arUsuario = window.prompt("Por favor, insira o código AR do usuário (ex: AR1234):", "");
        if (arUsuario === null || arUsuario.trim() === "") {
            // Usuário cancelou ou não inseriu nada
            return;
        }

        const template = await getMinutaContent('intimacao_decreto_crime');

        generateDocFromHtml(
            template,
            'intimacao_decreto_crime',
            {},
            `Minuta_Intimacao_Decreto_Crime_${numeroProcesso.replace(/\D/g, '') || 'processo'}.doc`,
            arUsuario
        );
    };

    const gerarMinutaFaltaDecreto = async () => {
        const { inicioPrazo, semDecreto } = resultado;
        const dataDispStr = formatarData(new Date(dataDisponibilizacao + 'T00:00:00'));
        const inicioPrazoStr = formatarData(inicioPrazo);
        const prazoFinalStr = formatarData(semDecreto.prazoFinalProrrogado);

        const placeholders = {
            '{{camara}}': '<span style="color: red;">[Nº da Câmara]</span>',
            '{{recursoApelacao}}': '<span style="color: red;">[Tipo e Mov. do Recurso]</span>',
            '{{dataLeitura}}': dataDispStr, // O template usa 'dataLeitura', mas o valor correto é da disponibilização
            '{{movIntimacao}}': '<span style="color: red;">[Mov. Intimação]</span>',
            '{{inicioPrazo}}': inicioPrazoStr,
            '{{prazoFinal}}': prazoFinalStr,
            '{{movDespacho}}': '<span style="color: red;">[Mov. Despacho]</span>',
            '{{movCertidao}}': '<span style="color: red;">[Mov. Certidão]</span>',
        };

        const template = await getMinutaContent('falta_decreto');
        const corpoMinuta = replacePlaceholders(template, placeholders);

        generateDocFromHtml(
            corpoMinuta,
            'falta_decreto',
            placeholders,
            `Minuta_Intempestivo_Falta_Decreto_${numeroProcesso.replace(/\D/g, '') || 'processo'}.doc`
        );
    };

    const gerarMinutaGenerica = async (tipo) => {
        if (!resultado) return;
        const { dataPublicacao, inicioPrazo, comDecreto } = resultado;

        const dataDispStr = formatarData(new Date(dataDisponibilizacao + 'T00:00:00'));
        const dataPubStr = formatarData(dataPublicacao);
        const inicioPrazoStr = formatarData(inicioPrazo);
        const prazoFinalStr = formatarData(comDecreto.prazoFinalProrrogado || comDecreto.prazoFinal);
        const dataInterposicaoStr = dataInterposicao ? formatarData(new Date(dataInterposicao + 'T00:00:00')) : '[Data Interposição]';

        const placeholders = {
            '{{numeroProcesso}}': numeroProcesso || '[Nº Processo]',
            '{{dataDisponibilizacao}}': dataDispStr,
            '{{dataPublicacao}}': dataPubStr,
            '{{inicioPrazo}}': inicioPrazoStr,
            '{{prazoDias}}': prazoSelecionado,
            '{{prazoFinal}}': prazoFinalStr,
            '{{dataInterposicao}}': dataInterposicaoStr,
            '{{movAcordao}}': '<span style="color: red;">[Mov. Acórdão]</span>',
            '{{camara}}': '<span style="color: red;">[Nº da Câmara]</span>',
            '{{recursoApelacao}}': '<span style="color: red;">[Tipo e Mov. do Recurso]</span>',
            '{{movIntimacao}}': '<span style="color: red;">[Mov. Intimação]</span>',
            '{{movDespacho}}': '<span style="color: red;">[Mov. Despacho]</span>',
            '{{movCertidao}}': '<span style="color: red;">[Mov. Certidão]</span>',
        };

        const template = await getMinutaContent(tipo.id);
        const corpoMinuta = replacePlaceholders(template, placeholders);

        generateDocFromHtml(
            corpoMinuta,
            tipo.id,
            placeholders,
            `Minuta_${tipo.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${numeroProcesso.replace(/\D/g, '') || 'processo'}.doc`
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <UserIDWatermark overlay={true} />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Calculadora de Prazo Final</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Calcule o prazo final considerando as regras de contagem para cada matéria.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Matéria</label>
                    <div className="flex rounded-xl shadow-sm bg-slate-100 dark:bg-slate-800 p-1">
                        <button onClick={() => setTipoPrazo('civel')} className={`w-full px-4 py-2 text-sm font-bold transition-all duration-200 rounded-lg ${tipoPrazo === 'civel' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Cível</button>
                        <button onClick={() => setTipoPrazo('crime')} className={`w-full px-4 py-2 text-sm font-bold transition-all duration-200 rounded-lg ${tipoPrazo === 'crime' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Crime</button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Prazo</label>
                    <div className="flex rounded-xl shadow-sm bg-slate-100 dark:bg-slate-800 p-1">
                        <button onClick={() => setPrazoSelecionado(5)} className={`w-full px-4 py-2 text-sm font-bold transition-all duration-200 rounded-lg ${prazoSelecionado == 5 ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>5 Dias</button>
                        <button onClick={() => setPrazoSelecionado(15)} className={`w-full px-4 py-2 text-sm font-bold transition-all duration-200 rounded-lg ${prazoSelecionado == 15 ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>15 Dias</button>
                        <button onClick={() => setPrazoSelecionado(30)} className={`w-full px-4 py-2 text-sm font-bold transition-all duration-200 rounded-lg ${prazoSelecionado == 30 ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>30 Dias</button>
                    </div>
                    {/* O botão para inserir prazo manualmente só aparece para a matéria de Crime */}
                    {tipoPrazo === 'crime' && (
                        <div className="mt-2 text-center">
                            {!showManualPrazoInput ? (
                                <button onClick={() => setShowManualPrazoInput(true)} className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                                    Inserir prazo manualmente
                                </button>
                            ) : (
                                <input type="number" placeholder="Digite o prazo em dias" value={![5, 15, 30].includes(prazoSelecionado) ? prazoSelecionado : ''} onChange={(e) => setPrazoSelecionado(e.target.value ? parseInt(e.target.value, 10) : '')} className="w-full md:w-1/2 mt-1 p-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 animate-fade-in focus:ring-2 focus:ring-blue-500 outline-none" />
                            )}
                        </div>
                    )}
                </div>
                {/* Opção para ignorar recesso (Réu Preso / Maria da Penha) - Exclusivo Crime */}
                {tipoPrazo === 'crime' && (
                    <div className="md:col-span-2 mt-2 flex justify-center">
                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <input
                                type="checkbox"
                                checked={ignorarRecesso}
                                onChange={(e) => setIgnorarRecesso(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Réu preso ou Lei Maria da Penha (ignorar recesso)
                            </span>
                        </label>
                    </div>
                )}
            </div>
            <div>
                <label htmlFor="data-disponibilizacao" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Data de Disponibilização</label>
                <input
                    type="date"
                    id="data-disponibilizacao"
                    value={dataDisponibilizacao}
                    onChange={e => setDataDisponibilizacao(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-medium text-slate-700 dark:text-slate-200" />
            </div>
            <div className="mt-4">
                <button onClick={handleCalcular} className="w-full flex justify-center items-center bg-blue-600 text-white font-bold py-4 px-6 rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg shadow-blue-500/30 transform hover:scale-[1.01]">Calcular Prazo Final</button>
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
                    {(resultado.tipo === 'civel' || resultado.tipo === 'crime') && (
                        <>
                            {resultado.suspensoesComprovaveis.length > 0 ? (
                                <>
                                    <div className="p-4 mb-4 text-sm text-orange-800 rounded-lg bg-orange-50 dark:bg-gray-800 dark:text-orange-400" role="alert">
                                        <span className="font-medium">Atenção!</span> Foram identificadas suspensões de prazo no período. Marque abaixo as que foram comprovadas nos autos para recalcular o prazo.
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="border-r md:pr-4">
                                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 text-center mb-2">Cenário 1: Sem Decreto</h3>
                                            <p className="text-center text-slate-600 dark:text-slate-300">O prazo final de {resultado.prazo} dias {resultado.tipo === 'crime' ? 'corridos' : 'úteis'} é:</p>
                                            <p className="text-center mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">{formatarData(resultado.semDecreto.prazoFinalProrrogado || resultado.semDecreto.prazoFinal)}</p>
                                            {resultado.semDecreto.diasNaoUteis.length > 0 && <div className="mt-4 text-left"><p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Dias não úteis:</p><ul className="text-xs space-y-1"><GroupedDiasNaoUteis dias={resultado.semDecreto.diasNaoUteis} /></ul></div>}
                                        </div>
                                        <div className="border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 md:pl-4 pt-4 md:pt-0">
                                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 text-center mb-2">Cenário 2: Com Decreto</h3>
                                            <p className="text-center text-slate-600 dark:text-slate-300">O prazo final, <strong>comprovando as suspensões</strong>, é:</p>
                                            <p className="text-center mt-2 text-2xl font-bold text-green-600 dark:text-green-400">{formatarData(resultado.comDecreto.prazoFinalProrrogado || resultado.comDecreto.prazoFinal)}</p>
                                            {resultado.tipo === 'crime' && resultado.comDecreto.diasNaoUteis.length > 0 && (
                                                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                    (Prazo estendido em {resultado.comDecreto.diasNaoUteis.length} dia{resultado.comDecreto.diasNaoUteis.length > 1 ? 's' : ''} devido a comprovações)
                                                </p>
                                            )}

                                            {/* Mostra a seção de comprovação apenas se houver decretos comprováveis */}
                                            {resultado.suspensoesComprovaveis.length > 0 && (
                                                <div className="mt-4 text-left border-t border-slate-300 dark:border-slate-600 pt-2">
                                                    <h4 className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2">Suspensões que influenciaram na dilação do prazo:</h4>
                                                    <div className="space-y-1">
                                                        {/* Lógica para agrupar o Feriado CNJ em uma única checkbox */}
                                                        {resultado.suspensoesComprovaveis.some(d => d.tipo === 'feriado_cnj') && (
                                                            <label className="flex items-center p-2 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700/50 transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    // A checkbox é marcada se QUALQUER um dos dias do feriado CNJ estiver comprovado
                                                                    checked={diasComprovados.has(DATA_CORPUS_CHRISTI) || diasComprovados.has(DATA_POS_CORPUS_CHRISTI)}
                                                                    onChange={() => handleComprovacaoChange(DATA_CORPUS_CHRISTI, dataDisponibilizacao)}
                                                                    className="h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="ml-2 text-xs text-slate-700 dark:text-slate-200">
                                                                    <strong className="font-semibold">{formatarData(new Date(DATA_CORPUS_CHRISTI + 'T00:00:00'))} e {formatarData(new Date(DATA_POS_CORPUS_CHRISTI + 'T00:00:00'))}:</strong> Corpus Christi e Suspensão
                                                                </span>
                                                            </label>
                                                        )}
                                                        {/* Renderiza as outras suspensões normalmente */}
                                                        {resultado.suspensoesComprovaveis.filter(d => d.tipo !== 'feriado_cnj').map(dia => {
                                                            const dataString = dia.data.toISOString().split('T')[0];
                                                            return ( // O key agora é o dataString para garantir unicidade
                                                                <label key={dataString} className="flex items-center p-2 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700/50 transition-colors">
                                                                    <input type="checkbox" checked={diasComprovados.has(dataString)} onChange={() => handleComprovacaoChange(dataString, dataDisponibilizacao)} className="h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500" />
                                                                    <span className="ml-2 text-xs text-slate-700 dark:text-slate-200"><strong className="font-semibold">{formatarData(dia.data)}:</strong> {dia.motivo} ({dia.tipo})</span>
                                                                </label>
                                                            ); // Adicionado o tipo para clareza
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
                                    <p className="text-slate-600 dark:text-slate-300">O prazo final de {resultado.prazo} dias {resultado.tipo === 'crime' ? 'corridos' : 'úteis'} é:</p>
                                    <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">{formatarData(resultado.semDecreto.prazoFinalProrrogado || resultado.semDecreto.prazoFinal)}</p>
                                    {resultado.diasProrrogados && resultado.diasProrrogados.length > 0 && (
                                        <div className="mt-4 p-3 text-xs text-blue-800 rounded-lg bg-blue-50 dark:bg-gray-800 dark:text-blue-400" role="alert"><span className="font-medium">Nota:</span> O prazo foi prorrogado pois o vencimento original ({formatarData(resultado.diasProrrogados[0].data)}) caiu em um dia de suspensão ({resultado.diasProrrogados[0].motivo}).</div>
                                    )}
                                    {resultado.semDecreto.diasNaoUteis.length > 0 && <div className="mt-6 text-left border-t border-slate-300 dark:border-slate-600 pt-4"><p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Dias não úteis considerados no cálculo:</p><ul className="text-xs space-y-1"><GroupedDiasNaoUteis dias={resultado.semDecreto.diasNaoUteis} /></ul></div>}
                                </div>

                            )}

                            {/* EXIBIÇÃO EXPLÍCITA DE PUBLICAÇÃO E INÍCIO (SOLICITADO PELO USUÁRIO) */}
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase mb-1">Dia da Publicação</p>
                                    <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatarData(resultado.dataPublicacao)}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase mb-1">Início do Prazo</p>
                                    <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatarData(resultado.inicioPrazo)}</p>
                                </div>
                            </div>



                            {/* Seção de Tempestividade movida para dentro do bloco 'civel' */}
                            {(userData?.role === 'intermediate' || userData?.role === 'admin') && (
                                <div className="mt-6 border-t border-slate-300 dark:border-slate-600 pt-4 animate-fade-in">
                                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Verificação de Tempestividade</h3>
                                    <div>
                                        <label htmlFor="data-interposicao" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Data de Interposição do Recurso</label>
                                        <input type="date" id="data-interposicao" value={dataInterposicao} onChange={e => setDataInterposicao(e.target.value)} className="w-full md:w-1/2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />
                                    </div>
                                    {tempestividade && (
                                        <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${tempestividade === 'tempestivo' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
                                            {tempestividade === 'tempestivo' ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                            <div>
                                                <p className="font-bold">{tempestividade === 'tempestivo' ? 'RECURSO TEMPESTIVO' : 'RECURSO INTEMPESTIVO'}</p>
                                                <p className="text-sm">O recurso foi interposto {tempestividade === 'tempestivo' ? 'dentro do' : 'fora do'} prazo legal. O prazo final, considerando as suspensões selecionadas, é {formatarData(resultado.comDecreto.prazoFinalProrrogado || resultado.comDecreto.prazoFinal)}.</p>
                                            </div>
                                        </div>
                                    )}
                                    {tempestividade === 'puramente_intempestivo' && (
                                        <div className="mt-4"><button onClick={gerarMinutaIntempestividade} className="w-full md:w-auto flex justify-center items-center bg-gradient-to-br from-red-500 to-red-600 text-white font-semibold py-2 px-5 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-md animate-pulse ring-4 ring-red-300 border-red-500">Baixar Minuta (Intempestivo)</button></div>
                                    )}
                                    {tempestividade === 'intempestivo_falta_decreto' && (
                                        <div className="mt-4 space-y-4">
                                            <div className="p-3 text-sm text-amber-800 rounded-lg bg-amber-50 dark:bg-gray-800 dark:text-amber-400" role="alert">
                                                <span className="font-medium">Atenção:</span> O recurso está intempestivo, a menos que as suspensões de prazo sejam comprovadas.
                                            </div>
                                            <div className="flex items-center gap-4 flex-wrap">
                                                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Gerar outras minutas:</p>
                                                <div className="flex gap-3">
                                                    {resultado.tipo === 'civel' ? (
                                                        <>
                                                            <button onClick={gerarMinutaIntimacaoDecreto} className="flex-1 md:flex-auto justify-center flex items-center bg-gradient-to-br from-sky-500 to-sky-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-sky-600 hover:to-sky-700 transition-all duration-300 shadow-md text-sm animate-pulse ring-4 ring-sky-300">Intimação Decreto</button>
                                                            <button onClick={gerarMinutaFaltaDecreto} className="flex-1 md:flex-auto justify-center flex items-center bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-md text-sm">Intempestivo Falta Decreto</button>
                                                        </>
                                                    ) : (
                                                        <button onClick={gerarMinutaIntimacaoDecretoCrime} className="flex-1 md:flex-auto justify-center flex items-center bg-gradient-to-br from-sky-500 to-sky-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-sky-600 hover:to-sky-700 transition-all duration-300 shadow-md text-sm animate-pulse ring-4 ring-sky-300">Intimação Decreto (Crime)</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Seção de Minutas Personalizadas */}
                            {customMinutaTypes.length > 0 && (
                                <div className="mt-6 border-t border-slate-300 dark:border-slate-600 pt-4 animate-fade-in">
                                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-3">Outras Minutas Disponíveis</h3>
                                    <div className="flex flex-wrap gap-3">
                                        {customMinutaTypes.map(tipo => (
                                            <button key={tipo.id} onClick={() => gerarMinutaGenerica(tipo)} className="px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors shadow-sm flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                                                {tipo.nome}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                </div>
            )}
        </div>
    );
};

const GroupedDiasNaoUteis = ({ dias }) => {
    // Esta função foi movida para helpers.js
    return agruparDiasConsecutivos(dias).map(dia => {
        const key = dia.id || dia.data.toISOString(); // Garante uma chave única
        return <DiaNaoUtilItem key={key} dia={dia} />;
    });
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
            <tr className="border-b last:border-b-0 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">{formatarData(dia.data)}</td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-200">{dia.motivo}</td>
                <td className="px-5 py-3">
                    <div className="flex justify-end">
                        {labelText && <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${labelClasses}`}>{labelText}</span>}
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <Tag className="flex items-center justify-between p-2 bg-slate-100/70 dark:bg-slate-900/50 rounded-md text-slate-700 dark:text-slate-200">
            <div className="flex-grow">
                {dia.tipo === 'recesso_grouped'
                    ? <span className="text-sm">{dia.motivo}</span>
                    : <span className="text-sm">
                        <strong className="font-semibold text-slate-900 dark:text-white">{formatarData(dia.data)}:</strong> {dia.motivo}
                        {dia.link && <a href={dia.link} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline text-xs font-semibold">(Ver Decreto)</a>}
                    </span>}
            </div>
            {labelText && <span className={`ml-3 flex-shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full ${labelClasses}`}>{labelText}</span>}
        </Tag>
    );
};




const PrivacyPolicyModal = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Política de Privacidade e Termos de Uso</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">1. Coleta de Dados</h3>
                    <p>Para o funcionamento desta ferramenta (Calculadora de Prazos e Painel Administrativo), coletamos os seguintes dados pessoais:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Identificação:</strong> Nome, E-mail e Setor de lotação.</li>
                        <li><strong>Dados de Uso:</strong> Registros de cálculos realizados, números de processos consultados, data e hora das ações.</li>
                        <li><strong>Técnicos:</strong> Endereço IP e User-Agent (navegador) para fins de segurança e auditoria.</li>
                    </ul>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4">2. Finalidade</h3>
                    <p>Os dados são utilizados estritamente para:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Autenticação e controle de acesso ao sistema.</li>
                        <li>Geração de histórico de cálculos para o próprio usuário.</li>
                        <li>Auditoria e estatísticas de uso para a administração do sistema (TJPR).</li>
                        <li>Melhoria contínua da ferramenta através da análise de erros reportados.</li>
                    </ul>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4">3. Armazenamento e Segurança</h3>
                    <p>Os dados são armazenados em nuvem utilizando os serviços do Google Firebase, com regras de segurança que restringem o acesso apenas a usuários autorizados e administradores do sistema.</p>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4">4. Seus Direitos (LGPD)</h3>
                    <p>Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Acessar seus dados (disponível no Perfil e Histórico).</li>
                        <li>Corrigir dados incompletos ou desatualizados.</li>
                        <li>Solicitar a exclusão de sua conta e dados pessoais (disponível na opção "Excluir Conta" no perfil).</li>
                    </ul>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4">5. Cookies e Armazenamento Local</h3>
                    <p>Utilizamos armazenamento local (LocalStorage) para salvar suas preferências de tema e configurações da calculadora. Não utilizamos cookies de rastreamento publicitário.</p>
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={onClose} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all">Entendi</button>
                </div>
            </div>
        </div>
    );
};

const CookieConsent = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('lgpd_consent');
        if (!consent) {
            setVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('lgpd_consent', 'true');
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-[80] animate-fade-in">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-slate-600 dark:text-slate-300">
                    <p><strong>Este sistema utiliza dados para funcionamento.</strong></p>
                    <p>Utilizamos armazenamento local para salvar suas preferências e coletamos dados de uso para fins de auditoria e melhoria, em conformidade com a LGPD. Ao continuar, você concorda com nossa Política de Privacidade.</p>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                    <button
                        onClick={() => document.dispatchEvent(new CustomEvent('openPrivacyPolicy'))}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Ler Política
                    </button>
                    <button
                        onClick={handleAccept}
                        className="px-6 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        Concordar e Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

const LoginPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [setorNome, setSetorNome] = useState(''); // Novo estado para o nome do setor
    const [setorIdSelecionado, setSetorIdSelecionado] = useState(''); // Para o <select>
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [rememberedUser, setRememberedUser] = useState(null);
    const [setores, setSetores] = useState([]); // Novo estado para a lista de setores
    const [isCreatingNewSector, setIsCreatingNewSector] = useState(false);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);

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

        // Função para normalizar nomes de setores para comparação
        const normalizeString = (str) => {
            return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
        };

        try {
            const finalEmail = email.includes('@') ? email : `${email}@tjpr.jus.br`;
            if (isLogin) {
                await auth.signInWithEmailAndPassword(finalEmail, password);
                localStorage.setItem('lastUserEmail', finalEmail);
            } else {
                // Validação do setor na tela de registro
                if (password !== confirmPassword) {
                    setError("As senhas não coincidem.");
                    return;
                }

                if (!acceptTerms) {
                    setError("Você precisa concordar com a Política de Privacidade e Termos de Uso para se registrar.");
                    return;
                }


                const isCreatingNew = setorIdSelecionado === '__novo__';
                if (!isCreatingNew && !setorIdSelecionado) {
                    setError("Por favor, selecione o seu setor.");
                    return;
                }
                if (isCreatingNew && !setorNome.trim()) {
                    setError("Por favor, digite o nome do novo setor.");
                    return;
                }

                let setorIdFinal;
                let userCredential;

                // Cria o usuário primeiro para ter o UID
                userCredential = await auth.createUserWithEmailAndPassword(finalEmail, password);

                if (isCreatingNew) {
                    // Lógica para criar um novo setor usando uma transação em lote (batch)
                    const nomeNormalizado = normalizeString(setorNome);

                    if (userCredential?.user) {
                        // Prepara a transação em lote
                        const batch = db.batch();

                        // 1. Documento do novo setor
                        const novoSetorRef = db.collection('setores').doc(); // Gera um ID automaticamente
                        batch.set(novoSetorRef, { nome: setorNome.trim(), nomeNormalizado: nomeNormalizado });

                        // 2. Documento de bloqueio para garantir unicidade do nome
                        const nomeUnicoRef = db.collection('setorNomesUnicos').doc(nomeNormalizado);
                        batch.set(nomeUnicoRef, { setorId: novoSetorRef.id });

                        // Executa a transação
                        await batch.commit();

                        setorIdFinal = novoSetorRef.id; // Usa o ID gerado
                    }
                } else {
                    // Usa o ID do setor selecionado na lista
                    setorIdFinal = setorIdSelecionado;
                }

                await db.collection('users').doc(userCredential.user.uid).set({
                    email: finalEmail,
                    role: 'basic',
                    displayName: displayName.trim(),
                    setorId: setorIdFinal // Adiciona o ID do setor encontrado ou criado
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
                case 'permission-denied':
                    setError('Permissão negada. É provável que o nome do setor que você tentou criar já exista.');
                    // Se a criação do setor falhou, o usuário pode ter sido criado. Tentamos deletá-lo.
                    if (auth.currentUser && auth.currentUser.email === finalEmail) await auth.currentUser.delete();
                    break;
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
        setAcceptTerms(false);
        if (!newIsLogin) { // Se estiver mudando para a tela de registro
            fetchSetores();
        }
    };

    return (
        <div className="flex items-center justify-center h-full p-4">
            <div className="w-full max-w-md p-6 sm:p-10 space-y-6 sm:space-y-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800">
                {rememberedUser && isLogin ? (
                    <>
                        <div className="p-3 text-sm text-blue-800 rounded-lg bg-blue-50 dark:bg-gray-800 dark:text-blue-400" role="alert">
                            <span className="font-medium">Atenção:</span> O seu e-mail do TJPR não está vinculado a esta calculadora. É necessário fazer um novo cadastro para acessar.
                        </div>
                        <h2 className="text-3xl font-extrabold text-center text-slate-900 dark:text-white tracking-tight">Bem-vindo de volta!</h2>
                        <div className="text-center p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                            <p className="font-medium text-slate-700 dark:text-slate-200">{rememberedUser}</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input type="password" placeholder="Palavra-passe" value={password} onChange={e => setPassword(e.target.value)} required autoFocus className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Lembrar-me</label>
                                <a href="#" onClick={(e) => { e.preventDefault(); setIsResettingPassword(true); setError(''); }} className="font-medium text-blue-600 hover:text-blue-500">Esqueceu a senha?</a>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg shadow-blue-500/30">Entrar</button>
                        </form>
                        {error && <p className="text-sm text-center text-red-500 pt-2">{error}</p>}
                        {message && !error && <p className="text-sm text-center text-green-500 pt-2">{message}</p>}
                        <p className="text-center text-sm text-slate-500 dark:text-slate-400 pt-2">
                            <a href="#" onClick={handleSwitchAccount} className="font-medium text-blue-600 hover:text-blue-500">Não é você? Use outra conta</a>
                        </p>
                    </>
                ) : (
                    <>
                        <h2 className="text-3xl font-extrabold text-center text-slate-900 dark:text-white tracking-tight">{isLogin ? 'Acessar Conta' : 'Criar Nova Conta'}</h2>
                        {isLogin && (
                            <div className="p-3 text-sm text-blue-800 rounded-lg bg-blue-50 dark:bg-gray-800 dark:text-blue-400" role="alert">
                                <span className="font-medium">Atenção:</span> O seu e-mail do TJPR não está vinculado a esta calculadora. É necessário fazer um novo cadastro para acessar.
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!isLogin && <input type="text" placeholder="Nome Completo" value={displayName} onChange={e => setDisplayName(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />}
                            {!isLogin && (<>
                                <select
                                    value={setorIdSelecionado}
                                    onChange={e => setSetorIdSelecionado(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                >
                                    <option value="" disabled>Selecione seu setor...</option>
                                    {setores.map(setor => <option key={setor.id} value={setor.id}>{setor.nome}</option>)}
                                    <option value="__novo__" className="font-bold text-blue-600">Não encontrou? Cadastre um novo...</option>
                                </select>
                                {setorIdSelecionado === '__novo__' && (
                                    <input type="text" placeholder="Digite o nome do novo setor" value={setorNome} onChange={e => setSetorNome(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition animate-fade-in" />
                                )}
                            </>
                            )}
                            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition overflow-hidden">
                                <input type="text" placeholder="seu.usuario" value={email} onChange={e => setEmail(e.target.value)} required className="flex-1 min-w-0 px-4 py-3 bg-transparent border-0 outline-none" />
                                <span className="px-2 sm:px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-600 text-xs sm:text-sm whitespace-nowrap">
                                    @tjpr.jus.br
                                </span>
                            </div>
                            <input type="password" placeholder="Palavra-passe" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />
                            {!isLogin && <input type="password" placeholder="Confirmar Palavra-passe" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />}
                            {!isLogin && (
                                <div className="p-3 text-sm text-amber-800 rounded-lg bg-amber-50 dark:bg-gray-800 dark:text-amber-400" role="alert">
                                    <span className="font-medium">Importante:</span> Por segurança, não utilize a mesma senha do seu e-mail do TJPR ou de outros sistemas.
                                </div>
                            )}
                            {!isLogin && (
                                <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                                    <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    <label>
                                        Li e concordo com a <a href="#" onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }} className="text-blue-600 hover:underline">Política de Privacidade e Termos de Uso</a>, incluindo a coleta de dados para fins de auditoria.
                                    </label>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Lembrar-me</label>
                                <a href="#" onClick={(e) => { e.preventDefault(); setIsResettingPassword(true); setError(''); }} className="font-medium text-blue-600 hover:text-blue-500">Esqueceu a senha?</a>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg shadow-blue-500/30">{isLogin ? 'Entrar' : 'Registrar'}</button>
                        </form>
                        {error && <p className="text-sm text-center text-red-500 pt-2">{error}</p>}
                        {message && <p className="text-sm text-center text-green-500 pt-2">{message}</p>}
                        <p className="text-center text-sm text-slate-500 dark:text-slate-400 pt-2">
                            <a href="#" onClick={handleToggleMode} className="font-medium text-blue-600 hover:text-blue-500">
                                {isLogin ? 'Não tem uma conta? Crie uma aqui.' : 'Já tem uma conta? Faça login.'}
                            </a>
                        </p>
                    </>
                )}
            </div>
            {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
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
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const todosDiasNaoUteis = useMemo(() => {
        const format = (map, defaultTipo) => {
            if (!map) return [];
            return Object.entries(map).map(([data, value]) => {
                if (typeof value === 'object' && value.motivo && value.tipo) {
                    return { data, motivo: value.motivo, tipo: value.tipo };
                }
                return { data, motivo: value, tipo: defaultTipo };
            });
        };

        return [
            ...format(feriadosMap, 'feriado'),
            ...format(decretosMap, 'decreto'),
            ...format(instabilidadeMap, 'instabilidade'),
        ].sort((a, b) => new Date(a.data) - new Date(b.data));
    }, [feriadosMap, decretosMap, instabilidadeMap]);

    const availableYears = useMemo(() => {
        const years = new Set([new Date().getFullYear(), new Date().getFullYear() + 1]);
        todosDiasNaoUteis.forEach(dia => {
            const y = parseInt(dia.data.split('-')[0]);
            if (!isNaN(y)) years.add(y);
        });
        return Array.from(years).sort((a, b) => a - b);
    }, [todosDiasNaoUteis]);

    const diasDoAnoSelecionado = useMemo(() =>
        todosDiasNaoUteis.filter(dia => dia.data.startsWith(`${selectedYear}-`)),
        [todosDiasNaoUteis, selectedYear]
    );

    const diasAgrupadosPorMes = useMemo(() => diasDoAnoSelecionado.reduce((acc, dia) => {
        const dataObj = new Date(dia.data + 'T00:00:00');
        const mes = dataObj.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
        const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);
        if (!acc[mesCapitalizado]) {
            acc[mesCapitalizado] = [];
        }
        acc[mesCapitalizado].push(dia);
        return acc;
    }, {}), [diasDoAnoSelecionado]);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col border-b border-slate-200 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-800 rounded-t-2xl z-10">
                    <div className="flex justify-between items-center p-6 pb-2">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Calendário de Suspensões</h2>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex space-x-1 px-6 pb-0 overflow-x-auto scrollbar-hide">
                        {availableYears.map(year => (
                            <button
                                key={year}
                                onClick={() => setSelectedYear(year)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${selectedYear === year
                                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                            >
                                {year}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-y-auto px-6 py-6 custom-scrollbar">
                    <div className="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-lg mb-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Recesso Forense {selectedYear}</h3>
                        <ul className="space-y-2">
                            <DiaNaoUtilItem dia={{ tipo: 'recesso_grouped', motivo: `Suspensão/Recesso de 01/01/${selectedYear} até 20/01/${selectedYear}` }} />
                            <DiaNaoUtilItem dia={{ tipo: 'recesso_grouped', motivo: `Recesso Forense de 20/12/${selectedYear} até 06/01/${selectedYear + 1}` }} />
                        </ul>
                    </div>

                    {calendarLoading ? (
                        <p className="text-center text-slate-500 dark:text-slate-400">Carregando calendário...</p>
                    ) : Object.keys(diasAgrupadosPorMes).length === 0 ? (
                        <p className="text-center text-slate-500 dark:text-slate-400">Nenhuma suspensão cadastrada para {selectedYear} além do recesso padrão.</p>
                    ) : (
                        Object.entries(diasAgrupadosPorMes).map(([mes, dias]) => (
                            <div key={mes} className="mb-6 animate-fade-in">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3 sticky top-0 bg-white/95 dark:bg-slate-800/95 py-2 backdrop-blur-sm z-0">{mes}</h3>
                                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <table className="w-full text-sm text-left table-fixed">
                                        <thead className="text-xs text-slate-700 dark:text-slate-200 uppercase bg-slate-50 dark:bg-slate-700/50">
                                            <tr>
                                                <th className="px-5 py-3 w-[15%]">Data</th>
                                                <th className="px-5 py-3 w-[60%]">Motivo</th>
                                                <th className="px-5 py-3 w-[25%] text-right">Tipo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
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

const BugReportsPage = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    const [filterStatus, setFilterStatus] = useState('aberto'); // 'aberto', 'resolvido', 'todos'

    useEffect(() => {
        if (!db) return;
        const fetchReports = async () => {
            setLoading(true);
            try {
                // Alterado para buscar tudo e filtrar na memória, evitando erro de índice composto no Firestore
                const query = db.collection('bug_reports').orderBy('createdAt', 'desc');
                const snapshot = await query.get();
                let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                if (filterStatus !== 'todos') {
                    data = data.filter(report => report.status === filterStatus);
                }
                setReports(data);
            } catch (error) {
                console.error("Erro ao buscar chamados:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, [filterStatus]);

    const handleStatusChange = async (reportId, newStatus) => {
        try {
            await db.collection('bug_reports').doc(reportId).update({ status: newStatus });
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
            if (selectedReport && selectedReport.id === reportId) {
                setSelectedReport(prev => ({ ...prev, status: newStatus }));
            }
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            alert("Erro ao atualizar status.");
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Chamados de Suporte</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie os reportes de erros enviados pelos usuários.</p>
                </div>
                <div className="flex gap-2">
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="aberto">Abertos</option>
                        <option value="resolvido">Resolvidos</option>
                        <option value="todos">Todos</option>
                    </select>
                </div>
            </div>

            {loading ? <div className="text-center py-8 text-slate-500">Carregando chamados...</div> : reports.length === 0 ? (
                <div className="text-center py-12 bg-slate-100/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><p className="text-slate-500">Nenhum chamado encontrado com este filtro.</p></div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {reports.map(report => (
                        <div key={report.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setSelectedReport(report)}>
                            <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full uppercase ${report.status === 'aberto' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>{report.status}</span>
                                    <span className="text-xs text-slate-400">{report.createdAt ? formatarData(report.createdAt.toDate()) : 'Data desconhecida'}</span>
                                </div>
                                <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{report.description}</p>
                                <p className="text-xs text-slate-500 truncate">Por: {report.userEmail}</p>
                            </div>
                            <button className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 whitespace-nowrap">Ver Detalhes</button>
                        </div>
                    ))}
                </div>
            )}

            {selectedReport && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setSelectedReport(null)}>
                    <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Detalhes do Chamado</h3>
                            <button onClick={() => setSelectedReport(null)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Informações</h4>
                                    <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                                        <p><span className="font-semibold">Status:</span> <span className={`uppercase font-bold ${selectedReport.status === 'aberto' ? 'text-red-600' : 'text-green-600'}`}>{selectedReport.status}</span></p>
                                        <p><span className="font-semibold">Usuário:</span> {selectedReport.userEmail}</p>
                                        <p><span className="font-semibold">Data:</span> {selectedReport.createdAt ? formatarData(selectedReport.createdAt.toDate()) : '-'}</p>
                                        <p><span className="font-semibold">Navegador:</span> {selectedReport.userAgent}</p>
                                        <p><span className="font-semibold">Página:</span> {selectedReport.pageURL}</p>
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mt-6 mb-2">Descrição</h4>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap">{selectedReport.description}</div>
                                    <div className="mt-6">
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Ações</h4>
                                        {selectedReport.status === 'aberto' ? (
                                            <button onClick={() => handleStatusChange(selectedReport.id, 'resolvido')} className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors shadow-sm">Marcar como Resolvido</button>
                                        ) : (
                                            <button onClick={() => handleStatusChange(selectedReport.id, 'aberto')} className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors">Reabrir Chamado</button>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Captura de Tela</h4>
                                    {selectedReport.screenshotBase64 ? (
                                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900">
                                            <img src={selectedReport.screenshotBase64} alt="Screenshot" className="w-full h-auto object-contain cursor-zoom-in" onClick={() => window.open(selectedReport.screenshotBase64, '_blank')} />
                                        </div>
                                    ) : <p className="text-sm text-slate-500 italic">Sem captura de tela.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const AdminPage = ({ setCurrentArea }) => {
    const { user } = useAuth();
    // Estado para controlar a visão dentro da página de Admin: 'stats', 'calendar', 'users'
    const [adminSection, setAdminSection] = useState('stats'); // 'stats', 'calendar', 'users', 'audit'

    const [stats, setStats] = useState({ total: 0, perMateria: {}, perPrazo: {}, byDay: {} });
    const [statsView, setStatsView] = useState('calculadora'); // 'calculadora' ou 'djen_consulta'
    const [allData, setAllData] = useState([]);
    const [viewData, setViewData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ startDate: '', endDate: '', email: 'todos', materia: 'todos', prazo: 'todos', userId: '', setorId: 'todos' });
    const [hasSearched, setHasSearched] = useState(false);
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
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteRange, setDeleteRange] = useState({ start: '', end: '' });
    const [auditLogs, setAuditLogs] = useState([]);
    const [broadcastMessage, setBroadcastMessage] = useState({ mensagem: '', ativo: false, tipo: 'info' });
    const [isSavingBroadcast, setIsSavingBroadcast] = useState(false);

    const handleDeleteClick = () => {
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteRange.start && !deleteRange.end) {
            alert("Por favor, selecione pelo menos uma data.");
            return;
        }

        const start = deleteRange.start ? new Date(deleteRange.start + 'T00:00:00') : new Date(0);
        const end = deleteRange.end ? new Date(deleteRange.end + 'T23:59:59.999') : new Date();

        // Usa filteredData se houver filtros ativos, caso contrário usa allData.
        const sourceData = filteredData.length > 0 ? filteredData : allData;

        const toDelete = sourceData.filter(item => {
            if (!item.timestamp) return false;
            const d = item.timestamp.toDate();
            return d >= start && d <= end;
        });

        if (toDelete.length === 0) {
            alert("Nenhum registro encontrado no período selecionado.");
            return;
        }

        if (window.confirm(`ATENÇÃO: Você está prestes a excluir ${toDelete.length} registros permanentemente.\nPeríodo: ${deleteRange.start || 'Início'} até ${deleteRange.end || 'Hoje'}.\n\nDeseja continuar?`)) {
            setLoading(true);
            try {
                const batchSize = 500;
                const chunks = [];
                for (let i = 0; i < toDelete.length; i += batchSize) chunks.push(toDelete.slice(i, i + batchSize));

                for (const chunk of chunks) {
                    const batch = db.batch();
                    chunk.forEach(doc => batch.delete(db.collection('usageStats').doc(doc.id)));
                    await batch.commit();
                }

                const deletedIds = new Set(toDelete.map(d => d.id));
                setAllData(prev => prev.filter(d => !deletedIds.has(d.id)));
                setFilteredData(prev => prev.filter(d => !deletedIds.has(d.id)));

                alert("Registros excluídos com sucesso.");
                setShowDeleteModal(false);
                await logAudit(db, user, 'EXCLUIR_REGISTROS_USO', `De ${deleteRange.start} até ${deleteRange.end}. Qtd: ${toDelete.length}`);
                setDeleteRange({ start: '', end: '' });
            } catch (err) {
                console.error("Erro ao excluir:", err);
                alert("Erro ao excluir registros.");
            } finally {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        let isMounted = true;
        if (!db) { setLoading(false); return; }
        setLoading(true);

        const loadAdminData = async () => {
            try {
                // 1. Busca usuários e setores em paralelo
                const [usersList, _, broadcastDoc] = await Promise.all([
                    fetchAllUsersForManagement(),
                    fetchSetores(),
                    db.collection('configuracoes').doc('aviso_global').get()
                ]);
                if (!isMounted) return;

                // 2. Busca todas as estatísticas de uso
                const usageSnapshot = await db.collection('usageStats').orderBy('timestamp', 'desc').get();
                if (!isMounted) return;

                let usageData = usageSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const usersMap = usersList.reduce((acc, user) => { acc[user.id] = user; return acc; }, {});

                // 3. Filtra estatísticas para Chefe de Setor
                if (adminUserData.role === 'setor_admin' && adminUserData.setorId) {
                    const userIdsInSector = new Set(usersList.filter(u => u.setorId === adminUserData.setorId).map(u => u.id));
                    usageData = usageData.filter(d => userIdsInSector.has(d.userId));
                }

                const enrichedData = usageData.map(d => ({ ...d, userName: usersMap[d.userId]?.displayName || usersMap[d.userId]?.email || d.userEmail }));

                setAllData(enrichedData);

                if (broadcastDoc.exists) {
                    setBroadcastMessage(broadcastDoc.data());
                }

            } catch (err) { console.error("Firebase query error:", err); }
            finally { if (isMounted) setLoading(false); }
        };

        loadAdminData();
        return () => { isMounted = false; };
    }, [adminUserData]);

    const fetchAllUsersForManagement = async () => {
        setUserManagementLoading(true);
        try {
            // Se o usuário for um 'setor_admin', ele só pode ver usuários do seu setor OU usuários sem setor.
            // O Firestore não suporta queries com 'OU' lógicos em campos diferentes ('setorId' == X OU 'setorId' == null).
            // A abordagem é buscar as duas listas e uni-las no cliente.
            if (adminUserData.role === 'setor_admin' && adminUserData.setorId) {
                const usersInSectorQuery = db.collection('users').where('setorId', '==', adminUserData.setorId).get();
                // A query para usuários sem setor pode ser desnecessária se o chefe de setor só gerencia seu próprio setor.
                // Vamos mantê-la por enquanto, mas pode ser removida se a regra de negócio for estrita.
                const usersWithoutSectorQuery = db.collection('users').where('setorId', '==', null).get();

                const [usersInSectorSnap, usersWithoutSectorSnap] = await Promise.all([usersInSectorQuery, usersWithoutSectorQuery]);

                const usersInSector = usersInSectorSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const usersWithoutSector = usersWithoutSectorSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const combinedUsers = [...usersInSector, ...usersWithoutSector].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
                setAllUsersForManagement(combinedUsers);
                return combinedUsers;
            } else {
                // Apenas o Admin Global executa a query geral
                const snapshot = await db.collection('users').orderBy('displayName').get();
                const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllUsersForManagement(usersList);
                return usersList;
            }
        } catch (err) {
            console.error("Erro ao buscar usuários para gerenciamento:", err);
            if (err.code === 'permission-denied') {
                alert("Você não tem permissão para visualizar todos os usuários.");
            }
        } finally {
            setUserManagementLoading(false);
        }
        return []; // Retorna um array vazio em caso de erro.
    };


    const fetchSetores = async () => {
        if (!db) return;
        try {
            let setoresQuery = db.collection('setores');
            // Se for chefe de gabinete, busca apenas o seu próprio setor.
            if (adminUserData.role === 'setor_admin' && adminUserData.setorId) {
                const setorDoc = await setoresQuery.doc(adminUserData.setorId).get();
                if (setorDoc.exists) {
                    setSetoresAdmin([{ id: setorDoc.id, ...setorDoc.data() }]);
                } else {
                    setSetoresAdmin([]);
                }
            } else { // Admin Global busca todos os setores.
                const snapshot = await setoresQuery.orderBy('nome').get();
                const setoresList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSetoresAdmin(setoresList);
            }
        } catch (err) {
            console.error("Erro ao buscar setores:", err);
        }
    };

    const handleDeleteSector = async (sectorId) => {
        if (window.confirm("Tem certeza que deseja excluir este setor? Esta ação não pode ser desfeita.")) {
            await db.collection('setores').doc(sectorId).delete();
            await logAudit(db, user, 'EXCLUIR_SETOR', `ID: ${sectorId}`);
            fetchSetores(); // Recarrega a lista
        }
    };

    const handleAddSector = async (e) => {
        e.preventDefault();
        if (!newSectorName.trim()) return;
        try {
            await db.collection('setores').add({ nome: newSectorName.trim() });
            await logAudit(db, user, 'CRIAR_SETOR', `Nome: ${newSectorName}`);
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
                await logAudit(db, user, 'EXCLUIR_USUARIO', `Email: ${userToDelete.email}`);
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
        await logAudit(db, user, 'ALTERAR_PERMISSOES', `User: ${userId}, Role: ${data.role}, Setor: ${data.setorId}`);
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
        // Filtra os dados brutos com base na visualização selecionada (Calculadora ou Consulta)
        const dataForView = allData.filter(item => (item.type || 'calculadora') === statsView);
        setViewData(dataForView);
        setHasSearched(false);
        setFilteredData([]);

        // Calcula estatísticas iniciais (sem filtros aplicados) para exibir o dashboard imediatamente
        const summary = {
            total: dataForView.length,
            perMateria: dataForView.reduce((acc, curr) => { if (curr.materia) acc[curr.materia] = (acc[curr.materia] || 0) + 1; return acc; }, {}),
            perPrazo: dataForView.reduce((acc, curr) => { if (curr.prazo) acc[curr.prazo] = (acc[curr.prazo] || 0) + 1; return acc; }, {}),
            perSector: {} // Será calculado abaixo
        };

        const today = new Date();
        const last7Days = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateString = formatarData(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
            last7Days[dateString] = 0;
        }
        dataForView.forEach(item => { const dateString = item.timestamp ? formatarData(item.timestamp.toDate()) : ''; if (dateString in last7Days) { last7Days[dateString]++; } });
        summary.byDay = last7Days;

        // Cálculo por Setor
        const sectorCounts = {};
        dataForView.forEach(item => {
            const user = allUsersForManagement.find(u => u.id === item.userId);
            const sectorId = user?.setorId || 'unknown';
            const sectorName = setores.find(s => s.id === sectorId)?.nome || (sectorId === 'unknown' ? 'Sem Setor' : 'Desconhecido');
            sectorCounts[sectorName] = (sectorCounts[sectorName] || 0) + 1;
        });
        summary.perSector = sectorCounts;

        setStats(summary);
        setFilteredData(dataForView);
        setHasSearched(true);
    }, [statsView, allData, adminUserData]);

    // Filtra a lista de usuários disponíveis no dropdown quando um setor é selecionado
    const usersForFilterDropdown = useMemo(() => {
        const allUsersInView = [...new Set(viewData.map(d => d.userName || d.userEmail))].filter(Boolean).sort();
        if (filters.setorId === 'todos') return allUsersInView;
        const userIdsInSector = new Set(allUsersForManagement.filter(u => u.setorId === filters.setorId).map(u => u.id));
        const usersInSectorData = viewData.filter(d => userIdsInSector.has(d.userId));
        return [...new Set(usersInSectorData.map(d => d.userName || d.userEmail))].filter(Boolean).sort();
    }, [filters.setorId, viewData, allUsersForManagement]);

    const handleFilter = async () => {
        if (!db) return;
        setLoading(true);
        setHasSearched(true);

        // Reverte para a filtragem no cliente
        let usageData = viewData.filter(item => {
            const itemDate = item.timestamp.toDate();
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                if (itemDate < startDate) return false;
            }
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999);
                if (itemDate > endDate) return false;
            }
            if (filters.materia !== 'todos' && item.materia !== filters.materia) return false;
            if (filters.prazo !== 'todos' && item.prazo != filters.prazo) return false;
            if (filters.email !== 'todos' && (item.userName !== filters.email && item.userEmail !== filters.email)) return false;
            if (filters.setorId !== 'todos') {
                const user = allUsersForManagement.find(u => u.id === item.userId);
                if (!user || user.setorId !== filters.setorId) return false;
            }
            if (filters.userId && item.userId !== filters.userId) return false;
            return true;
        });

        setSelectedUserForStats(null);
        setFilteredData(usageData);

        const summary = {
            total: usageData.length,
            perMateria: usageData.reduce((acc, curr) => { acc[curr.materia] = (acc[curr.materia] || 0) + 1; return acc; }, {}),
            perPrazo: usageData.reduce((acc, curr) => { acc[curr.prazo] = (acc[curr.prazo] || 0) + 1; return acc; }, {}),
            perSector: {}
        };

        const sectorCounts = {};
        usageData.forEach(item => {
            const user = allUsersForManagement.find(u => u.id === item.userId);
            const sectorId = user?.setorId || 'unknown';
            const sectorName = setores.find(s => s.id === sectorId)?.nome || (sectorId === 'unknown' ? 'Sem Setor' : 'Desconhecido');
            sectorCounts[sectorName] = (sectorCounts[sectorName] || 0) + 1;
        });
        summary.perSector = sectorCounts;

        // Lógica para o gráfico dos últimos 7 dias
        const today = new Date();
        const last7Days = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateString = formatarData(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
            last7Days[dateString] = 0;
        }
        usageData.forEach(item => { const dateString = formatarData(item.timestamp.toDate()); if (dateString in last7Days) { last7Days[dateString]++; } });
        summary.byDay = last7Days
        setStats(summary);
        setLoading(false);
    };

    const handleUserClick = (userEmail) => {
        const userData = allData.filter(item => item.userEmail === userEmail);
        const userName = userData.length > 0 ? (userData[0].userName || userEmail) : userEmail;
        setSelectedUserForStats({ email: userEmail, name: userName, data: userData }); // 'name' aqui é o userName ou email
    };

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const handleBulkExport = async () => {
        if (!window.JSZip) {
            alert("Biblioteca JSZip não carregada. Por favor, recarregue a página.");
            return;
        }

        const dataToExport = filteredData.length > 0 ? filteredData : allData;
        if (dataToExport.length === 0) {
            alert("Sem dados para exportar.");
            return;
        }

        try {
            const zip = new window.JSZip();
            const grouped = {};

            dataToExport.forEach(item => {
                const userName = item.userName || item.userEmail || 'Desconhecido';
                // Sanitiza o nome da pasta
                const safeName = userName.replace(/[^a-z0-9ãáàâéêíóôõúçñ -]/gi, '_').trim();

                if (!grouped[safeName]) grouped[safeName] = { cnj: [], calc: [] };

                if (item.type === 'djen_consulta') {
                    grouped[safeName].cnj.push(item);
                } else {
                    grouped[safeName].calc.push(item);
                }
            });

            for (const [user, types] of Object.entries(grouped)) {
                const userFolder = zip.folder(user);

                if (types.cnj.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(types.cnj.map(i => ({
                        'Data': i.timestamp ? formatarData(i.timestamp.toDate()) : '',
                        'Processo': i.numeroProcesso,
                        'Tipo': 'Consulta DJEN'
                    })));
                    const csv = XLSX.utils.sheet_to_csv(ws);
                    userFolder.file("pesquisa_cnj.csv", csv);
                }

                if (types.calc.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(types.calc.map(i => ({
                        'Data': i.timestamp ? formatarData(i.timestamp.toDate()) : '',
                        'Processo': i.numeroProcesso,
                        'Matéria': i.materia,
                        'Prazo': i.prazo,
                        'Tipo': 'Calculadora'
                    })));
                    const csv = XLSX.utils.sheet_to_csv(ws);
                    userFolder.file("calculo_crime_civel.csv", csv);
                }
            }

            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, "extracao_dados_usuarios.zip");
        } catch (err) {
            console.error("Erro na exportação ZIP:", err);
            alert("Erro ao gerar arquivo ZIP.");
        }
    };

    const handleBulkDelete = async () => {
        const dataToDelete = filteredData.length > 0 ? filteredData : allData;

        if (dataToDelete.length === 0) {
            alert("Não há registros para excluir.");
            return;
        }

        const isAllData = dataToDelete.length === allData.length;
        const confirmMessage = isAllData
            ? `ATENÇÃO: Você está prestes a excluir TODO o histórico de uso (${dataToDelete.length} registros).\n\nIsso liberará espaço no banco de dados, mas os dados serão perdidos permanentemente.\n\nDeseja continuar?`
            : `Tem certeza que deseja excluir os ${dataToDelete.length} registros filtrados?\n\nEsta ação não pode ser desfeita.`;

        if (!window.confirm(confirmMessage)) return;
        if (isAllData && !window.confirm("Confirmação final: Deseja realmente apagar TODO o histórico?")) return;

        setLoading(true);
        try {
            const batchSize = 500;
            const chunks = [];
            for (let i = 0; i < dataToDelete.length; i += batchSize) chunks.push(dataToDelete.slice(i, i + batchSize));

            for (const chunk of chunks) {
                const batch = db.batch();
                chunk.forEach(doc => batch.delete(db.collection('usageStats').doc(doc.id)));
                await batch.commit();
            }
            alert("Registros excluídos com sucesso.");
            const deletedIds = new Set(dataToDelete.map(d => d.id));
            setAllData(prev => prev.filter(item => !deletedIds.has(item.id)));
        } catch (err) { console.error("Erro ao excluir:", err); alert("Erro ao excluir registros."); } finally { setLoading(false); }
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

    const handleSaveBroadcast = async () => {
        setIsSavingBroadcast(true);
        try {
            await db.collection('configuracoes').doc('aviso_global').set(broadcastMessage);
            await logAudit(db, user, 'ATUALIZAR_BROADCAST', `Ativo: ${broadcastMessage.ativo}, Msg: ${broadcastMessage.mensagem}`);
            alert("Aviso global atualizado!");
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar aviso.");
        } finally {
            setIsSavingBroadcast(false);
        }
    };

    useEffect(() => {
        if (adminSection === 'audit') {
            const fetchAudit = async () => {
                setLoading(true);
                const snap = await db.collection('audit_logs').orderBy('timestamp', 'desc').limit(50).get();
                setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoading(false);
            };
            fetchAudit();
        }
    }, [adminSection]);

    // ATUALIZAÇÃO: Top 10 filtrado apenas pelo Mês Atual e com lógica de medalhas
    const topUsers = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Filtra apenas dados do mês corrente
        const monthlyData = viewData.filter(item => {
            if (!item.timestamp) return false;
            const d = item.timestamp.toDate();
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        return Object.entries(
            monthlyData.reduce((acc, curr) => {
                const name = curr.userName || curr.userEmail;
                if (name) acc[name] = (acc[name] || 0) + 1;
                return acc;
            }, {})
        ).sort(([, a], [, b]) => b - a).slice(0, 10);
    }, [viewData]);

    // CORREÇÃO: O hook de paginação é chamado incondicionalmente no topo do componente.
    // Ele vai operar sobre `filteredData` ou `selectedUserForStats.data` dependendo do contexto.
    const dataForPagination = selectedUserForStats ? selectedUserForStats.data : filteredData;
    const { paginatedData, PaginationControls } = usePagination(dataForPagination || [], 10);

    const chartDataMateria = { labels: ['Cível', 'Crime'], datasets: [{ data: [stats.perMateria.civel || 0, stats.perMateria.crime || 0], backgroundColor: ['#6366F1', '#F59E0B'] }] };
    const chartDataPrazo = { labels: ['5 Dias', '15 Dias'], datasets: [{ data: [stats.perPrazo[5] || 0, stats.perPrazo[15] || 0], backgroundColor: ['#10B981', '#3B82F6'] }] };
    const chartDataByDay = { labels: Object.keys(stats.byDay || {}).reverse(), datasets: [{ label: 'Cálculos por Dia', data: Object.values(stats.byDay || {}).reverse(), backgroundColor: 'rgba(79, 70, 229, 0.8)' }] };
    const chartOptions = { legend: { display: false }, maintainAspectRatio: false, scales: { xAxes: [{ ticks: { beginAtZero: true } }] } };

    const chartDataSector = {
        labels: Object.keys(stats.perSector || {}),
        datasets: [{
            data: Object.values(stats.perSector || {}),
            backgroundColor: ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']
        }]
    };

    if (loading && adminSection === 'stats') return <div className="text-center p-8"><p>A carregar dados...</p></div>

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
                <UserUsageCharts userData={selectedUserForStats?.data} />
                <div className="overflow-x-auto bg-slate-100/70 dark:bg-slate-900/50 rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-200/50 dark:bg-slate-800/50">
                            <tr><th className="px-6 py-3">Data</th><th className="px-6 py-3">Nº Processo</th><th className="px-6 py-3">Matéria</th><th className="px-6 py-3">Prazo</th></tr>
                        </thead>
                        <tbody>
                            {paginatedData.map(item => (
                                <tr key={item.id} className="border-b border-slate-200/50 dark:border-slate-700/50">
                                    <td className="px-6 py-4">{item.timestamp ? formatarData(item.timestamp.toDate()) : ''}</td>
                                    <td className="px-6 py-4">{item.numeroProcesso}</td>
                                    <td className="px-6 py-4">{item.materia}</td>
                                    <td className="px-6 py-4">{item.prazo} dias</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <PaginationControls />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Painel Administrativo</h2>
                <div className="flex items-center gap-2 mt-4 border-b border-slate-200 dark:border-slate-700 pb-4">
                    <button onClick={() => setAdminSection('stats')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${adminSection === 'stats' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>Estatísticas de Uso</button>
                    <button onClick={() => setAdminSection('users')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${adminSection === 'users' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                        {adminUserData.role === 'setor_admin' ? 'Usuários' : 'Usuários e Setores'}
                    </button>
                    {(adminUserData.role === 'admin' || adminUserData.role === 'setor_admin') && <button onClick={() => setAdminSection('minutas')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${adminSection === 'minutas' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>Gerir Minutas</button>}
                    {adminUserData.role === 'admin' && <button onClick={() => setAdminSection('calendar')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${adminSection === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>Gerir Calendário</button>}
                    {adminUserData.role === 'admin' && <button onClick={() => setAdminSection('chamados')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${adminSection === 'chamados' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>Chamados</button>}
                    {adminUserData.role === 'admin' && <button onClick={() => setAdminSection('audit')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${adminSection === 'audit' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>Auditoria</button>}
                </div>
            </div>

            {adminSection === 'stats' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Coluna Lateral */}
                    <div className="lg:col-span-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 self-start">
                        <h3 className="font-semibold text-lg mb-1 text-slate-800 dark:text-slate-100">Top 10 do Mês</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider font-bold">{statsView === 'calculadora' ? 'Calculadora' : 'Consulta DJEN'}</p>

                        {topUsers.length > 0 ? (
                            <ul className="space-y-2 text-left">
                                {topUsers.map(([name, count], index) => {
                                    // Lógica de Gamificação: Medalhas para o Top 3
                                    let medal = null;
                                    if (index === 0) medal = '🥇';
                                    if (index === 1) medal = '🥈';
                                    if (index === 2) medal = '🥉';

                                    return (
                                        <li key={name} className={`flex items-center justify-between p-2 rounded-md text-sm ${index < 3 ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800' : 'bg-slate-100/70 dark:bg-slate-900/50'}`}>
                                            <span className="font-medium truncate flex items-center gap-2" title={name}>
                                                <span className="w-5 text-center">{medal || `${index + 1}.`}</span>
                                                {name}
                                            </span>
                                            <span className={`font-bold flex-shrink-0 ml-2 ${index < 3 ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>{count}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum dado registrado neste mês.</p>}
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
                        </div>

                        <div className="space-y-6 animate-fade-in">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total de Usos</h3>
                                        <p className="text-3xl font-extrabold text-slate-800 dark:text-white">{stats.total}</p>
                                    </div>
                                    <div className="mt-4 flex items-center text-xs text-slate-400">
                                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                                        {statsView === 'calculadora' ? 'Cálculos Realizados' : 'Consultas DJEN'}
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Usuário Mais Ativo</h3>
                                        <p className="text-xl font-bold text-slate-800 dark:text-white truncate" title={topUsers[0]?.[0]}>{topUsers[0]?.[0] || 'N/A'}</p>
                                    </div>
                                    <div className="mt-4 text-xs text-slate-400">
                                        {topUsers[0]?.[1] || 0} registros
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                            {statsView === 'calculadora' ? 'Matéria Principal' : 'Dia Mais Movimentado'}
                                        </h3>
                                        <p className="text-xl font-bold text-slate-800 dark:text-white capitalize truncate">
                                            {statsView === 'calculadora'
                                                ? (Object.entries(stats.perMateria).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A')
                                                : (Object.entries(stats.byDay).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A')
                                            }
                                        </p>
                                    </div>
                                    <div className="mt-4 text-xs text-slate-400">
                                        Maior volume registrado
                                    </div>
                                </div>
                            </div>

                            {/* Gráfico de Setores */}
                            {adminUserData.role === 'admin' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 h-64">
                                        <h3 className="font-semibold text-center mb-2 text-slate-800 dark:text-slate-100">Utilização por Setor</h3>
                                        <Pie data={chartDataSector} options={{ responsive: true, maintainAspectRatio: false }} />
                                    </div>
                                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                                        <h3 className="font-semibold text-center mb-4 text-slate-800 dark:text-slate-100">Aviso Global (Broadcast)</h3>
                                        <div className="space-y-3">
                                            <textarea value={broadcastMessage.mensagem} onChange={e => setBroadcastMessage({ ...broadcastMessage, mensagem: e.target.value })} placeholder="Mensagem para todos os usuários..." className="w-full p-2 border rounded-md text-sm dark:bg-slate-900 dark:border-slate-600" rows="3"></textarea>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" checked={broadcastMessage.ativo} onChange={e => setBroadcastMessage({ ...broadcastMessage, ativo: e.target.checked })} id="broadcast-active" />
                                                <label htmlFor="broadcast-active" className="text-sm">Ativar Aviso</label>
                                            </div>
                                            <button onClick={handleSaveBroadcast} disabled={isSavingBroadcast} className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-bold hover:bg-blue-700 disabled:opacity-50">Salvar Aviso</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <span className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/50 px-3 py-1.5 rounded-lg">Total de Usos: <strong className="font-bold text-lg text-slate-700 dark:text-slate-200">{viewData.length}</strong></span>
                        </div>

                        <div className="p-4 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                                <div><label className="text-xs font-medium text-slate-500">Data Inicial</label><input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700" /></div>
                                <div><label className="text-xs font-medium text-slate-500">Data Final</label><input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700" /></div>
                                {statsView === 'calculadora' && <>
                                    <div><label className="text-xs font-medium text-slate-500">Matéria</label><select name="materia" value={filters.materia} onChange={handleFilterChange} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"><option value="todos">Todas</option><option value="civel">Cível</option><option value="crime">Crime</option></select></div>
                                    <div><label className="text-xs font-medium text-slate-500">Prazo</label><select name="prazo" value={filters.prazo} onChange={handleFilterChange} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"><option value="todos">Todos</option><option value="5">5 Dias</option><option value="15">15 Dias</option></select></div>
                                </>}
                                {adminUserData.role === 'admin' && (
                                    <div>
                                        <label className="text-xs font-medium text-slate-500">Setor</label>
                                        <select name="setorId" value={filters.setorId} onChange={handleFilterChange} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700">
                                            <option value="todos">Todos</option>
                                            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="lg:col-span-full"><label className="text-xs font-medium text-slate-500">Utilizador</label><select name="email" value={filters.email} onChange={handleFilterChange} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"><option value="todos">Todos</option>{usersForFilterDropdown.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                            </div>
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                                <label className="text-xs font-medium text-slate-500">Pesquisar por ID do Utilizador</label>
                                <div className="flex gap-4 items-center">
                                    <input type="text" name="userId" placeholder="Cole o ID do utilizador aqui..." value={filters.userId} onChange={handleFilterChange} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700" />
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
                                <button onClick={handleBulkExport} disabled={filteredData.length === 0} className="px-4 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" clipRule="evenodd" /></svg>
                                    Extração Completa (ZIP)
                                </button>
                                <button onClick={handleDeleteClick} disabled={filteredData.length === 0 && allData.length === 0} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    Excluir Registros
                                </button>
                            </div>
                        </div>

                        {!hasSearched ? (
                            <div className="text-center p-8 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg"><p className="text-slate-500 dark:text-slate-400">Os gráficos acima mostram o uso geral. Use os filtros para ver detalhes.</p></div>
                        ) : filteredData.length === 0 ? (
                            <div className="text-center p-8 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg">
                                {loading ? <p className="text-slate-500 dark:text-slate-400">Buscando dados...</p> : <p className="text-slate-500 dark:text-slate-400">Nenhum resultado encontrado para os filtros selecionados.</p>}
                            </div>
                        ) : (
                            <>
                                <div className="space-y-6">
                                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 h-64">
                                        <h3 className="font-semibold text-center mb-2 text-slate-800 dark:text-slate-100">Utilização nos Últimos 7 Dias</h3>
                                        <Bar data={chartDataByDay} options={{ responsive: true, maintainAspectRatio: false }} />
                                    </div>
                                    <div>
                                        {/* Table */}
                                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Registros Detalhados</h3>
                                                <button onClick={handleExport} disabled={filteredData.length === 0} className="text-xs font-bold text-green-600 hover:text-green-700 flex items-center gap-1 disabled:opacity-50">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                    Exportar Excel
                                                </button>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                                                        <tr>
                                                            <th className="px-6 py-3 font-bold">Utilizador</th>
                                                            <th className="px-6 py-3 font-bold">Tipo</th>
                                                            <th className="px-6 py-3 font-bold">Processo</th>
                                                            <th className="px-6 py-3 font-bold">Detalhes</th>
                                                            <th className="px-6 py-3 font-bold text-right">Data</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                        {paginatedData.map(item => (
                                                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                                <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">
                                                                    <a href="#" onClick={(e) => { e.preventDefault(); handleUserClick(item.userEmail) }} className="text-blue-600 hover:underline">{item.userName || item.userEmail}</a>
                                                                </td>
                                                                <td className="px-6 py-4 text-slate-500 capitalize">{(item.type || 'calculadora').split('_')[0]}</td>
                                                                <td className="px-6 py-4 text-slate-500">{item.numeroProcesso}</td>
                                                                <td className="px-6 py-4 text-slate-500">
                                                                    {item.materia ? (
                                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.materia === 'civel' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                                                            {item.materia}, {item.prazo}d
                                                                        </span>
                                                                    ) : '-'}
                                                                </td>
                                                                <td className="px-6 py-4 text-right text-slate-500 font-mono text-xs">{item.timestamp ? formatarData(item.timestamp.toDate()) : ''}</td>
                                                            </tr>
                                                        ))}
                                                        {paginatedData.length === 0 && (
                                                            <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">Nenhum registro encontrado.</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {filteredData.length > 0 && <PaginationControls />}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {adminSection === 'calendar' && (
                <CalendarioAdminPage />
            )}
            {adminSection === 'chamados' && (
                <BugReportsPage />
            )}
            {adminSection === 'audit' && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Logs de Auditoria (Últimos 50)</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                                <tr><th className="px-6 py-3">Data</th><th className="px-6 py-3">Ação</th><th className="px-6 py-3">Usuário</th><th className="px-6 py-3">Detalhes</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {auditLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="px-6 py-4 whitespace-nowrap">{log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString() : ''}</td>
                                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">{log.action}</td>
                                        <td className="px-6 py-4">{log.performedByEmail}</td>
                                        <td className="px-6 py-4 text-slate-500 truncate max-w-xs" title={log.details}>{log.details}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {adminSection === 'minutas' && (
                <MinutasAdminPage />
            )}
            {adminSection === 'users' && (
                <div className="flex flex-col lg:flex-row gap-6 animate-fade-in">
                    {/* Coluna Esquerda: Gerenciamento de Setores (Apenas Admin Global) */}
                    {adminUserData.role === 'admin' && (
                        <div className="lg:w-1/3 space-y-6">
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Gerenciar Setores</h3>
                                <form onSubmit={handleAddSector} className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Novo Setor</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Nome do setor..."
                                                value={newSectorName}
                                                onChange={e => setNewSectorName(e.target.value)}
                                                className="flex-grow px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                                            />
                                            <button type="submit" className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Setores Existentes</h3>
                                </div>
                                <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                                    {setores.map(setor => {
                                        const membersCount = allUsersForManagement.filter(u => u.setorId === setor.id).length;
                                        return (
                                            <div key={setor.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                                <div>
                                                    <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{setor.nome}</p>
                                                    <p className="text-xs text-slate-500">{membersCount} membros</p>
                                                </div>
                                                <button onClick={() => handleDeleteSector(setor.id)} className="text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100" title="Excluir Setor">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Coluna Direita: Gerenciamento de Usuários */}
                    <div className={`${adminUserData.role === 'admin' ? 'lg:w-2/3' : 'w-full'} space-y-6`}>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Usuários</h2>
                                <div className="relative w-full sm:w-64">
                                    <input
                                        type="text"
                                        placeholder="Buscar usuário..."
                                        value={userSearchTerm}
                                        onChange={e => setUserSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                                    />
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                                </div>
                            </div>

                            {userManagementLoading ? (
                                <div className="flex justify-center p-8"><p className="text-slate-500">Carregando usuários...</p></div>
                            ) : (
                                <div className="space-y-4">
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
                                        if (sectorIdA === 'sem-setor') return -1;
                                        if (sectorIdB === 'sem-setor') return 1;
                                        const setorA = setores.find(s => s.id === sectorIdA)?.nome || '';
                                        const setorB = setores.find(s => s.id === sectorIdB)?.nome || '';
                                        return setorA.localeCompare(setorB);
                                    }).map(([sectorId, users]) => {
                                        const sector = setores.find(s => s.id === sectorId);
                                        const sectorName = sector ? sector.nome : "Sem Setor Definido";
                                        const isExpanded = expandedUserSectors.has(sectorId) || userSearchTerm.length > 0;

                                        return (
                                            <div key={sectorId} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                                <div
                                                    className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                    onClick={() => toggleUserSectorExpansion(sectorId)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                        <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{sectorName}</h4>
                                                    </div>
                                                    <span className="text-xs font-medium bg-white dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500">{users.length}</span>
                                                </div>

                                                {isExpanded && (
                                                    <div className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                                        {users.map(u => (
                                                            <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${u.emailVerified ? 'bg-green-500' : 'bg-amber-500'}`}>
                                                                        {u.displayName ? u.displayName.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{u.displayName || 'Sem Nome'}</p>
                                                                        <p className="text-xs text-slate-500">{u.email}</p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3 self-end sm:self-auto">
                                                                    <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md ${u.role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                                        u.role === 'setor_admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                                                            u.role === 'intermediate' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                                                                'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                                                        }`}>
                                                                        {u.role === 'admin' ? 'Global Admin' : u.role === 'setor_admin' ? 'Chefe' : u.role === 'intermediate' ? 'Intermediário' : 'Básico'}
                                                                    </span>

                                                                    <div className="flex items-center border-l border-slate-200 dark:border-slate-700 pl-3 gap-1">
                                                                        <button onClick={() => handleOpenUserManagementModal(u)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Editar Permissões">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                                                        </button>
                                                                        <button onClick={() => handleDeleteUser(u)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50 dark:hover:bg-red-900/20" title="Excluir Usuário">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
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
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-700">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Excluir Registros por Período</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Selecione o intervalo de datas dos registros que deseja excluir permanentemente.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Data Inicial</label>
                                <input type="date" value={deleteRange.start} onChange={e => setDeleteRange({ ...deleteRange, start: e.target.value })} className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Data Final</label>
                                <input type="date" value={deleteRange.end} onChange={e => setDeleteRange({ ...deleteRange, end: e.target.value })} className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200" />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Cancelar</button>
                            <button onClick={handleConfirmDelete} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Excluir</button>
                        </div>
                    </div>
                </div>
            )}
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
            if (reportButton) reportButton.style.display = 'none';

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

            if (reportButton) reportButton.style.display = 'flex'; // Mostra o botão novamente

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
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
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
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{formatarData(new Date(notif.createdAt.toDate()))}</p>
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

    const handleDeleteAccount = async () => {
        const confirmMsg = "ATENÇÃO: Tem certeza que deseja excluir sua conta?\n\nEsta ação é irreversível. Todos os seus dados pessoais e histórico de acesso serão removidos permanentemente do sistema.\n\nDigite 'EXCLUIR' para confirmar:";
        const userInput = window.prompt(confirmMsg);

        if (userInput === 'EXCLUIR') {
            try {
                // Deleta o documento do usuário no Firestore
                await db.collection('users').doc(user.uid).delete();
                // Deleta o usuário da autenticação
                await user.delete();
                // O AuthProvider vai detectar o logout/delete e redirecionar
            } catch (err) {
                console.error("Erro ao excluir conta:", err);
                alert("Erro ao excluir conta. Pode ser necessário fazer login novamente antes de realizar esta ação (medida de segurança do Firebase).");
            }
        }
    };

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
                            <Avatar user={user} userData={{ ...userData, displayName, avatarColor }} size="h-24 w-24" />
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

                    <div className="pt-2">
                        <button onClick={handleDeleteAccount} className="w-full flex justify-center items-center text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-semibold py-2 px-4 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-300">
                            Excluir Minha Conta
                        </button>
                    </div>

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

const Sidebar = ({ isOpen, setIsOpen, isCollapsed, toggleCollapse }) => {
    const { user, userData, openCalendario, currentArea, setCurrentArea, isAdmin, isSetorAdmin } = useAuth();
    const { openBugReport } = useContext(BugReportContext);
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const menuItems = [
        { id: 'Calculadora', label: 'Calculadora', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> },
        { id: 'Admin', label: 'Administração', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, condition: !!(isAdmin || isSetorAdmin) },
    ];

    return (
        <>
            {/* Overlay Mobile */}
            {isOpen && <div className="fixed inset-0 bg-black/50 z-[55] lg:hidden" onClick={() => setIsOpen(false)}></div>}

            {/* Sidebar Container */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-[60] ${isCollapsed ? 'w-20' : 'w-64'} bg-tjpr-navy-900 dark:bg-tjpr-navy-900 text-white transform transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 flex flex-col shadow-xl`}>
                {/* Top Section - Apenas título sem logo */}
                <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-6'} border-b border-tjpr-navy-800 bg-tjpr-navy-900`}>
                    {!isCollapsed && <span className="text-sm font-semibold tracking-wide text-tjpr-navy-500">NAVEGAÇÃO</span>}
                    <button onClick={toggleCollapse} className="hidden lg:block text-tjpr-navy-500 hover:text-white transition-colors">
                        {isCollapsed ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        )}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto overflow-x-hidden">
                    {menuItems.map(item => (
                        (item.condition !== false) && (
                            <button
                                key={item.id}
                                onClick={() => { setCurrentArea(item.id); setIsOpen(false); }}
                                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 text-sm font-medium rounded-lg transition-colors ${currentArea === item.id ? 'bg-tjpr-navy-700 text-white' : 'text-tjpr-navy-500 hover:bg-tjpr-navy-800 hover:text-white'}`}
                                title={isCollapsed ? item.label : ''}
                            >
                                <span className={`${isCollapsed ? '' : 'mr-3'}`}>{item.icon}</span>
                                {!isCollapsed && item.label}
                            </button>
                        )
                    ))}

                    <div className={`pt-6 mt-6 border-t border-tjpr-navy-800 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                        {!isCollapsed && <p className="px-3 text-xs font-semibold text-tjpr-navy-600 uppercase tracking-wider mb-2">Ferramentas</p>}
                        <button onClick={() => { openCalendario(); setIsOpen(false); }} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 text-sm font-medium text-tjpr-navy-500 rounded-lg hover:bg-tjpr-navy-800 hover:text-white transition-colors`} title={isCollapsed ? 'Calendário' : ''}>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {!isCollapsed && 'Calendário'}
                        </button>
                        <button onClick={() => { openBugReport(); setIsOpen(false); }} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 text-sm font-medium text-tjpr-navy-500 rounded-lg hover:bg-tjpr-navy-800 hover:text-white transition-colors`} title={isCollapsed ? 'Reportar Problema' : ''}>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            {!isCollapsed && 'Reportar Problema'}
                        </button>
                        {deferredPrompt && (
                            <button onClick={handleInstallClick} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 text-sm font-medium text-tjpr-gold rounded-lg hover:bg-tjpr-navy-800 hover:text-tjpr-gold transition-colors mt-2`} title={isCollapsed ? 'Instalar App' : ''}>
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                {!isCollapsed && 'Instalar App'}
                            </button>
                        )}
                    </div>
                </nav>

                {/* Bottom Section - Sem perfil (movido para Header) */}
                <div className={`p-4 border-t border-tjpr-navy-800 bg-tjpr-navy-900 ${isCollapsed ? 'flex justify-center' : ''}`}>
                    <div className="text-center">
                        {!isCollapsed && (
                            <p className="text-xs text-tjpr-navy-600">
                                © {new Date().getFullYear()} TJPR
                            </p>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
};

const TopBar = ({ onMenuClick, title }) => {
    return (
        <header className="h-16 bg-white dark:bg-slate-800 shadow-sm flex items-center justify-between px-4 lg:px-8 relative z-20">
            <div className="flex items-center">
                <button onClick={onMenuClick} className="lg:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{title}</h2>
            </div>
        </header>
    );
};

const CalculatorApp = () => {
    // Inicializa lendo da URL se existir (?processo=...)
    const [numeroProcesso, setNumeroProcesso] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('processo') || '';
    });
    const { currentArea } = useAuth(); // Usaremos o contexto para gerenciar a área atual

    // Permite receber o número via postMessage (para uso em Iframe)
    useEffect(() => {
        const handleMessage = (event) => {
            // Verifica se a mensagem tem o formato esperado
            if (event.data && event.data.type === 'SET_PROCESSO') {
                setNumeroProcesso(event.data.numero);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

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

const UserIDWatermark = ({ overlay = false, isSidebarCollapsed = false }) => {
    const { user, userData } = useAuth();
    if (!user) return null;
    if (overlay) {
        return <div className="watermark-overlay">{user.uid}</div>
    }
    return (
        <div className={`fixed bottom-4 text-xs text-slate-400 dark:text-slate-600 z-40 pointer-events-none text-left transition-all duration-300 left-4 ${isSidebarCollapsed ? 'lg:left-[6rem]' : 'lg:left-[17rem]'}`}>
            <p>Logado como:</p>
            <p>{userData?.displayName || user.email}</p>
            ID do Utilizador: {user.uid}
        </div>
    );
};

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

const GlobalAlert = () => {
    const [msg, setMsg] = useState(null);
    useEffect(() => {
        if (!db) return;
        const unsubscribe = db.collection('configuracoes').doc('aviso_global').onSnapshot(doc => {
            if (doc.exists && doc.data().ativo) {
                setMsg(doc.data());
            } else {
                setMsg(null);
            }
        });
        return () => unsubscribe();
    }, []);
    if (!msg) return null;
    return <div className="bg-indigo-600 text-white text-center py-2 px-4 font-bold text-sm shadow-md animate-fade-in relative z-30">{msg.mensagem}</div>;
};

// --- Componente Principal ---
const App = () => {
    const { user, userData, isAdmin, loading, refreshUser, currentArea, setCurrentArea } = useAuth();
    const [showCalendario, setShowCalendario] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showChangelog, setShowChangelog] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

    useEffect(() => {
        // Adiciona o estilo de animação ao head do documento uma única vez.
        const openCalendarioHandler = () => setShowCalendario(true);
        const openProfileHandler = () => setShowProfile(true);
        const openSettingsHandler = () => setShowSettings(true);
        const openPrivacyHandler = () => setShowPrivacyPolicy(true);
        document.addEventListener('openCalendario', openCalendarioHandler);
        document.addEventListener('openProfile', openProfileHandler);
        document.addEventListener('openSettings', openSettingsHandler);
        document.addEventListener('openPrivacyPolicy', openPrivacyHandler);
        return () => {
            document.removeEventListener('openCalendario', openCalendarioHandler);
            document.removeEventListener('openProfile', openProfileHandler);
            document.removeEventListener('openSettings', openSettingsHandler);
            document.removeEventListener('openPrivacyPolicy', openPrivacyHandler);
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
        return <TJPRLoginPage />;
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
        <div id="app-wrapper" className="h-screen flex bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} isCollapsed={isSidebarCollapsed} toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />

            <div className="flex-1 flex flex-col overflow-hidden relative">
                <GlobalAlert />
                <TJPRHeader
                    user={userData}
                    onLogout={() => firebase.auth().signOut()}
                    onToggleDarkMode={() => {
                        const html = document.documentElement;
                        html.classList.toggle('dark');
                        localStorage.setItem('darkMode', html.classList.contains('dark'));
                    }}
                    isDarkMode={document.documentElement.classList.contains('dark')}
                    onOpenProfile={() => setShowProfile(true)}
                />

                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        {currentArea === 'Calculadora' ? (
                            <CalculatorApp />
                        ) : currentArea === 'Admin' && (isAdmin || userData?.role === 'setor_admin') ? (
                            <AdminPage setCurrentArea={setCurrentArea} />
                        ) : (
                            <p>Área desconhecida.</p>
                        )}
                        <footer className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-4">
                            <CreditsWatermark />
                        </footer>
                    </div>
                </main>
            </div>

            {showCalendario && <CalendarioModal onClose={() => setShowCalendario(false)} />}
            {showProfile && <ProfileModal user={user} userData={userData} onClose={() => setShowProfile(false)} onUpdate={refreshUser} />}
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
            {showPrivacyPolicy && <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} />}
            <CookieConsent />
            <UserIDWatermark isSidebarCollapsed={isSidebarCollapsed} />
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <AuthProvider>
        <SettingsProvider>
            <BugReportProvider>
                <App />
            </BugReportProvider>
        </SettingsProvider>
    </AuthProvider>
);
