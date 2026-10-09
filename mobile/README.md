# Aplicativo Android

Abra este diretório no Android Studio. JDK 17, SDK 35, Android 8 ou superior. O Gradle Wrapper está versionado; local.properties contém o SDK de cada máquina e não deve ser versionado.

`./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug` gera APK, testes e análise. URL da API é configurada no login. Em release, use HTTPS e configure assinatura institucional fora do repositório.

A câmera usa modelo embarcado de barras. Antes de ficar offline, faça login, atualize a base e prepare o inventário. SQLite guarda a fila durável; WorkManager reenvia sem descartar registros. Nunca apague dados locais antes de resolver as pendências. Consulte ../docs/fluxos.md e ../docs/testes.md.

## Demonstração em celular conectado por USB

Ative a Depuração USB nas Opções do desenvolvedor, desbloqueie o celular e aceite a autorização deste computador. Com a demonstração do servidor iniciada (`npm run demo`), execute na raiz do projeto:

```sh
adb devices -l
adb reverse tcp:3000 tcp:3000
adb install -r mobile/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n br.edu.fatec.patrimonio/.MainActivity
```

No aplicativo, informe `http://127.0.0.1:3000/api` e use uma conta do mesmo backend. O encaminhamento depende da conexão USB e não substitui a configuração de rede da Fatec. `adb install -r` atualiza mantendo os dados; não desinstale para atualizar se houver pendências. Se houver mais de um aparelho, selecione o destino com `adb -s SERIAL`.

Para demonstrar a conferência, importe ativos no portal, cadastre uma localização, atualize a base no app e prepare ou selecione um inventário aberto. Busque um patrimônio, confirme a conferência e acompanhe a aba Pendências e o inventário no portal. A câmera e o fluxo offline precisam ser verificados em aparelhos reais antes de homologar.

## Demonstração pela rede Wi-Fi

Na raiz, execute `npm run demo:lan` e informe no app debug `http://IP_DO_PC:3000/api`. O modo padrão `npm run demo` publica a API apenas no próprio computador. `10.0.2.2` é destinado ao emulador e não identifica o PC para um celular físico. A demonstração pela rede não exige o cabo USB.

## Organização das telas

A navegação inferior mantém Inventário, Ativo, Pendências e Ajuda acessíveis. Inventário separa preparação da sala, identificação do bem e registro do resultado. A atualização da base e a sincronização ficam agrupadas, e Conta no cabeçalho permite sair mantendo a fila. Ajuda contém instruções locais, disponíveis sem conexão após o login.
