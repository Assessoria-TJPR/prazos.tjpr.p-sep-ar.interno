const getMotivoDiaNaoUtil = (date, considerarDecretos) => {
    const d = date.toISOString().split('T')[0];
    if (d === '2025-11-20') return { tipo: 'feriado' }; // Zumbi
    if (d === '2025-11-21' && considerarDecretos) return { tipo: 'decreto' };
    const day = date.getDay();
    if (day === 0 || day === 6) return { tipo: 'fds' };
    return null;
};

const getProximoDiaUtilParaPublicacao = (data, considerarDecretos) => {
    const proximoDia = new Date(data.getTime());
    let motivo;
    do {
        proximoDia.setDate(proximoDia.getDate() + 1);
        motivo = getMotivoDiaNaoUtil(proximoDia, considerarDecretos);
    } while (motivo && motivo.tipo !== 'instabilidade');
    return proximoDia;
};

console.log('Test 1: Avail 20/11 (Thu), Sem Decreto');
const d1 = new Date('2025-11-20T00:00:00');
const p1 = getProximoDiaUtilParaPublicacao(d1, false);
console.log('Pub Date:', p1.toISOString().split('T')[0]); // Expect 2025-11-21

console.log('Test 2: Avail 20/11 (Thu), Com Decreto 21/11');
// User Rule: "Pub can fall on decree". So we pass FALSE to ignore decree for Pub calc.
const d2 = new Date('2025-11-20T00:00:00');
const p2 = getProximoDiaUtilParaPublicacao(d2, false);
console.log('Pub Date:', p2.toISOString().split('T')[0]); // Expect 2025-11-21
