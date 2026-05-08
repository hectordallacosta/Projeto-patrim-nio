# MELHORIAS DO SISTEMA — Patrimônio de TI

> Gerado em: 2026-05-08
> Este arquivo descreve as melhorias a serem implementadas no sistema.
> Cada item contém: descrição, arquivos afetados e instruções precisas de implementação.

---

## Melhoria 1 — Filtro de `objectClass=user` na Sincronização com AD

**Problema:** A sincronização com o AD está importando objetos do tipo `computer` (e possivelmente outros), além de usuários, causando erros no processo de importação.

**Causa raiz:** O filtro LDAP em `ldapService.js` usa apenas `(sAMAccountName=*)`, que retorna qualquer objeto com esse atributo — incluindo contas de computador (que terminam com `$`).

**Arquivos afetados:**
- `server/services/ldapService.js`

**O que fazer:**

Nos métodos `searchUsers` e `getUsersByOU`, alterar o filtro LDAP para restringir exclusivamente a `objectClass=person` (usuários humanos) e excluir contas de computador:

```js
// searchUsers — trocar o filtro de:
filter: `(&(objectClass=user)(|(sAMAccountName=*${query}*)(displayName=*${query}*)(mail=*${query}*)))`
// para:
filter: `(&(objectClass=person)(!(objectClass=computer))(!(sAMAccountName=*$))(|(sAMAccountName=*${query}*)(displayName=*${query}*)(mail=*${query}*)))`

// getUsersByOU — trocar o filtro de:
filter: `(&(objectClass=user)(sAMAccountName=*))`
// para:
filter: `(&(objectClass=person)(!(objectClass=computer))(!(sAMAccountName=*$))(sAMAccountName=*))`
```

**Critério de aceite:**
- Sincronização via "Buscar por nome" retorna apenas usuários humanos.
- Sincronização via "Importar por OU" não importa nenhum objeto com `$` no `sAMAccountName`.
- O campo `errors[]` no retorno não exibe mais falhas causadas por objetos do tipo computador.

---

## Melhoria 2 — Toast de erro com tempo limitado de exibição (6 segundos)

**Problema:** O toast de erro (`toast.error`) não tem auto-dismiss — o usuário precisa fechá-lo manualmente para sempre, o que polui a interface em caso de múltiplos erros consecutivos.

**Decisão:** Aplicar auto-dismiss de **6 segundos** para toasts de erro, mantendo o comportamento padrão dos demais tipos (`success`, `warning`, `info`), que já têm auto-dismiss.

**Arquivos afetados:**
- `client/src/store/toastStore.js`
- `client/src/components/shared/Toaster.jsx`

**O que fazer:**

Em `toastStore.js`, alterar a configuração do tipo `error` para incluir `duration: 6000` (ou equivalente ao padrão dos outros tipos). Exemplo:

```js
// Antes: erro sem auto-dismiss
error: (message) => addToast({ type: 'error', message })

// Depois: erro com auto-dismiss de 6 segundos
error: (message) => addToast({ type: 'error', message, duration: 6000 })
```

Em `Toaster.jsx`, garantir que o `useEffect` que remove o toast leia a propriedade `duration` de cada toast individualmente (em vez de usar um valor fixo global), para que o `error` use 6000ms e os outros usem o valor padrão já existente.

**Critério de aceite:**
- Toast de erro desaparece automaticamente após 6 segundos.
- O usuário ainda pode fechar manualmente antes dos 6 segundos.
- Os outros tipos de toast (`success`, `warning`, `info`) continuam com o tempo de exibição anterior.

---

## Melhoria 3 — Remover campo "Data de Compra" do cadastro de Modelo de Equipamento

**Problema:** O campo `purchaseDate` no formulário de cadastro/edição de Modelo de Equipamento não agrega valor ao contexto de modelo (template), pois a data de compra é específica de cada lote/instância, não do modelo em si.

**Arquivos afetados:**
- `client/src/pages/admin/EquipmentModels.jsx`
- `server/controllers/equipmentModelController.js`
- `server/services/equipmentModelService.js`
- `server/models/EquipmentModel.js` *(opcional — manter o campo no schema para não quebrar dados existentes, apenas não expô-lo no formulário)*

