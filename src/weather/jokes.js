// Comedy for the crawl (AJ, 2026-11-11: "the ticker should include comedy and
// jokes"). One joke follows each region's conditions, taking turns through
// the list, so a pass of the crawl reads weather, joke, weather, joke.
// Upper case like the rest of the crawl; keep each under about 110
// characters so one fits the strip comfortably.

export const JOKES = [
    "TODAY'S FORECAST: WEATHER. TOMORROW: MORE WEATHER. DETAILS AT 11.",
    'THE NATIONAL WEATHER SERVICE REMINDS YOU THAT THE SKY IS STILL UP THERE.',
    'METEOROLOGISTS CONFIRM CLOUDS ARE "MOSTLY WATER, PARTLY VIBES."',
    'DOPPLER RADAR DETECTS A 40% CHANCE OF SOMEONE ASKING "IS IT GOING TO RAIN?"',
    'LOCAL MAN BLAMES WEATHER FOR EVERYTHING. EXPERTS: "FAIR."',
    'WIND CONTINUES TO BE INVISIBLE. INVESTIGATION ONGOING.',
    'EXO-CAST ALERT: CHAT VISIBILITY DOWN TO ZERO IN DENSE EMOTE FOG.',
    'HYPE TRAIN DELAYS EXPECTED ON ALL LINES. PLEASE STAND CLEAR OF THE DOORS.',
    'SPHEAL MIGRATION SEASON HAS BEGUN. DO NOT FEED THE SPHEAL.',
    'BRB CONDITIONS PERSIST. STREAMER EXPECTED BACK SHORTLY, ACCORDING TO STREAMER.',
    'BULLETIN: AREA CLOUD LOOKS LIKE A DOG. RESIDENTS URGED TO LOOK UP.',
    'SEVERE SNACK WATCH IN EFFECT UNTIL FURTHER NOTICE.',
    'THE SUN WILL RISE TOMORROW. THIS HAS BEEN A TEST OF THE EMERGENCY BROADCAST SYSTEM.',
    'FROST ADVISORY FOR YOUR EX\'S TEXTS. BUNDLE UP.',
    'A HIGH PRESSURE SYSTEM IS MOVING IN. IT IS YOUR MANAGER.'
];

/**
 * The joke after a given crawl item, taking turns through the list.
 * @param {number} n - Running count of jokes shown so far
 * @returns {string}
 */
export function jokeAt(n) {
    return JOKES[((n % JOKES.length) + JOKES.length) % JOKES.length];
}
