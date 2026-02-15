

# Exibir Transcrição da Conversa Durante a Ligação

## O que será feito

Adicionar um painel de transcrição em tempo real na tela de chamada ativa, mostrando o que a Clara (agente) está dizendo durante a ligação. O SDK do Atoms já possui um evento `transcript` que envia o texto em tempo real.

## Como vai funcionar

- Durante a chamada ativa, um painel de chat aparecerá abaixo do avatar da Clara
- Cada mensagem da Clara aparecerá como uma bolha de texto com timestamp
- O painel fará scroll automático para a mensagem mais recente
- O painel será discreto e não atrapalhará o botão de encerrar chamada

## Mudanças técnicas

### Arquivo: `src/pages/CheckIn.tsx`

1. **Novo estado para transcrições**
   - Adicionar `transcripts` como array de `{ text, timestamp, sender }` no state
   - Adicionar estado `isAgentTalking` para feedback visual

2. **Escutar eventos do SDK**
   - Após `client.startSession()`, registrar listener para o evento `transcript` que captura `{ text, timestamp }`
   - Registrar listeners para `agent_start_talking` e `agent_stop_talking` para indicador visual
   - Cada transcript recebido será adicionado ao array de mensagens

3. **UI da transcrição na tela "active"**
   - Abaixo do timer e acima do botão de encerrar, adicionar um `ScrollArea` com as mensagens
   - Cada mensagem exibida como bolha com o texto e horário
   - Indicador visual quando a Clara está falando (animação no avatar ou label "Falando...")
   - Auto-scroll para a última mensagem

4. **Passar transcrições para o resumo**
   - Quando a chamada terminar, o campo "summary" será pré-preenchido com a transcrição completa da conversa, facilitando o salvamento

### Nenhuma mudança no backend
Todas as mudanças são apenas no frontend, usando eventos já disponíveis no SDK.

