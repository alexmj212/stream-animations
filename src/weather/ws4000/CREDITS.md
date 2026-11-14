# WeatherStar 4000 icons

The weather and moon-phase icons on Exo-Cast are the WeatherStar 4000's own,
as redrawn by fans: **Charles Abel and Nick Smith** (TWC Classics,
https://twcclassics.com/downloads.html) and **Malek Masoud**. Taken from the
GIFs shipped in netbymatt/ws4kp (`server/images/icons/current-conditions`,
`regional-maps`, `moon-phases`; ws4kp's code is MIT, and its README credits
the icons as above). The WeatherSTAR 4000 itself belongs to The Weather
Channel.

There is no formal licence on the icons. AJ asked for them on 2026-11-11
("the icons for the weather need to use the weather star versions"), and
chose the same day to bundle the Star4000 fonts from the same fan source with
credit, so these are bundled the same way.

Rebuild the strips (`*.png`) and `../ws4000icons.js` with
`python3 tools/weather/build_ws4000_icons.py <ws4kp>/server/images/icons`.
