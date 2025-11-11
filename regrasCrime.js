/**
 * @file regrasCrime.js
 * Contém a lógica de cálculo de prazo específica para a matéria de Crime.
 */

const calcularPrazoCrimeComprovavel = (dataPublicacaoComDecreto, inicioDoPrazoComDecreto, prazoNumerico, diasNaoUteisDoInicioComDecreto = [], inicioDisponibilizacao, helpers) => {
    const { getProximoDiaUtilParaPublicacao, calcularPrazoFinalDiasCorridos, decretosMap } = helpers;

    // 1. Encontra o prazo final sem considerar nenhuma comprovação (Cenário 1)
    const { proximoDia: dataPublicacaoSemDecreto } = getProximoDiaUtilParaPublicacao(inicioDisponibilizacao, false);
    const { proximoDia: inicioDoPrazoSemDecreto } = getProximoDiaUtilParaPublicacao(dataPublicacaoSemDecreto, false);
    const resultadoSemDecreto = calcularPrazoFinalDiasCorridos(inicioDoPrazoSemDecreto, prazoNumerico, new Set(), false);

    // 2. Encontra todas as suspensões comprováveis no período, similar ao cível.
    const todosDecretosPossiveis = new Set(Object.keys(decretosMap));
    const resultadoComTodosDecretos = calcularPrazoFinalDiasCorridos(inicioDoPrazoComDecreto, prazoNumerico, todosDecretosPossiveis, true);

    // CORREÇÃO: Para Crime, a instabilidade só é comprovável se ocorrer no início do prazo ou no vencimento.
    // Filtramos a lista de instabilidades potenciais para incluir apenas as que correspondem a essas datas.
    const inicioPrazoStr = inicioDoPrazoComDecreto.toISOString().split('T')[0];
    const prazoFinalSemDecretoStr = resultadoSemDecreto.prazoFinal.toISOString().split('T')[0];

    const instabilidadesParaUI = (resultadoComTodosDecretos.diasPotenciaisComprovaveis || [])
        .filter(d => {
            const dataInstabilidadeStr = d.data.toISOString().split('T')[0];
            return d.tipo === 'instabilidade' && (dataInstabilidadeStr === inicioPrazoStr || dataInstabilidadeStr === prazoFinalSemDecretoStr);
        });

    const filtroDecretos = d => d.tipo === 'decreto' || d.tipo === 'feriado_cnj';
    const decretosParaUI = [
        ...diasNaoUteisDoInicioComDecreto.filter(filtroDecretos),
        ...(resultadoComTodosDecretos.diasPotenciaisComprovaveis || []).filter(filtroDecretos),
        ...resultadoComTodosDecretos.diasProrrogados.filter(filtroDecretos)
    ];
    const todosDecretosParaUI = [...decretosParaUI, ...instabilidadesParaUI];
    const suspensoesRelevantesMap = new Map();
    // O Map garante que cada suspensão (pela data) seja adicionada apenas uma vez, evitando duplicatas.
    todosDecretosParaUI.forEach(suspensao => {
        suspensoesRelevantesMap.set(suspensao.data.toISOString().split('T')[0], suspensao);
    });
    let suspensoesRelevantes = Array.from(suspensoesRelevantesMap.values()).sort((a, b) => a.data - b.data);

    return {
        dataPublicacao: dataPublicacaoComDecreto,
        inicioPrazo: inicioDoPrazoComDecreto,
        semDecreto: resultadoSemDecreto,
        comDecreto: { ...resultadoSemDecreto }, // Cenário 2 começa igual ao 1
        suspensoesComprovaveis: suspensoesRelevantes,
        prazo: prazoNumerico, tipo: 'crime',
        diasProrrogados: resultadoSemDecreto.diasProrrogados
    };
  };