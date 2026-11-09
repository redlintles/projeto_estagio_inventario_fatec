package br.edu.fatec.patrimonio

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.json.JSONObject

@Composable
fun InventoryPanel(
  inventory: JSONObject,
  progress: InventoryProgress,
  assets: List<JSONObject>,
  operations: List<PendingOperation>,
  locationName: String,
  canManage: Boolean,
  busy: Boolean,
  onComplete: () -> Unit,
  onCancel: () -> Unit,
  onSync: () -> Unit,
  onNext: () -> Unit,
) {
  val cancel =
    operations.find {
      JSONObject(it.payload).optString("_action") == "CANCEL" && it.state != "DISCARDED"
    }
  val complete =
    operations.find {
      JSONObject(it.payload).optString("_action") == "COMPLETE" && it.state != "DISCARDED"
    }
  val pending = operations.count { it.state !in listOf("SYNCED", "DISCARDED") }
  val cancelled = cancel != null || inventory.optString("status") == "CANCELLED"
  // Concluído = comando explícito do usuário ou sessão já fechada no servidor.
  val completed = !cancelled && (complete != null || inventory.optString("status") == "CLOSED")
  val open = inventory.optString("status") == "OPEN"
  SectionCard(
    "Inventário atual · $locationName",
    "Iniciado em ${localDateTime(inventory.optString("startedAt"))}",
  ) {
    if (progress.initial) {
      Text("Inventário inicial", style = MaterialTheme.typography.titleMedium)
      Text(
        "Nenhum bem tinha esta sala como localização quando o inventário começou. Leia cada bem encontrado e confirme a conferência: ele passará a constar nesta localização."
      )
      Text("${progress.added.size} bens registrados nesta sala")
    } else {
      Text("${progress.found.size} encontrados · ${progress.notFound.size} não encontrados")
      LinearProgressIndicator(progress = { progress.fraction }, modifier = Modifier.fillMaxWidth())
      Text(
        "${progress.recorded} de ${progress.total} registrados · ${progress.remaining.size} faltam"
      )
      if (progress.added.isNotEmpty())
        Text("${progress.added.size} bens fora da lista adicionados a esta sala")
    }
    Text(
      when {
        cancelled && cancel?.state == "SYNCED" -> "Cancelamento sincronizado. A sala foi liberada."
        cancelled && inventory.optString("status") == "CANCELLED" ->
          "Inventário cancelado no servidor."
        cancelled -> "Cancelamento salvo no aparelho. Sincronize para liberar a sala no servidor."
        completed && complete?.state == "SYNCED" && pending == 0 ->
          "Inventário concluído e sincronizado. A sala foi liberada."
        completed && inventory.optString("status") == "CLOSED" && pending == 0 ->
          "Inventário concluído no servidor."
        completed ->
          "Conclusão salva no aparelho. Sincronize os dados para concluir no servidor e liberar a sala."
        inventory.optString("status") == "CLOSED" -> "Inventário encerrado no servidor."
        open && progress.canComplete ->
          if (progress.initial)
            "Quando terminar de ler os bens da sala, toque em Concluir inventário."
          else "Todos os bens esperados têm resultado. Leia bens extras, se houver, e conclua."
        pending == 0 -> "Todos os resultados salvos até agora estão sincronizados."
        else -> "$pending envios pendentes. Os resultados locais estão preservados."
      },
      style = MaterialTheme.typography.bodyMedium,
    )
    operations
      .filter { it.state !in listOf("SYNCED", "DISCARDED") && it.error.isNotBlank() }
      .take(3)
      .forEach { Text("${it.label}: ${it.error}", color = MaterialTheme.colorScheme.error) }
    Button(onClick = onSync, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
      Text("Sincronizar dados")
    }
    if (!cancelled && !completed && open) {
      Button(
        onClick = onComplete,
        enabled = canManage && !busy && progress.canComplete,
        modifier = Modifier.fillMaxWidth(),
      ) {
        Text("Concluir inventário")
      }
      if (!progress.canComplete)
        Text(
          "Para concluir, registre os ${progress.remaining.size} bens que faltam (leitura ou Não encontrei).",
          style = MaterialTheme.typography.bodySmall,
        )
    }
    if (!cancelled && !completed && open) {
      OutlinedButton(
        onClick = onCancel,
        enabled = canManage && !busy,
        modifier = Modifier.fillMaxWidth(),
      ) {
        Text("Cancelar inventário")
      }
    }
    if (cancelled || completed || !open) {
      OutlinedButton(onClick = onNext, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
        Text("Escolher outro inventário / localização")
      }
    }
  }
}

@Composable
fun InventoryExpectedList(
  inventory: JSONObject,
  progress: InventoryProgress,
  assets: List<JSONObject>,
  canManage: Boolean,
  busy: Boolean,
  onMissing: (String) -> Unit,
) {
  if (progress.remaining.isNotEmpty()) {
    SectionCard(
      "Bens que faltam encontrar",
      "Lista local da sala no início do inventário. Confirme a leitura ou informe Não encontrei para registrar um resultado.",
    ) {
      val catalog =
        (inventory.optJSONArray("expectedAssets")?.objects().orEmpty() + assets).associateBy {
          it.optString("id")
        }
      // Paginação local evita que a lista inteira ocupe a tela de coleta.
      var shown by remember(inventory.optString("id")) { mutableIntStateOf(10) }
      progress.remaining.take(shown).forEach { id ->
        val asset = catalog[id]
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Column(Modifier.weight(1f)) {
            Text(asset?.optString("patrimony") ?: id, style = MaterialTheme.typography.titleSmall)
            Text(
              asset?.optString("description")
                ?: "Bem esperado — atualize a base para consultar a descrição."
            )
          }
          OutlinedButton(onClick = { onMissing(id) }, enabled = canManage && !busy) {
            Text("Não encontrei")
          }
        }
        HorizontalDivider()
      }
      if (shown < progress.remaining.size)
        TextButton(onClick = { shown += 20 }) {
          Text("Mostrar mais bens (${progress.remaining.size - shown})")
        }
    }
  }
}
