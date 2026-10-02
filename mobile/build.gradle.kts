plugins {
 id("com.diffplug.spotless") version "7.0.2"
 id("com.android.application") version "8.11.0" apply false
 id("org.jetbrains.kotlin.android") version "2.1.20" apply false
 id("org.jetbrains.kotlin.plugin.compose") version "2.1.20" apply false
}

spotless {
 kotlin {
  target("app/src/**/*.kt")
  ktfmt("0.54").googleStyle()
 }
}
