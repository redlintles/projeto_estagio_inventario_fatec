package br.edu.fatec.patrimonio

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.time.Instant
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

/** Fila durável, separada por servidor e conta. Atualizações nunca apagam pendências. */
class LocalStore(
  context: Context,
  private val server: String? = null,
  private val owner: String? = null,
) : SQLiteOpenHelper(context, "patrimonio.db", null, 2) {
  private val session = Session(context)

  private fun serverKey() = server ?: session.apiUrl

  private fun scope(name: String) = "${serverKey()}|${owner ?: session.userId}|$name"

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("CREATE TABLE snapshots (name TEXT PRIMARY KEY, payload TEXT NOT NULL)")
    db.execSQL(
      "CREATE TABLE operations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, inventory_id TEXT NOT NULL, asset_id TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL, error TEXT NOT NULL, photo TEXT, event_id TEXT, server_key TEXT NOT NULL, asset_label TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '')"
    )
    createIndex(db)
  }

  private fun createIndex(db: SQLiteDatabase) {
    db.execSQL("CREATE INDEX operations_scope ON operations(server_key,user_id,state)")
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    if (oldVersion < 2) {
      db.execSQL("ALTER TABLE operations ADD COLUMN server_key TEXT NOT NULL DEFAULT ''")
      db.execSQL("ALTER TABLE operations ADD COLUMN asset_label TEXT NOT NULL DEFAULT ''")
      db.execSQL("ALTER TABLE operations ADD COLUMN created_at TEXT NOT NULL DEFAULT ''")
      db.execSQL("UPDATE operations SET server_key=?", arrayOf(serverKey()))
      // O cache antigo não tem dono comprovável. A fila e os arquivos são preservados.
      db.delete("snapshots", null, null)
      createIndex(db)
    }
  }

  fun snapshot(name: String): JSONArray {
    readableDatabase
      .rawQuery("SELECT payload FROM snapshots WHERE name=?", arrayOf(scope(name)))
      .use {
        return if (it.moveToFirst()) JSONArray(it.getString(0)) else JSONArray()
      }
  }

  fun cache(name: String, data: JSONArray) {
    writableDatabase.insertWithOnConflict(
      "snapshots",
      null,
      ContentValues().apply {
        put("name", scope(name))
        put("payload", data.toString())
      },
      SQLiteDatabase.CONFLICT_REPLACE,
    )
  }

  fun cacheBase(data: Map<String, JSONArray>, updatedAt: String): Map<String, JSONArray> =
    synchronized(LocalStore::class.java) {
      val result = data.toMutableMap()
      val previous = snapshot("assets").objects().associateBy { it.optString("id") }
      data["assets"]?.let { fresh ->
        result["assets"] =
          JSONArray(
            fresh.objects().map { asset ->
              previous[asset.optString("id")]?.takeIf {
                it.optInt("version") > asset.optInt("version")
              } ?: asset
            }
          )
      }
      val db = writableDatabase
      db.beginTransaction()
      try {
        result.forEach { (name, rows) -> cache(name, rows) }
        cache("metadata", JSONArray().put(JSONObject().put("updatedAt", updatedAt)))
        db.setTransactionSuccessful()
      } finally {
        db.endTransaction()
      }
      result
    }

  fun queue(
    userId: String,
    inventoryId: String,
    assetId: String,
    input: JSONObject,
    photo: String?,
    label: String = "",
  ): String {
    val db = writableDatabase
    db.beginTransaction()
    try {
      check(inventoryId.isBlank() || !hasReading(userId, inventoryId, assetId)) {
        "Este bem já possui conferência neste inventário no aparelho."
      }
      val id = UUID.randomUUID().toString()
      db.insertOrThrow(
        "operations",
        null,
        ContentValues().apply {
          put("id", id)
          put("user_id", userId)
          put("inventory_id", inventoryId)
          put("asset_id", assetId)
          put("payload", input.toString())
          put("state", if (inventoryId.isBlank()) "PHOTO_PENDING" else "PENDING")
          put("error", "")
          put("photo", photo)
          put("server_key", serverKey())
          put("asset_label", label)
          put("created_at", Instant.now().toString())
        },
      )
      db.setTransactionSuccessful()
      return id
    } finally {
      db.endTransaction()
    }
  }

  fun operations(userId: String, activeOnly: Boolean = false): List<PendingOperation> {
    val list = mutableListOf<PendingOperation>()
    readableDatabase
      .rawQuery(
        "SELECT id,inventory_id,asset_id,payload,state,error,photo,event_id,asset_label,created_at FROM operations WHERE user_id=? AND server_key=? ${if(activeOnly) "AND state IN ('PENDING','PHOTO_PENDING')" else ""} ORDER BY rowid",
        arrayOf(userId, serverKey()),
      )
      .use { c ->
        while (c.moveToNext()) list.add(
          PendingOperation(
            c.getString(0),
            c.getString(1),
            c.getString(2),
            c.getString(3),
            c.getString(4),
            c.getString(5),
            c.getString(6),
            c.getString(7),
            c.getString(8),
            c.getString(9),
          )
        )
      }
    return list
  }

  fun state(id: String, state: String, error: String = "", eventId: String? = null) {
    writableDatabase.update(
      "operations",
      ContentValues().apply {
        put("state", state)
        put("error", error)
        if (eventId != null) put("event_id", eventId)
      },
      "id=? AND server_key=?",
      arrayOf(id, serverKey()),
    )
  }

  fun hasReading(userId: String, inventoryId: String, assetId: String): Boolean {
    readableDatabase
      .rawQuery(
        "SELECT 1 FROM operations WHERE server_key=? AND user_id=? AND inventory_id=? AND asset_id=? AND state!='DISCARDED' LIMIT 1",
        arrayOf(serverKey(), userId, inventoryId, assetId),
      )
      .use {
        return it.moveToFirst()
      }
  }

  fun clearSnapshots() {
    writableDatabase.delete(
      "snapshots",
      "name IN (?,?,?,?)",
      arrayOf(scope("assets"), scope("locations"), scope("units"), scope("inventories")),
    )
  }
}

data class PendingOperation(
  val id: String,
  val inventoryId: String,
  val assetId: String,
  val payload: String,
  val state: String,
  val error: String,
  val photo: String?,
  val eventId: String?,
  val label: String = "",
  val createdAt: String = "",
)

fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
