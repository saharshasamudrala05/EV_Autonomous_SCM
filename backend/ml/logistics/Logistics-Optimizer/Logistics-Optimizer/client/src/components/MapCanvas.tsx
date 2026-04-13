import {
  useEffect,
  useRef,
  useState,
  useCallback,
  memo,
  useMemo,
} from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { OptimizeRequest, OptimizeResponse, RouteResult } from "@shared/schema";
import { decodePolyline } from "@shared/utils";
import {
  destinationIcon,
  routeColors,
  getVehicleIcon,
  calculateBearing,
  makeDepotIcon,
  makeStopIcon,
  makeChargingIcon,
  DARK_TILE_URL,
  LIGHT_TILE_URL,
  TILE_ATTRIBUTION,
} from "@/lib/leaflet-icons";
import {
  BatteryCharging,
  Clock,
  MapPin,
  Navigation,
  CloudLightning,
  AlertTriangle,
  Warehouse,
  Sun,
  Moon,
} from "lucide-react";
import L from "leaflet";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type DispatchState = "idle" | "reviewing" | "dispatched" | "completed";

interface SegmentPoint {
  pos: [number, number];
}

interface VehicleAnimInternal {
  vehicleId: string;
  vehicleType: string;
  color: string;
  points: SegmentPoint[];
  /** Floating-point cursor — advances by speedPps * dt each frame. */
  cursor: number;
  bearing: number;
  progress: number;
  status: "waiting" | "in_transit" | "delivering" | "completed";
  depotName?: string;
  depotPosition: [number, number];
  /** Imperative Leaflet vehicle marker */
  marker: L.Marker | null;
  /** Cached reference to the .vrp-vehicle-rot div — avoids querySelector every frame */
  rotEl: HTMLElement | null;
  /** Cached reference to the .vrp-vehicle-wrap div — receives .vrp-done for fade */
  wrapEl: HTMLElement | null;
  /** Animated progress polyline — grows from start as vehicle moves */
  progressLine: L.Polyline | null;
  zoom: number;
}

export interface VehicleProgressUpdate {
  vehicleId: string;
  progress: number;
  status: VehicleAnimInternal["status"];
  position: [number, number];
}

interface MapCanvasProps {
  requestParams: OptimizeRequest;
  response: OptimizeResponse | undefined;
  onLocationSelect?: (lat: number, lng: number) => void;
  dispatchState: DispatchState;
  onAllVehiclesCompleted?: () => void;
  onVehicleProgressUpdate?: (updates: VehicleProgressUpdate[]) => void;
  /** Points per original polyline segment. 40 is smooth. */
  interpolationSteps?: number;
  /** Segment points advanced per second. 120 ≈ visible city-speed. */
  animationSpeedPps?: number;
  /**
   * Initial tile style. The user can toggle between modes via the in-map
   * button, so this is just the starting preference.
   * Defaults to "dark".
   */
  initialMapMode?: "dark" | "light";
}

// ─────────────────────────────────────────────────────────────────────────────
// Lerp / interpolation helpers
// ─────────────────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function lerpLatLng(
  from: [number, number],
  to: [number, number],
  t: number,
): [number, number] {
  return [lerp(from[0], to[0], t), lerp(from[1], to[1], t)];
}

function buildSegmentPoints(
  polyline: [number, number][],
  steps: number,
): SegmentPoint[] {
  if (polyline.length < 2) return polyline.map(pos => ({ pos }));
  const out: SegmentPoint[] = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    for (let s = 0; s < steps; s++) {
      out.push({ pos: lerpLatLng(polyline[i], polyline[i + 1], s / steps) });
    }
  }
  out.push({ pos: polyline[polyline.length - 1] });
  return out;
}

function interpolatePosition(
  points: SegmentPoint[],
  cursor: number,
): [number, number] {
  const n = points.length;
  if (n === 0) return [0, 0];
  if (cursor <= 0) return points[0].pos;
  if (cursor >= n - 1) return points[n - 1].pos;
  const i = Math.floor(cursor);
  return lerpLatLng(points[i].pos, points[i + 1].pos, cursor - i);
}

