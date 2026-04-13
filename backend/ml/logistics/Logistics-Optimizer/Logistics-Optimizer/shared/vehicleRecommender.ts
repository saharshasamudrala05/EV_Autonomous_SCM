import type { SupplyChainStage, VehicleType, MaterialType, MaterialInfo } from "./schema";

export interface VehicleDetails {
  type: VehicleType;
  name: string;
  minCapacityTons: number;
  maxCapacityTons: number;
  avgSpeedKmh: number;
  fuelConsumptionLitersPerKm: number;
  hazmatCapable: boolean;
  canAccessHighways: boolean;
  highwayRestricted: boolean; // true = banned from highways (e.g. 2/3 wheelers)
  operationalEnvironment: string;
  maxTravelTimeHours: number;
  requiresSpecialHandling: boolean;
  preferredRoadTypes: string[];
  iconType: string; // used for map icon selection
}

// Vehicle specifications database
const vehicleSpecs: Record<VehicleType, VehicleDetails> = {
  mining_haul_truck: {
    type: "mining_haul_truck",
    name: "Mining Haul Truck (Ultra-class)",
    minCapacityTons: 200,
    maxCapacityTons: 400,
    avgSpeedKmh: 20,
    fuelConsumptionLitersPerKm: 0.8,
    hazmatCapable: false,
    canAccessHighways: false,
    highwayRestricted: true,
    operationalEnvironment: "Mine",
    maxTravelTimeHours: 8,
    requiresSpecialHandling: false,
    preferredRoadTypes: ["mine_haul_road"],
    iconType: "truck",
  },
  heavy_dump_truck: {
    type: "heavy_dump_truck",
    name: "Heavy Dump Truck",
    minCapacityTons: 20,
    maxCapacityTons: 60,
    avgSpeedKmh: 60,
    fuelConsumptionLitersPerKm: 0.35,
    hazmatCapable: false,
    canAccessHighways: true,
    highwayRestricted: false,
    operationalEnvironment: "Short-medium distance transport",
    maxTravelTimeHours: 10,
    requiresSpecialHandling: false,
    preferredRoadTypes: ["highway", "state_road"],
    iconType: "truck",
  },
  bulk_powder_tanker: {
    type: "bulk_powder_tanker",
    name: "Bulk Powder Tanker Truck",
    minCapacityTons: 15,
    maxCapacityTons: 30,
    avgSpeedKmh: 70,
    fuelConsumptionLitersPerKm: 0.25,
    hazmatCapable: false,
    canAccessHighways: true,
    highwayRestricted: false,
    operationalEnvironment: "Powder/granular transport",
    maxTravelTimeHours: 10,
    requiresSpecialHandling: true,
    preferredRoadTypes: ["highway", "state_road", "local_road"],
    iconType: "truck",
  },
  chemical_tanker: {
    type: "chemical_tanker",
    name: "Chemical Tanker Truck",
    minCapacityTons: 10,
    maxCapacityTons: 25,
    avgSpeedKmh: 65,
    fuelConsumptionLitersPerKm: 0.28,
    hazmatCapable: true,
    canAccessHighways: true,
    highwayRestricted: false,
    operationalEnvironment: "Hazardous liquid transport",
    maxTravelTimeHours: 8,
    requiresSpecialHandling: true,
    preferredRoadTypes: ["highway", "state_road"],
    iconType: "truck",
  },
  container_truck: {
    type: "container_truck",
    name: "Container Truck / Box Truck",
    minCapacityTons: 5,
    maxCapacityTons: 20,
    avgSpeedKmh: 75,
    fuelConsumptionLitersPerKm: 0.22,
    hazmatCapable: false,
    canAccessHighways: true,
    highwayRestricted: false,
    operationalEnvironment: "Standard logistics",
    maxTravelTimeHours: 12,
    requiresSpecialHandling: false,
    preferredRoadTypes: ["highway", "state_road", "local_road"],
    iconType: "truck",
  },
  forklift: {
    type: "forklift",
    name: "Forklift",
    minCapacityTons: 0.5,
    maxCapacityTons: 5,
    avgSpeedKmh: 20,
    fuelConsumptionLitersPerKm: 0.05,
    hazmatCapable: false,
    canAccessHighways: false,
    highwayRestricted: true,
    operationalEnvironment: "Indoor factory",
    maxTravelTimeHours: 2,
    requiresSpecialHandling: false,
    preferredRoadTypes: ["local_road"],
    iconType: "truck",
  },
  agv: {
    type: "agv",
    name: "AGV (Automated Guided Vehicle)",
    minCapacityTons: 0.2,
    maxCapacityTons: 2,
    avgSpeedKmh: 5,
    fuelConsumptionLitersPerKm: 0,
    hazmatCapable: false,
    canAccessHighways: false,
    highwayRestricted: true,
    operationalEnvironment: "Automated factory",
    maxTravelTimeHours: 1,
    requiresSpecialHandling: false,
    preferredRoadTypes: ["local_road"],
    iconType: "truck",
  },
  flatbed_truck: {
    type: "flatbed_truck",
    name: "Flatbed Truck",
    minCapacityTons: 8,
    maxCapacityTons: 25,
    avgSpeedKmh: 70,
    fuelConsumptionLitersPerKm: 0.24,
    hazmatCapable: false,
    canAccessHighways: true,
    highwayRestricted: false,
    operationalEnvironment: "Large component transport",
    maxTravelTimeHours: 11,
    requiresSpecialHandling: true,
    preferredRoadTypes: ["highway", "state_road"],
    iconType: "truck",
  },
  tugger_train: {
    type: "tugger_train",
    name: "Tugger Train",
    minCapacityTons: 2,
    maxCapacityTons: 15,
    avgSpeedKmh: 40,
    fuelConsumptionLitersPerKm: 0.1,
    hazmatCapable: false,
    canAccessHighways: false,
    highwayRestricted: true,
    operationalEnvironment: "Assembly line logistics",
    maxTravelTimeHours: 4,
    requiresSpecialHandling: false,
    preferredRoadTypes: ["local_road"],
    iconType: "truck",
  },
  car_carrier_truck: {
    type: "car_carrier_truck",
    name: "Car Carrier Truck",
    minCapacityTons: 30,
    maxCapacityTons: 80,
    avgSpeedKmh: 80,
    fuelConsumptionLitersPerKm: 0.3,
    hazmatCapable: false,
    canAccessHighways: true,
    highwayRestricted: false,
    operationalEnvironment: "Multi-vehicle transport",
    maxTravelTimeHours: 12,
    requiresSpecialHandling: true,
    preferredRoadTypes: ["highway", "state_road"],
    iconType: "truck",
  },
  rail_car: {
    type: "rail_car",
    name: "Rail Car Transport",
    minCapacityTons: 50,
    maxCapacityTons: 200,
    avgSpeedKmh: 100,
    fuelConsumptionLitersPerKm: 0.05,
    hazmatCapable: true,
    canAccessHighways: false,
    highwayRestricted: true,
    operationalEnvironment: "Long-distance rail",
    maxTravelTimeHours: 24,
    requiresSpecialHandling: false,
    preferredRoadTypes: [],
    iconType: "truck",
  },
  roro_cargo_ship: {
    type: "roro_cargo_ship",
    name: "Ro-Ro Cargo Ship",
    minCapacityTons: 1000,
    maxCapacityTons: 5000,
    avgSpeedKmh: 35,
    fuelConsumptionLitersPerKm: 0.8,
    hazmatCapable: true,
    canAccessHighways: false,
    highwayRestricted: true,
    operationalEnvironment: "International maritime",
    maxTravelTimeHours: 168,
    requiresSpecialHandling: false,
    preferredRoadTypes: [],
    iconType: "truck",
  },
  // --- NEW: Last-mile / Consumer Delivery Vehicles ---
  bike: {
    type: "bike",
    name: "Motorbike / Scooter",
    minCapacityTons: 0,
    maxCapacityTons: 0.05,
    avgSpeedKmh: 40,
    fuelConsumptionLitersPerKm: 0.03,
    hazmatCapable: false,
    canAccessHighways: false,
    highwayRestricted: true, // ⚠️ Banned from highways for safety
    operationalEnvironment: "Urban last-mile delivery",
    maxTravelTimeHours: 4,
    requiresSpecialHandling: false,
    preferredRoadTypes: ["local_road", "state_road"],
    iconType: "bike",
  },
  auto_rickshaw: {
    type: "auto_rickshaw",
    name: "Auto Rickshaw (3-Wheeler)",
    minCapacityTons: 0,
    maxCapacityTons: 0.5,
    avgSpeedKmh: 35,
    fuelConsumptionLitersPerKm: 0.04,
    hazmatCapable: false,
    canAccessHighways: false,
    highwayRestricted: true, // ⚠️ Banned from highways for safety
    operationalEnvironment: "Urban/semi-urban delivery",
    maxTravelTimeHours: 6,
    requiresSpecialHandling: false,
    preferredRoadTypes: ["local_road", "state_road"],
    iconType: "auto",
  },
  van: {
    type: "van",
    name: "Delivery Van",
    minCapacityTons: 0.5,
    maxCapacityTons: 3,
    avgSpeedKmh: 60,
    fuelConsumptionLitersPerKm: 0.12,
    hazmatCapable: false,
    canAccessHighways: true,
    highwayRestricted: false,
    operationalEnvironment: "Urban/suburban delivery",
    maxTravelTimeHours: 10,
    requiresSpecialHandling: false,
    preferredRoadTypes: ["highway", "state_road", "local_road"],
    iconType: "van",
  },
  delivery_bike: {
    type: "delivery_bike",
    name: "Delivery Bicycle / E-Bike",
    minCapacityTons: 0,
    maxCapacityTons: 0.02,
    avgSpeedKmh: 15,
    fuelConsumptionLitersPerKm: 0,
    hazmatCapable: false,
    canAccessHighways: false,
    highwayRestricted: true, // ⚠️ Banned from highways
    operationalEnvironment: "Hyper-local last-mile",
    maxTravelTimeHours: 3,
    requiresSpecialHandling: false,
    preferredRoadTypes: ["local_road"],
    iconType: "bicycle",
  },
};

