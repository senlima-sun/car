#![allow(dead_code)]

use std::hash::Hasher;

use rand::distributions::Distribution;
use rand::distributions::Uniform;
use rand::rngs::StdRng;
use rand::Rng;
use rand::SeedableRng;

#[inline]
fn sample_standard_normal(rng: &mut StdRng) -> f32 {
    let u1: f32 = rng.gen_range(f32::MIN_POSITIVE..1.0);
    let u2: f32 = rng.gen_range(0.0..1.0);
    let r = (-2.0_f32 * u1.ln()).sqrt();
    let theta = 2.0_f32 * std::f32::consts::PI * u2;
    r * theta.cos()
}

use crate::policies::lookahead::LOOKAHEAD_PARAM_COUNT;

pub const PARAM_BOUNDS: [(f32, f32); LOOKAHEAD_PARAM_COUNT] = [
    (50.0, 400.0),
    (10.0, 200.0),
    (0.0, 1000.0),
    (0.0, 0.5),
    (-6.0, 6.0),
    (0.0, 4.0),
    (0.1, 5.0),
    (0.0, 0.1),
    (0.0, 0.1),
    (0.0, 0.1),
    (0.0, 2.0),
    (0.0, 2.0),
    (0.0, 1.0),
    (0.0, 2.0),
    (0.0, 0.05),
    (0.01, 1.0),
    (0.0, 10.0),
    (-3.0, 3.0),
    (0.0, 60.0),
    (0.0, 5.0),
    (0.0, 0.5),
    (-1.0, 1.0),
    (-1.0, 1.0),
    (-1.0, 1.0),
];

pub const INITIAL_SIGMA_MONZA: [f32; LOOKAHEAD_PARAM_COUNT] = [
    35.0,
    19.0,
    100.0,
    0.05,
    1.2,
    0.4,
    0.49,
    0.01,
    0.01,
    0.01,
    0.2,
    0.2,
    0.1,
    0.2,
    0.005,
    0.099,
    1.0,
    0.5,
    6.0,
    0.5,
    0.08,
    0.1,
    0.1,
    0.1,
];

const _: () = {
    assert!(PARAM_BOUNDS.len() == LOOKAHEAD_PARAM_COUNT);
    assert!(INITIAL_SIGMA_MONZA.len() == LOOKAHEAD_PARAM_COUNT);
    assert!(crate::policies::lookahead::BASELINE_PARAMS_MONZA.len() == LOOKAHEAD_PARAM_COUNT);
};

#[derive(Debug, Clone)]
pub struct Individual {
    pub params: Vec<f32>,
    pub fitness: f32,
    pub sigma: Vec<f32>,
    pub child_index: usize,
    pub generation_born: u32,
}

#[derive(Debug, Clone)]
pub struct GenerationResult {
    pub generation: u32,
    pub best_fitness: f32,
    pub best_params: Vec<f32>,
    pub lap_completed: bool,
    pub lap_time_s: f32,
    pub off_track_count: u32,
    pub all_offspring: Vec<Individual>,
}

pub struct Population {
    pub dim: usize,
    pub mu: usize,
    pub lambda: usize,
    pub parents: Vec<Individual>,
    pub master_seed: u64,
    pub generation: u32,
}

// Stable across Rust versions and platforms: splitmix64 mixer applied to
// a structured combine of (master_seed, generation, child_idx). Reviewer
// flagged FxHasher as not stability-guaranteed.
#[inline]
fn splitmix64(mut x: u64) -> u64 {
    x = x.wrapping_add(0x9e3779b97f4a7c15);
    let mut z = x;
    z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
    z ^ (z >> 31)
}

#[inline]
pub fn child_seed(master_seed: u64, generation: u32, child_idx: usize) -> u64 {
    let combined = master_seed
        ^ ((generation as u64).wrapping_mul(0xd1342543de82ef95))
        ^ ((child_idx as u64).wrapping_mul(0x9e3779b97f4a7c15));
    splitmix64(combined)
}

#[inline]
fn clamp_to_bounds(params: &mut [f32]) {
    for (v, (lo, hi)) in params.iter_mut().zip(PARAM_BOUNDS.iter()) {
        if !v.is_finite() {
            *v = (*lo + *hi) * 0.5;
        }
        if *v < *lo {
            *v = *lo;
        } else if *v > *hi {
            *v = *hi;
        }
    }
}

#[inline]
fn clamp_sigma(sigma: &mut [f32]) {
    for (s, (lo, hi)) in sigma.iter_mut().zip(PARAM_BOUNDS.iter()) {
        let range = (*hi - *lo).max(f32::EPSILON);
        let min_s = range * 1e-4;
        let max_s = range * 0.5;
        if !s.is_finite() || *s < min_s {
            *s = min_s;
        } else if *s > max_s {
            *s = max_s;
        }
    }
}

#[inline]
fn tau(dim: usize) -> f32 {
    let d = (dim as f32).max(1.0);
    1.0 / (2.0 * d.sqrt()).sqrt()
}

