use rustc_hash::FxHashMap;

use crate::constants::terrain::*;
use crate::types::*;

#[derive(Debug)]
pub struct TerrainChunk {
    cells: Box<[TerrainCell; CHUNK_SIZE * CHUNK_SIZE]>,
}

impl TerrainChunk {
    fn new() -> Self {
        Self {
            cells: Box::new([TerrainCell::default(); CHUNK_SIZE * CHUNK_SIZE]),
        }
    }

    fn get(&self, local_x: usize, local_z: usize) -> &TerrainCell {
        &self.cells[local_z * CHUNK_SIZE + local_x]
    }

    fn get_mut(&mut self, local_x: usize, local_z: usize) -> &mut TerrainCell {
        &mut self.cells[local_z * CHUNK_SIZE + local_x]
    }
}

#[derive(Debug)]
pub struct WheelHysteresis {
    consecutive_material: [u32; 4],
    current_material: [TerrainMaterial; 4],
    smoothed_grip: [f32; 4],
}

impl Default for WheelHysteresis {
    fn default() -> Self {
        Self {
            consecutive_material: [0; 4],
            current_material: [TerrainMaterial::Asphalt; 4],
            smoothed_grip: [1.0; 4],
        }
    }
}

#[derive(Debug)]
pub struct TerrainGrid {
    chunks: FxHashMap<(i32, i32), TerrainChunk>,
    cell_size: f32,
    origin_x: f32,
    origin_z: f32,
    hysteresis: WheelHysteresis,
}

impl TerrainGrid {
    pub fn new(cell_size: f32, origin_x: f32, origin_z: f32) -> Self {
        Self {
            chunks: FxHashMap::default(),
            cell_size,
            origin_x,
            origin_z,
            hysteresis: WheelHysteresis::default(),
        }
    }

    pub fn is_initialized(&self) -> bool {
        !self.chunks.is_empty()
    }

    pub fn world_to_cell(&self, x: f32, z: f32) -> (i32, i32) {
        let cx = ((x - self.origin_x) / self.cell_size).floor() as i32;
        let cz = ((z - self.origin_z) / self.cell_size).floor() as i32;
        (cx, cz)
    }

    pub fn cell_to_chunk_and_local(&self, cx: i32, cz: i32) -> ((i32, i32), (usize, usize)) {
        let chunk_size = CHUNK_SIZE as i32;
        let chunk_x = cx.div_euclid(chunk_size);
        let chunk_z = cz.div_euclid(chunk_size);
        let local_x = cx.rem_euclid(chunk_size) as usize;
        let local_z = cz.rem_euclid(chunk_size) as usize;
        ((chunk_x, chunk_z), (local_x, local_z))
    }

    pub fn get_cell(&self, world_x: f32, world_z: f32) -> Option<&TerrainCell> {
        let (cx, cz) = self.world_to_cell(world_x, world_z);
        let (chunk_key, (lx, lz)) = self.cell_to_chunk_and_local(cx, cz);
        self.chunks.get(&chunk_key).map(|chunk| chunk.get(lx, lz))
    }

    pub fn set_cell(
        &mut self,
        world_x: f32,
        world_z: f32,
        height_m: f32,
        material: TerrainMaterial,
    ) {
        let (cx, cz) = self.world_to_cell(world_x, world_z);
        let (chunk_key, (lx, lz)) = self.cell_to_chunk_and_local(cx, cz);
        let props = material_properties(material);
        let chunk = self
            .chunks
            .entry(chunk_key)
            .or_insert_with(TerrainChunk::new);
        *chunk.get_mut(lx, lz) = TerrainCell::new(height_m, material, props.roughness_factor);
    }

    pub fn set_region(
        &mut self,
        min_x: f32,
        min_z: f32,
        max_x: f32,
        max_z: f32,
        height_m: f32,
        material: TerrainMaterial,
    ) {
        let (min_cx, min_cz) = self.world_to_cell(min_x, min_z);
        let (max_cx, max_cz) = self.world_to_cell(max_x, max_z);
        let props = material_properties(material);
        let roughness = props.roughness_factor;
        for cz in min_cz..=max_cz {
            for cx in min_cx..=max_cx {
                let (chunk_key, (lx, lz)) = self.cell_to_chunk_and_local(cx, cz);
                let chunk = self
                    .chunks
                    .entry(chunk_key)
                    .or_insert_with(TerrainChunk::new);
                *chunk.get_mut(lx, lz) = TerrainCell::new(height_m, material, roughness);
            }
        }
    }

