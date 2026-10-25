package br.edu.fatec.patrimonio

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun SectionHeading(title: String, description: String) {
  Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
    Text(title, style = MaterialTheme.typography.titleMedium)
    Text(description, style = MaterialTheme.typography.bodyMedium)
  }
}

@Composable
fun SectionCard(title: String, description: String, content: @Composable ColumnScope.() -> Unit) {
  OutlinedCard(Modifier.fillMaxWidth()) {
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      SectionHeading(title, description)
      content()
    }
  }
}

fun syncStateLabel(state: String, photoOnly: Boolean = false): String =
  when (state) {
    "PENDING" -> "Aguardando envio"
    "PHOTO_PENDING" ->
      if (photoOnly) "Foto aguardando envio" else "Conferência enviada · foto pendente"
    "PHOTO_ERROR" -> "Foto não enviada · revisão necessária"
    "BLOCKED" -> "Envio bloqueado por permissão"
    "SYNCED" -> "Sincronizado"
    "CONFLICT" -> "Conflito · revisão necessária"
    "ERROR" -> "Erro · revisão necessária"
    "DISCARDED" -> "Tentativa arquivada"
    else -> state
  }

fun assetStatusLabel(status: String): String =
  when (status) {
    "I" -> "Incorporado"
    "A" -> "Ativo"
    "D" -> "Disponibilizado"
    "T" -> "Transferido"
    "B" -> "A baixar"
    "X" -> "Baixado"
    else -> status
  }

