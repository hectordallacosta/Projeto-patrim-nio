# Fase 20 — Renomeações, Restrições de UI e Limpeza de UX

> Documento de especificação técnica para as melhorias listadas abaixo.
> Deve ser incorporado ao `CLAUDE.md` após a conclusão de cada item.
> Todas as mudanças são predominantemente de front-end, com pequenos ajustes no back-end.

---

## Sumário das Mudanças

| # | Mudança | Impacto |
|---|---------|---------|
| 1 | Renomear aba "Equipamentos" para "Ativos em Uso" | Front |
| 2 | Remover cadastro de equipamento da aba "Ativos em Uso" — cadastro exclusivo pelo Estoque | Front |
| 3 | Remover hardcode do DN `OU=Secretaria da Administração,...` de todos os arquivos | Back + Front |
| 4 | Remover cards "Disponível" e "Atribuído" da aba "Ativos em Uso" — manter apenas "Total" | Front |
| 5 | Único status atribuível manualmente é "Manutenção" | Back + Front |
| 6 | Navegar para detalhe do estoque clicando no nome, não no ícone de olho | Front |

---

## Mudança 1 — Renomear Aba "Equipamentos" para "Ativos em Uso"

### O que muda

#### Front-end — `Sidebar.jsx`
- Alterar o label do link de navegação de `"Equipamentos"` para `"Ativos em Uso"`
- Manter o ícone atual (pode ser `Monitor` ou similar)
- A rota `/admin/equipment` permanece igual — só o label visual muda

#### Front-end — `Equipment.jsx`
- Alterar o componente `PageTitle` de `"Equipamentos"` para `"Ativos em Uso"`
- Alterar o `<title>` da aba do browser (se houver `document.title` ou meta configurado)

#### Front-end — `Dashboard.jsx`
- Qualquer menção a "Equipamentos" que se refira à aba/seção deve ser atualizada para "Ativos em Uso"
- Links internos que apontam para `/admin/equipment` podem manter a rota, mas o texto do link deve dizer "Ativos em Uso"

#### Outros arquivos a verificar e atualizar labels (não rotas):
- `Header.jsx` — se exibir o nome da página atual
- Qualquer `breadcrumb` ou título dinâmico baseado na rota

---

## Mudança 2 — Cadastro de Equipamento Exclusivo pelo Estoque

### Contexto atual
A página `Equipment.jsx` (agora "Ativos em Uso") possui um botão "Novo Equipamento" no `PageTitle` que abre o formulário de cadastro.

### O que muda

#### Front-end — `Equipment.jsx` (Ativos em Uso)
- **Remover** o botão "Novo Equipamento" do `PageTitle`
- **Remover** o modal/form de criação de equipamento do componente (se não for reutilizado em outro lugar)
- Adicionar um `EmptyState` informativo caso não haja ativos em uso:
  - Ícone: `PackageOpen` ou similar
  - Texto: "Nenhum ativo em uso no momento"
  - Sub-texto: "Para adicionar equipamentos, acesse a aba **Estoques** e cadastre os itens lá."
  - Botão opcional: "Ir para Estoques" → navega para `/admin/stocks`

#### Front-end — `Stocks.jsx` / `StockDetail.jsx`
- O formulário de cadastro de equipamento **permanece** (ou é movido para cá, se ainda não estiver)
- Confirmar que o botão "Novo Equipamento" existe na página de Estoques ou no detalhe de um estoque (`StockDetail.jsx`)
- O fluxo correto é: Estoques → selecionar/criar estoque → cadastrar equipamento vinculado ao estoque

#### Regra de negócio (já definida na Fase 18b/19, reforçada aqui)
Todo equipamento é criado com `status: 'in_stock'` vinculado a um estoque obrigatório.
Não existe caminho de cadastro que não passe pelo estoque.

---

## Mudança 3 — Remover Hardcode do DN de Produção

### Contexto atual
Em algum ponto do código existe o DN hardcoded:
```
OU=Secretaria da Administração,OU=SEASC,DC=seasc,DC=sc,DC=gov,DC=br
```
Esse valor é específico do ambiente de produção e não deve constar no código-fonte.

