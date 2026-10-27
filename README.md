> **Máquina nova / Download ZIP:** leia `LEIA-ME-PRIMEIRO.txt`. Instale o Docker manualmente, extraia o ZIP e execute **INSTALAR.cmd** no Windows ou **bash instalar.sh** no Linux. O assistente pergunta os dados necessários, prepara os serviços, HTTPS e início automático. Mais detalhes no [guia de produção](docs/PRODUCAO.md).

# Gestão Patrimonial Fatec

Sistema interno da unidade de ensino para importar a base patrimonial, conferir ativos por localização, registrar divergências e acompanhar disponibilização, reserva, transporte, transferência e baixa. O portal atende à gestão; o aplicativo Android atende à conferência física, inclusive em salas sem internet.

## Funcionalidades atuais

- Importação do modelo institucional: novos bens automaticamente, diferenças por campo para revisão, UUID interno e conteúdo original preservado.
- Unidades e localizações na importação e por seleção em lote, inclusive todos os resultados dos filtros; confirmação em modal, histórico, desfazer e refazer com proteção contra alterações posteriores.
- Relatórios com filtros e prévia em CSV, XLSX e ODS, referências legíveis e limite explícito de 20.000 bens candidatos ou registros por solicitação.
- Contas com permissões por tarefa, administrador principal protegido e revogação de sessões após alterações de acesso.
- Ajuda dentro do portal, com roteiro por menu, estados, coleta no celular e solução de dúvidas.

## Componentes

| Diretório  | Responsabilidade                                        | Tecnologia                                    |
| ---------- | ------------------------------------------------------- | --------------------------------------------- |
| `backend/` | API, autorização, regras, banco, tarefas e notificações | NestJS, TypeScript, TypeORM e PostgreSQL      |
| `web/`     | Portal administrativo                                   | React, TypeScript e Vite                      |
| `mobile/`  | Leitura de barras, inventário e fila offline            | Kotlin, Jetpack Compose, SQLite e WorkManager |
| `docs/`    | Requisitos, arquitetura, contratos e manutenção         | Markdown                                      |
| `infra/`   | Ambiente Docker opcional e proxy de exemplo             | Compose e Nginx                               |

A hospedagem será em uma máquina interna da Fatec, na rede local compartilhada, sem VLANs. A configuração operacional de endereço estável, HTTPS e backup está descrita em `docs/deploy.md`. O ambiente Compose continua sendo uma opção de desenvolvimento e demonstração.

## Executar com um comando

```sh
./iniciar.sh
```

O script inicia banco, backend e portal, gera a configuração local e aplica as migrations. Requer Node.js 24 e Docker com Compose iniciado; não exige editar env. Portal em `http://localhost:8080` e `http://IP_DO_PC:8080`. Credenciais em `.demo/.env`, sem impressão da senha no terminal. O modo padrão já permite acesso de computadores e celulares na mesma rede; `./iniciar.sh --rede` é um alias e `./iniciar.sh --parar` para parar preservando os dados. O modo de rede usa HTTP e é destinado a testes; dados reais exigem a implantação HTTPS descrita em `docs/deploy.md`.

A importação do modelo institucional, estados e cálculos estão em [Importação](docs/importacao.md). O escopo da auditoria e os requisitos restantes estão em [Segurança](docs/seguranca.md).

## Demonstração com um comando

Com Node.js 24 e Docker com Compose **2.24.4 ou superior** instalado e iniciado:

```sh
npm run demo
```

Não é necessário executar `npm ci` no computador nem editar arquivos `.env`. O comando compila o portal e a API, inicia PostgreSQL e Mailpit, aplica as migrations e cria o administrador. Ao terminar, exibe o endereço **http://localhost:8080** e o caminho do arquivo privado de credenciais. A primeira execução precisa de internet para baixar as imagens e dependências.

As credenciais ficam em `.demo/.env`, ignorado pelo Git. Executar novamente preserva as credenciais e os dados. O banco da demonstração usa volumes próprios do projeto Docker `fatec-demo`. O portal e a API ficam acessíveis apenas neste computador. As portas 3000, 8080 e 8025 precisam estar livres; pare outras instâncias do projeto antes de iniciar.

```sh
npm run demo:stop
```

Esse comando para os serviços e preserva os dados. O ambiente começa sem ativos cadastrados: entre com o administrador, cadastre as localizações e importe a base patrimonial pela interface. Para usar em produção, siga a configuração abaixo e o guia de implantação.

## Começar sem Docker

Pré-requisitos: Node.js 24, npm, PostgreSQL 17 ou superior; para Android, Android Studio com JDK 17 e SDK 35. Use um banco exclusivo deste projeto.

```sh
npm ci
cp backend/.env.example backend/.env
cp web/.env.example web/.env
```

Edite `backend/.env`: configure `DATABASE_URL`, `JWT_SECRET` aleatório de pelo menos 32 caracteres e `WEB_ORIGIN`. Crie o banco antes de executar as migrations. As operações abaixo leem o ambiente a partir de `backend/`:

```sh
npm run migration:run -w backend
```

Para criar o primeiro administrador, configure `BOOTSTRAP_EMAIL` e `BOOTSTRAP_PASSWORD` (mínimo 12 caracteres) em `backend/.env` e execute:

```sh
npm run bootstrap -w backend
```

Remova a senha de bootstrap do ambiente depois de criar o usuário. O comando recusa criar outro administrador se já houver um.

Em terminais separados:

```sh
npm run dev:backend
npm run dev:web
```

Portal: `http://localhost:5173`. API: `http://localhost:3000/api`. Swagger opcional em `http://localhost:3000/api/docs` com `ENABLE_API_DOCS=true` (somente ambiente controlado). Entre com o administrador criado e cadastre as localizações, unidades e usuários.

## Começar com Docker

```sh
cp infra/.env.example infra/.env
# Edite as senhas e a identidade inicial.
docker compose --env-file infra/.env -f infra/compose.yaml up --build -d
# Execute uma única vez, após configurar a senha de bootstrap:
docker compose --env-file infra/.env -f infra/compose.yaml exec backend node dist/bootstrap.js
```

Portal: `http://localhost:8080`. API na porta 3000. E-mails de desenvolvimento: `http://localhost:8025` (Mailpit, sem envio externo). Configure destinatários na tela Parâmetros. Esse exemplo usa HTTP para desenvolvimento; consulte `docs/deploy.md` antes de implantar.

### Demonstração no celular pela rede local

```sh
npm run demo:lan
```

Este modo publica a API na rede local e exibe os endereços disponíveis para o celular. Use `http://IP_DO_PC:3000/api` no login do app debug, com ambos na mesma rede. O portal permanece em `http://localhost:8080`. Banco e credenciais são os mesmos da demo. Para retornar ao acesso somente local, execute `npm run demo`. O endereço `10.0.2.2` é exclusivo do emulador Android; no celular físico, use o IP do PC ou o encaminhamento USB descrito em `mobile/README.md`.

## Aplicativo Android

Abra `mobile/` no Android Studio, configure o SDK local e compile. Não versione `local.properties` nem chaves de assinatura.

```sh
cd mobile
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

A revisão de compatibilidade e os limites da validação Android estão em [docs/revisao-android.md](docs/revisao-android.md). O celular permanece focado em identificação, conferência e fotos; as funções de gestão ficam no portal.

O APK de desenvolvimento é gerado em `mobile/app/build/outputs/apk/debug/app-debug.apk`. No login, informe a URL da API. No emulador, use `http://10.0.2.2:3000/api`; em um aparelho conectado à mesma rede do servidor, use o endereço do servidor. A versão release exige HTTPS.

Antes de entrar em uma sala sem internet: faça login, atualize a base e prepare um inventário da sala. Leia os ativos, confira a descrição e confirme. As operações ficam gravadas no SQLite. Consulte a aba Pendências para acompanhar a sincronização e os conflitos. Nunca desinstale o aplicativo com pendências: a desinstalação remove o banco local.

## Validar

```sh
npm run build
npm test
npm run format:check
```

Sem `TEST_DATABASE_URL`, os testes unitários são executados e os testes de integração são explicitamente ignorados. Para verificar os fluxos reais, crie um banco descartável cujo nome contenha `test` e execute:

```sh
TEST_DATABASE_URL=postgresql://usuario:senha@localhost:5432/patrimonio_test npm test
```

**O teste de integração limpa tabelas do banco indicado. Nunca use o banco operacional.** A CI cria um PostgreSQL isolado automaticamente. Veja `docs/testes.md` para o que é coberto e o roteiro de validação em aparelhos.

## Documentação

- [Requisitos e decisões confirmadas](docs/requisitos.md)
- [Arquitetura e pontos de adaptação](docs/arquitetura.md)
- [Modelo de dados](docs/modelo-dados.md)
- [API e exemplos de chamadas](docs/api.md)
- [Fluxos operacionais](docs/fluxos.md)
- [Implantação e backup](docs/deploy.md)
- [Manutenção por novos alunos](docs/manutencao.md)
- [Testes e verificação](docs/testes.md)
- [Limitações e homologação](docs/limitacoes.md)
- [Registro de validação](docs/validacao.md)

Os briefings originais permanecem na raiz. As decisões confirmadas pelo responsável no chat prevalecem sobre sugestões do agregado de IA.

## Atualização de operação e coleta (1.2)

O comando padrão `npm start` (ou `./iniciar.sh`) disponibiliza portal e API na LAN e aguarda prontidão. Para acesso somente neste PC, use `npm run demo` ou `./iniciar.sh --local`. Android 1.2 inclui leitor de barras em tela inteira acionado por botão e teste de conexão no login. Consulte o [guia integrado](docs/operacao-lan.md) para endereços, configuração, compilação e validação.

## Identidade visual

O projeto usa uma marca de etiqueta patrimonial com barras e selo de conferência, no verde e azul do próprio sistema. O ícone está no Android 1.2.1 e no favicon, login e cabeçalho do dashboard. Veja a [matriz vetorial e instruções de geração](assets/brand/README.md).

## Inventário guiado — versão 1.3

O Android 1.3 inclui lista local de bens esperados, progresso, ausências, conclusão sincronizada e cancelamento. A API impede sessões simultâneas na mesma sala por padrão; administradores podem alterar a política em Parâmetros. Veja o [guia de inventário Android](docs/inventario-android.md).
