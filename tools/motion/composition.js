/**
 * Everything that can be on the 16:9 canvas at once, for worst-case
 * "everything visible" frames (Rotom's inventory for AJ's composition
 * review, 2026-10-28: /mnt/project-files/composition/inventory.md, read from
 * Defiant's OBS scenes, MIU actions and Stream Deck). Boxes are final canvas
 * px [x0, y0, x1, y1]; MIU boxes come from % anchors, so treat them as
 * ±20px. `box` is the layout after Defiant's collision fixes
 * (composition/defiant-steps-collisions.md, design review's gate on
 * 2026-10-28); `today` is the box before them, where it differs.
 * `npm run motion:compose` draws each pair (`--today` for the old layout);
 * tests/tools/composition.test.js holds the fixed pairs to it.
 *
 * kind: P persistent, A alert (timed, fired by events), G gag or redeem.
 * read: a viewer has to read it, so nothing may cover it and it must clear
 *       the player controls (SAFE-3).
 * scenario: our scene draws it; compose renders that harness scenario live
 *       instead of a mock box.
 */

import { config } from '../../src/config/config.js';

const DESIGN = config.design;

export const ELEMENTS = [
    { id: 'goal', label: 'Goal bar', box: [36, 26, 560, 75], kind: 'P', read: true, scenario: 'followers' },
    { id: 'remote', label: 'Remote holder avatar', box: [496, 83, 546, 133], today: [601, 26, 650, 76], kind: 'P' },
    { id: 'jail', label: 'Jail slideshow', box: [496, 140, 622, 211], today: [538, 18, 664, 89], kind: 'G' },
    { id: 'waveform', label: 'Music waveform', box: [19, 0, 481, 124], kind: 'P' },
    { id: 'nowPlaying', label: 'Now playing', box: [19, 89, 481, 130], kind: 'P', read: true },
    { id: 'chat', label: 'Chat', box: [18, 127, 488, 537], kind: 'P', read: true },
    { id: 'pig', label: 'Discoball pig (Just Chatting, Full 16:9)', box: [43, 130, 491, 469], kind: 'P' },
    { id: 'pride', label: 'Pride Guild badge', box: [1613, 950, 1840, 985], today: [1613, 995, 1840, 1030], kind: 'P', read: true },
    { id: 'discord', label: 'Discord heads', box: [440, 859, 1304, 994], today: [440, 928, 1304, 1063], kind: 'P', read: true },
    { id: 'toast', label: 'Toast', box: [560, 26, 1824, 74], kind: 'A', read: true, scenario: 'notifications-name' },
    { id: 'hype', label: 'Hype train banner', box: [560, 26, 1824, 74], today: [0, 28, 1920, 97], kind: 'A', read: true },
    { id: 'ad', label: 'Ad banner', box: [560, 26, 1824, 74], today: [0, 1057, 1920, 1094], kind: 'A', read: true },
    { id: 'sidebar', label: 'Sidebar alert', box: [1500, 560, 1920, 1000], kind: 'A', read: true, scenario: 'sidebar-name' },
    { id: 'shoutout', label: 'MIU shoutout avatar', box: [1451, 254, 1851, 654], kind: 'A' },
    { id: 'resub', label: 'MIU resub avatar', box: [1432, 340, 1832, 740], kind: 'A' },
    { id: 'hug', label: 'MIU hug/pet/treat', box: [1200, 440, 1860, 640], kind: 'A' },
    { id: 'lechonk', label: 'Lechonk', box: [1574, 692, 1824, 942], today: [1670, 830, 1920, 1080], kind: 'G' },
    // The corner gags end at y 942, above the Pride badge: a persistent
    // widget owns its corner (Rotom, COMP-2, 2026-10-28). Clippy at 90%,73%
    { id: 'clippy', label: 'Clippy', box: [1589, 642, 1867, 935], today: [1589, 782, 1867, 1075], kind: 'G', read: true },
    { id: 'horse', label: 'Horse', box: [0, 600, 258, 1080], kind: 'G' },
    { id: 'compliment', label: 'Compliment', box: [200, 200, 776, 524], kind: 'G' },
    { id: 'ban', label: 'Ban', box: [760, 120, 1160, 520], kind: 'G' },
    { id: 'exobot', label: 'Exobot TTS', box: [70, 788, 436, 994], today: [450, 874, 816, 1080], kind: 'G' },
    { id: 'iphone', label: 'iPhone notification', box: [1332, 714, 1824, 942], today: [1428, 852, 1920, 1080], kind: 'G', read: true },
    { id: 'nut', label: 'Nut bucket', box: [92, 80, 408, 257], kind: 'G' },
    // Life points as drawn after fix 9 (Rotom measured Defiant's frame, 2026-10-28)
    { id: 'life', label: 'Life points', box: [1312, 622, 1737, 942], today: [1336, 700, 2012, 1080], kind: 'G', read: true },
    { id: 'pixelStart', label: 'Pixel Guess (Starting)', box: [1223, 140, 1920, 654], today: [1223, 0, 1920, 514], kind: 'G', read: true },
    { id: 'pixelFull', label: 'Pixel Guess (Full 16:9)', box: [1366, 140, 1920, 567], today: [1366, 0, 1920, 427], kind: 'G', read: true },
    { id: 'lizard', label: 'Lizard', box: [237, 920, 330, 1000], kind: 'G' },
    // Camera presets (Stream Deck and scene filters): AJ's face lives here
    { id: 'camBL', label: 'Cam BL', box: [0, 462, 804, 1080], kind: 'P', face: true },
    { id: 'camBR', label: 'Cam BR', box: [1450, 657, 1906, 1055], kind: 'P', face: true },
    { id: 'camMR', label: 'Cam MR', box: [1450, 357, 1906, 755], kind: 'P', face: true }
];

