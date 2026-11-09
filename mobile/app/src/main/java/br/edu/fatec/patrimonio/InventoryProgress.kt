package br.edu.fatec.patrimonio

/**
 * O denominador é o snapshot inicial, nunca o cadastro mutável da sala.
 * `added` reúne bens lidos que não estavam na lista esperada: em um inventário inicial (sala sem
 * bens com localização registrada) todas as leituras caem aqui e passam a vincular o bem à sala.
 */
data class InventoryProgress(
  val expected: Set<String>,
  val found: Set<String>,
  val notFound: Set<String>,
  val remaining: Set<String>,
  val added: Set<String> = emptySet(),
) {
  val total
    get() = expected.size

  val recorded
    get() = found.size + notFound.size

  val fraction
    get() = if (total == 0) 1f else recorded.toFloat() / total

  /** Nenhum bem esperado: levantamento inicial da sala. */
  val initial
    get() = total == 0

  /** O servidor só aceita concluir quando todos os esperados têm resultado. */
  val canComplete
    get() = remaining.isEmpty()
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
    .filter { it.state != "DISCARDED" }
    .forEach {
      // Um resultado confirmado pelo servidor tem precedência sobre tentativas locais obsoletas.
      if (it.assetId !in results)
        results[it.assetId] = if (it.notFound) "NOT_FOUND" else "CONFIRMED"
    }
  val missing = expected.filter { results[it] == "NOT_FOUND" }.toSet()
  val found = expected.filter { results[it] != null && results[it] != "NOT_FOUND" }.toSet()
  val added = results.filter { (id, result) -> id !in expected && result != "NOT_FOUND" }.keys
  return InventoryProgress(expected, found, missing, expected - found - missing, added)
}
