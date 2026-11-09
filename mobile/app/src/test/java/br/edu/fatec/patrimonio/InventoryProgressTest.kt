package br.edu.fatec.patrimonio

import org.junit.Assert.*
import org.junit.Test

class InventoryProgressTest {
  @Test
  fun countsExpectedOnlyAndSeparatesMissingFromFound() {
    val progress =
      inventoryProgress(
        listOf("a", "b", "c"),
        emptyMap(),
        listOf(
          LocalInventoryResult("a", false, "PENDING"),
          LocalInventoryResult("b", true, "SYNCED"),
          LocalInventoryResult("extra", false, "SYNCED"),
        ),
      )
    assertEquals(3, progress.total)
    assertEquals(setOf("a"), progress.found)
    assertEquals(setOf("b"), progress.notFound)
    assertEquals(setOf("c"), progress.remaining)
    assertEquals(setOf("extra"), progress.added)
    assertEquals(2f / 3, progress.fraction)
    assertFalse(progress.canComplete)
  }

  @Test
  fun initialInventoryOfEmptyRoomCountsEveryReadingAsAdded() {
    val progress =
      inventoryProgress(
        emptyList(),
        mapOf("a" to "CONFIRMED"),
        listOf(
          LocalInventoryResult("b", false, "PENDING"),
          LocalInventoryResult("c", false, "DISCARDED"),
        ),
      )
    assertTrue(progress.initial)
    assertTrue(progress.canComplete)
    assertEquals(setOf("a", "b"), progress.added)
    assertEquals(0, progress.recorded)
  }

  @Test
  fun discardedAttemptReturnsToListAndServerResultWins() {
    val progress =
      inventoryProgress(
        listOf("a", "b"),
        mapOf("a" to "CONFIRMED"),
        listOf(
          LocalInventoryResult("a", true, "CONFLICT"),
          LocalInventoryResult("b", false, "DISCARDED"),
        ),
      )
    assertEquals(setOf("a"), progress.found)
    assertTrue(progress.notFound.isEmpty())
    assertEquals(setOf("b"), progress.remaining)
  }

  @Test
  fun completedAndEmptyRoomsHaveFiniteFullProgress() {
    val progress = inventoryProgress(listOf("a"), mapOf("a" to "NOT_FOUND"), emptyList())
    assertEquals(1f, progress.fraction)
    assertTrue(progress.remaining.isEmpty())
    assertEquals(1f, inventoryProgress(emptyList(), emptyMap(), emptyList()).fraction)
  }
}
