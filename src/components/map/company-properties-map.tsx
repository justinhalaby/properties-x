"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface PropertyMarker {
  matricule: string;
  address: string;
  latitude: number;
  longitude: number;
  matchType: 'exact' | 'fuzzy';
  evaluated_value?: number | null;
}

interface CompanyPropertiesMapProps {
  properties: PropertyMarker[];
  className?: string;
  onPropertyClick?: (matricule: string) => void;
}

export function CompanyPropertiesMap({
  properties,
  className = "",
  onPropertyClick,
}: CompanyPropertiesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || properties.length === 0) return;

    // Clean up existing map if it exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Calculate center and bounds
    const validProperties = properties.filter(p => p.latitude && p.longitude);
    if (validProperties.length === 0) return;

    const bounds = L.latLngBounds(
      validProperties.map(p => [p.latitude, p.longitude] as [number, number])
    );

    // Initialize map
    const map = L.map(mapRef.current).fitBounds(bounds, { padding: [50, 50] });
    mapInstanceRef.current = map;

    // Add dark tile layer (CartoDB Dark Matter)
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    // Add markers for each property
    validProperties.forEach((property) => {
      // Different colors for exact vs fuzzy matches
      const markerColor = property.matchType === 'exact' ? '#10b981' : '#f59e0b';

      const customIcon = L.divIcon({
        className: "custom-marker",
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: ${markerColor};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          "></div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([property.latitude, property.longitude], {
        icon: customIcon,
      }).addTo(map);

      // Create popup content
      const popupContent = `
        <div style="min-width: 200px;">
          <div style="font-weight: 600; margin-bottom: 4px; color: #1f2937;">${property.address}</div>
          <div style="font-family: monospace; font-size: 12px; color: #6b7280; margin-bottom: 4px;">${property.matricule}</div>
          <div style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; margin-top: 4px; ${
            property.matchType === 'exact'
              ? 'background: #d1fae5; color: #065f46;'
              : 'background: #fef3c7; color: #92400e;'
          }">
            ${property.matchType === 'exact' ? 'Exact Match' : 'Fuzzy Match'}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Handle click event
      if (onPropertyClick) {
        marker.on('click', () => {
          onPropertyClick(property.matricule);
        });
      }
    });

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [properties, onPropertyClick]);

  if (properties.length === 0) {
    return (
      <div className={`w-full h-full min-h-[400px] rounded-lg bg-gray-800 flex items-center justify-center ${className}`}>
        <p className="text-gray-400">No properties with coordinates to display</p>
      </div>
    );
  }

  const propertiesWithCoords = properties.filter(p => p.latitude && p.longitude).length;
  const propertiesWithoutCoords = properties.length - propertiesWithCoords;

  return (
    <div className="w-full">
      <div
        ref={mapRef}
        className={`w-full h-full min-h-[400px] rounded-lg overflow-hidden ${className}`}
      />
      {propertiesWithoutCoords > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          {propertiesWithoutCoords} {propertiesWithoutCoords === 1 ? 'property' : 'properties'} without coordinates not shown on map
        </p>
      )}
      <div className="flex items-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
          <span className="text-gray-400">Exact Match</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-yellow-500 border-2 border-white"></div>
          <span className="text-gray-400">Fuzzy Match</span>
        </div>
      </div>
    </div>
  );
}
