const { useState, useEffect, useCallback, useContext, useRef } = React;

const MinutasAdminPage = () => {
    const { user, userData, isAdmin, isSetorAdmin } = useAuth();
    const [setores, setSetores] = useState([]);
    const [tiposMinuta, setTiposMinuta] = useState([]);
    const [novoTipoMinutaNome, setNovoTipoMinutaNome] = useState('');
    const [selectedSetorId, setSelectedSetorId] = useState('');
    const [minutasCache, setMinutasCache] = useState({}); // Cache para armazenar minutas por setor
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedTipoMinutaId, setSelectedTipoMinutaId] = useState('');

    const editorRefs = useRef({});

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
            await logAudit(db, user, 'EDITAR_MINUTA', `Tipo: ${tipoId}, Setor: ${selectedSetorId}`);
            setSuccess(`Minuta salva com sucesso!`);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError('Falha ao salvar a minuta.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    // Efeito para carregar dados estáticos (setores e tipos de minuta) uma única vez.
    useEffect(() => {
        const loadStaticData = async () => {
            if (!db || !userData || !(isAdmin || isSetorAdmin)) {
                setLoading(false);
                return;
            }
            setLoading(true);
            setError('');
            try {
                const [setoresSnapshot, configDoc] = await Promise.all([
                    db.collection('setores').orderBy('nome').get(),
                    db.collection('configuracoes').doc('minutas').get()
                ]);

                const setoresList = setoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSetores(setoresList);

                let tiposList = [];
                if (configDoc.exists) {
                    tiposList = configDoc.data().tipos.sort((a, b) => a.nome.localeCompare(b.nome));
                } else {
                    console.warn("Documento de configuração de minutas não encontrado. A lista pode estar vazia.");
                }
                if (tiposList.length > 0) {
                    tiposList.unshift({ id: 'exemplo_didatico', nome: 'Exemplo Didático (Modelo)' });
                }
                setTiposMinuta(tiposList);
                if (tiposList.length > 0) {
                    setSelectedTipoMinutaId(tiposList[0].id);
                }

                const initialSetorId = isSetorAdmin ? userData.setorId : (setoresList[0]?.id || '');
                setSelectedSetorId(initialSetorId);
            } catch (err) {
                setError('Falha ao carregar dados iniciais da página.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadStaticData();
    }, [db, userData, isAdmin, isSetorAdmin]);

    // Efeito para buscar o conteúdo das minutas para o setor selecionado, apenas se não estiver em cache.
    useEffect(() => {
        const fetchMinutasContent = async () => {
            if (!selectedSetorId || !db || tiposMinuta.length === 0 || loading) return;

            // Se os dados para este setor já estão em cache, não faz nova busca.
            if (minutasCache[selectedSetorId]) {
                return;
            }

            try {
                const minutasData = {};
                await Promise.all(tiposMinuta.map(async (tipo) => {
                    const docRef = db.collection('minutas').doc(`${selectedSetorId}_${tipo.id}`);
                    const doc = await docRef.get();
                    minutasData[tipo.id] = doc.exists ? doc.data().conteudo : (MINUTAS_PADRAO[tipo.id] || `<p>Modelo para ${tipo.nome}...</p>`);
                }));
                // Adiciona os dados ao cache.
                setMinutasCache(prevCache => ({ ...prevCache, [selectedSetorId]: minutasData }));
            } catch (err) {
                setError('Falha ao carregar minutas para o setor selecionado.');
                console.error(err);
            }
        };

        fetchMinutasContent();
    }, [selectedSetorId, tiposMinuta, loading, minutasCache]); // Dependências controladas

    const handleAddTipoMinuta = async (e) => {
        e.preventDefault();
        if (!novoTipoMinutaNome.trim()) return;
        const id = novoTipoMinutaNome.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
        if (!id) {
            setError("Nome inválido para o tipo de minuta.");
            return;
        }
    
        const configRef = db.collection('configuracoes').doc('minutas');
    
        try {
            // Usa uma transação para garantir a consistência
            await db.runTransaction(async (transaction) => {
                const configDoc = await transaction.get(configRef);
                const tipos = configDoc.exists ? configDoc.data().tipos : [];
                if (tipos.some(t => t.id === id)) throw new Error("ID_EXISTS");
                
                tipos.push({ id: id, nome: novoTipoMinutaNome.trim() });
                transaction.set(configRef, { tipos: tipos }, { merge: true });
            });
    
            // ATUALIZAÇÃO: Em vez de recarregar a página, atualiza o estado local.
            const novoTipo = { id: id, nome: novoTipoMinutaNome.trim() };
            setTiposMinuta(prevTipos => {
                const exemplo = prevTipos.find(t => t.id === 'exemplo_didatico');
                const outros = prevTipos.filter(t => t.id !== 'exemplo_didatico');
                const novosOutros = [novoTipo, ...outros].sort((a, b) => a.nome.localeCompare(b.nome));
                return exemplo ? [exemplo, ...novosOutros] : novosOutros;
            });
            setSelectedTipoMinutaId(id);
            setNovoTipoMinutaNome('');
            setSuccess('Novo tipo de minuta adicionado com sucesso!');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message === "ID_EXISTS" ? "Falha: Um tipo de minuta com esse ID já existe." : "Falha ao adicionar novo tipo de minuta.");
            console.error(err);
        }
    };

    const handleDeleteTipoMinuta = async (tipoId) => {
        if (window.confirm("Tem certeza que deseja excluir este tipo de minuta? Todas as minutas salvas deste tipo para todos os setores serão perdidas.")) {
            try {
                const configRef = db.collection('configuracoes').doc('minutas');
                await db.runTransaction(async (transaction) => {
                    const configDoc = await transaction.get(configRef);
                    if (!configDoc.exists) return;
                    const tipos = configDoc.data().tipos || [];
                    const novosTipos = tipos.filter(t => t.id !== tipoId);
                    transaction.update(configRef, { tipos: novosTipos });
                });
                // ATUALIZAÇÃO: Em vez de recarregar a página, atualiza o estado local.
                setTiposMinuta(prevTipos => {
                    const newTipos = prevTipos.filter(t => t.id !== tipoId);
                    if (selectedTipoMinutaId === tipoId && newTipos.length > 0) {
                        setSelectedTipoMinutaId(newTipos[0].id);
                    }
                    return newTipos;
                });
                setSuccess('Tipo de minuta excluído com sucesso!');
            } catch (err) {
                setError("Falha ao excluir o tipo de minuta.");
                console.error(err);
            }
        }
    };

    // Novo componente de editor de texto rico, sem dependências externas
    const SimpleRichEditor = ({ initialValue, onRef }) => {
        const internalRef = useRef(null);

        const setRefs = useCallback((el) => {
            internalRef.current = el;
            if (onRef) onRef(el);
        }, [onRef]);

        const handleCommand = (command, value = null) => {
            document.execCommand(command, false, value);
            if (internalRef.current) internalRef.current.focus();
        };

        const insertPlaceholder = (placeholder) => {
            if (internalRef.current) {
                internalRef.current.focus();
                const success = document.execCommand('insertText', false, placeholder);
                if (!success) {
                    const selection = window.getSelection();
                    if (selection.rangeCount) {
                        const range = selection.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(document.createTextNode(placeholder));
                        range.collapse(false);
                    }
                }
            }
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

        const placeholders = [
            { label: 'Nº Processo', value: '{{numeroProcesso}}' },
            { label: 'Data Disp.', value: '{{dataDisponibilizacao}}' },
            { label: 'Data Pub.', value: '{{dataPublicacao}}' },
            { label: 'Início Prazo', value: '{{inicioPrazo}}' },
            { label: 'Prazo (dias)', value: '{{prazoDias}}' },
            { label: 'Prazo Final', value: '{{prazoFinal}}' },
            { label: 'Data Interp.', value: '{{dataInterposicao}}' },
            { label: 'Mov. Acórdão', value: '{{movAcordao}}' },
            { label: 'Câmara', value: '{{camara}}' },
            { label: 'Recurso', value: '{{recursoApelacao}}' },
            { label: 'Mov. Intimação', value: '{{movIntimacao}}' },
            { label: 'Mov. Despacho', value: '{{movDespacho}}' },
            { label: 'Mov. Certidão', value: '{{movCertidao}}' },
        ];

        return (
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg">
                <div className="p-2 border-b border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 rounded-t-lg">
                    <div className="flex flex-wrap items-center gap-1 mb-2">
                        {toolbarButtons.map(({ command, icon, title }) => (
                            <button key={command} title={title} onClick={() => handleCommand(command)} type="button" className="w-8 h-8 rounded text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-lg flex items-center justify-center transition-colors">
                                {icon}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inserir Campo:</span>
                        {placeholders.map(ph => (
                            <button 
                                key={ph.value} 
                                onClick={() => insertPlaceholder(ph.value)}
                                className="px-2 py-1 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
                                title={`Inserir ${ph.label}`}
                            >
                                {ph.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div
                    ref={setRefs}
                    contentEditable={true}
                    dangerouslySetInnerHTML={{ __html: initialValue }}
                    className="p-6 h-96 overflow-y-auto focus:outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    style={{ fontFamily: 'Arial, sans-serif', fontSize: '14pt', lineHeight: '1.5' }}
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
                    <li><strong>Use Placeholders:</strong> Para dados que mudam a cada processo (como número do processo, datas, etc.), use placeholders no formato <code>{"{{placeholder}}"}</code>. Ex: <code>{"{{numeroProcesso}}"}</code>, <code>{"{{dataPublicacao}}"}</code>. Estes serão substituídos automaticamente ao gerar o documento na calculadora. Veja o "Exemplo Didático" para uma lista de placeholders disponíveis.</li>
                    <li><strong>Salve a Minuta:</strong> Após editar, clique em "Salvar Minuta". O modelo ficará salvo para o setor selecionado.</li>
                    <li><strong>Gerar Documento:</strong> Na tela da Calculadora, após fazer um cálculo e analisar a tempestividade, os botões para baixar as minutas aparecerão. Ao clicar, o sistema usará o modelo salvo para gerar um arquivo `.doc` com os dados do cálculo.</li>
                </ol>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(isAdmin || isSetorAdmin) && (
                    <div className="p-4 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg space-y-2">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Criar Novo Modelo de Minuta</h3>
                        <form onSubmit={handleAddTipoMinuta} className="flex items-center gap-2">
                            <input type="text" placeholder="Nome (ex: Agravo Interno)" value={novoTipoMinutaNome} onChange={e => setNovoTipoMinutaNome(e.target.value)} className="flex-grow p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700" />
                            <button type="submit" className="px-3 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Criar</button>
                        </form>
                    </div>
                )}
                
                {isAdmin && (
                    <div className="p-4 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg space-y-2">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Selecione o Setor</label>
                        <select value={selectedSetorId} onChange={e => setSelectedSetorId(e.target.value)} className="w-full p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700">
                            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {loading ? (
                <p className="text-center text-slate-500 dark:text-slate-400">Carregando minutas...</p>
            ) : error ? (
                <p className="text-red-500">{error}</p>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6 mt-4">
                    {/* Sidebar: List of Types */}
                    <div className="lg:w-1/4 flex flex-col gap-2">
                        {tiposMinuta.map(tipo => (
                            <button
                                key={tipo.id}
                                onClick={() => setSelectedTipoMinutaId(tipo.id)}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all flex justify-between items-center group ${
                                    selectedTipoMinutaId === tipo.id 
                                    ? 'bg-indigo-600 text-white shadow-md transform scale-[1.02]' 
                                    : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                <span className="truncate font-medium text-sm">{tipo.nome}</span>
                                {isAdmin && tipo.id !== 'exemplo_didatico' && (
                                    <span 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteTipoMinuta(tipo.id); }} 
                                        title="Excluir" 
                                        className={`px-2 rounded hover:bg-red-500 hover:text-white transition-colors ${selectedTipoMinutaId === tipo.id ? 'text-indigo-200' : 'text-slate-400'}`}
                                    >
                                        &times;
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Editor Area */}
                    <div className="lg:w-3/4">
                        {tiposMinuta.map(tipo => minutasCache[selectedSetorId] && (
                            <div key={tipo.id} className={`${selectedTipoMinutaId === tipo.id ? 'block animate-fade-in' : 'hidden'} bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden`}>
                                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{tipo.nome}</h3>
                                    {tipo.id !== 'exemplo_didatico' && (
                                        <button onClick={() => handleSave(tipo.id)} disabled={saving} className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-all flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                                        </button>
                                    )}
                                </div>
                                <div className="p-4">
                                    <SimpleRichEditor
                                        initialValue={minutasCache[selectedSetorId][tipo.id]}
                                        onRef={el => editorRefs.current[tipo.id] = el}
                                    />
                                </div>
                            </div>
                        ))}
                        {tiposMinuta.length === 0 && <p className="text-center text-slate-500 mt-10">Nenhum tipo de minuta disponível.</p>}
                    </div>
                </div>
            )}
            {success && <div className="fixed bottom-4 right-4 p-4 text-sm text-white bg-green-600 rounded-lg shadow-lg animate-fade-in">{success}</div>}
        </div>
    );
};