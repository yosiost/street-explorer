// Minimal types for the Overpass JSON responses this app requests.

export interface OsmLatLon {
  lat: number;
  lon: number;
}

export interface OsmWay {
  type: 'way';
  id: number;
  tags?: Record<string, string>;
  geometry?: (OsmLatLon | null)[];
}

export interface OsmRelationMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
  geometry?: (OsmLatLon | null)[];
}

export interface OsmRelation {
  type: 'relation';
  id: number;
  tags?: Record<string, string>;
  members?: OsmRelationMember[];
}

export type OsmElement = OsmWay | OsmRelation | { type: 'node'; id: number };

export interface OverpassResponse {
  elements: OsmElement[];
  remark?: string;
  osm3s?: { timestamp_osm_base?: string };
}
