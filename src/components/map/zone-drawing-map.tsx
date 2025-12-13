"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import type { PropertyEvaluation } from "@/types/property-evaluation";
import type { ScrapingZone, ZoneBounds } from "@/types/scraping-zone";

interface ZoneDrawingMapProps {
  evaluations?: PropertyEvaluation[];
  zones?: ScrapingZone[];
  className?: string;
  drawingEnabled?: boolean;
  onZoneDrawn?: (bounds: ZoneBounds) => void;
  onZoneClick?: (zone: ScrapingZone) => void;
}

export function ZoneDrawingMap({
  evaluations = [],
  zones = [],
  className = "",
  drawingEnabled = false,
  onZoneDrawn,
  onZoneClick,
}: ZoneDrawingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const montrealCenter: [number, number] = [45.5017, -73.5673];
    const map = L.map(mapRef.current).setView(montrealCenter, 11);
    mapInstanceRef.current = map;

    // Dark tile layer
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    // Create layer groups
    markersRef.current = L.layerGroup().addTo(map);
    zonesLayerRef.current = L.layerGroup().addTo(map);
    drawnItemsRef.current = new L.FeatureGroup().addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = null;
        zonesLayerRef.current = null;
        drawnItemsRef.current = null;
        drawControlRef.current = null;
      }
    };
  }, []);

  // Setup drawing controls
  useEffect(() => {
    if (!mapInstanceRef.current || !drawnItemsRef.current) return;

    // Remove existing control
    if (drawControlRef.current) {
      mapInstanceRef.current.removeControl(drawControlRef.current);
    }

    if (drawingEnabled) {
      const drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
          rectangle: {
            shapeOptions: {
              color: '#f59e0b', // Orange for new zones
              weight: 3,
              fillOpacity: 0.2,
            },
          },
          polygon: false,
          circle: false,
          marker: false,
          polyline: false,
          circlemarker: false,
        },
        edit: {
          featureGroup: drawnItemsRef.current,
          remove: false,
        },
      });

      mapInstanceRef.current.addControl(drawControl);
      drawControlRef.current = drawControl;

      // Handle draw created event
      const handleDrawCreated = (e: any) => {
        const layer = e.layer;
        drawnItemsRef.current?.addLayer(layer);

        // Get bounds
        const bounds = layer.getBounds();
        const zoneBounds: ZoneBounds = {
          minLat: bounds.getSouth(),
          maxLat: bounds.getNorth(),
          minLng: bounds.getWest(),
          maxLng: bounds.getEast(),
        };

        if (onZoneDrawn) {
          onZoneDrawn(zoneBounds);
        }

        // Clear the drawn layer (it will be saved and displayed via zones prop)
        drawnItemsRef.current?.removeLayer(layer);
      };

      mapInstanceRef.current.on(L.Draw.Event.CREATED, handleDrawCreated);

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.off(L.Draw.Event.CREATED, handleDrawCreated);
          if (drawControlRef.current) {
            mapInstanceRef.current.removeControl(drawControlRef.current);
            drawControlRef.current = null;
          }
        }
      };
    }
  }, [drawingEnabled, onZoneDrawn]);

  // Update evaluation markers
  useEffect(() => {
    if (!markersRef.current || !mapInstanceRef.current) return;

    markersRef.current.clearLayers();

    const validEvaluations = evaluations.filter(
      (e) => e.latitude != null && e.longitude != null
    );

    if (validEvaluations.length === 0) return;

    validEvaluations.forEach((evaluation) => {
      const marker = L.marker(
        [evaluation.latitude!, evaluation.longitude!],
        {
          icon: L.divIcon({
            className: "custom-evaluation-marker",
            html: `
              <div style="
                background: #10b981;
                color: white;
                padding: 3px 6px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: 600;
              ">${evaluation.nombre_logement ?? "?"}u</div>
            `,
            iconSize: [40, 20],
            iconAnchor: [20, 10],
          }),
        }
      );

      marker.bindPopup(`
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 13px;">${evaluation.clean_address}</h3>
          <div style="font-size: 11px; color: #666;">
            <div><strong>Units:</strong> ${evaluation.nombre_logement ?? "N/A"}</div>
            <div><strong>Category:</strong> ${evaluation.categorie_uef ?? "N/A"}</div>
          </div>
        </div>
      `);

      marker.addTo(markersRef.current!);
    });

    // Fit bounds if we have markers
    if (validEvaluations.length > 0) {
      const bounds = L.latLngBounds(
        validEvaluations.map((e) => [e.latitude!, e.longitude!])
      );
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [evaluations]);

  // Update zone overlays
  useEffect(() => {
    if (!zonesLayerRef.current || !mapInstanceRef.current) return;

    zonesLayerRef.current.clearLayers();

    zones.forEach((zone) => {
      const bounds = L.latLngBounds(
        [zone.min_lat, zone.min_lng],
        [zone.max_lat, zone.max_lng]
      );

      const rectangle = L.rectangle(bounds, {
        color: '#3b82f6', // Blue for saved zones
        weight: 2,
        fillOpacity: 0.1,
        dashArray: '5, 5',
      });

      // Zone label
      const center = bounds.getCenter();
      const label = L.divIcon({
        className: 'zone-label',
        html: `
          <div style="
            background: #3b82f6;
            color: white;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
          ">
            ${zone.name}
            <div style="font-size: 10px; opacity: 0.9;">
              ${zone.scraped_count}/${zone.total_properties} scraped
            </div>
          </div>
        `,
      });

      const marker = L.marker(center, { icon: label });

      // Click handler
      const handleClick = () => {
        if (onZoneClick) {
          onZoneClick(zone);
        }
      };

      rectangle.on('click', handleClick);
      marker.on('click', handleClick);

      rectangle.addTo(zonesLayerRef.current!);
      marker.addTo(zonesLayerRef.current!);
    });
  }, [zones, onZoneClick]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className={`w-full h-full min-h-[400px] ${className}`} />
      {drawingEnabled && (
        <div className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-[1000]">
          <p className="text-sm font-medium">Drawing Mode: Click to draw a rectangle</p>
        </div>
      )}
    </div>
  );
}
