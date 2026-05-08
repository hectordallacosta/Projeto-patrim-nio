# MELHORIAS DO SISTEMA — Rodada 2

> Gerado em: 2026-05-08
> Este arquivo descreve as melhorias a serem implementadas no sistema.
> Cada item contém: descrição, arquivos afetados e instruções precisas de implementação.

---

## Melhoria 1 — Remover lista inicial de usuários no AssignForm (campo vazio até digitar)

**Problema:** Ao abrir o modal "Vincular Equipamento" e clicar no campo de usuário, o sistema exibe uma lista limitada pré-carregada de usuários. Com a busca reativa via API já implementada, essa lista inicial não faz mais sentido — ela é incompleta, confusa e pode induzir o usuário a selecionar sem perceber que existem mais opções.

**Comportamento atual:** Ao focar o campo de usuário, exibe os primeiros N usuários carregados em memória ou via chamada sem filtro.

**Comportamento esperado:** O campo deve exibir um estado vazio com uma dica de texto (`placeholder`) orientando o usuário a digitar. A lista de resultados só aparece após o usuário digitar pelo menos 1 caractere, disparando a busca reativa.

**Arquivos afetados:**
- `client/src/pages/admin/Equipment.jsx` *(AssignForm ou subcomponente de vinculação)*

**O que fazer:**

1. **Remover qualquer `useEffect` ou chamada inicial** que carrega a lista de usuários ao abrir o modal/form (ex.: `fetchUsers()` sem parâmetro de busca).

2. **Definir o estado inicial da lista de usuários como `[]`** (array vazio) — não realizar nenhuma chamada à API até que o usuário comece a digitar.

3. **Adicionar um estado de controle `hasSearched`** (booleano, inicia como `false`) para distinguir entre "ainda não buscou" e "buscou mas não encontrou":

```jsx
const [userSearch, setUserSearch] = useState('');
const [userResults, setUserResults] = useState([]);
const [hasSearched, setHasSearched] = useState(false);

// No efeito de busca com debounce:
useEffect(() => {
  if (!debouncedSearch) {
    setUserResults([]);
    setHasSearched(false);
    return;
  }
  setHasSearched(true);
  // chamar GET /api/users?search=<debouncedSearch>&isActive=true&limit=20
}, [debouncedSearch]);
```

4. **Renderização condicional da lista:**

```jsx
{/* Nenhuma busca ainda — exibir dica */}
{!hasSearched && (
  <p className="text-sm text-gray-400 px-3 py-2">
    Digite o nome ou usuário para buscar...
  </p>
)}

{/* Buscou mas não encontrou */}
{hasSearched && userResults.length === 0 && (
  <p className="text-sm text-gray-400 px-3 py-2">
    Nenhum usuário encontrado.
  </p>
)}

{/* Resultados */}
{userResults.map(user => (
  <div key={user._id} onClick={() => handleSelectUser(user)}>
    {user.displayName} — {user.sector?.name ?? 'Sem setor'}
  </div>
))}
```

**Critério de aceite:**
- Ao abrir o modal, o campo de usuário está vazio e sem lista suspensa.
- Mensagem de orientação (`"Digite o nome ou usuário para buscar..."`) é exibida quando o campo está em foco mas sem texto.
- A lista aparece somente após o usuário digitar ao menos 1 caractere.
- "Nenhum usuário encontrado." é exibido quando a busca retorna vazio.
- Nenhuma chamada à API é feita ao abrir o modal.

---

## Melhoria 2 — Unicidade de Modelos de Equipamento (sem duplicatas)

**Problema:** O sistema permite cadastrar múltiplos `EquipmentModel` com a mesma combinação de marca + modelo + tipo. Isso gera duplicatas que poluem os dropdowns e confundem o operador na hora de vincular um equipamento.

> **Nota:** Esta melhoria foi descrita na Rodada 1 (MELHORIAS.md — item 5). Este documento detalha a implementação completa caso ainda não tenha sido aplicada.