    fn get_cell_by_index(&self, cx: i32, cz: i32) -> TerrainCell {
        self.get_cell_by_index_checked(cx, cz).unwrap_or_default()
    }

    fn get_cell_by_index_checked(&self, cx: i32, cz: i32) -> Option<TerrainCell> {
        let (chunk_key, (lx, lz)) = self.cell_to_chunk_and_local(cx, cz);
        self.chunks.get(&chunk_key).and_then(|chunk| {
            let cell = *chunk.get(lx, lz);
            let is_uninitialized =
                cell.height == 0 && cell.material == 0 && cell.roughness_override == 0;
            if is_uninitialized {
                None
            } else {
                Some(cell)
            }
        })
    }

    pub fn query_point(&self, x: f32, z: f32) -> TerrainQueryResult {
        self.query_point_bilinear(x, z)
    }

    pub fn query_point_bilinear(&self, x: f32, z: f32) -> TerrainQueryResult {
        let fx = (x - self.origin_x) / self.cell_size;
        let fz = (z - self.origin_z) / self.cell_size;

        let ix = fx.floor() as i32;
        let iz = fz.floor() as i32;
        let tx = fx - fx.floor();
        let tz = fz - fz.floor();

        let cell_00 = self.get_cell_by_index_checked(ix, iz);
        let cell_10 = self.get_cell_by_index_checked(ix + 1, iz);
        let cell_01 = self.get_cell_by_index_checked(ix, iz + 1);
        let cell_11 = self.get_cell_by_index_checked(ix + 1, iz + 1);

        if let (Some(cell_00), Some(cell_10), Some(cell_01), Some(cell_11)) =
            (cell_00, cell_10, cell_01, cell_11)
        {
            let h00 = cell_00.height_m();
            let h10 = cell_10.height_m();
            let h01 = cell_01.height_m();
            let h11 = cell_11.height_m();

            let height = bilinear(h00, h10, h01, h11, tx, tz);

            let dh_dx = ((h10 - h00) + (h11 - h01)) * 0.5 / self.cell_size;
            let dh_dz = ((h01 - h00) + (h11 - h10)) * 0.5 / self.cell_size;
            let normal = normalize([-dh_dx, 1.0, -dh_dz]);

            let nearest_x = if tx >= 0.5 { ix + 1 } else { ix };
            let nearest_z = if tz >= 0.5 { iz + 1 } else { iz };
            let nearest_cell = self.get_cell_by_index(nearest_x, nearest_z);
            let material = nearest_cell.material();
            let properties = material_properties(material);

            let roughness = bilinear(
                cell_00.roughness(),
                cell_10.roughness(),
                cell_01.roughness(),
                cell_11.roughness(),
                tx,
                tz,
            );

            return TerrainQueryResult {
                height,
                material,
                properties,
                roughness,
                normal,
            };
        }

        let mut nearest_cell: Option<(TerrainCell, f32)> = None;
        for (candidate, corner_x, corner_z) in [
            (cell_00, 0.0f32, 0.0f32),
            (cell_10, 1.0f32, 0.0f32),
            (cell_01, 0.0f32, 1.0f32),
            (cell_11, 1.0f32, 1.0f32),
        ] {
            if let Some(cell) = candidate {
                let dx = tx - corner_x;
                let dz = tz - corner_z;
                let dist_sq = dx * dx + dz * dz;
                match nearest_cell {
                    Some((_, best_dist_sq)) if best_dist_sq <= dist_sq => {}
                    _ => nearest_cell = Some((cell, dist_sq)),
                }
            }
        }

        if let Some((cell, _)) = nearest_cell {
            let material = cell.material();
            return TerrainQueryResult {
                height: cell.height_m(),
                material,
                properties: material_properties(material),
                roughness: cell.roughness(),
                normal: [0.0, 1.0, 0.0],
            };
        }

        TerrainQueryResult::default()
    }

