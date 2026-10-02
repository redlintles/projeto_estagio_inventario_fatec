# Instruções do Projeto — Sistema de Gestão Patrimonial

## 1. Objetivo deste documento

Este arquivo consolida duas fontes do projeto:

1. **Especificação Funcional — Sistema de Gestão Patrimonial, Inventário e Movimentação de Ativos (v2.0, setembro/2026)**, que representa a visão formal dos professores/cliente.
2. **briefing estagio.txt**, que registra o entendimento técnico e operacional do projeto após a explicação recebida.

Quando houver diferença entre os dois documentos, este arquivo adota a seguinte ordem:

- **Requisito funcional da Especificação Funcional tem prioridade.**
- O briefing é usado para complementar detalhes que não contradizem a especificação.
- Ideias técnicas do briefing são tratadas como **decisões de implementação**, e não como requisitos funcionais obrigatórios.
- Pontos não definidos ou conflitantes ficam marcados como **Pendente de confirmação**.

---

# 2. Visão geral do sistema

O projeto consiste em um sistema interno para gestão patrimonial da unidade de ensino.

A solução deverá permitir:

- importar ativos a partir de planilhas Excel;
- consultar e controlar ativos patrimoniais;
- registrar e atualizar a localização dos ativos;
- realizar inventário por localização usando leitura de código de barras;
- registrar divergências encontradas durante inventários;
- disponibilizar ativos excedentes para outras unidades;
- transferir ativos entre unidades;
- controlar o processo de baixa patrimonial;
- registrar histórico completo das movimentações;
- manter rastreabilidade e auditoria;
- emitir relatórios;
- enviar notificações automáticas por e-mail;
- permitir operação por portal web e aplicativo mobile.

A solução será utilizada principalmente pela própria unidade de ensino. Outras unidades aparecem no sistema como entidades relacionadas a disponibilizações e transferências, mas não há requisito explícito de que utilizem diretamente a aplicação.

---

# 3. Arquitetura proposta

## 3.1 Backend

Implementar uma API utilizando:

- **NestJS**
- **TypeScript**

Responsabilidades:

- regras de negócio;
- autenticação e autorização;
- importação de planilhas;
- gerenciamento de ativos;
- gerenciamento de localizações;
- gerenciamento de unidades;
- inventário;
- divergências;
- disponibilização;
- transferência;
- baixa;
- histórico;
- auditoria;
- relatórios;
- notificações;
- comunicação com o banco de dados;
- comunicação com aplicativo mobile e frontend web.

> NestJS + TypeScript é uma decisão técnica do briefing. A especificação funcional não impõe tecnologia.

---

## 3.2 Banco de dados

Utilizar banco de dados **relacional**.

O SGBD ainda poderá ser definido de acordo com a infraestrutura disponível.

Sugestões adequadas:

- PostgreSQL;
- MySQL/MariaDB;
- SQL Server, caso a infraestrutura da instituição exija.

O banco será centralizado e deverá armazenar:

- ativos;
- localizações;
- unidades;
- usuários;
- perfis/permissões;
- movimentações;
- fotos;
- divergências;
- parâmetros;
- dados de inventários;
- histórico e auditoria.

---

## 3.3 Portal Web

O portal web será voltado principalmente à administração e gestão.

Deverá permitir:

- dashboard;
- consulta de ativos;
- importação de planilhas;
- cadastro de localizações;
- cadastro de unidades;
- cadastro/gestão de usuários;
- parametrizações;
- gestão de divergências;
- disponibilizações;
- transferências;
- baixas;
- relatórios;
- consulta de histórico;
- auditoria.

---

## 3.4 Aplicativo Mobile

Implementação proposta:

- **Kotlin**
- **Jetpack Compose**

O aplicativo será utilizado principalmente durante atividades físicas de inventário e movimentação.

Funções principais:

- login;
- leitura de código de barras pela câmera;
- inventário por localização;
- consulta de ativo;
- registro de divergência;
- captura de fotos;
- disponibilização;
- transferência.

### Operação offline

O briefing propõe funcionamento offline.

Caso seja implementado:

- operações realizadas sem internet devem ser armazenadas localmente;
- os registros devem possuir estado de sincronização;
- quando a conexão retornar, o aplicativo deverá sincronizar com a API;
- conflitos não devem ser sobrescritos silenciosamente;
- operações que alteram estado crítico do ativo devem ser validadas novamente pelo servidor durante a sincronização.

> O modo offline é uma melhoria proposta no briefing e **não aparece como requisito obrigatório na Especificação Funcional**. Deve ser considerado desejável, mas poderá ser adiado caso o prazo do projeto exija redução de escopo.

---

# 4. Perfis de acesso

## 4.1 Administrador

Permissões:

- importar ativos;
- cadastrar usuários;
- cadastrar unidades;
- cadastrar localizações;
- configurar parâmetros;
- acessar relatórios;
- acessar auditoria;
- consultar dados gerais.

## 4.2 Responsável Patrimonial

Permissões:

- realizar inventário;
- atualizar localização;
- registrar divergências;
- disponibilizar ativos;
- registrar transferências;
- registrar baixa;
- consultar ativos.

## 4.3 Consulta

Permissões:

- consultar ativos;
- visualizar relatórios permitidos.

---

# 5. Terminologia

## 5.1 Ativo

Para fins do sistema, utilizar **Ativo** como entidade principal do cadastro patrimonial.

A especificação funcional utiliza consistentemente esse termo.

## 5.2 Ativo x Bem

O briefing menciona a distinção:

- itens com QR code seriam chamados de **ativos**;
- itens sem QR code seriam chamados de **bens**.

Essa distinção **não está presente na Especificação Funcional**, que trata os registros patrimoniais genericamente como ativos/bens patrimoniais e trabalha com leitura de código de barras.

### Decisão recomendada

No código e no banco, manter uma única entidade principal chamada `Ativo`.

Caso seja necessário representar a distinção operacional existente na unidade, adicionar um campo como:

```text
tipo_identificacao
```

ou

```text
possui_identificacao_patrimonial
```

sem criar duas estruturas de dados completamente diferentes.

**Pendente de confirmação:** verificar com os professores se a diferença entre "ativo" e "bem" precisa realmente existir no sistema.

---

# 6. Modelo de dados mínimo

## 6.1 ATIVO

Campos mínimos:

- `id_ativo`
- `nro_patrimonio`
- `descricao_bem`
- `grupo_patrimonial`
- `codigo_unico`
- `unidade_origem`
- `data_incorporacao`
- `valor_bem`
- `status_atual`
- `localizacao_atual_id`
- `data_cadastro`
- `data_atualizacao`

### Restrições

- `nro_patrimonio` deve ser único;
- `codigo_unico` deve ser único;
- ativos não devem ser excluídos fisicamente;
- ativos baixados continuam disponíveis para consulta histórica.

---

## 6.2 LOCALIZACAO

Campos:

- `id_localizacao`
- `codigo`
- `descricao`
- `predio`
- `andar`
- `observacao`
- `ativo`

Exemplos:

- Bloco A / Sala 01;
- Laboratório de Informática;
- Diretoria;
- Almoxarifado.

---

## 6.3 UNIDADE

Campos:

- `id_unidade`
- `codigo`
- `nome`
- `email`

As unidades serão usadas principalmente como origem/destino de transferências e destinatárias de comunicações.

---

## 6.4 MOVIMENTACAO

Campos mínimos:

- `id_movimentacao`
- `id_ativo`
- `data_movimentacao`
- `usuario`
- `operacao`
- `status_anterior`
- `status_novo`
- `local_anterior`
- `local_novo`
- `observacao`

Toda alteração relevante deve gerar movimentação.

---

## 6.5 FOTO_ATIVO

Campos:

- `id_foto`
- `id_ativo`
- `caminho_arquivo`
- `data_upload`
- `usuario`

---

## 6.6 DIVERGENCIA_PATRIMONIAL

Campos:

- `id_divergencia`
- `id_ativo`
- `patrimonio`
- `descricao_cadastrada`
- `descricao_encontrada`
- `tipo_divergencia`
- `localizacao`
- `observacao`
- `foto_divergencia`
- `data_registro`
- `usuario`
- `status_tratamento`

---

## 6.7 PARAMETRO

Campos:

- `nome_parametro`
- `valor`

Exemplos:

- `PRAZO_BAIXA_DIAS = 20`
- `EMAIL_CPS = ...`

