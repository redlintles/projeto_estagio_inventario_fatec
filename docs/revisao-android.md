# Revisão Android — coleta de dados

Revisão original: versão 1.1.0 (versionCode 2). A atualização 1.2.0 (versionCode 3) descrita no guia integrado acrescenta leitor em tela inteira e teste de conexão; os resultados instrumentados abaixo pertencem à revisão original. O portal continua responsável pela gestão; o Android identifica bens, registra conferências, condição, divergências e fotos e mantém a fila offline.

| Mudança do projeto                       | Tratamento no Android                                                                                                                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UUID interno e códigos únicos repetidos  | O UUID identifica as operações internamente; as telas usam patrimônio/descrição. Uma etiqueta compartilhada pede escolha explícita pelo patrimônio.                                                  |
| Incorporado, Ativo e demais estados      | Todos os estados têm rótulo legível; apenas Incorporados e Ativos podem ser conferidos.                                                                                                              |
| Unidade cadastrada e localização em lote | A base atualizada recebe os vínculos; ambos aparecem no contexto do bem. O celular não edita unidade nem oferece alterações em lote.                                                                 |
| Desfazer/refazer e versionamento         | Leituras usam a versão capturada. Se o portal alterar o bem antes da sincronização, o servidor recusa a leitura obsoleta e a tentativa permanece para revisão; não há sobrescrita silenciosa.        |
| Permissões individuais                   | Login e atualização consultam as permissões efetivas. Tarefas e abas são limitadas ao acesso concedido; o backend continua sendo a autoridade.                                                       |
| Relatórios, importação e administração   | Permanecem no portal. Disponibilização, reservas e transporte foram removidos do Android para manter o foco na coleta.                                                                               |
| Fotos                                    | Podem acompanhar uma conferência ou entrar na fila como coleta independente. Preparação única para JPEG, até 1600 px no maior lado, orientação corrigida e remoção de metadados.                     |
| Sincronização                            | UUIDs estáveis e etapas persistidas distinguem leitura e foto. Expiração de sessão e erro da foto não reenviam a leitura já aceita. Falhas de permissão de um item não interrompem os demais.        |
| Dados locais                             | Migração SQLite preserva fila e arquivos. Cache e operações ficam separados por endereço do servidor e usuário; cache antigo sem origem comprovada é renovado.                                       |
| Interface                                | Identificar, Inventário, Pendências e Ajuda; confirmação para arquivar tentativas; nomes legíveis e data da atualização. Formulário, identificação, foto e aba são preservados na recriação da tela. |

## Verificações realizadas

- Compilação debug, testes unitários e lint Android.
- Seis testes unitários de estados, regras de coleta e decisão de reenvio.
- Sete testes instrumentados em emulador Android 15, sem falhas: migração SQLite 1→2 preservando fila/foto; isolamento por servidor/conta e duplicidade; preparação/orientação/remoção de GPS; falha HTTP 403 da foto sem reenviar a leitura nem bloquear outro item; foto avulsa sem chamar a rota de conferência; sessão HTTP 401 durante a foto com retomada da etapa correta; atualização atômica da base sem regredir a versão de um bem recém-sincronizado.
- Conferência visual com API fictícia: login de coletor com permissões individuais, etiqueta compartilhada por dois bens, escolha pelo patrimônio, unidade ausente/localização por nome, captura pela câmera virtual, fila da foto e estado Sincronizado. O formulário e a imagem sobreviveram à rotação; a aba foi ajustada para também ser preservada.

## Atualização e limites

Atualizar o APK com `adb install -r` preserva os dados locais. Antes de atualizar, confira o endereço da API: operações da versão antiga não registravam sua origem e a migração as associa ao endereço configurado naquele momento. Não desinstale nem limpe os dados enquanto houver pendências. Na atualização, o cache antigo é renovado; use Atualizar base com conexão antes da próxima coleta.

A identificação por câmera em etiquetas físicas, foco, iluminação, permissões do fabricante e restrições de bateria precisam ser homologados nos aparelhos reais. Nenhum celular físico estava conectado por ADB nesta revisão. Android 8 é o mínimo declarado; a execução instrumentada foi em Android 15. O APK debug permite HTTP para demonstração; a distribuição institucional exige assinatura e HTTPS, conforme a documentação de implantação.

Testes reproduzíveis e API fictícia: `mobile/README.md` e `scripts/mobile-fixture.mjs`.

## Referência de operação integrada — Android 1.2

Consulte [Operação em LAN e coleta Android](operacao-lan.md) para a inicialização conjunta com `npm start`, acesso ao dashboard e à API pela LAN, teste de conexão, leitor em tela inteira, fila offline, compilação do APK e roteiro de aceitação em dispositivos reais.
