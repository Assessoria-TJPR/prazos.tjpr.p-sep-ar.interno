const { useState, useEffect, useCallback, useContext } = React;

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

        if (editando) {
            // Se for um feriado recorrente, remove da lista de recorrentes
            if (editando.isRecurring) {
                const [ , month, day] = editando.data.split('-').map(Number);
                updatedConfig.feriadosNacionaisRecorrentes = updatedConfig.feriadosNacionaisRecorrentes.filter(f => f.mes !== month || f.dia !== day);
            } else {
                // Se for uma exceção anual, remove da lista de exceções
                const oldYear = editando.id.split('-')[0];
                if (updatedConfig.excecoesAnuais[oldYear]) {
                    updatedConfig.excecoesAnuais[oldYear] = updatedConfig.excecoesAnuais[oldYear].filter(ex => ex.data !== editando.id);
                }
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
        if (!window.confirm(`Tem certeza que deseja excluir a entrada para ${itemToDelete.data}?`)) return;

        setIsSaving(true);
        const updatedConfig = JSON.parse(JSON.stringify(config));
        const year = itemToDelete.data.split('-')[0];
        const [ , month, day] = itemToDelete.data.split('-').map(Number);

        if (itemToDelete.isRecurring) {
            updatedConfig.feriadosNacionaisRecorrentes = updatedConfig.feriadosNacionaisRecorrentes.filter(f => f.mes !== month || f.dia !== day);
        }

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

    const EditModal = () => {
        if (!editando) return null;
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditando(null)}>
                <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Editar Evento</h2>
                        <button onClick={() => setEditando(null)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Data</label>
                            <input 
                                type="date" 
                                name="data" 
                                value={editando.data} 
                                onChange={handleInputChange} 
                                disabled={true} 
                                required 
                                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition opacity-70 cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Motivo</label>
                            <input 
                                type="text" 
                                name="motivo" 
                                value={editando.motivo} 
                                onChange={handleInputChange} 
                                required 
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Tipo</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['feriado', 'decreto', 'instabilidade'].map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handleInputChange({ target: { name: 'tipo', value: type } })}
                                        className={`px-2 py-2 text-xs font-bold uppercase rounded-lg border transition-all ${
                                            editando.tipo === type
                                                ? type === 'feriado' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                                                : type === 'decreto' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                                                : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                                                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {error && <div className="p-3 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">{error}</div>}
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setEditando(null)} className="px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Cancelar</button>
                            <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 animate-fade-in">
            {/* Coluna Esquerda: Formulário */}
            <div className="lg:w-1/3 space-y-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 sticky top-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                            Adicionar Evento
                        </h2>
                    </div>
                    
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Data</label>
                            <input 
                                type="date" 
                                name="data" 
                                value={novaEntrada.data} 
                                onChange={handleInputChange} 
                                disabled={false} 
                                required 
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Motivo</label>
                            <input 
                                type="text" 
                                name="motivo" 
                                value={novaEntrada.motivo} 
                                onChange={handleInputChange} 
                                required 
                                placeholder="Ex: Feriado Municipal"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Tipo</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['feriado', 'decreto', 'instabilidade'].map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handleInputChange({ target: { name: 'tipo', value: type } })}
                                        className={`px-2 py-2 text-xs font-bold uppercase rounded-lg border transition-all ${
                                            novaEntrada.tipo === type
                                                ? type === 'feriado' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                                                : type === 'decreto' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                                                : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                                                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {!editando && error && <div className="p-3 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">{error}</div>}

                        <button 
                            type="submit" 
                            disabled={isSaving} 
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                        >
                            {isSaving ? 'Salvando...' : 'Adicionar ao Calendário'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Coluna Direita: Listas */}
            <div className="lg:w-2/3 space-y-6">
                {loading ? (
                    <div className="flex justify-center p-12"><p className="text-slate-500">Carregando...</p></div>
                ) : (
                    ['feriado', 'decreto', 'instabilidade'].map(tipo => {
                        const itemsFiltrados = allEntries.filter(item => item.tipo === tipo);
                        if (itemsFiltrados.length === 0) return null;

                        const configTipo = {
                            feriado: { label: 'Feriados', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-100 dark:border-blue-900/20' },
                            decreto: { label: 'Decretos', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-100 dark:border-red-900/20' },
                            instabilidade: { label: 'Instabilidades', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-100 dark:border-amber-900/20' }
                        }[tipo];

                        return (
                            <div key={tipo} className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden`}>
                                <div className={`px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 ${configTipo.bg}`}>
                                    <h3 className={`text-lg font-bold ${configTipo.color}`}>{configTipo.label}</h3>
                                    <span className="px-2 py-0.5 text-xs font-bold bg-white dark:bg-slate-800 rounded-full shadow-sm opacity-70">{itemsFiltrados.length}</span>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {itemsFiltrados.map(item => (
                                        <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="flex-shrink-0 w-16 text-center">
                                                    <span className="block text-xs font-bold text-slate-400 uppercase">{new Date(item.data + 'T00:00:00').toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                                                    <span className="block text-xl font-bold text-slate-800 dark:text-slate-200">{new Date(item.data + 'T00:00:00').getDate()}</span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-800 dark:text-slate-200">{item.motivo}</p>
                                                    <p className="text-xs text-slate-500">{new Date(item.data + 'T00:00:00').getFullYear()} • {item.isRecurring ? 'Recorrente' : 'Anual'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setEditando(item)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Editar">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                                </button>
                                                <button onClick={() => handleDelete(item)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Excluir">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            {editando && <EditModal />}
        </div>
    );
}