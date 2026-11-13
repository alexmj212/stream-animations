// Joke ads for the break between regions (AJ, 2026-11-11: "there needs to be
// interstitial ads between regions, the ads should be jokes or not serious",
// "for like fake business", "in the style of SNL or the onion", "the ads need
// like prices or services advertised"). Reworked the same day after a
// head-writer review of the set ("variety, variation in all aspects") and
// AJ's "ads that are themed to aspects of my channel ... pups or furries or
// gay bears, or 90s decorating": each ad is a real 90s local-break format
// (adLayouts.js), consecutive breaks never repeat a format or colour family,
// and every card stays near 45 words for the 10 s hold. Every business is
// made up and every number is a fictional 555-01xx. Stream-safe: playful,
// never explicit. The channel ads joke from inside the culture (AJ,
// 2026-11-12: the bear ad should be "mocking stereotypes or poking fun of
// that culture, I'm in it"), and Exo, AJ's name on stream, fronts the
// renovation ad (a nod to Decorating Cents, the Sunday watch-along).
// Video ads are URLs in config.weather.ads.videos.

/**
 * @typedef {Object} Ad
 * @property {string} name - Business name, the headline
 * @property {string} layout - shout, coupon, menu, luxe, spokes, bulletin, classified or infomercial (adLayouts.js)
 * @property {string} art - Clip art key (drawAdArt)
 * @property {Object} colors - Per-layout colours
 * @property {string} fine - Fine print
 * The other fields depend on the layout: see adLayouts.js.
 */

