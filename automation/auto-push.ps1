# NeoGenesis Auto-Push (PowerShell) - FileSystemWatcher + polling, debounced 90s
param(
  [int]$PollSec = 30,
  [int]$StableSec = 90,
  [int]$RunMinutes = 0, # 0 = forever
  [switch]$Once
)
$Repo = "C:\NeoGenesis"
$Exclude = @("\.git", "node_modules", "dist", "\.vite", "automation\\auto-push")
function Get-LastWrite {
  Get-ChildItem -LiteralPath $Repo -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $p=$_.FullName; -not ($Exclude | Where-Object { $p -match $_ }) } |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
function Test-Green {
  Write-Host "[auto-push] verifying tests+typecheck+build..."
  $t1 = & npm --prefix "$Repo\engine" test 2>&1 | Out-String
  if ($t1 -notmatch "ALL 234 CHECKS PASSED") { Write-Host "[auto-push] tests FAILED`n$t1" -ForegroundColor Red; return $false }
  & npm --prefix $Repo run typecheck 2>&1 | Out-Null; if ($LASTEXITCODE -ne 0) { Write-Host "[auto-push] typecheck FAILED" -ForegroundColor Red; return $false }
  & npm --prefix $Repo run build -w frontend 2>&1 | Out-Null; if ($LASTEXITCODE -ne 0) { Write-Host "[auto-push] build FAILED" -ForegroundColor Red; return $false }
  return $true
}
function Invoke-Push {
  $status = (git -C $Repo status --porcelain=v1 | Where-Object { $_ -notmatch "SUPERVISOR_INBOX.md" }).Trim()
  if (-not $status) { Write-Host "[auto-push] no changes"; return $false }
  if (-not (Test-Green)) { Write-Host "[auto-push] NOT GREEN - skip" -ForegroundColor Yellow; return $false }
  Write-Host "[auto-push] GREEN -> git add"
  git -C $Repo add -A | Out-Null
  git -C $Repo reset HEAD -- SUPERVISOR_INBOX.md 2>$null | Out-Null
  $staged = (git -C $Repo diff --cached --name-only).Trim()
  if (-not $staged) { Write-Host "[auto-push] nothing staged"; return $false }
  $msg = "auto: polish @ $(Get-Date -Format ''yyyy-MM-dd HH:mm:ss'') - $($staged -replace ''`r?`n'','', '')"
  Write-Host "[auto-push] commit: $msg"
  git -C $Repo commit -m $msg | Out-String | Write-Host
  Write-Host "[auto-push] pushing..."
  git -C $Repo push origin main 2>&1 | Out-String | Write-Host
  if ($LASTEXITCODE -eq 0) { Write-Host "[auto-push] PUSH OK" -ForegroundColor Green; return $true } else { Write-Host "[auto-push] PUSH FAILED" -ForegroundColor Red; return $false }
}

if ($Once) {
  $last = Get-LastWrite; $age = (Get-Date) - $last.LastWriteTime
  Write-Host "[auto-push] --Once age=$([int]$age.TotalSeconds)s stable=$StableSec"
  $has = (git -C $Repo status --porcelain=v1 | Where-Object { $_ -notmatch "SUPERVISOR_INBOX.md"}).Trim().Length -gt 0
  if ($has -and $age.TotalSeconds -ge $StableSec) { Invoke-Push } else { Write-Host "not ready" }
  exit 0
}

Write-Host "[auto-push] WATCHING $Repo poll=${PollSec}s stable=${StableSec}s runMinutes=$RunMinutes" -ForegroundColor Cyan
Write-Host "Excludes: .git, node_modules, dist"

# FileSystemWatcher for immediate debounce
$watcher = New-Object System.IO.FileSystemWatcher $Repo -Property @{ IncludeSubdirectories=$true; NotifyFilter=[IO.NotifyFilters]::LastWrite -bor [IO.NotifyFilters]::FileName }
$watcher.EnableRaisingEvents = $true
$lastEvent = Get-Date
Register-ObjectEvent $watcher Changed -Action { $global:lastEvent = Get-Date } | Out-Null
Register-ObjectEvent $watcher Created -Action { $global:lastEvent = Get-Date } | Out-Null

$end = if ($RunMinutes -gt 0) { (Get-Date).AddMinutes($RunMinutes) } else { [DateTime]::MaxValue }
while ((Get-Date) -lt $end) {
  Start-Sleep -Seconds $PollSec
  $last = Get-LastWrite; $age = (Get-Date) - $last.LastWriteTime
  $status = (git -C $Repo status --porcelain=v1 | Where-Object { $_ -notmatch "SUPERVISOR_INBOX.md"}).Trim()
  $hasChanges = $status.Length -gt 0
  $branch = git -C $Repo status -b 2>&1 | Out-String
  $ahead = $branch -match "ahead"
  Write-Host "[$(Get-Date -Format HH:mm:ss)] age=$([int]$age.TotalSeconds)s changes=$hasChanges ahead=$ahead last=$($last.Name) $($last.LastWriteTime)"
  if ($hasChanges -and $age.TotalSeconds -ge $StableSec) {
    Write-Host "[auto-push] stable -> push" -ForegroundColor Yellow
    Invoke-Push | Out-Null
  } elseif ($ahead -and $age.TotalSeconds -ge 10) {
    Write-Host "[auto-push] ahead -> push" -ForegroundColor Yellow
    git -C $Repo push origin main 2>&1 | Out-String | Write-Host
  }
}
