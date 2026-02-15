

# Ajustes na Clara e no Historico

## 1. Clara - Tom mais acolhedor e fluxo simplificado

### Mudancas no prompt (`supabase/functions/voice-chat/index.ts`)

**Saudacao acolhedora (Linha 240):**
Trocar o opener frio por algo caloroso:
- Antes: "Good morning! Let's check on your medications today."
- Depois: Clara deve cumprimentar pelo nome, perguntar como o paciente esta se sentindo, e depois perguntar sobre os medicamentos de forma simples e agrupada.
- Exemplo: "Bom dia, Joao! Como voce esta hoje? Tomou o Tylenol e a Desloratadina?"

**Pergunta sobre medicamentos de forma simples (Linhas 243-250):**
Em vez de perguntar um por um (lento e cansativo), Clara deve listar todos os medicamentos numa pergunta so:
- "Voce tomou o [med1], [med2] e [med3] hoje?"
- Se o paciente confirmar tudo, chamar `report_medication_status` para cada um.
- Se disser que faltou algum, perguntar qual especificamente.

**Encerramento positivo (Linha 259):**
Trocar "Take care! I'll check in again [next time]." por instrucao para Clara sempre desejar um dia maravilhoso e encerrar de forma positiva e acolhedora.
- Exemplo: "Que bom falar com voce, [nome]! Tenha um dia maravilhoso!"

### Resumo das mudancas no prompt

| Secao | Antes | Depois |
|-------|-------|--------|
| Opener | Saudacao fria, direto ao ponto | Cumprimento caloroso, perguntar como esta |
| Medicamentos | Um por um, rigido | Listar todos numa pergunta simples |
| Encerramento | Generico "Take care" | Desejar dia maravilhoso, tom acolhedor |

## 2. History - Mostrar logs da conversa

O History ja mostra alertas, health logs e reminders por check-in (implementado anteriormente). Porem, o `summary` (resumo gerado pela Clara) aparece truncado no card e repetido dentro do collapsible.

### Melhoria: Secao "Conversation Notes"
Adicionar uma secao dedicada no collapsible de cada check-in que mostre:
- O **summary** completo da conversa (gerado pelo tool `generate_summary`)
- Os **alertas** ja estao sendo mostrados (manter)
- Os **health logs** ja estao sendo mostrados (manter)

Nenhuma mudanca de banco necessaria - os dados ja estao salvos. Apenas melhorar a apresentacao visual do summary para que fique mais destacado como "notas da conversa".

## Arquivos alterados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/voice-chat/index.ts` | Reescrever opener, medicamentos agrupados, encerramento acolhedor |
| `src/pages/History.tsx` | Destacar summary como "Conversation Notes" com melhor formatacao |

## Detalhes tecnicos

### Prompt - Secoes reescritas

**Opener (linha 240):**
```text
1. Opener: Greet the patient warmly by name. Ask how they are feeling today. Then naturally transition to medications.
   Example: "Good morning, [name]! How are you doing today? Did you take your [med1] and [med2]?"
```

**Medication Check (linhas 243-250):**
```text
2. Medication Check - THIS IS YOUR PRIORITY:
   - Ask about ALL medications in a single, simple question. List them by name.
   - Example: "Did you take your [med1], [med2], and [med3] today?"
   - If patient confirms all: call report_medication_status for EACH one individually with taken=true.
   - If patient says they missed some: ask which ones specifically, then report each.
   - You MUST call report_medication_status for EVERY medication before moving on.
```

**Wrapping Up (linha 259):**
```text
5. Wrapping Up: Always end on a positive, warm note. Wish the patient a wonderful day. Make them feel cared for.
   Example: "It was so lovely talking to you, [name]! Have a wonderful day!" 
   Then use generate_summary and end_call.
```

### History.tsx - Summary como secao destacada
Mover o summary de uma linha truncada para uma secao "Conversation Notes" com icone de mensagem, dentro do collapsible, antes dos alertas.

