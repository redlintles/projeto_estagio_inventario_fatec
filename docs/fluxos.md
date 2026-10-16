# Fluxos operacionais

## Implantação da base

1. Criar administrador, localizações e unidades.
2. Conferir o modelo institucional e escolher a unidade cadastrada à qual a planilha pertence.
3. Selecionar o arquivo para importar automaticamente os novos bens válidos. Corrigir linhas inválidas e resolver somente os conflitos, salvando as escolhas.
4. Usar os filtros e a seleção em lote de Ativos para preencher unidades/localizações ausentes; depois conferir a situação física em inventário.

Uma importação não remove ativos ausentes do arquivo. O número patrimonial identifica o registro na reimportação. Mudanças nesse identificador exigem atenção: um patrimônio diferente será tratado como outro ativo.

## Inventário

Prepare a sessão online. O sistema captura os ativos que estavam na localização no início. No aparelho, atualize a base antes de sair da área com internet. Cada leitura apresenta descrição e patrimônio para confirmação humana; a câmera não consegue determinar se a etiqueta está no objeto correto.

Quando tudo confere, confirme. Se encontrar etiqueta incorreta, objeto diferente, código duplicado ou localização irregular, registre a divergência e foto. A divergência não altera automaticamente a localização oficial. Tratamento posterior exige justificativa e pode escolher nova localização explicitamente.

A sessão mostra conferidos e esperados ainda não vistos. Não encontrar um ativo não gera baixa automática. Antes de encerrar o inventário, sincronize todos os aparelhos envolvidos; sessões fechadas recusam leituras posteriores, mesmo coletadas antes do fechamento.

## Offline e revisão

Estados locais: PENDING (aguarda API), PHOTO_PENDING (conferência aplicada, foto ainda pendente), SYNCED, CONFLICT, ERROR e DISCARDED (tentativa arquivada pelo operador para revisão). A fila tem a conta responsável por cada leitura.

Quando a conexão retorna, WorkManager envia pendências. Android pode adiar tarefas em economia de bateria; o botão Sincronizar agenda nova execução. Se o token expirou, refaça login com a mesma conta. Conflitos não são sobrescritos. Atualize a base, confira o histórico e arquive a tentativa antiga apenas após revisão; se necessário, faça uma nova conferência com novo UUID e versão atual.

A foto pode ficar pendente depois da conferência. Nesse caso o item já existe no servidor e não deve ser digitado novamente. Consulte a fila até confirmar a conclusão.

## Disponibilização e prazo

Incorporado I ou Ativo A + foto + nota física 1–5 → D, data de disponibilização, histórico e e-mail em fila. A lista de destinatários é configurada na tela Parâmetros. A API não precisa esperar o SMTP para confirmar a operação.

Sem reserva, se o tempo superar PRAZO_BAIXA_DIAS, D → B e uma notificação ao CPS é enfileirada. A tarefa verifica a cada minuto, permitindo execução diária ou externa no futuro. Comparação é estrita: exatamente 20 dias não ultrapassa um parâmetro 20.

## Reserva e transporte

D → reserva para uma unidade ativa. Enquanto RESERVED ou IN_TRANSIT, o prazo fica suspenso. Iniciar transporte muda somente a reserva. Confirmar conclusão muda a reserva para COMPLETED e o ativo para T. Cancelar em qualquer uma dessas duas etapas muda a reserva para CANCELLED e reinicia a contagem do ativo D a partir do cancelamento.

Datas e detalhes de todas as etapas ficam no histórico. Não há acesso obrigatório da unidade de destino. A equipe local registra a solicitação recebida pelos meios institucionais e confirma a movimentação realizada.

## Baixa

Somente B permite baixa. Informe justificativa; o servidor grava X e histórico na mesma transação. Se um lote contém ativo em estado inválido, nenhum ativo do lote é baixado. Baixa no sistema é registro administrativo e pressupõe que o responsável obteve a autorização institucional necessária.

## Reimportação

A tela apresenta atual e planilha lado a lado. Escolha manter o atual, aceitar a planilha ou selecionar campos individuais. Localização, fotos, condição, reservas, divergências e histórico não são apagados. Se outro usuário alterar o ativo depois da prévia, a aplicação é recusada e exige nova comparação.

## Alterações em lote e relatórios

Em Ativos, combine filtros (incluindo Sem unidade vinculada e Sem localização) e marque registros ou use Selecionar tudo com os filtros atuais, abrangendo todas as páginas. Escolha unidade ou localização ativa. O modal escurece o fundo e mostra o destino e quantos bens efetivamente mudarão; cancelar não aplica o lote. Apenas Incorporados e Ativos aceitam essas operações.

Histórico de alterações em lote preserva o lote original e suas versões. Desfazer restaura os valores anteriores; Refazer reaplica o destino original aos mesmos bens. Cada tarefa exige a permissão correspondente. Qualquer alteração posterior em um dos bens bloqueia todo o desfazer/refazer; não há aplicação parcial. O destino precisa continuar ativo para refazer. O processamento ocorre em blocos de 500 dentro de uma transação.

Em Relatórios, escolha conteúdo e critérios, confira a prévia e exporte CSV, XLSX ou ODS. Datas de históricos seguem São Paulo; nos relatórios de ativos, o período usa incorporação. Referências usam patrimônio, nomes e descrições. A exportação consulta novamente os dados; não é um retrato congelado da prévia. O limite é 20.000 bens candidatos ou registros por solicitação, com recusa explícita em vez de arquivo parcial. Divida a consulta usando filtros quando necessário.
