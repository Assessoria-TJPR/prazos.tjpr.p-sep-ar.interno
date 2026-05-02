const { useState, useEffect, useCallback, useContext } = React;

const BugReportsPage = () => {
    const [chamados, setChamados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [selectedScreenshot, setSelectedScreenshot] = useState(null);
    const [error, setError] = useState(null);
    const [chamadoToDelete, setChamadoToDelete] = useState(null);
    const [chamadoToStatus, setChamadoToStatus] = useState(null); // Para confirmar finalização/reabertura

    const fetchChamados = useCallback(async () => {
        const _supabase = window._supabaseClient;
        if (!_supabase) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            console.log("BugReportsPage: Buscando chamados...");
            // Busca bug_reports e profiles via join
            const { data, error: fetchError } = await _supabase
                .from('bug_reports')
                .select(`
                    *,
                    profiles:user_id (
                        display_name,
                        email
                    )
                `)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            
            const reportsWithUsers = data.map(report => ({
                ...report,
                // Adaptação para o resto do componente que usa CamelCase ou nomes específicos
                createdAt: report.created_at,
                reporterName: report.profiles?.display_name || report.user_name || 'Usuário Desconhecido',
                reporterEmail: report.profiles?.email || report.user_email || '',
                reporterAvatar: '#4f46e5', // Padrão ou extraído do perfil se houver
                screenshotBase64: report.screenshot // Mapeia para o nome esperado no resto do código
            }));

            setChamados(reportsWithUsers);
            setError(null);
        } catch (err) {
            console.error("Erro ao buscar chamados:", err);
            setError("Falha ao carregar chamados.");
        } finally {
            setLoading(false);
        }
    }, []);

    const executeDeleteChamado = async () => {
        const _supabase = window._supabaseClient;
        if (!chamadoToDelete || !_supabase) return;
        try {
            console.log(`BugReportsPage: Excluindo chamado ${chamadoToDelete.id}`);
            const { error: delError } = await _supabase
                .from('bug_reports')
                .delete()
                .eq('id', chamadoToDelete.id);

            if (delError) throw delError;

            setChamadoToDelete(null);
            await fetchChamados();
            window.showToast?.("Chamado excluído com sucesso.", "success");
            // Audit log
            if (window.logAudit && window._supabaseAuth?.user) {
                await window.logAudit(_supabase, window._supabaseAuth.user, 'EXCLUIR_CHAMADO', `ID: ${chamadoToDelete.id} de ${chamadoToDelete.reporterName}`);
            }
        } catch (err) {
            console.error("BugReportsPage: Erro ao excluir chamado:", err);
            window.showToast?.("Falha ao excluir o chamado: " + (err.message || "Erro desconhecido"), "error");
        }
    };

    const handleUpdateStatus = async (chamado, newStatus) => {
        setChamadoToStatus({ chamado, newStatus });
    };

    const executeUpdateStatus = async () => {
        const _supabase = window._supabaseClient;
        if (!chamadoToStatus || !_supabase) return;
        const { chamado, newStatus } = chamadoToStatus;
        
        try {
            console.log(`BugReportsPage: Atualizando status para ${newStatus} no chamado ${chamado.id}`);
            const { error: upError } = await _supabase
                .from('bug_reports')
                .update({ 
                    status: newStatus, 
                    updated_at: new Date().toISOString() 
                })
                .eq('id', chamado.id);

            if (upError) throw upError;

            setChamadoToStatus(null);
            await fetchChamados();
            window.showToast?.(`Status do chamado atualizado para ${newStatus}.`, "success");
            
            if (window.logAudit && window._supabaseAuth?.user) {
                await window.logAudit(_supabase, window._supabaseAuth.user, 'ALTERAR_STATUS_CHAMADO', `ID: ${chamado.id} para ${newStatus}`);
            }
        } catch (err) {
            console.error("Erro ao atualizar status:", err);
            window.showToast?.("Falha ao atualizar status: " + (err.message || "Erro desconhecido"), "error");
        }
    };

    useEffect(() => {
        fetchChamados();
        // Listener para mudanças em tempo real via Supabase
        const _supabase = window._supabaseClient;
        if (!_supabase) return;

        const channel = _supabase
            .channel('bug_reports_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bug_reports' }, () => {
                fetchChamados();
            })
            .subscribe();

        return () => {
            _supabase.removeChannel(channel);
        };
    }, [fetchChamados]);

    // Filtros
    const filteredChamados = chamados.filter(c => {
        const matchSearch = (c.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (c.reporterName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'todos' || c.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const getStatusInfo = (status) => {
        switch(status) {
            case 'aberto': return { label: 'Aberto', color: 'warning', icon: 'pending' };
            case 'em_analise': return { label: 'Em Análise', color: 'info', icon: 'search' };
            case 'resolvido': return { label: 'Resolvido', color: 'success', icon: 'check_circle' };
            default: return { label: status, color: 'default', icon: 'help' };
        }
    };

    if (error) {
        return (
            <div className="p-12 text-center">
                <div className="w-20 h-20 tjpr-bg-error-glow tjpr-text-error rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-icons text-4xl">error</span>
                </div>
                <h2 className="text-2xl font-black tjpr-text-main mb-2">Ops! Algo deu errado</h2>
                <p className="tjpr-text-dim mb-8">{error}</p>
                <TJPRButton onClick={fetchChamados} icon="refresh">Tentar Novamente</TJPRButton>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Grid de Estatísticas Elite */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                {/* Total */}
                <div className="relative tjpr-bg-main backdrop-blur-xl border tjpr-border-main rounded-[2.5rem] p-8 overflow-hidden group shadow-xl dark:shadow-2xl transition-all">
                    <div className="absolute -right-4 -top-4 w-24 h-24 tjpr-bg-alt blur-3xl rounded-full transition-all group-hover:scale-150"></div>
                    <p className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] mb-2">Total de Chamados</p>
                    <p className="text-4xl font-black tjpr-text-main tracking-tighter">{chamados.length}</p>
                </div>
                
                {/* Status-based Stats */}
                {[
                    { label: 'Em Aberto', count: chamados.filter(c => c.status === 'aberto').length, color: 'tjpr-text-warning', glow: 'tjpr-bg-warning-glow' },
                    { label: 'Em Análise', count: chamados.filter(c => c.status === 'em_analise').length, color: 'tjpr-text-primary', glow: 'tjpr-bg-primary-glow' },
                    { label: 'Resolvidos', count: chamados.filter(c => c.status === 'resolvido').length, color: 'tjpr-text-success', glow: 'tjpr-bg-success-glow' }
                ].map((stat, i) => (
                    <div key={i} className="relative tjpr-bg-main backdrop-blur-xl border tjpr-border-main rounded-[2.5rem] p-8 overflow-hidden group shadow-xl dark:shadow-2xl transition-all">
                        <div className={`absolute -right-4 -top-4 w-24 h-24 ${stat.glow} blur-3xl rounded-full transition-all group-hover:scale-150`}></div>
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${stat.color}`}>{stat.label}</p>
                        <p className="text-4xl font-black tjpr-text-main tracking-tighter">{stat.count}</p>
                    </div>
                ))}
            </div>

            <TJPRCard 
                title="Central de Chamados e Bugs" 
                subtitle="Gerenciamento de feedback e suporte técnico"
                icon="bug_report"
            >
                {/* Filtros e Busca */}
                <div className="flex flex-col md:grid md:grid-cols-12 gap-6 mb-10">
                    <div className="md:col-span-6">
                        <TJPRInput 
                            placeholder="Buscar por descrição ou solicitante..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon="search"
                        />
                    </div>
                    <div className="md:col-span-4 relative">
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full h-[52px] tjpr-bg-alt border tjpr-border-main rounded-2xl px-6 text-xs font-black uppercase tracking-widest tjpr-text-main appearance-none focus:border-primary/50 outline-none transition-all cursor-pointer"
                        >
                            <option value="todos" className="tjpr-bg-main">Todos os Status</option>
                            <option value="aberto" className="tjpr-bg-main">Abertos</option>
                            <option value="em_analise" className="tjpr-bg-main">Em Análise</option>
                            <option value="resolvido" className="tjpr-bg-main">Resolvidos</option>
                        </select>
                        <span className="material-icons absolute right-6 top-1/2 -translate-y-1/2 tjpr-text-dim pointer-events-none text-lg">expand_more</span>
                    </div>
                    <div className="md:col-span-2">
                        <TJPRButton onClick={fetchChamados} variant="secondary" icon="refresh" className="w-full h-[52px]">
                            Atualizar
                        </TJPRButton>
                    </div>
                </div>

                {/* Tabela de Chamados */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-y-3">
                        <thead>
                            <tr className="text-[10px] font-black tjpr-text-dim uppercase tracking-[0.2em] px-4">
                                <th className="pb-4 pl-6">Solicitante</th>
                                <th className="pb-4">Descrição</th>
                                <th className="pb-4">Prioridade</th>
                                <th className="pb-4">Status</th>
                                <th className="pb-4 text-right pr-6">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && chamados.length === 0 ? (
                                Array(3).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                    <td colSpan="5" className="h-20 tjpr-bg-alt rounded-2xl"></td>
                                    </tr>
                                ))
                            ) : filteredChamados.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center">
                                        <p className="tjpr-text-dim font-bold uppercase tracking-widest">Nenhum chamado encontrado</p>
                                    </td>
                                </tr>
                            ) : filteredChamados.map(chamado => {
                                const status = getStatusInfo(chamado.status);
                                return (
                                    <tr key={chamado.id} className="group tjpr-bg-alt tjpr-bg-hover transition-all border-b border-transparent">
                                        <td className="py-5 pl-6 rounded-l-2xl">
                                            <div className="flex items-center gap-4">
                                                <div 
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg"
                                                    style={{ background: `linear-gradient(135deg, ${chamado.reporterAvatar}, #1e1b4b)` }}
                                                >
                                                    {chamado.reporterName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold tjpr-text-main leading-tight">{chamado.reporterName}</p>
                                                    <p className="text-[10px] tjpr-text-dim font-medium">{formatarData(new Date(chamado.createdAt))}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-5">
                                            <p className="text-sm tjpr-text-main line-clamp-1 max-w-md font-medium">
                                                {chamado.description}
                                            </p>
                                        </td>
                                        <td className="py-5">
                                            <TJPRBadge variant={chamado.priority === 'alta' ? 'error' : 'info'}>
                                                {chamado.priority || 'normal'}
                                            </TJPRBadge>
                                        </td>
                                        <td className="py-5">
                                            <TJPRBadge variant={status.color} icon={status.icon}>
                                                {status.label}
                                            </TJPRBadge>
                                        </td>
                                        <td className="py-5 pr-6 rounded-r-2xl text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {chamado.screenshotBase64 && (
                                                    <button 
                                                        onClick={() => setSelectedScreenshot(chamado.screenshotBase64)}
                                                        className="w-10 h-10 rounded-xl tjpr-bg-primary-glow tjpr-text-primary hover:tjpr-bg-primary hover:text-white transition-all flex items-center justify-center"
                                                        title="Ver Captura de Tela"
                                                    >
                                                        <span className="material-icons text-xl">image</span>
                                                    </button>
                                                )}
                                                {chamado.status !== 'resolvido' && (
                                                    <button 
                                                        onClick={() => handleUpdateStatus(chamado, 'resolvido')}
                                                        className="w-10 h-10 rounded-xl tjpr-bg-success-glow tjpr-text-success hover:tjpr-bg-success hover:text-white transition-all flex items-center justify-center"
                                                        title="Marcar como Resolvido"
                                                    >
                                                        <span className="material-icons text-xl">check_circle</span>
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => setChamadoToDelete(chamado)}
                                                    className="w-10 h-10 rounded-xl tjpr-bg-error-glow tjpr-text-error hover:tjpr-bg-error hover:text-white transition-all flex items-center justify-center"
                                                    title="Excluir Permanentemente"
                                                >
                                                    <span className="material-icons text-xl">delete_sweep</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </TJPRCard>

            {/* Modal de Screenshot */}
            <TJPRModal 
                isOpen={!!selectedScreenshot} 
                onClose={() => setSelectedScreenshot(null)}
                title="Captura de Tela do Erro"
                maxWidth="6xl"
                icon="wallpaper"
            >
                <div className="tjpr-bg-main rounded-3xl overflow-hidden border tjpr-border-main shadow-2xl">
                    <img src={selectedScreenshot} alt="Bug Screenshot" className="w-full h-auto" />
                </div>
            </TJPRModal>

            {/* Modal de Confirmação de Exclusão (Layout Clássico Elite) */}
            {chamadoToDelete && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setChamadoToDelete(null)}>
                    <div className="w-full max-w-md tjpr-bg-main border tjpr-border-main rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="p-10 text-center">
                            <div className="w-20 h-20 tjpr-bg-error-glow tjpr-text-error rounded-full flex items-center justify-center mx-auto mb-6 border tjpr-border-error shadow-lg shadow-[rgba(244,63,94,0.3)]">
                                <span className="material-icons text-4xl">delete_forever</span>
                            </div>
                            <h3 className="text-2xl font-black tjpr-text-main mb-2 uppercase tracking-tight">Excluir Chamado?</h3>
                            <p className="text-sm tjpr-text-dim font-medium leading-relaxed">
                                Tem certeza que deseja excluir o chamado de <br/>
                                <span className="tjpr-text-main font-bold">"{chamadoToDelete.reporterName}"</span>?<br/>
                                Esta ação removerá permanentemente o registro.
                            </p>
                        </div>
                        <div className="flex border-t tjpr-border-main tjpr-bg-alt">
                            <button onClick={() => setChamadoToDelete(null)} className="flex-1 px-8 py-6 text-xs font-black uppercase tracking-widest tjpr-text-dim hover:tjpr-text-main tjpr-bg-hover transition-all border-r tjpr-border-main">
                                Cancelar
                            </button>
                            <button onClick={executeDeleteChamado} className="flex-1 px-8 py-6 tjpr-bg-error hover:tjpr-bg-error/80 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-inner">
                                <span className="material-icons text-sm">delete</span>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Status (Layout Clássico Elite) */}
            {chamadoToStatus && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setChamadoToStatus(null)}>
                    <div className="w-full max-w-md tjpr-bg-main border tjpr-border-main rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="p-10 text-center">
                            <div className="w-20 h-20 tjpr-bg-success-glow tjpr-text-success rounded-full flex items-center justify-center mx-auto mb-6 border tjpr-border-success shadow-lg shadow-[rgba(16,185,129,0.3)]">
                                <span className="material-icons text-4xl">check_circle</span>
                            </div>
                            <h3 className="text-2xl font-black tjpr-text-main mb-2 uppercase tracking-tight">Resolver Chamado?</h3>
                            <p className="text-sm tjpr-text-dim font-medium leading-relaxed">
                                Deseja marcar o chamado de <br/>
                                <span className="tjpr-text-main font-bold">"{chamadoToStatus.chamado.reporterName}"</span> como <span className="text-emerald-500 font-bold">resolvido</span>?
                            </p>
                        </div>
                        <div className="flex border-t tjpr-border-main tjpr-bg-alt">
                            <button onClick={() => setChamadoToStatus(null)} className="flex-1 px-8 py-6 text-xs font-black uppercase tracking-widest tjpr-text-dim hover:tjpr-text-main tjpr-bg-hover transition-all border-r tjpr-border-main">
                                Voltar
                            </button>
                            <button onClick={executeUpdateStatus} className="flex-1 px-8 py-6 tjpr-bg-success hover:tjpr-bg-success/80 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-inner">
                                <span className="material-icons text-sm">task_alt</span>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

window.BugReportsPage = BugReportsPage;