### Busca e remoção

#### Arquivos a verificar (busca global por `SEASC` e `Secretaria da Administração`)
```bash
# Executar na raiz do projeto para localizar todas as ocorrências
grep -r "SEASC" . --include="*.js" --include="*.jsx" --include="*.ts" --include="*.json" -l
grep -r "Secretaria da Administração" . --include="*.js" --include="*.jsx" -l
grep -r "seasc.sc.gov.br" . --include="*.js" --include="*.jsx" --include="*.env*" -l
```

#### Locais prováveis e ação para cada um

| Local | Ação |
|-------|------|
| `server/config/ldap.js` | Substituir valor hardcoded pela variável de ambiente `LDAP_BASE_DN` ou `LDAP_USER_SEARCH_BASE` |
| `server/services/ldapService.js` | Substituir por variável de ambiente |
| `server/.env` (se commitado) | Remover do repo; garantir que está no `.gitignore` |
| `client/src/` qualquer arquivo | Remover referência direta; se necessário exibir, buscar via API |
| `ADSyncModal.jsx` — campo manual de DN | Se o valor aparecer como placeholder ou default, substituir por string genérica: `"OU=Exemplo,DC=empresa,DC=com,DC=br"` |
| Seeds / scripts de teste | Substituir por valores genéricos ou variáveis de ambiente |
| `CLAUDE.md` (documentação) | Manter apenas como exemplo genérico (já está assim) |

#### Variáveis de ambiente que devem cobrir os casos
```env
# server/.env — valores de exemplo (não commitar valores reais)
LDAP_BASE_DN=DC=empresa,DC=com,DC=br
LDAP_USER_SEARCH_BASE=OU=Usuarios,DC=empresa,DC=com,DC=br
LDAP_BIND_DN=CN=ServiceAccount,CN=Users,DC=empresa,DC=com,DC=br
```

> **Regra:** nenhum DN, domínio ou nome de OU de produção deve aparecer em arquivos `.js`, `.jsx` ou `.json` versionados. Todos os valores de conexão LDAP vêm exclusivamente de variáveis de ambiente.

---

## Mudança 4 — Remover Cards "Disponível" e "Atribuído" da Aba Ativos em Uso

### Contexto atual
A página `Equipment.jsx` possui cards de resumo clicáveis:
- Total | Disponível | Atribuído | Manutenção | Desativado

Com as mudanças das Fases 19 e 20, o status `available` não é mais gerado no fluxo normal, e equipamentos `in_stock` não aparecem nesta aba. Logo, os cards "Disponível" e "Atribuído" perdem significado.

### O que muda

#### Front-end — `Equipment.jsx`
- **Remover** o card "Disponível" (`status=available`)
- **Remover** o card "Atribuído" (`status=assigned`)
- **Manter** o card "Total" — exibe o total de ativos em uso (equipamentos que não estão `in_stock`)
- **Manter** o card "Manutenção" — útil para visibilidade rápida de itens bloqueados
- **Manter** o card "Desativado" — útil para visibilidade de itens baixados

#### Layout dos cards após a mudança
```
[ Total ] [ Manutenção ] [ Desativado ]
```

> O card "Total" deve exibir a contagem de todos os equipamentos que aparecem na lista (excluindo `in_stock`), sem filtro de status.

#### Impacto no `Promise.all` de contagens
Remover as chamadas de contagem com `status=available` e `status=assigned` do `useEffect` de cards.
Manter: total (sem filtro de status, excluindo `in_stock`), `status=maintenance`, `status=decommissioned`.

---

## Mudança 5 — Único Status Atribuível Manualmente: Manutenção

### Contexto atual
O endpoint `PATCH /api/equipment/:id/status` permite alterar o status para qualquer valor do enum:
`available | assigned | maintenance | decommissioned | in_stock`

Na UI, há um seletor ou menu de opções de status.

### O que muda

