/**
 * @file utils.js
 * Contém funções auxiliares reutilizáveis em toda a aplicação.
 */

const formatarData = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date)) return '';

    const dia = String(date.getUTCDate()).padStart(2, '0');
    const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
    const ano = date.getUTCFullYear();

    return `${dia}/${mes}/${ano}`;
};

/**
 * Agrupa dias não úteis consecutivos, especialmente para o recesso forense.
 * @param {Array<object>} dias - Array de objetos de dias não úteis.
 * @returns {Array<object>} Array com os dias agrupados.
 */
const agruparDiasConsecutivos = (dias) => {
    if (!dias || dias.length === 0) return [];

    const diasOrdenados = [...dias].sort((a, b) => a.data - b.data);
    const agrupados = [];
    let grupoRecesso = null;

    for (const dia of diasOrdenados) {
        if (dia.tipo === 'recesso') {
            if (grupoRecesso) {
                const ultimoDiaDoGrupo = new Date(grupoRecesso.fim.getTime());
                ultimoDiaDoGrupo.setDate(ultimoDiaDoGrupo.getDate() + 1);

                if (ultimoDiaDoGrupo.getTime() === dia.data.getTime()) {
                    grupoRecesso.fim = dia.data;
                } else {
                    agrupados.push(grupoRecesso);
                    grupoRecesso = { id: dia.data.toISOString(), inicio: dia.data, fim: dia.data, tipo: 'recesso' };
                }
            } else {
                grupoRecesso = { id: dia.data.toISOString(), inicio: dia.data, fim: dia.data, tipo: 'recesso' };
            }
        } else {
            if (grupoRecesso) {
                agrupados.push(grupoRecesso);
                grupoRecesso = null;
            }
            agrupados.push(dia);
        }
    }
    if (grupoRecesso) agrupados.push(grupoRecesso);
    return agrupados.map(item => item.tipo === 'recesso' ? { ...item, tipo: 'recesso_grouped', motivo: `Recesso de ${formatarData(item.inicio)} até ${formatarData(item.fim)}` } : item);
};

/**
 * Registra uma ação no log de auditoria do sistema.
 * @param {object} db - Instância do Firestore.
 * @param {object} user - Objeto do usuário atual (auth.currentUser).
 * @param {string} action - Nome da ação (ex: 'EDITAR_CALENDARIO').
 * @param {string} details - Detalhes da ação.
 */
const logAudit = async (supabase, user, action, details) => {
    if (!supabase || !user) return;
    try {
        await supabase.from('audit_logs').insert({
            action,
            admin_id: user.id,
            admin_name: user.email,
            details: typeof details === 'object' ? details : { message: details },
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error("Erro ao registrar auditoria:", e);
    }
};

// Expondo globalmente para uso em outros componentes (Babel-in-browser legacy)
window.formatarData = formatarData;
window.agruparDiasConsecutivos = agruparDiasConsecutivos;
window.logAudit = logAudit;