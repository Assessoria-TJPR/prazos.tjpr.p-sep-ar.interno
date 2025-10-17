const { useState, useEffect, useCallback } = React;

const BugReportsPage = () => {
    const [chamados, setChamados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchChamados = useCallback(async () => {
        if (!db) return;
        setLoading(true);
        try {
            const reportsSnapshot = await db.collection('bug_reports').orderBy('createdAt', 'desc').get();
            const reportsList = reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const userIds = [...new Set(reportsList.map(r => r.userId))];
            if (userIds.length > 0) {
                const usersSnapshot = await db.collection('users').where(firebase.firestore.FieldPath.documentId(), 'in', userIds).get();
                const usersMap = usersSnapshot.docs.reduce((acc, doc) => {
                    acc[doc.id] = doc.data().displayName;
                    return acc;
                }, {});
                const enrichedReports = reportsList.map(r => ({ ...r, reporterName: usersMap[r.userId] || r.userEmail }));
                setChamados(enrichedReports);
            } else {
                setChamados([]);
            }
        } catch (err) {
            console.error("Erro ao buscar chamados:", err);
            setError("Falha ao carregar chamados.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchChamados();
    }, [fetchChamados]);

    const handleDeleteChamado = async (chamadoId) => {
        if (window.confirm("Tem certeza que deseja excluir este chamado permanentemente? Esta ação não pode ser desfeita.")) {
            if (!db) return;
            try {
                await db.collection('bug_reports').doc(chamadoId).delete();
                fetchChamados(); // Recarrega a lista
            } catch (err) {
                console.error("Erro ao excluir chamado:", err);
                alert("Falha ao excluir o chamado.");
            }
        }
    };

    const viewScreenshot = (base64String) => {
        const newWindow = window.open();
        if (newWindow) {
            newWindow.document.write(`
                <html>
                    <head><title>Visualizador de Screenshot</title></head>
                    <body style="margin:0; background-color:#1e293b; display:flex; justify-content:center; align-items:center;">
                        <img src="${base64String}" alt="Screenshot do Chamado" style="max-width:100%; max-height:100%; object-fit:contain;">
                    </body>
                </html>
            `);
            newWindow.document.close();
        } else {
            alert('O visualizador de imagem foi bloqueado pelo seu navegador. Por favor, habilite os pop-ups para este site.');
        }
    };

    const handleUpdateStatus = async (chamado, newStatus) => {
        if (!db) return;
        try {
            await db.collection('bug_reports').doc(chamado.id).update({ status: newStatus, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            fetchChamados();
        } catch (err) {
            console.error("Erro ao atualizar status:", err);
            alert("Falha ao atualizar o status do chamado.");
        }
    };

    if (loading) return <p>Carregando chamados...</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">Caixa de Chamados de Problemas</h2>
            <div className="space-y-4">
                {chamados.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400">Nenhum chamado encontrado.</p>
                ) : (
                    chamados.map(chamado => (
                        <div key={chamado.id} className={`p-4 rounded-lg border ${chamado.status === 'aberto' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Reportado por: <span className="font-medium text-slate-700 dark:text-slate-200">{chamado.reporterName}</span></p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">Em: {chamado.createdAt ? formatarData(new Date(chamado.createdAt.toDate())) : 'Data indisponível'}</p>
                                </div>
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${chamado.status === 'aberto' ? 'bg-amber-200 text-amber-800 dark:bg-amber-500/30 dark:text-amber-300' : 'bg-green-200 text-green-800 dark:bg-green-500/30 dark:text-green-300'}`}>
                                    {chamado.status}
                                </span>
                            </div>
                            <p className="mt-4 text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-md">{chamado.description}</p>
                            <div className="mt-4 flex flex-wrap gap-4 items-center">
                                <button onClick={() => viewScreenshot(chamado.screenshotBase64)} className="text-sm font-semibold text-indigo-600 hover:underline">
                                    Ver Screenshot
                                </button>
                                {chamado.status === 'aberto' ? (
                                    <button onClick={() => handleUpdateStatus(chamado, 'resolvido')} className="px-3 py-1 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700">Marcar como Resolvido</button>
                                ) : (
                                    <button onClick={() => handleUpdateStatus(chamado, 'aberto')} className="px-3 py-1 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700">Reabrir Chamado</button>
                                )}
                                <button onClick={() => handleDeleteChamado(chamado.id)} className="text-sm font-semibold text-red-600 hover:underline">
                                    Excluir
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};