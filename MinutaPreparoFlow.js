/**
 * MinutaPreparoFlow.js
 * Estrutura de dados que define a árvore de perguntas do gerador de minutas de preparo recursal.
 */

const option = (texto, proximo, snippet) => ({
  texto,
  proximo,
  snippet
});

const finalOption = (texto, snippet) =>
  option(texto, 'final', snippet);

const MINUTA_PREPARO_FLUXO = {
  inicio: {
    pergunta: 'Qual o tipo de recurso excepcional em análise?',
    opcoes: [
      option(
        'Recurso Especial (REsp)',
        'classif',
        'Recurso Especial dirigido ao Superior Tribunal de Justiça.'
      ),
      option(
        'Recurso Extraordinário (RE)',
        'classif',
        'Recurso Extraordinário dirigido ao Supremo Tribunal Federal.'
      )
    ]
  },

  classif: {
    pergunta: 'Qual a classificação da situação do preparo?',
    opcoes: [
      option(
        'Complementação — primeira irregularidade (parte ainda não foi intimada)',
        'comp_guia',
        'Trata-se de hipótese de complementação de preparo, nos termos do art. 1.007, § 2º, do CPC.'
      ),
      option(
        'Pagamento em Dobro — preparo não comprovado no ato da interposição',
        'dobro',
        'Trata-se de ausência de comprovação do pagamento no ato da interposição, sujeitando a parte ao recolhimento em dobro (art. 1.007, § 4º, do CPC).'
      ),
      option(
        'Deserção — após intimação não atendida ou recurso intempestivo',
        'desercao',
        'Trata-se de hipótese de deserção por irregularidade insanável ou prazo não atendido.'
      ),
      option(
        'Intempestivo — pagamento ou comprovação fora do prazo recursal',
        'intempestivo',
        'Trata-se de intempestividade do preparo recursal.'
      ),
      option(
        'Desistência de Justiça Gratuita — custas em dobro',
        'desistencia_jg',
        'Trata-se de desistência da Justiça Gratuita com imposição de custas em dobro.'
      ),
      option(
        'Após indeferimento de J.G. — intimação para preparo e inércia/renúncia',
        'apos_indeferimento_jg',
        'Trata-se de indeferimento de Justiça Gratuita seguido de intimação para preparo com inércia ou renúncia.'
      )
    ]
  },

  comp_guia: {
    pergunta: 'Qual guia apresenta irregularidade? (a outra está regular)',
    opcoes: [
      option(
        'GRU — irregularidade nas custas devidas ao Tribunal Superior (FUNJUS regular)',
        'comp_gru',
        'Verificada irregularidade nas custas devidas ao Tribunal Superior (GRU); a guia FUNJUS encontra-se regular.'
      ),
      option(
        'FUNJUS — irregularidade nas custas locais deste Tribunal de Justiça (GRU regular)',
        'comp_funjus',
        'Verificada irregularidade nas custas locais (FUNJUS); a guia GRU encontra-se regular.'
      )
    ]
  },

  comp_gru: {
    pergunta: 'Qual a irregularidade constatada na GRU? (FUNJUS regular, parte ainda não intimada)',
    opcoes: [
      finalOption(
        'Juntou só a guia GRU (sem comprovante de pagamento)',
        'Constatada a juntada apenas da guia GRU, sem o respectivo comprovante de pagamento.'
      ),
      finalOption(
        'Juntou só o comprovante GRU (sem a guia de recolhimento)',
        'Constatada a juntada apenas do comprovante GRU, sem a respectiva guia de recolhimento.'
      ),
      finalOption(
        'Guia GRU juntada + comprovante de agendamento bancário',
        'O comprovante apresentado para a GRU é um agendamento bancário, não constituindo prova de recolhimento efetivo.'
      ),
      finalOption(
        'Guia GRU juntada + divergência de código de barras',
        'O código de barras do comprovante da GRU não corresponde ao código de barras da guia de recolhimento, impossibilitando a verificação do recolhimento.'
      ),
      finalOption(
        'Guia GRU juntada + comprovante sem código de barras legível',
        'O comprovante da GRU não apresenta o código de barras de forma visível e legível, impossibilitando a verificação do recolhimento.'
      ),
      finalOption(
        'Guia GRU juntada + número de processo ausente ou incorreto',
        'A guia GRU não contém o número do processo ou apresenta numeração incorreta.'
      ),
      finalOption(
        'Número único não corresponde ao processo',
        'O número único de referência constante no documento não corresponde ao número do processo nem à árvore processual.'
      ),
      finalOption(
        'Guia GRU pertencente a outro processo',
        'A guia GRU apresentada pertence a outro processo ou recurso, não sendo imputável ao presente feito.'
      ),
      finalOption(
        'Guia GRU juntada + valor divergente ou insuficiente',
        'O valor recolhido na GRU é divergente ou insuficiente em relação ao devido, não atingindo o montante exigido.'
      )
    ]
  },

  comp_funjus: {
    pergunta: 'Qual a irregularidade constatada na FUNJUS? (GRU regular, parte ainda não intimada)',
    opcoes: [
      finalOption(
        'Juntou só a guia FUNJUS (sem comprovante de pagamento)',
        'Constatada a juntada apenas da guia FUNJUS, sem o respectivo comprovante de pagamento.'
      ),
      finalOption(
        'Juntou só o comprovante FUNJUS (sem a guia de recolhimento)',
        'Constatada a juntada apenas do comprovante FUNJUS, sem a respectiva guia de recolhimento.'
      ),
      finalOption(
        'Guia FUNJUS juntada + comprovante de agendamento bancário',
        'O comprovante apresentado para a FUNJUS é um agendamento bancário, não constituindo prova de recolhimento efetivo. Intime-se para apresentar comprovante de débito definitivo, sob pena de deserção (art. 1.007, § 2º, do CPC).'
      ),
      finalOption(
        'Guia FUNJUS juntada + divergência de código de barras',
        'O código de barras do comprovante da FUNJUS não corresponde ao código de barras da guia de recolhimento, impossibilitando a verificação do recolhimento.'
      ),
      finalOption(
        'Guia FUNJUS juntada + comprovante sem código de barras legível',
        'O comprovante da FUNJUS não apresenta o código de barras de forma visível e legível, impossibilitando a verificação do recolhimento.'
      ),
      finalOption(
        'Guia FUNJUS juntada + número de processo ausente ou incorreto',
        'A guia FUNJUS não contém o número do processo ou apresenta numeração incorreta.'
      ),
      finalOption(
        'Número único não corresponde ao processo',
        'O número único de referência constante no documento não corresponde ao número do processo nem à árvore processual.'
      ),
      finalOption(
        'Guia FUNJUS pertencente a outro processo',
        'A guia FUNJUS apresentada pertence a outro processo ou recurso, não sendo imputável ao presente feito.'
      ),
      finalOption(
        'Guia FUNJUS juntada + valor divergente ou insuficiente',
        'O valor recolhido na FUNJUS é divergente ou insuficiente em relação ao devido, não atingindo o montante exigido.'
      )
    ]
  },

  dobro: {
    pergunta: 'Qual a situação dos documentos no ato da interposição do recurso?',
    opcoes: [
      finalOption(
        'Juntou só as guias GRU e FUNJUS (sem comprovantes de pagamento)',
        'Constatada a juntada de ambas as guias (GRU e FUNJUS) sem os respectivos comprovantes de pagamento.'
      ),
      finalOption(
        'Juntou só os comprovantes GRU e FUNJUS (sem as guias de recolhimento)',
        'Constatada a juntada dos comprovantes (GRU e FUNJUS) sem as respectivas guias de recolhimento.'
      ),
      finalOption(
        'Juntou guias com comprovante de agendamento bancário (ambos)',
        'Os comprovantes apresentados para as guias GRU e FUNJUS correspondem a agendamentos bancários não efetivados, não constituindo prova de recolhimento efetivo.'
      ),
      option(
        'Não pagou / documentos N/D (ausentes ou inválidos)',
        'dobro_nd',
        'Verificada ausência ou invalidade dos documentos de recolhimento (GRU e/ou FUNJUS) no ato da interposição.'
      )
    ]
  },

  dobro_nd: {
    pergunta: 'Qual o problema específico nos documentos? (sujeito ao recolhimento em dobro)',
    opcoes: [
      finalOption(
        '2 agendamentos bancários como comprovante',
        'Os comprovantes das guias GRU e FUNJUS correspondem a agendamentos bancários não efetivados.'
      ),
      finalOption(
        '2 comprovantes com divergência de código de barras',
        'Os códigos de barras dos comprovantes não correspondem aos das guias de recolhimento, impossibilitando a verificação do recolhimento.'
      ),
      finalOption(
        '2 comprovantes sem código de barras legível',
        'Os comprovantes das guias GRU e FUNJUS não apresentam o código de barras de forma visível e legível.'
      ),
      finalOption(
        '2 documentos não localizados (N/D)',
        'Não localizados nos autos os documentos de recolhimento (GRU e FUNJUS).'
      ),
      finalOption(
        '2 valores divergentes ou insuficientes',
        'Os valores recolhidos nas guias GRU e FUNJUS são divergentes ou insuficientes em relação aos devidos.'
      ),
      finalOption(
        '2 guias pertencentes a outros processos',
        'As guias GRU e FUNJUS apresentadas pertencem a outros processos ou recursos, não sendo imputáveis ao presente feito.'
      ),
      finalOption(
        'Número único não corresponde ao processo',
        'O número único de referência nos documentos não corresponde ao número do processo nem à árvore processual.'
      )
    ]
  },

  desercao: {
    pergunta: 'Qual a situação documental que fundamenta a deserção?',
    opcoes: [
      finalOption(
        'Juntou só as guias GRU e FUNJUS (sem comprovantes)',
        'A parte juntou apenas as guias de recolhimento (GRU e FUNJUS) sem os comprovantes de pagamento, não regularizando o preparo no prazo.'
      ),
      finalOption(
        'Juntou só os comprovantes GRU e FUNJUS (sem guias)',
        'A parte juntou apenas os comprovantes de pagamento (GRU e FUNJUS) sem as guias de recolhimento, não regularizando o preparo no prazo.'
      ),
      option(
        'Não pagou N/D — ambas as guias (GRU + FUNJUS)',
        'desercao_nd_2pgto',
        'Verificada ausência total de documentos de preparo (GRU e FUNJUS), não regularizada no prazo assinado.'
      ),
      option(
        'Apresentou documentação só para GRU (FUNJUS regular ou não exigida)',
        'desercao_gru_1pgto',
        'A irregularidade definitiva concentra-se na guia GRU, não regularizada no prazo assinado.'
      ),
      option(
        'Apresentou documentação só para FUNJUS (GRU regular ou não exigida)',
        'desercao_funjus_1pgto',
        'A irregularidade definitiva concentra-se na guia FUNJUS, não regularizada no prazo assinado.'
      )
    ]
  },

  desercao_nd_2pgto: {
    pergunta: 'Qual o vício que fundamenta a deserção? (intimação §4º, ambas as guias)',
    opcoes: [
      finalOption(
        'Guia pertencente a outro processo',
        'As guias apresentadas pertencem a outros processos — vício insanável após dobro.'
      ),
      finalOption(
        'Agendamento bancário',
        'Os comprovantes correspondem a agendamentos não efetivados — vício insanável após dobro.'
      ),
      finalOption(
        'Comprovou pagamento em valor simples (em vez de dobro)',
        'A parte foi intimada para recolher em dobro e comprovou o pagamento em valor simples — vício insanável.'
      ),
      finalOption(
        'Divergência de código de barras',
        'Os códigos de barras dos comprovantes não correspondem aos das guias de recolhimento — vício insanável após dobro.'
      ),
      finalOption(
        'Sem código de barras legível',
        'Os comprovantes não apresentam código de barras visível e legível — vício insanável após dobro.'
      ),
      finalOption(
        'Número de processo ausente ou incorreto',
        'As guias não identificam corretamente o processo — vício insanável após dobro.'
      ),
      finalOption(
        'Número único não corresponde ao processo',
        'O número único de referência nas guias não corresponde ao número do processo nem à árvore processual — vício insanável após dobro.'
      ),
      finalOption(
        'Documentos não localizados (N/D)',
        'Documentos de recolhimento não localizados — vício insanável após dobro.'
      ),
      finalOption(
        'Valores divergentes ou insuficientes (ambas as guias)',
        'Os valores recolhidos nas guias GRU e FUNJUS são divergentes ou insuficientes — vício insanável após dobro.'
      ),
      finalOption(
        'Ausência de manifestação',
        'A parte foi intimada e não se manifestou — vício insanável.'
      ),
      finalOption(
        'Renúncia de prazo',
        'A parte renunciou ao prazo para regularização — vício insanável.'
      ),
      finalOption(
        'Decurso de prazo',
        'Decorrido o prazo para regularização sem manifestação — vício insanável.'
      )
    ]
  },

  desercao_gru_1pgto: {
    pergunta: 'Qual o vício que fundamenta a deserção na GRU? (intimação §2º)',
    opcoes: [
      finalOption(
        'Agendamento bancário',
        'Comprovante GRU = agendamento não efetivado — vício insanável.'
      ),
      finalOption(
        'Divergência de código de barras',
        'O código de barras do comprovante GRU não corresponde ao da guia de recolhimento — vício insanável.'
      ),
      finalOption(
        'Sem código de barras legível',
        'Comprovante GRU sem código de barras visível e legível — vício insanável.'
      ),
      finalOption(
        'Número de processo ausente ou incorreto',
        'Guia GRU sem identificação processual correta — vício insanável.'
      ),
      finalOption(
        'Número único não corresponde ao processo (GRU)',
        'O número único de referência na guia GRU não corresponde ao número do processo nem à árvore processual — vício insanável.'
      ),
      finalOption(
        'Guia GRU não apresentada após intimação (nunca juntada)',
        'A parte foi intimada para juntar a guia GRU correspondente e não atendeu à determinação no prazo assinado — vício insanável.'
      ),
      finalOption(
        'Guia GRU pertencente a outro processo',
        'Guia GRU pertence a outro processo — vício insanável.'
      ),
      finalOption(
        'Valor divergente ou insuficiente (GRU)',
        'O valor recolhido na GRU é divergente ou insuficiente — vício insanável.'
      )
    ]
  },

  desercao_funjus_1pgto: {
    pergunta: 'Qual o vício que fundamenta a deserção na FUNJUS? (intimação §2º)',
    opcoes: [
      finalOption(
        'Agendamento bancário',
        'Comprovante FUNJUS = agendamento não efetivado — vício insanável.'
      ),
      finalOption(
        'Divergência de código de barras',
        'O código de barras do comprovante FUNJUS não corresponde ao da guia de recolhimento — vício insanável.'
      ),
      finalOption(
        'Sem código de barras legível',
        'Comprovante FUNJUS sem código de barras visível e legível — vício insanável.'
      ),
      finalOption(
        'Número de processo ausente ou incorreto',
        'Guia FUNJUS sem identificação processual correta — vício insanável.'
      ),
      finalOption(
        'Número único não corresponde ao processo (FUNJUS)',
        'O número único de referência na guia FUNJUS não corresponde ao número do processo nem à árvore processual — vício insanável.'
      ),
      finalOption(
        'Guia FUNJUS não apresentada após intimação (nunca juntada)',
        'A parte foi intimada para juntar a guia FUNJUS correspondente e não atendeu à determinação no prazo assinado — vício insanável.'
      ),
      finalOption(
        'Guia pertencente a outro processo',
        'Guia FUNJUS pertence a outro processo — vício insanável.'
      ),
      finalOption(
        'Valor divergente ou insuficiente (FUNJUS)',
        'O valor recolhido na FUNJUS é divergente ou insuficiente — vício insanável.'
      )
    ]
  },

  intempestivo: {
    pergunta: 'Qual a natureza da intempestividade?',
    opcoes: [
      finalOption(
        'Pagamento realizado fora do prazo recursal',
        'O recolhimento do preparo foi efetuado após o término do prazo recursal (art. 1.003, § 5º, c/c art. 219, do CPC).'
      ),
      finalOption(
        'Comprovante de pagamento juntado fora do prazo recursal',
        'O comprovante de pagamento das custas recursais foi juntado após o término do prazo recursal (art. 1.003, § 5º, c/c art. 219, do CPC).'
      )
    ]
  },

  desistencia_jg: {
    pergunta: 'Qual a abrangência das custas em dobro após desistência da J.G.?',
    opcoes: [
      finalOption(
        'Custas em dobro — GRU',
        'Declarada a desistência da Justiça Gratuita, as custas devidas ao Tribunal Superior (GRU) são exigidas em dobro.'
      ),
      finalOption(
        'Custas em dobro — FUNJUS',
        'Declarada a desistência da Justiça Gratuita, as custas devidas ao Tribunal de Justiça (FUNJUS) são exigidas em dobro.'
      ),
      finalOption(
        'Custas em dobro — GRU e FUNJUS (ambas)',
        'Declarada a desistência da Justiça Gratuita, todas as custas (GRU e FUNJUS) são exigidas em dobro.'
      )
    ]
  },

  apos_indeferimento_jg: {
    pergunta: 'Qual a razão do não preparo após indeferimento da J.G.?',
    opcoes: [
      finalOption(
        'Inércia — não manifestação após intimação',
        'Após indeferimento da J.G. e intimação para preparo, a parte não se manifestou.'
      ),
      finalOption(
        'Renúncia ao prazo',
        'Após indeferimento da J.G. e intimação para preparo, a parte renunciou ao prazo.'
      ),
      finalOption(
        'Decurso de prazo',
        'Decorrido o prazo para preparo após indeferimento da J.G. sem manifestação.'
      )
    ]
  }
};

window.MINUTA_PREPARO_FLUXO = MINUTA_PREPARO_FLUXO;