#[inline]
pub fn mutate_child(
    parent_params: &[f32],
    parent_sigma: &[f32],
    rng: &mut StdRng,
    dim: usize,
) -> (Vec<f32>, Vec<f32>) {
    let tau_val = tau(dim);
    let mut new_sigma = Vec::with_capacity(dim);
    let mut new_params = Vec::with_capacity(dim);
    for i in 0..dim {
        let n_sigma: f32 = sample_standard_normal(rng);
        let s_new = parent_sigma[i] * (tau_val * n_sigma).exp();
        new_sigma.push(s_new);
    }
    clamp_sigma(&mut new_sigma);
    for i in 0..dim {
        let n_param: f32 = sample_standard_normal(rng);
        new_params.push(parent_params[i] + new_sigma[i] * n_param);
    }
    clamp_to_bounds(&mut new_params);
    (new_params, new_sigma)
}

impl Population {
    pub fn init(
        dim: usize,
        mu: usize,
        lambda: usize,
        master_seed: u64,
        baseline: &[f32],
        initial_sigma: &[f32],
    ) -> Self {
        assert_eq!(baseline.len(), dim, "baseline length must equal dim");
        assert_eq!(initial_sigma.len(), dim, "initial sigma length must equal dim");
        assert!(mu >= 1, "mu must be >= 1");
        assert!(lambda >= mu, "lambda must be >= mu");

        let mut parents = Vec::with_capacity(mu);
        for parent_idx in 0..mu {
            let seed = child_seed(master_seed, u32::MAX, parent_idx);
            let mut rng = StdRng::seed_from_u64(seed);
            let mut params = Vec::with_capacity(dim);
            for i in 0..dim {
                let n: f32 = sample_standard_normal(&mut rng);
                params.push(baseline[i] + initial_sigma[i] * 0.25 * n);
            }
            clamp_to_bounds(&mut params);
            let sigma = initial_sigma.to_vec();
            parents.push(Individual {
                params,
                fitness: f32::NEG_INFINITY,
                sigma,
                child_index: parent_idx,
                generation_born: 0,
            });
        }

        Self {
            dim,
            mu,
            lambda,
            parents,
            master_seed,
            generation: 0,
        }
    }

    pub fn step<F>(&mut self, mut eval_fn: F) -> GenerationResult
    where
        F: FnMut(&[f32], usize) -> f32,
    {
        let mut offspring: Vec<Individual> = Vec::with_capacity(self.lambda);
        let parent_picker = Uniform::from(0..self.parents.len());
        for child_idx in 0..self.lambda {
            let seed = child_seed(self.master_seed, self.generation, child_idx);
            let mut rng = StdRng::seed_from_u64(seed);
            let parent_idx = parent_picker.sample(&mut rng);
            let parent = &self.parents[parent_idx];
            let (params, sigma) = mutate_child(&parent.params, &parent.sigma, &mut rng, self.dim);
            let fitness = eval_fn(&params, child_idx);
            offspring.push(Individual {
                params,
                fitness,
                sigma,
                child_index: child_idx,
                generation_born: self.generation + 1,
            });
        }

        self.finalize_generation(offspring)
    }

    pub fn step_par<F>(&mut self, eval_fn: F) -> GenerationResult
    where
        F: Fn(&[f32], usize) -> f32 + Sync + Send,
    {
        use rayon::prelude::*;

        let parent_picker = Uniform::from(0..self.parents.len());
        let mut prepared: Vec<(usize, Vec<f32>, Vec<f32>)> = Vec::with_capacity(self.lambda);
        for child_idx in 0..self.lambda {
            let seed = child_seed(self.master_seed, self.generation, child_idx);
            let mut rng = StdRng::seed_from_u64(seed);
            let parent_idx = parent_picker.sample(&mut rng);
            let parent = &self.parents[parent_idx];
            let (params, sigma) =
                mutate_child(&parent.params, &parent.sigma, &mut rng, self.dim);
            prepared.push((child_idx, params, sigma));
        }

        let mut fitnesses: Vec<f32> = vec![0.0; self.lambda];
        prepared
            .par_iter()
            .map(|(idx, params, _)| eval_fn(params, *idx))
            .collect_into_vec(&mut fitnesses);

        let generation_born = self.generation + 1;
        let offspring: Vec<Individual> = prepared
            .into_iter()
            .zip(fitnesses.into_iter())
            .map(|((child_index, params, sigma), fitness)| Individual {
                params,
                fitness,
                sigma,
                child_index,
                generation_born,
            })
            .collect();

        self.finalize_generation(offspring)
    }

    pub fn finalize_generation(&mut self, offspring: Vec<Individual>) -> GenerationResult {
        let mut combined: Vec<Individual> =
            Vec::with_capacity(self.parents.len() + offspring.len());
        combined.extend(self.parents.iter().cloned());
        combined.extend(offspring.iter().cloned());

        combined.sort_by(|a, b| {
            b.fitness
                .partial_cmp(&a.fitness)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.generation_born.cmp(&b.generation_born))
                .then_with(|| a.child_index.cmp(&b.child_index))
        });