// ─────────────────────────────────────────────────────────────────────────────
// ZoomTracker
// ─────────────────────────────────────────────────────────────────────────────
function ZoomTracker({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  const map = useMap();
  useEffect(() => { onZoomChange(map.getZoom()); }, [map, onZoomChange]);
  useMapEvents({ zoomend() { onZoomChange(map.getZoom()); } });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// BoundsUpdater
// ─────────────────────────────────────────────────────────────────────────────
function BoundsUpdater({
  requestParams,
  response,
}: {
  requestParams: OptimizeRequest;
  response?: OptimizeResponse;
}) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([]);
    requestParams.vehicles?.forEach(v =>
      bounds.extend([v.startLocation.lat, v.startLocation.lng]),
    );
    if (requestParams.depot)
      bounds.extend([requestParams.depot.lat, requestParams.depot.lng]);
    requestParams.stops.forEach(s => bounds.extend([s.lat, s.lng]));
    if (requestParams.destination)
      bounds.extend([requestParams.destination.lat, requestParams.destination.lng]);
    if (response)
      response.routes.forEach(route =>
        decodePolyline(route.polyline).forEach(pt =>
          bounds.extend(pt as [number, number]),
        ),
      );
    if (bounds.isValid())
      map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1 });
  }, [map, requestParams, response]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MapEventsHandler
