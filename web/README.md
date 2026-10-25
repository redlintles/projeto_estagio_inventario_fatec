# Portal web

React, TypeScript e Vite. Configure VITE_API_URL em .env antes de executar `npm run dev` ou `npm run build`. O artefato estático fica em dist. `npm test` verifica transporte e tratamento de erros.

As telas ficam em src/features, o estado comum em src/app-state.ts e as chamadas em src/api.ts. A autorização do backend permanece obrigatória, mesmo que um botão seja ocultado conforme o perfil.

A ajuda do portal usa os guias de `src/features/help-guides.ts`; o componente `Help.tsx` apresenta índice, acesso aos menus, estados e dúvidas. Atualize os textos ao mudar um fluxo. Falhas da API e de downloads usam o mesmo tratamento em `api.ts`, preservando mensagens úteis de conflito, limites ou servidor ocupado.

## Atualização de operação e coleta (1.2)

A Ajuda inclui acesso pela LAN, teste de conexão Android, leitor em tela inteira e revisão dos envios. `npm start` na raiz inicia o conjunto completo; use o portal na porta 8080 e a API pelo proxy `/api`. Consulte o [guia integrado](../docs/operacao-lan.md) para endereços, configuração, compilação e validação.
