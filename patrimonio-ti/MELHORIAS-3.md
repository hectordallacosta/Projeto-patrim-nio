# MELHORIAS DO SISTEMA — Rodada 3

> Gerado em: 2026-05-11
> Este arquivo descreve as melhorias a serem implementadas no sistema.
> Cada item contém: descrição, arquivos afetados e instruções precisas de implementação.

---

## Melhoria 1 — Remover cadastro manual de Setores (setores vêm exclusivamente do AD)

**Contexto:** Com a extração automática de siglas do DN do AD (implementada na Rodada 2), os setores são criados automaticamente no momento da importação de usuários. Manter a feature de criação/edição manual de setores cria inconsistências e confunde o operador.

**O que remover / desativar:**

### 1.1 — Front-end

**`client/src/pages/admin/Sectors.jsx`**
- Remover o botão **"Novo Setor"** (`PageTitle` com `action=`) da página.
- Remover o modal/formulário de criação de setor.
- Remover o modal/formulário de edição de setor.
- Remover o botão de **exclusão** de setor individual (ou manter com o bloqueio existente de `SECTOR_HAS_DEPENDENCIES`, a critério — ver nota abaixo).
- Manter a exibição da lista, filtros, cards de contagem e a informação de `userCount` / `equipmentCount` por setor — a página vira somente leitura (consulta).
- Remover o import e uso de qualquer service de `POST`/`PUT`/`DELETE` de setor no componente.

> **Nota sobre exclusão:** Setores sem usuários e sem equipamentos vinculados podem ser excluídos pelo admin para limpeza. Manter o botão de exclusão com o guard existente (`SECTOR_HAS_DEPENDENCIES`) é aceitável. Se a decisão for remover tudo, remover também o botão de exclusão.

**`client/src/components/layout/Sidebar.jsx`**
- O link para `/admin/sectors` pode permanecer (a página ainda existe como consulta).
- Não é necessário alterar.

**`client/src/services/sectorService.js`**
- Manter as funções de leitura (`list`, `getById`).
- Remover ou comentar as funções `create`, `update` e `delete` — se existirem exports não utilizados, removê-los para evitar dead code.

### 1.2 — Back-end

> Os endpoints de `POST`, `PUT` e `DELETE` de setores **não precisam ser removidos do servidor** — eles são utilizados internamente pelo `userService.findOrCreateSectorFromDN` na importação do AD. Remover apenas a exposição no front-end é suficiente.

> Se quiser proteger a API contra uso indevido, pode-se adicionar um middleware adicional que bloqueia chamadas diretas a `POST /api/sectors` vindas do front-end, mas isso é opcional.

### 1.3 — Mensagem explicativa na página de Setores

Adicionar um banner informativo no topo da página `Sectors.jsx`:

```jsx
<div className="mb-4 rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
  Os setores são criados e gerenciados automaticamente a partir do Active Directory.
  Para adicionar um setor, importe os usuários correspondentes via <strong>Usuários → Sincronizar com AD</strong>.
</div>
```

**Critério de aceite:**
- A página de Setores exibe a lista existente, filtros e contagens normalmente.
- Não existe botão "Novo Setor" nem formulário de criação/edição manual.
- O banner informativo está visível no topo da página.
- A importação de usuários do AD continua criando setores automaticamente sem erros.
- Os setores existentes não são afetados.

---

## Melhoria 2 — Exibir nome do setor do usuário na página "Meus Equipamentos" (perfil usuário)

**Problema:** Na página do usuário comum (`/user/equipment` ou `MyEquipment.jsx`), a seção "Do Seu Setor" exibe equipamentos do setor do usuário mas não identifica visualmente qual setor é esse. O usuário não sabe a qual setor pertence sem consultar o perfil separado.

**Comportamento esperado:** Exibir o nome/sigla do setor do usuário logado como subtítulo ou badge ao lado do título "Do Seu Setor", igual à exibição que aparece na tela de admin ao visualizar usuários.

**Arquivos afetados:**
- `client/src/pages/user/MyEquipment.jsx`
- `client/src/store/authStore.js` *(verificar se `sector` está no payload do token/store)*
- `server/controllers/authController.js` *(verificar se `sector.name` é retornado no `GET /api/auth/me`)*

