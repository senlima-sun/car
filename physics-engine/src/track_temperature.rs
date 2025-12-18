use rustc_hash::FxHashMap;
use crate::types::{AmbientConditions, AquaplaningState, GridCell, TrackBounds};

const DEFAULT_CELL_SIZE: f32 = 2.0;
const MAX_CELLS: usize = 5000;
const TEXTURE_SIZE: usize = 512;
const HEAT_RADIUS: f32 = 3.0;
const DRIVING_RADIUS: f32 = 2.0; // Smaller radius for normal driving (just under car)
const CELL_PRUNE_THRESHOLD: f32 = 0.01;
const WETNESS_GAIN_RATE: f32 = 0.15; // Rain wetness gain (increased so rain > car drying)
const WETNESS_DECAY_RATE: f32 = 0.02;
const CAR_SKID_DRYING_RATE: f32 = 0.3; // Drying rate during skids (reduced from 0.5)
const DRIVING_HEAT_RATE: f32 = 0.15; // Heat from normal driving
const DRIVING_DRY_RATE: f32 = 0.08; // Drying rate from normal driving (less than rain gain)
const RUBBER_BUILDUP_RATE: f32 = 0.1;
const RUBBER_DECAY_RATE: f32 = 0.001;
const ICE_FORMATION_RATE: f32 = 0.05;
const ICE_MELT_RATE: f32 = 0.1;
const FREEZING_THRESHOLD: f32 = 0.286; // ~0C in normalized scale (-20 to 50C)
const TIRE_TRACK_TRANSFER_RATE: f32 = 0.35; // Heat transfer rate between tire and track (increased)
const TRACK_AMBIENT_MULTIPLIER: f32 = 0.4; // How much ambient temp affects track baseline

// Rubber deposit constants for tire marks
const RUBBER_CONTACT_RADIUS: f32 = 0.5; // Smaller than heat radius - wheel contact patch
const RUBBER_UV_DECAY_RATE: f32 = 0.0003; // Natural UV/time decay (~30s for noticeable fade)
const RUBBER_RAIN_WASH_RATE: f32 = 0.015; // Rain washes away rubber faster
const RUBBER_HOT_DECAY_RATE: f32 = 0.0005; // Hot weather accelerates decay
const MIN_SPEED_FOR_RUBBER: f32 = 2.0; // Minimum speed (m/s) to leave rubber marks

// Road surface thermal properties
// Asphalt has high thermal mass - retains heat much better than grass/dirt
const ROAD_DECAY_MULTIPLIER: f32 = 0.3; // Roads lose heat 70% slower than non-road surfaces
const ROAD_RAIN_DECAY_MULTIPLIER: f32 = 2.5; // Rain significantly accelerates road cooling

