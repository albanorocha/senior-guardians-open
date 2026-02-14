

# Implementar Pre Call API - Contexto do Paciente para Clara

## O que aconteceu

O plano anterior foi aprovado mas nenhuma mudanca foi aplicada. O codigo atual ainda tenta enviar `variables` diretamente no endpoint `/conversation/webcall`, que ignora esse campo.

## O que sera feito

### 1. Criar tabela `pre_call_context`

Tabela temporaria para guardar o contexto do paciente entre o inicio da sessao e a chamada do Pre Call API do Atoms.

- `id` (uuid, PK)
- `user_id` (uuid, unique) - para fazer upsert
- `variables` (jsonb) - dados do paciente
- `created_at` (timestamp)
- RLS habilitado, sem policies publicas (acesso apenas via service_role nas edge functions)

### 2. Atualizar edge function `atoms-session`

Antes de criar a webcall:
- Receber `user_id` e `variables` do frontend
- Usar o Supabase client com service_role para salvar/atualizar o contexto na tabela `pre_call_context` (upsert por user_id)
- Criar a webcall normalmente enviando apenas `{ agentId }` (sem variables)
- Adicionar console.log para debug

### 3. Criar nova edge function `atoms-precall`

Webhook que o Atoms chamara automaticamente antes de iniciar a conversa:
- Receber a requisicao do Atoms
- Logar o body completo recebido (para debug, pois nao sabemos exatamente o que o Atoms envia)
- Buscar o contexto mais recente da tabela `pre_call_context`
- Retornar as variaveis no formato `{ variables: { patient_name, medications, ... } }`
- Configurar `verify_jwt = false` no config.toml (o Atoms nao envia JWT)

### 4. Atualizar `CheckIn.tsx`

- Enviar `user_id` no body da chamada para `atoms-session`:
  ```text
  body: JSON.stringify({ agentId: '...', variables, userId: user.id })
  ```

## Configuracao manual no Atoms (feita por voce)

Apos a implementacao, voce precisa configurar no dashboard do Atoms (https://app.smallest.ai):

1. Abrir o agente Clara
2. Adicionar um Pre Call API Node
3. URL: `https://rlbratdaqtdpbifkceds.supabase.co/functions/v1/atoms-precall`
4. Metodo: POST
5. Headers: `apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (chave anonima)

## Arquivos

- **Nova migracao SQL** - criar tabela `pre_call_context`
- **Novo:** `supabase/functions/atoms-precall/index.ts`
- **Modificado:** `supabase/functions/atoms-session/index.ts`
- **Modificado:** `src/pages/CheckIn.tsx` - enviar userId

