# Como instalar e usar o Patrimônio Fatec

Este guia é para a pessoa que vai instalar e cuidar do sistema no dia a dia. Não é preciso saber programar.

**Entrega: quarta-feira, 04/11/2026. O sistema deve estar funcionando até sexta-feira, 06/11/2026.** Faça a instalação antes do último dia para dar tempo de pedir ajuda, se necessário.

## 1. Escolha o computador

Escolha o computador em que o sistema ficará instalado. Ele precisa:

- Ter internet durante a instalação.
- Ter espaço livre e pelo menos 8 GB de memória. Se não souber conferir, peça ajuda a quem cuida dos computadores.
- Ficar ligado e conectado à rede enquanto as pessoas usam o sistema.

Neste guia, vamos chamar esse computador de **computador principal**. Os outros computadores vão acessar o sistema pelo navegador.

O passo a passo abaixo considera Windows 11. Se o computador usa Linux ou outro sistema, peça ajuda para a instalação seguindo o [guia de suporte](docs/PRODUCAO.md).

## 2. Baixe e extraia o projeto

1. Abra a página do projeto no GitHub que foi enviada a você.
2. Clique no botão **Code** e depois em **Download ZIP**.
3. Espere o download terminar. Abra a pasta **Downloads** do computador.
4. Clique com o botão direito no arquivo baixado e escolha **Extrair tudo**. Depois, clique em **Extrair**.
5. Abra a pasta extraída. Procure o arquivo **INSTALAR.cmd**. Se não encontrar, veja se há outra pasta dentro dela e abra essa pasta.
6. Guarde a pasta inteira em um lugar permanente no computador, por exemplo, no **Disco Local (C:)**, com o nome **FatecPatrimonio**. Não deixe em pendrive ou OneDrive.

**Extraia o ZIP antes de abrir o instalador.** Mantenha todos os arquivos juntos. Depois da instalação, não mude a pasta de lugar.

## 3. Instale o Docker uma única vez

O Docker é o programa que mantém o sistema funcionando. Se já estiver instalado e aberto, passe para a etapa 4.