/** @type {Ad[]} */
export const ADS = [
    {
        name: "BIG SAL'S PRE-LOVED AUTOS",
        layout: 'shout',
        colors: { a: '#d32020', b: '#ff3b2f', head: '#ffe14d', burst: '#ffe14d', burstInk: '#1a1a1a' },
        banner: 'EVERY CAR DRIVEN BY SEVERAL GRANDMOTHERS AT ONCE!',
        rows: [["'89 SEDAN, ONE DOOR", '$1,200'], ['CONVERTIBLE (ROOF STOLEN)', '$900']],
        deal: ['$0', 'DOWN*'],
        call: '555-0123 · HIGHWAY 61',
        fine: '*Sal is legally not allowed to say "mint condition."',
        art: 'car'
    },
    {
        name: 'Confusion',
        layout: 'luxe',
        line: 'For the man who walked into a room and forgot why.',
        price: '$29.99 the ounce',
        call: 'AT FINER DEPARTMENT STORES, PROBABLY',
        fine: 'Side effects may include standing in doorways.',
        art: 'perfume'
    },
    {
        name: 'GOOD BOY GOODS',
        layout: 'bulletin',
        colors: { a: '#1a3fb0' },
        title: 'COMMUNITY BULLETIN BOARD',
        tag: 'ITEM 4 OF 31',
        heading: 'PUP SUPPLY CO. · NOW OPEN',
        rows: [['Neoprene hood, new-pup smell', '$60'], ['Knee pads, for the pup mosh', '$15'], ['Handler, gently used', 'ASK']],
        call: 'RING THE BELL. WE WILL ALL BARK.',
        fine: 'Being in headspace does not get you out of your shift.',
        art: 'pup'
    },
    {
        name: 'MOM & POP PIZZA PALACE',
        layout: 'coupon',
        pattern: 'checker',
        colors: { p1: '#2e7d32', p2: '#f4efe0', coupon: '#fffaf0', name: '#b3261e' },
        sub: 'Mom and Pop are no longer speaking. The pizza is still great.',
        deal: '$15.99',
        detail: ['TWO LARGES, ONE FROM EACH OF THEM'],
        stamp: 'SAVE $4',
        call: '555-0164 · WE DELIVER. SEPARATELY.',
        fine: 'Please do not ask about Pop.',
        art: 'pizza'
    },
    {
        name: "BIG RON'S BEAR BAIL BONDS",
        layout: 'spokes',
        colors: { a: '#0d1b2a', b: '#1f3d63', portrait: '#c9d6e8' },
        plate: 'BIG RON',
        title: 'Bondsman. Bear. Daddy.',
        question: 'HAVE YOU BEEN:',
        checklist: [['Timed out for typing "woof"', true], ['Sent to horny jail', true], ['Actually innocent', false]],
        fee: ['BAIL FROM $5', 'BEAR HUG ON RELEASE, NON-NEGOTIABLE'],
        call: '555-0148 · OUT OF CHAT JAIL TONIGHT',
        fine: 'Ron is not a licensed bondsman. Ron is just very large and supportive.',
        art: 'bear'
    },
    {
        name: 'THE RE-PEELER(TM)',
        layout: 'infomercial',
        sub: "Peeled a banana too early? We've all been there.",
        lead: 'Only 3 easy payments of',
        price: '$19.99',
        wait: ['BUT WAIT!', 'Second one FREE, for your other banana.'],
        call: 'CALL 555-0150 NOW',
        fine: 'Operators are standing by. One is sitting.',
        art: 'banana'
    },
    {
        name: 'THE FLUFF HUT',
        layout: 'menu',
        board: 'chalk',
        colors: { head: '#ff9ec7', ink: '#f3eefa', burst: '#ff9ec7', burstInk: '#1a1a1a' },
        tagline: 'Fursuit dry cleaning. We have smelled what you did at the con.',
        items: [['Head, post-con exorcism', '$40'], ['Tail, re-floof after the dance', '$15'], ['Body, energy drink extraction', '$60']],
        deal: ['SAME DAY', 'FLOOF!'],
        call: '555-0172 · DROP-OFF AROUND BACK. HOLD YOUR BREATH.',
        fine: 'Not responsible for glitter. Nobody is.',
        art: 'paw'
    },
    {
        name: "EXO'S HOME RENOVATIONS",
        layout: 'shout',
        colors: { a: '#1f4d33', b: '#2f6b45', head: '#f7c6d9', outline: '#2a0f1a', burst: '#9e6b7c', burstInk: '#ffffff' },
        banner: 'DECORATING CENTS ON A DOLLAR-STORE BUDGET!',
        rows: [['WHOLE ROOM MADE OVER', '$0.47'], ['ONE (1) THROW PILLOW', '$900'], ['GOOD TASTE', 'N/A']],
        deal: ['UNDER', 'BUDGET!*'],
        call: '555-0193 · SUNDAYS, RIGHT HERE',
        fine: '*Budget does not include pillows. Nothing includes pillows.',
        art: 'roller'
    },
    {
        name: 'REWIND CITY VIDEO',
        layout: 'classified',
        bar: 'HELP WANTED',
        body: "Must rewind. Must have opinions about movies. Must not be Doug's nephew again.",
        wage: '$4.25/HR + ALL THE POPCORN THAT FELL',
        contact: ['APPLY BEFORE 9, OR WHEN DOUG LEAVES', '555-0142'],
        fine: 'Late fees are emotional, not financial.',
        art: 'tape'
    },
    {
        name: 'THE DEN',
        layout: 'coupon',
        pattern: 'plaid',
        colors: { p1: '#8e1b1b', p2: '#1a1a1a', coupon: '#fbf6ea', name: '#5a2a12', stamp: '#8e1b1b' },
        sub: 'Flannel for bears who have never once chopped wood.',
        deal: 'BOGO',
        detail: ['BUY ONE FLANNEL,', 'GET ONE FOR YOUR OTTER'],
        conditions: 'Sizes: Cub, Bear, Daddy, and "It Stretches."',
        stamp: 'WOOF!',
        call: '555-0166 · NEXT TO THE BEARD OIL BAR',
        fine: 'No manscaping on the premises. Chasers wait outside.',
        art: 'flannel'
    },
    {
        name: "MADAME ORLA'S PSYCHIC LINE",
        layout: 'spokes',
        colors: { a: '#06302e', b: '#0f5c57', portrait: '#123f3c' },
        plate: 'MADAME ORLA',
        title: 'Psychic since tomorrow',
        question: 'LET ORLA SEE YOUR:',
        checklist: [['Future', true], ['Love life', true], ['Lottery numbers (nice try)', false], ['Lost cat: under the porch', true]],
        fee: ['$0.99 THE FIRST MINUTE', '$4.99 EVERY MINUTE AFTER'],
        call: '555-0177 · SHE KNEW YOU WOULD',
        fine: 'For entertainment only. Orla already knows that.',
        art: 'crystal'
    },
    {
        name: "TONY'S TAXIDERMY & TAX PREP",
        layout: 'menu',
        board: 'wood',
        colors: { head: '#ffd23f', ink: '#f3e6c8', burst: '#e8401a', burstInk: '#ffffff' },
        tagline: 'We stuff deer. We also stuff returns.',
        items: [['Short form 1040', '$35'], ['Mounted bass, any mood', '$60'], ['Your audit, stuffed and mounted', '$150']],
        deal: ['COMBO', '$89'],
        call: '555-0199 · ASK FOR TONY. EITHER TONY.',
        fine: 'Not a licensed accountant. Barely a licensed taxidermist.',
        art: 'form'
    }
];

