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
