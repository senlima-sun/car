use std::f32::consts::PI;

/// Linear interpolation between two values
#[inline]
pub fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

/// Smoothstep interpolation (ease in-out)
#[inline]
pub fn smoothstep(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// Clamp value between min and max
#[inline]
pub fn clamp(value: f32, min: f32, max: f32) -> f32 {
    value.max(min).min(max)
}

/// Convert degrees to radians
#[inline]
pub fn deg_to_rad(deg: f32) -> f32 {
    deg * PI / 180.0
}

/// Convert radians to degrees
#[inline]
pub fn rad_to_deg(rad: f32) -> f32 {
    rad * 180.0 / PI
}

/// Conversion factor for metres-per-second → kilometres-per-hour.
pub const MS_TO_KMH: f32 = 3.6;

/// Conversion factor for kilometres-per-hour → metres-per-second.
pub const KMH_TO_MS: f32 = 1.0 / 3.6;

#[inline]
pub fn ms_to_kmh(speed_ms: f32) -> f32 {
    speed_ms * MS_TO_KMH
}

#[inline]
pub fn kmh_to_ms(speed_kmh: f32) -> f32 {
    speed_kmh * KMH_TO_MS
}

/// Sanitize a number, returning fallback if NaN or infinite
#[inline]
pub fn sanitize(value: f32, fallback: f32) -> f32 {
    if value.is_finite() {
        value
    } else {
        fallback
    }
}

/// Vector3 operations
#[derive(Clone, Copy, Debug, Default)]
pub struct Vec3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl Vec3 {
    pub const ZERO: Self = Self {
        x: 0.0,
        y: 0.0,
        z: 0.0,
    };
    pub const UP: Self = Self {
        x: 0.0,
        y: 1.0,
        z: 0.0,
    };
    pub const FORWARD: Self = Self {
        x: 0.0,
        y: 0.0,
        z: 1.0,
    };
    pub const RIGHT: Self = Self {
        x: 1.0,
        y: 0.0,
        z: 0.0,
    };

    #[inline]
    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }

    #[inline]
    pub fn from_array(arr: [f32; 3]) -> Self {
        Self {
            x: arr[0],
            y: arr[1],
            z: arr[2],
        }
    }

    #[inline]
    pub fn to_array(self) -> [f32; 3] {
        [self.x, self.y, self.z]
    }

    #[inline]
    pub fn dot(self, other: Self) -> f32 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    #[inline]
    pub fn cross(self, other: Self) -> Self {
        Self {
            x: self.y * other.z - self.z * other.y,
            y: self.z * other.x - self.x * other.z,
            z: self.x * other.y - self.y * other.x,
        }
    }

    #[inline]
    pub fn length(self) -> f32 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    #[inline]
    pub fn length_squared(self) -> f32 {
        self.x * self.x + self.y * self.y + self.z * self.z
    }

    #[inline]
    pub fn normalize(self) -> Self {
        let len = self.length();
        if len > 0.0001 {
            Self {
                x: self.x / len,
                y: self.y / len,
                z: self.z / len,
            }
        } else {
            Self::ZERO
        }
    }

    #[inline]
    pub fn scale(self, s: f32) -> Self {
        Self {
            x: self.x * s,
            y: self.y * s,
            z: self.z * s,
        }
    }

    #[inline]
    pub fn add(self, other: Self) -> Self {
        Self {
            x: self.x + other.x,
            y: self.y + other.y,
            z: self.z + other.z,
        }
    }

    #[inline]
    pub fn sub(self, other: Self) -> Self {
        Self {
            x: self.x - other.x,
            y: self.y - other.y,
            z: self.z - other.z,
        }
    }

    #[inline]
    pub fn lerp(self, other: Self, t: f32) -> Self {
        Self {
            x: lerp(self.x, other.x, t),
            y: lerp(self.y, other.y, t),
            z: lerp(self.z, other.z, t),
        }
    }
}

/// Quaternion for rotations
#[derive(Clone, Copy, Debug)]
pub struct Quat {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub w: f32,
}

impl Default for Quat {
    fn default() -> Self {
        Self::IDENTITY
    }
}

impl Quat {
    pub const IDENTITY: Self = Self {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        w: 1.0,
    };

    #[inline]
    pub fn new(x: f32, y: f32, z: f32, w: f32) -> Self {
        Self { x, y, z, w }
    }

