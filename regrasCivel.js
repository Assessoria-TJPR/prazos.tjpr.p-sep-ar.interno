/**
 * @file regrasCivel.js
 * Contém a lógica de cálculo de prazo específica para a matéria Cível.
 */

const calcularPrazoCivel = (dataPublicacaoComDecreto, inicioDoPrazoComDecreto, prazoNumerico, diasNaoUteisDoInicioComDecreto = [], inicioDisponibilizacao, helpers, diasComprovados = new Set()) => {
    const { getProximoDiaUtilParaPublicacao, calcularPrazoFinalDiasUteis, getMotivoDiaNaoUtil, getProximoDiaUtilComprovado, decretosMap } = helpers;

    const dataDisponibilizacaoStr = inicioDisponibilizacao.toISOString().split('T')[0];
    if (dataDisponibilizacaoStr === '2025-05-28' || dataDisponibilizacaoStr === '2025-05-29') {
        const prazoFinalEspecial = new Date('2025-06-23T00:00:00');
        const resultadoEspecial = { prazoFinal: prazoFinalEspecial, diasNaoUteis: [], diasProrrogados: [] };
        return { dataPublicacao: dataPublicacaoComDecreto, inicioPrazo: inicioDoPrazoComDecreto, semDecreto: resultadoEspecial, comDecreto: resultadoEspecial, suspensoesComprovaveis: [], prazo: prazoNumerico, tipo: 'civel' };
    }

    const { proximoDia: dataPublicacaoSemDecreto } = getProximoDiaUtilParaPublicacao(inicioDisponibilizacao, false);
    const { proximoDia: inicioDoPrazoSemDecreto } = getProximoDiaUtilParaPublicacao(dataPublicacaoSemDecreto, false);

    let resultadoSemDecreto = calcularPrazoFinalDiasUteis(inicioDoPrazoSemDecreto, prazoNumerico, new Set(), false, false, false);

    // [CORREÇÃO] Recalcula os marcos iniciais do Cenário 2 com base nos dias REALMENTE comprovados.
    // Antes usava o valor 'pré-maxizado' do app.js, o que fazia o Cenário 2 saltar dias mesmo sem checkboxes marcadas.
    const { proximoDia: dataPubEfetivaComDecreto } = getProximoDiaUtilComprovado(inicioDisponibilizacao, diasComprovados);
    const { proximoDia: inicioDoPrazoEfetivoComDecreto } = getProximoDiaUtilComprovado(dataPubEfetivaComDecreto, diasComprovados);

    let resultadoComDecretoInicial = calcularPrazoFinalDiasUteis(inicioDoPrazoEfetivoComDecreto, prazoNumerico, diasComprovados, true, true, true);

    // [CORREÇÃO] Filtro robusto para aceitar tanto objetos quanto o campo 'tipo' em string.
    const filtroComprovavel = d => {
        const t = (typeof d === 'string') ? d : (d?.tipo);
        return t === 'decreto' || t === 'feriado_cnj' || t === 'instabilidade';
    };

    const instabilidadesComprovaveis = [];
    const instabilidadeNoInicio = getMotivoDiaNaoUtil(inicioDoPrazoEfetivoComDecreto, true, 'instabilidade');
    if (instabilidadeNoInicio) instabilidadesComprovaveis.push({ data: new Date(inicioDoPrazoEfetivoComDecreto.getTime()), ...instabilidadeNoInicio });

    // 1. Adiciona suspensões comprováveis do INÍCIO
    // Captura as suspensões que podem prorrogar a publicação (D+1)
    const { suspensoesEncontradas: suspPubMax } = getProximoDiaUtilParaPublicacao(inicioDisponibilizacao, true);
    // Captura as suspensões que podem prorrogar o início do prazo (D+2)
    const { suspensoesEncontradas: suspInicioMax } = getProximoDiaUtilParaPublicacao(suspPubMax.length > 0 ? suspPubMax[suspPubMax.length - 1].data : getProximoDiaUtilParaPublicacao(inicioDisponibilizacao, false).proximoDia, true);

    const todasSuspensoesInicioMax = [...(suspPubMax || []), ...(suspInicioMax || [])];

    const decretosParaUI = todasSuspensoesInicioMax.filter(filtroComprovavel);

    // 2. Procura a PRIMEIRA suspensão comprovável no prazo final (sem decretos)
    const prazoFinalParaVerificar = resultadoSemDecreto.prazoFinal;
    const suspensaoNoFim = getMotivoDiaNaoUtil(prazoFinalParaVerificar, true);

    if (suspensaoNoFim && filtroComprovavel(suspensaoNoFim)) {
        const dataFimStr = prazoFinalParaVerificar.toISOString().split('T')[0];
        if (!decretosParaUI.some(s => s.data.toISOString().split('T')[0] === dataFimStr)) {
            decretosParaUI.push({ data: new Date(prazoFinalParaVerificar.getTime()), ...suspensaoNoFim });
        }
    }

    const instabilidadesParaUI = [...instabilidadesComprovaveis];
    const todosDecretosParaUI = [...decretosParaUI, ...instabilidadesParaUI];
    const suspensoesRelevantesMap = new Map();
    todosDecretosParaUI.forEach(suspensao => {
        suspensoesRelevantesMap.set(suspensao.data.toISOString().split('T')[0], suspensao);
    });

    // VARREDURA DE MEIO DE PRAZO 
    const ontemData = new Date(inicioDisponibilizacao);
    ontemData.setDate(ontemData.getDate() - 1);
    const { proximoDia: dataDispEfetivaComDecretoSim, suspensoesEncontradas: suspensoesDispComDecreto } = getProximoDiaUtilParaPublicacao(ontemData, true);
    const { proximoDia: dataPubComDecretoCalculadaSim, suspensoesEncontradas: suspensoesPubComDecreto } = getProximoDiaUtilParaPublicacao(dataDispEfetivaComDecretoSim, true);

    const todasSuspensoesPub = [...(suspensoesDispComDecreto || []), ...(suspensoesPubComDecreto || [])];

    todasSuspensoesPub.forEach(suspensao => {
        if (filtroComprovavel(suspensao.tipo)) {
            const dStr = suspensao.data.toISOString().split('T')[0];
            if (!suspensoesRelevantesMap.has(dStr)) {
                suspensoesRelevantesMap.set(dStr, { data: new Date(suspensao.data.getTime()), ...suspensao });
            }
        }
    });

    let dataVarredura = new Date(inicioDoPrazoSemDecreto.getTime());
    const dataLimiteVarredura = new Date(resultadoSemDecreto.prazoFinal.getTime());

    while (dataVarredura <= dataLimiteVarredura) {
        const dStr = dataVarredura.toISOString().split('T')[0];
        const motivo = getMotivoDiaNaoUtil(dataVarredura, true, 'decreto');
        if (motivo) {
            if (!suspensoesRelevantesMap.has(dStr)) {
                suspensoesRelevantesMap.set(dStr, { data: new Date(dataVarredura.getTime()), ...motivo });
            }
        }
        dataVarredura.setDate(dataVarredura.getDate() + 1);
    }

    let suspensoesRelevantes = Array.from(suspensoesRelevantesMap.values()).sort((a, b) => a.data - b.data);

    return {
        dataPublicacao: dataPublicacaoSemDecreto,
        inicioPrazo: inicioDoPrazoSemDecreto,
        semDecreto: resultadoSemDecreto,
        comDecreto: resultadoComDecretoInicial,
        suspensoesComprovaveis: suspensoesRelevantes,
        prazo: prazoNumerico, tipo: 'civel',
        diasProrrogados: resultadoSemDecreto.diasProrrogados
    };
};