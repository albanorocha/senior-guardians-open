

# Abordagem Alternativa: Passar Variaveis Diretamente no Webcall

## Problema

A abordagem atual usa um webhook (Pre Call API) que o Atoms deveria chamar antes da conversa para buscar as variaveis do paciente. Os logs mostram que o `atoms-precall` **nao esta sendo chamado pelo Atoms** -- so aparece um evento de "shutdown", sem nenhuma requisicao real. Isso significa que a configuracao no dashboard do Atoms nao esta funcionando corretamente.

## Nova Abordagem

Em vez de depender do webhook Pre Call API (que requer configuracao manual no dashboard do Atoms), vamos **enviar as variaveis diretamente na chamada de criacao do webcall**. A API do Atoms aceita um campo `variables` no body da requisicao, assim como a API de outbound call.

Isso elimina completamente a necessidade do webhook `atoms-precall` e da tabela `pre_call_context`.

## O que muda

### 1. Edge Function `atoms-session`

Atualmente envia apenas `{ agentId }` para a API do Atoms:
```text
{ "agentId": "6990ef650d1c87f0c9a42402" }
```

Sera alterado para incluir as variaveis diretamente:
```text
{ "agentId": "6990ef650d1c87f0c9a42402", "variables": { "patient_name": "Albano", ... } }
```

- Remover o codigo que salva contexto na tabela `pre_call_context`
- Passar as variaveis recebidas do frontend diretamente no body do webcall

### 2. Nenhuma alteracao no frontend

O `CheckIn.tsx` ja envia as variaveis corretamente para o `atoms-session`. Nada muda no frontend.

### 3. Edge Function `atoms-precall`

Pode ser mantida como fallback, mas nao sera mais necessaria para o fluxo principal. A configuracao no dashboard do Atoms pode ser removida.

## Detalhes Tecnicos

### Arquivo modificado

- **`supabase/functions/atoms-session/index.ts`** -- Alterar o body enviado para a API `webcall` do Atoms para incluir o campo `variables`

### Antes (linha relevante):
```javascript
const webcallBody = JSON.stringify({ agentId });
```

### Depois:
```javascript
const webcallBody = JSON.stringify({ agentId, variables });
```

Onde `variables` sao as variaveis ja recebidas do frontend (patient_name, medications, etc.).

### Deploy
- Redeployar apenas `atoms-session`
- Nao e necessario nenhuma configuracao adicional no dashboard do Atoms

