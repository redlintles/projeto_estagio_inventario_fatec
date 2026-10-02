# Portal web

React, TypeScript e Vite. Configure VITE_API_URL em .env antes de executar `npm run dev` ou `npm run build`. O artefato estático fica em dist. `npm test` verifica transporte e tratamento de erros.

As telas ficam em src/features, o estado comum em src/app-state.ts e as chamadas em src/api.ts. A autorização do backend permanece obrigatória, mesmo que um botão seja ocultado conforme o perfil.
