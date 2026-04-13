import type { Express } from "express";
import type { Server } from "http";
import { api } from "@shared/routes";
import { z } from "zod";
import axios from "axios";
import { spawn } from "child_process";
import { type Location } from "@shared/schema";
import crypto from "crypto";
import { encodePolyline } from "@shared/utils";

// ── Optional module (imported once at startup, not per-request) ───────────────
let getRoadRestrictionWarnings: ((type: any, roadTypes?: string[]) => string[]) | null = null;
import("@shared/vehicleRecommender")
  .then((mod) => { getRoadRestrictionWarnings = mod.getRoadRestrictionWarnings; })
  .catch(() => { /* optional — silently skip */ });

// ── Start Python VRP Service ──────────────────────────────────────────────────
const pythonCommand = process.platform === "win32" ? "py" : "python";
const pythonProcess = spawn(pythonCommand, ["vrp-service/main.py"], {
  stdio: "pipe",
  cwd: process.cwd(),
});

pythonProcess.on("error", (err) => {
  console.error("[VRP] Failed to start Python VRP service:", err);
});
pythonProcess.on("exit", (code, signal) => {
  console.error(`[VRP] Python process exited — code=${code} signal=${signal}`);
});
pythonProcess.stdout?.on("data", (d) => console.log("[VRP stdout]", d.toString()));
pythonProcess.stderr?.on("data", (d) => console.error("[VRP stderr]", d.toString()));

// ── Environment Helpers (read at runtime, not module load) ────────────────────
function getORSKey(): string {
  return process.env.ORS_API_KEY ?? "";
}

function getTomTomKey(): string {
  return process.env.TOMTOM_API_KEY ?? "";
}

function logRoutingStatus(): void {
  const hasKey = getORSKey() !== "";
  if (!hasKey) {
    console.warn("[Routing] ORS_API_KEY not set — using OSRM for all routing requests");
  } else {
    console.log("[Routing] ORS primary routing enabled");
  }
}

function logTrafficStatus(): void {
  const hasKey = getTomTomKey() !== "";
  if (!hasKey) {
    console.warn("[Traffic] TOMTOM_API_KEY not set — using manual traffic level as fallback");
  } else {
    console.log("[Traffic] TomTom live traffic enabled");
  }
}

// Call status logging at startup to show current state
logRoutingStatus();
logTrafficStatus();

// ── Axios clients (without headers that depend on env vars) ───────────────────
// OpenRouteService client — headers built at request time
const axiosOrs = axios.create({
  baseURL: "https://api.openrouteservice.org",
  timeout: 10_000,
});

function getOrsHeaders(): Record<string, string> {
  const key = getORSKey();
  return {
    Authorization: key,
    "Content-Type": "application/json",
  };
}

// OSRM — fallback provider (no auth needed)
const OSRM_BASE = process.env.OSRM_BASE_URL ?? "http://router.project-osrm.org";
const axiosOsrm = axios.create({ baseURL: OSRM_BASE, timeout: 15_000 });

// Nominatim client
const axiosNominatim = axios.create({
  baseURL: "https://nominatim.openstreetmap.org",
  timeout: 8_000,
  headers: {
    "User-Agent": "LogisticsOptimizer/1.0 (contact@yourapp.com)",
    "Accept-Language": "en",
  },
});

// ── In-memory caches ──────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Travel time matrix cache — provider-agnostic, SHA-256 keyed, no TTL, cap 50.
const matrixCache = new Map<string, (number | null)[][]>();
const MATRIX_CACHE_MAX = 50;

// Route geometry cache — provider-agnostic, TTL = 1 hour, cap 200.
const routeGeomCache = new Map<string, CacheEntry<NormalisedRoute>>();
const ROUTE_GEOM_TTL_MS = 60 * 60 * 1000;
const ROUTE_GEOM_CACHE_MAX = 200;

// Weather cache — keyed by "lat_lng", TTL = 10 minutes.
const weatherCache = new Map<string, CacheEntry<{ multiplier: number; annotations: string[] }>>();
const WEATHER_TTL_MS = 10 * 60 * 1000;

// Traffic cache — keyed by "lat_lng" (3dp for broader area coverage), TTL = 5 minutes.
const trafficCache = new Map<string, CacheEntry<{ multiplier: number; annotation: string }>>();
const TRAFFIC_TTL_MS = 5 * 60 * 1000;

