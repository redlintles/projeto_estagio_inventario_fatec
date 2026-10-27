# Ajusta somente certificado local e regra de firewall desta aplicacao.
param([ValidateRange(1,65535)][int]$Port = 443, [switch]$LocalOnly, [switch]$FirewallOnly)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
try {
    if ($FirewallOnly) {
        $name = 'Fatec-Patrimonio-HTTPS'
        Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        New-NetFirewallRule -Name $name -DisplayName 'Patrimonio Fatec - rede local' -Direction Inbound -Protocol TCP -LocalPort $Port -RemoteAddress LocalSubnet -Profile Private,Domain -Action Allow | Out-Null
        exit 0
    }
    $certificate = Join-Path $root 'producao\certificado-local.crt'
    if (Test-Path $certificate) {
        # Pode exibir confirmacao de confianca do proprio Windows para esta conta.
        Import-Certificate -FilePath $certificate -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
    }
    if (-not $LocalOnly) {
        Write-Host 'O Windows pode pedir permissao de administrador para liberar a porta na rede local. Confirme para continuar.'
        $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -Port ' + $Port + ' -FirewallOnly'
        $process = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $arguments -Verb RunAs -Wait -PassThru
        if ($process.ExitCode -ne 0) { throw 'O ajuste do firewall nao foi autorizado ou falhou.' }
    }
    exit 0
} catch {
    Write-Host "Ajuste do Windows nao concluido: $_" -ForegroundColor Red
    exit 1
}
