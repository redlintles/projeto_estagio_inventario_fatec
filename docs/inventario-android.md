# Inventário guiado no Android 1.3

## Preparação e lista local

Inicie o inventário online para reservar a localização no servidor e receber o snapshot dos bens esperados: ativos nos estados Incorporado e Ativo daquela sala no início da sessão. Atualize a base antes da coleta. A sessão pertence à conta que a iniciou; essa conta pode retomá-la depois de reiniciar o app. Um administrador também pode intervir. Para abrir uma sessão já existente pela primeira vez no aparelho, consulte seus detalhes com conexão; depois ela fica disponível localmente.

A lista mostra patrimônio e descrição dos bens ainda sem resultado. Ela usa o snapshot inicial, por isso mudar o cadastro da sala depois não altera o denominador do progresso. A lista é paginada localmente para não ocupar toda a tela. O leitor e a busca manual ficam antes dela; ao identificar um bem, a lista dá espaço ao formulário de revisão.

A leitura de barras identifica o bem. **Confirmar conferência** registra o resultado no SQLite e remove o item da lista imediatamente, mesmo offline. Divergências também contam como resultado registrado, sem afirmar que o cadastro está correto. Bens extras registrados durante a sessão não aumentam o total esperado nem substituem bens faltantes.

## Não encontrado e progresso

Use **Não encontrei** ao lado do bem e confirme. Isso grava o resultado `NOT_FOUND` no mesmo inventário, com autor e instante da observação. Não muda situação patrimonial, versão, localização ou unidade do bem e não provoca baixa automática. A ausência pode ser consultada nos detalhes do inventário e no relatório de conferências do portal.

A barra mostra resultados registrados sobre o total esperado. Os números separam encontrados (conferências corretas e divergências), não encontrados e quantos ainda faltam registrar. Tentativas arquivadas deixam de contar localmente; resultados já aceitos no servidor continuam tendo precedência. Um conflito ou erro de envio é exibido mesmo que todos os resultados tenham sido registrados localmente.

## Conclusão e sincronização

Ao esvaziar a lista, aparece **Inventário concluído**. Esse splash indica conclusão da coleta local e orienta sincronizar. O app guarda um comando de conclusão durável e o WorkManager envia as conferências/ausências, as fotos e, por último, solicita a conclusão no servidor. Uma sala sem bens esperados também pode ser concluída.

A tela distingue coleta concluída de **Inventário concluído e sincronizado**. Fotos pendentes ou em erro e conflitos bloqueiam a conclusão remota. Revise **Pendências**, retome envios quando apropriado e aguarde a confirmação. O servidor verifica que todos os IDs esperados têm resultado antes de aceitar `complete`. Se a resposta se perder, reenviar a conclusão não duplica resultados. A lista e a fila continuam separadas por conta e endereço de API.

Quando o servidor aceita a conclusão, fecha a sessão e libera a sala para outra abertura. Não desinstale nem limpe os dados antes de concluir os envios.

## Cancelamento

**Cancelar inventário** abre uma confirmação. O pedido é persistido, inclusive offline, e impede novas coletas naquela sessão no aparelho. A sala permanece reservada até o servidor receber o cancelamento.

O envio prioriza o cancelamento e o servidor o aplica de forma idempotente. Os resultados já aceitos permanecem no histórico. Após a confirmação, tentativas locais ainda não enviadas são arquivadas (`DISCARDED`), sem apagá-las. Fotos cuja leitura já foi aceita continuam podendo ser enviadas. O cancelamento não desfaz atualizações cadastrais de conferências já aceitas.

Se o app estiver sem conexão, não é possível afirmar que a sala foi liberada: a interface mostra **Cancelamento salvo no aparelho** até receber a confirmação. O botão para escolher outra localização não encerra nem cancela implicitamente sessões no servidor.

## Concorrência e Parâmetros

`INVENTARIO_EXCLUSIVO_LOCAL=true` é criado pela migration `InventoryProgress1786000000000` e é o padrão mesmo se o parâmetro não estiver cadastrado. Ao iniciar, o servidor trava a linha da localização na transação e consulta sessões abertas: aberturas concorrentes para a mesma sala são serializadas, e apenas uma passa. Salas diferentes podem trabalhar simultaneamente. O bloqueio se aplica tanto ao Android quanto ao portal e permanece enquanto a sessão estiver `OPEN`, mesmo que o celular esteja offline.

Em **Parâmetros → Inventário exclusivo por localização**, somente um administrador pode desativar a proteção. A interface exige confirmar o aviso: sessões simultâneas podem duplicar trabalho, gerar conflitos de versão e produzir resultados incompatíveis. O endpoint também restringe essa alteração a administradores, mesmo que outra conta tenha permissão para editar os demais parâmetros.

Com a proteção desligada, cada responsável abre sua própria sessão; outra conta não pode assumir uma sessão existente. Reativar bloqueia novas aberturas, mas não apaga nem cancela sessões que já estavam abertas. Se houver inventários antigos sobrepostos, conclua ou cancele cada um antes de abrir outro. Não há liberação por tempo: um administrador deve intervir numa sessão abandonada pelo endpoint de cancelamento ou coordenar com o responsável.

## Atualização

Atualize primeiro a API/migrations e o dashboard com `npm start`, depois o APK 1.3.0 (versionCode 5) com `adb install -r`. A migração preserva sessões, itens, contas e filas anteriores; não exige recriar o banco Android. Para reverter a migration, é necessário tratar explicitamente registros `CANCELLED`/`NOT_FOUND`: o rollback recusa convertê-los silenciosamente em resultados antigos.

O APK está em `mobile/app/build/outputs/apk/debug/app-debug.apk`, com cópia em `entregaveis/patrimonio-fatec-1.3.0-debug.apk`. A conta de coleta existente mantém as mesmas seis permissões; nenhuma permissão administrativa adicional é necessária.
