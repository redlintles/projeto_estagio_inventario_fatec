# Registro de validação

## Registro histórico de 30/09/2026

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

## Revisão de 16/10/2026 — portal e backend

A planilha institucional já foi recebida e incorporada ao parser; a observação de ausência da fonte no registro histórico acima descreve apenas aquela primeira validação. A revisão Android posterior está em docs/revisao-android.md e não foi repetida nesta rodada.

Esta rodada cobre ajuda e documentação, separação da gestão de contas/consulta/formatação de relatórios, nomes mais descritivos e comentários simples nas decisões de segurança. As correções de disponibilidade e segurança estão detalhadas em docs/seguranca.md.

Verificações: build TypeScript do backend e portal; 65 testes backend, incluindo HTTP e integração PostgreSQL em banco descartável; 5 testes web; Prettier; diff sem erros de whitespace; auditoria npm sem alertas conhecidos. O teste de histórico cobre 3.903 movimentações para 1.301 ativos. Não foram usados dados institucionais nos testes.

O roteiro de navegador verifica login, navegação, ajuda, prévia, download XLSX e viewport estreito na instalação de teste. HTTPS institucional, proteção de disco/backups, SMTP definitivo, carga simultânea e recuperação continuam dependentes da implantação e homologação no ambiente de destino.
