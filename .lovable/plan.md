

# Corrigir Integração de Voz: Auto-iniciar agente ao atender

## Problema Atual

O `AtomsWidget` renderiza seu proprio botao ("Talk to Atoms"), exigindo um segundo clique apos o botao verde de "Atender". O usuario quer que ao clicar no botao verde, o agente Clara ja comece a falar imediatamente.

## Solucao

Substituir o `AtomsWidget` (que tem UI propria) pelo `atoms-client-sdk` (SDK programatico), que permite iniciar a sessao de voz automaticamente via codigo.

## Fluxo

```text
Usuario clica "Atender" (botao verde)
        |
        v
Frontend chama edge function /atoms-session
        |
        v
Edge function chama API Smallest.ai com API Key
  POST atoms-api.smallest.ai/api/v1/conversation/webcall
        |
        v
Retorna accessToken + host (WebRTC)
        |
        v
Frontend usa AtomsClient.startSession() para conectar
        |
        v
Agente Clara comeca a falar automaticamente
```

## Etapas de Implementacao

### 1. Armazenar a API Key como secret
- Adicionar `SMALLEST_AI_API_KEY` como secret do projeto (valor: `sk_806034754ec921fe32d9f5cfee0dd731`)
- Nunca expor no frontend

### 2. Criar edge function `atoms-session`
- Recebe requisicao do frontend
- Chama `POST https://atoms-api.smallest.ai/api/v1/conversation/webcall` com o `agentId` e a API Key
- Retorna o `accessToken` e `host` para o frontend

### 3. Instalar `atoms-client-sdk` no frontend
- Adicionar como dependencia npm
- Remover uso do `AtomsWidget` de `atoms-widget-core`

### 4. Atualizar `src/pages/CheckIn.tsx`
- Restaurar o botao verde de "Atender" na tela incoming (ja existe)
- No `handleAnswer()`:
  - Chamar a edge function `/atoms-session` para obter token
  - Criar instancia de `AtomsClient`
  - Chamar `client.startSession({ accessToken, mode: "webcall", host })`
  - O agente comeca a falar imediatamente
- No `handleEndCall()`:
  - Chamar `client.stopSession()` para encerrar a conexao WebRTC
- Manter o timer, visualizador de audio e botao vermelho de encerrar

### Arquivos modificados/criados
- `supabase/functions/atoms-session/index.ts` — nova edge function
- `src/pages/CheckIn.tsx` — substituir AtomsWidget por AtomsClient programatico
- `package.json` — adicionar `atoms-client-sdk`