### 2.1 — Garantir que `sector` está disponível no authStore

O `GET /api/auth/me` já popula o campo `sector` do usuário. Verificar se o retorno inclui o objeto `sector` com pelo menos `{ _id, name }`.

Em `server/controllers/authController.js` (ou `userController.js`), no populate do usuário:

```js
// Garantir que sector é populado com name:
.populate('sector', 'name description')
```

O `authStore.js` armazena o objeto do usuário retornado — `user.sector.name` deve estar disponível.

### 2.2 — Exibir o nome do setor em `MyEquipment.jsx`

Importar o store de autenticação e usar `user.sector`:

```jsx
import { useAuthStore } from '@/store/authStore';

// Dentro do componente:
const { user } = useAuthStore();
const sectorName = user?.sector?.name;
```

Alterar o título da seção de equipamentos do setor de:

```jsx
<h2 className="text-lg font-semibold text-gray-700">Do Seu Setor</h2>
```

Para:

```jsx
<h2 className="text-lg font-semibold text-gray-700">
  Do Seu Setor
  {sectorName && (
    <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-medium text-indigo-700">
      {sectorName}
    </span>
  )}
</h2>
```

Ou, se preferir um layout em linha separada (subtítulo):

```jsx
<div>
  <h2 className="text-lg font-semibold text-gray-700">Equipamentos do Setor</h2>
  {sectorName ? (
    <p className="text-sm text-gray-500 mt-0.5">Setor: <strong>{sectorName}</strong></p>
  ) : (
    <p className="text-sm text-gray-400 mt-0.5">Você não está vinculado a nenhum setor.</p>
  )}
</div>
```

### 2.3 — Caso o usuário não tenha setor

Se `user.sector` for `null` (usuário sem setor atribuído), a seção "Do Seu Setor" provavelmente já retorna vazia. Adicionar uma mensagem explicativa:

```jsx
{!sectorName && (
  <p className="text-sm text-gray-400 italic">
    Você não está vinculado a nenhum setor. Contate o administrador.
  </p>
)}
```

**Critério de aceite:**
- Usuário logado com setor `GETIC` vê o badge/label `GETIC` ao lado de "Do Seu Setor".
- Usuário sem setor vê a mensagem de aviso.
- O comportamento de listagem dos equipamentos do setor não muda.

---

## Melhoria 3 — Dashboard com gráficos de análise de ativos

**Contexto:** O `Dashboard.jsx` atual exibe apenas cards de resumo com contagens. Adicionar visualizações gráficas para análise gerencial dos ativos de TI.

**Biblioteca recomendada:** `recharts` — já disponível no projeto React (listada nas dependências de artifacts). Instalar se necessário:
```bash
cd client && npm install recharts
```

**Arquivos afetados:**
- `client/src/pages/admin/Dashboard.jsx` *(alteração principal)*
- `server/controllers/equipmentController.js` *(novos endpoints de analytics)*
- `server/services/equipmentService.js` *(queries de aggregation)*
- `server/routes/equipment.routes.js` *(registrar novas rotas)*
- `client/src/services/equipmentService.js` *(funções de chamada dos endpoints)*

---

### 3.1 — Novos endpoints de analytics no back-end

Adicionar em `server/routes/equipment.routes.js`:

```
GET /api/equipment/analytics/by-sector       → ativos por setor
GET /api/equipment/analytics/by-type         → contagem por tipo de equipamento
GET /api/equipment/analytics/by-model-sector → modelos atribuídos por setor
GET /api/equipment/analytics/recent          → últimos 10 equipamentos atribuídos
```

Todos protegidos por `verifyToken` + `requireAdmin`.

---

### 3.2 — Implementação das queries no `equipmentService.js`

#### a) Ativos atribuídos por setor

```js
async function getAssetsBySector() {
  // Busca equipamentos com status 'assigned' vinculados a um Sector
  return Equipment.aggregate([
    { $match: { status: 'assigned', assignedSector: { $ne: null } } },
    { $group: { _id: '$assignedSector', total: { $sum: 1 } } },
    { $lookup: { from: 'sectors', localField: '_id', foreignField: '_id', as: 'sector' } },
    { $unwind: '$sector' },
    { $project: { _id: 0, sector: '$sector.name', total: 1 } },
    { $sort: { total: -1 } },
  ]);
}
```

