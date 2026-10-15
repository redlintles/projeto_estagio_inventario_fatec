# Contrato da API

Base: `/api`. Swagger em `/api/docs`, documento JSON em `/api/docs-json`. Todas as rotas, exceto login e health, exigem `Authorization: Bearer TOKEN`. O token dura 8 horas. A API verifica usuário ativo e perfil a cada chamada.

## Perfis

Consulta lê ativos, localizações, unidades, inventários, divergências, indicadores e relatórios. Patrimonial acrescenta inventário, fotos, localização, condição, disponibilização, reserva, transporte, transferência, tratamento e baixa. Administrador acumula tudo e gerencia usuários, parâmetros, cadastros, importação, auditoria e tarefas.

## Rotas

| Método e rota                     | Uso                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| GET `/health`                     | Disponibilidade do processo; não garante que o banco está saudável                        |
| POST `/auth/login`                | `{email,password}` → `{token,user}`                                                       |
| GET `/auth/me`                    | Usuário e perfil atuais                                                                   |
| GET `/dashboard`                  | Contagens por status e divergências pendentes                                             |
| GET `/assets`                     | Filtros patrimony, description, group, status e locationId; offset e limit para paginação |
| POST `/assets`                    | Cadastro manual com os sete campos oficiais                                               |
| GET `/assets/:id`                 | Ativo, fotos, reservas e movimentações                                                    |
| POST `/assets/:id/location`       | `{expectedVersion,locationId}`                                                            |
| POST `/assets/:id/available`      | `{expectedVersion,condition}`; requer foto existente                                      |
| POST `/assets/:id/reservations`   | `{expectedVersion,destinationUnitId}`                                                     |
| POST `/reservations/:id/dispatch` | Iniciar transporte, com expectedVersion                                                   |
| POST `/reservations/:id/complete` | Confirmar envio realizado, com expectedVersion                                            |
| POST `/reservations/:id/cancel`   | Cancelar e reiniciar prazo, com expectedVersion                                           |
| POST `/write-offs`                | `{assets:[{id,expectedVersion}],justification}`                                           |
| GET/POST `/locations`             | Listar ou criar localização                                                               |
| PATCH `/locations/:id`            | Alterar descrição, prédio, andar, observação ou active                                    |
| GET/POST `/units`                 | Listar ou criar unidade                                                                   |
| PATCH `/units/:id`                | Alterar nome, e-mail ou active                                                            |
| GET/POST `/users`                 | Listar sem hash ou cadastrar usuário                                                      |
| PATCH `/users/:id`                | Alterar perfil, senha ou active                                                           |
| GET/POST `/settings`              | Listar ou salvar `{name,value}`                                                           |
| GET/POST `/inventories`           | Listar ou iniciar com `{locationId}`                                                      |
| GET `/inventories/:id`            | Sessão, itens e missingIds                                                                |
| POST `/inventories/:id/scans`     | Conferência online                                                                        |
| POST `/inventories/:id/close`     | Encerrar pelo responsável ou administrador                                                |
| POST `/sync`                      | Aplicação idempotente de uma conferência offline                                          |
| GET `/divergences`                | Filtros status, type, locationId, from e to                                               |
| POST `/divergences/:id/resolve`   | `{resolution,newLocationId?}`                                                             |
| GET `/imports/template`           | Modelo Excel                                                                              |
| POST `/imports/preview`           | Multipart, campo `file` (máximo 8 MB) e `unitId` obrigatório (UUID de unidade ativa)      |
| POST `/imports/:id/apply`         | Decisões por linha e campo                                                                |
| POST `/assets/:id/photos`         | Multipart `file`; JPEG/PNG até 8 MB; eventId e uploadId opcionais na query                |
| GET `/photos/:id`                 | Arquivo privado autenticado                                                               |
| GET `/audit`                      | Últimas movimentações, administrador                                                      |
| GET `/notifications`              | Situação das notificações, administrador                                                  |
| POST `/jobs/run`                  | Verificação de prazo e tentativa de envio, administrador                                  |
| GET `/reports/:kind`              | Exportação filtrada CSV, XLSX ou ODS                                                      |

