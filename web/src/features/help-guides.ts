import type { Section } from "../navigation";

export const helpGuides: {
  section: Exclude<Section, "help">;
  purpose: string;
  steps: string[];
  tip: string;
}[] = [
  {
    section: "dashboard",
    purpose:
      "Acompanhe a situação do patrimônio e identifique o que precisa de atenção.",
    steps: [
      "Confira os cartões com a quantidade de ativos em cada status.",
      "Clique em um cartão para abrir Ativos com o status correspondente selecionado.",
      "Use Divergências pendentes para revisar ocorrências que ainda precisam de tratamento.",
    ],
    tip: "Os cartões resumem os registros do sistema. A conferência física é feita em Inventários.",
  },
  {
    section: "assets",
    purpose:
      "Consulte os bens, suas fotos, localização e histórico; registre as operações patrimoniais nos detalhes de cada ativo.",
    steps: [
      "Combine os filtros de patrimônio, grupo, descrição, status, unidade cadastrada e localização para encontrar o bem. Limpe os campos para ampliar a busca.",
      "Para localizar vários bens de uma vez, marque as caixas na lista, escolha uma localização e clique em Aplicar localização. A seleção manual aceita até 500 ativos; Selecionar tudo com os filtros atuais abrange todas as páginas. Use Sem unidade vinculada ou Sem localização para encontrar cadastros incompletos. Mudar os filtros limpa a seleção. Apenas bens Incorporados ou Ativos aceitam essa operação. Quem tem permissão para gerenciar localizações também pode cadastrá-las nessa mesma área.",
      "Para vincular unidades em lote, marque os bens na lista e use o cartão Vincular unidade. Escolha uma unidade ativa e clique em Aplicar unidade. O vínculo cadastrado muda sem alterar a coluna Unidade original da planilha. Cada operação concluída limpa a seleção; selecione novamente para outra ação.",
      "Antes de aplicar unidade ou localização, confira no modal de confirmação, com o fundo escurecido, quantos bens realmente serão alterados e o destino escolhido. Cancelar não altera os ativos. Em Histórico de alterações em lote, escolha Desfazer lote para restaurar os valores anteriores daquela operação. Alterações posteriores em qualquer bem bloqueiam a reversão de todo o lote para preservar os dados mais recentes. O histórico permanece após sair e entrar no sistema. Depois de desfazer, use Refazer lote para reaplicar o valor original aos mesmos bens. Essa ação possui permissão própria, exige destino ativo e é bloqueada se algum bem mudar após a reversão. Ver versões do lote mostra cada aplicação, reversão e reaplicação com data e responsável. Os lotes são processados em blocos dentro de uma única transação; aguarde a confirmação antes de repetir.",
      "Clique em Detalhes → para consultar os dados, baixar fotos e acompanhar o Histórico. Expanda Dados antes e depois para entender uma alteração.",
      "Para um bem Incorporado ou Ativo, selecione uma localização e clique em Atualizar localização. Para disponibilizá-lo, envie uma foto JPEG ou PNG, selecione a condição física de 1 a 5 e clique em Disponibilizar ativo.",
      "Para um ativo disponibilizado sem reserva ativa, escolha a unidade de destino e clique em Registrar reserva. Registre Iniciar transporte quando ele sair e Confirmar transferência quando a movimentação estiver concluída.",
      "Se a movimentação não ocorrer, use Cancelar reserva. O prazo do ativo disponibilizado reinicia a partir do cancelamento.",
      "Quando o status for A baixar, informe a justificativa e use Confirmar baixa definitiva somente após a autorização institucional.",
    ],
    tip: "As operações dependem do seu perfil e do status do bem. A baixa preserva o histórico e não oferece uma ação de desfazer nesta tela.",
  },
  {
    section: "inventories",
    purpose:
      "Confira fisicamente os bens de uma sala ou outra localização e acompanhe os itens esperados ainda não conferidos.",
    steps: [
      "Selecione uma localização ativa e clique em Iniciar inventário, ou abra um inventário já listado.",
      "No inventário aberto, informe o número do Patrimônio. Compare o objeto e a etiqueta com o cadastro.",
      "Se tudo estiver correto, mantenha Conferência correta. Caso contrário, escolha o tipo de divergência e preencha Descrição encontrada e Observação.",
      "Clique em Registrar conferência e acompanhe os totais de conferidos e esperados ainda não conferidos.",
      "Se usar o aplicativo Android, faça login, atualize a base e prepare o inventário enquanto estiver online. As leituras offline ficam no aparelho; acompanhe a sincronização na aba Pendências.",
      "Antes de Encerrar inventário, sincronize todos os aparelhos envolvidos e revise as pendências. Inventários encerrados recusam novas leituras, mesmo coletadas anteriormente.",
    ],
    tip: "Um bem não encontrado não recebe baixa automática. Não desinstale o aplicativo com pendências, pois isso remove os dados locais.",
  },
  {
    section: "divergences",
    purpose:
      "Revise diferenças encontradas na conferência, como localização incorreta, etiqueta incorreta, bem diferente ou patrimônio duplicado.",
    steps: [
      "Use Somente pendentes para priorizar o tratamento ou Todas para consultar também as resolvidas.",
      "Leia a descrição, o tipo e as observações. Clique em Abrir ativo → para conferir o cadastro e o histórico.",
      "No campo Resolução, descreva o tratamento realizado, com pelo menos três caracteres.",
      "Se a conferência justificar uma mudança, selecione a localização correta. Caso contrário, mantenha Preservar localização oficial.",
      "Clique em Resolver divergência e confira a confirmação da operação.",
    ],
    tip: "Registrar uma divergência não muda automaticamente a localização oficial. A correção deve ser escolhida explicitamente durante a resolução.",
  },
  {
    section: "imports",
    purpose:
      "Cadastre a base patrimonial ou atualize dados por planilha, revisando as diferenças antes de gravar.",
    steps: [
      "Clique em Baixar modelo de planilha → e preencha o arquivo seguindo as colunas do modelo. Preserve o número patrimonial dos bens já cadastrados.",
      "Escolha primeiro a unidade cadastrada à qual os bens pertencem. O vínculo é separado da coluna Unidade original, que permanece intacta. Mudanças no vínculo de bens existentes aparecem como conflitos.",
      "Selecione um arquivo .xlsx ou .xls. Os novos bens válidos são importados imediatamente; os registros idênticos são mantidos e apenas os conflitos aparecem para revisão.",
      "Leia os erros de cada linha. Corrija as linhas inválidas no arquivo e analise novamente para importá-las.",
      "Compare Atual e Planilha. Para cada conflito, escolha Manter atual / ignorar ou Aceitar planilha. A escolha fica destacada; também é possível selecionar campos individualmente. Use Manter atual / ignorar para pular uma linha.",
      "Após escolher uma opção para todos os conflitos, clique em Salvar escolhas. Os registros novos já foram salvos automaticamente e não precisam dessa confirmação.",
      "Se um registro tiver sido alterado por outra pessoa desde a prévia, analise a planilha novamente e revise a comparação atualizada.",
    ],
    tip: "A reimportação preserva UUID, localização, fotos, condição e histórico. O NroPatrimonio concilia registros existentes; Código único pode se repetir. Uma reserva em andamento impede trocar o status até que seja resolvida. Ativos ausentes do arquivo não são removidos. Um número patrimonial diferente é tratado como outro ativo. Um preço diferente com o mesmo patrimônio é um conflito; linhas idênticas não precisam de decisão. Fórmulas usam o resultado salvo no Excel ou LibreOffice: recalcule e salve antes de importar. O total é calculado pelo próprio sistema, e o cadastro manual oferece valor de outro bem + R$ 1,00.",
  },
  {
    section: "locations",
    purpose:
      "Organize as salas, laboratórios e demais espaços usados para localizar os bens e realizar inventários.",
    steps: [
      "Consulte os códigos, descrições, prédio, andar e situação dos espaços cadastrados.",
      "Se tiver a permissão Gerenciar localizações, preencha Nova localização: Código e Descrição são obrigatórios; Prédio, Andar e Observações complementam o cadastro.",
      "Clique em Cadastrar localização. Depois, associe os bens ao espaço nos detalhes do ativo ou pela seleção em lote na lista de Ativos.",
      "Use a edição disponível na linha para corrigir os dados. Use Inativar quando o espaço deixar de ser utilizado e Ativar para disponibilizá-lo novamente.",
    ],
    tip: "Localizações inativas deixam de aparecer nas opções de novos inventários e de atualização de localização. Inativar não apaga o cadastro.",
  },
  {
    section: "units",
    purpose:
      "Cadastre as unidades vinculadas aos bens na importação e utilizadas em reservas ou transferências.",
    steps: [
      "Consulte o código, nome e e-mail das unidades cadastradas.",
      "Se tiver a permissão Gerenciar unidades, preencha Código, Nome e E-mail em Nova unidade e clique em Cadastrar unidade.",
      "Use a edição da linha para atualizar nome ou e-mail e Ativar / Inativar para controlar sua disponibilidade.",
      "Para reservar um bem, abra seus detalhes em Ativos e escolha uma unidade ativa como destino.",
    ],
    tip: "A equipe local registra a reserva e as etapas do transporte. Não é necessário que a unidade de destino tenha acesso ao portal para esse registro.",
  },
  {
    section: "users",
    purpose:
      "Gerencie as contas e defina quem pode consultar, operar ou administrar o sistema.",
    steps: [
      "Abra Cadastrar novo usuário, informe Nome, E-mail e Senha inicial com pelo menos 12 caracteres e escolha um Modelo de acesso.",
      "Escolha Consulta para leitura, Responsável patrimonial para as operações patrimoniais ou Administrador para gerenciar também os cadastros e configurações.",
      "Clique em Cadastrar usuário. Informe as credenciais ao usuário pelo canal apropriado da instituição.",
      "Em Editar acesso e permissões, marque Personalizar permissões deste usuário para escolher cada tarefa. As consultas necessárias são incluídas automaticamente. Desmarque a personalização para restaurar as permissões do modelo. Salve o acesso; as sessões anteriores serão invalidadas. A senha opcional vazia preserva a senha atual.",
      "Use Desativar para bloquear uma conta que não deve mais acessar o sistema, ou Ativar para restabelecer o acesso. A sua própria conta não pode ser desativada pelo botão da lista.",
    ],
    tip: "Somente administradores gerenciam contas. O administrador principal mantém acesso global, não pode ser desativado nem ter permissões reduzidas, e somente ele altera sua própria senha. Os demais administradores também têm acesso global. Contas com tarefas limitadas devem usar Consulta ou Responsável patrimonial com permissões personalizadas.",
  },
  {
    section: "settings",
    purpose:
      "Configure o prazo de disponibilização e os destinatários das notificações.",
    steps: [
      "Em PRAZO_BAIXA_DIAS, informe o prazo em dias corridos e clique no botão Salvar correspondente.",
      "Em EMAIL_DISPONIBILIZACAO, informe quem deve receber os avisos de bens disponibilizados. Em EMAIL_CPS, informe os destinatários dos avisos relacionados ao prazo de baixa.",
      "Separe múltiplos e-mails por vírgula e salve cada parâmetro alterado.",
      "Use Executar verificação de prazo e notificações para solicitar uma verificação imediata. Bens disponibilizados sem reserva passam a aguardar baixa quando ultrapassam o prazo.",
    ],
    tip: "Reservas e transporte suspendem o prazo; cancelar a reserva reinicia a contagem. O envio de e-mails depende da configuração de envio do ambiente; na demonstração, eles ficam no Mailpit.",
  },
  {
    section: "reports",
    purpose:
      "Exporte os registros para consulta e acompanhamento em um programa de planilhas.",
    steps: [
      "Escolha o conteúdo do relatório: Todos os ativos, Conferências de inventário, Disponibilizados, Transferidos, Baixados, Divergências ou Histórico de movimentações.",
      "Combine os filtros de patrimônio, descrição, grupo, status, unidade e localização. Use Sem unidade vinculada ou Sem localização para consultar cadastros incompletos. Escolha as datas do período; nos relatórios de ativos ele corresponde à incorporação, e nos demais à movimentação, registro da divergência ou conferência.",
      "Clique em Visualizar prévia para conferir a quantidade total, os critérios e até 30 linhas. Selecione Excel (XLSX), LibreOffice / OpenDocument (ODS) ou CSV e clique em Exportar. O arquivo inclui todos os resultados, em todas as páginas. XLSX e ODS incluem a aba Sobre o relatório com os critérios. Prévia e exportação usam os mesmos filtros; a prévia não congela os dados.",
    ],
    tip: "Os ativos baixados continuam disponíveis no histórico. Editar o arquivo baixado não altera os registros no sistema. UUIDs internos são substituídos por patrimônio, nomes e descrições. Unidade e localização correspondem ao cadastro atual. Alterações feitas após a prévia aparecem na exportação. O limite por solicitação é de 20.000 bens candidatos ou registros; se exceder, refine os filtros e exporte em partes. O sistema informa o excesso e não entrega um arquivo cortado.",
  },
  {
    section: "audit",
    purpose:
      "Consulte as últimas movimentações para entender as alterações feitas no sistema.",
    steps: [
      "Localize a operação pela identificação e pela data e hora exibidas.",
      "Clique na operação para expandir seus detalhes.",
      "Confira o usuário responsável, as observações e os dados antes e depois. Processo automático identifica uma alteração executada pelo sistema.",
      "Para acompanhar um bem específico, consulte também o Histórico em seus detalhes no menu Ativos.",
    ],
    tip: "Este menu exige a permissão de consulta à auditoria e serve para consulta; ele não reverte operações.",
  },
];
