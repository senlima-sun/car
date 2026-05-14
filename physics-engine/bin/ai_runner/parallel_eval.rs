#![allow(dead_code)]

use std::cell::RefCell;

use car_physics_engine::engine::PhysicsEngine;

use crate::policies::lookahead::LOOKAHEAD_PARAM_COUNT;
use crate::reward::{evaluate, EvalResult};
use crate::track_loader::LoadedTrack;

thread_local! {
    // Option<PhysicsEngine> + take/replace so a panic mid-`f` doesn't leave
    // the RefCell borrowed and silo this rayon thread for the rest of the
    // process (Phase 4 review Critical #2).
    static THREAD_ENGINE: RefCell<Option<PhysicsEngine>> = RefCell::new(Some(PhysicsEngine::new()));
}

#[inline]
pub fn with_thread_engine<R>(f: impl FnOnce(&mut PhysicsEngine) -> R) -> R {
    let mut engine = THREAD_ENGINE
        .with(|cell| cell.borrow_mut().take())
        .unwrap_or_else(PhysicsEngine::new);
    // Borrow guard from `take()` is already dropped — f can panic safely.
    let result = f(&mut engine);
    THREAD_ENGINE.with(|cell| *cell.borrow_mut() = Some(engine));
    result
}

pub fn evaluate_on_thread_engine(
    params: &[f32; LOOKAHEAD_PARAM_COUNT],
    track: &LoadedTrack,
    record_telemetry: bool,
    max_t_s: f32,
    off_track_kill_s: f32,
) -> EvalResult {
    with_thread_engine(|engine| {
        evaluate(
            params,
            track,
            engine,
            record_telemetry,
            max_t_s,
            off_track_kill_s,
        )
    })
}

pub fn make_par_eval_fn<'a>(
    track: &'a LoadedTrack,
    max_t_s: f32,
    off_track_kill_s: f32,
) -> impl Fn(&[f32], usize) -> f32 + Sync + Send + 'a {
    move |params: &[f32], _child_idx: usize| {
        if params.len() != LOOKAHEAD_PARAM_COUNT {
            return f32::NEG_INFINITY;
        }
        let mut arr = [0.0_f32; LOOKAHEAD_PARAM_COUNT];
        arr.copy_from_slice(params);
        let result =
            evaluate_on_thread_engine(&arr, track, false, max_t_s, off_track_kill_s);
        result.fitness
    }
}

fn _assert_sync_invariants() {
    fn assert_sync<T: Sync>() {}
    fn assert_send<T: Send>() {}
    assert_sync::<LoadedTrack>();
    assert_send::<PhysicsEngine>();
}
