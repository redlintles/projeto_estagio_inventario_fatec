# Guia para quem assume a manutenção

## Primeiro dia

Leia README, requisitos e fluxos. Execute com um banco local vazio; crie administrador e dois usuários com perfis diferentes. Importe o modelo, abra um inventário e percorra o ciclo completo. Só depois use uma cópia anonimizada de dados institucionais.

## Onde alterar

| Mudança                         | Arquivos principais                                                     |
| ------------------------------- | ----------------------------------------------------------------------- |
| Regra de estado/reserva/prazo   | backend/src/assets/assets.service.ts e domain/rules.ts                  |
| Conferência e conflitos offline | backend/src/inventory/inventory.service.ts e mobile/SyncWorker.kt       |
| Campos da planilha              | backend/src/imports/imports.service.ts, validation.ts e web/Imports.tsx |
| Modelo de dados                 | domain/model.ts, persistence/schemas.ts e uma nova migration            |
| Login/perfis                    | backend/src/auth/auth.ts, controller.ts e mobile/Session.kt             |
| Tela web                        | web/src/features/ correspondente; app-state.ts para carregar dados      |
| Câmera                          | mobile/BarcodeCamera.kt                                                 |
| Dados locais Android            | mobile/LocalStore.kt e migration que preserve fila                      |
| Foto e armazenamento            | backend/src/files/files.service.ts e notifications/jobs.service.ts      |
| SMTP                            | backend/src/notifications/jobs.service.ts                               |

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

E-mails sem envio: confira SMTP_HOST, destinatários nos parâmetros e `/notifications` (administrador), que mostra lastError e attempts. Fotos ausentes após restauração: confirme UPLOAD_DIR e cópia do volume. Pendências Android: faça login com a conta original e use Sincronizar; versões antigas ou sessões encerradas precisam de revisão.

## Evolução planejada

Antes de integrar login institucional ou armazenamento cloud, mantenha os contratos públicos e escreva testes dos adaptadores. Para aumentar volume, amplie a paginação das listagens restantes e implemente sincronização incremental antes de carregar bases enormes no aparelho. Faça homologação do formato Excel real quando ele for fornecido.
