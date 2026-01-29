/**
 * @file regrasCrime.js
 * Contém a lógica de cálculo de prazo específica para a matéria Crime.
 */

const calcularPrazoCrime = (dataPublicacaoComDecreto, inicioDoPrazoComDecreto, prazoNumerico, diasNaoUteisDoInicioComDecreto = [], inicioDisponibilizacao, helpers, diasComprovados = new Set(), ignorarRecesso = false) => {
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

    // PASSO 1: Calcular a Disponibilização EFETIVA Sem Decreto
    // Se a data inputada (inicioDisponibilizacao) for feriado/recesso, ela move para o proximo dia util.
    // Usamos um truque: voltamos um dia e buscamos o próximo útil.
    const ontemData = new Date(inicioDisponibilizacao);
    ontemData.setDate(ontemData.getDate() - 1);

    // Calcula disp efetiva ignorando decretos
    const { proximoDia: dataDispEfetivaSemDecreto, suspensoesEncontradas: suspensoesDispSemDecreto } = getProximoDiaUtilParaPublicacao(ontemData, false);

    // PASSO 2: A partir da Disp Efetiva, calcula a Publicação
    const { proximoDia: dataPublicacaoSemDecreto, suspensoesEncontradas: suspensoesPubSemDecreto } = getProximoDiaUtilParaPublicacao(dataDispEfetivaSemDecreto, false);

    // Combina suspensões encontradas nos dois passos (Disp -> Efetiva e Efetiva -> Pub)
    // CORREÇÃO: Usar um Set para evitar dias duplicados, se ocorrerem na transição
    const todasSuspensoes = [...(suspensoesDispSemDecreto || []), ...(suspensoesPubSemDecreto || [])];
    const suspensoesIds = new Set();
    const suspensoesNaPublicacao = todasSuspensoes.filter(s => {
        const id = s.data.toISOString().split('T')[0];
        if (suspensoesIds.has(id)) return false;
        suspensoesIds.add(id);
        return true;
    });

    // CORREÇÃO CRIME: Se a publicação for sexta-feira, o prazo começa a contar na segunda (Súmula 310 STF).
    // Usamos getProximoDiaUtilParaPublicacao(..., false) para encontrar o start date correto ignorando decretos/instabilidades.
    const { proximoDia: inicioDoPrazoSemDecreto } = getProximoDiaUtilParaPublicacao(dataPublicacaoSemDecreto, false);

    // Verificar se o dia de início do prazo tem decreto (para mostrar como comprovável)
    const decretoNoInicioDoPrazo = getMotivoDiaNaoUtil(inicioDoPrazoSemDecreto, true, 'decreto') ||
        getMotivoDiaNaoUtil(inicioDoPrazoSemDecreto, true, 'instabilidade');

    // Para 'crime', o cálculo base é em dias corridos, mas 'semDecreto' ignora decretos/instabilidades.
    // 'false' no último parametro indica para ignorar decretos.
    const resultadoSemDecreto = calcularPrazoFinalDiasCorridos(inicioDoPrazoSemDecreto, prazoNumerico, new Set(), ignorarRecesso, false);

    // Cenário COM decreto: 
    // Se o usuário já comprovou suspensões (diasComprovados não vazio), usamos o início calculado pelo app.js e as suspensões validas.
    // Se NÃO houver comprovados (estado inicial), forçamos o uso do início 'SemDecreto' para evitar discrepâncias (bug 10/12) geradas por decretos futuros não comprovados.
    const dataInicioComDecretoEfetiva = (diasComprovados && diasComprovados.size > 0) ? inicioDoPrazoComDecreto : inicioDoPrazoSemDecreto;

    // Passamos 'true' para considerar decretos na prorrogação final, MAS apenas se estiverem no Set 'diasComprovados'.
    const resultadoComDecretoInicial = calcularPrazoFinalDiasCorridos(dataInicioComDecretoEfetiva, prazoNumerico, diasComprovados || new Set(), ignorarRecesso, true);

    // Identifica suspensões comprováveis
    // REGRA DE OURO (User Feedback): 
    // - Instabilidades só pedem comprovação se caírem no Início do Prazo ou no Fim do Prazo.
    // - Instabilidades na Publicação/Disponibilização são ignoradas.
    // - Feriados e Recessos são automáticos e não devem aparecer na lista.
    const filtroComprovavel = (tipo) => tipo === 'decreto' || tipo === 'instabilidade' || tipo === 'suspensao_outubro' || tipo === 'feriado_cnj';

    const suspensoesParaUI = [];

    // 1. Verifica Instabilidade/Decreto no INÍCIO DO PRAZO (Dies a Quo efetivo)
    // O dia calculado como início (sem decreto) pode ter uma instabilidade. Se tiver, pedimos comprovação.
    const suspensaoNoInicio = getMotivoDiaNaoUtil(inicioDoPrazoSemDecreto, true, 'todos');
    if (suspensaoNoInicio && filtroComprovavel(suspensaoNoInicio.tipo)) {
        suspensoesParaUI.push({ data: new Date(inicioDoPrazoSemDecreto.getTime()), ...suspensaoNoInicio });
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
        dataPublicacao: dataPublicacaoComDecreto,
        inicioPrazo: inicioDoPrazoComDecreto,
        semDecreto: resultadoSemDecreto,
        comDecreto: resultadoComDecretoInicial,
        suspensoesComprovaveis: suspensoesParaUI,
        prazo: prazoNumerico, tipo: 'crime',
        diasProrrogados: resultadoComDecretoInicial.diasProrrogados
    };
};