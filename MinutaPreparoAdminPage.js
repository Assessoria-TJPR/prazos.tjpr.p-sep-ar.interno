/**
 * @file MinutaPreparoAdminPage.js
 * Editor visual da árvore de decisão da Minuta de Preparo Recursal.
 * Padrão Monolith Elite — variáveis tjpr-*.
 */

const MinutaPreparoAdminPage = () => {
    const [flow, setFlow] = React.useState(null);
    const [selectedStepId, setSelectedStepId] = React.useState(null);
    const [saving, setSaving] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [previewMode, setPreviewMode] = React.useState(false);
    const [newStepId, setNewStepId] = React.useState('');
    const [showNewStepInput, setShowNewStepInput] = React.useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = React.useState(null);

    // ── Carregamento ──────────────────────────────────────────────────────────
    React.useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const { data, error } = await window._supabaseClient
                    .from('configuracoes')
                    .select('data')
                    .eq('id', 'minuta_preparo_fluxo')
                    .maybeSingle();

                if (error) throw error;

                const source = (data && data.data) ? data.data : (window.MINUTA_PREPARO_FLUXO || {});
                // Normaliza: o fluxo pode estar em .steps ou direto
                const steps = source.steps || source;
                setFlow(steps);
                const firstKey = Object.keys(steps)[0];
                if (firstKey) setSelectedStepId(firstKey);
            } catch (err) {
                console.error('Erro ao carregar fluxo:', err);
                const fallback = window.MINUTA_PREPARO_FLUXO || {};
                const steps = fallback.steps || fallback;
                setFlow(steps);
                const firstKey = Object.keys(steps)[0];
                if (firstKey) setSelectedStepId(firstKey);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // ── Salvar ────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await window._supabaseClient
                .from('configuracoes')
                .upsert({
                    id: 'minuta_preparo_fluxo',
                    data: flow,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            window.showToast?.('Fluxo de Preparo salvo com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao salvar:', err);
            window.showToast?.('Erro ao salvar: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Resetar para o fluxo estático ─────────────────────────────────────────
    const handleReset = () => {
        if (!window.confirm('Isso irá restaurar o fluxo padrão do arquivo local, descartando alterações salvas no banco. Confirmar?')) return;
        const fallback = window.MINUTA_PREPARO_FLUXO || {};
        const steps = fallback.steps || fallback;
        setFlow(steps);
        const firstKey = Object.keys(steps)[0];
        if (firstKey) setSelectedStepId(firstKey);
        window.showToast?.('Fluxo restaurado para o padrão local.', 'info');
    };

    // ── Manipulação do passo selecionado ─────────────────────────────────────
    const updateStep = (field, value) => {
        setFlow(prev => ({
            ...prev,
            [selectedStepId]: { ...prev[selectedStepId], [field]: value }
        }));
    };

    const updateOption = (optIndex, field, value) => {
        setFlow(prev => {
            const step = { ...prev[selectedStepId] };
            const opcoes = [...(step.opcoes || step.options || [])];
            opcoes[optIndex] = { ...opcoes[optIndex], [field]: value };
            // Normaliza sempre para 'opcoes'
            return { ...prev, [selectedStepId]: { ...step, opcoes, options: undefined } };
        });
    };

    const addOption = () => {
        setFlow(prev => {
            const step = { ...prev[selectedStepId] };
            const opcoes = [...(step.opcoes || step.options || []), { texto: 'Nova opção', proximo: 'final', snippet: '' }];
            return { ...prev, [selectedStepId]: { ...step, opcoes, options: undefined } };
        });
    };

    const removeOption = (optIndex) => {
        setFlow(prev => {
            const step = { ...prev[selectedStepId] };
            const opcoes = (step.opcoes || step.options || []).filter((_, i) => i !== optIndex);
            return { ...prev, [selectedStepId]: { ...step, opcoes, options: undefined } };
        });
    };

    const moveOption = (optIndex, dir) => {
        setFlow(prev => {
            const step = { ...prev[selectedStepId] };
            const opcoes = [...(step.opcoes || step.options || [])];
            const target = optIndex + dir;
            if (target < 0 || target >= opcoes.length) return prev;
            [opcoes[optIndex], opcoes[target]] = [opcoes[target], opcoes[optIndex]];
            return { ...prev, [selectedStepId]: { ...step, opcoes, options: undefined } };
        });
    };

    // ── Criar novo passo ──────────────────────────────────────────────────────
    const handleCreateStep = () => {
        const id = newStepId.trim().toLowerCase().replace(/\s+/g, '_');
        if (!id) return;
        if (flow[id]) { window.showToast?.('ID já existe!', 'error'); return; }
        setFlow(prev => ({
            ...prev,
            [id]: { pergunta: 'Nova pergunta', opcoes: [] }
        }));
        setSelectedStepId(id);
        setNewStepId('');
        setShowNewStepInput(false);
    };

    // ── Excluir passo ─────────────────────────────────────────────────────────
    const handleDeleteStep = (stepId) => {
        setFlow(prev => {
            const next = { ...prev };
            delete next[stepId];
            return next;
        });
        const keys = Object.keys(flow).filter(k => k !== stepId);
        setSelectedStepId(keys[0] || null);
        setDeleteConfirmId(null);
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const isFinalOption = (opt) => {
        const next = opt.proximo || opt.nextStep;
        return !next || next === 'final';
    };

    const allStepIds = flow ? Object.keys(flow) : [];

    const getStepUsageCount = (stepId) => {
        if (!flow) return 0;
        let count = 0;
        Object.values(flow).forEach(step => {
            (step.opcoes || step.options || []).forEach(opt => {
                if ((opt.proximo || opt.nextStep) === stepId) count++;
            });
        });
        return count;
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                <p className="tjpr-text-dim font-black uppercase tracking-widest text-[10px]">Carregando Árvore de Decisão...</p>
            </div>
        );
    }

    const selectedStep = flow && selectedStepId ? flow[selectedStepId] : null;
    const selectedOpcoes = selectedStep ? (selectedStep.opcoes || selectedStep.options || []) : [];

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="tjpr-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                        <span className="material-icons text-purple-400 text-2xl">account_tree</span>
                    </div>
                    <div>
                        <h3 className="font-black text-lg tjpr-text-main uppercase tracking-widest">Árvore de Decisão</h3>
                        <p className="text-[10px] font-bold tjpr-text-dim uppercase tracking-widest">
                            {allStepIds.length} passos configurados
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 tjpr-bg-alt border tjpr-border-main rounded-xl text-[10px] font-black tjpr-text-dim uppercase tracking-widest tjpr-bg-hover transition-all"
                    >
                        <span className="material-icons text-sm">restore</span>
                        Restaurar Padrão
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-60"
                    >
                        <span className={`material-icons text-sm ${saving ? 'animate-spin' : ''}`}>{saving ? 'sync' : 'save'}</span>
                        {saving ? 'Salvando...' : 'Salvar Fluxo'}
                    </button>
                </div>
            </div>

            {/* ── Layout Principal ── */}
            <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">

                {/* ── PAINEL ESQUERDO: Lista de Passos ── */}
                <div className="tjpr-card overflow-hidden flex flex-col" style={{maxHeight: '80vh'}}>
                    <div className="px-5 py-4 border-b tjpr-border-main tjpr-bg-alt flex items-center justify-between shrink-0">
                        <h4 className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em]">Passos do Fluxo</h4>
                        <button
                            onClick={() => setShowNewStepInput(v => !v)}
                            className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center hover:bg-indigo-500/20 transition-colors"
                            title="Novo passo"
                        >
                            <span className="material-icons text-sm">add</span>
                        </button>
                    </div>

                    {showNewStepInput && (
                        <div className="px-4 py-3 border-b tjpr-border-main tjpr-bg-alt flex gap-2 shrink-0">
                            <input
                                type="text"
                                value={newStepId}
                                onChange={e => setNewStepId(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateStep()}
                                placeholder="id_do_passo"
                                className="flex-1 px-3 py-1.5 tjpr-bg-main border tjpr-border-main rounded-lg text-xs font-mono tjpr-text-main focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button onClick={handleCreateStep} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-black hover:bg-indigo-700 transition-colors">OK</button>
                        </div>
                    )}

                    <div className="overflow-y-auto flex-1 divide-y tjpr-border-main">
                        {allStepIds.map((stepId, idx) => {
                            const step = flow[stepId];
                            const opcoes = step.opcoes || step.options || [];
                            const hasFinal = opcoes.some(isFinalOption);
                            const hasNext = opcoes.some(o => !isFinalOption(o));
                            const isSelected = stepId === selectedStepId;
                            const usage = getStepUsageCount(stepId);
                            const isEntry = idx === 0;

                            return (
                                <div
                                    key={stepId}
                                    onClick={() => setSelectedStepId(stepId)}
                                    className={`px-4 py-3 cursor-pointer transition-colors relative group ${isSelected ? 'bg-indigo-600/10 border-l-2 border-indigo-500' : 'tjpr-bg-hover border-l-2 border-transparent'}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {isEntry && (
                                                    <span className="text-[8px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">INÍCIO</span>
                                                )}
                                                <span className="text-[10px] font-black font-mono tjpr-text-dim truncate">{stepId}</span>
                                            </div>
                                            <p className="text-xs font-bold tjpr-text-main truncate leading-tight">{step.pergunta || step.question || '—'}</p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-[9px] tjpr-text-dim font-bold">{opcoes.length} opç.</span>
                                                {hasFinal && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Tem opções finais"></span>}
                                                {hasNext && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Tem opções intermediárias"></span>}
                                                {usage > 0 && (
                                                    <span className="text-[9px] font-bold tjpr-text-dim">← {usage}</span>
                                                )}
                                            </div>
                                        </div>
                                        {deleteConfirmId === stepId ? (
                                            <div className="flex gap-1 shrink-0">
                                                <button onClick={e => { e.stopPropagation(); handleDeleteStep(stepId); }} className="text-[9px] font-black text-red-400 px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 transition-colors">SIM</button>
                                                <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(null); }} className="text-[9px] font-black tjpr-text-dim px-2 py-1 rounded tjpr-bg-alt hover:opacity-80 transition-colors">NÃO</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={e => { e.stopPropagation(); setDeleteConfirmId(stepId); }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center shrink-0"
                                            >
                                                <span className="material-icons text-sm">delete</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── PAINEL DIREITO: Editor do Passo ── */}
                {selectedStep ? (
                    <div className="space-y-5">
                        {/* Cabeçalho do passo */}
                        <div className="tjpr-card p-6 space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded-lg">{selectedStepId}</span>
                                <span className="material-icons text-xs tjpr-text-dim">chevron_right</span>
                                <span className="text-[10px] font-black tjpr-text-dim uppercase tracking-widest">Editando passo</span>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] mb-2">Pergunta exibida ao usuário</label>
                                <textarea
                                    value={selectedStep.pergunta || selectedStep.question || ''}
                                    onChange={e => updateStep('pergunta', e.target.value)}
                                    rows="2"
                                    className="w-full px-4 py-3 tjpr-bg-alt border tjpr-border-main rounded-xl text-sm font-bold tjpr-text-main focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none"
                                    placeholder="Ex: Qual o tipo de recurso excepcional em análise?"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] mb-2">Descrição / subtítulo (opcional)</label>
                                <input
                                    type="text"
                                    value={selectedStep.descricao || selectedStep.description || ''}
                                    onChange={e => updateStep('descricao', e.target.value)}
                                    className="w-full px-4 py-3 tjpr-bg-alt border tjpr-border-main rounded-xl text-sm tjpr-text-main focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                    placeholder="Texto adicional exibido abaixo da pergunta..."
                                />
                            </div>
                        </div>

                        {/* Opções */}
                        <div className="tjpr-card overflow-hidden">
                            <div className="px-6 py-4 border-b tjpr-border-main tjpr-bg-alt flex items-center justify-between">
                                <div>
                                    <h4 className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em]">Opções de Resposta</h4>
                                    <p className="text-[9px] tjpr-text-dim font-bold mt-0.5">{selectedOpcoes.length} opção(ões) configurada(s)</p>
                                </div>
                                <button
                                    onClick={addOption}
                                    className="flex items-center gap-2 px-4 py-2 border border-dashed border-indigo-400/40 text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-400/70 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    <span className="material-icons text-sm">add</span>
                                    Adicionar Opção
                                </button>
                            </div>

                            <div className="p-4 space-y-3">
                                {selectedOpcoes.length === 0 && (
                                    <div className="text-center py-10 tjpr-bg-alt rounded-2xl border tjpr-border-main">
                                        <span className="material-icons text-3xl tjpr-text-dim mb-2 block">list</span>
                                        <p className="text-xs font-bold tjpr-text-dim">Nenhuma opção. Clique em "Adicionar Opção".</p>
                                    </div>
                                )}

                                {selectedOpcoes.map((opt, idx) => {
                                    const isFinal = isFinalOption(opt);
                                    const nextStep = opt.proximo || opt.nextStep || 'final';
                                    return (
                                        <div key={idx} className={`p-4 rounded-2xl border transition-all ${isFinal ? 'border-amber-500/20 bg-amber-500/5' : 'border-blue-500/20 bg-blue-500/5'}`}>
                                            {/* Header da opção */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${isFinal ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'}`}>
                                                        {isFinal ? '⬛ FINAL' : '➡ INTERMEDIÁRIA'}
                                                    </span>
                                                    <span className="text-[9px] font-bold tjpr-text-dim">Opção {idx + 1}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => moveOption(idx, -1)} disabled={idx === 0} className="w-6 h-6 rounded flex items-center justify-center tjpr-text-dim hover:tjpr-text-main disabled:opacity-30 transition-colors">
                                                        <span className="material-icons text-sm">arrow_upward</span>
                                                    </button>
                                                    <button onClick={() => moveOption(idx, 1)} disabled={idx === selectedOpcoes.length - 1} className="w-6 h-6 rounded flex items-center justify-center tjpr-text-dim hover:tjpr-text-main disabled:opacity-30 transition-colors">
                                                        <span className="material-icons text-sm">arrow_downward</span>
                                                    </button>
                                                    <button onClick={() => removeOption(idx)} className="w-6 h-6 rounded flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1">
                                                        <span className="material-icons text-sm">close</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Campos da opção */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="md:col-span-2">
                                                    <label className="block text-[9px] font-black tjpr-text-dim uppercase tracking-widest mb-1">Texto da opção</label>
                                                    <input
                                                        type="text"
                                                        value={opt.texto || opt.label || ''}
                                                        onChange={e => updateOption(idx, 'texto', e.target.value)}
                                                        className="w-full px-3 py-2 tjpr-bg-main border tjpr-border-main rounded-lg text-xs font-bold tjpr-text-main focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                                        placeholder="Texto exibido ao usuário..."
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[9px] font-black tjpr-text-dim uppercase tracking-widest mb-1">
                                                        Próximo passo <span className="text-amber-400">(ou "final")</span>
                                                    </label>
                                                    <div className="relative">
                                                        <select
                                                            value={nextStep}
                                                            onChange={e => updateOption(idx, 'proximo', e.target.value)}
                                                            className="w-full px-3 py-2 tjpr-bg-main border tjpr-border-main rounded-lg text-xs font-bold tjpr-text-main focus:ring-2 focus:ring-indigo-500 outline-none transition appearance-none pr-8 cursor-pointer"
                                                        >
                                                            <option value="final">⬛ final (gera minuta)</option>
                                                            {allStepIds.filter(id => id !== selectedStepId).map(id => (
                                                                <option key={id} value={id}>➡ {id}</option>
                                                            ))}
                                                        </select>
                                                        <span className="material-icons absolute right-2 top-1/2 -translate-y-1/2 text-sm tjpr-text-dim pointer-events-none">expand_more</span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[9px] font-black tjpr-text-dim uppercase tracking-widest mb-1">
                                                        Snippet / ID do template {isFinal && <span className="text-amber-400">*</span>}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={opt.snippet || opt.templateId || ''}
                                                        onChange={e => updateOption(idx, 'snippet', e.target.value)}
                                                        className="w-full px-3 py-2 tjpr-bg-main border tjpr-border-main rounded-lg text-xs font-mono tjpr-text-main focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                                        placeholder={isFinal ? "Texto ou ID da tabela minutas..." : "Texto descritivo (opcional)"}
                                                    />
                                                    {isFinal && (
                                                        <p className="text-[9px] tjpr-text-dim mt-1">
                                                            * Busca na tabela <code className="font-mono">minutas</code> como <code className="font-mono">id</code>. Se não achar, usa este texto diretamente.
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="md:col-span-2">
                                                    <label className="block text-[9px] font-black tjpr-text-dim uppercase tracking-widest mb-1">Ícone Material (opcional)</label>
                                                    <input
                                                        type="text"
                                                        value={opt.icon || ''}
                                                        onChange={e => updateOption(idx, 'icon', e.target.value)}
                                                        className="w-full px-3 py-2 tjpr-bg-main border tjpr-border-main rounded-lg text-xs font-mono tjpr-text-main focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                                        placeholder="Ex: gavel, description, chevron_right"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Dica referências */}
                        <div className="flex items-start gap-3 p-4 bg-purple-500/5 border border-purple-500/15 rounded-2xl">
                            <span className="material-icons text-purple-400 text-lg shrink-0 mt-0.5">info</span>
                            <div>
                                <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Como funciona o fluxo</p>
                                <p className="text-[10px] font-bold tjpr-text-dim leading-relaxed">
                                    O wizard começa pelo primeiro passo da lista (<code className="font-mono text-purple-300">inicio</code>). Opções com "Próximo passo = final" encerram o fluxo e carregam a minuta pelo <em>snippet</em>. Os demais navegam para outro passo.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="tjpr-card flex flex-col items-center justify-center py-20 text-center">
                        <span className="material-icons text-4xl tjpr-text-dim mb-4">account_tree</span>
                        <p className="font-black tjpr-text-main mb-1">Selecione um passo</p>
                        <p className="text-xs tjpr-text-dim">Clique em um passo na lista ao lado para editar suas perguntas e opções.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

window.MinutaPreparoAdminPage = MinutaPreparoAdminPage;
