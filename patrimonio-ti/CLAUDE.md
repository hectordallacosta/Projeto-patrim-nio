# Sistema de Gestão de Patrimônio de TI — CLAUDE.md

> Este arquivo é lido automaticamente pelo Claude Code a cada sessão.
> Contém contexto permanente do projeto, convenções e estado atual.

---

## Visão Geral do Projeto

Sistema MERN para gerenciamento de patrimônio de TI com autenticação via Active Directory (LDAP).
Permite gerenciar equipamentos, usuários e setores com controle de acesso por perfil (admin/usuário).

**Repo raiz:** `patrimonio-ti/`
**Back-end:** `server/` — Node.js + Express + MongoDB
**Front-end:** `client/` — React (Vite) + Tailwind CSS

---

## Stack Definitiva

| Camada | Tecnologia |
|--------|-----------|
| Back-end | Node.js 20 + Express 4 |
| Banco | MongoDB 7 + Mongoose 8 |
| Autenticação | JWT (jsonwebtoken) + LDAP (ldapts) |
| Front-end | React 18 + Vite 5 + React Router DOM 6 |
| Estado global | Zustand |
| UI | Tailwind CSS 3 + shadcn/ui |
| Validação | Zod (back e front) |
| HTTP client | Axios |
| Testes back | Jest + Supertest |
| Testes front | Vitest + React Testing Library |

---

## Arquitetura de Pastas

