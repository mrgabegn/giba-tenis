# Arquitetura inicial

O aplicativo chama funções HTTPS. Somente essas funções acessam o MongoDB. Em produção, não há processo próprio de Spring Boot ou Node para manter em execução.

| Componente   | Implementado nesta etapa                                                      | Evolução prevista                                 |
| ------------ | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| App Expo     | Tela inicial, calendário, seleção de horário e diagnóstico em desenvolvimento | Login definitivo e efetivação de reservas         |
| Funções      | Health, readiness e disponibilidade com autorização por perfil                | Reservas e integração com autenticação gerenciada |
| MongoDB      | Pool, diagnóstico, configuração da quadra, ocupações e sessões de consulta    | Escrita concorrente de reservas                   |
| Contratos    | Saúde, agenda, durações, intervalos e validação no cliente                    | Contratos de efetivação de reservas               |
| Autenticação | Códigos individuais de consulta emitidos pelo operador, com hash e validade   | Provedor gerenciado a escolher                    |
| Pagamentos   | Ainda não integrados                                                          | Gateway, webhooks verificados e idempotência      |

## Conexão e limites

- O driver é inicializado de forma lazy: a API de health funciona mesmo sem banco configurado.
- Cada instância aquecida da função reutiliza um `MongoClient`. O pool inicial tem máximo de cinco conexões por servidor e por instância, com timeouts limitados. Esse valor deverá ser revisado conforme o cluster e o volume esperado; não é um limite global do aplicativo.
- Falhas na conexão inicial liberam o estado para uma nova tentativa.
- A API não envia URI, usuário, senha ou mensagens internas do driver ao cliente.
- `READINESS_TOKEN` protege somente o diagnóstico. Não é token de cliente nem credencial para operações de negócio.
- O CORS aberto aplica-se somente ao health público. Readiness não recebe essa permissão. Disponibilidade exige autorização própria e permite somente origens web explicitamente configuradas.
- A tela de diagnóstico e seu link são restritos a `__DEV__`. Nome, ícone e identificadores atuais são provisórios.

## Decisões que aguardam o PO

O [calendário](calendar.md) lê `court_settings`, `court_occupancies` e `calendar_sessions`. As durações confirmadas são 90 minutos para simples e 120 para duplas. A configuração aceita janelas livres ou inícios exatos, conforme a publicação da administração; nenhum espaçamento fixo é gerado automaticamente. A proposta de segunda a sexta, 07–22h, só entra em vigor após a publicação explícita da configuração.

A seleção consulta novamente o servidor e não grava ocupação. Antes da efetivação, ainda precisamos fechar antecedência, recorrência, cancelamento, chuva, identificação dos participantes e confirmação/aprovação. Pagamentos ficam para a segunda fase.

Para horários fixos, índices únicos e atualizações condicionais podem proteger a ocupação. Intervalos arbitrários ou reservas que abrangem vários slots precisam de um desenho específico. Uma consulta de disponibilidade seguida de um insert sem proteção de concorrência não será suficiente.

O Compose local usa uma instância standalone. Se a modelagem exigir transações multidocumento, o desenvolvimento precisará de replica set ou Atlas. Essa escolha pertence ao milestone de reservas, após as respostas do PO.

## Ambientes

Desenvolvimento e produção devem usar bancos e segredos diferentes. O pipeline usa `giba_quadra_ci`, um banco temporário independente. As credenciais ficam no provedor serverless; somente `EXPO_PUBLIC_API_URL` vai para o app. A região de execução deve ficar próxima da região do cluster Atlas.