**O que fazer:**

No front-end (`EquipmentModels.jsx`):
- Remover o campo `<input type="date">` e seu label referente a `purchaseDate` do formulário de criação e edição.
- Remover `purchaseDate` do estado inicial do formulário e do payload enviado ao back-end.

No back-end (`equipmentModelController.js` e `equipmentModelService.js`):
- Remover `purchaseDate` da validação Zod do body de criação/edição.
- Remover `purchaseDate` do objeto de atualização no service.
- **Não remover o campo do schema Mongoose** — dados existentes devem ser preservados.

**Critério de aceite:**
- O formulário "Novo Modelo de Equipamento" e "Editar Modelo" não exibem mais o campo Data de Compra.
- Registros existentes que possuem `purchaseDate` não são afetados.
- A validação Zod não rejeita um body sem `purchaseDate`.

---

## Melhoria 4 — Correção do cálculo de Data de Garantia (problema D-1)

**Problema:** A data de garantia está sendo exibida/salva com um dia a menos do que o inserido. Ao salvar `2025-12-31`, o sistema exibe `2025-12-30`. Isso ocorre porque ao converter a string `YYYY-MM-DD` para objeto `Date` do JavaScript sem especificar timezone, o JS interpreta como UTC meia-noite (`2025-12-31T00:00:00Z`), que ao ser exibido no fuso horário do Brasil (UTC-3) vira `2025-12-30T21:00:00`.

**Arquivos afetados:**
- `server/models/EquipmentModel.js` *(pré-processamento ao salvar)*
- `server/services/equipmentModelService.js` *(conversão de data)*
- `client/src/pages/admin/EquipmentModels.jsx` *(exibição da data)*
- `client/src/utils/formatters.js` *(função de formatação de data, se existir)*

**O que fazer:**

**No back-end:** Ao converter a string `YYYY-MM-DD` para `Date` antes de salvar no MongoDB, usar a representação de meio-dia UTC ou, preferencialmente, armazenar a string pura e converter apenas na exibição. A solução mais simples e robusta é ajustar o `z.preprocess` do Zod para criar o Date com horário `T12:00:00.000Z` (meio-dia UTC), eliminando o problema de fuso:

```js
// Em equipmentModelService.js ou no schema Zod, trocar:
new Date(val)
// por:
new Date(`${val}T12:00:00.000Z`)
```

**No front-end:** Garantir que a função de formatação de data (em `formatters.js`) use `toLocaleDateString` com `timeZone: 'UTC'` para evitar que o UTC meia-noite seja convertido para o dia anterior:

```js
// Em formatters.js
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
```

**Critério de aceite:**
- Cadastrar garantia como `31/12/2025` → salva e exibe `31/12/2025`.
- O último dia do mês/ano é contabilizado corretamente.
- Datas já cadastradas com o problema de D-1 devem ser corrigidas manualmente via script de migração (opcional — documentar a necessidade).

---

## Melhoria 5 — Unicidade de Modelo de Equipamento (sem duplicatas)

**Problema:** O sistema permite cadastrar múltiplos `EquipmentModel` com a mesma combinação de `brand` + `model` + `type`, gerando duplicatas que confundem o usuário na hora de vincular equipamentos.

**Arquivos afetados:**
- `server/models/EquipmentModel.js`
- `server/services/equipmentModelService.js`
- `server/controllers/equipmentModelController.js`
- `server/middleware/errorHandler.js` *(para tratar erro de duplicate key)*

**O que fazer:**

**No model Mongoose (`EquipmentModel.js`):** Adicionar índice único composto para `brand` + `model` + `type`:

```js
EquipmentModelSchema.index(
  { brand: 1, model: 1, type: 1 },
  { unique: true, collation: { locale: 'pt', strength: 2 } } // case-insensitive
);
```

**No service (`equipmentModelService.js`):** Na operação de criação e de atualização, antes de persistir, verificar se já existe um documento com a mesma combinação (excluindo o próprio registro na edição):

