package br.edu.fatec.patrimonio

import org.junit.Assert.assertEquals
import org.junit.Test

class SyncPolicyTest {
  @Test
  fun expiredCredentialsRequireLoginRatherThanDiscardingReadings() {
    assertEquals(SyncDecision.LOGIN, syncDecision(401))
    assertEquals(SyncDecision.LOGIN, syncDecision(403))
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
  }
}
