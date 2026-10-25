package br.edu.fatec.patrimonio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ApiAddressTest {
  @Test
  fun normalizesLanAndHttpsWithoutChangingPath() {
    assertEquals("http://192.168.1.10:3000/api", normalizeApiUrl(" http://192.168.1.10:3000/api/ "))
    assertEquals(
      "https://patrimonio.fatec.local/api",
      normalizeApiUrl("https://patrimonio.fatec.local/api"),
    )
  }

  @Test
  fun rejectsCredentialsQueriesAndNonHttpSchemes() {
    listOf(
        "ftp://servidor/api",
        "http://user:pass@servidor/api",
        "http://servidor/api?token=x",
        "http://servidor/api#x",
        "servidor:3000/api",
      )
      .forEach { value ->
        assertThrows(IllegalArgumentException::class.java) { normalizeApiUrl(value) }
      }
  }
}
