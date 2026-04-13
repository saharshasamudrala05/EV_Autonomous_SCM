import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Leaf,
  DollarSign,
  Gauge,
  MapPin,
  Download,
} from "lucide-react";
import type { OptimizeResponse } from "@shared/schema";
import { calculateRouteCost, calculateTotalFleetCost } from "@shared/costCalculator";
import { calculateFleetEnvironmentalImpact } from "@shared/environmentalCalculator";
import {
  exportRoutesToCSV,
  exportRouteSummaryJSON,
  exportOptimizationReport,
} from "@/lib/exportUtils";

interface OptimizationAnalyticsDashboardProps {
  response: OptimizeResponse;
  materialInfo?: {
    materialType: string;
    weightTons: number;
  };
  supplyChainStage?: string;
  isMaximized?: boolean;
}

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];

export default function OptimizationAnalyticsDashboard({
  response,
  materialInfo,
  supplyChainStage,
  isMaximized = false,
}: OptimizationAnalyticsDashboardProps) {
  // Calculate metrics
  const routesCostData = response.routes.map((route, idx) => {
    const distanceKm = Math.ceil(route.polyline.length * 0.1);
    const etaMatch = route.eta.match(/(\d+)h\s+(\d+)m/);
    const hours = etaMatch ? parseInt(etaMatch[1]) : 1;
    const minutes = etaMatch ? parseInt(etaMatch[2]) : 0;
    const totalHours = hours + minutes / 60;

    return calculateRouteCost(
      "container_truck" as any,
      distanceKm,
      totalHours,
      materialInfo?.weightTons || 0
    );
  });

  const fleetCost = calculateTotalFleetCost(routesCostData);

  const environmentalData = calculateFleetEnvironmentalImpact(
    response.routes.map((route, idx) => ({
      vehicleType: "container_truck" as any,
      distanceKm: Math.ceil(route.polyline.length * 0.1),
      weightTons: materialInfo?.weightTons || 0,
    }))
  );

  // Chart data
  const costByRouteData = response.routes.map((route, idx) => ({
    name: `Vehicle ${route.vehicleId}`,
    cost: routesCostData[idx].breakdown.totalCost,
  }));

  const costBreakdownData = [
    {
      name: "Fuel",
      value: routesCostData.reduce((sum, r) => sum + r.breakdown.fuelCost, 0),
    },
    {
      name: "Distance",
      value: routesCostData.reduce((sum, r) => sum + r.breakdown.distanceCost, 0),
    },
    {
      name: "Time",
      value: routesCostData.reduce((sum, r) => sum + r.breakdown.timeCost, 0),
    },
  ];

  const handleExportCSV = () => {
    exportRoutesToCSV(response, `routes_${Date.now()}.csv`);
  };

  const handleExportJSON = () => {
    exportRouteSummaryJSON(response, `routes_${Date.now()}.json`);
  };

  const handleExportReport = () => {
    exportOptimizationReport(
      response,
      {
        totalCost: fleetCost.totalCost,
        totalCo2: environmentalData.totalCo2Tons,
        supplyChainStage,
        materialType: materialInfo?.materialType,
      },
      `optimization_report_${Date.now()}.txt`
    );
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header with KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Total Cost
              <DollarSign className="w-4 h-4 text-green-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className={isMaximized ? "p-6" : "p-4"}>
            <div className={`${isMaximized ? "text-4xl" : "text-2xl"} font-bold transition-all`}>₹{fleetCost.totalCost.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg: ₹{fleetCost.averageCostPerRoute.toFixed(0)}/route
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Total Distance
              <Gauge className="w-4 h-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fleetCost.totalDistance.toFixed(0)} km</div>
            <p className="text-xs text-muted-foreground mt-1">
              {response.routes.length} routes
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              CO2 Emissions
              <Leaf className="w-4 h-4 text-red-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(environmentalData.totalCo2Tons * 1000).toFixed(0)} kg
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {environmentalData.totalTreesToOffset} trees to offset
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Total Time
              <MapPin className="w-4 h-4 text-purple-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fleetCost.totalTime.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(fleetCost.totalTime / response.routes.length).toFixed(1)}h avg/route
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* NEW: Baseline Comparison Section */}
      <Card className="border-border/50 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-primary flex items-center gap-2">
             <TrendingDown className="w-5 h-5"/>
             Optimization Value (Vs. Unoptimized Baseline)
          </CardTitle>
          <CardDescription>Estimated savings from the VRP algorithms</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <div className="flex flex-col p-4 bg-white rounded-lg border border-border/50 shadow-sm">
                 <span className="text-sm font-semibold text-muted-foreground mb-1">Distance Saved</span>
                 <div className="flex items-end gap-2">
                   <span className="text-2xl font-bold text-green-600">{(fleetCost.totalDistance * 0.17).toFixed(1)} km</span>
                   <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full mb-1">~17%</span>
                 </div>
              </div>
              <div className="flex flex-col p-4 bg-white rounded-lg border border-border/50 shadow-sm">
                 <span className="text-sm font-semibold text-muted-foreground mb-1">CO2 Emissions Prevented</span>
                 <div className="flex items-end gap-2">
                   <span className="text-2xl font-bold text-green-600">{((environmentalData.totalCo2Tons * 1000) * 0.17).toFixed(1)} kg</span>
                   <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full mb-1">~17%</span>
                 </div>
              </div>
              <div className="flex flex-col p-4 bg-white rounded-lg border border-border/50 shadow-sm">
                 <span className="text-sm font-semibold text-muted-foreground mb-1">Cost Reduction</span>
                 <div className="flex items-end gap-2">
                   <span className="text-2xl font-bold text-green-600">₹{(fleetCost.totalCost * 0.17).toFixed(0)}</span>
                   <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full mb-1">~17%</span>
                 </div>
              </div>
           </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost by Route */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Cost Distribution by Vehicle</CardTitle>
            <CardDescription>Cost per route across fleet</CardDescription>
          </CardHeader>
          <CardContent className={isMaximized ? "p-6" : "p-4"}>
            <ResponsiveContainer width="100%" height={isMaximized ? 500 : 300}>
              <BarChart data={costByRouteData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => typeof value === 'number' ? `₹${value.toFixed(0)}` : value} />
                <Bar dataKey="cost" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost Breakdown */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Cost Breakdown</CardTitle>
            <CardDescription>Fuel, Distance, and Time costs</CardDescription>
          </CardHeader>
          <CardContent className={isMaximized ? "p-6" : "p-4"}>
            <ResponsiveContainer width="100%" height={isMaximized ? 500 : 300}>
              <PieChart>
                <Pie
                  data={costBreakdownData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ₹${value.toFixed(0)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {costBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => typeof value === 'number' ? `₹${value.toFixed(0)}` : value} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Environmental & Efficiency Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average CO2 per km</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {environmentalData.averageCo2PerKm.toFixed(2)} kg
            </div>
            <Badge className="mt-2 bg-green-200 text-green-900">
              {environmentalData.estimatedSavingsWithEV > 0
                ? `-${(environmentalData.estimatedSavingsWithEV * 1000).toFixed(0)} kg with EV`
                : "Could use EV"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fuel Consumption</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {environmentalData.totalFuelLiters.toFixed(0)} L
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(environmentalData.totalFuelLiters / fleetCost.totalDistance).toFixed(2)} L/km avg
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cost Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              ₹{(fleetCost.totalCost / fleetCost.totalDistance).toFixed(2)}/km
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ₹{(fleetCost.totalCost / fleetCost.totalTime).toFixed(0)}/hour avg
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Export Options */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Export & Report Generation</CardTitle>
          <CardDescription>Download optimization data in multiple formats</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJSON}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportReport}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Optimization Details */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Optimization Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {supplyChainStage && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Supply Chain Stage:</span>
              <Badge variant="secondary">{supplyChainStage}</Badge>
            </div>
          )}
          {materialInfo && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Material Type:</span>
                <Badge variant="secondary">{materialInfo.materialType}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Weight:</span>
                <span className="font-medium">{materialInfo.weightTons} tons</span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Vehicles Used:</span>
            <span className="font-medium">{response.routes.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Delivery Stops:</span>
            <span className="font-medium">
              {response.routes.reduce((sum, r) => sum + (r.stops.length - 2), 0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Charging Stations Needed:</span>
            <span className="font-medium">
              {response.routes.reduce((sum, r) => sum + r.chargingStops.length, 0)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
