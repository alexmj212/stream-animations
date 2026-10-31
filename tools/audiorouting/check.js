#!/usr/bin/env node
/**
 * End-to-end check of the audio routing dock against the fake obs-websocket
 * (tools/gamepicker/fake-obs.js, with AJ's sound from Archive_1-20261031.json).
 * Drives the dock in headless Chrome and checks that:
 *   - it connects, and lists only inputs whose sound reaches OBS's tracks
 *     (a browser page without "Control audio via OBS" and the video
 *     captures are left out),
 *   - each source shows its audio filters as icons in chain order, a
 *     disabled one faded, and video filters left out,
 *   - App Audio inputs hang off their Game Switcher channel, and channels
 *     feed the tracks their apps are on,
 *   - tracks carry the profile's names and the outputs that take them,
 *     and outputs say which tracks they record or stream,
 *   - dragging a source's dot to a track adds it in OBS; dragging the wire
 *     to another track moves it; dragging it away takes it off,
 *   - a click on a wire and × disconnects; Undo puts it back,
 *   - a channel dragged to a track moves every app in it and the saved
 *     channel tracks; dropping on Monitor turns monitoring on,
 *   - anything joining the Twitch VOD track asks first (music can mute it),
 *   - a Monitor Only source taken off Monitor, and an Undo back onto the
 *     VOD track, ask first too,
 *   - while the stream runs, a change to a streamed track waits for one
 *     confirm, and Cancel leaves OBS as it was,
 *   - nothing else in OBS is changed (only the tracks and monitoring asked for),
 *   - lights follow the meters, and "On program only" hides what's off air.
 *
 * Usage: npm run audiorouting:check [-- --shots=dir]
 */
import { startServer, launchBrowser } from '../lib/browser.js';
import { startFakeObs } from '../gamepicker/fake-obs.js';

