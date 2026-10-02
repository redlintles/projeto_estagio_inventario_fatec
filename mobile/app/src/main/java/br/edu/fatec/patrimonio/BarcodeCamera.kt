package br.edu.fatec.patrimonio

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Modelo embarcado: a câmera reconhece barras mesmo sem conexão. QR não é habilitado. */
@androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
@Composable
fun BarcodeCamera(modifier: Modifier = Modifier, onBarcode: (String) -> Unit) {
  val context = LocalContext.current
  val lifecycle = LocalLifecycleOwner.current
  var permitted by remember {
    mutableStateOf(
      ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED
    )
  }
  val permission =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
      permitted = it
    }
  val callback by rememberUpdatedState(onBarcode)
  if (!permitted) {
    Button(onClick = { permission.launch(Manifest.permission.CAMERA) }) { Text("Permitir câmera") }
    return
  }
  val preview = remember { PreviewView(context) }
  var cameraError by remember { mutableStateOf("") }
  AndroidView(factory = { preview }, modifier = modifier)
  DisposableEffect(lifecycle) {
    val executor = Executors.newSingleThreadExecutor()
    val scanner =
      BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
          .setBarcodeFormats(
            Barcode.FORMAT_CODE_128,
            Barcode.FORMAT_CODE_39,
            Barcode.FORMAT_CODE_93,
            Barcode.FORMAT_CODABAR,
            Barcode.FORMAT_EAN_13,
            Barcode.FORMAT_EAN_8,
            Barcode.FORMAT_ITF,
            Barcode.FORMAT_UPC_A,
            Barcode.FORMAT_UPC_E,
          )
          .build()
      )
    val processing = AtomicBoolean(false)
    var lastValue = ""
    var lastTime = 0L
    var provider: ProcessCameraProvider? = null
    var disposed = false
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener(
      {
        if (!disposed)
          try {
            provider = future.get()
            val display =
              Preview.Builder().build().also { it.surfaceProvider = preview.surfaceProvider }
            val analysis =
              ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            analysis.setAnalyzer(executor) { image ->
              val media = image.image
              if (media == null || !processing.compareAndSet(false, true)) image.close()
              else
                scanner
                  .process(InputImage.fromMediaImage(media, image.imageInfo.rotationDegrees))
                  .addOnSuccessListener { codes ->
                    val value = codes.firstOrNull()?.rawValue
                    val now = System.currentTimeMillis()
                    if (
                      !disposed && value != null && (value != lastValue || now - lastTime > 2500)
                    ) {
                      lastValue = value
                      lastTime = now
                      callback(value)
                    }
                  }
                  .addOnCompleteListener {
                    image.close()
                    processing.set(false)
                  }
            }
            provider?.unbindAll()
            provider?.bindToLifecycle(
              lifecycle,
              CameraSelector.DEFAULT_BACK_CAMERA,
              display,
              analysis,
            )
          } catch (e: Exception) {
            cameraError = e.message ?: "Câmera indisponível. Use a digitação manual."
          }
      },
      ContextCompat.getMainExecutor(context),
    )
    onDispose {
      disposed = true
      provider?.unbindAll()
      scanner.close()
      executor.shutdown()
    }
  }
  if (cameraError.isNotBlank()) Text(cameraError)
}