```
patrimonio-ti/
|-- CLAUDE.md
|-- server/
|   |-- config/
|   |   |-- db.js
|   |   `-- ldap.js
|   |-- controllers/
|   |   |-- authController.js
|   |   |-- userController.js
|   |   |-- sectorController.js
|   |   |-- equipmentController.js
|   |   |-- equipmentModelController.js  # CRUD de modelos de equipamento
|   |   |-- equipmentTypeController.js
|   |   `-- auditLogController.js
|   |-- middleware/
|   |   |-- verifyToken.js
|   |   |-- requireAdmin.js
|   |   `-- errorHandler.js
|   |-- models/
|   |   |-- User.js
|   |   |-- Sector.js                    # sem campo type (SectorType removido)
|   |   |-- Equipment.js                 # referencia EquipmentModel (sem brand/model/type diretos)
|   |   |-- EquipmentModel.js            # modelo/template: brand, model, type, lot, garantia
|   |   |-- EquipmentType.js
|   |   `-- AuditLog.js
|   |-- routes/
|   |   |-- auth.routes.js
|   |   |-- user.routes.js
|   |   |-- sector.routes.js
|   |   |-- equipment.routes.js
|   |   |-- equipmentModel.routes.js     # GET,POST,PUT,DELETE /api/equipment-models
|   |   |-- equipmentType.routes.js
|   |   `-- auditLog.routes.js
|   |-- services/
|   |   |-- ldapService.js               # searchUsers e getUsersByOU — filtra só objectClass=person
|   |   |-- auditService.js
|   |   |-- sectorService.js
|   |   |-- equipmentService.js
|   |   |-- equipmentModelService.js     # CRUD + contagem de equipamentos por modelo
|   |   `-- userService.js               # inclui importFromAD(usernames)
|   |-- utils/
|   |   |-- apiResponse.js
|   |   |-- pagination.js
|   |   `-- ldapUtils.js              # extractSectorAcronym e extractSectorFullName (parsing do DN)
|   |-- __tests__/
|   |   |-- auth.test.js
|   |   |-- equipment.test.js
|   |   |-- equipmentModel.test.js       # testes do novo CRUD de modelos
|   |   `-- users.test.js                # inclui testes search-ad e import-ad
|   |-- seed-admin.js                    # cria usuario admin local
|   |-- migrate-equipment-model.js       # migra equipamentos antigos para novo schema
|   |-- test-ldap.js                     # script de diagnostico LDAP (veja Comandos Uteis)
|   |-- app.js
|   |-- server.js
|   `-- package.json
`-- client/
    |-- src/
    |   |-- components/
    |   |   |-- layout/
    |   |   |   |-- Header.jsx           # logo + info do usuário + logout
    |   |   |   |-- Sidebar.jsx          # inclui link para /admin/equipment-models
    |   |   |   `-- Layout.jsx
    |   |   `-- shared/
    |   |       |-- ADSyncModal.jsx      # modal busca/importacao de usuarios do AD
    |   |       |-- ConfirmDialog.jsx
    |   |       |-- ErrorBoundary.jsx    # captura erros de renderizacao React
    |   |       |-- PageTitle.jsx        # titulo de pagina + slot de acao (botao Novo)
    |   |       |-- Pagination.jsx
    |   |       |-- Modal.jsx              # fecha ao clicar no overlay (stopPropagation no conteúdo)
    |   |       |-- SearchBar.jsx        # barra de busca reutilizavel
    |   |       |-- StatusBadge.jsx
    |   |       |-- EmptyState.jsx       # aceita prop action=
    |   |       |-- Toaster.jsx          # topo-direito, tipos: success/error/warning/info
    |   |       `-- ProtectedRoute.jsx   # exporta ProtectedRoute (user) e AdminRoute (admin)
    |   |-- pages/
    |   |   |-- auth/Login.jsx
    |   |   |-- admin/
    |   |   |   |-- Dashboard.jsx
    |   |   |   |-- Equipment.jsx        # AssignForm com busca reativa de usuários via API
    |   |   |   |-- EquipmentModels.jsx  # CRUD de modelos de equipamento
    |   |   |   |-- Users.jsx            # botao "Sincronizar com AD" + ADSyncModal
    |   |   |   |-- Sectors.jsx          # filtros + URL params + cards + contagens
    |   |   |   |-- EquipmentTypes.jsx
    |   |   |   `-- AuditLog.jsx
    |   |   |-- user/
    |   |   |   |-- MyEquipment.jsx
    |   |   |   `-- Profile.jsx
    |   |   `-- NotFound.jsx
    |   |-- hooks/
    |   |   |-- useAuth.js
    |   |   |-- useDebounce.js           # debounce 300ms para inputs de busca
    |   |   |-- useUrlFilters.js         # filtros via query params da URL
    |   |   `-- usePagination.js
    |   |-- services/
    |   |   |-- api.js
    |   |   |-- authService.js
    |   |   |-- equipmentService.js
    |   |   |-- equipmentModelService.js # listEquipmentModels, listAllEquipmentModels, CRUD
    |   |   |-- equipmentTypeService.js
    |   |   |-- userService.js           # inclui searchADUsers, importUsersFromAD
    |   |   |-- sectorService.js
    |   |   `-- auditLogService.js
    |   |-- store/
    |   |   |-- authStore.js
    |   |   `-- toastStore.js            # toast.success/error/warning/info
    |   `-- utils/
    |       |-- formatters.js
    |       `-- cn.js
    |-- index.html
    `-- package.json
```

---

## Modelos de Dados (referência rápida)

### User
```
username, email, displayName, role(admin|user), sector->Sector,
adImported, adDepartment, isActive, lastLogin, localPassword(hash — so admins locais)
```

### Sector
```
name(unico), description, manager->User, isActive
```
> **SectorType foi removido.** Setor não tem mais campo `type`.

### EquipmentModel
```
type->EquipmentType, brand(obrigatorio), model(obrigatorio), lot,
warrantyExpiry, notes, isActive
```
> Template/classe do equipamento. Atualizações aqui refletem em todos os equipamentos vinculados.
> Combinação `brand + model + type` é única (índice composto, case-insensitive).
> Campo `purchaseDate` existe no schema Mongoose mas não é mais exposto no formulário (preservado para dados históricos).

