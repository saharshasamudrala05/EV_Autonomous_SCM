import { z } from "zod";

export const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().optional(),
  demand: z.number().optional(),
});

// ── Supply Chain Stages ───────────────────────────────────────────────────────
export const supplyChainStageEnum = z.enum([
  "mining",
  "mine_to_refinery",
  "refinery_to_battery_plant",
  "refinery_to_chemical",
  "component_to_battery_plant",
  "battery_manufacturing_manual",
  "battery_manufacturing_automation",
  "component_to_ev_assembly",
  "ev_assembly_internal",
  "ev_distribution",
  "ev_long_distance",
  "ev_international_shipping",
]);

// ── Vehicle Types ─────────────────────────────────────────────────────────────
export const vehicleTypeEnum = z.enum([
  "mining_haul_truck",
  "heavy_dump_truck",
  "bulk_powder_tanker",
  "chemical_tanker",
  "container_truck",
  "forklift",
  "agv",
  "flatbed_truck",
  "tugger_train",
  "car_carrier_truck",
  "rail_car",
  "roro_cargo_ship",
  "bike",
  "auto_rickshaw",
  "van",
  "delivery_bike",
]);

// ── Material Types ────────────────────────────────────────────────────────────
export const materialTypeEnum = z.enum([
  "lithium_ore",
  "cobalt_ore",
  "nickel_ore",
  "lithium_carbonate",
  "nickel_sulfate",
  "graphite",
  "electrolyte",
  "battery_chemicals",
  "battery_cells",
  "electrodes",
  "separators",
  "battery_pack",
  "motor",
  "electronics",
  "ev_vehicle",
  "generic_cargo",
]);

export const MATERIAL_UNIT_MAP: Record<string, string> = {
  lithium_ore: "tons",
  cobalt_ore: "tons",
  nickel_ore: "tons",
  lithium_carbonate: "kg",
  nickel_sulfate: "kg",
  graphite: "kg",
  electrolyte: "liters",
  battery_chemicals: "kg",
  battery_cells: "pcs",
  electrodes: "pcs",
  separators: "pcs",
  battery_pack: "units",
  motor: "units",
  electronics: "units",
  ev_vehicle: "vehicles",
  generic_cargo: "pallets",
};

// ── EV Profile ────────────────────────────────────────────────────────────────
export const evProfileSchema = z.object({
  // Legacy fields kept for backward compatibility
  batteryCapacity_Wh: z.number().default(50000),
  initialCharge_Wh: z.number().default(40000),
  minChargeAtDestination_Wh: z.number().default(10000),

  // Fleet-aware EV fields
  batteryCapacityKwh: z.number().default(100),
  currentSocPercent: z.number().min(0).max(100).default(100),
  minReturnSocPercent: z.number().default(20),
  consumptionKwhPer100km: z.number().default(20),
  temperatureDegC: z.number().optional(),
});

// ── Material Info ─────────────────────────────────────────────────────────────
export const materialInfoSchema = z.object({
  materialType: materialTypeEnum,
  weightTons: z.number().min(0.1, "Quantity must be at least 0.1"),
  unit: z.string().optional(),
  isHazmat: z.boolean().default(false),
  requiresRefrigeration: z.boolean().default(false),
  requiresSealing: z.boolean().default(false),
});

// ── Delivery Constraints ──────────────────────────────────────────────────────
export const constraintsSchema = z.object({
  timeWindowStart: z.string().optional(),  // "HH:MM"
  timeWindowEnd: z.string().optional(),    // "HH:MM"
  maxWaitTime: z.number().optional(),      // minutes
  weatherTolerance: z.enum(["low_wind", "medium_wind", "high_wind"]).optional(),
  trafficLevel: z.enum(["low", "medium", "high"]).optional(),
  roadType: z.array(
    z.enum(["highway", "national_highway", "state_road", "local_road", "mine_haul_road"])
  ).optional(),
  chargingStationRequired: z.boolean().optional(),
  maxDetourMultiplier: z.number().optional(),
});

// ── Vehicle Config ────────────────────────────────────────────────────────────
export const vehicleConfigSchema = z.object({
  id: z.string(),
  type: vehicleTypeEnum,
  startLocation: locationSchema,
  capacityUnits: z.number().min(1, "Capacity must be at least 1 unit"),
  depotName: z.string().optional(),
});

export type VehicleConfig = z.infer<typeof vehicleConfigSchema>;

