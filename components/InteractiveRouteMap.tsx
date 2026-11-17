'use client';

import { useSyncExternalStore } from 'react';
import { JourneySimulation, RouteStrategyResult } from '@/lib/safepath-engine';
import { Navigation, Zap, Video, Hospital, AlertCircle } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';

interface InteractiveRouteMapProps {
  simulation: JourneySimulation;
  activeStrategy: RouteStrategyResult;
}

const emptySubscribe = () => () => {};

export default function InteractiveRouteMap({ simulation, activeStrategy }: InteractiveRouteMapProps) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const startCoord = activeStrategy.coordinates[0];
  const endCoord = activeStrategy.coordinates[activeStrategy.coordinates.length - 1];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-900 shadow-sm space-y-6">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <h3 className="text-lg font-bold flex items-center space-x-2 text-slate-900">
            <Navigation className="w-5 h-5 text-emerald-600" />
            <span>Bangalore Satellite Map & Segment Breakdown</span>
          </h3>
          <p className="text-xs text-slate-500">
            Visualizing <strong className="text-slate-800">{activeStrategy.name}</strong> ({simulation.timeOfDay.replace('_', ' ')} mode) over satellite imagery.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeStrategy.color }} />
            <span className="font-medium text-slate-700">Active Path</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
            <span className="font-medium text-slate-700">Emergency POI</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Working Satellite Leaflet Map */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 overflow-hidden h-[420px] relative z-10 shadow-inner bg-slate-100 flex items-center justify-center">
          {!isClient ? (
            <div className="text-slate-500 text-xs flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading Bangalore Satellite Map...</span>
            </div>
          ) : (
            <MapContainer
              center={simulation.centerCoordinates}
              zoom={14}
              scrollWheelZoom={false}
              style={{ width: '100%', height: '100%' }}
            >
              {/* Satellite View Only Tile Layer (Esri World Imagery) */}
              <TileLayer
                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />

              {/* Other routes rendered semi-transparent for comparison */}
              {simulation.strategies.map((strat) => {
                if (strat.id === activeStrategy.id) return null;
                return (
                  <Polyline
                    key={strat.id}
                    positions={strat.coordinates}
                    pathOptions={{ color: strat.color, weight: 3, opacity: 0.4, dashArray: '5, 5' }}
                  />
                );
              })}

              {/* Active route polyline */}
              <Polyline
                positions={activeStrategy.coordinates}
                pathOptions={{ color: activeStrategy.color, weight: 6, opacity: 0.9 }}
              />

              {/* Origin Marker */}
              {startCoord && (
                <Marker position={startCoord}>
                  <Popup>
                    <div className="text-xs font-bold text-slate-900">
                      <div>Origin</div>
                      <div className="font-normal text-slate-600">{simulation.origin}</div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Destination Marker */}
              {endCoord && (
                <Marker position={endCoord}>
                  <Popup>
                    <div className="text-xs font-bold text-slate-900">
                      <div>Destination</div>
                      <div className="font-normal text-slate-600">{simulation.destination}</div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Emergency Markers */}
              {simulation.emergencyMarkers.map((poi, idx) => (
                <Marker key={idx} position={[poi.lat, poi.lon]}>
                  <Popup>
                    <div className="text-xs font-bold text-slate-900">
                      <div>🚨 {poi.name}</div>
                      <div className="font-normal text-slate-600 capitalize">{poi.type} Facility (Bangalore)</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>

        {/* Segment Breakdown */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center space-x-2">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>Bangalore Segment Analysis</span>
            </h4>

            <div className="space-y-3 max-h-[330px] overflow-y-auto pr-1">
              {activeStrategy.segments.map((seg, idx) => (
                <div
                  key={seg.id}
                  className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    seg.isHighRisk
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-emerald-700 font-bold border border-slate-200">
                        {idx + 1}
                      </span>
                      <span>{seg.name}</span>
                    </span>
                    <span className="text-slate-500">{seg.distanceKm} km</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-600 pt-1">
                    <div className="bg-slate-50 p-1 rounded border border-slate-200 flex items-center space-x-1">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>Lit: {seg.lighting}%</span>
                    </div>
                    <div className="bg-slate-50 p-1 rounded border border-slate-200 flex items-center space-x-1">
                      <Video className="w-3 h-3 text-blue-500" />
                      <span>CCTV: {seg.cctvCoverage}%</span>
                    </div>
                    <div className="bg-slate-50 p-1 rounded border border-slate-200 flex items-center space-x-1">
                      <Hospital className="w-3 h-3 text-purple-500" />
                      <span>Emerg: {seg.emergencyProximity}%</span>
                    </div>
                  </div>

                  {seg.isHighRisk && (
                    <div className="flex items-center space-x-1 text-red-600 text-[10px] pt-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>High risk segment: Isolated / Low lighting</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-200 text-[11px] text-slate-500 text-center font-medium">
            Lighting: {activeStrategy.lightingAvg}% avg · CCTV: {activeStrategy.cctvAvg}% avg · Emergency: {activeStrategy.emergencyAvg}% avg
          </div>
        </div>
      </div>
    </div>
  );
}
