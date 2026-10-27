param([ValidateSet('ativar','desativar')][string]$Acao = 'ativar')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
try {
    $startup = [Environment]::GetFolderPath('Startup')
    if (-not $startup) { throw 'Nao foi possivel localizar a pasta de inicializacao desta conta.' }
    $shortcutPath = Join-Path $startup 'Fatec Patrimonio.lnk'
    if ($Acao -eq 'desativar') {
        if (Test-Path $shortcutPath) { Remove-Item -LiteralPath $shortcutPath }
        Write-Host 'Inicializacao automatica desativada nesta conta. O sistema em execucao continua funcionando.'
    } else {
        if (-not (Test-Path (Join-Path $root 'producao/.env'))) {
            throw 'Execute INICIAR-PRODUCAO.cmd e conclua a primeira instalacao antes de ativar.'
        }
        New-Item -ItemType Directory -Force $startup | Out-Null
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = Join-Path $PSHOME 'powershell.exe'
        $script = Join-Path $PSScriptRoot 'production.ps1'
        $shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $script + '" -Acao iniciar -Automatico'
        $shortcut.WorkingDirectory = $root
        $shortcut.WindowStyle = 7
        $shortcut.Description = 'Inicia o Patrimonio Fatec depois do login, aguardando o Docker.'
        $shortcut.Save()
        Write-Host 'Inicializacao automatica ativada para esta conta do Windows.'
        Write-Host 'No Docker Desktop: Settings > General > Start Docker Desktop when you sign in to your computer.'
        Write-Host 'Ao ligar o computador, entre nesta conta. Sem login, esta opcao nao inicia o sistema.'
        Write-Host 'Mantenha a pasta do projeto neste local. Se move-la, execute este ativador novamente.'
        Write-Host 'Registro da ultima tentativa: producao/inicializacao-automatica.log.'
    }
} catch {
    Write-Host "NAO FOI POSSIVEL CONCLUIR: $_" -ForegroundColor Red
    exit 1
}
