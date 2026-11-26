# Control EP

Frontend para gestão de presença e equipamentos em **React, Vite e TypeScript**, organizado por responsabilidade. O visual da primeira versão foi mantido.

## Iniciar o projeto

Requer Node.js **22.18 ou superior** e npm. A versão mínima também permite executar os testes TypeScript com o runner nativo do Node.

```sh
npm ci
```

Em uma nova máquina, copie `.env.example` para `.env`. No PowerShell:

```powershell
Copy-Item .env.example .env
```

```sh
npm run dev
```

Abra o endereço exibido pelo Vite no terminal. Após alterar variáveis de ambiente, reinicie o servidor.

## Comandos

| Comando                | Finalidade                                                                     |
| ---------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`          | Servidor de desenvolvimento com atualização automática                         |
| `npm run build`        | Verificação TypeScript e geração da versão de produção em `dist/`              |
| `npm run preview`      | Visualizar o build de produção localmente                                      |
| `npm run typecheck`    | Verificar os tipos sem gerar arquivos                                          |
| `npm test`             | Testar regras de registros, datas, CSV, armazenamento e renderização das rotas |
| `npm run format`       | Formatar o projeto com Prettier                                                |
| `npm run format:check` | Conferir a formatação sem modificar arquivos                                   |

## Organização

```text
src/
├── components/
│   ├── auth/         # Interface compartilhada dos fluxos de acesso
│   ├── forms/        # Campos, filtros de data e formulário de operação
│   ├── layout/       # Sidebar, cabeçalho e rodapé
│   ├── records/      # Ações, campos, histórico e diálogos de registros
│   └── ui/           # Tabela, badge, modal, toast e estado vazio
├── config/           # Configurações públicas de ambiente e menu
├── contexts/         # Dados compartilhados, notificações e diálogos
├── data/             # Dados iniciais da demonstração
├── hooks/            # Persistência local e intervalo de datas
├── layouts/          # Estrutura visual comum às páginas operacionais
├── pages/            # Uma página por rota; filtros locais de cada tela
│   └── auth/         # Login, cadastro e recuperação de senha
├── routes/           # Catálogo de URLs e definição central das rotas
├── services/         # Armazenamento e conversão/validação de registros
├── styles/           # CSS separado por responsabilidade
├── types/            # Contratos TypeScript das entidades
├── utils/            # Funções de datas e exportação CSV
├── App.tsx           # Composição dos providers e rotas
└── main.tsx          # Inicialização do React e do BrowserRouter
docs/
├── architecture.md   # Responsabilidades e orientação de manutenção
└── environment.md    # Variáveis de ambiente e limites de segurança
tests/                # Testes executados pelo Node e smoke tests com Vite
```

Veja [a documentação da arquitetura](docs/architecture.md) para entender o fluxo dos dados e adicionar novas páginas.

## Rotas

| URL                 | Página              | Funções                                         |
| ------------------- | ------------------- | ----------------------------------------------- |
| `/`                 | Painel              | Indicadores por período, equipe e equipamentos  |
| `/presenca`         | Presença            | Registro diário, filtros, impressão e CSV       |
| `/uso-equipamentos` | Uso de equipamentos | Empréstimos, devoluções, filtros e CSV          |
| `/funcionarios`     | Funcionários        | Cadastro, edição, busca e exclusão              |
| `/equipamentos`     | Equipamentos        | Inventário, edição, exclusão, histórico e CSV   |
| `/aprovacoes`       | Aprovações          | Aprovar ou recusar solicitações                 |
| `/gestao`           | Gestão              | Papéis, permissões e configuração da operação   |
| `/usuarios`         | Usuários            | Listagem e atribuição de papéis                 |
| `/login`            | Login               | Entrada com e-mail e senha (sessão por cookies) |
| `/cadastro`         | Cadastro            | Solicitação de acesso (aguarda aprovação)       |
| `/recuperar-senha`  | Recuperação         | Código por e-mail e definição de nova senha     |
| `/redefinir-senha`  | Redefinição         | Orienta a solicitar um novo código              |
| Qualquer outra URL  | Não encontrada      | Retorno ao painel                               |

As páginas internas exigem sessão autenticada. As permissões de cada ação são verificadas pelo back-end.

## Ambiente e GitHub

- `.env`: configuração local, ignorada pelo Git.
- `.env.example`: modelo sem segredos, destinado ao repositório.

**Ignorar um arquivo no Git não torna seus valores secretos no navegador.** Tudo que usa o prefixo `VITE_` aparece no JavaScript de produção. Senhas de banco, segredos JWT e credenciais de e-mail ficam no `.env` do **back-end**.

As configurações públicas ficam centralizadas em `src/config/env.ts`. Leia [a documentação de ambiente](docs/environment.md) antes de adicionar novas variáveis.

## Dados e sessão

Todos os cadastros (funcionários, equipamentos, empréstimos, presença, turnos, usuários e papéis) são lidos e gravados na API; após cada operação a tela recarrega os dados do servidor. Somente a aba "Operação" da Gestão ainda é salva no `localStorage`.

A sessão usa cookies `httpOnly`: um access token curto e um refresh token renovado a cada uso. Quando uma requisição recebe 401, o cliente chama `/refresh` uma única vez e repete a requisição; se a renovação falhar, a sessão é encerrada com a mensagem "Sua sessão expirou". Respostas 403 indicam falta de permissão e não encerram a sessão.

## Publicação

Execute `npm run build` e publique a pasta `dist/`. Configure no servidor o fallback de rotas para `index.html`, necessário para abrir ou atualizar URLs como `/funcionarios` diretamente. `npm run preview` serve para validação local do build.

O layout usa Google Fonts com fallback para fontes sans-serif locais.