private val helpTopics =
  listOf(
    "Começar e conectar" to
      listOf(
        "Antes de entrar, use Testar conexão com servidor para verificar o endereço da API. Em Base e sincronização, expanda Atualizar base e sincronizar para acessar os controles. Entre com a conta fornecida pelo administrador. As tarefas dependem das permissões configuradas no portal, e não apenas do nome do perfil. Para coletar, solicite Consultar ativos, Realizar inventários e, quando necessário, Adicionar fotos.",
        "No celular físico, informe a API do servidor da instituição. Na demo em rede, use http://IP_DO_PC:3000/api e inicie o PC com npm start (ou ./iniciar.sh). 10.0.2.2 é somente para emuladores.",
        "Na demo por USB, com encaminhamento configurado, use http://127.0.0.1:3000/api e mantenha o cabo conectado. A versão de produção exige HTTPS.",
      ),
    "Base e sincronização" to
      listOf(
        "Atualizar base baixa os dados permitidos da conta: bens, vínculos de unidade/localização e inventários. Confira a data da última atualização antes de sair para a conferência. Alterações em lote feitas no portal aparecem após atualizar. Leituras já salvas preservam a versão original e podem exigir revisão se o cadastro mudou.",
        "Sincronizar agenda o envio das conferências e fotos salvas. Acompanhe o resultado em Pendências; agendar não significa que o envio já terminou.",
        "O Android pode adiar o envio em segundo plano. Mantenha conexão com o servidor e confira o estado das pendências antes de encerrar o inventário no portal.",
      ),
    "Inventário passo a passo" to
      listOf(
        "1. Em Preparar a conferência, selecione a localização. Escolha um inventário aberto ou use Preparar novo inventário enquanto estiver online.",
        "2. Em Identificar o bem, digite o patrimônio e toque em Buscar, ou use Ler com câmera.",
        "3. Confira a descrição, o patrimônio e a localização do objeto encontrado. Uma leitura de etiqueta não comprova que ela está no objeto correto.",
        "4. Escolha o resultado da conferência. Quando a localização encontrada difere do cadastro, a conferência correta pode atualizar a localização; registre uma divergência se precisar de revisão.",
        "5. Para divergências, informe a descrição encontrada, observações e uma foto. Na conferência correta, a foto é opcional e você pode avaliar a condição física de 1 a 5.",
        "6. Toque em Confirmar conferência. O registro fica salvo no aparelho e será enviado quando houver conexão. Consulte Pendências para confirmar o envio.",
      ),
    "Câmera e busca manual" to
      listOf(
        "Toque em Ler com câmera para abrir o leitor em tela inteira. Após reconhecer o código, a câmera fecha automaticamente para você revisar o bem; Fechar câmera ou Voltar retorna à digitação sem registrar conferência. Autorize a câmera quando solicitado. Enquadre o código inteiro, mantenha o aparelho firme e evite reflexos ou sombras na etiqueta.",
        "Se aparecer Código lido seguido de Nenhum ativo encontrado, a leitura ocorreu, mas o número não está na base local. Confira a etiqueta e atualize a base com conexão.",
        "Código único pode se repetir na planilha. Quando houver mais de um resultado, o aplicativo pede a escolha pelo patrimônio. Se houver muitos, digite o NroPatrimonio completo. Nunca escolha apenas pela aparência do código.",
        "Uma embalagem de alimento pode ter um código reconhecível, mas não corresponde necessariamente a um patrimônio cadastrado. Se não conseguir ler, digite o número em Buscar.",
        "A câmera lê os formatos de barras habilitados no app. QR não está habilitado. A leitura com um equipamento externo ainda não está integrada.",
      ),
    "Identificar e coletar fotos" to
      listOf(
        "Na aba Identificar, busque ou leia a etiqueta para conferir patrimônio, descrição, unidade, localização e situação. Esses dados servem para identificar o objeto durante a coleta.",
        "Com a permissão Adicionar fotos, capture uma imagem e toque em Salvar foto para envio. A foto fica na fila e pode ser enviada depois, sem precisar alterar a situação do bem.",
        "As fotos são preparadas antes de entrar na fila: resolução reduzida, orientação corrigida e metadados removidos. Isso evita arquivos grandes incompatíveis com o servidor.",
        "Disponibilização, reservas, transporte, transferência, baixa, importação, relatórios, permissões e alterações em lote ficam no portal. O celular é um instrumento de coleta.",
      ),
    "Entender as pendências" to
      listOf(
        "Aguardando envio: a conferência está salva apenas no aparelho. Sincronizado: o envio foi concluído.",
        "Conferência enviada · foto pendente: a leitura já chegou ao servidor, mas a foto ainda precisa ser enviada. Não registre a mesma conferência novamente.",
        "Conflito: o registro mudou ou o inventário foi encerrado. Revise a base e o histórico no portal antes de registrar uma nova tentativa.",
        "Erro: confira a mensagem e revise no portal. Em Foto não enviada, a conferência já aceita não é reenviada; Tentar envio novamente retoma apenas a foto. Arquivar tentativa para revisão exige confirmação e preserva o histórico local.",
        "Se a sessão expirar, entre novamente com a mesma conta. Se faltar permissão, peça ao administrador para liberar a tarefa e use Tentar envio novamente. As filas são separadas por conta e endereço do servidor; não altere o endereço enquanto houver pendências sem orientação.",
      ),
    "Trabalhar sem conexão" to
      listOf(
        "Faça login, atualize a base e prepare ou selecione um inventário enquanto houver conexão. A preparação de inventários exige acesso ao servidor; as operações administrativas ficam no portal.",
        "A busca na base local, a leitura pela câmera e o registro de conferências funcionam offline. A fila permanece no aparelho após fechar e abrir o app.",
        "Sincronize todos os aparelhos antes de encerrar o inventário no portal. Uma sessão encerrada recusa leituras posteriores, mesmo que coletadas antes.",
        "Não desinstale o app nem limpe seus dados enquanto houver pendências. Sair da conta preserva a fila; entre novamente com a mesma conta para enviá-la.",
      ),
    "Resolver problemas de acesso" to
      listOf(
        "Timeout ou falha de conexão: confira o endereço da API, se o servidor está ligado e se o celular alcança a rede do servidor. localhost no celular é o próprio celular.",
        "Base vazia: peça ao administrador para importar os ativos no portal e depois toque em Atualizar base. Criar uma localização não cria ativos.",
        "Opção indisponível: confira as permissões da conta, o status do bem e se um inventário aberto foi selecionado. Somente Incorporados e Ativos permitem conferência. Se o servidor mudar os vínculos enquanto você estiver offline, a versão salva pode gerar conflito e exigir revisão no portal.",
        "Ao terminar em um aparelho compartilhado, abra Conta no cabeçalho e selecione Sair da conta. As pendências dessa conta são preservadas.",
      ),
  )

@Composable
fun MobileHelp() {
  SectionHeading(
    "Ajuda do aplicativo",
    "Instruções disponíveis neste aparelho, mesmo sem conexão. Toque em um assunto para ler.",
  )
  helpTopics.forEach { (title, paragraphs) ->
    var expanded by remember { mutableStateOf(false) }
    OutlinedCard(Modifier.fillMaxWidth()) {
      Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(modifier = Modifier.fillMaxWidth(), onClick = { expanded = !expanded }) {
          Text(title, modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
          Text(if (expanded) "−" else "+")
        }
        if (expanded) paragraphs.forEach { Text(it, style = MaterialTheme.typography.bodyMedium) }
      }
    }
  }
}
