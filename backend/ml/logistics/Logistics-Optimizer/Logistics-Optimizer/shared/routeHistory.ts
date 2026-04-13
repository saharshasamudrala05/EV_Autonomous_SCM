import type { OptimizeRequest, OptimizeResponse } from "./schema";

export interface OptimizationRecord {
  id: string;
  timestamp: number;
  request: OptimizeRequest;
  response: OptimizeResponse;
  metadata: {
    totalDistance: number;
    totalTime: number;
    costEstimate: number;
    co2Estimate: number;
    name?: string;
    notes?: string;
  };
}

const STORAGE_KEY = "logistics_optimizer_history";
const MAX_HISTORY = 50;

export function saveOptimizationToHistory(
  request: OptimizeRequest,
  response: OptimizeResponse,
  name?: string,
  notes?: string
): OptimizationRecord {
  // Calculate metadata
  const totalDistance = response.routes.reduce((sum, route) => {
    // Rough distance from polyline
    return sum + (route.polyline.length * 0.1); // Approximate
  }, 0);

  const totalTime = response.routes.reduce((sum, route) => {
    // Parse ETA string (e.g., "2h 30m")
    const match = route.eta.match(/(\d+)h\s+(\d+)m/);
    if (match) {
      return sum + (parseInt(match[1]) + parseInt(match[2]) / 60);
    }
    return sum;
  }, 0);

  // Rough cost estimate (can be improved)
  const costEstimate = totalDistance * 50; // Rough estimate

  // Rough CO2 estimate
  const co2Estimate = totalDistance * 0.12;

  const record: OptimizationRecord = {
    id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    request,
    response,
    metadata: {
      totalDistance,
      totalTime,
      costEstimate,
      co2Estimate,
      name: name || `Optimization ${new Date().toLocaleDateString()}`,
      notes,
    },
  };

  try {
    const history = loadOptimizationHistory();
    history.unshift(record);

    // Keep only recent 50 records
    if (history.length > MAX_HISTORY) {
      history.pop();
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return record;
  } catch (error) {
    console.error("Failed to save optimization to history:", error);
    throw error;
  }
}

export function loadOptimizationHistory(): OptimizationRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load optimization history:", error);
    return [];
  }
}

export function getOptimizationById(id: string): OptimizationRecord | null {
  const history = loadOptimizationHistory();
  return history.find((record) => record.id === id) || null;
}

export function deleteOptimization(id: string): boolean {
  try {
    const history = loadOptimizationHistory();
    const filtered = history.filter((record) => record.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error("Failed to delete optimization:", error);
    return false;
  }
}

export function clearHistory(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error("Failed to clear history:", error);
    return false;
  }
}

export function updateOptimizationMetadata(
  id: string,
  metadata: Partial<OptimizationRecord["metadata"]>
): OptimizationRecord | null {
  try {
    const history = loadOptimizationHistory();
    const record = history.find((r) => r.id === id);
    if (!record) return null;

    record.metadata = { ...record.metadata, ...metadata };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return record;
  } catch (error) {
    console.error("Failed to update optimization metadata:", error);
    return null;
  }
}

export function getOptimizationStats(): {
  totalOptimizations: number;
  totalDistance: number;
  totalCost: number;
  totalCo2: number;
  averageCost: number;
} {
  const history = loadOptimizationHistory();

  const totalOptimizations = history.length;
  const totalDistance = history.reduce((sum, r) => sum + r.metadata.totalDistance, 0);
  const totalCost = history.reduce((sum, r) => sum + r.metadata.costEstimate, 0);
  const totalCo2 = history.reduce((sum, r) => sum + r.metadata.co2Estimate, 0);
  const averageCost = totalOptimizations > 0 ? totalCost / totalOptimizations : 0;

  return {
    totalOptimizations,
    totalDistance,
    totalCost,
    totalCo2,
    averageCost,
  };
}
