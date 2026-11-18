# The secret pour

Shown on the home page above the saffron drops map (section `#secret`, loaded in an iframe).

A rose, chicory and saffron garden behind textured glass with "Golabii" standing among the
flowers. After 2.8 s of clear glass, a saffron syrup pours slowly down the pane and exposes
words that stay dry, so the syrup flows around them:

- luxury premium ingredients
- for good causes
- by the people, for the people
- gifts · events · decentralized · community-based

Inside the page the pour waits until the section is on screen and pauses while it is scrolled away.

## Run it on its own

    cd scenes/secret-pour
    python3 -m http.server 8000
    # open http://localhost:8000

## Where to change things (in `index.html`)

- `layout()` — the wording, sizes and positions.
- `WATER_AT` — seconds of clear glass before the pour; `SPEED` — how fast it runs (1 = original).
- `computeFlow()` — how the syrup runs and splits around the words.
- `lamp` — the corner light (position, aim, strength).

New words need their outlines added to `glyphs.js` (Gloock for "Golabii", Fraunces italic for the rest, both SIL OFL).
Debug: add `#still-at20` to the address to freeze the timeline at 20 s.
