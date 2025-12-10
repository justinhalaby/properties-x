"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Property } from "@/types/property";

interface PropertiesMapProps {
  properties: Property[];
  className?: string;
  onPropertyClick?: (property: Property) => void;
}

export function PropertiesMap({
  properties,
  className = "",
  onPropertyClick,
}: PropertiesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Montreal center coordinates
    const montrealCenter: [number, number] = [45.5017, -73.5673];

    const map = L.map(mapRef.current).setView(montrealCenter, 11);
    mapInstanceRef.current = map;

    // Add dark tile layer
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    // Create layer group for markers
    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // Update markers when properties change
  useEffect(() => {
    if (!markersRef.current || !mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.clearLayers();

    const validProperties = properties.filter(
      (p) => p.latitude != null && p.longitude != null
    );

    if (validProperties.length === 0) return;

    // Create custom marker icon
    const createMarkerIcon = (price: number | null) => {
      const priceText = price
        ? `$${Math.round(price / 1000)}K`
        : "N/A";

      return L.divIcon({
        className: "custom-price-marker",
        html: `
          <div style="
            background: #3b82f6;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 2px solid white;
          ">${priceText}</div>
        `,
        iconSize: [60, 24],
        iconAnchor: [30, 12],
      });
    };

    // Add markers for each property
    validProperties.forEach((property) => {
      const marker = L.marker(
        [property.latitude!, property.longitude!],
        { icon: createMarkerIcon(property.price) }
      );

      // Create popup content
      const popupContent = `
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-weight: 600;">${property.title}</h3>
          ${property.address ? `<p style="margin: 0 0 4px 0; color: #666;">${property.address}</p>` : ""}
          ${property.price ? `<p style="margin: 0; font-weight: 600; color: #3b82f6;">$${property.price.toLocaleString()}</p>` : ""}
          <div style="margin-top: 8px; display: flex; gap: 8px; color: #666; font-size: 12px;">
            ${property.bedrooms != null ? `<span>${property.bedrooms} bed</span>` : ""}
            ${property.bathrooms != null ? `<span>${property.bathrooms} bath</span>` : ""}
            ${property.sqft != null ? `<span>${property.sqft.toLocaleString()} sqft</span>` : ""}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      if (onPropertyClick) {
        marker.on("click", () => onPropertyClick(property));
      }

      marker.addTo(markersRef.current!);
    });

    // Fit bounds to show all markers
    if (validProperties.length > 0) {
      const bounds = L.latLngBounds(
        validProperties.map((p) => [p.latitude!, p.longitude!])
      );
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [properties, onPropertyClick]);

  return (
    <div
      ref={mapRef}
      className={`w-full h-full min-h-[400px] ${className}`}
    />
  );
}
