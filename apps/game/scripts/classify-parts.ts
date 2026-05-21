import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

interface NodeInfo {
  name: string;
  path: string;
  hasMesh: boolean;
  vertexCount: number;
  bboxCenter: [number, number, number] | null;
  bboxSize: [number, number, number] | null;
}

const inspectJson = process.argv[2];
if (!inspectJson) {
  console.error("usage: tsx apps/game/scripts/classify-parts.ts <inspect.json>");
  process.exit(1);
}

const infos: NodeInfo[] = JSON.parse(
  await readFile(resolve(inspectJson), "utf8"),
);

const meshes = infos.filter((i) => i.hasMesh && i.bboxCenter && i.bboxSize);

const RIGHT = "right";
const LEFT = "left";
function side(x: number): "left" | "right" | "center" {
  if (Math.abs(x) < 0.08) return "center";
  return x > 0 ? LEFT : RIGHT;
}

function longitudinalZone(y: number): "front" | "mid-front" | "mid" | "mid-rear" | "rear" {
  if (y < -1.5) return "front";
  if (y < -0.3) return "mid-front";
  if (y < 0.6) return "mid";
  if (y < 1.7) return "mid-rear";
  return "rear";
}

function heightZone(z: number): "low" | "mid" | "high" {
  if (z < 0.4) return "low";
  if (z < 0.7) return "mid";
  return "high";
}

interface Proposal {
  old: string;
  proposed: string;
  confidence: "high" | "medium" | "low" | "keep";
  reason: string;
  vertexCount: number;
  center: [number, number, number];
  size: [number, number, number];
  symmetricPartner?: string;
}

const proposals: Proposal[] = [];

const isUnnamed = (n: string) => /^Object_\d+(\.\d+)?$/.test(n);

const pairKey = (m: NodeInfo) => {
  const [x, y, z] = m.bboxCenter!;
  const [sx, sy, sz] = m.bboxSize!;
  const fx = Math.abs(x).toFixed(2);
  const fy = y.toFixed(2);
  const fz = z.toFixed(2);
  const fsx = sx.toFixed(2);
  const fsy = sy.toFixed(2);
  const fsz = sz.toFixed(2);
  return `${fx}|${fy}|${fz}|${fsx}|${fsy}|${fsz}`;
};

const byKey = new Map<string, NodeInfo[]>();
for (const m of meshes) {
  const k = pairKey(m);
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k)!.push(m);
}

const partnerOf = new Map<string, NodeInfo>();
for (const [, group] of byKey) {
  if (group.length === 2) {
    const [a, b] = group;
    if (Math.sign(a.bboxCenter![0]) !== Math.sign(b.bboxCenter![0])) {
      partnerOf.set(a.name, b);
      partnerOf.set(b.name, a);
    }
  }
}

const WHEEL_ZONES = {
  "front-left": { x: [0.6, 1.1], y: [-1.9, -1.1] },
  "front-right": { x: [-1.1, -0.6], y: [-1.9, -1.1] },
  "rear-left": { x: [0.6, 1.1], y: [1.7, 2.5] },
  "rear-right": { x: [-1.1, -0.6], y: [1.7, 2.5] },
} as const;

function whichWheel(x: number, y: number): keyof typeof WHEEL_ZONES | null {
  for (const [k, z] of Object.entries(WHEEL_ZONES)) {
    if (x >= z.x[0] && x <= z.x[1] && y >= z.y[0] && y <= z.y[1]) {
      return k as keyof typeof WHEEL_ZONES;
    }
  }
  return null;
}

const wheelSubpartByVerts = (verts: number): string => {
  if (verts > 6500) return "tire-sidewall";
  if (verts > 3000) return "rim";
  if (verts > 1500) return "brake-disc";
  if (verts > 500) return "brake-caliper";
  return "wheel-detail";
};

