import { z } from "zod";
import {
  optimizeRequestSchema,
  optimizeResponseSchema,
  geocodingRequestSchema,
  geocodingResponseSchema,
  reverseGeocodingRequestSchema,
  reverseGeocodingResponseSchema,
} from "./schema";

export const api = {
  optimization: {
    optimize: {
      method: "POST" as const,
      path: "/api/optimize" as const,
      input: optimizeRequestSchema,
      responses: {
        200: optimizeResponseSchema,
        500: z.object({ message: z.string() }),
      },
    },
  },

  geocoding: {
    forward: {
      method: "GET" as const,
      path: "/api/geocoding" as const,
      input: geocodingRequestSchema,
      responses: {
        200: geocodingResponseSchema,
        400: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    reverse: {
      method: "GET" as const,
      path: "/api/reverse-geocoding" as const,
      input: reverseGeocodingRequestSchema,
      responses: {
        200: reverseGeocodingResponseSchema,
        400: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
  },
};

export function buildUrl(
  path: string,
  params?: Record<string, string | number>
): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}