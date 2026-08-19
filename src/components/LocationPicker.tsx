"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";

export interface SelectedLocation {
  address: string;
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  initialLocation?: string;
  initialCoordinates?: { latitude: number; longitude: number };
  onLocationChange: (loc: SelectedLocation) => void;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

// Custom SVG marker to prevent broken asset paths with Leaflet in Next.js bundlers
const createCustomIcon = () => {
  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        transform: translate(-50%, -100%);
      ">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#10b981" stroke="#064e3b" stroke-width="1.5"/>
          <circle cx="12" cy="9" r="3.5" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

export default function LocationPicker({
  initialLocation = "",
  initialCoordinates,
  onLocationChange,
}: LocationPickerProps) {
  const [address, setAddress] = useState<string>(initialLocation);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(
    initialCoordinates
      ? { lat: initialCoordinates.latitude, lng: initialCoordinates.longitude }
      : { lat: 28.6139, lng: 77.209 } // Default fallback (e.g. New Delhi or neutral center)
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [mapReady, setMapReady] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize with external changes if initial location changes
  useEffect(() => {
    if (initialLocation && initialLocation !== address) {
      setAddress(initialLocation);
    }
  }, [initialLocation, address]);

  // Reverse Geocode using OpenStreetMap Nominatim API
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        setIsReverseGeocoding(true);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          {
            headers: {
              "Accept-Language": "en",
            },
          }
        );
        const data = await res.json();
        if (data && data.display_name) {
          const resolvedAddress = data.display_name;
          setAddress(resolvedAddress);
          onLocationChange({
            address: resolvedAddress,
            latitude: lat,
            longitude: lng,
          });
        }
      } catch (err) {
        console.error("OpenStreetMap Reverse Geocoding failed:", err);
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [onLocationChange]
  );

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialLat = coords.lat;
    const initialLng = coords.lng;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: true,
    });

    // OpenStreetMap Standard Tiles Layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Pin marker
    const marker = L.marker([initialLat, initialLng], {
      icon: createCustomIcon(),
      draggable: true,
    }).addTo(map);

    // Event: Map Click to place marker
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setCoords({ lat, lng });
      reverseGeocode(lat, lng);
    });

    // Event: Marker Drag End
    marker.on("dragend", () => {
      const position = marker.getLatLng();
      setCoords({ lat: position.lat, lng: position.lng });
      reverseGeocode(position.lat, position.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [coords.lat, coords.lng, reverseGeocode]);

  // Handle Search Input with Nominatim Geocoding API
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    setShowDropdown(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            value
          )}&limit=5&addressdetails=1`,
          {
            headers: {
              "Accept-Language": "en",
            },
          }
        );
        const data: SearchResult[] = await res.json();
        setSuggestions(data || []);
      } catch (err) {
        console.error("OpenStreetMap Nominatim search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 450);
  };

  // Select Search Suggestion
  const handleSelectSuggestion = (item: SearchResult) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);

    setCoords({ lat, lng: lon });
    setAddress(item.display_name);
    setSearchQuery("");
    setShowDropdown(false);
    setSuggestions([]);

    onLocationChange({
      address: item.display_name,
      latitude: lat,
      longitude: lon,
    });

    if (mapRef.current && markerRef.current) {
      mapRef.current.flyTo([lat, lon], 16, { duration: 1.2 });
      markerRef.current.setLatLng([lat, lon]);
    }
  };

  // Geolocation: Find My Location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        setCoords({ lat, lng: lon });
        setIsLocating(false);

        if (mapRef.current && markerRef.current) {
          mapRef.current.flyTo([lat, lon], 16, { duration: 1 });
          markerRef.current.setLatLng([lat, lon]);
        }

        reverseGeocode(lat, lon);
      },
      (err) => {
        setIsLocating(false);
        console.warn("Geolocation failed or denied:", err.message);
        alert("Unable to retrieve your location. Please search manually.");
      },
      { timeout: 10000 }
    );
  };

  // Manual address text edits
  const handleAddressTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddress(val);
    onLocationChange({
      address: val,
      latitude: coords.lat,
      longitude: coords.lng,
    });
  };

  return (
    <div className="space-y-3">
      {/* Search Bar & AutoComplete using OpenStreetMap Nominatim */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search address via OpenStreetMap (e.g. Connaught Place, Mumbai Airport, Wall Street)..."
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 text-xs sm:text-sm shadow-sm"
            />
            <span className="absolute left-3 top-2.5 text-slate-400 text-xs">
              🔍
            </span>
            {isSearching && (
              <span className="absolute right-3 top-2.5 text-xs text-emerald-600 animate-spin">
                ⏳
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            title="Use current GPS location"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <span>{isLocating ? "⏳" : "🎯"}</span>
            <span className="hidden sm:inline">
              {isLocating ? "Locating..." : "GPS"}
            </span>
          </button>
        </div>

        {/* Autocomplete Dropdown List */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
            <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 flex items-center justify-between">
              <span>OpenStreetMap Suggestions</span>
              <button
                type="button"
                onClick={() => setShowDropdown(false)}
                className="hover:text-slate-900"
              >
                ✕
              </button>
            </div>
            {suggestions.map((item) => (
              <button
                type="button"
                key={item.place_id}
                onClick={() => handleSelectSuggestion(item)}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 border-b border-slate-100 last:border-0 transition flex items-start gap-2 cursor-pointer"
              >
                <span className="text-emerald-600 mt-0.5 shrink-0">📍</span>
                <span className="line-clamp-2">{item.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Map Container */}
      <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-100 shadow-sm">
        <div
          ref={mapContainerRef}
          className="w-full h-64 sm:h-72"
          style={{ minHeight: "260px" }}
        />

        {/* Map Instructions Badge */}
        <div className="absolute bottom-2 left-2 z-20 bg-white/95 backdrop-blur px-2.5 py-1 rounded-md border border-slate-200 text-[10px] text-slate-700 pointer-events-none flex items-center gap-1.5 shadow-sm">
          <span>💡</span> Click map or drag pin to fine-tune branch location
        </div>

        {/* Reverse Geocoding Indicator */}
        {isReverseGeocoding && (
          <div className="absolute top-2 right-2 z-20 bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1.5 shadow-md">
            <span className="animate-spin">⚙️</span> Resolving address...
          </div>
        )}
      </div>

      {/* Selected Address Display & Manual Edit */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
          Branch Location / Address *
        </label>
        <div className="relative">
          <input
            type="text"
            required
            placeholder="Selected branch address will appear here (or type manually)..."
            value={address}
            onChange={handleAddressTextChange}
            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 text-xs sm:text-sm shadow-sm"
          />
        </div>
      </div>

      {/* Coordinates & OpenStreetMap Reference Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
        <div className="flex items-center gap-3 font-mono">
          <span className="text-slate-700">
            Latitude:{" "}
            <span className="text-emerald-700 font-bold">
              {coords.lat.toFixed(6)}
            </span>
          </span>
          <span className="text-slate-700">
            Longitude:{" "}
            <span className="text-emerald-700 font-bold">
              {coords.lng.toFixed(6)}
            </span>
          </span>
        </div>

        <a
          href={`https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=17/${coords.lat}/${coords.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-700 hover:text-emerald-800 font-medium underline flex items-center gap-1"
        >
          View on OpenStreetMap ↗
        </a>
      </div>
    </div>
  );
}