// Geocoding cache — keyed by normalised query, TTL = 24 hours.
const geocodingCache = new Map<string, CacheEntry<GeocodingResult[]>>();
const GEOCODING_TTL_MS = 24 * 60 * 60 * 1000;
const GEOCODING_CACHE_MAX = 500;

// Reverse geocoding cache — keyed by "lat_lng" (4dp), TTL = 24 hours.
const reverseGeocodingCache = new Map<string, CacheEntry<{ address: string; displayName: string }>>();
const REVERSE_GEOCODING_TTL_MS = 24 * 60 * 60 * 1000;
const REVERSE_GEOCODING_CACHE_MAX = 500;

// ── Shared types ──────────────────────────────────────────────────────────────

interface GeocodingResult {
  lat: number;
  lng: number;
  address: string;
  displayName: string;
}

// Normalised route — both ORS and OSRM responses are mapped into this shape
// so the rest of the code doesn't care which provider was used.
interface NormalisedRoute {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][]; // [lng, lat] order — same as both providers
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

function hashCoords(coordsString: string): string {
  return crypto.createHash("sha256").update(coordsString).digest("hex");
}

function evictOldest<V>(map: Map<string, V>, max: number) {
  if (map.size >= max) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
}

function getWeatherCache(lat: number, lng: number) {
  const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
  const entry = weatherCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.value;
  weatherCache.delete(key);
  return null;
}

function setWeatherCache(lat: number, lng: number, value: { multiplier: number; annotations: string[] }) {
  const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
  weatherCache.set(key, { value, expiresAt: Date.now() + WEATHER_TTL_MS });
}

function normaliseQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function getGeocodingCache(query: string): GeocodingResult[] | null {
  const key = normaliseQuery(query);
  const entry = geocodingCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.value;
  geocodingCache.delete(key);
  return null;
}

function setGeocodingCache(query: string, value: GeocodingResult[]) {
  const key = normaliseQuery(query);
  evictOldest(geocodingCache, GEOCODING_CACHE_MAX);
  geocodingCache.set(key, { value, expiresAt: Date.now() + GEOCODING_TTL_MS });
}

function getReverseGeocodingCache(lat: number, lng: number) {
  const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
  const entry = reverseGeocodingCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.value;
  reverseGeocodingCache.delete(key);
  return null;
}

