

# Painel Admin com Impersonacao de Usuarios

## Visao Geral

Criar um painel administrativo acessivel em `/admin` que permite ao admin (admin@guardians.com) visualizar todos os pacientes, suas metricas e dashboards, e impersonar qualquer usuario para navegar o app como se fosse ele.

## Arquitetura de Seguranca

A validacao do admin sera feita **server-side** via edge function. O frontend nunca decide sozinho se o usuario e admin -- ele chama uma edge function que:
1. Verifica se o token JWT pertence a `admin@guardians.com`
2. Usa a service_role key para buscar dados de todos os usuarios (bypass RLS)

Para impersonacao, um contexto React armazena o `user_id` sendo visualizado. As paginas existentes (Dashboard, History, Medications, CheckIn) passam a usar esse ID em vez do `user.id` direto.

## Mudancas no Banco de Dados

Nenhuma migracao necessaria. A tabela `profiles` ja contem `full_name`, `age`, `role` e os dados necessarios. O admin sera identificado pelo email na tabela `auth.users`, validado server-side.

## Nova Edge Function: `admin-data`

**Arquivo:** `supabase/functions/admin-data/index.ts`

Endpoints (via query param `action`):
- `list_patients`: Retorna todos os profiles com contagens de check-ins, alertas, medicamentos
- `patient_detail`: Retorna dados completos de um paciente especifico (check-ins, alertas, medicamentos, health_logs, etc.)

Validacao: extrai o JWT, busca o email em auth.users via service_role, rejeita se nao for admin@guardians.com.

## Novo Contexto: Impersonacao

**Arquivo:** `src/hooks/useImpersonation.tsx`

- Context com `impersonatedUserId` e `setImpersonatedUserId`
- Funcao `effectiveUserId`: retorna o impersonated ID se ativo, senao o user.id real
- Funcao `isImpersonating`: boolean
- Funcao `stopImpersonating`: limpa o estado

## Mudancas no Auth/Routing

**Arquivo:** `src/App.tsx`
- Adicionar rota `/admin` protegida
- Envolver app com `ImpersonationProvider`

**Arquivo:** `src/components/ProtectedRoute.tsx`
- Nenhuma mudanca (admin usa a mesma autenticacao)

**Arquivo:** `src/components/AdminRoute.tsx` (novo)
- Componente que verifica se o usuario e admin (via edge function) antes de renderizar

## Nova Pagina: Admin Dashboard

**Arquivo:** `src/pages/Admin.tsx`

Layout com:
- **Tabela de pacientes**: nome, idade, total check-ins, ultimo check-in, total alertas, aderencia
- **Metricas globais**: total pacientes, check-ins hoje, alertas ativos, aderencia media
- **Botao "View as"** em cada linha para impersonar o paciente
- Busca/filtro por nome

## Banner de Impersonacao

**Arquivo:** `src/components/ImpersonationBanner.tsx` (novo)

Banner fixo no topo quando admin esta impersonando, mostrando:
- "Viewing as [Nome do Paciente]"
- Botao "Back to Admin" para parar a impersonacao

## Mudancas nas Paginas Existentes

**Arquivos:** `src/pages/Dashboard.tsx`, `src/pages/History.tsx`, `src/pages/Medications.tsx`, `src/pages/CheckIn.tsx`

- Trocar `user.id` por `effectiveUserId` do contexto de impersonacao
- Quando impersonando, as queries buscam dados do paciente selecionado

**Arquivo:** `src/components/AppNav.tsx`
- Adicionar link "Admin" se o usuario for admin
- Mostrar o banner de impersonacao

## Resumo dos Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/admin-data/index.ts` | Novo - edge function para dados admin |
| `src/hooks/useImpersonation.tsx` | Novo - contexto de impersonacao |
| `src/components/AdminRoute.tsx` | Novo - rota protegida para admin |
| `src/components/ImpersonationBanner.tsx` | Novo - banner de impersonacao |
| `src/pages/Admin.tsx` | Novo - painel admin |
| `src/App.tsx` | Adicionar rota /admin e ImpersonationProvider |
| `src/components/AppNav.tsx` | Link admin + banner impersonacao |
| `src/pages/Dashboard.tsx` | Usar effectiveUserId |
| `src/pages/History.tsx` | Usar effectiveUserId |
| `src/pages/Medications.tsx` | Usar effectiveUserId |
| `src/pages/CheckIn.tsx` | Usar effectiveUserId |
| `supabase/config.toml` | Registrar nova edge function (verify_jwt = false) |

## Detalhes Tecnicos

### Edge Function - Validacao Admin
```text
1. Extrair Authorization header
2. supabase.auth.getUser(token) -> get user email
3. Se email !== 'admin@guardians.com' -> 403
4. Usar serviceRoleClient para queries cross-user
```

### Impersonacao - Fluxo
```text
Admin clica "View as" no paciente
  -> setImpersonatedUserId(patient.id)
  -> Redireciona para /dashboard
  -> Dashboard usa effectiveUserId em vez de user.id
  -> Banner mostra "Viewing as [nome]"
  -> Admin clica "Back to Admin"
  -> stopImpersonating() + redireciona para /admin
```

### Metricas do Admin Dashboard
- Total de pacientes ativos
- Check-ins realizados hoje (todos os usuarios)
- Alertas nao reconhecidos (todos)
- Aderencia media (ultimos 30 dias, todos)
- Lista com dados por paciente