**Arquivos afetados:**
- `server/models/EquipmentModel.js`
- `server/services/equipmentModelService.js`
- `server/controllers/equipmentModelController.js`
- `server/middleware/errorHandler.js`
- `client/src/pages/admin/EquipmentModels.jsx`

**O que fazer:**

### 2.1 — Índice único no Mongoose

Em `server/models/EquipmentModel.js`, adicionar índice composto único com collation case-insensitive **após** a definição do schema:

```js
EquipmentModelSchema.index(
  { brand: 1, model: 1, type: 1 },
  {
    unique: true,
    collation: { locale: 'pt', strength: 2 }, // case-insensitive, ignora acentuação
    name: 'unique_brand_model_type'
  }
);
```

> ⚠️ **Atenção:** Se já existirem duplicatas no banco, o índice não será criado e o MongoDB retornará erro. Antes de aplicar, verificar duplicatas com:
> ```js
> db.equipmentmodels.aggregate([
>   { $group: { _id: { brand: "$brand", model: "$model", type: "$type" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
>   { $match: { count: { $gt: 1 } } }
> ])
> ```
> Remover manualmente os duplicados antes de reiniciar o servidor.

### 2.2 — Verificação prévia no service (guard clause)

Em `server/services/equipmentModelService.js`, nas funções `create` e `update`, verificar unicidade antes de persistir:

```js
// No create:
async function create(data) {
  const exists = await EquipmentModel.findOne(
    { brand: data.brand, model: data.model, type: data.type },
    null,
    { collation: { locale: 'pt', strength: 2 } }
  );
  if (exists) {
    const err = new Error('Já existe um modelo com esta combinação de marca, modelo e tipo.');
    err.code = 'EQUIPMENT_MODEL_DUPLICATE';
    err.status = 409;
    throw err;
  }
  return EquipmentModel.create(data);
}

// No update (excluir o próprio ID da verificação):
async function update(id, data) {
  const exists = await EquipmentModel.findOne(
    { brand: data.brand, model: data.model, type: data.type, _id: { $ne: id } },
    null,
    { collation: { locale: 'pt', strength: 2 } }
  );
  if (exists) {
    const err = new Error('Já existe um modelo com esta combinação de marca, modelo e tipo.');
    err.code = 'EQUIPMENT_MODEL_DUPLICATE';
    err.status = 409;
    throw err;
  }
  return EquipmentModel.findByIdAndUpdate(id, data, { new: true });
}
```

### 2.3 — Tratamento no errorHandler (fallback para erro de índice MongoDB)

Em `server/middleware/errorHandler.js`, adicionar tratamento do código `11000` (duplicate key) especificamente para o índice de `EquipmentModel`:

```js
if (err.code === 11000) {
  const keyPattern = err.keyPattern || {};
  if (keyPattern.brand || keyPattern.model) {
    return res.status(409).json(
      apiError('Já existe um modelo com esta combinação de marca, modelo e tipo.', 'EQUIPMENT_MODEL_DUPLICATE')
    );
  }
  // outros índices únicos (serialNumber, patrimonyNumber) já tratados antes
}
```

### 2.4 — Feedback visual no front-end

Em `client/src/pages/admin/EquipmentModels.jsx`, no bloco `catch` do submit do formulário:

```js
} catch (err) {
  if (err.response?.data?.code === 'EQUIPMENT_MODEL_DUPLICATE') {
    toast.error('Já existe um modelo com esta combinação de marca, modelo e tipo.');
  } else {
    toast.error(err.response?.data?.message || 'Erro ao salvar modelo.');
  }
}
```

