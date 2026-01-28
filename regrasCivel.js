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

    // CASCATA: Ao invés de calcular com TODOS os decretos possíveis, calcula apenas o cenário base.
    // As suspensões comprováveis serão apenas:
    // 1. Do início do prazo 
    // 2. A PRIMEIRA suspensão no prazo final (não todas as prorrogações)

    const instabilidadesComprovaveis = [];
    const instabilidadeNoInicio = getMotivoDiaNaoUtil(inicioDoPrazoComDecreto, true, 'instabilidade');
    if (instabilidadeNoInicio) instabilidadesComprovaveis.push({ data: new Date(inicioDoPrazoComDecreto.getTime()), ...instabilidadeNoInicio });

    // Filtra suspensões comprováveis: decretos, feriados CNJ e instabilidades
    const filtroComprovavel = d => d.tipo === 'decreto' || d.tipo === 'feriado_cnj' || d.tipo === 'instabilidade';

    // 1. Adiciona suspensões comprováveis do INÍCIO
    // CASCATA: Pega apenas a PRIMEIRA suspensão do início.
    const primeiraSuspensaoInicio = diasNaoUteisDoInicioComDecreto.find(filtroComprovavel);
    const decretosParaUI = primeiraSuspensaoInicio ? [primeiraSuspensaoInicio] : [];

    // 2. Procura a PRIMEIRA suspensão comprovável no prazo final (sem decretos)
    // Verifica se o prazo final cai em uma suspensão comprovável
    const prazoFinalParaVerificar = resultadoSemDecreto.prazoFinal;
    const suspensaoNoFim = getMotivoDiaNaoUtil(prazoFinalParaVerificar, true);

    if (suspensaoNoFim && filtroComprovavel(suspensaoNoFim)) {
        const dataFimStr = prazoFinalParaVerificar.toISOString().split('T')[0];
        // Só adiciona se ainda não estiver na lista
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