---
name: gpu-check
description: Ready-to-send Defiant recipe for measuring what an OBS change costs (GPU per engine, plus OBS CPU when a burst matters), before and after, off-air. Use whenever an issue thread plans an OBS change that could cost GPU or CPU, or asks "how do I measure this".
---

# gpu-check

Made by the Performance expert (2026-10-31), after the third issue thread in a
day needed the same measurement recipe (camera transparency, browser source
GPU, stinger to video). Every OBS cost question has the same answer shape:
log 2 minutes before, change one thing, log 2 minutes after, compare per
engine. Copy the recipe below, fill in the brackets, and send it through the
coordinator to the Defiant thread. Background: `docs/PERFORMANCE.md`,
"OBS GPU", and `docs/roles/performance.md`.

## Rules

- **Off-air only.** Check AJ isn't streaming or recording first (obs-websocket
  `GetStreamStatus` / `GetRecordStatus`). Never measure while AJ is live.
- **One change per log.** Mark the clock time of each change. The logger
  writes local time, so give Defiant local `HH:MM` ranges.
- **Back up first** if the recipe changes OBS (scene collection
  `Archive_1.json.bak-<yyyymmdd-HHMMSS>`), and put everything back afterwards
  unless the issue thread's change is meant to stay.
- **Say which shell runs each step.** Defiant's session runs in WSL; the
  logger and counters are Windows PowerShell, so wrap them in `powershell.exe`
  and give Windows paths for files (code review on #152, 2026-10-31).
- **Compare engines, not totals.** Task Manager shows roughly the busiest
  engine. `obs_3D` includes the browser pages; `browser_3D` is their share.
- **Check for a GPU reset** before blaming a setting when something just
  stops working: OBS log "Device Remove/Reset" and Windows event nvlddmkm 153
  (`docs/roles/performance.md` Learnings, 2026-10-31).
- The logger has **no CPU column**. When the question is a short burst (a
  video decode, a transition, a page load), add the CPU step below.

## The recipe

```text
Off-air GPU check for "[issue thread title]": [the change in one line].
1. Confirm AJ isn't streaming or recording (GetStreamStatus, GetRecordStatus). If live, stop and say so.
2. [If OBS will change: back up the scene collection as Archive_1.json.bak-<timestamp>.]
3. Put [scene] on program. Start the logger. From WSL (Defiant's usual shell), in the repo clone:
   mkdir -p /mnt/c/Users/Alex/OneDrive/Desktop/claude/gpu   (the logger only makes a folder when -Out is omitted)
   cd /mnt/c && powershell.exe -ExecutionPolicy Bypass -File "$(wslpath -w ~/[repo path]/tools/gpu/obs-gpu-log.ps1)" -IntervalSec 5 -Minutes [N] -Out 'C:\Users\Alex\OneDrive\Desktop\claude\gpu\[name].csv'
   (From Windows PowerShell instead: powershell -ExecutionPolicy Bypass -File tools\gpu\obs-gpu-log.ps1 ... with the same -Out.)
4. Wait 2 minutes (before). Note the local time. Make the change: [exact change]. Note the time.
5. Wait 2 minutes (after). [Repeat 4-5 for each variant.]
6. [CPU burst only] While doing [the action, e.g. 5 transitions 10 s apart], log OBS CPU every second in a second shell, while the step 3 logger keeps running. This is Windows PowerShell; from WSL, save it as a .ps1 under C:\ and run it with powershell.exe -ExecutionPolicy Bypass -File:
   Get-Counter '\Process(obs64)\% Processor Time' -SampleInterval 1 -MaxSamples [S] |
     ForEach-Object { $_.CounterSamples | ForEach-Object { '{0:HH:mm:ss},{1:N1}' -f $_.Timestamp, ($_.CookedValue / $env:NUMBER_OF_PROCESSORS) } } |
     Set-Content 'C:\Users\Alex\OneDrive\Desktop\claude\gpu\[name]-cpu.csv'
   and read OBS's Stats dock "Frames missed due to rendering lag" and "Skipped frames due to encoding lag" before and after.
7. [Put everything back / keep the change, as the issue thread decided.]
8. In WSL, in the repo clone: npm run gpu:summary -- /mnt/c/Users/Alex/OneDrive/Desktop/claude/gpu/[name].csv --from=HH:MM --to=HH:MM for each stretch. Send the before and after median and p95 for obs_3D, browser_3D, obs_VideoEncode, obs_Cuda, plus the CPU peak and the missed-frame counts. Keep the CSVs in that gpu folder.
```

## Reading the result

- A change worth keeping moves a median by more than the run-to-run noise.
  Rows come every 8 to 10 s, so 2 minutes gives about 12 to 15 samples. If
  before and after differ by under 2 points, repeat once before believing it.
- A cost that only shows when a scene is on program belongs to that scene's
  sources. A cost that stays on every scene is a canvas, an output or an
  always-drawing hidden source.
- Report the numbers in the issue thread's PR or reply, and send the
  Performance expert one learning line when they change what
  `docs/PERFORMANCE.md` says costs what.
