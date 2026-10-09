import React from "react";
import { AppState } from "../app-state";
import { Section, sections } from "../navigation";

const guides: {
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
      "Combine os filtros de patrimônio, grupo, descrição, status e localização para encontrar o bem. Limpe os campos para ampliar a busca.",
      "Clique em Detalhes → para consultar os dados, baixar fotos e acompanhar o Histórico. Expanda Dados antes e depois para entender uma alteração.",
      "Para um ativo ativo, selecione uma localização e clique em Atualizar localização. Para disponibilizá-lo, envie uma foto JPEG ou PNG, selecione a condição física de 1 a 5 e clique em Disponibilizar ativo.",
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
      "Selecione um arquivo .xlsx ou .xls e clique em Analisar planilha. Essa etapa gera uma prévia; ainda não aplica a importação.",
      "Leia os erros de cada linha. Corrija as linhas inválidas no arquivo e analise novamente para importá-las.",
      "Compare Atual e Planilha. Para registros existentes, a opção inicial preserva os dados atuais; use Aceitar planilha ou marque os campos que deseja atualizar. Use Manter atual / ignorar para pular uma linha.",
      "Revise também os novos registros, que são selecionados para importar quando válidos. Clique em Aplicar decisões para confirmar.",
      "Se um registro tiver sido alterado por outra pessoa desde a prévia, analise a planilha novamente e revise a comparação atualizada.",
    ],
    tip: "A reimportação preserva localização, fotos, condição, reservas, divergências e histórico. Ativos ausentes do arquivo não são removidos. Um número patrimonial diferente é tratado como outro ativo.",
  },
  {
    section: "locations",
    purpose:
      "Organize as salas, laboratórios e demais espaços usados para localizar os bens e realizar inventários.",
    steps: [
      "Consulte os códigos, descrições, prédio, andar e situação dos espaços cadastrados.",
      "Como administrador, preencha Nova localização: Código e Descrição são obrigatórios; Prédio, Andar e Observações complementam o cadastro.",
      "Clique em Cadastrar localização. Depois, associe os bens ao espaço nos detalhes do ativo.",
      "Use a edição disponível na linha para corrigir os dados. Use Inativar quando o espaço deixar de ser utilizado e Ativar para disponibilizá-lo novamente.",
    ],
    tip: "Localizações inativas deixam de aparecer nas opções de novos inventários e de atualização de localização. Inativar não apaga o cadastro.",
  },
  {
    section: "units",
    purpose:
      "Cadastre as unidades que podem receber bens em uma reserva ou transferência.",
    steps: [
      "Consulte o código, nome e e-mail das unidades cadastradas.",
      "Como administrador, preencha Código, Nome e E-mail em Nova unidade e clique em Cadastrar unidade.",
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
      "Em Novo usuário, informe Nome, E-mail, Senha inicial com pelo menos 12 caracteres e Perfil.",
      "Escolha Consulta para leitura, Responsável patrimonial para as operações patrimoniais ou Administrador para gerenciar também os cadastros e configurações.",
      "Clique em Cadastrar usuário. Informe as credenciais ao usuário pelo canal apropriado da instituição.",
      "Use a edição da conta para alterar o perfil ou definir uma Nova senha. Deixe a senha opcional vazia para preservar a atual.",
      "Use Desativar para bloquear uma conta que não deve mais acessar o sistema, ou Ativar para restabelecer o acesso. A sua própria conta não pode ser desativada pelo botão da lista.",
    ],
    tip: "Este menu é exclusivo do administrador. Se esquecer sua senha, solicite a um administrador que defina uma nova em sua conta.",
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
      "Escolha o relatório: Ativos por localização, Conferências de inventário, Disponibilizados, Transferidos, Baixados, Divergências ou Histórico de movimentações.",
      "Clique no botão correspondente para baixar o arquivo CSV.",
      "Abra o arquivo no seu programa de planilhas. Se necessário, use a função de importar CSV para reconhecer corretamente as colunas e os caracteres.",
    ],
    tip: "Os ativos baixados continuam disponíveis no histórico. Editar o CSV baixado não altera os registros no sistema.",
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
    tip: "Este menu é exclusivo do administrador e serve para consulta; ele não reverte operações.",
  },
];