```js
// Verificação no create:
const exists = await EquipmentModel.findOne({ brand, model, type });
if (exists) throw { code: 'EQUIPMENT_MODEL_DUPLICATE', status: 409 };

// Verificação no update (excluir o próprio ID):
const exists = await EquipmentModel.findOne({ brand, model, type, _id: { $ne: id } });
if (exists) throw { code: 'EQUIPMENT_MODEL_DUPLICATE', status: 409 };
```

**No errorHandler (`errorHandler.js`):** Adicionar tratamento do código Mongoose `11000` para o índice único de `EquipmentModel`, retornando mensagem amigável:

```js
if (err.code === 11000 && err.keyPattern?.brand) {
  return res.status(409).json(apiError('Já existe um modelo com esta combinação de marca, modelo e tipo.', 'EQUIPMENT_MODEL_DUPLICATE'));
}
```

**No front-end (`EquipmentModels.jsx`):** Exibir toast de erro com a mensagem retornada pelo back-end quando o status for `409`.

**Critério de aceite:**
- Tentar criar `{ brand: "Dell", model: "Optiplex 3000", type: "Desktop" }` duas vezes retorna erro `409` na segunda tentativa.
- A mensagem de erro é clara e amigável no toast.
- A verificação é case-insensitive (Dell e dell são considerados iguais).
- A edição de um modelo não é bloqueada pela própria combinação existente.

**Código de erro a adicionar no CLAUDE.md:**
```
EQUIPMENT_MODEL_DUPLICATE
```

---

## Melhoria 6 — Campo de busca para filtrar usuários no modal "Vincular Equipamento"

**Problema:** A lista de usuários no formulário/modal de vinculação de equipamento não tem paginação nem campo de busca, tornando impossível encontrar um usuário específico quando há muitos registros.

**Contexto:** O `AssignForm` já possui um campo de busca em memória segundo o CLAUDE.md ("Campo de busca filtra a lista de usuários/setores em memória enquanto digita"), mas aparentemente o filtro não está funcionando adequadamente ou a lista não é carregada com todos os usuários.

**Arquivos afetados:**
- `client/src/pages/admin/Equipment.jsx` *(modal/form de vinculação)*
- `client/src/services/userService.js` *(busca de usuários com parâmetro `search`)*
- `server/controllers/userController.js` *(já suporta `?search=`)*

**O que fazer:**

Substituir o carregamento em memória por busca reativa via API:

1. **No componente de vinculação** (AssignForm ou modal dentro de `Equipment.jsx`):
   - Adicionar um `<input type="text" placeholder="Buscar usuário..." />` visível acima da lista.
   - Usar o hook `useDebounce` (já existente, 300ms) no valor do input.
   - A cada mudança no termo debounced, chamar `GET /api/users?search=<termo>&isActive=true&limit=20`.
   - Exibir os resultados como lista clicável (substituindo a lista estática em memória).
   - Mostrar nome (`displayName`) e setor (`sector.name`) de cada usuário na lista.

2. **No `userService.js` do front-end:** Garantir que a função de listagem aceite o parâmetro `search` e o repasse ao Axios.

3. **No back-end:** O endpoint `GET /api/users` já suporta `?search=` — nenhuma alteração necessária.

**Comportamento esperado:**
- Ao abrir o modal de vinculação, exibir os primeiros 20 usuários ativos.
- Ao digitar no campo de busca, filtrar por nome/username via API (debounce 300ms).
- A lista atualiza automaticamente conforme o usuário digita.
- Nenhuma paginação adicional necessária (limite de 20 por busca é suficiente).

**Critério de aceite:**
- Campo de busca visível e funcional no modal de vinculação.
- Digitar "ana" retorna apenas usuários cujo nome ou username contém "ana".
- A busca é case-insensitive.
- A lista nunca carrega todos os usuários de uma vez (evita travamento com centenas de registros).

---

## Melhoria 7 — Fechar modal ao clicar fora (overlay click)

**Problema:** Clicar fora de qualquer modal/caixa de cadastro (ex.: Vincular Equipamento, Novo Modelo, Novo Setor etc.) não fecha o modal. O usuário é obrigado a clicar explicitamente em "Cancelar" ou no botão "X".

**Arquivos afetados:**
- `client/src/components/shared/Modal.jsx` *(componente base de modal)*

**O que fazer:**

