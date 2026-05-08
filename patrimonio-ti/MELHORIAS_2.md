# Relatório de Alterações — Sistema de Gestão de Patrimônio de TI

> **Data:** 2026-05-07
> **Status:** Pendente de implementação
> **Elaborado por:** Revisão técnica

---

## Sumário

| # | Alteração | Impacto | Prioridade |
|---|-----------|---------|------------|
| 1 | Substituição da busca global (Ctrl+K) por filtros por feature | Alto | Média |
| 2 | Número de patrimônio obrigatório e único | Alto | Alta |
| 3 | Número de série passa a ser opcional | Médio | Alta |
| 4 | Usuários desativados não devem aparecer para atribuição | Alto | Alta |

---

## Alteração 1 — Substituição da Busca Global por Filtros por Feature

### Descrição

Remover o componente de busca global (`Ctrl+K`) e substituí-lo por barras de busca
contextuais em cada listagem da aplicação: Equipamentos, Usuários, Setores e Modelos de Equipamento.

### Motivação

A busca global unifica contextos distintos em um único resultado, o que pode confundir o
operador. Filtros por feature são mais previsíveis, mais fáceis de testar e se integram
naturalmente ao mecanismo de `useUrlFilters` já existente no projeto.

### Arquivos Afetados

#### Remoção
| Arquivo | Ação |
|---------|------|
| `client/src/components/shared/GlobalSearch.jsx` | **Deletar** |
| `server/controllers/searchController.js` | **Deletar** |
| `server/routes/search.routes.js` | **Deletar** |

#### Back-end
| Arquivo | Alteração |
|---------|-----------|
| `server/app.js` | Remover o `require` e o `app.use` da rota `/api/search` |

#### Front-end
| Arquivo | Alteração |
|---------|-----------|
| `client/src/components/layout/Header.jsx` | Remover o botão de busca global e o atalho `Ctrl+K` |
| `client/src/pages/admin/Equipment.jsx` | Adicionar `<SearchBar>` conectado ao param `search` via `useUrlFilters` |
| `client/src/pages/admin/Users.jsx` | Adicionar `<SearchBar>` conectado ao param `search` via `useUrlFilters` |
| `client/src/pages/admin/Sectors.jsx` | Verificar/consolidar `<SearchBar>` já existente (page já usa filtros de URL) |
| `client/src/pages/admin/EquipmentModels.jsx` | Adicionar `<SearchBar>` conectado ao param `search` via `useUrlFilters` |

### Comportamento Esperado por Tela

- **Equipamentos** — busca por número de série, número de patrimônio ou modelo/marca (via
  `search` param já suportado pelo `GET /api/equipment`)
- **Usuários** — busca por nome, username ou e-mail (param `search` já suportado pelo
  `GET /api/users`)
- **Setores** — busca por nome (param `search` já suportado pelo `GET /api/sectors`)
- **Modelos** — busca por marca ou modelo (novo param `search` a adicionar em
  `equipmentModelService.list`)

### Alterações no Back-end — Modelos de Equipamento

O endpoint `GET /api/equipment-models` não possui filtro de busca textual hoje.
Deve-se adicionar suporte ao query param `search` no `equipmentModelService.js`:

```js
// server/services/equipmentModelService.js
// Adicionar na construção do filtro:
if (search) {
  filter.$or = [
    { brand: { $regex: search, $options: 'i' } },
    { model: { $regex: search, $options: 'i' } },
    { lot:   { $regex: search, $options: 'i' } },
  ];
}
```

E no controller, repassar o param:

```js
// server/controllers/equipmentModelController.js — método list
const { page, limit, search, isActive } = req.query;
const result = await equipmentModelService.list({ page, limit, search, isActive });
```

### Observações

- O componente `<SearchBar>` já existe em `client/src/components/shared/SearchBar.jsx` e
  deve ser reaproveitado em todas as páginas.
- O hook `useDebounce` (300 ms) já existe e deve ser usado no `onChange` de cada `<SearchBar>`.
- A rota `GET /api/search` pode ser mantida temporariamente como *deprecated* e removida
  após confirmação de que não há mais chamadas no cliente.

---

## Alteração 2 — Número de Patrimônio Obrigatório e Único

### Descrição

