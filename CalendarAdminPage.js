const { useState, useEffect, useCallback, useContext } = React;

const CalendarioAdminPage = () => {
    const { refreshCalendar } = useContext(SettingsContext);
    const { user } = useAuth();
    const [config, setConfig] = useState(null);
    const [allEntries, setAllEntries] = useState([]);
    const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editando, setEditando] = useState(null); 
    const [novaEntrada, setNovaEntrada] = useState({ data: '', motivo: '', tipo: 'feriado', link: '' });
    const [entryToDelete, setEntryToDelete] = useState(null); 

    const fetchCalendarConfig = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await window._supabaseClient
                .from('configuracoes')
                .select('data')
                .eq('id', 'calendario')
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                setError("Configuração não encontrada.");
                return;
            }
            const configData = data.data;
            setConfig(configData);

            const entries = [];
            const anoAtual = new Date().getFullYear();
            const anosRelevantes = [String(anoAtual), String(anoAtual + 1)];

            if (configData.excecoesAnuais) {
                Object.keys(configData.excecoesAnuais).forEach(ano => {
                    if (!anosRelevantes.includes(ano)) anosRelevantes.push(ano);
                });
            }
            anosRelevantes.sort();

            anosRelevantes.forEach(year => {
                configData.feriadosNacionaisRecorrentes?.forEach(f => {
                    const dataStr = `${year}-${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`;
                    entries.push({ id: `rec_${dataStr}`, data: dataStr, motivo: f.motivo, tipo: 'feriado', isRecurring: true, link: f.link || '' });
                });

                if (configData.excecoesAnuais && configData.excecoesAnuais[year]) {
                    configData.excecoesAnuais[year].forEach(e => {
                        entries.push({ id: `exc_${e.data}`, data: e.data, motivo: e.motivo, tipo: e.tipo, isRecurring: false, link: e.link || '' });
                    });
                }
            });

            entries.sort((a, b) => new Date(a.data) - new Date(b.data));
            setAllEntries(entries);
        } catch (err) {
            setError('Falha ao carregar o calendário.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCalendarConfig();
    }, [fetchCalendarConfig]);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        const item = editando || novaEntrada;
        if (!item.data || !item.motivo || !item.tipo) {
            window.showToast?.('Preencha todos os campos obrigatórios.', 'warning');
            return;
        }

        setIsSaving(true);
        setError('');
        const updatedConfig = JSON.parse(JSON.stringify(config));
        const year = item.data.split('-')[0];

        if (editando) {
            if (editando.isRecurring) {
                const [, month, day] = editando.data.split('-').map(Number);
                updatedConfig.feriadosNacionaisRecorrentes = updatedConfig.feriadosNacionaisRecorrentes.filter(f => f.mes !== month || f.dia !== day);
            } else {
                const oldYear = editando.data.split('-')[0];
                if (updatedConfig.excecoesAnuais[oldYear]) {
                    updatedConfig.excecoesAnuais[oldYear] = updatedConfig.excecoesAnuais[oldYear].filter(ex => ex.data !== editando.data);
                }
            }
        }

        if (!updatedConfig.excecoesAnuais[year]) {
            updatedConfig.excecoesAnuais[year] = [];
        }
        updatedConfig.excecoesAnuais[year].push({ data: item.data, motivo: item.motivo, tipo: item.tipo, link: item.link || '' });
        
        try {
            const { error: saveError } = await window._supabaseClient
                .from('configuracoes')
                .upsert({ id: 'calendario', data: updatedConfig });

            if (saveError) throw saveError;

            await window.logAudit(window._supabaseClient, user, editando ? 'EDITAR_CALENDARIO' : 'ADICIONAR_CALENDARIO', `Data: ${item.data}`);
            setNovaEntrada({ data: '', motivo: '', tipo: 'feriado', link: '' });
            setEditando(null);
            await fetchCalendarConfig();
            await refreshCalendar();
            window.showToast?.('Calendário atualizado com sucesso!', 'success');
        } catch (err) {
            window.showToast?.('Erro ao salvar no banco de dados: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const executeDelete = async () => {
        if (!entryToDelete) return;
        const itemToDelete = entryToDelete;
        setIsSaving(true);
        const updatedConfig = JSON.parse(JSON.stringify(config));
        const year = itemToDelete.data.split('-')[0];
        const [, month, day] = itemToDelete.data.split('-').map(Number);

        if (itemToDelete.isRecurring) {
            updatedConfig.feriadosNacionaisRecorrentes = updatedConfig.feriadosNacionaisRecorrentes.filter(f => f.mes !== month || f.dia !== day);
        }

        if (updatedConfig.excecoesAnuais[year]) {
            updatedConfig.excecoesAnuais[year] = updatedConfig.excecoesAnuais[year].filter(ex => ex.data !== itemToDelete.data);
        }

        try {
            const { error: deleteError } = await window._supabaseClient
                .from('configuracoes')
                .upsert({ id: 'calendario', data: updatedConfig });

            if (deleteError) throw deleteError;

            await window.logAudit(window._supabaseClient, user, 'EXCLUIR_CALENDARIO', `Data: ${itemToDelete.data}`);
            setEntryToDelete(null);
            await fetchCalendarConfig();
            await refreshCalendar();
            window.showToast?.('Evento removido com sucesso.', 'success');
        } catch (err) {
            window.showToast?.('Erro ao excluir registro: ' + err.message, 'error');
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

    if (loading && !config) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-indigo-500 animate-spin mb-4"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Acessando Registros do Calendário...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Coluna de Controle */}
            <div className="lg:w-[380px] space-y-6">
                <TJPRCard title="Gestão de Eventos" subtitle="Controle de feriados e suspensões." icon="event_note">
                    <div className="space-y-6">
                        <TJPRInput
                            label="Data do Evento"
                            type="date"
                            name="data"
                            value={novaEntrada.data}
                            onChange={handleInputChange}
                            icon="calendar_today"
                        />
                        <TJPRInput
                            label="Descrição / Motivo"
                            name="motivo"
                            value={novaEntrada.motivo}
                            onChange={handleInputChange}
                            placeholder="Ex: Feriado Estadual"
                            icon="description"
                        />
                        <TJPRInput
                            label="URL do Decreto (Opcional)"
                            name="link"
                            value={novaEntrada.link}
                            onChange={handleInputChange}
                            placeholder="https://diario.tjpr.jus.br/..."
                            icon="link"
                        />
                        
                        <div className="space-y-3">
                            <label className="tjpr-label">Categoria do Evento</label>
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    { id: 'feriado', label: 'Feriado Nacional', icon: 'flag', color: 'text-indigo-400' },
                                    { id: 'decreto', label: 'Decreto Judiciário', icon: 'gavel', color: 'text-rose-400' },
                                    { id: 'instabilidade', label: 'Instabilidade Técnica', icon: 'bolt', color: 'text-amber-400' }
                                ].map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => handleInputChange({ target: { name: 'tipo', value: cat.id } })}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${novaEntrada.tipo === cat.id ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-950/20 border-white/5 hover:bg-slate-950/40'}`}
                                    >
                                        <span className={`material-icons ${novaEntrada.tipo === cat.id ? 'text-white' : cat.color}`}>{cat.icon}</span>
                                        <span className={`text-xs font-black uppercase tracking-widest ${novaEntrada.tipo === cat.id ? 'text-white' : 'text-slate-400'}`}>{cat.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && <p className="text-rose-400 text-[10px] font-black uppercase text-center">{error}</p>}

                        <TJPRButton
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full"
                            icon="add_circle"
                        >
                            {isSaving ? 'Processando...' : 'Registrar Evento'}
                        </TJPRButton>
                    </div>
                </TJPRCard>
            </div>

            {/* Coluna de Listagem */}
            <div className="flex-1 space-y-8">
                {/* Year Selection Tabs */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 p-2 bg-slate-950/40 border border-white/5 rounded-[2.5rem] w-full sm:w-fit backdrop-blur-md shadow-2xl mx-auto sm:mx-0">
                    {(() => {
                        const anosDisponiveis = [String(new Date().getFullYear()), String(new Date().getFullYear() + 1)];
                        const anosNosDados = [...new Set(allEntries.map(e => e.data.split('-')[0]))].sort();
                        const anosParaMostrar = [...new Set([...anosNosDados, ...anosDisponiveis])].sort();

                        return anosParaMostrar.map(ano => (
                            <button
                                key={ano}
                                onClick={() => setSelectedYear(ano)}
                                className={`px-6 sm:px-10 py-3 sm:py-4 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 border ${selectedYear === ano ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_10px_30px_-10px_rgba(79,70,229,0.5)] scale-105' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                            >
                                Exercício {ano}
                            </button>
                        ));
                    })()}
                </div>

                {/* Categorized Lists */}
                <div className="space-y-6">
                    {[
                        { id: 'feriado', label: 'Feriados & Pontos Facultativos', icon: 'event_available', color: 'text-indigo-400', glow: 'bg-indigo-500' },
                        { id: 'decreto', label: 'Decretos de Suspensão', icon: 'gavel', color: 'text-rose-400', glow: 'bg-rose-500' },
                        { id: 'instabilidade', label: 'Relatórios de Instabilidade', icon: 'report_problem', color: 'text-amber-400', glow: 'bg-amber-500' }
                    ].map(cat => {
                        const items = allEntries.filter(item => item.tipo === cat.id && item.data.startsWith(selectedYear));
                        if (items.length === 0) return null;

                        return (
                            <div key={cat.id} className="tjpr-card group hover:bg-slate-900/40 transition-all duration-500">
                                <div className={`absolute top-0 left-0 w-1 h-full ${cat.glow}`}></div>
                                <div className="px-8 py-6 border-b border-white/5 bg-slate-950/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <span className={`material-icons ${cat.color}`}>{cat.icon}</span>
                                        <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">{cat.label}</h3>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-slate-400 uppercase">
                                        {items.length} {items.length === 1 ? 'Evento' : 'Eventos'}
                                    </span>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {items.map(item => (
                                        <div key={item.id} className="group px-8 py-5 flex items-center justify-between hover:bg-slate-950/40 transition-all">
                                            <div className="flex items-center gap-8">
                                                {/* Calendar Leaf UI */}
                                                <div className="w-16 h-16 bg-slate-950 border border-white/10 rounded-2xl flex flex-col items-center justify-center shadow-inner group-hover:border-white/20 transition-all">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">
                                                        {new Date(item.data + 'T00:00:00').toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}
                                                    </span>
                                                    <span className="text-xl font-black text-white leading-none">
                                                        {new Date(item.data + 'T00:00:00').getDate()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">{item.motivo}</p>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.isRecurring ? 'Recorrência Anual' : 'Ajuste Pontual'}</span>
                                                        {item.link && (
                                                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest border-b border-indigo-400/20">
                                                                <span className="material-icons text-[10px]">open_in_new</span>
                                                                Ver Decreto
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                <button onClick={() => setEditando(item)} className="w-10 h-10 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center">
                                                    <span className="material-icons text-lg">edit</span>
                                                </button>
                                                <button onClick={() => setEntryToDelete(item)} className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center">
                                                    <span className="material-icons text-lg">delete_outline</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Edit Modal Elite */}
            <TJPRModal
                isOpen={!!editando}
                onClose={() => setEditando(null)}
                title="Ajustar Registro"
                subtitle={`Modificando evento datado de ${editando?.data.split('-').reverse().join('/')}`}
                icon="edit_calendar"
            >
                <div className="space-y-6">
                    <TJPRInput
                        label="Motivo / Descrição"
                        name="motivo"
                        value={editando?.motivo || ''}
                        onChange={handleInputChange}
                        icon="edit"
                    />
                    <TJPRInput
                        label="URL do Decreto"
                        name="link"
                        value={editando?.link || ''}
                        onChange={handleInputChange}
                        icon="link"
                    />
                    <div className="flex justify-end gap-4 mt-8">
                        <TJPRButton onClick={() => setEditando(null)} variant="ghost">Cancelar</TJPRButton>
                        <TJPRButton onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Salvando...' : 'Aplicar Mudanças'}
                        </TJPRButton>
                    </div>
                </div>
            </TJPRModal>
            
            {/* Modal de Confirmação de Exclusão (Layout Clássico Elite) */}
            {entryToDelete && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setEntryToDelete(null)}>
                    <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="p-10 text-center">
                            <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20 shadow-[0_0_40px_-10px_rgba(244,63,94,0.3)]">
                                <span className="material-icons text-4xl">delete_forever</span>
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Excluir Evento?</h3>
                            <p className="text-sm text-slate-400 font-medium leading-relaxed">
                                Tem certeza que deseja excluir o evento <br/>
                                <span className="text-white font-bold">"{entryToDelete.motivo}"</span> de <span className="text-white font-bold">{entryToDelete.data.split('-').reverse().join('/')}</span>?<br/>
                                Esta ação não pode ser desfeita.
                            </p>
                        </div>
                        <div className="flex border-t border-white/5 bg-slate-950/20">
                            <button onClick={() => setEntryToDelete(null)} className="flex-1 px-8 py-6 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                                Cancelar
                            </button>
                            <button onClick={executeDelete} className="flex-1 px-8 py-6 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                <span className="material-icons text-sm">delete</span>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

window.CalendarioAdminPage = CalendarioAdminPage;