> **Nota:** Equipamentos podem estar atribuídos a um usuário (`assignedTo`) que pertence a um setor. Para contemplar também esses, adicionar uma segunda branch no aggregate que une pelo setor do usuário. Exemplo complementar:

```js
// Equipamentos atribuídos a usuário — buscar o setor do usuário
{ $match: { status: 'assigned', assignedTo: { $ne: null } } }
// $lookup em users, depois $lookup em sectors para obter o nome
// Unir os dois resultados no código e somar por setor
```

#### b) Quantidade por tipo de equipamento

```js
async function getAssetsByType() {
  return Equipment.aggregate([
    { $match: { status: { $nin: ['decommissioned'] } } },
    {
      $lookup: {
        from: 'equipmentmodels',
        localField: 'equipmentModel',
        foreignField: '_id',
        as: 'model',
      },
    },
    { $unwind: '$model' },
    {
      $lookup: {
        from: 'equipmenttypes',
        localField: 'model.type',
        foreignField: '_id',
        as: 'type',
      },
    },
    { $unwind: '$type' },
    { $group: { _id: '$type.name', total: { $sum: 1 } } },
    { $project: { _id: 0, type: '$_id', total: 1 } },
    { $sort: { total: -1 } },
  ]);
}
```

#### c) Modelos atribuídos por setor (top modelos)

```js
async function getModelsBySector() {
  // Retorna para cada setor quais modelos (brand+model) estão atribuídos e em qual quantidade
  return Equipment.aggregate([
    { $match: { status: 'assigned', assignedSector: { $ne: null } } },
    {
      $lookup: {
        from: 'equipmentmodels',
        localField: 'equipmentModel',
        foreignField: '_id',
        as: 'model',
      },
    },
    { $unwind: '$model' },
    {
      $lookup: {
        from: 'sectors',
        localField: 'assignedSector',
        foreignField: '_id',
        as: 'sector',
      },
    },
    { $unwind: '$sector' },
    {
      $group: {
        _id: { sector: '$sector.name', model: { $concat: ['$model.brand', ' ', '$model.model'] } },
        total: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.sector',
        models: { $push: { model: '$_id.model', total: '$total' } },
        totalAssets: { $sum: '$total' },
      },
    },
    { $project: { _id: 0, sector: '$_id', models: 1, totalAssets: 1 } },
    { $sort: { totalAssets: -1 } },
  ]);
}
```

#### d) Últimos 10 equipamentos atribuídos

```js
async function getRecentAssignments() {
  return Equipment.find({ status: 'assigned' })
    .sort({ updatedAt: -1 })
    .limit(10)
    .populate('equipmentModel', 'brand model')
    .populate('assignedTo', 'displayName')
    .populate('assignedSector', 'name')
    .lean();
}
```

---

### 3.3 — Funções no `equipmentService.js` do front-end

Em `client/src/services/equipmentService.js`, adicionar:

```js
export const getAnalyticsBySector    = () => api.get('/equipment/analytics/by-sector');
export const getAnalyticsByType      = () => api.get('/equipment/analytics/by-type');
export const getAnalyticsByModelSector = () => api.get('/equipment/analytics/by-model-sector');
export const getRecentAssignments    = () => api.get('/equipment/analytics/recent');
```

---

### 3.4 — Atualizar `Dashboard.jsx` com os gráficos

Instalar recharts se necessário: `cd client && npm install recharts`

**Layout sugerido para o Dashboard:**

```
┌─────────────────────────────────────────────────────────┐
│  Cards de resumo (Total, Disponível, Atribuído, etc.)   │  ← já existente
├────────────────────────┬────────────────────────────────┤
│  Gráfico 1             │  Gráfico 2                     │
│  Ativos por Setor      │  Quantidade por Tipo           │
│  (BarChart horizontal) │  (PieChart / DonutChart)       │
├────────────────────────┴────────────────────────────────┤
│  Gráfico 3 — Modelos Atribuídos por Setor               │
│  (BarChart agrupado ou StackedBarChart)                  │
├─────────────────────────────────────────────────────────┤
│  Tabela 4 — Últimos 10 Equipamentos Atribuídos          │
└─────────────────────────────────────────────────────────┘
```

