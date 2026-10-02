# Backend

API NestJS com PostgreSQL e TypeORM. Siga a instalação na raiz. Comandos deste componente: `npm run start:dev`, `npm run build`, `npm test`, `npm run migration:run` e `npm run bootstrap`.

Código separado por domínio em src. O contrato e exemplos estão em ../docs/api.md. Dados de teste exigem TEST_DATABASE_URL; testes reais limpam tabelas do banco exclusivo indicado. Não use synchronize nem credenciais reais em testes.
