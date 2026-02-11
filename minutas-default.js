/**
 * @file minutas-default.js
 * Contém os templates padrão para as minutas.
 * Estes serão usados como fallback se um setor não tiver uma minuta personalizada.
 * Placeholders como {{numeroProcesso}} serão substituídos dinamicamente.
 */

const MINUTAS_PADRAO = {
    intempestividade: `
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">O recurso especial não pode ser admitido, pois foi interposto sem observância do prazo previsto no artigo 1.003, § 5º, c/c artigo 219, ambos do Código de Processo Civil.</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">Isto porque se verifica que a intimação do acórdão recorrido (mov. {{movAcordao}}, dos autos sob nº {{numeroProcesso}}) se deu pela disponibilização no DJEN na data de {{dataDisponibilizacao}} e, considerada como data da publicação o primeiro dia útil seguinte ao da disponibilização da informação (artigos 4º, §3º, da Lei 11.419/2006, e 224, do Código de Processo Civil), {{dataPublicacao}}, iniciou-se a contagem do prazo no primeiro dia útil seguinte ao da publicação, isto é em {{inicioPrazo}}.</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">Portanto, a petição recursal apresentada em {{dataInterposicao}} está intempestiva, já que protocolado além do prazo legal de {{prazoDias}} dias.</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">Neste sentido:</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">"PROCESSUAL CIVIL. AGRAVO INTERNO NO AGRAVO EM RECURSO ESPECIAL. RECURSO MANEJADO SOB A ÉGIDE DO NCPC. RECURSO INTEMPESTIVO. RECURSO ESPECIAL INTERPOSTO NA VIGÊNCIA DO NCPC. RECURSO ESPECIAL APRESENTADO FORA DO PRAZO LEGAL. INTEMPESTIVIDADE. APLICAÇÃO DOS ARTS. 219 E 1.003, § 5º, AMBOS DO NCPC. ADMISSIBILIDADE DO APELO NOBRE. JUÍZO BIFÁSICO. AUSÊNCIA DE VINCULAÇÃO DO STJ. AGRAVO INTERNO NÃO PROVIDO.</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">1. Aplica-se o NCPC a este julgamento ante os termos do Enunciado Administrativo nº 3, aprovado pelo Plenário do STJ na sessão de 9/3/2016: Aos recursos interpostos com fundamento no CPC/2015 (relativos a decisões publicadas a partir de 18 de março de 2016) serão exigidos os requisitos de admissibilidade recursal na forma do novo CPC.</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">2. A interposição de recurso especial após o prazo legal implica o seu não conhecimento, por intempestividade, nos termos dos arts. 219 e 1.003, § 5º, ambos do NCPC.</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">3. O juízo de admissibilidade do apelo nobre é bifásico, não ficando o STJ vinculado à decisão proferida pela Corte estadual.</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">4. Agravo interno não provido."</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">(AgInt no AREsp n. 2.039.729/RS, relator Ministro Moura Ribeiro, Terceira Turma, julgado em 9/5/2022, DJe de 11/5/2022.)</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">Diante do exposto, inadmito o recurso especial interposto.</p>
    `,
    intimacao_decreto: `
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">Intime-se a parte Recorrente, nos termos dos artigos 1.003, § 6º c/c 224, §1, ambos do Código de Processo Civil, sob pena de ser reconhecida a intempestividade do recurso, para, no prazo de 5 (cinco) dias, comprovar a ocorrência do feriado local ou a determinação de suspensão do expediente ou do prazo recursal neste Tribunal de Justiça, por meio de documento idôneo, conforme publicado no Diário da Justiça Eletrônico (AgInt no AREsp n. 2.734.555/RJ, relator Ministro Humberto Martins, Terceira Turma, julgado em 16/12/2024, DJEN de 19/12/2024.).</p>
    `,
    intimacao_decreto_crime: `
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">Intime-se a parte Recorrente, nos termos dos artigos 1.003, § 6º c/c 224, §1, ambos do Código de Processo Civil, para, no prazo de 5 (cinco) dias, comprovar a ocorrência do feriado local ou a determinação de suspensão do expediente ou do prazo recursal neste Tribunal de Justiça, por meio de documento idôneo, conforme publicado no Diário da Justiça Eletrônico (AgInt no AREsp n. 2.734.555/RJ, relator Ministro Humberto Martins, Terceira Turma, julgado em 16/12/2024, DJEN de 19/12/2024.).</p>
        <br>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">Oportunamente, voltem-se os autos conclusos à Assessoria de Recursos aos Tribunais Superiores.</p>
        <br>
    `,
    falta_decreto: `
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">Trata-se de recurso especial interposto em face do acórdão proferido pela {{camara}} deste Tribunal de Justiça, que negou provimento ao recurso de {{recursoApelacao}}.</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">A leitura da intimação do acórdão recorrido foi confirmada em {{dataLeitura}} ({{movIntimacao}}), de modo que o prazo de 15 (quinze) dias úteis para interposição de recursos aos Tribunais Superiores passou a fluir no dia {{inicioPrazo}} e findou em {{prazoFinal}}.</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">Instada a comprovar o feriado local ou a determinação de suspensão do prazo neste Tribunal de Justiça, nos termos do artigo 1.003, § 6º, do Código de Processo Civil (despacho de {{movDespacho}}), a parte recorrente permaneceu inerte (certidão de decurso de prazo de {{movCertidao}}).</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">Desse modo, é forçoso reconhecer a intempestividade do recurso especial, o que faço.</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">Nesse sentido é o entendimento vigente no âmbito do Superior Tribunal de Justiça:</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">"PROCESSUAL CIVIL. AGRAVO INTERNO NO AGRAVO EM RECURSO ESPECIAL. INTEMPESTIVIDADE DO RECURSO ESPECIAL. INCIDÊNCIA DO CPC DE 2015. FERIADO LOCAL E/OU SUSPENSÃO DE EXPEDIENTE FORENSE. QUESTÃO DE ORDEM NO ARESP 2.638.376/MG. ART. 1.003, § 6º, DO CPC/2015. INTIMAÇÃO PARA COMPROVAÇÃO POSTERIOR. DECURSO DO PRAZO. AGRAVO INTERNO DESPROVIDO. 1. A agravante foi intimada, nos termos da Questão de Ordem lavrada pela Corte Especial do Superior Tribunal de Justiça, no AREsp 2.638.376/MG, para comprovar, no prazo de 5 (cinco) dias úteis, a ocorrência de feriado local ou a suspensão de expediente forense, em consonância com a nova redação conferida pela Lei 14.939 /2024, ao art. 1.003, § 6º, do CPC, tendo deixado, contudo transcorrer in albis o prazo assinalado, conforme certidão de fl. 765. 2. Na hipótese dos autos, portanto, como não houve a juntada de documento comprobatório durante o iter processual, não é possível superar a intempestividade do apelo nobre. 3. Agravo interno a que se nega provimento." (AgInt no AREsp n. 2.710.026/MT, relator Ministro Raul Araújo, Quarta Turma, julgado em 14/4/2025, DJEN de 25/4/2025.)</p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">Diante do exposto, inadmito o recurso especial interposto.</p>
    `,
    exemplo_didatico: `
        <p style="background-color: #FFFBEB; color: #92400E; border-left: 4px solid #FBBF24; padding: 12px; margin-bottom: 1em; font-size: 12pt;">
            <i><b>Nota do Admin:</b> Este é um modelo de exemplo. Use os placeholders (ex: {{numeroProcesso}}) para inserir dados da calculadora. Placeholders em laranja (ex: <span style="color: #D97706; font-weight: bold;">[Mov. Acórdão]</span>) são exemplos de informações que precisam ser preenchidas manualmente no documento gerado.</i>
        </p>
        <p style="background-color: #EFF6FF; color: #1E40AF; border-left: 4px solid #60A5FA; padding: 12px; margin-bottom: 1em; font-size: 12pt;"><b>Placeholders disponíveis:</b> <code>{{numeroProcesso}}</code>, <code>{{dataDisponibilizacao}}</code>, <code>{{dataPublicacao}}</code>, <code>{{inicioPrazo}}</code>, <code>{{prazoDias}}</code>, <code>{{prazoFinal}}</code>, <code>{{dataInterposicao}}</code>, <code>{{movAcordao}}</code>, <code>{{camara}}</code>, <code>{{recursoApelacao}}</code>, <code>{{dataLeitura}}</code>, <code>{{movIntimacao}}</code>, <code>{{movDespacho}}</code>, <code>{{movCertidao}}</code></p>
        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">
            Trata-se de análise de tempestividade do recurso interposto nos autos sob nº <b>{{numeroProcesso}}</b>.
        </p>

        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">
            A intimação do acórdão (mov. <span style="color: #D97706; font-weight: bold;">[Mov. Acórdão]</span>) foi disponibilizada no DJEN em <b>{{dataDisponibilizacao}}</b>. A publicação ocorreu no primeiro dia útil seguinte, em <b>{{dataPublicacao}}</b>, e o prazo de <b>{{prazoDias}}</b> dias começou a fluir em <b>{{inicioPrazo}}</b>.
        </p>

        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">
            Considerando o prazo legal, o vencimento para a interposição do recurso era <b>{{prazoFinal}}</b>. O recurso foi protocolado em <b>{{dataInterposicao}}</b>.
        </p>

        <p style="text-align: justify; text-indent: 50px; margin-bottom: 1em;">
            <b><i>(Adicione aqui sua análise, jurisprudência ou outras informações pertinentes...)</i></b>
        </p>
    `
};
