package br.edu.fatec.patrimonio

enum class SyncDecision {
  LOGIN,
  BLOCKED,
  CONFLICT,
  INVALID,
  RETRY,
}

fun syncDecision(status: Int): SyncDecision =
  when (status) {
    401 -> SyncDecision.LOGIN
    403 -> SyncDecision.BLOCKED
    408,
    425,
    429 -> SyncDecision.RETRY
    409 -> SyncDecision.CONFLICT
    in 400..499 -> SyncDecision.INVALID
    else -> SyncDecision.RETRY
  }

/** Uma falha na foto jamais coloca uma conferência já aceita de volta na etapa de leitura. */
fun failureState(photoStage: Boolean, decision: SyncDecision): String =
  when {
    photoStage -> "PHOTO_ERROR"
    decision == SyncDecision.BLOCKED -> "BLOCKED"
    decision == SyncDecision.CONFLICT -> "CONFLICT"
    else -> "ERROR"
  }
