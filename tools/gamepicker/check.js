#!/usr/bin/env node
/**
 * End-to-end check of the game picker dock against a fake obs-websocket
 * (tools/gamepicker/fake-obs.js) holding AJ's real 16:9 Game scene. Drives
 * the dock in headless Chrome and checks that:
 *   - a wrong password shows the password box, the right one connects and
 *     is never stored (localStorage is shared across the Pages origin),
 *   - a first run opens setup with a guess from the scenes in OBS, and
 *     nothing about any one OBS is built in (the fake holds AJ's),
 *   - the list merges both captures' window lists (the hook's leaves out
 *     browsers and Discord), hides OBS and Explorer and pins recents,
 *   - a window only the hook can see goes to the hook, and what the dock
 *     says it shows follows changes made in the source properties,
 *   - picking a game hooks it and hides every other capture (not Action Cam),
 *   - a browser goes straight to window capture,
 *   - a Store app shows through its frame, and its dark UI isn't "black",
 *   - a hook that shows black falls back to window capture and remembers it,
 *   - a pinned source's button shows only that source,
 *   - an app's sound goes to a channel as an app capture with the tracks,
 *     volume and filters of the source it copies (no fade filters), and off,
 *   - a channel meter that goes red stays flagged until clicked,
 *   - a channel can be made, take several apps and move them with one
 *     fader (capped at the setup's max) and mute, kept in OBS,
 *   - a channel's light shows sound arriving, and the streamer's own audio
 *     sources are never changed.
 *
 *   - at tall, medium, small and wide dock sizes nothing scrolls off.
 *
 * Usage: npm run gamepicker:check [-- --shot=dock.png] [-- --shots=dir]
 */
import { startServer, launchBrowser } from '../lib/browser.js';
import { startFakeObs, WINDOWS } from './fake-obs.js';

