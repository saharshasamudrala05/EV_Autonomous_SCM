import type { OptimizeResponse } from "@shared/schema";

export function exportRoutesToCSV(response: OptimizeResponse, fileName: string = "routes.csv"): void {
  let csv = "Vehicle ID,Stop Number,Location,Latitude,Longitude,ETA,Stop Type\n";

  response.routes.forEach((route: any, vehicleIndex: number) => {
    route.stops.forEach((stop: any, stopIndex: number) => {
      const stopType =
        stopIndex === 0
          ? "Depot"
          : stopIndex === route.stops.length - 1
            ? "Final"
            : "Delivery";
      csv += `${route.vehicleId},${stopIndex},${stop.address || ""},${stop.lat},${stop.lng},"${route.eta}",${stopType}\n`;
    });

    // Add charging stops
    route.chargingStops.forEach((stop: any) => {
      csv += `${route.vehicleId},Charging,${stop.address || ""},${stop.lat},${stop.lng},"${route.eta}",Charging\n`;
    });
  });

  downloadCSV(csv, fileName);
}

export function exportStopsDetailedCSV(response: OptimizeResponse, fileName: string = "stops_detailed.csv"): void {
  let csv = "Vehicle ID,Stop Sequence,Address,Latitude,Longitude,Type,Weather Condition\n";

  response.routes.forEach((route: any) => {
    route.stops.forEach((stop: any, index: number) => {
      const type = index === 0 ? "Depot" : index === route.stops.length - 1 ? "Destination" : "Stop";
      const weather = route.weather && route.weather[index] ? route.weather[index] : "";
      csv += `${route.vehicleId},${index},"${stop.address || ""}",${stop.lat},${stop.lng},${type},"${weather}"\n`;
    });
  });

  downloadCSV(csv, fileName);
}

export function exportRouteSummaryJSON(
  response: OptimizeResponse,
  fileName: string = "route_summary.json"
): void {
  const summary = response.routes.map((route: any) => ({
    vehicleId: route.vehicleId,
    stops: route.stops.map((s: any) => ({
      address: s.address,
      lat: s.lat,
      lng: s.lng,
    })),
    chargingStops: route.chargingStops.map((s: any) => ({
      address: s.address,
      lat: s.lat,
      lng: s.lng,
    })),
    estimatedTime: route.eta,
    weatherConditions: route.weather || [],
  }));

  const jsonString = JSON.stringify(summary, null, 2);
  downloadFile(jsonString, fileName, "application/json");
}

export function exportOptimizationReport(
  response: OptimizeResponse,
  metadata: { totalCost?: number; totalCo2?: number; supplyChainStage?: string; materialType?: string },
  fileName: string = "optimization_report.txt"
): void {
  const date = new Date().toLocaleString();
  let report = `LOGISTICS OPTIMIZATION REPORT\n`;
  report += `Generated: ${date}\n`;
  report += `${"=".repeat(60)}\n\n`;

  report += `SUMMARY\n`;
  report += `Total Vehicles: ${response.routes.length}\n`;
  report += `Total Delivery Stops: ${response.routes.reduce((sum: number, r: any) => sum + r.stops.length - 2, 0)}\n`;
  report += `Total Charging Stops: ${response.routes.reduce((sum: number, r: any) => sum + r.chargingStops.length, 0)}\n`;

  if (metadata.totalCost) {
    report += `Estimated Total Cost: ₹${metadata.totalCost.toFixed(2)}\n`;
  }
  if (metadata.totalCo2) {
    report += `Estimated CO2 Emissions: ${metadata.totalCo2.toFixed(2)} tons\n`;
  }
  if (metadata.supplyChainStage) {
    report += `Supply Chain Stage: ${metadata.supplyChainStage}\n`;
  }
  if (metadata.materialType) {
    report += `Material Type: ${metadata.materialType}\n`;
  }

  report += `\n${"=".repeat(60)}\n`;
  report += `DETAILED ROUTES\n`;
  report += `${"=".repeat(60)}\n\n`;

  response.routes.forEach((route: any) => {
    report += `VEHICLE ${route.vehicleId}\n`;
    report += `-`.repeat(40) + "\n";
    report += `Estimated Duration: ${route.eta}\n`;
    report += `Stops: ${route.stops.length}\n`;
    report += `Charging Stations: ${route.chargingStops.length}\n\n`;

    report += `Route Details:\n`;
    route.stops.forEach((stop: any, index: number) => {
      const stopType =
        index === 0 ? "[START]" : index === route.stops.length - 1 ? "[END]" : `[STOP ${index}]`;
      report += `  ${stopType} ${stop.address} (${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)})\n`;
    });

    if (route.chargingStops.length > 0) {
      report += `\nCharging Stations:\n`;
      route.chargingStops.forEach((stop: any) => {
        report += `  ⚡ ${stop.address} (${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)})\n`;
      });
    }

    if (route.weather && route.weather.length > 0) {
      report += `\nWeather Conditions:\n`;
      route.weather.forEach((w: any) => {
        report += `  • ${w}\n`;
      });
    }

    report += "\n";
  });

  report += `${"=".repeat(60)}\n`;
  report += `Depot: ${response.depot.address} (${response.depot.lat}, ${response.depot.lng})\n`;

  downloadFile(report, fileName, "text/plain");
}

function downloadCSV(csvContent: string, fileName: string): void {
  downloadFile(csvContent, fileName, "text/csv;charset=utf-8;");
}

function downloadFile(content: string, fileName: string, mimeType: string): void {
  try {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error("Failed to download file:", error);
    alert("Failed to download file. Please try again.");
  }
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text).catch((error) => {
    console.error("Failed to copy to clipboard:", error);
    throw error;
  });
}
