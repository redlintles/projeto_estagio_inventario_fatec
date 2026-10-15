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

A navegação inferior mantém Inventário, Identificar, Pendências e Ajuda acessíveis. Inventário separa preparação da sala, identificação do bem e registro do resultado. A atualização da base e a sincronização ficam agrupadas, e Conta no cabeçalho permite sair mantendo a fila. Ajuda contém instruções locais, disponíveis sem conexão após o login.


## Papel do aplicativo e compatibilidade atual

O Android 1.1 é uma fonte de coleta: identificação por etiqueta/patrimônio, conferência física, condição, divergências e fotos, com fila offline. A aba Identificar mostra apenas o contexto do bem e permite salvar uma foto para envio sem alterar seu estado. Importação, unidades/localizações em lote, desfazer/refazer, relatórios, gestão de acessos e movimentações administrativas são feitos no portal.

As tarefas são verificadas pelas permissões individuais retornadas no login e em Atualizar base. A conta de coleta normalmente precisa de `assets.view`, `inventories.view`, `inventories.manage` e `photos.upload`; as consultas necessárias são incluídas no portal. `Incorporado` e `Ativo` podem ser conferidos. Vínculos de unidade e localização são atualizados com a base; leituras salvas preservam a versão original e divergências não alteram o vínculo oficial automaticamente.

A migração SQLite 1 → 2 preserva operações, caminhos das fotos e identificadores de reenvio. Somente o cache sem identificação de origem é renovado. As pendências antigas são associadas ao endereço da API configurado no aparelho no momento da atualização: confira esse endereço antes de atualizar e não o altere até concluir os envios antigos. A partir desta versão, filas e caches ficam separados por servidor e conta. Atualize por `adb install -r`; não desinstale nem limpe dados com pendências.

Leitura e foto têm etapas distintas. Expiração de sessão durante uma foto não reenfileira a leitura já aceita; falta de permissão em um item não bloqueia os demais. Arquivos permanecem no aparelho até confirmar o envio. Falhas temporárias de rede/HTTP 408/429/5xx são reenviadas com os mesmos UUIDs. Bloqueios de permissão e erros da foto podem ser retomados em Pendências. Uma foto ausente no armazenamento requer revisão; a conferência aceita permanece preservada no servidor.

Fotos são redimensionadas para até 1600 pixels no maior lado, convertidas para JPEG, orientadas e têm metadados removidos uma vez, antes da fila. Isso reduz tráfego e evita o limite de 8 MB / 16 megapixels do backend. O arquivo enfileirado não é recomprimido em cada tentativa.

## Testes de integração no emulador descartável

Os testes Android apagam **somente o banco do aplicativo de teste no emulador autorizado** e usam dados fictícios. Não execute em aparelhos operacionais ou em um AVD com dados importantes. O runner exige um emulador e o argumento explícito `fatecDisposable=true`.

1. Na raiz: `node scripts/mobile-fixture.mjs` (API fictícia em 127.0.0.1:3101).
2. Inicie um AVD em modo `-read-only -no-snapshot` e faça `adb -s SERIAL reverse tcp:3101 tcp:3101`.
3. Em mobile: `ANDROID_SERIAL=SERIAL ./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.fatecDisposable=true`.
4. Finalize a API fictícia e o AVD após o teste.

Os testes verificam migração sem apagar fila/fotos, isolamento de servidor/conta, duplicidade local, foto avulsa, reenvio apenas da foto após 403/401, continuidade da fila e orientação/remoção de GPS da imagem. Câmera, foco e leitura de etiquetas ainda devem ser homologados nos aparelhos reais; um emulador não comprova a qualidade óptica de um celular.
