# 120fps Performance Testing Guide

## Test Environment

### Hardware Requirements

- Display: 120Hz or higher refresh rate monitor
- GPU: Dedicated graphics card recommended
- CPU: Modern multi-core processor
- RAM: 8GB minimum

### Test Scenarios

#### 1. Static Scene Test

**Goal**: Verify baseline 120fps in stationary conditions

1. Start the game
2. Keep car stationary
3. Monitor FPS counter for 30 seconds
4. **Expected**: Stable 120fps ±2

#### 2. High-Speed Driving Test

**Goal**: Maintain 120fps during normal racing

1. Drive at 200+ km/h on straight track sections
2. Monitor FPS counter
3. **Expected**: 115-120fps (avg), 1% low > 100fps

#### 3. Weather Effects Test

**Goal**: Verify particle systems don't bottleneck

1. Enable rain weather (press Q to cycle)
2. Drive at 150+ km/h
3. Monitor FPS counter
4. **Expected**: 110-120fps (avg), 1% low > 95fps

#### 4. Tire Trail Stress Test

**Goal**: Ensure tire trails adapt to high framerate

1. Enable aggressive driving (drifting, burnouts)
2. Drive for 2 minutes continuously
3. Monitor FPS counter and trail rendering
4. **Expected**: 105-120fps (avg), 1% low > 90fps

#### 5. Surface Particle Test

**Goal**: Verify off-road particle limits work

1. Drive on grass/gravel at high speed
2. Monitor particle count and FPS
3. **Expected**: 110-120fps (avg), particle count adapts to tier

## Performance Metrics

### Frame Rate Targets

- **Target FPS**: 120
- **Minimum Average**: 115
- **1% Low**: 100
- **0.1% Low**: 90

### Performance Tiers

| Tier   | FPS Range | Particle Multiplier | Trail Points/Wheel | Surface Particles |
| ------ | --------- | ------------------- | ------------------ | ----------------- |
| Ultra  | 100+      | 1.2x                | 720                | 96                |
| High   | 60-99     | 1.0x                | 600                | 80                |
| Medium | 40-59     | 0.6x                | 420                | 48                |
| Low    | <40       | 0.3x                | 240                | 24                |

### System Monitoring

Use the enhanced FPS Counter to track:

- **Current FPS**: Real-time frame rate
- **Average FPS**: Rolling average (last 60 frames)
- **Frame Time**: Milliseconds per frame
- **1% Low FPS**: Worst 1% performance
- **Deviation**: Percentage from 120fps target

## Known Limitations

1. **Physics Update Rate**: Fixed at 120 Hz (1/120s timestep)
2. **Rapier Integration**: Uses fixed timestep for stability
3. **Browser VSync**: May cap at display refresh rate

## Troubleshooting

### FPS Below Target (<115 avg)

1. Check GPU utilization (should be 60-80%)
2. Verify display refresh rate in system settings
3. Disable browser extensions
4. Close other applications
5. Check performance tier - should be 'ultra' at 120fps

### Frame Time Spikes

1. Monitor GC pauses in browser DevTools
2. Check particle counts during spikes
3. Verify no background processes interfering
4. Test in incognito/private mode

### Physics Instability

If physics behaves oddly at high framerates:

1. Verify FIXED_TIME_STEP = 1/120 in constants/physics.ts
2. Check accumulator is being used in useCarFrame
3. Ensure Rapier timeStep matches (should be 1/120)

## Performance Optimization Checklist

- [ ] Canvas frameloop set to 'always'
- [ ] Target FPS = 120 in useFrameRateStore
- [ ] Physics using fixed timestep (1/120s)
- [ ] FPS monitoring precision supports 3-digit fps
- [ ] Performance tiers include 'ultra' (100+ fps)
- [ ] Particle systems use time-based spawning (not per-frame)
- [ ] Tire trails use adaptive distance thresholds
- [ ] Surface particles respect performance tier limits
- [ ] GPU instancing batch sizes scale with tier

## Reporting Issues

When reporting performance issues, include:

- Browser and version
- GPU model
- Display refresh rate
- Performance tier shown
- FPS metrics (current/avg/1% low)
- Specific scenario causing issues
- Screenshot of FPS Counter if possible
