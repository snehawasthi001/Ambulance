'use client';

import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { VitalSignsPanel } from '@/components/VitalSignsPanel';
import { HospitalMatchPanel } from '@/components/HospitalMatchPanel';
import { JourneyTracker } from '@/components/JourneyTracker';
import { useEmergencyStore } from '@/lib/store';
import { generateHospitals } from '@/lib/hospitalData';
import { VitalSimulator } from '@/lib/vitalSimulator';
import { HospitalMatcher } from '@/lib/hospitalMatcher';
import { geminiService } from '@/lib/geminiService';
import { PatientData, VitalSigns, EmergencyStatus, Hospital } from '@/types';
import { Activity, AlertCircle, Sun, Moon, Zap, Shield, Heart, TrendingUp, Phone, MapPin, Navigation, X, Menu } from 'lucide-react';
import { AnimatedButton } from '@/components/ui/animated-button';

import { ThemeToggle } from '@/components/theme-toggle';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export default function IntegratedEmergencyDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(true); // Keep for legacy logic if needed, but rely on ThemeProvider
  const [currentStatus, setCurrentStatus] = useState<EmergencyStatus>('idle');
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [vitals, setVitals] = useState<VitalSigns | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [ambulancePosition, setAmbulancePosition] = useState<[number, number] | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const ambulanceMarker = useRef<mapboxgl.Marker | null>(null);
  const hospitalMarkers = useRef<mapboxgl.Marker[]>([]);

  const {
    hospitals,
    setHospitals,
    userLocation,
    setUserLocation,
    matchedHospitals,
    setMatchedHospitals
  } = useEmergencyStore();

  // Initialize map and location
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: [number, number] = [position.coords.longitude, position.coords.latitude];
          setUserLocation(location);
          setAmbulancePosition(location);

          // Initialize map
          map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: 'mapbox://styles/mapbox/streets-v12', // Always colorful
            center: location,
            zoom: 12
          });

          // Add navigation controls
          map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

          // Add user location marker
          new mapboxgl.Marker({ color: '#3B82F6' })
            .setLngLat(location)
            .setPopup(new mapboxgl.Popup().setHTML('<h3>Your Location</h3>'))
            .addTo(map.current);

          // Generate and add hospitals
          const generatedHospitals = generateHospitals(location);
          setHospitals(generatedHospitals);

          // Add hospital markers
          generatedHospitals.forEach((hospital: Hospital) => {
            if (!hospital.location || hospital.location.length !== 2) {
              console.warn(`Hospital ${hospital.name} has invalid location:`, hospital.location);
              return;
            }

            const el = document.createElement('div');
            el.className = 'hospital-marker';
            el.innerHTML = '🏥';
            el.style.fontSize = '24px';
            el.style.cursor = 'pointer';

            const marker = new mapboxgl.Marker(el)
              .setLngLat(hospital.location)
              .setPopup(
                new mapboxgl.Popup({ offset: 25 }).setHTML(`
                  <div class="p-2">
                    <h3 class="font-bold text-sm">${hospital.name}</h3>
                    <p class="text-xs text-gray-600">${hospital.primarySpecialization}</p>
                    <p class="text-xs mt-1">⭐ ${hospital.rating}</p>
                    <p class="text-xs">🛏️ ${hospital.beds.general.available}/${hospital.beds.general.total} beds</p>
                  </div>
                `)
              )
              .addTo(map.current!);

            hospitalMarkers.current.push(marker);
          });

          // Add 5 dummy ambulances near user location
          const ambulances = [
            { id: 'AMB-001', offset: [0.01, 0.01], name: 'Ambulance 1' },
            { id: 'AMB-002', offset: [-0.01, 0.01], name: 'Ambulance 2' },
            { id: 'AMB-003', offset: [0.01, -0.01], name: 'Ambulance 3' },
            { id: 'AMB-004', offset: [-0.01, -0.01], name: 'Ambulance 4' },
            { id: 'AMB-005', offset: [0.02, 0], name: 'Ambulance 5' },
          ];

          ambulances.forEach(amb => {
            const ambEl = document.createElement('div');
            ambEl.innerHTML = '🚑';
            ambEl.style.fontSize = '28px';
            ambEl.style.cursor = 'pointer';

            new mapboxgl.Marker(ambEl)
              .setLngLat([location[0] + amb.offset[0], location[1] + amb.offset[1]])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 }).setHTML(`
                  <div class="p-2">
                    <h3 class="font-bold text-sm">${amb.name}</h3>
                    <p class="text-xs text-green-600">Available</p>
                  </div>
                `)
              )
              .addTo(map.current!);
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          const defaultLocation: [number, number] = [-74.006, 40.7128];
          setUserLocation(defaultLocation);
          setAmbulancePosition(defaultLocation);

          map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: 'mapbox://styles/mapbox/streets-v12', // Always colorful
            center: defaultLocation,
            zoom: 12
          });

          const generatedHospitals = generateHospitals(defaultLocation);
          setHospitals(generatedHospitals);
        }
      );
    }

    return () => {
      map.current?.remove();
    };
  }, []);

  // Route state
  const routeCoordinates = useRef<[number, number][]>([]);
  const traveledCoordinates = useRef<[number, number][]>([]);
  const animationRef = useRef<number>();

  // Helper to fetch route from Mapbox
  const getRoute = async (start: [number, number], end: [number, number]) => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`
      );
      const data = await response.json();
      const route = data.routes[0].geometry.coordinates;
      return route;
    } catch (error) {
      console.error('Error fetching route:', error);
      return null;
    }
  };

  // Initialize route layers
  useEffect(() => {
    if (!map.current) return;

    const mapInstance = map.current; // Capture ref value

    mapInstance.on('load', () => {
      // Planned Route Layer (Gray)
      if (!mapInstance.getSource('route')) {
        mapInstance.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: []
            }
          }
        });

        mapInstance.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#888',
            'line-width': 4,
            'line-opacity': 0.5
          }
        });
      }

      // Traveled Route Layer (Highlighted/Glow)
      if (!mapInstance.getSource('traveled-route')) {
        mapInstance.addSource('traveled-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: []
            }
          }
        });

        // Glow effect (wider, lower opacity)
        mapInstance.addLayer({
          id: 'traveled-route-glow',
          type: 'line',
          source: 'traveled-route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6', // Blue glow
            'line-width': 12,
            'line-opacity': 0.3,
            'line-blur': 4
          }
        });

        // Core line (sharper)
        mapInstance.addLayer({
          id: 'traveled-route',
          type: 'line',
          source: 'traveled-route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#60a5fa', // Lighter blue
            'line-width': 4,
            'line-opacity': 1
          }
        });
      }
    });
  }, []);

  const animateRoute = (route: [number, number][], onComplete?: () => void) => {
    let step = 0;
    const speed = 2; // Adjust speed as needed

    const animate = () => {
      if (step < route.length) {
        const currentPos = route[step];
        setAmbulancePosition(currentPos);

        // Update marker
        if (ambulanceMarker.current) {
          ambulanceMarker.current.setLngLat(currentPos);
        } else if (map.current) {
          const el = document.createElement('div');
          el.innerHTML = '🚑';
          el.style.fontSize = '32px';
          ambulanceMarker.current = new mapboxgl.Marker(el)
            .setLngLat(currentPos)
            .addTo(map.current);
        }

        // Update traveled path
        traveledCoordinates.current.push(currentPos);

        if (map.current?.getSource('traveled-route')) {
          (map.current.getSource('traveled-route') as mapboxgl.GeoJSONSource).setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: traveledCoordinates.current
            }
          });
        }

        // Pan map to follow ambulance if needed
        map.current?.panTo(currentPos, { duration: 0 });

        step += 1;
        animationRef.current = requestAnimationFrame(animate);
      } else {
        if (onComplete) onComplete();
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const handleSymptomAnalysis = async (analysis: any) => {
    console.log('Symptom analysis received:', analysis);

    const patient: PatientData = {
      symptoms: analysis.symptoms || [],
      rawTranscript: useEmergencyStore.getState().voiceTranscript,
      severity: analysis.severity || 'Moderate',
      urgency: analysis.urgency || 5,
      requiredSpecialization: analysis.requiredSpecializations || ['General'],
      bloodTypeNeeded: analysis.needsBlood ? analysis.bloodType : undefined
    };

    setPatientData(patient);
    console.log('Patient data set:', patient);

    const generatedVitals = VitalSimulator.generateBySeverity(patient.severity);
    setVitals(generatedVitals);
    console.log('Vitals generated:', generatedVitals);

    if (userLocation && hospitals.length > 0) {
      console.log('Matching hospitals...');
      const matches = await HospitalMatcher.matchHospitals(
        hospitals,
        userLocation,
        patient,
        process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
      );
      console.log('Hospital matches found:', matches.length);
      setMatchedHospitals(matches);

      // Highlight matched hospitals on map
      if (map.current && matches.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend(userLocation);
        matches.slice(0, 3).forEach(match => {
          if (match.hospital.location) {
            bounds.extend(match.hospital.location);
          }
        });
        map.current.fitBounds(bounds, { padding: 100 });
      }
    }

    setCurrentStatus('processing');
  };

  const handleSelectHospital = async (match: any) => {
    setSelectedHospitalId(match.hospital.id);
    setCurrentStatus('dispatching');

    // Reset previous routes
    traveledCoordinates.current = [];
    if (map.current?.getSource('traveled-route')) {
      (map.current.getSource('traveled-route') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] }
      });
    }

    // 1. Ambulance -> Patient
    // For demo, assume ambulance starts at a fixed offset or its last known position
    // If no ambulance position, start near user
    const startPos = ambulancePosition || [userLocation![0] + 0.01, userLocation![1] + 0.01];

    const routeToPatient = await getRoute(startPos, userLocation!);

    if (routeToPatient && map.current) {
      // Draw planned route
      (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeToPatient }
      });

      setCurrentStatus('ambulance_en_route_to_patient');

      animateRoute(routeToPatient, async () => {
        setCurrentStatus('patient_picked_up');

        // Wait a bit
        setTimeout(async () => {
          // 2. Patient -> Hospital
          const hospitalLoc = match.hospital.location;
          const routeToHospital = await getRoute(userLocation!, hospitalLoc);

          if (routeToHospital) {
            // Reset traveled for next leg or keep it? Let's reset for clarity or keep to show full history.
            // User said "route covered... highlighted", usually implies the whole session. 
            // But the route line source needs to be updated to the new plan.

            if (map.current?.getSource('route')) {
              (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
                type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeToHospital }
              });
            }

            // Clear traveled for new leg to avoid jumping lines if we just append
            traveledCoordinates.current = [];

            setCurrentStatus('en_route_to_hospital');
            animateRoute(routeToHospital, () => {
              setCurrentStatus('arrived_at_hospital');
            });
          }
        }, 2000);
      });
    }
  };

  const handleQuickDispatch = async () => {
    if (!patientData || matchedHospitals.length === 0) {
      alert('Please record your symptoms first!');
      return;
    }

    const topMatch = matchedHospitals[0];
    handleSelectHospital(topMatch);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b bg-primary/10 border-primary/20">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 rounded-xl transition-all bg-primary/10 hover:bg-primary/20 text-primary"
              >
                {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <span className="text-2xl">🚑</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Emergency Response
                </h1>
                <p className="text-sm text-muted-foreground">
                  AI-Powered Medical Dispatch
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-4">
              <button className="p-3 rounded-xl transition-all bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20">
                <Phone className="w-5 h-5" />
              </button>
              <div className="relative z-[60]">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Status Banner */}
      {currentStatus !== 'idle' && (
        <div className="px-6 py-3 z-40">
          <div className="rounded-2xl p-4 backdrop-blur-xl border bg-primary/10 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${currentStatus === 'arrived_at_hospital'
                  ? 'bg-green-500/20'
                  : 'bg-primary/20'
                  }`}>
                  <Activity className={`w-6 h-6 ${currentStatus === 'arrived_at_hospital'
                    ? 'text-green-500'
                    : 'text-primary animate-pulse'
                    }`} />
                </div>
                <div>
                  <p className="font-bold text-foreground">
                    Emergency Active
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {currentStatus.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              {currentStatus !== 'arrived_at_hospital' && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10">
                  <span className="w-2 h-2 rounded-full animate-pulse bg-primary" />
                  <span className="text-sm font-medium text-primary">
                    In Progress
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <div className={`${isSidebarOpen ? 'w-96' : 'w-0'
          } transition-all duration-300 overflow-hidden flex-shrink-0 border-r border-primary/20 bg-primary/5 backdrop-blur-xl text-foreground`}>
          <div className="h-full overflow-y-auto p-6 space-y-6">
            {/* Voice Recorder */}
            <VoiceRecorder onSymptomAnalysis={handleSymptomAnalysis} />

            {/* Quick Dispatch */}
            {patientData && matchedHospitals.length > 0 && currentStatus === 'processing' && (
              <AnimatedButton
                variant="danger"
                size="lg"
                className="w-full text-lg py-4"
                onClick={handleQuickDispatch}
                icon={<AlertCircle className="w-6 h-6" />}
              >
                Emergency Dispatch Now
              </AnimatedButton>
            )}

            {/* Vital Signs */}
            {vitals && (
              <VitalSignsPanel vitals={vitals} realtime={currentStatus !== 'idle'} />
            )}

            {/* Journey Tracker */}
            {currentStatus !== 'idle' && currentStatus !== 'processing' && selectedHospitalId && (
              <JourneyTracker
                currentStatus={currentStatus}
                driverName="Dr. Sarah Johnson"
                vehicleNumber="AMB-2024"
                hospitalName={matchedHospitals.find(m => m.hospital.id === selectedHospitalId)?.hospital.name}
                eta={currentStatus === 'arrived_at_hospital' ? 'Arrived' : '8 mins'}
              />
            )}
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="w-full h-full" />

          {/* Hospital Matches Overlay */}
          {matchedHospitals.length > 0 && (
            <div className="absolute top-4 right-4 w-96 max-h-[80vh] overflow-y-auto">
              <HospitalMatchPanel
                matches={matchedHospitals}
                onSelectHospital={handleSelectHospital}
                selectedHospitalId={selectedHospitalId}
              />
            </div>
          )}

          {/* Welcome Overlay */}
          {currentStatus === 'idle' && !isSidebarOpen && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="max-w-md rounded-3xl p-12 backdrop-blur-xl border border-border pointer-events-auto bg-card/50 shadow-2xl">
                <div className="text-center space-y-6">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 rounded-full blur-2xl bg-primary/30" />
                    <div className="relative w-24 h-24 mx-auto rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl">
                      <span className="text-5xl">🎤</span>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-3xl font-bold mb-3 text-foreground">
                      Get Immediate Help
                    </h2>
                    <p className="text-base text-muted-foreground">
                      Open the sidebar and describe your symptoms using voice
                    </p>
                  </div>

                  <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="px-6 py-3 rounded-xl font-semibold transition-all bg-primary text-primary-foreground shadow-lg hover:scale-105"
                  >
                    Open Controls
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
