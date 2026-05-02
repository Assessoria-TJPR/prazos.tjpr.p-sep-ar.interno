const { useState, useEffect, useCallback, createContext, useContext, useRef, useMemo } = React;
const { Bar, HorizontalBar, Pie } = window.ReactChartjs2;
const { 
    TJPRCard, TJPRButton, TJPRInput, TJPRHeader, TJPRBadge, 
    TJPRModal, NotificationsPanel, CookieConsent, TJPRFormGroup,
    MinutasAdminPage, CalendarAdminPage, BugReportsPage,
    TJPRLoginPage, MinutaPreparoPage
} = window;
const usePagination = (data, itemsPerPage) => {
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return data.slice(start, start + itemsPerPage);
    }, [data, currentPage, itemsPerPage]);

    const paginationControls = totalPages > 1 ? (
        <div className="flex justify-between items-center mt-4 text-sm p-4">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-3 py-1 rounded-md tjpr-bg-alt disabled:opacity-50">Anterior</button>
            <span>Página {currentPage} de {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-3 py-1 rounded-md tjpr-bg-alt disabled:opacity-50">Próxima</button>
        </div>
    ) : null;

    return { paginatedData, paginationControls, currentPage };
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
            const itemDate = new Date(item.timestamp);
            const type = item.type || 'calculadora';
            if (itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear) stats.current[type]++;
            if (itemDate.getMonth() === lastMonth && itemDate.getFullYear() === lastMonthYear) stats.last[type]++;
        });
        return stats;
    }, [userData]);

    const chartData = { 
        labels: ['Mês Anterior', 'Mês Atual'], 
        datasets: [
            { 
                label: 'Calculadora', 
                data: [monthlyUsage.last.calculadora, monthlyUsage.current.calculadora], 
                backgroundColor: '#4f46e5' // var(--tjpr-primary)
            }, 
            { 
                label: 'Consulta DJEN', 
                data: [monthlyUsage.last.djen_consulta, monthlyUsage.current.djen_consulta], 
                backgroundColor: '#f59e0b' // var(--tjpr-warning)
            }
        ] 
    };
    const chartOptions = { responsive: true, maintainAspectRatio: false, scales: { yAxes: [{ ticks: { beginAtZero: true, stepSize: 1 } }] } };

    return (
        <div className="p-4 tjpr-bg-alt/50 rounded-lg shadow-sm h-64 border tjpr-border-main">
            <h3 className="font-semibold text-center mb-2 tjpr-text-dim">Uso Mensal (Mês Atual vs. Anterior)</h3>
            <Bar data={chartData} options={chartOptions} />
        </div>
    );
};

