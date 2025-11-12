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
    const resultadoSemDecreto = calcularPrazoFinalDiasCorridos(inicioDoPrazoSemDecreto, prazoNumerico, new Set(), false);

    // Cenário 2: Com comprovação. Inicia igual ao cenário 1.
    // Será recalculado na UI quando o usuário marcar as checkboxes.
    const resultadoComDecretoInicial = { ...resultadoSemDecreto };

    // Identifica suspensões comprováveis APENAS no início e no fim do prazo.
    const suspensoesParaUI = [];
    const filtroComprovavel = (tipo) => tipo === 'decreto' || tipo === 'instabilidade' || tipo === 'feriado_cnj';

    const suspensaoNoInicio = getMotivoDiaNaoUtil(inicioDoPrazoSemDecreto, true);
    if (suspensaoNoInicio && filtroComprovavel(suspensaoNoInicio.tipo)) {
        suspensoesParaUI.push({ data: new Date(inicioDoPrazoSemDecreto.getTime()), ...suspensaoNoInicio });
    }

    const suspensaoNoFim = getMotivoDiaNaoUtil(resultadoSemDecreto.prazoFinal, true);
    if (suspensaoNoFim && filtroComprovavel(suspensaoNoFim.tipo)) {
        suspensoesParaUI.push({ data: new Date(resultadoSemDecreto.prazoFinal.getTime()), ...suspensaoNoFim });
    }

    const suspensoesRelevantesMap = new Map();
    suspensoesParaUI.forEach(suspensao => {
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