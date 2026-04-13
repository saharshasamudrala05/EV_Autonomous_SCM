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
  FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import axios from "axios";

async function geocode(address: string) {
  const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
  if (res.data && res.data.length > 0) {
    return {
      lat: parseFloat(res.data[0].lat),
      lng: parseFloat(res.data[0].lon),
      address: res.data[0].display_name
    };
  }
  return null;
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { evProfileSchema, locationSchema, type OptimizeRequest } from "@shared/schema";
import { MapPin, Battery, Truck, Plus, Trash2, Navigation2, Zap } from "lucide-react";
import { useEffect } from "react";

// We extend the schema for the form to handle comma-separated strings for arrays of numbers
const formSchema = z.object({
  depot: locationSchema,
  destination: locationSchema.optional(),
  stops: z.array(locationSchema).min(1, "Add at least one stop"),
  vehicleCount: z.coerce.number().min(1, "Must have at least 1 vehicle"),
  vehicleCapacitiesStr: z.string().min(1, "Required"),
  demandsStr: z.string().min(1, "Required"),
  evProfile: evProfileSchema,
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  depot: { lat: 19.0760, lng: 72.8777, address: "Mumbai, Maharashtra" },
  destination: { lat: 18.5204, lng: 73.8567, address: "Pune, Maharashtra" },
  stops: [
    { lat: 19.2183, lng: 72.9781, address: "Thane, Maharashtra" },
    { lat: 18.6784, lng: 73.8997, address: "Lonavala, Maharashtra" },
  ],
  vehicleCount: 1,
  vehicleCapacitiesStr: "500",
  demandsStr: "100, 100",
  evProfile: {
    batteryCapacity_Wh: 80000,
    initialCharge_Wh: 70000,
    minChargeAtDestination_Wh: 15000,
  }
};

interface OptimizeFormProps {
  onSubmit: (data: OptimizeRequest) => void;
  isPending: boolean;
  onValuesChange: (values: OptimizeRequest) => void;
  onLocationSelectData?: { lat: number, lng: number, address: string };
}

export default function OptimizeForm({ onSubmit, isPending, onValuesChange, onLocationSelectData }: OptimizeFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "stops",
  });

  // Sync external changes (like map clicks) back to the form
  useEffect(() => {
    if (onLocationSelectData) {
      const currentStops = form.getValues("stops");
      // Check if this location is already in the form to avoid loops
      const exists = currentStops.some(s => s.lat === onLocationSelectData.lat && s.lng === onLocationSelectData.lng);
      if (!exists) {
        append(onLocationSelectData);
      }
    }
  }, [onLocationSelectData, append, form]);

  // Watch for changes to update the map live
  useEffect(() => {
    const subscription = form.watch((value) => {
      // Safely parse the current form state to pass to the map canvas
      try {
        if (value.depot?.lat && value.depot?.lng) {
          const req: OptimizeRequest = {
            depot: value.depot as { lat: number; lng: number },
            destination: value.destination as { lat: number; lng: number } | undefined,
            stops: (value.stops || []).filter(s => s && s.lat && s.lng) as { lat: number; lng: number }[],
            vehicleCount: Number(value.vehicleCount) || 1,
            vehicleCapacities: (value.vehicleCapacitiesStr || "0").split(',').map(n => Number(n.trim())),
            demands: (value.demandsStr || "0").split(',').map(n => Number(n.trim())),
            evProfile: {
              batteryCapacity_Wh: Number(value.evProfile?.batteryCapacity_Wh) || 50000,
              initialCharge_Wh: Number(value.evProfile?.initialCharge_Wh) || 40000,
              minChargeAtDestination_Wh: Number(value.evProfile?.minChargeAtDestination_Wh) || 10000,
            }
          };
          onValuesChange(req);
        }
      } catch (e) {
        // Ignore partial/invalid states while typing
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch, onValuesChange]);

  const handleSubmit = (data: FormValues) => {
    // Transform string inputs to number arrays
    const requestData: OptimizeRequest = {
      depot: data.depot,
      destination: data.destination,
      stops: data.stops,
      vehicleCount: data.vehicleCount,
      vehicleCapacities: data.vehicleCapacitiesStr.split(',').map(n => Number(n.trim())),
      demands: data.demandsStr.split(',').map(n => Number(n.trim())),
      evProfile: data.evProfile,
    };
    
    onSubmit(requestData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-4 pb-12">
          
          <Accordion type="multiple" defaultValue={["locations", "fleet"]} className="w-full">
            
            {/* LOCATIONS */}
            <AccordionItem value="locations" className="border-border/50">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 font-display text-lg">
                  <Navigation2 className="w-5 h-5 text-primary" />
                  Locations
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <Card className="shadow-none border-border/50 bg-background/50">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      Starting Point  
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div className="flex gap-2">
                      <FormField
                        control={form.control}
                        name="depot.address"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder="Search location..." {...field} onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const result = await geocode(field.value || "");
                                  if (result) {
                                    form.setValue("depot.lat", result.lat);
                                    form.setValue("depot.lng", result.lng);
                                    form.setValue("depot.address", result.address);
                                  }
                                }
                              }} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button type="button" size="icon" variant="outline" className="shrink-0" onClick={async () => {
                        const addr = form.getValues("depot.address");
                        const result = await geocode(addr || "");
                        if (result) {
                          form.setValue("depot.lat", result.lat);
                          form.setValue("depot.lng", result.lng);
                          form.setValue("depot.address", result.address);
                        }
                      }}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="depot.lat"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Latitude</FormLabel>
                            <FormControl>
                              <Input type="number" step="any" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="h-8 bg-background" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="depot.lng"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Longitude</FormLabel>
                            <FormControl>
                              <Input type="number" step="any" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="h-8 bg-background" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-none border-border/50 bg-background/50">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      Ending Point
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div className="flex gap-2">
                      <FormField
                        control={form.control}
                        name="destination.address"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder="Search destination..." {...field} onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const result = await geocode(field.value || "");
                                  if (result) {
                                    form.setValue("destination.lat", result.lat);
                                    form.setValue("destination.lng", result.lng);
                                    form.setValue("destination.address", result.address);
                                  }
                                }
                              }} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button type="button" size="icon" variant="outline" className="shrink-0" onClick={async () => {
                        const addr = form.getValues("destination.address");
                        const result = await geocode(addr || "");
                        if (result) {
                          form.setValue("destination.lat", result.lat);
                          form.setValue("destination.lng", result.lng);
                          form.setValue("destination.address", result.address);
                        }
                      }}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="destination.lat"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Latitude</FormLabel>
                            <FormControl>
                              <Input type="number" step="any" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="h-8 bg-background" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="destination.lng"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Longitude</FormLabel>
                            <FormControl>
                              <Input type="number" step="any" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="h-8 bg-background" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      Delivery Stops
                    </span>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => append({ lat: 19.0, lng: 73.0, address: "" })}
                      className="h-7 text-xs px-2"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Stop
                    </Button>
                  </div>
                  
                  {fields.map((field, index) => (
                    <div key={field.id} className="space-y-2 p-3 border rounded-lg bg-background/50 group">
                      <div className="flex gap-2">
                        <FormField
                          control={form.control}
                          name={`stops.${index}.address`}
                          render={({ field: f }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input placeholder="Search stop location..." {...f} onKeyDown={async (e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const result = await geocode(f.value || "");
                                    if (result) {
                                      form.setValue(`stops.${index}.lat`, result.lat);
                                      form.setValue(`stops.${index}.lng`, result.lng);
                                      form.setValue(`stops.${index}.address`, result.address);
                                    }
                                  }
                                }} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <Button type="button" size="icon" variant="outline" className="shrink-0" onClick={async () => {
                          const addr = form.getValues(`stops.${index}.address`);
                          const result = await geocode(addr || "");
                          if (result) {
                            form.setValue(`stops.${index}.lat`, result.lat);
                            form.setValue(`stops.${index}.lng`, result.lng);
                            form.setValue(`stops.${index}.address`, result.address);
                          }
                        }}>
                          <Search className="h-4 w-4" />
                        </Button>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name={`stops.${index}.lat`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Input type="number" step="any" {...f} onChange={e => f.onChange(parseFloat(e.target.value))} className="h-8 text-sm" placeholder="Lat" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`stops.${index}.lng`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Input type="number" step="any" {...f} onChange={e => f.onChange(parseFloat(e.target.value))} className="h-8 text-sm" placeholder="Lng" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                  <FormMessage>{form.formState.errors.stops?.message}</FormMessage>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* FLEET CONFIG */}
            <AccordionItem value="fleet" className="border-border/50">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 font-display text-lg">
                  <Truck className="w-5 h-5 text-primary" />
                  Fleet Configuration
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vehicleCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicles</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="bg-background" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vehicleCapacitiesStr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacities (comma sep)</FormLabel>
                        <FormControl>
                          <Input placeholder="500, 500" {...field} className="bg-background" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="demandsStr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stop Demands (comma sep)</FormLabel>
                      <FormControl>
                        <Input placeholder="100, 200, 150" {...field} className="bg-background" />
                      </FormControl>
                      <FormDescription className="text-xs">Must match the number of stops.</FormDescription>
                    </FormItem>
                  )}
                />
              </AccordionContent>
            </AccordionItem>

            {/* EV PROFILE */}
            <AccordionItem value="ev" className="border-border/50">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 font-display text-lg">
                  <Battery className="w-5 h-5 text-accent" />
                  EV Profile
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="evProfile.batteryCapacity_Wh"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex justify-between">
                        Capacity (Wh) <span className="text-muted-foreground text-xs font-normal">Max storage</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="bg-background" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="evProfile.initialCharge_Wh"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Initial Charge</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="bg-background h-8 text-sm" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="evProfile.minChargeAtDestination_Wh"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Min Reserve</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} className="bg-background h-8 text-sm" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>

        <div className="pt-4 border-t mt-auto shrink-0 bg-card/80 backdrop-blur pb-4">
          <Button 
            type="submit" 
            className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-primary/25 transition-all" 
            disabled={isPending}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                Optimizing Routes...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Generate Optimized Plan
              </span>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