#### Regra de negócio atualizada
Os status são **gerenciados automaticamente** pelo sistema com base nas operações:

| Status | Como é atingido |
|--------|----------------|
| `in_stock` | Criação do equipamento; `unassign`; `send-to-stock` |
| `assigned` | Operação `assign` |
| `available` | Apenas legado — não gerado por novas operações |
| `maintenance` | **Único status atribuível manualmente pelo admin** |
| `decommissioned` | Operação de baixa — ver nota abaixo |

> **`decommissioned`:** manter como status possível via `PATCH /status`, pois representa baixa patrimonial — uma ação administrativa explícita. Porém não deve aparecer como opção de "status" no mesmo seletor de manutenção; deve ser uma ação separada ("Dar Baixa") com `ConfirmDialog` próprio, se já existir.

#### Back-end — `equipmentController.js` / `equipmentService.js`
O endpoint `PATCH /api/equipment/:id/status` deve **validar** que o status recebido é `maintenance` (ou `decommissioned` se a baixa for mantida aqui).

```js
// Validação Zod para o body do endpoint /status
const allowedManualStatuses = ['maintenance'] 
// Se baixa patrimonial também usa este endpoint: ['maintenance', 'decommissioned']
// Retornar VALIDATION_ERROR se outro valor for enviado
```

Qualquer tentativa de setar `available`, `assigned` ou `in_stock` via `PATCH /status` deve retornar HTTP 422 com:
```json
{ "success": false, "code": "STATUS_NOT_ALLOWED", "message": "Este status é gerenciado automaticamente pelo sistema." }
```

#### Front-end — `Equipment.jsx` (Ativos em Uso)
- Substituir o seletor de status (se existir como dropdown multi-opção) por um **botão de ação único**: `"Marcar para Manutenção"` (ícone `Wrench`)
- Ao clicar: abre `ConfirmDialog` → "Deseja marcar este equipamento como Em Manutenção? Ele ficará indisponível para atribuição."
- Confirmar → `PATCH /api/equipment/:id/status { status: 'maintenance' }`
- Esse botão só aparece quando o equipamento está `assigned` (em uso)

#### Front-end — Retirar da Manutenção
Quando o equipamento está `in_stock` com origem de retorno de manutenção, ou quando está `maintenance`:
- Adicionar botão "Concluir Manutenção" → abre `SendToStockForm` (escolha de estoque de destino)
- Ao confirmar: chama `send-to-stock` → equipamento volta para `in_stock` no estoque selecionado

#### Novo código de erro
```
STATUS_NOT_ALLOWED   — tentativa de setar status gerenciado automaticamente (422)
```

---

## Mudança 6 — Navegar para Detalhe do Estoque pelo Nome, Não pelo Ícone de Olho

### Contexto atual
Na página `Stocks.jsx`, cada linha da tabela possui um ícone de olho (`Eye`) na coluna de ações que navega para `/admin/stocks/:id` (detalhe do estoque).

### O que muda

#### Front-end — `Stocks.jsx`
- O **nome do estoque** na tabela deve ser um link clicável que navega para `/admin/stocks/:id`
- Estilizar como link: texto com cor primária + underline no hover (ex: `className="text-blue-600 hover:underline cursor-pointer font-medium"`)
- **Remover** o ícone de olho (`Eye`) da coluna de ações
- As demais ações da linha (editar, excluir) permanecem onde estão

#### Implementação sugerida
```jsx
// Na célula do nome na tabela de Stocks.jsx
<Link to={`/admin/stocks/${stock._id}`} className="text-blue-600 hover:underline font-medium">
  {stock.name}
</Link>
```

#### UX — consistência
Aplicar o mesmo padrão em outras listagens do sistema que possuam página de detalhe:
- `StockDetail.jsx` — se houver sub-listagens com ícone de olho, avaliar trocar pelo nome clicável
- Manter o padrão: **nome é sempre o link de navegação primário**; ícones de ação ficam apenas para editar/excluir

---

## Impacto Consolidado nos Arquivos

### Front-end

