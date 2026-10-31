/**
 * The OBS safe-restart flow (AJ, 2026-10-31: "restart obs, create a script or
 * skill to do this in the future"). Written after a GPU driver reset left
 * NVIDIA Background Removal passing the camera through untouched; only a
 * restart rebuilt it. Pure orchestration: the socket, process and file
 * operations are passed in, so the order and the safety checks are unit
 * tested (tests/obs/restart-flow.test.js) and tools/obs/restart.js wires the
 * real ones on Defiant.
 */

/** Aitum Vertical Canvas's obs-websocket vendor name. */
export const AITUM_VENDOR = 'aitum-vertical-canvas';

/** Log lines worth reporting after a relaunch. */
export const LOG_PROBLEM = /error|failed|device remove|device_hung|887a000/i;

/**
 * Is anything going out right now? Checks the main stream and recording and,
 * when the vendor answers, the vertical canvas.
 * @param {{call: Function}} obs
 * @returns {Promise<{live: boolean, detail: Object}>}
 */
export async function liveStatus(obs) {
    const stream = await obs.call('GetStreamStatus');
    const record = await obs.call('GetRecordStatus');
    const detail = { stream: !!stream.outputActive, record: !!record.outputActive };
    // Fail closed: if the vertical canvas can't be read, count it as live.
    let verticalUnknown = false;
    try {
        const v = await obs.call('CallVendorRequest', {
            vendorName: AITUM_VENDOR, requestType: 'status', requestData: {}
        });
        const d = v.responseData || {};
        detail.verticalRaw = d;
        if (typeof d.streaming !== 'boolean' || typeof d.recording !== 'boolean') {
            verticalUnknown = true;
            detail.vertical = 'unknown (status has no boolean streaming/recording)';
        } else {
            detail.verticalStream = d.streaming;
            detail.verticalRecord = d.recording;
        }
    } catch (e) {
        verticalUnknown = true;
        detail.vertical = `unknown (${e.message})`;
    }
    const live = detail.stream || detail.record || verticalUnknown ||
        !!detail.verticalStream || !!detail.verticalRecord;
    return { live, detail };
}

/**
 * Stop the outputs that keep OBS "active" without being live (Replay Buffer,
 * which also stops the Vertical Backtrack, and the Virtual Camera). With them
 * running, a clean close stops at OBS's "outputs are active, exit anyway?"
 * dialog (code review on #147).
 * @returns {Promise<boolean>} true once none is active
 */
export async function stopIdleOutputs(obs, sleep, timeoutMs = 15000) {
    const checks = [
        ['GetReplayBufferStatus', 'StopReplayBuffer'],
        ['GetVirtualCamStatus', 'StopVirtualCam']
    ];
    for (const [get, stop] of checks) {
        if ((await obs.call(get)).outputActive) await obs.call(stop);
    }
    for (let waited = 0; waited <= timeoutMs; waited += 500) {
        let active = false;
        for (const [get] of checks) active = active || !!(await obs.call(get)).outputActive;
        if (!active) return true;
        await sleep(500);
    }
    return false;
}

/**
 * Keep the OBS log lines worth reporting: those after startup finished
 * (startup probes are noisy) that look like a problem.
 * @param {string[]} lines
 * @returns {string[]}
 */
export function logProblems(lines) {
    const start = lines.findIndex(l => l.includes('==== Startup complete'));
    return lines.slice(start + 1).filter(l => LOG_PROBLEM.test(l));
}

/**
 * Run the restart.
 * @param {Object} io
 * @param {() => Promise<{call: Function, close?: Function}>} io.connect - connect and identify; rejects if OBS isn't up
 * @param {() => Promise<string>} io.backup - copy the scene collection, return the backup path
 * @param {() => Promise<void>} io.closeObs - ask OBS to close cleanly (no kill)
 * @param {() => Promise<boolean>} io.isRunning - is obs64.exe still running
 * @param {() => Promise<void>} io.launchObs
 * @param {(sinceMs: number) => Promise<string[]>} io.logLines - newest OBS log lines written after sinceMs
 * @param {(name: string, dataUrl: string) => Promise<string>} [io.saveShot] - save a screenshot, return its path
 * @param {(ms: number) => Promise<void>} io.sleep
 * @param {() => number} [io.now]
 * @param {(msg: string) => void} [io.log]
 * @param {Object} [opts]
 * @param {boolean} [opts.dryRun] - checks only, change nothing
 * @param {boolean} [opts.cameraCheck] - run the camera sequence after relaunch
 * @param {number} [opts.exitTimeoutMs]
 * @param {number} [opts.connectTimeoutMs]
 * @returns {Promise<Object>} summary; `ok` false with `abort` when it stopped early
 */
