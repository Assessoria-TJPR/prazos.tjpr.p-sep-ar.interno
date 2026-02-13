
const dataForView = [
    { materia: 'Cível', prazo: 15 },
    { materia: 'civel', prazo: '15' },
    { materia: 'Criminal', prazo: 5 },
    { materia: 'crime', prazo: '5' },
    { materia: 'Outros', prazo: 10 }
];

console.log("Mock Data:", JSON.stringify(dataForView, null, 2));

const stats = {
    perMateria: dataForView.reduce((acc, curr) => {
        if (curr.materia) acc[curr.materia] = (acc[curr.materia] || 0) + 1;
        return acc;
    }, {}),
    perPrazo: dataForView.reduce((acc, curr) => {
        if (curr.prazo) acc[curr.prazo] = (acc[curr.prazo] || 0) + 1;
        return acc;
    }, {})
};

console.log("\nCalculated Stats:", JSON.stringify(stats, null, 2));

const chartDataMateria = {
    labels: ['Cível', 'Crime'],
    datasets: [{
        data: [
            stats.perMateria.civel || 0,
            stats.perMateria.crime || 0
        ]
    }]
};

const chartDataPrazo = {
    labels: ['5 Dias', '15 Dias'],
    datasets: [{
        data: [
            stats.perPrazo[5] || 0,
            stats.perPrazo[15] || 0
        ]
    }]
};

console.log("\nChart Data Materia (Expected 'civel'/'crime'):");
console.log("Civel:", chartDataMateria.datasets[0].data[0]);
console.log("Crime:", chartDataMateria.datasets[0].data[1]);

console.log("\nChart Data Prazo (Expected 5/15):");
console.log("5 Dias:", chartDataPrazo.datasets[0].data[0]);
console.log("15 Dias:", chartDataPrazo.datasets[0].data[1]);
