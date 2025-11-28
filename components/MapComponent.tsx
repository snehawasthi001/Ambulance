"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import { Feature, LineString } from "geojson";

interface MapComponentProps {
  className?: string;
}

interface Ambulance {
  id: string;
  coordinates: [number, number];
  driverName: string;
  vehicleNumber: string;
  marker?: mapboxgl.Marker;
  available?: boolean;
}

type DriverStatus = "waiting" | "en-route" | "arrived" | "arriving";

interface DriverInfoState {
  driverName: string;
  vehicleNumber: string;
  eta: string;
  status: DriverStatus;
}

interface NearestAmbulanceResult {
  ambulance: Ambulance;
  duration: number;
  distance: number;
  route: Feature<LineString>;
}

const MapComponent = ({ className }: MapComponentProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [selectedAmbulance, setSelectedAmbulance] = useState<Ambulance | null>(
    null
  );
  const [isNavigating, setIsNavigating] = useState(false);
  const animationFrameId = useRef<number | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(true); // State to track the current theme

  const [driverInfo, setDriverInfo] = useState<DriverInfoState>({
    driverName: "",
    vehicleNumber: "",
    eta: "",
    status: "waiting",
  });

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} sec`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes} min ${remainingSeconds} sec` : `${minutes} min`;
  };

  const startNavigation = useCallback(
    (ambulance: Ambulance, route: Feature<LineString>) => {
      if (!map.current) return;

      const steps = route.geometry.coordinates;
      let currentStep = 0;
      const totalSteps = steps.length;
      const animationDuration = 20000; // 20 seconds total journey
      const stepDuration = animationDuration / totalSteps;
      let startTime: number | null = null;
      let animationFrameId: number;

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;
        const stepProgress = (progress % stepDuration) / stepDuration;
        currentStep = Math.floor(progress / stepDuration);

        if (currentStep >= totalSteps - 1) {
          // Arrived at destination
          if (ambulance.marker) {
            const finalPosition = steps[totalSteps - 1] as [number, number];
            ambulance.marker.setLngLat(finalPosition);
          }
          setDriverInfo((prev) => ({
            ...prev,
            eta: "Arrived",
            status: "arrived",
          }));
          return;
        }

        const currentPosition = steps[currentStep] as [number, number];
        const nextPosition = steps[Math.min(currentStep + 1, totalSteps - 1)] as [number, number];

        // Interpolate between current and next position
        const lng = currentPosition[0] + (nextPosition[0] - currentPosition[0]) * stepProgress;
        const lat = currentPosition[1] + (nextPosition[1] - currentPosition[1]) * stepProgress;

        if (ambulance.marker) {
          ambulance.marker.setLngLat([lng, lat]);

          // Calculate bearing for rotation
          const bearing = turf.bearing(
            turf.point(currentPosition),
            turf.point(nextPosition)
          );
          ambulance.marker.setRotation(bearing);
        }

        // Update ETA and status
        const remainingSteps = totalSteps - currentStep;
        const remainingTime = Math.ceil((remainingSteps * stepDuration) / 1000);
        setDriverInfo((prev) => ({
          ...prev,
          eta: formatTime(remainingTime),
          status: remainingTime <= 5 ? "arriving" : "en-route",
        }));

        animationFrameId = requestAnimationFrame(animate);
      };

      animationFrameId = requestAnimationFrame(animate);

      return () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      };
    },
    [formatTime]
  );

  const toggleAmbulanceAvailability = useCallback((ambulanceId: string) => {
    if (isNavigating) return;

    setAmbulances((prev) => {
      const newAmbulances = prev.map((amb) => {
        if (amb.id === ambulanceId) {
          // Update the marker's status dot color
          const markerEl = amb.marker?.getElement();
          if (markerEl) {
            const statusDot = markerEl.querySelector(".status-icon");
            const tooltip = markerEl.querySelector(".tooltip-text");
            if (statusDot && tooltip) {
              if (amb.available) {
                statusDot.classList.remove("bg-green-500");
                statusDot.classList.add("bg-red-500");
                tooltip.textContent = "Busy";
              } else {
                statusDot.classList.remove("bg-red-500");
                statusDot.classList.add("bg-green-500");
                tooltip.textContent = "Available";
              }
            }
          }
          return { ...amb, available: !amb.available };
        }
        return amb;
      });
      return newAmbulances;
    });
  }, [isNavigating]);

  const findNearestAmbulance = useCallback(
    async (): Promise<NearestAmbulanceResult | null> => {
      if (!userLocation || ambulances.length === 0) return null;

      // Only consider available ambulances
      const availableAmbulances = ambulances.filter((a) => a.available !== false);
      if (availableAmbulances.length === 0) return null;

      let nearestAmbulance = null;
      let shortestTime = Infinity;
      let shortestDistance = Infinity;

      for (const ambulance of availableAmbulances) {
        try {
          // Get route from Mapbox Directions API with timeout and error handling
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const query = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${ambulance.coordinates[0]},${ambulance.coordinates[1]};${userLocation[0]},${userLocation[1]}?steps=true&geometries=geojson&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
            { signal: controller.signal }
          ).finally(() => clearTimeout(timeoutId));
          
          if (!query.ok) {
            throw new Error(`Network response was not ok: ${query.status}`);
          }
          
          const json = await query.json();
          const data = json.routes[0];
          
          if (!data) {
            throw new Error('No route found');
          }

          if (data) {
            const duration = data.duration; // in seconds
            const distance = data.distance / 1000; // Convert to kilometers

            // Consider both time and distance with a weighted approach
            const score = duration * 0.7 + (distance * 1000) * 0.3; // Weighted score

            if (score < shortestTime) {
              shortestTime = score;
              shortestDistance = distance;
              nearestAmbulance = {
                ambulance,
                duration: Math.round(duration / 60), // Convert to minutes
                distance: Math.round(distance * 10) / 10, // Round to 1 decimal
                route: data.geometry,
              };
            }
          }
        } catch (error) {
          console.error("Error calculating route:", error);
        }
      }

      return nearestAmbulance;
    },
    [ambulances, userLocation]
  );

  const handleDispatch = useCallback(
    async (ambulanceId: string) => {
      if (!userLocation || !map.current) return;

      const ambulance = ambulances.find((a) => a.id === ambulanceId);
      if (!ambulance) return;

      setSelectedAmbulance(ambulance);
      setIsNavigating(true);
      setDriverInfo({
        driverName: ambulance.driverName,
        vehicleNumber: ambulance.vehicleNumber,
        eta: "Calculating...",
        status: "en-route",
      });

      try {
        // Get route from Mapbox Directions API with timeout and error handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const query = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${ambulance.coordinates[0]},${ambulance.coordinates[1]};${userLocation[0]},${userLocation[1]}?steps=true&geometries=geojson&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
          { signal: controller.signal }
        ).finally(() => clearTimeout(timeoutId));
        
        if (!query.ok) {
          throw new Error(`Network response was not ok: ${query.status}`);
        }
        
        const json = await query.json();
        const data = json.routes[0];
        
        if (!data) {
          throw new Error('No route found');
        }
        const routeGeoJSON: Feature<LineString> = {
          type: "Feature",
          properties: {},
          geometry: data.geometry,
        };

        // Remove existing route if any
        if (map.current.getSource("route")) {
          map.current.removeLayer("routeLayer");
          map.current.removeSource("route");
        }

        // Add route to map
        map.current.addSource("route", {
          type: "geojson",
          data: routeGeoJSON,
        });

        map.current.addLayer({
          id: "routeLayer",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#FF3B30",
            "line-width": 6,
            "line-opacity": 0.9,
            "line-dasharray": [0.5, 0.25],
          },
        });

        // Update initial ETA
        const initialETA = Math.round(data.duration / 60);
        setDriverInfo((prev) => ({
          ...prev,
          eta: `${initialETA} mins`,
        }));

        startNavigation(ambulance, routeGeoJSON);
      } catch (error) {
        console.error("Error getting route:", error);
      }
    },
    [ambulances, userLocation, startNavigation]
  );

  const handleQuickDispatch = useCallback(
    async () => {
      const nearest = await findNearestAmbulance();
      if (nearest) {
        handleDispatch(nearest.ambulance.id);
      }
    },
    [findNearestAmbulance, handleDispatch]
  );

  const toggleTheme = useCallback(() => {
    if (!map.current) return;
    
    const newTheme = !isDarkTheme;
    setIsDarkTheme(newTheme);
    
    // Change the map style based on the theme - using more colorful styles
    const style = newTheme ? 
      "mapbox://styles/mapbox/navigation-night-v1" : 
      "mapbox://styles/mapbox/navigation-day-v1";
    
    map.current.setStyle(style);
  }, [isDarkTheme]);

  useEffect(() => {
    const container = mapContainer.current;
    if (!container) return;

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        const userPos: [number, number] = [longitude, latitude];
        setUserLocation(userPos);
        setIsLoading(false);

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
        const mapInstance = new mapboxgl.Map({
          container,
          style: isDarkTheme ? "mapbox://styles/mapbox/navigation-night-v1" : "mapbox://styles/mapbox/navigation-day-v1",
          center: userPos,
          zoom: 14,
          pitch: 45,
          bearing: 0,
        });

        mapInstance.on("load", () => {
          setIsMapLoaded(true);
        });

        map.current = mapInstance;

        mapInstance.addControl(new mapboxgl.NavigationControl(), "top-right");

        const userMarkerEl = document.createElement("div");
        userMarkerEl.className = "relative";

        const userDot = document.createElement("div");
        userDot.className =
          "w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-lg";
        userMarkerEl.appendChild(userDot);

        const pulseDot = document.createElement("div");
        pulseDot.className =
          "absolute top-0 left-0 w-6 h-6 bg-blue-500 rounded-full animate-ping opacity-75";
        userMarkerEl.appendChild(pulseDot);
        
        // Add a label for user location
        const userLabel = document.createElement("div");
        userLabel.className = "absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-blue-700 text-white px-2 py-1 rounded text-xs whitespace-nowrap";
        userLabel.textContent = "You are here";
        userMarkerEl.appendChild(userLabel);

        new mapboxgl.Marker({ element: userMarkerEl })
          .setLngLat(userPos)
          .addTo(mapInstance);

        const nearbyAmbulances = Array.from({ length: 5 }, (_, i) => {
          const point = turf.destination(
            turf.point(userPos),
            Math.random() * 2,
            Math.random() * 360,
            { units: "kilometers" }
          );
          return {
            id: `AMB-${i + 1}`,
            coordinates: point.geometry.coordinates as [number, number],
            driverName: `Dr. ${["Sarah", "John", "Emma", "Michael", "Lisa"][i]}`,
            vehicleNumber: `AMB-202${i}`,
            available: true,
            marker: undefined,
          } as Ambulance;
        });

        nearbyAmbulances.forEach((ambulance) => {
          const el = document.createElement("div");
          el.className = "ambulance-marker relative group";
          el.style.width = "40px";
          el.style.height = "40px";

          // Create a more colorful background for the ambulance icon
          const iconBackground = document.createElement("div");
          iconBackground.className = "absolute inset-0 bg-red-500 rounded-full opacity-20 group-hover:opacity-30 transition-opacity duration-300";
          el.appendChild(iconBackground);

          const emojiDiv = document.createElement("div");
          emojiDiv.className = "w-full h-full flex items-center justify-center";
          emojiDiv.textContent = "🚑";
          emojiDiv.style.fontSize = "28px";
          emojiDiv.style.transform = "translateY(0)";
          emojiDiv.style.filter = "drop-shadow(0 0 2px rgba(0,0,0,0.5))";
          el.appendChild(emojiDiv);

          const statusIcon = document.createElement("div");
          statusIcon.className =
            "status-icon absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white transform transition-all duration-300 group-hover:scale-125 z-10 cursor-pointer shadow-md";

          const handleStatusClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            toggleAmbulanceAvailability(ambulance.id);
          };

          statusIcon.addEventListener("click", handleStatusClick);
          el.appendChild(statusIcon);

          const tooltip = document.createElement("div");
          tooltip.className =
            "tooltip-text absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/75 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200";
          tooltip.textContent = "Available";
          el.appendChild(tooltip);

          const marker = new mapboxgl.Marker({
            element: el,
            anchor: "center",
            rotationAlignment: "map",
            offset: [0, 0],
          })
            .setLngLat(ambulance.coordinates)
            .addTo(mapInstance);

          ambulance.marker = marker;
        });

        setAmbulances(nearbyAmbulances);
      },
      (error) => {
        console.error("Error getting location:", error);
        setError(
          "Unable to get your location. Please enable location services and refresh the page."
        );
        setIsLoading(false);
      }
    );

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      map.current?.remove();
    };
  }, []);

  return (
    <div className={className}>
      <div ref={mapContainer} className="w-full h-full relative">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 text-gray-800 dark:text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center w-12 h-12 border-2 border-blue-500 dark:border-yellow-400"
          aria-label={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
        >
          {isDarkTheme ? (
            // Sun icon for light mode
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
            </svg>
          ) : (
            // Moon icon for dark mode
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        {isLoading && (
          <div className="fixed inset-0 bg-gradient-to-br from-blue-900/90 to-black/90 text-white backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex flex-col items-center space-y-6 bg-black/30 p-8 rounded-xl border border-blue-500/30">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-t-4 border-red-500"></div>
                <div className="absolute inset-0 flex items-center justify-center text-2xl">🚑</div>
              </div>
              <p className="text-white font-medium text-xl">Loading Ambulance Tracker...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="fixed inset-0 bg-black/80 text-white backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-black/80 p-6 rounded-lg shadow-lg max-w-md">
              <h3 className="text-red-500 font-semibold text-lg mb-2">Error</h3>
              <p className="text-white">{error}</p>
            </div>
          </div>
        )}

        {userLocation && !isNavigating && (
          <button
            onClick={handleQuickDispatch}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2 border border-red-400"
          >
            <span>🚨</span>
            <span>Quick Dispatch</span>
          </button>
        )}

        {isNavigating && driverInfo && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-lg shadow-lg w-80">
            {driverInfo.status === "arrived" ? (
              // Arrived State
              <div className="text-center">
                <div className="text-green-500 text-4xl mb-2">🏥</div>
                <h3 className="font-bold text-xl mb-2">Ambulance Arrived!</h3>
                <p className="text-gray-600 mb-4">Your ambulance has reached the destination</p>
                <div className="flex justify-between text-sm text-gray-500 border-t pt-3">
                  <span>{driverInfo.driverName}</span>
                  <span>{driverInfo.vehicleNumber}</span>
                </div>
              </div>
            ) : (
              // En Route State
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg">Ambulance {
                      driverInfo.status === "arriving" ? "Almost There" : "En Route"
                    }</h3>
                    <p className="text-xl font-bold mt-1">
                      {driverInfo.status === "arriving" ? (
                        <span className="text-yellow-500 animate-pulse">Arriving in {driverInfo.eta}...</span>
                      ) : (
                        <span className="text-gray-800">{driverInfo.eta}</span>
                      )}
                    </p>
                  </div>
                  <div className={`text-2xl ${
                    driverInfo.status === "arriving" ? "animate-bounce" : ""
                  }`}>
                    🚑
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <div className="text-gray-600 text-sm flex-1">Ambulance on the way</div>
                  </div>
                  
                  <div className="relative h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`absolute h-full left-0 top-0 rounded-full transition-all duration-300 ${
                        driverInfo.status === "arriving" ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{
                        width: driverInfo.status === "arriving" ? "90%" : "60%"
                      }}
                    ></div>
                  </div>

                  <div className="flex justify-between text-sm text-gray-500 border-t pt-3">
                    <div>
                      <p className="font-medium">{driverInfo.driverName}</p>
                      <p>{driverInfo.vehicleNumber}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs ${
                      driverInfo.status === "arriving" 
                        ? "bg-yellow-100 text-yellow-800" 
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {driverInfo.status === "arriving" ? "Arriving" : "On the way"}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapComponent;
