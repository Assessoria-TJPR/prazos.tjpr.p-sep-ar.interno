
    const getMotivoDiaNaoUtil = require('./regrasCivel.js').getMotivoDiaNaoUtil;
    const calcularPrazoFinalDiasCorridos = (inicioDoPrazo, prazo, comprovados = new Set(), ignorarRecesso = false, considerarDecretosNaProrrogacao = true) => {
        /**
         * Para prazos de 'crime' (dias corridos):
         * 1. O início do prazo é ajustado para o próximo dia útil (se cair em fim de semana, feriado, etc.).
         * 2. A data final é calculada somando-se os dias corridos do prazo ao início ajustado.
         * 3. A data final é prorrogada se cair em um dia não útil (fim de semana, feriado, recesso ou suspensão comprovada).
         */

        const diasNaoUteisEncontrados = [];
        const diasPotenciaisComprovaveis = [];
        let diasDeSuspensaoComprovadaNoPeriodo = 0;
        const diasNaoUteisDoInicio = []; // Adicionado para rastrear suspensões no início

        // 1. Ajusta o início do prazo para o próximo dia útil, se necessário.
        let inicioAjustado = new Date(inicioDoPrazo.getTime());
        let infoDiaInicioNaoUtil;
        // O início do prazo só deve ser prorrogado por decretos/instabilidades se eles estiverem no conjunto 'comprovados'
        // E se a flag `considerarDecretosNaProrrogacao` for verdadeira.
        // Feriados e recessos sempre prorrogam.
        // CORREÇÃO: Usar do-while para garantir que a verificação seja feita pelo menos uma vez para a data de início.
        do {
            // Lógica para ignorar recesso se a flag estiver ativa
            const motivoRecesso = getMotivoDiaNaoUtil(inicioAjustado, true, 'recesso');
            const ehRecessoValido = motivoRecesso && !ignorarRecesso;

            (infoDiaInicioNaoUtil = getMotivoDiaNaoUtil(inicioAjustado, true, 'feriado') ||
                (ehRecessoValido ? motivoRecesso : null) ||
                (considerarDecretosNaProrrogacao && comprovados.has(inicioAjustado.toISOString().split('T')[0]) && (getMotivoDiaNaoUtil(inicioAjustado, true, 'decreto') || getMotivoDiaNaoUtil(inicioAjustado, true, 'instabilidade')))
            ) ||
                (inicioAjustado.getDay() === 0 || inicioAjustado.getDay() === 6)
                ? (() => {
                    if (infoDiaInicioNaoUtil) diasNaoUteisDoInicio.push({ data: new Date(inicioAjustado.getTime()), ...infoDiaInicioNaoUtil });
                    inicioAjustado.setDate(inicioAjustado.getDate() + 1);
                })()
                : false; // Condição para sair do loop se não for dia não útil
        } while (infoDiaInicioNaoUtil || inicioAjustado.getDay() === 0 || inicioAjustado.getDay() === 6);

        // 2. Calcula a data final "bruta" iterando dia a dia para permitir suspensões comprovadas no meio do prazo
        let diasCorridosContados = 0;
        let dataCorrente = new Date(inicioAjustado.getTime());
        
        // Ponto de partida já é o dia 1 do prazo
        diasCorridosContados = 1;

        while (diasCorridosContados < prazo) {
            dataCorrente.setDate(dataCorrente.getDate() + 1);
            const dataCorrenteStr = dataCorrente.toISOString().split('T')[0];
            
            // Feriados normais não suspendem prazo penal (correm normal)
            // Mas decretos COMPROVADOS suspendem o prazo penal, segundo regras locais do Tribunal
            let ehSuspensaoComprovada = false;
            let infoSuspensao = null;
            
            // Tratamento especial para 24/12 e 31/12 (se ignorarRecesso for true, o usuário pode ter comprovado)
            if (ignorarRecesso && ((dataCorrente.getMonth() === 11 && dataCorrente.getDate() === 24) || (dataCorrente.getMonth() === 11 && dataCorrente.getDate() === 31))) {
                if (comprovados.has(dataCorrenteStr)) {
                    ehSuspensaoComprovada = true;
                    infoSuspensao = { motivo: (dataCorrente.getDate() === 24 ? 'Véspera de Natal' : 'Véspera de Ano Novo'), tipo: 'decreto' };
                }
            } else if (comprovados.has(dataCorrenteStr)) {
                // Outros decretos/instabilidades normais
                infoSuspensao = getMotivoDiaNaoUtil(dataCorrente, true, 'decreto') || getMotivoDiaNaoUtil(dataCorrente, true, 'instabilidade');
                if (infoSuspensao) ehSuspensaoComprovada = true;
            }
            
            // Se o dia for uma suspensão comprovada, nós registramos o dia e NÃO contamos no prazo
            if (ehSuspensaoComprovada && infoSuspensao) {
                diasNaoUteisEncontrados.push({ data: new Date(dataCorrente.getTime()), ...infoSuspensao });
                diasDeSuspensaoComprovadaNoPeriodo++;
            } else {
                diasCorridosContados++;
            }

            // Apenas para vigilância da UI (Mostrar Feriados Nacionais que cruzaram o prazo)
            const motivoAuto = getMotivoDiaNaoUtil(dataCorrente, true, 'feriado') || getMotivoDiaNaoUtil(dataCorrente, true, 'recesso');
            if (motivoAuto && !((motivoAuto.tipo === 'recesso' || motivoAuto.tipo === 'recesso_grouped') && ignorarRecesso)) {
                // Evita duplicar se essa data também foi comprovada de alguma forma
                if (!ehSuspensaoComprovada) {
                    diasNaoUteisEncontrados.push({ data: new Date(dataCorrente.getTime()), ...motivoAuto });
                }
            }
        }

        const dataFinalBruta = new Date(dataCorrente.getTime());

        // Após o loop principal, verifica se a data final caiu em um dia não útil e prorroga se necessário.
        // CORREÇÃO: Criar uma nova instância de Date para evitar modificar dataFinalBruta
        let prazoFinalAjustado = new Date(dataFinalBruta.getTime());
        let infoDiaFinalNaoUtil;
        const diasProrrogados = [];

        // 3. Prorroga o prazo final se ele cair em um dia não útil (fim de semana, feriado, recesso).
        while (true) {
            // Lógica para ignorar recesso se a flag estiver ativa
            const motivoRecesso = getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'recesso');
            const ehRecessoValido = motivoRecesso && !ignorarRecesso;

            let infoDecreto = null;
            if (considerarDecretosNaProrrogacao && comprovados.has(prazoFinalAjustado.toISOString().split('T')[0])) {
                infoDecreto = getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'decreto') || getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'instabilidade');
                
                // Tratamento especial para 24/12 e 31/12 se ignorarRecesso for true
                if (!infoDecreto && ignorarRecesso) {
                    if (prazoFinalAjustado.getMonth() === 11 && prazoFinalAjustado.getDate() === 24) {
                        infoDecreto = { motivo: 'Véspera de Natal', tipo: 'decreto' };
                    } else if (prazoFinalAjustado.getMonth() === 11 && prazoFinalAjustado.getDate() === 31) {
                        infoDecreto = { motivo: 'Véspera de Ano Novo', tipo: 'decreto' };
                    }
                }
            }

            infoDiaFinalNaoUtil = getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'feriado') ||
                (ehRecessoValido ? motivoRecesso : null) || infoDecreto;

            const eFimDeSemana = prazoFinalAjustado.getDay() === 0 || prazoFinalAjustado.getDay() === 6;


            if (infoDiaFinalNaoUtil || eFimDeSemana) {
                if (infoDiaFinalNaoUtil) diasProrrogados.push({ data: new Date(prazoFinalAjustado.getTime()), ...infoDiaFinalNaoUtil });
                prazoFinalAjustado.setDate(prazoFinalAjustado.getDate() + 1);
            } else {
                break;
            }
        }


        // Retorna os dias que foram comprovados e causaram a dilação, os dias que causaram a prorrogação final, e os dias potenciais para a UI.
        return { prazoFinal: dataFinalBruta, prazoFinalProrrogado: prazoFinalAjustado, diasNaoUteis: [...diasNaoUteisEncontrados, ...diasProrrogados], diasProrrogados: diasProrrogados, diasPotenciaisComprovaveis: [...diasPotenciaisComprovaveis, ...diasNaoUteisDoInicio], diasNaoUteisDoInicio: diasNaoUteisDoInicio };
    };

    module.exports = calcularPrazoFinalDiasCorridos;
