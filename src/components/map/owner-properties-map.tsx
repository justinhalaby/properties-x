"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface PropertyWithCoords {
  matricule: string;
  address: string;
  current_total_value: number | null;
  latitude: number;
  longitude: number;
  [key: string]: any;
}

interface OwnerPropertiesMapProps {
  properties: PropertyWithCoords[];
  ownerName: string;
}

export function OwnerPropertiesMap({ properties, ownerName }: OwnerPropertiesMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current || properties.length === 0) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(
        [properties[0].latitude, properties[0].longitude],
        13
      );

      // Add dark tile layer
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(mapRef.current);
    }

    // Clear existing markers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        layer.remove();
      }
    });

    // Add markers for each property
    const bounds: L.LatLngBoundsExpression = [];

    properties.forEach((property) => {
      if (!mapRef.current) return;

      const markerColor = '#3b82f6'; // Blue for all owner properties

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
      }).addTo(mapRef.current);

      const formatCurrency = (value: number | null) => {
        if (value === null) return "N/A";
        return `${value.toLocaleString("en-CA")} $`;
      };

      marker.bindPopup(`
        <div style="color: #1f2937; min-width: 200px;">
          <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">
            ${property.address}
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
            Matricule: ${property.matricule}
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
            Value: ${formatCurrency(property.current_total_value)}
          </div>
          <a
            href="/buildings/${property.matricule}"
            style="
              color: #3b82f6;
              text-decoration: none;
              font-size: 12px;
              font-weight: 500;
            "
          >
            View Details →
          </a>
        </div>
      `);

      bounds.push([property.latitude, property.longitude]);
    });

    // Fit map to show all markers
    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [properties]);

  return (
    <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
  );
}