**Critério de aceite:**
- Criar `{ brand: "Dell", model: "Optiplex 3000", type: "Desktop" }` duas vezes → segundo retorna toast de erro com mensagem clara.
- Editar um modelo sem alterar a combinação → salva normalmente (não bloqueia o próprio registro).
- "dell" e "Dell" são considerados iguais (case-insensitive).
- A duplicata é bloqueada tanto no create quanto no update.

---

## Melhoria 3 — Extração automática de sigla do setor a partir do DN do AD

**Problema / Motivação:** Ao importar usuários do AD pela OU, os usuários chegam sem setor atribuído no sistema. O campo `distinguishedName` (DN) retornado pelo AD já contém a hierarquia de OUs com as siglas dos setores no formato `Nome Completo - SIGLA`. Queremos extrair essa sigla automaticamente e:

1. Criar o setor no sistema se ele ainda não existir.
2. Atribuir o setor ao usuário importado.

**Exemplo do DN:**
```
CN=joao.silva,OU=Gerência de Tecnologia da Informação do Centro Administrativo - GETIC,OU=Diretoria de Apoio Operacional,OU=Secretaria da Administração,OU=SEASC,DC=seasc,DC=sc,DC=gov,DC=br
```

**Sigla a extrair:** `GETIC` — a parte após o ` - ` na **primeira OU** do DN (a mais próxima do usuário, que representa o setor direto).

**Regra de extração:** Varrer os segmentos `OU=...` do DN da esquerda para a direita (do mais específico para o mais geral) e retornar a sigla da **primeira OU que contiver ` - `** no nome.

---

### 3.1 — Utilitário de extração da sigla (`server/utils/ldapUtils.js`)

Criar o arquivo `server/utils/ldapUtils.js`:

```js
/**
 * Extrai a sigla do setor a partir do distinguishedName do AD.
 *
 * Regra: percorre os segmentos OU= do DN (do mais específico ao mais geral)
 * e retorna a sigla após o último " - " da primeira OU que contiver esse padrão.
 *
 * Exemplo:
 *   DN: "CN=joao,OU=Gerência de TI - GETIC,OU=Diretoria,...,DC=seasc,..."
 *   Retorna: "GETIC"
 *
 * Retorna null se nenhuma OU tiver o padrão " - SIGLA".
 */
function extractSectorAcronym(distinguishedName) {
  if (!distinguishedName) return null;

  // Separar os segmentos pelo ',' e filtrar apenas os que começam com 'OU='
  const ouSegments = distinguishedName
    .split(',')
    .map(s => s.trim())
    .filter(s => s.toUpperCase().startsWith('OU='))
    .map(s => s.substring(3)); // remove o prefixo 'OU='

  for (const ou of ouSegments) {
    // Procura o padrão " - SIGLA" no final do nome da OU
    const match = ou.match(/\s-\s([A-Z0-9]+)\s*$/);
    if (match) {
      return match[1].trim(); // ex.: "GETIC"
    }
  }

  return null; // nenhuma OU com sigla encontrada
}

/**
 * Extrai o nome completo do setor (antes do hífen) para usar como description.
 *
 * Exemplo:
 *   "Gerência de Tecnologia da Informação do Centro Administrativo - GETIC"
 *   Retorna: "Gerência de Tecnologia da Informação do Centro Administrativo"
 */
function extractSectorFullName(distinguishedName) {
  if (!distinguishedName) return null;

  const ouSegments = distinguishedName
    .split(',')
    .map(s => s.trim())
    .filter(s => s.toUpperCase().startsWith('OU='))
    .map(s => s.substring(3));

  for (const ou of ouSegments) {
    const match = ou.match(/^(.+?)\s-\s[A-Z0-9]+\s*$/);
    if (match) {
      return match[1].trim(); // ex.: "Gerência de Tecnologia da Informação..."
    }
  }

  return null;
}

module.exports = { extractSectorAcronym, extractSectorFullName };
```

---

### 3.2 — Criar ou reutilizar o setor no `userService.js`

