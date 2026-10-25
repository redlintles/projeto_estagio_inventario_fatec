package br.edu.fatec.patrimonio

/** O denominador é o snapshot inicial, nunca o cadastro mutável da sala. */
data class InventoryProgress(
  val expected: Set<String>,
  val found: Set<String>,
  val notFound: Set<String>,
  val remaining: Set<String>,
) {
  val total
    get() = expected.size

  val recorded
    get() = found.size + notFound.size

  val fraction
    get() = if (total == 0) 1f else recorded.toFloat() / total
}

data class LocalInventoryResult(val assetId: String, val notFound: Boolean, val state: String)

fun inventoryProgress(
  expectedIds: List<String>,
  serverResults: Map<String, String>,
  localResults: List<LocalInventoryResult>,
): InventoryProgress {
  val expected = expectedIds.toSet()
  val results = serverResults.toMutableMap()
  localResults
    .filter { it.state != "DISCARDED" && it.assetId in expected }
    .forEach {
      // Um resultado confirmado pelo servidor tem precedência sobre tentativas locais obsoletas.
      if (it.assetId !in results)
        results[it.assetId] = if (it.notFound) "NOT_FOUND" else "CONFIRMED"
    }
  val missing = expected.filter { results[it] == "NOT_FOUND" }.toSet()
  val found = expected.filter { results[it] != null && results[it] != "NOT_FOUND" }.toSet()
  return InventoryProgress(expected, found, missing, expected - found - missing)
}
