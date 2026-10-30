# Map Coverage

A plain Google Maps embed with a local journal of where you have looked.

There is no Google API key. The map is an iframe. The pad, zoom buttons, search box, and arrow keys move that frame, and each move stores the centre, zoom, map type, screen bounds, and the size of the view. Blocks seen at or above the minimum zoom (16 by default) are marked covered.

Dragging inside the map frame is handled by Google and is not visible to this page, so those drags are not recorded. Use the pad when you want the journal to follow you.

Each city is its own project. Covered blocks and the green minimap belong to the city you have open. Use New city to start another one, then switch back from the city list.

Saved place names from earlier sessions stay in the journal under Places. The map does not read labels off the picture.

## Run

```bash
node serve.cjs
```

Open `http://localhost:5173`.

The journal stays in this browser. Export JSON for the full record, or CSV for the places.

## Checks

```bash
node tests.cjs
```
