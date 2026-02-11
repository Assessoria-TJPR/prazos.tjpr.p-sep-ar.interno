/**
 * @file migration-scripts.js
 * Contém scripts para migração de dados no Firestore.
 * Estes scripts devem ser executados manualmente no console do navegador
 * quando logado como um administrador com acesso total ao banco de dados.
 */

/**
 * Migra os tipos de minuta da coleção 'minutaTipos' para um único
 * documento em 'configuracoes/minutas'.
 * 
 * COMO USAR:
 * 1. Faça login na aplicação como um usuário 'admin'.
 * 2. Abra o console de desenvolvedor do navegador (F12).
 * 3. Copie e cole todo o código desta função no console.
 * 4. Pressione Enter para executar.
 * 5. Verifique o console para a mensagem de sucesso ou erro.
 */
const migrarTiposDeMinutaParaConfig = async () => {
    if (!db) {
        console.error("Firestore (db) não está inicializado.");
        return;
    }
    try {
        const tiposSnapshot = await db.collection('minutaTipos').get();
        const tipos = tiposSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        await db.collection('configuracoes').doc('minutas').set({ tipos: tipos });
        console.log("✅ Migração concluída com sucesso! Os tipos de minuta foram movidos para 'configuracoes/minutas'.");
    } catch (error) {
        console.error("❌ Erro durante a migração:", error);
    }
};