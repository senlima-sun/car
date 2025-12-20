# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A 3D car racing game built with React, Three.js, and Rapier physics. Features realistic car physics, dynamic weather effects, tire management, lap timing, and a track customization system.

## Commands

- **Development**: `bun run dev` - Start dev server with auto-rebuild (port 3000)
- **Build**: `bun run build` - Build WASM + Bun production bundle
- **Build WASM**: `bun run build:wasm` - Compile Rust physics engine to WASM
- **Test WASM**: `bun run test:wasm` - Run Rust unit tests
- **Preview**: `bun run preview` - Preview production build (port 4173)

## Architecture

### Tech Stack

- **React 19** with TypeScript
- **Three.js** via `@react-three/fiber` (React renderer for Three.js)
- **@react-three/drei** - Three.js helpers and abstractions
- **@react-three/rapier** - Rapier physics engine (collision detection, rigid body dynamics)
- **Rust/WASM** - Custom physics engine for car dynamics, weather, tires, track temperature
- **Zustand** - State management
- **Bun** - Runtime, bundler, and package manager

### Project Structure

```
car/
├── physics-engine/        # Rust/WASM physics engine crate
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs         # WASM bindings
│       ├── engine.rs      # Main physics state machine
│       ├── weather.rs     # Weather system & modifiers
│       ├── tires.rs       # Tire compounds, wear, grip
│       ├── track_temperature.rs  # Temperature grid
│       ├── curb.rs        # Curb physics modifiers
│       └── car_physics/   # Vehicle dynamics modules
│           ├── aerodynamics.rs
│           ├── tire_model.rs
│           ├── weight_transfer.rs
│           ├── steering.rs
│           └── drift.rs
├── src/
│   ├── App.tsx            # Root - PhysicsProvider, KeyboardControls, Canvas
│   ├── main.tsx           # React entry point
│   ├── wasm/              # WASM bridge layer
│   │   ├── index.ts       # Public exports
│   │   ├── PhysicsBridge.ts    # TypeScript bindings to WASM
│   │   ├── PhysicsProvider.tsx # React context for WASM engine
│   │   └── pkg/           # Generated WASM package (gitignored)
│   ├── components/
│   │   ├── canvas/        # 3D scene components
│   │   │   ├── Car/       # Vehicle (uses WASM physics via usePhysics hook)
│   │   │   ├── Camera/    # Third-person, first-person, isometric cameras
│   │   │   ├── Track/     # Race track and temperature overlay
│   │   │   ├── TrackObjects/  # Placeable objects
│   │   │   ├── Weather/   # Dynamic sky, clouds, lighting, rain/spray effects
│   │   │   └── Customization/ # Track editor
│   │   └── ui/            # HTML overlay components
│   │       ├── HUD/       # Speedometer, gear, tire wear, status bar, lap timer
│   │       ├── CustomizationPanel/
│   │       └── TrackSelector/
│   ├── stores/            # Zustand state stores (UI state, sync to WASM)
│   ├── constants/         # UI configs (physics constants now in Rust)
│   ├── shaders/           # GLSL shaders (track surface)
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Helper functions
```

### Key Systems

**WASM Physics Engine** (`physics-engine/`):

All core physics calculations run in Rust/WASM for performance:

- Vehicle dynamics: aerodynamics (drag, downforce), Pacejka tire model, weight transfer, Ackerman steering, drift state machine
- Weather system: 4 conditions with 10 physics modifiers, smoothstep transitions
- Tire system: 5 compounds (soft/medium/hard/wet/intermediate), wear degradation, weather compatibility
- Track temperature: sparse grid with heat gain/decay, wetness tracking
- Curb physics: grip/stability modifiers based on turn direction

**Car Component** (`src/components/canvas/Car/Car.tsx`):

- Uses `usePhysics()` hook to access WASM engine
- Rapier handles collision detection and rigid body integration
- Each frame: reads Rapier state -> calls `physics.stepPhysics()` -> applies returned velocities to Rapier
- Syncs weather/tire compound changes to WASM via useEffect

**Weather System** (`src/stores/useWeatherStore.ts`):

- Four conditions: dry, hot, rain, cold
- UI state for weather transitions and display
- Physics modifiers computed in WASM, store provides UI metadata (icon, description)

**Track Customization** (`src/stores/useCustomizationStore.ts`):

- Object types: cone, ramp, checkpoint, barrier, road (straight/curved), curb
- Roads use drag-to-draw with bezier curves for turns
- Curbs attach to road edges with parametric positioning
- Auto-saves to localStorage

**Two Game Modes**:

- **Racing mode**: Drive car with physics, HUD shows telemetry
- **Customize mode** (press T): Isometric view, place track objects

### Controls

| Key           | Action                               |
| ------------- | ------------------------------------ |
| W/Arrow Up    | Accelerate                           |
| S/Arrow Down  | Brake/Reverse                        |
| A/D or Arrows | Steer                                |
| Space         | Handbrake                            |
| E             | Toggle Aero Mode (Corner/Straight)   |
| G             | Cycle ERS Preset (BAL/AGR/CON)       |
| ]             | Brake Bias + (testing mode)          |
| [             | Brake Bias - (testing mode)          |
| O             | Activate Overtake (testing mode)     |
| C             | Toggle camera (third/first person)   |
| T             | Toggle customize mode                |
| Q             | Cycle weather                        |
| R             | Toggle lap recording                 |
| P             | Pit stop menu (when in pit box)      |
| H             | Toggle surface condition heatmap     |

### Path Aliases

TypeScript configured with `@/*` mapping to `src/*`.
