# Aplicativo Android

Abra este diretório no Android Studio. JDK 17, SDK 35, Android 8 ou superior. O Gradle Wrapper está versionado; local.properties contém o SDK de cada máquina e não deve ser versionado.

`./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug` gera APK, testes e análise. URL da API é configurada no login. Em release, use HTTPS e configure assinatura institucional fora do repositório.

A câmera usa modelo embarcado de barras. Antes de ficar offline, faça login, atualize a base e prepare o inventário. SQLite guarda a fila durável; WorkManager reenvia sem descartar registros. Nunca apague dados locais antes de resolver as pendências. Consulte ../docs/fluxos.md e ../docs/testes.md.
