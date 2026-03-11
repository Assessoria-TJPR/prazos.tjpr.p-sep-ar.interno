const feriadosMap = {
    '2025-12-25': { motivo: 'Natal (Nº 621/2025)', tipo: 'feriado' },
};

const decretosMap = {
    '2025-12-18': { motivo: 'Dia da Justiça (Feriado Regimental - Transf. p/ Decreto 808/2024)', tipo: 'decreto' },
    '2025-12-19': { motivo: 'Emancipação Política do Paraná (Nº 645/2024)', tipo: 'decreto' }
};

const getMotivoDiaNaoUtil = (date, considerarDecretos, tipo = 'todos', comprovados = new Set()) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateString = date.toISOString().split('T')[0];

    // Feriados Fixos e Móveis (MOCK)
    if (tipo === 'todos' || tipo === 'feriado') {
        if (feriadosMap[dateString]) return feriadosMap[dateString];
    }

    // Recesso Forense (20/12 a 20/01)
    if (tipo === 'todos' || tipo === 'recesso' || tipo === 'feriado') {
        if ((month === 12 && day >= 20) || (month === 1 && day <= 20)) {
            return { motivo: 'Recesso Forense / Suspensão de Prazos (Art. 220 CPC)', tipo: 'recesso' };
        }
    }

    // Decretos
    if (considerarDecretos && (tipo === 'todos' || tipo === 'decreto')) {
        if (decretosMap[dateString]) return decretosMap[dateString];
    }

    return null;
};

const logs = [];
function flog(msg) { logs.push(msg); }

const calcularPrazoFinalDiasCorridos = (inicioDoPrazo, prazo, comprovados = new Set(), ignorarRecesso = false, considerarDecretosNaProrrogacao = true) => {
    const diasNaoUteisEncontrados = [];
    const diasNaoUteisDoInicio = [];
    let inicioAjustado = new Date(inicioDoPrazo.getTime());
    let infoDiaInicioNaoUtil;
    do {
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
            : false;
    } while (infoDiaInicioNaoUtil || inicioAjustado.getDay() === 0 || inicioAjustado.getDay() === 6);

    let diasCorridosContados = 0;
    let dataCorrente = new Date(inicioAjustado.getTime());
    diasCorridosContados = 1;

    flog(`Inicio ajustado: ${inicioAjustado.toISOString().split('T')[0]}`);

    while (diasCorridosContados < prazo) {
        dataCorrente.setDate(dataCorrente.getDate() + 1);
        const dataCorrenteStr = dataCorrente.toISOString().split('T')[0];
        
        let ehSuspensaoComprovada = false;
        let infoSuspensao = null;
        
        if (ignorarRecesso && ((dataCorrente.getMonth() === 11 && dataCorrente.getDate() === 24) || (dataCorrente.getMonth() === 11 && dataCorrente.getDate() === 31))) {
            if (comprovados.has(dataCorrenteStr)) {
                ehSuspensaoComprovada = true;
                infoSuspensao = { motivo: (dataCorrente.getDate() === 24 ? 'Véspera de Natal' : 'Véspera de Ano Novo'), tipo: 'decreto' };
            }
        } else if (comprovados.has(dataCorrenteStr)) {
            infoSuspensao = getMotivoDiaNaoUtil(dataCorrente, true, 'decreto') || getMotivoDiaNaoUtil(dataCorrente, true, 'instabilidade');
            if (infoSuspensao) ehSuspensaoComprovada = true;
        }
        
        if (ehSuspensaoComprovada && infoSuspensao) {
            flog(`Suspenso no dia: ${dataCorrenteStr} devido a ${infoSuspensao.motivo}`);
            diasNaoUteisEncontrados.push({ data: new Date(dataCorrente.getTime()), ...infoSuspensao });
        } else {
            diasCorridosContados++;
            flog(`Contado dia: ${dataCorrenteStr} (Total: ${diasCorridosContados})`);
        }
    }

    const dataFinalBruta = new Date(dataCorrente.getTime());
    flog(`Data final bruta: ${dataFinalBruta.toISOString().split('T')[0]}`);

    let prazoFinalAjustado = new Date(dataFinalBruta.getTime());
    let infoDiaFinalNaoUtil;
    const diasProrrogados = [];

    while (true) {
        const motivoRecesso = getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'recesso');
        const ehRecessoValido = motivoRecesso && !ignorarRecesso;

        let infoDecreto = null;
        if (considerarDecretosNaProrrogacao && comprovados.has(prazoFinalAjustado.toISOString().split('T')[0])) {
            infoDecreto = getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'decreto') || getMotivoDiaNaoUtil(prazoFinalAjustado, true, 'instabilidade');
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

    flog(`Prazo final prorrogado: ${prazoFinalAjustado.toISOString().split('T')[0]}`);
    return { prazoFinal: dataFinalBruta, prazoFinalProrrogado: prazoFinalAjustado };
};

flog("TEST 2: With comprovações (Com Decreto)");
calcularPrazoFinalDiasCorridos(new Date('2025-12-16T00:00:00'), 15, new Set(['2025-12-18', '2025-12-19', '2025-12-24', '2025-12-31']), true, true);

const fs = require('fs');
fs.writeFileSync('out.json', JSON.stringify(logs, null, 2));
