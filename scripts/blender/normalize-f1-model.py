import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SOURCE_ROOT_CANDIDATES = (
    "F1_2026_Audi_FOM.obj.cleaner.materialmerger.gles",
    "F1_Car",
)

GROUP_NAMES = {
    "body": "Body",
    "front_wing": "FrontWing",
    "rear_wing": "RearWing",
    "floor": "Floor",
    "suspension": "Suspension",
    "cockpit": "Cockpit",
    "mirrors": "Mirrors",
    "interior": "Interior",
    "aero": "AeroDetails",
    "cameras": "Cameras",
    "lights": "Lights",
    "unsorted": "Unsorted",
}

REQUIRED_OUTPUT_NAMES = (
    "F1_Car",
    "WheelAssembly_FL",
    "WheelAssembly_FR",
    "WheelAssembly_RL",
    "WheelAssembly_RR",
    "Wheel_FL",
    "Wheel_FR",
    "Wheel_RL",
    "Wheel_RR",
    "WheelCover_FL",
    "WheelCover_FR",
    "WheelCover_RL",
    "WheelCover_RR",
    "Car_Livery_FW",
    "Car_Livery_FW-M",
    "Car_Livery_FW-T",
    "Car_Livery_BW-M",
    "Car_Livery_BW-L",
    "Car_Livery_NOSE",
    "Car_Livery_PRE_NOSE",
    "Car_Livery_HALO",
)

ANIMATED_FLAP_NAMES = (
    "Car_Livery_FW-M",
    "Car_Livery_FW-T",
    "Car_Livery_BW-M",
    "Car_Livery_BW-L",
)

WHEEL_CENTERS = {
    "FL": (0.815894, -1.520892, 0.35899),
    "FR": (-0.815894, -1.520892, 0.35899),
    "RL": (0.77097, 2.063081, 0.358995),
    "RR": (-0.770969, 2.063074, 0.358987),
}

MATERIAL_RENAMES = {
    "livery_audi_01": "Livery_Audi_01",
    "livery_audi_01_carbon2": "Livery_Audi_Carbon_2",
    "livery_audi_01_wheel_hub": "Livery_Audi_Wheel_Hub",
}

