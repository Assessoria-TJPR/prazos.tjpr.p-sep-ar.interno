const fs = require('fs');

const html = `
<!DOCTYPE html>
<html>
<head>
    <script src="./regrasCivel.js"></script>
    <script src="./regrasCrime.js"></script>
    <script src="./app.js"></script>
    <script>
        const inicioDisponibilizacao = new Date('2025-12-15T00:00:00');
        const diasComprovados = new Set(['2025-12-18', '2025-12-19', '2025-12-24', '2025-12-31']);
        const ignorarRecesso = true;
        const prazo = 15;

        // Simulate app.js flow
        const calcularPrazoUI = () => {
             const result = calcularPrazoCrime(
                 new Date('2025-12-16T00:00:00'),
                 new Date('2025-12-17T00:00:00'),
                 prazo,
                 [],
                 inicioDisponibilizacao,
                 { getProximoDiaUtilParaPublicacao, calcularPrazoFinalDiasCorridos, getMotivoDiaNaoUtil, getProximoDiaUtilComprovado, decretosMap },
                 diasComprovados,
                 ignorarRecesso
             );
             return result.comDecreto.prazoFinalProrrogado.toISOString().split('T')[0];
        };
        
        window.onload = () => {
             document.body.innerHTML = "<h1>FINAL DATE: " + calcularPrazoUI() + "</h1>";
        };
    </script>
</head>
<body></body>
</html>
`;
fs.writeFileSync('test_browser.html', html);
console.log('Created test_browser.html');
