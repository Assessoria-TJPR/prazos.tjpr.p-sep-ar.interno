
const feriadosMap = {
    '2025-12-25': 'Natal',
    '2026-01-01': 'Confraternização Universal'
};

const decretosMap = {
    '2025-12-18': { motivo: 'Dia da Justiça', tipo: 'decreto' },
    '2025-12-19': { motivo: 'Emancipação Política do Paraná', tipo: 'decreto' },
    '2025-12-24': { motivo: 'Véspera de Natal', tipo: 'decreto' },
    '2025-12-31': { motivo: 'Véspera de Ano Novo', tipo: 'decreto' }
};

const getMotivoDiaNaoUtil = (date, considerarDecretos, tipo = 'todos', comprovados = new Set(), ignorarRecesso = false) => {
    if (!date || isNaN(date.getTime())) return null;
    const dateString = date.toISOString().split('T')[0];
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();

    let motivoEncontrado = null;

    if (dateString === '2025-12-18' && (tipo === 'todos' || tipo === 'decreto')) {
        motivoEncontrado = { motivo: 'Dia da Justiça (Feriado Regimental - Transf. p/ Decreto 808/2024)', tipo: 'decreto' };
    }

    if (!motivoEncontrado && (tipo === 'todos' || tipo === 'feriado')) {
        if (feriadosMap[dateString]) motivoEncontrado = { motivo: feriadosMap[dateString], tipo: 'feriado' };
    }

    if (!motivoEncontrado && (tipo === 'todos' || tipo === 'decreto')) {
        if (decretosMap[dateString]) {
            motivoEncontrado = decretosMap[dateString];
        }
    }

    if (!motivoEncontrado && (tipo === 'todos' || tipo === 'recesso' || tipo === 'feriado')) {
        if ((month === 12 && day >= 20) || (month === 1 && day <= 20)) {
            if (ignorarRecesso) return null;
            return { motivo: 'Recesso Forense', tipo: 'recesso', ehRecesso: true, ehProrrogavel: true };
        }
    }

    if (motivoEncontrado) {
        const ehFeriadoOuRecesso = motivoEncontrado.tipo === 'feriado' || motivoEncontrado.tipo === 'recesso';
        if (ehFeriadoOuRecesso || considerarDecretos) {
            return motivoEncontrado;
        }
    }

    return null;
};

const getProximoDiaUtilParaPublicacao = (data, considerarDecretos = true, comprovados = new Set(), ignorarRecesso = false) => {
    const suspensoesEncontradas = [];
    const proximoDia = new Date(data.getTime());
    let motivo;
    do {
        proximoDia.setDate(proximoDia.getDate() + 1);
        motivo = getMotivoDiaNaoUtil(proximoDia, considerarDecretos, 'todos', comprovados, ignorarRecesso);
        if (motivo && motivo.tipo !== 'instabilidade') {
            suspensoesEncontradas.push({ data: new Date(proximoDia.getTime()), ...motivo });
        }
    } while (proximoDia.getDay() === 0 || proximoDia.getDay() === 6 || (motivo && motivo.tipo !== 'instabilidade'));
    return { proximoDia, suspensoesEncontradas };
};

const getProximoDiaUtilComprovado = (data, comprovados, ignorarRecesso = false) => {
    const suspensoesEncontradas = [];
    const proximoDia = new Date(data.getTime());
    let motivo;
    do {
        proximoDia.setDate(proximoDia.getDate() + 1);
        const dataStr = proximoDia.toISOString().split('T')[0];
        motivo = getMotivoDiaNaoUtil(proximoDia, true, 'todos', comprovados, ignorarRecesso);

        const eFimDeSemana = proximoDia.getDay() === 0 || proximoDia.getDay() === 6;
        const eSuspensaoRelevante = motivo && (motivo.tipo === 'feriado' || motivo.tipo === 'recesso' || comprovados.has(dataStr));

        if (eSuspensaoRelevante) {
            suspensoesEncontradas.push({ data: new Date(proximoDia.getTime()), ...motivo });
        }
    } while (proximoDia.getDay() === 0 || proximoDia.getDay() === 6 || (motivo && (motivo.tipo === 'feriado' || (motivo.tipo === 'recesso' && !ignorarRecesso) || comprovados.has(proximoDia.toISOString().split('T')[0]))));
    return { proximoDia, suspensoesEncontradas };
};