No componente `Modal.jsx`, o overlay (div de fundo escuro) deve capturar o evento `onClick` e chamar o `onClose`. Para evitar que o clique dentro do conteúdo do modal propague e feche o modal acidentalmente, usar `stopPropagation` no container interno:

```jsx
// Estrutura do Modal.jsx
<div
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
  onClick={onClose}          // ← fecha ao clicar no overlay
>
  <div
    className="relative bg-white rounded-lg shadow-xl ..."
    onClick={(e) => e.stopPropagation()}  // ← impede fechar ao clicar dentro
  >
    {children}
  </div>
</div>
```

Adicionalmente, garantir que todos os modais do sistema utilizem o componente `Modal.jsx` centralizado (e não implementações inline com div), para que a correção se propague automaticamente.

**Critério de aceite:**
- Clicar no overlay escuro fecha o modal (equivalente a clicar em "Cancelar").
- Clicar dentro do conteúdo do modal (formulário, botões, inputs) não fecha o modal.
- O comportamento é consistente em todos os modais: Vincular Equipamento, Novo/Editar Modelo, Novo/Editar Setor, Novo/Editar Usuário, Novo/Editar Equipamento, ConfirmDialog.
- Se o modal tiver dados não salvos, o comportamento de fechar ao clicar fora deve ser idêntico ao de clicar em "Cancelar" (sem confirmação adicional, a menos que já exista lógica de dirty-state).

---

## Resumo das Alterações por Arquivo

| Arquivo | Melhorias |
|---------|-----------|
| `server/services/ldapService.js` | #1 — Filtro LDAP só usuários |
| `client/src/store/toastStore.js` | #2 — Duration 6s no toast de erro |
| `client/src/components/shared/Toaster.jsx` | #2 — Ler `duration` por toast |
| `client/src/pages/admin/EquipmentModels.jsx` | #3 — Remover campo purchaseDate; #5 — Toast 409 |
| `server/controllers/equipmentModelController.js` | #3 — Remover purchaseDate do Zod; #5 — Erro 409 |
| `server/services/equipmentModelService.js` | #3 — Remover purchaseDate; #4 — Data T12:00Z; #5 — Verificar duplicata |
| `server/models/EquipmentModel.js` | #5 — Índice único composto |
| `server/middleware/errorHandler.js` | #5 — Tratar duplicate key de EquipmentModel |
| `client/src/utils/formatters.js` | #4 — formatDate com timeZone UTC |
| `client/src/pages/admin/Equipment.jsx` | #6 — Busca reativa de usuários no AssignForm |
| `client/src/services/userService.js` | #6 — Parâmetro search no list |
| `client/src/components/shared/Modal.jsx` | #7 — Fechar ao clicar no overlay |

---

## Atualizações no CLAUDE.md

Após implementar as melhorias acima, atualizar as seguintes seções do `CLAUDE.md`:

**Seção "Regras de Negócio Críticas"** — adicionar:
> 11. **EquipmentModel:** combinação `brand + model + type` deve ser única no sistema (índice composto, case-insensitive). Retorna `EQUIPMENT_MODEL_DUPLICATE` (409) em caso de duplicata.

**Seção "Códigos de Erro"** — adicionar:
```
EQUIPMENT_MODEL_DUPLICATE
```

**Seção "Decisões Técnicas"** — adicionar subseção:
> **Datas — timezone UTC** Todas as datas do tipo `YYYY-MM-DD` são salvas com horário `T12:00:00.000Z` para evitar o problema de D-1 causado pela conversão UTC → fuso local no front-end. A função `formatDate` em `formatters.js` usa `{ timeZone: 'UTC' }` na exibição.

**Seção "Toasts"** — atualizar:
> Erros (`toast.error`) têm auto-dismiss de **6 segundos** (antes: sem auto-dismiss). O usuário ainda pode fechar manualmente antes disso.

**Seção "Fase de Desenvolvimento"** — adicionar:
> - [ ] **Fase 14** — Melhorias de UX/robustez: filtro LDAP só usuários, toast erro com timeout, remoção purchaseDate, fix D-1 garantia, unicidade EquipmentModel, busca de usuários no AssignForm, fechar modal ao clicar fora
