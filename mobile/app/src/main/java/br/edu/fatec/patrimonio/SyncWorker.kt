package br.edu.fatec.patrimonio

import android.content.Context
import androidx.work.*
import java.io.File
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

/** Leitura e foto têm etapas persistidas e identificadores estáveis em todos os reenvios. */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result =
    withContext(Dispatchers.IO) {
      val session = Session(applicationContext)
      if (session.token.isBlank()) return@withContext Result.success()
      val owner = session.userId
      val server = session.apiUrl
      val token = session.token
      val store = LocalStore(applicationContext, server, owner)
      val api = Api(session)
      var retry = false
      try {
        for (op in store.operations(owner, activeOnly = true)) {
          if (session.userId != owner || session.apiUrl != server || session.token != token)
            return@withContext Result.success()
          var photoStage = op.state == "PHOTO_PENDING"
          var eventId = op.eventId
          try {
            if (!photoStage) {
              val result =
                JSONObject(
                  api.request(
                    "sync",
                    JSONObject()
                      .put("operationId", op.id)
                      .put("inventoryId", op.inventoryId)
                      .put("input", JSONObject(op.payload)),
                  )
                )
              eventId = result.optString("divergenceId").takeIf { it.isNotBlank() && it != "null" }
              photoStage = op.photo != null
              store.state(op.id, if (photoStage) "PHOTO_PENDING" else "SYNCED", eventId = eventId)
              val incoming = result.getJSONObject("asset")
              synchronized(LocalStore::class.java) {
                val assets =
                  store.snapshot("assets").objects().map {
                    if (
                      it.optString("id") == op.assetId &&
                        incoming.optInt("version") >= it.optInt("version")
                    )
                      incoming
                    else it
                  }
                store.cache("assets", org.json.JSONArray(assets))
              }
            }
            if (photoStage) {
              if (session.userId != owner || session.apiUrl != server || session.token != token)
                return@withContext Result.success()
              val file = op.photo?.let { File(it) }
              if (file == null || !file.isFile) {
                store.state(
                  op.id,
                  "PHOTO_ERROR",
                  "O registro foi preservado, mas o arquivo de foto não está disponível. Revise no portal.",
                  eventId,
                )
                continue
              }
              api.photo(op.assetId, file, eventId, op.id)
              store.state(op.id, "SYNCED")
              file.delete()
            }
          } catch (e: ApiFailure) {
            val decision = syncDecision(e.status)
            if (decision == SyncDecision.LOGIN) {
              store.state(
                op.id,
                if (photoStage) "PHOTO_PENDING" else "PENDING",
                "Sessão expirada ou acesso alterado. Entre novamente com a mesma conta.",
                eventId,
              )
              return@withContext Result.success()
            }
            if (decision == SyncDecision.RETRY) {
              store.state(
                op.id,
                if (photoStage) "PHOTO_PENDING" else "PENDING",
                e.message ?: "Envio temporariamente indisponível.",
                eventId,
              )
              retry = true
            } else
              store.state(
                op.id,
                failureState(photoStage, decision),
                if (decision == SyncDecision.BLOCKED)
                  "Permissão insuficiente. Solicite ao administrador a tarefa necessária. ${e.message}"
                else e.message ?: "Revise os dados.",
                eventId,
              )
          } catch (e: java.io.IOException) {
            store.state(
              op.id,
              if (photoStage) "PHOTO_PENDING" else "PENDING",
              "Sem comunicação com o servidor; envio preservado.",
              eventId,
            )
            retry = true
          }
          if (retry) break
        }
        if (retry) Result.retry() else Result.success()
      } catch (_: Exception) {
        Result.retry()
      } finally {
        store.close()
      }
    }

  companion object {
    fun schedule(context: Context) {
      val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
      val manager = WorkManager.getInstance(context)
      manager.enqueueUniqueWork(
        "sync-now",
        ExistingWorkPolicy.KEEP,
        OneTimeWorkRequestBuilder<SyncWorker>()
          .setConstraints(constraints)
          .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
          .build(),
      )
      manager.enqueueUniquePeriodicWork(
        "sync-periodic",
        ExistingPeriodicWorkPolicy.KEEP,
        PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
          .setConstraints(constraints)
          .build(),
      )
    }
  }
}
