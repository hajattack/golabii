# Glass garden — saffron pour

A three.js scene: a rose, chicory and saffron garden behind textured glass. After a 2.3 s
clear view, a saffron syrup pours down the pane, covers "Want to know our secret?" and
exposes hidden words as dry blocks the syrup has to flow around.

This folder is the version saved on 18 Nov 2026 (first version with the timed pour).

## Run it

The page loads its scripts as ES modules, so it needs a local server (opening the file
directly will not work):

    cd scenes/glass-garden
    python3 -m http.server 8000
    # open http://localhost:8000

## Files

- `index.html` — the whole scene: plants, lighting, glass shader, pour solver, timeline.
- `gloock-paths.js` — letter outlines (Gloock, SIL OFL) for the lettering and hidden words.
- `three.module.min.js`, `three.core.min.js` — three.js r180 (MIT).
- `tex/` — leaf branch textures from ez-tree (MIT).

## Where to change things (in `index.html`)

- `layout()` — every piece of text: wording, size, position.
- `WATER_AT` and `pour()` — the pause before the pour and how it speeds up.
- `computeFlow()` — how the syrup runs and splits around the hidden words.
- `plan` inside `buildGarden()` — which plant stands where.

Debug: add `#still-at7.5` to the address to freeze the pour at 7.5 s.
