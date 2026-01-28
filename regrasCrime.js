/**
 * @file regrasCrime.js
 * Contém a lógica de cálculo de prazo específica para a matéria Crime.
 */

const calcularPrazoCrime = (dataPublicacaoComDecreto, inicioDoPrazoComDecreto, prazoNumerico, diasNaoUteisDoInicioComDecreto = [], inicioDisponibilizacao, helpers) => {
    const { getProximoDiaUtilParaPublicacao, calcularPrazoFinalDiasCorridos, getMotivoDiaNaoUtil, decretosMap } = helpers;

    // Lógica para suspensão de prazos em maio de 2025 (SEI 0072049-32.2025.8.16.6000)
    // Para Crime, a suspensão é apenas nos dias 28 e 29 de maio.
    const dataDisponibilizacaoStr = inicioDisponibilizacao.toISOString().split('T')[0];
    if (dataDisponibilizacaoStr === '2025-05-28' || dataDisponibilizacaoStr === '2025-05-29') {
        const prazoFinalEspecial = new Date('2025-06-25T00:00:00');
        const resultadoEspecial = { prazoFinalProrrogado: prazoFinalEspecial, diasNaoUteis: [], diasProrrogados: [] };
        // Retorna a estrutura correta para que o front-end exiba e permita o recálculo se necessário
        return { dataPublicacao: dataPublicacaoComDecreto, inicioPrazo: inicioDoPrazoComDecreto, semDecreto: resultadoEspecial, comDecreto: resultadoEspecial, suspensoesComprovaveis: [], prazo: prazoNumerico, tipo: 'crime' };
    }

    // Calcula cenário SEM decreto (apenas feriados e recessos)
    // Para Crime, decretos NÃO adiam o início do prazo (prazo de dias corridos começa mesmo em dia de decreto)
    const { proximoDia: dataPublicacaoSemDecreto } = getProximoDiaUtilParaPublicacao(inicioDisponibilizacao, false);

    // CORREÇÃO CRIME: Para Crime com prazo em dias corridos, o início do prazo é o 
    // MESMO DIA da publicação. Decretos nesse dia NÃO adiam o início, apenas aparecem
    // como comprováveis para o usuário dilatar se necessário.
    const inicioDoPrazoSemDecreto = new Date(dataPublicacaoSemDecreto.getTime());

    // Verificar se o dia de início do prazo tem decreto (para mostrar como comprovável)
    const decretoNoInicioDoPrazo = getMotivoDiaNaoUtil(inicioDoPrazoSemDecreto, true, 'decreto') ||
        getMotivoDiaNaoUtil(inicioDoPrazoSemDecreto, true, 'instabilidade');

    // Para 'crime', o cálculo base é em dias corridos, mas 'semDecreto' ignora decretos/instabilidades.
    // 'false' no último parametro indica para ignorar decretos.
    const resultadoSemDecreto = calcularPrazoFinalDiasCorridos(inicioDoPrazoSemDecreto, prazoNumerico, new Set(), false);

    // Cenário COM decreto: Se o usuário marcar o decreto, usamos o inicioDoPrazoComDecreto original
    // Por enquanto, o cenário inicial é igual ao semDecreto
    const resultadoComDecretoInicial = { ...resultadoSemDecreto };

    // Identifica suspensões comprováveis
    const filtroComprovavel = (tipo) => tipo === 'decreto' || tipo === 'instabilidade' || tipo === 'feriado_cnj' || tipo === 'suspensao_outubro';

    // 1. Se houver decreto/instabilidade no dia de início do prazo, adiciona como comprovável
    const suspensoesParaUI = [];
    if (decretoNoInicioDoPrazo && filtroComprovavel(decretoNoInicioDoPrazo.tipo)) {
        suspensoesParaUI.push({ data: new Date(inicioDoPrazoSemDecreto.getTime()), ...decretoNoInicioDoPrazo });
    }

    // 2. Procura a PRIMEIRA suspensão comprovável no prazo final (prorrogado)
    // Não adiciona TODAS as suspensões da prorrogação, apenas a primeira que afeta o final
    const prazoFinalParaVerificar = resultadoSemDecreto.prazoFinalProrrogado;
    const suspensaoNoFimProrrogado = getMotivoDiaNaoUtil(prazoFinalParaVerificar, true);

    if (suspensaoNoFimProrrogado && filtroComprovavel(suspensaoNoFimProrrogado.tipo)) {
        const dataFimStr = prazoFinalParaVerificar.toISOString().split('T')[0];
        // Só adiciona se ainda não estiver na lista (evita duplicatas)
        if (!suspensoesParaUI.some(s => s.data.toISOString().split('T')[0] === dataFimStr)) {
            suspensoesParaUI.push({ data: new Date(prazoFinalParaVerificar.getTime()), ...suspensaoNoFimProrrogado });
        }
    }

    // Ordena as suspensões por data
    const suspensoesComprovaveis = suspensoesParaUI.sort((a, b) => a.data - b.data);

    return {
        dataPublicacao: dataPublicacaoComDecreto,
        inicioPrazo: inicioDoPrazoComDecreto,
        semDecreto: resultadoSemDecreto,
        comDecreto: resultadoComDecretoInicial,
        suspensoesComprovaveis,
        prazo: prazoNumerico,
        tipo: 'crime'
    };
};