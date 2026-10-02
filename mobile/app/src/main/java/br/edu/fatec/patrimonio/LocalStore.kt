package br.edu.fatec.patrimonio

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

/** SQLite é a fila durável. Nunca excluímos pendências quando a conexão falha. */
class LocalStore(context: Context) : SQLiteOpenHelper(context, "patrimonio.db", null, 1) {
  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("CREATE TABLE snapshots (name TEXT PRIMARY KEY, payload TEXT NOT NULL)")
    db.execSQL(
      "CREATE TABLE operations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, inventory_id TEXT NOT NULL, asset_id TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL, error TEXT NOT NULL, photo TEXT, event_id TEXT)"
    )
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    error("Implemente migration SQLite antes de mudar a versão; nunca apague a fila.")
  }

  fun snapshot(name: String): JSONArray {
    readableDatabase.rawQuery("SELECT payload FROM snapshots WHERE name=?", arrayOf(name)).use {
      return if (it.moveToFirst()) JSONArray(it.getString(0)) else JSONArray()
    }
  }

  fun cache(name: String, data: JSONArray) {
    writableDatabase.insertWithOnConflict(
      "snapshots",
      null,
      ContentValues().apply {
        put("name", name)
        put("payload", data.toString())
      },
      SQLiteDatabase.CONFLICT_REPLACE,
    )
  }

  fun queue(
    userId: String,
    inventoryId: String,
    assetId: String,
    input: JSONObject,
    photo: String?,
  ): String {
    val id = UUID.randomUUID().toString()
    writableDatabase.insertOrThrow(
      "operations",
      null,
      ContentValues().apply {
        put("id", id)
        put("user_id", userId)
        put("inventory_id", inventoryId)
        put("asset_id", assetId)
        put("payload", input.toString())
        put("state", "PENDING")
        put("error", "")
        put("photo", photo)
      },
    )
    return id
  }

  fun operations(userId: String): List<PendingOperation> {
    val list = mutableListOf<PendingOperation>()
    readableDatabase
      .rawQuery(
        "SELECT id,inventory_id,asset_id,payload,state,error,photo,event_id FROM operations WHERE user_id=? ORDER BY rowid",
        arrayOf(userId),
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
          )
        )
      }
    return list
  }

  fun state(id: String, state: String, error: String = "", eventId: String? = null) {
    val values =
      ContentValues().apply {
        put("state", state)
        put("error", error)
        if (eventId != null) put("event_id", eventId)
      }
    writableDatabase.update("operations", values, "id=?", arrayOf(id))
  }

  fun hasReading(userId: String, inventoryId: String, assetId: String) =
    operations(userId).any {
      it.inventoryId == inventoryId && it.assetId == assetId && it.state != "DISCARDED"
    }

  fun clearSnapshots() {
    writableDatabase.delete("snapshots", null, null)
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
)

fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
