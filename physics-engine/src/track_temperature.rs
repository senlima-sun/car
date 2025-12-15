use rustc_hash::FxHashMap;
use crate::types::{GridCell, TrackBounds, WeatherCondition};

const DEFAULT_CELL_SIZE: f32 = 2.0;
const MAX_CELLS: usize = 5000;
const TEXTURE_SIZE: usize = 512;
const HEAT_RADIUS: f32 = 3.0;
const CELL_PRUNE_THRESHOLD: f32 = 0.01;
const WETNESS_GAIN_RATE: f32 = 0.1;
const WETNESS_DECAY_RATE: f32 = 0.02;
const CAR_DRYING_RATE: f32 = 0.5;

#[derive(Debug)]
pub struct TrackTemperatureGrid {
    cells: FxHashMap<(i32, i32), GridCell>,
    cell_size: f32,
    bounds: TrackBounds,
    texture_dirty: bool,
    texture_data: Vec<u8>,
    time: f32,
    prune_timer: f32,
}

impl Default for TrackTemperatureGrid {
    fn default() -> Self {
        Self::new(DEFAULT_CELL_SIZE, TrackBounds::default())
    }
}

impl TrackTemperatureGrid {
    pub fn new(cell_size: f32, bounds: TrackBounds) -> Self {
        Self {
            cells: FxHashMap::default(),
            cell_size,
            bounds,
            texture_dirty: true,
            texture_data: vec![0u8; TEXTURE_SIZE * TEXTURE_SIZE * 4],
            time: 0.0,
            prune_timer: 0.0,
        }
    }

    pub fn init(&mut self, cell_size: f32, bounds: TrackBounds) {
        self.cell_size = cell_size;
        self.bounds = bounds;
        self.cells.clear();
        self.texture_dirty = true;
    }

    /// Convert world position to grid cell coordinates
    #[inline]
    fn world_to_cell(&self, x: f32, z: f32) -> (i32, i32) {
        let cell_x = (x / self.cell_size).floor() as i32;
        let cell_z = (z / self.cell_size).floor() as i32;
        (cell_x, cell_z)
    }

    /// Convert grid cell to texture UV coordinates
    #[inline]
    fn cell_to_texture(&self, cell_x: i32, cell_z: i32) -> Option<(usize, usize)> {
        let world_x = cell_x as f32 * self.cell_size;
        let world_z = cell_z as f32 * self.cell_size;

        if world_x < self.bounds.min_x || world_x > self.bounds.max_x
            || world_z < self.bounds.min_z || world_z > self.bounds.max_z {
            return None;
        }

        let u = ((world_x - self.bounds.min_x) / (self.bounds.max_x - self.bounds.min_x)
            * TEXTURE_SIZE as f32) as usize;
        let v = ((world_z - self.bounds.min_z) / (self.bounds.max_z - self.bounds.min_z)
            * TEXTURE_SIZE as f32) as usize;

        if u < TEXTURE_SIZE && v < TEXTURE_SIZE {
            Some((u, v))
        } else {
            None
        }
    }

    /// Update track temperature based on car position and skidding
    pub fn update_car_position(
        &mut self,
        world_x: f32,
        world_z: f32,
        skid_intensity: f32,
        delta_seconds: f32,
    ) {
        if skid_intensity < 0.01 || self.cells.len() >= MAX_CELLS {
            return;
        }

        let cell_radius = (HEAT_RADIUS / self.cell_size).ceil() as i32;
        let (center_x, center_z) = self.world_to_cell(world_x, world_z);

        for dx in -cell_radius..=cell_radius {
            for dz in -cell_radius..=cell_radius {
                let cell_x = center_x + dx;
                let cell_z = center_z + dz;

                let cell_world_x = cell_x as f32 * self.cell_size + self.cell_size * 0.5;
                let cell_world_z = cell_z as f32 * self.cell_size + self.cell_size * 0.5;

                let dist_sq = (cell_world_x - world_x).powi(2) + (cell_world_z - world_z).powi(2);
                let dist = dist_sq.sqrt();

                if dist > HEAT_RADIUS {
                    continue;
                }

                let falloff = 1.0 - dist / HEAT_RADIUS;
                let heat_gain = 0.8 * skid_intensity * falloff * delta_seconds;

                let cell = self.cells.entry((cell_x, cell_z)).or_insert(GridCell {
                    temperature: 0.0,
                    wetness: 0.0,
                    last_updated: self.time,
                });

                cell.temperature = (cell.temperature + heat_gain).min(1.0);
                cell.wetness = (cell.wetness - CAR_DRYING_RATE * falloff * delta_seconds).max(0.0);
                cell.last_updated = self.time;
                self.texture_dirty = true;
            }
        }
    }