const shotDir = process.argv.find(a => a.startsWith('--shots='))?.slice(8);
const results = [];
const check = (name, pass, detail = '') => {
    results.push({ name, pass });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass || !detail ? '' : `  (${detail})`}`);
};
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 6000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        if (await fn()) return true;
        await wait(50);
    }
    return false;
}

const obs = await startFakeObs({ password: 'pw', routing: true });
const { server, baseUrl } = await startServer();
const { browser } = await launchBrowser({ width: 900, height: 1000 });
const tracksOf = name => Object.entries(obs.state.inputs[name].tracks).filter(([, v]) => v).map(([k]) => Number(k)).join(',');
const writes = () => obs.state.log.filter(l => /^(Set|Create|Remove)/.test(l.requestType));

try {
    const page = await browser.newPage();
    await page.setViewport({ width: 860, height: 960 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${baseUrl}/src/audiorouting/index.html?password=pw&obs=${encodeURIComponent(obs.url)}`);
    check('connects', await until(() => page.$eval('#status', el => el.textContent === 'Connected to OBS')));
    await until(() => page.evaluate(() => !!window.__audioRouting.model));
    await wait(300);

    const names = await page.$$eval('#colSources .node.src, #colSources .member', els => els.map(e => e.dataset.id || e.title));
    check('lists the inputs with sound',
        ['Mic', 'BG Music', 'Local Game (A)', 'Ext Capture (B)', 'Twitch Alerts', 'Applause', 'App Audio: firefox.exe (Game)'].every(n => names.includes(n)), names.join(','));
    check('leaves out a browser page OBS doesn\'t hear and the video captures',
        !names.some(n => /Chatbox|Game Capture|Window Capture|mGBA/.test(n)), names.join(','));
    check('inputs come first, then desktop and apps, channels, media, browser', names[0] === 'Mic' && names.indexOf('Local Game (A)') < names.indexOf('App Audio: firefox.exe (Game)') && names.indexOf('App Audio: Spotify.exe (Music)') < names.indexOf('Applause') && names.indexOf('Applause') < names.indexOf('Twitch Alerts'), names.join(','));

    const micIcons = await page.$eval('#colSources .node[data-id="Mic"] .fx', el => [...el.querySelectorAll('svg')].map(s => s.dataset.icon).join(','));
    check('Mic shows its filter chain as icons, in order', micIcons === 'denoise,gate,upward,compressor,expander,eq,limiter,vst', micIcons);
    const extOff = await page.$eval('#colSources .node[data-id="Ext Capture (B)"] .fx svg', el => el.classList.contains('off'));
    check('a disabled filter is faded', extOff);
    const bgIcons = await page.$eval('#colSources .node[data-id="BG Music"] .fx', el => [...el.querySelectorAll('svg')].map(s => s.dataset.icon).join(','));
    check('fades show as automation, the limiter last', bgIcons === 'automation,automation,automation,limiter', bgIcons);
    check('a filter icon names its filter', await page.$eval('#colSources .node[data-id="Mic"] .fx svg title', el => el.textContent.startsWith('NVIDIA Noise Removal')));
    check('a muted source says so', await page.$eval('#colSources .node[data-id="Ext Capture (B)"]', el => el.classList.contains('muted')));

    const chans = await page.$$eval('#colSources .node.chan', els => els.map(e => e.querySelector('.name').textContent).join(','));
    check('shows the Game Switcher channels', chans === 'Game,Music,Voice chat', chans);
    const wires = await page.evaluate(() => window.__audioRouting.wires.map(w => w.id));
    check('an app sits in its channel\'s box, not wired to tracks itself',
        await page.$eval('#colSources .node.chan[data-id="game"]', el => /firefox\.exe/.test(el.textContent)) && !wires.some(w => w.startsWith('t:App Audio')));
    const ffIcons = await page.$eval('#colSources .member[title="App Audio: firefox.exe (Game)"] .fx', el => [...el.querySelectorAll('svg')].map(s => s.dataset.icon).join(','));
    check('an app in a channel shows its filters too', ffIcons === 'gain,limiter', ffIcons);
    check('a channel feeds its apps\' tracks', ['c:game:1', 'c:game:2', 'c:music:1', 'c:music:4'].every(w => wires.includes(w)) && !wires.includes('c:music:2'));
    check('an empty channel shows the tracks its next app gets', wires.includes('c:ch-voice:1') && wires.includes('c:ch-voice:2'));

    const tracks = await page.$$eval('#colTracks .node', els => els.map(e => `${e.querySelector('.name').textContent}[${[...e.querySelectorAll('.badge')].map(b => b.textContent).join(' ')}]`).join(' | '));
    check('tracks carry the profile names and their outputs',
        tracks.startsWith('Stream[Stream Rec Replay] | VOD[VOD Rec Replay] | Mic + alerts[Rec Replay] | Track 4[unused]'), tracks);
    const outs = await page.$$eval('#colOutputs .node', els => els.map(e => `${e.querySelector('.name').textContent}:${e.querySelector('.sub').textContent}`).join(' | '));
    check('outputs say which tracks they take, plus Monitor', /Stream.*track 1 \| Twitch VOD.*track 2 \| Recording.*tracks 1 2 3 \| Replay buffer.*tracks 1 2 3 \| Monitor/.test(outs), outs);
    check('monitored sources wire to Monitor', wires.includes('mon:BG Music') && wires.includes('mon:Twitch Alerts'));
    if (shotDir) await page.screenshot({ path: `${shotDir}/routing.png`, fullPage: true });

    // ---- drag to connect ----
    const center = sel => page.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    async function dragTo(from, to) {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
        await page.mouse.move(to.x, to.y, { steps: 4 });
        await page.mouse.up();
    }
    const before = writes().length;
    await dragTo(await center('#colSources .node[data-id="BG Music"] .port.out'), await center('#colTracks .node[data-id="3"]'));
    check('dragging a source to a track adds it', await until(() => tracksOf('BG Music') === '1,3,4,5,6'), tracksOf('BG Music'));
    await until(() => page.evaluate(() => window.__audioRouting.wires.some(w => w.id === 't:BG Music:3')));
    check('the chart redraws from OBS\'s event', await page.evaluate(() => window.__audioRouting.wires.some(w => w.id === 't:BG Music:3')));
    check('Undo is offered', await page.$eval('#undo', el => !el.disabled && /BG Music/.test(el.title)));

    // a point on a wire where it's the one on top (wires cross)
    const wireMid = id => page.evaluate((id) => {
        const p = [...document.querySelectorAll('#wires path.hit')].find(x => x.dataset.wire === id);
        const g = document.getElementById('grid').getBoundingClientRect();
        for (let f = 0.3; f < 0.95; f += 0.05) {
            const pt = p.getPointAtLength(p.getTotalLength() * f);
            const at = { x: pt.x + g.left, y: pt.y + g.top };
            if (document.elementsFromPoint(at.x, at.y).some(e => e.dataset?.wire === id) && f > 0.45) return at;
        }
        return null;
    }, id);
    await dragTo(await wireMid('t:BG Music:3'), await center('#colTracks .node[data-id="2"]'));
    // track 2 is the Twitch VOD in this profile: music there can mute the VOD (QA, #131)
    check('putting anything on the VOD track asks first, saying why', await until(() => page.$eval('#confirm', el => !el.hidden && /VOD muted/.test(el.textContent))));
    check('and changes nothing until confirmed', tracksOf('BG Music') === '1,3,4,5,6');
    await page.click('#confirmYes');
    check('dragging a wire to another track moves it', await until(() => tracksOf('BG Music') === '1,2,4,5,6'), tracksOf('BG Music'));
    await until(() => page.evaluate(() => window.__audioRouting.wires.some(w => w.id === 't:BG Music:2')));
    const m = await wireMid('t:BG Music:2');
    await dragTo(m, { x: m.x, y: m.y + 220 });
    check('dragging a wire away disconnects it', await until(() => tracksOf('BG Music') === '1,4,5,6'), tracksOf('BG Music'));
    // Undo goes through the same confirm: this one puts it back on the VOD (code review, #131)
    await until(() => page.evaluate(() => !document.body.classList.contains('busy')));
    await page.click('#undo');
    check('an Undo back onto the VOD track asks first', await until(() => page.$eval('#confirm', el => !el.hidden && /^Undo: .*VOD muted/.test(document.getElementById('confirmText').textContent))));
    await page.click('#confirmNo');
    check('and Cancel keeps it, still undoable', tracksOf('BG Music') === '1,4,5,6' && await page.$eval('#undo', el => !el.disabled && /BG Music/.test(el.title)));

    // Monitor Only: unplugging Monitor puts it on its tracks, so it asks
    await until(() => page.evaluate(() => window.__audioRouting.wires.some(w => w.id === 'mon:Cue Tone')));
    const cue = await wireMid('mon:Cue Tone');
    await dragTo(cue, { x: cue.x, y: cue.y + 200 });
    check('unplugging a Monitor Only source\'s Monitor asks, naming the tracks it starts on',
        await until(() => page.$eval('#confirm', el => !el.hidden && /starts playing on Stream, VOD.*VOD muted/.test(el.textContent))));
    await page.click('#confirmNo');
    check('and Cancel leaves it Monitor Only', obs.state.inputs['Cue Tone'].monitor === 'OBS_MONITORING_TYPE_MONITOR_ONLY');

    await until(() => page.evaluate(() => !document.body.classList.contains('busy')));
    const mm = await wireMid('t:Mic:6');
    await page.mouse.click(mm.x, mm.y);
    check('a click selects a wire and shows ×', await until(() => page.$eval('#unplug', el => !el.hidden)));
    await page.click('#unplug');
    check('× disconnects it', await until(() => tracksOf('Mic') === '1,2,3,4,5'), tracksOf('Mic'));
    await until(() => page.$eval('#undo', el => /Mic/.test(el.title)));
    await page.click('#undo');
    check('Undo puts it back', await until(() => tracksOf('Mic') === '1,2,3,4,5,6'), tracksOf('Mic'));

    // ---- channels and monitoring ----
    const idle = () => until(() => page.evaluate(() => !document.body.classList.contains('busy')));
    await idle();
    await dragTo(await center('#colSources .node.chan[data-id="music"] .port.out'), await center('#colTracks .node[data-id="3"]'));
    check('a channel to a track moves every app in it', await until(() => tracksOf('App Audio: Spotify.exe (Music)') === '1,3,4,5,6'), tracksOf('App Audio: Spotify.exe (Music)'));
    await idle();
    const savedMusic = obs.state.persistent['gamePicker.channels'].channels.find(c => c.id === 'music').tracks;
    check('and saves the channel\'s tracks for its next app', String(savedMusic) === '1,3,4,5,6', String(savedMusic));
    await dragTo(await center('#colTracks .node[data-id="4"] .port.in'), await center('#colSources .node[data-id="Applause"]'));
    check('a track\'s dot dragged to a source connects too', await until(() => tracksOf('Applause') === '1,2,3,4,5,6'));
    await idle();
    await dragTo(await center('#colSources .node[data-id="Mic"] .port.out'), await center('#colOutputs .node[data-id="monitor"]'));
    check('dropping on Monitor turns on Monitor and Output', await until(() => obs.state.inputs.Mic.monitor === 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'));
    await idle();
    await page.click('#undo');
    check('and Undo turns it off', await until(() => obs.state.inputs.Mic.monitor === 'OBS_MONITORING_TYPE_NONE'));

    // ---- live ----
    obs.setOutput('stream', true);
    check('shows LIVE while streaming', await until(() => page.$eval('#liveBadge', el => !el.hidden)));
    await until(() => page.evaluate(() => window.__audioRouting.model.running.stream));
    await dragTo(await center('#colSources .node[data-id="Applause"] .port.out'), await center('#colTracks .node[data-id="1"]'));
    check('while live, a streamed track already there changes nothing', tracksOf('Applause') === '1,2,3,4,5,6');
    const lm = await wireMid('t:Local Game (A):1');
    await dragTo(lm, { x: lm.x, y: lm.y + 260 });
    check('while live, taking a source off the stream track asks first', await until(() => page.$eval('#confirm', el => !el.hidden && /Stream/.test(el.textContent))));
    check('and nothing changes until confirmed', tracksOf('Local Game (A)') === '1,2,4,5,6');
    if (shotDir) await page.screenshot({ path: `${shotDir}/routing-live-confirm.png` });
    await page.click('#confirmNo');
    check('Cancel leaves it', await until(() => page.$eval('#confirm', el => el.hidden)) && tracksOf('Local Game (A)') === '1,2,4,5,6');
    const lm2 = await wireMid('t:Local Game (A):1');
    await dragTo(lm2, { x: lm2.x, y: lm2.y + 260 });
    await until(() => page.$eval('#confirm', el => !el.hidden));
    await page.click('#confirmYes');
    check('Change it applies', await until(() => tracksOf('Local Game (A)') === '2,4,5,6'));
    await page.click('#undo');
    await until(() => tracksOf('Local Game (A)') === '1,2,4,5,6');
    obs.setOutput('stream', false);

    // ---- only what was asked ----
    const kinds = [...new Set(writes().slice(before).map(l => l.requestType))].sort().join(',');
    check('only tracks, monitoring and the channel slot were written', kinds === 'SetInputAudioMonitorType,SetInputAudioTracks,SetPersistentData', kinds);

    // ---- lights and the program filter ----
    check('lights follow the meters', await until(() => page.$eval('#colSources .node[data-id="Mic"]', el => el.dataset.act === 'live')));
    check('a track lights when a source on it plays', await page.$eval('#colTracks .node[data-id="1"]', el => el.dataset.act === 'live'));
    check('an off-air source is dimmed', await page.$eval('#colSources .node[data-id="Applause"]', el => el.classList.contains('off')));
    await page.click('#onProgram');
    check('"On program only" hides it', await until(() => page.$$eval('#colSources .node', els => !els.some(e => e.dataset.id === 'Applause'))));
    await page.click('#onProgram');

    // ---- narrow dock: scrolls sideways, nothing breaks ----
    await page.setViewport({ width: 420, height: 700 });
    await wait(300);
    check('a narrow dock scrolls instead of squashing', await page.$eval('#chart', el => el.scrollWidth > el.clientWidth));
    if (shotDir) await page.screenshot({ path: `${shotDir}/routing-narrow.png` });

    check('no page errors', errors.length === 0, errors.join(' | '));
} finally {
    await browser.close();
    await server.close();
    await obs.close();
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
