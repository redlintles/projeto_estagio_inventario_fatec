package br.edu.fatec.patrimonio

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.*
import androidx.compose.ui.graphics.Color

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    SyncWorker.schedule(this)
    setContent {
      MaterialTheme(
        colorScheme = lightColorScheme(primary = Color(0xFF087C79), secondary = Color(0xFF12323D))
      ) {
        PatrimonioApp()
      }
    }
  }
}
