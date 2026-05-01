# Regras de Cálculo de Prazos Processuais - TJPR

Este documento detalha a lógica de negócio implementada para o cálculo de prazos no sistema, diferenciando as regras aplicadas à matéria Cível e à matéria Criminal.

## 1. Fluxo Base de Intimação (Comum a todas as matérias)

Independentemente da matéria, o sistema segue o rito de comunicação eletrônica (Lei 11.419/2006):

1.  **Disponibilização (D+0):** Data escolhida pelo usuário (dia em que o ato é publicado no Diário da Justiça Eletrônico).
2.  **Publicação (D+1):** Considera-se publicado no primeiro dia útil seguinte à disponibilização.
    *   *Regra:* Se o D+1 cair em sábado, domingo, feriado ou dia de suspensão de expediente, a publicação é deslocada para o próximo dia útil.
3.  **Início do Prazo (D+2):** A contagem começa no primeiro dia útil seguinte à data da publicação (Súmula 310 STF).
    *   *Regra:* Se o D+2 cair em dia não útil, o início da contagem é prorrogado para o próximo dia útil.

---

## 2. Regras Específicas - Matéria Cível (Código de Processo Civil)

Baseada no Art. 219 do Código de Processo Civil, a contagem é feita exclusivamente em **dias úteis**.

### A. Contagem e Meio de Prazo
*   **Apenas dias úteis:** Sábados, domingos e feriados (nacionais e estaduais do PR) são pulados na contagem.
*   **Suspensões (Decretos e Instabilidades):** Qualquer suspensão de expediente que ocorra dentro do intervalo do prazo também interrompe a contagem, "pulando" esses dias.
*   **Corpus Christi (CNJ):** Exige comprovação manual via checkbox para ser considerado suspensão, conforme regras específicas do CNJ aplicadas ao tribunal.

### B. Prorrogação de Início e Fim
*   Se o dia do início (D+2) ou o dia do vencimento cair em dia não útil (incluindo instabilidades do sistema Projudi ou decretos), o marco é movido para o próximo dia útil disponível.

### C. Exceção Histórica (Suspensão Sistêmica 2025)
*   **Maio/2025:** Devido a instabilidades críticas no Projudi, disponibilizações em **28/05/2025** ou **29/05/2025** possuem um prazo final fixo em **23/06/2025**, independentemente do número de dias do prazo (regra aplicada conforme SEI 0072049-32.2025.8.16.6000).

---

## 3. Regras Específicas - Matéria Criminal (Código de Processo Penal)

Baseada no Art. 798 do Código de Processo Penal, a contagem é feita em **dias corridos**.

### A. Contagem e Meio de Prazo
*   **Dias Corridos:** Uma vez iniciado, o prazo não para de correr em fins de semana ou feriados.
*   **Regra de Ouro (Meio de Prazo):** Suspensões de expediente (decretos locais) ocorridas no **meio** do prazo criminal NÃO suspendem a contagem. O prazo continua correndo normalmente.

### B. Prorrogação de Início e Fim
*   Embora a contagem seja em dias corridos, os marcos de **Início** e **Vencimento** devem obrigatoriamente ocorrer em dias úteis.
*   Se o D+2 (Início) for sábado, domingo ou feriado, o prazo começa no primeiro dia útil.
*   Se o Vencimento for dia não útil, prorroga-se para o primeiro dia útil seguinte.

### C. Recesso Forense (20/12 a 20/01)
*   **Exceção à Regra de Dias Corridos:** Durante o Recesso Forense e a suspensão de prazos do Art. 220 do Código de Processo Civil, a contagem criminal é **suspensa**. O sistema congela a contagem em 19/12 e retoma apenas em 21/01.

### D. Exceção Histórica (Suspensão Sistêmica 2025)
*   **Maio/2025:** Disponibilizações em **28/05/2025** ou **29/05/2025** possuem um prazo final fixo em **25/06/2025** para a matéria criminal.

---

## 4. Tabela Comparativa Resumida

| Regra | Cível (Código de Processo Civil) | Criminal (Código de Processo Penal) |
| :--- | :--- | :--- |
| **Tipo de Contagem** | Dias Úteis | Dias Corridos |
| **Sábados/Domingos** | Pulados (não contam) | Contam (exceto no início/fim) |
| **Suspensão no Meio** | Sim (pula o dia) | Não (ignora a suspensão) |
| **Recesso Forense** | Suspende (20/12 a 20/01) | Suspende (20/12 a 20/01) |
| **Prorrogação Início/Fim** | Próximo dia útil | Próximo dia útil |
| **Base Legal** | Art. 219 do Código de Processo Civil | Art. 798 do Código de Processo Penal |

---

## 5. Lógica de Comprovação (Checkboxes)

Para garantir a segurança jurídica, o sistema apresenta "Checkboxes de Comprovação" para:
1.  **Instabilidades do Projudi:** Devem ser marcadas pelo usuário para comprovar a indisponibilidade.
2.  **Decretos TJPR:** Decretos de suspensão de expediente local.
3.  **Corpus Christi e Feriados CNJ:** Datas que exigem comprovação oficial conforme a Súmula do tribunal.

No **Cível**, marcar uma checkbox pula o dia no meio do prazo. No **Crime**, marcar uma checkbox só altera o resultado se a data for o dia de Início ou o dia de Vencimento do prazo.