function setReverseGeocodingCache(lat: number, lng: number, value: { address: string; displayName: string }) {
  const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
  evictOldest(reverseGeocodingCache, REVERSE_GEOCODING_CACHE_MAX);
  reverseGeocodingCache.set(key, { value, expiresAt: Date.now() + REVERSE_GEOCODING_TTL_MS });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeStringToSeconds(t: string | undefined): number | null {
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 3600 + m * 60;
}

function hasValidCoords(loc: { lat?: number; lng?: number } | undefined): boolean {
  return (
    loc !== undefined &&
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    !isNaN(loc.lat) &&
    !isNaN(loc.lng) &&
    !(loc.lat === 0 && loc.lng === 0)
  );
}

function estimateCostINR(distanceKm: number, totalTimeSeconds: number, vehicleType: string): number {
  const ratePerKm: Record<string, number> = {
    container_truck: 25,
    car_carrier_truck: 25,
    heavy_dump_truck: 22,
    flatbed_truck: 22,
    van: 12,
    delivery_bike: 4,
    bike: 4,
    auto_rickshaw: 6,
  };
  const rate = ratePerKm[vehicleType] ?? 18;
  return Math.round(distanceKm * rate + (totalTimeSeconds / 3600) * 200);
}

// ── Travel time matrix — ORS → OSRM fallback ─────────────────────────────────

async function fetchOrsMatrix(points: Location[]): Promise<(number | null)[][]> {
  const { data } = await axiosOrs.post("/v2/matrix/driving-car", {
    locations: points.map((p) => [p.lng, p.lat]),
    metrics: ["duration"],
    resolve_locations: false,
  }, {
    headers: getOrsHeaders()
  });
  return data.durations as (number | null)[][];
}

async function fetchOsrmMatrix(coordsString: string): Promise<(number | null)[][]> {
  const { data } = await axiosOsrm.get(
    `/table/v1/driving/${coordsString}?annotations=duration`
  );
  return data.durations as (number | null)[][];
}

async function fetchTravelMatrix(
  points: Location[],
  coordsString: string
): Promise<(number | null)[][]> {
  // 1. Cache hit — same result regardless of which provider filled it
  const cacheKey = hashCoords(coordsString);
  if (matrixCache.has(cacheKey)) {
    console.log("[Matrix] Cache hit");
    return matrixCache.get(cacheKey)!;
  }

  let result: (number | null)[][] | null = null;

  // 2. Try ORS first (fast, ~300ms)
  const orsKey = getORSKey();
  if (orsKey) {
    try {
      result = await fetchOrsMatrix(points);
      console.log("[Matrix] ORS success");
    } catch (err: any) {
      console.warn(`[Matrix] ORS failed (${err.response?.status ?? err.message}) — falling back to OSRM`);
    }
  }

  // 3. Fall back to OSRM (slow, ~6–10s, but always available)
  if (!result) {
    result = await fetchOsrmMatrix(coordsString);
    console.log("[Matrix] OSRM fallback success");
  }

  // 4. Cache and return
  evictOldest(matrixCache, MATRIX_CACHE_MAX);
  matrixCache.set(cacheKey, result);
  return result;
}

// ── Route geometry — ORS → OSRM fallback ─────────────────────────────────────

async function fetchOrsRoute(routePoints: Location[]): Promise<NormalisedRoute> {
  const { data } = await axiosOrs.post("/v2/directions/driving-car/geojson", {
    coordinates: routePoints.map((p) => [p.lng, p.lat]),
  }, {
    headers: getOrsHeaders()
  });
  const feature = data.features[0];
  return {
    distanceMeters: feature.properties.summary.distance,
    durationSeconds: feature.properties.summary.duration,
    coordinates: feature.geometry.coordinates as [number, number][],
  };
}

async function fetchOsrmRoute(routePoints: Location[]): Promise<NormalisedRoute> {
  const coordsStr = routePoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const { data } = await axiosOsrm.get(
    `/route/v1/driving/${coordsStr}?geometries=geojson&overview=full`
  );
  const r = data.routes[0];
  return {
    distanceMeters: r.distance,
    durationSeconds: r.duration,
    coordinates: r.geometry.coordinates as [number, number][],
  };
}

async function fetchRouteGeometry(routePoints: Location[]): Promise<NormalisedRoute> {
  const coordsStr = routePoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const cacheKey = hashCoords(coordsStr);

  // 1. Cache hit
  const cached = routeGeomCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    console.log("[Geometry] Cache hit");
    return cached.value;
  }
  routeGeomCache.delete(cacheKey);

  let result: NormalisedRoute | null = null;

  // 2. Try ORS first
  const orsKey = getORSKey();
  if (orsKey) {
    try {
      result = await fetchOrsRoute(routePoints);
      console.log("[Geometry] ORS success");
    } catch (err: any) {
      console.warn(`[Geometry] ORS failed (${err.response?.status ?? err.message}) — falling back to OSRM`);
    }
  }

  // 3. Fall back to OSRM
  if (!result) {
    result = await fetchOsrmRoute(routePoints);
    console.log("[Geometry] OSRM fallback success");
  }

  // 4. Cache and return
  evictOldest(routeGeomCache, ROUTE_GEOM_CACHE_MAX);
  routeGeomCache.set(cacheKey, { value: result, expiresAt: Date.now() + ROUTE_GEOM_TTL_MS });
  return result;
}

// ── Weather ───────────────────────────────────────────────────────────────────

