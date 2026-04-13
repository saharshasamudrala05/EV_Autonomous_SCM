import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, MapPin } from "lucide-react";
import type { Location } from "@shared/schema";

interface LocationAutocompleteProps {
  value: string;
  onLocationSelect: (location: Location) => void;
  placeholder?: string;
  className?: string;
}

// Shape returned by our backend /api/geocoding endpoint.
interface GeocodingResult {
  lat: number;
  lng: number;
  address: string;
  displayName: string;
}

export default function LocationAutocomplete({
  value,
  onLocationSelect,
  placeholder = "Search location...",
  className = "",
}: LocationAutocompleteProps) {
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // ── Session-level cache ──────────────────────────────────────────────────
  // Keyed by normalised query string. Lives for the duration of the browser
  // session — avoids even the backend round-trip for repeated keystrokes.
  // The backend has its own 24-hour cross-session cache on top of this.
  const sessionCache = useRef<Map<string, GeocodingResult[]>>(new Map());

  // Normalise query the same way the backend does so cache keys align.
  const normalise = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

  // ── Debounced search ─────────────────────────────────────────────────────
  useEffect(() => {
    if (input.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const key = normalise(input);

    // 1. Session cache hit — instant, no network at all.
    const sessionHit = sessionCache.current.get(key);
    if (sessionHit) {
      setSuggestions(sessionHit);
      setIsOpen(sessionHit.length > 0);
      return;
    }

    // 2. Debounce before hitting the backend (which has its own cache).
    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);

        const res = await axios.get<{ results: GeocodingResult[]; cached: boolean }>(
          `/api/geocoding`,
          { params: { query: input, limit: 8 } }
        );

        const results = res.data.results ?? [];

        // Store in session cache regardless of whether backend served from cache.
        sessionCache.current.set(key, results);

        setSuggestions(results);
        setIsOpen(results.length > 0);
      } catch (error) {
        console.error("[LocationAutocomplete] Error:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [input]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSelect = (suggestion: GeocodingResult) => {
    const location: Location = {
      lat: suggestion.lat,
      lng: suggestion.lng,
      address: suggestion.displayName,
    };
    onLocationSelect(location);
    setInput(suggestion.displayName);
    setIsOpen(false);
  };

  const handleClear = () => {
    setInput("");
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => input.length >= 3 && setIsOpen(suggestions.length > 0)}
          placeholder={placeholder}
          className="pr-10"
          autoComplete="off"
        />
        {input ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 h-full px-2"
            onClick={handleClear}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        ) : (
          <MapPin className="absolute right-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
      </div>

      {isOpen && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {isLoading ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Loading suggestions...
            </div>
          ) : suggestions.length > 0 ? (
            <ul className="py-1">
              {suggestions.map((suggestion, index) => (
                <li key={index}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors flex items-start gap-2"
                    onClick={() => handleSelect(suggestion)}
                  >
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    <span className="text-sm">{suggestion.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-center text-sm text-muted-foreground">
              No locations found
            </div>
          )}
        </div>
      )}
    </div>
  );
}