// Cut-out clip art, one per ad (AJ, 2026-11-11: "if we can get some images
// with transparency, that'd be great"; the stock photos before them were
// cropped "in weird way"). CC0 only, credits in photos/CREDITS.md. Each URL
// is a literal so Vite inlines the file; the ad draws its own clip art until
// (or unless) the picture loads. Pictures are drawn whole, never cropped.
const PHOTOS = {
    car: new URL('./photos/car.png', import.meta.url).href,
    perfume: new URL('./photos/perfume.png', import.meta.url).href,
    pup: new URL('./photos/pup.png', import.meta.url).href,
    pizza: new URL('./photos/pizza.png', import.meta.url).href,
    bear: new URL('./photos/bear.png', import.meta.url).href,
    banana: new URL('./photos/banana.png', import.meta.url).href,
    paw: new URL('./photos/paw.png', import.meta.url).href,
    roller: new URL('./photos/roller.png', import.meta.url).href,
    tape: new URL('./photos/tape.png', import.meta.url).href,
    flannel: new URL('./photos/flannel.png', import.meta.url).href,
    crystal: new URL('./photos/crystal.png', import.meta.url).href,
    form: new URL('./photos/form.png', import.meta.url).href
};
for (const ad of ADS) {
    if (PHOTOS[ad.art]) {
        ad.photo = PHOTOS[ad.art];
        ad.photoCutout = true;
    }
}

/**
 * Which ad a break shows: text ads and video ads take turns through both
 * lists, so every ad comes round.
 * @param {number} cycle - How many breaks came before this one
 * @param {number} textCount
 * @param {number} videoCount
 * @returns {{kind: 'text'|'video', index: number}}
 */
export function pickAd(cycle, textCount, videoCount) {
    const total = textCount + videoCount;
    const k = ((cycle % total) + total) % total;
    if (!videoCount) return { kind: 'text', index: k };
    // Spread the videos among the text ads: every other break while both last
    const pairs = Math.min(textCount, videoCount);
    if (k < pairs * 2) return k % 2 ? { kind: 'video', index: (k - 1) / 2 } : { kind: 'text', index: k / 2 };
    return textCount > videoCount ? { kind: 'text', index: k - pairs } : { kind: 'video', index: k - pairs };
}

const OUTLINE = '#1a1a1a';

/**
 * Clip art for an ad, flat colours with a black outline, centred on (cx, cy)
 * in a box `size` wide (drawn on a 100x100 grid).
 * @param {CanvasRenderingContext2D} c
 * @param {string} art
 * @param {number} cx
 * @param {number} cy
 * @param {number} size
 */