O campo `patrimonyNumber` em `Equipment` passa a ser **obrigatório** e ter **índice único**
no banco de dados, assim como `serialNumber`. Duplicatas devem ser rejeitadas com erro
amigável.

### Motivação

O número de patrimônio é o identificador físico do bem (plaqueta), portanto não pode se
repetir entre equipamentos. Atualmente o campo é opcional e não possui restrição de unicidade,
permitindo cadastros duplicados ou sem identificação.

### Arquivos Afetados

#### Back-end
| Arquivo | Alteração |
|---------|-----------|
| `server/models/Equipment.js` | Tornar `patrimonyNumber` obrigatório e adicionar `unique: true` |
| `server/middleware/errorHandler.js` | Tratar o erro de duplicate key para `patrimonyNumber` com código `PATRIMONY_NUMBER_DUPLICATE` |
| `server/controllers/equipmentController.js` | Nenhuma alteração necessária — o `errorHandler` já captura `err.code === 11000` |
| `server/routes/equipment.routes.js` | Nenhuma alteração |

##### Modelo Mongoose — `server/models/Equipment.js`

```js
// Antes:
patrimonyNumber: {
  type: String,
  trim: true,
},

// Depois:
patrimonyNumber: {
  type: String,
  required: [true, 'Número de patrimônio é obrigatório'],
  unique: true,
  trim: true,
},
```

> **Atenção:** Antes de aplicar o índice único, executar o script de verificação abaixo para
> garantir que não existem valores duplicados ou nulos no banco:
>
> ```js
> // Verificar duplicatas antes da migration
> db.equipments.aggregate([
>   { $match: { patrimonyNumber: { $exists: true, $ne: null } } },
>   { $group: { _id: "$patrimonyNumber", count: { $sum: 1 } } },
>   { $match: { count: { $gt: 1 } } }
> ])
> ```

##### Middleware de erro — `server/middleware/errorHandler.js`

```js
// Ampliar o tratamento de duplicate key (já existente para serialNumber):
if (err.code === 11000) {
  const field = Object.keys(err.keyPattern)[0];
  const codeMap = {
    serialNumber:   { code: 'SERIAL_NUMBER_DUPLICATE',   message: 'Número de série já cadastrado.' },
    patrimonyNumber:{ code: 'PATRIMONY_NUMBER_DUPLICATE', message: 'Número de patrimônio já cadastrado.' },
  };
  const entry = codeMap[field] ?? { code: 'DUPLICATE_KEY', message: 'Valor duplicado.' };
  return res.status(409).json({ success: false, ...entry });
}
```

##### Validação Zod

```js
// server — schema de criação/edição de equipamento
patrimonyNumber: z.string().min(1, 'Número de patrimônio é obrigatório').trim(),
```

#### Front-end
| Arquivo | Alteração |
|---------|-----------|
| `client/src/pages/admin/Equipment.jsx` | Marcar campo como obrigatório no formulário (`required`), exibir `*` visual e tratar erro `PATRIMONY_NUMBER_DUPLICATE` com `toast.error` |

```jsx
// Exemplo de tratamento de erro no submit do formulário:
} catch (err) {
  const code = err.response?.data?.code;
  if (code === 'PATRIMONY_NUMBER_DUPLICATE') {
    toast.error('Número de patrimônio já está em uso por outro equipamento.');
  } else if (code === 'SERIAL_NUMBER_DUPLICATE') {
    toast.error('Número de série já está em uso por outro equipamento.');
  } else {
    toast.error('Erro ao salvar equipamento.');
  }
}
```

#### Testes
| Arquivo | Alteração |
|---------|-----------|
| `server/__tests__/equipment.test.js` | Adicionar casos: criação sem `patrimonyNumber` deve retornar 400; criação com `patrimonyNumber` duplicado deve retornar 409 com `PATRIMONY_NUMBER_DUPLICATE` |

### Códigos de Erro — Atualização

Adicionar `PATRIMONY_NUMBER_DUPLICATE` à tabela de códigos no `CLAUDE.md`:

```
PATRIMONY_NUMBER_DUPLICATE  — número de patrimônio já existe no banco
```

---

## Alteração 3 — Número de Série Passa a Ser Opcional

### Descrição

O campo `serialNumber` em `Equipment` deixa de ser obrigatório. Deve continuar sendo único
quando informado (índice sparse), mas pode ser omitido no cadastro.

### Motivação