Em `server/services/userService.js`, importar as funções utilitárias e criar uma função auxiliar interna `findOrCreateSectorFromDN`:

```js
const { extractSectorAcronym, extractSectorFullName } = require('../utils/ldapUtils');
const Sector = require('../models/Sector');

/**
 * Dado o distinguishedName do AD, encontra ou cria o setor pela sigla extraída.
 * Retorna o ObjectId do setor, ou null se o DN não contiver sigla.
 */
async function findOrCreateSectorFromDN(distinguishedName) {
  const acronym = extractSectorAcronym(distinguishedName);
  if (!acronym) return null;

  // Busca pelo nome da sigla (case-insensitive)
  let sector = await Sector.findOne(
    { name: acronym },
    null,
    { collation: { locale: 'pt', strength: 2 } }
  );

  if (!sector) {
    // Cria automaticamente o setor com a sigla como nome
    const fullName = extractSectorFullName(distinguishedName);
    sector = await Sector.create({
      name: acronym,
      description: fullName || acronym,
      isActive: true,
    });
    // Log opcional para rastreabilidade
    console.log(`[userService] Setor criado automaticamente: ${acronym}`);
  }

  return sector._id;
}
```

---

### 3.3 — Usar a função nas importações do AD

Nas funções `importFromAD` e `syncBulkFromAD` de `userService.js`, após obter os dados do usuário do AD, chamar `findOrCreateSectorFromDN` e atribuir o setor:

```js
// Dentro do loop de importação de cada usuário:
const adUser = await ldapService.getUserByUsername(username); // já retorna o objeto com 'dn' ou 'distinguishedName'

const sectorId = await findOrCreateSectorFromDN(adUser.dn || adUser.distinguishedName);

const userData = {
  username:    adUser.sAMAccountName,
  displayName: adUser.displayName || adUser.cn || adUser.sAMAccountName,
  email:       adUser.mail || null,
  adImported:  true,
  adDepartment: adUser.department || null,
  isActive:    true,
  ...(sectorId && { sector: sectorId }), // só atribui se encontrou/criou setor
};

// upsert (findOneAndUpdate com upsert:true ou create/update manual)
```

> **Importante:** A atribuição de setor só deve ocorrer **na importação**. Após o primeiro import, o administrador pode alterar manualmente o setor do usuário — sincronizações posteriores **não devem sobrescrever** o setor, a menos que exista uma opção explícita para isso. Adicionar lógica:

```js
// Se o usuário já existe no banco, NÃO sobrescrever o setor
const existingUser = await User.findOne({ username });
if (existingUser) {
  // atualiza dados do AD mas preserva o setor existente
  await User.updateOne({ username }, {
    $set: {
      displayName: userData.displayName,
      email: userData.email,
      adDepartment: userData.adDepartment,
    }
    // NÃO inclui 'sector' no $set
  });
} else {
  // novo usuário: criar com setor extraído do DN
  await User.create(userData);
}
```

---

### 3.4 — Atributo `dn`/`distinguishedName` no retorno do `ldapService`

Verificar se `ldapService.searchUsers` e `ldapService.getUsersByOU` já retornam o atributo `distinguishedName` (ou `dn`) no objeto de cada usuário. Se não estiver na lista de atributos solicitados ao LDAP, adicioná-lo:

```js
// Em ldapService.js, na chamada de busca, garantir que 'distinguishedName' está nos atributos:
attributes: [
  'sAMAccountName',
  'displayName',
  'mail',
  'department',
  'cn',
  'distinguishedName', // ← necessário para extração do setor
],
```

> O atributo `dn` costuma ser retornado automaticamente pelo `ldapts` em `entry.objectName` ou `entry.dn`. Verificar qual propriedade o `ldapts` usa e usar a mesma em `findOrCreateSectorFromDN`.

---

### 3.5 — Exibição no resumo de importação (`ADSyncModal.jsx`)