### Equipment
```
equipmentModel->EquipmentModel(obrigatorio),
serialNumber(unico, opcional, índice sparse),
patrimonyNumber(unico, obrigatorio),
status(available|assigned|maintenance|decommissioned),
assignedTo->User (XOR) assignedSector->Sector,
assignmentHistory[], notes
```
> **brand, model, type, purchaseDate e warrantyExpiry foram removidos** do registro individual.
> Esses dados são herdados via `equipmentModel`.

### AuditLog
```
action, entity, entityId, performedBy->User, before{}, after{}, ip
```

---

## Regras de Negócio Críticas

1. **LDAP auth:** credenciais NUNCA salvas no MongoDB — só JWT gerado após validação
2. **Login local (fallback):** se LDAP falhar, o sistema tenta `localPassword` (bcrypt) — usado para conta `admin` de desenvolvimento
3. **Equipamento:** vinculado a UM usuário OU UM setor (nunca ambos)
4. **Ao vincular:** histórico anterior é encerrado e salvo em `assignmentHistory`
5. **Transferência direta:** `assign` em equipamento já vinculado encerra o vínculo anterior automaticamente
6. **Equipamento em manutenção/decommissioned:** não pode ser vinculado
7. **Deletar Sector:** bloquear se houver Users ou Equipments vinculados
8. **serialNumber:** único quando informado (índice sparse — múltiplos equipamentos podem ter serialNumber nulo)
9. **patrimonyNumber:** obrigatório e único — identifica fisicamente o bem (plaqueta)
10. **Deletar EquipmentModel:** bloqueado se houver Equipment vinculado — retorna `EQUIPMENT_MODEL_IN_USE`
11. **EquipmentModel:** combinação `brand + model + type` deve ser única no sistema (índice composto, case-insensitive). Retorna `EQUIPMENT_MODEL_DUPLICATE` (409) em caso de duplicata.
12. **Atribuição restrita a usuários ativos:** `equipmentService.assign` rejeita usuários com `isActive: false`
13. **Toda operação destrutiva** (delete, desvincular) → registrar no AuditLog

---

## Padrão de Resposta da API

```js
// Sucesso
{ success: true, data: {}, pagination?: {} }

// Erro
{ success: false, message: "Descrição amigável", code: "ERROR_CODE", details: {} }

// Paginação
{ success: true, data: [], pagination: { page, limit, total, pages } }
```

### Códigos de Erro
```
EQUIPMENT_TYPE_IN_USE | EQUIPMENT_MODEL_IN_USE | EQUIPMENT_MODEL_DUPLICATE | SECTOR_HAS_DEPENDENCIES
SERIAL_NUMBER_DUPLICATE | PATRIMONY_NUMBER_DUPLICATE | EQUIPMENT_UNAVAILABLE
LDAP_AUTH_FAILED | LDAP_UNAVAILABLE | USER_NOT_FOUND_AD | USER_INACTIVE | VALIDATION_ERROR
```

---

