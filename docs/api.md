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
| POST `/imports/preview`           | Multipart, campo `file`, máximo 8 MB                                                      |
| POST `/imports/:id/apply`         | Decisões por linha e campo                                                                |
| POST `/assets/:id/photos`         | Multipart `file`; JPEG/PNG até 8 MB; eventId e uploadId opcionais na query                |
| GET `/photos/:id`                 | Arquivo privado autenticado                                                               |
| GET `/audit`                      | Últimas movimentações, administrador                                                      |
| GET `/notifications`              | Situação das notificações, administrador                                                  |
| POST `/jobs/run`                  | Verificação de prazo e tentativa de envio, administrador                                  |
| GET `/reports/:kind`              | Exportação CSV                                                                            |

Relatórios: `byLocation`, `inventories`, `available`, `transferred`, `writtenOff`, `divergences`, `movements`. `byLocation` aceita `locationId`. CSV utiliza UTF-8 com BOM e separador ponto e vírgula; valores que poderiam iniciar fórmulas recebem proteção.

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

Preserve números de patrimônio e códigos como texto no Excel, especialmente zeros à esquerda. A primeira aba deve ter os cabeçalhos `nro_patrimonio`, `descricao_bem`, `grupo_patrimonial`, `codigo_unico`, `unidade_origem`, `data_incorporacao`, `valor_bem`. Há limite de 10.000 linhas por arquivo. Linhas inválidas aparecem na prévia e devem ser ignoradas ou corrigidas em um novo arquivo.

Aplicação:

```json
{
  "decisions": [
    { "line": 2, "action": "APPLY", "fields": ["description"] },
    { "line": 3, "action": "SKIP" }
  ]
}
```

Para ativo novo, APPLY importa os sete campos. Para existente, `fields` seleciona os campos da planilha; os demais permanecem. Omitir `fields` aceita todos os campos divergentes. Linhas sem decisão não são aplicadas. A prévia é consumida uma única vez. Se a versão mudou desde a análise, refaça a prévia; nenhuma linha da transação é aplicada parcialmente.

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
