# Chamado por RESETAR.cmd. Apaga tudo o que a instalacao de producao criou
# (containers, banco, fotos, configuracao, firewall, certificado e inicio automatico)
# e instala do zero. Antes de apagar, guarda banco, fotos e a pasta producao em
# reset-backups\<data>. Nao exige Node instalado no Windows.
param([switch]$Confirmar, [switch]$SemReinstalar)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$project = 'fatec-producao'
$label = "label=com.docker.compose.project=$project"

# Executa docker sem interromper o reset quando o recurso ja nao existe.
# No PowerShell 5.1, stderr nativo com 'Stop' viraria erro fatal.
function Docker-Soft {
    $previous = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & docker @args 2>$null
        @($output | Where-Object { $_ })
    } finally { $ErrorActionPreference = $previous }
}
function Docker-Run {
    & docker @args | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Docker retornou erro ($LASTEXITCODE). Veja a mensagem acima." }
}
function Volume-Exists([string]$Name) {
    Docker-Soft volume inspect $Name | Out-Null
    return ($LASTEXITCODE -eq 0)
}
function Save-Volume([string]$Name, [string]$File, [string]$Destination) {
    Docker-Run run --rm --mount "type=volume,source=$Name,target=/data,readonly" --mount "type=bind,source=$Destination,target=/backup" postgres:17-alpine tar czf "/backup/$File" -C /data .
}
function Protect-Folder([string]$Path) {
    # Mesmo criterio da pasta producao: somente esta conta, SYSTEM e administradores.
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetOwner($identity)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @($identity, (New-Object System.Security.Principal.SecurityIdentifier 'S-1-5-18'), (New-Object System.Security.Principal.SecurityIdentifier 'S-1-5-32-544'))) {
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker Desktop nao encontrado. Instale-o, abra-o e execute RESETAR.cmd novamente.'
    }
    # Abre o Docker Desktop, se necessario, e aguarda o mecanismo ficar pronto.
    $deadline = (Get-Date).AddMinutes(10)
    $launched = $false
    do {
        Docker-Soft info --format '{{.ServerVersion}}' | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        if (-not $launched) {
            foreach ($candidate in @("$env:ProgramFiles\Docker\Docker\Docker Desktop.exe", "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe")) {
                if (Test-Path $candidate) { Start-Process -FilePath $candidate; break }
            }
            Write-Host 'Aguardando Docker Desktop. Se necessario, abra-o pelo menu Iniciar.'
            $launched = $true
        }
        if ((Get-Date) -ge $deadline) { throw 'Docker nao ficou pronto. Abra Docker Desktop, aguarde e execute RESETAR.cmd novamente.' }
        Start-Sleep -Seconds 2
    } while ($true)

    if (-not $Confirmar) {
        Write-Host ''
        Write-Host 'ATENCAO: o reset apaga a instalacao atual do Patrimonio Fatec:' -ForegroundColor Yellow
        Write-Host '  - containers, banco de dados, fotos e configuracao (pasta producao);' -ForegroundColor Yellow
        Write-Host '  - regra de firewall, certificado local e inicio automatico.' -ForegroundColor Yellow
        Write-Host 'Uma copia de seguranca sera guardada em reset-backups antes de apagar.'
        Write-Host 'Depois, a instalacao comeca do zero e fara as mesmas perguntas da primeira vez.'
        Write-Host ''
        $answer = Read-Host 'Para continuar, digite RESETAR e pressione Enter'
        if ($answer.Trim() -cne 'RESETAR') {
            Write-Host 'Reset cancelado. Nada foi alterado.'
            exit 1
        }
    }

    # 1. Inicio automatico (atalho na pasta Inicializar desta conta).
    $startup = [Environment]::GetFolderPath('Startup')
    if ($startup) {
        $shortcut = Join-Path $startup 'Fatec Patrimonio.lnk'
        if (Test-Path -LiteralPath $shortcut) {
            Remove-Item -LiteralPath $shortcut
            Write-Host 'Inicio automatico removido.'
        }
    }

    # 2. Copia de seguranca antes de apagar qualquer dado.
    New-Item -ItemType Directory -Force reset-backups | Out-Null
    $backupDir = Join-Path $root ('reset-backups\' + (Get-Date).ToString('yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Force $backupDir | Out-Null
    try { Protect-Folder (Join-Path $root 'reset-backups') } catch { Write-Warning "Nao foi possivel restringir o acesso a reset-backups: $_" }

    $dumped = $false
    $db = @(Docker-Soft ps -aq --filter $label --filter 'label=com.docker.compose.service=database') | Select-Object -First 1
    if ($db) {
        Write-Host 'Salvando o banco de dados...'
        Docker-Soft start $db | Out-Null
        for ($i = 0; $i -lt 60; $i++) {
            Docker-Soft exec $db pg_isready -U patrimonio -d patrimonio | Out-Null
            if ($LASTEXITCODE -eq 0) { break }
            Start-Sleep -Seconds 1
        }
        # Conexao local dentro do container: funciona mesmo se a senha do .env nao bater.
        Docker-Soft exec $db pg_dump -U patrimonio -d patrimonio -Fc -f /tmp/reset.dump | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Docker-Soft cp "${db}:/tmp/reset.dump" (Join-Path $backupDir 'banco.dump') | Out-Null
            $dumped = ($LASTEXITCODE -eq 0)
        }
    }
    $containers = @(Docker-Soft ps -aq --filter $label)
    if ($containers.Count) { Docker-Soft stop @containers | Out-Null }
    if ($dumped) {
        Write-Host 'Banco salvo em banco.dump.'
    } elseif (Volume-Exists "${project}_postgres_data") {
        Write-Host 'Nao foi possivel exportar o banco; salvando copia bruta dos arquivos do banco...'
        Save-Volume "${project}_postgres_data" 'banco-arquivos.tar.gz' $backupDir
    }
    if (Volume-Exists "${project}_photos") {
        Write-Host 'Salvando as fotos...'
        Save-Volume "${project}_photos" 'fotos.tar.gz' $backupDir
    }

    # 3. Certificado local importado por instalacoes antigas com HTTPS.
    $certificate = Join-Path $root 'producao\certificado-local.crt'
    if (Test-Path -LiteralPath $certificate) {
        try {
            $thumbprint = (New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $certificate).Thumbprint
            Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Thumbprint -eq $thumbprint } | Remove-Item
            Write-Host 'Certificado local removido.'
        } catch { Write-Warning "Certificado local nao removido: $_" }
    }

    # 4. Containers, volumes, redes e imagens do projeto.
    Write-Host 'Removendo containers, banco, fotos, redes e imagens da instalacao anterior...'
    $containers = @(Docker-Soft ps -aq --filter $label)
    if ($containers.Count) { Docker-Run rm -f -v @containers }
    $volumes = @(@(Docker-Soft volume ls -q --filter $label) + @(Docker-Soft volume ls -q | Where-Object { $_ -like "${project}_*" }) | Sort-Object -Unique)
    if ($volumes.Count) { Docker-Run volume rm -f @volumes }
    $networks = @(Docker-Soft network ls -q --filter $label)
    if ($networks.Count) { Docker-Soft network rm @networks | Out-Null }
    $images = @(@(Docker-Soft images -q --filter $label) + @(Docker-Soft images -q "${project}-backend") + @(Docker-Soft images -q "${project}-web") | Sort-Object -Unique)
    if ($images.Count) { Docker-Soft rmi -f @images | Out-Null }

    # 5. Regra de firewall (exige administrador; a reinstalacao a recria de qualquer forma).
    $rule = $null
    try { $rule = Get-NetFirewallRule -Name 'Fatec-Patrimonio-HTTPS' -ErrorAction SilentlyContinue } catch { }
    if ($rule) {
        Write-Host 'O Windows pode pedir permissao de administrador para remover a regra de firewall. Confirme para continuar.'
        try {
            $process = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList '-NoProfile -Command "Remove-NetFirewallRule -Name Fatec-Patrimonio-HTTPS"' -Verb RunAs -Wait -PassThru
            if ($process.ExitCode -ne 0) { Write-Warning 'A regra de firewall nao foi removida. A reinstalacao a substitui.' }
        } catch { Write-Warning 'A regra de firewall nao foi removida (permissao negada). A reinstalacao a substitui.' }
    }

    # 6. Configuracao, senhas e logs: movidos para a copia de seguranca.
    if (Test-Path -LiteralPath producao) {
        Move-Item -LiteralPath producao -Destination (Join-Path $backupDir 'producao')
    }

    $left = @(@(Docker-Soft ps -aq --filter $label) + @(Docker-Soft volume ls -q --filter $label))
    if ($left.Count) { throw 'Ainda restaram componentes da instalacao anterior. Feche o Docker Desktop, abra-o novamente e execute RESETAR.cmd outra vez.' }

    Write-Host ''
    Write-Host "RESET CONCLUIDO. Copia de seguranca em: $backupDir" -ForegroundColor Green
    if ($SemReinstalar) {
        Write-Host 'Para instalar novamente, execute INSTALAR.cmd.'
        exit 0
    }
    Write-Host 'Iniciando a instalacao do zero...'
    Write-Host ''
    & (Join-Path $PSScriptRoot 'production-install.ps1')
    exit $LASTEXITCODE
} catch {
    Write-Host "`nNAO FOI POSSIVEL CONCLUIR O RESET: $_" -ForegroundColor Red
    Write-Host 'Nenhum dado e apagado antes da copia de seguranca. Copias ficam em reset-backups.'
    exit 1
}
