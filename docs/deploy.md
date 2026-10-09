# Implantação e backup

A hospedagem confirmada será em uma máquina interna da Fatec, na rede local compartilhada, sem VLANs. Portal e API permanecerão nesse servidor; os celulares precisarão alcançar a API pela rede da instituição. Endereço estável, HTTPS, acesso pelo Wi-Fi, SMTP e rotina de backup ainda precisam ser definidos e validados.

## Servidor na rede interna da Fatec

Reserve um endereço estável para a máquina, por reserva DHCP ou configuração acordada com o responsável pela rede. Configure um nome interno e HTTPS com certificado confiável nos celulares. O APK release recusa HTTP e não ignora erros de certificado. A API no aplicativo deverá apontar para `https://NOME_DO_SERVIDOR/api`; `localhost` no telefone identifica o próprio telefone.

A ausência de VLANs não impede a integração, mas também não comprova acesso entre Wi-Fi e servidor: valide isolamento de clientes nos pontos de acesso e o firewall da máquina. Exponha o proxy HTTPS aos clientes autorizados; mantenha PostgreSQL e armazenamento de fotos sem acesso direto pela rede. Configure WEB_ORIGIN com a origem real do portal. A máquina precisa permanecer ligada durante o acesso e a sincronização.

O comando `npm run demo` atende à apresentação local e publica portal e API somente em `127.0.0.1`. Para uma apresentação com celulares na mesma rede, `npm run demo:lan` publica a API por HTTP no IP do computador e mantém o banco e as credenciais. Esse modo é exclusivo da demonstração com APK debug e não configura a implantação institucional. Para os aparelhos operacionais, distribua APK release assinado e valide a atualização sem apagar pendências locais. Faça a conferência offline após preparar a base e o inventário online; ao reconectar, sincronize antes de encerrar a sessão de inventário.

## Sem contêiner

Execute `npm ci` e `npm run build`. Configure o ambiente do backend e rode migrations antes do processo `node backend/dist/main.js` (com ambiente externo; se usar `.env`, execute a partir de backend). Sirva `web/dist` por um servidor estático com fallback para `index.html` e informe VITE_API_URL no build.

API precisa alcançar o PostgreSQL e o diretório persistente de fotos. Android precisa alcançar a API, inclusive ao voltar às áreas com conexão. Um servidor apenas em `localhost` no computador não é acessível pelo telefone.

## Variáveis

| Variável                 | Uso                                                              |
| ------------------------ | ---------------------------------------------------------------- |
| DATABASE_URL             | Conexão PostgreSQL, incluindo usuário, senha, host e banco       |
| JWT_SECRET               | Assinatura; 32 caracteres ou mais, aleatório e privado           |
| PORT                     | Porta da API, padrão 3000                                        |
| WEB_ORIGIN               | Origens web permitidas, separadas por vírgula                    |
| UPLOAD_DIR               | Diretório persistente e privado de fotos                         |
| JOBS_ENABLED             | false para agendamento externo; caso contrário, tarefas internas |
| SMTP_HOST/PORT/SECURE    | Servidor SMTP, porta e TLS direto                                |
| SMTP_USER/PASSWORD/FROM  | Credenciais quando exigidas e remetente                          |
| BOOTSTRAP_EMAIL/PASSWORD | Apenas inicialização administrativa                              |
| VITE_API_URL             | URL pública da API inserida no build do portal                   |

PRAZO_BAIXA_DIAS, EMAIL_CPS e EMAIL_DISPONIBILIZACAO ficam no banco, gerenciados na tela Parâmetros. Sem SMTP_HOST o sistema mantém e-mails pendentes. Sem destinatários, o envio fica pendente até parametrização.

## Produção

Use TLS entre clientes e API. A versão release Android recusa HTTP. Termine HTTPS em um proxy ou balanceador e mantenha fotos fora da pasta pública do web. Configure credenciais PostgreSQL exclusivas, backups, acesso de rede e volumes persistentes. Migrations devem rodar uma vez por atualização, antes das novas instâncias de API; múltiplas instâncias não devem disputar migrations.

A entrega não escolhe domínio, certificado, conta cloud, provedor de objetos ou credenciais reais. Celular corporativo e pessoal usam o mesmo app; a instituição decide distribuição do APK, assinatura release, aparelhos permitidos e política de remoção das pendências. Não distribua APK de debug como versão operacional definitiva.

Para PostgreSQL gerenciado com TLS, configure `ssl` no DataSource conforme o provedor e valide certificados; evite desabilitar verificação de certificado. Para múltiplas instâncias da API, todas precisam enxergar o mesmo armazenamento de fotos ou usar um adaptador de objetos.

## Backup

Faça backup conjunto do banco e das fotos. Preserve segredo de sessão em local seguro separado do repositório. Um exemplo com ferramentas PostgreSQL:

```sh
pg_dump --format=custom --file=patrimonio.dump "$DATABASE_URL"
# Copie também o diretório configurado em UPLOAD_DIR para armazenamento seguro.
```

Para uma cópia consistente dos arquivos, interrompa temporariamente gravações ou use snapshots coordenados do banco e volume. Não há limpeza automática de fotos históricas.

Restauração em banco vazio:

```sh
pg_restore --no-owner --dbname="$DATABASE_URL" patrimonio.dump
```

Restaure fotos com os mesmos nomes e permissões de leitura/gravação do processo. Teste a restauração em outro ambiente e confira login, detalhes, fotos e histórico. Uma cópia que nunca foi restaurada ainda não foi validada.

## Atualização

1. Fazer backup e registrar versão implantada.
2. Validar testes e build.
3. Aplicar migrations com o artefato correspondente.
4. Atualizar API e portal.
5. Conferir health, login, relatório, foto e fila de e-mails.
6. Distribuir versão Android compatível sem limpar seu SQLite.

Mudanças no protocolo offline precisam manter compatibilidade com operações coletadas pela versão anterior. Não remover ou reinterpretar campos enquanto houver aparelhos com pendências.