// ─────────────────────────────────────────────────────────────────────────────
function MapEventsHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// StaticDepotLayer
// ─────────────────────────────────────────────────────────────────────────────
const StaticDepotLayer = memo(function StaticDepotLayer({
  requestParams,
  currentZoom,
}: {
  requestParams: OptimizeRequest;
  currentZoom: number;
}) {
  return (
    <>
      {requestParams.destination && (
        <Marker
          position={[requestParams.destination.lat, requestParams.destination.lng]}
          icon={destinationIcon}
        >
          <Popup>
            <div className="p-3">
              <div className="flex items-center gap-2 font-semibold text-base mb-1">
                <MapPin className="w-4 h-4 text-destructive" /> Final Destination
              </div>
              {requestParams.destination.address && (
                <p className="text-xs text-muted-foreground">
                  {requestParams.destination.address}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      )}

      {requestParams.vehicles && requestParams.vehicles.length > 0
        ? requestParams.vehicles.map((v, idx) => (
          <Marker
            key={`depot-${v.id}`}
            position={[v.startLocation.lat, v.startLocation.lng]}
            icon={makeDepotIcon(currentZoom)}
          >
            <Popup>
              <div className="p-3">
                <div className="flex items-center gap-2 font-semibold text-base mb-1">
                  <Warehouse className="w-4 h-4 text-primary" />
                  {v.depotName ?? `Depot ${idx + 1}`}
                </div>
                <p className="text-xs text-muted-foreground">
                  {v.startLocation.address ??
                    `${v.startLocation.lat.toFixed(4)}, ${v.startLocation.lng.toFixed(4)}`}
                </p>
                <p className="text-xs mt-1">
                  Vehicle: <strong>{v.id}</strong> ·{" "}
                  <span className="capitalize">{v.type.replace(/_/g, " ")}</span>
                </p>
                <p className="text-xs">Capacity: <strong>{v.capacityUnits}</strong> units</p>
              </div>
            </Popup>
          </Marker>
        ))
        : requestParams.depot && (
          <Marker
            position={[requestParams.depot.lat, requestParams.depot.lng]}
            icon={makeDepotIcon(currentZoom)}
          >
            <Popup>
              <div className="p-3">
                <div className="flex items-center gap-2 font-semibold text-base mb-1">
                  <Navigation className="w-4 h-4 text-primary" /> Depot
                </div>
              </div>
            </Popup>
          </Marker>
        )}

      {requestParams.stops.map((stop, idx) => (
        <Marker
          key={`pending-stop-${idx}`}
          position={[stop.lat, stop.lng]}
          icon={makeStopIcon(idx + 1, currentZoom)}
        >
          <Popup>
            <div className="p-3">
              <div className="flex items-center gap-2 font-semibold text-base mb-1">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                Delivery Stop {idx + 1}
              </div>
              {stop.address && (
                <p className="text-xs text-muted-foreground">{stop.address}</p>
              )}
              {stop.demand !== undefined && stop.demand > 0 && (
                <p className="text-xs mt-1 font-medium text-primary">
                  Demand: {stop.demand} units
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// StaticRouteLayer
// Polylines are rendered slightly dimmed so the animated progress line pops.
// ─────────────────────────────────────────────────────────────────────────────
const StaticRouteLayer = memo(function StaticRouteLayer({
  routes,
  currentZoom,
}: {
  routes: RouteResult[];
  currentZoom: number;
}) {
  return (
    <>
      {routes.map((route, routeIdx) => {
        const color = routeColors[routeIdx % routeColors.length];
        const hasRestrictions = route.roadRestrictions && route.roadRestrictions.length > 0;

        return (
          <div key={`route-group-${route.vehicleId}`}>
            {/* Undriven portion — dimmer, acts as the "remaining track" */}
            <Polyline
              positions={decodePolyline(route.polyline) as [number, number][]}
              pathOptions={{
                color,
                weight: 3,
                opacity: 0.25,   // deliberately faint — progress line is brighter
                lineCap: "round",
                lineJoin: "round",
                dashArray: hasRestrictions ? "8 5" : undefined,
              }}
            >
              <Popup>
                <div className="p-3 min-w-[200px]">
                  <div className="flex items-center gap-2 font-semibold text-base mb-2" style={{ color }}>
                    Vehicle {route.vehicleId}
                    {route.assignedVehicleType && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300 font-normal capitalize">
                        {route.assignedVehicleType.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  {route.depotName && (
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Warehouse className="w-3 h-3" /> {route.depotName}
                    </p>
                  )}
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>ETA: <strong>{route.eta}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{route.distanceKm} km · {route.loadUnits}/{route.capacityUnits} units</span>
                    </div>
                    {hasRestrictions && (
                      <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div className="text-xs">
                          {route.roadRestrictions!.map((r, i) => <div key={i}>{r}</div>)}
                        </div>
                      </div>
                    )}
                    {route.weather && route.weather.length > 0 && (
                      <div className="flex items-start gap-2">
                        <CloudLightning className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          {route.weather.join(" · ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Polyline>

            {route.stops.map((stop, stopIdx) => (
              <Marker
                key={`route-${route.vehicleId}-stop-${stopIdx}`}
                position={[stop.lat, stop.lng]}
                icon={makeStopIcon(stopIdx + 1, currentZoom)}
              >
                <Popup>
                  <div className="p-3">
                    <div className="flex items-center gap-2 font-semibold text-base mb-1">
                      <MapPin className="w-4 h-4 text-muted-foreground" /> Stop {stopIdx + 1}
                    </div>
                    <p className="text-xs text-muted-foreground">Vehicle {route.vehicleId}</p>
                    {stop.address && <p className="text-xs mt-0.5">{stop.address}</p>}
                    {stop.demand !== undefined && stop.demand > 0 && (
                      <p className="text-xs mt-1 font-medium text-primary">
                        Demand: {stop.demand} units
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {route.chargingStops.map((stop, stopIdx) => (
              <Marker
                key={`route-${route.vehicleId}-charge-${stopIdx}`}
                position={[stop.lat, stop.lng]}
                icon={makeChargingIcon(currentZoom)}
              >
                <Popup>
                  <div className="p-3">
                    <div className="flex items-center gap-2 font-semibold text-base mb-1 text-accent">
                      <BatteryCharging className="w-4 h-4" /> Charging Station
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Vehicle {route.vehicleId} recharge point
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </div>
        );
      })}
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ImperativeVehicleLayer
//
// All markers and progress polylines are managed via the Leaflet imperative API.
// Zero React renders per animation frame — buttery 60fps with no diffing cost.
//
// Per-vehicle progress polyline design:
//   • Created as an empty L.polyline when routes arrive
//   • Each frame: setLatLngs(points[0 .. floor(cursor)]) — grows as vehicle moves
//   • Colour: full route colour at opacity 0.85 — brighter than the dim static line
//   • Weight 4 with rounded caps — matches Uber's "driven" trail style
//
// Bearing update:
//   • We store a direct ref to the .vrp-vehicle-rot element at marker creation
//   • When bearing changes > 1.5°, write style.transform directly — CSS takes
//     care of the 260ms smooth rotation transition (defined in leaflet-icons.ts)
//
// Completion:
//   • Add class "vrp-done" to .vrp-vehicle-wrap → CSS fade-out animation fires
// ─────────────────────────────────────────────────────────────────────────────
interface ImperativeVehicleLayerProps {
  routes: RouteResult[];
  dispatchState: DispatchState;
  currentZoom: number;
  interpolationSteps: number;
  animationSpeedPps: number;
  requestParams: OptimizeRequest;
  onAllVehiclesCompleted?: () => void;
  onVehicleProgressUpdate?: (updates: VehicleProgressUpdate[]) => void;
}

function ImperativeVehicleLayer({
  routes,
  dispatchState,
  currentZoom,
  interpolationSteps,
  animationSpeedPps,
  requestParams,
  onAllVehiclesCompleted,
  onVehicleProgressUpdate,
}: ImperativeVehicleLayerProps) {
  const map = useMap();

  const statesRef = useRef<VehicleAnimInternal[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  const completedRef = useRef(onAllVehiclesCompleted);
  const progressRef = useRef(onVehicleProgressUpdate);
  useEffect(() => { completedRef.current = onAllVehiclesCompleted; }, [onAllVehiclesCompleted]);
  useEffect(() => { progressRef.current = onVehicleProgressUpdate; }, [onVehicleProgressUpdate]);

  // ── Create markers + progress polylines when routes arrive ────────────────
  useEffect(() => {
    // Clean up previous session
    statesRef.current.forEach(s => {
      if (s.marker) map.removeLayer(s.marker);
      if (s.progressLine) map.removeLayer(s.progressLine);
    });
    statesRef.current = [];
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    if (!routes.length) return;

    const states: VehicleAnimInternal[] = routes.map((route, idx) => {
      const color = routeColors[idx % routeColors.length];
      const poly = decodePolyline(route.polyline);
      const points = buildSegmentPoints(poly, interpolationSteps);
      const cfg = requestParams.vehicles?.[route.vehicleIndex];
      const depotPos: [number, number] = cfg
        ? [cfg.startLocation.lat, cfg.startLocation.lng]
        : [0, 0];

      const startPos = points[0]?.pos ?? depotPos;

      // ── Vehicle marker ─────────────────────────────────────────────────
      const icon = getVehicleIcon(route.assignedVehicleType ?? "container_truck", color, 0, false, currentZoom);
      const marker = L.marker(startPos, { icon, zIndexOffset: 1000, interactive: true });

      marker.bindPopup(`
        <div style="padding:12px;min-width:160px;font-family:system-ui,sans-serif;">
          <div style="font-weight:700;font-size:14px;color:${color};margin-bottom:4px;">
            Vehicle ${route.vehicleId}
          </div>
          ${route.depotName
          ? `<p style="font-size:11px;color:#aaa;margin:0 0 4px;">🏭 ${route.depotName}</p>`
          : ''}
          <p style="font-size:11px;color:#888;margin:0;text-transform:capitalize;">
            ${(route.assignedVehicleType ?? 'vehicle').replace(/_/g, ' ')}
          </p>
        </div>`);

      marker.addTo(map);

      // Cache DOM refs immediately after addTo so we never query each frame
      const markerEl = marker.getElement();
      const rotEl = markerEl?.querySelector<HTMLElement>('.vrp-vehicle-rot') ?? null;
      const wrapEl = markerEl?.querySelector<HTMLElement>('.vrp-vehicle-wrap') ?? null;

      // ── Animated progress polyline ──────────────────────────────────────
      // Starts empty — grows as the vehicle moves forward.
      // Sits above the dim static polyline (zIndex handled by Leaflet pane).
      const progressLine = L.polyline([], {
        color,
        weight: 4,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      return {
        vehicleId: route.vehicleId,
        vehicleType: route.assignedVehicleType ?? "container_truck",
        color,
        points,
        cursor: 0,
        bearing: 0,
        progress: 0,
        status: "waiting" as const,
        depotName: route.depotName,
        depotPosition: depotPos,
        marker,
        rotEl,
        wrapEl,
        progressLine,
        zoom: currentZoom,
      };
    });

    statesRef.current = states;

    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      states.forEach(s => {
        if (s.marker) map.removeLayer(s.marker);
        if (s.progressLine) map.removeLayer(s.progressLine);
      });
      statesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, map, interpolationSteps]);

  // ── Rebuild icon on zoom change ────────────────────────────────────────────
  useEffect(() => {
    statesRef.current.forEach(s => {
      if (!s.marker) return;
      s.zoom = currentZoom;
      if (s.status !== "in_transit") {
        const icon = getVehicleIcon(s.vehicleType, s.color, s.bearing, false, currentZoom);
        s.marker.setIcon(icon);
        // Re-cache DOM refs after icon rebuild
        const el = s.marker.getElement();
        s.rotEl = el?.querySelector<HTMLElement>('.vrp-vehicle-rot') ?? null;
        s.wrapEl = el?.querySelector<HTMLElement>('.vrp-vehicle-wrap') ?? null;
      }
    });
  }, [currentZoom]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (dispatchState !== "dispatched") return;

    statesRef.current.forEach(s => {
      if (s.status === "waiting") s.status = "in_transit";
    });

    const tick = (ts: number) => {
      const dt = lastTsRef.current === 0 ? 0 : (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      let allDone = true;
      const updates: VehicleProgressUpdate[] = [];

      for (const s of statesRef.current) {
        if (s.status === "completed") {
          updates.push({
            vehicleId: s.vehicleId, progress: 100, status: "completed",
            position: s.points[s.points.length - 1]?.pos ?? s.depotPosition,
          });
          continue;
        }

        allDone = false;
        const total = s.points.length;
        if (total < 2) { s.status = "completed"; continue; }

        // Advance cursor (frame-rate independent)
        s.cursor = Math.min(s.cursor + animationSpeedPps * dt, total - 1);

        const pos = interpolatePosition(s.points, s.cursor);
        const progress = Math.round((s.cursor / (total - 1)) * 100);

        // Bearing — look ahead a couple of points for stability
        const nextIdx = Math.min(Math.ceil(s.cursor) + 2, total - 1);
        const fromPos = s.points[Math.floor(s.cursor)].pos;
        const toPos = s.points[nextIdx].pos;
        const bearing = calculateBearing(fromPos[0], fromPos[1], toPos[0], toPos[1]);
        const bearingDelta = Math.abs(bearing - s.bearing);

        s.bearing = bearing;
        s.progress = progress;

        // ── Imperative position update (no React) ──────────────────────────
        if (s.marker) s.marker.setLatLng(pos);

        // Bearing: write to cached rotEl — CSS transition handles the smooth turn
        if (bearingDelta > 1.5 && s.rotEl) {
          s.rotEl.style.transform = `rotate(${bearing}deg)`;
        }

        // ── Animated progress polyline ──────────────────────────────────────
        // Rebuild from start up to current integer cursor index.
        // We sample every other point to keep the latlngs array small.
        if (s.progressLine) {
          const endIdx = Math.floor(s.cursor);
          const latlngs: [number, number][] = [];
          for (let i = 0; i <= endIdx; i += 2) {
            latlngs.push(s.points[i].pos);
          }
          // Always include the exact current position as the last point
          // so the line head perfectly tracks the vehicle.
          latlngs.push(pos);
          s.progressLine.setLatLngs(latlngs);
        }

        if (s.cursor >= total - 1) {
          s.status = "completed";
          // Trigger CSS fade-out by adding class to the wrapper div
          s.wrapEl?.classList.add('vrp-done');
        }

        updates.push({ vehicleId: s.vehicleId, progress, status: s.status, position: pos });
      }

      progressRef.current?.(updates);

      if (allDone) {
        setTimeout(() => completedRef.current?.(), 800);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      lastTsRef.current = 0;
    };
  }, [dispatchState, animationSpeedPps]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MapCanvas
// ─────────────────────────────────────────────────────────────────────────────
export default function MapCanvas({
  requestParams,
  response,
  onLocationSelect,
  dispatchState,
  onAllVehiclesCompleted,
  onVehicleProgressUpdate,
  interpolationSteps = 40,
  animationSpeedPps = 120,
  initialMapMode = "dark",
}: MapCanvasProps) {
  const center: [number, number] =
    requestParams.vehicles?.[0]?.startLocation
      ? [
        requestParams.vehicles[0].startLocation.lat,
        requestParams.vehicles[0].startLocation.lng,
      ]
      : requestParams.depot
        ? [requestParams.depot.lat, requestParams.depot.lng]
        : [17.385, 78.4867];

  const [currentZoom, setCurrentZoom] = useState<number>(10);
  const handleZoomChange = useCallback((z: number) => setCurrentZoom(z), []);

  // ── Map mode (light / dark) ────────────────────────────────────────────────
  const [mapMode, setMapMode] = useState<"dark" | "light">(initialMapMode);
  const toggleMapMode = useCallback(
    () => setMapMode(m => (m === "dark" ? "light" : "dark")),
    [],
  );
  const tileUrl = mapMode === "dark" ? DARK_TILE_URL : LIGHT_TILE_URL;
  // ──────────────────────────────────────────────────────────────────────────

  const solvedRoutes = useMemo(() => response?.routes ?? [], [response]);

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={center}
        zoom={10}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer url={tileUrl} attribution={TILE_ATTRIBUTION} />

        <ZoomTracker onZoomChange={handleZoomChange} />
        <BoundsUpdater requestParams={requestParams} response={response} />
        {onLocationSelect && <MapEventsHandler onMapClick={onLocationSelect} />}

        {/* Static layers — re-render only on data change, never during animation */}
        <StaticDepotLayer requestParams={requestParams} currentZoom={currentZoom} />

        {solvedRoutes.length > 0 && (
          <StaticRouteLayer routes={solvedRoutes} currentZoom={currentZoom} />
        )}

        {/* Imperative animation layer — zero React renders per frame */}
        {(dispatchState === "dispatched" || dispatchState === "completed") &&
          solvedRoutes.length > 0 && (
            <ImperativeVehicleLayer
              routes={solvedRoutes}
              dispatchState={dispatchState}
              currentZoom={currentZoom}
              interpolationSteps={interpolationSteps}
              animationSpeedPps={animationSpeedPps}
              requestParams={requestParams}
              onAllVehiclesCompleted={onAllVehiclesCompleted}
              onVehicleProgressUpdate={onVehicleProgressUpdate}
            />
          )}
      </MapContainer>

      {/* ── Light / Dark toggle ────────────────────────────────────────────
           Positioned top-right inside the map, above Leaflet's own controls.
           z-[1000] matches Leaflet's control pane so it never disappears
           behind tiles, but sits in the DOM outside MapContainer so it
           never accidentally receives Leaflet click events.
      ──────────────────────────────────────────────────────────────────── */}
      <button
        onClick={toggleMapMode}
        aria-label={mapMode === "dark" ? "Switch to light map" : "Switch to dark map"}
        title={mapMode === "dark" ? "Switch to light map" : "Switch to dark map"}
        className={[
          "absolute top-3 right-3 z-[1000]",
          "flex items-center gap-1.5 px-2.5 py-1.5",
          "rounded-lg text-xs font-medium",
          "border transition-all duration-200",
          "shadow-md select-none",
          mapMode === "dark"
            ? "bg-zinc-900/90 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            : "bg-white/90 border-zinc-200 text-zinc-700 hover:bg-zinc-50",
        ].join(" ")}
      >
        {mapMode === "dark" ? (
          <>
            <Sun className="w-3.5 h-3.5" />
            <span>Light</span>
          </>
        ) : (
          <>
            <Moon className="w-3.5 h-3.5" />
            <span>Dark</span>
          </>
        )}
      </button>
    </div>
  );
}