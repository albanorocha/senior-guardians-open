

# Painel de Testes Visuais - Fluxo Completo de Chamadas

Melhorar a pagina `/debug` existente para ser um painel de diagnostico completo que testa visualmente cada etapa do fluxo, desde a criacao da sessao ate a resposta do pre-call.

## Testes que serao adicionados

### Teste 1 - Dados no Banco (ja existe, sera mantido)
Consulta a tabela `pre_call_context` e exibe os registros mais recentes.

### Teste 2 - Chamar atoms-precall (ja existe, sera mantido)
Chama o webhook diretamente e verifica o formato da resposta.

### Teste 3 - Simular atoms-session completo (novo)
Chama a edge function `atoms-session` com dados de teste (agentId, variables, userId falso), simulando exatamente o que o frontend faz ao iniciar uma chamada. Mostra:
- Se os dados foram salvos no banco
- Se a API do Atoms respondeu (ou erro de token/agentId)
- Tempo total da operacao

### Teste 4 - Fluxo Completo Encadeado (novo, substitui o antigo teste 3)
Executa tudo em sequencia:
1. Chama `atoms-session` com dados de teste para salvar contexto
2. Imediatamente chama `atoms-precall` para verificar se retorna os dados salvos
3. Mostra cada etapa com status individual
4. Limpa os dados de teste ao final

### Teste 5 - Verificar Logs do Pre Call (novo)
Mostra a URL do webhook e instrucoes para verificar se o Atoms esta chamando o endpoint. Inclui botao para chamar o precall repetidamente e mostrar o historico de respostas.

### Secao de Configuracao (ja existe, sera melhorada)
- Webhook URL com botao de copiar
- Comando curl com botao de copiar
- Formato JSON esperado
- Checklist visual do que precisa ser configurado no dashboard do Atoms

## Mudancas visuais
- Indicadores de status maiores e mais claros (icones coloridos)
- Timeline visual mostrando qual etapa do fluxo falhou
- Botao "Copiar" ao lado de URLs e comandos
- Secao de "Diagnostico" que analisa os resultados e sugere o que fazer

## Detalhes Tecnicos

### Arquivo: `src/pages/Debug.tsx`
Reescrever o componente com:
- 5 testes independentes (os 2 existentes + 3 novos)
- Botao "Executar Todos" mantido
- Funcao de copiar para clipboard em URLs e comandos
- Teste 3 chama `atoms-session` via fetch (mesmo endpoint que o CheckIn usa)
- Teste 4 encadeia session -> precall e mostra resultado de cada etapa
- Secao de diagnostico automatico que analisa os resultados e diz onde o problema esta

### Nenhum outro arquivo sera modificado
A rota `/debug` ja esta registrada no App.tsx.