/**
 * Rotom's pairs that can be on screen together and overlap. `exclusive`
 * groups never show together. `enforce`: design review gated these as rule
 * fixes, so the unit test holds them to KNOWN_OVERLAPS (2026-10-28).
 */
export const PAIRS = [
    { name: 'hype-train', enforce: true, title: 'Hype train with the goal bar, now playing, toast and remote', ids: ['hype', 'goal', 'nowPlaying', 'waveform', 'toast', 'remote'] },
    // The bottom-right corner takes one gag at a time (Rotom's step 4)
    { name: 'ad-break', enforce: true, title: 'Ad banner with Discord, Exobot and the bottom-right gags', ids: ['ad', 'discord', 'exobot', 'pride', 'lechonk', 'clippy', 'iphone'], exclusive: [['lechonk', 'clippy', 'iphone']] },
    { name: 'pig-chat', title: 'Discoball pig behind chat', ids: ['pig', 'chat', 'nowPlaying', 'waveform', 'goal'] },
    { name: 'chat-gags', title: 'Chat with the Nut bucket and the Compliment', ids: ['chat', 'nut', 'compliment', 'nowPlaying'] },
    { name: 'bottom-right', enforce: true, title: 'Bottom-right corner: Pride badge, Lechonk, Clippy, iPhone, Life points, Cam BR', ids: ['pride', 'lechonk', 'clippy', 'iphone', 'life', 'camBR'], exclusive: [['lechonk', 'clippy', 'iphone', 'life']] },
    { name: 'toast-lane', enforce: true, title: 'Remote avatar and jail under the toast lane', ids: ['toast', 'remote', 'jail', 'goal'] },
    { name: 'cameras', title: 'Cam BL with chat, Exobot and Discord; Cam MR with the sidebar and MIU avatars', ids: ['camBL', 'chat', 'exobot', 'discord', 'camMR', 'sidebar', 'shoutout', 'resub', 'hug'] },
    { name: 'pixel-guess', title: 'Pixel Guess with the toast and the MIU avatars', ids: ['pixelStart', 'pixelFull', 'toast', 'shoutout', 'resub'] }
];

