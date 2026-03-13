const fs = require('fs');

global.React = { useState: () => [{}, () => {}], useEffect: () => {}, useCallback: (f) => f, createContext: () => ({Provider: () => {}}), useContext: () => ({}), useRef: () => ({}), useMemo: (f) => f() };
global.window = { ReactChartjs2: { Bar: () => null, HorizontalBar: () => null, Pie: () => null } };
global.firebase = { firestore: { FieldValue: { serverTimestamp: () => new Date() } } };

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
const getMotivoDiaNaoUtil = eval(getMotivoDiaNaoUtilStr);

const calcularPrazoFinalDiasCorridosFunc = require('./temp_calcular.js');

const getProximoDiaUtilParaPublicacaoStr = extractFunc(content, 'getProximoDiaUtilParaPublicacao');
const getProximoDiaUtilParaPublicacao = eval(getProximoDiaUtilParaPublicacaoStr);

const getProximoDiaUtilComprovadoStr = extractFunc(content, 'getProximoDiaUtilComprovado');
const getProximoDiaUtilComprovado = eval(getProximoDiaUtilComprovadoStr);

const { calcularPrazoCrime } = require('./regrasCrime.js');

const helpers = {
    getMotivoDiaNaoUtil,
    calcularPrazoFinalDiasCorridos: calcularPrazoFinalDiasCorridosFunc,
    getProximoDiaUtilParaPublicacao,
    getProximoDiaUtilComprovado,
    decretosMap: {
        '2025-10-27': { motivo: 'Decreto X', tipo: 'decreto' },
        '2025-10-28': { motivo: 'Decreto Y', tipo: 'decreto' }
    }
};

const inicioDisponibilizacao = new Date('2025-10-08T00:00:00');
const res = calcularPrazoCrime(null, null, 15, [], inicioDisponibilizacao, helpers, new Set(), false);

console.log('--- RESULTADO DO CALCULO (Ignorar Recesso = FALSE) ---');
console.log('Disponibilização: 08/10/2025');
console.log('Publicação:', res.dataPublicacao.toLocaleDateString('pt-BR'));
console.log('Início do Prazo:', res.inicioPrazo.toLocaleDateString('pt-BR'));
if (res.semDecreto) {
    console.log('Prazo Final (Sem Decreto):', res.semDecreto.prazoFinalProrrogado ? res.semDecreto.prazoFinalProrrogado.toLocaleDateString('pt-BR') : res.semDecreto.prazoFinal.toLocaleDateString('pt-BR'));
}
console.log('Checkboxes de Suspensão:', res.suspensoesComprovaveis.length);

const resPreso = calcularPrazoCrime(null, null, 15, [], inicioDisponibilizacao, helpers, new Set(), true);
console.log('--- RESULTADO DO CALCULO (Ignorar Recesso = TRUE) ---');
console.log('Checkboxes de Suspensão:', resPreso.suspensoesComprovaveis.length);
