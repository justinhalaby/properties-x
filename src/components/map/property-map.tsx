"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface PropertyMapProps {
  latitude: number;
  longitude: number;
  title?: string;
  className?: string;
}

export function PropertyMap({
  latitude,
  longitude,
  title,
  className = "",
}: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView([latitude, longitude], 15);
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

    // Custom marker icon
    const customIcon = L.divIcon({
      className: "custom-marker",
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    // Add marker
    const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(
      map
    );

    if (title) {
      marker.bindPopup(title);
    }

    // Cleanup
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [latitude, longitude, title]);

  // Update map view if coordinates change
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([latitude, longitude], 15);
    }
  }, [latitude, longitude]);

  return (
    <div
      ref={mapRef}
      className={`w-full h-full min-h-[300px] rounded-lg overflow-hidden ${className}`}
    />
  );
}
