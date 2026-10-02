package br.edu.fatec.patrimonio

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Apenas o token é persistido; a senha nunca é gravada no aparelho. */
class Session(context: Context) {
  private val prefs = context.getSharedPreferences("session", Context.MODE_PRIVATE)

  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    return (store.getKey("patrimonio-token", null) as? SecretKey)
      ?: KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        .apply {
          init(
            KeyGenParameterSpec.Builder(
                "patrimonio-token",
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
              )
              .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
              .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
              .build()
          )
        }
        .generateKey()
  }

  var token: String
    get() =
      try {
        val raw = prefs.getString("token", null)
        if (raw == null) ""
        else {
          val pieces = raw.split(":")
          val cipher = Cipher.getInstance("AES/GCM/NoPadding")
          cipher.init(
            Cipher.DECRYPT_MODE,
            key(),
            GCMParameterSpec(128, Base64.decode(pieces[0], Base64.NO_WRAP)),
          )
          String(cipher.doFinal(Base64.decode(pieces[1], Base64.NO_WRAP)))
        }
      } catch (_: Exception) {
        ""
      }
    set(value) {
      if (value.isEmpty()) prefs.edit().remove("token").apply()
      else {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        prefs
          .edit()
          .putString(
            "token",
            Base64.encodeToString(cipher.iv, Base64.NO_WRAP) +
              ":" +
              Base64.encodeToString(cipher.doFinal(value.toByteArray()), Base64.NO_WRAP),
          )
          .apply()
      }
    }

  var userId: String
    get() = prefs.getString("userId", "")!!
    set(value) {
      prefs.edit().putString("userId", value).apply()
    }

  var role: String
    get() = prefs.getString("role", "CONSULTA")!!
    set(value) {
      prefs.edit().putString("role", value).apply()
    }

  var apiUrl: String
    get() = prefs.getString("apiUrl", "http://10.0.2.2:3000/api")!!
    set(value) {
      require(value.startsWith("https://") || (BuildConfig.DEBUG && value.startsWith("http://"))) {
        "Use HTTPS em produção."
      }
      prefs.edit().putString("apiUrl", value.trimEnd('/')).apply()
    }
}
