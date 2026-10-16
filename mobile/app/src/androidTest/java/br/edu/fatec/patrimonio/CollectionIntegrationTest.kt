package br.edu.fatec.patrimonio

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.ExifInterface
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.work.testing.TestListenableWorkerBuilder
import java.io.File
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** Executar somente no emulador descartável, com o servidor de teste em 127.0.0.1:3101. */
@RunWith(AndroidJUnit4::class)
class CollectionIntegrationTest {
  private lateinit var context: Context
  private lateinit var session: Session

  @Before
  fun setup() {
    org.junit.Assume.assumeTrue(
      "Use somente emulador descartável autorizado",
      android.os.Build.HARDWARE in listOf("ranchu", "goldfish") &&
        androidx.test.platform.app.InstrumentationRegistry.getArguments()
          .getString("fatecDisposable") == "true",
    )
    context = ApplicationProvider.getApplicationContext()
    context.deleteDatabase("patrimonio.db")
    session = Session(context)
    session.apiUrl = "http://127.0.0.1:3101/api"
    session.userId = "test-owner"
    session.token = "test-token"
  }

  @Test
  fun sqliteUpgradePreservesReadingsPhotosAndLabels() {
    val file = File(context.filesDir, "legacy-photo.jpg").apply { writeText("preserved") }
    val db = SQLiteDatabase.openOrCreateDatabase(context.getDatabasePath("patrimonio.db"), null)
    db.execSQL("CREATE TABLE snapshots(name TEXT PRIMARY KEY,payload TEXT NOT NULL)")
    db.execSQL(
      "CREATE TABLE operations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,inventory_id TEXT NOT NULL,asset_id TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,error TEXT NOT NULL,photo TEXT,event_id TEXT)"
    )
    db.execSQL("INSERT INTO snapshots VALUES('assets','[]')")
    db.execSQL(
      "INSERT INTO operations VALUES('legacy','test-owner','inventory','asset','{}','PHOTO_PENDING','',?,'event')",
      arrayOf(file.path),
    )
    db.version = 1
    db.close()
    LocalStore(context).use { store ->
      val op = store.operations(session.userId).single()
      assertEquals("legacy", op.id)
      assertEquals("PHOTO_PENDING", op.state)
      assertEquals("event", op.eventId)
      assertEquals(file.path, op.photo)
      assertTrue(file.exists())
      assertEquals(0, store.snapshot("assets").length())
    }
    file.delete()
  }

  @Test
  fun pendingDataNeverCrossesServerOrAccount() {
    LocalStore(context).use { store ->
      store.cache("assets", JSONArray().put(JSONObject().put("id", "source")))
      val id = store.queue(session.userId, "inv", "asset", JSONObject(), null, "0001 · Bem")
      session.apiUrl = "http://127.0.0.1:3102/api"
      assertTrue(store.operations(session.userId).isEmpty())
      assertEquals(0, store.snapshot("assets").length())
      session.apiUrl = "http://127.0.0.1:3101/api"
      session.userId = "other"
      assertEquals(0, store.snapshot("assets").length())
      assertTrue(store.operations("other").isEmpty())
      session.userId = "test-owner"
      assertEquals(id, store.operations(session.userId).single().id)
      assertEquals("source", store.snapshot("assets").getJSONObject(0).getString("id"))
      assertThrows(IllegalStateException::class.java) {
        store.queue(session.userId, "inv", "asset", JSONObject(), null)
      }
    }
  }