    pub fn query_point_bicubic(&self, x: f32, z: f32) -> TerrainQueryResult {
        let fx = (x - self.origin_x) / self.cell_size;
        let fz = (z - self.origin_z) / self.cell_size;

        let ix = fx.floor() as i32;
        let iz = fz.floor() as i32;
        let tx = fx - fx.floor();
        let tz = fz - fz.floor();

        // Fill the 4×4 stencil using the *checked* accessor. Any missing
        // cell falls back to bilinear (which has its own checked/default
        // path) — otherwise the Catmull-Rom interpolant pulls toward 0
        // at track borders, producing spurious dips that break suspension.
        let mut heights = [[0.0f32; 4]; 4];
        let mut roughness_vals = [[0.0f32; 4]; 4];
        for dz in 0..4 {
            for dx in 0..4 {
                let Some(cell) =
                    self.get_cell_by_index_checked(ix - 1 + dx as i32, iz - 1 + dz as i32)
                else {
                    return self.query_point_bilinear(x, z);
                };
                heights[dz][dx] = cell.height_m();
                roughness_vals[dz][dx] = cell.roughness();
            }
        }

        let height = bicubic_catmull_rom(&heights, tx, tz);

        let dh_dx = bicubic_catmull_rom_dx(&heights, tx, tz) / self.cell_size;
        let dh_dz = bicubic_catmull_rom_dz(&heights, tx, tz) / self.cell_size;
        let normal = normalize([-dh_dx, 1.0, -dh_dz]);

        let nearest_cell = self.get_cell_by_index(ix + (tx + 0.5) as i32, iz + (tz + 0.5) as i32);
        let material = nearest_cell.material();
        let properties = material_properties(material);

        let roughness = bilinear(
            roughness_vals[1][1],
            roughness_vals[1][2],
            roughness_vals[2][1],
            roughness_vals[2][2],
            tx,
            tz,
        );

        TerrainQueryResult {
            height,
            material,
            properties,
            roughness,
            normal,
        }
    }

    pub fn query_wheels(
        &mut self,
        positions: &[[f32; 2]; 4],
        prev_results: &[TerrainQueryResult; 4],
    ) -> [TerrainQueryResult; 4] {
        let mut results = [TerrainQueryResult::default(); 4];

        for i in 0..4 {
            let mut result = self.query_point(positions[i][0], positions[i][1]);

            let queried_material = result.material;
            if queried_material == self.hysteresis.current_material[i] {
                self.hysteresis.consecutive_material[i] = 0;
            } else {
                self.hysteresis.consecutive_material[i] += 1;
                if self.hysteresis.consecutive_material[i] > MATERIAL_HYSTERESIS_COUNT {
                    self.hysteresis.current_material[i] = queried_material;
                    self.hysteresis.consecutive_material[i] = 0;
                } else {
                    result.material = self.hysteresis.current_material[i];
                    result.properties = material_properties(self.hysteresis.current_material[i]);
                }
            }

            let queried_grip = result.properties.grip_coefficient;
            let prev_grip = prev_results[i].properties.grip_coefficient;
            let smoothed =
                prev_grip * (1.0 - GRIP_SMOOTHING_ALPHA) + queried_grip * GRIP_SMOOTHING_ALPHA;
            self.hysteresis.smoothed_grip[i] = smoothed;
            result.properties.grip_coefficient = smoothed;

            results[i] = result;
        }

        results
    }

    pub fn compute_bump_force(
        &self,
        x: f32,
        z: f32,
        speed_ms: f32,
        roughness: f32,
        _dt: f32,
    ) -> f32 {
        if roughness <= 0.0 || speed_ms <= 0.0 {
            return 0.0;
        }

        let speed_factor = (speed_ms / MAX_BUMP_SPEED).min(1.0);
        let mut octave_sum = 0.0f32;
        let mut amplitude = 1.0f32;
        let mut wavelength = BUMP_BASE_WAVELENGTH;

        for _ in 0..BUMP_OCTAVES {
            octave_sum += simplex2d(x / wavelength, z / wavelength) * amplitude;
            amplitude *= BUMP_PERSISTENCE;
            wavelength *= 0.5;
        }

        roughness * speed_factor * BASE_BUMP_AMPLITUDE * octave_sum
    }

    pub fn check_bottoming_out(
        &self,
        car_center_x: f32,
        car_center_z: f32,
        chassis_height: f32,
        speed_ms: f32,
    ) -> BottomingOutState {
        let result = self.query_point(car_center_x, car_center_z);
        check_bottoming_out_from_height(result.height, chassis_height, speed_ms)
    }
}

pub fn check_bottoming_out_from_height(
    terrain_height: f32,
    chassis_height: f32,
    speed_ms: f32,
) -> BottomingOutState {
    let clearance = chassis_height - terrain_height;

    if clearance >= PLANK_RIDE_HEIGHT {
        return BottomingOutState::default();
    }

    let scrape_intensity = (1.0 - clearance / PLANK_RIDE_HEIGHT).clamp(0.0, 1.0);
    let drag_force = scrape_intensity * speed_ms * speed_ms * PLANK_DRAG_COEFFICIENT;

    BottomingOutState {
        is_contact: true,
        scrape_intensity,
        drag_force,
    }
}