export function drawAdArt(c, art, cx, cy, size) {
    const s = size / 100;
    c.save();
    c.translate(cx - size / 2, cy - size / 2);
    c.scale(s, s);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.lineWidth = 3;
    c.strokeStyle = OUTLINE;
    const shape = (fill, draw) => {
        c.beginPath();
        draw();
        c.fillStyle = fill;
        c.fill();
        c.stroke();
    };
    const disc = (fill, x, y, r) => shape(fill, () => c.arc(x, y, r, 0, Math.PI * 2));
    if (art === 'car') {
        shape('#d8343a', () => {
            c.moveTo(6, 70);
            c.lineTo(6, 54);
            c.lineTo(22, 50);
            c.lineTo(34, 34);
            c.lineTo(68, 34);
            c.lineTo(80, 50);
            c.lineTo(94, 54);
            c.lineTo(94, 70);
            c.closePath();
        });
        shape('#bfe3ff', () => { c.moveTo(38, 38); c.lineTo(50, 38); c.lineTo(50, 50); c.lineTo(28, 50); c.closePath(); });
        shape('#bfe3ff', () => { c.moveTo(54, 38); c.lineTo(66, 38); c.lineTo(75, 50); c.lineTo(54, 50); c.closePath(); });
        disc('#333333', 26, 72, 10);
        disc('#333333', 74, 72, 10);
        disc('#cfcfcf', 26, 72, 4);
        disc('#cfcfcf', 74, 72, 4);
    } else if (art === 'pizza') {
        shape('#f2c14e', () => { c.moveTo(50, 92); c.lineTo(12, 18); c.quadraticCurveTo(50, 2, 88, 18); c.closePath(); });
        shape('#c9822b', () => { c.moveTo(12, 18); c.quadraticCurveTo(50, 2, 88, 18); c.lineTo(84, 26); c.quadraticCurveTo(50, 12, 16, 26); c.closePath(); });
        for (const [x, y] of [[40, 38], [60, 40], [50, 60], [44, 74]]) disc('#c8322b', x, y, 6);
    } else if (art === 'tape') {
        shape('#2a2a2a', () => c.roundRect(6, 24, 88, 54, 4));
        shape('#f2f2f2', () => c.rect(16, 30, 68, 16));
        shape('#6b6b6b', () => c.rect(26, 52, 48, 18));
        disc('#ffffff', 36, 61, 6);
        disc('#ffffff', 64, 61, 6);
        c.fillStyle = OUTLINE;
        c.font = 'bold 11px "Times New Roman", Times, serif';
        c.textAlign = 'center';
        c.fillText('PLEASE REWIND', 50, 42, 62);
    } else if (art === 'form') {
        shape('#ffffff', () => { c.moveTo(20, 8); c.lineTo(68, 8); c.lineTo(82, 22); c.lineTo(82, 92); c.lineTo(20, 92); c.closePath(); });
        c.beginPath();
        for (let y = 34; y <= 80; y += 10) { c.moveTo(28, y); c.lineTo(74, y); }
        c.strokeStyle = '#8c8c8c';
        c.stroke();
        c.strokeStyle = OUTLINE;
        c.fillStyle = OUTLINE;
        c.font = 'bold 12px "Times New Roman", Times, serif';
        c.textAlign = 'left';
        c.fillText('FORM 1040-ISH', 26, 26, 50);
        // A pair of antlers stapled to the corner
        c.beginPath();
        c.moveTo(70, 88); c.lineTo(78, 70); c.lineTo(72, 62);
        c.moveTo(78, 70); c.lineTo(88, 62); c.lineTo(86, 52);
        c.moveTo(88, 62); c.lineTo(96, 60);
        c.strokeStyle = '#7a4a22';
        c.lineWidth = 4;
        c.stroke();
    } else if (art === 'perfume') {
        shape('#c9a24a', () => c.rect(42, 14, 16, 14));
        shape('#e7c6f2', () => c.roundRect(20, 28, 60, 62, 14));
        shape('#ffffff', () => c.rect(32, 48, 36, 22));
        c.fillStyle = OUTLINE;
        c.font = 'italic 12px "Times New Roman", Times, serif';
        c.textAlign = 'center';
        c.fillText('Confusion', 50, 63, 32);
        disc('#c9a24a', 50, 10, 6);
    } else if (art === 'bear') {
        // Big Ron: a bear in a suit, aviators on
        shape('#1f2a44', () => { c.moveTo(12, 100); c.lineTo(22, 76); c.lineTo(78, 76); c.lineTo(88, 100); c.closePath(); });
        shape('#ffffff', () => { c.moveTo(42, 76); c.lineTo(50, 92); c.lineTo(58, 76); c.closePath(); });
        shape('#c62828', () => { c.moveTo(47, 78); c.lineTo(53, 78); c.lineTo(55, 92); c.lineTo(50, 98); c.lineTo(45, 92); c.closePath(); });
        disc('#7a4a26', 28, 22, 10);
        disc('#7a4a26', 72, 22, 10);
        disc('#7a4a26', 50, 46, 28);
        shape('#c9945e', () => c.ellipse(50, 58, 15, 11, 0, 0, Math.PI * 2));
        disc('#1a1a1a', 50, 52, 4);
        c.fillStyle = '#1a1a1a';
        c.fillRect(32, 36, 15, 9);
        c.fillRect(53, 36, 15, 9);
        c.fillRect(46, 38, 8, 3);
    } else if (art === 'pup') {
        // A pup's head, tongue out, tag on the collar
        shape('#8a5a33', () => c.ellipse(24, 40, 12, 24, 0.35, 0, Math.PI * 2));
        shape('#8a5a33', () => c.ellipse(76, 40, 12, 24, -0.35, 0, Math.PI * 2));
        disc('#d9a066', 50, 50, 30);
        shape('#f3e3c8', () => c.ellipse(50, 64, 16, 12, 0, 0, Math.PI * 2));
        disc('#1a1a1a', 50, 56, 5);
        disc('#1a1a1a', 39, 44, 3.5);
        disc('#1a1a1a', 61, 44, 3.5);
        shape('#ff7aa2', () => c.ellipse(54, 76, 5, 8, 0, 0, Math.PI * 2));
        shape('#c62828', () => c.rect(28, 84, 44, 7));
        disc('#ffd23f', 50, 94, 5);
    } else if (art === 'paw') {
        // A paw print, pink beans on cream
        disc('#f7c6d9', 50, 64, 22);
        disc('#f7c6d9', 22, 40, 10);
        disc('#f7c6d9', 38, 24, 10);
        disc('#f7c6d9', 62, 24, 10);
        disc('#f7c6d9', 78, 40, 10);
        c.fillStyle = '#ffffff';
        for (const [x, y] of [[60, 34], [34, 60], [72, 66]]) { c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); }
    } else if (art === 'flannel') {
        // A red plaid flannel shirt
        const body = () => { c.moveTo(30, 12); c.lineTo(10, 26); c.lineTo(16, 44); c.lineTo(26, 40); c.lineTo(26, 92); c.lineTo(74, 92); c.lineTo(74, 40); c.lineTo(84, 44); c.lineTo(90, 26); c.lineTo(70, 12); c.lineTo(58, 18); c.lineTo(42, 18); c.closePath(); };
        shape('#b3261e', body);
        c.save();
        c.beginPath();
        body();
        c.clip();
        c.fillStyle = 'hsla(0, 0%, 0%, 0.35)';
        for (let x = 6; x < 96; x += 16) c.fillRect(x, 0, 6, 100);
        for (let y = 10; y < 96; y += 16) c.fillRect(0, y, 100, 6);
        c.restore();
        c.beginPath();
        body();
        c.stroke();
        c.beginPath();
        c.moveTo(50, 20);
        c.lineTo(50, 92);
        c.stroke();
        for (const y of [32, 50, 68, 84]) disc('#f3e6c8', 50, y, 2.5);
    } else if (art === 'roller') {
        // A paint roller mid-stroke: hunter green over mauve
        shape('#9e6b7c', () => c.rect(8, 8, 58, 40));
        shape('#2f5d3a', () => c.rect(8, 14, 58, 24));
        shape('#2f5d3a', () => c.roundRect(14, 8, 52, 30, 8));
        c.beginPath();
        c.moveTo(66, 23);
        c.lineTo(80, 23);
        c.lineTo(80, 50);
        c.lineTo(52, 54);
        c.lineTo(52, 70);
        c.lineWidth = 5;
        c.stroke();
        c.lineWidth = 3;
        shape('#d8c38a', () => c.roundRect(45, 68, 14, 28, 5));
    } else if (art === 'crystal') {
        shape('#c9a24a', () => { c.moveTo(28, 92); c.lineTo(36, 76); c.lineTo(64, 76); c.lineTo(72, 92); c.closePath(); });
        const g = c.createRadialGradient(42, 34, 4, 50, 46, 36);
        g.addColorStop(0, '#d8fff6');
        g.addColorStop(1, '#2aa198');
        disc(g, 50, 46, 32);
        c.fillStyle = 'hsla(0, 0%, 100%, 0.8)';
        c.beginPath();
        c.ellipse(40, 32, 8, 5, -0.5, 0, Math.PI * 2);
        c.fill();
    } else if (art === 'banana') {
        // A banana with a zipper: the Re-Peeler's patient
        const curve = () => { c.moveTo(14, 58); c.quadraticCurveTo(48, 104, 88, 26); c.quadraticCurveTo(52, 76, 14, 58); };
        shape('#f5d33d', curve);
        shape('#6b4a2a', () => c.rect(84, 18, 8, 10));
        c.strokeStyle = '#8c8c8c';
        c.lineWidth = 2.5;
        for (let k = 1; k < 9; k++) {
            const t = 0.12 + k * 0.085;
            const x = (1 - t) ** 2 * 14 + 2 * (1 - t) * t * 50 + t * t * 88;
            const y = (1 - t) ** 2 * 58 + 2 * (1 - t) * t * 90 + t * t * 26;
            c.beginPath();
            c.moveTo(x - 2.5, y - 3);
            c.lineTo(x + 2.5, y + 3);
            c.stroke();
        }
        c.strokeStyle = OUTLINE;
        c.lineWidth = 3;
        shape('#8c8c8c', () => c.roundRect(10, 54, 8, 12, 2));
    }
    c.restore();
}

/**
 * A starburst price flash, the local-ad staple: a red-orange star with a
 * dark outline, centred on (cx, cy), radius r. The text goes on top.
 * @param {CanvasRenderingContext2D} c
 */
export function drawStarburst(c, cx, cy, r, fill = '#e8401a') {
    c.save();
    c.beginPath();
    const points = 18;
    for (let i = 0; i < points * 2; i++) {
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? r * 0.8 : r;
        c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = OUTLINE;
    c.stroke();
    c.restore();
}