// ── Optimize Request ──────────────────────────────────────────────────────────
export const optimizeRequestSchema = z.object({
  depot: locationSchema.optional(),
  destination: locationSchema.optional(),
  stops: z.array(locationSchema),
  vehicles: z.array(vehicleConfigSchema).min(1),
  demands: z.array(z.number()),
  evProfile: evProfileSchema,
  supplyChainStage: supplyChainStageEnum.optional(),
  vehicleTypes: z.array(vehicleTypeEnum).optional(),
  materialInfo: materialInfoSchema.optional(),
  constraints: constraintsSchema.optional(),
});

export type Location = z.infer<typeof locationSchema>;
export type EvProfile = z.infer<typeof evProfileSchema>;
export type SupplyChainStage = z.infer<typeof supplyChainStageEnum>;
export type VehicleType = z.infer<typeof vehicleTypeEnum>;
export type MaterialType = z.infer<typeof materialTypeEnum>;
export type MaterialInfo = z.infer<typeof materialInfoSchema>;
export type Constraints = z.infer<typeof constraintsSchema>;
export type OptimizeRequest = z.infer<typeof optimizeRequestSchema>;

// ── Per-vehicle route in the response ────────────────────────────────────────
export const routeSchema = z.object({
  vehicleId: z.string(),
  vehicleIndex: z.number(),
  depotId: z.string(),
  depotName: z.string().optional(),
  stops: z.array(locationSchema),
  // Encoded polyline string (Google Polyline Algorithm).
  // Replaces the raw coordinate array — ~75% smaller over the wire.
  // Decode with decodePolyline() from shared/utils.ts before use in MapCanvas.
  polyline: z.string(),
  chargingStops: z.array(locationSchema),
  eta: z.string(),
  totalTimeSeconds: z.number(),
  loadUnits: z.number(),
  capacityUnits: z.number(),
  distanceKm: z.number(),
  estimatedCostINR: z.number(),
  co2Kg: z.number(),
  assignedVehicleType: vehicleTypeEnum.optional(),
  weather: z.array(z.string()).optional(),
  roadRestrictions: z.array(z.string()).optional(),
});

// ── Fleet-level summary ───────────────────────────────────────────────────────
export const fleetSummarySchema = z.object({
  totalVehiclesUsed: z.number(),
  totalVehiclesDefined: z.number(),
  totalDistanceKm: z.number(),
  totalCostINR: z.number(),
  totalCo2Kg: z.number(),
  totalTimeSeconds: z.number(),
  totalDemandsServed: z.number(),
  totalDemandRequired: z.number(),
});

// ── Optimize Response ─────────────────────────────────────────────────────────
export const optimizeResponseSchema = z.object({
  routes: z.array(routeSchema),
  fleetSummary: fleetSummarySchema,
  depot: locationSchema,
  storeMarkers: z.array(locationSchema),
});

export type RouteResult = z.infer<typeof routeSchema>;
export type FleetSummary = z.infer<typeof fleetSummarySchema>;
export type OptimizeResponse = z.infer<typeof optimizeResponseSchema>;

// ── Geocoding ─────────────────────────────────────────────────────────────────
// Used by /api/geocoding (forward) and /api/reverse-geocoding (reverse).
// Both frontend components (LocationAutocomplete, Dashboard, LogisticsApp)
// must use these schemas — never call Nominatim directly from the browser.

export const geocodingRequestSchema = z.object({
  query: z.string().min(1, "Search query must not be empty"),
  limit: z.number().int().min(1).max(10).default(5),
});

export const geocodingResultSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string(),
  displayName: z.string(),
});

export const geocodingResponseSchema = z.object({
  results: z.array(geocodingResultSchema),
  cached: z.boolean(),  // true if served from backend cache
});

export const reverseGeocodingRequestSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const reverseGeocodingResponseSchema = z.object({
  address: z.string(),
  displayName: z.string(),
  cached: z.boolean(),
});

export type GeocodingRequest = z.infer<typeof geocodingRequestSchema>;
export type GeocodingResult = z.infer<typeof geocodingResultSchema>;
export type GeocodingResponse = z.infer<typeof geocodingResponseSchema>;
export type ReverseGeocodingRequest = z.infer<typeof reverseGeocodingRequestSchema>;
export type ReverseGeocodingResponse = z.infer<typeof reverseGeocodingResponseSchema>;