OBJECT_RULES = {
    "360-camera": ("Camera_360", "cameras"),
    "airhorn": ("Body_Airbox_Horn", "body"),
    "asdf": ("Cockpit_Fairing_Small", "cockpit"),
    "Cockpit surround": ("Car_Livery_CockpitSurround", "cockpit"),
    "engine cover celling": ("Car_Livery_EngineCover_Top", "body"),
    "engine cover left": ("Car_Livery_EngineCover_L", "body"),
    "engine cover right": ("Car_Livery_EngineCover_R", "body"),
    "Exhaust tailpipe": ("Exhaust_Tailpipe", "rear_wing"),
    "front-left-bones": ("Suspension_Front_LowerArm_L", "suspension"),
    "front-left-bones.002": ("Suspension_Front_UpperArm_L", "suspension"),
    "front-right-bones": ("Suspension_Front_UpperArm_R", "suspension"),
    "front-wind-end-plate-left": ("FrontWing_Endplate_L", "front_wing"),
    "front-wing": ("FrontWing_MainAssembly", "front_wing"),
    "front-wing-1st-flap": ("FrontWing_Flap_Lower", "front_wing"),
    "front-wing-2nd-flap": ("Car_Livery_FW-M", "front_wing"),
    "front-wing-3rd-flap": ("Car_Livery_FW-T", "front_wing"),
    "front-wing-end-plate-right": ("FrontWing_Endplate_R", "front_wing"),
    "front-wing-main-plane": ("Car_Livery_FW", "front_wing"),
    "front-wing-manipulator": ("FrontWing_Adjuster", "front_wing"),
    "front-wing.002": ("FrontWing_Mount_Pin", "front_wing"),
    "halo base": ("Car_Livery_HALO_Base", "cockpit"),
    "halo-celling": ("Car_Livery_HALO", "cockpit"),
    "halo-front": ("Halo_Front", "cockpit"),
    "mirror-left-container": ("Car_Livery_LREARVIEW", "mirrors"),
    "mirror-left-glass": ("Mirror_Glass_L", "mirrors"),
    "mirror-right-container": ("Car_Livery_RREARVIEW", "mirrors"),
    "mirror-right-glass": ("Mirror_Glass_R", "mirrors"),
    "nose": ("Car_Livery_NOSE", "front_wing"),
    "nose-camera": ("Nose_Camera", "cameras"),
    "Object_2": ("Nose_Black_Detail", "front_wing"),
    "Object_3": ("SteeringWheel_ClearLed_Dot", "interior"),
    "Object_4": ("SteeringWheel_ClearLed_Pre", "interior"),
    "Object_6": ("SteeringWheel_Audi", "interior"),
    "Object_7": ("SteeringWheel_Decal", "interior"),
    "Object_10": ("SteeringWheel_LCD", "interior"),
    "Object_11": ("Cockpit_Metal_Detail", "interior"),
    "Object_12": ("Cockpit_Glass", "interior"),
    "Object_13": ("Rear_Light", "lights"),
    "Object_14": ("SteeringWheel_Revs_Display", "interior"),
    "Object_15": ("SteeringWheel_ClearLed", "interior"),
    "Object_16": ("Floor_Base_Panel", "floor"),
    "Object_17": ("Floor_Base_Panel_Secondary", "floor"),
    "Object_18": ("Cockpit_Black_Insert", "cockpit"),
    "Object_19": ("Floor_Carbon_Shell", "floor"),
    "Object_19.001": ("Diffuser_Carbon_Plane", "floor"),
    "Object_19.002": ("Floor_Carbon_Plank", "floor"),
    "Object_20": ("RearWing_Chrome_Pin", "rear_wing"),
    "Object_21": ("Cockpit_Chrome_Fasteners", "interior"),
    "Object_23": ("BrakeDisc_Front_Pair", "suspension"),
    "Object_24": ("Cockpit_Chrome_AO_Detail", "interior"),
    "Object_25": ("FrontSuspension_Carbon_CrossMember", "suspension"),
    "Object_26": ("Floor_Carbon_Upper", "floor"),
    "Object_26.002": ("WheelPanel_FR", "suspension"),
    "Object_26.003": ("Floor_Carbon_CenterDetail", "floor"),
    "Object_27": ("Floor_Carbon_Lower", "floor"),
    "Object_28": ("Cockpit_Detail_Rail", "cockpit"),
    "Object_28.001": ("EmptyGeometry_Cockpit_Detail", "unsorted"),
    "Object_29": ("SteeringWheel_Carbon_Back", "interior"),
    "Object_30": ("SteeringWheel_Frame", "interior"),
    "Object_33": ("Body_Generic_Shell", "body"),
    "Object_34": ("Cockpit_Generic_Insert", "cockpit"),
    "Object_35": ("Pedals", "interior"),
    "Object_36": ("SteeringWheel_Carbon_LedStrip", "interior"),
    "Object_37": ("WheelHubNuts_All", "suspension"),
    "Object_38": ("SteeringWheel_Kers_White", "interior"),
    "Object_41.001": ("Car_Livery_Sidepod_R", "body"),
    "Object_41.002": ("Car_Livery_Sidepod_L", "body"),
    "Object_41.003": ("Car_Livery_FrontSidepod_L", "body"),
    "Object_41.004": ("Car_Livery_FrontSidepod_R", "body"),
    "Object_41.005": ("Car_Livery_PRE_NOSE", "front_wing"),
    "Object_41.006": ("Nose_Livery_Detail", "front_wing"),
    "Object_41.007": ("Nose_Livery_Detail_Secondary", "front_wing"),
    "Object_41.008": ("Cockpit_Livery_Pin", "cockpit"),
    "Object_44": ("Car_Livery_1.001", "floor"),
    "Object_45": ("WheelCover_RL", "wheel_RL"),
    "Object_46": ("WheelHub_RL", "wheel_RL"),
    "Object_47": ("WheelCover_RR", "wheel_RR"),
    "Object_48": ("WheelHub_RR", "wheel_RR"),
    "Object_49": ("WheelCover_FL", "wheel_FL"),
    "Object_50": ("WheelHub_FL", "wheel_FL"),
    "Object_51": ("WheelCover_FR", "wheel_FR"),
    "Object_52": ("WheelHub_FR", "wheel_FR"),
    "Object_53": ("EmptyGeometry_Tread", "unsorted"),
    "Object_54": ("Cockpit_Plastic_Interior", "interior"),
    "Object_55": ("WheelSidewalls_All", "suspension"),
    "rear-right-bones": ("Suspension_Rear_UpperArm_R", "suspension"),
    "rear-wing": ("Car_Livery_BW-L", "rear_wing"),
    "rearring": ("Car_Livery_BW-M", "rear_wing"),
    "seat-belt": ("Seat_Belt", "interior"),
    "shoulder camera": ("Shoulder_Camera", "cameras"),
    "tcam": ("TCam", "cameras"),
    "tier-tread-front-left": ("Wheel_FL", "wheel_FL"),
    "tier-tread-front-right": ("Wheel_FR", "wheel_FR"),
    "tier-tread-rear-left": ("Wheel_RL", "wheel_RL"),
    "tier-tread-rear-right": ("Wheel_RR", "wheel_RR"),
    "upper-wishbone-front-left": ("Suspension_Front_Wishbone_L", "suspension"),
    "upper-wishbone-rear-left": ("Suspension_Rear_Wishbone_L", "suspension"),
    "upper-wishbone-rear-right": ("Suspension_Rear_Wishbone_R", "suspension"),
    "wheel-left-panel": ("WheelPanel_FL", "suspension"),
    "wheel-winglet-left": ("FrontWheelWinglet_L", "aero"),
    "wheel-winglet-right": ("FrontWheelWinglet_R", "aero"),
}


