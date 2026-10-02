package br.edu.fatec.patrimonio

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject

@Composable
fun PatrimonioApp() {
  val context = LocalContext.current
  val session = remember { Session(context) }
  val store = remember { LocalStore(context) }
  val scope = rememberCoroutineScope()
  var logged by remember { mutableStateOf(session.token.isNotBlank()) }
  var url by remember { mutableStateOf(session.apiUrl) }
  var email by remember { mutableStateOf("") }
  var password by remember { mutableStateOf("") }
  var message by remember { mutableStateOf("") }
  var busy by remember { mutableStateOf(false) }
  var tab by remember { mutableStateOf("Inventário") }
  var refresh by remember { mutableIntStateOf(0) }
  var assets by remember { mutableStateOf(store.snapshot("assets").objects()) }
  var locations by remember { mutableStateOf(store.snapshot("locations").objects()) }
  var units by remember { mutableStateOf(store.snapshot("units").objects()) }
  var inventories by remember { mutableStateOf(store.snapshot("inventories").objects()) }
  var inventoryId by remember { mutableStateOf("") }
  var locationId by remember { mutableStateOf("") }
  var code by remember { mutableStateOf("") }
  var selected by remember { mutableStateOf<JSONObject?>(null) }
  var scanner by remember { mutableStateOf(false) }
  var divergenceType by remember { mutableStateOf("") }
  var found by remember { mutableStateOf("") }
  var notes by remember { mutableStateOf("") }
  var photoPath by remember { mutableStateOf<String?>(null) }
  var takingPhoto by remember { mutableStateOf<File?>(null) }
  var evaluated by remember { mutableStateOf(false) }
  var condition by remember { mutableIntStateOf(3) }
  var destination by remember { mutableStateOf("") }
  val photo =
    rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
      if (success) photoPath = takingPhoto?.absolutePath else takingPhoto?.delete()
    }
  val photoPermission =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      if (granted)
        takingPhoto?.let {
          photo.launch(FileProvider.getUriForFile(context, "${context.packageName}.files", it))
        }
      else message = "Permita a câmera para registrar a foto."
    }
  fun work(block: suspend () -> Unit) {
    scope.launch {
      busy = true
      message = ""
      try {
        block()
      } catch (e: Exception) {
        message = e.message ?: "Falha de comunicação. Os registros locais foram preservados."
      } finally {
        busy = false
        refresh++
      }
    }
  }
  suspend fun reload() {
    val api = Api(session)
    val data =
      withContext(Dispatchers.IO) {
        listOf("assets", "locations", "units", "inventories").associateWith { name ->
          if (name != "assets") JSONArray(api.request(name))
          else {
            val combined = JSONArray()
            var offset = 0
            do {
              val page = JSONArray(api.request("assets?offset=$offset&limit=1000"))
              page.objects().forEach { combined.put(it) }
              offset += page.length()
            } while (page.length() == 1000)
            combined
          }
        }
      }
    for ((name, list) in data) store.cache(name, list)
    assets = data.getValue("assets").objects()
    locations = data.getValue("locations").objects()
    units = data.getValue("units").objects()
    inventories = data.getValue("inventories").objects()
  }
  fun lookup(value: String) {
    code = value
    selected =
      assets.firstOrNull {
        it.optString("patrimony") == value || it.optString("uniqueCode") == value
      }
    message =
      if (selected == null) "Código não encontrado na base local. Atualize os dados com internet."
      else ""
    scanner = false
  }
  LaunchedEffect(logged) {
    if (logged) {
      while (true) {
        delay(3000)
        refresh++
        assets = store.snapshot("assets").objects()
      }
    }
  }
  DisposableEffect(Unit) { onDispose { store.close() } }
  Surface(modifier = Modifier.fillMaxSize()) {
    Column(
      Modifier.padding(20.dp).verticalScroll(rememberScrollState()),
      verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
      Text("Patrimônio Fatec", style = MaterialTheme.typography.headlineMedium)
      if (!logged) {
        Text("Conecte-se antes de preparar o inventário.")
        OutlinedTextField(
          url,
          { url = it },
          label = { Text("Endereço da API") },
          modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
          email,
          { email = it },
          label = { Text("E-mail") },
          modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
          password,
          { password = it },
          label = { Text("Senha") },
          visualTransformation = PasswordVisualTransformation(),
          modifier = Modifier.fillMaxWidth(),
        )
        Button(
          enabled = !busy,
          onClick = {
            work {
              session.apiUrl = url
              val login =
                withContext(Dispatchers.IO) {
                  JSONObject(
                    Api(session)
                      .request(
                        "auth/login",
                        JSONObject().put("email", email).put("password", password),
                      )
                  )
                }
              val id = login.getJSONObject("user").getString("id")
              if (session.userId != id) store.clearSnapshots()
              session.token = login.getString("token")
              session.userId = id
              session.role = login.getJSONObject("user").getString("role")
              password = ""
              logged = true
              reload()
              SyncWorker.schedule(context)
            }
          },
        ) {
          Text("Entrar")
        }
      } else {
        Text("Dados locais: ${assets.size} ativos. Prepare a sala enquanto houver internet.")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Button(
            enabled = !busy,
            onClick = {
              work {
                reload()
                message = "Base local atualizada."
              }
            },
          ) {
            Text("Atualizar base")
          }
          OutlinedButton(
            onClick = {
              SyncWorker.schedule(context)
              message = "Sincronização agendada. Consulte as pendências."
            }
          ) {
            Text("Sincronizar")
          }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          listOf("Inventário", "Ativo", "Pendências").forEach { name ->
            FilterChip(
              selected = tab == name,
              onClick = {
                tab = name
                scanner = false
              },
              label = { Text(name) },
            )
          }
        }
        if (tab == "Pendências") {
          @Suppress("UNUSED_VARIABLE") val revision = refresh
          val operations = store.operations(session.userId)
          Text("${operations.count {it.state!="SYNCED"&&it.state!="DISCARDED"}} pendências")
          operations.forEach { op ->
            Card(Modifier.fillMaxWidth()) {
              Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                  assets.find { it.optString("id") == op.assetId }?.optString("description")
                    ?: op.assetId
                )
                Text(op.state)
                if (op.error.isNotBlank()) Text(op.error)
                if (op.state in listOf("CONFLICT", "ERROR")) {
                  Text(
                    "Revise os dados atuais antes de registrar uma nova conferência. A operação original permanece no histórico local."
                  )
                  OutlinedButton(
                    onClick = {
                      store.state(op.id, "DISCARDED", op.error)
                      refresh++
                    }
                  ) {
                    Text("Arquivar tentativa para revisão")
                  }
                }
              }
            }
          }
        } else {
          if (tab == "Inventário") {
            SelectField(
              "Localização",
              locations.map { it.getString("id") to it.getString("description") },
              locationId,
            ) {
              locationId = it
              inventoryId = ""
              selected = null
            }
            Button(
              enabled = !busy && locationId.isNotBlank() && session.role != "CONSULTA",
              onClick = {
                work {
                  val data =
                    withContext(Dispatchers.IO) {
                      JSONObject(
                        Api(session)
                          .request("inventories", JSONObject().put("locationId", locationId))
                      )
                    }
                  inventoryId = data.getString("id")
                  inventories = inventories + data
                  store.cache("inventories", JSONArray(inventories))
                  message = "Inventário preparado. Agora é possível conferir sem internet."
                }
              },
            ) {
              Text("Preparar novo inventário")
            }
            SelectField(
              "Inventário aberto",
              inventories
                .filter {
                  it.optString("status") == "OPEN" &&
                    (locationId.isBlank() || it.optString("locationId") == locationId)
                }
                .map {
                  it.getString("id") to
                    "${it.optString("startedAt").take(16)} · ${it.getString("id").take(8)}"
                },
              inventoryId,
            ) {
              inventoryId = it
              locationId =
                inventories.find { i -> i.getString("id") == it }?.optString("locationId")
                  ?: locationId
            }
          }
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
              code,
              { code = it },
              label = { Text("Código de barras / patrimônio") },
              modifier = Modifier.weight(1f),
            )
            Button(onClick = { lookup(code) }) { Text("Buscar") }
          }
          OutlinedButton(onClick = { scanner = !scanner }) {
            Text(if (scanner) "Fechar câmera" else "Ler com câmera")
          }
          if (scanner) BarcodeCamera(Modifier.fillMaxWidth().height(240.dp)) { lookup(it) }
          selected?.let { asset ->
            Card(Modifier.fillMaxWidth()) {
              Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(asset.getString("description"), style = MaterialTheme.typography.titleLarge)
                Text("Patrimônio ${asset.getString("patrimony")} · ${asset.getString("status")}")
                Text(
                  "Localização: ${locations.find {it.getString("id")==asset.optString("locationId")}?.optString("description")?:"Não definida"}"
                )
                if (session.role != "CONSULTA") {
                  if (tab == "Inventário") {
                    val mismatch = asset.optString("locationId") != locationId
                    if (mismatch)
                      Text(
                        "A localização encontrada difere do cadastro. Registre uma divergência ou confirme explicitamente a correção."
                      )
                    SelectField(
                      "Resultado",
                      listOf(
                        "" to "Conferência correta / atualizar localização",
                        "WRONG_LOCATION" to "Localização incorreta",
                        "WRONG_LABEL" to "Etiqueta incorreta",
                        "WRONG_ITEM" to "Bem diferente",
                        "DUPLICATE" to "Patrimônio duplicado",
                        "OTHER" to "Outra divergência",
                      ),
                      divergenceType,
                    ) {
                      divergenceType = it
                    }
                    Row {
                      Checkbox(checked = evaluated, onCheckedChange = { evaluated = it })
                      Text("Avaliar condição física")
                    }
                    if (evaluated) {
                      Text("Condição: $condition / 5")
                      Slider(
                        value = condition.toFloat(),
                        onValueChange = { condition = it.toInt() },
                        valueRange = 1f..5f,
                        steps = 3,
                      )
                    }
                    if (divergenceType.isNotBlank()) {
                      OutlinedTextField(
                        found,
                        { found = it },
                        label = { Text("Descrição encontrada") },
                      )
                      OutlinedTextField(notes, { notes = it }, label = { Text("Observação") })
                    }
                  }
                  OutlinedButton(
                    onClick = {
                      val dir = File(context.filesDir, "photos").apply { mkdirs() }
                      val file = File(dir, "${UUID.randomUUID()}.jpg")
                      takingPhoto = file
                      if (
                        ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                          PackageManager.PERMISSION_GRANTED
                      )
                        photo.launch(
                          FileProvider.getUriForFile(context, "${context.packageName}.files", file)
                        )
                      else photoPermission.launch(Manifest.permission.CAMERA)
                    }
                  ) {
                    Text(if (photoPath == null) "Capturar foto" else "Foto registrada")
                  }
                  if (tab == "Inventário")
                    Button(
                      enabled =
                        inventoryId.isNotBlank() &&
                          !busy &&
                          (divergenceType.isBlank() || (found.isNotBlank() && photoPath != null)),
                      onClick = {
                        if (store.hasReading(session.userId, inventoryId, asset.getString("id")))
                          message = "Este ativo já tem uma conferência registrada localmente."
                        else {
                          val input =
                            JSONObject()
                              .put("assetId", asset.getString("id"))
                              .put("expectedVersion", asset.getInt("version"))
                              .put("observedAt", Instant.now().toString())
                          if (evaluated && divergenceType.isBlank())
                            input.put("condition", condition)
                          if (divergenceType.isNotBlank())
                            input.put(
                              "divergence",
                              JSONObject()
                                .put("type", divergenceType)
                                .put("foundDescription", found)
                                .put("notes", notes),
                            )
                          store.queue(
                            session.userId,
                            inventoryId,
                            asset.getString("id"),
                            input,
                            photoPath,
                          )
                          SyncWorker.schedule(context)
                          selected = null
                          code = ""
                          photoPath = null
                          divergenceType = ""
                          found = ""
                          notes = ""
                          refresh++
                          message =
                            "Conferência salva no aparelho. Será sincronizada quando houver conexão."
                        }
                      },
                    ) {
                      Text("Confirmar conferência")
                    }
                  if (tab == "Ativo") {
                    Text("Movimentações exigem conexão e são validadas pelo servidor.")
                    if (asset.optString("status") == "A") {
                      Text("Condição física: $condition / 5")
                      Slider(
                        value = condition.toFloat(),
                        onValueChange = { condition = it.toInt() },
                        valueRange = 1f..5f,
                        steps = 3,
                      )
                      Button(
                        enabled = !busy && photoPath != null,
                        onClick = {
                          work {
                            withContext(Dispatchers.IO) {
                              val api = Api(session)
                              api.photo(asset.getString("id"), File(photoPath!!))
                              api.request(
                                "assets/${asset.getString("id")}/available",
                                JSONObject()
                                  .put("expectedVersion", asset.getInt("version"))
                                  .put("condition", condition),
                              )
                            }
                            photoPath = null
                            selected = null
                            reload()
                            message = "Ativo disponibilizado."
                          }
                        },
                      ) {
                        Text("Disponibilizar")
                      }
                    }
                    if (asset.optString("status") == "D") {
                      SelectField(
                        "Unidade de destino",
                        units
                          .filter { it.optBoolean("active") }
                          .map { it.getString("id") to it.getString("name") },
                        destination,
                      ) {
                        destination = it
                      }
                      Button(
                        enabled = !busy && destination.isNotBlank(),
                        onClick = {
                          work {
                            withContext(Dispatchers.IO) {
                              Api(session)
                                .request(
                                  "assets/${asset.getString("id")}/reservations",
                                  JSONObject()
                                    .put("expectedVersion", asset.getInt("version"))
                                    .put("destinationUnitId", destination),
                                )
                            }
                            reload()
                            selected = null
                            message = "Reserva registrada."
                          }
                        },
                      ) {
                        Text("Reservar para transferência")
                      }
                      Button(
                        enabled = !busy,
                        onClick = {
                          work {
                            val details =
                              withContext(Dispatchers.IO) {
                                JSONObject(Api(session).request("assets/${asset.getString("id")}"))
                              }
                            val reservation =
                              details.getJSONArray("reservations").objects().firstOrNull {
                                it.optString("status") in listOf("RESERVED", "IN_TRANSIT")
                              } ?: error("Não há reserva ativa.")
                            val action =
                              if (reservation.getString("status") == "RESERVED") "dispatch"
                              else "complete"
                            withContext(Dispatchers.IO) {
                              Api(session)
                                .request(
                                  "reservations/${reservation.getString("id")}/$action",
                                  JSONObject().put("expectedVersion", details.getInt("version")),
                                )
                            }
                            reload()
                            selected = null
                            message =
                              if (action == "dispatch") "Transporte iniciado."
                              else "Transferência concluída."
                          }
                        },
                      ) {
                        Text("Avançar reserva / transporte")
                      }
                    }
                  }
                }
              }
            }
          }
        }
        OutlinedButton(
          onClick = {
            session.token = ""
            logged = false
            assets = emptyList()
            locations = emptyList()
            units = emptyList()
            inventories = emptyList()
            store.clearSnapshots()
            selected = null
          }
        ) {
          Text("Sair (pendências preservadas para esta conta)")
        }
      }
      if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
      if (message.isNotBlank()) Text(message, color = MaterialTheme.colorScheme.primary)
    }
  }
}

@Composable
fun SelectField(
  label: String,
  options: List<Pair<String, String>>,
  value: String,
  onChange: (String) -> Unit,
) {
  var expanded by remember { mutableStateOf(false) }
  Column {
    Text(label, style = MaterialTheme.typography.labelLarge)
    Box {
      OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
        Text(options.find { it.first == value }?.second ?: "Selecione")
      }
      DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
        options.forEach { (key, text) ->
          DropdownMenuItem(
            text = { Text(text) },
            onClick = {
              onChange(key)
              expanded = false
            },
          )
        }
      }
    }
  }
}
