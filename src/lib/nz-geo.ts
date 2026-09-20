/**
 * Map coordinates for the region + city taxonomy (migration 182), keyed by slug.
 *
 * Kept in code rather than the database: the taxonomy is fixed reference data
 * and this only feeds the admin map, so it needs no migration to run.
 * Region centroids are the fallback for an artist matched to a region but not
 * to a specific town.
 */
export type LatLng = [number, number];

export const REGION_CENTROIDS: Record<string, LatLng> = {
  northland: [-35.6, 173.9],
  auckland: [-36.85, 174.76],
  waikato: [-37.8, 175.3],
  "bay-of-plenty": [-37.9, 176.9],
  gisborne: [-38.5, 177.9],
  "hawkes-bay": [-39.6, 176.8],
  taranaki: [-39.3, 174.2],
  "manawatu-whanganui": [-39.9, 175.5],
  wellington: [-41.2, 175.0],
  tasman: [-41.4, 172.6],
  nelson: [-41.27, 173.28],
  marlborough: [-41.5, 173.8],
  "west-coast": [-42.8, 171.2],
  canterbury: [-43.5, 171.7],
  otago: [-45.3, 169.6],
  southland: [-45.9, 168.0],
};

export const CITY_COORDS: Record<string, LatLng> = {
  whangarei: [-35.725, 174.323],
  kerikeri: [-35.227, 173.947],
  paihia: [-35.282, 174.092],
  dargaville: [-35.937, 173.877],
  kaitaia: [-35.113, 173.262],
  russell: [-35.264, 174.122],

  auckland: [-36.848, 174.763],
  manukau: [-36.993, 174.879],
  "north-shore": [-36.79, 174.77],
  waitakere: [-36.88, 174.63],
  papakura: [-37.065, 174.944],
  titirangi: [-36.94, 174.66],
  "waiheke-island": [-36.8, 175.09],
  pukekohe: [-37.2, 174.9],
  warkworth: [-36.4, 174.66],

  hamilton: [-37.787, 175.279],
  cambridge: [-37.89, 175.47],
  "te-awamutu": [-38.01, 175.32],
  taupo: [-38.685, 176.07],
  matamata: [-37.81, 175.77],
  thames: [-37.14, 175.54],
  raglan: [-37.8, 174.87],
  tokoroa: [-38.23, 175.87],
  huntly: [-37.56, 175.16],
  coromandel: [-36.76, 175.5],

  tauranga: [-37.687, 176.165],
  rotorua: [-38.137, 176.25],
  whakatane: [-37.953, 177.0],
  "te-puke": [-37.78, 176.32],
  "mount-maunganui": [-37.63, 176.18],
  opotiki: [-38.01, 177.29],
  kawerau: [-38.09, 176.7],

  gisborne: [-38.662, 178.018],
  ruatoria: [-37.89, 178.33],
  "tolaga-bay": [-38.37, 178.3],

  napier: [-39.49, 176.91],
  hastings: [-39.64, 176.84],
  "havelock-north": [-39.67, 176.88],
  waipukurau: [-40.0, 176.56],
  wairoa: [-39.03, 177.42],

  "new-plymouth": [-39.056, 174.075],
  hawera: [-39.59, 174.28],
  stratford: [-39.34, 174.28],
  inglewood: [-39.155, 174.21],
  opunake: [-39.455, 173.86],

  "palmerston-north": [-40.356, 175.611],
  whanganui: [-39.93, 175.05],
  levin: [-40.62, 175.28],
  feilding: [-40.225, 175.565],
  taihape: [-39.68, 175.8],
  ohakune: [-39.42, 175.41],
  dannevirke: [-40.21, 176.1],

  wellington: [-41.287, 174.776],
  "lower-hutt": [-41.21, 174.91],
  "upper-hutt": [-41.124, 175.07],
  porirua: [-41.135, 174.84],
  "kapiti-coast": [-40.9, 175.0],
  masterton: [-40.95, 175.66],
  martinborough: [-41.22, 175.46],
  greytown: [-41.08, 175.46],

  richmond: [-41.34, 173.18],
  motueka: [-41.11, 173.01],
  takaka: [-40.85, 172.81],
  mapua: [-41.25, 173.1],

  nelson: [-41.27, 173.284],

  blenheim: [-41.514, 173.96],
  picton: [-41.29, 174.0],
  renwick: [-41.5, 173.83],

  greymouth: [-42.45, 171.21],
  hokitika: [-42.72, 170.97],
  westport: [-41.75, 171.6],
  reefton: [-42.12, 171.86],

  christchurch: [-43.532, 172.636],
  timaru: [-44.397, 171.255],
  ashburton: [-43.9, 171.75],
  rangiora: [-43.305, 172.595],
  kaikoura: [-42.4, 173.68],
  lyttelton: [-43.6, 172.72],
  akaroa: [-43.8, 172.97],
  geraldine: [-44.09, 171.24],

  dunedin: [-45.879, 170.503],
  queenstown: [-45.031, 168.663],
  wanaka: [-44.7, 169.13],
  oamaru: [-45.097, 170.97],
  alexandra: [-45.25, 169.38],
  balclutha: [-46.24, 169.74],
  arrowtown: [-44.94, 168.83],

  invercargill: [-46.413, 168.354],
  gore: [-46.1, 168.94],
  "te-anau": [-45.414, 167.72],
  bluff: [-46.6, 168.33],
  "stewart-island": [-46.9, 168.13],
  riverton: [-46.35, 168.02],
};

export const NZ_CENTRE: LatLng = [-41.0, 173.5];
