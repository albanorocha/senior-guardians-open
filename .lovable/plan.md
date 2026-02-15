

# Alertas em tempo real durante a chamada + estilo reforçado no Dashboard e History

## 1. Reduzir timeout de silêncio para 1 segundo

**Arquivo:** `src/pages/CheckIn.tsx`, linha 34
- `SILENCE_TIMEOUT_MS`: 2000 -> 1000

## 2. Cards de alerta durante a chamada ativa (CheckIn)

Atualmente, os alertas só aparecem na tela de resumo (summary). A mudança adiciona um banner de alertas **durante a chamada ativa**, logo acima do chat, que aparece em tempo real quando a Clara dispara um alerta.

**Arquivo:** `src/pages/CheckIn.tsx`
- No bloco `callState === 'active'` (entre o timer e o chat panel, por volta da linha 780), inserir um bloco que renderiza `callAlerts` em tempo real:
  - Alerta de emergência: card com borda vermelha, fundo vermelho translúcido, ícone vermelho
  - Notificação ao cuidador: card com borda azul, fundo azul translúcido, ícone azul
  - Animação de entrada com framer-motion para cada novo alerta

## 3. Reforçar alertas no Dashboard

**Arquivo:** `src/pages/Dashboard.tsx`, linhas 152-173
- Adicionar tratamento para `type === 'caregiver'`: borda azul, fundo azul claro, ícone azul (atualmente só tem emergency=vermelho e warning=amarelo)
- Texto adicional para caregiver: "Caregiver was notified"

## 4. Reforçar alertas no History

**Arquivo:** `src/pages/History.tsx`, linhas 148-158
- Mesmo padrão: adicionar estilo diferenciado para alertas do tipo `caregiver`
- Borda azul e fundo azul claro para alertas de notificação ao cuidador
- Manter vermelho para emergências e amarelo para warnings

## Resumo dos arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/CheckIn.tsx` | SILENCE_TIMEOUT_MS -> 1000; banner de alertas durante chamada ativa |
| `src/pages/Dashboard.tsx` | Estilo diferenciado para alertas caregiver (azul) |
| `src/pages/History.tsx` | Estilo diferenciado para alertas caregiver (azul) |