async function fetchWeather(lat: number, lng: number): Promise<{ multiplier: number; annotations: string[] }> {
  const cached = getWeatherCache(lat, lng);
  if (cached) {
    console.log("[Weather] Cache hit");
    return cached;
  }
  try {
    const { data } = await axios.get(
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current_weather=true&hourly=precipitation`,
      { timeout: 5_000 }
    );
    const cw = data.current_weather;
    const prec: number = data.hourly?.precipitation?.[0] ?? 0;
    let multiplier = 1.0;
    let roadCondition = "Dry";
    if (prec > 5.0) { roadCondition = "Heavy Rain / Flooded"; multiplier = 1.4; }
    else if (prec > 0.5) { roadCondition = "Wet / Slippery"; multiplier = 1.15; }
    if (cw.windspeed > 40) { roadCondition = "High Winds"; multiplier = Math.max(multiplier, 1.25); }
    const result = {
      multiplier,
      annotations: [
        `Temp: ${cw.temperature}°C, Wind: ${cw.windspeed} km/h`,
        `Road: ${roadCondition}, Condition: Clear`,
      ],
    };
    setWeatherCache(lat, lng, result);
    console.log(`[Weather] Fetched — multiplier=${multiplier}`);
    return result;
  } catch {
    return { multiplier: 1.0, annotations: ["Weather data unavailable"] };
  }
}

// ── Live traffic — TomTom Flow Segment Data ───────────────────────────────────
async function fetchTraffic(
  lat: number,
  lng: number,
  manualLevel: string | undefined
): Promise<{ multiplier: number; annotation: string }> {
  // 5-minute cache keyed at 3dp (~100m resolution — good enough for traffic)
  const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
  const cached = trafficCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    console.log("[Traffic] Cache hit");
    return cached.value;
  }
  trafficCache.delete(cacheKey);

  // Try TomTom live traffic first
  const tomTomKey = getTomTomKey();
  if (tomTomKey) {
    try {
      const { data } = await axios.get(
        `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json`,
        {
          params: {
            point: `${lat},${lng}`,
            key: tomTomKey,
          },
          timeout: 5_000,
        }
      );

      const flow = data.flowSegmentData;
      const currentSpeed: number = flow.currentSpeed;
      const freeFlowSpeed: number = flow.freeFlowSpeed;
      const currentTravelTime: number = flow.currentTravelTime;
      const freeFlowTravelTime: number = flow.freeFlowTravelTime;

      // Derive multiplier from travel time ratio
      const multiplier = Math.min(
        freeFlowTravelTime > 0 ? currentTravelTime / freeFlowTravelTime : 1.0,
        2.5  // cap at 2.5× to prevent extreme outliers
      );

      // Human-readable congestion label
      let congestionLabel: string;
      if (multiplier < 1.1) congestionLabel = "Free flow";
      else if (multiplier < 1.3) congestionLabel = "Light traffic";
      else if (multiplier < 1.6) congestionLabel = "Moderate congestion";
      else if (multiplier < 2.0) congestionLabel = "Heavy congestion";
      else congestionLabel = "Severe congestion";

      const result = {
        multiplier,
        annotation: `Traffic: ${congestionLabel} (${currentSpeed} km/h, free flow ${freeFlowSpeed} km/h)`,
      };

      trafficCache.set(cacheKey, { value: result, expiresAt: Date.now() + TRAFFIC_TTL_MS });
      console.log(`[Traffic] TomTom live — multiplier=${multiplier.toFixed(2)}, ${congestionLabel}`);
      return result;

    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403) {
        console.warn("[Traffic] TomTom daily limit reached — using manual level fallback");
      } else {
        console.warn(`[Traffic] TomTom failed (${status ?? err.message}) — using manual level fallback`);
      }
    }
  }

  // Fallback: manual traffic level from user input
  const manualMultiplier =
    manualLevel === "high" ? 1.3 :
      manualLevel === "medium" ? 1.15 : 1.0;

  const manualLabel =
    manualLevel === "high" ? "High (manual)" :
      manualLevel === "medium" ? "Medium (manual)" : "Low (manual)";

  const fallback = {
    multiplier: manualMultiplier,
    annotation: `Traffic: ${manualLabel}`,
  };

  // Don't cache manual fallback — next request should retry TomTom
  console.log(`[Traffic] Manual fallback — multiplier=${manualMultiplier}`);
  return fallback;
}


export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // ── GET /api/nodes ──────────────────────────────────────────────────────────
  app.get("/api/nodes", async (req, res) => {
    try {
      const state = req.query.state || "";
      const { data } = await axios.get(`http://127.0.0.1:5001/api/nodes?state=${state}`);
      return res.json(data);
    } catch (err: any) {
      console.error("[Nodes] Proxy Error:", err.message);
      return res.status(500).json({ message: "Network nodes service unavailable" });
    }
  });

  // ── GET /api/geocoding ─────────────────────────────────────────────────────
  app.get(api.geocoding.forward.path, async (req, res) => {
    try {
      const query = String(req.query.query ?? "").trim();
      const limit = Math.min(parseInt(String(req.query.limit ?? "5"), 10) || 5, 10);
      if (!query) return res.status(400).json({ message: "query parameter is required" });

      const cached = getGeocodingCache(query);
      if (cached) {
        console.log(`[Geocoding] Cache hit — "${query}"`);
        return res.json({ results: cached, cached: true });
      }

      const { data } = await axiosNominatim.get("/search", {
        params: { q: query, format: "json", limit, addressdetails: 1 },
      });

      const results: GeocodingResult[] = (data as any[]).map((item) => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        address: item.display_name,
        displayName: item.display_name,
      }));

      setGeocodingCache(query, results);
      console.log(`[Geocoding] Fetched ${results.length} results — "${query}"`);
      return res.json({ results, cached: false });

    } catch (err: any) {
      console.error("[Geocoding] Error:", err.message);
      return res.status(500).json({ message: "Geocoding service unavailable" });
    }
  });

  // ── GET /api/reverse-geocoding ─────────────────────────────────────────────
  app.get(api.geocoding.reverse.path, async (req, res) => {
    try {
      const lat = parseFloat(String(req.query.lat ?? ""));
      const lng = parseFloat(String(req.query.lng ?? ""));
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ message: "Valid lat and lng query parameters are required" });
      }

      const cached = getReverseGeocodingCache(lat, lng);
      if (cached) {
        console.log(`[ReverseGeocoding] Cache hit — ${lat},${lng}`);
        return res.json({ ...cached, cached: true });
      }

      const { data } = await axiosNominatim.get("/reverse", {
        params: { lat, lon: lng, format: "json", addressdetails: 1 },
      });

      if (!data || data.error) {
        return res.status(404).json({ message: "No address found for these coordinates" });
      }

      const result = {
        address: data.display_name as string,
        displayName: data.display_name as string,
      };

      setReverseGeocodingCache(lat, lng, result);
      console.log(`[ReverseGeocoding] Fetched — ${lat},${lng}`);
      return res.json({ ...result, cached: false });

    } catch (err: any) {
      console.error("[ReverseGeocoding] Error:", err.message);
      return res.status(500).json({ message: "Reverse geocoding service unavailable" });
    }
  });

  // ── POST /api/optimize ─────────────────────────────────────────────────────
  app.post(api.optimization.optimize.path, async (req, res) => {
    try {
      const input = api.optimization.optimize.input.parse(req.body);

      // ── Step 1: Filter vehicles ──────────────────────────────────────────
      const vehicles = input.vehicles.filter((v) => hasValidCoords(v.startLocation));
      if (vehicles.length === 0) {
        return res.status(400).json({
          message:
            "No vehicles with valid depot coordinates found. " +
            "Please enter a depot location for at least one vehicle.",
        });
      }

      // ── Step 2: Filter stops ─────────────────────────────────────────────
      const stopDemandPairs = input.stops
        .map((stop, i) => ({
          stop,
          // FIX: Use nullish coalescing + default 1 so that stops with
          // explicitly 0 demand are still passed to the solver as 0 (the
          // solver now handles them as waypoints), but any missing/undefined
          // demand is treated as 1 rather than being silently zeroed out.
          demand: input.demands[i] ?? 1,
        }))
        .filter(({ stop }) => hasValidCoords(stop));

      if (stopDemandPairs.length === 0) {
        return res.status(400).json({
          message:
            "No delivery stops with valid coordinates found. " +
            "Please enter lat/lng for at least one stop.",
        });
      }

      const validStops: Location[] = stopDemandPairs.map((p) => p.stop);
      const validDemands: number[] = stopDemandPairs.map((p) => p.demand);

      // ── Step 3: Validate capacity ────────────────────────────────────────
      // NOTE: We only sum non-zero demands here for the early capacity check.
      // 0-demand waypoints do not consume capacity so they should not block
      // the request — the solver handles them correctly.
      const totalDemand = validDemands.reduce((s, d) => s + d, 0);
      const totalCapacity = vehicles.reduce((s, v) => s + v.capacityUnits, 0);
      if (totalDemand > totalCapacity) {
        return res.status(400).json({
          message:
            `Total demand (${totalDemand} units) exceeds total fleet capacity ` +
            `(${totalCapacity} units). Add more vehicles or reduce stop demands.`,
        });
      }

      const numVehicles = vehicles.length;

      // ── Step 4: Build node list ──────────────────────────────────────────
      const depotNodes: Location[] = vehicles.map((v) => v.startLocation);
      const allPoints: Location[] = [...depotNodes, ...validStops];

      let destinationNodeIndex: number | null = null;
      if (input.destination && hasValidCoords(input.destination)) {
        destinationNodeIndex = allPoints.length;
        allPoints.push(input.destination);
      }

      const startIndices: number[] = vehicles.map((_, i) => i);
      const numDepotNodes = depotNodes.length;

      // ── Step 5: Matrix + weather + traffic in parallel ───────────────────
      const coordsString = allPoints.map((p) => `${p.lng},${p.lat}`).join(";");
      const firstDeliveryStop = allPoints[numDepotNodes];

      const [rawDurations, weather, traffic] = await Promise.all([
        fetchTravelMatrix(allPoints, coordsString),
        firstDeliveryStop
          ? fetchWeather(firstDeliveryStop.lat, firstDeliveryStop.lng)
          : Promise.resolve({ multiplier: 1.0, annotations: [] as string[] }),
        firstDeliveryStop
          ? fetchTraffic(
            firstDeliveryStop.lat,
            firstDeliveryStop.lng,
            input.constraints?.trafficLevel
          )
          : Promise.resolve({ multiplier: 1.0, annotation: "Traffic: No data" }),
      ]);

      const weatherMultiplier = weather.multiplier;
      const weatherAnnotations = [
        ...weather.annotations,
        traffic.annotation,
      ];

      // ── Step 6: Combined matrix multipliers ──────────────────────────────
      const trafficMultiplier = traffic.multiplier;
      const hazmatMultiplier = input.materialInfo?.isHazmat ? 1.2 : 1.0;
      const combinedMultiplier = trafficMultiplier * weatherMultiplier * hazmatMultiplier;

      console.log(
        `[Multipliers] traffic=${trafficMultiplier.toFixed(2)} ` +
        `weather=${weatherMultiplier.toFixed(2)} ` +
        `hazmat=${hazmatMultiplier.toFixed(2)} ` +
        `combined=${combinedMultiplier.toFixed(2)}`
      );

      const travelTimeMatrix: number[][] = rawDurations.map((row) =>
        row.map((val) => (val === null ? 999_999 : Math.round(val * combinedMultiplier)))
      );

      // ── Step 7: Time-window array ────────────────────────────────────────
      const horizonSec = 24 * 3600;
      const twStart = timeStringToSeconds(input.constraints?.timeWindowStart);
      const twEnd = timeStringToSeconds(input.constraints?.timeWindowEnd);

      const timeWindows: [number, number][] = allPoints.map((_, idx) => {
        const isDeliveryStop = idx >= numDepotNodes && idx < numDepotNodes + validStops.length;
        return isDeliveryStop && twStart !== null && twEnd !== null
          ? [twStart, twEnd]
          : [0, horizonSec];
      });

      // ── Step 8: Solver demands ───────────────────────────────────────────
      // Depot and destination nodes always get demand=0.
      // Delivery stop demands are passed through as-is (including 0 for
      // waypoints) — the solver now treats all non-depot nodes as mandatory.
      const solverDemands: number[] = [
        ...depotNodes.map(() => 0),
        ...validDemands,
        ...(destinationNodeIndex !== null ? [0] : []),
      ];

      console.log(
        "[Routes] Demand mapping →",
        `stops=${validStops.length}`,
        `demands=${JSON.stringify(validDemands)}`,
        `totalDemand=${totalDemand}`,
        `totalCapacity=${totalCapacity}`
      );

      // ── Step 9: Assemble VRP payload ─────────────────────────────────────
      const vrpPayload: Record<string, unknown> = {
        travel_time_matrix: travelTimeMatrix,
        num_vehicles: numVehicles,
        depot: startIndices,
        destination: destinationNodeIndex,
        demands: solverDemands,
        vehicle_capacities: vehicles.map((v) => v.capacityUnits),
        vehicle_types: vehicles.map((v) => v.type),
        time_windows: timeWindows,
        material_info: input.materialInfo
          ? {
            material_type: input.materialInfo.materialType,
            weight: input.materialInfo.weightTons,
            is_hazmat: input.materialInfo.isHazmat,
          }
          : null,
        constraints: input.constraints
          ? {
            time_window_start: input.constraints.timeWindowStart,
            time_window_end: input.constraints.timeWindowEnd,
            charging_required: input.constraints.chargingStationRequired,
          }
          : null,
      };

      if (input.evProfile?.batteryCapacityKwh && input.evProfile.batteryCapacityKwh > 0) {
        vrpPayload.battery_capacities = Array(numVehicles).fill(input.evProfile.batteryCapacityKwh);
        vrpPayload.min_return_soc = input.evProfile.minReturnSocPercent ?? 20;
        vrpPayload.consumption_rate = (input.evProfile.consumptionKwhPer100km ?? 20) / 100;
        vrpPayload.temperature_factor = (input.evProfile.temperatureDegC ?? 25) < 5 ? 1.3 : 1.0;
      }

      console.log(
        "[VRP] Payload →",
        `nodes=${travelTimeMatrix.length}`,
        `vehicles=${numVehicles}`,
        `stops=${validStops.length}`,
        `destination=${destinationNodeIndex}`,
        `demand=${totalDemand}/${totalCapacity}`
      );

      // ── Step 10: Call Python solver ──────────────────────────────────────
      const vrpResponse = await axios.post("http://127.0.0.1:5001/solve", vrpPayload);

      // FIX: Log any nodes the solver had to drop (genuine infeasibility).
      // These are surfaced by main.py in the droppedNodes field.
      const droppedNodes: number[] = vrpResponse.data.droppedNodes ?? [];
      if (droppedNodes.length > 0) {
        console.warn(
          `[Routes] Solver dropped ${droppedNodes.length} node(s) due to genuine infeasibility ` +
          `(capacity / time-window conflict): ${JSON.stringify(droppedNodes)}`
        );
      }

      const vehicleRoutes: Array<{
        vehicleId: number;
        nodes: number[];
        loadUnits: number;
        capacityUnits: number;
        distanceKm: number;
        co2Kg: number;
        totalTimeSeconds: number;
      }> = vrpResponse.data.routes;

      // ── Step 11: Filter to routes with delivery stops ────────────────────
      // FIX: A route is considered "used" if it visits ANY non-depot node
      // (including 0-demand waypoints), consistent with the solver fix.
      const routesWithDeliveries = vehicleRoutes.filter((solverRoute) =>
        solverRoute.nodes.some(
          (idx) => idx >= numDepotNodes && idx < numDepotNodes + validStops.length
        )
      );

      // ── Step 12: All geometry calls in parallel ──────────────────────────
      const routePointsPerVehicle = routesWithDeliveries.map((r) =>
        r.nodes.map((idx) => allPoints[idx])
      );

      const routeGeomResults = await Promise.all(
        routePointsPerVehicle.map((pts) => fetchRouteGeometry(pts))
      );

      // ── Step 13: Build formatted routes ──────────────────────────────────
      const formattedRoutes = routesWithDeliveries.map((solverRoute, i) => {
        const { vehicleId, loadUnits, capacityUnits, co2Kg } = solverRoute;
        const routePoints = routePointsPerVehicle[i];
        const geom = routeGeomResults[i];

        // Both ORS and OSRM return [lng, lat] coordinates.
        // Flip to [lat, lng] for Leaflet, then encode with Google Polyline Algorithm.
        const rawPolyline: [number, number][] = geom.coordinates.map(
          (coord) => [coord[1], coord[0]] as [number, number]
        );
        const polyline = encodePolyline(rawPolyline);

        const realDistanceKm = Math.round(geom.distanceMeters / 1000);
        const realDurationSeconds = geom.durationSeconds;
        const hours = Math.floor(realDurationSeconds / 3600);
        const minutes = Math.floor((realDurationSeconds % 3600) / 60);
        const eta = `${hours}h ${minutes}m`;

        const vehicle = vehicles[vehicleId];
        const vehicleType = vehicle?.type ?? "container_truck";
        const estimatedCostINR = estimateCostINR(realDistanceKm, realDurationSeconds, vehicleType);

        // Charging stops heuristic
        const chargingStops: Location[] = [];
        const initialChargePercent = input.evProfile?.initialCharge_Wh && input.evProfile?.batteryCapacity_Wh
          ? (input.evProfile.initialCharge_Wh / input.evProfile.batteryCapacity_Wh) * 100
          : 100;
        const needsCharging = realDistanceKm > 150 || initialChargePercent < 50;

        if ((needsCharging || input.constraints?.chargingStationRequired) && firstDeliveryStop) {
          const { lat, lng } = firstDeliveryStop;
          if (lat > 8 && lat < 38 && lng > 68 && lng < 98) {
            chargingStops.push({ lat: lat + 0.02, lng: lng + 0.02, address: "Charging Station (Auto)" });
          }
        }

        const roadRestrictions: string[] = getRoadRestrictionWarnings
          ? getRoadRestrictionWarnings(vehicleType as any, input.constraints?.roadType as string[] | undefined)
          : [];

        return {
          vehicleId: vehicle?.id ?? `vehicle-${vehicleId}`,
          vehicleIndex: vehicleId,
          depotId: vehicle?.id ?? `depot-${vehicleId}`,
          depotName: vehicle?.depotName ?? vehicle?.startLocation.address,
          stops: routePoints,
          polyline,
          chargingStops,
          eta,
          totalTimeSeconds: realDurationSeconds,
          loadUnits,
          capacityUnits,
          distanceKm: realDistanceKm,
          estimatedCostINR,
          co2Kg,
          assignedVehicleType: vehicleType,
          weather: weatherAnnotations,
          roadRestrictions,
        };
      });

      // ── Step 14: Guard ───────────────────────────────────────────────────
      if (formattedRoutes.length === 0) {
        return res.status(400).json({
          message:
            "Solver found a solution but no routable paths could be built. " +
            "Check that all coordinates are on a drivable road network.",
        });
      }

      // ── Step 15: Fleet summary ───────────────────────────────────────────
      const maxTime = Math.max(...formattedRoutes.map((r) => r.totalTimeSeconds), 0);

      const fleetSummary = {
        totalVehiclesUsed: formattedRoutes.length,
        totalVehiclesDefined: numVehicles,
        totalDistanceKm: formattedRoutes.reduce((s, r) => s + r.distanceKm, 0),
        totalCostINR: formattedRoutes.reduce((s, r) => s + r.estimatedCostINR, 0),
        totalCo2Kg: formattedRoutes.reduce((s, r) => s + r.co2Kg, 0),
        totalTimeSeconds: maxTime,
        totalDemandsServed: formattedRoutes.reduce((s, r) => s + r.loadUnits, 0),
        totalDemandRequired: totalDemand,
        // FIX: Surface dropped node count to the caller so the frontend can
        // show a warning if any stops were genuinely impossible to include.
        droppedStops: droppedNodes.length,
      };

      console.log(
        "[Routes] Fleet summary →",
        `used=${fleetSummary.totalVehiclesUsed}/${fleetSummary.totalVehiclesDefined}`,
        `dist=${fleetSummary.totalDistanceKm}km`,
        `cost=₹${fleetSummary.totalCostINR}`,
        `CO2=${fleetSummary.totalCo2Kg}kg`,
        `droppedStops=${fleetSummary.droppedStops}`
      );

      // ── Step 16: Respond ─────────────────────────────────────────────────
      res.json({
        routes: formattedRoutes,
        fleetSummary,
        depot: vehicles[0]?.startLocation ?? input.depot ?? { lat: 0, lng: 0 },
        storeMarkers: validStops,
      });

    } catch (err: any) {
      console.error("[Routes] Error:", err.response?.data ?? err.message);

      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error: " + JSON.stringify(err.errors) });
      }
      if (err.response?.status === 400 && err.response?.data?.error) {
        return res.status(400).json({ message: "Solver error: " + err.response.data.error });
      }

      res.status(500).json({ message: err.message ?? "Internal server error" });
    }
  });

  return httpServer;
}