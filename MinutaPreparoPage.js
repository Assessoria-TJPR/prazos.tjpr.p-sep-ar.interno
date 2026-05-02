/**
 * @file MinutaPreparoPage.js
 * Componente do Gerador de Minutas de Preparo Recursal
 */

const { useState, useEffect, useRef } = React;

const MinutaPreparoPage = () => {
    const [currentStepId, setCurrentStepId] = useState('inicio');
    const [history, setHistory] = useState([]);
    const [selectedOptions, setSelectedOptions] = useState({});
    const [template, setTemplate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [flowData, setFlowData] = useState(null);
    const [isFetchingFlow, setIsFetchingFlow] = useState(true);

    // Efeito para carregar o fluxo do Supabase
    useEffect(() => {
        const fetchFlow = async () => {
            try {
                setIsFetchingFlow(true);
                if (window._supabaseClient) {
                    const { data, error: sbError } = await window._supabaseClient
                        .from('configuracoes')
                        .select('data')
                        .eq('id', 'minuta_preparo_fluxo')
                        .maybeSingle();

                    if (sbError) throw sbError;
                    
                    if (data && data.data) {
                        setFlowData(data.data);
                    } else {
                        // Fallback para estático
                        setFlowData(window.MINUTA_PREPARO_FLUXO);
                    }
                } else {
                    setFlowData(window.MINUTA_PREPARO_FLUXO);
                }
            } catch (err) {
                console.error('Erro ao carregar fluxo:', err);
                setFlowData(window.MINUTA_PREPARO_FLUXO);
            } finally {
                setIsFetchingFlow(false);
            }
        };

        fetchFlow();
    }, []);

    const handleOptionSelect = async (option) => {
        const newHistory = [...history, currentStepId];
        // Mapeia texto para label se necessário
        const label = option.texto || option.label;
        const newSelectedOptions = { ...selectedOptions, [currentStepId]: label };
        
        setHistory(newHistory);
        setSelectedOptions(newSelectedOptions);

        const proximo = option.proximo || option.nextStep;
        
        if (proximo && proximo !== 'final') {
            setCurrentStepId(proximo);
        } else {
            // Se proximo for 'final' ou não houver próximo, carregamos o resultado
            // Usamos o snippet/templateId para carregar do banco
            const templateId = option.templateId || option.snippet || currentStepId;
            await loadTemplate(templateId, option.snippet);
            setCurrentStepId('resultado');
        }
    };

    const loadTemplate = async (templateId, fallbackContent) => {
        setIsLoading(true);
        setError(null);
        try {
            // Tenta buscar do Supabase
            if (window._supabaseClient) {
                const { data, error: sbError } = await window._supabaseClient
                    .from('minutas') // Tabela correta conforme esquema
                    .select('conteudo')
                    .eq('id', templateId)
                    .single();

                if (sbError) {
                    console.warn('Template não encontrado no banco, usando snippet local:', sbError.message);
                    setTemplate(fallbackContent || 'Modelo em desenvolvimento.');
                } else if (data) {
                    setTemplate(data.conteudo);
                } else {
                    setTemplate(fallbackContent || 'Nenhum conteúdo disponível.');
                }
            } else {
                // Se não houver Supabase, usa o snippet local
                setTemplate(fallbackContent || 'Supabase não inicializado.');
            }
        } catch (err) {
            console.error('Erro ao carregar template:', err);
            setTemplate(fallbackContent || 'Erro ao carregar modelo.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        if (history.length > 0) {
            const lastStep = history[history.length - 1];
            setHistory(history.slice(0, -1));
            setCurrentStepId(lastStep);
            setTemplate('');
            setError(null);
        }
    };

    const handleReset = () => {
        setCurrentStepId('inicio');
        setHistory([]);
        setSelectedOptions({});
        setTemplate('');
        setError(null);
    };

    const handleCopy = () => {
        const textArea = document.createElement('textarea');
        textArea.value = template;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
            if (window.showToast) window.showToast('Copiado para a área de transferência!', 'success');
        } catch (err) {
            console.error('Erro ao copiar:', err);
        }
        document.body.removeChild(textArea);
    };

    const renderStep = () => {
        if (isFetchingFlow) {
            return (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
                    <p className="tjpr-text-dim font-black uppercase tracking-widest text-[10px]">Configurando Árvore de Decisão...</p>
                </div>
            );
        }

        // Normalização do fluxo de dados (pode vir como objeto direto ou dentro de .steps)
        const steps = flowData?.steps || flowData;
        
        // Proteção contra steps indefinido ou nulo
        if (!steps || typeof steps !== 'object') {
            return (
                <div className="flex flex-col items-center justify-center py-10">
                    <span className="material-icons text-rose-500 text-4xl mb-4">error_outline</span>
                    <p className="tjpr-text-dim font-bold">Erro: Estrutura do fluxo inválida.</p>
                    <TJPRButton variant="ghost" onClick={handleReset} className="mt-4">Recomeçar</TJPRButton>
                </div>
            );
        }

        const currentStep = steps[currentStepId];

        if (!flowData || isFetchingFlow) {
            return (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
                    <p className="tjpr-text-dim font-black uppercase tracking-widest text-[10px]">Sincronizando Base de Dados...</p>
                </div>
            );
        }

        if (!currentStep) return (
            <div className="text-center py-10">
                <p className="text-rose-400 font-bold">Passo "{currentStepId}" não encontrado no fluxo.</p>
                <TJPRButton variant="ghost" onClick={handleReset} className="mt-4">Recomeçar</TJPRButton>
            </div>
        );

        const question = currentStep.pergunta || currentStep.question;
        const options = currentStep.opcoes || currentStep.options || [];

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-black tjpr-text-main mb-2 tracking-tight">
                        {question}
                    </h2>
                    {(currentStep.descricao || currentStep.description) && (
                        <p className="tjpr-text-dim text-sm font-medium">
                            {currentStep.descricao || currentStep.description}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {options.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => handleOptionSelect(option)}
                            className="tjpr-card p-6 text-left tjpr-bg-hover transition-all border tjpr-border-main group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                                    <span className="material-icons text-indigo-400">
                                        {option.icon || 'chevron_right'}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-lg font-bold tjpr-text-main group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors leading-tight">
                                        {option.texto || option.label}
                                    </h4>
                                    {(option.snippet || option.description) && (
                                        <p className="text-[10px] tjpr-text-dim mt-2 uppercase tracking-wider font-semibold opacity-80 group-hover:opacity-100 transition-opacity">
                                            {option.snippet || option.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {history.length > 0 && (
                    <div className="flex justify-center mt-8">
                        <TJPRButton variant="ghost" icon="arrow_back" onClick={handleBack}>
                            Voltar
                        </TJPRButton>
                    </div>
                )}
            </div>
        );
    };

    const renderResult = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                    <p className="tjpr-text-dim font-bold uppercase tracking-widest text-xs">
                        Gerando Minuta...
                    </p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="text-center py-10 space-y-6">
                    <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto">
                        <span className="material-icons text-rose-500 text-4xl">error_outline</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-black tjpr-text-main mb-2">Ops! Ocorreu um erro</h3>
                        <p className="tjpr-text-dim max-w-md mx-auto">{error}</p>
                    </div>
                    <TJPRButton variant="primary" onClick={handleReset}>
                        Tentar Novamente
                    </TJPRButton>
                </div>
            );
        }

        return (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between border-b tjpr-border-main pb-4">
                    <h3 className="text-xl font-black tjpr-text-main tracking-tight">Minuta Gerada</h3>
                    <div className="flex gap-2">
                        <TJPRButton variant="ghost" icon="refresh" onClick={handleReset}>
                            Recomeçar
                        </TJPRButton>
                        <TJPRButton variant="success" icon={copySuccess ? 'check' : 'content_copy'} onClick={handleCopy}>
                            {copySuccess ? 'Copiado!' : 'Copiar Texto'}
                        </TJPRButton>
                    </div>
                </div>

                <div className="tjpr-card p-0 overflow-hidden tjpr-bg-alt border tjpr-border-main">
                    <div className="p-8 font-serif tjpr-text-main leading-relaxed text-lg min-h-[400px] whitespace-pre-wrap select-text selection:bg-indigo-500/30">
                        {template || 'Nenhum conteúdo gerado.'}
                    </div>
                </div>

                <div className="flex justify-between items-center bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10">
                    <div className="flex items-center gap-3">
                        <span className="material-icons text-indigo-400">info</span>
                        <p className="text-xs text-indigo-300 font-medium">
                            A minuta foi gerada com base nas suas seleções. Revise os dados antes de utilizar.
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <TJPRCard 
                title="Gerador de Minutas" 
                subtitle="Preparo Recursal - Wizard de Auxílio"
                icon="description"
                className="mb-8"
            >
                {currentStepId === 'resultado' ? renderResult() : renderStep()}
            </TJPRCard>

            {/* Breadcrumbs/Progress */}
            {history.length > 0 && currentStepId !== 'resultado' && (
                <div className="flex flex-wrap gap-2 justify-center mt-4 opacity-50">
                    {history.map((stepId, index) => (
                        <React.Fragment key={stepId}>
                            <span className="text-[10px] font-bold tjpr-text-dim uppercase">
                                {selectedOptions[stepId]}
                            </span>
                            {index < history.length - 1 && (
                                <span className="material-icons text-xs tjpr-text-dim">chevron_right</span>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
};

window.MinutaPreparoPage = MinutaPreparoPage;
