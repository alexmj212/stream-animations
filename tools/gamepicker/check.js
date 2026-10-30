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
 *   - a hook that shows black falls back to window capture and remembers it,
 *   - the capture card button shows only the Game Capture scene,
 *   - the meters move, and the picker never sends an audio request.
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

    const clickExe = async (exe, swap = false) => {
        const rows = await page.$$('#windows li');
        for (const li of rows) {
            const name = await li.$eval('.exe', e => e.textContent.replace('★ ', ''));
            if (name === exe) return (await li.$(swap ? '.swap' : '.pick')).click();
        }
        throw new Error(`no row for ${exe}`);
    };
    const settled = () => until(() => page.$eval('body', b => !b.classList.contains('busy')), 10000);

    await clickExe('mGBA.exe');
    await wait(100);
    await settled();
    check('mGBA goes to the game hook', obs.state.inputs['Game Capture 2'].settings.window.includes('mGBA.exe')
        && obs.state.inputs['Game Capture 2'].settings.priority === 2);
    check('only the hook is visible (duplicates hidden)', visible() === 'Game Capture 2', visible());
    check('preview shown', await page.$eval('#preview', el => !el.hidden && el.src.startsWith('data:image')));

    await clickExe('firefox.exe');
    await wait(100);
    await settled();
    check('a browser goes to window capture', visible() === 'Window Capture'
        && obs.state.inputs['Window Capture'].settings.window.includes('firefox.exe'), visible());

    await clickExe('Balatro.exe');
    await wait(100);
    await settled();
    check('a black hook falls back to window capture', visible() === 'Window Capture'
        && obs.state.inputs['Window Capture'].settings.window.startsWith('Balatro'), visible());
    check('and says so', /switched to window capture/.test(await page.$eval('#note', el => el.textContent)));
    const remembered = await page.evaluate(() => JSON.parse(localStorage.getItem('gamePicker:v1')).remembered);
    check('remembers window capture for it', remembered['balatro.exe'] === 'window', JSON.stringify(remembered));
    check('never stores the password', !(await page.evaluate(() => JSON.stringify(localStorage))).includes('pw'));
    const top = await page.$$eval('#windows .exe', els => els.slice(0, 3).map(e => e.textContent));
    check('recents pinned on top, newest first', top.join('|') === '★ Balatro.exe|★ firefox.exe|★ mGBA.exe', top.join('|'));

    // Telegram is only in the hook's list: never sent to window capture,
    // even with the black fallback, and the ⇄ window button is off
    obs.state.inputs['Window Capture'].settings.window = 'x:y:none.exe';
    await clickExe('Telegram.exe');
    await wait(100);
    await settled();
    check('a hook-only window goes to the hook', visible() === 'Game Capture 2'
        && obs.state.inputs['Game Capture 2'].settings.window.includes('Telegram.exe')
        && obs.state.inputs['Window Capture'].settings.window === 'x:y:none.exe', visible());

    // Changed by hand in the source properties: the dock follows OBS
    await clickExe('firefox.exe');
    await wait(100);
    await settled();
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

    check('meters move', await until(() => page.$eval('#meters .bar', b => parseFloat(b.style.width) > 50)));
    const audio = obs.state.log.filter(r => /Volume|Mute$|SetInputMute|Audio|Monitor/.test(r.requestType) && r.requestType !== 'GetInputMute');
    check('never changes audio', audio.length === 0, audio.map(r => r.requestType).join(','));
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