Na resposta do endpoint de importação em lote, incluir no retorno a contagem de setores criados automaticamente:

**Back-end (`userController.js` / `userService.js`):**
```js
// No retorno do sync-ad-bulk e import-ad, adicionar:
return {
  total,
  imported,   // novos usuários
  updated,    // usuários existentes atualizados
  sectorsCreated, // setores criados automaticamente
  errors,
};
```

**Front-end (`ADSyncModal.jsx`):**
```jsx
{/* No resumo após a importação: */}
{result.sectorsCreated > 0 && (
  <p className="text-sm text-blue-600">
    {result.sectorsCreated} setor(es) criado(s) automaticamente a partir do AD.
  </p>
)}
```

---

**Critério de aceite:**
- Importar usuário com DN `OU=Gerência de TI - GETIC,...` → setor `GETIC` criado no sistema e atribuído ao usuário.
- Se o setor `GETIC` já existia → reutilizado (não criado duplicado).
- Usuário já existente no banco → setor **não** é sobrescrito na resincronização.
- Usuário cujo DN não contém ` - SIGLA` em nenhuma OU → importado normalmente sem setor.
- A sigla extraída é sempre maiúscula (`GETIC`, não `getic`).
- O resumo do modal exibe quantos setores foram criados automaticamente.

---

## Resumo das Alterações por Arquivo

| Arquivo | Melhoria |
|---------|----------|
| `client/src/pages/admin/Equipment.jsx` | #1 — Remover lista inicial; exibir campo vazio com dica |
| `server/models/EquipmentModel.js` | #2 — Índice único composto brand+model+type |
| `server/services/equipmentModelService.js` | #2 — Guard clause de duplicata no create/update |
| `server/controllers/equipmentModelController.js` | #2 — Repassar erro 409 corretamente |
| `server/middleware/errorHandler.js` | #2 — Tratar duplicate key 11000 para EquipmentModel |
| `client/src/pages/admin/EquipmentModels.jsx` | #2 — Toast de erro 409 no submit |
| `server/utils/ldapUtils.js` *(novo)* | #3 — `extractSectorAcronym` e `extractSectorFullName` |
| `server/services/userService.js` | #3 — `findOrCreateSectorFromDN`, atribuição na importação |
| `server/services/ldapService.js` | #3 — Incluir `distinguishedName` nos atributos LDAP |
| `server/controllers/userController.js` | #3 — Retornar `sectorsCreated` no resumo |
| `client/src/components/shared/ADSyncModal.jsx` | #3 — Exibir contagem de setores criados |

---

## Atualizações no CLAUDE.md após implementação

**Seção "Arquitetura de Pastas"** — adicionar em `server/utils/`:
```
`-- ldapUtils.js   # extractSectorAcronym e extractSectorFullName (parsing do DN do AD)
```

**Seção "Decisões Técnicas" — subseção "Importação de usuários do AD"** — adicionar:
> - Ao importar um usuário, o `distinguishedName` do AD é parseado por `ldapUtils.extractSectorAcronym` para extrair a sigla do setor (ex.: `GETIC` de `"...Centro Administrativo - GETIC,..."`). O setor é criado automaticamente no sistema caso não exista, e atribuído ao usuário novo. Usuários já existentes **não têm o setor sobrescrito** na resincronização.
> - `POST /api/users/sync-ad-bulk` e `POST /api/users/import-ad` agora retornam `sectorsCreated` no resumo.

**Seção "AssignForm — Busca reativa de usuários"** — atualizar:
> - A lista de usuários só aparece após o usuário digitar (campo começa vazio com mensagem orientadora). Nenhuma chamada à API é feita ao abrir o modal.

**Seção "Regras de Negócio Críticas"** — regra 11 já deve constar:
> 11. **EquipmentModel:** combinação `brand + model + type` deve ser única (índice composto, case-insensitive). Retorna `EQUIPMENT_MODEL_DUPLICATE` (409).
