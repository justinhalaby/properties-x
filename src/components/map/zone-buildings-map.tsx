"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ScrapingZone } from "@/types/scraping-zone";

interface PropertyEvaluation {
  matricule83: string;
  clean_address?: string;
  adresse_complete?: string;
  latitude: number;
  longitude: number;
  nombre_logement?: number;
  valeur_totale?: number;
  is_scraped?: boolean;
}

interface ZoneBuildingsMapProps {
  zone: ScrapingZone;
  properties: PropertyEvaluation[];
  onPropertyClick?: (property: PropertyEvaluation) => void;
}

export function ZoneBuildingsMap({
  zone,
  properties,
  onPropertyClick,
}: ZoneBuildingsMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: [
        (zone.min_lat + zone.max_lat) / 2,
        (zone.min_lng + zone.max_lng) / 2,
      ],
      zoom: 15,
      zoomControl: true,
    });

    // Add dark tile layer
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    // Draw zone bounds rectangle
    const bounds: L.LatLngBoundsExpression = [
      [zone.min_lat, zone.min_lng],
      [zone.max_lat, zone.max_lng],
    ];

    L.rectangle(bounds, {
      color: "#3b82f6",
      weight: 2,
      fillOpacity: 0.1,
    }).addTo(map);

    // Fit map to zone bounds
    map.fitBounds(bounds, { padding: [50, 50] });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [zone]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Add markers for each property
    properties.forEach((property) => {
      if (!property.latitude || !property.longitude) return;

      // Create custom icon based on scraped status
      const icon = L.divIcon({
        className: "custom-marker",
        html: `
          <div class="relative">
            <div class="w-3 h-3 rounded-full ${
              property.is_scraped
                ? "bg-green-500 ring-2 ring-green-400/50"
                : "bg-yellow-500 ring-2 ring-yellow-400/50"
            }"></div>
          </div>
        `,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const marker = L.marker([property.latitude, property.longitude], {
        icon,
      });

      // Create popup content
      const address = property.clean_address || property.adresse_complete || "Address unavailable";
      const units = property.nombre_logement || "N/A";
      const value = property.valeur_totale
        ? new Intl.NumberFormat("en-CA", {
            style: "currency",
            currency: "CAD",
            maximumFractionDigits: 0,
          }).format(property.valeur_totale)
        : "N/A";

      const popupContent = `
        <div class="p-2 min-w-[200px]">
          <div class="font-medium mb-2">${address}</div>
          <div class="text-sm space-y-1">
            <div><span class="text-gray-400">Units:</span> ${units}</div>
            <div><span class="text-gray-400">Value:</span> ${value}</div>
            <div><span class="text-gray-400">Status:</span>
              <span class="${property.is_scraped ? "text-green-400" : "text-yellow-400"}">
                ${property.is_scraped ? "Scraped" : "Not scraped"}
              </span>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Handle click
      marker.on("click", () => {
        if (onPropertyClick) {
          onPropertyClick(property);
        }
      });

      marker.addTo(map);
    });
  }, [properties, onPropertyClick]);

  return (
    <div ref={mapContainerRef} className="w-full h-full">
      <style jsx global>{`
        .custom-marker {
          background: none;
          border: none;
        }
        .leaflet-popup-content-wrapper {
          background-color: #1f2937;
          color: #fff;
        }
        .leaflet-popup-tip {
          background-color: #1f2937;
        }
      `}</style>
    </div>
  );
}