| Arquivo | Mudanças |
|---------|----------|
| `Sidebar.jsx` | Label "Equipamentos" → "Ativos em Uso" |
| `Equipment.jsx` | Título → "Ativos em Uso"; remover botão "Novo Equipamento"; remover cards "Disponível" e "Atribuído"; substituir seletor de status por botão "Marcar para Manutenção"; botão "Concluir Manutenção" para itens em maintenance |
| `Stocks.jsx` | Nome do estoque como link clicável; remover ícone de olho das ações |
| `StockDetail.jsx` | Confirmar que botão "Novo Equipamento" existe aqui (ponto único de cadastro) |
| `ADSyncModal.jsx` | Remover DN hardcoded do placeholder do campo manual de OU |
| `Dashboard.jsx` | Atualizar labels "Equipamentos" → "Ativos em Uso" onde aplicável |

### Back-end

| Arquivo | Mudanças |
|---------|----------|
| `equipmentController.js` | Validar que `PATCH /status` só aceita `maintenance` (e opcionalmente `decommissioned`) |
| `equipmentService.js` | Rejeitar status não permitidos com `STATUS_NOT_ALLOWED` |
| `ldapService.js` | Remover qualquer DN hardcoded; usar apenas variáveis de ambiente |
| `ldap.js` (config) | Verificar ausência de valores hardcoded de produção |
| Qualquer `*.test.js` | Substituir DNs reais por valores genéricos de teste |

---

## Novo Código de Erro

```
STATUS_NOT_ALLOWED   — status não pode ser alterado manualmente (422)
```

---

## Checklist de Implementação

### Mudança 1 — Renomear aba
- [ ] Atualizar label no `Sidebar.jsx`
- [ ] Atualizar `PageTitle` em `Equipment.jsx`
- [ ] Verificar outros lugares com texto "Equipamentos" que se refiram à aba

### Mudança 2 — Cadastro exclusivo pelo Estoque
- [ ] Remover botão "Novo Equipamento" de `Equipment.jsx`
- [ ] Remover ou desabilitar modal de criação em `Equipment.jsx`
- [ ] Adicionar `EmptyState` com link para Estoques
- [ ] Confirmar que `StockDetail.jsx` possui o formulário de cadastro de equipamento

### Mudança 3 — Remover hardcode de DN
- [ ] Executar grep global por `SEASC`, `Secretaria da Administração`, `seasc.sc.gov.br`
- [ ] Substituir todos os valores encontrados por variáveis de ambiente
- [ ] Atualizar placeholder do campo manual em `ADSyncModal.jsx`
- [ ] Verificar arquivos de teste

### Mudança 4 — Remover cards Disponível e Atribuído
- [ ] Remover card "Disponível" de `Equipment.jsx`
- [ ] Remover card "Atribuído" de `Equipment.jsx`
- [ ] Remover chamadas de contagem com `status=available` e `status=assigned` do `Promise.all`
- [ ] Ajustar layout dos cards restantes: Total | Manutenção | Desativado

### Mudança 5 — Status manual restrito a Manutenção
- [ ] Atualizar validação Zod em `equipmentController.js` / service
- [ ] Adicionar código de erro `STATUS_NOT_ALLOWED`
- [ ] Substituir seletor de status por botão "Marcar para Manutenção" em `Equipment.jsx`
- [ ] Adicionar botão "Concluir Manutenção" com `SendToStockForm` para equipamentos em `maintenance`

### Mudança 6 — Nome do estoque como link
- [ ] Tornar nome clicável com `<Link>` em `Stocks.jsx`
- [ ] Remover ícone de olho da coluna de ações em `Stocks.jsx`
- [ ] Verificar consistência em outras listagens com detalhe

---

## Estado de Desenvolvimento — Inserir em CLAUDE.md após conclusão

```
- [ ] Fase 20 — UX/Restrições: renomear aba para "Ativos em Uso", cadastro de equipment
               exclusivo pelo Estoque, remoção de hardcode de DN, simplificação de cards,
               status manual restrito a Manutenção, nome do estoque como link de navegação
```