// Premium UI Components
const SkeletonLoader = () => (
    <div className="animate-pulse space-y-4 w-full">
        <div className="h-10 bg-tjpr-alt/50 rounded-lg w-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-32 bg-tjpr-alt/50 rounded-2xl"></div>
            <div className="h-32 bg-tjpr-alt/50 rounded-2xl"></div>
            <div className="h-32 bg-tjpr-alt/50 rounded-2xl"></div>
        </div>
        <div className="h-64 bg-tjpr-alt/50 rounded-2xl"></div>
    </div>
);

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
        if (window._supabaseClient) {
            setSettings(s => ({ ...s, calendarLoading: true }));
            try {
                const { data, error } = await window._supabaseClient
                    .from('configuracoes')
                    .select('data')
                    .eq('id', 'calendario')
                    .maybeSingle();

                if (error) throw error;
                if (!data) {
                    console.warn("Documento 'calendario' não encontrado.");
                    updateSettings({ feriadosMap: {}, decretosMap: {}, instabilidadeMap: {}, calendarLoading: false });
                    return;
                }

                const calendarConfig = data.data;
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
    }, [user]); // CORREÇÃO: Usar apenas 'user' como dependência

    const updateSettings = (newSettings) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        localStorage.setItem('appSettings', JSON.stringify(updated));
    };

    useEffect(() => {
        if (window._supabaseClient && user) {
            fetchCalendarData();
        }
    }, [user, fetchCalendarData]);

    useEffect(() => {
        const root = window.document.documentElement;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        const applyTheme = () => {
            const isDark = settings.theme === 'dark' || 
                          (settings.theme === 'system' && mediaQuery.matches);
            root.classList.toggle('dark', isDark);
        };

        applyTheme();

        if (settings.theme === 'system') {
            const listener = () => applyTheme();
            mediaQuery.addEventListener('change', listener);
            return () => mediaQuery.removeEventListener('change', listener);
        }
    }, [settings.theme]);

    const value = { settings, updateSettings, refreshCalendar: fetchCalendarData };
    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentArea, setCurrentArea] = useState('Calculadora');

    useEffect(() => {
        if (userData) {
            const hasCalculadora = userData.role === 'admin' || userData.role === 'setor_admin' || userData.role === 'intermediate';
            if (!hasCalculadora && currentArea === 'Calculadora') {
                setCurrentArea('Minuta');
            }
        }
    }, [userData]);

    const updateUserAndAdminStatus = async (supabaseUser) => {
        if (supabaseUser) {
            setUser(supabaseUser);
            try {
                const { data: userData, error } = await window._supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', supabaseUser.id)
                    .maybeSingle();

                if (error) {
                    console.warn("Perfil não encontrado ou erro:", error);
                    // Não desloga automaticamente se for erro temporário
                    setUserData(null);
                } else {
                    // Mapeamento de compatibilidade: mantém snake_case do banco mas expõe camelCase para o frontend legado
                    setUserData({
                        ...userData,
                        setorId: userData.setor_id,
                        displayName: userData.display_name,
                        emailVerified: userData.email_verified,
                        avatarColor: userData.avatar_color,
                        photoURL: userData.photo_url || null
                    });
                }
            } catch (error) {
                console.error("Erro ao buscar dados do usuário:", error);
                setUserData(null);
            }
        } else {
            setUser(null);
            setUserData(null);
        }
        setLoading(false);
    };

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await window._supabaseClient.auth.getSession();
            updateUserAndAdminStatus(session?.user || null);
        };
        checkUser();

        const { data: { subscription } } = window._supabaseClient.auth.onAuthStateChange((_event, session) => {
            updateUserAndAdminStatus(session?.user || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && user) {
                // Força a atualização dos dados do usuário quando a aba se torna visível
                updateUserAndAdminStatus(user);
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
        if (window._supabaseClient) {
            const { data: { user: freshUser }, error } = await window._supabaseClient.auth.getUser();
            if (error) {
                console.error("Erro ao atualizar usuário:", error);
                return;
            }
            if (freshUser) {
                await updateUserAndAdminStatus(freshUser);
            }
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
    const { user, userData } = useAuth();
    const [alerta, setAlerta] = useState('');

    const logDjenUsage = () => {
        if (window._supabaseClient && user) {
            window._supabaseClient.from('usage_stats').insert({
                user_id: user.id,
                user_name: userData?.display_name || user.email,
                setor_id: userData?.setor_id,
                setor_nome: userData?.setor_nome,
                type: 'djen_consulta',
                numero_processo: numeroProcesso || 'Não informado',
                timestamp: new Date().toISOString()
            }).then(({ error }) => {
                if (error) console.error("Erro ao registrar uso da consulta DJEN:", error);
            });
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
        <div className="tjpr-card p-8 sm:p-10 mb-8 relative overflow-hidden group">
            <div className="flex items-start gap-4 mb-8 border-b border-slate-200 dark:border-white/5 pb-8 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center border border-indigo-600/20 shadow-inner">
                    <span className="material-icons text-indigo-500">search</span>
                </div>
                <div className="text-left">
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">Consulta de Processo</h2>
                    <p className="text-slate-500 font-medium text-sm">Localize a intimação no Diário de Justiça Eletrônico Nacional.</p>
                </div>
            </div>

            {alerta && (
                <div className="p-4 mb-6 text-sm text-amber-400 rounded-2xl bg-amber-400/5 border border-amber-400/10 flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                    <span className="material-icons text-lg">warning</span>
                    <span className="font-medium">{alerta}</span>
                </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-grow w-full">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons text-slate-600">numbers</span>
                    <input 
                        type="text" 
                        value={numeroProcesso} 
                        onChange={(e) => { setNumeroProcesso(e.target.value); setAlerta(''); }} 
                        placeholder="Número do Processo (Ex: 0001234-56.2024.8.16.0000)" 
                        className="tjpr-input pl-12"
                    />
                </div>
                <TJPRButton 
                    onClick={handleConsulta} 
                    disabled={!numeroProcesso} 
                    icon="search"
                    iconPosition="right"
                    className="w-full sm:w-auto min-w-[180px] h-[52px] shadow-lg shadow-indigo-600/20"
                >
                    CONSULTAR NO DJEN
                </TJPRButton>
            </div>
            
            <div className="mt-6 flex items-center gap-2 px-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Dica: Utilize a "Data de Disponibilização" para a calculadora abaixo.</p>
            </div>
        </div>
    );
};

const CalculadoraDePrazo = ({ numeroProcesso }) => {
    const { settings, updateSettings } = useContext(SettingsContext);
    const { setReportData } = useContext(BugReportContext); // Consumir contexto de report
    const [prazoSelecionado, setPrazoSelecionado] = useState(settings.defaultPrazo || 15);
    const [dataDisponibilizacao, setDataDisponibilizacao] = useState('');
    const [tipoPrazo, setTipoPrazo] = useState(settings.defaultMateria || 'civel');
    const [showManualPrazoInput, setShowManualPrazoInput] = useState(false);
    const [ignorarRecesso, setIgnorarRecesso] = useState(false);
    const [resultado, setResultado] = useState(null);

    const [diasComprovados, setDiasComprovados] = useState(new Set());
    const diasComprovadosRef = useRef(new Set());
    const [dataInterposicao, setDataInterposicao] = useState('');
    const [tempestividade, setTempestividade] = useState(null);
    const [error, setError] = useState('');
    const [customMinutaTypes, setCustomMinutaTypes] = useState([]);
    const [isArModalOpen, setIsArModalOpen] = useState(false);
    const [arCodeValue, setArCodeValue] = useState('');
    const [arModalAction, setArModalAction] = useState(null); // 'civel' ou 'crime'
    const { user, userData } = useAuth();
    const { feriadosMap, decretosMap, instabilidadeMap, recessoForense, calendarLoading } = settings;

    // Atualiza os dados para o reporte de bugs
    useEffect(() => {
        if (setReportData) {
            setReportData({
                dataDisponibilizacao,
                isCrime: ['crime', 'juizado_crim'].includes(tipoPrazo),
                prazo: prazoSelecionado
            });
        }
    }, [dataDisponibilizacao, tipoPrazo, prazoSelecionado, setReportData]);

    // Efeito para gerenciar a visibilidade do input manual de prazo
    useEffect(() => {
        // Se o tipo de prazo mudar para 'civel', esconde o input manual
        // e reseta o prazo selecionado para o padrão, caso um valor manual estivesse em uso.
        if (tipoPrazo === 'civel') {
            setShowManualPrazoInput(false);
            if (![5, 15].includes(prazoSelecionado)) {
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

            const resultadoCrime = calcularPrazoCrime(
                dataPublicacaoComDecreto,
                inicioDoPrazoComDecreto,
                prazoNumerico,
                diasNaoUteisDoInicioComDecreto,
                inicioDisponibilizacao,
                helpers,
                diasComprovados,
                ignorarRecesso
            );
            setResultado(resultadoCrime);
            // Não chama logUsage() para evitar gerar registros duplicados
        } catch (e) {
            console.error("Erro ao recalcular com ignorarRecesso:", e);
        }
    }, [ignorarRecesso]);

    const getMotivoDiaNaoUtil = (date, considerarDecretos, tipo = 'todos', comprovados = new Set(), ignorarRecesso = false) => {
        if (!date || isNaN(date.getTime())) return null;

        const dateString = date.toISOString().split('T')[0];
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();

        // Flag interna para saber se o decreto EXISTE, independente de ser considerado para dilação
        let motivoEncontrado = null;

        if (dateString === '2025-12-18' && (tipo === 'todos' || tipo === 'decreto')) {
            motivoEncontrado = { motivo: 'Dia da Justiça (Feriado Regimental - Transf. p/ Decreto 808/2024)', tipo: 'decreto' };
        }

        if (!motivoEncontrado && (tipo === 'todos' || tipo === 'feriado')) {
            if (feriadosMap && feriadosMap[dateString]) motivoEncontrado = typeof feriadosMap[dateString] === 'object' ? feriadosMap[dateString] : { motivo: feriadosMap[dateString], tipo: 'feriado' };
        }

        if (!motivoEncontrado && (tipo === 'todos' || tipo === 'decreto')) {
            if (decretosMap && decretosMap[dateString]) {
                motivoEncontrado = typeof decretosMap[dateString] === 'object' ? decretosMap[dateString] : { motivo: decretosMap[dateString], tipo: 'decreto' };
            }
        }

        if (!motivoEncontrado && (tipo === 'todos' || tipo === 'instabilidade')) {
            if (instabilidadeMap && instabilidadeMap[dateString]) motivoEncontrado = typeof instabilidadeMap[dateString] === 'object' ? instabilidadeMap[dateString] : { motivo: instabilidadeMap[dateString], tipo: 'instabilidade' };
        }

        // PATCH: Recesso Forense e Suspensão de Prazos (Art. 220 do Código de Processo Civil)
        const caiNoRecesso = (month === 12 && day >= 20) || (month === 1 && day <= 20);

        if (caiNoRecesso && !ignorarRecesso) {
            if (motivoEncontrado) {
                // Se já encontrou um motivo (Natal, Decreto etc), mantém o motivo mas força a flag ehRecesso
                // Isso garante que a contagem 'Crime' (dias corridos) suspenda nesses dias.
                // Criamos uma nova referência para evitar mutar o objeto original dos Mapas.
                motivoEncontrado = { ...motivoEncontrado, ehRecesso: true };
            } else if (tipo === 'todos' || tipo === 'recesso' || tipo === 'feriado') {
                return { motivo: 'Recesso Forense / Suspensão de Prazos (Art. 220 do Código de Processo Civil)', tipo: 'recesso', ehRecesso: true, ehProrrogavel: true };
            }
        }

        // Se encontrou algo, decide se retorna baseado em considerarDecretos e se é feriado/recesso
        if (motivoEncontrado) {
            const ehFeriadoOuRecesso = motivoEncontrado.tipo === 'feriado' || motivoEncontrado.tipo === 'recesso' || motivoEncontrado.ehRecesso;
            
            // Feriados e Recessos sempre retornam. 
            // Decretos só retornam se considerarDecretos for true.
            if (ehFeriadoOuRecesso || considerarDecretos) {
                // Se for recesso dentro do período que deve ser ignorado no crime, mas é um decreto específico,
                // ele DEVE retornar se considerarDecretos for true para permitir comprovação.
                return motivoEncontrado;
            }
            // Se NÃO considerar o decreto, retorna null
            if (motivoEncontrado.tipo === 'decreto' || motivoEncontrado.tipo === 'instabilidade') return null;
        }

        return null;
    };

    const getProximoDiaUtil = (data) => {
        const proximoDia = new Date(data.getTime());
        do {
            proximoDia.setDate(proximoDia.getDate() + 1);
        } while (proximoDia.getDay() === 0 || proximoDia.getDay() === 6 || getMotivoDiaNaoUtil(proximoDia, true, 'todos', new Set(), ignorarRecesso));
        return proximoDia;
    };

    const getProximoDiaUtilParaPublicacao = (data, considerarDecretos = true, comprovados = new Set(), ignorarRecessoLocal = false) => {
        const suspensoesEncontradas = [];
        const proximoDia = new Date(data.getTime());
        // A publicação deve ser o primeiro dia útil após a disponibilização,
        // prorrogando caso caia em fim de semana, feriado, recesso ou decreto.
        let motivo;
        do {
            proximoDia.setDate(proximoDia.getDate() + 1);
            motivo = getMotivoDiaNaoUtil(proximoDia, considerarDecretos, 'todos', comprovados, ignorarRecessoLocal);
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
    const getProximoDiaUtilComprovado = (data, comprovados, ignorarRecesso = false) => {
        const suspensoesEncontradas = [];
        const proximoDia = new Date(data.getTime()); // Começa a partir da data fornecida
        let motivo;
        do {
            proximoDia.setDate(proximoDia.getDate() + 1); // Avança para o próximo dia
            const dataStr = proximoDia.toISOString().split('T')[0];
            motivo = getMotivoDiaNaoUtil(proximoDia, true, 'todos', comprovados, ignorarRecesso);

            const eFimDeSemana = proximoDia.getDay() === 0 || proximoDia.getDay() === 6;
            const eRecessoNaoIgnorado = motivo && motivo.tipo === 'recesso' && !ignorarRecesso;
            const eSuspensaoRelevante = motivo && (motivo.tipo === 'feriado' || eRecessoNaoIgnorado || comprovados.has(dataStr));

            if (eSuspensaoRelevante && !eFimDeSemana) {
                suspensoesEncontradas.push({ data: new Date(proximoDia.getTime()), ...motivo });
            }
        } while (proximoDia.getDay() === 0 || proximoDia.getDay() === 6 || (motivo && (motivo.tipo === 'feriado' || (motivo.tipo === 'recesso' && !ignorarRecesso) || comprovados.has(proximoDia.toISOString().split('T')[0]))));
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
        const isCrime = tipoPrazo === 'crime' || tipoPrazo === 'juizado_crim';
        
        const filtroComprovavel = (suspData, tipo) => {
            if (isCrime && !ignorarRecesso) return false; // Crime sem ignorar recesso não comprova NENHUM decreto
            return tipo === 'decreto' || tipo === 'instabilidade' || tipo === 'feriado_cnj' || tipo === 'suspensao_outubro';
        };

        const dataStr = dataFinal.toISOString().split('T')[0];

        // Se a data já foi comprovada, não adicionar novamente
        if (comprovados.has(dataStr)) return null;

        // Verificar se a data tem uma suspensão comprovável
        const suspensao = getMotivoDiaNaoUtil(dataFinal, true, 'todos');
        if (suspensao && filtroComprovavel(dataFinal, suspensao.tipo)) {
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
                if (infoDiaNaoUtil) {
                    // SEMPRE coleta feriados e recessos (automáticos) ou decretos/instabilidades se comprovados
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
                (considerarDecretosNaProrrogacao && comprovados.has(prazoFinalAjustado.toISOString().split('T')[0]) && getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'instabilidade')) // CORREÇÃO: Instabilidades devem prorrogar o cível também.
            ) ||
            prazoFinalAjustado.getDay() === 0 || prazoFinalAjustado.getDay() === 6
        ) {
            if (infoDiaFinalNaoUtil) diasProrrogados.push({ data: new Date(prazoFinalAjustado.getTime()), ...infoDiaFinalNaoUtil });
            prazoFinalAjustado.setDate(prazoFinalAjustado.getDate() + 1);
        }
        return { prazoFinal: prazoFinalAjustado, diasNaoUteis: diasNaoUteisEncontrados, diasProrrogados };
    };

    const calcularPrazoFinalDiasCorridos = (inicioDoPrazo, prazo, comprovados = new Set(), ignorarRecesso = false, considerarDecretosNaProrrogacao = true) => {
        const VERSION = "V4_FIX_CRIME_RULE_UPDATE";
        const diasNaoUteisEncontrados = [];
        const diasPotenciaisComprovaveis = [];
        const diasNaoUteisDoInicio = [];
        let diasDeSuspensaoComprovadaNoPeriodo = 0;

        // Função auxiliar para verificar se um dia é considerado "não útil" para o Crime nos limites (Início/Fim)
        const isDiaNaoUtilBoundary = (d) => {
            const dataStr = d.toISOString().split('T')[0];
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const motivo = getMotivoDiaNaoUtil(d, true, 'todos', comprovados, ignorarRecesso);
            
            if (isWeekend) return { ehNaoUtil: true, motivo: { motivo: 'Fim de Semana', tipo: 'fim_de_semana' } };
            
            if (motivo) {
                if (motivo.tipo === 'feriado') return { ehNaoUtil: true, motivo };
                if (motivo.ehRecesso && !ignorarRecesso) {
                    return { ehNaoUtil: true, motivo };
                }
                // Se for decreto/instabilidade, SÓ conta se estiver nos comprovados
                if (comprovados.has(dataStr)) return { ehNaoUtil: true, motivo };
            }
            return { ehNaoUtil: false };
        };

        const getInfoDia = (d) => {
            const motivo = getMotivoDiaNaoUtil(d, false, 'todos', comprovados, ignorarRecesso);
            let ehNaoUtilParaContagem = false;
            
            if (motivo && motivo.ehRecesso) {
                ehNaoUtilParaContagem = !ignorarRecesso;
            }
            // NOTA: Decrees in the middle are now IGNORED for Crime counting, as requested.
            return { ehNaoUtilParaContagem, motivo };
        };

        // 1. Ajusta o início do prazo para o próximo dia útil.
        let inicioAjustado = new Date(inicioDoPrazo.getTime());
        while (true) {
            const res = isDiaNaoUtilBoundary(inicioAjustado);
            if (!res.ehNaoUtil) break;
            if (res.motivo && res.motivo.tipo !== 'fim_de_semana') {
                diasNaoUteisDoInicio.push({ data: new Date(inicioAjustado.getTime()), ...res.motivo });
            }
            inicioAjustado.setDate(inicioAjustado.getDate() + 1);
        }

        // 2. Calcula a data final iterando dia a dia.
        let diasCorridosContados = 1;
        let dataCorrente = new Date(inicioAjustado.getTime());
        while (diasCorridosContados < prazo) {
            dataCorrente.setDate(dataCorrente.getDate() + 1);
            const info = getInfoDia(dataCorrente);
            if (info.ehNaoUtilParaContagem) {
                if (info.motivo) diasNaoUteisEncontrados.push({ data: new Date(dataCorrente.getTime()), ...info.motivo });
                diasDeSuspensaoComprovadaNoPeriodo++;
            } else {
                diasCorridosContados++;
            }
        }

        // 3. Prorroga o prazo final se ele cair em um dia não útil.
        let prazoFinalAjustado = new Date(dataCorrente.getTime());
        const diasProrrogados = [];
        while (true) {
            const res = isDiaNaoUtilBoundary(prazoFinalAjustado);
            if (!res.ehNaoUtil) break;
            
            if (res.motivo) diasProrrogados.push({ data: new Date(prazoFinalAjustado.getTime()), ...res.motivo });
            prazoFinalAjustado.setDate(prazoFinalAjustado.getDate() + 1);
        }

        return { 
            prazoFinal: dataCorrente, 
            prazoFinalProrrogado: prazoFinalAjustado, 
            diasNaoUteis: [...diasNaoUteisEncontrados, ...diasProrrogados], 
            diasProrrogados, 
            diasPotenciaisComprovaveis: diasNaoUteisDoInicio, 
            diasNaoUteisDoInicio 
        };
    };

    const resultRef = React.useRef(null);

    const logUsage = () => {
        if (window._supabaseClient && user) {
            window._supabaseClient.from('usage_stats').insert({
                user_id: user.id,
                user_name: userData?.display_name || user.email,
                setor_id: userData?.setor_id,
                setor_nome: userData?.setor_nome,
                type: 'calculadora',
                details: { 
                    materia: tipoPrazo, 
                    prazo: prazoSelecionado, 
                    numero_processo: numeroProcesso || 'Não informado'
                },
                timestamp: new Date().toISOString()
            }).then(({ error }) => {
                if (error) console.error("Erro ao registrar uso:", error);
            });
        }
    }

    // Scroll suave para o resultado quando ele aparecer
    React.useEffect(() => {
        if (resultado && resultRef.current) {
            setTimeout(() => {
                resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [resultado]);

    const handleCalcular = () => {
        console.log("--- Início do Cálculo ---");
        setError('');
        setResultado(null);
        setDataInterposicao('');
        setTempestividade(null);
        setDiasComprovados(new Set()); // Reseta os dias comprovados
        diasComprovadosRef.current = new Set(); // Sincroniza a ref também
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

            // FIX: Define variables for trace logic
            const dataDispEfetiva = inicioDisponibilizacao;
            const suspensoesDispEfetiva = [];

            // 1. PASSO: Publicação (Primeiro dia útil após disponibilização)
            // Regra Crime (User Update): "A publicação pode cair em dia de decreto, não precisa pular".
            // Para 'crime', passamos 'false' para ignorar decretos na determinação da data de publicação.
            // [ATUALIZAÇÃO]: Isso serve para o Cenário 1 (Sem Decreto). O Cenário 2 será tratado dentro das regras.
            const considerarDecretosPub = (tipoPrazo === 'crime' || tipoPrazo === 'juizado_crim') ? false : true;

            const { proximoDia: dataPublicacaoComDecreto, suspensoesEncontradas: suspensoesPublicacaoComDecreto } = getProximoDiaUtilParaPublicacao(inicioDisponibilizacao, considerarDecretosPub, diasComprovados, ignorarRecesso);

            // 2. PASSO: Início do Prazo (D+1 Útil)
            // Regra Crime (User Update): "O início do prazo é no dia 24". (Pub 21 -> Start 24).
            // Isso é um Salto Duplo simples. Pub -> Start.
            // Para o início, também ignoramos decretos automaticamente (o usuário deve marcar se quiser pular).
            const { proximoDia: inicioDoPrazoComDecreto, suspensoesEncontradas: suspensoesInicioComDecreto } = getProximoDiaUtilParaPublicacao(dataPublicacaoComDecreto, false, diasComprovados, ignorarRecesso);

            const diasNaoUteisDoInicioComDecreto = [
                ...suspensoesPublicacaoComDecreto,
                ...suspensoesInicioComDecreto
            ];

            // Agrupa as funções auxiliares para passá-las para as funções de regras
            const helpers = {
                getProximoDiaUtilParaPublicacao,
                getProximoDiaUtilComprovado,
                calcularPrazoFinalDiasUteis,
                calcularPrazoFinalDiasCorridos,
                getMotivoDiaNaoUtil,
                decretosMap
            };

            let res;
            if (tipoPrazo === 'civel') {
                res = calcularPrazoCivel(dataPublicacaoComDecreto, inicioDoPrazoComDecreto, prazoNumerico, diasNaoUteisDoInicioComDecreto, inicioDisponibilizacao, helpers, diasComprovados);
            } else if (tipoPrazo === 'crime' || tipoPrazo === 'juizado_crim') {
                res = calcularPrazoCrime(
                    dataPublicacaoComDecreto,
                    inicioDoPrazoComDecreto,
                    prazoNumerico,
                    diasNaoUteisDoInicioComDecreto,
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
                description: 'Primeiro dia útil após a disponibilização'
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
            res.ignorarRecesso = ignorarRecesso;

            setResultado(res);

            logUsage();
        } catch (e) {
            console.error(e);
            setError(e.message);
        }
    };

    const handleComprovacaoChange = (dataString, dataDisponibilizacaoAtual) => {
        console.log("handleComprovacaoChange chamado para:", dataString);
        
        // 1. Obtém e atualiza o estado atual (síncrono através da Ref) para evitar bugs de clicks rápidos (stale closures)
        let novosComprovados = new Set(diasComprovadosRef.current);
        
        // REGRA CNJ: Agrupa a comprovação de Corpus Christi.
        if (dataString === DATA_CORPUS_CHRISTI) {
            novosComprovados = agruparComprovacaoCorpusChristi(novosComprovados);
        } else {
            // Comportamento padrão para outros decretos
            novosComprovados.has(dataString) ? novosComprovados.delete(dataString) : novosComprovados.add(dataString);
        }
        
        diasComprovadosRef.current = novosComprovados; // Mantém a ref sincronizada urgentemente
        setDiasComprovados(novosComprovados); // Dispara re-render da UI (checkboxes)

        console.log("Dias comprovados (após toggle):", Array.from(novosComprovados));

        // 2. Dispara o recálculo passando o estado fresco
        setResultado(prev => {
            if (!prev || !dataDisponibilizacaoAtual) return prev; 

            const { prazo, tipo } = prev;

            const inicioDisponibilizacao = new Date(dataDisponibilizacaoAtual + 'T00:00:00');
            const dataIgnorarRecesso = ignorarRecesso;
            
            // CORREÇÃO: Passar dataIgnorarRecesso para os helpers para respeitar a regra de réu preso no recálculo
            const { proximoDia: novaDataPublicacao } = getProximoDiaUtilComprovado(inicioDisponibilizacao, novosComprovados, dataIgnorarRecesso);
            const { proximoDia: novoInicioDoPrazo } = getProximoDiaUtilComprovado(novaDataPublicacao, novosComprovados, dataIgnorarRecesso);
            let novoResultadoComDecreto;

            if (tipo === 'civel') {
                novoResultadoComDecreto = calcularPrazoFinalDiasUteis(novoInicioDoPrazo, prazo, novosComprovados, true, true, true);

                const novasSuspensoesComprovaveis = [...prev.suspensoesComprovaveis];
                let novaSuspensaoEncontrada = null;

                const suspensaoInicio = getProximaSuspensaoComprovavel(novoInicioDoPrazo, novosComprovados);
                if (suspensaoInicio) novaSuspensaoEncontrada = suspensaoInicio;

                if (!novaSuspensaoEncontrada) {
                    const suspensaoFinal = getProximaSuspensaoComprovavel(novoResultadoComDecreto.prazoFinal, novosComprovados);
                    if (suspensaoFinal) novaSuspensaoEncontrada = suspensaoFinal;
                }

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
                    dataPublicacao: novaDataPublicacao,
                    inicioPrazo: novoInicioDoPrazo,
                    comDecreto: novoResultadoComDecreto,
                    suspensoesComprovaveis: novasSuspensoesComprovaveis.sort((a, b) => a.data - b.data),
                    ignorarRecesso: dataIgnorarRecesso
                };
            } else {
                const helpers = {
                    getProximoDiaUtilParaPublicacao,
                    getProximoDiaUtilComprovado,
                    calcularPrazoFinalDiasUteis,
                    calcularPrazoFinalDiasCorridos,
                    getMotivoDiaNaoUtil,
                    decretosMap
                };
                const resultadoCrimeRecalculado = calcularPrazoCrime(
                    novaDataPublicacao,
                    novoInicioDoPrazo,
                    prazo,
                    [],
                    inicioDisponibilizacao,
                    helpers,
                    novosComprovados,
                    dataIgnorarRecesso
                );
                return {
                    ...prev,
                    ...resultadoCrimeRecalculado,
                    ignorarRecesso: dataIgnorarRecesso
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
        if (window._supabaseClient) {
            const fetchTypes = async () => {
                const { data } = await window._supabaseClient
                    .from('configuracoes')
                    .select('data')
                    .eq('id', 'minutas')
                    .maybeSingle();
                if (data && data.data && data.data.tipos) {
                    setCustomMinutaTypes(data.data.tipos.filter(t => t.id !== 'exemplo_didatico'));
                }
            };
            fetchTypes();

            const channel = window._supabaseClient
                .channel('minuta_types_changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes', filter: 'id=eq.minutas' }, (payload) => {
                    if (payload.new && payload.new.data && payload.new.data.tipos) {
                        setCustomMinutaTypes(payload.new.data.tipos.filter(t => t.id !== 'exemplo_didatico'));
                    }
                })
                .subscribe();
            
            return () => window._supabaseClient.removeChannel(channel);
        }
    }, []);

    // --- Funções de Geração de Minutas (conforme o código fornecido) ---

    // Template para o documento Word
    const getDocTemplate = (bodyHtml, pStyle, pCenterStyle, fontFamily, fontSize) => `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Minuta Despacho</title></head>
      <body>
          <div style="font-family: ${fontFamily || 'Arial'}, sans-serif; font-size: ${fontSize || '16pt'}; line-height: 1.5;">
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
    const generateDocFromHtml = (bodyHtml, minutaType, placeholders, outputFileName, arUsuario = null, fontStyles = {}) => {
        try {
            const fontFamily = fontStyles.font_family || 'Arial';
            const fontSize = fontStyles.font_size || '16pt';

            const pStyle = `text-align: justify; text-indent: 50px; margin-bottom: 1em; font-family: ${fontFamily}, sans-serif; font-size: ${fontSize};`;
            const pCenterStyle = `text-align: center; margin: 0; font-family: ${fontFamily}, sans-serif; font-size: ${fontSize};`;

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
                <p style="font-family: ${fontFamily}, sans-serif; font-size: 10pt; text-align: left; margin: 0;">${arUsuario.trim()}</p>
            ` : ''}
        `;

            const sourceHTML = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>Minuta Despacho</title>
            <style>
                p { font-family: ${fontFamily}, sans-serif; font-size: ${fontSize}; line-height: 1.5; }
            </style>
            </head>
            <body>
                <div style="font-family: ${fontFamily}, sans-serif; font-size: ${fontSize};">
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

    // Função para buscar a minuta do Supabase ou usar o padrão
    const getMinutaContent = async (minutaType) => {
        if (userData?.setorId) {
            const docId = `${userData.setorId}_${minutaType}`;
            try {
                const { data, error } = await window._supabaseClient
                    .from('minutas')
                    .select('*')
                    .eq('id', docId)
                    .maybeSingle();

                if (error) throw error;
                if (data) {
                    return {
                        conteudo: data.conteudo,
                        font_family: data.font_family,
                        font_size: data.font_size
                    };
                }
            } catch (err) {
                console.error(`Erro ao buscar minuta personalizada '${docId}'. Usando padrão.`, err);
            }
        }
        return {
            conteudo: MINUTAS_PADRAO[minutaType],
            font_family: 'Arial',
            font_size: '16pt'
        };
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
        setArCodeValue('');
        setArModalAction('civel');
        setIsArModalOpen(true);
    };

    const handleConfirmArCivel = async () => {
        const arUsuario = arCodeValue;
        if (!arUsuario || arUsuario.trim() === "") return;

        setIsArModalOpen(false);
        const template = await getMinutaContent('intimacao_decreto');
        const corpoMinuta = template.conteudo;

        generateDocFromHtml(
            corpoMinuta,
            'intimacao_decreto',
            {},
            `Minuta_Intimacao_Decreto_${numeroProcesso.replace(/\D/g, '') || 'processo'}.doc`,
            arUsuario,
            { font_family: template.font_family, font_size: template.font_size }
        );
    };

    const gerarMinutaIntimacaoDecretoCrime = async () => {
        setArCodeValue('');
        setArModalAction('crime');
        setIsArModalOpen(true);
    };

    const handleConfirmArCrime = async () => {
        const arUsuario = arCodeValue;
        if (!arUsuario || arUsuario.trim() === "") return;

        setIsArModalOpen(false);
        const template = await getMinutaContent('intimacao_decreto_crime');

        generateDocFromHtml(
            template.conteudo,
            'intimacao_decreto_crime',
            {},
            `Minuta_Intimacao_Decreto_Crime_${numeroProcesso.replace(/\D/g, '') || 'processo'}.doc`,
            arUsuario,
            { font_family: template.font_family, font_size: template.font_size }
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

    const handlePasteDate = (setter) => (e) => {
        const text = e.clipboardData.getData('Text');
        if (!text) return;
        const cleanedText = text.trim();

        // Tenta DD/MM/AAAA ou DD-MM-AAAA ou D/M/AA
        const ddMMyyyyMatch = cleanedText.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (ddMMyyyyMatch) {
            let day = ddMMyyyyMatch[1].padStart(2, '0');
            let month = ddMMyyyyMatch[2].padStart(2, '0');
            let year = ddMMyyyyMatch[3];
            
            if (year.length === 2) {
                year = '20' + year;
            }
            if (year.length === 4) {
               e.preventDefault();
               const formattedDate = `${year}-${month}-${day}`;
               const testDate = new Date(`${formattedDate}T00:00:00`);
               if (!isNaN(testDate.getTime())) {
                   setter(formattedDate);
               }
               return;
            }
        }

        // Tenta AAAA-MM-DD ou AAAA/MM/DD
        const yyyyMMddMatch = cleanedText.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (yyyyMMddMatch) {
            e.preventDefault();
            let year = yyyyMMddMatch[1];
            let month = yyyyMMddMatch[2].padStart(2, '0');
            let day = yyyyMMddMatch[3].padStart(2, '0');
            
            const formattedDate = `${year}-${month}-${day}`;
            const testDate = new Date(`${formattedDate}T00:00:00`);
            if (!isNaN(testDate.getTime())) {
                setter(formattedDate);
            }
        }
    };

    return (
        <div className="tjpr-card p-8 sm:p-10 mb-8 relative overflow-hidden group">
            <div className="flex items-start gap-4 mb-8 border-b tjpr-border-main pb-8 relative z-10">
                <div className="w-12 h-12 rounded-2xl tjpr-bg-alt flex items-center justify-center border tjpr-border-main shadow-inner">
                    <span className="material-icons tjpr-text-primary text-3xl">calculate</span>
                </div>
                <div className="text-left">
                    <h2 className="text-2xl font-black tjpr-text-main mb-1 tracking-tight">Calculadora de Prazos</h2>
                    <p className="tjpr-text-dim font-medium text-sm">Contagem automática de prazos processuais.</p>
                </div>
            </div>

            <div className="space-y-8 relative z-10">
                <TJPRFormGroup cols={1}>
                    {/* Configurações de Matéria */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] ml-1">Matéria Processual</label>
                        <div className="flex flex-wrap gap-3">
                            <button 
                                onClick={() => setTipoPrazo('civel')} 
                                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 border ${tipoPrazo === 'civel' ? 'tjpr-bg-primary tjpr-border-primary text-white tjpr-shadow-primary' : 'tjpr-bg-alt tjpr-border-main tjpr-text-dim hover:tjpr-text-main'}`}
                            >
                                Matéria Cível
                            </button>
                            <button 
                                onClick={() => setTipoPrazo('crime')} 
                                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 border ${tipoPrazo === 'crime' ? 'tjpr-bg-primary tjpr-border-primary text-white tjpr-shadow-primary' : 'tjpr-bg-alt tjpr-border-main tjpr-text-dim hover:tjpr-text-main'}`}
                            >
                                Matéria Criminal
                            </button>
                        </div>
                    </div>

                    {/* Tempo do Prazo */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] ml-1">Tempo do Prazo (Dias)</label>
                        <div className="flex flex-wrap gap-3">
                            {(tipoPrazo === 'civel' ? [5, 15] : [5, 15, 30]).map(p => (
                                <button 
                                    key={p}
                                    onClick={() => { setPrazoSelecionado(p); setShowManualPrazoInput(false); }} 
                                    className={`w-16 h-12 rounded-xl text-xs font-black transition-all duration-300 border ${prazoSelecionado == p && !showManualPrazoInput ? 'tjpr-bg-primary tjpr-border-primary text-white tjpr-shadow-primary' : 'tjpr-bg-alt tjpr-border-main tjpr-text-dim hover:tjpr-text-main'}`}
                                >
                                    {p} DIAS
                                </button>
                            ))}
                            {tipoPrazo === 'crime' && (
                                <button 
                                    onClick={() => setShowManualPrazoInput(!showManualPrazoInput)}
                                    className={`flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${showManualPrazoInput ? 'tjpr-bg-primary tjpr-border-primary text-white tjpr-shadow-primary' : 'tjpr-bg-alt tjpr-border-main tjpr-text-dim hover:tjpr-text-main'}`}
                                >
                                    {showManualPrazoInput ? 'Fechar' : 'Personalizado'}
                                </button>
                            )}
                        </div>

                        {showManualPrazoInput && (
                            <div className="animate-in zoom-in-95 duration-300 pt-2">
                                <TJPRInput 
                                    type="number"
                                    placeholder="Digite o número de dias..."
                                    value={prazoSelecionado}
                                    onChange={(e) => setPrazoSelecionado(e.target.value)}
                                    icon="edit"
                                    className="h-[52px]"
                                />
                            </div>
                        )}
                    </div>

                    {/* Data de Disponibilização */}
                    <div className="space-y-3">
                        <TJPRInput 
                            label="Data de Disponibilização (DJEN/DJS)"
                            type="date"
                            value={dataDisponibilizacao}
                            onChange={(e) => setDataDisponibilizacao(e.target.value)}
                            icon="calendar_today"
                            className="h-[52px]"
                        />
                    </div>

                    <div className="pt-6">
                        <TJPRButton 
                            onClick={handleCalcular} 
                            icon="shutter_speed"
                            className="w-full h-[64px] rounded-2xl shadow-xl shadow-indigo-600/30"
                        >
                            CALCULAR PRAZO FINAL
                        </TJPRButton>
                        
                        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest text-center mt-6">
                            Sincronizado com calendário oficial 2025/2026
                        </p>
                    </div>
                </TJPRFormGroup>
            </div>


            {error && (
                <div className="mt-8 flex items-start gap-4 text-rose-400 bg-rose-400/5 border border-rose-400/10 p-6 rounded-2xl animate-in zoom-in duration-300">
                    <span className="material-icons text-2xl">error_outline</span>
                    <div className="flex flex-col gap-1">
                        <span className="font-black uppercase tracking-widest text-xs">Erro de Validação</span>
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                </div>
            )}

            {resultado && (
                <div ref={resultRef} className="mt-12 border-t tjpr-border-main pt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 scroll-mt-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        <div className="tjpr-bg-alt border tjpr-border-main p-8 rounded-[2rem] backdrop-blur-xl relative overflow-hidden group shadow-2xl">
                            <div className="absolute top-0 left-0 w-2 h-full bg-slate-700"></div>
                            <span className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] block mb-3">Publicação (D1)</span>
                            <p className="text-3xl font-black tjpr-text-main group-hover:tjpr-text-primary transition-colors">{formatarData(resultado.dataPublicacao)}</p>
                        </div>
                        <div className="tjpr-bg-alt border tjpr-border-main p-8 rounded-[2rem] backdrop-blur-xl relative overflow-hidden group shadow-2xl">
                            <div className="absolute top-0 left-0 w-2 h-full tjpr-bg-primary"></div>
                            <span className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] block mb-3">Início do Prazo</span>
                            <p className="text-3xl font-black tjpr-text-main group-hover:tjpr-text-primary transition-colors">{formatarData(resultado.inicioPrazo)}</p>
                        </div>
                        <div className="tjpr-bg-primary-glow border tjpr-border-primary p-8 rounded-[2rem] backdrop-blur-xl relative overflow-hidden group shadow-[0_20px_50px_-10px_rgba(79,70,229,0.3)]">
                            <div className="absolute top-0 right-0 w-32 h-32 tjpr-bg-primary-glow blur-3xl rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000"></div>
                            <span className="text-[10px] font-black tjpr-text-primary uppercase tracking-[0.2em] block mb-3">Total de Dias</span>
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-black tjpr-text-main">{resultado.prazo}</p>
                                <span className="text-[10px] font-black tjpr-text-primary opacity-80 uppercase tracking-widest">{resultado.tipo === 'crime' ? 'Dias Corridos' : 'Dias Úteis'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Cenário 1: Base */}
                        <div className="tjpr-bg-alt border tjpr-border-main rounded-3xl p-8 relative group">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black tjpr-text-dim uppercase tracking-[0.2em]">Cenário Padrão</h3>
                                <div className="px-3 py-1 rounded-full tjpr-bg-main border tjpr-border-main text-[10px] font-black tjpr-text-dim uppercase tracking-widest">Sem Decretos</div>
                            </div>
                            
                            <div className="text-center py-6">
                                <p className="text-[10px] font-black tjpr-text-dim uppercase tracking-widest mb-2">Data Vencimento</p>
                                <p className="text-5xl font-black tjpr-text-main tracking-tighter drop-shadow-2xl">
                                    {formatarData(resultado.semDecreto.prazoFinalProrrogado || resultado.semDecreto.prazoFinal)}
                                </p>
                            </div>

                            {resultado.semDecreto.diasNaoUteis.length > 0 && (
                                <div className="mt-8 space-y-3">
                                    <p className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] border-b tjpr-border-main pb-2">Suspensões Automáticas</p>
                                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-2 overscroll-contain">
                                        <GroupedDiasNaoUteis dias={resultado.semDecreto.diasNaoUteis} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Cenário 2: Comprovado */}
                        <div className={`rounded-3xl p-8 relative overflow-hidden transition-all duration-700 border ${resultado.suspensoesComprovaveis.length > 0 ? 'tjpr-bg-primary-glow border-indigo-500/30 shadow-2xl shadow-indigo-500/10' : 'tjpr-bg-alt tjpr-border-main opacity-50 grayscale hover:grayscale-0 transition-all cursor-not-allowed'}`}>
                            <div className="absolute top-0 right-0 p-4">
                                <span className="material-icons tjpr-text-primary animate-pulse">verified</span>
                            </div>

                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black tjpr-text-primary uppercase tracking-[0.2em]">Cenário Comprovado</h3>
                                <div className="px-3 py-1 rounded-full tjpr-bg-primary-glow border tjpr-border-primary text-[10px] font-black tjpr-text-primary uppercase tracking-widest">Com Decretos</div>
                            </div>

                            <div className="text-center py-6">
                                <p className="text-[10px] font-black tjpr-text-primary opacity-60 uppercase tracking-widest mb-2">Data Vencimento (Recalculada)</p>
                                <p className="text-5xl font-black tjpr-text-main tracking-tighter drop-shadow-2xl">
                                    {formatarData(resultado.comDecreto.prazoFinalProrrogado || resultado.comDecreto.prazoFinal)}
                                </p>
                            </div>

                            {resultado.suspensoesComprovaveis.length > 0 ? (
                                <div className="mt-8 space-y-4">
                                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Selecione para Comprovar</p>
                                        <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2 overscroll-contain">
                                            {/* Feriado CNJ Especial */}
                                            {resultado.suspensoesComprovaveis.some(d => d.tipo === 'feriado_cnj') && (
                                                <label className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all ${diasComprovados.has(DATA_CORPUS_CHRISTI) ? 'bg-indigo-600 border border-indigo-500 shadow-lg' : 'bg-slate-900/50 border border-white/5 hover:bg-white/5'}`}>
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${diasComprovados.has(DATA_CORPUS_CHRISTI) ? 'bg-indigo-400 border-indigo-400' : 'border-slate-700'}`}>
                                                        {diasComprovados.has(DATA_CORPUS_CHRISTI) && <span className="material-icons text-white text-xs font-black">check</span>}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={diasComprovados.has(DATA_CORPUS_CHRISTI)}
                                                        onChange={() => handleComprovacaoChange(DATA_CORPUS_CHRISTI, dataDisponibilizacao)}
                                                        className="hidden"
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className={`text-[11px] font-bold ${diasComprovados.has(DATA_CORPUS_CHRISTI) ? 'text-white' : 'text-slate-300'}`}>Corpus Christi e Suspensão</span>
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${diasComprovados.has(DATA_CORPUS_CHRISTI) ? 'text-indigo-200' : 'text-slate-500'}`}>Feriado CNJ</span>
                                                    </div>
                                                </label>
                                            )}

                                            {/* Outras Suspensões */}
                                            {resultado.suspensoesComprovaveis.filter(d => d.tipo !== 'feriado_cnj').map(dia => {
                                                const dataStr = dia.data.toISOString().split('T')[0];
                                                const isSelected = diasComprovados.has(dataStr);
                                                return (
                                                    <label key={dataStr} className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-indigo-600 border border-indigo-500 shadow-lg' : 'bg-slate-900/50 border border-white/5 hover:bg-white/5'}`}>
                                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-400 border-indigo-400' : 'border-slate-700'}`}>
                                                            {isSelected && <span className="material-icons text-white text-xs font-black">check</span>}
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isSelected} 
                                                            onChange={() => handleComprovacaoChange(dataStr, dataDisponibilizacao)} 
                                                            className="hidden"
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{formatarData(dia.data)}: {dia.motivo}</span>
                                                            <span className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>{dia.tipo}</span>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <span className="material-icons text-slate-700 text-4xl mb-4">task_alt</span>
                                    <p className="text-slate-600 font-bold text-xs uppercase tracking-widest">Nenhuma suspensão comprovável no período</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Verificação de Tempestividade (Intermediate/Admin) */}
                    {(userData?.role === 'intermediate' || userData?.role === 'admin') && (
                        <div className="mt-12 bg-white/5 border border-white/5 rounded-3xl p-8 backdrop-blur-xl relative z-10 overflow-hidden">
                            <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] rounded-full -mr-32 -mb-32 pointer-events-none"></div>
                            
                            <div className="flex items-center gap-4 mb-8">
                                <span className="material-icons text-indigo-400">gavel</span>
                                <h3 className="text-lg font-black text-white uppercase tracking-[0.2em]">Exame de Tempestividade</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Data de Interposição</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons text-indigo-400">event_available</span>
                                        <input 
                                            type="date" 
                                            value={dataInterposicao} 
                                            onChange={e => setDataInterposicao(e.target.value)} 
                                            onPaste={handlePasteDate(setDataInterposicao)} 
                                            className="tjpr-input pl-12 h-[60px] font-bold" 
                                        />
                                    </div>
                                </div>

                                {tempestividade && (
                                    <div className={`h-[60px] flex items-center px-6 rounded-2xl border animate-in slide-in-from-right-4 duration-500 ${tempestividade === 'tempestivo' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10' : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-lg shadow-rose-500/10'}`}>
                                        <span className="material-icons mr-3">{tempestividade === 'tempestivo' ? 'check_circle' : 'cancel'}</span>
                                        <span className="font-black uppercase tracking-widest">{tempestividade === 'tempestivo' ? 'Recurso Tempestivo' : 'Recurso Intempestivo'}</span>
                                    </div>
                                )}
                            </div>

                            {/* Ações de Minuta */}
                            <div className="mt-8 flex flex-wrap gap-4">
                                {tempestividade === 'puramente_intempestivo' && (
                                    <button onClick={gerarMinutaIntempestividade} className="px-6 py-3 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-rose-700 transition-all animate-pulse shadow-lg shadow-rose-600/20">
                                        <span className="material-icons text-sm">description</span>
                                        Baixar Minuta Intempestividade
                                    </button>
                                )}
                                
                                {tempestividade === 'intempestivo_falta_decreto' && (
                                    <div className="flex gap-4 w-full sm:w-auto">
                                        <button onClick={gerarMinutaIntimacaoDecreto} className="flex-1 sm:flex-none px-6 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20">
                                            <span className="material-icons text-sm">notifications_active</span>
                                            Intimar para Comprovar
                                        </button>
                                        <button onClick={gerarMinutaFaltaDecreto} className="flex-1 sm:flex-none px-6 py-3 bg-slate-800 text-white border border-white/10 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-slate-700 transition-all">
                                            <span className="material-icons text-sm">history_edu</span>
                                            Minuta Falta Decreto
                                        </button>
                                    </div>
                                )}

                                {customMinutaTypes.length > 0 && (
                                    <div className="flex flex-wrap gap-3 w-full border-t border-white/5 pt-8 mt-4">
                                        {customMinutaTypes.map(tipo => (
                                            <button key={tipo.id} onClick={() => gerarMinutaGenerica(tipo)} className="px-5 py-2.5 bg-white/5 text-slate-300 border border-white/10 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all">
                                                <span className="material-icons text-sm text-indigo-400">article</span>
                                                {tipo.nome}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal AR Elite */}
            <TJPRModal 
                isOpen={isArModalOpen} 
                onClose={() => setIsArModalOpen(false)}
                title="Identificação de AR"
                icon="qr_code_2"
                maxWidth="md"
            >
                <div className="space-y-8 py-4">
                    <div className="p-8 bg-slate-950/40 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 blur-3xl rounded-full transition-all group-hover:scale-150"></div>
                        <div className="relative z-10">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block">Código AR do Usuário</label>
                            <TJPRInput 
                                placeholder="Ex: AR1234..."
                                value={arCodeValue}
                                onChange={(e) => setArCodeValue(e.target.value)}
                                autoFocus
                            />
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-4 flex items-center gap-2">
                                <span className="material-icons text-sm">info</span>
                                Identificação necessária para o rodapé da minuta.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <TJPRButton 
                            variant="ghost" 
                            onClick={() => setIsArModalOpen(false)}
                            className="flex-1 h-[52px]"
                        >
                            CANCELAR
                        </TJPRButton>
                        <TJPRButton 
                            variant="primary" 
                            onClick={arModalAction === 'civel' ? handleConfirmArCivel : handleConfirmArCrime}
                            className="flex-1 h-[52px] shadow-lg shadow-indigo-600/20"
                            disabled={!arCodeValue || arCodeValue.trim() === ""}
                        >
                            GERAR MINUTA
                        </TJPRButton>
                    </div>
                </div>
            </TJPRModal>
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
            labelClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            break;
        case 'feriado_cnj':
            labelText = 'Feriado CNJ';
            labelClasses = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            break;
        case 'instabilidade':
            labelText = 'Instabilidade';
            labelClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            break;
        case 'feriado':
            labelText = 'Feriado Nacional';
            labelClasses = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
            break;
        case 'recesso':
            labelText = 'Recesso';
            labelClasses = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
            break;
        case 'recesso_grouped':
            labelText = 'Recesso';
            labelClasses = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
            break;
    }

    const Tag = as;

    if (Tag === 'tr') {
        return (
            <tr className="border-b last:border-b-0 border-white/5 bg-transparent hover:bg-white/5 transition-all duration-300">
                <td className="px-5 py-4 font-bold text-white whitespace-nowrap text-xs uppercase tracking-widest">{formatarData(dia.data)}</td>
                <td className="px-5 py-4 text-slate-400 font-medium text-sm">{dia.motivo}</td>
                <td className="px-5 py-4">
                    <div className="flex justify-end">
                        {labelText && <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border uppercase tracking-widest ${labelClasses}`}>{labelText}</span>}
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <Tag className="flex items-center justify-between p-4 tjpr-bg-alt border tjpr-border-main rounded-2xl tjpr-text-dim group hover:tjpr-bg-hover transition-all duration-300 shadow-sm">
            <div className="flex-grow">
                {dia.tipo === 'recesso_grouped'
                    ? <span className="text-sm font-black tjpr-text-main tracking-tight">{dia.motivo}</span>
                    : <span className="text-xs font-medium flex items-center flex-wrap gap-y-1">
                        <strong className="font-black tjpr-text-main mr-3 py-1 px-2.5 tjpr-bg-main rounded-lg border tjpr-border-main">{formatarData(dia.data)}</strong> 
                        <span className="tjpr-text-dim mr-3 hidden sm:inline">—</span> 
                        <span className="tjpr-text-main font-bold">{dia.motivo}</span>
                        {dia.link && <a href={dia.link} target="_blank" rel="noopener noreferrer" className="ml-4 text-indigo-500 hover:text-indigo-400 text-[10px] font-black uppercase tracking-widest border-b border-indigo-400/30 hover:border-indigo-300 transition-all">Decreto</a>}
                    </span>}
            </div>
            {labelText && <span className={`ml-4 flex-shrink-0 text-[9px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${labelClasses}`}>{labelText}</span>}
        </Tag>
    );
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
            const { error: resendError } = await window._supabaseClient.auth.resend({
                type: 'signup',
                email: user.email,
                options: {
                    emailRedirectTo: window.location.origin
                }
            });
            
            if (resendError) throw resendError;
            
            setMessage('Um novo e-mail de verificação foi enviado.');
            setCooldown(30); // Inicia um cooldown de 30 segundos
        } catch (err) {
            console.error('Erro ao reenviar e-mail:', err);
            setError('Erro ao reenviar o e-mail: ' + (err.message || 'Tente novamente.'));
        } finally {
            setIsResending(false);
        }
    };

    const handleCheckVerification = async () => {
        setMessage('Verificando status...');
        await refreshUser();
        // O App component vai redirecionar automaticamente se o email estiver verificado
        // pois o estado 'user' será atualizado e isVerified será true.
        setTimeout(() => {
            setMessage('');
        }, 2000);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 blur-[120px] rounded-full"></div>
            
            <div className="w-full max-w-md p-10 space-y-8 bg-slate-900/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl text-center relative z-10">
                <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <span className="material-icons text-indigo-400 text-4xl">mark_email_unread</span>
                </div>
                
                <div className="space-y-2">
                    <h2 className="text-3xl font-black text-white tracking-tight">Verifique seu E-mail</h2>
                    <p className="text-sm font-medium text-slate-400">
                        Enviamos um link de ativação para <strong className="text-indigo-400">{user?.email}</strong>
                    </p>
                </div>

                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed p-4 bg-white/5 rounded-2xl border border-white/5">
                    Se não encontrar na sua caixa de entrada, verifique a pasta de <strong className="text-amber-400">Spam</strong>.
                </div>

                <div className="space-y-4 pt-4">
                    <TJPRButton onClick={handleCheckVerification} className="w-full h-14 shadow-lg shadow-indigo-600/20">
                        JÁ VERIFIQUEI, ATUALIZAR STATUS
                    </TJPRButton>
                    
                    <button 
                        onClick={handleResend} 
                        disabled={isResending || cooldown > 0 || initialCooldown > 0} 
                        className="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-all disabled:opacity-30"
                    >
                        {isResending ? 'A ENVIAR...' : initialCooldown > 0 ? `AGUARDE ${initialCooldown}S PARA REENVIAR` : (cooldown > 0 ? `AGUARDE ${cooldown}S` : 'REENVIAR E-MAIL')}
                    </button>
                    
                    <div className="pt-4 border-t border-white/5">
                        <button onClick={() => window._supabaseClient.auth.signOut()} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-400 transition-colors">
                            Voltar para o Login
                        </button>
                    </div>
                </div>
                {message && <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest animate-pulse">{message}</p>}
                {error && <p className="text-xs font-bold text-rose-400 uppercase tracking-widest">{error}</p>}
            </div>
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
        <TJPRModal 
            isOpen={true} 
            onClose={onClose} 
            title="Calendário Oficial" 
            icon="calendar_today" 
            maxWidth="4xl"
        >
            <div className="space-y-8">
                {/* Seleção de Ano Elite */}
                <div className="flex flex-col items-center gap-4 border-b tjpr-border-main pb-8">
                    <p className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em]">Selecione o Ano</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {availableYears.map(year => (
                            <button
                                key={year}
                                onClick={() => setSelectedYear(year)}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                                    selectedYear === year
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                        : 'tjpr-bg-alt tjpr-text-dim tjpr-bg-hover hover:tjpr-text-main border tjpr-border-main'
                                }`}
                            >
                                {year}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recesso Forense */}
                <div className="tjpr-bg-alt border tjpr-border-main rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <span className="material-icons text-indigo-400 text-sm">ac_unit</span>
                        </div>
                        <h3 className="text-lg font-black tjpr-text-main tracking-tight">Recesso Forense {selectedYear}</h3>
                    </div>
                    <ul className="space-y-3">
                        <DiaNaoUtilItem dia={{ tipo: 'recesso_grouped', motivo: `Suspensão/Recesso de 01/01/${selectedYear} até 20/01/${selectedYear}` }} />
                        <DiaNaoUtilItem dia={{ tipo: 'recesso_grouped', motivo: `Recesso Forense de 20/12/${selectedYear} até 06/01/${selectedYear + 1}` }} />
                    </ul>
                </div>

                {/* Listagem Mensal */}
                {calendarLoading ? (
                    <div className="flex flex-col items-center py-12">
                        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Sincronizando Dados...</p>
                    </div>
                ) : Object.keys(diasAgrupadosPorMes).length === 0 ? (
                    <div className="py-12 text-center tjpr-bg-alt rounded-2xl border border-dashed tjpr-border-main">
                        <span className="material-icons tjpr-text-dim text-4xl mb-3">event_busy</span>
                        <p className="text-sm font-bold tjpr-text-dim uppercase tracking-widest">Nenhuma suspensão em {selectedYear}</p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {Object.entries(diasAgrupadosPorMes).map(([mes, dias]) => (
                            <div key={mes} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="sticky top-0 z-10 py-3 tjpr-bg-main backdrop-blur-md -mx-6 px-6 mb-4 border-y tjpr-border-main">
                                    <h3 className="text-lg font-black tjpr-text-main uppercase tracking-tight flex items-center gap-3">
                                        <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                                        {mes}
                                    </h3>
                                </div>
                                <div className="space-y-2">
                                    {dias.map(dia => (
                                        <DiaNaoUtilItem 
                                            key={dia.data} 
                                            dia={{ ...dia, data: new Date(dia.data + 'T00:00:00') }} 
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </TJPRModal>
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



const AdminPage = ({ setCurrentArea, initialSection }) => {
    const { user } = useAuth();
    // Estado para controlar a visão dentro da página de Admin: 'stats', 'calendar', 'users'
    const [adminSection, setAdminSection] = useState('stats'); // 'stats', 'calendar', 'users', 'audit'

    // Atualizado para receber objeto com timestamp
    useEffect(() => {
        if (initialSection?.view) setAdminSection(initialSection.view);
    }, [initialSection]);

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
    const [collapsedSections, setCollapsedSections] = useState({ kpis: false, charts: false, table: false });
    const [sectorToDelete, setSectorToDelete] = useState(null); // Para o modal de confirmação de setor

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
            const d = new Date(item.timestamp);
            return d >= start && d <= end;
        });

        if (toDelete.length === 0) {
            alert("Nenhum registro encontrado no período selecionado.");
            return;
        }

        if (window.confirm(`ATENÇÃO: Você está prestes a excluir ${toDelete.length} registros permanentemente.\nPeríodo: ${deleteRange.start || 'Início'} até ${deleteRange.end || 'Hoje'}.\n\nDeseja continuar?`)) {
            setLoading(true);
            try {
                const idsToDelete = toDelete.map(d => d.id);
                const { error } = await window._supabaseClient
                    .from('usage_stats')
                    .delete()
                    .in('id', idsToDelete);

                if (error) throw error;

                const deletedIds = new Set(idsToDelete);
                setAllData(prev => prev.filter(d => !deletedIds.has(d.id)));
                setFilteredData(prev => prev.filter(d => !deletedIds.has(d.id)));

                window.showToast("Registros excluídos com sucesso.", "success");
                setShowDeleteModal(false);
                await window.logAudit(window._supabaseClient, user, 'EXCLUIR_REGISTROS_USO', `De ${deleteRange.start} até ${deleteRange.end}. Qtd: ${toDelete.length}`);
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
        if (!window._supabaseClient) { setLoading(false); return; }
        setLoading(true);

        const loadAdminData = async () => {
            try {
                // 1. Busca usuários e setores em paralelo
                const [usersList, _, { data: broadcastDoc }] = await Promise.all([
                    fetchAllUsersForManagement(),
                    fetchSetores(),
                    window._supabaseClient.from('configuracoes').select('data').eq('id', 'aviso_global').maybeSingle()
                ]);
                if (!isMounted) return;

                // 2. Busca todas as estatísticas de uso
                const { data: usageData, error: usageError } = await window._supabaseClient
                    .from('usage_stats')
                    .select('*')
                    .order('timestamp', { ascending: false });

                if (usageError) throw usageError;
                if (!isMounted) return;

                let finalUsageData = usageData || [];
                const usersMap = (usersList || []).reduce((acc, user) => { acc[user.id] = user; return acc; }, {});

                // 3. Filtra estatísticas para Chefe de Setor
                if (adminUserData.role === 'setor_admin' && adminUserData.setorId) {
                    const userIdsInSector = new Set((usersList || []).filter(u => u.setorId === adminUserData.setorId).map(u => u.id));
                    finalUsageData = finalUsageData.filter(d => userIdsInSector.has(d.user_id));
                }

                const enrichedData = finalUsageData.map(d => ({ ...d, userName: usersMap[d.user_id]?.displayName || usersMap[d.user_id]?.email || d.user_email }));

                setAllData(enrichedData);

                if (broadcastDoc && broadcastDoc.data) {
                    setBroadcastMessage(broadcastDoc.data);
                }

            } catch (err) { console.error("Supabase query error:", err); }
            finally { if (isMounted) setLoading(false); }
        };

        loadAdminData();
        return () => { isMounted = false; };
    }, [adminUserData]);

    const fetchAllUsersForManagement = async () => {
        setUserManagementLoading(true);
        try {
            if (adminUserData.role === 'setor_admin' && adminUserData.setorId) {
                const { data: users, error } = await window._supabaseClient
                    .from('profiles')
                    .select('*')
                    .or(`setor_id.eq.${adminUserData.setor_id},setor_id.is.null`)
                    .order('display_name');

                if (error) throw error;
                const mappedUsers = users.map(u => ({
                    ...u,
                    setorId: u.setor_id,
                    displayName: u.display_name,
                    emailVerified: u.email_verified,
                    avatarColor: u.avatar_color
                }));
                setAllUsersForManagement(mappedUsers);
                return mappedUsers;
            } else {
                const { data: users, error } = await window._supabaseClient
                    .from('profiles')
                    .select('*')
                    .order('display_name');

                if (error) throw error;
                const mappedUsers = users.map(u => ({
                    ...u,
                    setorId: u.setor_id,
                    displayName: u.display_name,
                    emailVerified: u.email_verified,
                    avatarColor: u.avatar_color
                }));
                setAllUsersForManagement(mappedUsers);
                return mappedUsers;
            }
        } catch (err) {
            console.error("Erro ao buscar usuários para gerenciamento:", err);
            window.showToast("Falha ao buscar usuários.", "error");
        } finally {
            setUserManagementLoading(false);
        }
        return [];
    };


    const fetchSetores = async () => {
        if (!window._supabaseClient) return;
        try {
            if (adminUserData.role === 'setor_admin' && adminUserData.setorId) {
                const { data: setor, error } = await window._supabaseClient
                    .from('setores')
                    .select('*')
                    .eq('id', adminUserData.setorId)
                    .maybeSingle();

                if (error) throw error;
                setSetoresAdmin(setor ? [setor] : []);
            } else {
                const { data: setores, error } = await window._supabaseClient
                    .from('setores')
                    .select('*')
                    .order('nome');

                if (error) throw error;
                setSetoresAdmin(setores || []);
            }
        } catch (err) {
            console.error("Erro ao buscar setores:", err);
        }
    };

    const handleDeleteSector = (sectorId) => {
        const sector = setoresAdmin.find(s => s.id === sectorId);
        if (!sector) return;
        setSectorToDelete(sector);
    };

    const executeDeleteSector = async (sectorObj) => {
        const sector = sectorObj || sectorToDelete;
        if (!sector) return;
        const sectorId = sector.id;
        const sectorName = sector.nome;

        try {
            setLoading(true);
            setSectorToDelete(null);
            const { error } = await window._supabaseClient
                .from('setores')
                .delete()
                .eq('id', sectorId);

            if (error) throw error;

            await window.logAudit(window._supabaseClient, user, 'EXCLUIR_SETOR', `ID: ${sectorId} - Nome: ${sectorName}`);
            window.showToast("Setor excluído com sucesso.", "success");
            await fetchSetores(); // Recarrega a lista
        } catch (err) {
            console.error("Erro ao excluir setor:", err);
            window.showToast("Erro ao excluir setor.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAddSector = async (e) => {
        e.preventDefault();
        const nome = newSectorName.trim();
        if (!nome) return;

        try {
            setLoading(true);
            const { error } = await window._supabaseClient
                .from('setores')
                .insert({ nome });

            if (error) throw error;

            await window.logAudit(window._supabaseClient, user, 'CRIAR_SETOR', `Nome: ${nome}`);
            setNewSectorName('');
            window.showToast("Setor adicionado com sucesso.", "success");
            await fetchSetores(); // Recarrega a lista de setores
        } catch (err) {
            console.error("Erro ao adicionar setor:", err);
            if (err.message?.includes('duplicate key')) {
                window.showToast("Este setor já existe.", "warning");
            } else {
                window.showToast("Falha ao adicionar setor.", "error");
            }
        } finally {
            setLoading(false);
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
                alert("Falha ao salvar permissões.");
            } finally {
                setIsSaving(false);
            }
        };

        const canChangeToAdmin = adminUser.role === 'admin';

        return (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300" onClick={onClose}>
                <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-10 border-b border-white/5">
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">Gerenciar Usuário</h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{user.displayName || user.email}</p>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                            <span className="material-icons">close</span>
                        </button>
                    </div>
                    <div className="p-10 space-y-8">
                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Nível de Acesso</label>
                            <div className="relative">
                                <select 
                                    value={role} 
                                    onChange={e => setRole(e.target.value)} 
                                    className="w-full h-14 pl-12 pr-4 bg-slate-950 border border-white/5 rounded-2xl focus:border-indigo-500/50 outline-none text-white appearance-none transition-all shadow-inner font-bold text-sm"
                                >
                                    <option value="basic">Básico (Visualizador)</option>
                                    <option value="intermediate">Intermediário (Editor)</option>
                                    <option value="setor_admin">Chefe de Gabinete</option>
                                    {canChangeToAdmin && <option value="admin">Administrador Global</option>}
                                </select>
                                <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">verified_user</span>
                                <span className="material-icons absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none">expand_more</span>
                            </div>
                            {!canChangeToAdmin && role === 'admin' && (
                                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-tight ml-1 flex items-center gap-1">
                                    <span className="material-icons text-xs">warning</span>
                                    Apenas Administradores podem gerenciar outros Administradores.
                                </p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Vínculo de Setor</label>
                            <div className="relative">
                                <select 
                                    value={setorId} 
                                    onChange={e => setSetorId(e.target.value)} 
                                    className="w-full h-14 pl-12 pr-4 bg-slate-950 border border-white/5 rounded-2xl focus:border-indigo-500/50 outline-none text-white appearance-none transition-all shadow-inner font-bold text-sm"
                                >
                                    <option value="">Sem Setor Definido</option>
                                    {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                </select>
                                <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">business</span>
                                <span className="material-icons absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none">expand_more</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex border-t border-white/5 bg-white/[0.02]">
                        <button onClick={onClose} className="flex-1 px-8 py-6 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                            Descartar
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={isSaving} 
                            className="flex-1 px-8 py-6 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSaving ? <span className="material-icons animate-spin text-sm">sync</span> : <span className="material-icons text-sm">save</span>}
                            {isSaving ? 'SALVANDO...' : 'SALVAR'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const [userToDelete, setUserToDelete] = useState(null);

    const handleDeleteUser = (u) => {
        setUserToDelete(u);
    };

    const executeDeleteUser = async () => {
        if (!userToDelete) return;
        const u = userToDelete;
        if (!window._supabaseClient) return;

        try {
            setLoading(true);
            const { error } = await window._supabaseClient
                .from('profiles')
                .delete()
                .eq('id', u.id);

            if (error) throw error;

            await window.logAudit(window._supabaseClient, user, 'EXCLUIR_USUARIO', `Email: ${u.email}`);
            setUserToDelete(null);
            window.showToast("Usuário excluído com sucesso.", "success");
            fetchAllUsersForManagement();
        } catch (err) {
            console.error("Erro ao excluir usuário:", err);
            window.showToast("Falha ao excluir o usuário.", "error");
        } finally {
            setLoading(false);
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
        if (!window._supabaseClient) return;
        
        // Mapeia de volta para snake_case para o Supabase
        const updateData = {
            role: data.role,
            setor_id: data.setorId || null
        };

        const { error } = await window._supabaseClient
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

        if (error) throw error;
        await window.logAudit(window._supabaseClient, user, 'ALTERAR_PERMISSOES', `User: ${userId}, Role: ${data.role}, Setor: ${data.setorId}`);
    };

    const handleCloseUserManagementModal = () => {
        setEditingUser(null);
        fetchAllUsersForManagement(); // Sempre recarrega a lista ao fechar o modal
    };

    const handleSectorChange = async (userId, newSectorId) => {
        if (!window._supabaseClient) return;
        try {
            const { error } = await window._supabaseClient
                .from('profiles')
                .update({ setor_id: newSectorId })
                .eq('id', userId);

            if (error) throw error;
            fetchAllUsersForManagement();
        } catch (err) {
            console.error("Erro ao alterar setor:", err);
            window.showToast("Falha ao alterar o setor do usuário.", "error");
        }
    };

    const handleManualVerification = async (userId) => {
        if (window.confirm("Tem certeza que deseja verificar manualmente o e-mail deste usuário?")) {
            if (!window._supabaseClient) return;
            try {
                const { error } = await window._supabaseClient
                    .from('profiles')
                    .update({ email_verified: true })
                    .eq('id', userId);

                if (error) throw error;
                window.showToast("Usuário verificado com sucesso.", "success");
                fetchAllUsersForManagement();
            } catch (err) {
                console.error("Erro na verificação manual:", err);
                window.showToast("Falha ao verificar o usuário.", "error");
            }
        }
    };

    const handleManualPasswordReset = async (user) => {
        if (window.confirm(`Deseja enviar um link de redefinição de senha para ${user.email}?`)) {
            const { error } = await window._supabaseClient.auth.resetPasswordForEmail(user.email);
            if (error) {
                window.showToast("Erro ao enviar e-mail: " + error.message, "error");
            } else {
                window.showToast("E-mail de redefinição de senha enviado.", "success");
            }
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
            perMateria: usageData.reduce((acc, curr) => {
                let m = (curr.materia || '').toLowerCase();
                if (m.includes('crime') || m.includes('criminal')) m = 'crime';
                else if (m.includes('civel') || m.includes('cível')) m = 'civel';
                if (m === 'crime' || m === 'civel') acc[m] = (acc[m] || 0) + 1;
                return acc;
            }, {}),
            perPrazo: usageData.reduce((acc, curr) => {
                const p = String(curr.prazo || '');
                if (p === '5' || p === '15') acc[p] = (acc[p] || 0) + 1;
                return acc;
            }, {}),
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
            const idsToDelete = dataToDelete.map(d => d.id);
            const { error } = await window._supabaseClient
                .from('usage_stats')
                .delete()
                .in('id', idsToDelete);

            if (error) throw error;

            alert("Registros excluídos com sucesso.");
            const deletedIds = new Set(idsToDelete);
            setAllData(prev => prev.filter(item => !deletedIds.has(item.id)));
        } catch (err) { 
            console.error("Erro ao excluir:", err); 
            alert("Erro ao excluir registros."); 
        } finally { 
            setLoading(false); 
        }
    };

    const handleExport = () => {
        const dataToExport = (selectedUserForStats ? selectedUserForStats.data : filteredData).map(item => ({
            'ID do Usuário': item.userId,
            'Usuário': item.userName || item.userEmail,
            'Tipo de Uso': item.type === 'djen_consulta' ? 'Consulta DJEN' : (item.type || 'Calculadora'),
            'Matéria': item.type === 'djen_consulta' ? '-' : (item.materia === 'civel' ? 'Cível' : (item.materia ? 'Criminal' : '-')),
            'Prazo (dias)': item.prazo || '-',
            'Número do Processo': item.numeroProcesso && item.numeroProcesso !== 'Não informado' ? item.numeroProcesso : '',
            'Data': item.timestamp ? formatarData(new Date(item.timestamp)) : ''
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "RelatorioCalculos");
        XLSX.writeFile(workbook, "relatorio_calculadora_prazos.xlsx");
    };

    const handleSaveBroadcast = async () => {
        setIsSavingBroadcast(true);
        console.log('Tentando salvar aviso global:', broadcastMessage);
        try {
            const { error } = await window._supabaseClient
                .from('configuracoes')
                .update(broadcastMessage)
                .eq('id', 'aviso_global');
            
            if (error) throw error;

            await logAudit(window._supabaseClient, user, 'ATUALIZAR_BROADCAST', `Ativo: ${broadcastMessage.ativo}, Msg: ${broadcastMessage.mensagem}`);
            alert("Aviso global atualizado com sucesso!");
        } catch (e) {
            console.error('Erro ao salvar aviso global:', e);
            const errorMsg = e.message || (typeof e === 'object' ? JSON.stringify(e) : String(e));
            alert("Erro ao salvar aviso: " + errorMsg);
        } finally {
            setIsSavingBroadcast(false);
        }
    };

    useEffect(() => {
        if (adminSection === 'audit') {
            const fetchAudit = async () => {
                setLoading(true);
                try {
                    const { data, error } = await window._supabaseClient
                        .from('audit_logs')
                        .select('*')
                        .order('timestamp', { ascending: false })
                        .limit(50);
                    
                    if (error) throw error;
                    setAuditLogs(data || []);
                } catch (err) {
                    console.error("Erro ao buscar logs:", err);
                } finally {
                    setLoading(false);
                }
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
    const dataForPagination = useMemo(() => {
        if (selectedUserForStats) return selectedUserForStats.data;
        return filteredData;
    }, [selectedUserForStats, filteredData]);

    const { paginatedData, paginationControls } = usePagination(dataForPagination || [], 10);

    const chartDataMateria = { labels: ['Matéria Cível', 'Matéria Criminal'], datasets: [{ data: [stats.perMateria.civel || 0, stats.perMateria.crime || 0], backgroundColor: ['#6366F1', '#F59E0B'] }] };
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
            <div className="tjpr-card p-6 sm:p-8 space-y-6 animate-fade-in-up">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Perfil do Usuário</h2>
                        <p className="text-slate-400 font-medium">{selectedUserForStats.name}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">ID: {selectedUserForStats.data[0]?.userId}</p>
                    </div>
                    <button onClick={() => setSelectedUserForStats(null)} className="text-xs font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                        <span className="material-icons text-sm">arrow_back</span> Voltar ao Painel
                    </button>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={handleExport} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-semibold">
                        <span className="material-icons text-sm">download</span>
                        Baixar Relatório do Usuário
                    </button>
                </div>
                <UserUsageCharts userData={selectedUserForStats.data} />
                <div className="overflow-hidden bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 shadow-2xl">
                    <div className="px-8 py-6 border-b border-white/5 bg-white/5">
                        <h3 className="font-black text-white uppercase tracking-widest text-xs">Histórico Recente</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-separate border-spacing-y-2 px-4 pb-4">
                            <thead className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                <tr>
                                    <th className="px-6 py-4">Data</th>
                                    <th className="px-6 py-4">Nº Processo</th>
                                    <th className="px-6 py-4 text-center">Tipo / Matéria</th>
                                    <th className="px-6 py-4 text-center">Prazo</th>
                                </tr>
                            </thead>
                            <tbody className="space-y-2">
                                {paginatedData.map(item => (
                                    <tr key={item.id} className="bg-white/[0.02] hover:bg-white/[0.05] transition-all group">
                                        <td className="px-6 py-4 rounded-l-2xl text-slate-400 font-medium">{item.timestamp ? formatarData(item.timestamp.toDate()) : ''}</td>
                                        <td className="px-6 py-4 font-black text-white">{item.numeroProcesso && item.numeroProcesso !== 'Não informado' ? item.numeroProcesso : '-'}</td>
                                        <td className="px-6 py-4 text-center">
                                            {item.type === 'djen_consulta' ? (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    DJEN
                                                </span>
                                            ) : (
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${item.materia === 'civel' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                                    {item.materia === 'civel' ? 'Cível' : 'Criminal'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 rounded-r-2xl font-bold text-indigo-400 text-center">{item.prazo ? `${item.prazo} dias` : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {selectedUserForStats.data.length > 10 && (
                        <div className="p-6 border-t border-white/5 bg-white/2">
                            {paginationControls}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="tjpr-card p-6 sm:p-8">
                <h2 className="text-2xl font-black tjpr-text-main tracking-tight">Painel Administrativo</h2>
                <div className="flex items-center gap-2 mt-4 border-b tjpr-border-main pb-4">
                    <button 
                        onClick={() => setAdminSection('stats')} 
                        className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${adminSection === 'stats' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 scale-105' : 'tjpr-bg-alt tjpr-text-dim hover:tjpr-text-main tjpr-bg-hover'}`}
                    >
                        <span className="material-icons text-sm">insights</span>
                        Estatísticas
                    </button>
                    
                    <button 
                        onClick={() => setAdminSection('users')} 
                        className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${adminSection === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 scale-105' : 'tjpr-bg-alt tjpr-text-dim hover:tjpr-text-main tjpr-bg-hover'}`}
                    >
                        <span className="material-icons text-sm">people</span>
                        {adminUserData?.role === 'setor_admin' ? 'Usuários' : 'Gestão de Acesso'}
                    </button>
                    
                    {(adminUserData?.role === 'admin' || adminUserData?.role === 'setor_admin') && (
                        <button 
                            onClick={() => setAdminSection('minutas')} 
                            className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${adminSection === 'minutas' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 scale-105' : 'tjpr-bg-alt tjpr-text-dim hover:tjpr-text-main tjpr-bg-hover'}`}
                        >
                            <span className="material-icons text-sm">description</span>
                            Minutas
                        </button>
                    )}
                    
                    {adminUserData?.role === 'admin' && (
                        <>
                            <button 
                                onClick={() => setAdminSection('calendar')} 
                                className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${adminSection === 'calendar' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 scale-105' : 'tjpr-bg-alt tjpr-text-dim hover:tjpr-text-main tjpr-bg-hover'}`}
                            >
                                <span className="material-icons text-sm">event</span>
                                Calendário
                            </button>
                            
                            <button 
                                onClick={() => setAdminSection('chamados')} 
                                className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${adminSection === 'chamados' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 scale-105' : 'tjpr-bg-alt tjpr-text-dim hover:tjpr-text-main tjpr-bg-hover'}`}
                            >
                                <span className="material-icons text-sm">confirmation_number</span>
                                Chamados
                            </button>
                            
                            <button 
                                onClick={() => setAdminSection('broadcast')} 
                                className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${adminSection === 'broadcast' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 scale-105' : 'tjpr-bg-alt tjpr-text-dim hover:tjpr-text-main tjpr-bg-hover'}`}
                            >
                                <span className="material-icons text-sm">campaign</span>
                                Aviso Global
                            </button>
                        </>
                    )}

                </div>
            </div>

            {adminSection === 'stats' && (
                <div className="space-y-8 animate-fade-in">

                    {/* 1. Header & Filters Toolbar */}
                    <div className="tjpr-card p-6">
                        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                            <div>
                                <h3 className="text-xl font-black tjpr-text-main tracking-tight">Visão Geral de Uso</h3>
                                <p className="text-sm tjpr-text-dim font-medium">Analise o desempenho e engajamento da ferramenta.</p>
                            </div>
                            <div className="flex tjpr-bg-alt p-1 rounded-xl border tjpr-border-main">
                                <button onClick={() => setStatsView('calculadora')} className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${statsView === 'calculadora' ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20 text-white' : 'tjpr-text-dim hover:tjpr-text-main'}`}>Calculadora</button>
                                <button onClick={() => setStatsView('djen_consulta')} className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${statsView === 'djen_consulta' ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20 text-white' : 'tjpr-text-dim hover:tjpr-text-main'}`}>Consulta DJEN</button>
                            </div>
                        </div>

                        {/* Filters Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                            <div><label className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] mb-2 ml-1 block">Data Inicial</label><input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full h-12 tjpr-bg-alt border tjpr-border-main rounded-xl px-4 text-xs font-bold tjpr-text-main focus:border-indigo-500/50 outline-none transition-all" /></div>
                            <div><label className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] mb-2 ml-1 block">Data Final</label><input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full h-12 tjpr-bg-alt border tjpr-border-main rounded-xl px-4 text-xs font-bold tjpr-text-main focus:border-indigo-500/50 outline-none transition-all" /></div>

                            {statsView === 'calculadora' ? (
                                <>
                                    <div><label className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] mb-2 ml-1 block">Matéria</label><select name="materia" value={filters.materia} onChange={handleFilterChange} className="w-full h-12 tjpr-bg-alt border tjpr-border-main rounded-xl px-4 text-xs font-bold tjpr-text-main appearance-none focus:border-indigo-500/50 outline-none transition-all cursor-pointer"><option value="todos">Todas</option><option value="civel">Matéria Cível</option><option value="crime">Matéria Criminal</option></select></div>
                                    <div><label className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] mb-2 ml-1 block">Prazo</label><select name="prazo" value={filters.prazo} onChange={handleFilterChange} className="w-full h-12 tjpr-bg-alt border tjpr-border-main rounded-xl px-4 text-xs font-bold tjpr-text-main appearance-none focus:border-indigo-500/50 outline-none transition-all cursor-pointer"><option value="todos">Todos</option><option value="5">5 Dias</option><option value="15">15 Dias</option></select></div>
                                </>
                            ) : (
                                <div className="lg:col-span-2 hidden lg:block"></div>
                            )}

                            <div className="lg:hidden"><button onClick={handleFilter} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-sm">Aplicar Filtros</button></div>
                        </div>
                        <div className="hidden lg:flex justify-end mt-6 pt-6 border-t border-white/5">
                            <button onClick={handleFilter} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/40 flex items-center gap-2 active:scale-95">
                                <span className="material-icons text-sm">filter_list</span> Aplicar Filtros
                            </button>
                        </div>
                    </div>

                    {!hasSearched ? (
                        <div className="text-center py-24 bg-white/5 rounded-[2.5rem] border border-white/10 border-dashed backdrop-blur-xl">
                            <span className="material-icons text-6xl text-slate-700 mb-6">analytics</span>
                            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Configure os filtros acima para visualizar as estatísticas.</p>
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="text-center py-24 bg-white/5 rounded-[2.5rem] border border-white/10 border-dashed backdrop-blur-xl animate-fade-in">
                            {loading ? (
                                <div className="max-w-4xl mx-auto px-4">
                                    <SkeletonLoader />
                                </div>
                            ) : (
                                <>
                                    <span className="material-icons text-6xl text-slate-300 dark:text-slate-600 mb-4">search_off</span>
                                    <p className="text-slate-500 dark:text-slate-400">Nenhum registro encontrado para este período.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* 2. KPI Cards Section (Collapsible) */}
                            <div className="tjpr-card overflow-hidden transition-all duration-300">
                                <button
                                    onClick={() => setCollapsedSections(prev => ({ ...prev, kpis: !prev.kpis }))}
                                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-icons text-indigo-400">dashboard</span>
                                        <span className="font-black text-white tracking-tight">Indicadores Chave (KPIs)</span>
                                    </div>
                                    <span className={`material-icons text-slate-500 transition-transform duration-300 ${collapsedSections.kpis ? '' : 'rotate-180'}`}>expand_more</span>
                                </button>
                                {!collapsedSections.kpis && (
                                    <div className="p-6 pt-0 animate-fade-in">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                                                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity"><span className="material-icons text-8xl text-white">bar_chart</span></div>
                                                <h3 className="text-xs font-bold text-indigo-100 uppercase tracking-wider mb-2">Total de Usos</h3>
                                                <p className="text-4xl font-extrabold text-white mb-2">{stats.total}</p>
                                                <div className="flex items-center text-xs font-medium text-white/90 bg-white/20 px-2 py-1 rounded w-fit backdrop-blur-sm"><span className="material-icons text-xs mr-1">trending_up</span> No período selecionado</div>
                                            </div>
                                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                                                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity"><span className="material-icons text-8xl text-white">person</span></div>
                                                <h3 className="text-xs font-bold text-emerald-100 uppercase tracking-wider mb-2">Top Usuário</h3>
                                                <p className="text-2xl font-bold text-white truncate mb-1" title={topUsers[0]?.[0]}>{topUsers[0]?.[0] || 'N/A'}</p>
                                                <p className="text-sm text-emerald-100/90">Responsável por <strong className="text-white">{topUsers[0]?.[1] || 0}</strong> operações</p>
                                            </div>
                                            <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                                                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity"><span className="material-icons text-8xl text-white">lightbulb</span></div>
                                                <h3 className="text-xs font-bold text-amber-100 uppercase tracking-wider mb-2">{statsView === 'calculadora' ? 'Matéria Principal' : 'Dia de Pico'}</h3>
                                                <p className="text-2xl font-bold text-white capitalize truncate mb-1">{statsView === 'calculadora' ? (Object.entries(stats.perMateria).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A') : (Object.entries(stats.byDay).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A')}</p>
                                                <p className="text-sm text-amber-100/90">Maior volume registrado</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 3. Global Charts Section (Collapsible) */}
                            <div className="tjpr-card overflow-hidden transition-all duration-300">
                                <button
                                    onClick={() => setCollapsedSections(prev => ({ ...prev, charts: !prev.charts }))}
                                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-icons text-purple-400">insights</span>
                                        <span className="font-black text-white tracking-tight">Gráficos de Tendência e Distribuição</span>
                                    </div>
                                    <span className={`material-icons text-slate-500 transition-transform duration-300 ${collapsedSections.charts ? '' : 'rotate-180'}`}>expand_more</span>
                                </button>
                                {!collapsedSections.charts && (
                                    <div className="p-8 pt-2 animate-fade-in space-y-8">
                                        <div className="bg-slate-950/50 p-6 rounded-2xl border border-white/5 shadow-inner">
                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Volume de Utilização por Dia</h4>
                                            <div className="h-[300px]">
                                                <Bar data={chartDataByDay} options={{ ...chartOptions, maintainAspectRatio: false }} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                            <div className="bg-slate-950/50 p-6 rounded-2xl border border-white/5 shadow-inner">
                                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 text-center">Matéria</h4>
                                                <div className="h-64"><Pie data={chartDataMateria} options={{ maintainAspectRatio: false }} /></div>
                                            </div>
                                            <div className="bg-slate-950/50 p-6 rounded-2xl border border-white/5 shadow-inner">
                                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 text-center">Prazo</h4>
                                                <div className="h-64"><Pie data={chartDataPrazo} options={{ maintainAspectRatio: false }} /></div>
                                            </div>
                                            <div className="bg-slate-950/50 p-6 rounded-2xl border border-white/5 shadow-inner">
                                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 text-center">Setor</h4>
                                                <div className="h-64"><HorizontalBar data={chartDataSector} options={{ ...chartOptions, maintainAspectRatio: false }} /></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 4. Top Usuários Section */}
                            <div className="tjpr-card overflow-hidden">
                                <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                    <h3 className="font-black text-white flex items-center gap-3 tracking-tight">
                                        <span className="material-icons text-amber-400">emoji_events</span> Hall da Fama (Mês Atual)
                                    </h3>
                                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest italic">Ranking de Atividade</span>
                                </div>
                                <div className="p-8">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                                        {topUsers.map(([email, count], idx) => {
                                            let badge = null;
                                            if (idx === 0) badge = "🥇";
                                            else if (idx === 1) badge = "🥈";
                                            else if (idx === 2) badge = "🥉";

                                            return (
                                                <div key={idx} className={`p-6 rounded-2xl border transition-all duration-300 flex flex-col items-center text-center group ${idx < 3 ? 'bg-indigo-600/10 border-indigo-500/20 shadow-lg shadow-indigo-600/5 scale-[1.05]' : 'bg-slate-950/40 border-white/5'}`}>
                                                    <div className="relative mb-4">
                                                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black text-white shadow-inner ${idx === 0 ? 'bg-gradient-to-tr from-amber-400 to-yellow-600 shadow-amber-500/20' :
                                                            idx === 1 ? 'bg-gradient-to-tr from-slate-300 to-slate-500 shadow-slate-400/20' :
                                                                idx === 2 ? 'bg-gradient-to-tr from-orange-400 to-orange-700 shadow-orange-600/20' : 'bg-slate-900 border border-white/5 text-slate-600'
                                                            }`}>
                                                            {badge || (idx + 1)}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs font-black text-white truncate w-full mb-1 tracking-tight" title={email}>{email.split('@')[0]}</div>
                                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{count} cálculos</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* 5. Detailed Records Table (Collapsible) */}
                            <div className="tjpr-card overflow-hidden transition-all duration-300">
                                <button
                                    onClick={() => setCollapsedSections(prev => ({ ...prev, table: !prev.table }))}
                                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-icons text-emerald-400">table_view</span>
                                        <span className="font-black text-white tracking-tight">Registros Detalhados</span>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <span className="text-[10px] font-black px-3 py-1 bg-white/5 border border-white/5 rounded-full text-slate-400 uppercase tracking-widest">{filteredData.length} registros</span>
                                        <span className={`material-icons text-slate-500 transition-transform duration-300 ${collapsedSections.table ? '' : 'rotate-180'}`}>expand_more</span>
                                    </div>
                                </button>
                                {!collapsedSections.table && (
                                    <div className="p-8 pt-2 animate-fade-in">
                                        <div className="flex justify-between items-center mb-6">
                                            <button onClick={handleExport} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 text-xs font-black uppercase tracking-wider">
                                                <span className="material-icons text-sm">download</span> Exportar Excel
                                            </button>
                                            {adminUserData.role === 'admin' && (
                                                <button onClick={handleDeleteClick} className="px-5 py-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 rounded-xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-2">
                                                    <span className="material-icons text-sm">delete_sweep</span> Limpar Período
                                                </button>
                                            )}
                                        </div>

                                        <div className="overflow-hidden bg-slate-950/40 rounded-2xl border border-white/5">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="text-[10px] text-slate-500 uppercase tracking-[0.2em] bg-white/5 border-b border-white/5">
                                                        <tr>
                                                            <th className="px-6 py-5 font-black">Usuário</th>
                                                            <th className="px-6 py-5 font-black text-center">{statsView === 'calculadora' ? 'Matéria' : 'Tipo'}</th>
                                                            {statsView === 'calculadora' && <th className="px-6 py-5 font-black text-center">Prazo</th>}
                                                            <th className="px-6 py-5 font-black">Processo</th>
                                                            <th className="px-6 py-5 font-black">Data/Hora</th>
                                                            <th className="px-6 py-5 font-black text-center">Ações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {paginatedData.map(item => (
                                                            <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                                                                <td className="px-6 py-5">
                                                                    <div className="font-bold text-white tracking-tight">{item.userName || item.userEmail || <span className="text-slate-500 italic">Anônimo</span>}</div>
                                                                    {item.userEmail && <div className="text-[10px] text-slate-500 font-medium">{item.userEmail}</div>}
                                                                </td>
                                                                <td className="px-6 py-5 text-center">
                                                                    {statsView === 'calculadora' ? (
                                                                        item.materia ? (
                                                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${item.materia === 'civel' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                                                                {item.materia === 'civel' ? 'Cível' : 'Criminal'}
                                                                            </span>
                                                                        ) : <span className="text-slate-600">-</span>
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                            DJEN
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                {statsView === 'calculadora' && (
                                                                    <td className="px-6 py-5 font-black text-slate-400 text-xs text-center">{item.prazo ? `${item.prazo}d` : '-'}</td>
                                                                )}
                                                                <td className="px-6 py-5 text-slate-500 font-bold text-[11px] tracking-tighter">{item.numeroProcesso && item.numeroProcesso !== 'Não informado' ? item.numeroProcesso : '-'}</td>
                                                                <td className="px-6 py-5 text-slate-500 text-[11px] font-medium">{item.timestamp ? formatarData(item.timestamp.toDate()) : '-'}</td>
                                                                <td className="px-6 py-5 text-center">
                                                                    <button onClick={() => setSelectedUserForStats({ name: item.userName || item.userEmail || 'Anônimo', data: allData.filter(d => d.userId === item.userId) })} className="p-2 text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all" title="Ver perfil do usuário">
                                                                        <span className="material-icons text-sm">visibility</span>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="p-6 border-t border-white/5 bg-white/5">
                                                {paginationControls}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {adminSection === 'users' && (
                <div className="flex flex-col xl:flex-row gap-8 animate-fade-in">
                    {/* Coluna Esquerda: Gerenciamento de Setores (Apenas Admin Global) */}
                    {adminUserData.role === 'admin' && (
                        <div className="xl:w-1/3 space-y-8">
                            <div className="tjpr-card p-8">
                                <h3 className="text-xl font-black tjpr-text-main mb-6 tracking-tight flex items-center gap-2">
                                    <span className="material-icons text-blue-400">category</span>
                                    Gerenciar Setores
                                </h3>
                                <form onSubmit={handleAddSector} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] ml-1">Novo Setor</label>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <input
                                                type="text"
                                                placeholder="Nome do setor..."
                                                value={newSectorName}
                                                onChange={e => setNewSectorName(e.target.value)}
                                                className="flex-grow px-4 py-3 tjpr-bg-alt border tjpr-border-main rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm tjpr-text-main placeholder:tjpr-text-dim"
                                            />
                                            <button type="submit" className="sm:px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center">
                                                <span className="material-icons">add</span>
                                                <span className="sm:hidden ml-2 font-bold uppercase text-[10px] tracking-widest">Adicionar</span>
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            <div className="tjpr-card overflow-hidden">
                                <div className="px-6 py-4 border-b tjpr-border-main tjpr-bg-alt">
                                    <h3 className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em]">Setores Existentes</h3>
                                </div>
                                <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
                                    {setores.map(setor => {
                                        const membersCount = allUsersForManagement.filter(u => u.setorId === setor.id).length;
                                        return (
                                            <div key={setor.id} className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                                                <div>
                                                    <p className="font-bold text-white text-sm tracking-tight">{setor.nome}</p>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{membersCount} membros</p>
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteSector(setor.id);
                                                    }} 
                                                    className="text-slate-600 hover:text-rose-400 transition-all p-2 rounded-lg hover:bg-rose-400/10" 
                                                    title="Excluir Setor"
                                                >
                                                    <span className="material-icons text-xl">delete_outline</span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={`${adminUserData.role === 'admin' ? 'xl:w-2/3' : 'w-full'} space-y-8`}>
                        <div className="tjpr-card p-8">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-8">
                                <h2 className="text-2xl font-black tjpr-text-main tracking-tight">Gestão de Usuários</h2>
                                <div className="relative w-full sm:w-72 group">
                                    <input
                                        type="text"
                                        placeholder="Buscar usuário..."
                                        value={userSearchTerm}
                                        onChange={e => setUserSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 tjpr-bg-alt border tjpr-border-main rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition text-sm tjpr-text-main placeholder:tjpr-text-dim"
                                    />
                                    <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors">search</span>
                                </div>
                            </div>

                            {userManagementLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Carregando base de usuários...</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
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
                                            <div key={sectorId} className="tjpr-card overflow-hidden">
                                                <div
                                                    className="px-6 py-4 flex justify-between items-center cursor-pointer tjpr-bg-hover transition-colors"
                                                    onClick={() => toggleUserSectorExpansion(sectorId)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className={`material-icons text-slate-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>chevron_right</span>
                                                        <h4 className="font-black tjpr-text-main text-xs uppercase tracking-widest">{sectorName}</h4>
                                                    </div>
                                                    <span className="text-[10px] font-black tjpr-bg-alt px-2.5 py-1 rounded-full border tjpr-border-main tjpr-text-dim">{users.length}</span>
                                                </div>

                                                {isExpanded && (
                                                    <div className="divide-y tjpr-border-main tjpr-bg-alt">
                                                        {users.map(u => (
                                                            <div key={u.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black text-white shadow-lg ${u.emailVerified ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/20' : 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/20'}`}>
                                                                        {u.displayName ? u.displayName.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-black tjpr-text-main tracking-tight">{u.displayName || 'Sem Nome'}</p>
                                                                        <p className="text-[10px] font-bold tjpr-text-dim tracking-wider">{u.email}</p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-4 self-end sm:self-auto">
                                                                    <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] rounded-md border ${u.role === 'admin' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                                        u.role === 'setor_admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                                            u.role === 'intermediate' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                                                                'bg-slate-500/10 text-slate-400 border-white/5'
                                                                        }`}>
                                                                        {u.role === 'admin' ? 'Global Admin' : u.role === 'setor_admin' ? 'Chefe' : u.role === 'intermediate' ? 'Intermediário' : 'Básico'}
                                                                    </span>

                                                                    <div className="flex items-center border-l border-white/5 pl-4 gap-2">
                                                                        <button onClick={() => handleOpenUserManagementModal(u)} className="p-2 text-slate-500 hover:text-indigo-400 transition-all rounded-xl hover:bg-indigo-400/10" title="Editar Permissões">
                                                                            <span className="material-icons text-lg">edit_note</span>
                                                                        </button>
                                                                        <button onClick={() => handleDeleteUser(u)} className="p-2 text-slate-500 hover:text-rose-400 transition-all rounded-xl hover:bg-rose-400/10" title="Excluir Usuário">
                                                                            <span className="material-icons text-lg">person_remove</span>
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
            {adminSection === 'minutas' && <MinutasAdminPage />}
            {adminSection === 'calendar' && <CalendarioAdminPage />}
            {adminSection === 'chamados' && <BugReportsPage />}
            {adminSection === 'broadcast' && (
                <div className="tjpr-card p-10 space-y-10 animate-fade-in-up">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                            <span className="material-icons text-3xl">campaign</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tjpr-text-main tracking-tight uppercase">Aviso Global</h2>
                            <p className="tjpr-text-dim text-xs font-bold tracking-widest uppercase mt-1">Comunicação direta com todos os usuários</p>
                        </div>
                    </div>

                    <div className="space-y-8 tjpr-bg-alt p-8 rounded-[2rem] border tjpr-border-main">
                        <div className="flex items-center gap-4 p-4 tjpr-bg-main rounded-2xl border tjpr-border-main">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={broadcastMessage.ativo}
                                    onChange={e => setBroadcastMessage({ ...broadcastMessage, ativo: e.target.checked })}
                                />
                                <div className="w-12 h-6 tjpr-bg-main border tjpr-border-main rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white shadow-inner"></div>
                                <span className="ml-4 text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em]">Exibir aviso na página inicial</span>
                            </label>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] ml-1">Conteúdo da Mensagem</label>
                            <textarea
                                value={broadcastMessage.mensagem}
                                onChange={e => setBroadcastMessage({ ...broadcastMessage, mensagem: e.target.value })}
                                rows="4"
                                className="w-full p-6 tjpr-bg-main border tjpr-border-main rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all tjpr-text-main placeholder:tjpr-text-dim shadow-inner"
                                placeholder="Digite aqui a mensagem que será exibida para todos..."
                            ></textarea>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleSaveBroadcast}
                                disabled={isSavingBroadcast}
                                className="flex items-center gap-3 px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50 active:scale-95"
                            >
                                <span className="material-icons text-lg">{isSavingBroadcast ? 'sync' : 'cloud_upload'}</span>
                                {isSavingBroadcast ? 'Processando...' : 'Publicar Alterações'}
                            </button>
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

            {/* Modal de Exclusão de Estatísticas (Padrão Elite) */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setShowDeleteModal(false)}>
                    <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="p-10">
                            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
                                <span className="material-icons text-3xl">history</span>
                            </div>
                            <h3 className="text-xl font-black text-white text-center mb-6 uppercase tracking-tight">Limpar Histórico</h3>
                            
                            <div className="space-y-4">
                                <TJPRInput
                                    label="Data Inicial"
                                    type="date"
                                    value={deleteRange.start}
                                    onChange={e => setDeleteRange({ ...deleteRange, start: e.target.value })}
                                    icon="calendar_today"
                                />
                                <TJPRInput
                                    label="Data Final"
                                    type="date"
                                    value={deleteRange.end}
                                    onChange={e => setDeleteRange({ ...deleteRange, end: e.target.value })}
                                    icon="event"
                                />
                            </div>
                        </div>
                        <div className="flex border-t border-white/5 bg-white/[0.02]">
                            <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-8 py-6 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                                Cancelar
                            </button>
                            <button onClick={handleConfirmDelete} className="flex-1 px-8 py-6 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest transition-all">
                                EXCLUIR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão de Setor (Padrão Elite) */}
            {sectorToDelete && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setSectorToDelete(null)}>
                    <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="p-10 text-center">
                            <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20 shadow-[0_0_40px_-10px_rgba(244,63,94,0.3)]">
                                <span className="material-icons text-4xl">delete_forever</span>
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Excluir Setor?</h3>
                            <p className="text-sm text-slate-400 font-medium leading-relaxed">
                                Tem certeza que deseja excluir o setor <br/>
                                <span className="text-white font-bold">"{sectorToDelete.nome}"</span>?<br/>
                                Esta ação removerá o vínculo de todos os usuários.
                            </p>
                        </div>
                        <div className="flex border-t border-white/5 bg-white/[0.02]">
                            <button onClick={() => setSectorToDelete(null)} className="flex-1 px-8 py-6 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                                Cancelar
                            </button>
                            <button onClick={() => executeDeleteSector()} className="flex-1 px-8 py-6 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                <span className="material-icons text-sm">delete</span>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão de Usuário (Padrão Elite) */}
            {userToDelete && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setUserToDelete(null)}>
                    <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="p-10 text-center">
                            <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20 shadow-[0_0_40px_-10px_rgba(244,63,94,0.3)]">
                                <span className="material-icons text-4xl">person_remove</span>
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Excluir Usuário?</h3>
                            <p className="text-sm text-slate-400 font-medium leading-relaxed">
                                Deseja excluir <span className="text-white font-bold">{userToDelete.displayName || userToDelete.email}</span>?<br/>
                                Esta ação é irreversível.
                            </p>
                        </div>
                        <div className="flex border-t border-white/5 bg-white/[0.02]">
                            <button onClick={() => setUserToDelete(null)} className="flex-1 px-8 py-6 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                                Cancelar
                            </button>
                            <button onClick={executeDeleteUser} className="flex-1 px-8 py-6 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                <span className="material-icons text-sm">delete</span>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};


const ChangelogModal = ({ onClose }) => {
    const [latestLog, setLatestLog] = useState(null);
    const [loading, setLoading] = useState(true);
    const { userData } = useAuth();

    useEffect(() => {
        const fetchChangelog = async () => {
            if (!window._supabaseClient) return;
            try {
                const { data, error } = await window._supabaseClient
                    .from('changelog')
                    .select('*')
                    .order('date', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (!error && data) {
                    setLatestLog(data);
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
                    <p className="text-sm text-slate-500 dark:text-slate-400">Novidades da versão {latestLog.id} (em {formatarData(latestLog.date && latestLog.date.toDate ? latestLog.date.toDate() : new Date(latestLog.date))})</p>
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

// Usar o componente global definido em components.js
// NotificationsPanel já está declarado no topo do arquivo via window

const SettingsModal = ({ onClose }) => {
    const { settings, updateSettings } = useContext(SettingsContext);
    const { user } = useAuth();
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
        // O 'user' já vem do contexto useAuth

        try {
            // Supabase: valida senha atual tentando login, depois atualiza
            const { error: signInErr } = await window._supabaseClient.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
            });
            if (signInErr) throw { code: 'auth/wrong-password' };

            // Atualizar a senha
            const { error: updateErr } = await window._supabaseClient.auth.updateUser({ password: newPassword });
            if (updateErr) throw updateErr;

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
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Nova Senha</label>
                                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition text-white placeholder:text-slate-600" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Confirmar Nova Senha</label>
                                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition text-white placeholder:text-slate-600" />
                            </div>
                            {error && <p className="text-xs font-bold text-center text-rose-500 uppercase tracking-widest">{error}</p>}
                            {message && <p className="text-xs font-bold text-center text-emerald-500 uppercase tracking-widest">{message}</p>}
                            <button type="submit" disabled={isSaving} className="w-full h-14 flex justify-center items-center bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
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
    const [activeTab, setActiveTab] = useState('perfil'); // 'perfil' | 'senha'
    const [displayName, setDisplayName] = useState(userData?.display_name || '');
    const [avatarColor, setAvatarColor] = useState(userData?.avatar_color || AVATAR_COLORS[0]);
    const [photoPreview, setPhotoPreview] = useState(userData?.photo_url || userData?.photoURL || null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
    const fileInputRef = useRef(null);

    // Senha
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwError, setPwError] = useState('');
    const [pwMessage, setPwMessage] = useState('');
    const [isSavingPw, setIsSavingPw] = useState(false);

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            setError('A imagem deve ter no maximo 2 MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoPreview(ev.target.result);
        reader.readAsDataURL(file);
        setError('');
    };

    const handleRemovePhoto = () => {
        setPhotoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDeleteAccount = () => setShowDeleteConfirm(true);

    const confirmDelete = async () => {
        if (deleteConfirmInput !== 'EXCLUIR') {
            if (window.showToast) window.showToast("Digite 'EXCLUIR' corretamente para confirmar.", 'error');
            return;
        }
        try {
            await window._supabaseClient.from('profiles').delete().eq('id', user.id);
            await window._supabaseClient.auth.signOut();
            if (window.showToast) window.showToast('Conta excluida com sucesso.', 'success');
        } catch (err) {
            console.error('Erro ao excluir conta:', err);
            if (window.showToast) window.showToast('Erro ao excluir conta. Entre em contato com o suporte.', 'error');
        }
    };

    const handleSave = async () => {
        if (!displayName.trim()) {
            setError('O nome nao pode ficar em branco.');
            return;
        }
        setIsSaving(true);
        setError('');
        setMessage('');
        try {
            const photoUrl = photoPreview || null;
            const updateData = {
                display_name: displayName.trim(),
                avatar_color: avatarColor,
                photo_url: photoUrl,
            };
            const { error: updateError } = await window._supabaseClient
                .from('profiles')
                .update(updateData)
                .eq('id', user.id);
            if (updateError) throw updateError;
            if (window.showToast) window.showToast('Perfil atualizado com sucesso!', 'success');
            onUpdate();
            setTimeout(() => onClose(), 1500);
        } catch (err) {
            setError('Nao foi possivel atualizar o perfil. Tente novamente.');
            console.error('Erro ao atualizar perfil:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPwError('');
        setPwMessage('');
        if (newPassword !== confirmPassword) {
            setPwError('As novas senhas nao coincidem.');
            return;
        }
        if (newPassword.length < 6) {
            setPwError('A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }
        setIsSavingPw(true);
        try {
            const { error: signInErr } = await window._supabaseClient.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
            });
            if (signInErr) throw { code: 'auth/wrong-password' };
            const { error: updateErr } = await window._supabaseClient.auth.updateUser({ password: newPassword });
            if (updateErr) throw updateErr;
            setPwMessage('Senha alterada com sucesso!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPwMessage(''), 3000);
        } catch (err) {
            if (err.code === 'auth/wrong-password') {
                setPwError('A senha atual esta incorreta.');
            } else {
                setPwError('Ocorreu um erro ao alterar a senha. Tente novamente.');
                console.error('Erro ao alterar senha:', err);
            }
        } finally {
            setIsSavingPw(false);
        }
    };

    const previewUserData = { ...userData, display_name: displayName, avatar_color: avatarColor, photoURL: photoPreview };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300" onClick={onClose}>
            <div className="tjpr-bg-main border border-white/10 w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh]" onClick={e => e.stopPropagation()}>

                <div className="flex justify-between items-center p-8 border-b border-white/5 bg-white/[0.02] flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Meu Perfil</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Gerencie sua identidade digital</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                        <span className="material-icons">close</span>
                    </button>
                </div>

                <div className="flex border-b border-white/5 flex-shrink-0">
                    {[{ id: 'perfil', label: 'Perfil', icon: 'person' }, { id: 'senha', label: 'Segurança', icon: 'lock' }].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === tab.id ? 'text-tjpr-primary border-tjpr-primary' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            <span className="material-icons text-sm">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">

                    {activeTab === 'perfil' && (
                        <>
                            <div className="flex flex-col items-center gap-5">
                                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <div className="absolute inset-0 bg-tjpr-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <Avatar user={user} userData={previewUserData} size="h-28 w-28" />
                                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="material-icons text-white text-2xl">photo_camera</span>
                                    </div>
                                </div>
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                                <div className="flex gap-2 flex-wrap justify-center">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-tjpr-primary border border-tjpr-primary/30 rounded-xl hover:bg-tjpr-primary/10 transition-all flex items-center gap-1.5"
                                    >
                                        <span className="material-icons text-sm">upload</span>
                                        Subir Foto
                                    </button>
                                    {photoPreview && (
                                        <button
                                            onClick={handleRemovePhoto}
                                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-400 border border-rose-500/30 rounded-xl hover:bg-rose-500/10 transition-all flex items-center gap-1.5"
                                        >
                                            <span className="material-icons text-sm">delete</span>
                                            Remover
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-600 font-medium text-center">JPG, PNG ou GIF - Max. 2 MB | Ou escolha uma cor abaixo</p>
                                <div className="flex flex-wrap justify-center gap-3">
                                    {AVATAR_COLORS.map(color => (
                                        <button key={color} onClick={() => setAvatarColor(color)} className={`h-8 w-8 rounded-full transition-all transform hover:scale-125 hover:shadow-lg ${avatarColor === color && !photoPreview ? 'ring-2 ring-white ring-offset-4 ring-offset-slate-900 scale-110' : 'opacity-40 hover:opacity-100'}`} style={{ backgroundColor: color }}></button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <TJPRInput
                                    label="Nome Completo"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Seu nome"
                                    icon="person"
                                />
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail Institucional</label>
                                    <div className="w-full px-4 py-4 tjpr-bg-alt/50 border border-white/5 rounded-xl text-slate-400 font-bold text-sm">{user.email}</div>
                                </div>
                            </div>

                            {error && <p className="text-xs font-bold text-center text-rose-500 uppercase tracking-widest">{error}</p>}
                            {message && <p className="text-xs font-bold text-center text-emerald-500 uppercase tracking-widest">{message}</p>}

                            <div className="pt-2 space-y-3">
                                <button onClick={handleSave} disabled={isSaving} className="w-full h-14 flex justify-center items-center bg-tjpr-primary hover:opacity-90 text-white font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-tjpr-primary/20 disabled:opacity-50">
                                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                                <button onClick={handleDeleteAccount} className="w-full py-3 flex justify-center items-center text-rose-500 hover:text-rose-400 text-[10px] font-black uppercase tracking-widest transition-all">
                                    Excluir Minha Conta
                                </button>
                            </div>
                        </>
                    )}

                    {activeTab === 'senha' && (
                        <form onSubmit={handlePasswordChange} className="space-y-5">
                            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-2">
                                <span className="material-icons text-indigo-400">lock</span>
                            </div>
                            <p className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Altere sua senha de acesso</p>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Senha Atual</label>
                                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required placeholder="..." className="w-full px-4 py-3 tjpr-bg-alt/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-tjpr-primary outline-none transition text-white placeholder:text-slate-600" />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Nova Senha</label>
                                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" className="w-full px-4 py-3 tjpr-bg-alt/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-tjpr-primary outline-none transition text-white placeholder:text-slate-600" />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Confirmar Nova Senha</label>
                                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Repita a nova senha" className="w-full px-4 py-3 tjpr-bg-alt/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-tjpr-primary outline-none transition text-white placeholder:text-slate-600" />
                            </div>

                            {pwError && <p className="text-xs font-bold text-center text-rose-500 uppercase tracking-widest">{pwError}</p>}
                            {pwMessage && <p className="text-xs font-bold text-center text-emerald-500 uppercase tracking-widest">{pwMessage}</p>}

                            <button type="submit" disabled={isSavingPw} className="w-full h-14 flex justify-center items-center bg-tjpr-primary hover:opacity-90 text-white font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-tjpr-primary/20 disabled:opacity-50">
                                {isSavingPw ? 'Salvando...' : 'Alterar Senha'}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="bg-slate-900 border border-rose-500/30 w-full max-w-sm rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center mx-auto text-rose-500 mb-4">
                                <span className="material-icons text-3xl">warning</span>
                            </div>
                            <h3 className="text-xl font-black text-white tracking-tight">Excluir Conta?</h3>
                            <p className="text-xs text-slate-400 leading-relaxed font-bold">Esta acao e irreversivel. Todos os seus dados serao removidos permanentemente.</p>
                            <div className="space-y-4 pt-4">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Digite <span className="text-rose-500">EXCLUIR</span> para confirmar:</p>
                                <input type="text" value={deleteConfirmInput} onChange={e => setDeleteConfirmInput(e.target.value)} placeholder="Digite aqui..." className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-center font-black tracking-widest text-white uppercase focus:ring-2 focus:ring-rose-500 outline-none transition" />
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-400 font-bold rounded-xl transition-all">Cancelar</button>
                                    <button onClick={confirmDelete} className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl transition-all shadow-lg shadow-rose-600/20">Excluir</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
const Sidebar = ({ isOpen, setIsOpen, isCollapsed, toggleCollapse, deferredPrompt, onInstallClick }) => {
    const { user, userData, openCalendario, currentArea, setCurrentArea, isAdmin, isSetorAdmin } = useAuth();
    const { openBugReport } = useContext(BugReportContext);

    const menuItems = [
        { 
            id: 'Calculadora', 
            label: 'Calculadora', 
            icon: 'calculate',
            condition: !!(isAdmin || isSetorAdmin || userData?.role === 'intermediate')
        },
        { id: 'Minuta', label: 'Minuta de Preparo', icon: 'description' },
        { id: 'Admin', label: 'Administração', icon: 'admin_panel_settings', condition: !!(isAdmin || isSetorAdmin) },
    ];

    return (
        <>
            {/* Overlay Mobile */}
            {isOpen && <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[55] lg:hidden" onClick={() => setIsOpen(false)}></div>}

            {/* Sidebar Container */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-[60] ${isCollapsed ? 'w-20' : 'w-72'} tjpr-bg-main border-r tjpr-border-main transform transition-all duration-500 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 flex flex-col shadow-2xl`}>
                {/* Brand Section */}
                <div className={`h-24 flex items-center ${isCollapsed ? 'justify-center' : 'px-8'} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-tjpr-primary-glow to-transparent pointer-events-none"></div>
                    
                    {!isCollapsed ? (
                        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left duration-500">
                            <div className="w-10 h-10 rounded-xl tjpr-bg-alt border tjpr-border-main flex items-center justify-center backdrop-blur-md">
                                <img src="Logo.png" alt="Logo" className="h-6 w-auto tjpr-logo" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-black tracking-widest tjpr-text-main">TJPR</span>
                                <span className="text-[10px] font-bold tjpr-text-dim uppercase tracking-tighter">Módulo de Prazos</span>
                            </div>
                        </div>
                    ) : (
                        <img src="Logo.png" alt="Logo" className="h-6 w-auto tjpr-logo animate-in zoom-in duration-500" />
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
                    {!isCollapsed && <p className="px-4 text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] mb-4">Principal</p>}
                    
                    {menuItems.map(item => (
                        (item.condition !== false) && (
                            <button
                                key={item.id}
                                onClick={() => { setCurrentArea(item.id); setIsOpen(false); }}
                                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'px-4'} py-3.5 rounded-2xl transition-all duration-300 group relative ${currentArea === item.id ? 'tjpr-bg-primary text-white tjpr-shadow-primary' : 'tjpr-text-dim hover:tjpr-bg-alt hover:tjpr-text-main'}`}
                                title={isCollapsed ? item.label : ''}
                            >
                                {currentArea === item.id && (
                                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-white rounded-full"></div>
                                )}
                                <span className={`material-icons ${isCollapsed ? '' : 'mr-4'} ${currentArea === item.id ? 'text-white' : 'tjpr-text-dim group-hover:tjpr-text-primary'}`}>
                                    {item.icon}
                                </span>
                                {!isCollapsed && <span className="font-bold text-sm tracking-tight">{item.label}</span>}
                            </button>
                        )
                    ))}

                    <div className="pt-8 mt-8 border-t tjpr-border-main">
                        {!isCollapsed && <p className="px-4 text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] mb-4">Ferramentas</p>}
                        
                        <button onClick={() => { openCalendario(); setIsOpen(false); }} className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'px-4'} py-3.5 tjpr-text-dim rounded-2xl hover:tjpr-bg-alt hover:tjpr-text-main transition-all duration-300 group`} title={isCollapsed ? 'Calendário' : ''}>
                            <span className={`material-icons ${isCollapsed ? '' : 'mr-4'} tjpr-text-dim group-hover:tjpr-text-primary`}>calendar_today</span>
                            {!isCollapsed && <span className="font-bold text-sm tracking-tight">Calendário</span>}
                        </button>

                        <button onClick={() => { openBugReport(); setIsOpen(false); }} className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'px-4'} py-3.5 tjpr-text-dim rounded-2xl hover:tjpr-bg-alt hover:tjpr-text-main transition-all duration-300 group`} title={isCollapsed ? 'Reportar Problema' : ''}>
                            <span className={`material-icons ${isCollapsed ? '' : 'mr-4'} tjpr-text-dim group-hover:tjpr-text-error`}>bug_report</span>
                            {!isCollapsed && <span className="font-bold text-sm tracking-tight">Reportar Erro</span>}
                        </button>

                        {deferredPrompt && (
                            <button onClick={onInstallClick} className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'px-4'} py-3.5 text-tjpr-primary rounded-2xl bg-tjpr-primary/5 hover:bg-tjpr-primary/10 transition-all duration-300 mt-4 border border-tjpr-primary/10 group`} title={isCollapsed ? 'Instalar App' : ''}>
                                <span className={`material-icons ${isCollapsed ? '' : 'mr-4'} text-tjpr-primary`}>install_mobile</span>
                                {!isCollapsed && <span className="font-bold text-sm tracking-tight">Instalar App</span>}
                            </button>
                        )}
                    </div>
                </nav>

                {/* User Section / Collapse Toggle */}
                <div className="p-4 border-t tjpr-border-main">
                    <button
                        onClick={() => toggleCollapse()}
                        className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-4'} py-3 rounded-xl tjpr-text-dim hover:tjpr-text-main hover:tjpr-bg-alt transition-all group`}
                        title={isCollapsed ? 'Expandir' : 'Recolher'}
                    >
                        <span className="material-icons text-sm">
                            {isCollapsed ? 'last_page' : 'first_page'}
                        </span>
                        {!isCollapsed && <span className="ml-3 text-[10px] font-black uppercase tracking-widest">Recolher</span>}
                    </button>
                    
                    {!isCollapsed && (
                        <div className="mt-6 text-center">
                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">© 2026 TJPR • Assessoria</p>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
};

const TopBar = ({ onMenuClick, title }) => {
    return (
        <header className="h-16 tjpr-bg-main shadow-sm flex items-center justify-between px-4 lg:px-8 relative z-20 border-b border-white/5">
            <div className="flex items-center">
                <button onClick={onMenuClick} className="lg:hidden p-2 rounded-md tjpr-text-dim hover:tjpr-bg-alt mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <h2 className="text-xl font-bold tjpr-text-main">{title}</h2>
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
    <div className="text-xs text-slate-500 dark:text-slate-600 text-center opacity-40 hover:opacity-100 transition-opacity duration-500">
        <p className="mb-1">Desenvolvido por:</p>
        <p className="font-bold">P-SEP-AR - GESTÃO 2025/2026</p>
        <p>Assessoria de Recursos aos Tribunais Superiores (STF e STJ) da Secretaria Especial da Presidência</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 font-medium">
            <span>Elvertoni Martelli Coimbra</span>
            <span className="font-black text-slate-400">Luís Gustavo Arruda Lançoni</span>
            <span>Narley Almeida de Sousa</span>
            <span>Rodrigo Louzano</span>
        </div>
    </div>
);

const UserIDWatermark = ({ overlay = false, isSidebarCollapsed = false }) => {
    const { user, userData } = useAuth();
    if (!user) return null;
    
    // Watermark discreta de fundo (opcional, dependendo do design)
    if (overlay) {
        return (
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center select-none">
                <span className="text-[10vw] font-black text-white/[0.02] -rotate-12 uppercase whitespace-nowrap">
                    P-SEP-AR • TJPR • {user?.id?.slice(0, 8) || 'N/A'}
                </span>
            </div>
        );
    }
    
    return (
        <div className={`fixed bottom-4 text-[10px] font-bold text-slate-500 z-40 pointer-events-none transition-all duration-300 left-4 ${isSidebarCollapsed ? 'lg:left-[6rem]' : 'lg:left-[17rem]'}`}>
            <p className="opacity-50">SISTEMA P-SEP-AR • ID: {user?.id?.slice(0, 8) || 'N/A'}</p>
        </div>
    );
};

const BugReportProvider = ({ children }) => {
    const { user, userData } = useAuth();
    const [isReporting, setIsReporting] = useState(false);
    const [screenshot, setScreenshot] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);

    // Estado para guardar dados da calculadora
    const [reportData, setReportData] = useState({
        dataDisponibilizacao: '',
        isCrime: false,
        prazo: ''
    });

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

    const handleSubmitReport = async (payload) => {
        console.log("BugReportProvider: Iniciando handleSubmitReport com payload:", payload);
        
        if (!window._supabaseClient || !user || !screenshot) {
            console.error("BugReportProvider: Dependências ausentes:", { supabase: !!window._supabaseClient, user: !!user, screenshot: !!screenshot });
            if (window.showToast) window.showToast("Erro: Serviços de autenticação ou banco de dados não estão disponíveis.", "error");
            return false;
        }

        let description = '';
        let extraFields = {};

        if (typeof payload === 'string') {
            description = payload;
        } else {
            description = payload.description;
            extraFields = {
                dataDisponibilizacao: payload.dataDisponibilizacao,
                isCrime: payload.isCrime,
                prazo: payload.prazo
            };
        }

        try {
            console.log("BugReportProvider: Iniciando submissão do relatório...");
            console.log("BugReportProvider: Dados do usuário:", user ? { id: user.id, email: user.email } : "Sem usuário");

            if (!user) {
                throw new Error("Você precisa estar logado para enviar um relatório.");
            }

            const reportObj = {
                user_id: user.id,
                user_email: user.email,
                description: description,
                ...extraFields,
                screenshot_base64: screenshot,
                status: 'aberto',
                created_at: new Date().toISOString(),
                page_url: window.location.href,
                user_agent: navigator.userAgent,
            };

            console.log("BugReportProvider: Chamando supabase.from('bug_reports').insert()...");
            const { data: reportData, error: reportError } = await window._supabaseClient
                .from('bug_reports')
                .insert([reportObj])
                .select()
                .maybeSingle();

            if (reportError) throw reportError;
            console.log("BugReportProvider: Relatório salvo com sucesso no banco.");
            
            // Notificar Administradores
            try {
                console.log("BugReportProvider: Buscando administradores para notificar...");
                const { data: admins, error: adminError } = await window._supabaseClient
                    .from('profiles')
                    .select('id')
                    .in('role', ['admin', 'setor_admin']);

                if (!adminError && admins && admins.length > 0) {
                    const notifications = admins.map(admin => ({
                        user_id: admin.id,
                        title: 'Novo Chamado',
                        message: `O usuário ${user.email} abriu um chamado: ${description.substring(0, 40)}...`,
                        type: 'new_bug_report',
                        read: false,
                        related_id: reportData.id,
                        created_at: new Date().toISOString(),
                        link: '#admin?tab=bugs'
                    }));

                    const { error: notifError } = await window._supabaseClient
                        .from('notifications')
                        .insert(notifications);
                    
                    if (!notifError) console.log("BugReportProvider: Notificações enviadas aos administradores.");
                }
            } catch (notifError) {
                console.warn("BugReportProvider: Falha ao enviar notificações (não crítico):", notifError);
            }

            if (window.showToast) window.showToast('Relatório de problema enviado com sucesso! Agradecemos a sua colaboração.', 'success');
            setIsReporting(false);
            return true;
        } catch (error) {
            const errorMsg = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
            if (window.showToast) window.showToast("Erro ao enviar relatório: " + errorMsg, "error");
            return false;
        }
    };

    return (
        <BugReportContext.Provider value={{ openBugReport, reportData, setReportData }}>
            {children}
            {isReporting && screenshot && (
                <BugReportModal screenshot={screenshot} onClose={() => setIsReporting(false)} onSubmit={handleSubmitReport} />
            )}
        </BugReportContext.Provider>
    );
};

const GlobalAlert = () => {
    const [msg, setMsg] = useState(null);
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        if (!window._supabaseClient) return;
        
        const fetchAviso = async () => {
            const { data, error } = await window._supabaseClient
                .from('configuracoes')
                .select('*')
                .eq('id', 'aviso_global')
                .maybeSingle();
            
            if (!error && data && data.ativo) {
                setMsg(data);
            } else {
                setMsg(null);
            }
        };

        fetchAviso();

        const channel = window._supabaseClient
            .channel('aviso_global_changes')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'configuracoes', 
                filter: 'id=eq.aviso_global' 
            }, (payload) => {
                const data = payload.new;
                if (data && data.ativo) {
                    setMsg(data);
                } else {
                    setMsg(null);
                }
            })
            .subscribe();

        return () => {
            window._supabaseClient.removeChannel(channel);
        };
    }, []);

    // Animation every 10 minutes (600,000 ms)
    useEffect(() => {
        if (!msg) return;
        const interval = setInterval(() => {
            setAnimate(true);
            setTimeout(() => setAnimate(false), 1000); // Reset after 1s (duration of animation)
        }, 600000); // 10 minutes
        return () => clearInterval(interval);
    }, [msg]);

    if (!msg) return null;
    return <div className={`bg-indigo-600 text-white text-center py-2 px-4 font-bold text-sm shadow-md relative z-30 transition-all ${animate ? 'animate-attention' : ''}`}>{msg.mensagem}</div>;
};

const PWAInstallPrompt = ({ deferredPrompt, onInstall, isIOS, onDismiss }) => {
    if (!deferredPrompt && !isIOS) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] animate-fade-in-up">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400">
                    <span className="material-icons">install_mobile</span>
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">Instalar Prazos TJPR</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isIOS ? 'Clique em Compartilhar > Adicionar à Tela de Início' : 'Acesse mais rápido instalando como app.'}
                    </p>
                </div>
                <div className="flex gap-2">
                    {!isIOS && (
                        <button onClick={onInstall} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors">
                            Instalar
                        </button>
                    )}
                    <button onClick={onDismiss} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <span className="material-icons text-sm">close</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Componente Principal ---
/**
 * ToastNotification - Componente para notificações flutuantes (tipo Windows)
 */
const ToastNotification = ({ notification, onClose, onNotificationClick }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 6000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const getIcon = () => {
        switch(notification.type) {
            case 'bug_resolved': return 'check_circle';
            case 'new_bug_report': return 'bug_report';
            case 'global_alert': return 'campaign';
            case 'bug_reopened': return 'history';
            default: return 'notifications';
        }
    };

    const getVariant = () => {
        if (notification.type === 'bug_resolved') return 'success';
        if (notification.type === 'new_bug_report') return 'warning';
        if (notification.type === 'bug_reopened') return 'info';
        return '';
    };

    return (
        <div 
            className={`tjpr-toast ${getVariant()} group`}
            onClick={() => {
                if (onNotificationClick) {
                    onNotificationClick(notification);
                } else if (notification.link) {
                    window.location.hash = notification.link;
                }
                onClose();
            }}
        >
            <div className="tjpr-toast-glow"></div>
            <div className="tjpr-toast-icon">
                <span className="material-icons">
                    {getIcon()}
                </span>
            </div>
            <div className="tjpr-toast-content">
                <div className="tjpr-toast-title">
                    {notification.title || 'Nova Notificação'}
                </div>
                <div className="tjpr-toast-message">
                    {notification.message}
                </div>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="tjpr-toast-close"
            >
                <span className="material-icons">close</span>
            </button>
        </div>
    );
};

const App = () => {
    const { user, userData, isAdmin, loading, refreshUser, currentArea, setCurrentArea } = useAuth();
    const { settings, updateSettings } = useContext(SettingsContext);
    const [showCalendario, setShowCalendario] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showChangelog, setShowChangelog] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [adminInitialSection, setAdminInitialSection] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'primary' });
    const prevNotifsRef = React.useRef([]);

    useEffect(() => {
        if (user && adminInitialSection) {
            // Se mudou de área, garante que o adminInitialSection seja limpo depois de um tempo
        }
    }, [user, adminInitialSection]);

    useEffect(() => {
        if (!user || !window._supabaseClient) return;
        
        const fetchNotifications = async () => {
            const { data, error } = await window._supabaseClient
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .eq('read', false)
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (!error && data) {
                setNotifications(data);
                prevNotifsRef.current = data;
            }
        };

        fetchNotifications();

        const channel = window._supabaseClient
            .channel('notifications_changes')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'notifications', 
                filter: `user_id=eq.${user.id}` 
            }, (payload) => {
                const newNotif = payload.new;
                setNotifications(prev => [newNotif, ...prev]);
                if (window.showToast) {
                    window.showToast(newNotif.message, 'info');
                }
            })
            .subscribe();

        return () => {
            window._supabaseClient.removeChannel(channel);
        };
    }, [user]);

    // removeToast removido - agora gerenciado pelo TJPRToastContainer

    const handleMarkAsRead = async () => {
        if (!window._supabaseClient || !user) return;
        const { error } = await window._supabaseClient
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user.id)
            .eq('read', false);
        
        if (!error) {
            setNotifications([]);
        }
    };

    const handleNotificationClick = async (notif) => {
        // Marca como lida
        if (!notif.read) {
            await window._supabaseClient
                .from('notifications')
                .update({ read: true })
                .eq('id', notif.id);
        }

        // Navegação baseada no tipo
        if (notif.type === 'new_bug_report') {
            console.log("handleNotificationClick: Direcionando para chamados");
            setAdminInitialSection({ view: 'chamados', ts: Date.now() });
            setCurrentArea('Admin');
            setShowNotifications(false);
        } else if (notif.link) {
            console.log(`handleNotificationClick: Direcionando para link ${notif.link}`);
            window.location.hash = notif.link;
            setShowNotifications(false);
        }
    };

    useEffect(() => {
        // Detecta iOS
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        if (isIOSDevice && !isStandalone) {
            setIsIOS(true);
            const dismissed = localStorage.getItem('pwa_prompt_dismissed');
            if (!dismissed) setShowInstallPrompt(true);
        }

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            const dismissed = localStorage.getItem('pwa_prompt_dismissed');
            if (!dismissed) setShowInstallPrompt(true);
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
            setShowInstallPrompt(false);
        }
    };

    const dismissInstallPrompt = () => {
        setShowInstallPrompt(false);
        localStorage.setItem('pwa_prompt_dismissed', 'true');
    };

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
        if (user && window._supabaseClient) {
            const checkChangelog = async () => {
                const lastSeenVersion = localStorage.getItem('lastSeenChangelogVersion');
                const { data, error } = await window._supabaseClient
                    .from('changelog')
                    .select('id')
                    .order('date', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (!error && data) {
                    if (data.id !== lastSeenVersion) {
                        setShowChangelog(true);
                    }
                }
            };
            checkChangelog();
        }
    }, [user]);



    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest text-[10px] animate-pulse">Iniciando Sistema...</p>
            </div>
        );
    }

    // Se não houver usuário, exibe a página de login em tela cheia.
    if (!user) {
        return <TJPRLoginPage />;
    }

    // Se o e-mail não for verificado, exibe a página de verificação.
    // No Supabase, verificamos 'email_confirmed_at'.
    // A verificação do userData (profiles table) permite override pelo admin.
    const isVerified = !!(user?.email_confirmed_at || userData?.emailVerified);
    if (!isVerified) {
        return <VerifyEmailPage />;
    }

    // Se o usuário estiver logado e verificado, exibe a aplicação principal.
    return (
        <div id="app-wrapper" className="h-screen h-[100dvh] flex bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-200 transition-colors duration-500">
            <Sidebar
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                isCollapsed={isSidebarCollapsed}
                toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                deferredPrompt={deferredPrompt}
                onInstallClick={handleInstallClick}
            />

            <div className="flex-1 flex flex-col overflow-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none"></div>
                
                <GlobalAlert />
                
                <TJPRHeader
                    user={userData}
                    onLogout={async () => {
                        if (window._supabaseClient) {
                            await window._supabaseClient.auth.signOut();
                        }
                    }}
                    onToggleDarkMode={() => {
                        const cycle = { 'light': 'dark', 'dark': 'system', 'system': 'light' };
                        const next = cycle[settings.theme] || 'dark';
                        updateSettings({ theme: next });
                    }}
                    theme={settings.theme}
                    onOpenProfile={() => setShowProfile(true)}
                    currentArea={currentArea}
                    onNavigate={(area) => setCurrentArea(area)}
                    isAdmin={userData?.role === 'admin' || userData?.role === 'setor_admin'}
                    notifications={notifications}
                    onToggleNotifications={() => setShowNotifications(!showNotifications)}
                />

                <NotificationsPanel
                    notifications={notifications}
                    onMarkAsRead={handleMarkAsRead}
                    isOpen={showNotifications}
                    onClose={() => setShowNotifications(false)}
                    onNotificationClick={handleNotificationClick}
                />

                <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12 custom-scrollbar relative z-10">
                    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {currentArea === 'Calculadora' && (isAdmin || isSetorAdmin || userData?.role === 'intermediate') ? (
                            <CalculatorApp />
                        ) : currentArea === 'Minuta' ? (
                            <MinutaPreparoPage />
                        ) : currentArea === 'Admin' && (isAdmin || isSetorAdmin) ? (
                            <AdminPage 
                                setCurrentArea={setCurrentArea} 
                                initialSection={adminInitialSection}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                                <span className="material-icons text-6xl text-slate-700 mb-4">explore_off</span>
                                <h2 className="text-2xl font-black text-white mb-2">Área Desconhecida</h2>
                                <p className="text-slate-500 max-w-md mx-auto">A página que você está tentando acessar não existe ou você não tem permissão para visualizá-la.</p>
                                <button 
                                    onClick={() => setCurrentArea(isAdmin || isSetorAdmin || userData?.role === 'intermediate' ? 'Calculadora' : 'Minuta')} 
                                    className="mt-8 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                                >
                                    Voltar para o Início
                                </button>
                            </div>
                        )}
                        
                        <footer className="mt-16 border-t border-white/5 pt-8 pb-12">
                            <CreditsWatermark />
                        </footer>
                    </div>
                </main>
            </div>

            {showCalendario && <CalendarioModal onClose={() => setShowCalendario(false)} />}
            {showProfile && <ProfileModal user={user} userData={userData} onClose={() => setShowProfile(false)} onUpdate={refreshUser} />}
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
            {showPrivacyPolicy && <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} />}
            {showInstallPrompt && (
                <PWAInstallPrompt
                    deferredPrompt={deferredPrompt}
                    onInstall={handleInstallClick}
                    isIOS={isIOS}
                    onDismiss={dismissInstallPrompt}
                />
            )}
            <CookieConsent />
            <UserIDWatermark isSidebarCollapsed={isSidebarCollapsed} />

            {/* Sistema de Feedback Moderno (Monolith Elite) */}
            <TJPRToastContainer />
            
            <TJPRConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={() => {
                    if (confirmModal.onConfirm) confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                variant={confirmModal.variant}
            />
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
