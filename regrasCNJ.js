/**
 * @file regrasCNJ.js
 * Centraliza a lógica de negócio específica para os feriados do CNJ,
 * como Corpus Christi e a suspensão subsequente.
 */

/**
 * Datas dos feriados do CNJ para o ano de 2025.
 * @constant {string}
 */
const DATA_CORPUS_CHRISTI = '2025-06-19';
const DATA_POS_CORPUS_CHRISTI = '2025-06-20';

/**
 * Modifica os mapas de feriados e decretos para garantir que Corpus Christi
 * seja tratado como um "feriado_cnj" que exige comprovação.
 * @param {object} feriados - O mapa de feriados carregado.
 * @param {object} decretos - O mapa de decretos carregado.
 */
const aplicarRegraEspecialCorpusChristi = (feriados, decretos) => {
    // Remove a data do mapa de feriados para forçar o tratamento como "feriado_cnj".
    delete feriados[DATA_CORPUS_CHRISTI];

    // Adiciona/sobrescreve as datas no mapa de decretos com um tipo especial.
    decretos[DATA_CORPUS_CHRISTI] = { motivo: 'Corpus Christi', tipo: 'feriado_cnj' };
    decretos[DATA_POS_CORPUS_CHRISTI] = { motivo: 'Suspensão de expediente (pós Corpus Christi)', tipo: 'feriado_cnj' };
};

/**
 * Verifica se um dia de decreto é um feriado CNJ e se deve ser considerado
 * dia não útil com base na comprovação.
 * @param {object} eDecreto - O objeto do decreto.
 * @param {string} dataCorrenteStr - A data atual no formato 'YYYY-MM-DD'.
 * @param {Set<string>} comprovados - O conjunto de datas comprovadas pelo usuário.
 * @returns {object|null} O objeto do decreto se for um dia não útil, caso contrário null.
 */
const tratarFeriadoCnjNoPrazo = (eDecreto, dataCorrenteStr, comprovados) => {
    if (eDecreto.tipo === 'feriado_cnj') {
        // RESTAURAÇÃO: Feriados do CNJ que ocorrem no meio do prazo só devem
        // ser contados como dia não útil se forem explicitamente comprovados pelo usuário.
        return comprovados.has(dataCorrenteStr) ? eDecreto : null;
    }
    // Decretos normais são contados automaticamente.
    return eDecreto;
};

/**
 * Agrupa as checkboxes de Corpus Christi (19/06) e do dia seguinte (20/06)
 * para que funcionem como uma única seleção na interface.
 * @param {Set<string>} diasComprovados - O conjunto de dias atualmente comprovados.
 * @returns {Set<string>} O novo conjunto de dias comprovados.
 */
const agruparComprovacaoCorpusChristi = (diasComprovados) => {
    const novosComprovados = new Set(diasComprovados);
    // Se um dos dias relacionados já estiver marcado, desmarca ambos. Caso contrário, marca ambos.
    if (novosComprovados.has(DATA_CORPUS_CHRISTI) || novosComprovados.has(DATA_POS_CORPUS_CHRISTI)) {
        novosComprovados.delete(DATA_CORPUS_CHRISTI);
        novosComprovados.delete(DATA_POS_CORPUS_CHRISTI);
    } else {
        novosComprovados.add(DATA_CORPUS_CHRISTI);
        novosComprovados.add(DATA_POS_CORPUS_CHRISTI);
    }
    return novosComprovados;
};