// Water depth and aquaplaning constants
const WATER_ACCUMULATION_RATE: f32 = 0.08; // Water pools during rain
const WATER_DRAINAGE_BASE_RATE: f32 = 0.03; // Base drainage when rain stops
const MAX_WATER_DEPTH: f32 = 1.0;
const AQUAPLANING_MIN_SPEED: f32 = 22.2; // 80 km/h in m/s
const AQUAPLANING_WATER_THRESHOLD: f32 = 0.7; // Minimum water depth for aquaplaning
const AQUAPLANING_SPEED_FACTOR: f32 = 0.02; // Higher speed = more likely
const AQUAPLANING_INTENSITY_THRESHOLD: f32 = 0.3; // Min intensity to trigger
const SHELTERED_DRYING_MULTIPLIER: f32 = 3.0; // Sheltered areas dry faster

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

                let cell = self.cells.entry((cell_x, cell_z)).or_insert_with(|| {
                    let mut c = GridCell::new();
                    c.last_updated = self.time;
                    c
                });

                cell.temperature = (cell.temperature + heat_gain).min(1.0);
                cell.wetness = (cell.wetness - CAR_SKID_DRYING_RATE * falloff * delta_seconds).max(0.0);
                // Water depth also reduces when car drives through
                cell.water_depth = (cell.water_depth - CAR_SKID_DRYING_RATE * 0.5 * falloff * delta_seconds).max(0.0);
                // Rubber builds up from skidding (slower than heat)
                let rubber_gain = RUBBER_BUILDUP_RATE * skid_intensity * falloff * delta_seconds;
                cell.rubber_buildup = (cell.rubber_buildup + rubber_gain).min(1.0);
                // Car driving clears ice
                cell.ice_formation = (cell.ice_formation - 0.3 * falloff * delta_seconds).max(0.0);
                cell.last_updated = self.time;
                self.texture_dirty = true;
            }
        }
    }

    /// Update track temperature based on normal driving (not skidding)
    /// This creates heat trails and dries wet road from tire contact
    pub fn update_car_driving(
        &mut self,
        world_x: f32,
        world_z: f32,
        speed_ms: f32,
        delta_seconds: f32,
    ) {
        // Only update if car is moving at reasonable speed
        if speed_ms < 1.0 || self.cells.len() >= MAX_CELLS {
            return;
        }

        // Speed factor: 0 at 0 m/s, 1.0 at 30 m/s (~108 km/h)
        let speed_factor = (speed_ms / 30.0).min(1.0);

        let cell_radius = (DRIVING_RADIUS / self.cell_size).ceil() as i32;
        let (center_x, center_z) = self.world_to_cell(world_x, world_z);

        for dx in -cell_radius..=cell_radius {
            for dz in -cell_radius..=cell_radius {
                let cell_x = center_x + dx;
                let cell_z = center_z + dz;

                let cell_world_x = cell_x as f32 * self.cell_size + self.cell_size * 0.5;
                let cell_world_z = cell_z as f32 * self.cell_size + self.cell_size * 0.5;

                let dist_sq = (cell_world_x - world_x).powi(2) + (cell_world_z - world_z).powi(2);
                let dist = dist_sq.sqrt();

                if dist > DRIVING_RADIUS {
                    continue;
                }

                let falloff = 1.0 - dist / DRIVING_RADIUS;
                let heat_gain = DRIVING_HEAT_RATE * speed_factor * falloff * delta_seconds;
                let dry_amount = DRIVING_DRY_RATE * speed_factor * falloff * delta_seconds;

                let cell = self.cells.entry((cell_x, cell_z)).or_insert_with(|| {
                    let mut c = GridCell::new();
                    c.last_updated = self.time;
                    c
                });

                // Increase temperature from tire friction
                cell.temperature = (cell.temperature + heat_gain).min(1.0);
                // Decrease wetness (car dries the road)
                cell.wetness = (cell.wetness - dry_amount).max(0.0);
                // Water depth also reduces when car drives through (displaces water)
                cell.water_depth = (cell.water_depth - dry_amount * 0.5).max(0.0);
                // Clear ice when driving over it
                cell.ice_formation = (cell.ice_formation - 0.1 * speed_factor * falloff * delta_seconds).max(0.0);
                cell.last_updated = self.time;
                self.texture_dirty = true;
            }
        }
    }

    /// Update weather effects on all cells (decay, wetness, ice, water depth)
    /// Wrapper for tests - calls update_weather_with_ambient with wind_cooling = 1.0
    pub fn update_weather(
        &mut self,
        ambient: &AmbientConditions,
        delta_seconds: f32,
    ) {
        self.update_weather_with_ambient(ambient, 1.0, delta_seconds);

        // Periodic pruning
        self.prune_timer += delta_seconds;
        if self.prune_timer >= 5.0 {
            self.prune_timer = 0.0;
            self.prune_empty_cells();
        }
    }

    /// Update weather effects on all cells with wind cooling modifier
    pub fn update_weather_with_ambient(
        &mut self,
        ambient: &AmbientConditions,
        wind_cooling_multiplier: f32,
        delta_seconds: f32,
    ) {
        let celsius = ambient.to_celsius();
        let rain_intensity = ambient.rain_intensity;
        let is_raining = rain_intensity > 0.01;
        let is_freezing = ambient.temperature < FREEZING_THRESHOLD;

        // Base decay rate from temperature
        // Cold: fast decay, Hot: slow decay, Normal: medium
        let base_decay_rate = if celsius < 5.0 {
            0.018 // Cold
        } else if celsius > 35.0 {
            0.002 // Hot
        } else {
            0.004 // Normal
        };

        // Rain increases decay
        let weather_decay_rate = if is_raining {
            base_decay_rate * (1.0 + rain_intensity * 2.0) // Up to 3x decay with heavy rain
        } else {
            base_decay_rate
        };

        let mut cells_modified = false;

        // Update all cells
        for cell in self.cells.values_mut() {
            // Calculate decay rate based on surface type and wind
            // Roads retain heat better (lower decay) unless it's raining
            let surface_decay = if cell.is_road {
                if is_raining {
                    // Rain accelerates cooling on roads (water conducts heat away)
                    weather_decay_rate * ROAD_RAIN_DECAY_MULTIPLIER
                } else {
                    // Roads retain heat much better in dry conditions
                    weather_decay_rate * ROAD_DECAY_MULTIPLIER
                }
            } else {
                weather_decay_rate
            };

            // Wind increases cooling rate
            let decay_rate = surface_decay * wind_cooling_multiplier;

            // Temperature decay (enhanced by wind)
            let old_temp = cell.temperature;
            cell.temperature = (cell.temperature - decay_rate * delta_seconds).max(0.0);

            // Wetness and water depth changes - scaled by rain_exposure, wind helps drying
            if is_raining {
                let effective_rain = rain_intensity * cell.rain_exposure;
                cell.wetness = (cell.wetness + WETNESS_GAIN_RATE * effective_rain * delta_seconds).min(1.0);

                // Water depth accumulation (affected by drainage)
                let water_gain = WATER_ACCUMULATION_RATE * effective_rain * delta_seconds;
                let water_drain = cell.drainage_rate * WATER_DRAINAGE_BASE_RATE * delta_seconds;
                cell.water_depth = (cell.water_depth + water_gain - water_drain).clamp(0.0, MAX_WATER_DEPTH);
            } else {
                // Wind helps dry the track, sheltered areas also dry faster
                let dry_multiplier = if cell.rain_exposure < 0.5 {
                    SHELTERED_DRYING_MULTIPLIER * wind_cooling_multiplier
                } else {
                    wind_cooling_multiplier
                };
                cell.wetness = (cell.wetness - WETNESS_DECAY_RATE * dry_multiplier * delta_seconds).max(0.0);
                // Water drains faster with wind
                let drain_rate = WATER_DRAINAGE_BASE_RATE * (1.0 + cell.drainage_rate) * wind_cooling_multiplier * delta_seconds;
                cell.water_depth = (cell.water_depth - drain_rate).max(0.0);
            }

            // Ice formation/melting
            if is_freezing {
                let ice_potential = cell.wetness.max(ambient.humidity * 0.5);
                let ice_gain = ICE_FORMATION_RATE * ice_potential * (FREEZING_THRESHOLD - ambient.temperature) * delta_seconds;
                cell.ice_formation = (cell.ice_formation + ice_gain).min(1.0);
            } else {
                let melt_factor = (ambient.temperature - FREEZING_THRESHOLD).min(0.2);
                cell.ice_formation = (cell.ice_formation - ICE_MELT_RATE * melt_factor * delta_seconds).max(0.0);
            }

            // Rubber decay based on ambient conditions (wind helps drying/decay)
            let rubber_decay_rate = if is_raining {
                RUBBER_RAIN_WASH_RATE * rain_intensity.max(0.3) * wind_cooling_multiplier
            } else if celsius > 35.0 {
                RUBBER_HOT_DECAY_RATE * wind_cooling_multiplier
            } else if celsius < 5.0 {
                RUBBER_UV_DECAY_RATE * 0.5
            } else {
                RUBBER_UV_DECAY_RATE * wind_cooling_multiplier.sqrt() // Wind has modest effect
            };
            cell.rubber_buildup = (cell.rubber_buildup - rubber_decay_rate * delta_seconds).max(0.0);

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
            cell.temperature > CELL_PRUNE_THRESHOLD
                || cell.wetness > CELL_PRUNE_THRESHOLD
                || cell.rubber_buildup > CELL_PRUNE_THRESHOLD
                || cell.ice_formation > CELL_PRUNE_THRESHOLD
                || cell.water_depth > CELL_PRUNE_THRESHOLD
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
    /// R = temperature (car heat)
    /// G = wetness (rain)
    /// B = rubber (lower 4 bits) + ice (upper 4 bits)
    /// A = full alpha
    fn rebuild_texture(&mut self) {
        // Clear texture
        self.texture_data.fill(0);

        for ((cell_x, cell_z), cell) in &self.cells {
            if let Some((u, v)) = self.cell_to_texture(*cell_x, *cell_z) {
                let idx = (v * TEXTURE_SIZE + u) * 4;
                if idx + 3 < self.texture_data.len() {
                    self.texture_data[idx] = (cell.temperature * 255.0) as u8;     // R = temperature
                    self.texture_data[idx + 1] = (cell.wetness * 255.0) as u8;     // G = wetness
                    // Pack rubber (lower 4 bits) and ice (upper 4 bits) into B channel
                    let rubber_packed = (cell.rubber_buildup * 15.0).min(15.0) as u8;
                    let ice_packed = (cell.ice_formation * 15.0).min(15.0) as u8;
                    self.texture_data[idx + 2] = rubber_packed | (ice_packed << 4); // B = rubber + ice
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

    /// Get temperature at a world position (0.0 to 1.0, or None if no data)
    pub fn get_temperature_at(&self, world_x: f32, world_z: f32) -> Option<f32> {
        let (cell_x, cell_z) = self.world_to_cell(world_x, world_z);
        self.cells.get(&(cell_x, cell_z)).map(|c| c.temperature)
    }

    /// Get temperature at position, or ambient baseline if no data
    pub fn get_temperature_or_ambient(&self, world_x: f32, world_z: f32, ambient_temp: f32) -> f32 {
        self.get_temperature_at(world_x, world_z)
            .unwrap_or(ambient_temp * TRACK_AMBIENT_MULTIPLIER)
    }

    /// Get water depth at a world position (0.0 to 1.0)
    pub fn get_water_depth_at(&self, world_x: f32, world_z: f32) -> f32 {
        let (cell_x, cell_z) = self.world_to_cell(world_x, world_z);
        self.cells.get(&(cell_x, cell_z))
            .map(|c| c.water_depth)
            .unwrap_or(0.0)
    }

    /// Set rain exposure for a cell (0.0 = fully sheltered, 1.0 = open sky)
    pub fn set_rain_exposure(&mut self, world_x: f32, world_z: f32, exposure: f32) {
        let (cell_x, cell_z) = self.world_to_cell(world_x, world_z);
        let cell = self.cells.entry((cell_x, cell_z)).or_insert_with(|| {
            let mut c = GridCell::new();
            c.last_updated = self.time;
            c
        });
        cell.rain_exposure = exposure.clamp(0.0, 1.0);
    }

    /// Set drainage rate for a cell (higher = faster drainage, based on slope)
    pub fn set_drainage_rate(&mut self, world_x: f32, world_z: f32, rate: f32) {
        let (cell_x, cell_z) = self.world_to_cell(world_x, world_z);
        let cell = self.cells.entry((cell_x, cell_z)).or_insert_with(|| {
            let mut c = GridCell::new();
            c.last_updated = self.time;
            c
        });
        cell.drainage_rate = rate.clamp(0.0, 2.0);
    }

    /// Mark a cell as road surface (roads retain heat better)
    pub fn set_road_cell(&mut self, world_x: f32, world_z: f32, is_road: bool) {
        let (cell_x, cell_z) = self.world_to_cell(world_x, world_z);
        let cell = self.cells.entry((cell_x, cell_z)).or_insert_with(|| {
            let mut c = GridCell::new();
            c.last_updated = self.time;
            c
        });
        cell.is_road = is_road;
    }

    /// Mark a rectangular region as road surface
    /// Useful for registering entire road segments at once
    pub fn set_road_region(&mut self, min_x: f32, min_z: f32, max_x: f32, max_z: f32, is_road: bool) {
        let (start_cell_x, start_cell_z) = self.world_to_cell(min_x, min_z);
        let (end_cell_x, end_cell_z) = self.world_to_cell(max_x, max_z);

        for cell_x in start_cell_x..=end_cell_x {
            for cell_z in start_cell_z..=end_cell_z {
                let cell = self.cells.entry((cell_x, cell_z)).or_insert_with(|| {
                    let mut c = GridCell::new();
                    c.last_updated = self.time;
                    c
                });
                cell.is_road = is_road;
            }
        }
        self.texture_dirty = true;
    }

    /// Check for aquaplaning conditions at a position
    /// Returns aquaplaning state with intensity based on speed and water depth
    pub fn check_aquaplaning(&self, world_x: f32, world_z: f32, speed_ms: f32) -> AquaplaningState {
        // No aquaplaning below minimum speed
        if speed_ms < AQUAPLANING_MIN_SPEED {
            return AquaplaningState::default();
        }

        let water_depth = self.get_water_depth_at(world_x, world_z);

        // No aquaplaning without enough standing water
        if water_depth < AQUAPLANING_WATER_THRESHOLD {
            return AquaplaningState::default();
        }

        // Calculate aquaplaning intensity based on speed and water depth
        let speed_factor = (speed_ms - AQUAPLANING_MIN_SPEED) * AQUAPLANING_SPEED_FACTOR;
        let water_factor = (water_depth - AQUAPLANING_WATER_THRESHOLD)
            / (MAX_WATER_DEPTH - AQUAPLANING_WATER_THRESHOLD);
        let intensity = (speed_factor * water_factor).clamp(0.0, 1.0);

        // Only trigger if intensity exceeds threshold
        let is_aquaplaning = intensity > AQUAPLANING_INTENSITY_THRESHOLD;

        AquaplaningState {
            is_aquaplaning,
            intensity,
            affected_wheels: [true, true, true, true], // All wheels affected
        }
    }

    /// Bidirectional heat exchange between tire and track surface
    ///
    /// When tire is hotter than track: tire cools, track heats up
    /// When track is hotter than tire: tire heats up, track cools
    ///
    /// Returns the heat delta for the tire (positive = tire gains heat, negative = tire loses heat)
    pub fn update_tire_track_exchange(
        &mut self,
        world_x: f32,
        world_z: f32,
        tire_temperature: f32,  // Average tire temperature (0.0-1.0, maps to 20-150C)
        ambient_temp: f32,      // Ambient temperature (0.0-1.0, maps to -20 to 50C)
        delta_seconds: f32,
    ) -> f32 {
        if self.cells.len() >= MAX_CELLS {
            return 0.0;
        }

        let (cell_x, cell_z) = self.world_to_cell(world_x, world_z);

        // Get or create the track cell
        // Track baseline temp based on ambient (track surface is warmer than air)
        let track_baseline = ambient_temp * TRACK_AMBIENT_MULTIPLIER;
        let cell = self.cells.entry((cell_x, cell_z)).or_insert_with(|| {
            let mut c = GridCell::new();
            c.temperature = track_baseline;
            c.last_updated = self.time;
            c
        });

        // Convert to common temperature scale for comparison
        // Tire: 0-1 = 20-150C (130C range)
        // Track display: 0-1 range, but we want it relative to tire temps
        // A tire at 1.0 (150C) should significantly heat the track
        // A track at baseline (~0.25) is around ambient temp

        // Temperature difference in "track units"
        // Tire at 150C (1.0) vs track at 25C equivalent (~0.25) = large positive diff
        let temp_diff = tire_temperature - cell.temperature;

        // Heat flows from hot to cold
        // Positive temp_diff = tire is hotter, heat flows to track
        let heat_to_track = temp_diff * TIRE_TRACK_TRANSFER_RATE * delta_seconds;

        // Update track temperature (track gains heat from hot tire)
        cell.temperature = (cell.temperature + heat_to_track).clamp(0.0, 1.0);
        cell.last_updated = self.time;
        self.texture_dirty = true;

        // Tire loses/gains heat inversely
        // Track has more thermal mass, so tire effect is scaled down
        // But still significant enough that hot tires can cool on cold track
        -heat_to_track * 0.15
    }

    /// Update rubber deposits from per-wheel positions
    /// This creates tire marks on the track surface
    ///
    /// # Arguments
    /// * `wheel_positions` - [FL, FR, RL, RR] wheel positions as [x, z] world coordinates
    /// * `wheel_intensities` - [FL, FR, RL, RR] rubber deposit intensities (0.0-1.0)
    /// * `delta_seconds` - Time delta
    pub fn update_rubber_per_wheel(
        &mut self,
        wheel_positions: &[[f32; 2]; 4],
        wheel_intensities: &[f32; 4],
        delta_seconds: f32,
    ) {
        if self.cells.len() >= MAX_CELLS {
            return;
        }

        let cell_radius = (RUBBER_CONTACT_RADIUS / self.cell_size).ceil() as i32;

        for wheel_idx in 0..4 {
            let intensity = wheel_intensities[wheel_idx];

            // Skip if intensity is too low
            if intensity < 0.01 {
                continue;
            }

            let world_x = wheel_positions[wheel_idx][0];
            let world_z = wheel_positions[wheel_idx][1];
            let (center_x, center_z) = self.world_to_cell(world_x, world_z);

            for dx in -cell_radius..=cell_radius {
                for dz in -cell_radius..=cell_radius {
                    let cell_x = center_x + dx;
                    let cell_z = center_z + dz;

                    // Calculate cell center in world space
                    let cell_world_x = cell_x as f32 * self.cell_size + self.cell_size * 0.5;
                    let cell_world_z = cell_z as f32 * self.cell_size + self.cell_size * 0.5;

                    // Distance from wheel to cell center
                    let dist = ((cell_world_x - world_x).powi(2)
                              + (cell_world_z - world_z).powi(2)).sqrt();

                    if dist > RUBBER_CONTACT_RADIUS {
                        continue;
                    }

                    // Falloff from center of wheel contact patch
                    let falloff = 1.0 - (dist / RUBBER_CONTACT_RADIUS);
                    let rubber_gain = RUBBER_BUILDUP_RATE * intensity * falloff * delta_seconds;

                    let cell = self.cells.entry((cell_x, cell_z)).or_insert_with(|| {
                        let mut c = GridCell::new();
                        c.last_updated = self.time;
                        c
                    });

                    cell.rubber_buildup = (cell.rubber_buildup + rubber_gain).min(1.0);
                    cell.last_updated = self.time;
                    self.texture_dirty = true;
                }
            }
        }
    }

    /// Get wetness at a world position (for rubber intensity calculation)
    pub fn get_wetness_at(&self, world_x: f32, world_z: f32) -> f32 {
        let (cell_x, cell_z) = self.world_to_cell(world_x, world_z);
        self.cells.get(&(cell_x, cell_z))
            .map(|c| c.wetness)
            .unwrap_or(0.0)
    }
}

/// Calculate rubber deposit intensity for a single wheel
/// Returns intensity value from 0.0 to 1.0
///
/// Formula: base_intensity * speed_factor * wetness_factor * temp_factor * compound_mult
pub fn calculate_rubber_intensity(
    slip_angle: f32,            // Slip angle in degrees
    lateral_g: f32,             // Lateral G-force
    longitudinal_g: f32,        // Longitudinal G-force (braking/accel)
    speed_ms: f32,              // Speed in m/s
    is_braking: bool,
    is_handbrake: bool,
    is_drifting: bool,
    tire_temp: f32,             // Tire temperature 0-1 normalized
    track_wetness: f32,         // Track wetness 0-1
    compound_multiplier: f32,   // Tire compound rubber deposit multiplier
) -> f32 {
    // No rubber marks at very low speeds
    if speed_ms < MIN_SPEED_FOR_RUBBER {
        return 0.0;
    }

    // Base intensity from slip angle
    let slip_angle_abs = slip_angle.abs();
    let slip_intensity = if is_drifting {
        // Drifting: high slip angle = high rubber deposit
        (slip_angle_abs / 30.0).min(1.0) * 0.9
    } else {
        // Normal driving: lower intensity, caps at 0.5
        (slip_angle_abs / 45.0).min(0.5)
    };

    // G-force contribution (braking and cornering)
    let g_intensity = ((lateral_g.abs() + longitudinal_g.abs()) / 2.0).min(0.6);

    // Braking boost for front wheels (handled by caller for per-wheel)
    let brake_boost = if is_braking { 0.3 } else { 0.0 };

    // Handbrake creates strong rear wheel marks
    let handbrake_boost = if is_handbrake { 0.5 } else { 0.0 };

    // Combine base intensities
    let base_intensity = (slip_intensity + g_intensity + brake_boost + handbrake_boost).min(1.0);

    // Speed factor: ramps from 0 at 2 m/s to 1 at 17 m/s (~60 km/h)
    let speed_factor = ((speed_ms - MIN_SPEED_FOR_RUBBER) / 15.0).clamp(0.0, 1.0);

    // Wetness reduces rubber transfer (water film prevents adhesion)
    let wetness_factor = 1.0 - track_wetness * 0.7;

    // Temperature factor: cold tires deposit less, hot tires deposit more
    let temp_factor = if tire_temp < 0.3 {
        0.6  // Cold tires
    } else if tire_temp > 0.7 {
        1.3  // Hot tires (more rubber transfer)
    } else {
        1.0  // Optimal temperature
    };

    // Final intensity with compound multiplier
    let final_intensity = base_intensity * speed_factor * wetness_factor * temp_factor * compound_multiplier;

    final_intensity.clamp(0.0, 1.0)
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

        // Let it decay (dry weather - 25C, 30% humidity, no rain)
        let ambient = AmbientConditions::from_celsius(25.0, 0.3);
        for _ in 0..300 {
            grid.update_weather(&ambient, 1.0 / 60.0);
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

        // Simulate rain (rainy ambient conditions with rain_intensity set)
        let ambient = AmbientConditions::new(15.0, 0.9, 0.8); // 15C, 90% humidity, 80% rain
        for _ in 0..180 {
            grid.update_weather(&ambient, 1.0 / 60.0);
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

    #[test]
    fn test_road_retains_heat_better() {
        // Road surfaces should lose heat slower than non-road surfaces
        let mut road_grid = TrackTemperatureGrid::new(2.0, TrackBounds::default());
        let mut grass_grid = TrackTemperatureGrid::new(2.0, TrackBounds::default());

        // Add heat to both grids
        road_grid.update_car_position(0.0, 0.0, 1.0, 0.5);
        grass_grid.update_car_position(0.0, 0.0, 1.0, 0.5);

        // Mark road grid cell as road surface
        road_grid.set_road_cell(0.0, 0.0, true);

        let (cx, cz) = road_grid.world_to_cell(0.0, 0.0);
        let initial_road_temp = road_grid.cells.get(&(cx, cz)).unwrap().temperature;
        let initial_grass_temp = grass_grid.cells.get(&(cx, cz)).unwrap().temperature;

        // Verify they start at the same temperature
        assert!((initial_road_temp - initial_grass_temp).abs() < 0.01);

        // Let them decay (dry weather - road should retain heat better)
        let ambient = AmbientConditions::from_celsius(25.0, 0.3);
        for _ in 0..600 { // 10 seconds at 60fps
            road_grid.update_weather(&ambient, 1.0 / 60.0);
            grass_grid.update_weather(&ambient, 1.0 / 60.0);
            road_grid.update_time(1.0 / 60.0);
            grass_grid.update_time(1.0 / 60.0);
        }

        let final_road_temp = road_grid.cells.get(&(cx, cz)).map(|c| c.temperature).unwrap_or(0.0);
        let final_grass_temp = grass_grid.cells.get(&(cx, cz)).map(|c| c.temperature).unwrap_or(0.0);

        // Road should retain more heat (higher temperature)
        assert!(final_road_temp > final_grass_temp,
            "Road temp {} should be > grass temp {}", final_road_temp, final_grass_temp);
    }

    #[test]
    fn test_road_loses_heat_faster_in_rain() {
        // Road surfaces should lose heat faster when it's raining
        let mut road_grid = TrackTemperatureGrid::new(2.0, TrackBounds::default());
        let mut grass_grid = TrackTemperatureGrid::new(2.0, TrackBounds::default());

        // Add heat to both grids
        road_grid.update_car_position(0.0, 0.0, 1.0, 0.5);
        grass_grid.update_car_position(0.0, 0.0, 1.0, 0.5);

        // Mark road grid cell as road surface
        road_grid.set_road_cell(0.0, 0.0, true);

        let (cx, cz) = road_grid.world_to_cell(0.0, 0.0);

        // Let them decay in rain (road should lose heat faster)
        let ambient = AmbientConditions::new(15.0, 0.9, 0.8); // 15C, 90% humidity, 80% rain
        for _ in 0..600 { // 10 seconds at 60fps
            road_grid.update_weather(&ambient, 1.0 / 60.0);
            grass_grid.update_weather(&ambient, 1.0 / 60.0);
            road_grid.update_time(1.0 / 60.0);
            grass_grid.update_time(1.0 / 60.0);
        }

        let final_road_temp = road_grid.cells.get(&(cx, cz)).map(|c| c.temperature).unwrap_or(0.0);
        let final_grass_temp = grass_grid.cells.get(&(cx, cz)).map(|c| c.temperature).unwrap_or(0.0);

        // In rain, road should lose heat faster (lower temperature) than grass
        // Due to ROAD_RAIN_DECAY_MULTIPLIER = 2.5
        assert!(final_road_temp < final_grass_temp,
            "Road temp {} should be < grass temp {} in rain", final_road_temp, final_grass_temp);
    }

    #[test]
    fn test_set_road_region() {
        let mut grid = TrackTemperatureGrid::new(2.0, TrackBounds::default());

        // Set a rectangular region as road
        grid.set_road_region(-5.0, -5.0, 5.0, 5.0, true);

        // Check cells within the region
        let (cx, cz) = grid.world_to_cell(0.0, 0.0);
        assert!(grid.cells.get(&(cx, cz)).map(|c| c.is_road).unwrap_or(false));

        let (cx2, cz2) = grid.world_to_cell(4.0, 4.0);
        assert!(grid.cells.get(&(cx2, cz2)).map(|c| c.is_road).unwrap_or(false));

        // Check cell outside the region (should not exist or not be road)
        let (cx3, cz3) = grid.world_to_cell(10.0, 10.0);
        assert!(!grid.cells.get(&(cx3, cz3)).map(|c| c.is_road).unwrap_or(false));
    }
}