Relatórios: `byLocation`, `inventories`, `available`, `transferred`, `writtenOff`, `divergences`, `movements`. Todos os relatórios aceitam os filtros descritos na seção Relatórios para leitura humana. CSV utiliza UTF-8 com BOM e separador ponto e vírgula; valores que poderiam iniciar fórmulas recebem proteção.

## Cadastro e importação

```json
{
  "patrimony": "000001",
  "description": "Mesa escolar",
  "group": "Mobiliário",
  "uniqueCode": "000001",
  "originUnit": "FATEC",
  "incorporationDate": "2026-09-30",
  "value": "250.00"
}
```

Use os cabeçalhos institucionais descritos em `docs/importacao.md`; o formato técnico antigo continua aceito. POST `/imports/preview` exige `unitId` e vincula os novos bens à unidade ativa escolhida, preservando a coluna original Unidade. Diferenças de `unitId` nos bens existentes geram conflito. A operação importa imediatamente os novos registros válidos em transação e retorna `imported`, `unchanged`, `issues` e `rows`. `rows` contém exclusivamente registros existentes com diferenças; `issues` contém linhas inválidas, que não são gravadas. O nome da rota foi mantido por compatibilidade, mas a análise já pode inserir bens. Reenviar o mesmo arquivo não duplica as inclusões.

Aplicação:

```json
{
  "decisions": [
    { "line": 2, "action": "APPLY", "fields": ["description"] },
    { "line": 3, "action": "SKIP" }
  ]
}
```

O endpoint `/imports/:id/apply` recebe decisões apenas dos conflitos retornados em `rows`. Todos os conflitos devem ter uma escolha; novos e idênticos não são enviados para decisão. APPLY atualiza os campos divergentes selecionados e SKIP mantém os dados atuais. A revisão é consumida uma única vez. Se a versão de um conflito mudou desde a análise, nenhuma decisão da revisão é aplicada parcialmente; as inclusões automáticas da etapa anterior permanecem gravadas. A prévia é privada ao criador e expira em 24 horas.

## Conferência offline

```json
{
  "operationId": "UUID-gerado-no-aparelho",
  "inventoryId": "UUID-do-inventario-preparado",
  "input": {
    "assetId": "UUID-do-ativo",
    "expectedVersion": 3,
    "observedAt": "2026-09-30T15:00:00Z",
    "condition": 4,
    "divergence": {
      "type": "WRONG_LOCATION",
      "foundDescription": "Mesa encontrada no laboratório",
      "notes": "Diverge da sala cadastrada"
    }
  }
}
```

`condition` e `divergence` são opcionais. Sem divergência, uma confirmação explícita atualiza localização e, se informada, condição. Com divergência, preserva dados oficiais. Tipos: WRONG_LABEL, WRONG_ITEM, DUPLICATE, WRONG_LOCATION, OTHER. Resposta contém `asset`, `item` e `divergenceId`. Depois de aplicar a operação, envie a foto com o eventId retornado.

Reenvie o mesmo UUID e payload para obter o resultado já aplicado. Mudar o payload com o mesmo UUID produz 409. O servidor associa o recibo ao usuário autenticado. Registro offline não autoriza alterar um ativo baixado, uma sessão fechada ou uma versão desatualizada.

## Erros

- 400: entrada inválida, foto ausente, cadastro incompatível.
- 401: token inválido/expirado ou usuário inativo; refazer login.
- 403: perfil sem permissão.
- 404: identificador não encontrado.
- 409: duplicidade, versão antiga ou transição incompatível. Revisar estado atual.
- 500: falha interna, sem expor SQL ou credenciais ao cliente.

Sempre confira o código HTTP. Mensagens são voltadas ao operador; o cliente não deve identificar tipos de erro por comparar textos.

## Paginação e foto idempotente

Ativos aceitam offset não negativo e limit de 1 a 5.000 (padrão 1.000). O portal usa páginas de 100 e o Android carrega páginas de 1.000 até o fim. Os relatórios de ativos não são truncados por esse limite.

