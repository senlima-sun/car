#![allow(dead_code)]

use std::cell::RefCell;

use car_physics_engine::engine::PhysicsEngine;

use crate::policies::lookahead::LOOKAHEAD_PARAM_COUNT;
use crate::reward::{evaluate, EvalResult};
use crate::track_loader::LoadedTrack;

thread_local! {
    static THREAD_ENGINE: RefCell<PhysicsEngine> = RefCell::new(PhysicsEngine::new());
}

#[inline]
pub fn with_thread_engine<R>(f: impl FnOnce(&mut PhysicsEngine) -> R) -> R {
    THREAD_ENGINE.with(|cell| {
        let mut engine = cell.borrow_mut();
        f(&mut engine)
    })
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