def args_after_separator():
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def ensure_name_available(name, existing):
    if name not in existing:
        existing.add(name)
        return name
    index = 2
    while True:
        candidate = f"{name}_{index:02d}"
        if candidate not in existing:
            existing.add(candidate)
            return candidate
        index += 1


def find_source_root():
    found = [bpy.data.objects[name] for name in SOURCE_ROOT_CANDIDATES if bpy.data.objects.get(name)]
    if len(found) > 1:
        raise RuntimeError("both original and normalized roots exist; refusing ambiguous input")
    if found:
        return found[0]
    empties = [obj for obj in bpy.data.objects if obj.type == "EMPTY"]
    if not empties:
        return None
    return max(empties, key=lambda obj: len(obj.children))


def create_empty(name, parent, location=None):
    empty = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(empty)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.25
    if location:
        empty.location = location
    if parent:
        empty.parent = parent
    return empty


def parent_keep_world(obj, parent):
    matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = matrix


def parent_mesh_at_parent_origin(obj, parent):
    if obj.type != "MESH" or obj.data is None:
        parent_keep_world(obj, parent)
        return
    world_vertices = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    parent_world_origin = parent.location.copy()
    obj.parent = parent
    obj.location = (0, 0, 0)
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)
    for vertex, world_vertex in zip(obj.data.vertices, world_vertices):
        vertex.co = world_vertex - parent_world_origin
    obj.data.update()


