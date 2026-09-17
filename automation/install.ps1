# Install NeoGenesis Auto-Push as: npm scripts + Windows Scheduled Task + Git hook
$Repo = "C:\NeoGenesis"
Write-Host "=== NeoGenesis Auto-Push Installer ===" -ForegroundColor Cyan
Write-Host "Repo: $Repo"
Write-Host "Remote: $(git -C $Repo remote get-url origin)"

# 1. npm scripts
$pkgPath = Join-Path $Repo "package.json"
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
if (-not $pkg.scripts) { $pkg | Add-Member -NotePropertyName scripts -NotePropertyValue @{} }
$pkg.scripts | Add-Member -NotePropertyName "auto-push" -NotePropertyValue "node automation/auto-push.mjs" -Force
$pkg.scripts | Add-Member -NotePropertyName "auto-push:ps" -NotePropertyValue "powershell -ExecutionPolicy Bypass -File automation/auto-push.ps1" -Force
$pkg.scripts | Add-Member -NotePropertyName "auto-push:once" -NotePropertyValue "node automation/auto-push.mjs --once" -Force
$pkg.scripts | Add-Member -NotePropertyName "auto-push:install" -NotePropertyValue "powershell -ExecutionPolicy Bypass -File automation/install.ps1" -Force
$pkg.scripts | Add-Member -NotePropertyName "auto-push:status" -NotePropertyValue "powershell -NoProfile -Command `"Get-Job | Format-Table; git -C . status -b; git log --oneline -3`"" -Force
$pkg | ConvertTo-Json -Depth 10 | Set-Content $pkgPath -Encoding UTF8
Write-Host "[1/4] package.json scripts added: auto-push, auto-push:ps, auto-push:once" -ForegroundColor Green

# 2. Git hook: post-commit optional auto-push (commented, enable via env)
$hookDir = Join-Path $Repo ".git\hooks"
$hook = Join-Path $hookDir "post-commit"
$hookContent = @"
#!/bin/sh
# NeoGenesis post-commit hook - auto-push if AUTO_PUSH=1
if [ "`$AUTO_PUSH" = "1" ]; then
  echo "[hook] AUTO_PUSH=1 -> pushing..."
  git push origin main
fi
"@
Set-Content -LiteralPath $hook -Value $hookContent -Encoding UTF8
Write-Host "[2/4] .git/hooks/post-commit created (enable with `$env:AUTO_PUSH=1)" -ForegroundColor Green

# 3. Scheduled Task: run at logon + every 5 min polling fallback
$taskName = "NeoGenesisAutoPush"
$psExe = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
$action = New-ScheduledTaskAction -Execute $psExe -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Repo\automation\auto-push.ps1`" -PollSec 30 -StableSec 90"
$trigger1 = New-ScheduledTaskTrigger -AtLogOn
$trigger2 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration (New-TimeSpan -Days 365)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit 0 -Hidden:$false
try {
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($trigger1,$trigger2) -Settings $settings -Description "NeoGenesis auto-push watcher (poll 30s, stable 90s, green-build gate)" -Force | Out-Null
  Write-Host "[3/4] Scheduled Task `$taskName` registered (logon + every 30min)" -ForegroundColor Green
  Write-Host "      Check: Get-ScheduledTask -TaskName $taskName | Get-ScheduledTaskInfo"
} catch {
  Write-Host "[3/4] Scheduled Task FAILED (needs Admin). Run this script as Administrator to enable." -ForegroundColor Yellow
  Write-Host "      Fallback: run manually: npm run auto-push"
}

# 4. Start watcher now as background job
Write-Host "[4/4] Starting watcher now (60 min)..."
Start-Job -Name NeoGenesisWatcher -ScriptBlock { powershell -NoProfile -ExecutionPolicy Bypass -File "C:\NeoGenesis\automation\auto-push.ps1" -PollSec 30 -StableSec 90 -RunMinutes 60 } | Out-Null
Write-Host "      Job: NeoGenesisWatcher (Get-Job; Receive-Job NeoGenesisWatcher -Keep)" -ForegroundColor Green
Write-Host ""
Write-Host "DONE. Usage:" -ForegroundColor Cyan
Write-Host "  npm run auto-push        # Node watcher (poll+fs.watch, forever)"
Write-Host "  npm run auto-push:ps     # PowerShell watcher"
Write-Host "  npm run auto-push:once   # Single check+push if stable"
Write-Host "  `$env:AUTO_PUSH=1; git commit ... # auto-push via hook"
Write-Host "  Get-Job; Receive-Job NeoGenesisWatcher -Keep  # view logs"