export async function restartObs(io, opts = {}) {
    const {
        dryRun = false, cameraCheck = false,
        exitTimeoutMs = 60000, connectTimeoutMs = 90000
    } = opts;
    const now = io.now || Date.now;
    const log = io.log || (() => {});
    const summary = { ok: false, steps: [] };
    const step = (name, result) => { summary.steps.push({ name, ...result }); log(`${name}: ${JSON.stringify(result)}`); };

    // 1. Preflight: never while anything is going out.
    let obs = await io.connect();
    const before = await liveStatus(obs);
    step('preflight', before.detail);
    if (before.live) {
        summary.abort = 'OBS is live, or the vertical canvas status is unknown; not restarting';
        await obs.close?.();
        return summary;
    }
    const { currentProgramSceneName: startScene } = await obs.call('GetCurrentProgramScene');
    summary.startScene = startScene;
    if (dryRun) {
        await obs.close?.();
        summary.ok = true;
        summary.dryRun = true;
        return summary;
    }

    // 2. Back up the scene collection (OBS saves it again on a clean close).
    summary.backup = await io.backup();
    step('backup', { path: summary.backup });

    // 3. Stop the idle outputs, close cleanly and wait for the process to exit.
    if (!(await stopIdleOutputs(obs, io.sleep))) {
        summary.abort = 'Replay Buffer or Virtual Camera would not stop; not closing OBS';
        await obs.close?.();
        return summary;
    }
    step('outputsStopped', {});
    await obs.close?.();
    const closedAt = now();
    await io.closeObs();
    while (await io.isRunning()) {
        if (now() - closedAt > exitTimeoutMs) {
            summary.abort = `obs64.exe still running after ${exitTimeoutMs} ms; check for a dialog on screen (never kill it)`;
            return summary;
        }
        await io.sleep(1000);
    }
    step('closed', { ms: now() - closedAt });

    // 4. Relaunch and wait for the websocket.
    const launchedAt = now();
    await io.launchObs();
    obs = null;
    while (!obs) {
        try {
            obs = await io.connect();
        } catch {
            if (now() - launchedAt > connectTimeoutMs) {
                summary.abort = `websocket not back ${connectTimeoutMs} ms after launch`;
                return summary;
            }
            await io.sleep(2000);
        }
    }
    step('relaunched', { ms: now() - launchedAt });

    // 5. Outputs that don't start themselves (docs/roles/obs.md, "Outputs").
    const outputs = {};
    try {
        const rb = await obs.call('GetReplayBufferStatus');
        if (!rb.outputActive) await obs.call('StartReplayBuffer');
        await io.sleep(1000);
        outputs.replayBuffer = !!(await obs.call('GetReplayBufferStatus')).outputActive;
    } catch (e) {
        outputs.replayBuffer = `failed: ${e.message}`;
    }
    try {
        await obs.call('CallVendorRequest', {
            vendorName: AITUM_VENDOR, requestType: 'start_backtrack', requestData: {}
        });
        const v = await obs.call('CallVendorRequest', {
            vendorName: AITUM_VENDOR, requestType: 'status', requestData: {}
        });
        outputs.backtrack = v.responseData?.backtrack ?? 'started (status has no backtrack field)';
    } catch (e) {
        outputs.backtrack = `failed: ${e.message}`;
    }
    step('outputs', outputs);
    summary.outputs = outputs;

    // 6. Camera sequence: removal off in a Full Camera scene, on in Full 16:9.
    if (cameraCheck) {
        const cam = {};
        await obs.call('SetCurrentProgramScene', { sceneName: 'Just Chatting' });
        await io.sleep(5000);
        await obs.call('SetCurrentProgramScene', { sceneName: 'Full 16:9' });
        await io.sleep(12000); // NVIDIA removal takes 4-9 s to kick in
        const f = await obs.call('GetSourceFilter', { sourceName: 'Cam Base', filterName: 'NVIDIA Background Removal' });
        cam.removalEnabled = f.filterEnabled;
        if (io.saveShot) {
            const shot = await obs.call('GetSourceScreenshot', { sourceName: 'Cam Base', imageFormat: 'png', imageWidth: 640 });
            cam.screenshot = await io.saveShot('cam-base-full169', shot.imageData);
        }
        step('camera', cam);
        summary.camera = cam;
    }
    if (startScene) await obs.call('SetCurrentProgramScene', { sceneName: startScene });

    // 7. Problems in the new log.
    summary.logProblems = logProblems(await io.logLines(launchedAt));
    step('log', { problems: summary.logProblems.length });

    await obs.close?.();
    summary.ok = outputs.replayBuffer === true && !String(outputs.backtrack).startsWith('failed');
    return summary;
}