const calcularPrazoFinalDiasCorridos = (inicioDoPrazo, prazo, comprovados = new Set(), ignorarRecesso = false, considerarDecretosNaProrrogacao = true) => {
    const diasNaoUteisEncontrados = [];
    const diasNaoUteisDoInicio = [];

    const isDiaNaoUtilBoundary = (d) => {
        const dataStr = d.toISOString().split('T')[0];
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const motivo = getMotivoDiaNaoUtil(d, true, 'todos', comprovados, ignorarRecesso);
        
        if (isWeekend) return { ehNaoUtil: true, motivo: { motivo: 'Fim de Semana', tipo: 'fim_de_semana' } };
        
        if (motivo) {
            if (motivo.tipo === 'feriado') return { ehNaoUtil: true, motivo };
            if (motivo.ehRecesso && !ignorarRecesso) {
                return { ehNaoUtil: true, motivo };
            }
            if (comprovados.has(dataStr)) return { ehNaoUtil: true, motivo };
        }
        return { ehNaoUtil: false };
    };

    const getInfoDia = (d) => {
        const motivo = getMotivoDiaNaoUtil(d, false, 'todos', comprovados, ignorarRecesso);
        let ehNaoUtilParaContagem = false;
        if (motivo && motivo.ehRecesso) {
            ehNaoUtilParaContagem = !ignorarRecesso;
        }
        return { ehNaoUtilParaContagem, motivo };
    };

    let inicioAjustado = new Date(inicioDoPrazo.getTime());
    while (true) {
        const res = isDiaNaoUtilBoundary(inicioAjustado);
        if (!res.ehNaoUtil) break;
        if (res.motivo && res.motivo.tipo !== 'fim_de_semana') {
            diasNaoUteisDoInicio.push({ data: new Date(inicioAjustado.getTime()), ...res.motivo });
        }
        inicioAjustado.setDate(inicioAjustado.getDate() + 1);
    }

    let diasCorridosContados = 1;
    let dataCorrente = new Date(inicioAjustado.getTime());
    while (diasCorridosContados < prazo) {
        dataCorrente.setDate(dataCorrente.getDate() + 1);
        const info = getInfoDia(dataCorrente);
        if (info.ehNaoUtilParaContagem) {
            if (info.motivo) diasNaoUteisEncontrados.push({ data: new Date(dataCorrente.getTime()), ...info.motivo });
            diasDeSuspensaoComprovadaNoPeriodo++;
        } else {
            diasCorridosContados++;
        }
    }

    let prazoFinalAjustado = new Date(dataCorrente.getTime());
    const diasProrrogados = [];
    while (true) {
        const res = isDiaNaoUtilBoundary(prazoFinalAjustado);
        if (!res.ehNaoUtil) break;
        if (res.motivo) diasProrrogados.push({ data: new Date(prazoFinalAjustado.getTime()), ...res.motivo });
        prazoFinalAjustado.setDate(prazoFinalAjustado.getDate() + 1);
    }

    return { 
        prazoFinal: dataCorrente, 
        prazoFinalProrrogado: prazoFinalAjustado, 
        diasProrrogados
    };
};

const helpers = {
    getProximoDiaUtilParaPublicacao,
    getProximoDiaUtilComprovado,
    calcularPrazoFinalDiasCorridos,
    getMotivoDiaNaoUtil,
    decretosMap
};

// Scenario from screenshot
const inicioDisponibilizacao = new Date('2025-12-17T00:00:00');
const prazoNumerico = 15;
const ignorarRecesso = true;
const diasComprovados = new Set(['2025-12-18']);

const res = calcularPrazoCrime(
    null, // Not used
    null, // Not used
    prazoNumerico,
    [], // Not used
    inicioDisponibilizacao,
    helpers,
    diasComprovados,
    ignorarRecesso
);

console.log('--- RESULTADO ---');
console.log('Publicação:', res.dataPublicacao.toISOString().split('T')[0]);
console.log('Início do Prazo:', res.inicioPrazo.toISOString().split('T')[0]);
console.log('Prazo Final Sem Decreto:', res.semDecreto.prazoFinalProrrogado.toISOString().split('T')[0]);
console.log('Prazo Final Com Decreto:', res.comDecreto.prazoFinalProrrogado.toISOString().split('T')[0]);
console.log('Dias Prorrogados no Com Decreto:', res.comDecreto.diasProrrogados.map(d => d.data.toISOString().split('T')[0]));