## Endpoints da API

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/login` | — | Login LDAP com fallback local |
| GET | `/api/auth/me` | token | Dados do usuário logado |
| GET | `/api/equipment` | token | Lista com filtros: status, equipmentModel, search, sort, sortDir |
| POST | `/api/equipment` | admin | Cria equipamento (body: equipmentModel, serialNumber, patrimonyNumber) |
| PATCH | `/api/equipment/:id/assign` | admin | Vincula (também faz transferência se já vinculado) |
| PATCH | `/api/equipment/:id/unassign` | admin | Desvincula |
| PATCH | `/api/equipment/:id/status` | admin | Altera status |
| GET | `/api/equipment-models` | token | Lista modelos com paginação + equipmentCount |
| GET | `/api/equipment-models/all` | token | Todos os modelos ativos (sem paginação, para dropdowns) |
| GET | `/api/equipment-models/:id` | token | Detalhe do modelo |
| POST | `/api/equipment-models` | admin | Cria modelo |
| PUT | `/api/equipment-models/:id` | admin | Atualiza modelo |
| DELETE | `/api/equipment-models/:id` | admin | Remove (bloqueado se em uso) |
| GET | `/api/sectors` | token | Lista com filtros: search, isActive, hasManager |
| GET | `/api/users` | admin | Lista com filtros: search, role, isActive, sector, noSector |
| GET | `/api/users/search-ad?q=termo` | admin | Busca usuários no AD por nome/username (mín. 2 chars) |
| POST | `/api/users/sync/:username` | admin | Sincroniza usuário individual com AD |
| POST | `/api/users/import-ad` | admin | Importa múltiplos usuários do AD `{ usernames: [] }` |
| POST | `/api/users/sync-ad-bulk` | admin | Sincroniza todos os usuários de uma OU `{ ouPath: "OU=..." }` |

---

## Middleware de Rotas

```js
// Sempre nesta ordem:
router.get('/admin-route', verifyToken, requireAdmin, controller)
router.get('/user-route',  verifyToken, controller)
```

---

## Visibilidade por Perfil

| Perfil | Acesso |
|--------|--------|
| admin | Tudo |
| user | Só seus equipamentos, equipamentos do seu setor e perfil |

---

## Convenções de Código

- **Arquivos JS:** `camelCase` | **Componentes React:** `PascalCase`
- Controllers delegam toda lógica aos services — nunca acessam o DB diretamente
- `async/await` + `try/catch` em todos os controllers
- Zod valida entrada antes de persistir no banco
- NUNCA expor senhas, tokens ou dados LDAP em logs ou respostas
- Comentários em **português** nos trechos complexos
- Usar `apiResponse.js` helpers em todos os controllers para padronizar respostas
- **Filtros nas páginas admin** sempre refletidos na URL via `useUrlFilters` (preserva estado no F5 e permite compartilhar links)
- **Toasts** em todas as operações CRUD via `toast.success/error/warning/info` de `@/store/toastStore`

---

## Variáveis de Ambiente

Arquivo: `server/.env` (nunca commitar — baseado no `.env.example` que foi removido do repo; variáveis abaixo)

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27018/patrimonio_ti
JWT_SECRET=seu_segredo_aqui
JWT_EXPIRES_IN=8h
LDAP_URL=ldaps://seu-ad-server:636
LDAP_BASE_DN=DC=empresa,DC=com,DC=br
LDAP_BIND_DN=CN=ServiceAccount,CN=Users,DC=empresa,DC=com,DC=br
LDAP_BIND_PASSWORD=senha_service_account
LDAP_USER_SEARCH_BASE=OU=Usuarios,DC=empresa,DC=com,DC=br
LDAP_DOMAIN=empresa.com.br
```

---

## Estado de Desenvolvimento

> Atualizado em: 2026-05-08

- [x] **Fase 1** — Scaffolding + Modelos + Config
- [x] **Fase 2** — Auth (LDAP + JWT) + Middleware
- [x] **Fase 3** — CRUD: Sectors, EquipmentTypes
- [x] **Fase 4** — CRUD: Equipment + lógica de vínculo
- [x] **Fase 5** — CRUD: Users + sincronização AD
- [x] **Fase 6** — Front-end: Auth + Layout + Rotas
- [x] **Fase 7** — Front-end: Telas Admin
- [x] **Fase 8** — Front-end: Telas Usuário Comum
- [x] **Fase 9** — Testes (back + front)
- [x] **Fase 10** — AuditLog + Polish final
- [x] **Fase 11** — Correções de bugs + remoção SectorType + login local
- [x] **Fase 12** — UX: busca global, filtros avançados, URL params, cards de resumo, toasts
- [x] **Fase 13** — EquipmentModel (POO: modelo como template, equipment como instância) + importação AD em lote
- [x] **Fase 14** — Refinamentos de negócio: filtros por feature, patrimônio obrigatório/único, série opcional, atribuição restrita a usuários ativos
- [x] **Fase 15** — Melhorias de UX/robustez: filtro LDAP só usuários, toast erro com timeout 6s, remoção purchaseDate, fix D-1 garantia, unicidade EquipmentModel, busca reativa de usuários no AssignForm, fechar modal ao clicar fora
- [x] **Fase 16** — AssignForm: campo vazio até digitar (hasSearched); extração automática de setor do DN do AD na importação (`ldapUtils.js`); `sectorsCreated` no resumo de importação

