# Arquitetura inicial

O aplicativo chama funções HTTPS. Somente essas funções acessam o MongoDB. Em produção, não há processo próprio de Spring Boot ou Node para manter em execução.

| Componente   | Implementado nesta etapa                                               | Evolução prevista                                       |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| App Expo     | Tela inicial, navegação, tema e diagnóstico da API em desenvolvimento  | Calendário, login, reservas e pagamentos                |
| Funções      | Health público e readiness autenticado                                 | Autorização de usuários, reservas e webhooks            |
| MongoDB      | Configuração, pool reutilizável, ping e diagnóstico de leitura/escrita | Coleções, índices e validações conforme as regras do PO |
| Contratos    | Respostas de saúde e validação no cliente                              | Contratos dos casos de uso de negócio                   |
| Autenticação | Ainda não integrada                                                    | Provedor gerenciado a escolher                          |
| Pagamentos   | Ainda não integrados                                                   | Gateway, webhooks verificados e idempotência            |

## Conexão e limites

- O driver é inicializado de forma lazy: a API de health funciona mesmo sem banco configurado.
- Cada instância aquecida da função reutiliza um `MongoClient`. O pool inicial tem máximo de cinco conexões por servidor e por instância, com timeouts limitados. Esse valor deverá ser revisado conforme o cluster e o volume esperado; não é um limite global do aplicativo.
- Falhas na conexão inicial liberam o estado para uma nova tentativa.
- A API não envia URI, usuário, senha ou mensagens internas do driver ao cliente.
- `READINESS_TOKEN` protege somente o diagnóstico. Não é token de cliente nem credencial para operações de negócio.
- O CORS aberto aplica-se somente ao health público, para diagnóstico pelo navegador. Readiness não recebe essa permissão. Novas rotas terão autorização própria.
- A tela de diagnóstico e seu link são restritos a `__DEV__`. Nome, ícone e identificadores atuais são provisórios.

## Decisões que aguardam o PO

Não foram implementadas coleções de reservas com duração ou preço presumidos. Antes dessa modelagem, precisamos definir horários fixos ou intervalos livres, antecedência, recorrência, política de bloqueio, cancelamento, chuva e pagamento tardio.

Para horários fixos, índices únicos e atualizações condicionais podem proteger a ocupação. Intervalos arbitrários ou reservas que abrangem vários slots precisam de um desenho específico. Uma consulta de disponibilidade seguida de um insert sem proteção de concorrência não será suficiente.

O Compose local usa uma instância standalone. Se a modelagem exigir transações multidocumento, o desenvolvimento precisará de replica set ou Atlas. Essa escolha pertence ao milestone de reservas, após as respostas do PO.

## Ambientes

Desenvolvimento e produção devem usar bancos e segredos diferentes. O pipeline usa `giba_quadra_ci`, um banco temporário independente. As credenciais ficam no provedor serverless; somente `EXPO_PUBLIC_API_URL` vai para o app. A região de execução deve ficar próxima da região do cluster Atlas.
