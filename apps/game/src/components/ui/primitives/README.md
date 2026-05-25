# UI primitives

Single source of truth for chrome (surface containers, dividers, label
typography, icon buttons, accent rails). Every HUD widget, Showroom
panel, TrackEditor toolbar, TrackSelector menu, and dev overlay imports
from here.

## Surfaces

| Token / component | When to use |
| --- | --- |
| `<Surface variant='pill'>` | Toolbar / action rows / dropdown buttons. `rounded-full`. |
| `<Surface variant='card'>` | Standard HUD widget, side panel, info card. `rounded-2xl`. |
| `<Surface variant='cardStrong'>` | Modal, full-screen overlay, dev overlay, important warning. Darker bg + stronger shadow. |

Class-string equivalents (`surfacePill`, `surfaceCard`, `surfaceCardStrong`)
are exported for cases where the component wrapper is not appropriate
(e.g. attaching to a plain `<button>` or composing with other utility
classes).

## Atoms

| Component | Purpose |
| --- | --- |
| `<AccentBar color={hex}>` | 3px left rail with glow. Encodes status color (success / warning / danger). Mounts inside a `relative` parent. |
| `<Divider orientation='vertical' \| 'horizontal'>` | 1px `bg-white/10` separator. |
| `<LabelTag>` | Uppercase micro-label (e.g. "Speed", "Lap"). 9px / `tracking-[0.22em]`. |
| `<IconButton>` | 36x36 rounded-full button with variant prop (default / active / primary / danger / disabled). |
| `<Tooltip>` | Used inside `IconButton`. Group-hover anchored. |

## Rules

- **No `bg-black/X` or `rounded-[Npx]` chrome at use sites.** If you find
  yourself reaching for those, you want a `<Surface>` variant instead.
- **Status colors come from `constants/colors.ts STATUS`**, not hardcoded.
  Primitives accept colors as props; they don't choose them.
- **No clipPath polygon cut corners.** The canon dropped these in favor
  of `rounded-2xl` + `<AccentBar>` for status encoding.
- **Layout classes stay at the use site** (flex / padding / gap). Surface
  tokens carry only the surface chrome (border / bg / shadow / blur /
  radius).

## Adding a new primitive

If a pattern repeats 3+ times across consumers, extract a primitive here.
Do not introduce new tokens for one-off use cases — compose existing
ones with a use-site className first.
