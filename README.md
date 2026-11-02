# Giba Quadra — estrutura técnica

Base de um aplicativo de agendamento para uma quadra de tênis. Nome, identidade visual e identificadores são provisórios.

| Parte              | Tecnologia                                                  |
| ------------------ | ----------------------------------------------------------- |
| Aplicativo         | React Native, Expo SDK 58, Expo Router e TypeScript         |
| Execução confiável | Funções Node.js/TypeScript preparadas para Vercel           |
| Banco único        | MongoDB, usando o driver oficial, sem ORM                   |
| Organização        | Monorepo com npm workspaces e contratos compartilhados      |
| Verificação        | TypeScript, testes com node:test, Prettier e pipeline de CI |

O aplicativo usa o Expo SDK 58 e requer uma versão do Expo Go compatível com esse SDK no celular. O lockfile fixa as versões efetivamente instaladas. Não atualize a versão de React Native isoladamente; use as ferramentas do Expo ao atualizar o SDK.

O projeto inclui a fundação técnica e o calendário com seleção de dia e horário, disponibilidade configurável, durações de simples/duplas e consulta de ocupações com acesso restrito. Veja [como publicar a agenda e emitir acesso aos sócios](docs/calendar.md). A seleção ainda não efetiva reservas. Login definitivo e o fluxo de reservas seguem nos próximos milestones; pagamentos ficam para a segunda fase.

## Executar no Windows

Pré-requisitos: Node.js 24, npm 11+, Git e Expo Go no celular. Docker Desktop/WSL é opcional se usar MongoDB Atlas. Os comandos abaixo são para PowerShell, na pasta raiz extraída do projeto.

```powershell
node --version
npm --version
npm ci
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

Se usa NVM for Windows, selecione Node 24 para este projeto. O arquivo `.nvmrc` registra a versão principal esperada.

### 1. Banco de desenvolvimento

Com Docker Desktop em execução:

```powershell
docker compose up -d mongodb
npm run db:check
```

O Compose disponibiliza um MongoDB local em `127.0.0.1:27017`, persistido em volume. Essa configuração sem autenticação é exclusiva do desenvolvimento local; a porta fica vinculada ao localhost. Não a use como configuração de produção.

Se preferir Atlas, preencha `MONGODB_URI` e `MONGODB_DATABASE` em `apps/api/.env` com um banco de desenvolvimento e configure o acesso de rede desse ambiente. Execute o mesmo `npm run db:check`. O comando cria um documento temporário em `__diagnostics`, lê o documento e o remove.

### 2. API local

No primeiro terminal:

```powershell
npm run dev:api
```

Verifique `http://localhost:3000/api/health`. A resposta precisa ter `service: "giba-quadra-api"` e `status: "ok"`. Esse endpoint confirma somente a API, sem consultar o banco.

Para o diagnóstico autenticado do MongoDB, gere um token no computador:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copie o valor gerado para `READINESS_TOKEN` em `apps/api/.env` e reinicie a API. O endpoint `/api/readiness` exige `Authorization: Bearer <token>`. Sem token configurado, responde 503; sem autorização válida, responde 401. Esse token é apenas de monitoramento e não substitui a futura autenticação de clientes.

### 3. Aplicativo no celular

Edite `EXPO_PUBLIC_API_URL` em `apps/mobile/.env`:

| Onde o app roda                          | URL da API local               |
| ---------------------------------------- | ------------------------------ |
| Celular físico                           | `http://IP_DO_COMPUTADOR:3000` |
| Android Emulator                         | `http://10.0.2.2:3000`         |
| iOS Simulator ou navegador do computador | `http://localhost:3000`        |

No Windows, `ipconfig` mostra o IPv4 do computador na rede Wi-Fi. Celular e computador precisam estar na mesma rede; permita a conexão do Node na rede privada se o firewall bloquear o acesso. No celular físico, `localhost` aponta para o próprio celular.

No segundo terminal:

```powershell
npm run dev:mobile
```

Abra pelo QR code no Expo Go. A tela inicial tem o link **Verificar conexão com a API**, disponível apenas em desenvolvimento. Ele valida uma resposta real da API, sem simular sucesso. O botão não consulta o MongoDB; use `db:check` ou o endpoint autenticado de readiness para isso.

Após mudar `.env`, encerre e reinicie o Expo. Se necessário:

```powershell
npm run start --workspace @giba-quadra/mobile -- --clear
```

Nenhum segredo pode usar o prefixo `EXPO_PUBLIC_`: esses valores entram no bundle do celular. O app recebe somente a URL pública da API.

## Verificações

```powershell
npm run check
npm run db:check
npm run export:android
npm run export:ios
```

Os comandos `export` verificam a geração dos bundles JavaScript e assets de cada plataforma. Eles não geram APK/IPA e não substituem testes em dispositivos. A CI também executa o teste de escrita e leitura com um MongoDB temporário.

## Estrutura

| Caminho                    | Responsabilidade                                               |
| -------------------------- | -------------------------------------------------------------- |
| `apps/mobile/src/app`      | Rotas e telas do aplicativo                                    |
| `apps/mobile/src/services` | Cliente HTTP e validação de respostas                          |
| `apps/api/api`             | Entradas das funções serverless                                |
| `apps/api/src`             | Conexão MongoDB, configuração e handlers                       |
| `apps/api/scripts`         | Diagnóstico real de escrita e leitura                          |
| `apps/api/tests`           | Testes de disponibilidade, autorização e erros                 |
| `packages/contracts`       | Tipos e validação compartilhados, sem dependências de servidor |
| `docs`                     | Arquitetura, implantação e pendências do milestone             |
| `.github/workflows/ci.yml` | Validação preparada para um futuro repositório GitHub          |

O servidor HTTP de `apps/api/src/dev-server.ts` existe para executar as mesmas funções localmente. Em produção, cada arquivo de `apps/api/api` será executado pela plataforma serverless.

## Git e próximos ambientes

O pacote não inclui a pasta interna `.git`. Para iniciar o seu repositório depois de extrair:

```powershell
git init -b main
git add .
git commit -m "chore: estrutura tecnica inicial"
```

Consulte [arquitetura](docs/architecture.md), [implantação](docs/deployment.md) e [status do milestone](docs/technical-milestone.md). Contas de Atlas/Vercel/Expo, credenciais, builds nativos e publicação ainda dependem da configuração do ambiente do responsável pelo projeto.

## Fontes técnicas

- [Template oficial e transição de SDK](https://docs.expo.dev/more/create-expo/)
- [Monorepos no Expo](https://docs.expo.dev/guides/monorepos/)
- [EAS Build com monorepos](https://docs.expo.dev/build-reference/build-with-monorepos/)
- [Funções Node.js na Vercel](https://vercel.com/docs/functions/runtimes/node-js)
- [Arquivos fora da raiz na Vercel](https://vercel.com/docs/monorepos/monorepo-faq)
- [Pools do driver MongoDB](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/connection-pools/)