    /// Update weather effects on all cells (decay, wetness)
    pub fn update_weather(&mut self, weather: WeatherCondition, delta_seconds: f32) {
        let decay_rate = match weather {
            WeatherCondition::Dry => 0.03,
            WeatherCondition::Hot => 0.015,
            WeatherCondition::Rain => 0.08,
            WeatherCondition::Cold => 0.12,
        };

        let is_raining = weather == WeatherCondition::Rain;
        let mut cells_modified = false;

        // Update all cells
        for cell in self.cells.values_mut() {
            // Temperature decay
            let old_temp = cell.temperature;
            cell.temperature = (cell.temperature - decay_rate * delta_seconds).max(0.0);

            // Wetness changes
            if is_raining {
                cell.wetness = (cell.wetness + WETNESS_GAIN_RATE * delta_seconds).min(1.0);
            } else {
                cell.wetness = (cell.wetness - WETNESS_DECAY_RATE * delta_seconds).max(0.0);
            }

            if (cell.temperature - old_temp).abs() > 0.001 {
                cells_modified = true;
            }
        }

        if cells_modified {
            self.texture_dirty = true;
        }

        // Periodic pruning
        self.prune_timer += delta_seconds;
        if self.prune_timer >= 5.0 {
            self.prune_timer = 0.0;
            self.prune_empty_cells();
        }
    }

    /// Remove cells with negligible values
    fn prune_empty_cells(&mut self) {
        let before_count = self.cells.len();
        self.cells.retain(|_, cell| {
            cell.temperature > CELL_PRUNE_THRESHOLD || cell.wetness > CELL_PRUNE_THRESHOLD
        });

        if self.cells.len() != before_count {
            self.texture_dirty = true;
        }
    }

    /// Update internal time
    pub fn update_time(&mut self, delta_seconds: f32) {
        self.time += delta_seconds;
    }

    /// Get texture data for rendering (RGBA format)
    pub fn get_texture_data(&mut self) -> &[u8] {
        if self.texture_dirty {
            self.rebuild_texture();
            self.texture_dirty = false;
        }
        &self.texture_data
    }

    /// Rebuild the texture from cell data
    fn rebuild_texture(&mut self) {
        // Clear texture
        self.texture_data.fill(0);

        for ((cell_x, cell_z), cell) in &self.cells {
            if let Some((u, v)) = self.cell_to_texture(*cell_x, *cell_z) {
                let idx = (v * TEXTURE_SIZE + u) * 4;
                if idx + 3 < self.texture_data.len() {
                    self.texture_data[idx] = (cell.temperature * 255.0) as u8;     // R = temperature
                    self.texture_data[idx + 1] = (cell.wetness * 255.0) as u8;     // G = wetness
                    self.texture_data[idx + 2] = 0;                                 // B = reserved
                    self.texture_data[idx + 3] = 255;                               // A = full alpha
                }
            }
        }
    }

    /// Get cell count for debugging
    pub fn get_cell_count(&self) -> usize {
        self.cells.len()
    }

    /// Check if texture needs update
    pub fn is_texture_dirty(&self) -> bool {
        self.texture_dirty
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_grid_init() {
        let grid = TrackTemperatureGrid::new(2.0, TrackBounds::default());
        assert_eq!(grid.get_cell_count(), 0);
    }

    #[test]
    fn test_heat_gain() {
        let mut grid = TrackTemperatureGrid::new(2.0, TrackBounds::default());

        // Simulate skidding at origin
        for _ in 0..60 {
            grid.update_car_position(0.0, 0.0, 1.0, 1.0 / 60.0);
            grid.update_time(1.0 / 60.0);
        }

        assert!(grid.get_cell_count() > 0);

        // Check center cell has heat
        let (cx, cz) = grid.world_to_cell(0.0, 0.0);
        let cell = grid.cells.get(&(cx, cz)).unwrap();
        assert!(cell.temperature > 0.0);
    }

    #[test]
    fn test_temperature_decay() {
        let mut grid = TrackTemperatureGrid::new(2.0, TrackBounds::default());

        // Add heat
        grid.update_car_position(0.0, 0.0, 1.0, 0.5);
        grid.update_time(0.5);

        let (cx, cz) = grid.world_to_cell(0.0, 0.0);
        let initial_temp = grid.cells.get(&(cx, cz)).unwrap().temperature;

        // Let it decay (dry weather)
        for _ in 0..300 {
            grid.update_weather(WeatherCondition::Dry, 1.0 / 60.0);
            grid.update_time(1.0 / 60.0);
        }

        let final_temp = grid.cells.get(&(cx, cz)).map(|c| c.temperature).unwrap_or(0.0);
        assert!(final_temp < initial_temp);
    }

    #[test]
    fn test_rain_wetness() {
        let mut grid = TrackTemperatureGrid::new(2.0, TrackBounds::default());

        // Create a cell first
        grid.update_car_position(0.0, 0.0, 1.0, 0.1);

        let (cx, cz) = grid.world_to_cell(0.0, 0.0);
        let initial_wetness = grid.cells.get(&(cx, cz)).unwrap().wetness;

        // Simulate rain
        for _ in 0..180 {
            grid.update_weather(WeatherCondition::Rain, 1.0 / 60.0);
            grid.update_time(1.0 / 60.0);
        }

        let final_wetness = grid.cells.get(&(cx, cz)).map(|c| c.wetness).unwrap_or(0.0);
        assert!(final_wetness > initial_wetness);
    }

    #[test]
    fn test_texture_generation() {
        let mut grid = TrackTemperatureGrid::new(2.0, TrackBounds::default());
        grid.update_car_position(0.0, 0.0, 1.0, 0.5);

        let texture = grid.get_texture_data();
        assert_eq!(texture.len(), TEXTURE_SIZE * TEXTURE_SIZE * 4);

        // Check that some pixels have non-zero values
        let has_heat = texture.chunks(4).any(|pixel| pixel[0] > 0);
        assert!(has_heat);
    }
}
