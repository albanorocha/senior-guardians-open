

# Enviar Contexto do Paciente para o Agente Clara via API

## Objetivo

Antes de iniciar a chamada de voz, o sistema deve coletar todas as informacoes do paciente (nome, medicacoes, frequencias, etc.) e envia-las como variaveis para a API do Smallest.ai. Assim, a Clara ja comeca a conversa sabendo quem e o paciente e quais medicamentos verificar.

## Como Funciona a Integracao

A API do Smallest.ai aceita um campo `variables` no corpo da requisicao de webcall. Essas variaveis sao injetadas no prompt do agente e ficam disponiveis durante toda a conversa.

```text
Frontend coleta dados do paciente (nome, medicacoes, etc.)
        |
        v
Envia para edge function /atoms-session com os dados
        |
        v
Edge function repassa para Smallest.ai API com campo "variables"
  POST atoms-api.smallest.ai/api/v1/conversation/webcall
  Body: { agentId, variables: { patient_name, medications, ... } }
        |
        v
Agente Clara recebe o contexto e inicia a conversa personalizada
```

## Etapas de Implementacao

### 1. Atualizar a Edge Function `atoms-session`

Arquivo: `supabase/functions/atoms-session/index.ts`

- Aceitar um campo `variables` no corpo da requisicao (alem do `agentId`)
- Repassar esse campo para a API do Smallest.ai no POST para `/conversation/webcall`

Corpo enviado para Smallest.ai:
```text
{
  "agentId": "6990ef650d1c87f0c9a42402",
  "variables": {
    "patient_name": "Albano",
    "patient_age": 35,
    "medications": "test (5mg, once daily, Take with water)",
    "current_date": "2026-02-14",
    "current_time": "19:20"
  }
}
```

### 2. Atualizar `src/pages/CheckIn.tsx`

No `handleAnswer()`:
- Buscar dados do perfil do usuario (nome, idade) - ja temos via `useAuth`
- Usar a lista de medicacoes ja carregada no estado `medications`
- Formatar as medicacoes como string legivel (nome, dosagem, frequencia, instrucoes)
- Enviar tudo no body da chamada para a edge function

Exemplo do body enviado pelo frontend:
```text
{
  "agentId": "6990ef650d1c87f0c9a42402",
  "variables": {
    "patient_name": "Albano",
    "patient_age": 35,
    "medications": "1. test - 5mg, once daily. Instructions: Take with water",
    "current_date": "Friday, February 14, 2026",
    "current_time": "7:20 PM"
  }
}
```

### 3. Configurar o Agente no Painel do Smallest.ai

No painel do Smallest.ai (https://app.smallest.ai), voce precisa configurar o prompt do agente Clara para usar as variaveis. No prompt, use a sintaxe de variaveis do Atoms:

```text
You are Clara, a friendly health companion for elderly patients.

The patient you are speaking with is {{patient_name}}, age {{patient_age}}.

Today is {{current_date}} and the current time is {{current_time}}.

Their current medications are:
{{medications}}

Your task is to:
1. Greet the patient warmly by name
2. Ask about each medication - did they take it today?
3. Ask if they experienced any side effects or issues
4. Ask how they are feeling overall (mood)
5. Provide a brief encouraging message
6. End the call politely

Keep responses short and clear. Speak slowly. Use simple language.
```

**Onde configurar no Smallest.ai:**
1. Acesse https://app.smallest.ai
2. Va em "Agents" e selecione o agente Clara (ID: `6990ef650d1c87f0c9a42402`)
3. Na aba "Prompt" ou "Single Prompt", cole o prompt acima usando as variaveis com `{{variable_name}}`
4. Na aba "Default Variables" (opcional), defina valores padrao caso alguma variavel nao seja enviada
5. Salve as alteracoes

## Detalhes Tecnicos

### Arquivos modificados
- `supabase/functions/atoms-session/index.ts` - aceitar e repassar `variables`
- `src/pages/CheckIn.tsx` - coletar e enviar contexto do paciente

### Dados enviados ao agente

| Variavel | Origem | Exemplo |
|---|---|---|
| `patient_name` | profiles.full_name | "Albano" |
| `patient_age` | profiles.age | 35 |
| `medications` | medications table (formatado) | "1. test - 5mg, once daily..." |
| `current_date` | `new Date()` formatado | "Friday, February 14, 2026" |
| `current_time` | `new Date()` formatado | "7:20 PM" |

### Formato das medicacoes

Cada medicacao sera formatada como:
```text
1. [nome] - [dosagem], [frequencia]. Instructions: [instrucoes]
2. [nome] - [dosagem], [frequencia]. Instructions: [instrucoes]
```

Se nao houver medicacoes, sera enviado: "No medications registered."

