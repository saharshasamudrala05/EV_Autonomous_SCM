import { useState, useMemo, useCallback, useEffect } from "react";
import OptimizeForm from "@/components/OptimizeForm";
import MapCanvas, { type DispatchState } from "@/components/MapCanvas";
import RouteDetails from "@/components/RouteDetails";
import OptimizationAnalyticsDashboard from "@/components/OptimizationAnalyticsDashboard";
import { useOptimizeRoute } from "@/hooks/use-optimize";
import type { OptimizeRequest, OptimizeResponse } from "@shared/schema";
import { getVehicleDetails } from "@shared/vehicleRecommender";
import { getVehicleBadgeSvg, routeColors } from "@/lib/leaflet-icons";
import { Zap, Activity, Navigation, Info, ChevronRight, ChevronLeft, PlayCircle, CheckCircle2, AlertTriangle, RotateCw, Truck, Maximize2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveOptimizationToHistory } from "@shared/routeHistory";
import axios from "axios";

// Vehicle status tracking for the fleet panel
interface VehicleStatus {
  vehicleId: number;
  vehicleType: string;
  status: "waiting" | "in_transit" | "delivering" | "returning" | "completed" | string;
  progress: number;
  eta: string;
  color: string;
}

export default function Dashboard() {
  const { mutate, isPending, data: responseData } = useOptimizeRoute();

  const [currentRequest, setCurrentRequest] = useState<OptimizeRequest | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [lastSelectedLocation, setLastSelectedLocation] = useState<{ lat: number, lng: number, address: string } | undefined>(undefined);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [isDetailsMaximized, setIsDetailsMaximized] = useState(false);

  // Dispatch lifecycle
  const [dispatchState, setDispatchState] = useState<DispatchState>("idle");
  const [vehicleStatuses, setVehicleStatuses] = useState<VehicleStatus[]>([]);

  // ── Map click → reverse geocoding ─────────────────────────────────────────
  // Previously called Nominatim directly from the browser.
  // Now proxied through the backend which has a 24-hour cache — repeated
  // clicks on the same area are instant and never hit Nominatim's rate limit.
  const handleLocationSelect = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await axios.get<{ address: string; displayName: string; cached: boolean }>(
        `/api/reverse-geocoding`,
        { params: { lat, lng } }
      );
      const address = res.data?.displayName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setLastSelectedLocation({ lat, lng, address });
    } catch (e) {
      // Fallback to coordinate string if the proxy is unreachable.
      console.error("[Dashboard] Reverse geocoding failed:", e);
      setLastSelectedLocation({ lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
    }
  }, []);

  const handleOptimize = (data: OptimizeRequest) => {
    setCurrentRequest(data);
    mutate(data);
    setDispatchState("reviewing");
    setShowDetailsSheet(true);
  };

  const handleValuesChange = (data: OptimizeRequest) => {
    setCurrentRequest(data);
  };

  // Initialize vehicle statuses when response arrives
  useEffect(() => {
    if (responseData) {
      const statuses: VehicleStatus[] = responseData.routes.map((route, idx) => ({
        vehicleId: route.vehicleId,
        vehicleType: route.assignedVehicleType || "container_truck",
        status: "waiting",
        progress: 0,
        eta: route.eta,
        color: routeColors[idx % routeColors.length],
      }));
      setVehicleStatuses(statuses);
    }
  }, [responseData]);

  // Sync fleet status from map animation
  const handleVehicleProgressUpdate = useCallback((animStates: any[]) => {
    setVehicleStatuses(prev =>
      prev.map((v, idx) => {
        const animState = animStates[idx];
        if (!animState) return v;
        return {
          ...v,
          progress: animState.progress,
          status: animState.status,
        };
      })
    );

    const allDone = animStates.every((s: any) => s.status === "completed");
    if (allDone && dispatchState === "dispatched") {
      // MapCanvas already handles this via onAllVehiclesCompleted
    }
  }, [dispatchState]);

  const handleDispatch = () => {
    setDispatchState("dispatched");
    setVehicleStatuses(prev => prev.map(v => ({ ...v, status: "in_transit", progress: 0 })));
  };

  const handleAllVehiclesCompleted = useCallback(() => {
    setDispatchState("completed");
  }, []);

  const handleReset = () => {
    setDispatchState("idle");
    setVehicleStatuses([]);
  };

  const generatePlainEnglishSummary = useCallback(() => {
    if (!responseData || !currentRequest) return "";

    const count = responseData.routes.length;
    let summary = `Our optimizer has organized the fleet using ${count} vehicle${count > 1 ? 's' : ''} for maximum efficiency. `;

    responseData.routes.forEach((route, i) => {
      const type = route.assignedVehicleType?.replace(/_/g, ' ') || "vehicle";
      const start = route.stops[0]?.address?.split(',')[0] || "starting point";
      const stopsCount = route.stops.length - 2;
      summary += `Vehicle ${i + 1} (${type}) will start at ${start}, handle ${stopsCount} delivery stop${stopsCount !== 1 ? 's' : ''}, and is expected to finish in ${route.eta}. `;
    });

    summary += "Please review the routes on the map. Everything is set for a safe and timely delivery.";
    return summary;
  }, [responseData, currentRequest]);

  const handleSaveToHistory = () => {
    if (responseData && currentRequest) {
      try {
        saveOptimizationToHistory(
          currentRequest,
          responseData,
          `Optimization ${new Date().toLocaleString()}`,
          "Auto-saved optimization result"
        );
        alert("Optimization saved to history!");
      } catch (error) {
        console.error("Failed to save to history:", error);
        alert("Failed to save optimization");
      }
    }
  };

  const stats = useMemo(() => {
    if (!responseData) return null;
    const totalVehiclesUsed = responseData.routes.length;
    const totalChargingStops = responseData.routes.reduce((acc, r) => acc + r.chargingStops.length, 0);
    const totalStops = responseData.routes.reduce((acc, r) => acc + r.stops.length, 0);
    const hasRestrictions = responseData.routes.some(r => r.roadRestrictions && r.roadRestrictions.length > 0);
    return { totalVehiclesUsed, totalChargingStops, totalStops, hasRestrictions };
  }, [responseData]);

  const defaultMapState: OptimizeRequest = currentRequest || {
    depot: { lat: 19.0760, lng: 72.8777 },
    stops: [],
    vehicleCount: 0,
    vehicleCapacities: [],
    demands: [],
    evProfile: {
      batteryCapacity_Wh: 50000,
      initialCharge_Wh: 40000,
      minChargeAtDestination_Wh: 10000,
      batteryCapacityKwh: 100,
      currentSocPercent: 100,
      minReturnSocPercent: 20,
      consumptionKwhPer100km: 20
    }, destination: { lat: 18.5204, lng: 73.8567 }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "in_transit": return "text-blue-600 bg-blue-50";
      case "delivering": return "text-amber-600 bg-amber-50";
      case "returning": return "text-purple-600 bg-purple-50";
      case "completed": return "text-green-600 bg-green-50";
      default: return "text-gray-500 bg-gray-50";
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-background overflow-hidden">

      {/* Sidebar Panel */}
      <aside className="w-full lg:w-[420px] shrink-0 border-r border-border/50 bg-card/60 backdrop-blur-xl flex flex-col z-10 shadow-2xl lg:shadow-none">
        <div className="p-6 border-b border-border/50 bg-card/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl leading-none tracking-tight">EcoLogistics</h1>
              <p className="text-xs font-medium text-muted-foreground mt-1">Fleet Route Optimizer</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-6">
          <OptimizeForm
            onSubmit={handleOptimize}
            isPending={isPending}
            onValuesChange={handleValuesChange}
            onLocationSelectData={lastSelectedLocation}
          />
        </div>
      </aside>

      {/* Main Map Area */}
      <main className="flex-1 relative h-full flex flex-col bg-slate-50">

        {/* Top Bar: Stats + Dispatch Controls */}
        {stats && responseData && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-top-4 duration-500">
            <Card className="border-border/50 shadow-2xl shadow-black/5 bg-card/95 backdrop-blur">
              <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-display font-bold text-primary">{stats.totalVehiclesUsed}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vehicles</span>
                </div>
                <div className="w-px h-10 bg-border/50" />
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-display font-bold text-foreground">{stats.totalStops}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deliveries</span>
                </div>
                <div className="w-px h-10 bg-border/50" />
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-display font-bold text-accent">{stats.totalChargingStops}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Charge Stops</span>
                </div>
                <div className="w-px h-10 bg-border/50" />

                {/* Dispatch Control */}
                {dispatchState === "reviewing" && (
                  <Button onClick={handleDispatch} className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/30 px-6 font-bold">
                    <PlayCircle className="w-5 h-5" />
                    Proceed & Dispatch
                  </Button>
                )}
                {dispatchState === "dispatched" && (
                  <Badge variant="outline" className="gap-1 py-1.5 px-3 text-blue-600 border-blue-300 bg-blue-50 animate-pulse">
                    <RotateCw className="w-3 h-3 animate-spin" />
                    Fleet In Transit...
                  </Badge>
                )}
                {dispatchState === "completed" && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 py-1.5 px-3 text-green-600 border-green-300 bg-green-50">
                      <CheckCircle2 className="w-3 h-3" />
                      All Completed!
                    </Badge>
                    <Button size="sm" variant="outline" onClick={handleReset} className="gap-1">
                      <RotateCw className="w-3 h-3" /> Reset
                    </Button>
                  </div>
                )}

                <Sheet open={showDetailsSheet} onOpenChange={setShowDetailsSheet}>
                  <SheetTrigger asChild>
                    <Button size="sm" variant="default" className="gap-2">
                      <Info className="w-4 h-4" />
                      Details
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className={`transition-all duration-500 ease-in-out overflow-y-auto border-l-border/50 shadow-2xl p-0 ${isDetailsMaximized ? 'w-[100vw] sm:max-w-[100vw]' : 'w-full sm:max-w-[60vw] md:max-w-[55vw] lg:max-w-[50vw]'}`}
                  >
                    <div className="flex flex-col h-full bg-slate-50/50">
                      <div className="p-6 border-b border-border/50 bg-card/95 flex items-center justify-between sticky top-0 z-50 backdrop-blur">
                        <SheetHeader className="space-y-1">
                          <SheetTitle className="text-2xl font-display font-bold">Optimization Results</SheetTitle>
                          <SheetDescription className="text-sm font-medium text-muted-foreground">
                            Deep-dive into costs, performance, and route planning
                          </SheetDescription>
                        </SheetHeader>
                        <div className="flex items-center gap-2 mr-8">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setIsDetailsMaximized(!isDetailsMaximized)}
                          >
                            <Maximize2 className={`w-4 h-4 transition-transform ${isDetailsMaximized ? 'rotate-180' : ''}`} />
                            {isDetailsMaximized ? 'Minimize' : 'Expand Full'}
                          </Button>
                        </div>
                      </div>

                      <div className="flex-1 p-6 md:p-10">

                        <Tabs defaultValue="analytics" className="w-full space-y-6">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="analytics">Analytics</TabsTrigger>
                            <TabsTrigger value="routes">Routes</TabsTrigger>
                          </TabsList>

                          <TabsContent value="analytics" className="space-y-4">
                            {responseData && (
                              <OptimizationAnalyticsDashboard
                                response={responseData}
                                materialInfo={currentRequest?.materialInfo}
                                supplyChainStage={currentRequest?.supplyChainStage}
                                isMaximized={isDetailsMaximized}
                              />
                            )}
                          </TabsContent>

                          <TabsContent value="routes" className="space-y-4">
                            {responseData && (
                              <>
                                <div className="flex items-center justify-between gap-2 mb-4">
                                  <h3 className="font-semibold">Route {selectedRouteIndex + 1} of {responseData.routes.length}</h3>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={selectedRouteIndex === 0}
                                      onClick={() => setSelectedRouteIndex(Math.max(0, selectedRouteIndex - 1))}
                                    >
                                      <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={selectedRouteIndex === responseData.routes.length - 1}
                                      onClick={() =>
                                        setSelectedRouteIndex(
                                          Math.min(responseData.routes.length - 1, selectedRouteIndex + 1)
                                        )
                                      }
                                    >
                                      <ChevronRight className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                                <RouteDetails
                                  route={responseData.routes[selectedRouteIndex]}
                                  vehicleType={currentRequest?.vehicles?.[selectedRouteIndex]?.type || "container_truck"}
                                  materialInfo={currentRequest?.materialInfo}
                                  isMaximized={isDetailsMaximized}
                                />
                              </>
                            )}
                          </TabsContent>
                        </Tabs>

                        <Button
                          onClick={handleSaveToHistory}
                          className="w-full mt-6"
                          variant="outline"
                        >
                          💾 Save to History
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </CardContent>
            </Card>

            {/* Plain English Dispatch Summary */}
            {dispatchState === "reviewing" && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-700 delay-300">
                <Card className="border-primary/50 shadow-xl bg-primary/5 border-2 max-w-2xl mx-auto">
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-primary mb-1">Fleet Dispatch Summary</h3>
                      <p className="text-sm text-foreground leading-relaxed font-medium italic">
                        "{generatePlainEnglishSummary()}"
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Fleet Status Panel */}
        {vehicleStatuses.length > 0 && (dispatchState === "reviewing" || dispatchState === "dispatched" || dispatchState === "completed") && (
          <div className="absolute top-24 right-6 z-[400] w-72 animate-in fade-in slide-in-from-right-4 duration-500">
            <Card className="border-border/50 shadow-2xl bg-card/95 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="w-4 h-4 text-primary" />
                  <h3 className="font-display font-bold text-sm">Fleet Status</h3>
                  {dispatchState === "dispatched" && (
                    <Badge variant="outline" className="text-[10px] ml-auto text-blue-600 border-blue-200 bg-blue-50">LIVE</Badge>
                  )}
                </div>
                <div className="space-y-3">
                  {vehicleStatuses.map((vehicle) => {
                    const details = getVehicleDetails(vehicle.vehicleType as any);
                    return (
                      <div key={vehicle.vehicleId} className="flex items-center gap-3 p-2 rounded-lg border border-border/50 bg-background/50">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: vehicle.color }}
                          dangerouslySetInnerHTML={{ __html: getVehicleBadgeSvg(vehicle.vehicleType) }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs truncate">V{vehicle.vehicleId}</span>
                            <span className="text-[10px] text-muted-foreground truncate">{details?.name || vehicle.vehicleType}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${statusColor(vehicle.status)}`}>
                              {vehicle.status.replace(/_/g, ' ')}
                            </span>
                            {details?.highwayRestricted && (
                              <span title="Highway restricted"><AlertTriangle className="w-3 h-3 text-amber-500" /></span>
                            )}
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1 mt-1.5">
                            <div
                              className="h-1 rounded-full transition-all duration-300 ease-out"
                              style={{ width: `${vehicle.progress}%`, backgroundColor: vehicle.color }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-muted-foreground">{vehicle.eta}</span>
                          <div className="text-[10px] font-medium text-muted-foreground">{vehicle.progress}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Map Container */}
        <div className="flex-1 w-full h-full relative isolate">
          {typeof window !== 'undefined' && (
            <MapCanvas
              requestParams={defaultMapState}
              response={responseData}
              onLocationSelect={handleLocationSelect}
              dispatchState={dispatchState}
              onAllVehiclesCompleted={handleAllVehiclesCompleted}
              onVehicleProgressUpdate={handleVehicleProgressUpdate}
            />
          )}

          {/* Legend */}
          <div className="absolute bottom-8 right-8 z-[400] bg-card p-4 rounded-xl shadow-xl border border-border/50 pointer-events-none">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Map Legend</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm font-medium">
                <div className="w-4 h-4 rounded-[4px] bg-primary border border-primary/20 flex items-center justify-center">
                  <Navigation className="w-2.5 h-2.5 text-white" />
                </div>
                Depot
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <div className="w-4 h-4 rounded-full bg-slate-500 border border-slate-500/20" />
                Delivery Stop
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <div className="w-4 h-4 rounded-full bg-accent border border-accent/20 flex items-center justify-center">
                  <Zap className="w-2.5 h-2.5 text-white" />
                </div>
                Charging Station
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <div className="w-4 h-[3px] bg-blue-500 rounded-full" />
                Vehicle Route
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <div className="w-4 h-[3px] border-b-2 border-dashed border-amber-500 rounded-full" />
                Highway Restricted
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}