export function Help({ state }: { state: AppState }) {
  if (state.section !== "help") return null;
  return (
    <div className="help-page">
      <p className="subtitle">
        Guia de uso do sistema. Encontre o menu desejado no índice ou siga o
        roteiro para começar.
      </p>
      <section className="panel" aria-labelledby="help-start">
        <h2 id="help-start">Primeiros passos</h2>
        <ol>
          <li>
            O administrador cadastra as <strong>Localizações</strong>, as{" "}
            <strong>Unidades</strong> de destino e os <strong>Usuários</strong>.
          </li>
          <li>
            Em <strong>Importar planilha</strong>, baixe o modelo, preencha a
            base e revise a prévia antes de aplicar.
          </li>
          <li>
            Em <strong>Ativos</strong>, associe os bens às localizações e
            confira os dados importados.
          </li>
          <li>
            Em <strong>Inventários</strong>, faça a conferência física e trate
            as ocorrências em <strong>Divergências</strong>.
          </li>
          <li>
            Acompanhe a situação em <strong>Visão geral</strong> e exporte os
            resultados em <strong>Relatórios</strong>.
          </li>
        </ol>
      </section>
      <section className="panel" aria-labelledby="help-access">
        <h2 id="help-access">Seu perfil e as permissões</h2>
        <p>
          <strong>Consulta:</strong> consulta os registros e exporta relatórios.{" "}
          <strong>Responsável patrimonial:</strong> também registra
          conferências, resolve divergências e realiza operações nos ativos.{" "}
          <strong>Administrador:</strong> também importa planilhas, gerencia
          localizações, unidades e usuários, configura parâmetros e consulta a
          auditoria.
        </p>
        <p>
          Alguns menus ou botões aparecem apenas para os perfis autorizados. As
          instruções abaixo descrevem todos os menus; se uma opção não estiver
          disponível, consulte o administrador.
        </p>
      </section>
      <section className="panel" aria-labelledby="help-index">
        <h2 id="help-index">Guia por menu</h2>
        <div className="help-index">
          {guides.map((guide) => (
            <a key={guide.section} href={`#help-${guide.section}`}>
              {sections[guide.section]}
            </a>
          ))}
        </div>
      </section>
      {guides.map((guide) => (
        <section
          className="panel help-guide"
          key={guide.section}
          id={`help-${guide.section}`}
          aria-labelledby={`help-title-${guide.section}`}
        >
          <div className="help-heading">
            <h2 id={`help-title-${guide.section}`}>
              {sections[guide.section]}
            </h2>
            {(state.admin ||
              !["imports", "users", "settings", "audit"].includes(
                guide.section,
              )) && (
              <button
                className="secondary"
                onClick={() => {
                  state.choose(guide.section);
                  window.scrollTo(0, 0);
                }}
              >
                Abrir {sections[guide.section]} →
              </button>
            )}
          </div>
          <p>{guide.purpose}</p>
          <ol>
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="help-tip">
            <strong>Lembrete:</strong> {guide.tip}
          </p>
          <a href="#help-index">Voltar ao índice ↑</a>
        </section>
      ))}
      <section className="panel" aria-labelledby="help-status">
        <h2 id="help-status">O que significa cada status do ativo?</h2>
        <dl>
          <dt>Ativo (A)</dt>
          <dd>
            Bem em uso, que pode ter a localização atualizada ou ser
            disponibilizado.
          </dd>
          <dt>Disponibilizado (D)</dt>
          <dd>
            Bem oferecido para outra unidade; pode ser reservado e transportado.
          </dd>
          <dt>Transferido (T)</dt>
          <dd>Transferência para a unidade de destino concluída.</dd>
          <dt>A baixar (B)</dt>
          <dd>
            O prazo de disponibilização foi ultrapassado sem reserva; aguarda o
            tratamento administrativo.
          </dd>
          <dt>Baixado (X)</dt>
          <dd>
            Baixa definitiva registrada com justificativa; dados e histórico
            preservados.
          </dd>
        </dl>
      </section>
      <section className="panel" aria-labelledby="help-questions">
        <h2 id="help-questions">Dúvidas frequentes</h2>
        <details>
          <summary>Por que a lista de ativos está vazia?</summary>
          <p>
            Limpe os filtros em Ativos. Se a base ainda não tiver sido
            cadastrada, peça ao administrador para importar a planilha.
            Cadastrar uma localização não cria ativos.
          </p>
        </details>
        <details>
          <summary>
            O sistema informou que o registro foi alterado. O que fazer?
          </summary>
          <p>
            Abra novamente o ativo e confira os dados e o histórico mais
            recentes antes de repetir a operação. Em uma importação, gere uma
            nova prévia e revise suas decisões.
          </p>
        </details>
        <details>
          <summary>
            Posso encerrar um inventário com leituras pendentes no celular?
          </summary>
          <p>
            Sincronize e revise as pendências de todos os aparelhos primeiro.
            Depois do encerramento, essas leituras não serão aceitas. Se a
            sessão expirar, entre novamente com a mesma conta e acompanhe a
            sincronização.
          </p>
        </details>
        <details>
          <summary>Como sei se uma operação foi concluída?</summary>
          <p>
            Aguarde a mensagem de confirmação e confira o registro atualizado.
            Se aparecer um erro, leia a mensagem e corrija a informação
            solicitada antes de tentar novamente.
          </p>
        </details>
        <details>
          <summary>Como encerro meu acesso?</summary>
          <p>
            Clique em Sair na barra lateral ao terminar, principalmente se
            estiver usando um computador compartilhado.
          </p>
        </details>
      </section>
    </div>
  );
}
