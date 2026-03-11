const fs = require('fs');
const path = require('path');

// Mock components and React
global.React = { useState: () => [{}, () => {}], useEffect: () => {}, useCallback: (f) => f, createContext: () => ({Provider: () => {}}), useContext: () => ({}), useRef: () => ({}), useMemo: (f) => f() };
global.window = { ReactChartjs2: { Bar: () => null, HorizontalBar: () => null, Pie: () => null } };
global.firebase = { firestore: { FieldValue: { serverTimestamp: () => new Date() } } };

const content = fs.readFileSync('app.js', 'utf8');

function extractFunc(fileContent, funcName) {
    // Basic regex for arrow functions defined as const funcName = (...) => { ... }
    const regex = new RegExp(`const ${funcName}\\s*=\\s*(\\(.*?\\)\\s*=>\\s*{(?:[^{}]*|{(?:[^{}]*|{[^{}]*})*})*})`, 's');
    const match = fileContent.match(regex);
    if (match) return match[1];
    
    // Try without const (assignment)
    const regex2 = new RegExp(`${funcName}\\s*=\\s*(\\(.*?\\)\\s*=>\\s*{(?:[^{}]*|{(?:[^{}]*|{[^{}]*})*})*})`, 's');
    const match2 = fileContent.match(regex2);
    if (match2) return match2[1];
    
    return null;
}

const getMotivoDiaNaoUtilStr = extractFunc(content, 'getMotivoDiaNaoUtil');
const calcularPrazoFinalDiasCorridosStr = extractFunc(content, 'calcularPrazoFinalDiasCorridos');
const getProximoDiaUtilParaPublicacaoStr = extractFunc(content, 'getProximoDiaUtilParaPublicacao');
const getProximoDiaUtilComprovadoStr = extractFunc(content, 'getProximoDiaUtilComprovado');

if (!getMotivoDiaNaoUtilStr) {
    console.error('Function getMotivoDiaNaoUtil not found');
    process.exit(1);
}

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

const { calcularPrazoCrime } = require('./regrasCrime.js');

const inicioDisponibilizacao = new Date('2025-12-15T12:00:00');
const res = calcularPrazoCrime(null, null, 15, [], inicioDisponibilizacao, helpers, new Set(), true);

console.log('--- RESULTADO DO CALCULO ---');
console.log('Disponibilização:', '15/12/2025');
console.log('Publicação:', res.dataPublicacao.toLocaleDateString('pt-BR'));
console.log('Início do Prazo:', res.inicioPrazo.toLocaleDateString('pt-BR'));
console.log('Prazo Final:', res.semDecreto.prazoFinalProrrogado.toLocaleDateString('pt-BR'));
console.log('Checkboxes de Suspensão:', res.suspensoesComprovaveis.length);
