

# Ajustar uso do nome do paciente pela Clara

## Mudanca

**Arquivo:** `supabase/functions/voice-chat/index.ts`, linha 221

Trocar a instrucao atual:
> "Always address the patient by their first name in every response. Use their name naturally to make them feel recognized and cared for."

Por:
> "Use the patient's first name only at the beginning of the conversation (greeting) and occasionally when it feels natural -- for example, to comfort or emphasize something. Do NOT repeat their name in every single response; it sounds robotic."

Isso torna a conversa mais natural e menos repetitiva, mantendo o toque pessoal nos momentos certos.

## Arquivo alterado

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/voice-chat/index.ts` | Instrucao sobre uso do nome: apenas no inicio e quando fizer sentido |

