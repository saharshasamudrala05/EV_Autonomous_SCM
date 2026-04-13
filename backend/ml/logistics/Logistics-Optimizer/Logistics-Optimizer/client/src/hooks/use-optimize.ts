import { useMutation } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { OptimizeRequest, OptimizeResponse } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

export function useOptimizeRoute() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: OptimizeRequest) => {
      // Validate input before sending to catch issues early
      const validatedInput = api.optimization.optimize.input.parse(data);

      const res = await fetch(api.optimization.optimize.path, {
        method: api.optimization.optimize.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedInput),
        credentials: "include",
      });

      if (!res.ok) {
        let errorMessage = "Optimization failed";
        try {
          const errorData = await res.json();
          if (errorData.message) errorMessage = errorData.message;
        } catch {
          // ignore parsing error
        }
        throw new Error(errorMessage);
      }

      const rawData = await res.json();
      return api.optimization.optimize.responses[200].parse(rawData);
    },
    onError: (error) => {
      toast({
        title: "Optimization Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Optimization Complete",
        description: "Successfully calculated optimal EV routes.",
      });
    },
  });
}
