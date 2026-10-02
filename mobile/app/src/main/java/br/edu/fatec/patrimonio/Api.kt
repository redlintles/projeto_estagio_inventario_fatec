package br.edu.fatec.patrimonio

import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import org.json.JSONObject

class ApiFailure(val status: Int, val response: String) :
  Exception(
    try {
      JSONObject(response).optString("message", response)
    } catch (_: Exception) {
      response
    }
  )

class Api(session: Session) {
  private val baseUrl = session.apiUrl
  private val token = session.token

  fun request(path: String, body: JSONObject? = null): String {
    val conn = URL("${baseUrl}/$path").openConnection() as HttpURLConnection
    try {
      conn.connectTimeout = 15000
      conn.readTimeout = 20000
      conn.setRequestProperty("Authorization", "Bearer ${token}")
      if (body != null) {
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write(body.toString().toByteArray()) }
      }
      val code = conn.responseCode
      val text =
        (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use {
          it.readText()
        } ?: "Falha de comunicação"
      if (code !in 200..299) throw ApiFailure(code, text)
      return text
    } finally {
      conn.disconnect()
    }
  }

  fun photo(assetId: String, file: File, eventId: String? = null, uploadId: String? = null) {
    val boundary = UUID.randomUUID().toString()
    val conn =
      URL(
          "${baseUrl}/assets/$assetId/photos?${eventId?.let { "&eventId=$it" } ?: ""}${uploadId?.let { "&uploadId=$it" } ?: ""}"
        )
        .openConnection() as HttpURLConnection
    try {
      conn.connectTimeout = 15000
      conn.readTimeout = 30000
      conn.requestMethod = "POST"
      conn.doOutput = true
      conn.setRequestProperty("Authorization", "Bearer ${token}")
      conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
      conn.outputStream.use { out ->
        out.write(
          "--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"foto.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n"
            .toByteArray()
        )
        file.inputStream().use { it.copyTo(out) }
        out.write("\r\n--$boundary--\r\n".toByteArray())
      }
      if (conn.responseCode !in 200..299)
        throw ApiFailure(
          conn.responseCode,
          conn.errorStream?.bufferedReader()?.use { it.readText() } ?: "Erro ao enviar foto",
        )
    } finally {
      conn.disconnect()
    }
  }
}
