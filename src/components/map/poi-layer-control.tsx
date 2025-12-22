import type { POIType } from '@/types/poi';

interface POILayerControlProps {
  layers: Record<POIType, boolean>;
  onToggle: (type: POIType) => void;
}

const POI_CONFIG = {
  hospital: { label: 'Hospitals', color: '#ef4444' },
  university: { label: 'Universities', color: '#a855f7' },
  cegep: { label: 'CEGEPs', color: '#3b82f6' },
  metro: { label: 'Metro Stations', color: '#f97316' },
  rem: { label: 'REM Stations', color: '#14b8a6' },
};

export function POILayerControl({ layers, onToggle }: POILayerControlProps) {
  return (
    <div className="absolute top-4 right-4 z-[1000] bg-gray-900 rounded-lg p-3 shadow-lg">
      <h3 className="text-sm font-semibold text-white mb-2">Points of Interest</h3>
      <div className="space-y-1.5">
        {Object.entries(POI_CONFIG).map(([type, config]) => (
          <label
            key={type}
            className="flex items-center gap-2 cursor-pointer text-sm text-gray-200 hover:text-white"
          >
            <input
              type="checkbox"
              checked={layers[type as POIType]}
              onChange={() => onToggle(type as POIType)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 checked:bg-blue-600"
            />
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            <span>{config.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
