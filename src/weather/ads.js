// Joke ads for the break between regions (AJ, 2026-11-11: "there needs to be
// interstitial ads between regions, the ads should be jokes or not serious,
// they can be videos or just text and an image with default text
// formatting", then "for like fake business, not necessarily weather
// themed", "in the style of SNL or the onion", and "the ads need like
// prices or services advertised"). A cheap local spot: plain Times on a flat
// colour, clip art, a price list, a starburst deal, a phone number and fine
// print. Every business here is made up, and every number is a fictional
// 555-01xx.
// Video ads are URLs in config.weather.ads.videos, played muted over the card.

/**
 * @typedef {Object} Ad
 * @property {string} name - Business name, the headline
 * @property {string} tagline - The pitch, one or two lines
 * @property {Array<[string, string]>} items - What's for sale: [service, price]
 * @property {string[]} deal - The starburst, one or two short lines
 * @property {string} call - Phone and where, the bottom line (555-01xx numbers are fictional by design)
 * @property {string} fine - Fine print
 * @property {string} art - Picture: mattress, perfume, car, tape, pizza, tooth, form, tag, mug
 * @property {string} bg - Card colour
 */

// AJ (2026-11-11): "The ads need like prices or services advertised, these
// are just one liners". Each spot now sells something: a price list, a
// starburst deal and a phone number, with the joke in the details.
/** @type {Ad[]} */
export const ADS = [
    {
        name: "GARY'S DISCOUNT MATTRESS BARN",
        tagline: "Gary has been asleep since 1987. Come see what he's lying on.",
        items: [['Twin, gently slept on', '$49'], ['Queen, "barely" used', '$89'], ['Box spring with a secret', '$15'], ["King (Gary's)", 'NOT FOR SALE']],
        deal: ['NO MONEY', 'DOWN!'],
        call: 'CALL 555-0187 · ROUTE 9, NEXT TO THE OTHER BARN',
        fine: 'Barn may contain Gary. Do not wake Gary.',
        art: 'mattress',
        bg: '#f4eecb'
    },
    {
        name: 'CONFUSION',
        tagline: 'The new fragrance for the man who walked into a room and forgot why.',
        items: [['Eau de Confusion, 1 oz.', '$29.99'], ['Gift set with your keys (lost)', '$44.99'], ['Travel size (also lost)', '$9.99'], ['Body spray, for... someone', '$12.99']],
        deal: ['NOW', '$29.99'],
        call: 'AT FINER DEPARTMENT STORES, PROBABLY',
        fine: 'Do not spray near memories.',
        art: 'perfume',
        bg: '#efe2f2'
    },
    {
        name: "BIG SAL'S PRE-LOVED AUTOS",
        tagline: 'Every car driven by a grandmother. Several grandmothers. At once.',
        items: [["'89 sedan, one door", '$1,200'], ['Minivan, smells like soup', '$2,400'], ['Convertible (roof stolen)', '$900'], ['Air freshener with any car', 'FREE']],
        deal: ['$0', 'DOWN*'],
        call: "CALL 555-0123 · SAL'S LOT, HIGHWAY 61",
        fine: '*Sal is legally not allowed to say "mint condition."',
        art: 'car',
        bg: '#dfe9f7'
    },
    {
        name: 'REWIND CITY VIDEO',
        tagline: 'Area video store still open, owner "fine with it."',
        items: [['New releases (from 1994)', '$3.99'], ["Kids' tapes, mostly rewound", '99¢'], ['Board games, back room', '$1.50'], ['Late fee forgiveness', '$40.00']],
        deal: ['2 FOR', '$5!'],
        call: 'OPEN TIL 9, OR WHEN DOUG LEAVES · 555-0142',
        fine: 'Late fees are emotional, not financial.',
        art: 'tape',
        bg: '#e9e4f6'
    },
    {
        name: 'MOM & POP PIZZA PALACE',
        tagline: 'Mom and Pop are no longer speaking. The pizza is still very good.',
        items: [["Large cheese (Mom's)", '$8.99'], ["Large pepperoni (Pop's)", '$9.99'], ['Half and half, eaten in silence', '$10.99'], ['Garlic knots of tension', '$3.49']],
        deal: ['2 LARGE', '$15.99'],
        call: 'CALL 555-0164 · WE DELIVER. SEPARATELY.',
        fine: 'Please do not ask about Pop.',
        art: 'pizza',
        bg: '#f6e0d2'
    },
    {
        name: 'CRESTVIEW FAMILY DENTAL',
        tagline: 'Nine out of ten dentists recommend us. The tenth one works here.',
        items: [['Cleaning and x-rays', '$59'], ['Whitening (some teeth)', '$99'], ['Root canal, cheerful', '$249'], ['Lollipop on the way out', 'FREE']],
        deal: ['CHECKUP', '$29'],
        call: 'CALL 555-0110 · NOW ACCEPTING MOST TEETH',
        fine: 'Smiling is mandatory for the duration of your visit.',
        art: 'tooth',
        bg: '#e4efe0'
    },
    {
        name: "TONY'S TAXIDERMY & TAX PREP",
        tagline: 'We stuff deer. We also stuff returns.',
        items: [['Short form 1040', '$35'], ['Mounted bass, any mood', '$60'], ['Itemized deductions', '$85'], ['Squirrel, any pose', '$40']],
        deal: ['COMBO', '$89'],
        call: 'CALL 555-0199 · ASK FOR TONY. EITHER TONY.',
        fine: 'Not a licensed accountant. Barely a licensed taxidermist.',
        art: 'form',
        bg: '#f7f0c6'
    },
    {
        name: 'HUGE GARAGE SALE THIS SATURDAY',
        tagline: 'Local man selling everything, including feelings.',
        items: [['Exercise bike, never used', '25¢'], ['Box of cables (all of them)', '$1'], ["Ex-wife's bread maker", '50¢'], ['Feelings, assorted', 'MAKE OFFER']],
        deal: ['SAT', '7 AM'],
        call: '1440 ELM STREET · PARK ON THE LAWN, IT IS FINE',
        fine: 'Feelings sold as is. Cash only. Do not haggle with Dennis.',
        art: 'tag',
        bg: '#f3e6cf'
    },
    {
        name: 'THE BEAN SCENE',
        tagline: 'Coffee so strong it has opinions about you.',
        items: [['House blend, judgmental', '$1.25'], ['Espresso, disappointed in you', '$1.75'], ["Decaf (we'll allow it)", '$3.50'], ['Muffin of the day', '$1.99']],
        deal: ['REFILLS', '$2'],
        call: 'CORNER OF MAIN & 3RD · OPEN 6 AM',
        fine: 'Decaf available on request and judgement.',
        art: 'mug',
        bg: '#eadfd2'
    }
];

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
    if (art === 'mattress') {
        shape('#8a5a33', () => c.rect(10, 70, 6, 14));
        shape('#8a5a33', () => c.rect(84, 70, 6, 14));
        shape('#f7f7ff', () => c.roundRect(6, 46, 88, 26, 8));
        c.beginPath();
        for (let x = 20; x < 90; x += 14) { c.moveTo(x, 52); c.lineTo(x, 66); }
        c.strokeStyle = '#9db0d8';
        c.stroke();
        c.strokeStyle = OUTLINE;
        shape('#ffffff', () => c.roundRect(12, 34, 30, 16, 6));
    } else if (art === 'car') {
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
    } else if (art === 'tooth') {
        shape('#ffffff', () => {
            c.moveTo(24, 22);
            c.bezierCurveTo(30, 6, 44, 14, 50, 18);
            c.bezierCurveTo(56, 14, 70, 6, 76, 22);
            c.bezierCurveTo(82, 40, 72, 52, 70, 64);
            c.bezierCurveTo(68, 80, 64, 92, 58, 90);
            c.bezierCurveTo(54, 88, 54, 66, 50, 66);
            c.bezierCurveTo(46, 66, 46, 88, 42, 90);
            c.bezierCurveTo(36, 92, 32, 80, 30, 64);
            c.bezierCurveTo(28, 52, 18, 40, 24, 22);
            c.closePath();
        });
        c.beginPath();
        c.arc(42, 38, 2.5, 0, Math.PI * 2);
        c.arc(58, 38, 2.5, 0, Math.PI * 2);
        c.fillStyle = OUTLINE;
        c.fill();
        c.beginPath();
        c.arc(50, 44, 8, 0.15 * Math.PI, 0.85 * Math.PI);
        c.stroke();
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
    } else if (art === 'tag') {
        shape('#f5d36b', () => { c.moveTo(30, 14); c.lineTo(86, 14); c.lineTo(86, 70); c.lineTo(30, 70); c.lineTo(10, 42); c.closePath(); });
        disc('#ffffff', 24, 42, 5);
        c.beginPath();
        c.moveTo(19, 42);
        c.bezierCurveTo(4, 50, 8, 80, 30, 90);
        c.stroke();
        c.fillStyle = OUTLINE;
        c.font = 'bold 22px "Times New Roman", Times, serif';
        c.textAlign = 'center';
        c.fillText('25¢', 58, 50, 44);
    } else if (art === 'mug') {
        shape('#f2f2f2', () => {
            c.moveTo(70, 40);
            c.bezierCurveTo(92, 40, 92, 72, 70, 72);
            c.lineTo(70, 64);
            c.bezierCurveTo(82, 64, 82, 48, 70, 48);
            c.closePath();
        });
        shape('#ffffff', () => c.roundRect(20, 30, 54, 62, 6));
        shape('#5a3a22', () => c.ellipse(47, 32, 25, 5, 0, 0, Math.PI * 2));
        c.beginPath();
        for (const x of [36, 48, 60]) { c.moveTo(x, 22); c.bezierCurveTo(x - 6, 14, x + 6, 10, x, 2); }
        c.strokeStyle = '#9a9a9a';
        c.stroke();
    }
    c.restore();
}

/**
 * A starburst price flash, the local-ad staple: a red-orange star with a
 * dark outline, centred on (cx, cy), radius r. The text goes on top.
 * @param {CanvasRenderingContext2D} c
 */
export function drawStarburst(c, cx, cy, r) {
    c.save();
    c.beginPath();
    const points = 18;
    for (let i = 0; i < points * 2; i++) {
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? r * 0.8 : r;
        c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.closePath();
    c.fillStyle = '#e8401a';
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = OUTLINE;
    c.stroke();
    c.restore();
}
