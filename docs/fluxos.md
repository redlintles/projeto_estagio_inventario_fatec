# Fluxos operacionais

## Implantação da base

1. Criar administrador, localizações e unidades.
2. Baixar o modelo e comparar com a planilha oficial quando ela estiver disponível.
3. Analisar o arquivo, corrigir inconsistências e confirmar os registros válidos.
4. Usar o primeiro inventário para preencher localizações e conferir a situação física.

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

Ativo A + foto + nota física 1–5 → D, data de disponibilização, histórico e e-mail em fila. A lista de destinatários é configurada na tela Parâmetros. A API não precisa esperar o SMTP para confirmar a operação.

Sem reserva, se o tempo superar PRAZO_BAIXA_DIAS, D → B e uma notificação ao CPS é enfileirada. A tarefa verifica a cada minuto, permitindo execução diária ou externa no futuro. Comparação é estrita: exatamente 20 dias não ultrapassa um parâmetro 20.

## Reserva e transporte

D → reserva para uma unidade ativa. Enquanto RESERVED ou IN_TRANSIT, o prazo fica suspenso. Iniciar transporte muda somente a reserva. Confirmar conclusão muda a reserva para COMPLETED e o ativo para T. Cancelar em qualquer uma dessas duas etapas muda a reserva para CANCELLED e reinicia a contagem do ativo D a partir do cancelamento.

Datas e detalhes de todas as etapas ficam no histórico. Não há acesso obrigatório da unidade de destino. A equipe local registra a solicitação recebida pelos meios institucionais e confirma a movimentação realizada.

## Baixa

Somente B permite baixa. Informe justificativa; o servidor grava X e histórico na mesma transação. Se um lote contém ativo em estado inválido, nenhum ativo do lote é baixado. Baixa no sistema é registro administrativo e pressupõe que o responsável obteve a autorização institucional necessária.

## Reimportação

A tela apresenta atual e planilha lado a lado. Escolha manter o atual, aceitar a planilha ou selecionar campos individuais. Localização, fotos, condição, reservas, divergências e histórico não são apagados. Se outro usuário alterar o ativo depois da prévia, a aplicação é recusada e exige nova comparação.
