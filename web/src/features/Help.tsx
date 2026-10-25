import React from "react";
import { helpGuides } from "./help-guides";
import { AppState } from "../app-state";
import { sections } from "../navigation";

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
            <strong>Unidades</strong> vinculadas aos bens e de destino e os{" "}
            <strong>Usuários</strong>.
          </li>
          <li>
            Em <strong>Importar planilha</strong>, baixe o modelo, preencha a
            base, escolha a unidade cadastrada e selecione o arquivo. Os novos
            bens válidos são importados automaticamente; revise apenas os
            conflitos.
          </li>
          <li>
            Em <strong>Ativos</strong>, associe os bens às unidades e
            localizações e confira os dados importados.
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
      <section className="panel" aria-labelledby="help-lan">
        <h2 id="help-lan">Coleta Android e acesso pela rede local</h2>
        <p>
          Na máquina servidora, execute npm start ou ./iniciar.sh. Aguarde a
          confirmação de prontidão e use o endereço do portal exibido (porta
          8080) nos outros computadores da mesma LAN.
        </p>
        <p>
          No Android 1.2, configure a API exibida (porta 3000, caminho /api),
          toque em Testar conexão com servidor e entre com sua conta. Atualize a
          base, selecione a sala e um inventário aberto. Ler com câmera abre o
          leitor em tela inteira; a leitura retorna ao formulário para revisão e
          confirmação. Também é possível digitar o patrimônio.
        </p>
        <p>
          Os controles de atualização e envio ficam em Base e sincronização.
          Conferências e fotos ficam salvas no aparelho até o envio; confira
          Pendências e atualize o inventário no portal antes de encerrá-lo. Para
          uso institucional com dados reais, siga a implantação HTTPS.
        </p>
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
          Os perfis são modelos iniciais. Permissões personalizadas podem
          liberar ou retirar tarefas de Consulta e Responsável patrimonial;
          administradores têm acesso global. Menus e botões seguem as permissões
          da conta. As instruções abaixo descrevem todos os menus; se uma opção
          não estiver disponível, consulte o administrador.
        </p>
      </section>
      <section className="panel" aria-labelledby="help-index">
        <h2 id="help-index">Guia por menu</h2>
        <div className="help-index">
          {helpGuides.map((guide) => (
            <a key={guide.section} href={`#help-${guide.section}`}>
              {sections[guide.section]}
            </a>
          ))}
        </div>
      </section>
      {helpGuides.map((guide) => (
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
            {state.canAccessSection(guide.section) && (
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
          <dt>Incorporado (I)</dt>
          <dd>
            Bem incorporado na base oficial. A conferência correta em inventário
            muda o status para Ativo; também pode ser disponibilizado.
          </dd>
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
      <section className="panel" aria-labelledby="help-mobile">
        <h2 id="help-mobile">Portal e coleta no celular</h2>
        <p>
          Use o portal para cadastrar, importar, vincular unidades e
          localizações em lote, desfazer e refazer lotes, exportar relatórios e
          administrar acessos. O celular identifica bens, registra conferências
          e divergências e envia fotos; não precisa reproduzir os menus de
          gestão.
        </p>
        <p>
          Antes da coleta, atualize a base e prepare o inventário com conexão.
          Depois, confirme a sincronização das leituras e fotos antes de
          encerrar o inventário. Se o portal alterar um bem enquanto o celular
          estiver offline, a versão antiga será encaminhada para revisão, sem
          sobrescrever o cadastro atualizado.
        </p>
      </section>
      <section className="panel" aria-labelledby="help-questions">
        <h2 id="help-questions">Dúvidas frequentes</h2>
        <details>
          <summary>
            O servidor está ocupado ou o relatório ficou grande demais. O que
            fazer?
          </summary>
          <p>
            Aguarde alguns segundos quando o servidor estiver processando
            arquivos. Se a mensagem indicar mais de 20.000 bens ou registros,
            restrinja os filtros de unidade, localização, patrimônio ou grupo e
            exporte em partes. Para históricos, o período também reduz as
            movimentações consultadas. Nenhum relatório parcial é gerado por
            causa desse limite.
          </p>
        </details>
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