        let new_parents: Vec<Individual> = combined.into_iter().take(self.mu).collect();
        let best = &new_parents[0];
        let mut sorted_offspring = offspring.clone();
        sorted_offspring.sort_by(|a, b| {
            b.fitness
                .partial_cmp(&a.fitness)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.child_index.cmp(&b.child_index))
        });
        let result = GenerationResult {
            generation: self.generation + 1,
            best_fitness: best.fitness,
            best_params: best.params.clone(),
            lap_completed: false,
            lap_time_s: 0.0,
            off_track_count: 0,
            all_offspring: sorted_offspring,
        };

        self.parents = new_parents;
        self.generation += 1;
        result
    }

    pub fn next_generation_seeds(&self) -> Vec<u64> {
        (0..self.lambda)
            .map(|c| child_seed(self.master_seed, self.generation, c))
            .collect()
    }

    pub fn pick_parents_for_next_generation(&self) -> Vec<usize> {
        let parent_picker = Uniform::from(0..self.parents.len());
        let mut out = Vec::with_capacity(self.lambda);
        for child_idx in 0..self.lambda {
            let seed = child_seed(self.master_seed, self.generation, child_idx);
            let mut rng = StdRng::seed_from_u64(seed);
            out.push(parent_picker.sample(&mut rng));
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn synthetic_eval(params: &[f32], _child_idx: usize) -> f32 {
        params[0] + 0.01 * params[1]
    }

    fn make_pop(seed: u64) -> Population {
        let baseline = vec![0.0_f32; LOOKAHEAD_PARAM_COUNT];
        let sigma = vec![0.5_f32; LOOKAHEAD_PARAM_COUNT];
        Population::init(LOOKAHEAD_PARAM_COUNT, 4, 8, seed, &baseline, &sigma)
    }

    #[test]
    fn determinism_serial_step_matches_across_runs() {
        let mut pop_a = make_pop(42);
        let mut pop_b = make_pop(42);
        let mut last_a = f32::NEG_INFINITY;
        let mut last_b = f32::NEG_INFINITY;
        let mut last_params_a: Vec<f32> = Vec::new();
        let mut last_params_b: Vec<f32> = Vec::new();
        for _ in 0..5 {
            let a = pop_a.step(synthetic_eval);
            let b = pop_b.step(synthetic_eval);
            last_a = a.best_fitness;
            last_b = b.best_fitness;
            last_params_a = a.best_params;
            last_params_b = b.best_params;
        }
        assert_eq!(last_a.to_bits(), last_b.to_bits(), "best_fitness must be bit-identical");
        assert_eq!(last_params_a, last_params_b, "best_params must be identical");
    }

    #[test]
    fn finalize_generation_truncates_to_mu() {
        let mut pop = make_pop(7);
        let _gen = pop.step(synthetic_eval);
        assert_eq!(pop.parents.len(), pop.mu);
    }

    #[test]
    fn sorted_offspring_in_fitness_desc_order() {
        let mut pop = make_pop(11);
        let gen = pop.step(synthetic_eval);
        assert_eq!(gen.all_offspring.len(), pop.lambda);
        for w in gen.all_offspring.windows(2) {
            assert!(
                w[0].fitness >= w[1].fitness,
                "offspring not sorted: {} vs {}",
                w[0].fitness,
                w[1].fitness
            );
        }
    }

    #[test]
    fn mutate_child_respects_bounds() {
        let parent_params = vec![100.0_f32; LOOKAHEAD_PARAM_COUNT];
        let parent_sigma = vec![1000.0_f32; LOOKAHEAD_PARAM_COUNT];
        let mut rng = StdRng::seed_from_u64(99);
        let (params, sigma) =
            mutate_child(&parent_params, &parent_sigma, &mut rng, LOOKAHEAD_PARAM_COUNT);
        for (i, &v) in params.iter().enumerate() {
            let (lo, hi) = PARAM_BOUNDS[i];
            assert!(v >= lo && v <= hi, "param {i} = {v} outside [{lo}, {hi}]");
            assert!(v.is_finite());
        }
        for &s in &sigma {
            assert!(s.is_finite() && s > 0.0);
        }
    }

    #[test]
    fn tau_matches_standard_es_formula() {
        let expected = 1.0_f32 / (2.0_f32 * (LOOKAHEAD_PARAM_COUNT as f32).sqrt()).sqrt();
        assert!((tau(LOOKAHEAD_PARAM_COUNT) - expected).abs() < 1e-7);
    }

    #[test]
    fn child_seed_is_function_of_inputs() {
        let s1 = child_seed(42, 0, 0);
        let s2 = child_seed(42, 0, 0);
        let s3 = child_seed(42, 0, 1);
        let s4 = child_seed(42, 1, 0);
        assert_eq!(s1, s2);
        assert_ne!(s1, s3);
        assert_ne!(s1, s4);
    }

    // Locks the splitmix64 algorithm: if the constants drift, this fails
    // and the determinism contract across Rust versions is broken (see
    // Phase 4 review Critical #1).
    #[test]
    fn child_seed_locked_values() {
        assert_eq!(child_seed(42, 1, 3), 0x73662ffd86fcdeee);
        assert_eq!(child_seed(42, 0, 0), 0xbdd732262feb6e95);
    }
}