1. Abra a [página oficial de download do Docker para Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
2. Baixe o instalador do **Docker Desktop para Windows**. Se não souber qual opção corresponde ao computador, peça ajuda antes de baixar.
3. Abra o instalador e siga as instruções. Se aparecer a opção **WSL 2**, deixe marcada.
4. Reinicie o computador se for solicitado.
5. Abra **Docker Desktop** pelo menu Iniciar e espere terminar de iniciar.

Se aparecer uma mensagem sobre **WSL**, **virtualização**, falta de permissão ou incompatibilidade do computador, peça ajuda à pessoa que dá suporte aos computadores. Mostre a mensagem que apareceu. Depois de resolver, continue por aqui.

Não é necessário instalar outros programas de desenvolvimento.

## 4. Abra o instalador do sistema

1. Volte à pasta do projeto.
2. Dê dois cliques em **INSTALAR.cmd**. Dependendo da configuração do Windows, pode aparecer apenas **INSTALAR**.
3. Uma janela com perguntas será aberta. Responda conforme a tabela abaixo. Para aceitar uma sugestão, pressione **Enter**.

| Quando perguntar… | O que fazer |
| --- | --- |
| Endereço do computador | Se outras pessoas vão acessar pela rede, confirme o endereço sugerido com quem cuida dos computadores. Se o uso for somente neste computador, digite `localhost`. |
| Porta | Aceite a sugestão pressionando Enter. |
| Usuário ou e-mail | Informe o e-mail que deseja usar para entrar. Pode aceitar `admin@fatec.local`; ele serve como nome de acesso. |
| Senha | Escolha uma senha com pelo menos 12 caracteres e repita quando solicitado. A senha não aparece enquanto você digita. Se preferir que o instalador crie uma senha, pressione Enter sem digitar. |
| Início automático | Responda **s**, de sim, quando essa opção estiver disponível. |
| Confirmação final | Confira as respostas e pressione Enter para continuar. |

O sistema abre em HTTP na LAN, normalmente em `http://IP-DO-COMPUTADOR:8080`. Não é necessário instalar ou compartilhar certificados. O Windows pode pedir autorização de administrador para liberar a porta na rede local. HTTP não criptografa o tráfego; use em uma LAN de confiança.

**Aguarde a mensagem “INSTALACAO CONCLUIDA”.** Pode levar vários minutos. Não feche a janela enquanto estiver instalando.

Se aparecer um erro, anote ou fotografe a mensagem e peça ajuda. Não apague arquivos para tentar resolver. Depois da correção, você pode abrir **INSTALAR.cmd** novamente.

## 5. Entre no sistema

1. Ao terminar, o instalador tentará abrir o navegador. Se não abrir, copie o endereço mostrado na janela e cole na barra de endereço do navegador.
2. Na pasta do projeto, abra a pasta **producao**.
3. Abra o arquivo **ACESSO.txt**. Ele contém o endereço do sistema, o usuário e a senha inicial.
4. Use esses dados para entrar. Guarde a senha em local protegido.
5. Salve o endereço nos **Favoritos** do navegador para facilitar o acesso nos próximos dias.

Se mudar a senha dentro do sistema, passe a usar a nova senha. O arquivo ACESSO.txt continua mostrando a senha inicial.

**Os dados da apresentação não vêm no ZIP.** A instalação nova começa sem os bens cadastrados. Antes de importar a planilha da unidade, combine com quem fez a entrega como conferir e importar esses dados. Se for necessário trazer dados de outra instalação, peça ajuda.

## 6. Confira antes de começar o trabalho

Peça a quem fez a entrega para acompanhar esta primeira conferência:

- [ ] Consigo abrir o sistema e entrar com meu usuário e senha.
- [ ] Sei onde consultar os bens e como importar a planilha da unidade.
- [ ] Fiz um teste de cadastro, consulta e foto.
- [ ] Se outras pessoas vão usar, elas conseguem abrir o sistema em seus computadores.
- [ ] Se haverá celular, o aplicativo foi instalado e testado com acompanhamento.

Nos outros computadores, use o **endereço do computador principal**. Não é preciso instalar o projeto em cada um deles.

Digite o endereço completo começando com `http://`, incluindo a porta. Se não abrir em outro PC, confira o IP do computador principal, a rede e o firewall. No Windows, a liberação automática vale para redes Privadas e de Domínio.

### Se for usar o aplicativo no celular

Avise quem fez a entrega antes de começar. Use o celular na mesma LAN e informe o endereço exibido pelo instalador acrescido de `/api`, por exemplo `http://192.168.1.50:8080/api`. Não há certificado para instalar.

O arquivo do aplicativo está na pasta do projeto e se chama **patrimonio-fatec-1.3.1-release.apk**. Peça ajuda para instalar, informar o endereço e testar se os registros chegam ao sistema.

Se já houver outro aplicativo de teste instalado, **não desinstale nem apague seus dados antes de confirmar que todos os registros foram enviados**.

## 7. O que fazer no dia a dia

- Mantenha o computador principal ligado, conectado à rede e com o Docker funcionando.
- Depois de ligar ou reiniciar o computador, entre na **mesma conta do Windows** usada na instalação e aguarde alguns minutos.
- Abra o sistema pelo favorito salvo no navegador.
- Se não abrir, confira se o Docker Desktop está aberto. Depois, abra **INSTALAR.cmd** novamente e aguarde.
- Pode fechar a janela do instalador depois da mensagem de conclusão.
- Pode bloquear a tela, mas mantenha a conta conectada. Evite a opção **Sair** do Windows enquanto o sistema estiver sendo usado.

Nas configurações de energia do Windows, desative a **suspensão automática** do computador principal. Se não souber onde fica, peça ajuda. Quando ele desliga ou entra em suspensão, as outras pessoas também ficam sem acesso.

## 8. Faça uma cópia de segurança todos os dias de uso

A cópia de segurança, também chamada de **backup**, permite recuperar os dados se houver um problema no computador.

1. Combine um horário em que ninguém esteja usando o sistema. Se houver celulares, confirme antes que enviaram todos os registros.
2. Na pasta do projeto, dê dois cliques em **BACKUP-PRODUCAO.cmd**.
3. Aguarde a mensagem **Backup concluído**. Durante esse procedimento, o sistema fica parado.
4. Abra **producao → backups**. Copie a pasta que acabou de ser criada, inteira, para outro dispositivo ou local protegido indicado pela instituição.
5. Abra **INSTALAR.cmd** para colocar o sistema em funcionamento novamente.
6. Entre pelo navegador e confira se abriu normalmente.

Se aparecer erro no backup, peça ajuda e não considere aquela cópia concluída. As cópias contêm dados e senhas: guarde com cuidado e não envie em mensagens ou chamados de suporte.

## 9. Como parar o sistema

Se precisar parar, avise as pessoas antes e abra **PARAR-PRODUCAO.cmd** na pasta do projeto. Isso preserva os dados.

Para voltar a usar, abra **INSTALAR.cmd** e espere concluir.

Não apague a pasta **producao** nem use opções de limpeza, exclusão de dados ou restauração de fábrica no Docker. Elas podem apagar informações do sistema. Para atualizar ou trocar de computador, peça ajuda e faça backup primeiro.

## 10. Deixe tudo conferido até 06/11

Na entrega de quarta-feira, **04/11**, combine quem ajudará com a instalação. Use a quinta-feira para testar e resolver dúvidas. Até sexta-feira, **06/11**, confira:

- [ ] O sistema abre no computador principal.
- [ ] As pessoas que vão trabalhar conseguem entrar.
- [ ] Os dados necessários foram conferidos.
- [ ] O celular funciona e envia os registros, se for utilizado.
- [ ] Depois de reiniciar o computador e entrar no Windows, o sistema volta a funcionar.
- [ ] Uma cópia de segurança foi feita e guardada fora do computador principal.
- [ ] Está definido quem cuida do computador, faz o backup e atende em caso de problema.

Preencha e guarde, sem colocar senhas:

```text
Endereço para abrir o sistema:
Pasta onde o projeto foi instalado:
Pessoa responsável pelo computador:
Pessoa que fará o backup:
Local onde serão guardadas as cópias:
Nome e contato de quem pode ajudar:
```

## Preciso de ajuda: o que enviar?

Informe o que estava tentando fazer e mande a mensagem de erro ou uma foto dela, sem mostrar senhas. Não envie o arquivo **ACESSO.txt**, arquivos de configuração ou backups.

Para a pessoa que prestar suporte, as instruções detalhadas estão em [docs/PRODUCAO.md](docs/PRODUCAO.md).

## Corrigir uma instalação anterior

Atualize os arquivos do projeto na mesma pasta, preservando a pasta `producao`.
Abra `INSTALAR.cmd` novamente (Linux: `bash instalar.sh`). Ele converte a configuração
antiga para HTTP sem trocar contas, senhas ou apagar dados. Use o novo endereço
mostrado e registrado em `producao/ACESSO.txt`, inclusive nos outros PCs.
Não use `localhost` nos outros computadores: use o IP do computador principal.
A configuração anterior fica salva em `producao/.env.before-http`.
