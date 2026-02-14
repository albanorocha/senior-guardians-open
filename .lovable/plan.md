

# Integração do Smallest.ai Atoms Voice Widget

## O que será feito

Substituir o placeholder atual na página de check-in pelo widget real de voz do Smallest.ai, permitindo conversas de voz com a Clara.

## Detalhes

### 1. Instalar o pacote `atoms-widget-core`
- Adicionar como dependência npm do projeto

### 2. Atualizar a página de Check-in (`/check-in`)
- Importar o componente `AtomsWidget` de `atoms-widget-core`
- Substituir o bloco placeholder (linhas 174-177) pelo widget real:
  - `assistantId="6990ef650d1c87f0c9a42402"`
  - `mode="voice"`
  - `accentColor="#4A90A4"`
- Adicionar tratamento de erro caso o widget não carregue

### Sobre a API Key
- A API Key (`sk_...`) é usada apenas no painel do Smallest.ai para autenticar sua conta
- O widget no frontend usa apenas o Assistant ID, que é público
- Não é necessário armazenar a API Key no projeto

### Arquivo modificado
- `src/pages/CheckIn.tsx` — importar AtomsWidget e substituir placeholder

