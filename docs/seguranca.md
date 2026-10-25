# Auditoria de segurança e limites da implantação

Esta revisão cobre o código do backend, portal e cliente Android deste repositório. A inspeção e os testes locais não constituem uma certificação nem garantem ausência absoluta de vazamentos. A rede compartilhada da Fatec deve ser considerada acessível a terceiros; estar na rede interna não substitui autenticação e HTTPS.

## Correções aplicadas

| Problema observado                                                                             | Correção                                                                                                                                                         | Validação                                                            |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Tokens continuavam válidos após redefinição de senha ou reativação de conta                    | Versão de sessão persistida por usuário; troca de senha, perfil ou situação invalida tokens anteriores; endpoint de logout invalida as sessões da conta          | Testes HTTP de revogação e logout                                    |
| Tentativas com e-mails diferentes podiam acumular memória e o hash bloqueava a execução da API | Limites por conexão e conta, contadores com expiração e capacidade máxima; derivação assíncrona e comparação uniforme para contas inexistentes                   | Testes de limite, expiração e resposta 429                           |
| Erros de persistência podiam registrar consultas e parâmetros sensíveis                        | Respostas genéricas e supressão de detalhes de SQL e SMTP nos logs                                                                                               | Revisão do filtro e testes de respostas                              |
| Respostas autenticadas não proibiam armazenamento em cache                                     | Cache-Control no-store, cabeçalhos contra sniffing, enquadramento e referências; CSP no portal e API                                                             | Testes HTTP e verificação do portal servido                          |
| Imagens eram aceitas apenas pelos bytes iniciais                                               | Decodificação e recodificação JPEG/PNG, limite de pixels, rejeição de conteúdo inválido e remoção de EXIF, inclusive coordenadas; gravação com permissão privada | Testes com foto válida, conteúdo falso e reenvio idempotente         |
| Arquivos Excel comprimidos podiam ocupar muito mais memória que o limite de upload             | Inspeção de diretório ZIP e tamanho efetivamente descompactado, limites por entrada/arquivo/linhas/colunas; nenhuma execução de fórmulas                         | Testes com ZIP alterado, dimensões excessivas e arquivos disfarçados |
| Prévia podia ser aplicada por outro administrador e era retida integralmente após uso          | Restrição ao criador, validade de 24 horas, remoção das linhas após aplicação; exclusão das prévias vencidas em novas importações                                | Testes de proprietário e reimportação                                |
| CSV não cobria fórmulas precedidas por espaços                                                 | Neutralização de prefixos perigosos, inclusive após espaços e controles                                                                                          | Testes unitários de CSV                                              |
| Pacote Docker podia incluir planilhas e backups locais                                         | Exclusão explícita de arquivos de cliente, backups e .demo do contexto Docker e do Git                                                                           | Revisão de .gitignore e .dockerignore                                |
| Serviços de exemplo eram publicados em todas as interfaces                                     | Bind local no Compose padrão; API em rede somente com opção explícita --rede                                                                                     | Configuração Compose validada                                        |
| Código compartilhado podia selecionar silenciosamente o primeiro ativo no Android              | Busca por patrimônio ou UUID tem prioridade; código compartilhado exige identificação pelo patrimônio                                                            | Compilação Android e revisão do fluxo                                |

A API e o download de fotos exigem token. Somente administradores gerenciam contas; importação, parâmetros, auditoria, fotos e demais tarefas exigem as respectivas permissões efetivas. Os modelos concedem consultas por padrão, mas uma lista personalizada pode removê-las. A permissão reports.export autoriza os conteúdos oferecidos nos relatórios, inclusive o histórico de movimentações: não a conceda a quem não deva exportar esses dados. Não há segregação de dados entre departamentos ou instituições.

## O que ainda depende da Fatec

- **HTTPS obrigatório para dados reais em trânsito.** O modo de demonstração por HTTP não deve receber a base sensível na rede compartilhada. Implantar proxy HTTPS, nome estável e certificado confiável nos aparelhos. Não ignorar erros de certificado. A release Android já recusa HTTP.
- **Proteção do servidor e backups.** Banco, fotos e snapshots locais não foram convertidos em um cofre criptografado pela aplicação. Configurar criptografia de disco e backups, contas do sistema, permissões e acesso físico; restringir PostgreSQL ao host/rede Docker. Testar restauração e guardar cópias em local protegido.
- **Proteção dos celulares.** A fila SQLite e fotos offline usam o armazenamento privado do aplicativo; isso não equivale a uma garantia de criptografia própria desses arquivos. Exigir bloqueio de tela, aparelhos atualizados, sem root, armazenamento criptografado e procedimento para perda/roubo. Não apagar pendências antes da sincronização. O token usa Android Keystore; backups do app estão desabilitados.
- **Credenciais e autorização.** Substituir a conta e senha da demonstração antes do uso institucional; definir contas individuais e privilégio mínimo. Logout online no portal e no Android revoga todas as sessões da mesma conta; saída Android sem conexão limpa o token local e informa que não houve revogação remota; uma sessão já carregada offline num celular não pode ser apagada remotamente por esta aplicação.
- **Rede e atualizações.** Restringir acesso ao proxy HTTPS e não expor Mailpit ou PostgreSQL. A limitação de tentativas é local ao processo: múltiplas instâncias exigem um limitador compartilhado ou no proxy. O endereço do cliente é obtido da conexão; cabeçalhos X-Forwarded-For não são confiados como identidade.
- **E-mails.** Destinatários configurados por usuários com settings.manage recebem dados e fotos por e-mail. Definir os destinatários aprovados, servidor SMTP com TLS e política institucional de retenção; SMTP em produção exige TLS.
- **Documentação da API.** Swagger fica desabilitado por padrão. ENABLE_API_DOCS=true deve ser usado somente em ambiente controlado; não é uma ferramenta de autenticação.
- **Monitoramento.** Definir responsável por atualizações, revisão de acessos, disponibilidade, alertas, retenção de dados, descarte e resposta a incidentes. O histórico do aplicativo não impede adulteração por um administrador do banco.