    #[inline]
    pub fn from_array(arr: [f32; 4]) -> Self {
        Self {
            x: arr[0],
            y: arr[1],
            z: arr[2],
            w: arr[3],
        }
    }

    #[inline]
    pub fn to_array(self) -> [f32; 4] {
        [self.x, self.y, self.z, self.w]
    }

    /// Rotate a vector by this quaternion
    #[inline]
    pub fn rotate_vec3(self, v: Vec3) -> Vec3 {
        // q * v * q^-1
        let qv = Vec3::new(self.x, self.y, self.z);
        let uv = qv.cross(v);
        let uuv = qv.cross(uv);
        v.add(uv.scale(2.0 * self.w)).add(uuv.scale(2.0))
    }

    /// Get forward direction (positive Z in local space rotated by quaternion)
    /// Note: In this game, the car model faces +Z direction
    #[inline]
    pub fn forward(self) -> Vec3 {
        self.rotate_vec3(Vec3::new(0.0, 0.0, 1.0))
    }

    /// Get right direction (positive X in local space rotated by quaternion)
    #[inline]
    pub fn right(self) -> Vec3 {
        self.rotate_vec3(Vec3::new(1.0, 0.0, 0.0))
    }

    /// Get up direction (positive Y in local space rotated by quaternion)
    #[inline]
    pub fn up(self) -> Vec3 {
        self.rotate_vec3(Vec3::new(0.0, 1.0, 0.0))
    }

    /// Extract yaw angle (rotation around Y axis) from quaternion
    /// Returns angle in radians
    #[inline]
    pub fn yaw(self) -> f32 {
        // Calculate yaw from quaternion
        // yaw = atan2(2*(w*y + x*z), 1 - 2*(y*y + z*z))
        // But for Y-up with car facing +Z, we use:
        let forward = self.forward();
        forward.x.atan2(forward.z)
    }

    /// Create quaternion from axis-angle
    pub fn from_axis_angle(axis: Vec3, angle: f32) -> Self {
        let half_angle = angle * 0.5;
        let s = half_angle.sin();
        let axis = axis.normalize();
        Self {
            x: axis.x * s,
            y: axis.y * s,
            z: axis.z * s,
            w: half_angle.cos(),
        }
    }

    /// Multiply two quaternions
    #[inline]
    pub fn mul(self, other: Self) -> Self {
        Self {
            x: self.w * other.x + self.x * other.w + self.y * other.z - self.z * other.y,
            y: self.w * other.y - self.x * other.z + self.y * other.w + self.z * other.x,
            z: self.w * other.z + self.x * other.y - self.y * other.x + self.z * other.w,
            w: self.w * other.w - self.x * other.x - self.y * other.y - self.z * other.z,
        }
    }

