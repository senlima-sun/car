import { NodeIO } from "@gltf-transform/core";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("usage: tsx apps/game/scripts/inspect-glb.ts <path-to-glb>");
  process.exit(1);
}

const io = new NodeIO();
const doc = await io.read(resolve(input));
const root = doc.getRoot();

interface NodeInfo {
  name: string;
  path: string;
  hasMesh: boolean;
  meshName: string | null;
  primitiveCount: number;
  vertexCount: number;
  bboxMin: [number, number, number] | null;
  bboxMax: [number, number, number] | null;
  bboxCenter: [number, number, number] | null;
  bboxSize: [number, number, number] | null;
  childCount: number;
}

const infos: NodeInfo[] = [];

function bboxOfMesh(mesh: ReturnType<typeof doc.createMesh>) {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  let vertexCount = 0;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    if (!pos) continue;
    const array = pos.getArray();
    if (!array) continue;
    const count = pos.getCount();
    vertexCount += count;
    for (let i = 0; i < count; i++) {
      const x = array[i * 3]!;
      const y = array[i * 3 + 1]!;
      const z = array[i * 3 + 2]!;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
  }
  if (vertexCount === 0) return { vertexCount, min: null, max: null };
  return {
    vertexCount,
    min: [minX, minY, minZ] as [number, number, number],
    max: [maxX, maxY, maxZ] as [number, number, number],
  };
}

function walk(node: ReturnType<typeof doc.createNode>, path: string) {
  const mesh = node.getMesh();
  const name = node.getName() || "(unnamed)";
  const fullPath = path ? `${path}/${name}` : name;
  let info: NodeInfo = {
    name,
    path: fullPath,
    hasMesh: !!mesh,
    meshName: mesh?.getName() ?? null,
    primitiveCount: mesh?.listPrimitives().length ?? 0,
    vertexCount: 0,
    bboxMin: null,
    bboxMax: null,
    bboxCenter: null,
    bboxSize: null,
    childCount: node.listChildren().length,
  };
  if (mesh) {
    const { vertexCount, min, max } = bboxOfMesh(mesh);
    info.vertexCount = vertexCount;
    info.bboxMin = min;
    info.bboxMax = max;
    if (min && max) {
      info.bboxCenter = [
        (min[0] + max[0]) / 2,
        (min[1] + max[1]) / 2,
        (min[2] + max[2]) / 2,
      ];
      info.bboxSize = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    }
  }
  infos.push(info);
  for (const child of node.listChildren()) walk(child, fullPath);
}

for (const scene of root.listScenes()) {
  for (const node of scene.listChildren()) walk(node, "");
}

const meshNodes = infos.filter((i) => i.hasMesh);
console.log(`Total nodes: ${infos.length}`);
console.log(`Mesh nodes:  ${meshNodes.length}`);
console.log(`Materials:   ${root.listMaterials().length}`);
console.log(`Textures:    ${root.listTextures().length}`);
console.log();

const sorted = [...meshNodes].sort((a, b) => b.vertexCount - a.vertexCount);
console.log("Mesh nodes (sorted by vertex count desc):");
console.log(
  "name".padEnd(40),
  "verts".padStart(8),
  "prims".padStart(6),
  "center(x,y,z)".padStart(28),
  "size(x,y,z)".padStart(24),
);
for (const m of sorted) {
  const c = m.bboxCenter
    ? `(${m.bboxCenter.map((v) => v.toFixed(2)).join(",")})`
    : "-";
  const s = m.bboxSize
    ? `(${m.bboxSize.map((v) => v.toFixed(2)).join(",")})`
    : "-";
  console.log(
    m.name.slice(0, 40).padEnd(40),
    String(m.vertexCount).padStart(8),
    String(m.primitiveCount).padStart(6),
    c.padStart(28),
    s.padStart(24),
  );
}

const outPath = resolve(input).replace(/\.glb$/i, ".inspect.json");
await writeFile(outPath, JSON.stringify(infos, null, 2));
console.log(`\nFull metadata written to: ${outPath}`);
