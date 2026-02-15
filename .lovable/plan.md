
# Debug Visual no Frontend

Criar uma pagina `/debug` com um painel visual que testa cada etapa do fluxo de dados, permitindo identificar exatamente onde o problema esta.

## O que sera criado

### Pagina Debug (`src/pages/Debug.tsx`)

Um painel com 4 testes, cada um em um card com botao para executar:

**Teste 1 - Dados no Banco**
- Consulta a tabela `pre_call_context` usando o Supabase client
- Mostra o ultimo registro salvo (user_id, variables, created_at)
- Indica se tem dados ou se esta vazio

**Teste 2 - Chamar atoms-precall diretamente**
- Faz um `fetch` POST para a edge function `atoms-precall` a partir do browser
- Mostra a resposta JSON exata (o que o Atoms receberia)
- Verifica se o formato esta correto (`{ variables: { ... } }`)

**Teste 3 - Fluxo completo simulado**
- Insere dados de teste na tabela `pre_call_context` via `atoms-session`
- Imediatamente chama `atoms-precall` para verificar se retorna os dados
- Mostra o resultado de ambas as etapas

**Teste 4 - Informacoes uteis**
- Mostra a URL completa do webhook para copiar e colar no dashboard do Atoms
- Mostra o comando `curl` exato para testar externamente
- Mostra o formato JSON esperado pelo Atoms

Cada teste mostra:
- Status visual (verde/vermelho/cinza)
- Tempo de resposta em ms
- JSON formatado da resposta
- Mensagem de diagnostico

### Rota no App (`src/App.tsx`)

- Adicionar rota publica `/debug` (sem `ProtectedRoute`) para facilitar testes

## Detalhes Tecnicos

### Arquivo: `src/pages/Debug.tsx`

- Componente React com estado para cada teste (idle, loading, success, error)
- Usa `supabase` client para ler `pre_call_context` diretamente
- Usa `fetch` para chamar as edge functions
- Cards com `pre` tags para exibir JSON formatado
- Botao "Executar Todos" no topo

### Arquivo: `src/App.tsx`

- Import do componente Debug
- Adicionar `<Route path="/debug" element={<Debug />} />`

### Dependencias

Nenhuma nova dependencia necessaria. Usa componentes UI existentes (Card, Button, Badge).
