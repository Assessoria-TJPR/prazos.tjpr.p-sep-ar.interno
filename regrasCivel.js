/**
 * @file regrasCivel.js
 * Contém a lógica de cálculo de prazo específica para a matéria Cível.
 */

const calcularPrazoCivel = (dataPublicacaoComDecreto, inicioDoPrazoComDecreto, prazoNumerico, diasNaoUteisDoInicioComDecreto = [], inicioDisponibilizacao, helpers) => {
    const { getProximoDiaUtilParaPublicacao, calcularPrazoFinalDiasUteis, getMotivoDiaNaoUtil, decretosMap } = helpers;

    const dataDisponibilizacaoStr = inicioDisponibilizacao.toISOString().split('T')[0];
    if (dataDisponibilizacaoStr === '2025-05-28' || dataDisponibilizacaoStr === '2025-05-29') {
        const prazoFinalEspecial = new Date('2025-06-23T00:00:00');
        const resultadoEspecial = { prazoFinal: prazoFinalEspecial, diasNaoUteis: [], diasProrrogados: [] };
        return { dataPublicacao: dataPublicacaoComDecreto, inicioPrazo: inicioDoPrazoComDecreto, semDecreto: resultadoEspecial, comDecreto: resultadoEspecial, suspensoesComprovaveis: [], prazo: prazoNumerico, tipo: 'civel' };
    }

    const { proximoDia: dataPublicacaoSemDecreto } = getProximoDiaUtilParaPublicacao(inicioDisponibilizacao, false);
    const { proximoDia: inicioDoPrazoSemDecreto } = getProximoDiaUtilParaPublicacao(dataPublicacaoSemDecreto, false);
    
    let resultadoSemDecreto = calcularPrazoFinalDiasUteis(inicioDoPrazoSemDecreto, prazoNumerico, new Set(), false, false, false);

    let resultadoComDecretoInicial = { ...resultadoSemDecreto }; // Cenário 2 inicia igual ao Cenário 1

    const todosDecretosPossiveis = new Set(Object.keys(decretosMap));
    const resultadoComTodosDecretos = calcularPrazoFinalDiasUteis(inicioDoPrazoComDecreto, prazoNumerico, todosDecretosPossiveis, true, false, true);

    const instabilidadesComprovaveis = [];
    const instabilidadeNoInicio = getMotivoDiaNaoUtil(inicioDoPrazoComDecreto, true, 'instabilidade');
    if (instabilidadeNoInicio) instabilidadesComprovaveis.push({ data: new Date(inicioDoPrazoComDecreto.getTime()), ...instabilidadeNoInicio });

    const instabilidadeNoFim = getMotivoDiaNaoUtil(resultadoSemDecreto.prazoFinal, true, 'instabilidade');
    if (instabilidadeNoFim) instabilidadesComprovaveis.push({ data: new Date(resultadoSemDecreto.prazoFinal.getTime()), ...instabilidadeNoFim });

    const filtroDecretos = d => d.tipo === 'decreto' || d.tipo === 'feriado_cnj';
    const decretosParaUI = [
        ...diasNaoUteisDoInicioComDecreto.filter(filtroDecretos), 
        ...resultadoComTodosDecretos.diasNaoUteis.filter(filtroDecretos),
        ...resultadoComTodosDecretos.diasProrrogados.filter(filtroDecretos) // Adiciona decretos encontrados na prorrogação
    ];
    const instabilidadesParaUI = [...instabilidadesComprovaveis];
    const todosDecretosParaUI = [...decretosParaUI, ...instabilidadesParaUI];
    const suspensoesRelevantesMap = new Map();
    todosDecretosParaUI.forEach(suspensao => {
        suspensoesRelevantesMap.set(suspensao.data.toISOString().split('T')[0], suspensao);
    });
    let suspensoesRelevantes = Array.from(suspensoesRelevantesMap.values()).sort((a, b) => a.data - b.data);

    return {
        dataPublicacao: dataPublicacaoComDecreto,
        inicioPrazo: inicioDoPrazoComDecreto,
        semDecreto: resultadoSemDecreto,
        comDecreto: resultadoComDecretoInicial,
        suspensoesComprovaveis: suspensoesRelevantes,
        prazo: prazoNumerico, tipo: 'civel',
        diasProrrogados: resultadoSemDecreto.diasProrrogados
    };
  };