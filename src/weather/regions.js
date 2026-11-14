/**
 * The weather page's regions. AJ (2026-11-10): "real weather data for real
 * places ... general places and cities like old weather channel stuff".
 * Each region is a home city (first: current conditions, forecast, almanac)
 * plus six neighbours for the regional table and the radar map. `grid` is
 * the National Weather Service forecast grid (office/x,y) and `station` the
 * observation station, looked up once from api.weather.gov/points so the
 * page doesn't have to on every load. `timeZone` is the home city's.
 */
export const REGIONS = [
    {
        name: 'NORTHEAST', timeZone: 'America/New_York',
        towns: [
            { name: 'NEW YORK', lat: 40.78, lon: -73.97, grid: 'OKX/34,45', station: 'KLGA' },
            { name: 'BOSTON', lat: 42.36, lon: -71.06, grid: 'BOX/71,101', station: 'KBOS' },
            { name: 'PHILADELPHIA', lat: 39.95, lon: -75.17, grid: 'PHI/50,79', station: 'KPHL' },
            { name: 'WASHINGTON', lat: 38.9, lon: -77.04, grid: 'LWX/96,71', station: 'KDCA' },
            { name: 'PITTSBURGH', lat: 40.44, lon: -80.0, grid: 'PBZ/77,66', station: 'KPIT' },
            { name: 'BUFFALO', lat: 42.89, lon: -78.88, grid: 'BUF/36,47', station: 'KBUF' },
            { name: 'HARTFORD', lat: 41.76, lon: -72.68, grid: 'BOX/22,64', station: 'KHFD' }
        ]
    },
    {
        name: 'SOUTHEAST', timeZone: 'America/New_York',
        towns: [
            { name: 'ATLANTA', lat: 33.75, lon: -84.39, grid: 'FFC/51,87', station: 'KATL' },
            { name: 'MIAMI', lat: 25.77, lon: -80.19, grid: 'MFL/110,50', station: 'KMIA' },
            { name: 'CHARLOTTE', lat: 35.23, lon: -80.84, grid: 'GSP/119,65', station: 'KCLT' },
            { name: 'ORLANDO', lat: 28.54, lon: -81.38, grid: 'MLB/26,68', station: 'KMCO' },
            { name: 'NASHVILLE', lat: 36.16, lon: -86.78, grid: 'OHX/50,57', station: 'KBNA' },
            { name: 'NEW ORLEANS', lat: 29.95, lon: -90.07, grid: 'LIX/68,88', station: 'KMSY' },
            { name: 'TAMPA', lat: 27.95, lon: -82.46, grid: 'TBW/71,98', station: 'KTPA' }
        ]
    },
    {
        name: 'MIDWEST', timeZone: 'America/Chicago',
        towns: [
            { name: 'CHICAGO', lat: 41.88, lon: -87.63, grid: 'LOT/76,73', station: 'KORD' },
            { name: 'DETROIT', lat: 42.33, lon: -83.05, grid: 'DTX/66,34', station: 'KDTW' },
            { name: 'MINNEAPOLIS', lat: 44.98, lon: -93.27, grid: 'MPX/108,72', station: 'KMSP' },
            { name: 'ST. LOUIS', lat: 38.63, lon: -90.2, grid: 'LSX/95,75', station: 'KSTL' },
            { name: 'KANSAS CITY', lat: 39.1, lon: -94.58, grid: 'EAX/44,51', station: 'KMCI' },
            { name: 'CLEVELAND', lat: 41.5, lon: -81.69, grid: 'CLE/83,65', station: 'KCLE' },
            { name: 'INDIANAPOLIS', lat: 39.77, lon: -86.16, grid: 'IND/58,69', station: 'KIND' }
        ]
    },
    {
        name: 'SOUTH CENTRAL', timeZone: 'America/Chicago',
        towns: [
            { name: 'DALLAS', lat: 32.78, lon: -96.8, grid: 'FWD/89,104', station: 'KDFW' },
            { name: 'HOUSTON', lat: 29.76, lon: -95.37, grid: 'HGX/63,95', station: 'KIAH' },
            { name: 'OKLAHOMA CITY', lat: 35.47, lon: -97.52, grid: 'OUN/97,94', station: 'KOKC' },
            { name: 'SAN ANTONIO', lat: 29.42, lon: -98.49, grid: 'EWX/127,54', station: 'KSAT' },
            { name: 'LITTLE ROCK', lat: 34.75, lon: -92.29, grid: 'LZK/82,73', station: 'KLIT' },
            { name: 'MEMPHIS', lat: 35.15, lon: -90.05, grid: 'MEG/42,67', station: 'KMEM' },
            { name: 'AUSTIN', lat: 30.27, lon: -97.74, grid: 'EWX/156,91', station: 'KAUS' }
        ]
    },
    {
        name: 'ROCKIES', timeZone: 'America/Denver',
        towns: [
            { name: 'DENVER', lat: 39.74, lon: -104.99, grid: 'BOU/63,62', station: 'KDEN' },
            { name: 'SALT LAKE CITY', lat: 40.76, lon: -111.89, grid: 'SLC/100,175', station: 'KSLC' },
            { name: 'PHOENIX', lat: 33.45, lon: -112.07, grid: 'PSR/159,58', station: 'KPHX' },
            { name: 'ALBUQUERQUE', lat: 35.08, lon: -106.65, grid: 'ABQ/98,121', station: 'KABQ' },
            { name: 'LAS VEGAS', lat: 36.17, lon: -115.14, grid: 'VEF/123,98', station: 'KLAS' },
            { name: 'BOISE', lat: 43.62, lon: -116.2, grid: 'BOI/134,86', station: 'KBOI' },
            { name: 'CHEYENNE', lat: 41.14, lon: -104.82, grid: 'CYS/110,14', station: 'KCYS' }
        ]
    },
    {
        name: 'WEST COAST', timeZone: 'America/Los_Angeles',
        towns: [
            { name: 'LOS ANGELES', lat: 34.05, lon: -118.24, grid: 'LOX/155,45', station: 'KLAX' },
            { name: 'SAN FRANCISCO', lat: 37.77, lon: -122.42, grid: 'MTR/85,105', station: 'KSFO' },
            { name: 'SEATTLE', lat: 47.61, lon: -122.33, grid: 'SEW/125,68', station: 'KSEA' },
            { name: 'PORTLAND', lat: 45.52, lon: -122.68, grid: 'PQR/113,104', station: 'KPDX' },
            { name: 'SAN DIEGO', lat: 32.72, lon: -117.16, grid: 'SGX/57,14', station: 'KSAN' },
            { name: 'SACRAMENTO', lat: 38.58, lon: -121.49, grid: 'STO/41,68', station: 'KSMF' },
            { name: 'RENO', lat: 39.53, lon: -119.81, grid: 'REV/45,106', station: 'KRNO' }
        ]
    }
];

/**
 * Demo regions (`?data=demo`, and the motion harness, which must not call
 * the network): made-up towns with generated forecasts, so a demo frame
 * can't be mistaken for a real forecast. `norm` is [January high, January
 * low, July high, July low] in °F, borrowed from the real city in each
 * comment; `wet` scales the chance of precipitation.
 */
export const DEMO_REGIONS = [
    {
        name: 'NORTHERN LAKES', lat: 44.98, lon: -93.27, timeZone: 'America/Chicago', wet: 0.42,
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
        name: 'ATLANTIC COAST', lat: 42.36, lon: -71.06, timeZone: 'America/New_York', wet: 0.46,
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
        name: 'PIEDMONT', lat: 33.75, lon: -84.39, timeZone: 'America/New_York', wet: 0.45,
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
        name: 'HIGH PLAINS', lat: 35.47, lon: -97.52, timeZone: 'America/Chicago', wet: 0.34,
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
        name: 'DESERT SOUTHWEST', lat: 33.45, lon: -112.07, timeZone: 'America/Phoenix', wet: 0.12,
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
        name: 'PACIFIC NORTHWEST', lat: 47.61, lon: -122.33, timeZone: 'America/Los_Angeles', wet: 0.6,
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