O prazo de 20 dias **não deve ficar fixo no código**.

---

## 6.8 USUARIO

A especificação exige cadastro de usuários e perfis, embora não detalhe uma tabela.

Criar estrutura própria de usuário, por exemplo:

- `id_usuario`
- `nome`
- `email`
- `senha_hash` ou identificador do provedor de autenticação
- `perfil`
- `ativo`
- `data_cadastro`

---

## 6.9 INVENTARIO

A especificação descreve o processo de inventário, mas não fornece uma tabela própria.

É recomendável criar uma entidade para representar uma sessão de inventário.

Exemplo:

### INVENTARIO

- `id_inventario`
- `id_localizacao`
- `id_usuario`
- `data_inicio`
- `data_fim`
- `status`

### INVENTARIO_ITEM

- `id_inventario_item`
- `id_inventario`
- `id_ativo`
- `data_leitura`
- `resultado`
- `possui_divergencia`

Isso facilita relatórios, auditoria e rastreabilidade.

---

# 7. Status dos ativos

A Especificação Funcional define oficialmente:

| Código | Status |
|---|---|
| A | Ativo |
| D | Disponibilizado |
| B | A Baixar |
| T | Transferido |
| X | Baixado |

Esses devem ser considerados os **status oficiais mínimos**.

---

# 8. Estado físico do ativo

O briefing identifica a necessidade de registrar condição física, por exemplo:

- bom;
- quebrado;
- danificado.

A especificação funcional registra a "situação do bem" durante disponibilização, mas não define claramente esse atributo no modelo `ATIVO`.

### Decisão recomendada

Separar:

- **status patrimonial/fluxo**, que indica o estado administrativo;
- **condição física**, que indica a situação material do objeto.

Exemplo:

```text
status_atual = DISPONIBILIZADO
condicao_fisica = DANIFICADO
```

Possíveis valores iniciais:

- BOM;
- DANIFICADO;
- QUEBRADO;
- NECESSITA_MANUTENCAO;
- NÃO_AVALIADO.

**Pendente de confirmação:** conjunto definitivo de condições físicas.

---

# 9. Status intermediários sugeridos no briefing

O briefing sugere estados como:

- recebido;
- a caminho;
- disponível;
- requisitado;
- enviado.

A especificação formal, porém, somente define:

- Ativo;
- Disponibilizado;
- A Baixar;
- Transferido;
- Baixado.

### Regra para implementação

Não criar novos status patrimoniais sem confirmação.

Caso seja necessário controlar o transporte ou uma solicitação de transferência, preferir uma entidade/processo separado, por exemplo:

```text
SOLICITACAO_TRANSFERENCIA
```

com estados:

- PENDENTE;
- APROVADA;
- EM_TRANSPORTE;
- CONCLUÍDA;
- CANCELADA.

Assim, evita-se misturar o estado patrimonial do ativo com o estado operacional da transferência.

---

# 10. Importação de planilhas

## 10.1 Requisito mínimo obrigatório

O sistema deverá:

1. permitir selecionar arquivo Excel;
2. validar estrutura;
3. validar duplicidades;
4. exibir inconsistências;
5. importar registros válidos.

---

## 10.2 Atualização por novas planilhas

O briefing propõe um comportamento adicional:

- futuramente poderão ser recebidas versões atualizadas da planilha oficial;
- os registros deverão ser comparados com os registros já existentes;
- em caso de conflito, o responsável poderá decidir qual valor manter.

Essa funcionalidade **não aparece explicitamente na Especificação Funcional**, mas é coerente com o processo descrito no briefing.

### Estratégia recomendada

Separar importação em duas operações:

### Primeira carga

- inserir ativos ainda inexistentes;
- rejeitar duplicidades;
- apresentar erros.

### Reimportação / atualização

Para cada ativo existente:

- comparar os campos importados com a base;
- identificar campos divergentes;
- não sobrescrever automaticamente dados internos;
- mostrar diferenças ao usuário;
- permitir escolher, campo a campo ou ativo a ativo, qual valor manter.

### Regra importante

Dados internos, como localização atual, fotos, histórico, divergências e movimentações, **nunca devem ser apagados por uma nova importação de planilha**.

---

# 11. Inventário por localização

