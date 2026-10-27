# Colocar o sistema em funcionamento — Windows e Linux

**Entrada recomendada para quem não é técnico:** leia `LEIA-ME-PRIMEIRO.txt`, instale Docker manualmente, extraia o ZIP e use `INSTALAR.cmd` (Windows) ou `bash instalar.sh` (Linux). O assistente faz as perguntas e executa toda a preparação. As seções abaixo também documentam os comandos de manutenção para suporte.

Este é o guia de produção. O portal, a API (parte que processa os dados) e o banco ficam no mesmo computador. O Docker prepara esses componentes automaticamente. O Docker precisa ter o plugin Compose 2.24.4 ou superior. Não instale Node.js, PostgreSQL ou Nginx separadamente. Não use `npm start` ou `iniciar.sh` para produção: eles iniciam a demonstração, com dados diferentes.

## 1. Antes de começar

Separe um computador dedicado, ligado à energia e à rede por cabo se possível. Como ponto de partida, reserve 4 núcleos, 8 GB de memória e 30 GB livres, aumentando o espaço conforme fotos e backups. Isso é uma referência inicial, não uma capacidade medida. A instalação precisa de internet para baixar programas e montar o sistema; os downloads podem demorar. Depois, o uso local não depende de internet, exceto serviços externos como e-mail e renovação de certificados públicos.

Use Windows 11 compatível com Docker Desktop e WSL 2, ou uma versão de Ubuntu/Debian de 64 bits ainda suportada pelo Docker. Outros Linux podem usar o mesmo `producao.sh`, mas precisam instalar Docker Engine e Compose pelo procedimento da própria distribuição. Windows Server não é atendido pelo Docker Desktop: prefira Linux nesse caso. Consulte os requisitos atuais do fabricante antes de escolher a máquina:

- [Docker Desktop para Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
- [Docker Engine para Linux](https://docs.docker.com/engine/install/).

Peça ao responsável pela rede uma única preparação: reservar um IP para esse computador (por exemplo, `192.168.1.50`), permitir que os computadores e celulares alcancem esse endereço e liberar a porta HTTPS escolhida (443 por padrão) somente para a rede autorizada. O IP do exemplo é ilustrativo: use o endereço fornecido por ele. Não abra portas no roteador para a internet. Apenas a porta HTTPS é publicada; banco e API não têm portas próprias expostas.

A máquina deve ficar ligada, sem suspensão automática. Configure essa opção nas configurações de energia. O sistema para de atender se ela desligar ou dormir.

## 2. Copiar o projeto

1. Receba a pasta completa desta versão do projeto, ou baixe o ZIP da versão aprovada.
2. Extraia o ZIP antes de executar qualquer arquivo. Não abra o programa dentro do ZIP.
3. No Windows, coloque em uma pasta local, por exemplo `C:\FatecPatrimonio`. No Linux, use uma pasta local permanente. Evite OneDrive, pastas de rede e pendrives para a instalação.
4. Confira se a pasta contém `INICIAR-PRODUCAO.cmd`, `producao.sh`, `scripts` e `infra`. Mantenha os arquivos juntos.
5. Não copie `.demo`, `node_modules` ou uma pasta `producao` de outra instalação. Uma migração de dados existentes exige restauração, descrita no final deste guia.

## 3A. Windows — preparar uma vez

1. Abra o [instalador oficial do Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/), baixe a versão correspondente ao processador e execute o instalador.
2. Quando oferecido, escolha o uso de WSL 2. Aceite a autorização de administrador. Reinicie o computador se solicitado.
3. Se aparecer a mensagem de que é necessário instalar/atualizar o WSL, abra o menu Iniciar, procure **Terminal**, clique com o botão direito e escolha **Executar como administrador**. Digite `wsl --install`, pressione Enter e reinicie. Se o Docker pedir atualização, use `wsl --update` no mesmo terminal. Siga as mensagens do instalador.
4. Abra **Docker Desktop** pelo menu Iniciar e aguarde o mecanismo ficar em execução. Use contêineres Linux. Se ele informar que a virtualização está desativada, peça à pessoa responsável pelo computador para habilitá-la; essa opção depende do fabricante.
5. Em **Settings > General**, habilite a opção de iniciar Docker Desktop ao entrar no Windows. A tradução/nome da opção pode variar. O Docker Desktop depende de uma sessão de usuário: após reiniciar, entre no Windows e aguarde o Docker abrir. Para servidor que precise funcionar sem login, prefira Linux.
6. Volte à pasta do projeto. Dê dois cliques em **INICIAR-PRODUCAO.cmd**. Se o Windows ocultar extensões, o nome pode aparecer apenas como **INICIAR-PRODUCAO**. É o arquivo do tipo script de comandos, não uma pasta.
7. Na primeira execução, digite o IP reservado ou nome fornecido pelo responsável da rede e pressione Enter. Não escreva `https://`, barras nem número de porta.
8. Aguarde a mensagem **Servicos iniciados**. Não feche a janela durante os downloads. A janela fica aberta para leitura; pressione uma tecla ao terminar.

Alternativa pelo terminal aberto na pasta:

```bat
.\INICIAR-PRODUCAO.cmd
```

Os scripts não alteram permanentemente a política do PowerShell. A execução é liberada somente para esse processo local. Políticas institucionais podem impedir scripts; nesse caso o administrador da máquina precisa autorizar os arquivos entregues.

## 3B. Linux — preparar uma vez

No Ubuntu ou Debian, abra a pasta do projeto no gerenciador de arquivos. Clique com o botão direito em um espaço vazio e escolha **Abrir no terminal** (o nome pode variar). Cole e execute:

```bash
bash scripts/instalar-docker-linux.sh
```

O instalador usa o repositório oficial do Docker. Ele pede a senha do seu usuário para instalar programas; o terminal não mostra caracteres enquanto você digita a senha. Isso é normal. Ele atende Ubuntu/Debian e não remove um Docker ou runtime já existente. Se detectar uma instalação anterior incompleta, peça ao responsável para conferir `sudo docker compose version` antes de continuar. Fonte do procedimento: [instalação oficial no Ubuntu](https://docs.docker.com/engine/install/ubuntu/) e [Debian](https://docs.docker.com/engine/install/debian/).

Quando concluir, execute na mesma pasta:

```bash
sudo bash producao.sh
```

Informe o IP reservado ou nome do servidor, sem `https://`, barras ou porta. Aguarde **Serviços iniciados**. Nas próximas vezes, o mesmo comando inicia tudo e preserva a configuração e os dados. O `sudo` evita exigir a inclusão do usuário no grupo privilegiado do Docker. Se seu usuário já possui acesso autorizado ao Docker, pode usar `bash producao.sh`.

Em outras distribuições, instale [Docker Engine](https://docs.docker.com/engine/install/) e o [plugin Compose](https://docs.docker.com/compose/install/linux/), habilite o serviço Docker e use o mesmo comando acima. Não existe um instalador seguro único para todas as distribuições Linux.

## 4. HTTPS e primeiro acesso

O endereço será `https://IP_RESERVADO` ou `https://NOME_FORNECIDO`. Abra exatamente o endereço informado pelo script. No próprio servidor também use esse endereço, e não `localhost`, se tiver configurado um IP.

Por padrão, o projeto cria um certificado local para criptografar a conexão. O navegador só confiará nele depois que a instituição instalar o certificado nas máquinas clientes. O script copia o certificado público para `producao/certificado-local.crt`. Compartilhe **somente esse arquivo público** com quem configura os computadores. Nunca compartilhe a pasta `caddy` dos backups: ela contém a chave privada da autoridade certificadora.

### Computadores Windows

1. Confira com o responsável que o arquivo `certificado-local.crt` veio desta instalação.
2. Dê dois cliques no certificado e escolha **Instalar certificado**.
3. Escolha **Computador local** (exige administrador), **Colocar todos os certificados no repositório a seguir**, **Procurar**, **Autoridades de Certificação Raiz Confiáveis** e conclua.
4. Feche e reabra o navegador. Acesse o endereço HTTPS novamente.

### Computadores Ubuntu/Debian

Na máquina que acessará o portal, copie o arquivo público e execute a partir da pasta dele:

```bash
sudo cp certificado-local.crt /usr/local/share/ca-certificates/fatec-patrimonio.crt
sudo update-ca-certificates
```

Feche e reabra o navegador. Navegadores com armazenamento próprio de certificados podem exigir importação nas configurações de certificados/autoridades. O responsável pelos computadores deve conferir isso. Não oriente usuários a ignorar o aviso de segurança.

### Celulares e endereço institucional

O APK release exige HTTPS e certificado confiável. Instalar uma autoridade apenas como certificado de usuário no Android não garante que o aplicativo confie nela. Para produção com celulares, peça à TI que prepare um nome institucional e certificado confiável pelo Android, ou distribua a autoridade como confiança de sistema em aparelhos gerenciados. Teste no APK release antes de iniciar coletas reais. A simples execução do script não comprova essa confiança.

Para certificado público automático, a TI deve configurar um domínio que aponte para o servidor e a validação ACME compatível com a rede. No arquivo `producao/.env`, altere `SITE_HOST` para esse domínio e `TLS_MODE` para um endereço de e-mail institucional válido (por exemplo `TLS_MODE=ti@instituicao.edu.br`). O Caddy usa esse e-mail para emissão pública. A validação padrão precisa que a autoridade alcance o servidor na porta 443 (validação TLS-ALPN); redes internas sem essa possibilidade precisam de outro método preparado pela TI, como validação DNS ou um proxy institucional. Não exponha a máquina à internet apenas para contornar isso. Execute o iniciador novamente depois da preparação.

A API do celular será o mesmo endereço do portal acrescido de `/api`, por exemplo `https://patrimonio.instituicao.edu.br/api`.

## 5. Entrar pela primeira vez

1. Abra a pasta **producao** criada ao lado do iniciador. Ela contém um arquivo **.env**. No Linux, `Ctrl+H` mostra arquivos ocultos.
2. Abra `.env` com Bloco de Notas/editor de texto, sem alterar nada. Se necessário, use **Abrir com**. Não renomeie para `.env.txt`.
3. O login é o e-mail escolhido no assistente; o padrão é `admin@fatec.local`. No assistente novo, use `producao/ACESSO.txt`. Nas instalações antigas, a senha é o texto à direita de `BOOTSTRAP_PASSWORD=`. Copie apenas a senha, sem o nome da variável nem o sinal `=`.
4. Acesse o portal com esse login e senha. Cadastre as contas nominais e permissões de quem usará o sistema na gestão de usuários. Atualize a senha administrativa pelo fluxo de gestão disponível e guarde a senha atual em local seguro. Executar o iniciador novamente não redefine uma conta existente.
5. Guarde `.env` protegido: ele também contém as senhas internas do banco e o segredo de sessão. Não envie em e-mails, chamados ou capturas de tela. No Windows, mantenha a pasta em uma conta protegida e restrinja a leitura nas propriedades de segurança à conta operadora e aos administradores. No Linux os scripts criam os arquivos privados.
6. Antes de importar dados reais, entre a partir de outro computador, cadastre um registro de teste, envie uma foto e confira o resultado. Se houver Android, teste conexão, login, foto e sincronização offline usando o APK release. Consulte [operação Android](operacao-lan.md).

O e-mail automático precisa de uma conta SMTP real. Sem ela, os e-mails permanecem pendentes; Mailpit não faz parte da produção. Peça ao responsável pelo e-mail os valores de `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM`; eles ficam em `producao/.env`. Depois, execute o iniciador novamente e configure destinatários na tela Parâmetros. Não invente credenciais. Valores contendo `$`, `#` ou espaços precisam da sintaxe de aspas do arquivo de ambiente do Compose; a TI deve preparar esses valores.

## 6. Rotina diária e reinício

### Windows: ativar a inicialização automática uma vez

1. Conclua a primeira instalação com **INICIAR-PRODUCAO.cmd** e confirme que o portal abre.
2. No Docker Desktop, abra **Settings > General**, marque **Start Docker Desktop when you sign in to your computer** e aplique a alteração. [Referência do Docker](https://docs.docker.com/desktop/settings-and-maintenance/settings/).
3. Na pasta do projeto, dê dois cliques em **ATIVAR-INICIO-AUTOMATICO.cmd**. Aguarde a confirmação e pressione uma tecla para fechar. Não precisa executar como administrador.
4. Reinicie o computador e entre **na mesma conta do Windows** usada na ativação. Aguarde alguns minutos e abra o portal pelo endereço já configurado. Não é necessário abrir o iniciador manualmente.
5. Se não abrir, confira `producao/inicializacao-automatica.log`. O processo espera até 10 minutos pelo Docker; se falhar, abra Docker Desktop e execute **INICIAR-PRODUCAO.cmd** para obter a mensagem de erro.

O ativador cria um atalho na [pasta de inicialização da conta do Windows](https://support.microsoft.com/en-us/windows/experience/startup-boot/configure-startup-applications-in-windows). Ele espera o Docker ficar pronto e inicia as imagens já instaladas, sem compilar nem baixar uma nova versão. Atualizações continuam sendo feitas pelo iniciador manual. O atalho pode executar com uma janela minimizada; o registro da última tentativa é substituído a cada execução.

**Isso ocorre após o login, não antes dele.** Docker Desktop e esta configuração dependem da sessão de usuário. Para voltar ao atendimento após falta de energia sem ninguém entrar na conta, use Linux com Docker Engine habilitado no boot ou uma infraestrutura de servidor preparada pela TI. O ativador não configura login automático nem salva a senha do Windows. Bloquear a tela é diferente de encerrar a sessão; para operação contínua, mantenha a conta conectada e desative a suspensão.

Para cancelar, dê dois cliques em **DESATIVAR-INICIO-AUTOMATICO.cmd**, na mesma conta. Isso remove apenas o atalho de inicialização; não para os serviços nem apaga dados. Para parar naquele momento, use **PARAR-PRODUCAO.cmd**. Com a opção automática ativa, os serviços voltam no próximo login, mesmo se tiverem sido parados manualmente. Se mover a pasta do projeto, execute o ativador novamente para atualizar o caminho.

### Comandos de operação

| O que fazer           | Windows                                                                             | Linux, no terminal da pasta    |
| --------------------- | ----------------------------------------------------------------------------------- | ------------------------------ |
| Iniciar ou retomar    | Dois cliques em `INICIAR-PRODUCAO.cmd`                                              | `sudo bash producao.sh`        |
| Parar com segurança   | Dois cliques em `PARAR-PRODUCAO.cmd`                                                | `sudo bash producao.sh parar`  |
| Fazer backup          | Dois cliques em `BACKUP-PRODUCAO.cmd`                                               | `sudo bash producao.sh backup` |
| Ver situação          | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\production.ps1 status` | `sudo bash producao.sh status` |
| Ver mensagens de erro | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\production.ps1 logs`   | `sudo bash producao.sh logs`   |

Após a mensagem de sucesso, pode fechar o terminal: o sistema continua rodando. Ao reiniciar Linux, o Docker e os serviços com reinício automático voltam, desde que não tenham sido parados manualmente. No Windows, entre na sessão e abra Docker Desktop, ou use a opção automática descrita acima. Em ambos, executar o iniciador é a forma explícita de retomar após parada manual. Depois de falta de energia, confira acesso antes de retomar o trabalho.

Use uma única pasta e execute um iniciador por vez. Não execute backup junto com atualização ou outra inicialização. Não use as opções **Delete**, **Clean/Purge data**, **Factory reset** ou remoção de volumes no Docker: elas podem apagar o banco e as fotos. Parar o sistema não apaga dados. Copiar apenas a pasta do código não copia o banco, que fica nos volumes do Docker.

## 7. Backup — faça todos os dias de uso

1. Avise as pessoas para interromper o uso. Sincronize os celulares primeiro.
2. Execute o botão/comando de backup da tabela. O portal ficará indisponível durante esse procedimento.
3. Aguarde **Backup concluído**. Se aparecer erro, não considere aquela cópia válida. O script mantém o sistema parado; corrija a causa e refaça.
4. Abra `producao/backups`. Cada pasta tem a data/hora em UTC e contém `banco.dump`, `fotos.tar.gz`, `config.env` e `caddy`.
5. Copie a pasta completa para outro dispositivo ou armazenamento institucional com controle de acesso. Uma cópia no mesmo disco não protege contra perda da máquina. Guarde várias datas; não substitua a única cópia boa.
6. Execute o iniciador para voltar ao atendimento.

O backup inclui banco, fotos, configuração e autoridade HTTPS local. Proteja-o como dados confidenciais. O backup é manual; este projeto não configura agenda ou destino externo automaticamente. A instituição deve designar uma pessoa e uma rotina. Teste a restauração em outra máquina antes de depender dessas cópias.

## 8. Atualizar sem perder os dados

1. Avise os usuários e faça backup completo com os passos acima.
2. Pare o sistema. Guarde a versão antiga do código e o backup em outro local.
3. Extraia a nova versão na mesma pasta, preservando **producao**. Não substitua `.env` nem limpe os volumes do Docker.
4. Execute o iniciador. Ele compila a versão recebida, aplica as alterações de banco uma vez no serviço de inicialização e verifica a saúde dos serviços.
5. Confira login, consulta, foto e sincronização antes de liberar o acesso. Atualizações do Android devem preservar os dados locais; nunca desinstale com pendências.

Se uma atualização falhar, preserve os dados e peça suporte. Retornar somente o código pode ser incompatível com alterações do banco/senhas. Restaurar um backup anterior perde o trabalho feito depois dele e exige decisão do responsável.

## 9. Quando algo não funcionar

| Mensagem ou situação                            | Ação                                                                                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker não encontrado                           | Instale Docker conforme a seção do seu sistema e reabra o terminal.                                                                                 |
| Cannot connect / daemon / permission denied     | Windows: abra Docker Desktop e aguarde. Linux: use `sudo bash producao.sh`; confira se Docker está ativo.                                           |
| Download ou build falhou                        | Confira internet, espaço livre e acesso aos servidores de pacotes. Execute novamente; a configuração existente é preservada.                        |
| Port already allocated / address already in use | Outro programa usa a porta HTTPS escolhida. Peça ao responsável para identificar o conflito; não encerre programas desconhecidos.                   |
| Inicialização demorou e terminou em erro        | Use `status` e `logs`. Serviços podem continuar ativos. Após corrigir a causa, execute o iniciador novamente.                                       |
| Só abre no servidor                             | Confira IP, reserva de endereço, firewall e conexão da rede/Wi-Fi com o responsável da rede.                                                        |
| Aviso de certificado                            | Confira endereço e instale a autoridade conforme seção 4. Não ignore o aviso.                                                                       |
| Login não funciona                              | Use a senha atual da conta. `.env` guarda a senha inicial, que pode ter sido alterada depois. Não apague o banco para recuperar acesso.             |
| E-mail não chega                                | Confira SMTP, destinatários e fila de pendências. Sem SMTP, mensagens não saem.                                                                     |
| Banco vazio após mudança de máquina/pasta       | Não importe de novo por impulso. Confirme o Docker/contexto correto e restaure o backup com suporte. Demonstração e produção usam bancos separados. |

Para pedir suporte, envie a mensagem do erro e a versão do projeto, sem senhas nem `.env`. Os logs podem conter informações internas; revise antes de compartilhar.

## 10. Restauração — procedimento para o responsável técnico

A restauração deve ser feita em uma instalação vazia e isolada, com a mesma versão do código do backup. Não há botão de restauração para sobrescrever produção por acidente. O operador não técnico deve entregar o backup completo ao responsável. Abaixo está a sequência para quem administra a máquina.

1. Instalar Docker e colocar o código da versão correspondente em uma pasta permanente. Não iniciar o portal ainda.
2. Criar `producao`, copiar `config.env` do backup para `producao/.env` e restringir permissões. Manter `SITE_HOST` se o mesmo endereço puder ser reservado; qualquer mudança precisa de nova validação de HTTPS. Não gerar novas senhas do banco sobre volumes existentes.
3. Executar os comandos abaixo a partir da raiz do projeto. No Linux, antepor `sudo` ao `docker` se necessário. Nos exemplos, substituir `CAMINHO_BACKUP` pelo caminho da pasta que contém `banco.dump` e `fotos.tar.gz`.

```text
docker compose --env-file producao/.env -f infra/compose.production.yaml up -d --wait database
docker compose --env-file producao/.env -f infra/compose.production.yaml cp CAMINHO_BACKUP/banco.dump database:/tmp/restaurar.dump
docker compose --env-file producao/.env -f infra/compose.production.yaml exec -T database pg_restore --exit-on-error --no-owner -U patrimonio -d patrimonio /tmp/restaurar.dump
docker compose --env-file producao/.env -f infra/compose.production.yaml exec -T database rm /tmp/restaurar.dump
docker compose --env-file producao/.env -f infra/compose.production.yaml build initialize web
docker compose --env-file producao/.env -f infra/compose.production.yaml create --no-deps backend gateway
```

Restaure as fotos no volume compartilhado e a autoridade HTTPS no contêiner criado:

```text
docker compose --env-file producao/.env -f infra/compose.production.yaml run --rm --no-deps --user root --entrypoint sh --volume CAMINHO_ABSOLUTO_BACKUP:/backup:ro backend -c "tar xzf /backup/fotos.tar.gz -C /app/uploads && chown -R node:node /app/uploads"
docker compose --env-file producao/.env -f infra/compose.production.yaml cp CAMINHO_BACKUP/caddy/. gateway:/data/caddy
```

No `--volume`, use caminho absoluto e envolva o argumento inteiro em aspas se contiver espaços. No Windows, por exemplo `--volume "C:\Backups\copia:/backup:ro"`. Não use redirecionamento `>` de dump binário no Windows PowerShell antigo: ele pode corromper o arquivo.

4. Executar o iniciador normal. As migrations e o bootstrap preservam o administrador restaurado. Conferir login, quantidade de registros, fotos antigas, histórico e fila de e-mails. Comparar com a instalação de origem.
5. Validar o certificado nos clientes e a conexão do APK release. Se a autoridade do backup foi preservada, a confiança anterior continua vinculada à mesma chave; mantenha essa chave protegida.
6. Registrar data, versão e resultado do teste. Nunca ensaiar restauração por cima do único banco em uso.

## 11. O que foi validado nesta entrega

Foi executado um ambiente Docker isolado em Linux: compilação das imagens, inicialização em banco vazio, migrations, criação do administrador, login pela API, acesso HTTPS com validação do certificado local e reinicialização sem trocar as credenciais. Também foram verificados geração da configuração, backup do volume de fotos, cópia da autoridade HTTPS e restauração do dump em banco vazio com a conta administrativa preservada. O ambiente temporário foi removido depois do teste, sem alterar o ambiente de demonstração.

Os scripts Bash passaram pela verificação de sintaxe e o Compose pela validação de configuração. O instalador do Docker não foi executado em uma máquina nova durante essa validação; a máquina de teste já tinha Docker. O iniciador PowerShell e os três arquivos de dois cliques passaram por 12 testes em Windows Server 2022 no GitHub Actions, com Windows PowerShell 5.1 e CMD: primeira inicialização, caminhos com espaços, preservação de credenciais, parada, status/logs, cópia binária de backup e tratamento de falhas. As chamadas ao Docker foram simuladas nesse teste; ele não valida a instalação completa com Docker Desktop/WSL 2 no Windows 11. Resultado: [execução aprovada dos testes Windows](https://github.com/redlintles/projeto_estagio_inventario_fatec/actions/runs/40372026812). O teste pode ser repetido em Windows com `node scripts/test-production-windows.mjs` (Node 24 apenas para desenvolvimento/testes). Conectividade da rede definitiva, confiança HTTPS nos dispositivos, SMTP e capacidade com dados reais devem ser conferidos na instalação institucional.
