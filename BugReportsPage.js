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
                fetchChamados();
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

    if (loading) {
        return (
            <TJPRCard title="Caixa de Chamados de Problemas" icon="bug_report">
                <div className="text-center py-8">
                    <span className="material-icons text-4xl text-gray-400 animate-spin">refresh</span>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Carregando chamados...</p>
                </div>
            </TJPRCard>
        );
    }

    if (error) {
        return (
            <TJPRCard title="Caixa de Chamados de Problemas" icon="bug_report">
                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-tjpr-error p-4 rounded">
                    <div className="flex items-center gap-2">
                        <span className="material-icons text-tjpr-error">error</span>
                        <p className="text-sm text-tjpr-error font-medium">{error}</p>
                    </div>
                </div>
            </TJPRCard>
        );
    }

    return (
        <TJPRCard
            title="Caixa de Chamados de Problemas"
            subtitle={`${chamados.length} ${chamados.length === 1 ? 'chamado encontrado' : 'chamados encontrados'}`}
            icon="bug_report"
        >
            <div className="space-y-4">
                {chamados.length === 0 ? (
                    <div className="text-center py-12">
                        <span className="material-icons text-6xl text-gray-300 dark:text-gray-700">check_circle</span>
                        <p className="mt-4 text-gray-500 dark:text-gray-400">Nenhum chamado encontrado.</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500">Tudo certo por aqui! 🎉</p>
                    </div>
                ) : (
                    chamados.map(chamado => (
                        <div key={chamado.id} className={`p-5 rounded-lg border transition-all duration-200 ${chamado.status === 'aberto'
                                ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 hover:shadow-md'
                                : 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 hover:shadow-sm'
                            }`}>
                            {/* Header do Chamado */}
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="material-icons text-sm text-gray-500">person</span>
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{chamado.reporterName}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons text-xs text-gray-400">schedule</span>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {chamado.createdAt ? formatarData(new Date(chamado.createdAt.toDate())) : 'Data indisponível'}
                                        </p>
                                    </div>
                                </div>
                                <TJPRBadge
                                    variant={chamado.status === 'aberto' ? 'warning' : 'success'}
                                    icon={chamado.status === 'aberto' ? 'pending' : 'check_circle'}
                                >
                                    {chamado.status === 'aberto' ? 'Aberto' : 'Resolvido'}
                                </TJPRBadge>
                            </div>

                            {/* Descrição do Problema */}
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                                <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{chamado.description}</p>
                            </div>

                            {/* Actions */}
                            <div className="mt-4 flex flex-wrap gap-3 items-center">
                                <TJPRButton
                                    onClick={() => viewScreenshot(chamado.screenshotBase64)}
                                    variant="ghost"
                                    size="sm"
                                    icon="image"
                                >
                                    Ver Screenshot
                                </TJPRButton>

                                {chamado.status === 'aberto' ? (
                                    <TJPRButton
                                        onClick={() => handleUpdateStatus(chamado, 'resolvido')}
                                        variant="success"
                                        size="sm"
                                        icon="check_circle"
                                    >
                                        Marcar como Resolvido
                                    </TJPRButton>
                                ) : (
                                    <TJPRButton
                                        onClick={() => handleUpdateStatus(chamado, 'aberto')}
                                        variant="warning"
                                        size="sm"
                                        icon="refresh"
                                    >
                                        Reabrir Chamado
                                    </TJPRButton>
                                )}

                                <TJPRButton
                                    onClick={() => handleDeleteChamado(chamado.id)}
                                    variant="error"
                                    size="sm"
                                    icon="delete"
                                >
                                    Excluir
                                </TJPRButton>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </TJPRCard>
    );
};