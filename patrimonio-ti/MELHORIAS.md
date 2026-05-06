# Relatório de Melhorias — Sistema de Gestão de Patrimônio de TI

> **Versão:** 1.1
> **Data original:** 05/05/2026
> **Atualizado em:** 06/05/2026 — checklist de status adicionado após revisão do código
> **Objetivo:** Reestruturação do cadastro de equipamentos e sincronização de usuários

---

## Status Geral

| Tópico | Descrição | Status |
|--------|-----------|--------|
| 1 | POO: Equipamentos como instâncias de modelos | ✅ Concluído |
| 2 | Seleção de modelo via dropdown/autocomplete | ✅ Concluído |
| 3 | Separação: cadastro de modelo x equipamento | ✅ Concluído |
| 4 | Templates pré-cadastrados com injeção de patrimônio | ✅ Concluído |
| 5.1 | Botão "Sincronizar com AD" + modal de busca/importação | ✅ Concluído |
| 5.2 | Importação em lote por lista de usernames | ✅ Concluído |
| 5.2 | Sincronização em lote por OU inteira | ✅ Concluído |
| 5.3 | Back-end: `searchUsers`, `import-ad` | ✅ Concluído |
| 5.3 | Back-end: `sync-ad-bulk` por OU | ✅ Concluído |
| 5.4 | Front-end: ADSyncModal, userService client | ✅ Concluído |

---

## Checklist Detalhado

### Tópico 1 — POO: Equipamentos como Instâncias de Modelos

- [x] Criar entidade `EquipmentModel` como "classe" do equipamento
- [x] Simplificar `Equipment` para conter apenas `serialNumber`, `patrimonyNumber` e referência a `EquipmentModel`
- [x] Remover campos `brand`, `model`, `type`, `purchaseDate`, `warrantyExpiry` do registro individual de equipamento
- [x] Garantir que atualizações no `EquipmentModel` reflitam em todos os equipamentos vinculados (via populate)

---

### Tópico 2 — Seleção de Modelo via Lista Suspensa

- [x] Substituir campos de texto livre (marca, modelo) por dropdown/autocomplete no formulário de equipamento
- [x] Exibir modelos no formato `"Marca Modelo — Lote"` (ex: `Dell OptiPlex — SEA 1212/2026`)
- [x] Ao selecionar o modelo, exibir campos herdados (tipo, marca, modelo, garantia, lote) como somente-leitura
- [x] Endpoint `GET /api/equipment-models/all` para alimentar o dropdown com todos os modelos ativos

---

### Tópico 3 — Separação: Cadastro de Modelo x Cadastro de Equipamento

- [x] Criar página dedicada para CRUD de modelos de equipamento (`/admin/equipment-models`)
- [x] Link para a página de modelos no Sidebar
- [x] Formulário de equipamento simplificado: seleção do modelo + série + patrimônio
- [x] Validação: bloquear exclusão de `EquipmentModel` se houver `Equipment` vinculado (`EQUIPMENT_MODEL_IN_USE`)

---

### Tópico 4 — Templates Pré-Cadastrados com Injeção de Patrimônio

- [x] `EquipmentModel` armazena: tipo, marca, modelo, lote/processo, data de compra, garantia, observações, `isActive`
- [x] `EquipmentModel` com `isActive: false` não aparece no dropdown de novo equipamento
- [x] Listagem de modelos com contagem de equipamentos vinculados (`equipmentCount` via aggregation)
- [x] Script de migração `migrate-equipment-model.js` para converter equipamentos existentes ao novo schema
- [x] Filtros na listagem de modelos: tipo, busca textual (marca/modelo/lote), status ativo/inativo

---

### Tópico 5 — Sincronização de Usuários com Active Directory

#### 5.1 — Botão "Sincronizar com AD" e Modal
- [x] Botão "Sincronizar com AD" na página `Users.jsx`
- [x] `ADSyncModal.jsx` com campo de busca (mín. 2 caracteres, debounce 400ms)
- [x] Resultados do AD exibem: nome, username, departamento, email
- [x] Seleção múltipla de usuários para importação
- [x] Resumo pós-importação: X importados, Y atualizados, Z com erro
- [x] Tratamento de LDAP indisponível com mensagem amigável