A análise de dependências deve ser repetida com `npm audit --omit=dev` após atualizações. Resultado sem alertas indica somente ausência de avisos conhecidos retornados pelo registro consultado, não ausência de vulnerabilidades. A planilha original não foi adicionada ao Git e não foi enviada a ferramentas externas de busca.

## Referências da revisão

- [OWASP sobre sessões e invalidação após mudanças de privilégios](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP sobre uploads e limites após descompactação](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

## Acesso por tarefa

Contas existentes mantêm os perfis como modelos. A lista personalizada de permissões substitui o modelo e é conferida no backend em cada operação; esconder menus é uma conveniência da interface. Somente ADMIN administra contas e nenhum campo de permissões permite promover a própria conta. A conta principal mantém acesso global e é protegida contra inativação/rebaixamento também por restrição no PostgreSQL. Mudanças de permissões revogam as sessões existentes. O Android atualizado usa a lista de permissões no login e na atualização da base; clientes antigos continuam sujeitos às mesmas verificações do servidor, mas precisam da nova versão para mostrar corretamente tarefas concedidas individualmente.

## Revisão do portal e backend em 16/10/2026

Escopo desta rodada: backend, portal, proxy de exemplo e documentação; nenhum código Android alterado. Principais correções:

- Criação, troca e verificação de senha usam scrypt assíncrono com até quatro cálculos simultâneos. Novos hashes guardam versão e usam N=16384, r=8, p=5, uma das combinações indicadas pela OWASP. Hashes antigos N=16384/r=8/p=1 continuam válidos e são atualizados após login correto, com atualização condicional para não sobrescrever troca de senha concorrente. Não é necessário redefinir contas existentes. Rebaixar a versão do servidor depois da atualização exige cuidado: versões antigas não reconhecem o novo hash.
- Relatórios limitam a leitura a 20.000 bens candidatos ou registros e recusam o excesso sem exportação parcial. Históricos consultam datas no PostgreSQL e dividem IDs em blocos de 500; dados de usuários são selecionados apenas por nome e ID.
- Uploads de fotos, análise de importações e relatórios compartilham limite de duas operações simultâneas por processo. O excesso retorna 503 com Retry-After, sem reter fila ilimitada na memória. Esses controles reduzem o risco; não substituem teste de carga, proxy e monitoramento.
- JSON malformado retorna 400 sem ecoar conteúdo recebido. O portal mostra os motivos da recusa de download em vez de esconder limites em uma mensagem genérica.
- O proxy admite 9 MB no corpo para comportar arquivo de 8 MB e campos multipart; o backend mantém o limite de 8 MB do arquivo. Cabeçalhos de segurança também são enviados nas respostas de erro. Tempos máximos de conexão do proxy e SMTP evitam esperas sem limite. O pool PostgreSQL tem 10 conexões, conexão inicial de até 10 segundos, consulta de até 60 segundos e transação ociosa de até 60 segundos; consultas interrompidas retornam 503 sem detalhes SQL.
- A limpeza dos contadores de login é periódica e respeita a expiração individual; não percorre todas as contas em toda requisição normal.

`npm audit` e `npm audit --omit=dev` não retornaram alertas conhecidos nesta data. Isso não certifica a aplicação: HTTPS, backups protegidos, restrição da rede, destinatários aprovados de e-mail e homologação da máquina continuam necessários. Referências: [armazenamento de senhas OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) e [proxy Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

## Referência de operação integrada — Android 1.2

O modo LAN publica apenas API e portal em todas as interfaces; PostgreSQL e Mailpit não são expostos à LAN. A consulta de saúde no Android não envia token nem troca a sessão. Restrinja portas 3000/8080 à rede autorizada; a distribuição institucional usa release assinado e HTTPS. Consulte o [guia integrado](operacao-lan.md) para os procedimentos.
