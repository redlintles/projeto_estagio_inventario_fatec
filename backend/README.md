# Backend

API NestJS com PostgreSQL e TypeORM. Siga a instalação na raiz. Comandos deste componente: `npm run start:dev`, `npm run build`, `npm test`, `npm run migration:run` e `npm run bootstrap`.

Código separado por domínio em src. O contrato e exemplos estão em ../docs/api.md. Dados de teste exigem TEST_DATABASE_URL; testes reais limpam tabelas do banco exclusivo indicado. Não use synchronize nem credenciais reais em testes.

Rotas e validação ficam em `src/controller.ts`; contas e senhas em `src/auth/users.service.ts` e `src/auth/passwords.ts`. Relatórios separam consulta (`reports/report-query.ts`), montagem (`reports/reports.ts`) e exportação (`reports/report-format.ts`). Limites de arquivos ficam em `src/resource-limit.ts`. Veja `docs/manutencao.md` e `docs/seguranca.md` na raiz para decisões, compatibilidade dos hashes e limites de produção.

## Atualização de operação e coleta (1.2)

A inicialização integrada `npm start` na raiz aguarda `/api/health`, aplica migrations e prepara o administrador. Android utiliza o mesmo contrato autenticado para base, inventários, leituras e fotos. O dashboard acessa `/api` pelo proxy na mesma origem. Consulte o [guia integrado](../docs/operacao-lan.md) para endereços, configuração, compilação e validação.
