

# Corrigir Injecao de Contexto: Pre Call API e a Unica Opcao para Webcall

## Descoberta Importante

O metodo `sendTextMessage()` do SDK **so funciona no modo "chat"**, nao no modo "webcall" (voz). A documentacao oficial do Atoms mostra explicitamente:

```text
sendMessage(message: string) {
  if (this.mode === "chat") {        // <-- so funciona em chat
    this.client.sendTextMessage(message);
  }
}
```

Por isso a Clara nunca recebe o contexto -- a mensagem e ignorada silenciosamente no modo webcall.

## Opcoes Disponiveis

Para webcall, a unica forma de passar contexto dinamico e o **Pre Call API Node** no Workflow do agente. Isso requer configuracao no dashboard do Atoms.

## O que precisa ser feito

### 1. No Dashboard do Atoms (feito por voce)

Ir ate o agente Clara e configurar o **Workflow Editor**:

1. Abrir o agente no dashboard do Atoms
2. Ir para **Workflow Editor** (nao "API Calls Settings")
3. Adicionar um **Pre Call API Node**
4. Conectar o Pre Call API Node ao **Start Node**
5. Configurar a URL do webhook:
   - URL: `https://rlbratdaqtdpbifkceds.supabase.co/functions/v1/atoms-precall`
   - Metodo: POST
   - Headers: nenhum necessario (a funcao ja esta configurada para aceitar qualquer origem)
6. **Mapear as variaveis** da resposta da API para as variaveis do agente:
   - `patient_name` -> JSONPath: `$.variables.patient_name`
   - `patient_age` -> JSONPath: `$.variables.patient_age`
   - `medications` -> JSONPath: `$.variables.medications`
   - `current_date` -> JSONPath: `$.variables.current_date`
   - `current_time` -> JSONPath: `$.variables.current_time`
7. Usar essas variaveis no prompt do agente (ex: `{{patient_name}}`, `{{medications}}`)

### 2. No Codigo (feito por mim)

- **Reverter o `sendTextMessage`** do CheckIn.tsx (remover o codigo que envia contexto via texto, ja que nao funciona em webcall)
- **Restaurar o salvamento de contexto** no `atoms-session` para que ele salve as variaveis na tabela `pre_call_context` antes de criar o webcall
- O `atoms-precall` ja esta funcionando e retornando as variaveis corretamente -- so precisa ser chamado pelo Atoms

### 3. Fluxo Completo

```text
Frontend (CheckIn.tsx)
   |
   | envia variables + userId
   v
atoms-session (edge function)
   |
   | 1. Salva variables na tabela pre_call_context
   | 2. Cria webcall na API do Atoms
   | 3. Retorna token + host
   v
Atoms Platform
   |
   | Antes de iniciar a conversa, chama Pre Call API
   v
atoms-precall (edge function)
   |
   | Busca variables da tabela pre_call_context
   | Retorna { variables: { patient_name, medications, ... } }
   v
Agente Clara
   |
   | Usa as variaveis no prompt: "Ola {{patient_name}}..."
```

## Resumo

O problema nao e no codigo -- e na **configuracao do Workflow do agente no dashboard do Atoms**. O Pre Call API Node precisa estar conectado ao Start Node com o mapeamento de variaveis correto. Sem isso, o Atoms nunca chama o webhook.

Depois que voce configurar o Workflow, eu removo o `sendTextMessage` (que nao funciona) e restauro o salvamento de contexto no banco.