  @Test
  fun photoPreparationCorrectsOrientationAndStripsGps() {
    val file = File(context.filesDir, "camera-test.jpg")
    val bitmap = Bitmap.createBitmap(4096, 2048, Bitmap.Config.ARGB_8888)
    file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it) }
    bitmap.recycle()
    ExifInterface(file.path).apply {
      setAttribute(ExifInterface.TAG_ORIENTATION, "6")
      setAttribute(ExifInterface.TAG_GPS_LATITUDE, "23/1,30/1,0/1")
      setAttribute(ExifInterface.TAG_GPS_LATITUDE_REF, "S")
      setAttribute(ExifInterface.TAG_GPS_LONGITUDE, "46/1,36/1,0/1")
      setAttribute(ExifInterface.TAG_GPS_LONGITUDE_REF, "W")
      saveAttributes()
    }
    PhotoPreparation.prepare(file)
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    assertEquals(800, bounds.outWidth)
    assertEquals(1600, bounds.outHeight)
    assertTrue(file.length() < 8 * 1024 * 1024)
    assertNull(ExifInterface(file.path).getAttribute(ExifInterface.TAG_GPS_LATITUDE))
    file.delete()
  }

  @Test
  fun photoPermissionFailureDoesNotResendReadingOrBlockOtherReadings() = runBlocking {
    val api = Api(session)
    api.request("test/reset", JSONObject().put("photoStatus", 403))
    val photo =
      File(context.filesDir, "sync-test.jpg").apply { writeBytes(byteArrayOf(1, 2, 3, 4)) }
    val id: String
    LocalStore(context).use { store ->
      id =
        store.queue(
          session.userId,
          "inv",
          "asset-one",
          JSONObject()
            .put("assetId", "asset-one")
            .put("expectedVersion", 1)
            .put("observedAt", "2026-10-15T12:00:00Z")
            .put("divergence", JSONObject().put("type", "OTHER")),
          photo.path,
          "0001 · Mesa",
        )
      store.queue(
        session.userId,
        "inv",
        "asset-two",
        JSONObject()
          .put("assetId", "asset-two")
          .put("expectedVersion", 1)
          .put("observedAt", "2026-10-15T12:00:00Z"),
        null,
        "0002 · Cadeira",
      )
    }
    TestListenableWorkerBuilder<SyncWorker>(context).build().doWork()
    LocalStore(context).use { store ->
      val ops = store.operations(session.userId)
      assertEquals("PHOTO_ERROR", ops.first().state)
      assertEquals("test-event", ops.first().eventId)
      assertEquals("SYNCED", ops[1].state)
      assertTrue(photo.exists())
      store.state(id, "PHOTO_PENDING")
    }
    api.request("test/config", JSONObject().put("photoStatus", 200))
    TestListenableWorkerBuilder<SyncWorker>(context).build().doWork()
    val stats = JSONObject(api.request("test/status"))
    assertEquals(2, stats.getInt("syncRequests"))
    assertEquals(2, stats.getInt("photoRequests"))
    assertEquals(1, stats.getJSONArray("uploadIds").length())
    assertEquals("test-event", stats.getJSONArray("eventIds").getString(0))
    assertFalse(photo.exists())
    LocalStore(context).use { assertEquals("SYNCED", it.operations(session.userId).first().state) }
  }

  @Test
  fun standalonePhotosUseOnlyPhotoEndpoint() = runBlocking {
    val api = Api(session)
    api.request("test/reset", JSONObject().put("photoStatus", 200))
    val photo = File(context.filesDir, "standalone.jpg").apply { writeBytes(byteArrayOf(5, 6, 7)) }
    LocalStore(context).use {
      it.queue(session.userId, "", "asset-photo", JSONObject(), photo.path, "0003 · Foto")
    }
    TestListenableWorkerBuilder<SyncWorker>(context).build().doWork()
    val stats = JSONObject(api.request("test/status"))
    assertEquals(0, stats.getInt("syncRequests"))
    assertEquals(1, stats.getInt("photoRequests"))
    assertFalse(photo.exists())
  }

  @Test
  fun expiredSessionDuringPhotoPreservesTheAcceptedReading() = runBlocking {
    val api = Api(session)
    api.request("test/reset", JSONObject().put("photoStatus", 401))
    val photo =
      File(context.filesDir, "expired-photo.jpg").apply { writeBytes(byteArrayOf(9, 8, 7)) }
    LocalStore(context).use {
      it.queue(
        session.userId,
        "inv",
        "asset-expired",
        JSONObject()
          .put("assetId", "asset-expired")
          .put("expectedVersion", 1)
          .put("observedAt", "2026-10-15T12:00:00Z"),
        photo.path,
      )
    }
    TestListenableWorkerBuilder<SyncWorker>(context).build().doWork()
    LocalStore(context).use {
      assertEquals("PHOTO_PENDING", it.operations(session.userId).single().state)
    }
    session.token = "new-test-token"
    Api(session).request("test/config", JSONObject().put("photoStatus", 200))
    TestListenableWorkerBuilder<SyncWorker>(context).build().doWork()
    val stats = JSONObject(Api(session).request("test/status"))
    assertEquals(1, stats.getInt("syncRequests"))
    assertEquals(2, stats.getInt("photoRequests"))
    assertFalse(photo.exists())
  }

  @Test
  fun baseRefreshNeverDowngradesAnAssetJustSynchronized() {
    LocalStore(context).use { store ->
      store.cache(
        "assets",
        JSONArray().put(JSONObject().put("id", "same").put("version", 3).put("unitId", "new-unit")),
      )
      val result =
        store.cacheBase(
          mapOf(
            "assets" to
              JSONArray()
                .put(JSONObject().put("id", "same").put("version", 2).put("unitId", "old-unit")),
            "locations" to JSONArray(),
          ),
          "2026-10-15T12:00:00Z",
        )
      assertEquals(3, result.getValue("assets").getJSONObject(0).getInt("version"))
      assertEquals("new-unit", store.snapshot("assets").getJSONObject(0).getString("unitId"))
      assertEquals(
        "2026-10-15T12:00:00Z",
        store.snapshot("metadata").getJSONObject(0).getString("updatedAt"),
      )
    }
  }
}
