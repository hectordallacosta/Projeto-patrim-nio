# Patrimônio TI

Sistema web para gestão de patrimônio de TI com integração ao Active Directory (LDAP). Permite controlar equipamentos, usuários, setores e gerar trilhas de auditoria — tudo em uma interface moderna e responsiva.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js 20 + Express 4 |
| Frontend | React 18 + Vite 5 |
| Banco de dados | MongoDB 7 + Mongoose 8 |
| Autenticação | LDAP/Active Directory + JWT |
| Estilização | Tailwind CSS 3 |
| Estado global | Zustand |
| Validação | Zod (backend e frontend) |

---

## Funcionalidades implementadas

### Autenticação e autorização
- Login via Active Directory (LDAP/LDAPS) — sem armazenar senhas localmente
- Fallback para senha local (bcrypt) para a conta `admin`
- JWT com expiração de 8 horas
- Controle de acesso por papéis: `admin` e `user`
- Provisionamento automático de usuário no primeiro login via AD

### Usuários
- CRUD completo (somente admin)
- Busca de usuários no AD com correspondência parcial
- Importação individual por username: `POST /api/users/sync/:username`
- Importação em lote por lista de usernames: `POST /api/users/import-ad`
- Sincronização em lote por OU do AD: `POST /api/users/sync-ad-bulk`
- Ativação/desativação de usuários
- Rastreamento de departamento (`adDepartment`) e último login

### Setores
- CRUD com validação de nome único
- Atribuição de gestor responsável
- Contagem de usuários e equipamentos vinculados
- Exclusão bloqueada se houver dependências

### Tipos de equipamento
- CRUD básico (Desktop, Notebook, Impressora, Telefone, etc.)
- Exclusão bloqueada se o tipo estiver em uso

### Modelos de equipamento
- Funcionam como "classe" ou template para equipamentos físicos
- Armazenam: marca, modelo, tipo, número de lote, data de compra, vencimento de garantia
- Equipamentos físicos herdam esses dados do modelo
- Contagem de equipamentos vinculados por modelo
- Exclusão bloqueada se houver equipamentos vinculados

### Equipamentos
- CRUD com número de série (único) e número de patrimônio
- Status: `disponível`, `atribuído`, `manutenção`, `desativado`
- Atribuição a usuário **ou** setor (nunca ambos simultaneamente)
- Histórico completo de atribuições (data, destino, responsável)
- Reatribuição direta (transferência) com fechamento automático do histórico anterior
- Filtragem por status, modelo e busca textual
- Equipamentos em manutenção ou desativados ficam indisponíveis para atribuição

### Auditoria
- Log automático de todas as operações destrutivas (exclusão, desativação, desatribuição)
- Registra: tipo de ação, entidade, executor, IP, estado antes/depois
- Visualizador de logs exclusivo para admin

### Busca global (Ctrl+K)
- Pesquisa simultânea em Equipamentos, Usuários e Setores
- Resultados agrupados por categoria com destaque do termo
- Navegação por teclado (setas, Enter, Esc)
- Atalho de teclado `Ctrl+K` em qualquer página

### Dashboard
- Cards com totais clicáveis que filtram as listagens:
  - Equipamentos: total, disponível, atribuído, manutenção, desativado
  - Usuários: total, ativos, inativos, sem setor
  - Setores: total, ativos, inativos

---

## Estrutura do projeto

```
patrimonio-ti/
├── server/                         # Backend Node.js/Express
│   ├── config/                     # Conexão MongoDB e LDAP
│   ├── controllers/                # Handlers das rotas (8 controllers)
│   ├── middleware/                 # JWT, permissão admin, erro global
│   ├── models/                     # Schemas Mongoose (6 modelos)
│   ├── routes/                     # Definição das rotas da API (8 arquivos)
│   ├── services/                   # Regras de negócio (6 services)
│   ├── utils/                      # Formatação de resposta e paginação
│   ├── __tests__/                  # Testes Jest + Supertest
│   ├── seed-admin.js               # Script para criar usuário admin local
│   ├── migrate-equipment-model.js  # Script de migração de schema
│   └── test-ldap.js                # Diagnóstico de conexão LDAP
│
└── client/                         # Frontend React/Vite
    └── src/
        ├── components/             # Layout (Header, Sidebar) e componentes reutilizáveis
        ├── pages/                  # Páginas admin e user
        ├── hooks/                  # useAuth, useDebounce, useUrlFilters, usePagination
        ├── services/               # Clientes Axios por entidade
        ├── store/                  # Zustand: authStore, toastStore
        └── utils/                  # Formatadores e utilitário de classes CSS
```

---

## Configuração do ambiente

### Pré-requisitos
- Node.js 20+
- MongoDB 7 rodando na porta `27018`
- Servidor Active Directory acessível via LDAP/LDAPS

### Variáveis de ambiente

Copie o arquivo de exemplo e preencha com os dados do seu ambiente:

```bash
cp .env.example server/.env
```

**server/.env**
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27018/patrimonio_ti
JWT_SECRET=sua_chave_secreta
JWT_EXPIRES_IN=8h

LDAP_URL=ldaps://seu-ad-server:636
LDAP_BASE_DN=DC=empresa,DC=com,DC=br
LDAP_BIND_DN=CN=ServiceAccount,CN=Users,DC=empresa,DC=com,DC=br
LDAP_BIND_PASSWORD=senha_da_service_account
LDAP_USER_SEARCH_BASE=OU=Usuarios,DC=empresa,DC=com,DC=br
LDAP_DOMAIN=empresa.com.br
```

### Instalação

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### Criando o usuário admin local

```bash
cd server
node seed-admin.js
# Credenciais padrão: admin / Admin@1234
```

### Executando em desenvolvimento

```bash
# Backend (porta 5000)
cd server
npm run dev

# Frontend (porta 5173)
cd client
npm run dev
```

O Vite faz proxy automático de `/api` para `http://localhost:5000`.

---

## API — principais endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login (AD ou local) |
| GET | `/api/users` | Listar usuários |
| POST | `/api/users/sync/:username` | Sincronizar usuário do AD |
| POST | `/api/users/import-ad` | Importar usuários em lote do AD |
| GET | `/api/equipment` | Listar equipamentos |
| POST | `/api/equipment` | Criar equipamento |
| POST | `/api/equipment/:id/assign` | Atribuir equipamento |
| POST | `/api/equipment/:id/unassign` | Desatribuir equipamento |
| GET | `/api/equipment-models` | Listar modelos de equipamento |
| GET | `/api/sectors` | Listar setores |
| GET | `/api/audit-logs` | Visualizar logs de auditoria |
| GET | `/api/search?q=termo` | Busca global |

---

## Testes

```bash
cd server
npm test
```

Testes cobrem: autenticação, CRUD de equipamentos, modelos de equipamento e usuários.

---

## Decisões técnicas relevantes

- **EquipmentModel como template** — elimina duplicação de dados entre equipamentos idênticos (mesmo lote, marca, modelo)
- **JWT stateless** — adequado para API REST, sem necessidade de sessão no servidor
- **Zustand no lugar de Redux** — suficiente para o escopo da aplicação, com menos boilerplate
- **Zod em ambas as camadas** — mesma biblioteca de validação no backend e frontend
- **Filtros via query params** — URLs compartilháveis e estado preservado no F5
- **Axios interceptor para 401** — tratamento centralizado de token expirado
- **Audit log automático** — todas as operações destrutivas são registradas sem necessidade de chamada explícita
