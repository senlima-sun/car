# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A 3D car racing game built with React, Three.js, and Rapier physics. Features realistic car physics, dynamic weather effects, tire management, lap timing, and a track customization system.

## Commands

- **Development**: `npm run dev` - Start Vite dev server
- **Build**: `npm run build` - TypeScript check + Vite production build
- **Preview**: `npm run preview` - Preview production build

## Architecture

### Tech Stack

- **React 19** with TypeScript
- **Three.js** via `@react-three/fiber` (React renderer for Three.js)
- **@react-three/drei** - Three.js helpers and abstractions
- **@react-three/rapier** - Rapier physics engine integration
- **Zustand** - State management
- **Vite** - Build tool (with WASM support for Rapier)

### Project Structure

```
src/
├── App.tsx                 # Root - KeyboardControls, Canvas, Physics setup
├── main.tsx               # React entry point
├── components/
│   ├── canvas/            # 3D scene components (rendered inside Canvas)
│   │   ├── Car/           # Vehicle with physics (Car.tsx has full physics model)
│   │   ├── Camera/        # Third-person, first-person, isometric cameras
│   │   ├── Track/         # Race track and temperature overlay
│   │   ├── TrackObjects/  # Placeable objects (cone, ramp, barrier, road, checkpoint, curb)
│   │   ├── Weather/       # Dynamic sky, clouds, lighting, rain/spray effects
│   │   └── Customization/ # Track editor (object placer, preview, placed objects)
│   └── ui/                # HTML overlay components
│       ├── HUD/           # Speedometer, gear, tire wear, status bar, lap timer
│       ├── CustomizationPanel/ # Track editor UI
│       └── TrackSelector/ # Pre-made track selection
├── stores/                # Zustand state stores
│   ├── useCarStore.ts     # Speed, gear, position, telemetry
│   ├── useGameStore.ts    # Game status (racing/customize), camera mode
│   ├── useWeatherStore.ts # Weather system with physics modifiers
│   ├── useTireStore.ts    # Tire compounds, wear, grip modifiers
│   ├── useCustomizationStore.ts # Track editor state, placed objects
│   ├── usePitStore.ts     # Pit lane and pit stop management
│   └── useLapTimeStore.ts # Lap timing and recording
├── constants/             # Physics configs, tire specs, weather params
├── shaders/               # GLSL shaders (track surface)
├── types/                 # TypeScript type definitions
└── utils/                 # Helper functions
```

### Key Systems

**Car Physics** (`src/components/canvas/Car/Car.tsx`):

- Detailed physics: engine power curves, aerodynamic drag/downforce, tire grip model (Pacejka-inspired), weight transfer, drift mechanics
- DRS system for top speed boost
- Weather modifies all physics parameters (grip, braking, steering)
- Tire compound affects grip multiplier

**Weather System** (`src/stores/useWeatherStore.ts`):

- Four conditions: sunny, cloudy, rainy, cold
- Modifies physics via `currentModifiers`: friction, braking, steering, max speed, drift behavior
- Smooth transitions between weather states

**Track Customization** (`src/stores/useCustomizationStore.ts`):

- Object types: cone, ramp, checkpoint, barrier, road (straight/curved), curb
- Roads use drag-to-draw with bezier curves for turns
- Curbs attach to road edges with parametric positioning
- Auto-saves to localStorage

**Two Game Modes**:

- **Racing mode**: Drive car with physics, HUD shows telemetry
- **Customize mode** (press T): Isometric view, place track objects

### Controls

| Key           | Action                             |
| ------------- | ---------------------------------- |
| W/Arrow Up    | Accelerate                         |
| S/Arrow Down  | Brake/Reverse                      |
| A/D or Arrows | Steer                              |
| Space         | Handbrake                          |
| Shift         | Handbrake                          |
| E             | DRS (above 200 km/h)               |
| C             | Toggle camera (third/first person) |
| T             | Toggle customize mode              |
| Q             | Cycle weather                      |
| R             | Toggle lap recording               |
| P             | Pit stop menu (when in pit box)    |

### Path Aliases

TypeScript configured with `@/*` mapping to `src/*`.
