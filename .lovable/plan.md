

# Exibir Informacoes do Paciente na Tela de Preparacao

## O que sera feito

Na tela de "Preparando..." (estado `preparing`), alem dos passos de progresso, exibir um card com as informacoes do paciente que estao sendo enviadas para o agente Clara. Cada item tera um indicador visual mostrando se ja foi enviado e se o agente tem acesso.

## Mudancas em `src/pages/CheckIn.tsx`

### 1. Armazenar as variaveis preparadas em um estado

Adicionar um estado `preparedVariables` que guarda os dados coletados (nome, idade, medicamentos) para exibir na tela de preparacao. Preenchido durante a Fase 1 do `handleAnswer`.

### 2. Atualizar a tela "preparing"

Abaixo dos passos de progresso, adicionar um card semi-transparente mostrando:

- **Nome do paciente**: ex. "Albano"
- **Idade**: ex. "35 anos"
- **Medicamentos**: lista com nome e dosagem de cada medicamento
- **Status de envio**: icone de check verde + texto "Dados enviados ao agente" quando `prepStep` atingir `connecting` ou `done`, ou um loader enquanto ainda esta enviando

O card so aparece apos o passo "profile" ser concluido (quando os dados ja foram coletados). Quando os dados forem salvos no banco (passo "context" concluido), o card mostra confirmacao visual de que o agente tem acesso.

### Detalhes visuais

- Card com fundo `bg-primary-foreground/10` e `backdrop-blur`
- Titulo "Dados do paciente"
- Cada campo como linha: label em opacidade reduzida, valor em destaque
- Medicamentos como lista numerada compacta
- Rodape do card com badge de status:
  - Durante envio: Loader + "Enviando para Clara..."
  - Apos envio: Check verde + "Clara tem acesso a estes dados"

### Nenhuma mudanca no backend
Apenas alteracoes visuais no frontend usando dados ja disponiveis no fluxo.