---

## Decisões Técnicas

### EquipmentModel — POO aplicado ao cadastro
- `EquipmentModel` funciona como a "classe" do equipamento: armazena brand, model, type, lot, garantia
- `Equipment` é a "instância": armazena apenas serialNumber, patrimonyNumber e referência ao modelo
- Ao selecionar o modelo no formulário, os dados herdados aparecem somente-leitura (feedback visual)
- `GET /api/equipment-models/all` retorna apenas modelos ativos — usado nos dropdowns do front-end
- A listagem paginada (`/api/equipment-models`) inclui `equipmentCount` via aggregation paralela
- Exclusão bloqueada se `Equipment.countDocuments({ equipmentModel: id }) > 0`
- Combinação `brand + model + type` possui índice único composto (case-insensitive, collation `pt` strength 2) — duplicatas retornam 409 `EQUIPMENT_MODEL_DUPLICATE`; verificação prévia também feita no service antes do `create`/`update`
- Campo `purchaseDate` removido do formulário e do schema Zod mas mantido no Mongoose para preservar dados históricos
- Script `migrate-equipment-model.js` converte registros antigos (brand/model diretos) para o novo schema

### Modal — fechar ao clicar no overlay
- O componente `Modal.jsx` captura `onClick` no backdrop e chama `onClose`
- `stopPropagation` no container interno impede que cliques dentro do modal propaguem para o backdrop
- Todos os modais do sistema usam `Modal.jsx` como base — comportamento é automático e consistente

### Importação de usuários do AD
- `ldapService.searchUsers(query)` faz busca parcial no AD (sAMAccountName, displayName, mail) sem autenticar o usuário — filtro restringe a `objectClass=person`, exclui `objectClass=computer` e contas terminadas em `$`; retorna `distinguishedName` de cada usuário
- `ldapService.getUsersByOU(ouPath)` busca **todos** os usuários de uma OU específica via `scope: sub` — mesmo filtro de exclusão de computadores; retorna `distinguishedName` de cada usuário
- `ldapService.findUser(username)` também retorna `distinguishedName` para uso na extração do setor
- `GET /api/users/search-ad?q=termo` — mín. 2 chars, retorna até 25 resultados
- `POST /api/users/import-ad { usernames[] }` — importa em lote por lista de usernames; usuários já existentes são atualizados; retorna `{ imported, updated, errors[] }`
- `POST /api/users/sync-ad-bulk { ouPath }` — sincroniza todos os usuários da OU (e sub-OUs); retorna `{ total, imported, updated, errors[] }`
- Ao importar um usuário **novo**, o `distinguishedName` do AD é parseado por `ldapUtils.extractSectorAcronym` para extrair a sigla do setor (ex: `GETIC` de `"...Centro Administrativo - GETIC,..."`). O setor é criado automaticamente se não existir, usando o nome completo como `description`. Usuários já existentes no banco **não têm o setor sobrescrito** na resincronização.
- `POST /api/users/import-ad` e `POST /api/users/sync-ad-bulk` retornam `sectorsCreated` no resumo
- `ADSyncModal.jsx` — modal com **duas abas**:
  - **"Buscar por nome"** — debounce 400ms, seleção múltipla, importação por usernames; exibe `sectorsCreated` no resumo
  - **"Importar por OU"** — campo DN, botão sincronizar, resumo com contagens, `sectorsCreated` e erros detalhados

