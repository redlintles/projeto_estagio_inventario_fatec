# Limitações e homologação pendente

Esta implementação usa os campos descritos nos briefings, sem acesso à planilha real nem às etiquetas da instituição. A integração real precisa de homologação de cabeçalhos, zeros à esquerda, datas e formato de código de barras. Bens sem etiqueta e QR estão fora do escopo confirmado.

A hospedagem definitiva, SMTP real, política dos aparelhos, certificados, assinatura release e recuperação de desastres dependem da instituição. Compose oferece um ambiente de desenvolvimento; não constitui uma implantação operacional homologada.

A base mobile é um snapshot carregado quando há rede; inventários precisam ser preparados online. Não há criação offline de sessões, reserva ou transferência offline. Leitura em inventário encerrado gera conflito. A sincronização pode ser adiada pelo Android e nunca substitui revisão humana de conflitos.

A consulta de ativos é paginada; o aplicativo percorre as páginas ao atualizar a base. Inventários recentes são limitados a 500 e listagens de divergências/auditoria a 5.000 registros; arquivos de importação têm limite de 10.000 linhas. Para bases grandes, planeje sincronização incremental, paginação das demais listagens e exportações em streaming. Não há otimização para múltiplas dezenas de milhares de fotos ou entrega simultânea de muitos e-mails.

Os relatórios são CSV; não há diagramação PDF. A conferência por localização pode ser consultada na sessão, incluindo itens ainda não vistos. Não há formulários oficiais de autorização institucional de baixa/transferência nem integração com sistemas externos do CPS.

A fila de SMTP tem entrega pelo menos uma vez; falha após aceitação pelo servidor de e-mail pode produzir reenvio. Fotos offline usam um uploadId estável e são verificadas por conteúdo para evitar duplicação em reenvios. Auditoria protege rastreabilidade pela aplicação, sem assinatura criptográfica contra alteração direta por administrador PostgreSQL.

Cadastro, edição e inativação estão disponíveis no portal. Não há recuperação de senha por e-mail: o administrador redefine a senha pelo cadastro de usuários.

Testes unitários, integração, compilação e lint não comprovam a câmera real ou cobertura de rede da escola. Valide o roteiro em docs/testes.md antes de uso operacional.