Para fotos offline, envie uploadId igual ao UUID da operação local. Reenviar mesmo usuário, ativo, evento e bytes retorna o metadado existente; conteúdo diferente com o mesmo UUID responde 409. Evita duplicações quando a resposta do primeiro envio é perdida.

### Localização em lote

POST `/assets/location-batch` (Patrimonial ou Administrador): `{ "locationId": "UUID", "assets": [{ "id": "UUID", "expectedVersion": 1 }] }`. Aceita de 1 a 500 bens distintos nos estados Incorporado/Ativo. A localização deve estar ativa. A operação é atômica, verifica versões e registra auditoria individual. Retorna `{ "updated": 2, "unchanged": 0 }`. GET `/assets?unitId=UUID` filtra pelo vínculo cadastrado.

### Unidade em lote

POST `/assets/unit-batch` (Patrimonial ou Administrador): `{ "unitId": "UUID", "assets": [{ "id": "UUID", "expectedVersion": 1 }] }`. Aceita de 1 a 500 bens distintos nos estados Incorporado/Ativo e exige unidade ativa. Preserva `originUnit` e localização. A operação é atômica, verifica versões e registra `UNIT_BATCH` no histórico de cada bem alterado. Retorna `{ "updated": 2, "unchanged": 0 }`; bens já vinculados não recebem nova versão.

### Seleção global, confirmação e reversão

- POST `/asset-batches/selection`: `{filters:{...}}`, retorna `matched` e `selected` (somente Incorporado/Ativo), ignorando paginação.
- POST `/asset-batches/preview`: `{field:"unitId"|"locationId",targetId,assets?:[{id,expectedVersion}],filters?:{...}}`. Informe exatamente uma seleção manual (até 500) ou filtros (todas as páginas). Retorna `id`, `changed`, `selected`, `skipped`, `unchanged` e `targetLabel`. Captura IDs e versões naquele instante; ativos que passarem a corresponder depois não entram nessa confirmação.
- POST `/asset-batches/:id/apply`: confirma a prévia do próprio usuário em até 30 minutos. Verifica versões e destino ativo e aplica tudo em transação. As rotas antigas de lote também passam a registrar histórico.
- GET `/asset-batches?offset=0`: histórico persistente de lotes, 25 por página, incluindo responsável, campo, destino, contagens e reversões.
- POST `/asset-batches/:id/undo`: restaura os valores individuais anteriores (inclusive nulos), mantendo auditoria e incrementando versões. Qualquer alteração posterior de um ativo bloqueia a reversão integral. Uma reversão não pode ser repetida. Operadores Patrimoniais e Administradores podem consultar e desfazer os lotes.

Filtros `unitId=none` e `locationId=none` localizam valores ausentes. A prévia não altera ativos. Lotes antigos, executados antes da criação deste histórico, permanecem apenas na auditoria individual e não possuem reversão automática.

### Relatórios para leitura humana

GET `/reports/:kind/preview` recebe os mesmos filtros da exportação e retorna título, colunas, até 30 linhas, quantidade total e critérios legíveis. GET `/reports/:kind` exporta todos os resultados (sem paginação), com `format=csv|xlsx|ods` (padrão CSV por compatibilidade). Tipos: `byLocation` (todos os ativos), `available`, `transferred`, `writtenOff`, `inventories`, `divergences`, `movements`.

Filtros combináveis: `patrimony`, `description`, `group` (contém), `status`, `unitId`, `locationId`, `dateFrom` e `dateTo` (AAAA-MM-DD, inclusivas). IDs de unidade/localização aceitam `none` para vínculo ausente. Relatórios específicos de status impõem D/T/X e rejeitam status contraditório. O período de ativos considera incorporação; nos demais, data de conferência, criação da divergência ou movimentação, no fuso de São Paulo. Os filtros do bem usam o cadastro atual, inclusive em relatórios históricos. Datas invertidas, parâmetros extras e formatos inválidos são recusados.

