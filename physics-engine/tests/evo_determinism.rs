#![cfg(feature = "headless")]
#![allow(dead_code, unused_imports, unused_variables)]

#[path = "../bin/ai_runner/obs.rs"]
mod obs;

#[path = "../bin/ai_runner/policies/mod.rs"]
mod policies;

#[path = "../bin/ai_runner/sim.rs"]
mod sim;

#[path = "../bin/ai_runner/track_loader.rs"]
mod track_loader;

#[path = "../bin/ai_runner/evo.rs"]
mod evo;

use evo::{Population, INITIAL_SIGMA_MONZA};
use policies::lookahead::{BASELINE_PARAMS_MONZA, LOOKAHEAD_PARAM_COUNT};

fn synthetic_eval(params: &[f32], _child_idx: usize) -> f32 {
    let mut acc = 0.0_f32;
    for (i, v) in params.iter().enumerate() {
        let weight = 1.0 / ((i + 1) as f32);
        acc += weight * v;
    }
    acc
}

#[test]
fn two_runs_with_same_seed_produce_identical_best_fitness_and_params() {
    let mut pop_a = Population::init(
        LOOKAHEAD_PARAM_COUNT,
        8,
        24,
        42,
        &BASELINE_PARAMS_MONZA,
        &INITIAL_SIGMA_MONZA,
    );
    let mut pop_b = Population::init(
        LOOKAHEAD_PARAM_COUNT,
        8,
        24,
        42,
        &BASELINE_PARAMS_MONZA,
        &INITIAL_SIGMA_MONZA,
    );

    let mut last_a_fitness = f32::NEG_INFINITY;
    let mut last_b_fitness = f32::NEG_INFINITY;
    let mut last_a_params: Vec<f32> = Vec::new();
    let mut last_b_params: Vec<f32> = Vec::new();

    for _ in 0..5 {
        let a = pop_a.step(synthetic_eval);
        let b = pop_b.step(synthetic_eval);
        last_a_fitness = a.best_fitness;
        last_b_fitness = b.best_fitness;
        last_a_params = a.best_params;
        last_b_params = b.best_params;
    }

    assert_eq!(
        last_a_fitness.to_bits(),
        last_b_fitness.to_bits(),
        "best_fitness diverged across two seeded runs"
    );
    assert_eq!(
        last_a_params, last_b_params,
        "best_params diverged across two seeded runs"
    );
}

#[test]
fn different_seeds_produce_different_trajectories() {
    let mut pop_a = Population::init(
        LOOKAHEAD_PARAM_COUNT,
        8,
        24,
        42,
        &BASELINE_PARAMS_MONZA,
        &INITIAL_SIGMA_MONZA,
    );
    let mut pop_b = Population::init(
        LOOKAHEAD_PARAM_COUNT,
        8,
        24,
        43,
        &BASELINE_PARAMS_MONZA,
        &INITIAL_SIGMA_MONZA,
    );

    let a = pop_a.step(synthetic_eval);
    let b = pop_b.step(synthetic_eval);
    assert_ne!(
        a.best_params, b.best_params,
        "different seeds must produce different parameter trajectories"
    );
}