fn catmull_rom_basis(t: f32) -> [f32; 4] {
    let t2 = t * t;
    let t3 = t2 * t;
    [
        -0.5 * t3 + t2 - 0.5 * t,
        1.5 * t3 - 2.5 * t2 + 1.0,
        -1.5 * t3 + 2.0 * t2 + 0.5 * t,
        0.5 * t3 - 0.5 * t2,
    ]
}

fn catmull_rom_derivative(t: f32) -> [f32; 4] {
    let t2 = t * t;
    [
        -1.5 * t2 + 2.0 * t - 0.5,
        4.5 * t2 - 5.0 * t,
        -4.5 * t2 + 4.0 * t + 0.5,
        1.5 * t2 - t,
    ]
}

fn bicubic_catmull_rom(grid: &[[f32; 4]; 4], tx: f32, tz: f32) -> f32 {
    let bz = catmull_rom_basis(tz);
    let bx = catmull_rom_basis(tx);
    let mut val = 0.0;
    for j in 0..4 {
        for i in 0..4 {
            val += grid[j][i] * bx[i] * bz[j];
        }
    }
    val
}

fn bicubic_catmull_rom_dx(grid: &[[f32; 4]; 4], tx: f32, tz: f32) -> f32 {
    let bz = catmull_rom_basis(tz);
    let dbx = catmull_rom_derivative(tx);
    let mut val = 0.0;
    for j in 0..4 {
        for i in 0..4 {
            val += grid[j][i] * dbx[i] * bz[j];
        }
    }
    val
}

fn bicubic_catmull_rom_dz(grid: &[[f32; 4]; 4], tx: f32, tz: f32) -> f32 {
    let dbz = catmull_rom_derivative(tz);
    let bx = catmull_rom_basis(tx);
    let mut val = 0.0;
    for j in 0..4 {
        for i in 0..4 {
            val += grid[j][i] * bx[i] * dbz[j];
        }
    }
    val
}

fn bilinear(v00: f32, v10: f32, v01: f32, v11: f32, tx: f32, tz: f32) -> f32 {
    let a = v00 * (1.0 - tx) + v10 * tx;
    let b = v01 * (1.0 - tx) + v11 * tx;
    a * (1.0 - tz) + b * tz
}

fn normalize(v: [f32; 3]) -> [f32; 3] {
    let len = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    if len < 1e-10 {
        return [0.0, 1.0, 0.0];
    }
    [v[0] / len, v[1] / len, v[2] / len]
}

// ============================================================================
// 2D Simplex noise (inline, no crate dependency)
// ============================================================================

const PERM: [u8; 256] = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69,
    142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219,
    203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
    74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230,
    220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76,
    132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173,
    186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206,
    59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163,
    70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232,
    178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162,
    241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204,
    176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141,
    128, 195, 78, 66, 215, 61, 156, 180,
];

fn perm(i: i32) -> u8 {
    PERM[(i & 255) as usize]
}

fn grad2(hash: u8, x: f32, y: f32) -> f32 {
    match hash & 7 {
        0 => x + y,
        1 => x,
        2 => x - y,
        3 => -y,
        4 => -x - y,
        5 => -x,
        6 => -x + y,
        7 => y,
        _ => 0.0,
    }
}

