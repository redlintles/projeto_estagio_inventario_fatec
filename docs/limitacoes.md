# Limitações e homologação pendente

A importação foi adaptada ao modelo institucional recebido, incluindo cabeçalhos, Incorporado/Baixado, identificadores preservados e resultados salvos de fórmulas. Novos arquivos precisam seguir esse contrato, descrito em docs/importacao.md. As etiquetas e os aparelhos reais ainda exigem homologação de foco, iluminação e formato de código de barras. Bens sem etiqueta e QR estão fora do escopo confirmado.

A hospedagem definitiva, SMTP real, política dos aparelhos, certificados, assinatura release e recuperação de desastres dependem da instituição. Compose oferece um ambiente de desenvolvimento; não constitui uma implantação operacional homologada.

A base mobile é um snapshot carregado quando há rede; inventários precisam ser preparados online. Não há criação offline de sessões, reserva ou transferência offline. Leitura em inventário encerrado gera conflito. A sincronização pode ser adiada pelo Android e nunca substitui revisão humana de conflitos.

A consulta de ativos é paginada; o aplicativo percorre as páginas ao atualizar a base. Inventários recentes são limitados a 500 e listagens de divergências/auditoria a 5.000 registros; arquivos de importação têm limite de 10.000 linhas. Para bases grandes, planeje sincronização incremental, paginação das demais listagens e exportações em streaming. Não há otimização para múltiplas dezenas de milhares de fotos ou entrega simultânea de muitos e-mails.

Os relatórios oferecem CSV, XLSX e ODS, filtros e prévia de 30 linhas, com referências legíveis em lugar de UUIDs. Cada solicitação aceita até 20.000 bens candidatos ou registros; o excesso gera erro explícito e exige exportar por filtros em partes. Em históricos, o limite de bens candidatos é aplicado antes do período dos eventos: restrinja unidade, localização, grupo ou patrimônio quando necessário. Não há diagramação PDF. A conferência por localização pode ser consultada na sessão, incluindo itens ainda não vistos. Não há formulários oficiais de autorização institucional de baixa/transferência nem integração com sistemas externos do CPS.

A fila de SMTP tem entrega pelo menos uma vez; falha após aceitação pelo servidor de e-mail pode produzir reenvio. Fotos offline usam um uploadId estável e são verificadas por conteúdo para evitar duplicação em reenvios. Auditoria protege rastreabilidade pela aplicação, sem assinatura criptográfica contra alteração direta por administrador PostgreSQL.

Cadastro, edição e inativação estão disponíveis no portal. Não há recuperação de senha por e-mail: o administrador redefine a senha pelo cadastro de usuários.

Testes unitários, integração, compilação e lint não comprovam a câmera real ou cobertura de rede da escola. Valide o roteiro em docs/testes.md antes de uso operacional.

## Capacidade e operações simultâneas

Duas operações de arquivo (upload de foto, análise de planilha ou geração/prévia de relatório) podem executar simultaneamente por processo. O excesso recebe 503 e Retry-After de 15 segundos; aguarde e repita. Até quatro cálculos assíncronos de senha podem executar em paralelo; o excesso também recebe 503. Esses limites não substituem monitoramento de CPU, memória, disco e conexões nem proteção no proxy. O parser de Excel e a geração das planilhas ainda usam processamento síncrono: bases maiores exigirão trabalhos em segundo plano ou streaming, com testes de carga no hardware institucional.
