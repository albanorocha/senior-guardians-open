

# Reestruturar o Fluxo do Check-In: Enviar Dados Antes da Ligacao

## Problema Atual

O fluxo atual faz tudo em um unico passo dentro do `handleAnswer`:
1. Clica em "Atender"
2. Muda para estado "active" imediatamente
3. Busca perfil do paciente
4. Busca medicamentos
5. Chama `atoms-session` (que salva dados E cria a webcall ao mesmo tempo)
6. Inicia a sessao de voz

O problema: como tudo acontece junto, existe uma corrida entre salvar os dados e o Atoms chamar o webhook `atoms-precall`. Se o Atoms chamar o webhook antes dos dados serem salvos, o agente Clara nao recebe as informacoes do paciente.

## Solucao: Fluxo em Duas Etapas

Separar o processo em duas fases claras:

**Fase 1 - Preparar Dados** (novo estado "preparing"):
- Ao clicar em "Atender", mostra tela de "Preparando..."
- Busca perfil e medicamentos
- Salva os dados no `pre_call_context` via uma chamada dedicada
- Confirma que os dados foram salvos com sucesso

**Fase 2 - Estabelecer Ligacao** (so apos Fase 1 completar):
- Cria a webcall via `atoms-session`
- Inicia a sessao de voz
- Muda para estado "active"

## Mudancas Necessarias

### 1. Edge Function `atoms-session` - Separar responsabilidades

Criar uma nova rota ou modificar `atoms-session` para aceitar dois modos:
- **Modo 1 - Salvar contexto**: recebe `variables` e `userId`, salva no `pre_call_context`, retorna confirmacao
- **Modo 2 - Criar webcall**: recebe `agentId`, cria a sessao no Atoms, retorna token

Na pratica, o mais simples e criar uma nova edge function `atoms-save-context` dedicada a salvar os dados, e manter `atoms-session` apenas para criar a webcall.

### 2. Nova Edge Function `atoms-save-context`

Arquivo: `supabase/functions/atoms-save-context/index.ts`
- Recebe `{ variables, userId }`
- Deleta registros antigos do `pre_call_context`
- Insere novo registro
- Retorna `{ success: true }` com confirmacao

### 3. Simplificar `atoms-session`

Arquivo: `supabase/functions/atoms-session/index.ts`
- Remover a logica de salvar no `pre_call_context` (agora feita pela nova funcao)
- Manter apenas a criacao da webcall no Atoms API

### 4. Reestruturar `CheckIn.tsx`

Arquivo: `src/pages/CheckIn.tsx`

- Adicionar novo estado `preparing` ao `CallState`: `'incoming' | 'preparing' | 'active' | 'summary'`
- Nova tela visual para o estado "preparing" mostrando progresso (ex: "Preparando seus dados...", "Dados enviados!", "Conectando com Clara...")
- O fluxo do `handleAnswer` passa a ser:

```
1. setCallState('preparing')
2. Buscar perfil e medicamentos
3. Chamar atoms-save-context → salvar dados
4. Aguardar confirmacao de sucesso
5. Chamar atoms-session → criar webcall
6. Iniciar sessao de voz
7. setCallState('active')
```

- Se qualquer etapa falhar, volta para `incoming` com mensagem de erro

### 5. Configuracao do config.toml

Adicionar entrada para a nova edge function com `verify_jwt = false` (necessario pois o Atoms chama sem JWT):

```toml
[functions.atoms-save-context]
verify_jwt = false
```

## Tela de "Preparando" (Estado preparing)

Visual similar ao estado "incoming" mas com:
- Icone de Clara com animacao de carregamento
- Texto "Preparando seus dados..."
- Indicadores de progresso para cada etapa:
  - "Carregando perfil..." → checkmark
  - "Enviando medicamentos..." → checkmark
  - "Conectando com Clara..." → animacao

## Resultado Esperado

Quando o usuario clicar em "Atender":
1. Ve uma tela de preparacao com progresso
2. Dados do paciente sao salvos no banco PRIMEIRO
3. So depois a ligacao e criada
4. Quando o Atoms chamar o webhook `atoms-precall`, os dados ja estarao disponiveis
5. Clara recebe nome, idade e medicamentos corretamente

