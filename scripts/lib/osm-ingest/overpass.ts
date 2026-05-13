export interface OSMNode {
  type: 'node'
  id: number
  lat: number
  lon: number
}

export interface OSMWay {
  type: 'way'
  id: number
  nodes: number[]
  tags: Record<string, string>
}

export interface OSMRelation {
  type: 'relation'
  id: number
  members: { type: string; ref: number; role: string }[]
  tags?: Record<string, string>
}

export interface OSMResponse {
  elements: (OSMNode | OSMWay | OSMRelation)[]
}

export async function fetchOSMData(query: string): Promise<OSMResponse> {
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
  const transientStatuses = new Set([429, 502, 503, 504])
  const maxAttempts = 4
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Fetching OSM data (attempt ${attempt}/${maxAttempts})...`)
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'F1-Track-Converter/1.0' },
      })
      if (res.ok) return (await res.json()) as OSMResponse
      if (!transientStatuses.has(res.status)) {
        throw new Error(`Overpass API error: ${res.status}`)
      }
      lastError = new Error(`Overpass API error: ${res.status}`)
    } catch (err) {
      lastError = err as Error
    }
    if (attempt < maxAttempts) {
      const backoffMs = 2000 * 2 ** (attempt - 1)
      console.log(`  Transient failure (${lastError?.message}); retrying in ${backoffMs}ms...`)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
    }
  }
  throw lastError ?? new Error('Overpass API: exhausted retries')
}

export function extractNodesAndWays(data: OSMResponse): {
  nodes: Map<number, OSMNode>
  ways: OSMWay[]
  relations: OSMRelation[]
} {
  const nodes = new Map<number, OSMNode>()
  const ways: OSMWay[] = []
  const relations: OSMRelation[] = []

  for (const el of data.elements) {
    if (el.type === 'node') nodes.set(el.id, el)
    else if (el.type === 'way') ways.push(el)
    else if (el.type === 'relation') relations.push(el)
  }

  return { nodes, ways, relations }
}

export function buildOverpassQuery(
  bbox: [number, number, number, number],
  queryFilters: string[],
  relationId?: number,
): string {
  if (relationId != null) {
    return `[out:json][timeout:60];
      rel(${relationId});
      out body;
      (
        way(r);
      );
      out body;
      >;
      out skel qt;`
  }
  const [south, west, north, east] = bbox
  const filters = queryFilters.map(f => `[${f}]`).join('')
  return `[out:json][timeout:60];
      (
        way(${south},${west},${north},${east})${filters};
      );
      out body;
      >;
      out skel qt;`
}