---

#### Gráfico 1 — Ativos por Setor (BarChart horizontal)

```jsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';

// Gráfico de barras horizontal — ativos por setor
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={bySectorData} layout="vertical" margin={{ left: 60 }}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis type="number" allowDecimals={false} />
    <YAxis type="category" dataKey="sector" width={80} tick={{ fontSize: 12 }} />
    <Tooltip formatter={(value) => [`${value} ativos`, 'Total']} />
    <Bar dataKey="total" fill="#6366f1" radius={[0, 4, 4, 0]} />
  </BarChart>
</ResponsiveContainer>
```

---

#### Gráfico 2 — Quantidade por Tipo de Equipamento (PieChart/Donut)

```jsx
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6'];

<ResponsiveContainer width="100%" height={300}>
  <PieChart>
    <Pie
      data={byTypeData}
      dataKey="total"
      nameKey="type"
      cx="50%"
      cy="50%"
      innerRadius={60}
      outerRadius={110}
      paddingAngle={3}
      label={({ type, percent }) => `${type} (${(percent * 100).toFixed(0)}%)`}
    >
      {byTypeData.map((_, index) => (
        <Cell key={index} fill={COLORS[index % COLORS.length]} />
      ))}
    </Pie>
    <Tooltip formatter={(value, name) => [`${value} equipamentos`, name]} />
    <Legend />
  </PieChart>
</ResponsiveContainer>
```

---

#### Gráfico 3 — Modelos Atribuídos por Setor (StackedBarChart)

> Este gráfico é mais complexo pois o número de modelos é variável. A sugestão é exibir os **5 setores com mais ativos** e os **5 modelos mais frequentes**, agrupados em barras empilhadas:

```jsx
// Transformar dados de getModelsBySector() em formato recharts:
// [{ sector: 'GETIC', 'Dell Optiplex 3000': 5, 'HP LaserJet': 3 }, ...]

// Renderizar com múltiplos <Bar> empilhados, um por modelo:
{topModels.map((modelName, index) => (
  <Bar key={modelName} dataKey={modelName} stackId="a" fill={COLORS[index % COLORS.length]} />
))}
```

> Calcular `topModels` como os N modelos mais frequentes no conjunto de dados retornado.

---

#### Tabela 4 — Últimos 10 Equipamentos Atribuídos

```jsx
<div className="overflow-x-auto">
  <table className="min-w-full divide-y divide-gray-200 text-sm">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-4 py-3 text-left font-medium text-gray-500">Patrimônio</th>
        <th className="px-4 py-3 text-left font-medium text-gray-500">Modelo</th>
        <th className="px-4 py-3 text-left font-medium text-gray-500">Atribuído a</th>
        <th className="px-4 py-3 text-left font-medium text-gray-500">Data</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {recentData.map(eq => (
        <tr key={eq._id} className="hover:bg-gray-50">
          <td className="px-4 py-3 font-mono">{eq.patrimonyNumber}</td>
          <td className="px-4 py-3">
            {eq.equipmentModel?.brand} {eq.equipmentModel?.model}
          </td>
          <td className="px-4 py-3">
            {eq.assignedTo?.displayName ?? eq.assignedSector?.name ?? '—'}
          </td>
          <td className="px-4 py-3 text-gray-400">
            {formatDate(eq.updatedAt)}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

### 3.5 — Estrutura de estados e carregamento no Dashboard

```jsx
const [bySectorData, setBySectorData]       = useState([]);
const [byTypeData, setByTypeData]           = useState([]);
const [byModelSectorData, setByModelSectorData] = useState([]);
const [recentData, setRecentData]           = useState([]);
const [loadingCharts, setLoadingCharts]     = useState(true);

