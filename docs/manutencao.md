# Guia para quem assume a manutenção

## Primeiro dia

Leia README, requisitos e fluxos. Execute com um banco local vazio; crie administrador e dois usuários com perfis diferentes. Importe o modelo, abra um inventário e percorra o ciclo completo. Só depois use uma cópia anonimizada de dados institucionais.

## Onde alterar

| Mudança                         | Arquivos principais                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| Regra de estado/reserva/prazo   | backend/src/assets/assets.service.ts e domain/rules.ts                                   |
| Conferência e conflitos offline | backend/src/inventory/inventory.service.ts e mobile/SyncWorker.kt                        |
| Campos da planilha              | backend/src/imports/imports.service.ts, validation.ts e web/Imports.tsx                  |
| Modelo de dados                 | domain/model.ts, persistence/schemas.ts e uma nova migration                             |
| Login/perfis                    | backend/src/auth/auth.ts, auth/passwords.ts, auth/users.service.ts e auth/permissions.ts |
| Tela web                        | web/src/features/ correspondente; app-state.ts para carregar dados                       |
| Câmera                          | mobile/BarcodeCamera.kt                                                                  |
| Dados locais Android            | mobile/LocalStore.kt e migration que preserve fila                                       |
| Foto e armazenamento            | backend/src/files/files.service.ts e notifications/jobs.service.ts                       |
| SMTP                            | backend/src/notifications/jobs.service.ts                                                |

Caminhos mobile completos ficam sob `mobile/app/src/main/java/br/edu/fatec/patrimonio/`. Features web ficam sob `web/src/features/`.

## Regras de contribuição

- Coloque decisões de negócio em services, não apenas na interface.
- Valide entradas na API e autorize no servidor.
- Use transação para dados patrimoniais e histórico.
- Não remova expectedVersion para contornar um conflito.
- Nunca use synchronize=true para produção.
- Não altere migrations já distribuídas.
- Não apague histórico, pendências SQLite ou ativos para resolver um erro.
- Preserve patrimônio e códigos como texto.
- Acrescente um teste que reproduza o problema antes de corrigir uma regra importante.
- Atualize documentação e contrato quando mudar comportamento.

## Testes e qualidade

`npm test` executa regras, transporte web e, quando configurado, PostgreSQL e contrato HTTP. Android valida política de falhas da sincronização. A CI também compila e roda lint. O formato usa Prettier para TypeScript, JSON, CSS e Markdown; o código Kotlin usa ktfmt pelo comando `./gradlew spotlessApply`; `spotlessCheck` verifica sem alterar.

## Diagnóstico

401: sessão expirou ou usuário foi inativado. 403: falta de permissão. 409: dados concorrentes ou transição inválida; recarregue antes de confirmar. Importação com patrimônio duplicado: revise o arquivo, não desative restrições únicas.

E-mails sem envio: confira SMTP_HOST, destinatários nos parâmetros e `/notifications` (permissão settings.manage), que mostra lastError e attempts. Fotos ausentes após restauração: confirme UPLOAD_DIR e cópia do volume. Pendências Android: faça login com a conta original e use Sincronizar; versões antigas ou sessões encerradas precisam de revisão.

## Evolução planejada

Antes de integrar login institucional ou armazenamento cloud, mantenha os contratos públicos e escreva testes dos adaptadores. Para aumentar volume, amplie a paginação das listagens restantes e implemente sincronização incremental antes de carregar bases enormes no aparelho. O modelo Excel real já foi recebido e incorporado; use docs/importacao.md como contrato e preserve fixtures sem dados institucionais.

## Organização e escrita do código

- Use nomes que expliquem o papel do dado (`assetIds`, `dateFrom`, `passwordHash`); use camelCase em funções/variáveis, PascalCase em tipos/classes/componentes e UPPER_SNAKE_CASE em constantes de limite.
- Comente o motivo de uma decisão que não seja óbvia, em frases curtas. Não repita em comentário o que o comando já diz.
- Separe validação de entrada, autorização, regra e apresentação. O controlador mantém o contrato HTTP; `auth/users.service.ts` concentra contas; `auth/passwords.ts`, senhas; `reports/report-query.ts`, consulta limitada; `reports/report-format.ts`, arquivos e datas. Os textos da ajuda ficam em `web/src/features/help-guides.ts`.
- Evite renomeações em massa de campos persistidos ou públicos: `unitId`, `locationId`, `expectedVersion` e chaves das permissões pertencem ao contrato. Mudanças nesses nomes exigem migração e compatibilidade com clientes.
- Prefira operações assíncronas para disco/rede/cálculos de senha durante requisições. Não volte a usar `hashPassword` síncrono em rotas; ele existe para fixtures. Senhas antigas são reconhecidas e atualizadas no login.
- Preserve transações e bloqueio ordenado dos lotes. O erro deve cancelar a operação completa, nunca fingir sucesso parcial.
- Execute `npm run format` e `npm run format:check`. Não inclua credenciais, dados do cliente, APKs ou artefatos gerados nos commits.

## Limites que precisam permanecer visíveis

Relatórios recusam mais de 20.000 bens candidatos ou registros e orientam filtros; não aumente o limite sem medir memória e tempo no servidor. Históricos são consultados em blocos de 500 IDs com datas filtradas no PostgreSQL. Operações de arquivo compartilham dois lugares por processo em `resource-limit.ts`; o excesso retorna 503, sem fila ilimitada. Cálculos de senha têm quatro lugares. As restrições são locais ao processo; várias instâncias exigem limites também no proxy. SMTP tem timeout para não deixar conexões e transações presas indefinidamente.