#### 5.2 — Importação em Lote
- [x] `POST /api/users/import-ad { usernames: [] }` — importa lista de usernames do AD
- [x] Usuários já existentes são atualizados em vez de duplicados
- [x] Resposta retorna `{ imported, updated, errors[] }`
- [x] Sincronização em lote por OU inteira — `POST /api/users/sync-ad-bulk { ouPath }`

#### 5.3 — Alterações no Back-end
- [x] `ldapService.searchUsers(query)` — busca parcial por sAMAccountName, displayName, mail (até 25 resultados)
- [x] `ldapService.getUsersByOU(ouPath)` — retorna todos os usuários de uma OU e suas sub-OUs
- [x] `POST /api/users/import-ad` — importa usuários por array de usernames
- [x] `POST /api/users/sync-ad-bulk { ouPath }` — sincroniza todos da OU; retorna `{ total, imported, updated, errors[] }`
- [x] `POST /api/users/sync/:username` — sincroniza usuário individual com AD
- [x] `GET /api/users/search-ad?q=termo` — busca usuários no AD (mín. 2 chars)
- [x] `userService.syncBulkFromAD(ouPath, performedBy, ip)` — lógica de upsert em lote
- [x] Novas rotas registradas com `verifyToken + requireAdmin`

#### 5.4 — Alterações no Front-end
- [x] `Users.jsx` — botão "Sincronizar com AD" abre `ADSyncModal`
- [x] `ADSyncModal.jsx` — modal com **duas abas**: "Buscar por nome" (seleção manual) e "Importar por OU" (bulk)
- [x] `client/src/services/userService.js` — métodos `searchADUsers`, `importUsersFromAD` e `syncADBulk(ouPath)`

#### 5.5 — Fluxo de Uso (Implementado)
- [x] Admin acessa tela de Usuários
- [x] Clica em "Sincronizar com AD"
- [x] Digita nome ou username no modal
- [x] Sistema consulta AD e exibe resultados em tempo real
- [x] Admin seleciona usuários e clica em "Importar"
- [x] Usuários aparecem na lista e ficam disponíveis para atribuição de equipamentos e setor

---

---

## Sumário Executivo (original)

Este relatório apresenta 5 propostas de melhoria para o Sistema de Gestão de Patrimônio de TI. Os tópicos 1 a 4 tratam da reestruturação do fluxo de cadastro de equipamentos, separando o conceito de **modelo de equipamento** do **equipamento físico individual**. O tópico 5 aborda a necessidade de sincronização manual de usuários com o Active Directory antes do primeiro login.

---

## Situação Atual (na data de escrita — 05/05/2026)

O sistema possuía a seguinte estrutura para equipamentos:

- **EquipmentType** — categorias genéricas (Desktop, Notebook, Impressora, Telefone)
- **Equipment** — equipamento individual com todos os campos: tipo, marca, modelo, nº série, nº patrimônio, garantia, etc.

O formulário exigia preenchimento manual de todos os campos a cada novo equipamento, mesmo quando vários compartilhavam a mesma marca, modelo, garantia e lote.

Quanto aos usuários, o sistema só criava o registro no MongoDB após o primeiro login via LDAP.

> **Nota:** Esta situação foi resolvida com a implementação dos Tópicos 1–4 e 5.1–5.4. Ver checklist acima para status atual.

---

## Análise de Impacto

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Cadastro de lote (50 unidades) | 50x preenchimento completo (7+ campos) | 1 modelo + 50x (2 campos cada) |
| Consistência de dados | Sujeita a erros de digitação | Garantida via referência ao modelo |
| Atualização de garantia | Atualizar 50 registros individuais | Atualizar 1 modelo (reflete em todos) |
| Rastreabilidade por lote | Não disponível | Filtrar equipamentos por modelo/lote |
| Atribuição a novos usuários | Usuário precisa logar antes | Admin importa do AD a qualquer momento |
| Onboarding de departamento inteiro | Impossível sem logins individuais | ✅ Admin informa o DN da OU e todos os usuários são importados de uma vez |
