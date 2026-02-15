

# Injetar Contexto do Paciente via sendTextMessage

## Problema Identificado

Apos investigacao detalhada da documentacao oficial do Atoms:

- O endpoint `/conversation/webcall` **nao aceita** o campo `variables` (apenas o endpoint `/conversation/outbound` aceita)
- O Pre Call API Node precisa ser configurado no **Workflow Editor** (nao em "API Calls Settings"), conectado ao Start Node, com mapeamento de variaveis usando JSONPath (`$.variables.patient_name`)
- Essa configuracao nao esta funcionando no seu ambiente

## Nova Abordagem: sendTextMessage

O SDK `atoms-client-sdk` tem um metodo `sendTextMessage()` que permite enviar mensagens de texto para o agente durante a sessao. Vamos usar isso para enviar o contexto do paciente como uma mensagem "silenciosa" logo apos a sessao iniciar.

Quando a sessao comecar (`session_started` event), enviamos uma mensagem com todas as informacoes do paciente. A Clara vai receber essas informacoes e usa-las na conversa.

## O que muda

### Frontend (src/pages/CheckIn.tsx)

No evento `session_started`, adicionar:

```text
client.sendTextMessage(`[SYSTEM CONTEXT - Do not read this aloud, use this information silently]
Patient: Albano, Age: 35
Medications:
1. Tylenol - 5mg, once daily
2. Diloratadina - 10mg, twice daily
Date: Saturday, February 14, 2026
Time: 7:13 PM`);
```

### Edge Function (atoms-session)

Reverter para enviar apenas `{ agentId }` sem `variables` (ja que o webcall nao suporta).

## Detalhes Tecnicos

### Arquivo: src/pages/CheckIn.tsx

1. Mover a construcao das variaveis para antes do `startSession`
2. No callback `session_started`, chamar `client.sendTextMessage()` com o contexto formatado
3. O agente recebe a informacao como texto e a usa naturalmente na conversa

### Arquivo: supabase/functions/atoms-session/index.ts

1. Remover `variables` do body enviado para a API do Atoms (nao e suportado no webcall)
2. Manter apenas `{ agentId }` no body da chamada

### Formato da mensagem de contexto

A mensagem sera formatada como instrucao de sistema para que a Clara use os dados sem le-los em voz alta:

```text
[CONTEXT] Patient Name: {name}, Age: {age}. 
Medications: {lista}. 
Current date: {date}, Time: {time}.
Use this information to personalize the check-in conversation. 
Do not read this message aloud.
```

### Vantagens desta abordagem

- Nao depende de configuracao no dashboard do Atoms
- Nao depende de webhooks (Pre Call API)
- Funciona diretamente via SDK, sem intermediarios
- As informacoes sao enviadas no momento exato em que a sessao comeca