const byId = new Map(ELEMENTS.map(e => [e.id, e]));

/** Elements for a list of ids, in the fixed layout or `today`'s; throws on an unknown id. */
export function elementsFor(ids, { today = false } = {}) {
    return ids.map(id => {
        const e = byId.get(id);
        if (!e) throw new Error(`Unknown composition element: ${id}`);
        return today && e.today ? { ...e, box: e.today } : e;
    });
}

/** Overlap of two [x0, y0, x1, y1] boxes, or null. */
export function intersect(a, b) {
    const x0 = Math.max(a[0], b[0]);
    const y0 = Math.max(a[1], b[1]);
    const x1 = Math.min(a[2], b[2]);
    const y1 = Math.min(a[3], b[3]);
    return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : null;
}

/**
 * Overlaps that matter in one frame: a readable element or a camera (AJ's
 * face) under or over anything else. Two decorative layers crossing don't
 * count, and neither do two elements of one `exclusive` group.
 */
export function overlaps(elements, exclusive = []) {
    const apart = (a, b) => exclusive.some(g => g.includes(a.id) && g.includes(b.id));
    const out = [];
    for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
            const a = elements[i];
            const b = elements[j];
            if (!(a.read || b.read || a.face || b.face)) continue;
            if (a.face && b.face) continue;
            if (apart(a, b)) continue;
            const box = intersect(a.box, b.box);
            if (box) out.push({ a: a.id, b: b.id, box, area: (box[2] - box[0]) * (box[3] - box[1]) });
        }
    }
    return out.sort((p, q) => q.area - p.area);
}

/**
 * Placement breaks for readable elements: past the frame edge, or into
 * Twitch's player controls (SAFE-3, design.playerChromeTop).
 */
export function placementBreaks(elements, design, width = design.canvas.width, height = design.canvas.height) {
    const chrome = design.playerChromeTop * height;
    const out = [];
    for (const e of elements.filter(el => el.read)) {
        const [x0, y0, x1, y1] = e.box;
        if (x0 < 0 || y0 < 0 || x1 > width || y1 > height) out.push({ id: e.id, rule: 'off frame', detail: `${e.label} runs past the frame edge` });
        if (y1 > chrome + 0.5) out.push({ id: e.id, rule: 'SAFE-3', detail: `${e.label} reaches y ${y1}, under the player controls from y ${Math.round(chrome)}` });
    }
    return out;
}

/**
 * What the enforced pairs still overlap after Defiant's fixes (QA and
 * Rotom, 2026-10-28; steps 7 and 8 moved the Pride badge and Exobot). The unit test fails on anything new, and on an
 * entry that no longer happens, so this list only ever shrinks on purpose.
 */
export const KNOWN_OVERLAPS = [
    'hype-train: goal x waveform',         // Accepted: the waveform draws under the bar's plate (Rotom on #79)
    'hype-train: nowPlaying x waveform',   // One info box: the song line sits on its own waveform
    // Accepted: AJ put the banner in the toast's own place (#86, 2026-10-28);
    // the toast sits above it in OBS and plays over it, then the banner shows again
    'hype-train: hype x toast',
    // Accepted, report only: AJ fires Cam BR by hand from the Stream Deck,
    // so a gag can land on it for 3-10 s (Rotom, 2026-10-28)
    'bottom-right: life x camBR',
    'bottom-right: iphone x camBR',
    'bottom-right: clippy x camBR',
    'bottom-right: lechonk x camBR',
    'bottom-right: pride x camBR'
];

/** One pair's overlaps and breaks as stable keys, e.g. 'ad-break: discord x exobot'. */
export function pairFindings(pair) {
    const els = elementsFor(pair.ids);
    return [
        ...overlaps(els, pair.exclusive).map(h => `${pair.name}: ${h.a} x ${h.b}`),
        ...placementBreaks(els, DESIGN).map(b => `${pair.name}: ${b.id} ${b.rule}`)
    ];
}
