/**
 * @file regrasCrime.js
 * Contém a lógica de cálculo de prazo específica para a matéria de Crime.
 * REGRA: A contagem é em dias corridos. Decretos e instabilidades só são relevantes
 * (e precisam de comprovação) se ocorrerem no dia do início ou no dia do vencimento do prazo.
 */

const calcularPrazoCrimeComprovavel = (dataPublicacaoComDecreto, inicioDoPrazoComDecreto, prazoNumerico, diasNaoUteisDoInicioComDecreto = [], inicioDisponibilizacao, helpers) => {
    const { getProximoDiaUtilParaPublicacao, calcularPrazoFinalDiasCorridos, getMotivoDiaNaoUtil } = helpers;

    // Cenário 1: Sem comprovação de decretos/instabilidades.
    // O início e o fim são prorrogados apenas por feriados/recesso/fim de semana. Decretos/instabilidades são ignorados.
    const { proximoDia: dataPublicacaoSemDecreto, suspensoesEncontradas: suspensoesNaPublicacao } = getProximoDiaUtilParaPublicacao(inicioDisponibilizacao, false);
    const { proximoDia: inicioDoPrazoSemDecreto, suspensoesEncontradas: suspensoesNoInicio } = getProximoDiaUtilParaPublicacao(dataPublicacaoSemDecreto, false);
    const resultadoSemDecreto = calcularPrazoFinalDiasCorridos(inicioDoPrazoSemDecreto, prazoNumerico, new Set(), true);

    // Cenário 2: Com comprovação. Inicia igual ao cenário 1.
    // Será recalculado na UI quando o usuário marcar as checkboxes.
    const resultadoComDecretoInicial = { ...resultadoSemDecreto };

    // Identifica suspensões comprováveis: as do início e todas as que causaram a prorrogação do prazo final.
    const filtroComprovavel = (tipo) => tipo === 'decreto' || tipo === 'instabilidade' || tipo === 'feriado_cnj' || tipo === 'suspensao_outubro';
    
    // CORREÇÃO: Inicia a lista de suspensões com os itens comprováveis encontrados no início do prazo.
    const suspensoesParaUI = diasNaoUteisDoInicioComDecreto.filter(s => filtroComprovavel(s.tipo));

    // Adiciona todos os dias da prorrogação inicial à lista de comprováveis.
    (resultadoSemDecreto.diasProrrogados || []).forEach(dia => {
        if (filtroComprovavel(dia.tipo)) suspensoesParaUI.push(dia);
    });

    // Garante que, se o próprio dia do vencimento (após a prorrogação inicial) for uma suspensão,
    // ele também seja adicionado à lista para comprovação.
    const suspensaoNoFimProrrogado = getMotivoDiaNaoUtil(resultadoSemDecreto.prazoFinalProrrogado, true);
    if (suspensaoNoFimProrrogado && filtroComprovavel(suspensaoNoFimProrrogado.tipo)) {
        suspensoesParaUI.push({ data: new Date(resultadoSemDecreto.prazoFinalProrrogado.getTime()), ...suspensaoNoFimProrrogado });
    }

    const suspensoesRelevantesMap = new Map();
    suspensoesParaUI.forEach(suspensao => { // Usa a lista corrigida
        suspensoesRelevantesMap.set(suspensao.data.toISOString().split('T')[0], suspensao);
    });
    const suspensoesRelevantes = Array.from(suspensoesRelevantesMap.values()).sort((a, b) => a.data - b.data);

    return {
        dataPublicacao: dataPublicacaoSemDecreto,
        inicioPrazo: inicioDoPrazoSemDecreto,
        semDecreto: resultadoSemDecreto,
        comDecreto: resultadoComDecretoInicial,
        suspensoesComprovaveis: suspensoesRelevantes,
        prazo: prazoNumerico,
        tipo: 'crime'
    };
};