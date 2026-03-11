const appJs = require('./app.js'); // Assuming we can use module if it exists

// We will just recreate the environment here and paste the exact functions:

const feriadosMap = {
    '2025-12-25': { motivo: 'Natal', tipo: 'feriado' },
    '2026-01-01': { motivo: 'Ano Novo', tipo: 'feriado' }
};

const decretosMap = {
    '2025-12-18': { motivo: 'Decreto Teste', tipo: 'decreto' }
};

const getMotivoDiaNaoUtil = (date, considerarDecretos, tipo = 'todos', comprovados = new Set(), ignorarRecesso = false) => {
    if (!date || isNaN(date.getTime())) return null;

    const dateString = date.toISOString().split('T')[0];

    // Flag interna para saber se o decreto EXISTE, independente de ser considerado para dilação
    let motivoEncontrado = null;

    if (dateString === '2025-12-18' && (tipo === 'todos' || tipo === 'decreto')) {
        motivoEncontrado = { motivo: 'Dia da Justiça (Feriado Regimental - Transf. p/ Decreto 808/2024)', tipo: 'decreto' };
    }

    if (!motivoEncontrado && (tipo === 'todos' || tipo === 'feriado')) {
        if (feriadosMap && feriadosMap[dateString]) motivoEncontrado = typeof feriadosMap[dateString] === 'object' ? feriadosMap[dateString] : { motivo: feriadosMap[dateString], tipo: 'feriado' };
    }

    if (!motivoEncontrado && (tipo === 'todos' || tipo === 'decreto')) {
        if (decretosMap && decretosMap[dateString]) {
            motivoEncontrado = typeof decretosMap[dateString] === 'object' ? decretosMap[dateString] : { motivo: decretosMap[dateString], tipo: 'decreto' };
        }
    }

    // Se encontrou algo, decide se retorna baseado em considerarDecretos e se é feriado/recesso
    if (motivoEncontrado) {
        const ehFeriadoOuRecesso = motivoEncontrado.tipo === 'feriado' || motivoEncontrado.tipo === 'recesso';
        // Feriados sempre retornam. Decretos só se considerarDecretos for true.
        if (ehFeriadoOuRecesso || considerarDecretos) {
            return motivoEncontrado;
        }
        if (motivoEncontrado.tipo === 'decreto' || motivoEncontrado.tipo === 'instabilidade') return null;
    }
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if (tipo === 'todos' || tipo === 'recesso' || tipo === 'feriado') {
        if ((month === 12 && day >= 20) || (month === 1 && day <= 20)) {
            if (ignorarRecesso) {
                if ((month === 12 && day >= 20) || (month === 1 && day <= 6)) {
                     return { motivo: 'Recesso Forense (Prisional/Urgentíssimo - Art. 798 CPP)', tipo: 'recesso', ehRecesso: true, ehProrrogavel: true };
                }
                return null;
            }
            return { motivo: 'Recesso Forense / Suspensão de Prazos (Art. 220 CPC)', tipo: 'recesso', ehRecesso: true, ehProrrogavel: true };
        }
    }

    return null;
};

