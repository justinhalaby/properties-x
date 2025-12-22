"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Property } from "@/types/property";
import type { PropertyEvaluation } from "@/types/property-evaluation";
import type { POIType } from "@/types/poi";
import { usePOIs } from "@/hooks/usePOIs";
import { POILayerControl } from "./poi-layer-control";

interface PropertiesMapProps {
  properties: Property[];
  evaluations?: PropertyEvaluation[];
  className?: string;
  onPropertyClick?: (property: Property) => void;
  onScrapeSingle?: (matricule: string) => Promise<any>;
  highlightedMatricule?: string | null;
  zoneBounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export function PropertiesMap({
  properties,
  evaluations = [],
  className = "",
  onPropertyClick,
  onScrapeSingle,
  highlightedMatricule,
  zoneBounds,
}: PropertiesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const zoneBoundsRef = useRef<L.Rectangle | null>(null);
  const poiLayersRef = useRef<Record<POIType, L.LayerGroup>>({
    hospital: L.layerGroup(),
    university: L.layerGroup(),
    cegep: L.layerGroup(),
    metro: L.layerGroup(),
    rem: L.layerGroup(),
  });

  // Load POI data
  const { pois, getByType } = usePOIs();

  // POI layer visibility state
  const [poiLayers, setPoiLayers] = useState<Record<POIType, boolean>>({
    hospital: true,
    university: true,
    cegep: true,
    metro: true,
    rem: true,
  });

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
      // Clean up POI layers
      Object.values(poiLayersRef.current).forEach(layer => layer.remove());
    };
  }, []);

  // Draw zone bounds if provided
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing zone bounds
    if (zoneBoundsRef.current) {
      mapInstanceRef.current.removeLayer(zoneBoundsRef.current);
      zoneBoundsRef.current = null;
    }

    // Draw new zone bounds if provided
    if (zoneBounds) {
      const bounds: L.LatLngBoundsExpression = [
        [zoneBounds.minLat, zoneBounds.minLng],
        [zoneBounds.maxLat, zoneBounds.maxLng],
      ];

      zoneBoundsRef.current = L.rectangle(bounds, {
        color: "#3b82f6",
        weight: 2,
        fillOpacity: 0.05,
        dashArray: "5, 5",
      }).addTo(mapInstanceRef.current);
    }
  }, [zoneBounds]);

  // Toggle POI layer visibility
  const togglePOILayer = (type: POIType) => {
    setPoiLayers(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // Create POI markers for a specific type
  const createPOIMarkers = (type: POIType) => {
    if (!mapInstanceRef.current || !poiLayers[type]) return;

    const colors: Record<POIType, string> = {
      hospital: '#ef4444',    // Red
      university: '#a855f7',  // Purple
      cegep: '#3b82f6',       // Blue
      metro: '#f97316',       // Orange
      rem: '#14b8a6',         // Teal
    };

    const typePOIs = getByType(type);

    typePOIs.forEach(poi => {
      const displayName = poi.name.length > 20 ? poi.name.slice(0, 17) + '...' : poi.name;

      const icon = L.divIcon({
        className: 'poi-marker',
        html: `
          <div style="
            background-color: ${colors[type]};
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            border: 2px solid rgba(255,255,255,0.3);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            ${displayName}
          </div>
        `,
        iconSize: [undefined, 24],
        iconAnchor: [0, 12],
      });

      const popup = `
        <div style="min-width: 150px;">
          <strong style="font-size: 13px;">${poi.name}</strong><br/>
          <small style="color: #666; text-transform: uppercase; font-size: 10px;">${poi.type}</small><br/>
          ${poi.address ? `<small style="color: #666; font-size: 11px;">${poi.address}</small>` : ''}
        </div>
      `;

      // Note: GeoJSON coordinates are [lng, lat], Leaflet expects [lat, lng]
      L.marker([poi.coordinates[1], poi.coordinates[0]], { icon })
        .bindPopup(popup)
        .addTo(poiLayersRef.current[type]);
    });

    poiLayersRef.current[type].addTo(mapInstanceRef.current);
  };

  // Update POI layers when visibility or data changes
  useEffect(() => {
    if (!mapInstanceRef.current || pois.length === 0) return;

    Object.entries(poiLayers).forEach(([type, visible]) => {
      const poiType = type as POIType;

      // Clear existing layer
      poiLayersRef.current[poiType].clearLayers();

      if (visible) {
        createPOIMarkers(poiType);
      } else {
        // Remove from map if not visible
        if (mapInstanceRef.current?.hasLayer(poiLayersRef.current[poiType])) {
          mapInstanceRef.current.removeLayer(poiLayersRef.current[poiType]);
        }
      }
    });
  }, [poiLayers, pois, getByType]);

  // Update markers when properties or evaluations change
  useEffect(() => {
    if (!markersRef.current || !mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.clearLayers();

    const validProperties = properties.filter(
      (p) => p.latitude != null && p.longitude != null
    );

    const validEvaluations = evaluations.filter(
      (e) => e.latitude != null && e.longitude != null
    );

    if (validProperties.length === 0 && validEvaluations.length === 0) return;

    // Create custom marker icon for properties
    const createPropertyMarkerIcon = (price: number | null) => {
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

    // Create custom marker icon for evaluations
    const createEvaluationMarkerIcon = (
      units: number | null,
      isHighlighted: boolean = false,
      isScraped: boolean = false
    ) => {
      const unitsText = units != null ? `${units}u` : "?u";

      // Determine color: highlighted > scraped > not scraped
      let backgroundColor: string;
      if (isHighlighted) {
        backgroundColor = '#f59e0b'; // Orange for highlighted
      } else if (isScraped) {
        backgroundColor = '#10b981'; // Green for scraped
      } else {
        backgroundColor = '#6b7280'; // Gray for not scraped
      }

      return L.divIcon({
        className: "custom-evaluation-marker",
        html: `
          <div style="
            background: ${backgroundColor};
            color: white;
            padding: ${isHighlighted ? '6px 10px' : '4px 8px'};
            border-radius: 4px;
            font-size: ${isHighlighted ? '13px' : '11px'};
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 ${isHighlighted ? '4px 12px' : '2px 8px'} rgba(0,0,0,0.3);
            border: ${isHighlighted ? '3px' : '2px'} solid white;
            transform: ${isHighlighted ? 'scale(1.2)' : 'scale(1)'};
          ">${unitsText}</div>
        `,
        iconSize: [50, 24],
        iconAnchor: [25, 12],
      });
    };

    // Add markers for each property
    validProperties.forEach((property) => {
      const marker = L.marker(
        [property.latitude!, property.longitude!],
        { icon: createPropertyMarkerIcon(property.price) }
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

    // Add markers for each evaluation
    validEvaluations.forEach((evaluation) => {
      const isHighlighted = highlightedMatricule === evaluation.matricule83;
      const isScraped = (evaluation as any).is_scraped || false;
      const marker = L.marker(
        [evaluation.latitude!, evaluation.longitude!],
        { icon: createEvaluationMarkerIcon(evaluation.nombre_logement, isHighlighted, isScraped) }
      );

      // Format scraped date if available
      const scrapedDate = (evaluation as any).scraped_at
        ? new Date((evaluation as any).scraped_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        : null;

      // Create popup content
      const popupContent = `
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-weight: 600; font-size: 14px;">${evaluation.clean_address}</h3>
          <div style="font-size: 12px; color: #666; line-height: 1.6;">
            <div><strong>Units:</strong> ${evaluation.nombre_logement ?? "N/A"}</div>
            <div><strong>Category:</strong> ${evaluation.categorie_uef}</div>
            <div><strong>Year:</strong> ${evaluation.annee_construction === 9999 ? "Unknown" : evaluation.annee_construction ?? "N/A"}</div>
            <div><strong>Floors:</strong> ${evaluation.etage_hors_sol ?? "N/A"}</div>
            ${evaluation.superficie_terrain ? `<div><strong>Land:</strong> ${evaluation.superficie_terrain.toLocaleString()} m²</div>` : ""}
          </div>
          ${(evaluation as any).is_scraped
            ? `<div style="
                margin-top: 8px;
                padding: 6px 12px;
                background: #10b981;
                color: white;
                border-radius: 4px;
                font-size: 11px;
                text-align: center;
              ">
                ✓ Scraped ${scrapedDate ? `on ${scrapedDate}` : ''}
              </div>`
            : `<button
                data-matricule="${evaluation.matricule83}"
                class="scrape-button"
                style="
                  display: block;
                  width: 100%;
                  margin-top: 8px;
                  padding: 6px 12px;
                  background: #3b82f6;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  font-size: 12px;
                  font-weight: 600;
                  cursor: pointer;
                "
              >Scrape Now</button>`
          }
          <a
            href="/buildings/${evaluation.matricule83}"
            style="
              display: inline-block;
              margin-top: 8px;
              width: 100%;
              padding: 4px 12px;
              background: #10b981;
              color: white;
              border-radius: 4px;
              text-decoration: none;
              font-size: 12px;
              font-weight: 600;
              text-align: center;
              box-sizing: border-box;
            "
          >View Details</a>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Add click handler for scrape button
      marker.on('popupopen', () => {
        const scrapeButton = document.querySelector(`button[data-matricule="${evaluation.matricule83}"]`);
        if (scrapeButton && onScrapeSingle) {
          scrapeButton.addEventListener('click', async () => {
            scrapeButton.textContent = 'Scraping...';
            (scrapeButton as HTMLButtonElement).disabled = true;

            const result = await onScrapeSingle(evaluation.matricule83);

            if (result.success) {
              scrapeButton.textContent = '✓ Scraped!';
            } else if (result.already_scraped) {
              scrapeButton.textContent = 'Already Scraped';
            } else {
              scrapeButton.textContent = 'Failed - Try Again';
              (scrapeButton as HTMLButtonElement).disabled = false;
            }
          });
        }
      });

      marker.addTo(markersRef.current!);
    });

    // Fit bounds to show all markers
    const allCoords: [number, number][] = [
      ...validProperties.map((p) => [p.latitude!, p.longitude!] as [number, number]),
      ...validEvaluations.map((e) => [e.latitude!, e.longitude!] as [number, number]),
    ];

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [properties, evaluations, onPropertyClick, onScrapeSingle, highlightedMatricule]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapRef}
        className={`w-full h-full min-h-[400px] ${className}`}
      />

      {/* POI Layer Control */}
      {mapInstanceRef.current && (
        <POILayerControl
          layers={poiLayers}
          onToggle={togglePOILayer}
        />
      )}

      {/* Map Legend */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          right: "10px",
          background: "white",
          padding: "12px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          zIndex: 1000,
          fontSize: "12px",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "8px", fontSize: "13px" }}>
          Map Legend
        </div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
          <div
            style={{
              width: "24px",
              height: "18px",
              background: "#3b82f6",
              border: "2px solid white",
              marginRight: "8px",
              borderRadius: "3px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          ></div>
          <span>Properties (Price)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
          <div
            style={{
              width: "24px",
              height: "18px",
              background: "#10b981",
              border: "2px solid white",
              marginRight: "8px",
              borderRadius: "3px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          ></div>
          <span>Scraped Buildings</span>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: "24px",
              height: "18px",
              background: "#6b7280",
              border: "2px solid white",
              marginRight: "8px",
              borderRadius: "3px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          ></div>
          <span>Not Scraped Buildings</span>
        </div>
      </div>
    </div>
  );
}
