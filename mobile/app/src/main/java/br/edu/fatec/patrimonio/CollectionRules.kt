package br.edu.fatec.patrimonio

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

fun localDateTime(value: String): String =
  try {
    DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", Locale("pt", "BR"))
      .withZone(ZoneId.systemDefault())
      .format(Instant.parse(value))
  } catch (_: Exception) {
    "Data não informada"
  }

fun canCollect(status: String) = status in listOf("I", "A")

/** Código, descrição e unidade da sala, para distinguir salas homônimas de unidades diferentes. */
fun locationLabel(location: org.json.JSONObject, units: List<org.json.JSONObject>): String {
  val unit = units.find { it.optString("id") == location.optString("unitId") }
  val code = location.optString("code")
  val name = location.optString("description")
  return listOfNotNull(
      if (code.isNotBlank()) "$code · $name" else name,
      unit?.optString("name")?.takeIf { it.isNotBlank() },
    )
    .joinToString(" — ")
}