useEffect(() => {
  async function loadAnalytics() {
    try {
      const [sector, type, modelSector, recent] = await Promise.all([
        getAnalyticsBySector(),
        getAnalyticsByType(),
        getAnalyticsByModelSector(),
        getRecentAssignments(),
      ]);
      setBySectorData(sector.data.data);
      setByTypeData(type.data.data);
      setByModelSectorData(modelSector.data.data);
      setRecentData(recent.data.data);
    } catch (err) {
      toast.error('Erro ao carregar dados do dashboard.');
    } finally {
      setLoadingCharts(false);
    }
  }
  loadAnalytics();
}, []);
```

---

### 3.6 — Skeleton / Loading state dos gráficos

Enquanto `loadingCharts === true`, exibir placeholders animados para evitar layout shift:

```jsx
{loadingCharts ? (
  <div className="h-[300px] animate-pulse rounded-xl bg-gray-100" />
) : (
  <ResponsiveContainer>...</ResponsiveContainer>
)}
```

---

**Critério de aceite — Dashboard:**
- Os 4 painéis são exibidos logo abaixo dos cards de resumo existentes.
- Os gráficos carregam de forma assíncrona sem travar o restante da página.
- Se não houver dados (ex.: nenhum equipamento atribuído), os gráficos exibem estado vazio (`EmptyState` ou mensagem `"Sem dados para exibir"`).
- A tabela de "Últimos 10 Atribuídos" exibe patrimônio, modelo, destinatário (usuário ou setor) e data.
- O gráfico de Tipo de Equipamento destaca visualmente as impressoras (elas aparecem como fatia do Pie com o nome do tipo de impressora cadastrado no sistema).
- Responsivo: em telas menores, os gráficos 1 e 2 empilham verticalmente (grid de 1 coluna).

---

## Resumo das Alterações por Arquivo

| Arquivo | Melhoria |
|---------|----------|
| `client/src/pages/admin/Sectors.jsx` | #1 — Remover botão Novo, formulários de criação/edição; adicionar banner informativo |
| `client/src/services/sectorService.js` | #1 — Remover funções create/update/delete |
| `client/src/pages/user/MyEquipment.jsx` | #2 — Exibir nome/sigla do setor do usuário logado |
| `server/controllers/authController.js` | #2 — Garantir `sector.name` no populate do `/api/auth/me` |
| `server/services/equipmentService.js` | #3 — 4 novas funções de analytics |
| `server/controllers/equipmentController.js` | #3 — 4 novos handlers de analytics |
| `server/routes/equipment.routes.js` | #3 — Registrar rotas `/analytics/*` |
| `client/src/services/equipmentService.js` | #3 — 4 novas funções de chamada à API |
| `client/src/pages/admin/Dashboard.jsx` | #3 — Gráficos recharts + tabela de recentes |

---

## Atualizações no CLAUDE.md após implementação

**Seção "Arquitetura de Pastas" — Páginas admin:**
```
|-- Sectors.jsx   # somente leitura — setores criados pelo AD; sem formulários manuais
|-- Dashboard.jsx # cards de resumo + 4 gráficos recharts (analytics de ativos)
```

**Seção "Endpoints da API"** — adicionar:
| GET | `/api/equipment/analytics/by-sector` | admin | Ativos atribuídos por setor |
| GET | `/api/equipment/analytics/by-type` | admin | Contagem por tipo de equipamento |
| GET | `/api/equipment/analytics/by-model-sector` | admin | Modelos atribuídos por setor |
| GET | `/api/equipment/analytics/recent` | admin | Últimos 10 equipamentos atribuídos |

**Seção "Regras de Negócio Críticas"** — adicionar:
> 14. **Setores:** criados exclusivamente pela importação do AD. Não há cadastro manual de setores no front-end.

**Seção "Decisões Técnicas"** — adicionar subseção:
> **Dashboard — Analytics de Ativos**
> - Biblioteca: `recharts` (já listada nas dependências do React)
> - Dados carregados com `Promise.all` de 4 endpoints de analytics
> - Skeleton animado durante carregamento para evitar layout shift
> - Gráfico 1: BarChart horizontal — ativos por setor
> - Gráfico 2: PieChart/Donut — distribuição por tipo de equipamento
> - Gráfico 3: StackedBarChart — modelos por setor (top 5 setores × top 5 modelos)
> - Tabela: últimos 10 equipamentos atribuídos com patrimônio, modelo, destinatário e data
