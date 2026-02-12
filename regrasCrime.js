/**
 * @file regrasCrime.js
 * Contém a lógica de cálculo de prazo específica para a matéria Crime.
 */

const calcularPrazoCrime = (dataPublicacaoComDecreto, inicioDoPrazoComDecreto, prazoNumerico, diasNaoUteisDoInicioComDecreto = [], inicioDisponibilizacao, helpers, diasComprovados = new Set(), ignorarRecesso = false) => {
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
    // Regra Crime: Publicação é o primeiro dia útil após disponibilização.
    // User Update: "A publicação pode cair em dia de decreto, não precisa pular".
    // Portanto, calculamos a publicação IGNORANDO decretos (passando 'false').
    const { proximoDia: dataPublicacaoSemDecreto, suspensoesEncontradas: suspensoesPubSemDecreto } = getProximoDiaUtilParaPublicacao(inicioDisponibilizacao, false);

    // PASSO 2: A partir da Publicação, calcula o Início do Prazo (D+1 Útil - Súmula 310 STF)
    // User Update: "O início do prazo é no dia 24". (Pub 21/11 -> Início 24/11).
    // Isso confirma a lógica de Salto Duplo (Disponibilização -> Publicação -> Início) para este caso,
    // onde a Intimação (se existir processualmente) ocorre na própria Publicação ou não adiciona um dia útil extra na contagem padrão.
    const { proximoDia: inicioDoPrazoSemDecreto, suspensoesEncontradas: suspensoesInicioSemDecreto } = getProximoDiaUtilParaPublicacao(dataPublicacaoSemDecreto, false);

    // Combina suspensões encontradas (apenas feriados/recessos que realmente pularam dias)
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
    // Como a user disse que "Publicação pode cair em dia de decreto", a Data de Publicação e o Início da Contagem
    // NÃO mudam baseados na presença do decreto na publicação (21/11).
    // O decreto apenas conta como suspensão SE afetar o decurso do prazo (após o início).
    // Mas mantemos a lógica de 'diasComprovados' para o cálculo final do prazo, caso suspenda dias do meio/fim.

    // [IMPORTANTE] Se o decreto cair EXATAMENTE no dia que seria o início do prazo, aí sim ele poderia prorrogar o início?
    // Pela regra de dias corridos (CPP Art 798), o prazo corre... mas se o início é feriado/suspensão, prorroga?
    // Súmula 310: "não se computando o dia do começo". Começa no primeiro dia útil.
    // Se 24/11 fosse decreto, começaria 25/11.
    // Como estamos usando 'getProximoDiaUtilParaPublicacao(..., false)' para inicioDoPrazoSemDecreto,
    // precisamos recalcular o inicio efetivo SE houver decretos comprovados NO DIA DO INÍCIO?
    // User disse: "Inicio no dia 24 e não 25". (24 é segunda, util).
    // Se houver decreto dia 24, e usuário marcar, aí sim pularia.

    const { proximoDia: inicioDoPrazoEfetivoComDecretoLocal } = getProximoDiaUtilComprovado(dataPublicacaoSemDecreto, diasComprovados);

    const resultadoComDecretoInicial = calcularPrazoFinalDiasCorridos(inicioDoPrazoEfetivoComDecretoLocal, prazoNumerico, diasComprovados || new Set(), ignorarRecesso, true);

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
        dataPublicacao: dataPublicacaoSemDecreto,
        inicioPrazo: inicioDoPrazoSemDecreto,
        semDecreto: resultadoSemDecreto,
        comDecreto: resultadoComDecretoInicial,
        suspensoesComprovaveis: suspensoesParaUI,
        prazo: prazoNumerico, tipo: 'crime',
        diasProrrogados: resultadoComDecretoInicial.diasProrrogados
    };
};