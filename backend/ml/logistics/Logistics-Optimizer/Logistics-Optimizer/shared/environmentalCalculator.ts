import { getVehicleDetails } from "./vehicleRecommender";
import type { VehicleType } from "./schema";

export interface EnvironmentalMetrics {
  co2EmissionsTons: number;
  fuelConsumptionLiters: number;
  co2PerKm: number;
  co2PerTon: number;
  equivalentTrees: number; // Trees needed to offset CO2
  equivalentCars: number; // Equivalent km driven by average car
}

// CO2 emissions factors (kg CO2 per liter of fuel)
const CO2_EMISSIONS = {
  diesel: 2.68, // kg CO2 per liter
  petrol: 2.31, // kg CO2 per liter
  electric: 0.05, // kg CO2 per kWh (from grid average)
};

// Vehicle fuel type mapping
const VEHICLE_FUEL_TYPE: Record<VehicleType, "diesel" | "petrol" | "electric"> = {
  mining_haul_truck: "diesel",
  heavy_dump_truck: "diesel",
  bulk_powder_tanker: "diesel",
  chemical_tanker: "diesel",
  container_truck: "diesel",
  forklift: "diesel",
  agv: "electric",
  flatbed_truck: "diesel",
  tugger_train: "diesel",
  car_carrier_truck: "diesel",
  rail_car: "diesel",
  roro_cargo_ship: "diesel",
};

// One tree offsets approximately 22 kg of CO2 per year
const CO2_PER_TREE = 22;

// Average car emits about 200g CO2 per km
const CO2_PER_CAR_KM = 0.2;

export function calculateEnvironmentalImpact(
  vehicleType: VehicleType,
  distanceKm: number,
  weightTons: number
): EnvironmentalMetrics {
  const specs = getVehicleDetails(vehicleType);
  const fuelType = VEHICLE_FUEL_TYPE[vehicleType] || "diesel";

  let fuelConsumptionLiters: number;
  let co2EmissionsKg: number;

  if (fuelType === "electric") {
    // For EVs: estimate consumption in kWh
    // Average EV: 0.15-0.25 kWh per km
    const avgConsumptionPerKm = 0.2; // kWh per km
    fuelConsumptionLiters = distanceKm * avgConsumptionPerKm; // Will represent kWh
    co2EmissionsKg = fuelConsumptionLiters * CO2_EMISSIONS.electric;
  } else {
    fuelConsumptionLiters = distanceKm * specs.fuelConsumptionLitersPerKm;
    co2EmissionsKg = fuelConsumptionLiters * CO2_EMISSIONS[fuelType];
  }

  const co2EmissionsTons = co2EmissionsKg / 1000;
  const co2PerKm = co2EmissionsKg / distanceKm;
  const co2PerTon = weightTons > 0 ? co2EmissionsKg / weightTons : co2EmissionsKg;
  const equivalentTrees = Math.ceil(co2EmissionsKg / CO2_PER_TREE);
  const equivalentCars = distanceKm * CO2_PER_CAR_KM / co2EmissionsKg;

  return {
    co2EmissionsTons,
    fuelConsumptionLiters,
    co2PerKm,
    co2PerTon,
    equivalentTrees,
    equivalentCars: Math.round(equivalentCars * 100) / 100,
  };
}

export function calculateFleetEnvironmentalImpact(
  routes: Array<{ vehicleType: VehicleType; distanceKm: number; weightTons: number }>
): {
  totalCo2Tons: number;
  totalFuelLiters: number;
  averageCo2PerKm: number;
  totalTreesToOffset: number;
  estimatedSavingsWithEV: number;
} {
  const analyses = routes.map((route) =>
    calculateEnvironmentalImpact(route.vehicleType, route.distanceKm, route.weightTons)
  );

  const totalCo2Tons = analyses.reduce((sum, a) => sum + a.co2EmissionsTons, 0);
  const totalFuelLiters = analyses.reduce((sum, a) => sum + a.fuelConsumptionLiters, 0);
  const totalDistance = routes.reduce((sum, r) => sum + r.distanceKm, 0);
  const averageCo2PerKm = totalDistance > 0 ? (totalCo2Tons * 1000) / totalDistance : 0;
  const totalTreesToOffset = analyses.reduce((sum, a) => sum + a.equivalentTrees, 0);

  // Calculate potential savings if all routes used EVs instead
  const evAnalyses = routes.map((route) => {
    const specs = getVehicleDetails(route.vehicleType);
    const avgConsumptionPerKm = 0.2;
    const kwh = route.distanceKm * avgConsumptionPerKm;
    const evCo2Kg = kwh * CO2_EMISSIONS.electric;
    const currentCo2 = calculateEnvironmentalImpact(
      route.vehicleType,
      route.distanceKm,
      route.weightTons
    ).co2EmissionsTons * 1000;
    return (currentCo2 - evCo2Kg) / 1000;
  });

  const estimatedSavingsWithEV =
    evAnalyses.reduce((sum, a) => sum + a, 0);

  return {
    totalCo2Tons,
    totalFuelLiters,
    averageCo2PerKm,
    totalTreesToOffset,
    estimatedSavingsWithEV,
  };
}

export function getVehicleEmissionRanking(vehicleTypes: VehicleType[]): Array<{
  vehicle: VehicleType;
  co2PerKm: number;
  rank: number;
}> {
  const emissions = vehicleTypes.map((vehicle) => ({
    vehicle,
    co2PerKm: calculateEnvironmentalImpact(vehicle, 100, 1).co2PerKm,
  }));

  emissions.sort((a, b) => a.co2PerKm - b.co2PerKm);

  return emissions.map((e, index) => ({
    ...e,
    rank: index + 1,
  }));
}
