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
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
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
  var tab by rememberSaveable {
    mutableStateOf(
      if (session.can("inventories.view")) "Inventário"
      else if (session.can("assets.view")) "Identificar" else "Ajuda"
    )
  }
  var accountMenu by remember { mutableStateOf(false) }
  val contentScroll = rememberScrollState()
  var refresh by remember { mutableIntStateOf(0) }
  var assets by remember { mutableStateOf(store.snapshot("assets").objects()) }
  var locations by remember { mutableStateOf(store.snapshot("locations").objects()) }
  var units by remember { mutableStateOf(store.snapshot("units").objects()) }
  var inventories by remember { mutableStateOf(store.snapshot("inventories").objects()) }
  var inventoryId by rememberSaveable { mutableStateOf("") }
  var locationId by rememberSaveable { mutableStateOf("") }
  var code by rememberSaveable { mutableStateOf("") }
  var candidates by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
  var lastRefresh by remember {
    mutableStateOf(store.snapshot("metadata").objects().firstOrNull()?.optString("updatedAt") ?: "")
  }
  var selected by
    rememberSaveable(
      stateSaver =
        Saver<JSONObject?, String>(save = { it?.toString() }, restore = { JSONObject(it) })
    ) {
      mutableStateOf<JSONObject?>(null)
    }
  var scanner by remember { mutableStateOf(false) }
  var divergenceType by rememberSaveable { mutableStateOf("") }
  var found by rememberSaveable { mutableStateOf("") }
  var notes by rememberSaveable { mutableStateOf("") }
  var photoPath by rememberSaveable { mutableStateOf<String?>(null) }
  var takingPhoto by
    rememberSaveable(
      stateSaver = Saver<File?, String>(save = { it?.absolutePath }, restore = { File(it) })
    ) {
      mutableStateOf<File?>(null)
    }
  var captureScope by rememberSaveable { mutableStateOf("") }
  var archiveOperation by remember { mutableStateOf<PendingOperation?>(null) }
  var evaluated by rememberSaveable { mutableStateOf(false) }
  var condition by rememberSaveable { mutableIntStateOf(3) }

  val photo =
    rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
      val file = takingPhoto
      if (
        success &&
          file != null &&
          captureScope == "${session.userId}|${session.apiUrl}|${selected?.optString("id")}"
      ) {
        scope.launch {
          busy = true
          try {
            withContext(Dispatchers.IO) { PhotoPreparation.prepare(file) }
            if (
              captureScope == "${session.userId}|${session.apiUrl}|${selected?.optString("id")}"
            ) {
              photoPath?.let { File(it).delete() }
              photoPath = file.absolutePath
            } else file.delete()
          } catch (e: Exception) {
            file.delete()
            message = e.message ?: "Não foi possível preparar a foto."
          } finally {
            busy = false
          }
        }
      } else file?.delete()
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
    if (busy) return
    busy = true
    message = ""
    scope.launch {
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
        session.updateAccess(JSONObject(api.request("auth/me")))
        listOf("assets", "locations", "units", "inventories").associateWith { name ->
          if (
            (name == "locations" && !session.can("locations.view")) ||
              (name == "units" && !session.can("units.view")) ||
              (name == "assets" && !session.can("assets.view")) ||
              (name == "inventories" && !session.can("inventories.view"))
          )
            JSONArray()
          else if (name != "assets") JSONArray(api.request(name))
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
    val updatedAt = Instant.now().toString()
    val stored = withContext(Dispatchers.IO) { store.cacheBase(data, updatedAt) }
    assets = stored.getValue("assets").objects()
    locations = stored.getValue("locations").objects()
    units = stored.getValue("units").objects()
    inventories = stored.getValue("inventories").objects()
    lastRefresh = updatedAt
    if (tab == "Inventário" && !session.can("inventories.view"))
      tab = if (session.can("assets.view")) "Identificar" else "Ajuda"
    if (tab == "Identificar" && !session.can("assets.view")) tab = "Ajuda"
    selected =
      selected?.let { previous -> assets.find { it.optString("id") == previous.optString("id") } }
    if (inventories.none { it.optString("id") == inventoryId && it.optString("status") == "OPEN" })
      inventoryId = ""
    if (locations.none { it.optString("id") == locationId && it.optBoolean("active") })
      locationId = ""
  }
  fun lookup(value: String) {
    photoPath?.let { File(it).delete() }
    photoPath = null
    evaluated = false
    condition = 3
    divergenceType = ""
    found = ""
    notes = ""
    code = value.trim()
    val exact = assets.filter { it.optString("patrimony") == code || it.optString("id") == code }
    val matches =
      if (exact.isNotEmpty()) exact else assets.filter { it.optString("uniqueCode") == code }
    candidates = if (matches.size > 1) matches else emptyList()
    selected = matches.singleOrNull()
    message =
      when {
        matches.size > 1 ->
          "Código compartilhado por ${matches.size} ativos. Digite o NroPatrimonio da etiqueta para identificar o bem correto."
        selected == null ->
          "Código lido: $code. Nenhum ativo encontrado na base local. Atualize a base ou confira a etiqueta."
        else -> "Ativo encontrado para o código $code."
      }
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
  LaunchedEffect(tab) { contentScroll.scrollTo(0) }
  archiveOperation?.let { operation ->
    AlertDialog(
      onDismissRequest = { archiveOperation = null },
      title = { Text("Arquivar tentativa?") },
      text = {
        Text(
          "Esta tentativa deixará de ser enviada. O registro local será mantido para revisão e os dados do servidor não serão alterados. Confira o portal antes de registrar outra conferência."
        )
      },
      confirmButton = {
        TextButton(
          onClick = {
            store.state(operation.id, "DISCARDED", operation.error)
            archiveOperation = null
            refresh++
          }
        ) {
          Text("Arquivar tentativa")
        }
      },
      dismissButton = { TextButton(onClick = { archiveOperation = null }) { Text("Cancelar") } },
    )
  }
  Scaffold(
    topBar = {
      Surface(tonalElevation = 2.dp) {
        Row(
          Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 20.dp, vertical = 12.dp),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.SpaceBetween,
        ) {
          Column(Modifier.weight(1f)) {
            Text("Patrimônio Fatec", style = MaterialTheme.typography.titleLarge)
            Text(
              if (logged) tab else "Acesso ao sistema",
              style = MaterialTheme.typography.bodyMedium,
            )
          }
          if (logged)
            Box {
              TextButton(onClick = { accountMenu = true }) { Text("Conta") }
              DropdownMenu(expanded = accountMenu, onDismissRequest = { accountMenu = false }) {
                DropdownMenuItem(
                  text = { Text("Sair da conta") },
                  onClick = {
                    accountMenu = false
                    work {
                      val revoked =
                        withContext(Dispatchers.IO) {
                          try {
                            Api(session).request("auth/logout", JSONObject())
                            true
                          } catch (e: ApiFailure) {
                            e.status == 401
                          } catch (_: Exception) {
                            false
                          }
                        }
                      session.token = ""
                      logged = false
                      assets = emptyList()
                      locations = emptyList()
                      units = emptyList()
                      inventories = emptyList()
                      store.clearSnapshots()
                      selected = null
                      candidates = emptyList()
                      photoPath?.let { File(it).delete() }
                      photoPath = null
                      lastRefresh = ""
                      scanner = false
                      inventoryId = ""
                      locationId = ""
                      message =
                        if (revoked)
                          "Sessões da conta encerradas no servidor. Pendências preservadas."
                        else
                          "Saída local concluída sem conexão. As sessões do servidor expiram ou podem ser revogadas pelo administrador. Pendências preservadas."
                    }
                  },
                )
              }
            }
        }
      }
    },
    bottomBar = {
      if (logged)
        NavigationBar {
          listOf("Inventário" to "✓", "Identificar" to "▣", "Pendências" to "↻", "Ajuda" to "?")
            .filter { (name, _) -> name != "Inventário" || session.can("inventories.view") }
            .filter { (name, _) -> name != "Identificar" || session.can("assets.view") }
            .forEach { (name, symbol) ->
              NavigationBarItem(
                selected = tab == name,
                onClick = {
                  tab = name
                  scanner = false
                  message = ""
                },
                icon = { Text(symbol, style = MaterialTheme.typography.titleLarge) },
                label = { Text(name) },
              )
            }
        }
    },
  ) { insets ->
    Column(Modifier.fillMaxSize().padding(insets).imePadding()) {
      if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
      if (message.isNotBlank())
        Surface(color = MaterialTheme.colorScheme.secondaryContainer) {
          Row(
            Modifier.fillMaxWidth().padding(start = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Text(
              message,
              modifier = Modifier.weight(1f).padding(vertical = 10.dp),
              style = MaterialTheme.typography.bodyMedium,
            )
            TextButton(onClick = { message = "" }) { Text("Fechar") }
          }
        }
      Column(
        Modifier.weight(1f).verticalScroll(contentScroll).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
      ) {
        if (!logged) {
          SectionHeading(
            "Entrar na sua conta",
            "Conecte-se para baixar a base e preparar o inventário. As conferências poderão ser feitas offline depois.",
          )
          Text("Servidor", style = MaterialTheme.typography.titleMedium)
          OutlinedTextField(
            url,
            { url = it },
            label = { Text("Endereço da API") },
            modifier = Modifier.fillMaxWidth(),
            supportingText = {
              Text(
                "Celular na rede: http://IP_DO_PC:3000/api. O endereço 10.0.2.2 é apenas para emulador."
              )
            },
            singleLine = true,
          )
          Text("Credenciais", style = MaterialTheme.typography.titleMedium)
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
            modifier = Modifier.fillMaxWidth(),
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
                session.updateAccess(login.getJSONObject("user"))
                password = ""
                logged = true
                reload()
                tab =
                  if (session.can("inventories.view")) "Inventário"
                  else if (session.can("assets.view")) "Identificar" else "Ajuda"
                SyncWorker.schedule(context)
              }
            },
          ) {
            Text("Entrar")
          }
        } else {
          if (tab == "Inventário" || tab == "Identificar") {
            SectionCard(
              "Base e sincronização",
              "${assets.size} bens na base local · ${if(lastRefresh.isBlank()) "ainda não atualizada" else localDateTime(lastRefresh)}",
            ) {
              Text(
                "Atualize com conexão antes de iniciar a conferência.",
                style = MaterialTheme.typography.bodyMedium,
              )
              Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                  modifier = Modifier.weight(1f),
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
                  modifier = Modifier.weight(1f),
                  enabled = !busy,
                  onClick = {
                    SyncWorker.schedule(context)
                    message = "Sincronização agendada. Consulte as pendências."
                  },
                ) {
                  Text("Sincronizar")
                }
              }
            }
          }
          if (tab == "Ajuda") {
            MobileHelp()
          } else if (tab == "Pendências") {
            @Suppress("UNUSED_VARIABLE") val revision = refresh
            val operations = store.operations(session.userId)
            SectionHeading(
              "Acompanhar envios",
              "${operations.count {it.state!="SYNCED"&&it.state!="DISCARDED"}} pendências desta conta neste servidor. Leituras e fotos são preservadas até o envio.",
            )
            Button(
              modifier = Modifier.fillMaxWidth(),
              onClick = {
                SyncWorker.schedule(context)
                message = "Sincronização agendada. Aguarde a atualização dos estados."
              },
            ) {
              Text("Sincronizar agora")
            }
            if (operations.isEmpty())
              Text("Nenhuma conferência registrada nesta conta. Comece pela aba Inventário.")
            operations.forEach { op ->
              Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                  Text(
                    op.label.ifBlank {
                      assets
                        .find { it.optString("id") == op.assetId }
                        ?.let { "${it.optString("patrimony")} · ${it.optString("description")}" }
                        ?: "Bem registrado anteriormente"
                    }
                  )
                  Text(
                    if (op.inventoryId.isBlank()) "Coleta de foto" else "Conferência de inventário",
                    style = MaterialTheme.typography.labelMedium,
                  )
                  if (op.createdAt.isNotBlank())
                    Text(localDateTime(op.createdAt), style = MaterialTheme.typography.bodySmall)
                  Text(
                    syncStateLabel(op.state, op.inventoryId.isBlank()),
                    style = MaterialTheme.typography.labelLarge,
                  )
                  if (op.error.isNotBlank()) Text(op.error)
                  if (op.state in listOf("BLOCKED", "PHOTO_ERROR")) {
                    OutlinedButton(
                      modifier = Modifier.fillMaxWidth(),
                      onClick = {
                        store.state(
                          op.id,
                          if (op.state == "PHOTO_ERROR") "PHOTO_PENDING" else "PENDING",
                        )
                        SyncWorker.schedule(context)
                        refresh++
                      },
                    ) {
                      Text("Tentar envio novamente")
                    }
                  }
                  if (op.state in listOf("CONFLICT", "ERROR")) {
                    Text(
                      "Revise os dados atuais antes de registrar uma nova conferência. A operação original permanece no histórico local."
                    )
                    OutlinedButton(
                      modifier = Modifier.fillMaxWidth(),
                      onClick = { archiveOperation = op },
                    ) {
                      Text("Arquivar tentativa para revisão")
                    }
                  }
                }
              }
            }
          } else {
            if (tab == "Inventário") {
              if (!session.can("inventories.manage"))
                Text(
                  "Sua conta não possui a tarefa de realizar inventários. Solicite ao administrador; as pendências existentes serão preservadas."
                )
              SectionCard(
                "1 Preparar a conferência",
                "Selecione uma sala e um inventário aberto, ou crie um novo enquanto estiver online.",
              ) {
                SelectField(
                  "Localização",
                  locations
                    .filter { it.optBoolean("active") }
                    .map { it.getString("id") to it.getString("description") },
                  locationId,
                ) {
                  photoPath?.let { path -> File(path).delete() }
                  photoPath = null
                  locationId = it
                  inventoryId = ""
                  selected = null
                }
                Button(
                  modifier = Modifier.fillMaxWidth(),
                  enabled = !busy && locationId.isNotBlank() && session.can("inventories.manage"),
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
                        "${locations.find { l -> l.optString("id")==it.optString("locationId") }?.optString("description") ?: "Localização"} · ${localDateTime(it.optString("startedAt"))}"
                    },
                  inventoryId,
                ) {
                  selected = null
                  photoPath?.let { path -> File(path).delete() }
                  photoPath = null
                  inventoryId = it
                  locationId =
                    inventories.find { i -> i.getString("id") == it }?.optString("locationId")
                      ?: locationId
                }
              }
            }
            SectionCard(
              if (tab == "Inventário") "2 Identificar o bem" else "Identificar e fotografar",
              "Digite o patrimônio ou leia a etiqueta pela câmera.",
            ) {
              Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
              ) {
                OutlinedTextField(
                  code,
                  {
                    code = it
                    selected = null
                    candidates = emptyList()
                    photoPath?.let { path -> File(path).delete() }
                    photoPath = null
                  },
                  enabled = !busy,
                  label = { Text("Código de barras / patrimônio") },
                  modifier = Modifier.weight(1f),
                )
                Button(enabled = code.isNotBlank() && !busy, onClick = { lookup(code) }) {
                  Text("Buscar")
                }
              }
              OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = { scanner = !scanner }) {
                Text(if (scanner) "Fechar câmera" else "Ler com câmera")
              }
              if (scanner) {
                Text(
                  "Enquadre o código inteiro, mantenha o aparelho firme e evite reflexos.",
                  style = MaterialTheme.typography.bodyMedium,
                )
                BarcodeCamera(Modifier.fillMaxWidth().height(240.dp)) { lookup(it) }
              }
            }
            if (selected == null && tab == "Identificar")
              Text(
                "A identificação do bem e a coleta de foto aparecerão abaixo da busca.",
                style = MaterialTheme.typography.bodyMedium,
              )
            if (candidates.isNotEmpty())
              SectionCard(
                "Código compartilhado",
                "${candidates.size} bens correspondem a este código. Confira o patrimônio da etiqueta para escolher; a seleção não registra a conferência.",
              ) {
                candidates.take(20).forEach { candidate ->
                  OutlinedButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                      selected = candidate
                      candidates = emptyList()
                      message = "Bem selecionado pelo patrimônio. Confira antes de registrar."
                    },
                  ) {
                    Text(
                      "${candidate.optString("patrimony")} · ${candidate.optString("description")}"
                    )
                  }
                }
                if (candidates.size > 20)
                  Text("Há mais resultados. Digite o patrimônio completo para identificar o bem.")
              }
            selected?.let { asset ->
              Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                  Text(
                    if (tab == "Inventário") "3 Conferir e registrar" else "Dados do ativo",
                    style = MaterialTheme.typography.labelLarge,
                  )
                  Text(asset.getString("description"), style = MaterialTheme.typography.titleLarge)
                  Text(
                    "Patrimônio ${asset.getString("patrimony")} · ${assetStatusLabel(asset.getString("status"))}"
                  )
                  Text(
                    "Unidade: ${units.find { it.optString("id")==asset.optString("unitId") }?.optString("name") ?: "Não vinculada"}"
                  )
                  if (!canCollect(asset.optString("status")))
                    Text("Este status não permite conferência. Solicite revisão no portal.")
                  Text(
                    "Localização: ${locations.find {it.getString("id")==asset.optString("locationId")}?.optString("description")?:"Não definida"}"
                  )
                  if (session.can("inventories.manage") || session.can("photos.upload")) {
                    if (
                      tab == "Inventário" &&
                        session.can("inventories.manage") &&
                        canCollect(asset.optString("status"))
                    ) {
                      val mismatch = asset.optString("locationId") != locationId
                      if (mismatch)
                        Text(
                          "A localização encontrada difere do cadastro. Registre uma divergência ou confirme explicitamente a correção."
                        )
                      if (!session.can("photos.upload"))
                        Text(
                          "Sua conta pode registrar conferências sem foto. Para divergências com foto, solicite a permissão Adicionar fotos."
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
                      Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = evaluated, onCheckedChange = { evaluated = it })
                        Text("Avaliar condição física", modifier = Modifier.weight(1f))
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
                          { found = it.take(255) },
                          label = { Text("Descrição encontrada") },
                          modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedTextField(
                          notes,
                          { notes = it.take(2000) },
                          label = { Text("Observação") },
                          modifier = Modifier.fillMaxWidth(),
                        )
                      }
                    }
                    if (
                      session.can("photos.upload") &&
                        (tab == "Inventário" || canCollect(asset.optString("status")))
                    ) {
                      HorizontalDivider()
                      Text("Foto do bem", style = MaterialTheme.typography.titleMedium)
                      Text(
                        if (tab == "Inventário")
                          "Obrigatória para divergências; opcional na conferência correta."
                        else "Colete uma foto do bem e salve para envio, mesmo sem conexão.",
                        style = MaterialTheme.typography.bodyMedium,
                      )
                      OutlinedButton(
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !busy,
                        onClick = {
                          val dir = File(context.filesDir, "photos").apply { mkdirs() }
                          val file = File(dir, "${UUID.randomUUID()}.jpg")
                          captureScope =
                            "${session.userId}|${session.apiUrl}|${asset.getString("id")}"
                          takingPhoto = file
                          if (
                            ContextCompat.checkSelfPermission(
                              context,
                              Manifest.permission.CAMERA,
                            ) == PackageManager.PERMISSION_GRANTED
                          )
                            photo.launch(
                              FileProvider.getUriForFile(
                                context,
                                "${context.packageName}.files",
                                file,
                              )
                            )
                          else photoPermission.launch(Manifest.permission.CAMERA)
                        },
                      ) {
                        Text(if (photoPath == null) "Capturar foto" else "Foto registrada")
                      }
                    }
                    if (tab == "Inventário" && session.can("inventories.manage"))
                      Button(
                        modifier = Modifier.fillMaxWidth(),
                        enabled =
                          canCollect(asset.optString("status")) &&
                            inventories.any {
                              it.optString("id") == inventoryId && it.optString("status") == "OPEN"
                            } &&
                            !busy &&
                            (divergenceType.isBlank() ||
                              (session.can("photos.upload") &&
                                found.isNotBlank() &&
                                photoPath != null)),
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
                              "${asset.optString("patrimony")} · ${asset.optString("description")}",
                            )
                            SyncWorker.schedule(context)
                            selected = null
                            evaluated = false
                            condition = 3
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
                    if (
                      tab == "Identificar" &&
                        session.can("photos.upload") &&
                        canCollect(asset.optString("status"))
                    ) {
                      Button(
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !busy && photoPath != null,
                        onClick = {
                          work {
                            store.queue(
                              session.userId,
                              "",
                              asset.getString("id"),
                              JSONObject(),
                              photoPath,
                              "${asset.optString("patrimony")} · ${asset.optString("description")}",
                            )
                            photoPath = null
                            SyncWorker.schedule(context)
                            message = "Foto salva para envio. Acompanhe em Pendências."
                          }
                        },
                      ) {
                        Text("Salvar foto para envio")
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
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
  Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
    Text(label, style = MaterialTheme.typography.labelLarge)
    Box {
      OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
        Text(
          options.find { it.first == value }?.second
            ?: if (options.isEmpty()) "Nenhuma opção disponível" else "Selecione"
        )
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
