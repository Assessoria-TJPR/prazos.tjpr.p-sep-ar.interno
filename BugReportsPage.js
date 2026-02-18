const { useState, useEffect, useCallback } = React;

const BugReportsPage = () => {
    const [chamados, setChamados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('aberto'); // Estado para a aba ativa

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

    const [selectedImage, setSelectedImage] = useState(null);

    const viewScreenshot = (base64String) => {
        setSelectedImage(base64String);
    };

    const closeScreenshotModal = () => {
        setSelectedImage(null);
    };

    // Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Filter logic
    const filteredChamados = chamados.filter(report => {
        if (activeTab === 'aberto') return report.status === 'aberto';
        if (activeTab === 'resolvido') return report.status === 'resolvido';
        return true;
    });

    // Reset page when reports change (e.g. filter)
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, chamados]); // Reset page on tab change too

    const totalPages = Math.ceil(filteredChamados.length / itemsPerPage);
    const paginatedReports = filteredChamados.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleUpdateStatus = async (chamado, newStatus) => {
        if (!db) return;
        try {
            await db.collection('bug_reports').doc(chamado.id).update({ status: newStatus, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });

            // Notification Logic
            if (newStatus === 'resolvido' && chamado.userId) {
                try {
                    await db.collection('notifications').add({
                        userId: chamado.userId,
                        message: `O seu reporte: "${chamado.description.substring(0, 40)}${chamado.description.length > 40 ? '...' : ''}" foi marcado como resolvido.`,
                        read: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        type: 'bug_resolved',
                        link: '/bug-reports' // Contextual link, though navigation handles it
                    });
                } catch (notifError) {
                    console.error("Erro ao criar notificação:", notifError);
                    // Non-blocking error
                }
            }

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
        <>
            <TJPRCard
                title="Caixa de Chamados de Problemas"
                subtitle="Gerencie os chamados e feedbacks dos usuários."
                icon="bug_report"
                actions={
                    <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('aberto')}
                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${activeTab === 'aberto' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            Em Aberto
                            <span className={`px-1.5 py-0.5 text-xs rounded-full ${activeTab === 'aberto' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                                {chamados.filter(c => c.status === 'aberto').length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('resolvido')}
                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${activeTab === 'resolvido' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                        >
                            Finalizados
                            <span className={`px-1.5 py-0.5 text-xs rounded-full ${activeTab === 'resolvido' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                                {chamados.filter(c => c.status === 'resolvido').length}
                            </span>
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    {filteredChamados.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="material-icons text-6xl text-gray-300 dark:text-gray-700">{activeTab === 'aberto' ? 'check_circle' : 'search_off'}</span>
                            <p className="mt-4 text-gray-500 dark:text-gray-400">Nenhum chamado {activeTab === 'aberto' ? 'em aberto' : 'finalizado found'}.</p>
                        </div>
                    ) : (
                        <>
                            {paginatedReports.map(chamado => (
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

                                    {/* Detalhes do Contexto */}
                                    {(chamado.dataDisponibilizacao || chamado.prazo) && (
                                        <div className="mt-3 p-3 bg-slate-100 dark:bg-slate-900/50 rounded-md border border-slate-200 dark:border-slate-700 text-sm">
                                            <p className="font-semibold text-xs text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Dados da Calculadora</p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-2 gap-x-4">
                                                {chamado.dataDisponibilizacao && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-icons text-slate-400 text-base">event</span>
                                                        <span className="text-slate-700 dark:text-slate-300">
                                                            <span className="font-medium">Disp:</span> {chamado.dataDisponibilizacao.split('-').reverse().join('/')}
                                                        </span>
                                                    </div>
                                                )}
                                                {chamado.prazo && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-icons text-slate-400 text-base">timer</span>
                                                        <span className="text-slate-700 dark:text-slate-300">
                                                            <span className="font-medium">Prazo:</span> {chamado.prazo} dias
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <span className="material-icons text-slate-400 text-base">gavel</span>
                                                    <span className={`font-medium ${chamado.isCrime ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                                        {chamado.isCrime ? 'Criminal' : 'Cível'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

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
                            ))}

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex justify-center items-center gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                        title="Página Anterior"
                                    >
                                        <span className="material-icons text-gray-600 dark:text-gray-300">chevron_left</span>
                                    </button>

                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                        Página {currentPage} de {totalPages}
                                    </span>

                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                        title="Próxima Página"
                                    >
                                        <span className="material-icons text-gray-600 dark:text-gray-300">chevron_right</span>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </TJPRCard>

            <TJPRModal
                isOpen={!!selectedImage}
                onClose={closeScreenshotModal}
                title="Visualizador de Screenshot"
                icon="image"
                maxWidth="4xl"
            >
                <div className="flex justify-center items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-2">
                    <img
                        src={selectedImage}
                        alt="Screenshot do Chamado"
                        className="max-w-full max-h-[70vh] object-contain rounded shadow-sm"
                    />
                </div>
                <div className="mt-4 flex justify-end">
                    <TJPRButton
                        onClick={closeScreenshotModal}
                        variant="secondary"
                    >
                        Fechar Visualização
                    </TJPRButton>
                </div>
            </TJPRModal>
        </>
    );
};