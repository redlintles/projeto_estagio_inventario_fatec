# Registro de validação

Verificação de desenvolvimento em 30/09/2026, usando PostgreSQL 17 temporário, separado dos bancos existentes na máquina.

| Verificação                                  | Resultado                                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| Backend e portal TypeScript                  | Build concluído                                                                   |
| Testes de regras, PostgreSQL e contrato HTTP | 20 testes aprovados; detalhes em docs/testes.md                                   |
| Transporte do portal                         | 2 testes aprovados                                                                |
| Android assembleDebug                        | APK gerado                                                                        |
| Android testDebugUnitTest                    | 4 testes de sincronização aprovados                                               |
| Android lintDebug                            | Sem erros; avisos principalmente de versões disponíveis                           |
| Navegador Chrome                             | Login, dashboard, ativos/histórico, cadastro, telas e viewport mobile verificados |
| Dependências npm de produção                 | Auditoria sem vulnerabilidades reportadas                                         |
| Formatação                                   | Prettier para TypeScript/documentação e ktfmt para Kotlin                         |

A validação do navegador usa `scripts/web-smoke.mjs` e deve apontar para uma instalação de teste. Defina SMOKE_WEB_URL, SMOKE_EMAIL, SMOKE_PASSWORD e, se necessário, CHROME_PATH. O roteiro cadastra uma localização e salva imagens em `/tmp/fatec-web-qa`.

Não havia aparelho ou emulador Android conectado durante esta validação. Câmera real, coleta sem rede e comportamento de bateria devem ser homologados seguindo docs/testes.md. O ambiente Docker fornecido não foi implantado como servidor definitivo. A planilha oficial não foi fornecida; o parser foi validado com planilhas construídas a partir dos campos descritos.
