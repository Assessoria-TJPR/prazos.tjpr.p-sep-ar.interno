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

    const renderForm = () => {
        const item = editando || novaEntrada;
        return (
            <form onSubmit={handleSave} className="p-6 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg space-y-4">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{editando ? `Editando ${formatarData(new Date(editando.data + 'T00:00:00'))}` : 'Adicionar Nova Data'}</h3>
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
                                                        <>
                                                            <button onClick={() => setEditando(item)} className="font-semibold text-indigo-600 hover:text-indigo-500">Editar</button>
                                                            <button onClick={() => handleDelete(item)} className="font-semibold text-red-600 hover:text-red-500">Excluir</button>
                                                        </>
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