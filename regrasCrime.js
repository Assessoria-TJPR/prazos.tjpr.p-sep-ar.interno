/**
 * @file regrasCrime.js
 * Contém a lógica de cálculo de prazo específica para a matéria Crime.
 */

const calcularPrazoCrime = (_dataPubApp, _inicioPrazoApp, prazoNumerico, diasNaoUteisDoInicioComDecreto = [], inicioDisponibilizacao, helpers, diasComprovados = new Set(), ignorarRecesso = false) => {
    const { getProximoDiaUtilParaPublicacao, calcularPrazoFinalDiasCorridos, getMotivoDiaNaoUtil, getProximoDiaUtilComprovado, decretosMap } = helpers;

    // Lógica para suspensão de prazos em maio de 2025 (SEI 0072049-32.2025.8.16.6000)
    // Para Crime, a suspensão é apenas nos dias 28 e 29 de maio.
    const dataDisponibilizacaoStr = inicioDisponibilizacao.toISOString().split('T')[0];
    if (dataDisponibilizacaoStr === '2025-05-28' || dataDisponibilizacaoStr === '2025-05-29') {
        const prazoFinalEspecial = new Date('2025-06-25T00:00:00');
        const resultadoEspecial = { prazoFinalProrrogado: prazoFinalEspecial, diasNaoUteis: [], diasProrrogados: [] };
        // Retorna a estrutura correta para que o front-end exiba e permita o recálculo se necessário
        return { dataPublicacao: dataPublicacaoComDecreto, inicioPrazo: inicioDoPrazoComDecreto, semDecreto: resultadoEspecial, comDecreto: resultadoEspecial, suspensoesComprovaveis: [], prazo: prazoNumerico, tipo: 'crime' };
    }

    // PASSO 1: A partir da Disponibilização, calcula a Publicação (D+1 Útil)
    // Cenário 1: Sem Decreto -> Ignora decretos (false)
    const { proximoDia: dataPublicacaoSemDecreto, suspensoesEncontradas: suspensoesPubSemDecreto } = getProximoDiaUtilParaPublicacao(inicioDisponibilizacao, false);

    // Cenário 2: Com Decreto -> Considera apenas decretos COMPROVADOS
    const { proximoDia: dataPublicacaoComDecreto } = getProximoDiaUtilComprovado(inicioDisponibilizacao, diasComprovados);

    // PASSO 2: A partir da Publicação, calcula o Início do Prazo (D+1 Útil - Súmula 310 STF)
    // Cenário 1: Sem Decreto
    const { proximoDia: inicioDoPrazoSemDecreto, suspensoesEncontradas: suspensoesInicioSemDecreto } = getProximoDiaUtilParaPublicacao(dataPublicacaoSemDecreto, false);

    // Cenário 2: Com Decreto (baseado na publicação ajustada pelos decretos comprovados)
    const { proximoDia: inicioDoPrazoComDecreto } = getProximoDiaUtilComprovado(dataPublicacaoComDecreto, diasComprovados);

    // Combina suspensões encontradas (apenas feriados/recessos que realmente pularam dias no Cenário 1)
    const todasSuspensoes = [
        ...(suspensoesPubSemDecreto || []),
        ...(suspensoesInicioSemDecreto || [])
    ];
    const suspensoesIds = new Set();
    const suspensoesIniciais = todasSuspensoes.filter(s => {
        const id = s.data.toISOString().split('T')[0];
        if (suspensoesIds.has(id)) return false;
        suspensoesIds.add(id);
        return true;
    });

    // Verificar se o dia de início do prazo tem decreto
    const decretoNoInicioDoPrazo = getMotivoDiaNaoUtil(inicioDoPrazoSemDecreto, true, 'decreto') ||
        getMotivoDiaNaoUtil(inicioDoPrazoSemDecreto, true, 'instabilidade');

    // CALCULO DO PRAZO
    // Cenário 1: Sem Decreto
    const resultadoSemDecreto = calcularPrazoFinalDiasCorridos(inicioDoPrazoSemDecreto, prazoNumerico, new Set(), ignorarRecesso, false);

    // Cenário 2: Com Decreto
    // Usa o início do prazo recalculado com base nas comprovações
    const resultadoComDecretoInicial = calcularPrazoFinalDiasCorridos(inicioDoPrazoComDecreto, prazoNumerico, diasComprovados || new Set(), ignorarRecesso, true);

    // Identifica suspensões comprováveis
    // REGRA DE OURO (User Feedback): 
    // - Instabilidades só pedem comprovação se caírem no Início do Prazo ou no Fim do Prazo.
    // - Instabilidades na Publicação/Disponibilização são ignoradas.
    // - Feriados e Recessos são automáticos e não devem aparecer na lista.
    const filtroComprovavel = (tipo) => tipo === 'decreto' || tipo === 'instabilidade' || tipo === 'suspensao_outubro' || tipo === 'feriado_cnj';

    const suspensoesParaUI = [];

    // 0. Coleta suspensões comprováveis dos marcos iniciais (Salto Duplo)
    // Usamos o caminho COM DECRETOS para encontrar os dias que empurraram os marcos para frente,
    // caso o usuário marque as opções.
    const { suspensoesEncontradas: suspPubComDecreto } = getProximoDiaUtilParaPublicacao(inicioDisponibilizacao, true);
    // Para Intimação/Início, usamos a data de publicação calculada (sem decreto) como base
    const { suspensoesEncontradas: suspInicioMax } = getProximoDiaUtilParaPublicacao(dataPublicacaoSemDecreto, true);

    const todasSuspensoesIniciaisComDecreto = [
        ...(suspPubComDecreto || []),
        ...(suspInicioMax || [])
    ];

    todasSuspensoesIniciaisComDecreto.forEach(suspensao => {
        if (filtroComprovavel(suspensao.tipo)) {
            const dStr = suspensao.data.toISOString().split('T')[0];
            if (!suspensoesParaUI.some(s => s.data.toISOString().split('T')[0] === dStr)) {
                suspensoesParaUI.push(suspensao);
            }
        }
    });

    // 1. Verifica Instabilidade/Decreto no INÍCIO DO PRAZO (Dies a Quo efetivo)
    // O dia calculado como início (sem decreto) pode ter uma instabilidade. Se tiver, pedimos comprovação.
    const suspensaoNoInicio = getMotivoDiaNaoUtil(inicioDoPrazoSemDecreto, true, 'todos');
    if (suspensaoNoInicio && filtroComprovavel(suspensaoNoInicio.tipo)) {
        const dStr = inicioDoPrazoSemDecreto.toISOString().split('T')[0];
        if (!suspensoesParaUI.some(s => s.data.toISOString().split('T')[0] === dStr)) {
            suspensoesParaUI.push({ data: new Date(inicioDoPrazoSemDecreto.getTime()), ...suspensaoNoInicio });
        }
    }

    // 2. Verifica Instabilidade/Decreto no FIM DO PRAZO (Dies ad Quem)
    // O dia calculado como final (sem decreto, já prorrogado por feriados naturais) pode cair numa instabilidade.
    const prazoFinalParaVerificar = resultadoSemDecreto.prazoFinalProrrogado; // Usa o 'Prorrogado' para lidar com feriados naturais primeiro
    const suspensaoNoFim = getMotivoDiaNaoUtil(prazoFinalParaVerificar, true, 'todos');

    if (suspensaoNoFim && filtroComprovavel(suspensaoNoFim.tipo)) {
        // Garantir que não é duplicata
        const dStr = prazoFinalParaVerificar.toISOString().split('T')[0];
        if (!suspensoesParaUI.some(s => s.data.toISOString().split('T')[0] === dStr)) {
            suspensoesParaUI.push({ data: new Date(prazoFinalParaVerificar.getTime()), ...suspensaoNoFim });
        }
    }

    // REMOVIDO "Varredura de Intervalo" completa que trazia dias 23/10, 24/10 etc.
    // O usuário foi claro que instabilidades nesses dias não devem ser cobradas.

    // Ordena
    suspensoesParaUI.sort((a, b) => a.data - b.data);

    return {
        dataPublicacao: (diasComprovados && diasComprovados.size > 0) ? dataPublicacaoComDecreto : dataPublicacaoSemDecreto,
        inicioPrazo: (diasComprovados && diasComprovados.size > 0) ? inicioDoPrazoComDecreto : inicioDoPrazoSemDecreto,
        semDecreto: resultadoSemDecreto,
        comDecreto: resultadoComDecretoInicial,
        suspensoesComprovaveis: suspensoesParaUI,
        prazo: prazoNumerico, tipo: 'crime',
        diasProrrogados: resultadoComDecretoInicial.diasProrrogados
    };
};