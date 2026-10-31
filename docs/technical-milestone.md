# Milestone 2 — estrutura técnica

## Entregas de código

- [x] Monorepo com npm workspaces e Node.js 24.
- [x] App Expo/TypeScript com navegação inicial e tema provisório.
- [x] Funções serverless de health e readiness.
- [x] Conexão MongoDB com pool reutilizável, timeouts e respostas sem segredos.
- [x] Script de diagnóstico de conexão, escrita e leitura com limpeza do documento.
- [x] Variáveis de ambiente de exemplo e exclusão de segredos no Git.
- [x] Compose de MongoDB para desenvolvimento e workflow de CI.
- [x] Perfis de build EAS e guia de implantação da API.
- [x] Instruções para execução no Windows, Android Emulator e celular físico.

## Validação desta entrega

Os resultados executados estão registrados em `docs/validation.md`. Exportação de bundle não equivale a build nativo ou execução em dispositivo.

## Pendências para aceitar o milestone no ambiente do projeto

- [ ] Definir o repositório remoto e enviar a base inicial.
- [ ] Configurar MongoDB Atlas com credenciais e acesso de rede do projeto.
- [ ] Publicar a API nas contas do projeto e validar readiness contra Atlas.
- [ ] Configurar o projeto Expo/EAS e a URL HTTPS da API por ambiente.
- [ ] Executar no Android físico ou emulador e validar a conexão.
- [ ] Executar no iPhone/Expo Go ou build apropriado e validar a conexão.

O marco estará aceito quando os dois aplicativos executarem e acessarem a API, e a API validar o banco do ambiente configurado. Login, permissões de negócio, calendário e pagamentos pertencem aos próximos marcos.
