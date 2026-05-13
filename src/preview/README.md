# Track Preview

Standalone top-down preview of a preset track's ribbon layers — no physics, no WASM, no car.

## Usage

`bun run dev` then open one of:

- `http://localhost:3000/track-preview` — fallback list of every preset
- `http://localhost:3000/track-preview?track=suzuka` — open Suzuka in preview
- `http://localhost:3000/track-preview?track=<preset-id>` — any `id` from `src/constants/tracks/index.ts`

## Layer groups

The toggle panel filters `PlacedObject` visibility by `LayerGroup` (`src/utils/trackLayerGroup.ts`):

| Group | What it shows |
| --- | --- |
| `surface` | Asphalt road segments + ribbon track surfaces |
| `edge` | White edge lines (currently rendered inside the asphalt; toggle reserved for future split) |
| `painted` | `painted_area` placed objects |
| `curb` | All curb segments (linear, curved, ribbon) |
| `pit` | Pit-lane variants of roads and ribbons |

Non-ribbon objects (cones, walls, checkpoints, corners) are always visible — they anchor orientation.

## Why a separate route

The simulator mounts `PhysicsProvider` (custom WASM physics), `Car`, weather, and a full HUD. None of that is useful for ribbon-layer review. The pathname switch in `src/main.tsx` picks a different lazy root for `/track-preview*` so the bundle stays lean for the preview path.

## Adding a new layer group

1. Add the variant to `LayerGroup` in `src/types/trackObjects.ts`.
2. Wire the resolution rule in `src/utils/trackLayerGroup.ts`.
3. Add the label + ordering in `LAYER_LABELS` / `LAYER_ORDER` here.
4. Default it to `true` in `useLayerToggleStore.ts`.