    /// Normalize the quaternion
    #[inline]
    pub fn normalize(self) -> Self {
        let len = (self.x * self.x + self.y * self.y + self.z * self.z + self.w * self.w).sqrt();
        if len > 0.0001 {
            Self {
                x: self.x / len,
                y: self.y / len,
                z: self.z / len,
                w: self.w / len,
            }
        } else {
            Self::IDENTITY
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::{FRAC_PI_2, PI};

    const EPSILON: f32 = 1e-5;

    fn approx_eq(a: f32, b: f32) -> bool {
        (a - b).abs() < EPSILON
    }

    fn vec3_approx_eq(a: Vec3, b: Vec3) -> bool {
        approx_eq(a.x, b.x) && approx_eq(a.y, b.y) && approx_eq(a.z, b.z)
    }

    #[test]
    fn vec3_dot_perpendicular_vectors_returns_zero() {
        let a = Vec3::new(1.0, 0.0, 0.0);
        let b = Vec3::new(0.0, 1.0, 0.0);
        assert!(approx_eq(a.dot(b), 0.0));
    }

    #[test]
    fn vec3_dot_parallel_vectors_returns_length_squared() {
        let a = Vec3::new(3.0, 4.0, 0.0);
        assert!(approx_eq(a.dot(a), a.length_squared()));
    }

    #[test]
    fn vec3_dot_antiparallel_vectors_returns_negative_length_squared() {
        let a = Vec3::new(2.0, 3.0, 1.0);
        let b = a.scale(-1.0);
        assert!(approx_eq(a.dot(b), -a.length_squared()));
    }

    #[test]
    fn vec3_cross_perpendicular_result() {
        let x = Vec3::RIGHT;
        let y = Vec3::UP;
        let result = x.cross(y);
        assert!(vec3_approx_eq(result, Vec3::new(0.0, 0.0, 1.0)));
    }

    #[test]
    fn vec3_cross_anticommutativity() {
        let a = Vec3::new(1.0, 2.0, 3.0);
        let b = Vec3::new(4.0, 5.0, 6.0);
        let ab = a.cross(b);
        let ba = b.cross(a);
        assert!(vec3_approx_eq(ab, ba.scale(-1.0)));
    }

    #[test]
    fn vec3_cross_parallel_vectors_returns_zero() {
        let a = Vec3::new(2.0, 0.0, 0.0);
        let b = Vec3::new(5.0, 0.0, 0.0);
        let result = a.cross(b);
        assert!(approx_eq(result.length(), 0.0));
    }

    #[test]
    fn vec3_cross_result_perpendicular_to_both_inputs() {
        let a = Vec3::new(1.0, 2.0, 3.0);
        let b = Vec3::new(4.0, 5.0, 6.0);
        let c = a.cross(b);
        assert!(approx_eq(c.dot(a), 0.0));
        assert!(approx_eq(c.dot(b), 0.0));
    }

    #[test]
    fn vec3_normalize_produces_unit_length() {
        let v = Vec3::new(3.0, 4.0, 0.0);
        let n = v.normalize();
        assert!(approx_eq(n.length(), 1.0));
    }

    #[test]
    fn vec3_normalize_preserves_direction() {
        let v = Vec3::new(0.0, 5.0, 0.0);
        let n = v.normalize();
        assert!(vec3_approx_eq(n, Vec3::new(0.0, 1.0, 0.0)));
    }

    #[test]
    fn vec3_normalize_zero_vector_returns_zero_no_nan() {
        let v = Vec3::ZERO;
        let n = v.normalize();
        assert!(vec3_approx_eq(n, Vec3::ZERO));
        assert!(!n.x.is_nan());
        assert!(!n.y.is_nan());
        assert!(!n.z.is_nan());
    }

    #[test]
    fn vec3_normalize_very_small_vector_returns_zero_no_nan() {
        let v = Vec3::new(1e-6, 0.0, 0.0);
        let n = v.normalize();
        assert!(!n.x.is_nan());
        assert!(!n.y.is_nan());
        assert!(!n.z.is_nan());
    }

    #[test]
    fn vec3_lerp_at_zero_returns_start() {
        let a = Vec3::new(1.0, 2.0, 3.0);
        let b = Vec3::new(10.0, 20.0, 30.0);
        let result = a.lerp(b, 0.0);
        assert!(vec3_approx_eq(result, a));
    }

    #[test]
    fn vec3_lerp_at_one_returns_end() {
        let a = Vec3::new(1.0, 2.0, 3.0);
        let b = Vec3::new(10.0, 20.0, 30.0);
        let result = a.lerp(b, 1.0);
        assert!(vec3_approx_eq(result, b));
    }

    #[test]
    fn vec3_lerp_at_half_returns_midpoint() {
        let a = Vec3::new(0.0, 0.0, 0.0);
        let b = Vec3::new(10.0, 20.0, 30.0);
        let result = a.lerp(b, 0.5);
        assert!(vec3_approx_eq(result, Vec3::new(5.0, 10.0, 15.0)));
    }

    #[test]
    fn vec3_length_of_unit_vectors() {
        assert!(approx_eq(Vec3::RIGHT.length(), 1.0));
        assert!(approx_eq(Vec3::UP.length(), 1.0));
        assert!(approx_eq(Vec3::FORWARD.length(), 1.0));
    }

    #[test]
    fn vec3_length_of_345_triangle() {
        let v = Vec3::new(3.0, 4.0, 0.0);
        assert!(approx_eq(v.length(), 5.0));
    }

    #[test]
    fn vec3_length_squared_avoids_sqrt() {
        let v = Vec3::new(3.0, 4.0, 0.0);
        assert!(approx_eq(v.length_squared(), 25.0));
    }

    #[test]
    fn vec3_length_squared_of_zero_is_zero() {
        assert!(approx_eq(Vec3::ZERO.length_squared(), 0.0));
    }

    #[test]
    fn vec3_add_two_vectors() {
        let a = Vec3::new(1.0, 2.0, 3.0);
        let b = Vec3::new(4.0, 5.0, 6.0);
        let result = a.add(b);
        assert!(vec3_approx_eq(result, Vec3::new(5.0, 7.0, 9.0)));
    }

    #[test]
    fn vec3_add_zero_is_identity() {
        let a = Vec3::new(1.0, 2.0, 3.0);
        assert!(vec3_approx_eq(a.add(Vec3::ZERO), a));
    }

    #[test]
    fn vec3_sub_two_vectors() {
        let a = Vec3::new(5.0, 7.0, 9.0);
        let b = Vec3::new(1.0, 2.0, 3.0);
        let result = a.sub(b);
        assert!(vec3_approx_eq(result, Vec3::new(4.0, 5.0, 6.0)));
    }

    #[test]
    fn vec3_sub_self_returns_zero() {
        let a = Vec3::new(3.0, 7.0, 11.0);
        assert!(vec3_approx_eq(a.sub(a), Vec3::ZERO));
    }

    #[test]
    fn vec3_scale_doubles_length() {
        let v = Vec3::new(1.0, 2.0, 3.0);
        let scaled = v.scale(2.0);
        assert!(vec3_approx_eq(scaled, Vec3::new(2.0, 4.0, 6.0)));
    }

    #[test]
    fn vec3_scale_by_zero_returns_zero() {
        let v = Vec3::new(1.0, 2.0, 3.0);
        assert!(vec3_approx_eq(v.scale(0.0), Vec3::ZERO));
    }

    #[test]
    fn vec3_scale_by_negative_reverses_direction() {
        let v = Vec3::new(1.0, 0.0, 0.0);
        let result = v.scale(-1.0);
        assert!(vec3_approx_eq(result, Vec3::new(-1.0, 0.0, 0.0)));
    }

    #[test]
    fn vec3_from_array_and_to_array_roundtrip() {
        let arr = [1.0, 2.0, 3.0];
        let v = Vec3::from_array(arr);
        let back = v.to_array();
        assert!(approx_eq(arr[0], back[0]));
        assert!(approx_eq(arr[1], back[1]));
        assert!(approx_eq(arr[2], back[2]));
    }

    #[test]
    fn quat_rotate_vec3_90_degrees_around_y() {
        let q = Quat::from_axis_angle(Vec3::UP, FRAC_PI_2);
        let v = Vec3::new(0.0, 0.0, 1.0);
        let result = q.rotate_vec3(v);
        assert!(vec3_approx_eq(result, Vec3::new(1.0, 0.0, 0.0)));
    }

    #[test]
    fn quat_rotate_vec3_180_degrees_around_y() {
        let q = Quat::from_axis_angle(Vec3::UP, PI);
        let v = Vec3::new(0.0, 0.0, 1.0);
        let result = q.rotate_vec3(v);
        assert!(vec3_approx_eq(result, Vec3::new(0.0, 0.0, -1.0)));
    }

    #[test]
    fn quat_rotate_vec3_90_degrees_around_x() {
        let q = Quat::from_axis_angle(Vec3::RIGHT, FRAC_PI_2);
        let v = Vec3::new(0.0, 1.0, 0.0);
        let result = q.rotate_vec3(v);
        assert!(vec3_approx_eq(result, Vec3::new(0.0, 0.0, 1.0)));
    }

    #[test]
    fn quat_from_axis_angle_zero_produces_identity() {
        let q = Quat::from_axis_angle(Vec3::UP, 0.0);
        assert!(approx_eq(q.x, 0.0));
        assert!(approx_eq(q.y, 0.0));
        assert!(approx_eq(q.z, 0.0));
        assert!(approx_eq(q.w, 1.0));
    }

    #[test]
    fn quat_identity_does_not_rotate() {
        let v = Vec3::new(1.0, 2.0, 3.0);
        let result = Quat::IDENTITY.rotate_vec3(v);
        assert!(vec3_approx_eq(result, v));
    }

    #[test]
    fn quat_yaw_matches_input_angle() {
        let angle = 0.7;
        let q = Quat::from_axis_angle(Vec3::UP, angle);
        assert!(approx_eq(q.yaw(), angle));
    }

    #[test]
    fn quat_yaw_zero_for_identity() {
        assert!(approx_eq(Quat::IDENTITY.yaw(), 0.0));
    }

    #[test]
    fn quat_yaw_negative_angle() {
        let angle = -1.2;
        let q = Quat::from_axis_angle(Vec3::UP, angle);
        assert!(approx_eq(q.yaw(), angle));
    }

    #[test]
    fn quat_rotation_preserves_vector_length() {
        let v = Vec3::new(3.0, 4.0, 5.0);
        let original_len = v.length();
        let q = Quat::from_axis_angle(Vec3::new(1.0, 1.0, 0.0).normalize(), 1.23);
        let rotated = q.rotate_vec3(v);
        assert!(approx_eq(rotated.length(), original_len));
    }

    #[test]
    fn quat_rotation_preserves_length_multiple_axes() {
        let v = Vec3::new(1.0, 0.0, 0.0);
        let q = Quat::from_axis_angle(Vec3::UP, 0.5).mul(Quat::from_axis_angle(Vec3::RIGHT, 0.3));
        let rotated = q.rotate_vec3(v);
        assert!(approx_eq(rotated.length(), v.length()));
    }

    #[test]
    fn quat_forward_right_up_mutually_perpendicular() {
        let q = Quat::from_axis_angle(Vec3::UP, 0.8);
        let f = q.forward();
        let r = q.right();
        let u = q.up();
        assert!(approx_eq(f.dot(r), 0.0));
        assert!(approx_eq(f.dot(u), 0.0));
        assert!(approx_eq(r.dot(u), 0.0));
    }

    #[test]
    fn quat_forward_right_up_are_unit_length() {
        let q = Quat::from_axis_angle(Vec3::new(1.0, 1.0, 1.0).normalize(), 1.5);
        assert!(approx_eq(q.forward().length(), 1.0));
        assert!(approx_eq(q.right().length(), 1.0));
        assert!(approx_eq(q.up().length(), 1.0));
    }

    #[test]
    fn quat_identity_forward_is_positive_z() {
        let f = Quat::IDENTITY.forward();
        assert!(vec3_approx_eq(f, Vec3::FORWARD));
    }

    #[test]
    fn quat_identity_right_is_positive_x() {
        let r = Quat::IDENTITY.right();
        assert!(vec3_approx_eq(r, Vec3::RIGHT));
    }

    #[test]
    fn quat_identity_up_is_positive_y() {
        let u = Quat::IDENTITY.up();
        assert!(vec3_approx_eq(u, Vec3::UP));
    }

    #[test]
    fn quat_mul_with_identity_is_unchanged() {
        let q = Quat::from_axis_angle(Vec3::UP, 1.0);
        let result = q.mul(Quat::IDENTITY);
        let v = Vec3::new(1.0, 2.0, 3.0);
        assert!(vec3_approx_eq(result.rotate_vec3(v), q.rotate_vec3(v)));
    }

    #[test]
    fn quat_normalize_produces_unit_quaternion() {
        let q = Quat::new(1.0, 2.0, 3.0, 4.0);
        let n = q.normalize();
        let len = (n.x * n.x + n.y * n.y + n.z * n.z + n.w * n.w).sqrt();
        assert!(approx_eq(len, 1.0));
    }

    #[test]
    fn quat_from_array_and_to_array_roundtrip() {
        let arr = [0.1, 0.2, 0.3, 0.9];
        let q = Quat::from_array(arr);
        let back = q.to_array();
        assert!(approx_eq(arr[0], back[0]));
        assert!(approx_eq(arr[1], back[1]));
        assert!(approx_eq(arr[2], back[2]));
        assert!(approx_eq(arr[3], back[3]));
    }

    #[test]
    fn smoothstep_at_zero_returns_zero() {
        assert!(approx_eq(smoothstep(0.0), 0.0));
    }

    #[test]
    fn smoothstep_at_one_returns_one() {
        assert!(approx_eq(smoothstep(1.0), 1.0));
    }

    #[test]
    fn smoothstep_at_half_returns_half() {
        assert!(approx_eq(smoothstep(0.5), 0.5));
    }

    #[test]
    fn smoothstep_clamps_below_zero() {
        assert!(approx_eq(smoothstep(-0.5), 0.0));
        assert!(approx_eq(smoothstep(-100.0), 0.0));
    }

    #[test]
    fn smoothstep_clamps_above_one() {
        assert!(approx_eq(smoothstep(1.5), 1.0));
        assert!(approx_eq(smoothstep(100.0), 1.0));
    }

    #[test]
    fn smoothstep_is_monotonically_increasing() {
        let mut prev = smoothstep(0.0);
        for i in 1..=100 {
            let t = i as f32 / 100.0;
            let val = smoothstep(t);
            assert!(val >= prev);
            prev = val;
        }
    }

    #[test]
    fn sanitize_passes_normal_values() {
        assert!(approx_eq(sanitize(42.0, 0.0), 42.0));
        assert!(approx_eq(sanitize(-1.5, 0.0), -1.5));
        assert!(approx_eq(sanitize(0.0, 99.0), 0.0));
    }

    #[test]
    fn sanitize_filters_nan() {
        assert!(approx_eq(sanitize(f32::NAN, 0.0), 0.0));
        assert!(approx_eq(sanitize(f32::NAN, -5.0), -5.0));
    }

    #[test]
    fn sanitize_filters_positive_infinity() {
        assert!(approx_eq(sanitize(f32::INFINITY, 0.0), 0.0));
    }

    #[test]
    fn sanitize_filters_negative_infinity() {
        assert!(approx_eq(sanitize(f32::NEG_INFINITY, 1.0), 1.0));
    }

    #[test]
    fn scalar_lerp_at_zero_returns_start() {
        assert!(approx_eq(lerp(10.0, 20.0, 0.0), 10.0));
    }

    #[test]
    fn scalar_lerp_at_one_returns_end() {
        assert!(approx_eq(lerp(10.0, 20.0, 1.0), 20.0));
    }

    #[test]
    fn scalar_lerp_at_half_returns_midpoint() {
        assert!(approx_eq(lerp(0.0, 100.0, 0.5), 50.0));
    }

    #[test]
    fn scalar_lerp_with_negative_values() {
        assert!(approx_eq(lerp(-10.0, 10.0, 0.5), 0.0));
    }

    #[test]
    fn scalar_lerp_extrapolation_beyond_one() {
        assert!(approx_eq(lerp(0.0, 10.0, 2.0), 20.0));
    }

    #[test]
    fn clamp_value_within_range_unchanged() {
        assert!(approx_eq(clamp(5.0, 0.0, 10.0), 5.0));
    }

    #[test]
    fn clamp_value_below_range_returns_min() {
        assert!(approx_eq(clamp(-5.0, 0.0, 10.0), 0.0));
    }

    #[test]
    fn clamp_value_above_range_returns_max() {
        assert!(approx_eq(clamp(15.0, 0.0, 10.0), 10.0));
    }

    #[test]
    fn clamp_value_at_min_boundary() {
        assert!(approx_eq(clamp(0.0, 0.0, 10.0), 0.0));
    }

    #[test]
    fn clamp_value_at_max_boundary() {
        assert!(approx_eq(clamp(10.0, 0.0, 10.0), 10.0));
    }

    #[test]
    fn deg_to_rad_zero() {
        assert!(approx_eq(deg_to_rad(0.0), 0.0));
    }

    #[test]
    fn deg_to_rad_180_is_pi() {
        assert!(approx_eq(deg_to_rad(180.0), PI));
    }

    #[test]
    fn deg_to_rad_90_is_half_pi() {
        assert!(approx_eq(deg_to_rad(90.0), FRAC_PI_2));
    }

    #[test]
    fn rad_to_deg_zero() {
        assert!(approx_eq(rad_to_deg(0.0), 0.0));
    }

    #[test]
    fn rad_to_deg_pi_is_180() {
        assert!(approx_eq(rad_to_deg(PI), 180.0));
    }

    #[test]
    fn deg_to_rad_and_back_roundtrip() {
        let original = 45.0;
        let result = rad_to_deg(deg_to_rad(original));
        assert!(approx_eq(result, original));
    }

    #[test]
    fn rad_to_deg_and_back_roundtrip() {
        let original = 1.234;
        let result = deg_to_rad(rad_to_deg(original));
        assert!(approx_eq(result, original));
    }

    #[test]
    fn deg_to_rad_negative_angle() {
        assert!(approx_eq(deg_to_rad(-90.0), -FRAC_PI_2));
    }

    #[test]
    fn deg_to_rad_360_is_two_pi() {
        assert!(approx_eq(deg_to_rad(360.0), 2.0 * PI));
    }
}