Fluxo:

1. usuário seleciona uma localização;
2. inicia um inventário;
3. lê códigos de barras dos ativos encontrados;
4. o sistema exibe os dados do ativo;
5. o usuário confirma a conferência;
6. o sistema registra usuário, data e hora.

A experiência mobile deve ser rápida.

Durante inventário normal, o usuário não deve precisar preencher um formulário completo para cada item.

Uma leitura bem-sucedida deve exigir o mínimo possível de interação.

---

# 12. Divergências patrimoniais

Situações previstas:

- etiqueta em bem incorreto;
- bem diferente do cadastro;
- bem sem identificação patrimonial;
- patrimônio duplicado;
- ativo encontrado em localização incorreta;
- outro.

Fluxo:

1. ler o patrimônio;
2. detectar ou informar divergência;
3. informar tipo;
4. descrever o bem encontrado;
5. anexar foto;
6. registrar.

### Regra crítica

Quando houver divergência, o sistema **não deve alterar automaticamente a localização oficial do ativo**.

A divergência deve ficar registrada para tratamento posterior.

---

# 13. Atualização de localização

Quando um ativo for encontrado corretamente durante um inventário:

- sua localização poderá ser atualizada;
- a alteração deve registrar usuário, data e hora;
- deve ser criada uma movimentação no histórico.

Quando houver divergência:

- não atualizar automaticamente;
- criar registro de divergência.

---

# 14. Disponibilização de ativos

Fluxo:

1. identificar o ativo;
2. exibir seus dados;
3. informar situação/condição;
4. capturar foto;
5. confirmar.

Resultado:

- status muda para `Disponibilizado`;
- registrar data de disponibilização;
- registrar situação;
- registrar fotos;
- registrar usuário;
- gerar histórico.

---

# 15. Notificação de disponibilização

Após disponibilizar um ativo, o sistema deverá enviar e-mail automaticamente para uma lista parametrizada.

Conteúdo mínimo:

- patrimônio;
- descrição;
- situação;
- fotos.

---

# 16. Prazo para baixa

Deve existir um processo automático executado periodicamente, idealmente uma vez por dia.

Critério:

```text
status = DISPONIBILIZADO
e
dias_desde_disponibilizacao > PRAZO_BAIXA_DIAS
```

Resultado:

- alterar status para `A Baixar`;
- registrar alteração automática no histórico;
- comunicar o CPS conforme parametrização.

O valor inicial poderá ser 20 dias, mas deverá ser configurável.

---

# 17. Comunicação ao CPS

Quando o ativo passar para `A Baixar`, enviar e-mail contendo:

- patrimônio;
- descrição;
- situação;
- fotos;
- data da disponibilização.

O endereço deverá ser configurável por parâmetro.

---

# 18. Transferência patrimonial

O sistema deverá permitir localizar um ativo por:

- código de barras;
- digitação manual;
- lista de disponibilizados.

Fluxo:

1. selecionar ativo;
2. selecionar unidade de destino;
3. confirmar.

Resultado:

- status do ativo passa para `Transferido`;
- registrar unidade de destino;
- registrar data;
- registrar usuário;
- gerar histórico.

Se futuramente for necessário acompanhar solicitação, aprovação ou transporte, usar uma entidade de processo separada, em vez de acrescentar status improvisados diretamente em `ATIVO`.

---

# 19. Baixa patrimonial

Somente ativos em estado `A Baixar` devem aparecer no fluxo normal de baixa.

Fluxo:

1. selecionar um ou mais ativos;
2. informar justificativa;
3. confirmar.

Resultado:

- status passa para `Baixado`;
- registrar data;
- registrar usuário;
- registrar justificativa;
- gerar histórico.

O ativo continua no banco para consulta histórica.

---

# 20. Histórico e auditoria

Toda movimentação relevante deve ser registrada.

Eventos mínimos:

- inclusão;
- alteração de localização;
- divergência;
- disponibilização;
- transferência;
- baixa;
- alterações automáticas.

Cada registro deve permitir identificar, quando aplicável:

- usuário;
- data/hora;
- operação;
- estado anterior;
- estado novo;
- localização anterior;
- localização nova;
- observação.

---

# 21. Dashboard

Indicadores mínimos:

- total de ativos;
- ativos;
- disponibilizados;
- a baixar;
- transferidos;
- baixados;
- divergências pendentes.

---

# 22. Consulta de ativos

Filtros mínimos:

- patrimônio;
- descrição;
- grupo patrimonial;
- status;
- localização.

Também é desejável permitir acesso ao:

- histórico;
- fotos;
- divergências;
- movimentações relacionadas.

---

# 23. Gestão de divergências

Filtros mínimos:

- período;
- tipo;
- localização;
- status de tratamento.

A tela deve permitir acompanhar divergências até sua resolução.

---

# 24. Relatórios

Relatórios mínimos:

- inventário por localização;
- bens disponibilizados;
- bens transferidos;
- bens baixados;
- divergências patrimoniais;
- histórico de movimentações.

---

# 25. Sincronização offline do aplicativo

Esta seção somente se aplica caso o modo offline seja incluído no escopo.

## Regras sugeridas

Cada operação local deve possuir:

- identificador local;
- data/hora;
- usuário;
- tipo de operação;
- payload;
- estado de sincronização.

Estados possíveis:

- PENDENTE;
- SINCRONIZANDO;
- SINCRONIZADO;
- ERRO;
- CONFLITO.

### Segurança de sincronização

O servidor deverá continuar sendo a fonte final de verdade.

Exemplo:

Se um colaborador tentar transferir offline um ativo que, antes da sincronização, já foi baixado por outro usuário, a API não deve aceitar silenciosamente a operação.

O aplicativo deverá informar o conflito.

---

# 26. Fotos

Fotos devem ficar associadas ao patrimônio ou ao evento correspondente.

Podem existir fotos de:

- ativo;
- divergência;
- disponibilização.

Evitar armazenar grandes arquivos binários diretamente na tabela principal de ativos.

A implementação poderá utilizar armazenamento de arquivos/objetos e registrar no banco apenas o caminho ou identificador.

---

# 27. Exclusão de dados

Não permitir exclusão física de ativos.

Quando necessário:

- inativar cadastros auxiliares;
- preservar movimentações;
- preservar histórico;
- preservar dados usados em auditoria.

---

# 28. Requisitos de documentação

O projeto deverá ser mantido por outros alunos no futuro.

Por isso, entregar no mínimo:

- README principal;
- instruções de instalação;
- instruções de execução;
- variáveis de ambiente;
- estrutura dos projetos;
- modelo do banco;
- migrations;
- documentação da API;
- descrição dos fluxos de negócio;
- instruções de deploy;
- instruções de backup/restauração, quando aplicável;
- decisões técnicas importantes;
- limitações conhecidas.

Para a API NestJS, preferir documentação automática com OpenAPI/Swagger.

---

# 29. Organização sugerida do projeto

Exemplo:

```text
projeto-patrimonio/
├── backend/
├── web/
├── mobile/
├── docs/
├── database/
├── docker/
└── README.md
```

Dentro de `docs/`:

```text
docs/
├── requisitos.md
├── modelo-dados.md
├── arquitetura.md
├── fluxos.md
├── api.md
├── deploy.md
└── manutencao.md
```

---

# 30. Ordem recomendada de desenvolvimento

## Fase 1 — Fundação

1. definir SGBD;
2. criar repositórios/projetos;
3. modelar banco;
4. configurar migrations;
5. implementar usuários/perfis;
6. implementar API básica;
7. configurar documentação Swagger.

## Fase 2 — Cadastro básico

1. unidades;
2. localizações;
3. ativos;
4. consulta e filtros;
5. importação inicial de Excel.

## Fase 3 — Inventário

1. sessão de inventário;
2. leitura de código;
3. atualização de localização;
4. divergências;
5. fotos;
6. histórico.

## Fase 4 — Ciclo patrimonial

1. disponibilização;
2. notificação;
3. monitoramento de prazo;
4. mudança automática para `A Baixar`;
5. comunicação ao CPS;
6. transferência;
7. baixa.

## Fase 5 — Gestão

1. dashboard;
2. relatórios;
3. auditoria;
4. parametrizações.

## Fase 6 — Melhorias

1. reimportação com resolução de conflitos;
2. funcionamento offline;
3. sincronização;
4. refinamentos de UX;
5. otimizações.

