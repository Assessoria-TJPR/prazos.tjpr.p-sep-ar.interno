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