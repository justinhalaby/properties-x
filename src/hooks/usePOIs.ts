import { useEffect, useState } from 'react';
import type { POI, POIType } from '@/types/poi';

interface UsePOIsReturn {
  pois: POI[];
  loading: boolean;
  error: string | null;
  getByType: (type: POIType) => POI[];
}

const POI_FILES: Record<POIType, string> = {
  hospital: '/data/hospitals.geojson',
  university: '/data/universities.geojson',
  cegep: '/data/cegeps.geojson',
  metro: '/data/metro.geojson',
  rem: '/data/rem.geojson',
};

export function usePOIs(): UsePOIsReturn {
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPOIs = async () => {
      try {
        const fetchPromises = Object.entries(POI_FILES).map(([type, url]) =>
          fetch(url)
            .then(res => res.json())
            .then(data => ({
              type: type as POIType,
              data: data.features
            }))
        );

        const results = await Promise.all(fetchPromises);

        const allPOIs: POI[] = results.flatMap(({ data }) =>
          data.map((f: any) => ({
            name: f.properties.name,
            type: f.properties.type,
            coordinates: f.geometry.coordinates,
            address: f.properties.address
          }))
        );

        setPois(allPOIs);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load POIs');
        setLoading(false);
      }
    };

    loadPOIs();
  }, []);

  const getByType = (type: POIType) =>
    pois.filter(poi => poi.type === type);

  return { pois, loading, error, getByType };
}
