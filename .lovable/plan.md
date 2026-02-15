
# Melhorias Visuais e Sonoras no Check-In

## 1. Som de toque na tela de chamada recebida

Adicionar um som de toque de celular que toca em loop enquanto a tela "incoming" estiver ativa. Usar a Web Audio API para gerar um tom de toque sintetizado (dois tons alternados, estilo telefone clássico), sem precisar de arquivo de áudio externo. O som para automaticamente ao atender ou recusar.

## 2. Estilos diferentes para mensagens da Clara e do Usuário

Atualmente ambas as bolhas de chat são muito parecidas (apenas opacidade diferente). As mudanças:
- **Mensagens do Usuário**: bolha com fundo branco semi-transparente, alinhada à direita, bordas arredondadas com canto inferior direito reto
- **Mensagens da Clara**: bolha com fundo em tom de accent/teal mais escuro, alinhada à esquerda, bordas arredondadas com canto inferior esquerdo reto, com um pequeno indicador "Clara" em destaque

## 3. Microfone em cor diferente

Mudar o botão do microfone para usar a cor secondary (amber/laranja) em vez do estilo atual transparente, tornando-o mais visível e distinto dos outros controles.

---

## Detalhes Tecnicos

### Arquivo: `src/pages/CheckIn.tsx`

**Toque de celular (Ringtone)**:
- Criar um hook/efeito que inicia quando `callState === 'incoming'`
- Usar `OscillatorNode` da Web Audio API para gerar tons alternados (440Hz e 480Hz) com padrão ring-pause-ring
- Usar `setInterval` para criar o padrão de toque (1s tocando, 2s silêncio)
- Limpar tudo no cleanup do efeito (ao sair da tela ou atender)

**Estilos das mensagens**:
- Usuário: `bg-white/25 rounded-lg rounded-br-none`
- Clara: `bg-accent/30 rounded-lg rounded-bl-none border-l-2 border-secondary`
- Label "Clara" em cor secondary (amber)

**Cor do microfone**:
- Mudar o fundo do botão do microfone em estado "listening" para `bg-secondary/80` (amber)
- Em estado "speaking" manter `bg-destructive/80` (vermelho)
- O ícone `Mic` ficará mais destacado com o contraste do amber