const shot = process.argv.find(a => a.startsWith('--shot='))?.slice(7);
const shotDir = process.argv.find(a => a.startsWith('--shots='))?.slice(8);
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

    // First run: setup, guessed from the scenes (AJ, 2026-10-30: "assume
    // someone is coming in with an entire different setup")
    check('a first run opens setup', await until(() => page.$eval('#setup', el => !el.hidden)));
    if (shotDir) await page.screenshot({ path: `${shotDir}/dock-setup.png` });
    // AJ "checks, then saves": the guess should be AJ's OBS as it is (QA, #120)
    const guess = await page.evaluate(() => ['setScene', 'setWindow', 'setHook', 'setAudioScene', 'setMaxDb']
        .map(id => document.getElementById(id).value).join('|') + `|${document.getElementById('setHideOthers').checked}`);
    check('guesses the scene, the captures in use, the nested audio scene and -12 dB',
        guess === '16:9 Game|Window Capture|Game Capture 2|Audio|-12|true', guess);
    const sceneOpts = await page.$$eval('#setScene option, #setAudioScene option', els => els.map(e => e.value));
    check('leaves divider scenes out of setup', !sceneOpts.some(v => v.includes('---')), sceneOpts.join(','));
    const html = await page.evaluate(() => document.documentElement.innerHTML.replace(/<select[\s\S]*?<\/select>|<div id="setPinned">[\s\S]*?<\/div>/g, ''));
    check('no names from any one OBS in the page', !/Local Game|BG Music|Ext Capture|16:9 Game|Console/.test(html));
    await page.$$eval('#setPinned input', els => els.forEach(e => { e.checked = e.value === 'Game Capture'; }));
    await page.click('#setup .save');
    check('saves the setup in OBS', await until(() => obs.state.persistent['gamePicker.setup']?.window === 'Window Capture')
        && await until(() => page.$eval('#setup', el => el.hidden)), JSON.stringify(obs.state.persistent['gamePicker.setup']));
    check('offers Game and Music to start', await until(() => page.$$eval('#channels .chan b', els => els.map(e => e.textContent).join() === 'Game,Music')));

    await until(() => page.$$eval('#windows .pick', els => els.length > 0));
    const exes = await page.$$eval('#windows .exe', els => els.map(e => e.textContent.split(' · ')[0]));
    check('hides OBS and Explorer', !exes.some(e => /obs64|explorer/.test(e)), exes.join(' '));
    check('window title first, app under it, with a letter tile', await page.$eval('#windows li', li =>
        li.querySelector('.pick').firstElementChild.className === 'title' && /^[A-Z0-9?]$/.test(li.querySelector('.ico').textContent)));
    // AJ (2026-10-30): "i would call them Apps instead of Windows"
    check('calls the list Apps', await page.$eval('#tabWindows', el => el.textContent) === 'Apps'
        && await page.$eval('#search', el => el.placeholder) === 'Filter apps');
    check('lists windows only the window capture sees (Firefox)', exes.includes('firefox.exe'), exes.join(' '));
    check('lists windows only the hook sees (Telegram)', exes.includes('Telegram.exe'), exes.join(' '));
    const shown = () => page.$eval('.showtext', el => `${el.querySelector('#showing').textContent} | ${el.querySelector('#showMeta').textContent}`);
    check('shows what 16:9 Game shows now, title first', await shown() === 'RACCOIN | RACCOIN.exe · game hook', await shown());

    const rowOf = async (exe) => {
        for (const li of await page.$$('#windows li')) {
            const name = await li.$eval('.exe', e => e.textContent.split(' · ')[0]);
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
    check('and the dock shows it as picked', await shown() === 'Realtek Audio Console | RtkUWP.exe · window'
        && (await page.$$eval('#windows li.current .exe', els => els.map(e => e.textContent))).join() === 'RtkUWP.exe',
    await shown());

    // Exclusive fullscreen: black through window capture, so the hook
    await pickAndWait('Balatro.exe');
    check('a game black in window capture falls back to the game hook', visible() === 'Game Capture 2'
        && obs.state.inputs['Game Capture 2'].settings.window.startsWith('Balatro'), visible());
    check('and says so', /uses the game hook now/.test(await noteText()), await noteText());
    let remembered = await page.evaluate(() => JSON.parse(localStorage.getItem('gamePicker:v1')).remembered);
    check('remembers the hook for it', remembered['balatro.exe'] === 'hook', JSON.stringify(remembered));
    check('never stores the password', !(await page.evaluate(() => JSON.stringify(localStorage))).includes('pw'));
    const top = [...new Set(await page.$$eval('#windows li', els => els.map(li =>
        `${li.querySelector('.title').textContent.startsWith('★') ? '★ ' : ''}${li.querySelector('.exe').textContent}`)))].slice(0, 3);
    check('recents pinned on top, newest first', top.join('|') === '★ Balatro.exe|★ RtkUWP.exe|★ firefox.exe', top.join('|'));

    // Telegram minimised: only the hook lists it, and the hook gives no
    // picture for a desktop app. Remembered as window, it must still go to
    // the hook (the only capture that lists it), say it looks minimised, and
    // leave Window Capture alone (Code review, #114). Spotify remembered as
    // hook (a stale choice): the hook gives no picture at all (null), which
    // must count as failed and fall back to window capture
    await reopen({ 'telegram.exe': 'window', 'spotify.exe': 'hook' });
    check('marks a hook-only window as minimised', (await (await rowOf('Telegram.exe')).$eval('.exe', e => e.textContent)).includes('minimised?'));
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
    check('highlights only the picked window', (await page.$$eval('#windows li.current .exe', els => els.map(e => e.textContent))).join() === 'firefox.exe');
    obs.setFromProperties('Window Capture', { window: 'Claude:Chrome_WidgetWin_1:claude.exe' });
    check('follows a change made in the source properties', await until(() =>
        page.$eval('#showMeta', el => el.textContent === 'claude.exe · window · app not found')));

    // Action Cam is MIU's: shown by MIU, the picker must leave it shown
    obs.state.items.find(i => i.sourceName === 'Action Cam').sceneItemEnabled = true;
    await page.click('#pinned button');
    await wait(600);
    check('a pinned source\u2019s button shows only it (Action Cam left alone)',
        visible() === 'Action Cam,Game Capture', visible());
    check('says so, without the window-not-found warning', await shown() === 'Game Capture | pinned source'
        && await page.$eval('#showing', el => !el.classList.contains('missing')), await shown());

    // Channels made in the dock (AJ, 2026-10-30): a name, tracks, and
    // optionally a source to copy. The offered plain Game and Music go, then
    // AJ's two: Game copies Local Game (A), Music copies BG Music (off the
    // VOD track)
    const makeChannel = async (name, copyFrom) => {
        if (await page.$eval('#newChannel', f => f.hidden)) await page.click('#newToggle');
        await until(() => page.$$eval('#channelCopy option', os => os.length > 1));
        await page.type('#channelName', name);
        await page.select('#channelCopy', copyFrom);
        await wait(200);    // its tracks get ticked
        await page.click('#newChannel button[type=submit]');
        await settled();
    };
    // A fresh dock: Music has no tracks, nothing to copy and no app yet, so
    // the first app sent there would land on every track (VOD too) with no
    // limiter. The dock asks for its tracks instead (Code review, #120)
    await (await (await rowOf('firefox.exe')).$('select.audio')).select('music');
    await settled();
    check('a fresh channel asks for its tracks before its first app', !Object.keys(obs.state.inputs).some(n => n.startsWith('App Audio:'))
        && /tracks first/.test(await noteText()) && await page.$eval('#newChannel', f => !f.hidden)
        && await page.$eval('#channelName', i => i.readOnly && i.value === 'Music'), await noteText());
    // It suggests the source named like it, with that source's tracks: on
    // AJ's OBS, Music copies BG Music, off the VOD track 2 (QA, #120)
    const ticked = () => page.$$eval('#channelTracks input:checked', els => els.map(e => e.value).join());
    check('and suggests the source named like it, with its tracks', await until(async () => await ticked() === '1,4,5,6')
        && await page.$eval('#channelCopy', s => s.value === 'BG Music'), await ticked());
    await page.click('#newChannel button[type=submit]');
    await settled();
    const saved = () => obs.state.persistent['gamePicker.channels']?.channels?.find(c => c.id === 'music');
    check('saving keeps it', JSON.stringify(saved()?.tracks) === '[1,4,5,6]' && saved()?.copyFrom === 'BG Music', JSON.stringify(saved()));
    await (await (await rowOf('firefox.exe')).$('select.audio')).select('music');
    await settled();
    const firstMusic = obs.state.inputs['App Audio: firefox.exe (Music)'];
    check('then the app goes in off the VOD track, with the Limiter', JSON.stringify(firstMusic?.tracks) === JSON.stringify(obs.state.inputs['BG Music'].tracks)
        && firstMusic?.filters.map(f => f.filterKind).join() === 'limiter_filter', JSON.stringify(firstMusic?.tracks));
    // An app moved to a channel that still needs its tracks stays where it was
    await page.$$eval('#channels .chan', rows => rows[0].querySelector('.name').click());
    await page.click('#newToggle');
    await (await (await rowOf('firefox.exe')).$('select.audio')).select('game');
    await settled();
    check('moving an app to a channel that needs tracks leaves it where it was', !!obs.state.inputs['App Audio: firefox.exe (Music)']
        && await (await rowOf('firefox.exe')).$eval('select.audio', s => s.value === 'music'));
    await page.click('#newToggle');
    await (await (await rowOf('firefox.exe')).$('select.audio')).select('off');
    await settled();
    // Game the same way: Local Game (A), on 1,2,4,5,6
    await page.$$eval('#channels .chan', rows => rows[0].querySelector('.name').click());
    check('Game suggests Local Game (A) and its tracks', await until(async () => await ticked() === '1,2,4,5,6')
        && await page.$eval('#channelCopy', s => s.value === 'Local Game (A)'), await ticked());
    await page.click('#newToggle');
    await page.click('#newToggle');
    await until(() => page.$$eval('#channelCopy option', os => os.length > 1));
    const copyOpts = await page.$$eval('#channelCopy option', os => os.map(o => o.value));
    check('the copy menu lists audio sources, not captures', copyOpts.includes('BG Music') && copyOpts.includes('Mic')
        && !copyOpts.includes('Window Capture'), copyOpts.join());
    for (let i = 0; i < 2; i++) {
        await page.$eval('#channels .chan .del', b => b.click());
        await settled();
    }
    check('the offered channels can be removed', await until(() => page.$$eval('#channels .chan', els => els.length === 0)));
    await makeChannel('Game', 'Local Game (A)');
    await makeChannel('Music', 'BG Music');
    const chanNames = () => page.$$eval('#channels .chan b', els => els.map(e => e.textContent).join());
    check('channels made', await until(async () => await chanNames() === 'Game,Music'), await chanNames());
    check('a copied channel takes its source\u2019s tracks', JSON.stringify(obs.state.persistent['gamePicker.channels']?.channels
        .find(c => c.label === 'Music')?.tracks) === '[1,4,5,6]', JSON.stringify(obs.state.persistent['gamePicker.channels']));

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
    await route('firefox.exe', 'ch-music');
    check('a route that fails partway leaves nothing behind', !Object.keys(obs.state.inputs).some(n => n.startsWith('App Audio:'))
        && !obs.state.audioScene.some(i => i.name.startsWith('App Audio:'))
        && /Couldn't route/.test(await noteText()), `${JSON.stringify(obs.state.audioScene)} ${await noteText()}`);
    check('and the menu says off', await (await rowOf('firefox.exe')).$eval('select.audio', s => s.value === 'off'));
    await route('firefox.exe', 'ch-music');
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
    check('the Music channel counts it', await until(() => page.$$eval('#channels .apps', els => els.map(e => e.textContent.split(' · ')[0]).join() === 'empty,1 app')));
    check('and its light shows sound arriving', await until(() => page.$$eval('#channels .chan', els => els[1].dataset.act === 'live' && els[0].dataset.act === 'idle')));
    const flagged = () => page.$$eval('#channels .chan.clipped', els => els.length);
    check('a channel meter in the green isn\u2019t flagged', !(await wait(300)) && await flagged() === 0);
    obs.state.appPeak = 0.5;    // -6 dBFS: red
    check('a channel meter that goes red stays flagged', await until(async () => await flagged() === 1));
    obs.state.appPeak = 0.05;
    await wait(300);
    check('until clicked', await flagged() === 1 && await page.$eval('#channels .chan.clipped', el => { el.click(); return true; })
        && await flagged() === 0);
    check('the row shows where it goes', await (await rowOf('firefox.exe')).$eval('select.audio', s => s.value === 'ch-music'));

    await route('firefox.exe', 'ch-game');
    const game = inp('App Audio: firefox.exe (Game)');
    check('switching to Game replaces it, with Local Game (A)’s tracks, volume and filters',
        !inp('App Audio: firefox.exe (Music)') && !inScene('App Audio: firefox.exe (Music)') && !!game && game.tracks['2'] === true
        && game.volume === inp('Local Game (A)').volume && game.filters.map(f => f.filterKind).join() === 'gain_filter,limiter_filter');

    await route('firefox.exe', 'off');
    check('off stream removes it', !Object.keys(obs.state.inputs).some(n => n.startsWith('App Audio:'))
        && !obs.state.audioScene.some(i => i.name.startsWith('App Audio:')), JSON.stringify(obs.state.audioScene));
    check('and the dock says so', await (await rowOf('firefox.exe')).$eval('select.audio', s => s.value === 'off'));

    // Channels AJ makes (AJ, 2026-10-30): several apps in one, one fader
    await makeChannel('Browser', 'Local Game (A)');
    const slot = () => obs.state.persistent['gamePicker.channels'];
    check('a new channel is saved in OBS', slot()?.channels?.[2]?.label === 'Browser' && slot().channels[2].copyFrom === 'Local Game (A)', JSON.stringify(slot()));
    check('and shows in the Sound menu', await (await rowOf('Spotify.exe')).$$eval('select.audio option', os => os.some(o => o.textContent.includes('Browser'))));
    await route('firefox.exe', 'ch-browser');
    await route('Spotify.exe', 'ch-browser');
    const ff = inp('App Audio: firefox.exe (Browser)'), sp = inp('App Audio: Spotify.exe (Browser)');
    check('two apps share the channel, each copying Local Game (A)', !!ff && !!sp && ff.tracks['2'] === true
        && sp.filters.map(f => f.filterKind).join() === 'gain_filter,limiter_filter'
        && await page.$$eval('#channels .apps', els => els[2]?.textContent.startsWith('2 apps')));
    // Each app is yellow (-14 dBFS) but the two together could reach -8: red
    obs.state.appPeak = 0.2;
    check('a channel meter adds its apps up, so two yellow apps flag red',
        await until(async () => (await page.$$eval('#channels .chan', els => els[2]?.classList.contains('clipped')))));
    obs.state.appPeak = 0.05;
    await page.$$eval('#channels .chan', els => els[2].click());
    const fader = async (i, db) => {
        await page.$$eval('#channels .fader', (els, [i, db]) => {
            els[i].value = String(db);
            els[i].dispatchEvent(new Event('change'));
        }, [i, db]);
        await wait(100);
        await settled();
    };
    await fader(2, -30);
    const near = (v, db) => Math.abs(20 * Math.log10(v) - db) < 0.01;
    check('the channel fader moves both apps', near(inp('App Audio: firefox.exe (Browser)').volume, -30)
        && near(inp('App Audio: Spotify.exe (Browser)').volume, -30), `${inp('App Audio: firefox.exe (Browser)').volume}`);
    check('and is saved', near(slot().mix['ch-browser'].volumeMul, -30));
    await fader(2, 0);
    check('the fader stops at -12 dB (out of the red with the copied Limiter)', near(inp('App Audio: firefox.exe (Browser)').volume, -12));
    await page.$$eval('#channels .chan', rows => rows[2].querySelector('.mute').click());
    await wait(100);
    await settled();
    check('channel mute mutes both apps', inp('App Audio: firefox.exe (Browser)').muted && inp('App Audio: Spotify.exe (Browser)').muted);
    await reopen({});
    check('the channel and its apps are there after a reload', await (await rowOf('firefox.exe')).$eval('select.audio', s => s.value === 'ch-browser')
        && await page.$$eval('#channels .apps', els => els[2]?.textContent.startsWith('2 apps')));
    await route('Telegram.exe', 'ch-browser');
    const tg = inp('App Audio: Telegram.exe (Browser)');
    check('an app added later gets the channel\u2019s fader and mute', !!tg && near(tg.volume, -12) && tg.muted === true);
    await page.$$eval('#channels .chan', rows => rows[2].querySelector('.del').click());
    await wait(100);
    await settled();
    check('removing the channel takes its apps off stream', !Object.keys(obs.state.inputs).some(n => n.startsWith('App Audio:'))
        && !obs.state.audioScene.some(i => i.name.startsWith('App Audio:')) && slot().channels.length === 2, JSON.stringify(obs.state.audioScene));

    const own = ['Mic', 'Local Game (A)', 'Ext Capture (B)', 'BG Music'];
    const touched = obs.state.log.filter(r => /^(Set|Remove|Create)/.test(r.requestType)
        && own.includes(r.requestData.inputName ?? r.requestData.sourceName));
    check('never changes your own audio sources', touched.length === 0, touched.map(r => r.requestType).join(','));
    // The dock can be any shape in AJ's dock layout (AJ, 2026-10-30): at
    // each size the picture, the windows and the mixer are on screen without
    // scrolling the page, nothing runs off the side, and a short dock that
    // can't fit both halves shows them as tabs
    const inView = sel => page.$$eval(sel, (els) => els.length > 0 && els.every((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    }));
    const firstInView = sel => page.$eval(sel, (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    });
    // A window opened after the list was read shows up by itself (OBS has
    // no event for it; the dock re-reads every refreshMs while on screen)
    WINDOWS.push('notes.txt - Notepad:Notepad:notepad.exe');
    check('a newly opened window shows up without a click', await until(() =>
        page.$$eval('#windows .exe', els => els.some(e => e.textContent === 'notepad.exe')), 8000));
    WINDOWS.pop();

    // An older dock's saved channels ({custom}, built-in Game and Music) with
    // an app already in Music: the next app sent there matches it, not OBS's
    // defaults (every track, VOD too, no limiter) (Code review, #120)
    obs.state.persistent['gamePicker.channels'] = { custom: [], mix: {} };
    obs.state.inputs['App Audio: Spotify.exe (Music)'] = {
        kind: 'wasapi_process_output_capture', settings: { window: 'Spotify Premium:Chrome_WidgetWin_1:Spotify.exe' }, volume: 0.03,
        tracks: { ...inp('BG Music').tracks }, filters: inp('BG Music').filters.filter(f => f.filterKind === 'limiter_filter').map(f => ({ ...f })),
        monitor: 'OBS_MONITORING_TYPE_NONE', muted: false
    };
    obs.state.audioScene.push({ id: obs.state.nextItemId++, name: 'App Audio: Spotify.exe (Music)', enabled: true });
    await reopen({});
    check('an older dock\u2019s Game and Music are there, with its app', await chanNames() === 'Game,Music'
        && await (await rowOf('Spotify.exe')).$eval('select.audio', s => s.value === 'music'), await chanNames());
    await route('firefox.exe', 'music');
    const migrated = inp('App Audio: firefox.exe (Music)');
    check('and the next app in it copies the app already there (tracks off the VOD, its limiter)', !!migrated
        && JSON.stringify(migrated.tracks) === JSON.stringify(inp('BG Music').tracks)
        && migrated.filters.map(f => f.filterKind).join() === 'limiter_filter', JSON.stringify(migrated?.tracks));
    await route('firefox.exe', 'off');
    await route('Spotify.exe', 'off');

    // A lived-in dock for the pictures: a game showing, an app in Music
    await pickAndWait('mGBA.exe');
    await route('firefox.exe', 'music');
    obs.state.appPeak = 0.08;
    for (const size of [
        { name: 'tall', width: 340, height: 860 },
        { name: 'medium', width: 640, height: 540 },
        { name: 'small', width: 300, height: 380, tabs: true },
        { name: 'wide', width: 1240, height: 300 }
    ]) {
        await page.setViewport({ width: size.width, height: size.height });
        await page.evaluate(() => document.getElementById('tabWindows').click());
        await wait(150);
        const tag = `${size.name} ${size.width}x${size.height}`;
        check(`${tag}: nothing runs off the side`, await page.evaluate(() =>
            document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('#app > *')]
                .every(el => el.scrollWidth <= el.clientWidth + 1)));
        check(`${tag}: what's showing and its buttons on screen`, await inView('#showing, #setupBtn, #pinned button, #search'));
        check(`${tag}: the window list starts on screen`, await firstInView('#windows li'));
        check(`${tag}: tabs only when short and narrow`, await page.$eval('#tabs', el => getComputedStyle(el).display !== 'none') === !!size.tabs);
        if (size.tabs) await page.click('#tabSound');
        await wait(100);
        check(`${tag}: every channel strip on screen`, await inView('#channels .chan'));
        if (shotDir) {
            await page.screenshot({ path: `${shotDir}/dock-${size.name}.png` });
            if (size.tabs) {
                await page.click('#tabWindows');
                await wait(100);
                await page.screenshot({ path: `${shotDir}/dock-${size.name}-windows.png` });
            }
        }
    }

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
