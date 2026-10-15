package br.edu.fatec.patrimonio

import org.junit.Assert.assertEquals
import org.junit.Test

class SyncPolicyTest {
  @Test
  fun expiredCredentialsRequireLoginRatherThanDiscardingReadings() {
    assertEquals(SyncDecision.LOGIN, syncDecision(401))
    assertEquals(SyncDecision.BLOCKED, syncDecision(403))
  }

  @Test
  fun staleAssetNeedsHumanReview() {
    assertEquals(SyncDecision.CONFLICT, syncDecision(409))
  }

  @Test
  fun invalidDataDoesNotLoopForever() {
    assertEquals(SyncDecision.INVALID, syncDecision(400))
    assertEquals(SyncDecision.INVALID, syncDecision(404))
  }

  @Test
  fun serverFailureCanBeRetriedWithoutChangingOperationId() {
    assertEquals(SyncDecision.RETRY, syncDecision(500))
    assertEquals(SyncDecision.RETRY, syncDecision(503))
    assertEquals(SyncDecision.RETRY, syncDecision(408))
    assertEquals(SyncDecision.RETRY, syncDecision(429))
  }

  @Test
  fun photoFailureNeverRequeuesAnAcceptedReading() {
    assertEquals("PHOTO_ERROR", failureState(true, SyncDecision.CONFLICT))
    assertEquals("PHOTO_ERROR", failureState(true, SyncDecision.BLOCKED))
    assertEquals("BLOCKED", failureState(false, SyncDecision.BLOCKED))
    assertEquals("CONFLICT", failureState(false, SyncDecision.CONFLICT))
  }

  @Test
  fun incorporatedAndActiveAreTheOnlyCollectableStatuses() {
    assertEquals(true, canCollect("I"))
    assertEquals(true, canCollect("A"))
    listOf("D", "B", "T", "X", "").forEach { assertEquals(false, canCollect(it)) }
  }
}
