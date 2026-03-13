const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf8');

function extractFunc(fileContent, funcName) {
    const regex = new RegExp(`const ${funcName}\\s*=\\s*(\\(.*?\\)\\s*=>\\s*{(?:[^{}]*|{(?:[^{}]*|{[^{}]*})*})*})`, 's');
    const match = fileContent.match(regex);
    if (match) return match[1];
    
    const regex2 = new RegExp(`${funcName}\\s*=\\s*(\\(.*?\\)\\s*=>\\s*{(?:[^{}]*|{(?:[^{}]*|{[^{}]*})*})*})`, 's');
    const match2 = fileContent.match(regex2);
    if (match2) return match2[1];
    
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
    decretosMap: {
        '2025-10-24': { motivo: 'Instabilidade', tipo: 'instabilidade' },
        '2025-10-27': { motivo: 'Decreto X', tipo: 'decreto' },
        '2025-10-28': { motivo: 'Decreto Y', tipo: 'decreto' }
    }
};

const { calcularPrazoCrime } = require('./regrasCrime.js');

const inicioDisponibilizacao = new Date('2025-10-08T00:00:00');
const res = calcularPrazoCrime(null, null, 15, [], inicioDisponibilizacao, helpers, new Set(), false);

console.log('--- RESULTADO DO CALCULO (Ignorar Recesso = FALSE) ---');
console.log('Disponibilização: 08/10/2025');
console.log('Publicação:', res.dataPublicacao.toLocaleDateString('pt-BR'));
console.log('Início do Prazo:', res.inicioPrazo.toLocaleDateString('pt-BR'));
if (res.semDecreto) {
    const pF = res.semDecreto.prazoFinalProrrogado || res.semDecreto.prazoFinal;
    console.log('Prazo Final (Sem Decreto):', pF.toLocaleDateString('pt-BR'));
}
console.log('Checkboxes de Suspensão:', res.suspensoesComprovaveis.length);
if (res.suspensoesComprovaveis.length > 0) {
    res.suspensoesComprovaveis.forEach(s => console.log('   - ', s.data.toISOString().split('T')[0], s.motivo));
}

const resPreso = calcularPrazoCrime(null, null, 15, [], inicioDisponibilizacao, helpers, new Set(), true);
console.log('--- RESULTADO DO CALCULO (Ignorar Recesso = TRUE) ---');
console.log('Checkboxes de Suspensão:', resPreso.suspensoesComprovaveis.length);
if (resPreso.suspensoesComprovaveis.length > 0) {
    resPreso.suspensoesComprovaveis.forEach(s => console.log('   - ', s.data.toISOString().split('T')[0], s.motivo));
}
