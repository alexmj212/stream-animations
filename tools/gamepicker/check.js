#!/usr/bin/env node
/**
 * End-to-end check of the game picker dock against a fake obs-websocket
 * (tools/gamepicker/fake-obs.js) holding AJ's real 16:9 Game scene. Drives
 * the dock in headless Chrome and checks that:
 *   - a wrong password shows the password box, the right one connects and
 *     is never stored (localStorage is shared across the Pages origin),
 *   - the list merges both captures' window lists (the hook's leaves out
 *     browsers and Discord), hides OBS / MIU / Explorer and pins recents,
 *   - a window only the hook can see goes to the hook, and what the dock
 *     says it shows follows changes made in the source properties,
 *   - picking a game hooks it and hides every other capture (not Action Cam),
 *   - a browser goes straight to window capture,
 *   - a Store app shows through its frame, and its dark UI isn't "black",
 *   - a hook that shows black falls back to window capture and remembers it,
 *   - the capture card button shows only the Game Capture scene,
 *   - an app's sound goes to Music or Game as an app capture with that
 *     source's tracks, volume and filters (no fade filters), and off again,
 *   - an app meter that goes red stays flagged until clicked,
 *   - the meters move, and AJ's own audio sources are never changed.
 *
 * Usage: npm run gamepicker:check [-- --shot=dock.png]
 */
import { startServer, launchBrowser } from '../lib/browser.js';
import { startFakeObs } from './fake-obs.js';

