

# Adicionar Logs Detalhados para Debug do Pre Call API

## Problema Atual

Os logs mostram que a funcao `atoms-precall` **foi chamada** pelo Atoms (recebeu body `{}`) e **retornou as variaveis corretamente**. Isso significa que a integracao tecnica esta funcionando. O problema provavel e a **configuracao de mapeamento de variaveis** no dashboard do Atoms.

## O que sera feito

### 1. Adicionar logs detalhados no frontend (CheckIn.tsx)

- Logar as variaveis enviadas para `atoms-session`
- Logar a resposta completa do `atoms-session`
- Logar erros com detalhes completos

### 2. Adicionar logs detalhados no `atoms-session`

- Logar o body completo recebido do frontend
- Logar a resposta completa da API do Atoms (webcall)
- Logar o status HTTP da resposta do Atoms

### 3. Adicionar logs detalhados e headers no `atoms-precall`

- Logar todos os headers recebidos (para entender como o Atoms chama)
- Logar o metodo HTTP usado
- Logar a URL completa
- Logar a query completa ao banco

### 4. Verificacao de configuracao no Atoms

Apos os logs, voce precisa verificar no dashboard do Atoms:

1. Na configuracao do Pre Call API, alem da URL, **e necessario mapear as variaveis da resposta**
2. Cada variavel do agente (ex: `patient_name`) precisa ser mapeada para o campo correspondente na resposta da API
3. Exemplo de mapeamento:
   - Variavel `patient_name` -> Path: `$.variables.patient_name`
   - Variavel `medications` -> Path: `$.variables.medications`
   - Variavel `current_date` -> Path: `$.variables.current_date`
   - Variavel `current_time` -> Path: `$.variables.current_time`
   - Variavel `patient_age` -> Path: `$.variables.patient_age`

## Detalhes Tecnicos

### Arquivos modificados

- **`src/pages/CheckIn.tsx`** - Adicionar `console.log` antes e depois da chamada ao `atoms-session`
- **`supabase/functions/atoms-session/index.ts`** - Logar body recebido, resposta completa do Atoms API, e status
- **`supabase/functions/atoms-precall/index.ts`** - Logar headers, metodo, e detalhes da query ao banco

### Exemplo de logs que serao adicionados

**Frontend:**
```text
[CheckIn] Variables: { patient_name: "Albano", ... }
[CheckIn] atoms-session response: { data: { token: "...", host: "..." } }
```

**atoms-session:**
```text
[atoms-session] Received body: { agentId: "...", variables: {...}, userId: "..." }
[atoms-session] Atoms API response status: 200
[atoms-session] Atoms API response body: { data: { token: "...", host: "..." } }
```

**atoms-precall:**
```text
[atoms-precall] Method: POST
[atoms-precall] Headers: { apikey: "...", content-type: "..." }
[atoms-precall] Received body: {}
[atoms-precall] DB query result: { variables: { patient_name: "Albano", ... } }
[atoms-precall] Returning: { variables: { patient_name: "Albano", ... } }
```

