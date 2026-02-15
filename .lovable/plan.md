

# Conectar IA ao sistema + Auto-finalizar chamada

## O que muda para o usuario

Durante a conversa com a Clara, ela vai automaticamente:
- Marcar medicamentos como tomados ou nao tomados
- Registrar efeitos colaterais mencionados
- Detectar o humor do paciente
- Gerar um resumo da conversa
- **Finalizar a chamada automaticamente** quando entender que o check-in esta completo

Tudo isso aparece pre-preenchido na tela de resumo. Pequenos toasts discretos aparecem durante a chamada confirmando o que foi registrado.

## Detalhes Tecnicos

### Arquivo: `supabase/functions/voice-chat/index.ts`

Adicionar **tool calling** ao LLM com 4 ferramentas:

```typescript
const tools = [
  {
    type: "function",
    function: {
      name: "report_medication_status",
      description: "Report whether patient took a medication and any side effects",
      parameters: {
        type: "object",
        properties: {
          medication_name: { type: "string" },
          taken: { type: "boolean" },
          side_effects: { type: "string" }
        },
        required: ["medication_name", "taken"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "report_mood",
      description: "Report detected patient mood",
      parameters: {
        type: "object",
        properties: {
          mood: { type: "string", enum: ["happy", "neutral", "confused", "distressed"] },
          details: { type: "string" }
        },
        required: ["mood"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_summary",
      description: "Generate a brief check-in summary when conversation is wrapping up",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          overall_status: { type: "string", enum: ["good", "concerning", "needs_attention"] }
        },
        required: ["summary"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "end_conversation",
      description: "End the check-in call when all topics have been covered and the patient has said goodbye",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" }
        },
        required: ["reason"]
      }
    }
  }
];
```

Atualizar o system prompt para instruir a Clara a:
- Chamar `report_medication_status` quando o paciente confirmar/negar ter tomado um medicamento
- Chamar `report_mood` quando detectar o estado emocional
- Chamar `generate_summary` quando a conversa estiver terminando
- Chamar `end_conversation` apos a despedida final (depois de ter coberto medicamentos e humor)

Processar tool calls do LLM: quando o modelo retornar `tool_calls`, extrair os dados, fazer uma segunda chamada ao LLM com os resultados das tools para obter a resposta de texto, e incluir `extractedData` no JSON de resposta.

```text
Fluxo:
  LLM resposta com tool_calls
      |
      v
  Extrair dados de cada tool call
      |
      v
  Segunda chamada ao LLM com tool results
      |
      v
  Retornar: { agentText, audioBase64, extractedData: [...] }
```

### Arquivo: `src/pages/CheckIn.tsx`

Modificar `handleVoiceResponse` para processar `extractedData`:

- **report_medication_status**: Encontrar medicamento pelo nome (match parcial, case-insensitive) e atualizar `responses` state (toggle taken, preencher issues)
- **report_mood**: Atualizar state `mood`
- **generate_summary**: Preencher campo `summary`
- **end_conversation**: Chamar `handleEndCall()` automaticamente apos a Clara falar sua mensagem de despedida (aguardar o audio terminar de tocar)

Para cada acao, mostrar um toast discreto (ex: "Losartan marcado como tomado", "Humor: Happy").

Para o `end_conversation`, adicionar logica no `playAudio` / `onended` que verifica se ha um flag `shouldEndCall` e chama `handleEndCall()` quando o audio de despedida terminar de tocar.

```typescript
// Novo ref para controlar auto-end
const shouldEndCallRef = useRef(false);

// Em handleVoiceResponse:
if (data.extractedData) {
  for (const item of data.extractedData) {
    if (item.tool === 'report_medication_status') {
      // match medication by name
      const med = medications.find(m => 
        m.name.toLowerCase().includes(item.args.medication_name.toLowerCase())
      );
      if (med) {
        setResponses(r => ({
          ...r,
          [med.id]: { taken: item.args.taken, issues: item.args.side_effects || '' }
        }));
        toast({ title: `${med.name}: ${item.args.taken ? 'Taken' : 'Not taken'}` });
      }
    }
    if (item.tool === 'report_mood') {
      setMood(item.args.mood);
      toast({ title: `Mood detected: ${item.args.mood}` });
    }
    if (item.tool === 'generate_summary') {
      setSummary(item.args.summary);
    }
    if (item.tool === 'end_conversation') {
      shouldEndCallRef.current = true;
      // handleEndCall sera chamado quando o audio terminar
    }
  }
}

// Em playAudio, no onended:
audio.onended = () => {
  setIsPlaying(false);
  URL.revokeObjectURL(url);
  if (shouldEndCallRef.current) {
    shouldEndCallRef.current = false;
    handleEndCall();
  }
};
```

### Resumo dos arquivos modificados

1. **`supabase/functions/voice-chat/index.ts`** -- Tools definition, tool call processing, second LLM round-trip, updated system prompt, `extractedData` in response
2. **`src/pages/CheckIn.tsx`** -- Process `extractedData`, auto-update medications/mood/summary states, auto-end call via `shouldEndCallRef`, toast feedback

