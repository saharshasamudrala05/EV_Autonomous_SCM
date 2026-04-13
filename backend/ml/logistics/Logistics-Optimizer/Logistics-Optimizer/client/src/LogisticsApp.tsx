import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L, { LatLngExpression, Polyline as LeafletPolyline } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Car, Truck, Zap, Navigation, MapPin,
  Map as MapIcon, RotateCw, Flag, List, Play, CheckCircle2, Database
} from 'lucide-react';

// --- Fix Leaflet Default Icon Issues in React ---
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const customMarkerIcon = (color: string) => L.divIcon({
  className: 'custom-icon',
  html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

// --- Types ---
interface Point { lat: number; lng: number; address: string; }
interface TrafficSegment { positions: [number, number][]; color: string; factor: number; }
interface RouteInfo {
  id: string;
  summary: string;
  distance: number;
  baseDuration: number;
  durationWithTraffic: number;
  segments: TrafficSegment[];
  rawPositions: [number, number][];
  steps: any[];
  scores: { car: number; truck: number; ev: number };
}

type VehicleType = 'car' | 'truck' | 'ev';

// --- Helper Functions ---
const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;

const solveTSP = (start: Point, points: Point[]): Point[] => {
  const distance = (p1: Point, p2: Point) => {
    const R = 6371;
    const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
    const dLon = (p2.lng - p1.lng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const route = [start];
  const unvisited = [...points];
  let current = start;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = distance(current, unvisited[i]);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    }
    current = unvisited[nearestIdx];
    route.push(current);
    unvisited.splice(nearestIdx, 1);
  }
  return route;
};

const generateTrafficSegments = (coordinates: [number, number][]): { segments: TrafficSegment[], avgFactor: number } => {
  const segments: TrafficSegment[] = [];
  let currentPoints: [number, number][] = [[coordinates[0][1], coordinates[0][0]]];
  let currentFactor = 1.0;
  let currentColor = '#3b82f6';
  let totalFactor = 0;
  let segmentCount = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const pt: [number, number] = [coordinates[i][1], coordinates[i][0]];
    currentPoints.push(pt);

    if (Math.random() > 0.85 || i === coordinates.length - 1) {
      segments.push({ positions: currentPoints, color: currentColor, factor: currentFactor });
      totalFactor += currentFactor;
      segmentCount++;
      currentPoints = [pt];
      const chance = Math.random();
      if (chance < 0.65) { currentFactor = 1.0; currentColor = '#3b82f6'; }
      else if (chance < 0.85) { currentFactor = 1.4; currentColor = '#f59e0b'; }
      else { currentFactor = 1.9; currentColor = '#ef4444'; }
    }
  }
  return { segments, avgFactor: segmentCount > 0 ? (totalFactor / segmentCount) : 1 };
};

const MapClickHandler = ({ onMapClick, mode }: { onMapClick: (ll: { lat: number, lng: number }) => void, mode: string }) => {
  useMapEvents({ click(e) { onMapClick(e.latlng); } });
  return null;
};

// --- LocationInput ---
// Previously called Nominatim directly on Enter/blur.
// Now calls the backend /api/geocoding proxy which has a 24-hour cross-session
// cache — repeated searches for the same city are instant.
const LocationInput = ({ placeholder, value, onSelect, icon: Icon }: any) => {
  const [query, setQuery] = useState(value?.address || '');

  useEffect(() => {
    if (value?.address) setQuery(value.address);
    else if (value) setQuery(`${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`);
    else setQuery('');
  }, [value]);

  const handleSearch = async (e?: React.KeyboardEvent) => {
    if (e && e.key !== 'Enter') return;
    if (!query.trim()) return;
    try {
      const res = await fetch(
        `/api/geocoding?query=${encodeURIComponent(query)}&limit=1`
      );
      const json = await res.json();
      const first = json.results?.[0];
      if (first) {
        onSelect({
          lat: first.lat,
          lng: first.lng,
          address: first.displayName.split(',')[0],
        });
      }
    } catch (err) {
      console.error('[LocationInput] Geocoding error:', err);
    }
  };

  return (
    <div className="flex bg-gray-50 rounded-lg shadow-sm overflow-hidden border border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all mb-2">
      <div className="p-3 text-gray-500 bg-white border-r border-gray-100"><Icon size={18} /></div>
      <input
        className="flex-1 px-3 py-2 outline-none text-sm bg-white"
        placeholder={placeholder}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleSearch}
        onBlur={() => handleSearch()}
      />
    </div>
  );
};

