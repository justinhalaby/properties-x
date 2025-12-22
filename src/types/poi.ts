export type POIType = 'hospital' | 'university' | 'cegep' | 'metro' | 'rem';

export interface POI {
  name: string;
  type: POIType;
  coordinates: [number, number]; // [longitude, latitude]
  address?: string;
}

export interface POILayerConfig {
  type: POIType;
  label: string;
  color: string;
  visible: boolean;
}