// Supply chain stage to recommended vehicle types mapping
const stageToVehicles: Record<SupplyChainStage, VehicleType[]> = {
  mining: ["mining_haul_truck"],
  mine_to_refinery: ["heavy_dump_truck"],
  refinery_to_battery_plant: ["bulk_powder_tanker"],
  refinery_to_chemical: ["chemical_tanker"],
  component_to_battery_plant: ["container_truck"],
  battery_manufacturing_manual: ["forklift"],
  battery_manufacturing_automation: ["agv"],
  component_to_ev_assembly: ["flatbed_truck", "container_truck"],
  ev_assembly_internal: ["tugger_train"],
  ev_distribution: ["car_carrier_truck", "van"],
  ev_long_distance: ["car_carrier_truck", "rail_car"],
  ev_international_shipping: ["roro_cargo_ship"],
};

// Material type handling requirements
const materialHandling: Record<MaterialType, {hazmat: boolean; sealed: boolean; refrigerated: boolean; specialHandling: boolean}> = {
  lithium_ore: { hazmat: false, sealed: false, refrigerated: false, specialHandling: false },
  cobalt_ore: { hazmat: false, sealed: false, refrigerated: false, specialHandling: false },
  nickel_ore: { hazmat: false, sealed: false, refrigerated: false, specialHandling: false },
  lithium_carbonate: { hazmat: false, sealed: true, refrigerated: false, specialHandling: true },
  nickel_sulfate: { hazmat: true, sealed: true, refrigerated: false, specialHandling: true },
  graphite: { hazmat: false, sealed: true, refrigerated: false, specialHandling: true },
  electrolyte: { hazmat: true, sealed: true, refrigerated: false, specialHandling: true },
  battery_chemicals: { hazmat: true, sealed: true, refrigerated: false, specialHandling: true },
  battery_cells: { hazmat: false, sealed: false, refrigerated: false, specialHandling: true },
  electrodes: { hazmat: false, sealed: false, refrigerated: false, specialHandling: true },
  separators: { hazmat: false, sealed: true, refrigerated: false, specialHandling: true },
  battery_pack: { hazmat: false, sealed: false, refrigerated: false, specialHandling: true },
  motor: { hazmat: false, sealed: false, refrigerated: false, specialHandling: false },
  electronics: { hazmat: false, sealed: false, refrigerated: false, specialHandling: true },
  ev_vehicle: { hazmat: false, sealed: false, refrigerated: false, specialHandling: true },
  generic_cargo: { hazmat: false, sealed: false, refrigerated: false, specialHandling: false },
};