Nem todos os equipamentos possuem número de série acessível no momento do tombamento
(ex.: periféricos, equipamentos sem etiqueta visível). Forçar o preenchimento impede o
cadastro imediato do bem.

### Arquivos Afetados

#### Back-end
| Arquivo | Alteração |
|---------|-----------|
| `server/models/Equipment.js` | Remover `required` de `serialNumber`; adicionar `sparse: true` ao índice único |
| `server/services/equipmentService.js` | Nenhuma alteração necessária |

##### Modelo Mongoose — `server/models/Equipment.js`

```js
// Antes:
serialNumber: {
  type: String,
  required: [true, 'Número de série é obrigatório'],
  unique: true,
  trim: true,
},

// Depois:
serialNumber: {
  type: String,
  unique: true,
  sparse: true,   // permite múltiplos documentos com serialNumber nulo/ausente
  trim: true,
},
```

> **Por que `sparse: true`?**
> Um índice `unique` normal rejeita dois documentos com `null`. O índice *sparse* só indexa
> documentos que possuem o campo, permitindo que vários equipamentos não tenham número de série.

##### Validação Zod

```js
// Antes:
serialNumber: z.string().min(1, 'Número de série é obrigatório').trim(),

// Depois:
serialNumber: z.string().trim().optional().or(z.literal('')).transform(v => v || undefined),
```

#### Front-end
| Arquivo | Alteração |
|---------|-----------|
| `client/src/pages/admin/Equipment.jsx` | Remover atributo `required` e indicador `*` do campo `serialNumber`; manter o `toast.error` para `SERIAL_NUMBER_DUPLICATE` quando o campo for informado e colidir |

#### Testes
| Arquivo | Alteração |
|---------|-----------|
| `server/__tests__/equipment.test.js` | Atualizar os casos que criam equipamento sem `serialNumber` — o que retornava 400 deve passar a retornar 201 |

---

## Alteração 4 — Usuários Desativados Não Aparecem para Atribuição

### Descrição

Ao vincular um equipamento a um usuário (`PATCH /api/equipment/:id/assign`), a listagem de
usuários disponíveis no front-end e a validação no back-end devem ignorar usuários com
`isActive: false`.

### Motivação

Hoje o `AssignForm` e o endpoint de vínculo não filtram por `isActive`, permitindo que um
equipamento seja atribuído a um colaborador que já foi desligado. Isso gera inconsistência
no inventário e pode violar auditorias.

### Arquivos Afetados

#### Back-end
| Arquivo | Alteração |
|---------|-----------|
| `server/services/equipmentService.js` | No método `assign`, verificar que o `userId` alvo tem `isActive: true` antes de vincular |
| `server/controllers/equipmentController.js` | Nenhuma alteração necessária — lógica vai para o service |

##### Service — `server/services/equipmentService.js`

```js
// Dentro do método assign, após buscar o equipamento:
if (assignTo === 'user') {
  const targetUser = await User.findById(userId).select('isActive displayName').lean();
  if (!targetUser) {
    throw createError('Usuário não encontrado.', 'USER_NOT_FOUND', 404);
  }
  if (!targetUser.isActive) {
    throw createError(
      `O usuário "${targetUser.displayName}" está desativado e não pode receber equipamentos.`,
      'USER_INACTIVE',
      422
    );
  }
}
```

#### Front-end
| Arquivo | Alteração |
|---------|-----------|
| `client/src/pages/admin/Equipment.jsx` (AssignForm) | Filtrar a lista de usuários para exibir apenas `isActive === true` |
| `client/src/services/userService.js` | Garantir que a chamada que popula o dropdown de usuários inclua `isActive=true` no query param |

##### Chamada da API — `client/src/services/userService.js`

```js
// Na função que lista usuários para o AssignForm:
// Antes (sem filtro):
export const listActiveUsers = () => api.get('/users');

// Depois:
export const listActiveUsers = () => api.get('/users?isActive=true&limit=999');
```

##### AssignForm — `client/src/pages/admin/Equipment.jsx`

```jsx
// Ao carregar a lista de usuários, garantir o filtro:
useEffect(() => {
  userService.listActiveUsers().then(res => setUsers(res.data.data));
}, []);
```

> O filtro `isActive=true` já é suportado pelo `GET /api/users` conforme documentado no
> `CLAUDE.md` (filtros: `search, role, isActive, sector, noSector`).

