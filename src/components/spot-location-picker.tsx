"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Search } from "lucide-react";
import {
  DEFAULT_MAP_RADIUS_KM,
  MAP_RADIUS_PRESETS,
  MAX_MAP_RADIUS_KM,
  MIN_MAP_RADIUS_KM,
} from "@/lib/geo";
import "leaflet/dist/leaflet.css";

interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
}

interface SpotLocationPickerProps {
  defaultLatitude?: number;
  defaultLongitude?: number;
  defaultRadiusKm?: number;
  latitudeError?: string;
  longitudeError?: string;
}

const DEFAULT_CENTER = { lat: 20, lng: -30 };
const DEFAULT_ZOOM = 2;

export function SpotLocationPicker({
  defaultLatitude,
  defaultLongitude,
  defaultRadiusKm,
  latitudeError,
  longitudeError,
}: SpotLocationPickerProps) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const circleRef = useRef<import("leaflet").Circle | null>(null);
  const [radiusKm, setRadiusKm] = useState(
    defaultRadiusKm ?? DEFAULT_MAP_RADIUS_KM,
  );
  const radiusRef = useRef(radiusKm);
  radiusRef.current = radiusKm;

  const [latitude, setLatitude] = useState(
    defaultLatitude != null ? String(defaultLatitude) : "",
  );
  const [longitude, setLongitude] = useState(
    defaultLongitude != null ? String(defaultLongitude) : "",
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchError, setSearchError] = useState("");

  function applyCoords(lat: number, lng: number) {
    setLatitude(lat.toFixed(5));
    setLongitude(lng.toFixed(5));
    void syncOverlay(lat, lng, radiusRef.current);
  }

  async function syncOverlay(lat: number, lng: number, km: number) {
    const map = mapRef.current;
    if (!map) return;
    const L = (await import("leaflet")).default;
    if (!mapRef.current) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.circleMarker([lat, lng], {
        radius: 8,
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(map);
    }
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(km * 1000);
    } else {
      circleRef.current = L.circle([lat, lng], {
        radius: km * 1000,
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(map);
    }
    map.fitBounds(circleRef.current.getBounds(), {
      padding: [24, 24],
      maxZoom: 16,
    });
  }

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current) return;

      const startLat =
        defaultLatitude ?? DEFAULT_CENTER.lat;
      const startLng =
        defaultLongitude ?? DEFAULT_CENTER.lng;
      const startZoom =
        defaultLatitude != null && defaultLongitude != null
          ? 12
          : DEFAULT_ZOOM;

      const map = L.map(mapEl.current, {
        scrollWheelZoom: true,
      }).setView([startLat, startLng], startZoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);

      const startRadius = defaultRadiusKm ?? DEFAULT_MAP_RADIUS_KM;
      const hasPin = defaultLatitude != null && defaultLongitude != null;
      const marker = hasPin
        ? L.circleMarker([defaultLatitude, defaultLongitude], {
            radius: 8,
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.9,
            weight: 2,
          }).addTo(map)
        : null;
      const circle = hasPin
        ? L.circle([defaultLatitude, defaultLongitude], {
            radius: startRadius * 1000,
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.12,
            weight: 2,
          }).addTo(map)
        : null;
      if (circle) {
        map.fitBounds(circle.getBounds(), { padding: [24, 24], maxZoom: 16 });
      }

      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = event.latlng;
        applyCoords(lat, lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [defaultLatitude, defaultLongitude, defaultRadiusKm]);

  async function handleSearch(e?: React.SyntheticEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchError("");
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("search failed");
      const data = (await res.json()) as GeocodeResult[];
      setResults(data);
      if (data.length === 0) setSearchError("No places found.");
    } catch {
      setSearchError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }

  function pickResult(result: GeocodeResult) {
    applyCoords(result.latitude, result.longitude);
    setResults([]);
    setQuery(result.label);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setSearchError("Geolocation is not available in this browser.");
      return;
    }
    setLocating(true);
    setSearchError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyCoords(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setSearchError("Couldn't get your location.");
        setLocating(false);
      },
      { timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSearch(e);
              }
            }}
            placeholder="Search for a beach, city, or spot"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={(e) => void handleSearch(e)}
            disabled={searching || query.trim().length < 2}
          >
            {searching ? "Searching…" : "Search"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={useMyLocation}
            disabled={locating}
          >
            <MapPin className="h-4 w-4" />
            {locating ? "Locating…" : "Use my location"}
          </Button>
        </div>
      </div>

      {searchError && (
        <p className="text-sm text-destructive">{searchError}</p>
      )}

      {results.length > 0 && (
        <ul className="rounded-md border divide-y max-h-40 overflow-auto">
          {results.map((result) => (
            <li key={`${result.latitude},${result.longitude},${result.label}`}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                onClick={() => pickResult(result)}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Click the map to drop a pin, then size the circle to the water you ride.
      </p>
      <div
        ref={mapEl}
        className="h-64 w-full rounded-md border z-0"
        role="application"
        aria-label="Click the map to set the spot location"
      />
      <input type="hidden" name="mapRadiusKm" value={radiusKm} />
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="mapRadius">Winging area</Label>
          <span className="text-sm tabular-nums text-muted-foreground">
            {radiusKm < 10 ? radiusKm.toFixed(1) : Math.round(radiusKm)} km
          </span>
        </div>
        <input
          id="mapRadius"
          type="range"
          min={MIN_MAP_RADIUS_KM}
          max={MAX_MAP_RADIUS_KM}
          step={0.1}
          value={radiusKm}
          onChange={(e) => {
            const km = Number(e.target.value);
            setRadiusKm(km);
            const lat = Number(latitude);
            const lng = Number(longitude);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              void syncOverlay(lat, lng, km);
            }
          }}
          className="w-full accent-primary"
          aria-label="Winging area radius in kilometers"
        />
        <div className="flex flex-wrap gap-2">
          {MAP_RADIUS_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              variant={radiusKm === preset.km ? "secondary" : "outline"}
              onClick={() => {
                setRadiusKm(preset.km);
                const lat = Number(latitude);
                const lng = Number(longitude);
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                  void syncOverlay(lat, lng, preset.km);
                }
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Frames the satellite wind map. Forecast and tides stay on the pin.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="latitude">Latitude</Label>
          <Input
            id="latitude"
            name="latitude"
            type="number"
            step="any"
            required
            placeholder="37.8045"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
          />
          {latitudeError && (
            <p className="text-xs text-destructive">{latitudeError}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="longitude">Longitude</Label>
          <Input
            id="longitude"
            name="longitude"
            type="number"
            step="any"
            required
            placeholder="-122.4654"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
          />
          {longitudeError && (
            <p className="text-xs text-destructive">{longitudeError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
