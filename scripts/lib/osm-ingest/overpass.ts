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

export interface OSMResponse {
  elements: (OSMNode | OSMWay)[]
}

export async function fetchOSMData(query: string): Promise<OSMResponse> {
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
  console.log('Fetching OSM data...')
  const res = await fetch(url, { headers: { 'User-Agent': 'F1-Track-Converter/1.0' } })
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`)
  return res.json() as Promise<OSMResponse>
}

export function extractNodesAndWays(data: OSMResponse): {
  nodes: Map<number, OSMNode>
  ways: OSMWay[]
} {
  const nodes = new Map<number, OSMNode>()
  const ways: OSMWay[] = []

  for (const el of data.elements) {
    if (el.type === 'node') nodes.set(el.id, el)
    if (el.type === 'way') ways.push(el)
  }

  return { nodes, ways }
}

export function buildOverpassQuery(
  bbox: [number, number, number, number],
  queryFilters: string[],
): string {
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
