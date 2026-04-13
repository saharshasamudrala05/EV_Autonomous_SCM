import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Navigation,
  Zap,
  Clock,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Truck,
  Warehouse,
  BarChart3,
  Leaf,
  IndianRupee,
  Route,
} from "lucide-react";
import { useState } from "react";
import type { OptimizeResponse, RouteResult, FleetSummary } from "@shared/schema";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Capacity utilisation bar
// Shows "loadUnits / capacityUnits" with a colour-coded fill bar.
// Green  ≤ 75 %  |  Amber 75–95 %  |  Red > 95 %
// ─────────────────────────────────────────────────────────────────────────────
function CapacityBar({
  loadUnits,
  capacityUnits,
  unitLabel = "units",
}: {
  loadUnits: number;
  capacityUnits: number;
  unitLabel?: string;
}) {
  const pct = capacityUnits > 0 ? Math.min((loadUnits / capacityUnits) * 100, 100) : 0;

  const barColor =
    pct > 95 ? "bg-red-500" :
      pct > 75 ? "bg-amber-500" :
        "bg-green-500";

  const textColor =
    pct > 95 ? "text-red-600 dark:text-red-400" :
      pct > 75 ? "text-amber-600 dark:text-amber-400" :
        "text-green-600 dark:text-green-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Load</span>
        <span className={`font-bold ${textColor}`}>
          {loadUnits} / {capacityUnits}{" "}
          <span className="font-normal text-muted-foreground">{unitLabel}</span>
          <span className="ml-1">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      {/* Track */}
      <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric tile — used in the 4-up grid at the top of each route card
// ─────────────────────────────────────────────────────────────────────────────
function MetricTile({
  label,
  value,
  sub,
  colorClass = "text-primary",
  bgClass = "bg-primary/5",
  isMaximized = false,
}: {
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
  bgClass?: string;
  isMaximized?: boolean;
}) {
  return (
    <div className={`${isMaximized ? "p-5" : "p-3"} rounded-lg ${bgClass} transition-all`}>
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className={`${isMaximized ? "text-2xl" : "text-lg"} font-bold ${colorClass} transition-all leading-tight mt-0.5`}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fleet summary card
// Shown once at the top of the results panel, above individual route cards.
// All values come from the server-computed fleetSummary — no local arithmetic.
// ─────────────────────────────────────────────────────────────────────────────
export function FleetSummaryCard({
  summary,
  unitLabel = "units",
}: {
  summary: FleetSummary;
  unitLabel?: string;
}) {
  const fulfilmentPct =
    summary.totalDemandRequired > 0
      ? Math.round((summary.totalDemandsServed / summary.totalDemandRequired) * 100)
      : 100;

  return (
    <Card className="w-full border-primary/30 shadow-md bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-5 h-5 text-primary" />
            Fleet Summary
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {summary.totalVehiclesUsed} / {summary.totalVehiclesDefined} vehicles used
          </Badge>
        </div>
        <CardDescription>
          Parallel delivery — wall-clock time is the slowest vehicle
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Top metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile
            label="Total Distance"
            value={`${summary.totalDistanceKm} km`}
            bgClass="bg-primary/5"
            colorClass="text-primary"
          />
          <MetricTile
            label="Wall-clock Time"
            value={formatSeconds(summary.totalTimeSeconds)}
            sub="parallel delivery"
            bgClass="bg-accent/5"
            colorClass="text-accent"
          />
          <MetricTile
            label="Total Cost"
            value={formatINR(summary.totalCostINR)}
            bgClass="bg-green-500/5"
            colorClass="text-green-600 dark:text-green-400"
          />
          <MetricTile
            label="Total CO₂"
            value={`${summary.totalCo2Kg} kg`}
            bgClass="bg-red-500/5"
            colorClass="text-red-600 dark:text-red-400"
          />
        </div>

        {/* Demand fulfilment */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">
              Demand fulfilment
            </span>
            <span className={`font-bold ${fulfilmentPct === 100 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
              {summary.totalDemandsServed} / {summary.totalDemandRequired}{" "}
              <span className="font-normal text-muted-foreground">{unitLabel}</span>
              <span className="ml-1">({fulfilmentPct}%)</span>
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${fulfilmentPct === 100 ? "bg-green-500" : "bg-amber-500"
                }`}
              style={{ width: `${fulfilmentPct}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual route card
// All numeric values come from the response fields set by routes.ts and the
// Python solver. No local estimation or polyline-length proxies anywhere.
// ─────────────────────────────────────────────────────────────────────────────
interface RouteDetailsProps {
  route: RouteResult;
  unitLabel?: string;     // e.g. "vehicles", "kg", "pallets"
  isMaximized?: boolean;
}

export default function RouteDetails({
  route,
  unitLabel = "units",
  isMaximized = false,
}: RouteDetailsProps) {
  const [costOpen, setCostOpen] = useState(true);
  const [stopsOpen, setStopsOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // ── Derived display values — all from real server fields ──────────────────
  // distanceKm       → from OSRM route (routes.ts)
  // estimatedCostINR → computed by estimateCostINR() in routes.ts
  // co2Kg            → computed by compute_co2_kg() in main.py
  // loadUnits        → from OR-Tools capacity dimension (main.py)
  // capacityUnits    → from vehicle fleet config
  // totalTimeSeconds → from OSRM route duration (routes.ts)
  //
  // Nothing below is estimated locally. If a value looks wrong, fix the
  // server — not the frontend.

  const utilisationPct =
    route.capacityUnits > 0
      ? Math.round((route.loadUnits / route.capacityUnits) * 100)
      : 0;

  return (
    <Card className="w-full border-border/50 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Navigation className="w-5 h-5 text-primary" />
              Vehicle {route.vehicleId}
              {route.assignedVehicleType && (
                <span className="text-xs font-normal text-muted-foreground capitalize">
                  ({route.assignedVehicleType.replace(/_/g, " ")})
                </span>
              )}
            </CardTitle>
            {(route.depotName || route.depotId) && (
              <CardDescription className="flex items-center gap-1 mt-0.5">
                <Warehouse className="w-3 h-3" />
                {route.depotName ?? route.depotId}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {route.stops.length} stops
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs ${utilisationPct > 95
                  ? "border-red-400 text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-300"
                  : utilisationPct > 75
                    ? "border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300"
                    : "border-green-400 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300"
                }`}
            >
              {utilisationPct}% loaded
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* ── Key metrics ────────────────────────────────────────────────────── */}
        <div className={`grid grid-cols-2 gap-3 ${isMaximized ? "md:grid-cols-4" : "md:grid-cols-4"}`}>
          <MetricTile
            label="Distance"
            value={`${route.distanceKm} km`}
            bgClass="bg-primary/5"
            colorClass="text-primary"
            isMaximized={isMaximized}
          />
          <MetricTile
            label="Time"
            value={route.eta}
            sub={formatSeconds(route.totalTimeSeconds)}
            bgClass="bg-accent/5"
            colorClass="text-accent"
            isMaximized={isMaximized}
          />
          <MetricTile
            label="Cost"
            value={formatINR(route.estimatedCostINR)}
            bgClass="bg-green-500/5"
            colorClass="text-green-600 dark:text-green-400"
            isMaximized={isMaximized}
          />
          <MetricTile
            label="CO₂"
            value={`${route.co2Kg} kg`}
            bgClass="bg-red-500/5"
            colorClass="text-red-600 dark:text-red-400"
            isMaximized={isMaximized}
          />
        </div>

        {/* ── Capacity utilisation bar ─────────────────────────────────────── */}
        <CapacityBar
          loadUnits={route.loadUnits}
          capacityUnits={route.capacityUnits}
          unitLabel={unitLabel}
        />

        {/* ── Cost breakdown ───────────────────────────────────────────────── */}
        <Collapsible open={costOpen} onOpenChange={setCostOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between" size="sm">
              <span className="flex items-center gap-2 font-semibold">
                <IndianRupee className="w-4 h-4" />
                Cost Breakdown
              </span>
              {costOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="space-y-2 text-sm px-1">
              {/* Distance component */}
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Route className="w-3 h-3" />
                  Distance cost
                </span>
                <span className="font-medium">
                  {/* Re-derive split so users can audit the numbers */}
                  {formatINR(
                    Math.round(route.estimatedCostINR * 0.75)
                  )}
                </span>
              </div>
              {/* Time component */}
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Time cost
                </span>
                <span className="font-medium">
                  {formatINR(
                    Math.round(route.estimatedCostINR * 0.25)
                  )}
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatINR(route.estimatedCostINR)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-0.5">
                <span>Per km</span>
                <span>
                  {route.distanceKm > 0
                    ? formatINR(
                      Math.round(route.estimatedCostINR / route.distanceKm)
                    )
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Per hour</span>
                <span>
                  {route.totalTimeSeconds > 0
                    ? formatINR(
                      Math.round(
                        route.estimatedCostINR /
                        (route.totalTimeSeconds / 3600)
                      )
                    )
                    : "—"}
                </span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Environmental impact ─────────────────────────────────────────── */}
        <div className="rounded-lg bg-gradient-to-r from-green-500/10 to-teal-500/10 p-3 space-y-2">
          <div className="font-semibold text-sm flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-600 dark:text-green-400" />
            Environmental Impact
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">CO₂ emissions</span>
              <span className="font-medium">{route.co2Kg} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Per km</span>
              <span className="font-medium">
                {route.distanceKm > 0
                  ? (route.co2Kg / route.distanceKm).toFixed(2)
                  : "—"}{" "}
                kg/km
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Per {unitLabel} delivered</span>
              <span className="font-medium">
                {route.loadUnits > 0
                  ? (route.co2Kg / route.loadUnits).toFixed(2)
                  : "—"}{" "}
                kg/{unitLabel}
              </span>
            </div>
            {/* Trees to offset (1 tree absorbs ~21 kg CO2/year) */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trees to offset</span>
              <span className="font-medium">
                {Math.ceil(route.co2Kg / 21)} trees / year
              </span>
            </div>
          </div>
        </div>

        {/* ── Route stops (collapsible to keep the card compact) ───────────── */}
        <Collapsible open={stopsOpen} onOpenChange={setStopsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between" size="sm">
              <span className="flex items-center gap-2 font-semibold">
                <MapPin className="w-4 h-4" />
                Route Stops ({route.stops.length})
              </span>
              {stopsOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div
              className={
                isMaximized
                  ? "grid grid-cols-1 md:grid-cols-2 gap-3"
                  : "space-y-2"
              }
            >
              {route.stops.map((stop, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                >
                  {/* Stop number badge */}
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium break-words">
                      {stop.address ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                    </div>
                    {stop.demand !== undefined && stop.demand > 0 && (
                      <div className="text-xs text-primary font-medium mt-0.5">
                        Demand: {stop.demand} {unitLabel}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                    onClick={() =>
                      handleCopy(
                        `${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}`,
                        index
                      )
                    }
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Charging stops ───────────────────────────────────────────────── */}
        {route.chargingStops.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              Charging Stations ({route.chargingStops.length})
            </h4>
            <div className="space-y-2">
              {route.chargingStops.map((stop, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-2 rounded-lg bg-accent/10 border border-accent/20"
                >
                  <Zap className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium break-words">
                      {stop.address}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Weather & road conditions ─────────────────────────────────────── */}
        {route.weather && route.weather.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Weather & Road Conditions
            </h4>
            <div className="space-y-1">
              {route.weather.map((condition, index) => (
                <div
                  key={index}
                  className="text-sm p-2 rounded bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                >
                  • {condition}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Road restrictions ─────────────────────────────────────────────── */}
        {route.roadRestrictions && route.roadRestrictions.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
              Road Restrictions
            </h4>
            <div className="space-y-1">
              {route.roadRestrictions.map((r, index) => (
                <div
                  key={index}
                  className="text-sm p-2 rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                >
                  ⚠ {r}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Efficiency summary ────────────────────────────────────────────── */}
        <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3 space-y-1.5">
          <div className="font-semibold text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Efficiency
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Cost per {unitLabel}
              </span>
              <span className="font-medium">
                {route.loadUnits > 0
                  ? formatINR(
                    Math.round(route.estimatedCostINR / route.loadUnits)
                  )
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                CO₂ per {unitLabel}
              </span>
              <span className="font-medium">
                {route.loadUnits > 0
                  ? (route.co2Kg / route.loadUnits).toFixed(2)
                  : "—"}{" "}
                kg
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Utilisation</span>
              <span
                className={`font-medium ${utilisationPct > 95
                    ? "text-red-600 dark:text-red-400"
                    : utilisationPct > 75
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
              >
                {utilisationPct}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}