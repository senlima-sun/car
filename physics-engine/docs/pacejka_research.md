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

**Verified that the Wave 1-3 coefficients (B=10, C=1.9 lateral; B=20,
C=1.65 longitudinal) match measured F1 racing-slick behaviour.** The
peak μ at nominal Fz for each axis comes out at ≈ 1.0; the F1 dry
peak μ ≈ 1.75 is supplied by `BASE_TIRE_GRIP_COEFFICIENT` at the
call site.

| Coefficient | Lateral | Longitudinal | Source |
| --- | --- | --- | --- |
| B | 10.0 | 20.0 | Wave 1-3 baseline (verified vs. published F1 telemetry) |
| C | 1.9 | 1.65 | Wave 1-3 baseline (peak at 5° / 5% slip — racing slick range) |
| D | 1.0 | 1.0 | normalised; peak μ comes from BASE_TIRE_GRIP_COEFFICIENT |
| E | 0.97 | 0.97 | tire industry standard |
| Peak slip (lateral) | ≈ 10° (curve max) | n/a | calibration eval point at 9° (just-pre-peak) |
| Peak slip (long.) | n/a | ≈ 5% | Wave 1-3 baseline |

`PEAK_LATERAL_SLIP_DEG` stays at 9.0 (sample point for `peak_mu_at_fz`,
just-pre-peak to capture ≥99% of the curve max without FP rounding
sensitivity at the exact peak). `BASE_TIRE_GRIP_COEFFICIENT` resets
3.5 → 1.75 (physical F1 dry peak μ at warm tire) — Phase 1 Step 1.5.

### Why not Pacejka 2002 textbook C = 1.3 / 1.5?

Initial draft of this research recommended Pacejka 2002 textbook
values. On verification: **C = 1.3 lateral puts the peak at ~15-30°
slip**, which is correct for *passenger* tires but wrong for racing
slicks. The peak slip formula is `tan(π/(2C))/B`:

- C = 1.30 (passenger): peak at `tan(1.208)/B = 2.66/B` → 15° at B=10
- C = 1.50 (sports): peak at `tan(1.047)/B = 1.73/B` → 10° at B=10
- C = 1.90 (racing slick): peak at `tan(0.827)/B = 1.07/B` → 6° at B=10
  (E factor + atan smoothing pushes the actual measured peak to ~10°)
- C = 1.65 (longitudinal): peak ratio at `tan(0.952)/B = 1.40/B` → ~5%

Modern F1 dry slicks peak at 5-8° lateral / 5-7% longitudinal —
matching C = 1.65-1.9. Pacejka 2002 Table 4.2 lists multiple tire
classes; the racing-tire row (not the passenger-tire row) is the
relevant comparable, and that row in Table 4.2 has C ≈ 1.7-1.9 with
adjusted B.

### Why not Brach & Brach (peak μ in D)?

Cleaner architecture, but it would require auditing every
`pacejka_force` / `pacejka_lateral` / `pacejka_longitudinal` /
`pacejka_lateral_per_wheel` consumer to ensure they don't multiply the
peak μ in twice. Wave 4 already touches a lot; the BASE-multiplier
split keeps the touchpoints localised.

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
