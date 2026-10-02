# Gestão Patrimonial Fatec

Sistema interno da unidade de ensino para importar a base patrimonial, conferir ativos por localização, registrar divergências e acompanhar disponibilização, reserva, transporte, transferência e baixa. O portal atende à gestão; o aplicativo Android atende à conferência física, inclusive em salas sem internet.

## Componentes

| Diretório  | Responsabilidade                                        | Tecnologia                                    |
| ---------- | ------------------------------------------------------- | --------------------------------------------- |
| `backend/` | API, autorização, regras, banco, tarefas e notificações | NestJS, TypeScript, TypeORM e PostgreSQL      |
| `web/`     | Portal administrativo                                   | React, TypeScript e Vite                      |
| `mobile/`  | Leitura de barras, inventário e fila offline            | Kotlin, Jetpack Compose, SQLite e WorkManager |
| `docs/`    | Requisitos, arquitetura, contratos e manutenção         | Markdown                                      |
| `infra/`   | Ambiente Docker opcional e proxy de exemplo             | Compose e Nginx                               |

A implantação definitiva continua em aberto. É possível executar os componentes sem Docker, usar um PostgreSQL gerenciado ou hospedar em uma máquina da instituição. O ambiente Compose é uma opção de desenvolvimento, sem compromisso com uma infraestrutura específica.

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

Portal: `http://localhost:5173`. API: `http://localhost:3000/api`. Swagger: `http://localhost:3000/api/docs`. Entre com o administrador criado e cadastre as localizações, unidades e usuários.

## Começar com Docker

```sh
cp infra/.env.example infra/.env
# Edite as senhas e a identidade inicial.
docker compose --env-file infra/.env -f infra/compose.yaml up --build -d
# Execute uma única vez, após configurar a senha de bootstrap:
docker compose --env-file infra/.env -f infra/compose.yaml exec backend node dist/bootstrap.js
```

Portal: `http://localhost:8080`. API na porta 3000. E-mails de desenvolvimento: `http://localhost:8025` (Mailpit, sem envio externo). Configure destinatários na tela Parâmetros. Esse exemplo usa HTTP para desenvolvimento; consulte `docs/deploy.md` antes de implantar.

## Aplicativo Android

Abra `mobile/` no Android Studio, configure o SDK local e compile. Não versione `local.properties` nem chaves de assinatura.

```sh
cd mobile
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

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
