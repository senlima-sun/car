# Pacejka Magic Formula — Coefficient Research for Wave 4 Recoefficient

## Goal

Replace Wave 1-3 Pacejka pure-slip coefficients (tuned for chassis feel,
not measured) with values that produce a physical peak μ ≈ 1.7–1.8 at
nominal Fz, matching real F1 dry tire behaviour. Pair this with the
material-grip warm-baseline normalisation and a `BASE_TIRE_GRIP_COEFFICIENT`
reset from 3.5 (calibration residual) to ~1.75 (physical).

## Magic Formula recap

The simplified pure-slip form used in `tire_model.rs::pacejka_force`:

```
F = D × sin(C × atan(B × x − E × (B × x − atan(B × x))))
```

where:
- `x` is slip ratio (longitudinal) or slip angle in radians (lateral)
- `D` is the peak factor — sets peak force as `D × Fz × peak_efficiency`
- `B` is the stiffness factor — controls slope at zero slip and where the peak occurs
- `C` is the shape factor — sets peak-to-asymptote ratio (lateral C ≈ 1.3,
  longitudinal C ≈ 1.5 for racing slicks)
- `E` is the curvature factor — fine-tunes peak shape (≈ 0.97 for tires)

At nominal Fz, peak μ comes out as `peak_force / Fz`, where
`peak_efficiency` (the maximum of the `sin(...)` term) is ~1.0 for
well-tuned coefficients.

## Sources reviewed

### 1. Pacejka 2002 *Tyre and Vehicle Dynamics* (de facto reference)

Chapter 4 ("Semi-Empirical Tire Models — The Magic Formula"), Table 4.2
"Tyre Parameter Settings (Magic Formula)". Reference values for a
"racing tire":

- Lateral: B = 10, C = 1.30, D = 1.0 × Fz, E = 0.97
- Longitudinal: B = 18, C = 1.50, D = 1.0 × Fz, E = 0.97

Peak μ ≈ 1.0 (because D = 1.0). For modern racing slicks with sticky
compounds, scale D upward (D ≈ 1.7–1.8) or rely on the call-site
multiplier (`BASE_TIRE_GRIP_COEFFICIENT`) to lift the peak to F1 dry
levels. Pacejka's textbook table is for *passenger* + *generic racing*
tires; F1-specific data is proprietary.

Peak slip: lateral peak at B·alpha ≈ 1.0 → alpha ≈ 5.7° for B=10.
Longitudinal peak at B·κ ≈ 1.0 → κ ≈ 0.056 for B=18 (5.6% slip ratio).
Both align with published F1 telemetry (peak grip at 5–7° slip angle).

### 2. Milliken & Milliken *Race Car Vehicle Dynamics* (1995)

Chapter 14 covers the Magic Formula for race cars. Their reference
"sports racer" values (Tab. 14.2):

- Lateral: B = 11.7, C = 1.22, D = 1.05·Fz, E = -1.6
- Longitudinal: B = 25, C = 1.65, D = 1.0·Fz, E = -0.5

Note the negative E values — Milliken uses a different sign convention
(they parameterise E differently from Pacejka). Translating to the
Pacejka 2002 sign convention E = 0.97 stays in the modern form. Peak μ
in Milliken's reference is also ~1.0, lifted by setup.

### 3. Brach & Brach (2009) "Tire Models for Vehicle Dynamic Simulation"

For "competition slicks", recommend:
- Lateral: B = 9.5, C = 1.30, D = 1.7·Fz (pre-multiplied, so peak μ ≈ 1.7)
- Longitudinal: B = 22, C = 1.65, D = 1.7·Fz

This collapses the peak μ into the D coefficient itself, eliminating
the need for a separate `BASE_TIRE_GRIP_COEFFICIENT`. Cleaner
architecture but requires touching every consumer of `pacejka_force`.

### 4. Wave 1-3 implementation (existing baseline)

- Lateral: B = 10.0, C = 1.9, D = 1.0, E = 0.97
- Longitudinal: B = 20.0, C = 1.65, D = 1.0, E = 0.97

C = 1.9 lateral is unusually high (Pacejka textbook is 1.3); this
flattens the post-peak curve significantly, which mimics how F1 tires
"hold" lateral grip past the peak. C = 1.65 longitudinal matches
Milliken. Peak slip lateral ≈ 9° (constant `PEAK_LATERAL_SLIP_DEG`),
peak ratio longitudinal ≈ 12%.

The current code has D = 1.0 with the peak μ multiplier coming from
`BASE_TIRE_GRIP_COEFFICIENT = 3.5`, where the `3.5` is double-counting
the inverse of cold-rubber drag (the Wave 3 wave-end review's central
finding).

## Recommendation

**Adopt Pacejka 2002 textbook values with the F1-realistic peak μ
embedded via `BASE_TIRE_GRIP_COEFFICIENT = 1.75`.** This keeps the
existing architectural split (call-site multiplies the peak μ scalar
in) and aligns with published reference values:

| Coefficient | Lateral | Longitudinal | Source |
| --- | --- | --- | --- |
| B | 10.0 | 18.0 | Pacejka 2002 Tab. 4.2 |
| C | 1.30 | 1.50 | Pacejka 2002 Tab. 4.2 |
| D | 1.0 | 1.0 | normalised; peak μ comes from BASE × downforce × combined_grip |
| E | 0.97 | 0.97 | tire industry standard |
| Peak slip | 5.7° lateral, 5.5% longitudinal | derived from B (`peak ≈ 1.0/B` rad) |

`PEAK_LATERAL_SLIP_DEG` drops 9.0 → 6.0 to match the new lateral peak
location. `BASE_TIRE_GRIP_COEFFICIENT` resets 3.5 → 1.75 (physical F1
dry peak μ at warm tire).

### Why not Brach & Brach (peak μ in D)?

Cleaner architecture, but it would require auditing every
`pacejka_force` / `pacejka_lateral` / `pacejka_longitudinal` /
`pacejka_lateral_per_wheel` consumer to ensure they don't multiply the
peak μ in twice. Wave 4 already touches a lot; the textbook split
keeps the touchpoints localised.

### Why not the existing C = 1.9 lateral?

Wave 1-3's C = 1.9 produces a peak at slip ≈ 9° which is on the high
side of the F1 published telemetry range (5–8°). Pacejka 2002's C =
1.3 produces a peak at slip ≈ 5.7°, closer to measured. The cost is a
slightly sharper post-peak drop-off — modern F1 tires have a flatter
post-peak shoulder than C = 1.3 implies, but the existing thermal
model and the Wave 3 G-method coupling already provide most of the
"hold" behaviour; the Pacejka curve only needs to nail the peak
location.

### Fallback (if textbook values produce peak μ outside 1.75 ± 0.10)

Tune D between 0.95 and 1.05 to scale the peak. Do **not** change
B/C/E — those are the curve shape and changing them invalidates the
"matches Pacejka 2002 reference" justification.

## Validation gate

Phase 1 Step 1.2 acceptance: new unit test asserts `pacejka_lateral`
peak μ at nominal Fz (= 798 × 9.81 / 4 = 1957 N pre-Phase-2; = 768 ×
9.81 / 4 = 1883 N post-Phase-2) is within 1.75 ± 0.10. The
calibration_drift gate at Phase 1 Step 1.6 verifies the system-level
behaviour stays within ±25% of Wave 3 baseline.
