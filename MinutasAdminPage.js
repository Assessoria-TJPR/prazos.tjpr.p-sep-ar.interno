const { useState, useEffect, useCallback, useContext, useRef } = React;

const MinutasAdminPage = () => {
    const { userData } = useAuth();
    const [setores, setSetores] = useState([]);
    const [tiposMinuta, setTiposMinuta] = useState([]);
    const [novoTipoMinutaNome, setNovoTipoMinutaNome] = useState('');
    const [selectedSetorId, setSelectedSetorId] = useState('');
    const [minutas, setMinutas] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const editorRefs = useRef({});
    const isInitialMount = useRef(true);

    const handleSave = async (tipoId) => {
        if (!selectedSetorId || !editorRefs.current[tipoId]) return;
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const conteudo = editorRefs.current[tipoId].innerHTML;
            const docRef = db.collection('minutas').doc(`${selectedSetorId}_${tipoId}`);
            await docRef.set({
                setorId: selectedSetorId,
                tipo: tipoId,
                conteudo: conteudo,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            setSuccess(`Minuta "${tiposMinuta.find(t => t.id === tipoId).nome}" salva com sucesso!`);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError('Falha ao salvar a minuta.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    // Efeito principal para carregar todos os dados da página
    useEffect(() => { // Efeito para carregar os setores e definir o setor inicial
        const fetchSetores = async () => {
            if (!db || !userData) return;
            setError('');
            try {
                const setoresSnapshot = await db.collection('setores').orderBy('nome').get();
                const setoresList = setoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSetores(setoresList);

                if (userData.role === 'setor_admin') {
                    setSelectedSetorId(userData.setorId);
                } else if (setoresList.length > 0) {
                    setSelectedSetorId(setoresList[0].id);
                }
            } catch (err) {
                setError('Falha ao carregar setores.');
                console.error(err);
            }
        };
        fetchSetores();
    }, [db, userData]); // Roda apenas uma vez quando o componente é montado

    // Efeito para buscar as minutas QUANDO o setor selecionado muda
    useEffect(() => {
        const fetchMinutasData = async () => {
            if (!selectedSetorId || !db) return;

            setLoading(true);
            setError('');
            try {
                // Busca os tipos de minuta sempre que o setor muda para garantir que estão atualizados
                const tiposSnapshot = await db.collection('minutaTipos').orderBy('nome').get();
                const tiposList = tiposSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTiposMinuta(tiposList);

                if (tiposList.length > 0) {
                    const minutasData = {};
                    // Usando Promise.all para buscar todas as minutas em paralelo
                    await Promise.all(tiposList.map(async (tipo) => {
                        const docRef = db.collection('minutas').doc(`${selectedSetorId}_${tipo.id}`);
                        const doc = await docRef.get();
                        minutasData[tipo.id] = doc.exists ? doc.data().conteudo : (MINUTAS_PADRAO[tipo.id] || `<p>Modelo para ${tipo.nome}...</p>`);
                    }));
                    setMinutas(minutasData);
                }
            } catch (err) {
                setError('Falha ao carregar os dados das minutas.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchMinutasData();
    }, [selectedSetorId, db]); // Roda sempre que o setor selecionado ou o 'db' mudam

    const handleAddTipoMinuta = async (e) => {
        e.preventDefault();
        if (!novoTipoMinutaNome.trim()) return;
        const id = novoTipoMinutaNome.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
        if (!id) {
            setError("Nome inválido para o tipo de minuta.");
            return;
        }
        try {
            await db.collection('minutaTipos').doc(id).set({ nome: novoTipoMinutaNome.trim() });
            setNovoTipoMinutaNome('');
            window.location.reload();
        } catch (err) {
            setError("Falha ao adicionar novo tipo de minuta. O ID pode já existir.");
            console.error(err);
        }
    };

    const handleDeleteTipoMinuta = async (tipoId) => {
        if (window.confirm("Tem certeza que deseja excluir este tipo de minuta? Todas as minutas salvas deste tipo para todos os setores serão perdidas.")) {
            try {
                await db.collection('minutaTipos').doc(tipoId).delete();
                window.location.reload();
            } catch (err) {
                setError("Falha ao excluir o tipo de minuta.");
                console.error(err);
            }
        }
    };

    // Novo componente de editor de texto rico, sem dependências externas
    const SimpleRichEditor = ({ initialValue, onRef }) => {
        const handleCommand = (command, value = null) => {
            document.execCommand(command, false, value);
            onRef.current.focus();
        };

        const toolbarButtons = [
            { command: 'undo', icon: '↶', title: 'Desfazer' },
            { command: 'redo', icon: '↷', title: 'Refazer' },
            { command: 'bold', icon: 'B', title: 'Negrito' },
            { command: 'italic', icon: 'I', title: 'Itálico' },
            { command: 'underline', icon: 'U', title: 'Sublinhado' },
            { command: 'justifyLeft', icon: '⇚', title: 'Alinhar à Esquerda' },
            { command: 'justifyCenter', icon: '⇇', title: 'Centralizar' },
            { command: 'justifyRight', icon: '⇛', title: 'Alinhar à Direita' },
            { command: 'insertUnorderedList', icon: '•', title: 'Lista (pontos)' },
            { command: 'insertOrderedList', icon: '1.', title: 'Lista (números)' },
        ];

        return (
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg">
                <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-300 dark:border-slate-600 bg-slate-200/70 dark:bg-slate-800/70 rounded-t-lg">
                    {toolbarButtons.map(({ command, icon, title }) => (
                        <button key={command} title={title} onClick={() => handleCommand(command)} type="button" className="w-8 h-8 rounded text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 font-bold text-lg">
                            {icon}
                        </button>
                    ))}
                </div>
                <div
                    ref={onRef}
                    contentEditable={true}
                    dangerouslySetInnerHTML={{ __html: initialValue }}
                    className="p-4 h-96 overflow-y-auto focus:outline-none bg-white dark:bg-slate-800/50"
                    style={{ fontFamily: 'Arial, sans-serif', fontSize: '16pt' }}
                ></div>
            </div>
        );
    };

    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gerenciamento de Minutas</h2>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-2">Como Funciona</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-700 dark:text-blue-300">
                    <li><strong>Selecione o Setor:</strong> Se você for um Admin Global, escolha o setor para o qual deseja editar as minutas. Chefes de Setor verão apenas as minutas do seu próprio setor.</li>
                    <li><strong>Edite o Modelo:</strong> Altere o texto no editor para cada tipo de minuta. Você pode usar negrito, itálico e outras formatações.</li>
                    <li><strong>Use Placeholders:</strong> Para dados que mudam a cada processo (como número do processo, datas, etc.), use placeholders no formato {"{{placeholder}}"}. Ex: {"{{numeroProcesso}}"}, {"{{dataPublicacao}}"}. Estes serão substituídos automaticamente ao gerar o documento na calculadora.</li>
                    <li><strong>Salve a Minuta:</strong> Após editar, clique em "Salvar Minuta". O modelo ficará salvo para o setor selecionado.</li>
                    <li><strong>Gerar Documento:</strong> Na tela da Calculadora, após fazer um cálculo e analisar a tempestividade, os botões para baixar as minutas aparecerão. Ao clicar, o sistema usará o modelo salvo para gerar um arquivo `.doc` com os dados do cálculo.</li>
                </ol>
            </div>

            {userData.role === 'admin' && (
                <div className="p-4 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg space-y-4">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Adicionar Novo Tipo de Minuta</h3>
                    <form onSubmit={handleAddTipoMinuta} className="flex items-center gap-2">
                        <input type="text" placeholder="Nome do novo tipo (ex: Agravo Interno)" value={novoTipoMinutaNome} onChange={e => setNovoTipoMinutaNome(e.target.value)} className="flex-grow p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700" />
                        <button type="submit" className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Adicionar</button>
                    </form>
                </div>
            )}
            
            {userData.role === 'admin' && (
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Selecione o Setor</label>
                    <select value={selectedSetorId} onChange={e => setSelectedSetorId(e.target.value)} className="w-full md:w-1/2 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700">
                        {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                </div>
            )}

            {loading ? (
                <p className="text-center text-slate-500 dark:text-slate-400">Carregando minutas...</p>
            ) : error ? (
                <p className="text-red-500">{error}</p>
            ) : (
                <div className="space-y-8">
                    {tiposMinuta.map(tipo => (
                        <div key={tipo.id} className="p-4 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{tipo.nome}</h3>
                                {userData.role === 'admin' && (
                                    <button onClick={() => handleDeleteTipoMinuta(tipo.id)} title="Excluir este tipo de minuta" className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 text-xl font-bold">&times;</button>
                                )}
                            </div>
                            <SimpleRichEditor
                                initialValue={minutas[tipo.id]}
                                onRef={el => editorRefs.current[tipo.id] = el}
                            />
                            <div className="mt-4 flex justify-end gap-4">
                                <button onClick={() => handleSave(tipo.id)} disabled={saving} className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                    {saving ? 'Salvando...' : 'Salvar Minuta'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {success && <div className="fixed bottom-4 right-4 p-4 text-sm text-white bg-green-600 rounded-lg shadow-lg animate-fade-in">{success}</div>}
        </div>
    );
};