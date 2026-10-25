# Operação integrada em LAN e coleta Android 1.2

## Iniciar e parar

Requer Node.js 24 e Docker com Compose 2.24.4 ou superior, daemon iniciado e acesso às imagens/dependências na primeira compilação. Na raiz:

```sh
npm start
# equivalente: ./iniciar.sh ou ./iniciar.sh --rede
npm stop
# equivalente: ./iniciar.sh --parar
```

O comando compila API e dashboard, sobe PostgreSQL, Mailpit, API e proxy Nginx, aplica migrations, aguarda os healthchecks (até 180 segundos) e inicializa o administrador se necessário. Só informa prontidão depois dessas etapas. Se falhar, examine `docker compose --project-name fatec-demo --env-file .demo/.env -f infra/compose.yaml -f infra/compose.demo.yaml logs --tail=100`. Os serviços podem continuar iniciados após uma falha; use `npm stop` para pará-los.

Credenciais persistem no arquivo privado `.demo/.env`; não o compartilhe nem versione. Parar preserva volumes e fotos. Não use `down -v` para encerrar a operação normal. `npm run demo` ou `./iniciar.sh --local` limita portal e API ao próprio PC.

## Endereços e conectividade

O modo padrão publica dashboard em `0.0.0.0:8080` e API em `0.0.0.0:3000`. Banco e Mailpit continuam sem acesso externo. O terminal lista os IPv4 das interfaces; escolha o endereço da interface ligada à LAN da instituição, evitando interfaces virtuais Docker/VPN.

- Outros computadores: `http://IP_DO_PC:8080`.
- Android debug: `http://IP_DO_PC:3000/api`.
- Emulador Android local: `http://10.0.2.2:3000/api`.
- USB: `adb reverse tcp:3000 tcp:3000`, API `http://127.0.0.1:3000/api`.

PC e celular precisam de rota entre si; desative isolamento de clientes no ponto de acesso autorizado e libere TCP 8080 e 3000 no firewall apenas para a sub-rede institucional. Não encaminhe essas portas no roteador para a internet. Se o IP mudar, atualize o endereço antes de iniciar novas coletas; prefira uma reserva DHCP. Confirme `http://IP_DO_PC:3000/api/health` a partir de outra máquina ou do navegador do celular.

O dashboard usa `/api` pelo proxy na mesma origem, portanto não exige uma lista aberta de CORS. O app nativo usa a API diretamente e não depende de CORS. O APK debug permite HTTP para testes em LAN; release exige HTTPS e assinatura institucional. Para dados reais, publique uma origem HTTPS com certificado confiável e siga [deploy](deploy.md).

## Preparar e coletar

1. No portal, cadastre localizações, importe bens e atribua permissões à conta de coleta: `assets.view`, `inventories.view`, `inventories.manage` e `photos.upload` quando houver fotos; inclua consultas de localizações/unidades.
2. No app, configure a API e use **Testar conexão com servidor**. O teste consulta `/health`; login e autorização são verificados ao entrar.
3. Entre e expanda **Atualizar base e sincronizar**. Atualize a base antes de sair para coleta. Selecione a localização e o inventário aberto ou prepare um novo online.
4. Toque em **Ler com câmera**. A prévia ocupa a tela inteira. Autorize a câmera, enquadre a etiqueta e aguarde. A leitura fecha o leitor e apresenta o resultado; **Fechar câmera / digitar código** ou Voltar cancela a câmera. A câmera só fica ativa enquanto esse leitor está aberto.
5. Revise patrimônio e descrição, registre condição/divergência e foto, e confirme. Digitação manual continua disponível. Códigos compartilhados exigem identificar o patrimônio correto.
6. Consulte **Pendências**, sincronize e confira o resultado no portal. Fechar o leitor não registra conferência. O botão de leitura do inventário só é habilitado depois de selecionar um inventário.

O app mantém operações/fotos em SQLite e WorkManager, com isolamento por servidor/conta e identificadores estáveis de reenvio. HTTP 408/429/5xx e rede indisponível admitem nova tentativa; conflitos de versão, permissão e foto exigem revisão conforme o estado. Nunca desinstale, limpe dados ou mude de servidor com coletas pendentes. Atualize com `adb install -r`.

## Compilar e instalar

```sh
cd mobile
# configure ANDROID_HOME e JAVA_HOME (JDK 17), ou local.properties com sdk.dir
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

APK de testes: `mobile/app/build/outputs/apk/debug/app-debug.apk`. Cópia para entrega: `entregaveis/patrimonio-fatec-1.2.0-debug.apk` (ignorada pelo Git). Não distribua debug como release institucional. Veja [Android](../mobile/README.md) para testes instrumentados.

## Aceitação em dispositivos reais

Abra o portal de uma segunda máquina e teste a saúde da API pelo celular. Faça login, atualize a base, abra/feche o leitor, negue e conceda permissão, leia uma etiqueta real, confirme um bem e envie uma foto. Repita uma coleta sem Wi-Fi, reconecte, sincronize e confirme a ausência de duplicação no portal. Confira cancelamento, rotação, foco e legibilidade em diferentes tamanhos de tela. Sem um celular na LAN, compilação e testes automatizados não comprovam conectividade física nem qualidade óptica.