### Extração de setor do DN do AD
- `server/utils/ldapUtils.js` fornece `extractSectorAcronym(dn)` e `extractSectorFullName(dn)`
- Regra: percorre os segmentos `OU=` do DN do mais específico ao mais geral e retorna a sigla após ` - ` na primeira OU que contiver o padrão (regex `/\s-\s([A-Z0-9]+)\s*$/`)
- Exemplo: `OU=Gerência de TI - GETIC,...` → sigla `GETIC`, nome `Gerência de TI`
- `userService.findOrCreateSectorFromDN(dn)` usa o utilitário para encontrar ou criar o setor automaticamente, retornando o `_id`
- A atribuição ocorre **somente na criação** do usuário (`$setOnInsert`); sincronizações posteriores não sobrescrevem setores definidos manualmente

### Auth — Login local (fallback LDAP)
- `authController` tenta LDAP primeiro; se falhar, verifica `localPassword` (bcrypt) no MongoDB
- Permite conta `admin` local para desenvolvimento sem depender do AD
- Criada via `node seed-admin.js` na pasta `server/`
- Credenciais do admin local: `admin` / `Admin@1234`

### LDAP com LDAPS (SSL interno)
- `ldapService` usa `tlsOptions: { rejectUnauthorized: false }` — necessário para certificados de CA interna (SEASC)
- Erros de conectividade LDAP retornam HTTP 503 com mensagem amigável em vez de 500

### Interceptor Axios — 401
- O interceptor de 401 **não redireciona** para `/login` quando a requisição veio do endpoint `/auth/login`
- Evita loop: login falho não recarregava a página silenciosamente

### SectorType — Removido
- O conceito não era necessário para o negócio
- `Sector` passou a ter apenas: `name`, `description`, `manager`, `isActive`
- Todos os arquivos relacionados foram deletados (model, controller, service, routes, página e service front)

### Validação e exibição de datas
- Schema Zod usa `z.preprocess` para converter string `YYYY-MM-DD` em `new Date(`${val}T12:00:00.000Z`)` — meio-dia UTC evita o problema D-1 (JS interpreta `YYYY-MM-DD` como meia-noite UTC, que no fuso UTC-3 vira o dia anterior)
- String vazia é convertida para `null` antes da validação
- Aplicado em `EquipmentModel` (`warrantyExpiry`)
- `formatDate` em `formatters.js` usa `{ timeZone: 'UTC' }` para exibir a data sem conversão de fuso

### Filtros via URL (useUrlFilters)
- Hook `useUrlFilters` gerencia query params da URL como fonte de verdade dos filtros
- Estado sobrevive a F5 e permite compartilhar links filtrados
- Exemplo: `/admin/equipment?status=available&page=2`

### Filtros por feature no lugar da busca global
- Cada listagem (Equipamentos, Usuários, Setores, Modelos) possui sua própria barra de busca inline conectada ao param `search` via `useUrlFilters`
- A rota `GET /api/search` e os arquivos `GlobalSearch.jsx`, `searchController.js` e `search.routes.js` foram removidos
- Equipment: busca por serialNumber, patrimonyNumber ou via EquipmentModel (brand/model/lot)
- EquipmentModels: busca por brand, model ou lot (suportado pelo `equipmentModelService.list`)

### serialNumber opcional com índice sparse
- `serialNumber` removido como obrigatório — periféricos ou equipamentos sem etiqueta podem ser cadastrados sem ele
- Índice `sparse: true` garante unicidade apenas quando o campo está presente, permitindo múltiplos documentos sem serialNumber

### patrimonyNumber obrigatório e único
- Identificador físico do bem (plaqueta) — não pode se repetir
- Duplicatas retornam HTTP 409 com código `PATRIMONY_NUMBER_DUPLICATE`
- Antes de aplicar o índice em banco existente, verificar duplicatas via aggregation: `db.equipments.aggregate([{$group:{_id:"$patrimonyNumber",count:{$sum:1}}},{$match:{count:{$gt:1}}}])`

