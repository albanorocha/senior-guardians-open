
# Correções: Finalizar chamada antes de nova + Cor do microfone

## 1. Finalizar chamada anterior antes de iniciar nova

**Problema**: Ao atender uma nova chamada, o codigo nao limpa os recursos da chamada anterior (streams de audio, MediaRecorder, AudioContext). Isso causa dois audios tocando simultaneamente.

**Solucao**: Chamar `resetCallState()` no inicio de `handleAnswer()` para garantir que todos os recursos da chamada anterior sejam liberados antes de iniciar uma nova.

## 2. Cor do microfone

**Problema**: O microfone no estado "listening" ja foi alterado para `bg-secondary/80` (amber), mas o usuario quer confirmar que nao esta vermelho.

**Verificacao**: Confirmar que o estado `listening` usa `bg-secondary/80` (amber/laranja) e nao vermelho. O vermelho (`bg-destructive/80`) deve ser usado apenas quando o usuario esta falando (`speaking`).

---

## Detalhes Tecnicos

### Arquivo: `src/pages/CheckIn.tsx`

**Mudanca 1 — `handleAnswer` (linha ~326)**:
Adicionar `resetCallState()` como primeira acao dentro de `handleAnswer`, antes de qualquer setup novo. Isso garante que:
- MediaRecorder anterior e parado
- Streams de audio anteriores sao fechados
- AudioContext anterior e encerrado
- Todos os refs sao resetados

```typescript
const handleAnswer = async () => {
  // Limpar qualquer chamada anterior antes de iniciar nova
  resetCallState();
  setConnecting(true);
  // ... resto do codigo
};
```

**Mudanca 2 — Cor do microfone**:
Verificar e garantir que as cores estejam corretas:
- `listening` → `bg-secondary/80` (amber/laranja) — ja implementado
- `speaking` → `bg-secondary` (amber, mesma familia, nao vermelho)
- `processing` → indicador de loading
- `clara-speaking` → `bg-accent/60` (teal, indicando que a Clara esta falando)

Isso remove o vermelho do microfone completamente, usando amber para estados do usuario e teal para estados da Clara.
