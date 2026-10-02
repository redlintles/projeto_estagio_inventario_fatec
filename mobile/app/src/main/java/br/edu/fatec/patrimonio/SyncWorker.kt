package br.edu.fatec.patrimonio

import android.content.Context
import androidx.work.*
import java.io.File
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

/** Mesmo UUID em cada reenvio; o servidor guarda o resultado da primeira aplicação. */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result =
    withContext(Dispatchers.IO) {
      val session = Session(applicationContext)
      if (session.token.isEmpty()) return@withContext Result.success()
      val store = LocalStore(applicationContext)
      val api = Api(session)
      val owner = session.userId
      try {
        for (op in
          store.operations(owner).filter { it.state in listOf("PENDING", "PHOTO_PENDING") }) {
          try {
            if (session.userId != owner || session.token.isBlank())
              return@withContext Result.success()
            var eventId = op.eventId
            if (op.state == "PENDING") {
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
              store.state(
                op.id,
                if (op.photo != null) "PHOTO_PENDING" else "SYNCED",
                eventId = eventId,
              )
              val assets =
                store.snapshot("assets").objects().map {
                  if (it.optString("id") == op.assetId) result.getJSONObject("asset") else it
                }
              if (session.userId == owner && session.token.isNotBlank())
                store.cache("assets", org.json.JSONArray(assets))
            }
            if (op.photo != null) {
              api.photo(op.assetId, File(op.photo), eventId, op.id)
              store.state(op.id, "SYNCED")
              File(op.photo).delete()
            }
          } catch (e: ApiFailure) {
            if (syncDecision(e.status) == SyncDecision.LOGIN) {
              store.state(op.id, op.state, "Faça login com a conta responsável para sincronizar.")
              return@withContext Result.success()
            }
            if (syncDecision(e.status) == SyncDecision.CONFLICT) {
              store.state(op.id, "CONFLICT", e.message ?: "Conflito")
            } else if (syncDecision(e.status) == SyncDecision.INVALID) {
              store.state(op.id, "ERROR", e.message ?: "Dados inválidos")
            } else return@withContext Result.retry()
          }
        }
        Result.success()
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
