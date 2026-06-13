# Arbiter — Auto-run paper loop + export + git push (Windows PowerShell)
# Setup: jadwalkan via Task Scheduler setiap 5 menit

$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo

Write-Host "[arbiter] running paper loop..."
& "$repo\.venv\Scripts\python.exe" -m paper.loop --once

Write-Host "[arbiter] collecting snapshots..."
& "$repo\.venv\Scripts\python.exe" -m paper.snapshot_collector --once --limit 50

Write-Host "[arbiter] exporting dashboard data..."
& "$repo\.venv\Scripts\python.exe" scripts/export_dashboard_data.py

# Push data ke GitHub → trigger Vercel deploy
git add dashboard-web/public/data/
$diff = git diff --cached --name-only
if ($diff) {
    $ts = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    git commit -m "auto: update dashboard data $ts"
    git push origin main
    Write-Host "[auto-deploy] pushed → Vercel deploying..."
} else {
    Write-Host "[auto-deploy] no data changes"
}
