# Chamado por INSTALAR.cmd. Nao exige Node instalado no Windows.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Invoke-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel concluir uma etapa do Docker. Leia a mensagem acima e execute INSTALAR.cmd novamente.' }
}
try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Instale o Docker Desktop manualmente, abra-o e execute INSTALAR.cmd novamente. Veja LEIA-ME-PRIMEIRO.txt.'
    }
    # Abre o Docker Desktop, se instalado, e aguarda o mecanismo ficar pronto.
    $deadline = (Get-Date).AddMinutes(10)
    $launched = $false
    do {
        $previousPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            & docker info --format '{{.ServerVersion}}' *> $null
            $ready = $LASTEXITCODE -eq 0
        } finally { $ErrorActionPreference = $previousPreference }
        if ($ready) { break }
        if (-not $launched) {
            foreach ($candidate in @("$env:ProgramFiles\Docker\Docker\Docker Desktop.exe", "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe")) {
                if (Test-Path $candidate) { Start-Process -FilePath $candidate; break }
            }
            Write-Host 'Aguardando Docker Desktop. Se necessario, abra-o pelo menu Iniciar.'
            $launched = $true
        }
        if ((Get-Date) -ge $deadline) { throw 'Docker nao ficou pronto. Abra Docker Desktop, aguarde e execute INSTALAR.cmd novamente.' }
        Start-Sleep -Seconds 2
    } while ($true)
    $version = (& docker compose version --short | Out-String).Trim().TrimStart('v')
    if ($LASTEXITCODE -ne 0 -or [version]($version.Split('-')[0]) -lt [version]'2.24.4') {
        throw 'Atualize o Docker Desktop: e necessario Docker Compose 2.24.4 ou superior.'
    }
    New-Item -ItemType Directory -Force producao | Out-Null
    # Arquivos privados ficam acessiveis somente a esta conta, SYSTEM e administradores.
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetOwner($identity)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @($identity, (New-Object System.Security.Principal.SecurityIdentifier 'S-1-5-18'), (New-Object System.Security.Principal.SecurityIdentifier 'S-1-5-32-544'))) {
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath producao -AclObject $acl
    $serverHost = 'localhost'
    try {
        $address = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | Select-Object -First 1
        if ($address) { $serverHost = $address.IPv4Address.IPAddress | Select-Object -First 1 }
    } catch { }
    $busyPorts = ''
    try { $busyPorts = ((Get-NetTCPConnection -State Listen | Select-Object -ExpandProperty LocalPort -Unique) -join ',') } catch { }
    $suggestedPort = '443'
    if (($busyPorts -split ',') -contains '443') { $suggestedPort = '8443' }
    $interactive = '-it'
    if ([Console]::IsInputRedirected) { $interactive = '-i' }
    Invoke-Docker run --rm $interactive --mount "type=bind,source=$((Get-Location).Path)\producao,target=/config" --mount "type=bind,source=$PSScriptRoot\production-setup.mjs,target=/setup.mjs,readonly" -e SETUP_OS=windows -e "DEFAULT_HOST=$serverHost" -e "DEFAULT_PORT=$suggestedPort" -e "BUSY_PORTS=$busyPorts" node:24-alpine node /setup.mjs
    $config = @{}
    foreach ($line in Get-Content producao/.env) {
        if ($line -match '^([A-Z_]+)=(.*)$') { $config[$matches[1]] = $matches[2] }
    }
    & (Join-Path $PSScriptRoot 'production.ps1') -Acao iniciar
    if ($LASTEXITCODE -ne 0) { throw 'O sistema nao iniciou. Confira as mensagens acima.' }
    & (Join-Path $PSScriptRoot 'production-host.ps1') -Port ([int]$(if ($config.HTTPS_PORT) { $config.HTTPS_PORT } else { 443 })) -LocalOnly:($config.BIND_ADDRESS -eq '127.0.0.1')
    if ($LASTEXITCODE -ne 0) { throw 'Os ajustes do Windows nao foram concluidos. Execute INSTALAR.cmd novamente.' }
    $autoAction = 'desativar'
    if ($config.SETUP_AUTOSTART -eq 's') { $autoAction = 'ativar' }
    & (Join-Path $PSScriptRoot 'production-autostart.ps1') -Acao $autoAction
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel configurar o inicio automatico.' }
    $url = "https://$($config.SITE_HOST)$($config.SITE_PORT_SUFFIX)"
    Write-Host "`nINSTALACAO CONCLUIDA: $url"
    Write-Host 'Seu usuario e senha inicial estao em producao\ACESSO.txt (arquivo privado).'
    Write-Host 'Guarde a pasta neste local. Para iniciar novamente, use o mesmo INSTALAR.cmd.'
    Start-Process $url
} catch {
    Write-Host "`nNAO FOI POSSIVEL CONCLUIR: $_" -ForegroundColor Red
    Write-Host 'Seus dados foram preservados. Consulte LEIA-ME-PRIMEIRO.txt. Nao apague a pasta producao.'
    exit 1
}
