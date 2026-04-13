import { getVehicleDetails } from "./vehicleRecommender";
import type { VehicleType } from "./schema";

export interface CostBreakdown {
  fuelCost: number;
  distanceCost: number;
  timeCost: number;
  totalCost: number;
  costPerKm: number;
  costPerHour: number;
}

export interface RouteCostAnalysis {
  vehicleType: VehicleType;
  distanceKm: number;
  timeHours: number;
  weightTons: number;
  breakdown: CostBreakdown;
  efficiency: {
    costPerTon: number;
    fuelConsumption: number;
  };
}

// Cost parameters (can be made configurable)
const COST_PARAMS = {
  fuelPricePerLiter: 100, // INR per liter
  driverWagePerHour: 300, // INR per hour
  maintenancePerKm: 5, // INR per km
  overheadPerHour: 100, // INR per hour (insurance, depreciation, etc.)
  tolls: {
    highway: 2, // INR per km on highways
    national_highway: 1.5,
    state_road: 0.5,
    local_road: 0,
  },
  batteryChargeCost: 15, // INR per kWh for EV
};

export function calculateRouteCost(
  vehicleType: VehicleType,
  distanceKm: number,
  timeHours: number,
  weightTons: number,
  roadType: string[] = ["highway", "state_road", "local_road"]
): RouteCostAnalysis {
  const specs = getVehicleDetails(vehicleType);

  // Fuel/Energy cost
  const fuelConsumptionLiters = distanceKm * specs.fuelConsumptionLitersPerKm;
  const fuelCost = fuelConsumptionLiters * COST_PARAMS.fuelPricePerLiter;

  // Toll cost (average across road types)
  const avgTollRate =
    roadType.length > 0
      ? roadType.reduce((sum, road) => sum + (COST_PARAMS.tolls[road as keyof typeof COST_PARAMS.tolls] || 0), 0) /
        roadType.length
      : 1.5;
  const tollCost = distanceKm * avgTollRate;

  // Driver & labor cost
  const driverCost = timeHours * COST_PARAMS.driverWagePerHour;

  // Maintenance cost
  const maintenanceCost = distanceKm * COST_PARAMS.maintenancePerKm;

  // Overhead cost
  const overheadCost = timeHours * COST_PARAMS.overheadPerHour;

  // Distance-based costs
  const distanceCost = tollCost + maintenanceCost;

  // Time-based costs
  const timeCost = driverCost + overheadCost;

  const totalCost = fuelCost + distanceCost + timeCost;
  const costPerKm = totalCost / distanceKm;
  const costPerHour = totalCost / timeHours;

  return {
    vehicleType,
    distanceKm,
    timeHours,
    weightTons,
    breakdown: {
      fuelCost,
      distanceCost,
      timeCost,
      totalCost,
      costPerKm,
      costPerHour,
    },
    efficiency: {
      costPerTon: weightTons > 0 ? totalCost / weightTons : totalCost,
      fuelConsumption: fuelConsumptionLiters,
    },
  };
}

export function calculateTotalFleetCost(routes: RouteCostAnalysis[]): {
  totalCost: number;
  averageCostPerRoute: number;
  totalDistance: number;
  totalTime: number;
} {
  const totalCost = routes.reduce((sum, route) => sum + route.breakdown.totalCost, 0);
  const totalDistance = routes.reduce((sum, route) => sum + route.distanceKm, 0);
  const totalTime = routes.reduce((sum, route) => sum + route.timeHours, 0);

  return {
    totalCost,
    averageCostPerRoute: routes.length > 0 ? totalCost / routes.length : 0,
    totalDistance,
    totalTime,
  };
}

export function getOptimalVehicleForCost(
  vehicleTypes: VehicleType[],
  distanceKm: number,
  weightTons: number
): VehicleType {
  const costAnalyses = vehicleTypes.map((vehicleType) =>
    calculateRouteCost(vehicleType, distanceKm, distanceKm / 60, weightTons) // Assume avg 60 km/h
  );

  let minCostIndex = 0;
  let minCost = costAnalyses[0].breakdown.totalCost;

  for (let i = 1; i < costAnalyses.length; i++) {
    if (costAnalyses[i].breakdown.totalCost < minCost) {
      minCost = costAnalyses[i].breakdown.totalCost;
      minCostIndex = i;
    }
  }

  return vehicleTypes[minCostIndex];
}
