package br.edu.fatec.patrimonio

/** Falhas permanentes pedem revisão; conexão/servidor pedem reenvio com o mesmo UUID. */
enum class SyncDecision {
  LOGIN,
  CONFLICT,
  INVALID,
  RETRY,
}

fun syncDecision(status: Int): SyncDecision =
  when (status) {
    401,
    403 -> SyncDecision.LOGIN
    409 -> SyncDecision.CONFLICT
    in 400..499 -> SyncDecision.INVALID
    else -> SyncDecision.RETRY
  }
