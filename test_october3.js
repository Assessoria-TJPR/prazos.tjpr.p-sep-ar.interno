const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf8');

function extractFunc(fileContent, funcName) {
    const regex = new RegExp(`const ${funcName}\\s*=\\s*(\\(.*?\\)\\s*=>\\s*{(?:[^{}]*|{(?:[^{}]*|{[^{}]*})*})*})`, 's');
    const match = fileContent.match(regex);
    if (match) return match[1];
    return null;
}

const getMotivoDiaNaoUtilStr = extractFunc(content, 'getMotivoDiaNaoUtil');
const calcularPrazoFinalDiasCorridosStr = extractFunc(content, 'calcularPrazoFinalDiasCorridos');
const getProximoDiaUtilParaPublicacaoStr = extractFunc(content, 'getProximoDiaUtilParaPublicacao');
const getProximoDiaUtilComprovadoStr = extractFunc(content, 'getProximoDiaUtilComprovado');

const getMotivoDiaNaoUtil = eval(getMotivoDiaNaoUtilStr);
const calcularPrazoFinalDiasCorridos = eval(calcularPrazoFinalDiasCorridosStr);
const getProximoDiaUtilParaPublicacao = eval(getProximoDiaUtilParaPublicacaoStr);
const getProximoDiaUtilComprovado = eval(getProximoDiaUtilComprovadoStr);

const helpers = {
    getMotivoDiaNaoUtil,
    calcularPrazoFinalDiasCorridos,
    getProximoDiaUtilParaPublicacao,
    getProximoDiaUtilComprovado,
    decretosMap: {}
};

// Mocking getMotivoDiaNaoUtil behavior for our specific dates
const originalGetMotivo = helpers.getMotivoDiaNaoUtil;
helpers.getMotivoDiaNaoUtil = (date, considerDecrets, type, comprovados, ignorarRecesso) => {
    const d = date.toISOString().split('T')[0];
    if (d === '2025-10-24') return { motivo: 'Instabilidade 24', tipo: 'instabilidade' };
    if (d === '2025-10-27') return { motivo: 'Decreto 27', tipo: 'decreto' };
    if (d === '2025-10-28') return { motivo: 'Decreto 28', tipo: 'decreto' };
    return originalGetMotivo(date, considerDecrets, type, comprovados, ignorarRecesso);
};

const { calcularPrazoCrime } = require('./regrasCrime.js');

const startDisp = new Date('2025-10-08T12:00:00');
const prazo = 15;

console.log('--- STEP 1: No comprovados ---');
const res1 = calcularPrazoCrime(null, null, prazo, [], startDisp, helpers, new Set(), false);
console.log('Prazo Final:', res1.comDecreto.prazoFinalProrrogado.toISOString().split('T')[0]); // 2025-10-24
console.log('Checkboxes:', res1.suspensoesComprovaveis.map(s => s.data.toISOString().split('T')[0])); 
// Expecting [2025-10-24]

console.log('--- STEP 2: Comprove 2025-10-24 ---');
const res2 = calcularPrazoCrime(null, null, prazo, [], startDisp, helpers, new Set(['2025-10-24']), false);
console.log('Prazo Final:', res2.comDecreto.prazoFinalProrrogado.toISOString().split('T')[0]); // 2025-10-27
console.log('Checkboxes:', res2.suspensoesComprovaveis.map(s => s.data.toISOString().split('T')[0]));
// Expecting [2025-10-24, 2025-10-27]

console.log('--- STEP 3: Comprove 2025-10-24 e 2025-10-27 ---');
const res3 = calcularPrazoCrime(null, null, prazo, [], startDisp, helpers, new Set(['2025-10-24', '2025-10-27']), false);
console.log('Prazo Final:', res3.comDecreto.prazoFinalProrrogado.toISOString().split('T')[0]); // 2025-10-28
console.log('Checkboxes:', res3.suspensoesComprovaveis.map(s => s.data.toISOString().split('T')[0]));
// Expecting [2025-10-24, 2025-10-27, 2025-10-28]

console.log('--- STEP 4: Comprove 24, 27 e 28 ---');
const res4 = calcularPrazoCrime(null, null, prazo, [], startDisp, helpers, new Set(['2025-10-24', '2025-10-27', '2025-10-28']), false);
console.log('Prazo Final:', res4.comDecreto.prazoFinalProrrogado.toISOString().split('T')[0]); // 2025-10-29
console.log('Checkboxes:', res4.suspensoesComprovaveis.map(s => s.data.toISOString().split('T')[0]));
// Expecting [2025-10-24, 2025-10-27, 2025-10-28]
