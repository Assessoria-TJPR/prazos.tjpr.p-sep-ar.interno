const fs = require('fs');

const { calcularPrazoCrime } = require('./regrasCrime.js');
const { getProximoDiaUtilParaPublicacao, getMotivoDiaNaoUtil, getProximoDiaUtilComprovado, decretosMap } = require('./regrasCivel.js');

const fsContent = fs.readFileSync('./app.js', 'utf8');

// Extrair calcularPrazoFinalDiasCorridos
const match = fsContent.match(/const calcularPrazoFinalDiasCorridos = \([\s\S]*?^    };\n/m);

// Fazer eval num contexto para não poluir
let calcularPrazoFinalDiasCorridosFunc;
const wrapper = `
    const getMotivoDiaNaoUtil = require('./regrasCivel.js').getMotivoDiaNaoUtil;
    ${match[0]}
    module.exports = calcularPrazoFinalDiasCorridos;
`;
fs.writeFileSync('./temp_calcular.js', wrapper);
calcularPrazoFinalDiasCorridosFunc = require('./temp_calcular.js');


const helpers = {
    getProximoDiaUtilParaPublicacao,
    calcularPrazoFinalDiasCorridos: calcularPrazoFinalDiasCorridosFunc,
    getMotivoDiaNaoUtil,
    getProximoDiaUtilComprovado,
    decretosMap
};


const inicioDisponibilizacao = new Date('2025-12-15T00:00:00');
const dataPublicacaoSemDecreto = new Date('2025-12-16T00:00:00');
const inicioPrazo = new Date('2025-12-17T00:00:00');
const comprovados = new Set(['2025-12-18', '2025-12-19', '2025-12-24', '2025-12-31']);

const res = calcularPrazoCrime(
    dataPublicacaoSemDecreto, 
    inicioPrazo, 
    15, 
    [], 
    inicioDisponibilizacao, 
    helpers, 
    comprovados, 
    true
);

console.log("Comprovados:", comprovados);
console.log("Prazo Sem Decreto:", res.semDecreto.prazoFinalProrrogado.toISOString().split('T')[0]);
console.log("Prazo Com Decreto:", res.comDecreto.prazoFinalProrrogado.toISOString().split('T')[0]);

fs.unlinkSync('./temp_calcular.js');