Os arquivos não expõem colunas de UUID, hashes ou objetos JSON; usam patrimônio e referências por código/nome, responsáveis por nome, status traduzidos e resumos das alterações. Códigos patrimoniais e de origem permanecem textos para preservar zeros iniciais. XLSX e ODS preservam valores monetários numéricos e datas formatadas, com uma aba de critérios. CSV usa UTF-8 com BOM, separador ponto e vírgula, decimais com vírgula e neutralização de fórmulas. Resultados vazios mantêm cabeçalhos. A exportação refaz a consulta e pode refletir alterações posteriores à prévia.

### Permissões por usuário

Os perfis ADMIN, PATRIMONIAL e CONSULTA permanecem como modelos compatíveis com contas existentes. Usuários não administradores podem ter uma lista explícita `permissions`: `null` usa o modelo do perfil, `[]` não concede tarefas e uma lista substitui as permissões do modelo. As consultas necessárias são incluídas pelo servidor. ADMIN sempre tem acesso global e somente administradores podem criar/editar contas. O catálogo de tarefas fica em `backend/src/auth/permissions.ts` e é espelhado no portal com teste de equivalência.

POST `/users` aceita `permissions` opcional. PATCH `/users/:id` aceita `permissions`, `role`, `active` e `password`. Nomes de permissão desconhecidos são recusados. GET `/users` devolve a configuração persistida e `primaryAdmin`, sem hashes. Login e `/auth/me` retornam as permissões efetivas; o guard lê o usuário atual do banco em cada requisição. Alterações em conta invalidam tokens anteriores. Mesmo com papel PATRIMONIAL, uma lista personalizada vazia bloqueia todas as tarefas; mesmo com papel CONSULTA, uma tarefa explicitamente concedida pode ser executada.

O administrador principal é identificado na migração pela conta administrativa ativa correspondente ao BOOTSTRAP_EMAIL (ou pela primeira conta administrativa ativa disponível) e protegido por restrição no banco: deve permanecer ativo e ADMIN. Não pode ser desativado, rebaixado ou receber permissões limitadas. Outros administradores não podem redefinir sua senha; o próprio principal pode trocá-la. Contas criadas por bootstrap em instalação nova recebem essa proteção.

Permissões de lote são distintas: `batches.unit`, `batches.location`, `batches.undo`. Prévia e aplicação também verificam o campo do lote, impedindo que a permissão de unidade altere localizações. `reports.export` controla consultas e downloads; `imports.manage` controla o modelo, upload e resolução. Consultas de ativos, inventários, divergências, indicadores, unidades e localizações também são verificadas explicitamente. Autenticação, encerramento da própria sessão e consulta do próprio acesso permanecem disponíveis para toda conta ativa.

### Refazer lotes e processamento em blocos

POST `/asset-batches/:id/redo` exige `batches.redo`, recebe um lote UNDONE e retorna `{id,restored,revision}`. Revalida versões salvas na reversão, valores anteriores, estados Incorporado/Ativo e destino original ativo. Não aceita filtros ou seleção nova: somente os bens efetivamente alterados pelo lote original são reaplicados. Requisições simultâneas/repetidas são serializadas pelo bloqueio do lote; somente a transição válida é aplicada. Cada ciclo atualiza versões de ativos e do lote.

GET `/asset-batches/:id/events` devolve as versões cronológicas, com APPLY/UNDO/REDO, responsável, contagem e data. O histórico original é preservado; cada transição inclui um evento adicional e auditoria individual completa (BATCH_UNDO/BATCH_REDO nas reversões e reaplicações). A migração converte lotes antigos UNDONE para que também possam ser refeitos, desde que não tenham alterações posteriores.

Aplicar, desfazer e refazer usam bloqueio ordenado dos ativos, validação conjunta e escrita de ativos/auditoria em blocos de 500, todos na mesma transação. Uma falha em qualquer bloco cancela tudo, incluindo versões e eventos; não há confirmação parcial. Valores nulos anteriores são preservados. Bloqueios concorrentes têm espera limitada e retornam mensagem para tentar novamente. Não há atualização por registro via ORM ou milhares de consultas individuais. `batches.redo` integra o modelo PATRIMONIAL e o acesso global ADMIN; listas personalizadas existentes precisam conceder essa tarefa explicitamente.
