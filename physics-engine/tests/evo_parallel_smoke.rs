#![cfg(feature = "headless")]
#![allow(dead_code, unused_imports, unused_variables)]

use std::time::Instant;

#[path = "../bin/ai_runner/obs.rs"]
mod obs;

#[path = "../bin/ai_runner/policies/mod.rs"]
mod policies;

#[path = "../bin/ai_runner/sim.rs"]
mod sim;

#[path = "../bin/ai_runner/track_loader.rs"]
mod track_loader;

#[path = "../bin/ai_runner/reward.rs"]
mod reward;

#[path = "../bin/ai_runner/parallel_eval.rs"]
mod parallel_eval;

#[path = "../bin/ai_runner/evo.rs"]
mod evo;

use evo::{Population, INITIAL_SIGMA_MONZA};
use parallel_eval::make_par_eval_fn;
use policies::lookahead::{BASELINE_PARAMS_MONZA, LOOKAHEAD_PARAM_COUNT};
use track_loader::load_track;

#[test]
fn three_generations_run_without_panic_and_produce_finite_fitness() {
    let track = load_track("monza").expect("monza track must load");
    let mut pop = Population::init(
        LOOKAHEAD_PARAM_COUNT,
        8,
        24,
        42,
        &BASELINE_PARAMS_MONZA,
        &INITIAL_SIGMA_MONZA,
    );
    let eval = make_par_eval_fn(&track, 20.0, 5.0);

    let start = Instant::now();
    let mut last_best = f32::NEG_INFINITY;
    for gen in 0..3 {
        let r = pop.step_par(&eval);
        for child in &r.all_offspring {
            assert!(child.fitness.is_finite(), "non-finite fitness at gen {gen}");
        }
        assert!(
            r.best_fitness.is_finite(),
            "non-finite best at gen {gen}: {}",
            r.best_fitness
        );
        last_best = r.best_fitness;
    }
    let wall = start.elapsed().as_secs_f32();
    println!(
        "evo_parallel_smoke: 3 gens lambda=24 wall={:.3}s last_best={}",
        wall, last_best
    );
    assert!(
        last_best > -1e6,
        "best fitness pathologically low: {}",
        last_best
    );
}
