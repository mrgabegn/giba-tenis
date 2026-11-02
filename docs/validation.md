# Validação da estrutura técnica

Executada em 31/10/2026, com Node.js 24.22.1 e npm 11.9.0.

| Verificação                       | Resultado                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| Instalação do monorepo            | Concluída; lockfile gerado e árvore de dependências sem conflitos reportados por `npm ls`   |
| TypeScript                        | Aprovado nos três workspaces                                                                |
| Testes automatizados              | 14 aprovados, sem falhas                                                                    |
| Formatação                        | Prettier aprovado                                                                           |
| Bundle Android                    | Gerado com Metro/Hermes, incluindo assets                                                   |
| Bundle iOS                        | Gerado com Metro/Hermes, incluindo assets                                                   |
| API HTTP local                    | Health GET 200; health POST 405; readiness sem autorização 401; rota inexistente 404        |
| Falha real de conexão             | Readiness autenticado devolveu 503 e resposta sanitizada quando o banco estava indisponível |
| Consistência de dependências Expo | Checagem local/offline aprovada; checagem online não concluída por timeout de rede          |

Os testes automatizados cobrem autorização antes do acesso ao banco, falhas sem exposição de informações internas, contratos de resposta, compartilhamento de uma tentativa de conexão entre requisições concorrentes e recuperação após falha inicial. Os testes de ciclo de conexão usam o método `connect` simulado; não comprovam um handshake real com MongoDB.

## Verificações pendentes

- MongoDB real: o binário oficial 8.0.16, com SHA256 conferido, não pôde iniciar neste ambiente (`open: Operation not permitted`). Por isso, leitura/escrita reais não foram aprovadas. O script `db:check`, o Compose e a execução com MongoDB na CI estão preparados para essa validação no ambiente do projeto.
- Interface em execução: a tentativa de validação automatizada no navegador não foi concluída porque o navegador do Playwright não está instalado. Não houve teste visual nem teste em dispositivo nesta entrega.
- Android e iPhone: execução em aparelhos/emuladores permanece pendente. Bundles exportados não são APK/IPA e não comprovam execução nativa.
- Atlas, Vercel e EAS: nenhum serviço remoto foi provisionado ou publicado. A CI foi escrita, mas ainda não executada no GitHub.

Não há gateway de pagamento, autenticação de clientes ou dados reais de usuários integrados nesta etapa.

## Calendário — validação de 02/11/2026

Esta atualização acrescenta o calendário e supera as pendências de MongoDB local e interface web registradas na entrega inicial acima. Ambiente: Node.js 24.22.1 e npm 11.9.0.

| Verificação                    | Resultado                                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                | TypeScript nos três workspaces, 32 testes aprovados sem skips com `CALENDAR_TEST_MONGODB_URI` e Prettier aprovado                                                                           |
| MongoDB 8.0.17 temporário      | Publicação, importação idempotente, índices, emissão de acesso, hash, expiração, revogação, perfis e privacidade validados contra o banco real                                              |
| Expo Web com API e banco reais | Seleção de simples/duplas, fechamento, navegação mensal, atualização, nova ocupação antes da seleção, grade explícita, falha de rede com nova tentativa e visibilidade por perfil aprovados |
| Layout no navegador            | Conferido em larguras de 320, 390 e 1440 pixels, sem rolagem horizontal nem erros de execução no navegador                                                                                  |
| Android e iOS                  | Bundles Metro/Hermes e assets exportados; execução nativa em aparelhos/emuladores permanece pendente                                                                                        |

As verificações usam apenas dados e códigos de acesso de teste. Nenhum banco do usuário, Atlas, Vercel ou EAS foi alterado. A efetivação concorrente de reservas e o login definitivo ainda não fazem parte deste fluxo de seleção.
