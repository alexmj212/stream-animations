/**
 * The weather page's regions (AJ, 2026-11-10). Every town is made up, so no
 * one mistakes a generated forecast for a real one (Rotom, 2026-11-10).
 * Climates are borrowed from real places so the numbers feel right:
 * `norm` is [January high, January low, July high, July low] in °F, from the
 * real city named in each comment. `lat`/`lon` place the home town (first in
 * the list) for sunrise and sunset; `tz` is its standard UTC offset in hours
 * and `dst` whether it keeps US daylight saving time.
 */
export const REGIONS = [
    {
        name: 'NORTHERN LAKES', lat: 44.98, lon: -93.27, tz: -6, dst: true, wet: 0.42,
        towns: [
            { name: 'LAKE VERITY', norm: [22, 5, 83, 64] },       // Minneapolis
            { name: 'HARROW BAY', norm: [19, 1, 77, 56] },        // Duluth
            { name: 'NORTH KESTREL', norm: [17, -1, 82, 59] },    // Fargo
            { name: 'PINE HOLLOW', norm: [27, 11, 82, 62] },      // Madison
            { name: 'CALDER FALLS', norm: [26, 5, 86, 63] },      // Sioux Falls
            { name: 'GRAYMOOR', norm: [26, 8, 85, 64] },          // La Crosse
            { name: 'TAMSIN CITY', norm: [31, 14, 86, 67] }       // Des Moines
        ]
    },
    {
        name: 'ATLANTIC COAST', lat: 42.36, lon: -71.06, tz: -5, dst: true, wet: 0.46,
        towns: [
            { name: 'PORT ALDEN', norm: [37, 23, 82, 66] },       // Boston
            { name: 'WEXLEY', norm: [35, 18, 85, 63] },           // Hartford
            { name: 'MARROW COVE', norm: [37, 21, 83, 64] },      // Providence
            { name: 'SALTON HEIGHTS', norm: [31, 14, 83, 61] },   // Albany
            { name: 'BRIARCLIFF', norm: [31, 13, 79, 59] },       // Portland ME
            { name: 'EAST HALLOWAY', norm: [28, 11, 81, 61] },    // Burlington
            { name: 'CAPE ORIEL', norm: [32, 17, 79, 61] }        // Worcester
        ]
    },
    {
        name: 'PIEDMONT', lat: 33.75, lon: -84.39, tz: -5, dst: true, wet: 0.45,
        towns: [
            { name: 'MAGNOLIA PARK', norm: [53, 35, 90, 72] },    // Atlanta
            { name: 'RED CLAY', norm: [50, 31, 90, 69] },         // Chattanooga
            { name: 'BELLHAVEN', norm: [51, 31, 90, 70] },        // Charlotte
            { name: 'SUMMIT RIDGE', norm: [56, 34, 93, 72] },     // Columbia
            { name: 'OAKVALE', norm: [57, 35, 93, 71] },          // Macon
            { name: 'CASSWELL', norm: [57, 34, 93, 71] },         // Augusta
            { name: 'TIDEWATER', norm: [61, 39, 92, 73] }         // Savannah
        ]
    },
    {
        name: 'HIGH PLAINS', lat: 35.47, lon: -97.52, tz: -6, dst: true, wet: 0.34,
        towns: [
            { name: 'PRAIRIE STAR', norm: [49, 28, 94, 72] },     // Oklahoma City
            { name: 'DUST HOLLOW', norm: [50, 24, 91, 66] },      // Amarillo
            { name: 'KENDRICK', norm: [42, 22, 93, 71] },         // Wichita
            { name: 'BRANDT CITY', norm: [48, 28, 94, 74] },      // Tulsa
            { name: 'WILLOW CREEK', norm: [39, 19, 89, 68] },     // Topeka
            { name: 'GRANITE BEND', norm: [57, 37, 96, 77] },     // Dallas
            { name: 'OSAGE MILL', norm: [51, 32, 93, 73] }        // Little Rock
        ]
    },
    {
        name: 'DESERT SOUTHWEST', lat: 33.45, lon: -112.07, tz: -7, dst: false, wet: 0.12,
        towns: [
            { name: 'SOLANO MESA', norm: [68, 46, 106, 84] },     // Phoenix
            { name: 'COPPER WELLS', norm: [66, 40, 100, 75] },    // Tucson
            { name: 'DRY CREEK', norm: [58, 39, 105, 82] },       // Las Vegas
            { name: 'SAGUARO FLATS', norm: [70, 46, 108, 82] },   // Yuma
            { name: 'VISTA ROJA', norm: [58, 33, 96, 73] },       // El Paso
            { name: 'SANDIA RIDGE', norm: [48, 26, 91, 66] },     // Albuquerque
            { name: 'PINE MESA', norm: [43, 17, 82, 52] }         // Flagstaff
        ]
    },
    {
        name: 'PACIFIC NORTHWEST', lat: 47.61, lon: -122.33, tz: -8, dst: true, wet: 0.6,
        towns: [
            { name: 'CEDAR SOUND', norm: [48, 37, 77, 56] },      // Seattle
            { name: 'FERNHAVEN', norm: [48, 36, 82, 58] },        // Portland OR
            { name: 'MOSSBANK', norm: [46, 33, 77, 50] },         // Olympia
            { name: 'GREYWATER', norm: [46, 33, 72, 53] },        // Bellingham
            { name: 'TILLAMORE', norm: [48, 34, 83, 52] },        // Eugene
            { name: 'NORTH FORK', norm: [35, 24, 84, 57] },       // Spokane
            { name: 'BASALT FLATS', norm: [39, 21, 88, 53] }      // Yakima
        ]
    }
];
