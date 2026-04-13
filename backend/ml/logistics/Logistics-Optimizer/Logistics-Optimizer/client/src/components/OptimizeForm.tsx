import React, { useEffect, useMemo, useCallback, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LocationAutocomplete from "./LocationAutocomplete";
import {
  locationSchema,
  evProfileSchema,
  supplyChainStageEnum,
  materialTypeEnum,
  MATERIAL_UNIT_MAP,
  type OptimizeRequest,
  type VehicleType,
  type MaterialType,
} from "@shared/schema";
import {
  recommendVehicles,
  getVehicleDetails,
  getLastMileVehicles,
} from "@shared/vehicleRecommender";
import {
  MapPin,
  Battery,
  Truck,
  Plus,
  Trash2,
  Navigation2,
  Zap,
  AlertCircle,
  Factory,
  Weight,
  Warehouse,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ── Form schema ───────────────────────────────────────────────────────────────
// trafficLevel removed — traffic is now fetched live from TomTom on the backend.
// Users should never have to guess what the traffic is like.
const formSchema = z.object({
  depot: locationSchema.optional(),
  destination: locationSchema.optional(),
  stops: z
    .array(
      z.object({
        lat: z.number({ invalid_type_error: "Enter a valid latitude" }),
        lng: z.number({ invalid_type_error: "Enter a valid longitude" }),
        address: z.string().optional(),
        // FIX: min(0) keeps 0 valid for waypoints, but default is now 1
        // so that new stops are always included in routing by default.
        demand: z.coerce.number().min(0).default(1),
      })
    )
    .min(1, "Add at least one delivery stop"),
  vehicles: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        startLocation: locationSchema,
        capacityUnits: z.coerce.number().min(1, "Must be at least 1"),
        depotName: z.string().optional(),
      })
    )
    .min(1, "Add at least one vehicle"),
  evProfile: evProfileSchema,
  supplyChainStage: supplyChainStageEnum.optional(),
  materialType: materialTypeEnum.optional(),
  materialWeight: z.coerce.number().optional(),
  isHazmat: z.boolean().default(false),
  requiresSealing: z.boolean().default(false),
  timeWindowStart: z.string().optional(),
  timeWindowEnd: z.string().optional(),
  chargingStationRequired: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

// ── Static option lists ───────────────────────────────────────────────────────
const LAST_MILE_VEHICLES = getLastMileVehicles();

const MATERIAL_OPTIONS = [
  { value: "ev_vehicle", label: "EV Vehicle" },
  { value: "battery_pack", label: "Battery Pack" },
  { value: "generic_cargo", label: "Generic Cargo" },
  { value: "lithium_ore", label: "Lithium Ore" },
  { value: "cobalt_ore", label: "Cobalt Ore" },
  { value: "battery_cells", label: "Battery Cells" },
  { value: "motor", label: "Motor" },
  { value: "electronics", label: "Electronics" },
];

const SUPPLY_CHAIN_OPTIONS = [
  { value: "ev_distribution", label: "Finished EV Distribution" },
  { value: "ev_long_distance", label: "Long Distance EV Distribution" },
  { value: "mining", label: "Mining / Raw Material" },
  { value: "mine_to_refinery", label: "Mine → Refinery" },
  { value: "refinery_to_battery_plant", label: "Refinery → Battery Plant" },
  { value: "component_to_ev_assembly", label: "Component → EV Assembly" },
  { value: "ev_assembly_internal", label: "EV Assembly (Internal)" },
  { value: "ev_international_shipping", label: "International Shipping" },
];

// ── Fully empty defaults ──────────────────────────────────────────────────────
// FIX: First default stop now has demand=1 so it is picked up by the solver.
const defaultValues: FormValues = {
  depot: undefined,
  destination: undefined,
  stops: [{ lat: 0, lng: 0, address: "", demand: 1 }],
  vehicles: [
    {
      id: "v1",
      type: "container_truck",
      startLocation: { lat: 0, lng: 0, address: "" },
      capacityUnits: 50,
      depotName: "",
    },
  ],
  evProfile: {
    batteryCapacity_Wh: 50000,
    initialCharge_Wh: 40000,
    minChargeAtDestination_Wh: 10000,
    batteryCapacityKwh: 100,
    currentSocPercent: 100,
    minReturnSocPercent: 20,
    consumptionKwhPer100km: 20,
  },
  materialType: undefined,
  materialWeight: undefined,
  isHazmat: false,
  requiresSealing: false,
  chargingStationRequired: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function capacityLabel(materialType: MaterialType | undefined): string {
  if (!materialType) return "units";
  return MATERIAL_UNIT_MAP[materialType] ?? "units";
}

function hasValidCoords(loc: { lat?: number; lng?: number } | undefined): boolean {
  return (
    loc !== undefined &&
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    loc.lat !== 0 &&
    loc.lng !== 0
  );
}

// ── Depot status badge ────────────────────────────────────────────────────────
function DepotStatusBadgeBase({ busy }: { busy: boolean }) {
  if (busy) {
    return (
      <Badge variant="outline"
        className="text-[10px] gap-1 border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300">
        <XCircle className="w-3 h-3" /> In Transit
      </Badge>
    );
  }
  return (
    <Badge variant="outline"
      className="text-[10px] gap-1 border-green-400 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300">
      <CheckCircle2 className="w-3 h-3" /> Available
    </Badge>
  );
}
const DepotStatusBadge = React.memo(DepotStatusBadgeBase);
DepotStatusBadge.displayName = "DepotStatusBadge";

// ── Per-vehicle card ──────────────────────────────────────────────────────────
interface VehicleCardProps {
  vehicle: { id: string };
  index: number;
  unitLabel: string;
  isPending: boolean;
  canRemove: boolean;
  onRemove: (index: number) => void;
  form: ReturnType<typeof useForm<FormValues>>;
}

const VehicleCard = React.memo(function VehicleCard({
  vehicle, index, unitLabel, isPending, canRemove, onRemove, form,
}: VehicleCardProps) {
  const vtype = form.watch(`vehicles.${index}.type`);
  const depotName = form.watch(`vehicles.${index}.depotName`);
  const spec = useMemo(() => getVehicleDetails(vtype as any), [vtype]);

  return (
    <div className="relative p-4 border border-border/60 rounded-xl bg-card/50 shadow-sm space-y-3 group">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <Truck className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm font-semibold">
            Vehicle {index + 1}
            {depotName && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                — {depotName}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DepotStatusBadge busy={isPending} />
          {canRemove && (
            <Button type="button" variant="ghost" size="sm"
              className="h-7 px-2 text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(index)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Depot name */}
      <FormField control={form.control} name={`vehicles.${index}.depotName`}
        render={({ field: f }) => (
          <FormItem>
            <FormLabel className="text-xs flex items-center gap-1">
              <Warehouse className="w-3 h-3" /> Depot / Warehouse Name
            </FormLabel>
            <FormControl>
              <Input {...f} value={f.value ?? ""} className="h-8 bg-background text-xs"
                placeholder="e.g. North Warehouse" />
            </FormControl>
          </FormItem>
        )} />

      {/* Type + capacity */}
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name={`vehicles.${index}.type`}
          render={({ field: f }) => (
            <FormItem>
              <FormLabel className="text-xs">Vehicle Type</FormLabel>
              <Select onValueChange={f.onChange} defaultValue={f.value}>
                <FormControl>
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {LAST_MILE_VEHICLES.map((vt) => (
                    <SelectItem key={vt} value={vt} className="text-xs capitalize">
                      {vt.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )} />

        <FormField control={form.control} name={`vehicles.${index}.capacityUnits`}
          render={({ field: f }) => (
            <FormItem>
              <FormLabel className="text-xs">Capacity ({unitLabel})</FormLabel>
              <FormControl>
                <Input type="number" step="1" min="1" {...f} value={f.value ?? ""}
                  className="bg-background text-xs h-9" placeholder="e.g. 50" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
      </div>

      {/* Depot location */}
      <FormField control={form.control} name={`vehicles.${index}.startLocation`}
        render={({ field: f }) => (
          <FormItem>
            <FormLabel className="text-xs flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Depot Location
            </FormLabel>
            <FormControl>
              <LocationAutocomplete
                placeholder="Search or enter depot address…"
                onLocationSelect={(loc) =>
                  f.onChange({ lat: loc.lat, lng: loc.lng, address: loc.address || "" })
                }
                value={f.value?.address || ""}
              />
            </FormControl>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input
                type="number" step="any"
                placeholder="Latitude"
                value={f.value?.lat || ""}
                onChange={(e) =>
                  f.onChange({ ...f.value, lat: parseFloat(e.target.value) || 0 })
                }
                className="h-8 text-xs bg-background"
              />
              <Input
                type="number" step="any"
                placeholder="Longitude"
                value={f.value?.lng || ""}
                onChange={(e) =>
                  f.onChange({ ...f.value, lng: parseFloat(e.target.value) || 0 })
                }
                className="h-8 text-xs bg-background"
              />
            </div>
            <FormMessage />
          </FormItem>
        )} />

      {/* Highway restriction warning */}
      {spec?.highwayRestricted && (
        <div className="flex items-start gap-1 p-1.5 rounded bg-amber-50 text-amber-700 text-[10px] leading-tight border border-amber-200 dark:bg-amber-950 dark:text-amber-300">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>Restricted from highways. Routes will avoid expressways.</span>
        </div>
      )}
    </div>
  );
});

// ── Props ─────────────────────────────────────────────────────────────────────
interface OptimizeFormProps {
  onSubmit: (data: OptimizeRequest) => void;
  isPending: boolean;
  onValuesChange: (values: OptimizeRequest) => void;
  onLocationSelectData?: { lat: number; lng: number; address: string };
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function OptimizeForm({
  onSubmit,
  isPending,
  onValuesChange,
  onLocationSelectData,
}: OptimizeFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: "onChange",
  });

  const { fields: stopFields, append: appendStop, remove: removeStop } =
    useFieldArray({ control: form.control, name: "stops" });

  const { fields: vehicleFields, append: appendVehicle, remove: removeVehicle } =
    useFieldArray({ control: form.control, name: "vehicles" });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const stage = form.watch("supplyChainStage");
  const materialType = form.watch("materialType");
  const materialWeight = form.watch("materialWeight");
  const isHazmat = form.watch("isHazmat");
  const requiresSealing = form.watch("requiresSealing");
  const watchedStops = form.watch("stops");
  const watchedVehicles = form.watch("vehicles");

  const unitLabel = useMemo(
    () => capacityLabel(materialType as MaterialType | undefined),
    [materialType]
  );

  const { totalDemand, totalCapacity, capacityShortfall } = useMemo(() => {
    const demand = watchedStops.reduce((s, st) => s + (Number(st?.demand) || 0), 0);
    const capacity = watchedVehicles.reduce((s, v) => s + (Number(v?.capacityUnits) || 0), 0);
    return { totalDemand: demand, totalCapacity: capacity, capacityShortfall: demand > capacity };
  }, [watchedStops, watchedVehicles]);

  const recommendedVehicles = useMemo(() => {
    if (!stage && !materialType) return [];
    return recommendVehicles(
      stage,
      materialType
        ? { materialType: materialType as MaterialType, weightTons: materialWeight || 0, isHazmat, requiresRefrigeration: false, requiresSealing }
        : undefined
    );
  }, [stage, materialType, materialWeight, isHazmat, requiresSealing]);

  // FIX: When a location is selected via the map picker, default demand to 1
  // so the stop is not silently dropped by the solver.
  useEffect(() => {
    if (!onLocationSelectData) return;
    const current = form.getValues("stops");
    const exists = current.some(
      (s) => s?.lat === onLocationSelectData.lat && s?.lng === onLocationSelectData.lng
    );
    if (!exists) appendStop({ ...onLocationSelectData, demand: 1 });
  }, [onLocationSelectData, appendStop, form]);

  const buildRequest = useCallback((): OptimizeRequest | null => {
    const v = form.getValues();
    const stops = (v.stops ?? []).filter((s) => hasValidCoords(s));
    if (!stops.length) return null;

    return {
      depot: hasValidCoords(v.depot) ? v.depot : undefined,
      destination: hasValidCoords(v.destination) ? v.destination : undefined,
      stops,
      vehicles: (v.vehicles ?? [])
        .filter((vh) => hasValidCoords(vh?.startLocation))
        .map((vh) => ({
          id: vh?.id ?? "",
          type: (vh?.type as VehicleType) ?? "container_truck",
          startLocation: vh?.startLocation as { lat: number; lng: number },
          capacityUnits: Number(vh?.capacityUnits) || 1,
          depotName: vh?.depotName,
        })),
      // FIX: Preserve the actual demand value. Fall back to 1 (not 0) so that
      // stops added programmatically without an explicit demand are still routed.
      demands: stops.map((s) => Number(s?.demand) ?? 1),
      evProfile: {
        batteryCapacity_Wh: Number(v.evProfile?.batteryCapacity_Wh) || 50000,
        initialCharge_Wh: Number(v.evProfile?.initialCharge_Wh) || 40000,
        minChargeAtDestination_Wh: Number(v.evProfile?.minChargeAtDestination_Wh) || 10000,
        batteryCapacityKwh: Number(v.evProfile?.batteryCapacityKwh) || 100,
        currentSocPercent: Number(v.evProfile?.currentSocPercent) || 100,
        minReturnSocPercent: Number(v.evProfile?.minReturnSocPercent) || 20,
        consumptionKwhPer100km: Number(v.evProfile?.consumptionKwhPer100km) || 20,
      },
      supplyChainStage: v.supplyChainStage,
      vehicleTypes: (v.vehicles ?? []).map((vh) => vh?.type as VehicleType),
      materialInfo: v.materialType
        ? {
          materialType: v.materialType as MaterialType,
          weightTons: v.materialWeight || 0,
          isHazmat: v.isHazmat || false,
          requiresRefrigeration: false,
          requiresSealing: v.requiresSealing || false,
        }
        : undefined,
      constraints: {
        timeWindowStart: v.timeWindowStart,
        timeWindowEnd: v.timeWindowEnd,
        // trafficLevel intentionally omitted — fetched live from TomTom
        chargingStationRequired: v.chargingStationRequired || false,
        roadType: ["highway", "state_road", "local_road"],
      },
    };
  }, [form]);

  useEffect(() => {
    const sub = form.watch(() => {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        try {
          const req = buildRequest();
          if (req) onValuesChange(req);
        } catch { /* ignore partial states */ }
      }, 500);
    });
    return () => {
      sub.unsubscribe();
      clearTimeout(debounceTimerRef.current);
    };
  }, [form, onValuesChange, buildRequest]);

  const handleSubmit = useCallback((data: FormValues) => {
    const validStops = data.stops.filter((s) => hasValidCoords(s));
    const validVehicles = data.vehicles
      .filter((v) => hasValidCoords(v?.startLocation))
      .map((v) => ({
        id: v.id,
        type: v.type as VehicleType,
        startLocation: v.startLocation,
        capacityUnits: Number(v.capacityUnits),
        depotName: v.depotName,
      }));

    if (!validStops.length) {
      form.setError("stops", { message: "At least one stop with valid coordinates is required." });
      return;
    }
    if (!validVehicles.length) {
      form.setError("vehicles", { message: "At least one vehicle with a valid depot location is required." });
      return;
    }

    onSubmit({
      depot: hasValidCoords(data.depot) ? data.depot : undefined,
      destination: hasValidCoords(data.destination) ? data.destination : undefined,
      stops: validStops,
      vehicles: validVehicles,
      // FIX: Same fallback as buildRequest — use 1 not 0 to avoid silent drops.
      demands: validStops.map((s) => Number(s.demand) ?? 1),
      evProfile: data.evProfile,
      supplyChainStage: data.supplyChainStage,
      vehicleTypes: validVehicles.map((v) => v.type as VehicleType),
      materialInfo: data.materialType
        ? {
          materialType: data.materialType as MaterialType,
          weightTons: data.materialWeight || 0,
          unit: MATERIAL_UNIT_MAP[data.materialType] ?? "units",
          isHazmat: data.isHazmat,
          requiresRefrigeration: false,
          requiresSealing: data.requiresSealing,
        }
        : undefined,
      constraints: {
        timeWindowStart: data.timeWindowStart,
        timeWindowEnd: data.timeWindowEnd,
        // trafficLevel intentionally omitted — fetched live from TomTom
        chargingStationRequired: data.chargingStationRequired || false,
        roadType: ["highway", "state_road", "local_road"],
      },
    });
  }, [onSubmit, form]);

  const handleRemoveVehicle = useCallback(
    (index: number) => removeVehicle(index),
    [removeVehicle]
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-4 pb-12">
          <Accordion type="multiple" defaultValue={["locations", "fleet"]} className="w-full">

            {/* ── LOCATIONS ─────────────────────────────────────────────────── */}
            <AccordionItem value="locations" className="border-border/50">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 font-display text-lg">
                  <Navigation2 className="w-5 h-5 text-primary" /> Locations
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">

                <Card className="shadow-none border-border/50 bg-background/50">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      Starting Point (fallback depot)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2">
                    <FormField control={form.control} name="depot.address"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <LocationAutocomplete
                              value={field.value || ""}
                              onLocationSelect={(loc) => {
                                form.setValue("depot.lat", loc.lat);
                                form.setValue("depot.lng", loc.lng);
                                form.setValue("depot.address", loc.address || "");
                              }}
                              placeholder="Search starting location…"
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                    <div className="grid grid-cols-2 gap-2">
                      <FormField control={form.control} name="depot.lat"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Latitude</FormLabel>
                            <FormControl>
                              <Input type="number" step="any" placeholder="e.g. 17.385"
                                {...field} value={field.value ?? ""}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                                className="h-8 bg-background text-xs" />
                            </FormControl>
                          </FormItem>
                        )} />
                      <FormField control={form.control} name="depot.lng"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Longitude</FormLabel>
                            <FormControl>
                              <Input type="number" step="any" placeholder="e.g. 78.487"
                                {...field} value={field.value ?? ""}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                                className="h-8 bg-background text-xs" />
                            </FormControl>
                          </FormItem>
                        )} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-none border-border/50 bg-background/50">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      Ending Point (destination)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2">
                    <FormField control={form.control} name="destination.address"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <LocationAutocomplete
                              value={field.value || ""}
                              onLocationSelect={(loc) => {
                                form.setValue("destination.lat", loc.lat);
                                form.setValue("destination.lng", loc.lng);
                                form.setValue("destination.address", loc.address || "");
                              }}
                              placeholder="Search ending location…"
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                    <div className="grid grid-cols-2 gap-2">
                      <FormField control={form.control} name="destination.lat"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Latitude</FormLabel>
                            <FormControl>
                              <Input type="number" step="any" placeholder="e.g. 17.428"
                                {...field} value={field.value ?? ""}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                                className="h-8 bg-background text-xs" />
                            </FormControl>
                          </FormItem>
                        )} />
                      <FormField control={form.control} name="destination.lng"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Longitude</FormLabel>
                            <FormControl>
                              <Input type="number" step="any" placeholder="e.g. 78.552"
                                {...field} value={field.value ?? ""}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                                className="h-8 bg-background text-xs" />
                            </FormControl>
                          </FormItem>
                        )} />
                    </div>
                  </CardContent>
                </Card>

                {/* ── Delivery Stops ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      Delivery Stops
                    </span>
                    {/* FIX: New stops default to demand=1 so they are always routed. */}
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => appendStop({ lat: 0, lng: 0, address: "", demand: 1 })}
                      className="h-7 text-xs px-2">
                      <Plus className="w-3 h-3 mr-1" /> Add Stop
                    </Button>
                  </div>

                  {(totalDemand > 0 || totalCapacity > 0) && (
                    <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium ${capacityShortfall
                      ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300"
                      : "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300"
                      }`}>
                      <span>Demand: <strong>{totalDemand}</strong> {unitLabel}</span>
                      <span>Capacity: <strong>{totalCapacity}</strong> {unitLabel}</span>
                      {capacityShortfall && (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Shortfall: {totalDemand - totalCapacity}
                        </span>
                      )}
                    </div>
                  )}

                  {stopFields.map((field, index) => (
                    <div key={field.id} className="space-y-2 p-3 border rounded-lg bg-background/50 group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          Stop {index + 1}
                        </span>
                        <Button type="button" variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeStop(index)}
                          disabled={stopFields.length === 1}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <FormField control={form.control} name={`stops.${index}.address`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormControl>
                              <LocationAutocomplete
                                value={f.value || ""}
                                onLocationSelect={(loc) => {
                                  form.setValue(`stops.${index}.lat`, loc.lat);
                                  form.setValue(`stops.${index}.lng`, loc.lng);
                                  form.setValue(`stops.${index}.address`, loc.address || "");
                                }}
                                placeholder={`Search stop ${index + 1} address…`}
                              />
                            </FormControl>
                          </FormItem>
                        )} />

                      <div className="grid grid-cols-3 gap-2">
                        <FormField control={form.control} name={`stops.${index}.lat`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel className="text-[10px]">Latitude</FormLabel>
                              <FormControl>
                                <Input type="number" step="any" placeholder="Lat"
                                  {...f} value={f.value || ""}
                                  onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs" />
                              </FormControl>
                            </FormItem>
                          )} />
                        <FormField control={form.control} name={`stops.${index}.lng`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel className="text-[10px]">Longitude</FormLabel>
                              <FormControl>
                                <Input type="number" step="any" placeholder="Lng"
                                  {...f} value={f.value || ""}
                                  onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs" />
                              </FormControl>
                            </FormItem>
                          )} />
                        <FormField control={form.control} name={`stops.${index}.demand`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel className="text-[10px]">
                                Qty ({unitLabel || "units"})
                              </FormLabel>
                              <FormControl>
                                {/* FIX: placeholder now shows "1" (new default) not "0" */}
                                <Input type="number" step="1" min="0" placeholder="1"
                                  {...f} value={f.value ?? ""}
                                  onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs" />
                              </FormControl>
                            </FormItem>
                          )} />
                      </div>
                    </div>
                  ))}
                  <FormMessage>{form.formState.errors.stops?.message}</FormMessage>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ── FLEET & DEPOTS ─────────────────────────────────────────────── */}
            <AccordionItem value="fleet" className="border-border/50">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 font-display text-lg">
                  <Truck className="w-5 h-5 text-primary" /> Fleet & Depots
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">

                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  <span>
                    <strong>{vehicleFields.length}</strong> vehicle{vehicleFields.length !== 1 ? "s" : ""}
                  </span>
                  <span>
                    Capacity: <strong>{totalCapacity} {unitLabel}</strong>
                  </span>
                  <span>
                    {isPending
                      ? <Badge variant="secondary" className="text-[10px]">Optimizing…</Badge>
                      : <Badge variant="outline" className="text-[10px] text-green-600 border-green-400">Ready</Badge>
                    }
                  </span>
                </div>

                {vehicleFields.map((field, index) => (
                  <VehicleCard
                    key={field.id}
                    vehicle={field}
                    index={index}
                    unitLabel={unitLabel}
                    isPending={isPending}
                    canRemove={vehicleFields.length > 1}
                    onRemove={handleRemoveVehicle}
                    form={form}
                  />
                ))}

                <Button type="button" variant="outline" size="sm"
                  className="w-full mt-2 border-dashed bg-background/50 text-muted-foreground hover:text-primary hover:border-primary/50"
                  onClick={() => appendVehicle({
                    id: `v${Date.now()}`,
                    type: "container_truck",
                    startLocation: { lat: 0, lng: 0, address: "" },
                    capacityUnits: 50,
                    depotName: "",
                  })}>
                  <Plus className="w-4 h-4 mr-2" /> Add Vehicle / Depot
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* ── SUPPLY CHAIN & MATERIAL ───────────────────────────────────── */}
            <AccordionItem value="supply-chain" className="border-border/50">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 font-display text-lg">
                  <Factory className="w-5 h-5 text-primary" /> Supply Chain & Material
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">

                <FormField control={form.control} name="supplyChainStage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supply Chain Stage</FormLabel>
                      <Select value={field.value || ""} onValueChange={(v) => field.onChange(v || undefined)}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select a stage…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SUPPLY_CHAIN_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                <FormField control={form.control} name="materialType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Material Type</FormLabel>
                      <Select value={field.value || ""} onValueChange={(v) => field.onChange(v || undefined)}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select material…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MATERIAL_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                <FormField control={form.control} name="materialWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Weight className="w-4 h-4" /> Total Quantity ({unitLabel})
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="1" placeholder="e.g. 500"
                          {...field} value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          className="bg-background" />
                      </FormControl>
                    </FormItem>
                  )} />

                <div className="space-y-3 p-3 border rounded-lg bg-background/50">
                  <FormField control={form.control} name="isHazmat"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="text-sm font-normal cursor-pointer flex-1">
                          <span className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-destructive" /> Hazardous Material
                          </span>
                        </FormLabel>
                      </FormItem>
                    )} />
                  <FormField control={form.control} name="requiresSealing"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="text-sm font-normal cursor-pointer flex-1">
                          Requires Sealed Container
                        </FormLabel>
                      </FormItem>
                    )} />
                </div>

                {recommendedVehicles.length > 0 && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="p-4 pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Truck className="w-4 h-4 text-primary" /> Recommended Vehicles
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex flex-wrap gap-2">
                        {recommendedVehicles.map((vehicle) => {
                          const spec = getVehicleDetails(vehicle);
                          return (
                            <div key={vehicle} className="flex flex-col gap-1 flex-1 min-w-[160px] p-2 rounded bg-card border border-border/50">
                              <Badge variant="outline" className="w-fit">{spec.name}</Badge>
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                <div>Capacity: {spec.minCapacityTons}–{spec.maxCapacityTons} tons</div>
                                <div>Speed: {spec.avgSpeedKmh} km/h</div>
                                <div>{spec.hazmatCapable ? "✓ Hazmat capable" : "✗ Not hazmat"}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* ── CONSTRAINTS ───────────────────────────────────────────────── */}
            <AccordionItem value="constraints" className="border-border/50">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 font-display text-lg">
                  <AlertCircle className="w-5 h-5 text-amber-500" /> Constraints & Preferences
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">

                {/* Live traffic notice */}
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                  <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
                  <span>
                    Traffic conditions are fetched automatically in real time — no manual input needed.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="timeWindowStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time Window Start</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} className="bg-background" />
                        </FormControl>
                      </FormItem>
                    )} />
                  <FormField control={form.control} name="timeWindowEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time Window End</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} className="bg-background" />
                        </FormControl>
                      </FormItem>
                    )} />
                </div>

                <FormField control={form.control} name="chargingStationRequired"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="text-sm font-normal cursor-pointer flex-1">
                        <span className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-accent" /> Charging Stations Must Be Available
                        </span>
                      </FormLabel>
                    </FormItem>
                  )} />
              </AccordionContent>
            </AccordionItem>

            {/* ── EV PROFILE ────────────────────────────────────────────────── */}
            <AccordionItem value="ev" className="border-border/50">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 font-display text-lg">
                  <Battery className="w-5 h-5 text-accent" /> EV Profile
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <FormField control={form.control} name="evProfile.batteryCapacityKwh"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Battery Capacity (kWh)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          className="bg-background" />
                      </FormControl>
                    </FormItem>
                  )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="evProfile.currentSocPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Current SOC (%)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max="100" {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            className="bg-background h-8 text-sm" />
                        </FormControl>
                      </FormItem>
                    )} />
                  <FormField control={form.control} name="evProfile.minReturnSocPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Min Return SOC (%)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max="100" {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            className="bg-background h-8 text-sm" />
                        </FormControl>
                      </FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="evProfile.consumptionKwhPer100km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Consumption (kWh / 100 km)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          className="bg-background h-8 text-sm" />
                      </FormControl>
                    </FormItem>
                  )} />
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>

        {/* ── Submit ─────────────────────────────────────────────────────────── */}
        <div className="pt-4 border-t mt-auto shrink-0 bg-card/80 backdrop-blur pb-4">
          {capacityShortfall && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Fleet capacity ({totalCapacity}) is less than total demand ({totalDemand}).
            </p>
          )}
          <Button type="submit"
            className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-primary/25 transition-all"
            disabled={isPending || capacityShortfall}>
            {isPending ? "Optimizing…" : "Optimize Routes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}