const { calcularPrazoCrime } = require('./regrasCrime.js');

// Mock helpers with essential logic for the test
const getMotivoDiaNaoUtil = (date) => {
    const d = date.toISOString().split('T')[0];
    if (d === '2025-10-24') return { motivo: 'Instabilidade 24', tipo: 'instabilidade' };
    if (d === '2025-10-27') return { motivo: 'Decreto 27', tipo: 'decreto' };
    if (d === '2025-10-28') return { motivo: 'Decreto 28', tipo: 'decreto' };
    if (date.getDay() === 0 || date.getDay() === 6) return { motivo: 'FDS', tipo: 'fim_de_semana' };
    return null;
};

const getProximoDiaUtilComprovado = (data, comprovados) => {
    const proximoDia = new Date(data.getTime());
    do {
        proximoDia.setDate(proximoDia.getDate() + 1);
        const dStr = proximoDia.toISOString().split('T')[0];
        const motivo = getMotivoDiaNaoUtil(proximoDia);
        const ehNaoUtil = proximoDia.getDay() === 0 || proximoDia.getDay() === 6 || (motivo && (motivo.tipo === 'feriado' || comprovados.has(dStr)));
        if (!ehNaoUtil) break;
    } while (true);
    return { proximoDia };
};

const helpers = {
    getMotivoDiaNaoUtil,
    getProximoDiaUtilParaPublicacao: (data) => {
        // Simple D+1 for this test
        const proximoDia = new Date(data.getTime());
        proximoDia.setDate(proximoDia.getDate() + 1);
        return { proximoDia, suspensoesEncontradas: [] };
    },
    getProximoDiaUtilComprovado,
    calcularPrazoFinalDiasCorridos: (inicio, prazo, comprovados) => {
        // Implementation based on app.js logic
        let current = new Date(inicio.getTime());
        let count = 1;
        while (count < prazo) {
            current.setDate(current.getDate() + 1);
            count++;
        }
        
        let finalProrrogado = new Date(current.getTime());
        while (true) {
            const dStr = finalProrrogado.toISOString().split('T')[0];
            const motivo = getMotivoDiaNaoUtil(finalProrrogado);
            const ehNaoUtil = finalProrrogado.getDay() === 0 || finalProrrogado.getDay() === 6 || (motivo && comprovados.has(dStr));
            if (!ehNaoUtil) break;
            finalProrrogado.setDate(finalProrrogado.getDate() + 1);
        }
        return { prazoFinalProrrogado: finalProrrogado };
    },
    decretosMap: {}
};

const startDisp = new Date('2025-10-08T12:00:00');
const prazo = 15;

console.log('--- TEST CASCADE ---');

console.log('Case 0: No comprovados');
const res0 = calcularPrazoCrime(null, null, prazo, [], startDisp, helpers, new Set(), false);
console.log('Result Deadline:', res0.comDecreto.prazoFinalProrrogado.toISOString().split('T')[0]);
console.log('UI Checkboxes:', res0.suspensoesComprovaveis.map(s => s.data.toISOString().split('T')[0]));

console.log('Case 1: Comprove 24');
const res1 = calcularPrazoCrime(null, null, prazo, [], startDisp, helpers, new Set(['2025-10-24']), false);
console.log('Result Deadline:', res1.comDecreto.prazoFinalProrrogado.toISOString().split('T')[0]);
console.log('UI Checkboxes:', res1.suspensoesComprovaveis.map(s => s.data.toISOString().split('T')[0]));

console.log('Case 2: Comprove 24, 27');
const res2 = calcularPrazoCrime(null, null, prazo, [], startDisp, helpers, new Set(['2025-10-24', '2025-10-27']), false);
console.log('Result Deadline:', res2.comDecreto.prazoFinalProrrogado.toISOString().split('T')[0]);
console.log('UI Checkboxes:', res2.suspensoesComprovaveis.map(s => s.data.toISOString().split('T')[0]));

console.log('Case 3: Comprove 24, 27, 28');
const res3 = calcularPrazoCrime(null, null, prazo, [], startDisp, helpers, new Set(['2025-10-24', '2025-10-27', '2025-10-28']), false);
console.log('Result Deadline:', res3.comDecreto.prazoFinalProrrogado.toISOString().split('T')[0]);
console.log('UI Checkboxes:', res3.suspensoesComprovaveis.map(s => s.data.toISOString().split('T')[0]));
