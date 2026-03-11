const fs = require('fs');

const appContent = fs.readFileSync('app.js', 'utf8');

// Extrair funcoes necessarias

function extractFunction(codigo, funcName) {
    const reg = new RegExp(`const ${funcName} = \\(.*?\\) => {`);
    const match = reg.exec(codigo);
    if (!match) return;
    let index = match.index;
    let braces = 0;
    let start = index;
    // Pula ate a primeira chave
    while(codigo[index] !== '{') index++;
    index++;
    braces++;
    while(braces > 0 && index < codigo.length) {
        if (codigo[index] === '{') braces++;
        if (codigo[index] === '}') braces--;
        index++;
    }
    return codigo.substring(start, index) + ';';
}

const getMotivoDiaNaoUtilStr = extractFunction(appContent, 'getMotivoDiaNaoUtil');
const calcularPrazoFinalDiasCorridosStr = extractFunction(appContent, 'calcularPrazoFinalDiasCorridos');
const getProximaSuspensaoComprovavelStr = extractFunction(appContent, 'getProximaSuspensaoComprovavel');
const getProximoDiaUtilComprovadoStr = extractFunction(appContent, 'getProximoDiaUtilComprovado');

// Mock data
const feriadosMap = {
    '2025-12-25': { motivo: 'Natal' },
    '2026-01-01': { motivo: 'Ano Novo' }
};

const decretosMap = {
    '2025-12-18': { motivo: 'Decreto Teste 1', tipo: 'decreto' },
    '2025-12-19': { motivo: 'Decreto Teste 2', tipo: 'decreto' },
    '2025-12-24': { motivo: 'Véspera de Natal', tipo: 'decreto' }, // Nao sei se o decreto de vespera no mapa existe assim
    '2025-12-31': { motivo: 'Véspera de Ano Novo', tipo: 'decreto' }
};

const instabilidadeMap = {};

const recessoForense = { ativo: true, inicio: '12-20', fim: '01-06' };

const settings = {
    feriadosMap, decretosMap, instabilidadeMap, recessoForense
};

eval(getMotivoDiaNaoUtilStr);
eval(calcularPrazoFinalDiasCorridosStr);
eval(getProximaSuspensaoComprovavelStr);
eval(getProximoDiaUtilComprovadoStr);

const ignorarRecesso = true;
const comprovados = new Set(['2025-12-18', '2025-12-19', '2025-12-24', '2025-12-31']);

const inicioDispo = new Date('2025-12-15T00:00:00');
const { proximoDia: dataPub } = getProximoDiaUtilComprovado(inicioDispo, comprovados);
const { proximoDia: dataInic } = getProximoDiaUtilComprovado(dataPub, comprovados);

console.log("Inicio:", dataInic.toISOString().split('T')[0]);

const res = calcularPrazoFinalDiasCorridos(dataInic, 15, comprovados, ignorarRecesso, true);
console.log("Prazo Bruto:", res.prazoFinalBruto ? res.prazoFinalBruto.toISOString().split('T')[0] : 'N/A');
console.log("Prazo Estendido Final:", res.prazoFinalProrrogado ? res.prazoFinalProrrogado.toISOString().split('T')[0] : res.prazoFinal?.toISOString().split('T')[0]);

console.log("Dias Corridos Encontrados Nao uteis no meio:");
res.diasNaoUteis.forEach(d => console.log(d.data.toISOString().split('T')[0], d.motivo));

console.log("Dias prorrogados finais:");
if (res.diasProrrogados) {
    res.diasProrrogados.forEach(d => console.log(d.data.toISOString().split('T')[0], d.motivo));
}

