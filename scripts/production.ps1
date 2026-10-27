param(
    [ValidateSet('iniciar','parar','status','logs','backup')][string]$Acao = 'iniciar',
    [switch]$Automatico,
    [ValidateRange(1,1800)][int]$EsperaDockerSegundos = 600
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Docker-Run {
    & docker @args
    if ($LASTEXITCODE -ne 0) { throw "Docker retornou erro ($LASTEXITCODE). Veja a mensagem acima." }
}
$composeArgs = @('compose','--env-file','producao/.env','-f','infra/compose.production.yaml')
function Compose-Run { Docker-Run @composeArgs @args }
$transcriptStarted = $false
try {
    if ($Automatico) {
        if ($Acao -ne 'iniciar') { throw 'O modo automatico permite somente iniciar.' }
        if (-not (Test-Path producao/.env)) {
            throw 'Execute INICIAR-PRODUCAO.cmd uma vez antes de ativar a inicializacao automatica.'
        }
        Start-Transcript -Path producao/inicializacao-automatica.log -Force | Out-Null
        $transcriptStarted = $true
    }
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Instale e abra o Docker Desktop. Consulte docs/PRODUCAO.md.'
    }
    if ($Automatico) {
        Write-Host 'Aguardando Docker Desktop ficar pronto...'
        $deadline = (Get-Date).AddSeconds($EsperaDockerSegundos)
        do {
            $previousPreference = $ErrorActionPreference
            try {
                # No PowerShell 5.1, stderr nativo nao deve interromper as tentativas.
                $ErrorActionPreference = 'Continue'
                & docker info --format '{{.ServerVersion}}' *> $null
                $dockerReady = $LASTEXITCODE -eq 0
            } finally {
                $ErrorActionPreference = $previousPreference
            }
            if ($dockerReady) { break }
            if ((Get-Date) -ge $deadline) {
                throw 'Docker nao ficou pronto no prazo. Abra Docker Desktop e execute INICIAR-PRODUCAO.cmd.'
            }
            Start-Sleep -Seconds 2
        } while ($true)
    } else {
        Docker-Run info --format '{{.ServerVersion}}'
    }
    Docker-Run compose version
    New-Item -ItemType Directory -Force producao | Out-Null
    if (-not (Test-Path producao/.env)) {
        if ($Acao -ne 'iniciar') { throw 'Execute primeiro INICIAR-PRODUCAO.cmd.' }
        $serverHost = Read-Host 'IP fixo ou nome deste servidor (exemplo: 192.168.1.50)'
        Docker-Run run --rm --mount "type=bind,source=$((Get-Location).Path)\producao,target=/config" --mount "type=bind,source=$((Get-Location).Path)\scripts\production-config.mjs,target=/setup.mjs,readonly" node:24-alpine node /setup.mjs $serverHost
    }
    switch ($Acao) {
        'iniciar' {
            Write-Host 'Preparando o sistema. A primeira execucao pode demorar varios minutos.'
            if ($Automatico) {
                # A primeira instalacao/atualizacao deve ser feita pelo iniciador manual.
                Compose-Run up --no-build --pull never -d --wait --wait-timeout 300
            } else {
                Compose-Run up --build -d --wait --wait-timeout 300
            }
            $config = Get-Content producao/.env
            if ($config -contains 'TLS_MODE=internal') {
                Compose-Run cp gateway:/data/caddy/pki/authorities/local/root.crt producao/certificado-local.crt
            }
            $address = ($config | Where-Object { $_ -like 'SITE_HOST=*' }) -replace '^SITE_HOST=', ''
            Write-Host "Servicos iniciados: https://$address"
            Write-Host 'Login inicial: admin@fatec.local. Senha: linha BOOTSTRAP_PASSWORD de producao/.env.'
            Write-Host 'Instale o certificado conforme docs/PRODUCAO.md antes de acessar.'
        }
        'parar' { Compose-Run stop; Write-Host 'Sistema parado. Dados preservados.' }
        'status' { Compose-Run ps -a }
        'logs' { Compose-Run logs --tail=100 }
        'backup' {
            $destination = 'producao/backups/' + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
            New-Item -ItemType Directory $destination | Out-Null
            Compose-Run stop gateway web backend
            # Copia binaria via docker cp: redirecionamento no PowerShell 5 corrompe dumps.
            Compose-Run exec -T database pg_dump -U patrimonio -d patrimonio -Fc -f /tmp/fatec-backup.dump
            Compose-Run cp database:/tmp/fatec-backup.dump "$destination/banco.dump"
            Compose-Run exec -T database rm /tmp/fatec-backup.dump
            Compose-Run run --rm --no-deps -T --user root --entrypoint sh --volume "$((Get-Location).Path)/${destination}:/backup" backend -c 'tar czf /backup/fotos.tar.gz -C /app/uploads .'
            Copy-Item producao/.env "$destination/config.env"
            Compose-Run cp gateway:/data/caddy "$destination/caddy"
            Write-Host "Backup concluido em $destination. Copie para armazenamento externo protegido."
            Write-Host 'Para reiniciar, abra INICIAR-PRODUCAO.cmd.'
        }
    }
} catch {
    Write-Host "NAO FOI POSSIVEL CONCLUIR: $_" -ForegroundColor Red
    Write-Host 'Os dados foram preservados. Consulte docs/PRODUCAO.md. Se o backup falhou, o sistema pode estar parado.'
    exit 1
} finally {
    if ($transcriptStarted) { Stop-Transcript | Out-Null }
}
