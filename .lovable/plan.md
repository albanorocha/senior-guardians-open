

# Pre Call API - Enviar Contexto do Paciente para Clara

## Arquitetura em Duas Partes

O fluxo e dividido entre o que o Lovable controla (codigo) e o que voce configura manualmente no dashboard do Atoms.

```text
PARTE 1 - Lovable (codigo)                    PARTE 2 - Atoms Dashboard (manual)
================================               ==================================
                                               
Frontend inicia webcall                        No dashboard do Atoms:
  envia user_id para atoms-session             1. Adicionar Pre Call API Node
        |                                      2. URL: {supabase_url}/functions/v1/atoms-precall
        v                                      3. Metodo: POST
atoms-session salva contexto                   4. Configurar headers (apikey)
  na tabela pre_call_context                   
  e cria a webcall                             
        |                                      Atoms chama o webhook automaticamente
        v                                      antes de iniciar a conversa
atoms-precall (webhook)                              |
  recebe chamada do Atoms                            v
  busca contexto do paciente                   Clara recebe as variaveis
  retorna variables                            e inicia conversa personalizada
```

## Parte 1 - Codigo (Lovable)

### 1. Criar tabela `pre_call_context`

Tabela temporaria para armazenar o contexto do paciente entre a criacao da sessao e a chamada do Pre Call API.

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid (PK) | Identificador unico |
| user_id | uuid | ID do usuario |
| variables | jsonb | Dados do paciente (nome, medicacoes, etc.) |
| created_at | timestamp | Para limpeza de registros antigos |

RLS: service_role apenas (acessada somente pelas edge functions).

### 2. Atualizar `atoms-session` edge function

Antes de criar a webcall:
- Receber `user_id` e `variables` do frontend
- Salvar o contexto na tabela `pre_call_context` (upsert por user_id)
- Criar a webcall normalmente (sem enviar variables, pois o endpoint webcall ignora)

### 3. Criar nova edge function `atoms-precall`

Este e o webhook que o Atoms vai chamar. Ele:
- Recebe a requisicao do Atoms (o body depende do que o Atoms envia)
- Busca o contexto mais recente do paciente na tabela `pre_call_context`
- Retorna as variaveis no formato esperado pelo Atoms

### 4. Atualizar `CheckIn.tsx`

- Enviar `user_id` junto com as `variables` para a edge function `atoms-session`
- O restante do codigo de coleta de dados (nome, medicacoes, etc.) ja esta pronto

## Parte 2 - Dashboard do Atoms (manual, feito por voce)

No painel do Smallest.ai (https://app.smallest.ai):

1. Abrir o agente Clara (ID: `6990ef650d1c87f0c9a42402`)
2. Adicionar um **Pre Call API Node** no fluxo do agente
3. Configurar a URL do webhook apontando para a edge function:
   - URL: `https://rlbratdaqtdpbifkceds.supabase.co/functions/v1/atoms-precall`
   - Metodo: POST
   - Headers: adicionar `apikey` com a chave anonima do projeto
4. Garantir que o prompt do agente usa as variaveis com sintaxe `{{patient_name}}`, `{{medications}}`, etc.

## Ponto importante

Precisamos saber **que dados o Atoms envia no body** quando chama o Pre Call API. Isso determina como vamos identificar o paciente correto. Opcoes possiveis:

- Se o Atoms envia algum ID de sessao que podemos controlar, usamos esse ID como chave
- Se nao envia nada identificavel, usamos o registro mais recente do `pre_call_context` para o usuario (funciona bem para MVP com poucos usuarios simultaneos)

Apos a implementacao, voce podera verificar nos logs da edge function `atoms-precall` exatamente o que o Atoms envia, e ajustaremos se necessario.

## Arquivos criados/modificados

- **Novo:** Migracao SQL para tabela `pre_call_context`
- **Novo:** `supabase/functions/atoms-precall/index.ts`
- **Modificado:** `supabase/functions/atoms-session/index.ts` - salvar contexto na tabela
- **Modificado:** `src/pages/CheckIn.tsx` - enviar user_id

