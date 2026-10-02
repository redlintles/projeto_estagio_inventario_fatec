# Requisitos e decisões confirmadas

## Fontes

A especificação funcional da faculdade é a base do escopo. O entendimento do aluno complementa offline e reimportação. O agregado de IA ajuda na organização, sem substituir requisitos originais. As confirmações do responsável em 30/09/2026 resolvem as ambiguidades abaixo.

## Decisões

- Backend NestJS, TypeScript, TypeORM e PostgreSQL.
- Portal React, TypeScript e Vite. Uma única API para web e mobile.
- Android Kotlin e Jetpack Compose.
- Componentes em diretórios próprios; documentação e testes fazem parte da entrega.
- Apenas ativos identificados entram no cadastro. Bens sem etiqueta não fazem parte deste escopo.
- Leitura de códigos de barras lineares; QR não é necessário.
- Condição física inteira de 1 a 5, separada do status. `null` significa que o ativo importado ainda não foi avaliado; não há nota zero.
- Reserva deve existir antes do transporte. Ela suspende a contagem para baixa. Cancelamento reinicia o prazo de disponibilização e preserva os eventos anteriores.
- Inventário, divergências e fotos são armazenados offline e sincronizados depois.
- Reimportação apresenta os valores atual e importado e permite escolha por registro ou campo. Dados internos são preservados.
- Login inicial local, com senha protegida por hash. Administrador acumula todas as permissões operacionais.
- Outras unidades são cadastros de destino e destinatários, sem acesso externo obrigatório.
- Sem planilha real disponível: implementar o formato descrito e fornecer um modelo para homologação.

## Funcionalidades e implementação

| Requisito                  | Implementação                                                             |
| -------------------------- | ------------------------------------------------------------------------- |
| Importar Excel e validar   | Prévia persistida, erros por linha, duplicidades, aplicação transacional  |
| Reimportar                 | Comparação de campos oficiais, controle de versão e decisões explícitas   |
| Consultar ativos           | Filtros, detalhes, fotos, reservas e histórico                            |
| Inventário por localização | Sessão, lista esperada, conferências, itens não conferidos                |
| Divergências               | Registro e tratamento explícito; localização preservada até correção      |
| Disponibilizar             | Foto obrigatória, condição, data, histórico e fila de e-mail              |
| Reserva e transferência    | Reserva, transporte, confirmação ou cancelamento                          |
| Monitorar prazo            | Tarefa periódica, regra estrita dias > parâmetro                          |
| Baixar                     | Apenas B, justificativa obrigatória, transação em lote, sem exclusão      |
| Dashboard e relatórios     | Indicadores, CSV por situação, conferências, divergências e movimentações |
| Offline                    | SQLite, fila por usuário, UUID, reenvio idempotente e conflitos           |
| Usuários e perfis          | Administração, patrimonial e consulta, autorização no servidor            |

## Estados oficiais

`A` Ativo → `D` Disponibilizado → `B` A baixar → `X` Baixado.

A partir de `D`, reserva e transporte podem levar a `T` Transferido. Reserva não acrescenta outro status patrimonial: seu estado fica na tabela própria. Não há retorno automático de `T` ou `X` para `A`.

## Critério de aceitação

Um responsável deve conseguir importar uma planilha, organizar localizações, preparar um inventário online, conferir uma sala offline, sincronizar e tratar divergências, disponibilizar ativos com foto, reservar e transferir ou aguardar o prazo e registrar baixa. Os eventos devem permitir identificar autor, instante e alteração.
