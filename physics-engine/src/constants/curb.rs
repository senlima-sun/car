use crate::types::CurbType;

pub const TOOTH_SPACING: f32 = 0.8;

pub fn amplitude_for_type(curb_type: CurbType) -> f32 {
    match curb_type {
        CurbType::Apex => 0.08,
        CurbType::Exit => 0.20,
        CurbType::Flat => 0.0,
    }
}

pub fn grip_for_type(curb_type: CurbType) -> f32 {
    match curb_type {
        CurbType::Apex => 0.97,
        CurbType::Exit => 0.93,
        CurbType::Flat => 0.98,
    }
}