const shot = process.argv.find(a => a.startsWith('--shot='))?.slice(7);
const results = [];
const check = (name, pass, detail = '') => {
    results.push({ name, pass });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass || !detail ? '' : `  (${detail})`}`);
};
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        if (await fn()) return true;
        await wait(50);
    }
    return false;
}

const obs = await startFakeObs({ password: 'pw' });
const { server, baseUrl } = await startServer();
const { browser } = await launchBrowser({ width: 380, height: 900 });
const visible = () => obs.state.items.filter(i => i.sceneItemEnabled).map(i => i.sourceName).sort().join(',');

try {
    const page = await browser.newPage();
    await page.setViewport({ width: 360, height: 860 });
    const errors = [];

    // ?obs= only reaches this machine
    await page.goto(`${baseUrl}/src/gamepicker/index.html?obs=${encodeURIComponent('wss://example.com:4455')}`);
    check('refuses a remote ?obs=', await until(() => page.$eval('#note', el => /Ignored \?obs=/.test(el.textContent))));

    page.on('pageerror', e => errors.push(e.message));

    // wrong password first
    await page.goto(`${baseUrl}/src/gamepicker/index.html?obs=${encodeURIComponent(obs.url)}`);
    check('wrong password shows the password box',
        await until(() => page.$eval('#auth', el => !el.hidden)));
    await page.type('#password', 'pw');
    await page.click('#auth button');
    check('connects with the right password',
        await until(() => page.$eval('#status', el => el.textContent === 'Connected to OBS')));

    await until(() => page.$$eval('#windows .pick', els => els.length > 0));
    const exes = await page.$$eval('#windows .exe', els => els.map(e => e.textContent));
    check('hides OBS, MIU and Explorer', !exes.some(e => /obs64|MixItUp|explorer/.test(e)), exes.join(' '));
    check('lists windows only the window capture sees (Firefox)', exes.includes('firefox.exe'), exes.join(' '));
    check('lists windows only the hook sees (Telegram)', exes.includes('Telegram.exe'), exes.join(' '));
    check('shows what 16:9 Game shows now',
        (await page.$eval('#showing', el => el.textContent)) === 'Showing: RACCOIN.exe (game hook)');

    const rowOf = async (exe) => {
        for (const li of await page.$$('#windows li')) {
            const name = await li.$eval('.exe', e => e.textContent.replace('★ ', ''));
            if (name === exe) return li;
        }
        throw new Error(`no row for ${exe}`);
    };
    const clickExe = async (exe, swap = false) => (await (await rowOf(exe)).$(swap ? '.swap' : '.pick')).click();
    const settled = () => until(() => page.$eval('body', b => !b.classList.contains('busy')), 15000);
    const pickAndWait = async (exe) => { await clickExe(exe); await wait(100); await settled(); };
    const noteText = () => page.$eval('#note', el => el.textContent);
    const reopen = async (remembered) => {
        await page.evaluate((r) => {
            const s = JSON.parse(localStorage.getItem('gamePicker:v1'));
            Object.assign(s.remembered, r);
            localStorage.setItem('gamePicker:v1', JSON.stringify(s));
        }, remembered);
        await page.goto(`${baseUrl}/src/gamepicker/index.html?obs=${encodeURIComponent(obs.url)}&password=pw`);
        await until(() => page.$eval('#status', el => el.textContent === 'Connected to OBS'));
        await until(() => page.$$eval('#windows .pick', els => els.length > 0));
    };

    // Window capture is the default: it shows any app (Defiant, 2026-10-30)
    await pickAndWait('mGBA.exe');
    check('a game goes to window capture by default', visible() === 'Window Capture'
        && obs.state.inputs['Window Capture'].settings.window.includes('mGBA.exe')
        && obs.state.inputs['Window Capture'].settings.priority === 2, visible());
    check('only that capture is visible (duplicates hidden)', visible() === 'Window Capture', visible());
    check('preview shown', await page.$eval('#preview', el => !el.hidden && el.src.startsWith('data:image')));

    await pickAndWait('Spotify.exe');
    check('a desktop app (Spotify) shows through window capture', visible() === 'Window Capture'
        && obs.state.inputs['Window Capture'].settings.window.includes('Spotify.exe') && await noteText() === '', await noteText());

    await pickAndWait('firefox.exe');
    check('a browser goes to window capture', visible() === 'Window Capture'
        && obs.state.inputs['Window Capture'].settings.window.includes('firefox.exe'), visible());

    // A Store app (Realtek): the list names its inner window, which shows
    // nothing; the frame shows it, dark but real (Defiant, 2026-10-30)
    await pickAndWait('RtkUWP.exe');
    check('a Store app shows through its frame', visible() === 'Window Capture'
        && obs.state.inputs['Window Capture'].settings.window === 'Realtek Audio Console:ApplicationFrameWindow:ApplicationFrameHost.exe'
        && obs.state.inputs['Window Capture'].settings.priority === 1, `${visible()} ${obs.state.inputs['Window Capture'].settings.window}`);
    check('and its dark picture counts as a picture', await noteText() === '', await noteText());
    check('and the dock shows it as picked', (await page.$eval('#showing', el => el.textContent)) === 'Showing: RtkUWP.exe (window)'
        && (await page.$$eval('#windows li.current .exe', els => els.map(e => e.textContent))).join() === '★ RtkUWP.exe',
    await page.$eval('#showing', el => el.textContent));

    // Exclusive fullscreen: black through window capture, so the hook
    await pickAndWait('Balatro.exe');
    check('a game black in window capture falls back to the game hook', visible() === 'Game Capture 2'
        && obs.state.inputs['Game Capture 2'].settings.window.startsWith('Balatro'), visible());
    check('and says so', /uses the game hook now/.test(await noteText()), await noteText());
    let remembered = await page.evaluate(() => JSON.parse(localStorage.getItem('gamePicker:v1')).remembered);
    check('remembers the hook for it', remembered['balatro.exe'] === 'hook', JSON.stringify(remembered));
    check('never stores the password', !(await page.evaluate(() => JSON.stringify(localStorage))).includes('pw'));
    const top = [...new Set(await page.$$eval('#windows .exe', els => els.map(e => e.textContent)))].slice(0, 3);
    check('recents pinned on top, newest first', top.join('|') === '★ Balatro.exe|★ RtkUWP.exe|★ firefox.exe', top.join('|'));

    // Telegram minimised: only the hook lists it, and the hook gives no
    // picture for a desktop app. Remembered as window, it must still go to
    // the hook (the only capture that lists it), say it looks minimised, and
    // leave Window Capture alone (Code review, #114). Spotify remembered as
    // hook (a stale choice): the hook gives no picture at all (null), which
    // must count as failed and fall back to window capture
    await reopen({ 'telegram.exe': 'window', 'spotify.exe': 'hook' });
    check('marks a hook-only window as minimised', (await (await rowOf('Telegram.exe')).$eval('.title', e => e.textContent)).includes('minimised?'));
    const visibleBefore = visible();
    const windowBefore = obs.state.inputs['Window Capture'].settings.window;
    const hookBefore = obs.state.inputs['Game Capture 2'].settings.window;
    await pickAndWait('Telegram.exe');
    const tried = obs.state.log.some(r => r.requestType === 'SetInputSettings' && r.requestData.inputName === 'Game Capture 2'
        && String(r.requestData.inputSettings.window).includes('Telegram.exe'));
    check('a hook-only window is tried on the hook (never window capture)', tried
        && !obs.state.log.some(r => r.requestType === 'SetInputSettings' && r.requestData.inputName === 'Window Capture'
            && String(r.requestData.inputSettings.window).includes('Telegram.exe')));
    check('and when it shows nothing, the picture stays as it was (Defiant: it went black)',
        visible() === visibleBefore && obs.state.inputs['Game Capture 2'].settings.window === hookBefore
        && obs.state.inputs['Window Capture'].settings.window === windowBefore, `${visible()} vs ${visibleBefore}`);
    check('and asks to restore it', /looks minimised/.test(await noteText()), await noteText());

    // Restored, then picked once: the dock re-lists first, so one click works
    obs.restore('Telegram.exe');
    await pickAndWait('Telegram.exe');
    check('a window restored a moment ago works on the first click', visible() === 'Window Capture'
        && obs.state.inputs['Window Capture'].settings.window.includes('Telegram.exe'), `${visible()} ${await noteText()}`);

    await pickAndWait('Spotify.exe');
    check('no picture from the hook (null) falls back to window capture', visible() === 'Window Capture'
        && obs.state.inputs['Window Capture'].settings.window.includes('Spotify.exe'), visible());
    remembered = await page.evaluate(() => JSON.parse(localStorage.getItem('gamePicker:v1')).remembered);
    check('and remembers window capture for it', remembered['spotify.exe'] === 'window', JSON.stringify(remembered));

    // Changed by hand in the source properties: the dock follows OBS
    await pickAndWait('firefox.exe');
    check('highlights only the picked window', (await page.$$eval('#windows li.current .exe', els => els.map(e => e.textContent))).join() === '★ firefox.exe');
    obs.setFromProperties('Window Capture', { window: 'Claude:Chrome_WidgetWin_1:claude.exe' });
    check('follows a change made in the source properties', await until(() =>
        page.$eval('#showing', el => el.textContent.startsWith('Showing: claude.exe (window) - window not found'))));

    // Action Cam is MIU's: shown by MIU, the picker must leave it shown
    obs.state.items.find(i => i.sourceName === 'Action Cam').sceneItemEnabled = true;
    await page.click('#console');
    await wait(600);
    check('capture card shows only Game Capture (Action Cam left alone)',
        visible() === 'Action Cam,Game Capture', visible());
    check('says so, without the window-not-found warning', await page.$eval('#showing',
        el => el.textContent === 'Showing: console (capture card)' && !el.classList.contains('missing')));

    // Per-app audio (AJ, 2026-10-30): Firefox to Music keeps it off the VOD
    const route = async (exe, target) => {
        await (await (await rowOf(exe)).$('select.audio')).select(target);
        await wait(100);
        await settled();
    };
    const inp = n => obs.state.inputs[n];
    const inScene = n => obs.state.audioScene.some(i => i.name === n);
    // Made hidden, set up, then shown: a half-made input must never play,
    // and one that fails partway is removed (Code review, #116)
    obs.state.failOn = 'CreateSourceFilter';
    await route('firefox.exe', 'music');
    check('a route that fails partway leaves nothing behind', !Object.keys(obs.state.inputs).some(n => n.startsWith('App Audio:'))
        && !obs.state.audioScene.some(i => i.name.startsWith('App Audio:'))
        && /Couldn't route/.test(await noteText()), `${JSON.stringify(obs.state.audioScene)} ${await noteText()}`);
    check('and the menu says off', await (await rowOf('firefox.exe')).$eval('select.audio', s => s.value === 'off'));
    await route('firefox.exe', 'music');
    const created = obs.state.log.filter(r => r.requestType === 'CreateInput').at(-1);
    const shownAt = obs.state.log.findLastIndex(r => r.requestType === 'SetSceneItemEnabled' && r.requestData.sceneName === 'Audio');
    const lastSetup = obs.state.log.findLastIndex(r => /^(SetInputAudioTracks|SetInputVolume|CreateSourceFilter)$/.test(r.requestType));
    check('the app input is created hidden and shown only once set up', created?.requestData.sceneItemEnabled === false
        && shownAt > lastSetup && obs.state.audioScene.find(i => i.name === 'App Audio: firefox.exe (Music)')?.enabled === true);
    const music = inp('App Audio: firefox.exe (Music)');
    check('Firefox to Music adds an app capture in the Audio scene', !!music && music.kind === 'wasapi_process_output_capture'
        && inScene('App Audio: firefox.exe (Music)') && music.settings.window.includes('firefox.exe')
        && music.settings.priority === 2, JSON.stringify(music?.settings));
    check('with BG Music’s tracks (off the VOD track 2), volume and no monitoring', !!music
        && JSON.stringify(music.tracks) === JSON.stringify(inp('BG Music').tracks) && music.tracks['2'] === false
        && music.volume === inp('BG Music').volume && music.monitor === 'OBS_MONITORING_TYPE_NONE');
    check('and BG Music’s filters, without its fade (Move) filters', !!music
        && music.filters.map(f => f.filterKind).join() === 'limiter_filter', music?.filters.map(f => f.filterKind).join());
    check('its meter shows in the dock', await until(() => page.$$eval('#meters .name', els => els.some(e => e.textContent === 'firefox.exe (Music)'))));
    const flagged = () => page.$$eval('#meters .meter.clipped', els => els.length);
    check('an app meter in the green isn\u2019t flagged', !(await wait(300)) && await flagged() === 0);
    obs.state.appPeak = 0.5;    // -6 dBFS: red
    check('an app meter that goes red stays flagged', await until(async () => await flagged() === 1));
    obs.state.appPeak = 0.05;
    await wait(300);
    check('until clicked', await flagged() === 1 && await page.$eval('#meters .meter.clipped', el => { el.click(); return true; })
        && await flagged() === 0);
    check('the row shows where it goes', await (await rowOf('firefox.exe')).$eval('select.audio', s => s.value === 'music'));

    await route('firefox.exe', 'game');
    const game = inp('App Audio: firefox.exe (Game)');
    check('switching to Game replaces it, with Local Game (A)’s tracks, volume and filters',
        !inp('App Audio: firefox.exe (Music)') && !inScene('App Audio: firefox.exe (Music)') && !!game && game.tracks['2'] === true
        && game.volume === inp('Local Game (A)').volume && game.filters.map(f => f.filterKind).join() === 'gain_filter,limiter_filter');

    await route('firefox.exe', 'off');
    check('off stream removes it', !Object.keys(obs.state.inputs).some(n => n.startsWith('App Audio:'))
        && !obs.state.audioScene.some(i => i.name.startsWith('App Audio:')), JSON.stringify(obs.state.audioScene));
    check('and the dock says so', await (await rowOf('firefox.exe')).$eval('select.audio', s => s.value === 'off'));

    check('meters move', await until(() => page.$eval('#meters .bar', b => parseFloat(b.style.width) > 50)));
    const own = ['Mic', 'Local Game (A)', 'Ext Capture (B)', 'BG Music'];
    const touched = obs.state.log.filter(r => /^(Set|Remove|Create)/.test(r.requestType)
        && own.includes(r.requestData.inputName ?? r.requestData.sourceName));
    check('never changes your own audio sources', touched.length === 0, touched.map(r => r.requestType).join(','));
    check('no page errors', errors.length === 0, errors.join('; '));

    if (shot) {
        await page.screenshot({ path: shot, fullPage: true });
        console.log(`screenshot: ${shot}`);
    }
} finally {
    await browser.close();
    await server.close();
    await obs.close();
}

const failed = results.filter(r => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
