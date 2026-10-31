# Preparação dos ambientes remotos

Nenhum serviço remoto foi provisionado ou publicado por esta entrega. As configurações estão preparadas para usar as contas do responsável pelo projeto.

## MongoDB Atlas

1. Criar ou selecionar o projeto e o cluster de desenvolvimento.
2. Criar um usuário do banco com leitura/escrita somente no banco de desenvolvimento.
3. Configurar acesso de rede compatível com o ambiente que executa as funções.
4. Guardar a URI e o nome do banco somente nas variáveis do servidor.
5. Executar `npm run db:check` com esse ambiente para validar acesso real.
6. Criar um banco e credenciais separados para produção. Não reutilizar o banco do piloto para testes automatizados.

## Vercel — somente a API

1. Enviar o monorepo completo a um repositório Git próprio.
2. Importar o repositório na Vercel com **Root Directory: `apps/api`** e framework **Other**.
3. Habilitar **Include source files outside of the Root Directory in the Build Step**, pois a API usa `packages/contracts`.
4. Manter a detecção de npm workspaces e do lockfile da raiz. As funções TypeScript serão compiladas pela Vercel; `vercel.json` define a saída estática `public` e não exige um build de frontend.
5. Configurar `MONGODB_URI`, `MONGODB_DATABASE` e `READINESS_TOKEN` no ambiente correto. Nenhuma dessas variáveis vai para o Expo.
6. Publicar um preview e verificar `/api/health` e `/api/readiness` com autorização. O primeiro verifica a API; o segundo verifica o ping no MongoDB.
7. Usar a URL HTTPS resultante como `EXPO_PUBLIC_API_URL` no ambiente do aplicativo.

O servidor de desenvolvimento não será usado na Vercel. As duas entradas de produção estão em `apps/api/api`. O limite inicial de duração é 15 segundos.

## Expo / EAS

Executar os comandos EAS dentro de `apps/mobile`. Antes de gerar builds, trocar `com.example.gibaquadra` nos campos Android e iOS pelo identificador definitivo e confirmar nome/slug do aplicativo.

```powershell
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init
```

Criar `EXPO_PUBLIC_API_URL` nos ambientes **preview** e **production** do projeto Expo, usando a URL HTTPS correspondente da API. Não cadastrar segredos do banco ou do gateway no app.

Para um APK de teste:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

O perfil preview de iOS também está preparado para distribuição interna, mas exige credenciais Apple e o cadastro dos dispositivos conforme o fluxo do EAS. Builds nativos, custos dos provedores e distribuição nas lojas serão realizados nas contas do responsável pelo projeto.

Os comandos `npm run export:android` e `npm run export:ios`, executados na raiz, verificam somente bundles e assets. TestFlight/App Store/Google Play pertencem ao milestone de publicação.