function classify(m: NodeInfo): Proposal {
  const [x, y, z] = m.bboxCenter!;
  const [sx, sy, sz] = m.bboxSize!;
  const out: Proposal = {
    old: m.name,
    proposed: m.name,
    confidence: "keep",
    reason: "already named",
    vertexCount: m.vertexCount,
    center: [x, y, z],
    size: [sx, sy, sz],
  };

  if (!isUnnamed(m.name)) {
    out.proposed = m.name;
    out.confidence = "keep";
    out.reason = "already named";
    return out;
  }

  const sideStr = side(x);
  const longZone = longitudinalZone(y);
  const hZone = heightZone(z);
  const wheel = whichWheel(x, y);
  const partner = partnerOf.get(m.name);

  if (wheel) {
    const subpart = wheelSubpartByVerts(m.vertexCount);
    out.proposed = `${subpart}-${wheel}`;
    out.confidence = "high";
    out.reason = `bbox in ${wheel} wheel zone, verts=${m.vertexCount}`;
    if (partner) out.symmetricPartner = partner.name;
    return out;
  }

  if (longZone === "front" && z < 0.5 && Math.abs(x) < 1.2) {
    if (Math.abs(x) < 0.1) {
      out.proposed = `nose-detail-${y < -1.8 ? "tip" : "mid"}`;
    } else {
      out.proposed = `front-wing-detail-${sideStr}`;
    }
    out.confidence = "medium";
    out.reason = `front zone, low/mid height, x=${x.toFixed(2)}`;
    if (partner) out.symmetricPartner = partner.name;
    return out;
  }

  if (longZone === "rear" && z >= 0.4) {
    out.proposed = `rear-wing-detail-${sideStr === "center" ? "center" : sideStr}`;
    out.confidence = "medium";
    out.reason = `rear zone, mid+ height`;
    if (partner) out.symmetricPartner = partner.name;
    return out;
  }

  if (longZone === "rear" && z < 0.4) {
    out.proposed = `diffuser-detail-${sideStr === "center" ? "center" : sideStr}`;
    out.confidence = "low";
    out.reason = `rear zone, low height — guess diffuser`;
    if (partner) out.symmetricPartner = partner.name;
    return out;
  }

  if (longZone === "mid-rear" && hZone !== "low") {
    out.proposed = `sidepod-rear-${sideStr === "center" ? "center" : sideStr}`;
    out.confidence = "low";
    out.reason = `mid-rear zone, ${hZone}`;
    if (partner) out.symmetricPartner = partner.name;
    return out;
  }

  if (longZone === "mid" && hZone === "high") {
    if (Math.abs(x) < 0.15) {
      out.proposed = `cockpit-top-detail`;
    } else {
      out.proposed = `cockpit-side-${sideStr}`;
    }
    out.confidence = "low";
    out.reason = `mid zone, high — cockpit/halo area`;
    if (partner) out.symmetricPartner = partner.name;
    return out;
  }

  if (longZone === "mid" && hZone === "mid") {
    if (Math.abs(x) < 0.15) {
      out.proposed = `chassis-center-detail`;
    } else {
      out.proposed = `chassis-side-${sideStr}`;
    }
    out.confidence = "low";
    out.reason = `mid zone, mid height — chassis/cockpit area`;
    if (partner) out.symmetricPartner = partner.name;
    return out;
  }

  if (longZone === "mid-front") {
    if (Math.abs(x) < 0.15) {
      out.proposed = `chassis-front-detail`;
    } else {
      out.proposed = `bargeboard-${sideStr}`;
    }
    out.confidence = "low";
    out.reason = `mid-front zone`;
    if (partner) out.symmetricPartner = partner.name;
    return out;
  }

  out.proposed = `unknown-${longZone}-${sideStr}-${hZone}`;
  out.confidence = "low";
  out.reason = `unmatched: long=${longZone}, side=${sideStr}, h=${hZone}, verts=${m.vertexCount}`;
  if (partner) out.symmetricPartner = partner.name;
  return out;
}

for (const m of meshes) proposals.push(classify(m));

const collisions = new Map<string, Proposal[]>();
for (const p of proposals) {
  if (p.confidence === "keep") continue;
  if (!collisions.has(p.proposed)) collisions.set(p.proposed, []);
  collisions.get(p.proposed)!.push(p);
}
for (const [name, ps] of collisions) {
  if (ps.length <= 1) continue;
  ps.sort((a, b) => a.center[2] - b.center[2]);
  for (let i = 0; i < ps.length; i++) {
    ps[i].proposed = `${name}-${String(i + 1).padStart(2, "0")}`;
  }
}

const byConf = (c: Proposal["confidence"]) =>
  proposals.filter((p) => p.confidence === c);
console.log(`Total mesh nodes:    ${proposals.length}`);
console.log(`  keep (named):      ${byConf("keep").length}`);
console.log(`  high confidence:   ${byConf("high").length}`);
console.log(`  medium confidence: ${byConf("medium").length}`);
console.log(`  low confidence:    ${byConf("low").length}`);
console.log();

console.log("=== HIGH CONFIDENCE (wheel zone matches) ===");
for (const p of byConf("high"))
  console.log(`  ${p.old.padEnd(18)} → ${p.proposed.padEnd(32)} (${p.reason})`);

console.log("\n=== MEDIUM CONFIDENCE ===");
for (const p of byConf("medium"))
  console.log(`  ${p.old.padEnd(18)} → ${p.proposed.padEnd(32)} (${p.reason})`);

console.log("\n=== LOW CONFIDENCE (needs review / VLM pass) ===");
for (const p of byConf("low"))
  console.log(`  ${p.old.padEnd(18)} → ${p.proposed.padEnd(32)} (${p.reason})`);

const outPath = resolve(inspectJson).replace(/\.inspect\.json$/i, ".mapping.json");
await writeFile(
  outPath,
  JSON.stringify(
    {
      summary: {
        total: proposals.length,
        keep: byConf("keep").length,
        high: byConf("high").length,
        medium: byConf("medium").length,
        low: byConf("low").length,
      },
      proposals,
    },
    null,
    2,
  ),
);
console.log(`\nMapping written to: ${outPath}`);
