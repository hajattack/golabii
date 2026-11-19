# The sunken atelier

Shown on the home page above the saffron drops map (section `#atelier`, loaded in an iframe).

Three Golabii vessels lie under saffron water on a Persian rug: the floral bottle, the clear pouch
(`pouch_2.glb`) and the glass bottle (`vessel_1.glb`), both filled with a deep red drink that sways
when they are nudged. Tapping the water sends one ripple out and pushes the rose petals away;
"Rain roses" lets a screen-covering fall of petals and roses drop from the edges inward
(1.8 s cooldown).

One self-contained file: the rug photo, the models and the lettering are all inline.
Embedded in the site it waits until the section is on screen, stops drawing while scrolled away,
and lets phones scroll past it with a vertical swipe.

## Run it on its own

    cd scenes/sunken-atelier
    python3 -m http.server 8000
    # open http://localhost:8000
