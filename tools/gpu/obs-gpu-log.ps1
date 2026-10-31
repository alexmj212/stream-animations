<#
.SYNOPSIS
  Logs OBS's GPU use by engine (3D, VideoEncode, Cuda, Compute, ...) to a CSV,
  so idle and live GPU load can be checked after the fact (docs/PERFORMANCE.md,
  "OBS GPU"). Added 2026-10-30 after AJ saw OBS at ~30% GPU while idle.

.DESCRIPTION
  Reads the Windows "GPU Engine" counters every -IntervalSec seconds and sums
  them per engine type for OBS (obs64.exe) and its browser sources
  (obs-browser-page.exe), plus the whole machine for comparison. Task
  Manager's single GPU number is roughly the busiest engine, so the CSV keeps
  each engine apart. obs_3D already includes the browser pages; browser_3D
  is that part on its own. Read only: it changes nothing in OBS.

  Get-Counter itself takes several seconds on Defiant (2026-10-31: rows came
  every 8 to 10 s at -IntervalSec 2), so the wait subtracts the time it took
  and intervals under about 8 s are best effort.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\gpu\obs-gpu-log.ps1
  powershell -ExecutionPolicy Bypass -File tools\gpu\obs-gpu-log.ps1 -IntervalSec 2 -Minutes 10 -Out idle.csv

  Then: npm run gpu:summary -- idle.csv
#>
param(
    [int]$IntervalSec = 5,
    [double]$Minutes = 0,            # 0 = until Ctrl+C
    [string]$Out = ''
)

if (-not $Out) {
    $dir = Join-Path $PSScriptRoot '..\gpu-results'
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $Out = Join-Path $dir ("obs-gpu-{0}.csv" -f (Get-Date -Format 'yyyy-MM-dd'))
}

$engines = @('3D', 'VideoEncode', 'VideoDecode', 'Cuda', 'Compute_0', 'Compute_1', 'Copy')
$obsNames = @('obs64', 'obs-browser-page')

if (-not (Test-Path $Out)) {
    $header = @('time', 'obs_running') + ($engines | ForEach-Object { "obs_$_" }) +
              @('browser_3D') + ($engines | ForEach-Object { "all_$_" })
    ($header -join ',') | Set-Content -Path $Out -Encoding ascii
}
Write-Host "Logging OBS GPU use every $IntervalSec s to $Out (Ctrl+C stops)"

# Sleep what's left of the interval after the slow counter read
function Wait-Interval([datetime]$since) {
    $left = $IntervalSec - ((Get-Date) - $since).TotalSeconds
    if ($left -gt 0) { Start-Sleep -Milliseconds ([int]($left * 1000)) }
}

$deadline = if ($Minutes -gt 0) { (Get-Date).AddMinutes($Minutes) } else { [datetime]::MaxValue }
while ((Get-Date) -lt $deadline) {
    $tick = Get-Date
    $procs = Get-Process -Name $obsNames -ErrorAction SilentlyContinue
    $obsPids = @{}
    foreach ($p in $procs) { $obsPids[[string]$p.Id] = $p.ProcessName }

    $obs = @{}; $all = @{}; $browser3D = 0.0
    foreach ($e in $engines) { $obs[$e] = 0.0; $all[$e] = 0.0 }

    $samples = (Get-Counter '\GPU Engine(*)\Utilization Percentage' -ErrorAction SilentlyContinue).CounterSamples
    # The counters can fail for a moment while a GPU process starts or exits:
    # skip the row rather than log zeros that drag the medians down
    if (-not $samples) { Wait-Interval $tick; continue }
    foreach ($s in $samples) {
        # Instance: pid_1234_luid_0x..._phys_0_eng_0_engtype_3D
        if ($s.InstanceName -notmatch '^pid_(\d+)_.*_engtype_(.+)$') { continue }
        $procId = $Matches[1]; $eng = $Matches[2]
        if (-not $all.ContainsKey($eng)) { continue }
        $all[$eng] += $s.CookedValue
        if ($obsPids.ContainsKey($procId)) {
            $obs[$eng] += $s.CookedValue
            if ($eng -eq '3D' -and $obsPids[$procId] -eq 'obs-browser-page') { $browser3D += $s.CookedValue }
        }
    }

    $inv = [cultureinfo]::InvariantCulture
    $f = { param($v) $v.ToString('F1', $inv) }
    $running = [int](@($procs | Where-Object ProcessName -eq 'obs64').Count -gt 0)
    $row = @((Get-Date).ToString('s'), $running) +
           ($engines | ForEach-Object { & $f $obs[$_] }) +
           @(& $f $browser3D) +
           ($engines | ForEach-Object { & $f $all[$_] })
    ($row -join ',') | Add-Content -Path $Out -Encoding ascii
    Wait-Interval $tick
}
