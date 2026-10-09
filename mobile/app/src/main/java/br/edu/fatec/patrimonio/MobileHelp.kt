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

fun syncStateLabel(state: String): String = when (state) {
  "PENDING" -> "Aguardando envio"
  "PHOTO_PENDING" -> "Conferência enviada · foto pendente"
  "SYNCED" -> "Sincronizado"
  "CONFLICT" -> "Conflito · revisão necessária"
  "ERROR" -> "Erro · revisão necessária"
  "DISCARDED" -> "Tentativa arquivada"
  else -> state
}

fun assetStatusLabel(status: String): String = when (status) {
  "A" -> "Ativo"
  "D" -> "Disponibilizado"
  "T" -> "Transferido"
  "B" -> "A baixar"
  "X" -> "Baixado"
  else -> status
}

private val helpTopics = listOf(
  "Começar e conectar" to listOf(
    "Entre com a conta fornecida pelo administrador. O perfil Consulta permite consultar; os perfis Responsável patrimonial e Administrador permitem registrar operações.",
    "No celular físico, informe a API do servidor da instituição. Na demo em rede, use http://IP_DO_PC:3000/api e inicie o PC com npm run demo:lan. 10.0.2.2 é somente para emuladores.",
    "Na demo por USB, com encaminhamento configurado, use http://127.0.0.1:3000/api e mantenha o cabo conectado. A versão de produção exige HTTPS.",
  ),
  "Base e sincronização" to listOf(
    "Atualizar base baixa ativos, localizações, unidades e inventários. Faça isso com conexão antes de sair para a conferência.",
    "Sincronizar agenda o envio das conferências e fotos salvas. Acompanhe o resultado em Pendências; agendar não significa que o envio já terminou.",
    "O Android pode adiar o envio em segundo plano. Mantenha conexão com o servidor e confira o estado das pendências antes de encerrar o inventário no portal.",
  ),
  "Inventário passo a passo" to listOf(
    "1. Em Preparar a conferência, selecione a localização. Escolha um inventário aberto ou use Preparar novo inventário enquanto estiver online.",
    "2. Em Identificar o bem, digite o patrimônio e toque em Buscar, ou use Ler com câmera.",
    "3. Confira a descrição, o patrimônio e a localização do objeto encontrado. Uma leitura de etiqueta não comprova que ela está no objeto correto.",
    "4. Escolha o resultado da conferência. Quando a localização encontrada difere do cadastro, a conferência correta pode atualizar a localização; registre uma divergência se precisar de revisão.",
    "5. Para divergências, informe a descrição encontrada, observações e uma foto. Na conferência correta, a foto é opcional e você pode avaliar a condição física de 1 a 5.",
    "6. Toque em Confirmar conferência. O registro fica salvo no aparelho e será enviado quando houver conexão. Consulte Pendências para confirmar o envio.",
  ),
  "Câmera e busca manual" to listOf(
    "Autorize a câmera quando solicitado. Enquadre o código inteiro, mantenha o aparelho firme e evite reflexos ou sombras na etiqueta.",
    "Se aparecer Código lido seguido de Nenhum ativo encontrado, a leitura ocorreu, mas o número não está na base local. Confira a etiqueta e atualize a base com conexão.",
    "Uma embalagem de alimento pode ter um código reconhecível, mas não corresponde necessariamente a um patrimônio cadastrado. Se não conseguir ler, digite o número em Buscar.",
    "A câmera lê os formatos de barras habilitados no app. QR não está habilitado. A leitura com um equipamento externo ainda não está integrada.",
  ),
  "Consultar e movimentar ativos" to listOf(
    "Na aba Ativo, busque o patrimônio para consultar descrição, localização e status. As movimentações exigem conexão e um perfil autorizado.",
    "Para um bem Ativo, capture uma foto, avalie a condição física de 1 a 5 e toque em Disponibilizar.",
    "Para um bem Disponibilizado, selecione a unidade ativa de destino e registre a reserva. Se já houver reserva, Avançar reserva / transporte inicia o transporte ou confirma a transferência conforme a etapa atual.",
    "O prazo de baixa fica suspenso durante reserva e transporte. Cancelamentos, tratamento de divergências, encerramento de inventários e baixa definitiva são feitos no portal.",
  ),
  "Entender as pendências" to listOf(
    "Aguardando envio: a conferência está salva apenas no aparelho. Sincronizado: o envio foi concluído.",
    "Conferência enviada · foto pendente: a leitura já chegou ao servidor, mas a foto ainda precisa ser enviada. Não registre a mesma conferência novamente.",
    "Conflito: o registro mudou ou o inventário foi encerrado. Revise a base e o histórico no portal antes de registrar uma nova tentativa.",
    "Erro: confira a mensagem e corrija o problema. Arquivar tentativa para revisão preserva o registro local, mas retira a tentativa do fluxo de envio; faça isso somente depois de revisar.",
    "Se a sessão expirar, saia e entre com a mesma conta para sincronizar suas pendências. Leituras de outra conta não são enviadas em seu nome.",
  ),
  "Trabalhar sem conexão" to listOf(
    "Faça login, atualize a base e prepare ou selecione um inventário enquanto houver conexão. A criação de inventários e as movimentações de ativos exigem acesso ao servidor.",
    "A busca na base local, a leitura pela câmera e o registro de conferências funcionam offline. A fila permanece no aparelho após fechar e abrir o app.",
    "Sincronize todos os aparelhos antes de encerrar o inventário no portal. Uma sessão encerrada recusa leituras posteriores, mesmo que coletadas antes.",
    "Não desinstale o app nem limpe seus dados enquanto houver pendências. Sair da conta preserva a fila; entre novamente com a mesma conta para enviá-la.",
  ),
  "Resolver problemas de acesso" to listOf(
    "Timeout ou falha de conexão: confira o endereço da API, se o servidor está ligado e se o celular alcança a rede do servidor. localhost no celular é o próprio celular.",
    "Base vazia: peça ao administrador para importar os ativos no portal e depois toque em Atualizar base. Criar uma localização não cria ativos.",
    "Opção indisponível: confira o perfil da sua conta, o status do bem e se uma localização ou inventário foi selecionado.",
    "Ao terminar em um aparelho compartilhado, abra Conta no cabeçalho e selecione Sair da conta. As pendências dessa conta são preservadas.",
  ),
)

@Composable
fun MobileHelp() {
  SectionHeading("Ajuda do aplicativo", "Instruções disponíveis neste aparelho, mesmo sem conexão. Toque em um assunto para ler.")
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