def world_bounds_center(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    center = Vector((0, 0, 0))
    for corner in corners:
        center += corner
    return center / len(corners)


def move_mesh_origin_to_world(obj, origin):
    if obj.type != "MESH" or obj.data is None:
        return
    world_vertices = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    matrix = obj.matrix_world.copy()
    matrix.translation = origin
    inverse = matrix.inverted()
    for vertex, world_vertex in zip(obj.data.vertices, world_vertices):
        vertex.co = inverse @ world_vertex
    obj.matrix_world = matrix
    obj.data.update()


def parse_args():
    argv = args_after_separator()
    if len(argv) < 3:
        raise RuntimeError(
            "usage: blender --background <source.blend> --python scripts/blender/normalize-f1-model.py -- <output.blend> <output.glb> <report.json>"
        )
    output_blend = Path(argv[0])
    output_glb = Path(argv[1])
    report = Path(argv[2])
    return output_blend, output_glb, report


def reject_already_normalized_input(source_root):
    if source_root.name != "F1_Car":
        return
    existing_groups = [name for name in GROUP_NAMES.values() if bpy.data.objects.get(name)]
    existing_wheels = [
        f"WheelAssembly_{suffix}"
        for suffix in WHEEL_CENTERS
        if bpy.data.objects.get(f"WheelAssembly_{suffix}")
    ]
    if existing_groups or existing_wheels:
        raise RuntimeError("input already appears normalized; rerun from the original source blend")


def main():
    output_blend, output_glb, report_path = parse_args()
    output_blend.parent.mkdir(parents=True, exist_ok=True)
    if output_glb:
        output_glb.parent.mkdir(parents=True, exist_ok=True)
    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)

    for old_name, new_name in MATERIAL_RENAMES.items():
        material = bpy.data.materials.get(old_name)
        if material:
            material.name = new_name

    source_root = find_source_root()
    if source_root is None:
        raise RuntimeError("unable to find source root")
    reject_already_normalized_input(source_root)

    source_root.name = "F1_Car"
    source_root.parent = None
    source_root.location = (0, 0, 0)
    source_root.rotation_euler = (0, 0, 0)
    source_root.scale = (1, 1, 1)

    for obj in list(bpy.data.objects):
        if obj.type == "EMPTY" and obj.name.startswith("Sketchfab_model"):
            if not obj.children:
                bpy.data.objects.remove(obj, do_unlink=True)

    groups = {key: create_empty(name, source_root) for key, name in GROUP_NAMES.items()}
    wheel_groups = {}
    for suffix, center in WHEEL_CENTERS.items():
        wheel_groups[f"wheel_{suffix}"] = create_empty(
            f"WheelAssembly_{suffix}",
            source_root,
            Vector(center),
        )

    existing = {obj.name for obj in bpy.data.objects}
    existing.discard("F1_Car")
    for group in groups.values():
        existing.discard(group.name)
    for group in wheel_groups.values():
        existing.discard(group.name)

    records = []
    for old_name, (target_name, group_key) in OBJECT_RULES.items():
        obj = bpy.data.objects.get(old_name)
        if obj is None:
            records.append(
                {"old": old_name, "new": target_name, "group": group_key, "status": "missing"}
            )
            continue
        final_name = ensure_name_available(target_name, existing)
        obj.name = final_name
        if obj.type == "MESH" and obj.data:
            obj.data.name = final_name
        parent = wheel_groups[group_key] if group_key.startswith("wheel_") else groups[group_key]
        if group_key.startswith("wheel_"):
            parent_mesh_at_parent_origin(obj, parent)
        else:
            if final_name in ANIMATED_FLAP_NAMES:
                move_mesh_origin_to_world(obj, world_bounds_center(obj))
            parent_keep_world(obj, parent)
        records.append({"old": old_name, "new": final_name, "group": group_key, "status": "renamed"})

    missing_records = [record for record in records if record["status"] == "missing"]
    missing_required = [name for name in REQUIRED_OUTPUT_NAMES if bpy.data.objects.get(name) is None]
    if missing_records or missing_required:
        if report_path:
            report = {
                "source": bpy.data.filepath,
                "outputBlend": str(output_blend),
                "outputGlb": str(output_glb),
                "renamed": records,
                "missing": missing_records,
                "missingRequiredOutputNames": missing_required,
            }
            report_path.write_text(json.dumps(report, indent=2) + "\n")
        details = {
            "missingMappings": [record["old"] for record in missing_records],
            "missingRequiredOutputNames": missing_required,
        }
        raise RuntimeError(f"normalization incomplete: {json.dumps(details)}")

    for obj in bpy.data.objects:
        if obj == source_root or obj.name in GROUP_NAMES.values() or obj.name.startswith("WheelAssembly_"):
            continue
        if obj.parent == source_root:
            parent_keep_world(obj, groups["unsorted"])

    if report_path:
        report = {
            "source": bpy.data.filepath,
            "outputBlend": str(output_blend),
            "outputGlb": str(output_glb) if output_glb else None,
            "renamed": records,
            "missing": missing_records,
            "missingRequiredOutputNames": missing_required,
            "objects": sorted([obj.name for obj in bpy.data.objects]),
        }
        report_path.write_text(json.dumps(report, indent=2) + "\n")

    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))

    if output_glb:
        bpy.ops.export_scene.gltf(
            filepath=str(output_glb),
            export_format="GLB",
            export_yup=True,
            export_apply=False,
            export_draco_mesh_compression_enable=True,
        )

    print(f"saved normalized blend to {output_blend}")
    if output_glb:
        print(f"exported normalized glb to {output_glb}")
    if report_path:
        print(f"wrote normalization report to {report_path}")


try:
    main()
except Exception as exc:
    print(f"error: {exc}", file=sys.stderr)
    sys.exit(1)
