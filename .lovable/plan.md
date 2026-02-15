

# Unificar o Prompt da Clara com o Sistema Atual

## Objetivo

Substituir o system prompt simplificado atual pelo prompt completo e detalhado da Clara, e alinhar as ferramentas (tools) do LLM com as funcoes descritas no prompt.

## O que muda

### 1. System Prompt (`supabase/functions/voice-chat/index.ts`)

O prompt atual tem ~20 linhas genericas. Sera substituido pelo prompt completo que define:
- Personalidade e tom da Clara (paciente, calorosa, feminina)
- Regras de formatacao (sem markdown, numeros digito a digito, horarios por extenso)
- Fluxo conversacional completo (abertura, checagem de medicamentos um a um, efeitos colaterais, wellness check, encerramento)
- Protocolo de emergencia
- Guardrails de seguranca (nunca diagnosticar, nunca mudar medicamentos)
- Logica de reforco positivo e tracking de aderencia

O prompt sera parametrizado com as variaveis dinamicas ja existentes: `patientName`, `patientAge`, `medicationList`, data/hora atual.

### 2. Ferramentas (Tools) - Expandir para cobrir o prompt completo

Ferramentas atuais (mantidas e ajustadas):
- **report_medication_status** - mantida como esta
- **report_mood** - mantida como esta
- **generate_summary** - mantida como esta
- **end_conversation** - renomeada para `end_call` para alinhar com o prompt

Novas ferramentas adicionadas:
- **send_alert** - Para emergencias (dor no peito, queda, ideacao suicida). No momento, loga no servidor e inclui nos extractedData para o frontend exibir alerta visual
- **send_alert_to_caregiver** - Para alertas nao-urgentes (medicamento nao tomado, padrao de nao-aderencia). Similar ao anterior, com severidade menor
- **log_health_data** - Registra dados de saude mencionados (sono, alimentacao, sintomas). Incluido nos extractedData para referencia
- **schedule_reminder** - Para quando Clara sugere ligar de volta mais tarde. Por agora, apenas loga a intencao nos extractedData

### 3. Frontend (`src/pages/CheckIn.tsx`)

Atualizar `handleVoiceResponse` para processar as novas ferramentas:
- **send_alert**: Exibir toast de alerta vermelho/urgente
- **send_alert_to_caregiver**: Exibir toast informativo
- **log_health_data**: Silencioso (apenas logging no console)
- **schedule_reminder**: Toast informativo ("Clara vai ligar novamente as X")
- **end_call**: Renomear de `end_conversation` para `end_call`

### 4. Detalhes do System Prompt

O prompt completo sera inserido como template string, com as seguintes variaveis interpoladas:
- `${patientContext?.patientName || 'Patient'}` 
- `${patientContext?.patientAge || 'unknown'}`
- `${medicationList}` (lista formatada dos medicamentos)
- `${new Date().toLocaleDateString()}` para current_date
- `${new Date().toLocaleTimeString()}` para current_time

O prompt sera longo (~4000 tokens), mas isso e necessario para guiar corretamente o comportamento da Clara. As secoes de fluxo conversacional, protocolo de emergencia e guardrails serao incluidas integralmente.

## Arquivos modificados

1. **`supabase/functions/voice-chat/index.ts`** - Prompt completo, novas tools, renomear end_conversation para end_call
2. **`src/pages/CheckIn.tsx`** - Processar novas tools no handleVoiceResponse, renomear end_conversation para end_call