fn simplex2d(x: f32, y: f32) -> f32 {
    const F2: f32 = 0.366025403; // (sqrt(3) - 1) / 2
    const G2: f32 = 0.211324865; // (3 - sqrt(3)) / 6

    let s = (x + y) * F2;
    let i = (x + s).floor() as i32;
    let j = (y + s).floor() as i32;

    let t = (i + j) as f32 * G2;
    let x0 = x - (i as f32 - t);
    let y0 = y - (j as f32 - t);

    let (i1, j1) = if x0 > y0 { (1, 0) } else { (0, 1) };

    let x1 = x0 - i1 as f32 + G2;
    let y1 = y0 - j1 as f32 + G2;
    let x2 = x0 - 1.0 + 2.0 * G2;
    let y2 = y0 - 1.0 + 2.0 * G2;

    let mut n = 0.0f32;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if t0 > 0.0 {
        let t0_sq = t0 * t0;
        n += t0_sq * t0_sq * grad2(perm(i + perm(j) as i32), x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if t1 > 0.0 {
        let t1_sq = t1 * t1;
        n += t1_sq * t1_sq * grad2(perm(i + i1 + perm(j + j1) as i32), x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if t2 > 0.0 {
        let t2_sq = t2 * t2;
        n += t2_sq * t2_sq * grad2(perm(i + 1 + perm(j + 1) as i32), x2, y2);
    }

    70.0 * n
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flat_grid_returns_zero_height_and_up_normal() {
        let mut grid = TerrainGrid::new(1.0, 0.0, 0.0);
        grid.set_region(0.0, 0.0, 10.0, 10.0, 0.0, TerrainMaterial::Asphalt);

        let result = grid.query_point(5.0, 5.0);
        assert!((result.height).abs() < 0.001);
        assert!((result.normal[0]).abs() < 0.01);
        assert!((result.normal[1] - 1.0).abs() < 0.01);
        assert!((result.normal[2]).abs() < 0.01);
    }

    #[test]
    fn linear_slope_correct_height_and_normal() {
        let mut grid = TerrainGrid::new(1.0, 0.0, 0.0);
        for cx in 0..20 {
            for cz in 0..20 {
                let h = cx as f32 * 0.1;
                grid.set_cell(cx as f32, cz as f32, h, TerrainMaterial::Asphalt);
            }
        }

        let result = grid.query_point(10.0, 10.0);
        assert!((result.height - 1.0).abs() < 0.05);
        assert!(result.normal[0] < -0.01, "normal should tilt against slope");
        assert!(result.normal[1] > 0.9);
    }

    #[test]
    fn chunk_boundary_no_discontinuity() {
        let mut grid = TerrainGrid::new(1.0, 0.0, 0.0);
        let boundary = CHUNK_SIZE as f32;
        grid.set_region(0.0, 0.0, boundary + 5.0, 5.0, 1.0, TerrainMaterial::Asphalt);

        let h_before = grid.query_point(boundary - 0.5, 2.5).height;
        let h_at = grid.query_point(boundary, 2.5).height;
        let h_after = grid.query_point(boundary + 0.5, 2.5).height;

        assert!(
            (h_before - h_at).abs() < 0.05,
            "discontinuity at chunk boundary"
        );
        assert!(
            (h_at - h_after).abs() < 0.05,
            "discontinuity at chunk boundary"
        );
    }

    #[test]
    fn out_of_bounds_returns_safe_default() {
        let grid = TerrainGrid::new(1.0, 0.0, 0.0);
        let result = grid.query_point(9999.0, 9999.0);
        assert!((result.height).abs() < 0.001);
        assert_eq!(result.material, TerrainMaterial::Asphalt);
        assert!((result.normal[1] - 1.0).abs() < 0.01);
    }

    #[test]
    fn sparse_bilinear_uses_nearest_cell_without_default_ramp() {
        let mut grid = TerrainGrid::new(1.0, 0.0, 0.0);
        grid.set_cell(0.0, 0.0, 1.0, TerrainMaterial::Grass);

        let result = grid.query_point(0.9, 0.9);
        assert!((result.height - 1.0).abs() < 0.001);
        assert_eq!(result.material, TerrainMaterial::Grass);
        assert!(result.roughness > 0.0);
    }

    #[test]
    fn four_wheels_flat_grid() {
        let mut grid = TerrainGrid::new(1.0, 0.0, 0.0);
        grid.set_region(0.0, 0.0, 20.0, 20.0, 0.0, TerrainMaterial::Asphalt);

        let positions = [[5.0, 5.0], [6.0, 5.0], [5.0, 7.0], [6.0, 7.0]];
        let prev = [TerrainQueryResult::default(); 4];
        let results = grid.query_wheels(&positions, &prev);

        for r in &results {
            assert!((r.height).abs() < 0.001);
        }
    }

    #[test]
    fn material_hysteresis_no_flicker() {
        let mut grid = TerrainGrid::new(1.0, 0.0, 0.0);
        grid.set_region(0.0, 0.0, 10.0, 10.0, 0.0, TerrainMaterial::Asphalt);
        grid.set_region(10.0, 0.0, 20.0, 10.0, 0.0, TerrainMaterial::Grass);

        let prev = [TerrainQueryResult::default(); 4];

        let positions_asphalt = [[5.0, 5.0], [5.0, 5.0], [5.0, 5.0], [5.0, 5.0]];
        let r1 = grid.query_wheels(&positions_asphalt, &prev);
        assert_eq!(r1[0].material, TerrainMaterial::Asphalt);

        let positions_grass = [[10.5, 5.0], [10.5, 5.0], [10.5, 5.0], [10.5, 5.0]];
        let r2 = grid.query_wheels(&positions_grass, &r1);
        assert_eq!(
            r2[0].material,
            TerrainMaterial::Asphalt,
            "should not switch after 1 query"
        );

        let r3 = grid.query_wheels(&positions_grass, &r2);
        assert_eq!(
            r3[0].material,
            TerrainMaterial::Asphalt,
            "should not switch after 2 queries"
        );

        let r4 = grid.query_wheels(&positions_grass, &r3);
        assert_eq!(
            r4[0].material,
            TerrainMaterial::Grass,
            "should switch after 3 queries"
        );
    }

    #[test]
    fn deterministic_bump_same_position() {
        let grid = TerrainGrid::new(1.0, 0.0, 0.0);
        let b1 = grid.compute_bump_force(3.7, 8.2, 20.0, 0.5, 0.008);
        let b2 = grid.compute_bump_force(3.7, 8.2, 20.0, 0.5, 0.008);
        assert_eq!(b1, b2);
    }

    #[test]
    fn zero_roughness_zero_bump() {
        let grid = TerrainGrid::new(1.0, 0.0, 0.0);
        let bump = grid.compute_bump_force(5.0, 5.0, 30.0, 0.0, 0.008);
        assert_eq!(bump, 0.0);
    }

    #[test]
    fn zero_speed_zero_bump() {
        let grid = TerrainGrid::new(1.0, 0.0, 0.0);
        let bump = grid.compute_bump_force(5.0, 5.0, 0.0, 0.5, 0.008);
        assert_eq!(bump, 0.0);
    }

    #[test]
    fn sufficient_clearance_no_contact() {
        let mut grid = TerrainGrid::new(1.0, 0.0, 0.0);
        grid.set_region(0.0, 0.0, 10.0, 10.0, 0.0, TerrainMaterial::Asphalt);

        let state = grid.check_bottoming_out(5.0, 5.0, 0.10, 50.0);
        assert!(!state.is_contact);
        assert_eq!(state.scrape_intensity, 0.0);
        assert_eq!(state.drag_force, 0.0);
    }

    #[test]
    fn low_clearance_contact_with_drag() {
        let mut grid = TerrainGrid::new(1.0, 0.0, 0.0);
        grid.set_region(0.0, 0.0, 10.0, 10.0, 0.0, TerrainMaterial::Asphalt);

        let state = grid.check_bottoming_out(5.0, 5.0, 0.01, 50.0);
        assert!(state.is_contact);
        assert!(state.scrape_intensity > 0.0);
        assert!(state.drag_force > 0.0);

        let expected_scrape = 1.0 - (0.01 / PLANK_RIDE_HEIGHT);
        assert!((state.scrape_intensity - expected_scrape).abs() < 0.01);
        let expected_drag = expected_scrape * 50.0 * 50.0 * PLANK_DRAG_COEFFICIENT;
        assert!((state.drag_force - expected_drag).abs() < 0.1);
    }

    #[test]
    fn terrain_cell_height_quantization_roundtrip() {
        let heights = [0.0, 1.0, 5.5, 32.0, 65.0];
        for h in heights {
            let cell = TerrainCell::new(h, TerrainMaterial::Asphalt, 0.5);
            let decoded = cell.height_m();
            assert!(
                (decoded - h).abs() < TerrainCell::HEIGHT_RESOLUTION + 0.001,
                "round-trip failed for h={}: got {}",
                h,
                decoded
            );
        }
    }

    #[test]
    fn set_region_covers_all_cells() {
        let mut grid = TerrainGrid::new(1.0, 0.0, 0.0);
        grid.set_region(0.0, 0.0, 4.0, 4.0, 2.0, TerrainMaterial::Grass);

        for x in 0..=4 {
            for z in 0..=4 {
                let cell = grid.get_cell(x as f32, z as f32);
                assert!(cell.is_some(), "missing cell at ({}, {})", x, z);
                let cell = cell.unwrap();
                assert_eq!(cell.material(), TerrainMaterial::Grass);
                assert!((cell.height_m() - 2.0).abs() < 0.01);
            }
        }
    }
}
