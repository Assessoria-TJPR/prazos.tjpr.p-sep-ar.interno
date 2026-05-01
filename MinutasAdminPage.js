/**
 * @file MinutasAdminPage.js
 * Página administrativa para gerenciamento de modelos de minutas por setor.
 * Modernizada para o padrão Monolith Elite.
 */

const MinutasAdminPage = () => {
    const { user, userData } = useAuth();
    const [setores, setSetores] = React.useState([]);
    const [selectedSetor, setSelectedSetor] = React.useState(null);
    const [minutas, setMinutas] = React.useState({});
    const [minutaStyles, setMinutaStyles] = React.useState({});
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Estados para Modais Customizados
    const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
    const [newMinutaName, setNewMinutaName] = React.useState('');
    const [minutaToDelete, setMinutaToDelete] = React.useState(null);

    const baseTiposMinuta = [
        { id: 'intempestividade', nome: 'Intempestividade', icon: 'gavel' },
        { id: 'intimacao_decreto', nome: 'Intimação Decreto (Cível)', icon: 'description' },
        { id: 'intimacao_decreto_crime', nome: 'Intimação Decreto (Crime)', icon: 'security' },
        { id: 'falta_decreto', nome: 'Falta de Comprovação', icon: 'history_edu' }
    ];
    const [tiposMinuta, setTiposMinuta] = React.useState(baseTiposMinuta);
    const [activeTipoId, setActiveTipoId] = React.useState(baseTiposMinuta[0].id);

    React.useEffect(() => {
        fetchSetores();
        
        // Carregar tipos customizados do Supabase
        const fetchTipos = async () => {
            try {
                const { data, error } = await window._supabaseClient
                    .from('configuracoes')
                    .select('data')
                    .eq('id', 'minutas')
                    .maybeSingle();

                if (error) throw error;
                if (data && data.data && data.data.tipos) {
                    const customTypes = data.data.tipos.filter(t => t.id !== 'exemplo_didatico');
                    setTiposMinuta([...baseTiposMinuta, ...customTypes]);
                } else {
                    setTiposMinuta(baseTiposMinuta);
                }
            } catch (err) {
                console.error("Erro ao carregar tipos de minuta:", err);
            }
        };

        fetchTipos();

        // Inscrição em tempo real para mudanças nas configurações
        const channel = window._supabaseClient
            .channel('config_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes', filter: 'id=eq.minutas' }, (payload) => {
                if (payload.new && payload.new.data && payload.new.data.tipos) {
                    const customTypes = payload.new.data.tipos.filter(t => t.id !== 'exemplo_didatico');
                    setTiposMinuta([...baseTiposMinuta, ...customTypes]);
                }
            })
            .subscribe();

        return () => {
            window._supabaseClient.removeChannel(channel);
        };
    }, []);

    React.useEffect(() => {
        if (selectedSetor) {
            fetchMinutas(selectedSetor.id);
        }
    }, [selectedSetor, tiposMinuta]);

    const fetchSetores = async () => {
        try {
            setLoading(true);
            const { data, error } = await window._supabaseClient
                .from('setores')
                .select('*')
                .order('nome');
            
            if (error) throw error;
            
            setSetores(data);
            
            if (userData?.setorId) {
                const userSetor = data.find(s => s.id === userData.setorId);
                if (userSetor) setSelectedSetor(userSetor);
            } else if (data.length > 0) {
                setSelectedSetor(data[0]);
            }
        } catch (error) {
            console.error("Erro ao buscar setores:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMinutas = async (setorId) => {
        try {
            setLoading(true);
            const { data, error } = await window._supabaseClient
                .from('minutas')
                .select('*')
                .eq('setor_id', setorId);
            
            if (error) throw error;
            
            const minutasMap = {};
            const stylesMap = {};
            
            tiposMinuta.forEach(tipo => {
                minutasMap[tipo.id] = MINUTAS_PADRAO[tipo.id] || '';
                stylesMap[tipo.id] = { font_family: 'Arial', font_size: '16pt' };
            });

            data.forEach(item => {
                if (item.tipo_id) {
                    minutasMap[item.tipo_id] = item.conteudo;
                    stylesMap[item.tipo_id] = {
                        font_family: item.font_family || 'Arial',
                        font_size: item.font_size || '16pt'
                    };
                }
            });

            setMinutas(minutasMap);
            setMinutaStyles(stylesMap);
        } catch (error) {
            console.error("Erro ao buscar minutas:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (tipoId) => {
        if (!selectedSetor) return;
        
        try {
            setSaving(tipoId);
            const docId = `${selectedSetor.id}_${tipoId}`;
            const { error } = await window._supabaseClient
                .from('minutas')
                .upsert({
                    id: docId,
                    setor_id: selectedSetor.id,
                    tipo_id: tipoId,
                    conteudo: minutas[tipoId] || '',
                    font_family: minutaStyles[tipoId]?.font_family || 'Arial',
                    font_size: minutaStyles[tipoId]?.font_size || '16pt',
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            
            await window.logAudit(window._supabaseClient, user, 'ATUALIZAR_MINUTA', `Setor: ${selectedSetor.nome}, Tipo: ${tipoId}`);
            window.showToast?.(`Minuta "${tipoId}" salva com sucesso!`, 'success');
        } catch (error) {
            console.error("Erro ao salvar minuta:", error);
            window.showToast?.("Erro ao salvar: " + error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateNewMinuta = () => {
        setNewMinutaName('');
        setIsCreateModalOpen(true);
    };

    const confirmCreateNewMinuta = async () => {
        if (!newMinutaName.trim()) return;

        const id = 'custom_' + Date.now();
        const novoTipo = { id, nome: newMinutaName.trim(), icon: 'description', isCustom: true };

        try {
            setSaving('creating');
            
            // Buscar configurações atuais
            const { data: currentConfig, error: fetchError } = await window._supabaseClient
                .from('configuracoes')
                .select('data')
                .eq('id', 'minutas')
                .maybeSingle();

            if (fetchError) throw fetchError;

            let tiposAtuais = [];
            if (currentConfig && currentConfig.data && currentConfig.data.tipos) {
                tiposAtuais = currentConfig.data.tipos;
            }

            const novaData = {
                tipos: [...tiposAtuais, novoTipo]
            };

            const { error: upsertError } = await window._supabaseClient
                .from('configuracoes')
                .upsert({
                    id: 'minutas',
                    data: novaData,
                    updated_at: new Date().toISOString()
                });

            if (upsertError) throw upsertError;

            setActiveTipoId(id);
            setIsCreateModalOpen(false);
            window.showToast?.("Novo modelo de minuta criado!", "success");
        } catch (error) {
            console.error("Erro ao criar nova minuta:", error);
            window.showToast?.("Erro ao criar: " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteMinuta = (tipoId) => {
        setMinutaToDelete(tipoId);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteMinuta = async () => {
        if (!minutaToDelete) return;

        try {
            setSaving('deleting');
            
            const { data: currentConfig, error: fetchError } = await window._supabaseClient
                .from('configuracoes')
                .select('data')
                .eq('id', 'minutas')
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (currentConfig && currentConfig.data && currentConfig.data.tipos) {
                const novosTipos = currentConfig.data.tipos.filter(t => t.id !== minutaToDelete);
                
                const { error: upsertError } = await window._supabaseClient
                    .from('configuracoes')
                    .upsert({
                        id: 'minutas',
                        data: { tipos: novosTipos },
                        updated_at: new Date().toISOString()
                    });

                if (upsertError) throw upsertError;
                
                if (activeTipoId === minutaToDelete) {
                    setActiveTipoId(baseTiposMinuta[0].id);
                }
            }
            setIsDeleteModalOpen(false);
            setMinutaToDelete(null);
            window.showToast?.("Modelo de minuta excluído.", "success");
        } catch (error) {
            console.error("Erro ao excluir minuta:", error);
            window.showToast?.("Erro ao excluir: " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (tipoId, value) => {
        setMinutas(prev => ({ ...prev, [tipoId]: value }));
    };

    const handleStyleChange = (tipoId, field, value) => {
        setMinutaStyles(prev => ({
            ...prev,
            [tipoId]: {
                ...(prev[tipoId] || { font_family: 'Arial', font_size: '16pt' }),
                [field]: value
            }
        }));
    };

    if (loading && setores.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 animate-pulse">
                <div className="w-16 h-16 rounded-full border-4 border-white/5 border-t-indigo-500 animate-spin mb-4"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Acessando Modelos de Minutas...</p>
            </div>
        );
    }

    const activeTipo = tiposMinuta.find(t => t.id === activeTipoId);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header / Selector */}
            <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-6 sm:p-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8 backdrop-blur-2xl relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 blur-[120px] rounded-full -mr-40 -mt-40 pointer-events-none"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-10 h-1 bg-indigo-500 rounded-full shrink-0"></div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight whitespace-nowrap">Modelos de Minutas</h1>
                    </div>
                    <p className="text-slate-500 font-bold text-[10px] sm:text-[11px] uppercase tracking-[0.2em] ml-0 sm:ml-14">Personalização e automação de documentos por unidade judiciária.</p>
                </div>

                <div className="relative z-10 flex items-center gap-5 bg-slate-950/60 p-3 pl-6 sm:pl-8 rounded-[1.5rem] border border-white/10 shadow-inner w-full xl:w-auto">
                    <div className="flex flex-col flex-1 sm:flex-initial">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Setor em Edição</span>
                        <select 
                            value={selectedSetor?.id || ''} 
                            onChange={(e) => setSelectedSetor(setores.find(s => s.id === e.target.value))}
                            disabled={userData?.role === 'setor_admin'}
                            className="bg-transparent border-none focus:ring-0 text-sm font-black text-white uppercase tracking-widest cursor-pointer appearance-none p-0 pr-8 w-full"
                        >
                            {setores.map(s => (
                                <option key={s.id} value={s.id} className="bg-[#020617]">{s.nome}</option>
                            ))}
                        </select>
                    </div>
                    <span className="material-icons text-slate-500 pointer-events-none">expand_more</span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-4 px-2">
                {tiposMinuta.map(tipo => (
                    <button
                        key={tipo.id}
                        onClick={() => setActiveTipoId(tipo.id)}
                        className={`flex items-center gap-3 px-6 py-4 rounded-[1.5rem] border transition-all duration-500 relative overflow-hidden group ${
                            activeTipoId === tipo.id 
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30' 
                            : 'bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                        }`}
                    >
                        <span className={`material-icons text-xl ${activeTipoId === tipo.id ? 'text-white' : 'text-indigo-400'}`}>
                            {tipo.icon}
                        </span>
                        <span className="font-black uppercase tracking-widest text-[10px] sm:text-xs">{tipo.nome}</span>
                        {activeTipoId === tipo.id && (
                            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none animate-pulse"></div>
                        )}
                    </button>
                ))}
                
                <button
                    onClick={handleCreateNewMinuta}
                    className="flex items-center gap-3 px-6 py-4 rounded-[1.5rem] border border-dashed border-indigo-500/30 text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/50 transition-all duration-300"
                >
                    <span className="material-icons text-xl">add_circle</span>
                    <span className="font-black uppercase tracking-widest text-[10px] sm:text-xs">Nova Minuta</span>
                </button>
            </div>

            {/* Editor de Minuta Único */}
            <div className="animate-in fade-in zoom-in-95 duration-500">
                {activeTipo && (
                    <div key={activeTipo.id} className="tjpr-card group/card hover:bg-slate-900/40 transition-all duration-500 border-t-2 border-t-indigo-500/50">
                        <div className="px-8 py-6 border-b border-white/5 bg-slate-950/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                                    <span className="material-icons text-indigo-400 text-2xl">{activeTipo.icon}</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-xl text-white uppercase tracking-widest">{activeTipo.nome}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                        Editando Modelo para {selectedSetor?.nome}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex gap-4">
                                {activeTipo.id.startsWith('custom_') && (
                                    <button 
                                        onClick={() => handleDeleteMinuta(activeTipo.id)}
                                        className="px-4 py-2 text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-2 font-black uppercase tracking-widest text-[10px]"
                                    >
                                        <span className="material-icons text-sm">delete</span>
                                        Excluir Modelo
                                    </button>
                                )}
                                <TJPRButton 
                                    onClick={() => handleSave(activeTipo.id)}
                                    disabled={saving === activeTipo.id}
                                    variant={saving === activeTipo.id ? 'ghost' : 'primary'}
                                    className="px-8"
                                    icon={saving === activeTipo.id ? 'sync' : 'save'}
                                >
                                    {saving === activeTipo.id ? 'Salvando...' : 'Salvar Alterações'}
                                </TJPRButton>
                            </div>
                        </div>

                        {/* Controles de Estilo (Fonte) */}
                        <div className="px-8 py-4 bg-slate-900/20 border-b border-white/5 flex flex-wrap gap-6 items-center">
                            <div className="flex items-center gap-3">
                                <span className="material-icons text-slate-500 text-sm">font_download</span>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fonte:</span>
                                <select 
                                    value={minutaStyles[activeTipo.id]?.font_family || 'Arial'}
                                    onChange={(e) => handleStyleChange(activeTipo.id, 'font_family', e.target.value)}
                                    className="bg-slate-950 border border-white/10 rounded-lg text-xs font-bold text-white px-3 py-1 focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="Arial">Arial</option>
                                    <option value="Times New Roman">Times New Roman</option>
                                    <option value="Verdana">Verdana</option>
                                    <option value="Courier New">Courier New</option>
                                    <option value="Georgia">Georgia</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="material-icons text-slate-500 text-sm">format_size</span>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tamanho:</span>
                                <select 
                                    value={minutaStyles[activeTipo.id]?.font_size || '16pt'}
                                    onChange={(e) => handleStyleChange(activeTipo.id, 'font_size', e.target.value)}
                                    className="bg-slate-950 border border-white/10 rounded-lg text-xs font-bold text-white px-3 py-1 focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="12pt">12pt</option>
                                    <option value="14pt">14pt</option>
                                    <option value="16pt">16pt</option>
                                    <option value="18pt">18pt</option>
                                    <option value="20pt">20pt</option>
                                </select>
                            </div>
                            
                            <div className="ml-auto text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] italic">
                                * As fontes serão aplicadas na geração do arquivo .doc
                            </div>
                        </div>
                        
                        <div className="p-8">
                            <div className="relative group/editor">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-3xl blur opacity-0 group-focus-within/editor:opacity-100 transition duration-1000"></div>
                                <textarea
                                    value={minutas[activeTipo.id] || ''}
                                    onChange={(e) => handleChange(activeTipo.id, e.target.value)}
                                    className="relative w-full h-[500px] p-8 rounded-3xl bg-slate-950 border border-white/5 focus:border-indigo-500/50 focus:ring-0 font-mono text-xs leading-relaxed text-slate-300 resize-none transition-all custom-scrollbar shadow-2xl"
                                    placeholder="Escreva aqui o conteúdo HTML da minuta..."
                                />
                            </div>
                            
                            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-slate-950/40 rounded-3xl border border-white/5 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/20 via-transparent to-transparent"></div>
                                <div className="md:col-span-1 flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="material-icons text-indigo-400 text-sm">auto_fix_high</span>
                                        <p className="text-[10px] font-black text-white uppercase tracking-widest">Variáveis de Texto:</p>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Clique para copiar as tags automáticas</p>
                                </div>
                                <div className="md:col-span-3 flex flex-wrap gap-2">
                                    {['{{numeroProcesso}}', '{{dataPublicacao}}', '{{prazoExtenso}}', '{{setorNome}}'].map(tag => (
                                        <button 
                                            key={tag} 
                                            onClick={() => {
                                                navigator.clipboard.writeText(tag);
                                            }}
                                            className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black text-indigo-300 uppercase tracking-tighter hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all active:scale-95"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Criação de Minuta */}
            <TJPRModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Novo Modelo de Minuta"
                icon="add_circle"
                maxWidth="md"
            >
                <div className="space-y-6">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">
                        Defina um nome claro para o novo modelo. Ele ficará disponível para todos os setores configurarem seus textos.
                    </p>
                    
                    <TJPRInput
                        label="Nome do Modelo"
                        placeholder="Ex: Intimação de Despacho"
                        value={newMinutaName}
                        onChange={(e) => setNewMinutaName(e.target.value)}
                        icon="edit"
                        required
                    />

                    <div className="flex gap-4 pt-4">
                        <TJPRButton 
                            variant="ghost" 
                            onClick={() => setIsCreateModalOpen(false)}
                            className="flex-1"
                        >
                            Cancelar
                        </TJPRButton>
                        <TJPRButton 
                            variant="primary" 
                            onClick={confirmCreateNewMinuta}
                            disabled={!newMinutaName.trim() || saving === 'creating'}
                            className="flex-1"
                            icon={saving === 'creating' ? 'sync' : 'check'}
                        >
                            {saving === 'creating' ? 'Criando...' : 'Criar Modelo'}
                        </TJPRButton>
                    </div>
                </div>
            </TJPRModal>

            {/* Modal de Confirmação de Exclusão */}
            <TJPRModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Excluir Modelo"
                icon="warning"
                maxWidth="sm"
            >
                <div className="space-y-6 text-center">
                    <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-2">
                        <span className="material-icons text-rose-500 text-4xl">delete_forever</span>
                    </div>
                    
                    <div>
                        <h4 className="text-white font-black uppercase tracking-tight text-lg">Você tem certeza?</h4>
                        <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest mt-2 leading-relaxed">
                            Esta ação é irreversível e removerá este modelo de todos os setores permanentemente.
                        </p>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <TJPRButton 
                            variant="ghost" 
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="flex-1"
                        >
                            Voltar
                        </TJPRButton>
                        <TJPRButton 
                            variant="error" 
                            onClick={confirmDeleteMinuta}
                            disabled={saving === 'deleting'}
                            className="flex-1"
                            icon={saving === 'deleting' ? 'sync' : 'delete'}
                        >
                            {saving === 'deleting' ? 'Excluindo...' : 'Confirmar Exclusão'}
                        </TJPRButton>
                    </div>
                </div>
            </TJPRModal>
        </div>
    );
};

window.MinutasAdminPage = MinutasAdminPage;