#### Código de Erro — Novo

Adicionar `USER_INACTIVE` à tabela de códigos no `CLAUDE.md`:

```
USER_INACTIVE  — tentativa de atribuir equipamento a usuário desativado
```

#### Tratamento no Front-end

```jsx
} catch (err) {
  const code = err.response?.data?.code;
  if (code === 'USER_INACTIVE') {
    toast.error('Este usuário está desativado. Reative-o antes de atribuir equipamentos.');
  } else {
    toast.error('Erro ao atribuir equipamento.');
  }
}
```

#### Testes
| Arquivo | Alteração |
|---------|-----------|
| `server/__tests__/equipment.test.js` | Adicionar caso: tentativa de atribuir equipamento a usuário com `isActive: false` deve retornar 422 com código `USER_INACTIVE` |

---

## Atualização do CLAUDE.md

Após implementar todas as alterações acima, atualizar os seguintes pontos no `CLAUDE.md`:

### Modelos de Dados — Equipment
```
serialNumber(único, opcional, índice sparse),
patrimonyNumber(único, obrigatório)
```

### Endpoints da API — Remover
```
GET /api/search?q=termo&limit=5
```

### Códigos de Erro — Adicionar
```
PATRIMONY_NUMBER_DUPLICATE | USER_INACTIVE
```

### Decisões Técnicas — Adicionar
- **serialNumber opcional com índice sparse:** permite cadastro de equipamentos sem número de série; o índice sparse garante unicidade apenas quando o campo está presente.
- **patrimonyNumber obrigatório e único:** identifica fisicamente o bem (plaqueta); duplicatas retornam HTTP 409.
- **Filtros por feature no lugar da busca global:** cada listagem possui sua própria barra de busca conectada a `useUrlFilters`; a rota `/api/search` foi removida.
- **Atribuição restrita a usuários ativos:** o service `equipmentService.assign` rejeita vínculos com `isActive: false`; o front-end filtra a lista antes mesmo da submissão.

### Estado de Desenvolvimento — Adicionar Fase
```
- [ ] Fase 14 — Refinamentos de negócio: filtros por feature, validações de patrimônio e usuários ativos
```

---

## Checklist de Implementação

### Alteração 1 — Filtros por Feature
- [ ] Deletar `GlobalSearch.jsx`
- [ ] Deletar `searchController.js` e `search.routes.js`
- [ ] Remover registro da rota em `app.js`
- [ ] Remover botão Ctrl+K do `Header.jsx`
- [ ] Adicionar `<SearchBar>` em `Equipment.jsx`
- [ ] Adicionar `<SearchBar>` em `Users.jsx`
- [ ] Confirmar/ajustar `<SearchBar>` em `Sectors.jsx`
- [ ] Adicionar `<SearchBar>` em `EquipmentModels.jsx`
- [ ] Adicionar suporte ao param `search` em `equipmentModelService.js` (back-end)
- [ ] Atualizar `CLAUDE.md`

### Alteração 2 — Patrimônio Obrigatório e Único
- [ ] Verificar duplicatas existentes no banco antes de migrar
- [ ] Atualizar schema Mongoose em `Equipment.js`
- [ ] Atualizar validação Zod no back-end
- [ ] Atualizar `errorHandler.js` com `PATRIMONY_NUMBER_DUPLICATE`
- [ ] Atualizar formulário em `Equipment.jsx` (campo required + tratamento de erro)
- [ ] Adicionar testes em `equipment.test.js`
- [ ] Atualizar `CLAUDE.md`

### Alteração 3 — Série Opcional
- [ ] Atualizar schema Mongoose em `Equipment.js` (remover `required`, adicionar `sparse: true`)
- [ ] Atualizar validação Zod no back-end
- [ ] Atualizar formulário em `Equipment.jsx` (remover `required`)
- [ ] Atualizar testes em `equipment.test.js`
- [ ] Atualizar `CLAUDE.md`

### Alteração 4 — Usuários Desativados
- [ ] Adicionar verificação `isActive` no `equipmentService.assign`
- [ ] Atualizar chamada da API no front-end para `isActive=true`
- [ ] Tratar código `USER_INACTIVE` no formulário de atribuição
- [ ] Adicionar testes em `equipment.test.js`
- [ ] Atualizar `CLAUDE.md`