### Atribuição restrita a usuários ativos
- `equipmentService.assign` verifica `isActive: true` antes de vincular ao usuário; retorna HTTP 422 com `USER_INACTIVE` se desativado
- Front-end usa `isActive=true` no parâmetro da busca reativa do AssignForm — usuários inativos nunca aparecem na lista

### Cards de resumo clicáveis
- Equipment: total, disponível, atribuído, manutenção, desativado — cada card aplica filtro de status
- Users: total, ativos, inativos, sem setor — cada card aplica o filtro correspondente
- Sectors: total, ativos, inativos
- Contagens carregadas com `Promise.all` de chamadas com `limit=1`

### Contagens nos Setores
- `sectorService.list` roda aggregation paralela para contar usuários e equipamentos por setor
- Retornado como `userCount` e `equipmentCount` em cada objeto do array

### Ordenação de Equipamentos
- `equipmentService.list` aceita params `sort` (campo) e `sortDir` (`asc`|`desc`)
- Colunas clicáveis no header da tabela alternam direção via URL params

### Toasts
- `toast.success/error/warning/info` disponível em qualquer lugar via `useToastStore.getState()`
- Erros (`toast.error`) têm auto-dismiss de **6 segundos** (antes: sem auto-dismiss). O usuário ainda pode fechar manualmente antes disso.
- Máximo 3 toasts empilhados (os mais antigos são descartados)
- Posição: topo-direito

### AssignForm — Busca reativa de usuários + Transferência
- O campo começa **vazio** com mensagem orientadora ("Digite o nome ou usuário para buscar...") — nenhuma chamada à API ao abrir o modal
- Após digitar ≥1 caractere, chama `GET /api/users?search=&isActive=true&limit=20` com debounce 300ms
- Estado `hasSearched` distingue "ainda não buscou" (mostra dica) de "buscou mas não encontrou" (mostra "Nenhum usuário encontrado")
- Setores ainda usam autocomplete em memória (são poucos e carregados na abertura da página)
- Se o equipamento já está vinculado, exibe alerta de transferência e muda label do botão para "Transferir"
- Botão separado "Transferir" (ícone `ArrowRightLeft`) aparece na linha quando o equipamento está vinculado

### ProtectedRoute — dois exports
- `ProtectedRoute` (export nomeado) — rota autenticada para qualquer usuário
- `AdminRoute` (export nomeado) — rota restrita a `role === 'admin'`
- Ambos renderizam `<Layout>` com o `<Outlet>` dentro

---

## Problemas Encontrados e Resoluções

| Problema | Resolução |
|----------|-----------|
| Rota `GET /users/me/equipment` colidia com `GET /users/:id` | Declarada antes da rota parametrizada no router |
| `errorHandler` não capturava duplicate key (11000) como `SERIAL_NUMBER_DUPLICATE` | Adicionado tratamento explícito do `err.code === 11000` no middleware |
| Re-atribuição direta de equipamento sem fechar histórico | `assign` verifica `assignedTo \|\| assignedSector` antes de sobrescrever e encerra histórico automaticamente |
| Zustand store acessado fora de componente React | Usado `useAuthStore.getState()` / `useToastStore.getState()` — Zustand suporta acesso fora do React |
| Login LDAP retornava 401 e o interceptor redirecionava para /login silenciosamente | Interceptor ignora 401 quando a URL contém `/auth/login` |
| Certificado SSL do AD (LDAPS) rejeitado pelo Node.js | `tlsOptions: { rejectUnauthorized: false }` no cliente `ldapts` |
| Datas no formato `YYYY-MM-DD` rejeitadas pelo Zod (`datetime({ offset: true })`) | Substituído por `z.preprocess` + regex `^\d{4}-\d{2}-\d{2}$` |
| `POPULATE_SECTOR` no `userService` ainda referenciava `type` do SectorType removido | Simplificado para `{ path: 'sector', select: 'name' }` |
| `equipment.test.js` importava `SectorType` (modelo removido) e usava campos `brand`/`model` diretos | Reescrito para usar `EquipmentModel` como referência; Sector criado sem campo `type` |
| Login falha com erro de conectividade LDAP sem mensagem clara | Adicionado `isLdapConnError` em `userController` retornando HTTP 503 com mensagem amigável |
| Script para testar autenticação LDAP de forma isolada | Criado `server/test-ldap.js` — executa 4 etapas: bind service account, busca usuário, bind usuário, resumo |
| Login retornava "Não foi possível autenticar" + ECONNREFUSED no proxy Vite | Causa raiz: MongoDB não estava rodando + `.env` usava porta 27017 mas `mongod.cfg` configurado em 27018. Corrigido: `.env` atualizado para porta 27018; MongoDB iniciado manualmente. Ver seção "MongoDB — Configuração e Inicialização" |
| Sem mecanismo para importar todos os usuários de uma OU de uma vez | Implementado `ldapService.getUsersByOU`, `userService.syncBulkFromAD`, `POST /api/users/sync-ad-bulk` e aba "Importar por OU" no `ADSyncModal.jsx` |

