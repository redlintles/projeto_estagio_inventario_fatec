# Modelo de dados

A sequência de migrations registrada no DataSource é a autoridade do esquema. `synchronize` permanece desabilitado. Não altere o banco manualmente para fazer uma mudança permanente de funcionalidade.

| Tabela            | Conteúdo e integridade                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `users`           | Nome, e-mail único, hash versionado, perfil, permissões, principal e versão de sessão     |
| `locations`       | Código único, descrição, prédio, andar, observação e situação                             |
| `units`           | Código único, nome, e-mail e situação                                                     |
| `assets`          | UUID interno, campos oficiais, status, unidade cadastrada, localização, condição e versão |
| `reservations`    | Ativo, destino, solicitante e etapas do transporte                                        |
| `movements`       | Antes/depois, operação, autor, justificativa e instante                                   |
| `inventories`     | Localização, responsável, estado e ativos esperados no início                             |
| `inventory_items` | Uma conferência por ativo e sessão, resultado e instante observado                        |
| `divergences`     | Tipo, descrição encontrada, localização observada e resolução                             |
| `photos`          | Metadados privados, vínculo ao ativo e opcionalmente à divergência                        |
| `settings`        | Prazo e listas de destinatários                                                           |
| `outbox`          | Notificação pendente/enviada, tentativas e erro mais recente                              |
| `import_batches`  | Prévia imutável em JSON, versões esperadas e decisões aplicadas                           |
| `sync_receipts`   | UUID de operação, autor, hash do payload e resultado já aplicado                          |

`assets.id` é o UUID imutável. `assets.patrimony` tem restrição única para conciliar reimportações; `assets.uniqueCode` pode se repetir e é preservado como veio na fonte. `unitId` é o vínculo com uma unidade cadastrada; `originUnit` preserva o conteúdo original da planilha. Valores monetários usam `decimal(15,2)` e transitam como string para evitar arredondamento binário. `condition` aceita 1 a 5 ou null quando não avaliada. Chaves estrangeiras preservam relações; não há exclusão de ativos exposta na API.

```mermaid
erDiagram
 ASSET ||--o{ MOVEMENT : historico
 ASSET ||--o{ PHOTO : fotos
 ASSET ||--o{ RESERVATION : transferencia
 UNIT ||--o{ RESERVATION : destino
 LOCATION ||--o{ ASSET : localizacao
 LOCATION ||--o{ INVENTORY : conferencias
 INVENTORY ||--o{ INVENTORY_ITEM : leituras
 ASSET ||--o{ INVENTORY_ITEM : encontrado
 ASSET ||--o{ DIVERGENCE : divergencias
 USER ||--o{ MOVEMENT : autor
```

## Histórico e exclusão

A API não oferece DELETE para ativos, fotos, movimentações ou inventários. Localizações, unidades e usuários são inativados. Ativos baixados continuam consultáveis e são recusados nos fluxos de alteração. O histórico não é uma proteção criptográfica contra administradores do banco; restrinja credenciais e acesso direto em produção.

## Migrations futuras

Crie uma classe `MigrationInterface` com timestamp novo, registre no DataSource e valide em banco descartável. Não edite uma migration que já foi aplicada em outra instalação. Acrescente coluna inicialmente nullable quando houver dados existentes, preencha dados e somente depois imponha restrições. O rollback de esquema pode remover dados: faça backup e planeje-o.

## Banco do aparelho

SQLite contém `snapshots` e `operations`. Cada operação tem UUID, usuário, inventário, ativo, payload, estado, erro e foto local. Pendências não são removidas ao sair da conta. A desinstalação ou limpeza dos dados Android remove tudo; o aplicativo desabilita backup automático para evitar restaurar tokens/fila em outro aparelho inadvertidamente.

## Histórico de alterações em lote

`asset_batches` preserva campo alterado, destino, responsável, estado e revisão do lote; a coluna JSON `asset_batches.items` guarda valores anteriores e versões de cada ativo. `asset_batch_events` registra aplicações, reversões e reaplicações. Esses registros complementam as movimentações individuais, sem substituí-las. Aplicar, desfazer e refazer alteram ativos e histórico na mesma transação. Nenhuma dessas operações muda o UUID nem a coluna de unidade original.

## Referência de operação integrada — Android 1.2

A atualização 1.2 não exige migration adicional: preserva esquema do servidor, SQLite, IDs de reenvio e isolamento das filas por servidor/conta. O teste de conexão não troca o servidor persistido da sessão. Consulte o [guia integrado](operacao-lan.md) para os procedimentos.

## Inventário guiado — versão 1.3

Inventários admitem OPEN, CLOSED e CANCELLED. Itens admitem CONFIRMED, DIVERGENCE e NOT_FOUND. expectedIds mantém o snapshot inicial, sem alterar o denominador por mudanças posteriores no cadastro. Nenhuma tabela Android é apagada: comandos COMPLETE/CANCEL usam a fila existente. Veja o [guia de inventário Android](inventario-android.md).
