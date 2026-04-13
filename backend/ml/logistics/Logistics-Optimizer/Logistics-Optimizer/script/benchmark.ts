import axios from "axios";
import { performance } from "perf_hooks";

/**
 * benchmark.ts
 *
 * Automates performance testing of the Logistics-Optimizer API.
 * Run with: npx tsx benchmark.ts
 * Requires the dev server to be running: npm run dev
 */

const BASE_URL = "http://localhost:5000";

// ── Bounding boxes ────────────────────────────────────────────────────────────
const HYD = { minLat: 17.3, maxLat: 17.5, minLng: 78.3, maxLng: 78.6 };

function randomCoord(box = HYD) {
  return {
    lat: box.minLat + Math.random() * (box.maxLat - box.minLat),
    lng: box.minLng + Math.random() * (box.maxLng - box.minLng),
  };
}

// ── Scenario generator ────────────────────────────────────────────────────────
function generateScenario(
  numStops: number,
  numVehicles: number,
  includeTimeWindows = false
) {
  const depot = { ...randomCoord(), address: "Central Depot" };

  const demands = Array.from({ length: numStops }, () =>
    Math.floor(Math.random() * 5) + 1
  );

  // Each vehicle capacity set to handle a fair share of total demand
  const totalDemand = demands.reduce((a, b) => a + b, 0);
  const capacityPerVehicle = Math.ceil((totalDemand / numVehicles) * 1.3);

  return {
    depot,
    stops: Array.from({ length: numStops }, (_, i) => ({
      ...randomCoord(),
      address: `Stop ${i + 1}`,
    })),
    demands,
    vehicles: Array.from({ length: numVehicles }, (_, i) => ({
      id: `V${i + 1}`,
      type: "van",
      startLocation: depot,
      capacityUnits: capacityPerVehicle,
      depotName: `Depot ${i + 1}`,
    })),
    evProfile: {
      batteryCapacity_Wh: 50000,
      initialCharge_Wh: 40000,
      minChargeAtDestination_Wh: 10000,
      batteryCapacityKwh: 100,
      currentSocPercent: 100,
      minReturnSocPercent: 20,
      consumptionKwhPer100km: 20,
    },
    // Only include time windows when explicitly testing them.
    // Without this, single-vehicle tests might trigger OR-Tools instead
    // of the TSP fast path, making results misleading.
    ...(includeTimeWindows
      ? { constraints: { timeWindowStart: "08:00", timeWindowEnd: "18:00" } }
      : {}),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function printDivider(title: string) {
  console.log(`\n${"─".repeat(55)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(55));
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

// Measure a single HTTP call, returning duration + response.
async function measure<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, ms: performance.now() - start };
}

// ── Main benchmark ────────────────────────────────────────────────────────────

async function runBenchmark() {
  console.log("\n🚀  Logistics-Optimizer — Performance Benchmark");
  console.log(`    Target: ${BASE_URL}`);
  console.log(`    Node:   ${process.version}`);

  try {

    // ── 1. Geocoding cache ──────────────────────────────────────────────────
    printDivider("1 / 4  Geocoding cache");

    const testQuery = "Banjara Hills, Hyderabad";

    // FIX: your original script used ?q= but the backend expects ?query=
    const geoUrl = `${BASE_URL}/api/geocoding?query=${encodeURIComponent(testQuery)}&limit=5`;

    const { ms: cold } = await measure(() => axios.get(geoUrl));
    console.log(`  Cold (Nominatim fetch) : ${formatMs(cold)}`);

    const { result: hotRes, ms: hot } = await measure(() => axios.get(geoUrl));
    console.log(`  Hot  (cache hit)       : ${formatMs(hot)}`);
    console.log(`  cached flag            : ${hotRes.data.cached}`);
    console.log(`  Speedup                : ${(cold / Math.max(hot, 1)).toFixed(1)}×`);

    // Burst: 5 concurrent requests for the same query — all should hit cache
    const burstStart = performance.now();
    await Promise.all(Array.from({ length: 5 }, () => axios.get(geoUrl)));
    const burstMs = performance.now() - burstStart;
    console.log(`  5× concurrent burst    : ${formatMs(burstMs)} total`);

    // ── 2. Reverse geocoding cache ──────────────────────────────────────────
    printDivider("2 / 4  Reverse geocoding cache");

    const coord = randomCoord();
    const revUrl = `${BASE_URL}/api/reverse-geocoding?lat=${coord.lat}&lng=${coord.lng}`;

    const { ms: revCold } = await measure(() => axios.get(revUrl));
    console.log(`  Cold : ${formatMs(revCold)}`);

    const { result: revHot, ms: revHotMs } = await measure(() => axios.get(revUrl));
    console.log(`  Hot  : ${formatMs(revHotMs)}  cached=${revHot.data.cached}`);

    // ── 3. Compression + polyline encoding ─────────────────────────────────
    printDivider("3 / 4  Payload compression & polyline encoding");

    const compScenario = generateScenario(10, 2);

    // FIX: axios decompresses automatically so content-length reflects
    // the compressed size only when transfer-encoding is NOT chunked.
    // Use decompress:false to get the raw compressed bytes, then measure
    // the decompressed size ourselves from the string.
    const compressedRes = await axios.post(
      `${BASE_URL}/api/optimize`,
      compScenario,
      {
        headers: { "Accept-Encoding": "gzip" },
        decompress: false,          // ← keep compressed bytes intact
        responseType: "arraybuffer",
      }
    );

    const compressedBytes = (compressedRes.data as Buffer).length;

    // Now fetch decompressed (axios default) to measure raw JSON size
    const decompressedRes = await axios.post(
      `${BASE_URL}/api/optimize`,
      compScenario,
      { headers: { "Accept-Encoding": "identity" } }  // ← no compression
    );

    const rawBytes = JSON.stringify(decompressedRes.data).length;

    // Check that polylines are now encoded strings, not arrays
    const firstRoute = decompressedRes.data?.routes?.[0];
    const polylineIsEncoded = typeof firstRoute?.polyline === "string";

    console.log(`  Raw JSON size          : ${formatKb(rawBytes)}`);
    console.log(`  Gzip transfer size     : ${formatKb(compressedBytes)}`);
    console.log(`  Compression ratio      : ${(((rawBytes - compressedBytes) / rawBytes) * 100).toFixed(1)}%`);
    console.log(`  Polyline encoded       : ${polylineIsEncoded ? "✓ string" : "✗ still array — check encodePolyline()"}`);
    if (polylineIsEncoded && firstRoute?.polyline) {
      console.log(`  Encoded sample (30ch)  : ${firstRoute.polyline.slice(0, 30)}...`);
    }

    // ── 4. VRP solver scaling ───────────────────────────────────────────────
    printDivider("4 / 4  Solver latency scaling");

    // Single-vehicle tests — should use TSP fast path (no OR-Tools).
    // IMPORTANT: Even with TSP, total time is dominated by OSRM network calls
    // (matrix + geometry) on the public endpoint (~2-6s).
    // Confirm TSP is working by checking server logs for:
    //   [VRP] tsp_eligible=True
    //   [VRP] Single-vehicle TSP fast path — skipping OR-Tools
    // On second run, geometry cache hits will reduce time significantly.
    console.log("\n  Single vehicle (check server logs for tsp_eligible=True):");
    const tspScenario5 = generateScenario(5, 1);
    const { ms: tsp5cold } = await measure(() =>
      axios.post(`${BASE_URL}/api/optimize`, tspScenario5)
    );
    const { ms: tsp5hot } = await measure(() =>
      axios.post(`${BASE_URL}/api/optimize`, tspScenario5)
    );
    console.log(`     5 stops cold : ${formatMs(tsp5cold).padStart(8)}`);
    console.log(`     5 stops hot  : ${formatMs(tsp5hot).padStart(8)}  (geometry cache)`);
    console.log(`     Speedup      : ${(tsp5cold / Math.max(tsp5hot, 1)).toFixed(1)}×`);

    for (const n of [10, 15]) {
      const sc = generateScenario(n, 1);
      const { ms } = await measure(() =>
        axios.post(`${BASE_URL}/api/optimize`, sc)
      );
      console.log(`    ${String(n).padStart(2)} stops       : ${formatMs(ms).padStart(8)}`);
    }

    // Multi-vehicle tests — OR-Tools with adaptive timeout
    // Capped at 20 stops to avoid OSRM rate limiting on public endpoint
    console.log("\n  Multi-vehicle (OR-Tools, adaptive timeout):");
    for (const [n, v] of [[6, 2], [12, 3], [20, 4]] as [number, number][]) {
      const sc = generateScenario(n, v);
      const { ms } = await measure(() =>
        axios.post(`${BASE_URL}/api/optimize`, sc)
      );
      console.log(`    ${String(n).padStart(2)} stops, ${v} vehicles : ${formatMs(ms).padStart(8)}`);
    }

    // OSRM matrix cache test — resubmit identical coordinates
    console.log("\n  OSRM matrix + geometry cache (same coordinates resubmitted):");
    const cacheTestScenario = generateScenario(8, 2);
    const { ms: miss } = await measure(() =>
      axios.post(`${BASE_URL}/api/optimize`, cacheTestScenario)
    );
    const { ms: hit } = await measure(() =>
      axios.post(`${BASE_URL}/api/optimize`, cacheTestScenario)
    );
    console.log(`    Cache miss : ${formatMs(miss)}`);
    console.log(`    Cache hit  : ${formatMs(hit)}`);
    console.log(`    Speedup    : ${(miss / Math.max(hit, 1)).toFixed(1)}×`);
    console.log(`    (Check server logs for "[OSRM] Matrix cache hit" and "[OSRM] Route geometry cache hit")`);

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log(`\n${"═".repeat(55)}`);
    console.log("  ✅  Benchmark complete");
    console.log(`${"═".repeat(55)}\n`);

  } catch (error: any) {
    if (error.code === "ECONNREFUSED") {
      console.error(`\n❌  Cannot connect to ${BASE_URL}`);
      console.error("    Start the server first: npm run dev\n");
    } else if (error.response) {
      console.error(`\n❌  HTTP ${error.response.status}:`, error.response.data);
    } else {
      console.error("\n❌  Benchmark failed:", error.message);
    }
    process.exit(1);
  }
}

runBenchmark();