---

## Comandos Úteis

```bash
# Instalar dependências
cd server && npm install
cd client && npm install

# Criar usuário admin local (primeira vez ou reset de senha)
cd server && node seed-admin.js
# Login: admin / Admin@1234

# Migrar equipamentos antigos para o novo schema (rodar uma única vez)
cd server && node migrate-equipment-model.js

# Diagnosticar conexão LDAP (util para debug em producao)
cd server && node test-ldap.js <username> "<senha>"
# Exemplo: node test-ldap.js hector.dallacosta "MinhaSenha@123"
# Executa 4 etapas: bind service account, busca usuario, valida senha, exibe atributos

# Rodar em dev (dois terminais)
cd server && npm run dev      # porta 5000 (nodemon)
cd client && npm run dev      # porta 5173 (vite)

# Testes
cd server && npm test
cd client && npm test

# Build producao
cd client && npm run build
```

---

## MongoDB — Configuração e Inicialização

> Atualizado em 2026-05-06 após diagnóstico de falha no login.

**Instalação:** MongoDB 8.2 em `C:\Program Files\MongoDB\Server\8.2\`
**Config:** `C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg`
**Porta configurada:** **27018** (não 27017 — atenção ao `.env`)
**Data dir:** `C:\Program Files\MongoDB\Server\8.2\data`
**Log:** `C:\Program Files\MongoDB\Server\8.2\log\mongod.log`

### Por que porta 27018?
O `mongod.cfg` instalado tem `net.port: 27018`. O `.env` foi corrigido para usar essa porta.
Antes o `.env` apontava para 27017 (porta padrão), causando `ECONNREFUSED` ao iniciar o servidor Node.

### O MongoDB NÃO está registrado como serviço do Windows
Precisa ser iniciado manualmente a cada reinicialização. Para iniciar:

```powershell
# Iniciar MongoDB (PowerShell normal, sem admin)
Start-Process -FilePath "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" `
  -ArgumentList "--dbpath `"C:\Program Files\MongoDB\Server\8.2\data`" --port 27018 --bind_ip 127.0.0.1 --logpath `"C:\Users\hector.dallacosta\mongod.log`" --logappend" `
  -WindowStyle Hidden
```

### Registrar como serviço (fazer UMA vez como Administrador)
Abrir PowerShell **como Administrador** e executar:

```powershell
& "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --config "C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg" --install --serviceName MongoDB --serviceDisplayName "MongoDB Server 8.2"
Start-Service MongoDB
Set-Service MongoDB -StartupType Automatic
```

Após isso, o MongoDB sobe automaticamente com o Windows e os comandos manuais não são mais necessários.

### Verificar se MongoDB está rodando
```powershell
netstat -ano | Select-String ":27018"
# Deve mostrar linha com LISTENING na porta 27018
```