const calcularPrazoFinalDiasCorridos = (inicioDoPrazo, prazo, comprovados = new Set(), ignorarRecesso = false, considerarDecretosNaProrrogacao = true) => {
    const VERSION = "V4_FIX_CRIME";
    const diasNaoUteisEncontrados = [];
    const diasPotenciaisComprovaveis = [];
    const diasNaoUteisDoInicio = [];
    let diasDeSuspensaoComprovadaNoPeriodo = 0;

    const getInfoDia = (d, consDecretos) => {
        const motivo = getMotivoDiaNaoUtil(d, consDecretos, 'todos', comprovados, ignorarRecesso);
        
        // Para a CONTAGEM do prazo CPP (ignorarRecesso=true), o recesso não deve contar como interrupção
        // Dias corridos não pulam fim de semana nem feriado, a menos que seja um recesso e ignorarRecesso=false
        let ehNaoUtilParaContagem = false;
        
        if (motivo) {
            if (motivo.ehRecesso) {
                ehNaoUtilParaContagem = !ignorarRecesso;
            } else if (motivo.tipo === 'decreto' || motivo.tipo === 'instabilidade' || motivo.tipo === 'feriado_cnj' || motivo.tipo === 'suspensao_outubro') {
                // SUSPENSÕES COMUMENTE COMPROVÁVEIS suspendem a contagem 
                if (comprovados.has(d.toISOString().split('T')[0])) {
                    ehNaoUtilParaContagem = true;
                }
            }
        }

        return { ehNaoUtilParaContagem, motivo };
    };

    // 1. Ajusta o início do prazo para o próximo dia útil.
    let inicioAjustado = new Date(inicioDoPrazo.getTime());
    while (true) {
        // Início do prazo sempre pula feriados e fins de semana. Decretos só se comprovados (se a flag permitir).
        const motivo = getMotivoDiaNaoUtil(inicioAjustado, considerarDecretosNaProrrogacao, 'todos', comprovados, ignorarRecesso); // changed false to ignorarRecesso exactly like in our fix
        const isWeekend = inicioAjustado.getDay() === 0 || inicioAjustado.getDay() === 6;
        if (!motivo && !isWeekend) break;
        if (motivo) diasNaoUteisDoInicio.push({ data: new Date(inicioAjustado.getTime()), ...motivo });
        inicioAjustado.setDate(inicioAjustado.getDate() + 1);
    }

    // 2. Calcula a data final iterando dia a dia.
    let diasCorridosContados = 1;
    let dataCorrente = new Date(inicioAjustado.getTime());
    while (diasCorridosContados < prazo) {
        dataCorrente.setDate(dataCorrente.getDate() + 1);
        const info = getInfoDia(dataCorrente, considerarDecretosNaProrrogacao);
        if (info.ehNaoUtilParaContagem) {
            if (info.motivo) diasNaoUteisEncontrados.push({ data: new Date(dataCorrente.getTime()), ...info.motivo });
            diasDeSuspensaoComprovadaNoPeriodo++;
        } else {
            diasCorridosContados++;
        }
    }

    // 3. Prorroga o prazo final se ele cair em um dia não útil.
    let prazoFinalAjustado = new Date(dataCorrente.getTime());
    const diasProrrogados = [];
    while (true) {
        const motivo = getMotivoDiaNaoUtil(prazoFinalAjustado, considerarDecretosNaProrrogacao, 'todos', comprovados, ignorarRecesso);
        const isWeekend = prazoFinalAjustado.getDay() === 0 || prazoFinalAjustado.getDay() === 6;
        
        if (!motivo && !isWeekend) break;
        
        if (motivo) diasProrrogados.push({ data: new Date(prazoFinalAjustado.getTime()), ...motivo });
        prazoFinalAjustado.setDate(prazoFinalAjustado.getDate() + 1);
    }

    return { 
        prazoFinal: dataCorrente, 
        prazoFinalProrrogado: prazoFinalAjustado, 
        diasNaoUteis: [...diasNaoUteisEncontrados, ...diasProrrogados], 
        diasProrrogados, 
        diasPotenciaisComprovaveis: diasNaoUteisDoInicio, 
        diasNaoUteisDoInicio 
    };
};

const ignorarRecesso = true;
const inicio = new Date('2025-12-17T00:00:00'); // Quarta, Inicio do Prazo (Pub 16, Disp 15)

const resSemDecreto = calcularPrazoFinalDiasCorridos(inicio, 15, new Set(), ignorarRecesso, false);

console.log("Prazo Sem Decreto (ignorarRecesso = true):");
console.log("- Data Final:", resSemDecreto.prazoFinal.toISOString().split('T')[0]);
console.log("- Data Final Prorrogada:", resSemDecreto.prazoFinalProrrogado.toISOString().split('T')[0]);
console.log("- Esperado: 2025-12-31");
console.log("- Recebido: " + resSemDecreto.prazoFinalProrrogado.toISOString().split('T')[0]);

