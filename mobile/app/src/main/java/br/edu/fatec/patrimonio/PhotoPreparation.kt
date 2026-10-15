package br.edu.fatec.patrimonio

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import java.io.File

/** Prepara uma única vez antes de enfileirar: imagem pequena, orientada e sem metadados. */
object PhotoPreparation {
  fun prepare(file: File) {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    require(bounds.outWidth > 0 && bounds.outHeight > 0) {
      "A câmera não produziu uma imagem válida."
    }
    var sample = 1
    while (bounds.outWidth / sample > 2400 || bounds.outHeight / sample > 2400) sample *= 2
    val decoded =
      BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
        ?: error("Não foi possível preparar a foto.")
    val orientation =
      ExifInterface(file.path)
        .getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    val matrix =
      Matrix().apply {
        when (orientation) {
          2 -> setScale(-1f, 1f)
          3 -> setRotate(180f)
          4 -> setScale(1f, -1f)
          5 -> {
            setRotate(90f)
            postScale(-1f, 1f)
          }
          6 -> setRotate(90f)
          7 -> {
            setRotate(270f)
            postScale(-1f, 1f)
          }
          8 -> setRotate(270f)
        }
      }
    val oriented = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
    val ratio = minOf(1f, 1600f / maxOf(oriented.width, oriented.height))
    val resized =
      if (ratio < 1f)
        Bitmap.createScaledBitmap(
          oriented,
          (oriented.width * ratio).toInt().coerceAtLeast(1),
          (oriented.height * ratio).toInt().coerceAtLeast(1),
          true,
        )
      else oriented
    val temp = File(file.parentFile, "${file.name}.prepared")
    try {
      temp.outputStream().use {
        check(resized.compress(Bitmap.CompressFormat.JPEG, 85, it)) {
          "Não foi possível salvar a foto."
        }
      }
      check(temp.renameTo(file)) { "Não foi possível substituir a foto preparada." }
    } finally {
      temp.delete()
      if (resized !== oriented) resized.recycle()
      if (oriented !== decoded) oriented.recycle()
      decoded.recycle()
    }
  }
}
