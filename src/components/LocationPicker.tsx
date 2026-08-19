"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import { useLanguage } from "@/context/LanguageContext";

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
  const { t } = useLanguage();

  const [address, setAddress] = useState<string>(initialLocation);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(
    initialCoordinates
      ? { lat: initialCoordinates.latitude, lng: initialCoordinates.longitude }
      : { lat: 28.6139, lng: 77.209 } // Default fallback
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
        console.error("Reverse geocoding failed:", err);
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [onLocationChange]
  );

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [coords.lat, coords.lng],
      zoom: 13,
      zoomControl: true,
    });

    // Clean OpenStreetMap Tile Layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add draggable marker
    const marker = L.marker([coords.lat, coords.lng], {
      icon: createCustomIcon(),
      draggable: true,
    }).addTo(map);

    // Marker dragend event
    marker.on("dragend", () => {
      const position = marker.getLatLng();
      setCoords({ lat: position.lat, lng: position.lng });
      reverseGeocode(position.lat, position.lng);
    });

    // Map click event
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setCoords({ lat, lng });
      reverseGeocode(lat, lng);
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

  // Handle Search Input with Debounce (Nominatim Search API)
  const handleSearchInput = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&limit=5&addressdetails=1`,
          {
            headers: {
              "Accept-Language": "en",
            },
          }
        );
        const data = await res.json();
        setSuggestions(data || []);
        setShowDropdown(true);
      } catch (err) {
        console.error("Nominatim search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  // Select Search Suggestion
  const handleSelectSuggestion = (item: SearchResult) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setCoords({ lat, lng });
    setAddress(item.display_name);
    setSearchQuery(item.display_name);
    setShowDropdown(false);

    if (mapRef.current && markerRef.current) {
      mapRef.current.setView([lat, lng], 16);
      markerRef.current.setLatLng([lat, lng]);
    }

    onLocationChange({
      address: item.display_name,
      latitude: lat,
      longitude: lng,
    });
  };

  // Geolocation (Current GPS Location)
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });

        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([latitude, longitude], 16);
          markerRef.current.setLatLng([latitude, longitude]);
        }

        reverseGeocode(latitude, longitude);
        setIsLocating(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Unable to retrieve your location. Please check browser permissions.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAddressTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setAddress(text);
    onLocationChange({
      address: text,
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
              placeholder={t("osm_search_placeholder")}
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              className="w-full pl-8 pr-8 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-xs shadow-inner"
            />
            <span className="absolute left-2.5 top-2.5 text-slate-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
            {isSearching && (
              <span className="absolute right-3 top-2.5 text-xs text-slate-500 animate-spin">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            title={t("use_gps")}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <span>{isLocating ? t("locating") : t("use_gps")}</span>
          </button>
        </div>

        {/* Autocomplete Dropdown List */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
            <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 flex items-center justify-between">
              <span>{t("osm_suggestions")}</span>
              <button
                type="button"
                onClick={() => setShowDropdown(false)}
                className="hover:text-slate-900 font-bold"
              >
                ✕
              </button>
            </div>
            {suggestions.map((item) => (
              <button
                type="button"
                key={item.place_id}
                onClick={() => handleSelectSuggestion(item)}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition flex items-start gap-2 cursor-pointer"
              >
                <span className="line-clamp-2">{item.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Map Container */}
      <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-100">
        <div
          ref={mapContainerRef}
          className="w-full h-64 sm:h-72"
          style={{ minHeight: "260px" }}
        />

        {/* Map Instructions Badge */}
        <div className="absolute bottom-2 left-2 z-20 bg-white/95 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-300 text-[10px] text-slate-700 pointer-events-none shadow-2xs">
          {t("map_instructions")}
        </div>

        {/* Reverse Geocoding Indicator */}
        {isReverseGeocoding && (
          <div className="absolute top-2 right-2 z-20 bg-slate-900 text-white px-2.5 py-1 rounded-lg text-[10px] font-medium shadow-md">
            {t("resolving_address")}
          </div>
        )}
      </div>

      {/* Selected Address Display & Manual Edit */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
          {t("branch_location_label")}
        </label>
        <div className="relative">
          <input
            type="text"
            required
            placeholder={t("branch_location_placeholder")}
            value={address}
            onChange={handleAddressTextChange}
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-xs shadow-inner"
          />
        </div>
      </div>

      {/* Coordinates & OpenStreetMap Reference Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 font-mono">
          <span className="text-slate-700">
            {t("latitude")}:{" "}
            <span className="text-slate-900 font-bold">
              {coords.lat.toFixed(6)}
            </span>
          </span>
          <span className="text-slate-700">
            {t("longitude")}:{" "}
            <span className="text-slate-900 font-bold">
              {coords.lng.toFixed(6)}
            </span>
          </span>
        </div>

        <a
          href={`https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=17/${coords.lat}/${coords.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline font-medium flex items-center gap-1"
        >
          {t("view_on_osm")}
        </a>
      </div>
    </div>
  );
}
