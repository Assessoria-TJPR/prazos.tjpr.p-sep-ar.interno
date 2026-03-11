const fs = require('fs');
const path = require('path');

// Mock components and React
global.React = { useState: () => [{}, () => {}], useEffect: () => {}, useCallback: (f) => f, createContext: () => ({Provider: () => {}}), useContext: () => ({}), useRef: () => ({}), useMemo: (f) => f() };
global.window = { ReactChartjs2: { Bar: () => null, HorizontalBar: () => null, Pie: () => null } };

// Mock firebase
global.firebase = { firestore: { FieldValue: { serverTimestamp: () => new Date() } } };

// Utility to extract function source
function extractFunc(fileContent, funcName) {
    const regex = new RegExp(`const ${funcName}\\s*=\\s*(\\(.*?\\)\\s*=>\\s*{(?:[^{}]*|{(?:[^{}]*|{[^{}]*})*})*})`, 's');
    const match = fileContent.match(regex);
    if (match) return match[1];
    
    // Try without const
    const regex2 = new RegExp(`${funcName}\\s*=\\s*(\\(.*?\\)\\s*=>\\s*{(?:[^{}]*|{(?:[^{}]*|{[^{}]*})*})*})`, 's');
    const match2 = fileContent.match(regex2);
    if (match2) return match2[1];
    
    return null;
}

const appJs = fs.readFileSync('app.js', 'utf8');
const regrasCrimeJs = fs.readFileSync('regrasCrime.js', 'utf8');

// We need getMotivoDiaNaoUtil, calcularPrazoFinalDiasCorridos, getProximoDiaUtilParaPublicacao, getProximoDiaUtilComprovado
const getMotivoDiaNaoUtilSrc = extractFunc(appJs, 'getMotivoDiaNaoUtil');
const calcularPrazoFinalDiasCorridosSrc = extractFunc(appJs, 'calcularPrazoFinalDiasCorridos');
const getProximoDiaUtilParaPublicacaoSrc = extractFunc(appJs, 'getProximoDiaUtilParaPublicacao');
const getProximoDiaUtilComprovadoSrc = extractFunc(appJs, 'getProximoDiaUtilComprovado');

// Mock helpers for rules
const getMotivoDiaNaoUtil = eval(getMotivoDiaNaoUtilSrc);
const calcularPrazoFinalDiasCorridos = eval(calcularPrazoFinalDiasCorridosSrc);
const getProximoDiaUtilParaPublicacao = eval(getProximoDiaUtilParaPublicacaoSrc);
const getProximoDiaUtilComprovado = eval(getProximoDiaUtilComprovadoSrc);

const helpers = {
    getMotivoDiaNaoUtil,
    calcularPrazoFinalDiasCorridos,
    getProximoDiaUtilParaPublicacao,
    getProximoDiaUtilComprovado,
    decretosMap: {}
};

// Import calcularPrazoCrime
const { calcularPrazoCrime } = require('./regrasCrime.js');

// TEST SCENARIO
const inicioDisponibilizacao = new Date('2025-12-15T12:00:00');
const prazoNumerico = 15;
const ignorarRecesso = true;
const diasComprovados = new Set();

const resultado = calcularPrazoCrime(
    null, // _dataPubApp (not used by my current version of regrasCrime)
    null, // _inicioPrazoApp
    prazoNumerico,
    [], // diasNaoUteisDoInicioComDecreto
    inicioDisponibilizacao,
    helpers,
    diasComprovados,
    ignorarRecesso
);

console.log('--- TESTE: DISP 15/12/2025, PRAZO 15, IGNORAR RECESSO = TRUE ---');
console.log('Data Publicação:', resultado.dataPublicacao.toISOString().split('T')[0]);
console.log('Início Prazo:', resultado.inicioPrazo.toISOString().split('T')[0]);
console.log('Prazo Final (Sem Decreto):', resultado.semDecreto.prazoFinalProrrogado.toISOString().split('T')[0]);
console.log('Suspensões Comprováveis:', resultado.suspensoesComprovaveis.map(s => `${s.data.toISOString().split('T')[0]} (${s.tipo})`));

if (resultado.suspensoesComprovaveis.length === 0) {
    console.log('SUCESSO: Nenhuma checkbox de recesso foi gerada.');
} else {
    console.log('FALHA: Checkboxes indesejadas encontradas!');
    process.exit(1);
}
