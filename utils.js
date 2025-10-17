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