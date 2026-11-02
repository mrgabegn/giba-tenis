# Calendário e seleção de horário

O app permite escolher mês, dia, modalidade e início do jogo, consultar ocupações reais e revalidar a seleção na API. Simples dura 90 minutos; duplas, 120. A seleção não grava uma reserva: confirmação, participantes e concorrência da efetivação pertencem ao próximo fluxo.

## Publicar a disponibilidade

Com o MongoDB configurado em `apps/api/.env`, revise `apps/api/config/court-schedule.json` e publique:

```powershell
npm run calendar:configure
npm run calendar:access -- member 30
npm run dev:api
npm run dev:mobile
```

O JSON inicial contém a **proposta provisória** do PO: segunda a sexta, 07:00–22:00, no fuso `America/Sao_Paulo`. Revise os intervalos antes de publicá-los. A API não aplica essa proposta automaticamente: sem configuração publicada, informa que a agenda ainda não foi liberada.

Na tela inicial, toque em **Escolher dia e horário** e informe o código emitido pelo segundo comando. A emissão deve ser feita pelo operador somente para sócios cadastrados. Não coloque esse código em `.env` do mobile, no código-fonte ou em um commit.

O argumento `30` é a validade técnica do código em dias, configurável entre 1 e 365; não representa antecedência nem limite de reservas. `admin` e `teacher` podem ser usados pelo operador para emitir acessos dos respectivos responsáveis. O código é aleatório, armazenado apenas como SHA-256 no MongoDB e mantido somente em memória no app. Essa é uma forma inicial de acesso à consulta, substituível por autenticação gerenciada quando o cadastro/login for definido. Não há cadastro público nem escolha de perfil no celular. O `READINESS_TOKEN` continua exclusivo de monitoramento e não concede acesso à agenda.

## Janelas livres ou inícios exatos

`weekday` segue `0 = domingo` a `6 = sábado`. Cada dia precisa constar uma vez em `weekly`. `windows: []` fecha o dia. É possível cadastrar várias janelas sem sobreposição. A reserva inteira precisa caber numa janela e não pode atravessar uma ocupação.

Sem `startTimes`, o sócio pode informar qualquer início no formato HH:MM dentro de um período livre, sem gerar uma grade presumida de 30, 60 ou 90 minutos. A interface oferece o primeiro início de cada período como atalho.

Se o administrador publicar os inícios exatos, acrescente `startTimes` ao dia:

```json
{
  "weekday": 1,
  "windows": [{ "start": "07:00", "end": "22:00" }],
  "startTimes": ["07:00", "09:15", "14:00", "20:00", "20:30"]
}
```

Esse exemplo demonstra o formato, não representa uma grade aprovada pelo PO. O app mostra botões com os inícios publicados. Um início 20:30 é válido para simples, mas não para duplas com fechamento às 22:00. `startTimes: []` não libera nenhum início.

`overrides` substitui integralmente a configuração semanal de uma data, permitindo feriados e aberturas extraordinárias:

```json
[
  { "date": "2026-11-15", "windows": [] },
  {
    "date": "2026-11-21",
    "windows": [{ "start": "08:00", "end": "12:00" }],
    "startTimes": ["08:00", "10:00"]
  }
]
```

Use datas e horários locais da quadra. Intervalos encerram no mesmo dia; `24:00` é aceito somente como término. Republicar o JSON preserva as ocupações existentes. O comando também aceita um JSON diferente: `npm run calendar:configure -- config/minha-agenda.json` (caminho relativo a `apps/api`).

## Aulas, reservas e bloqueios existentes

A consulta lê `court_occupancies`. Para cadastrar os períodos que já ocupam a quadra, o operador pode importar um JSON como segundo argumento:

```json
[
  {
    "date": "2026-11-03",
    "start": "09:00",
    "end": "10:15",
    "kind": "lesson",
    "responsibleName": "Nome do aluno"
  }
]
```

```powershell
npm run calendar:configure -- config/court-schedule.json config/ocupacoes.json
```

Os tipos são `lesson`, `booking` e `block`. A duração das aulas é explícita; não herda a duração dos jogos. A importação é idempotente por data/início/fim/tipo e não modifica ou remove registros existentes. A consulta considera registros com `active` diferente de `false`. Recorrências ainda precisam ser expandidas para datas concretas pelo futuro cadastro de aulas. Não há edição de aulas no app nem endpoint de escrita; o fluxo futuro deverá permitir alterações de alunos somente ao professor.

Nomes só entram na resposta de professor/administrador. A resposta do sócio contém apenas os períodos e tipos de ocupação, sem nomes, IDs ou participantes. O perfil vem da sessão validada no servidor.

## API e testes

`GET /api/availability?month=2026-11&modality=singles`, com `Authorization: Bearer <código>`, retorna os dias, janelas, períodos livres e ocupações. `modality=doubles` aplica 120 minutos. Acrescentar `date=2026-11-03&start=07:00` revalida a seleção e retorna `selection.available`. A consulta não bloqueia nem garante o horário para uma futura gravação.

Para Expo Web, configure `CALENDAR_ALLOWED_ORIGINS` na API com as origens exatas, como `http://localhost:8081`. Apps nativos também exigem o código de acesso. A rota local e a função da Vercel usam o mesmo handler.

Os testes cobrem funcionamento, exceções, durações, sobreposição, privacidade, autorização, fuso, virada de dia, início já passado, anos bissextos, grade explícita, CORS, erros e revalidação após mudança na agenda. Execute `npm run check`, `npm run export:android` e `npm run export:ios`.

O teste de integração usa `CALENDAR_TEST_MONGODB_URI` e cria/remove somente um banco temporário com nome aleatório. A CI já define essa variável. Na execução local, sem essa variável, somente esse teste é pulado; os demais continuam executando.

O login definitivo, a tela administrativa, a edição das aulas pelo professor e a efetivação concorrente de reservas continuam pendentes. Nenhum pagamento é exigido nesta etapa.