// --- Main App Component ---
function LogisticsDashboard() {
  const [pickup, setPickup] = useState<Point | null>(null);
  const [delivery, setDelivery] = useState<Point | null>(null);
  const [waypoints, setWaypoints] = useState<Point[]>([]);

  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<VehicleType>('car');
  const [mode, setMode] = useState<'normal' | 'multidrop'>('normal');
  const [isLoading, setIsLoading] = useState(false);
  const [deviationMarker, setDeviationMarker] = useState<Point | null>(null);

  // --- TITAN V4: DYNAMIC NODE HUB ---
  const [networkNodes, setNetworkNodes] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const mapRef = useRef<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state");
    if (state) {
      console.log("[TITAN V4] Contextual Handshake Detected: " + state);
      setSelectedState(state);
      fetch(`/api/nodes?state=${state}`)
        .then(res => res.json())
        .then(data => {
          setNetworkNodes(data);
          if (data.length > 0 && mapRef.current) {
            // Auto-center map on the new nodes
            const first = data[0];
            mapRef.current.setView([first.coordinates[0], first.coordinates[1]], 8);
          }
        })
        .catch(err => console.error("Node Discovery Error:", err));
    }
  }, []);

  const bestRouteId = React.useMemo(() => {
    if (!routes.length) return null;
    let bestId = routes[0].id;
    let minScore = Infinity;
    routes.forEach(r => {
      if (r.scores[vehicle] < minScore) { minScore = r.scores[vehicle]; bestId = r.id; }
    });
    return bestId;
  }, [routes, vehicle]);

  useEffect(() => {
    if (bestRouteId && !selectedRouteId) setSelectedRouteId(bestRouteId);
  }, [bestRouteId, selectedRouteId]);

  // ── Map click → reverse geocoding ──────────────────────────────────────────
  const handleMapClick = async (latlng: { lat: number; lng: number }) => {
    try {
      const res = await fetch(
        `/api/reverse-geocoding?lat=${latlng.lat}&lng=${latlng.lng}`
      );
      const json = await res.json();
      const address =
        json.displayName?.split(',')[0] ||
        `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;

      const pt: Point = { lat: latlng.lat, lng: latlng.lng, address };

      if (mode === 'multidrop') {
        if (!pickup) setPickup(pt);
        else setWaypoints(prev => [...prev, pt]);
      } else {
        if (!pickup) setPickup(pt);
        else if (!delivery) setDelivery(pt);
        else {
          setDeviationMarker(pt);
          calculateRoute(pt, delivery, []);
        }
      }
    } catch (e) {
      console.error('[LogisticsApp] Reverse geocoding failed:', e);
      const address = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
      const pt: Point = { lat: latlng.lat, lng: latlng.lng, address };
      if (mode === 'multidrop') {
        if (!pickup) setPickup(pt);
        else setWaypoints(prev => [...prev, pt]);
      } else {
        if (!pickup) setPickup(pt);
        else if (!delivery) setDelivery(pt);
        else { setDeviationMarker(pt); calculateRoute(pt, delivery, []); }
      }
    }
  };

  const calculateRoute = async (start: Point, end: Point, via: Point[] = []) => {
    setIsLoading(true);
    try {
      let coordsStr = `${start.lng},${start.lat}`;
      if (via.length > 0) {
        const ordered = solveTSP(start, [...via, end]);
        coordsStr = ordered.map(p => `${p.lng},${p.lat}`).join(';');
      } else {
        coordsStr += `;${end.lng},${end.lat}`;
      }

      const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?alternatives=true&steps=true&geometries=geojson&overview=full`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 'Ok') throw new Error('Routing failed');

      const parsedRoutes: RouteInfo[] = data.routes.map((r: any, idx: number) => {
        const { segments, avgFactor } = generateTrafficSegments(r.geometry.coordinates);
        const carScore = r.duration * avgFactor;
        const truckPenalty = r.legs.reduce((acc: number, leg: any) =>
          acc + leg.steps.filter((s: any) => s.name === '' || s.maneuver.modifier?.includes('sharp')).length * 500, 0);
        const evScore = r.distance * 1.5;

        return {
          id: `route-${idx}`,
          summary: r.legs[0].summary || `Alternative ${idx + 1}`,
          distance: r.distance,
          baseDuration: r.duration,
          durationWithTraffic: r.duration * avgFactor,
          segments,
          rawPositions: segments.flatMap((s: TrafficSegment) => s.positions),
          steps: r.legs.flatMap((l: any) => l.steps),
          scores: { car: carScore, truck: carScore + truckPenalty, ev: evScore },
        };
      });

      setRoutes(parsedRoutes);
      setSelectedRouteId(parsedRoutes[0].id);

      if (mapRef.current && parsedRoutes.length > 0) {
        const bounds = L.latLngBounds(parsedRoutes[0].rawPositions);
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (e) {
      console.error(e);
      alert("Error generating route. Try different points.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculate = () => {
    if (pickup && (delivery || waypoints.length > 0)) {
      if (mode === 'multidrop' && waypoints.length > 0) {
        const lastPoint = waypoints[waypoints.length - 1];
        calculateRoute(pickup, lastPoint, waypoints.slice(0, -1));
      } else if (delivery) {
        calculateRoute(pickup, delivery);
      }
    }
  };

  const clearAll = () => {
    setPickup(null);
    setDelivery(null);
    setWaypoints([]);
    setRoutes([]);
    setSelectedRouteId(null);
    setDeviationMarker(null);
  };

  return (
    <div className="flex h-screen w-full font-sans text-gray-800 bg-gray-100 overflow-hidden">

      {/* Sidebar Panel */}
      <div className="w-96 bg-white shadow-2xl flex flex-col z-20 relative">
        <div className="p-5 border-b border-gray-100 pb-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="flex items-center space-x-2 font-bold text-xl mb-4">
            <Navigation className="text-white" fill="currentColor" />
            <span>Logistics Optimizer</span>
          </div>

          <div className="flex space-x-3 mb-4 bg-blue-800/50 p-1 rounded-lg">
            <button
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${mode === 'normal' ? 'bg-white text-blue-800 shadow-sm' : 'text-blue-100 hover:bg-blue-800'}`}
              onClick={() => setMode('normal')}
            >
              Point-to-Point
            </button>
            <button
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${mode === 'multidrop' ? 'bg-white text-blue-800 shadow-sm' : 'text-blue-100 hover:bg-blue-800'}`}
              onClick={() => setMode('multidrop')}
            >
              Multi-Drop (VRP)
            </button>
          </div>

          <div className="space-y-3">
            <LocationInput icon={MapPin} placeholder="Choose pickup location..." value={pickup} onSelect={setPickup} />

            {mode === 'normal' && (
              <LocationInput icon={Flag} placeholder="Choose delivery destination..." value={delivery} onSelect={setDelivery} />
            )}

            {mode === 'multidrop' && waypoints.map((wp, i) => (
              <div key={i} className="flex space-x-2">
                <div className="flex-1">
                  <LocationInput icon={List} placeholder={`Stop ${i + 1}`} value={wp} onSelect={(p: Point) => {
                    const newWps = [...waypoints]; newWps[i] = p; setWaypoints(newWps);
                  }} />
                </div>
                <button onClick={() => setWaypoints(wp => wp.filter((_, idx) => idx !== i))} className="p-3 bg-red-500/10 text-red-200 rounded-lg">
                  <RotateCw size={16} />
                </button>
              </div>
            ))}

            {mode === 'multidrop' && (
              <button onClick={() => setWaypoints(wp => [...wp, { lat: 0, lng: 0, address: '' }])} className="text-sm text-blue-200 hover:text-white underline">
                + Add Stop
              </button>
            )}
          </div>

          <div className="flex space-x-2 mt-4">
            <button
              onClick={handleCalculate}
              disabled={isLoading}
              className="flex-1 bg-white text-blue-700 py-2.5 rounded-lg font-bold shadow-sm hover:bg-gray-50 flex justify-center items-center"
            >
              {isLoading
                ? <RotateCw className="animate-spin mr-2" size={18} />
                : <Navigation className="mr-2" size={18} />}
              Find Optimal Routes
            </button>
            <button onClick={clearAll} className="aspect-square p-2 border border-blue-400 text-blue-200 rounded-lg hover:bg-blue-800">
              <RotateCw size={18} />
            </button>
          </div>
        </div>

        {/* --- TITAN V4: PostgreSQL Node Discovery Hub --- */}
        {selectedState && networkNodes.length > 0 && (
          <div className="p-4 bg-gray-50 border-b border-gray-200 overflow-y-auto max-h-64">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Database size={12} className="text-blue-500" />
              Sovereign Handshake: {selectedState} Nodes
            </h3>
            <div className="space-y-2">
              {networkNodes.map((node) => (
                <div key={node.id} className="flex items-center justify-between bg-white p-2 rounded border border-gray-100 shadow-sm group hover:border-blue-300 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-gray-800 truncate max-w-[120px]">{node.name}</span>
                    <span className="text-[9px] text-gray-400 uppercase tracking-tighter">{node.node_type}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setPickup({ lat: node.coordinates[0], lng: node.coordinates[1], address: node.name })}
                      className="px-2 py-1 bg-blue-500 text-white text-[8px] font-bold rounded hover:bg-blue-600"
                    >
                      SET START
                    </button>
                    <button 
                      onClick={() => {
                        if (mode === 'normal') setDelivery({ lat: node.coordinates[0], lng: node.coordinates[1], address: node.name });
                        else setWaypoints(prev => [...prev.filter(w => w.address !== ''), { lat: node.coordinates[0], lng: node.coordinates[1], address: node.name }]);
                      }}
                      className="px-2 py-1 bg-indigo-500 text-white text-[8px] font-bold rounded hover:bg-indigo-600"
                    >
                      SET END
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Panel */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
          {routes.map((route) => {
            const isBest = route.id === bestRouteId;
            const isSelected = route.id === selectedRouteId;
            return (
              <div
                key={route.id}
                onClick={() => setSelectedRouteId(route.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden group
                  ${isSelected ? 'border-blue-500 bg-white shadow-md' : 'border-transparent bg-white shadow-sm hover:border-blue-200'}`}
              >
                {isBest && (
                   <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center">
                     <CheckCircle2 size={12} className="mr-1" /> RECOMMENDED
                   </div>
                )}
                <div className="flex justify-between items-start mb-2 mt-1">
                  <h3 className={`font-bold text-lg ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                    {formatDuration(route.durationWithTraffic)}
                  </h3>
                  <span className="text-gray-500 text-sm font-medium">{formatDistance(route.distance)}</span>
                </div>
                <p className="text-gray-600 text-sm line-clamp-1">{route.summary}</p>
                <div className="mt-3 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden flex">
                  {route.segments.map((seg, i) => (
                    <div key={i} style={{ width: `${(seg.positions.length / route.rawPositions.length) * 100}%`, backgroundColor: seg.color }} className="h-full" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Map View */}
      <div className="flex-1 relative">
        <MapContainer center={[20.5937, 78.9629]} zoom={5} className="h-full w-full" ref={mapRef} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler onMapClick={handleMapClick} mode={mode} />

          {pickup && (
            <Marker position={[pickup.lat, pickup.lng]} icon={customMarkerIcon('#2563eb')}>
              <Popup className="custom-popup"><b>Pickup:</b><br/>{pickup.address}</Popup>
            </Marker>
          )}

          {delivery && (
            <Marker position={[delivery.lat, delivery.lng]} icon={customMarkerIcon('#ef4444')}>
              <Popup className="custom-popup"><b>Destination:</b><br/>{delivery.address}</Popup>
            </Marker>
          )}

          {waypoints.map((wp, i) => wp.address && (
            <Marker key={i} position={[wp.lat, wp.lng]} icon={customMarkerIcon('#f59e0b')}>
              <Popup className="custom-popup"><b>Stop {i + 1}:</b><br/>{wp.address}</Popup>
            </Marker>
          ))}

          {/* TITAN V4: PostgreSQL Node Markers */}
          {networkNodes.map((node) => (
            <Marker key={`node-${node.id}`} position={[node.coordinates[0], node.coordinates[1]]} icon={customMarkerIcon('#4338ca')}>
               <Popup>
                 <b>{node.name}</b><br/>
                 Type: {node.node_type}<br/>
                 H3: {node.h3_index}
               </Popup>
            </Marker>
          ))}

          {routes.filter(r => r.id !== selectedRouteId).map(route => (
            <Polyline key={route.id} positions={route.rawPositions} color="#9ca3af" weight={4} opacity={0.6}
              eventHandlers={{ click: () => setSelectedRouteId(route.id) }} className="cursor-pointer" />
          ))}

          {routes.find(r => r.id === selectedRouteId)?.segments.map((seg, i) => (
            <Polyline key={`selected-${i}`} positions={seg.positions} color={seg.color} weight={6} opacity={0.9} lineCap="round" />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

// --- TITAN V4: BOOTSTRAP WRAPPER ---
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient();

export default function LogisticsApp() {
  return (
    <QueryClientProvider client={queryClient}>
        <LogisticsDashboard />
    </QueryClientProvider>
  );
}