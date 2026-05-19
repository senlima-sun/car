import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def args_after_separator():
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def round_number(value):
    if abs(value) < 0.000001:
        return 0
    return round(value, 6)


def vector_values(values):
    return [round_number(float(v)) for v in values]


def world_bbox(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    mins = [min(corner[i] for corner in corners) for i in range(3)]
    maxs = [max(corner[i] for corner in corners) for i in range(3)]
    center = [(mins[i] + maxs[i]) / 2 for i in range(3)]
    size = [maxs[i] - mins[i] for i in range(3)]
    return {
        "min": vector_values(mins),
        "max": vector_values(maxs),
        "center": vector_values(center),
        "size": vector_values(size),
    }


def mesh_counts(obj, depsgraph):
    if obj.type != "MESH":
        return 0, 0
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        return len(mesh.vertices), len(mesh.polygons)
    finally:
        evaluated.to_mesh_clear()


def object_record(obj, depsgraph):
    mesh = obj.data if obj.type == "MESH" else None
    materials = []
    if mesh:
        materials = [
            slot.material.name
            for slot in obj.material_slots
            if slot.material is not None
        ]
    evaluated = obj.evaluated_get(depsgraph)
    vertex_count, polygon_count = mesh_counts(obj, depsgraph)
    record = {
        "name": obj.name,
        "type": obj.type,
        "parent": obj.parent.name if obj.parent else None,
        "children": [child.name for child in obj.children],
        "collections": [collection.name for collection in obj.users_collection],
        "location": vector_values(obj.location),
        "rotationEuler": vector_values(obj.rotation_euler),
        "scale": vector_values(obj.scale),
        "worldLocation": vector_values(obj.matrix_world.translation),
        "materials": materials,
        "vertexCount": vertex_count,
        "polygonCount": polygon_count,
    }
    if obj.type == "MESH":
        record["worldBounds"] = world_bbox(evaluated)
    return record


def material_record(material):
    users = [
        obj.name
        for obj in bpy.data.objects
        if obj.type == "MESH"
        and any(slot.material == material for slot in obj.material_slots)
    ]
    return {
        "name": material.name,
        "users": users,
        "userCount": len(users),
        "useNodes": material.use_nodes,
    }


def collection_record(collection):
    return {
        "name": collection.name,
        "objects": [obj.name for obj in collection.objects],
        "children": [child.name for child in collection.children],
    }


def main():
    argv = args_after_separator()
    output = Path(argv[0]) if argv else Path.cwd() / "f1-model-audit.json"
    output.parent.mkdir(parents=True, exist_ok=True)

    objects = sorted(bpy.data.objects, key=lambda obj: obj.name.lower())
    materials = sorted(bpy.data.materials, key=lambda material: material.name.lower())
    collections = sorted(bpy.data.collections, key=lambda collection: collection.name.lower())
    depsgraph = bpy.context.evaluated_depsgraph_get()

    audit = {
        "source": bpy.data.filepath,
        "objectCount": len(objects),
        "meshCount": sum(1 for obj in objects if obj.type == "MESH"),
        "materialCount": len(materials),
        "collectionCount": len(collections),
        "objects": [object_record(obj, depsgraph) for obj in objects],
        "materials": [material_record(material) for material in materials],
        "collections": [collection_record(collection) for collection in collections],
    }

    output.write_text(json.dumps(audit, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote audit to {output}")


try:
    main()
except Exception as exc:
    print(f"error: {exc}", file=sys.stderr)
    sys.exit(1)
