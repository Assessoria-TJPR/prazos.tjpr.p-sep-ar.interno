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

    // CORREÇÃO CRIME: Para Crime com prazo em dias corridos, o início do prazo é o 
    // MESMO DIA da publicação. Decretos nesse dia NÃO adiam o início, apenas aparecem
    // como comprováveis para o usuário dilatar se necessário.
    const inicioDoPrazoSemDecreto = new Date(dataPublicacaoSemDecreto.getTime());

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
    // Para Crime, removemos 'feriado' e 'recesso' da lista de sugestões automáticas
    // pois eles já são aplicados por lei na fase de disponibilização/publicação.
    // Apenas Decretos e Instabilidades são opcionais/comprováveis.
    // PORÉM, para fins de visualização da cascata (ex: entender por que pulou 22/10),
    // vamos permitir que feriados apareçam na lista, embora sua aplicação seja automática pelo app.js.
    const filtroComprovavel = (tipo) => tipo === 'decreto' || tipo === 'instabilidade' || tipo === 'suspensao_outubro' || tipo === 'feriado' || tipo === 'recesso' || tipo === 'feriado_cnj';

    const suspensoesParaUI = [];

    // 1. Adiciona decretos/instabilidades encontrados durante o cálculo da publicação SEM decreto
    // Isso captura o decreto do dia 21/11 (no caso de 20/11) que deve aparecer como opção
    // Além disso, verificamos o próprio dia da Disp Efetiva e Pub Sem Decreto para ver se tem decreto
    // (pois o getProximoDiaUtil ignora decretos, então ele pode retornar um dia COM decreto)

    // Verifica decreto na Disp Efetiva (21/11 no caso do input 20/11)
    const suspensaoDispEfetiva = getMotivoDiaNaoUtil(dataDispEfetivaSemDecreto, true, 'decreto') || getMotivoDiaNaoUtil(dataDispEfetivaSemDecreto, true, 'instabilidade');
    if (suspensaoDispEfetiva) {
        suspensoesParaUI.push({ data: new Date(dataDispEfetivaSemDecreto.getTime()), ...suspensaoDispEfetiva });
    }

    // Verifica suspensões encontradas no caminho (mas filtra tipos)
    if (suspensoesNaPublicacao && suspensoesNaPublicacao.length > 0) {
        suspensoesNaPublicacao.forEach(s => {
            // Só adiciona se for comprovável e não for duplicata do anterior
            if (filtroComprovavel(s.tipo)) {
                const dataStr = s.data.toISOString().split('T')[0];
                if (!suspensoesParaUI.some(exist => exist.data.toISOString().split('T')[0] === dataStr)) {
                    suspensoesParaUI.push(s);
                }
            }
        });
    }

    // 2. Se houver decreto/instabilidade no dia de início do prazo, adiciona como comprovável
    if (decretoNoInicioDoPrazo && filtroComprovavel(decretoNoInicioDoPrazo.tipo)) {
        const dataInicioStr = inicioDoPrazoSemDecreto.toISOString().split('T')[0];
        // Só adiciona se ainda não estiver na lista (evita duplicatas)
        if (!suspensoesParaUI.some(s => s.data.toISOString().split('T')[0] === dataInicioStr)) {
            suspensoesParaUI.push({ data: new Date(inicioDoPrazoSemDecreto.getTime()), ...decretoNoInicioDoPrazo });
        }
    }

    // 2. Procura a PRIMEIRA suspensão comprovável no prazo final (prorrogado)
    // Não adiciona TODAS as suspensões da prorrogação, apenas a primeira que afeta o final
    const prazoFinalParaVerificar = resultadoSemDecreto.prazoFinalProrrogado;
    const suspensaoNoFimProrrogado = getMotivoDiaNaoUtil(prazoFinalParaVerificar, true);

    if (suspensaoNoFimProrrogado && filtroComprovavel(suspensaoNoFimProrrogado.tipo)) {
        const dataFimStr = prazoFinalParaVerificar.toISOString().split('T')[0];
        // Só adiciona se ainda não estiver na lista (evita duplicatas)
        const dataStr = prazoFinalParaVerificar.toISOString().split('T')[0];
        if (!suspensoesParaUI.some(exist => exist.data.toISOString().split('T')[0] === dataStr)) {
            suspensoesParaUI.push({ data: new Date(prazoFinalParaVerificar.getTime()), ...suspensaoNoFimProrrogado });
        }
    }

    // CASCATA (UPDATE): Varredura de Intervalo
    // Para capturar suspensões em "degraus" intermediários (ex: 18/12, 19/12) que ocorrem entre a data base e a final,
    // percorremos todo o intervalo entre a publicação sem decreto e o início do prazo com decreto.

    // Determina o range de varredura
    // Início: Menor data entre PubSemDecreto e as datas efetivas
    // Fim: Maior data entre PubComDecreto e InícioComDecreto
    let dataVarredura = new Date(dataPublicacaoSemDecreto.getTime());
    // Regride um pouco para garantir que pegamos instabilidades da disponibilização se houver gap
    dataVarredura.setDate(dataVarredura.getDate() - 5);
    // Ajusta para o dia real da Disp Efetiva Base ou Pub Base
    if (dataDispEfetivaSemDecreto < dataVarredura) dataVarredura = new Date(dataDispEfetivaSemDecreto.getTime());
    else dataVarredura = new Date(dataPublicacaoSemDecreto.getTime());

    // AJUSTE FINAL: Para garantir que TODAS as suspensões no decorrer do prazo apareçam (ex: 18 e 19/12),
    // definimos o limite de varredura como a Data Final calculada (ou o início, o que for maior).
    // Isso cobre todo o período do prazo.
    const dataFimCalculada = resultadoComDecretoInicial.prazoFinal;
    let dataLimite = new Date(inicioDoPrazoComDecreto.getTime());
    if (dataFimCalculada > dataLimite) {
        dataLimite = new Date(dataFimCalculada.getTime());
    }

    // Mantemos a margem de segurança para pegar suspensões que possam prorrogar o final.
    const dataLimiteMargem = new Date(dataLimite);
    dataLimiteMargem.setDate(dataLimiteMargem.getDate() + 5);

    while (dataVarredura <= dataLimiteMargem) {
        const d = dataVarredura;
        // MELHORIA: Busca qualquer tipo de não-util (todos) e depois filtra.
        // Isso evita perder suspensões que possam estar classificadas apenas como 'feriado' mas deveriam aparecer.
        const susp = getMotivoDiaNaoUtil(d, true, 'todos');

        if (susp && filtroComprovavel(susp.tipo)) {
            const dStr = d.toISOString().split('T')[0];
            if (!suspensoesParaUI.some(exist => exist.data.toISOString().split('T')[0] === dStr)) {
                // Filtra apenas se estiver dentro do range lógico relevante (Disp Base até Início Com Decreto)
                // ou se for uma suspensão próxima relevante.
                const isWithinRange = d >= dataDispEfetivaSemDecreto && d <= dataLimite;
                // Aceita se estiver no range E for um tipo válido para Crime (Decreto, Instab, etc)
                // AJUSTE: Recesso é removido da lista visual para evitar confusão (automático).
                if (susp.tipo !== 'recesso') {
                    // LÓGICA CONDICIONAL: Se não estiver ignorando recesso (Réu Solto), e a suspensão cair em Dezembro (11),
                    // ocultamos as suspensões, pois o prazo final cairá em Janeiro de qualquer forma.
                    // Isso atende ao pedido: "só vai aparecer os dois cenarios nesse caso se a caixa estiver marcada".
                    const mes = d.getMonth();
                    if (mes === 11 && !ignorarRecesso) {
                        // Oculta suspensões de dezembro se recesso não for ignorado
                    } else {
                        // Feriado é mantido para explicar pulos automáticos (ex: 22/10).
                        // Instabilidade e Decreto são mantidos como comprováveis.
                        suspensoesParaUI.push({ data: new Date(d.getTime()), ...susp });
                    }
                }
            }
        }
        dataVarredura.setDate(dataVarredura.getDate() + 1);
    }

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