---

# 31. MVP recomendado

Caso seja necessário reduzir o escopo por prazo, o MVP deve priorizar:

- autenticação;
- ativos;
- localizações;
- unidades;
- importação inicial;
- consulta;
- inventário;
- leitura de código de barras;
- atualização de localização;
- divergências;
- histórico;
- disponibilização;
- transferência;
- baixa.

Podem ser adiados, caso necessário:

- funcionamento offline;
- resolução avançada de conflito de planilhas;
- dashboard sofisticado;
- relatórios altamente customizados;
- automações não essenciais além das explicitamente exigidas.

---

# 32. Pontos que precisam ser confirmados com os professores

## P1 — Ativo x Bem

A diferença entre ativo com QR code e bem sem QR code deve existir formalmente no sistema?

## P2 — Tipo de identificação

O sistema deve ler:

- código de barras;
- QR code;
- ambos?

A especificação fala em código de barras; o briefing menciona QR code na classificação dos itens.

## P3 — Estado físico

Quais valores devem existir oficialmente?

Exemplo:

- bom;
- danificado;
- quebrado;
- manutenção.

## P4 — Status de fluxo adicionais

É realmente necessário ter:

- recebido;
- a caminho;
- requisitado;
- enviado;

ou os cinco status da especificação são suficientes?

## P5 — Reimportação de planilha

O sistema deverá apenas realizar a carga inicial ou deverá receber periodicamente novas planilhas e mesclar alterações?

## P6 — Conflitos de importação

Se houver reimportação, a resolução deve ocorrer:

- ativo a ativo;
- campo a campo;
- automaticamente segundo alguma prioridade?

## P7 — Modo offline

É requisito obrigatório ou melhoria desejável?

## P8 — Infraestrutura

Definir:

- onde backend será hospedado;
- onde banco ficará;
- onde fotos ficarão;
- política de backup;
- disponibilidade de servidor interno/cloud.

## P9 — Autenticação

Definir se haverá:

- login local;
- Microsoft/Google institucional;
- Active Directory/LDAP;
- outro mecanismo.

## P10 — Uso por outras unidades

Outras unidades irão acessar o sistema diretamente ou somente receber e-mails/participar do processo de transferência?

---

# 33. Decisões consolidadas para evitar ambiguidade

Até que os pontos pendentes sejam respondidos, desenvolver assumindo:

1. `Ativo` é a entidade patrimonial principal.
2. O número patrimonial e o código único são únicos.
3. Os status oficiais são somente:
   - Ativo;
   - Disponibilizado;
   - A Baixar;
   - Transferido;
   - Baixado.
4. Condição física é um atributo separado do status patrimonial.
5. Toda alteração relevante gera histórico.
6. Ativos nunca são fisicamente excluídos.
7. O prazo para baixa é parametrizável.
8. O backend é a fonte final de verdade.
9. O aplicativo mobile usa a câmera para leitura do código.
10. NestJS + TypeScript e Kotlin + Jetpack Compose são decisões de implementação.
11. Offline é desejável, mas não deve bloquear a entrega do núcleo obrigatório.
12. Dados internos nunca devem ser apagados por reimportação de planilha.
13. Transferências entre unidades devem ser registradas, mesmo que as outras unidades não sejam usuárias diretas do sistema.
14. Divergências nunca devem corrigir automaticamente dados oficiais sem tratamento.
15. O sistema deve ser fortemente documentado para permitir manutenção por outros alunos.

---

# 34. Critério geral de conclusão

O projeto poderá ser considerado funcional quando um responsável conseguir executar o ciclo abaixo sem recorrer à planilha como ferramenta principal de gestão:

```text
Importar ativos
      ↓
Cadastrar/organizar localizações
      ↓
Realizar inventário pelo celular
      ↓
Identificar divergências
      ↓
Atualizar localização e histórico
      ↓
Disponibilizar ativo excedente
      ↓
Transferir para outra unidade
          OU
Aguardar prazo
      ↓
Marcar como A Baixar
      ↓
Realizar baixa
      ↓
Consultar histórico e relatórios
```

A planilha oficial continua sendo uma fonte de dados de entrada, mas o sistema passa a ser a ferramenta central de gestão operacional e rastreabilidade.
