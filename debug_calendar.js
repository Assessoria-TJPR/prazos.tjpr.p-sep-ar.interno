
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

// Inspect December 2025
console.log('--- CALENDÁRIO DEZEMBRO 2025 ---');
for (let d = 1; d <= 31; d++) {
    const date = new Date(Date.UTC(2025, 11, d));
    const motivo = getMotivoDiaNaoUtil(date, true, 'todos', new Set(), true); // ignorarRecesso = true
    const dayName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][date.getUTCDay()];
    if (motivo || date.getUTCDay() === 0 || date.getUTCDay() === 6) {
        console.log(`${date.toISOString().split('T')[0]} (${dayName}): ${motivo ? motivo.motivo + ' [' + motivo.tipo + ']' : 'FDS'}`);
    }
}

// Inspect January 2026
console.log('\n--- CALENDÁRIO JANEIRO 2026 ---');
for (let d = 1; d <= 10; d++) {
    const date = new Date(Date.UTC(2026, 0, d));
    const motivo = getMotivoDiaNaoUtil(date, true, 'todos', new Set(), true);
    const dayName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][date.getUTCDay()];
    if (motivo || date.getUTCDay() === 0 || date.getUTCDay() === 6) {
        console.log(`${date.toISOString().split('T')[0]} (${dayName}): ${motivo ? motivo.motivo + ' [' + motivo.tipo + ']' : 'FDS'}`);
    }
}
