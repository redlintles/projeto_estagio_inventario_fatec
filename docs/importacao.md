# Importação da base patrimonial

## Modelo institucional

A aba deve conter estes cabeçalhos na primeira linha: **NroPatrimonio**, **Descrição do Bem**, **Grupo patrimonial**, **Código único**, **Unidade**, **Data de Incorporação**, **Status** e **Valor R$**. A ordem das colunas pode variar; acentos, espaços e capitalização dos cabeçalhos são normalizados. O botão Baixar modelo fornece esse formato com dados fictícios. O formato anterior com nomes técnicos continua aceito para compatibilidade.

O UUID é a identidade interna imutável do ativo. NroPatrimonio é usado para conciliar a reimportação com o cadastro existente: um patrimônio diferente é um novo bem. Patrimônios repetidos no mesmo arquivo são sinalizados para revisão, sem escolher uma linha arbitrariamente. Código único é preservado e pode se repetir; não é mais uma chave exclusiva nem necessariamente o código de barras da etiqueta. Se o Android encontrar vários bens pelo código, solicita NroPatrimonio.

Identificadores de texto preservam zeros à esquerda. Identificadores numéricos inteiros não recebem as casas decimais do formato monetário da célula. Um identificador longo que ultrapasse a precisão segura do Excel/JavaScript deve ser fornecido como texto: dígitos já perdidos pelo arquivo não podem ser reconstruídos.

## Datas e valores

Datas Excel são interpretadas pelo calendário do arquivo, sem deslocamento por fuso horário; também são aceitas datas ISO e dd/mm/aaaa. Valores numéricos, decimais e moeda brasileira são normalizados em centavos, sem conversão indevida de separadores. A linha final Total é reconhecida pela estrutura e não gera um ativo. Linhas incompletas comuns continuam aparecendo como erros na prévia.

Fórmulas não são executadas no servidor. São usados os resultados armazenados no arquivo; fórmulas sem resultado exigem recalcular e salvar no Excel/LibreOffice. Um cache pode estar desatualizado, portanto a planilha deve ser salva após recalcular antes do envio.

O sistema oferece nativamente os dois cálculos presentes no exemplo:

- O total da base é calculado no PostgreSQL com SUM decimal e aparece na Visão geral, incluindo bens baixados, como a soma da planilha. Novas inclusões e alterações recalculam esse total sem depender de um arquivo Excel.
- No cadastro manual, escolha um ativo de referência no campo Cálculo do valor para calcular seu valor + R$ 1,00, equivalente ao encadeamento entre as linhas do exemplo. O servidor lê o valor da referência e calcula em centavos. Essa opção é explícita: valores patrimoniais reais não são incrementados silenciosamente por padrão. Também é possível informar um valor manual.

O sistema não tenta executar fórmulas arbitrárias, macros, links externos ou INDIRECT; o total é obtido diretamente da base. Não existe uma dependência dinâmica entre valores de ativos depois da inclusão: o valor calculado fica registrado e sua alteração posterior passa pela reimportação com histórico.

## Status e conciliação

- Incorporado → **I**, diferente de Ativo.
- Baixado → **X**, histórico baixado da fonte.
- Uma conferência correta transforma Incorporado em **Ativo A** e registra o histórico. Registrar divergência mantém o estado anterior.
- Localização e disponibilização aceitam Incorporado e Ativo. Disponibilização, reserva, transporte e prazo continuam com seus estados próprios.

Ao selecionar o arquivo, novos bens válidos são gravados automaticamente com histórico. Registros idênticos são mantidos sem alterar a versão. Apenas registros existentes com diferenças aparecem para revisão, inicialmente sem escolha definida. Cada conflito exige uma escolha explícita entre manter os dados atuais e aceitar campos da planilha; Salvar escolhas confirma essas alterações. Novos bens já importados não dependem dessa confirmação. Linhas inválidas aparecem em uma lista separada e não são gravadas. Uma reimportação pode atualizar ou reativar um bem conforme a fonte, com o mesmo UUID e histórico. Uma reserva ou transporte em andamento precisa ser resolvido antes de trocar o status pela importação; isso evita deixar reservas ativas em bens baixados ou reincorporados.

Localização, fotos, condição, divergências e histórico não são apagados. Ativos ausentes do arquivo não são excluídos. Alterações concorrentes invalidam a prévia. Ela é privada para o usuário autorizado que a criou e expira em 24 horas; após aplicar, as cópias de dados das linhas são removidas da prévia.

Limites: 8 MB de upload, 32 MB descompactados, até 16 MB por entrada ZIP, 512 entradas, uma aba, 10.000 ativos e 32 colunas. Uploads excedentes devem ser divididos em arquivos menores, preservando os cabeçalhos e os patrimônios.

## Unidade cadastrada e localização

Antes de carregar o arquivo, escolha uma unidade ativa já cadastrada no sistema. Os novos ativos são vinculados a essa unidade sem alterar o conteúdo da coluna Unidade da planilha. Para bens existentes, uma diferença nesse vínculo aparece entre os conflitos e pode ser aceita ou mantida. Bens já importados sem vínculo podem ser associados reimportando a planilha e aceitando o campo Unidade cadastrada.

Na lista de Ativos, marque os bens e escolha uma localização ativa na área Localização em lote. É possível selecionar até 500 bens entre páginas; mudar filtros limpa a seleção. Quem tem permissão locations.manage pode cadastrar uma localização nessa área e aplicá-la ao grupo. A operação aceita bens Incorporados e Ativos, registra o histórico de cada alteração e cancela todo o lote se houver alteração concorrente ou item inválido.

A unidade cadastrada também pode ser vinculada sem reimportar a planilha: em Ativos, marque os bens Incorporados ou Ativos e use o cartão Vincular unidade. Escolha uma unidade ativa e aplique ao lote. A operação preserva a coluna Unidade original e a localização, registra o histórico e verifica alterações concorrentes. Cada ação concluída limpa a seleção para evitar reutilizar versões anteriores dos registros.

Para abranger todos os resultados, use Selecionar tudo com os filtros atuais. Sem unidade vinculada e Sem localização permitem localizar cadastros incompletos. A seleção global abrange todas as páginas; a seleção manual continua limitada a 500. A confirmação informa a quantidade que realmente mudará. Cada lote fica no Histórico de alterações em lote e pode ser desfeito enquanto nenhum de seus ativos tiver alterações posteriores. A reversão restaura inclusive valores ausentes, registra auditoria e mantém a operação original no histórico.

Depois de desfazer um lote, Refazer lote reaplica o destino original aos mesmos bens, com permissão própria e nova versão no histórico. Alteração posterior em qualquer bem bloqueia toda a operação; destino inativo impede refazer. Ver versões do lote identifica data, responsável e quantidade de cada aplicação, reversão ou reaplicação. O modal de confirmação mostra a quantidade antes de executar.