export function recommendVehicles(
  stage: SupplyChainStage | undefined,
  materialInfo: MaterialInfo | undefined
): VehicleType[] {
  if (!stage) return [];

  let recommendedTypes = stageToVehicles[stage] || [];

  // Filter based on material info
  if (materialInfo) {
    const handling = materialHandling[materialInfo.materialType];
    recommendedTypes = recommendedTypes.filter((type) => {
      const specs = vehicleSpecs[type];
      // Check capacity
      if (materialInfo.weightTons > specs.maxCapacityTons) return false;
      // Check hazmat capability
      if (handling.hazmat && !specs.hazmatCapable) return false;
      return true;
    });
  }

  return recommendedTypes;
}

export function getVehicleDetails(vehicleType: VehicleType): VehicleDetails {
  return vehicleSpecs[vehicleType];
}

export function getAllVehicleTypes(): VehicleType[] {
  return Object.keys(vehicleSpecs) as VehicleType[];
}

export function getLastMileVehicles(): VehicleType[] {
  return ["bike", "auto_rickshaw", "van", "delivery_bike", "container_truck"];
}

export function getRecommendedCapacity(materialInfo: MaterialInfo): number {
  const handling = materialHandling[materialInfo.materialType];
  
  // Find smallest vehicle that can handle the material and weight
  let minCapacity = materialInfo.weightTons;

  for (const specs of Object.values(vehicleSpecs)) {
    if (specs.maxCapacityTons >= materialInfo.weightTons * 1.2 && specs.minCapacityTons <= specs.maxCapacityTons) {
      if (handling.hazmat && !specs.hazmatCapable) continue;
      if (specs.maxCapacityTons < minCapacity) {
        minCapacity = specs.maxCapacityTons;
      }
    }
  }

  return minCapacity;
}

/**
 * Check road restriction warnings for a given vehicle type and selected road types.
 * Returns an array of human-readable warning strings.
 */
export function getRoadRestrictionWarnings(vehicleType: VehicleType, roadTypes?: string[]): string[] {
  const specs = vehicleSpecs[vehicleType];
  const warnings: string[] = [];

  if (specs.highwayRestricted) {
    if (!roadTypes || roadTypes.includes("highway") || roadTypes.includes("national_highway")) {
      warnings.push(`⚠️ ${specs.name} is NOT allowed on highways/expressways for safety`);
    }
    if (roadTypes?.includes("state_road") && !specs.preferredRoadTypes.includes("state_road")) {
      warnings.push(`⚠️ ${specs.name} may face restrictions on state roads`);
    }
  }

  if (!specs.canAccessHighways && roadTypes?.includes("highway")) {
    warnings.push(`🚫 ${specs.name} cannot access highway routes — alternative routes will be used`);
  }

  return warnings;
}
