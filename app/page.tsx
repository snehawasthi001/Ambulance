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

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export default function IntegratedEmergencyDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(true);
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
            style: isDarkMode ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
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
            style: isDarkMode ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
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

  // Update map style when theme changes
  useEffect(() => {
    if (map.current) {
      map.current.setStyle(isDarkMode ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11');
    }
  }, [isDarkMode]);

  // Animate ambulance movement
  useEffect(() => {
    if (currentStatus === 'ambulance_en_route_to_patient' || currentStatus === 'en_route_to_hospital') {
      const interval = setInterval(() => {
        setAmbulancePosition(prev => {
          if (!prev || !userLocation) return prev;

          const target = currentStatus === 'ambulance_en_route_to_patient'
            ? userLocation
            : selectedHospitalId
              ? hospitals.find(h => h.id === selectedHospitalId)?.location || prev
              : prev;

          // Move towards target
          const dx = (target[0] - prev[0]) * 0.05;
          const dy = (target[1] - prev[1]) * 0.05;
          const newPos: [number, number] = [prev[0] + dx, prev[1] + dy];

          // Update marker
          if (ambulanceMarker.current) {
            ambulanceMarker.current.setLngLat(newPos);
          } else if (map.current) {
            const el = document.createElement('div');
            el.innerHTML = '🚑';
            el.style.fontSize = '32px';
            ambulanceMarker.current = new mapboxgl.Marker(el)
              .setLngLat(newPos)
              .addTo(map.current);
          }

          return newPos;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [currentStatus, userLocation, selectedHospitalId, hospitals]);

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

  const handleSelectHospital = (match: any) => {
    setSelectedHospitalId(match.hospital.id);
    setCurrentStatus('dispatching');

    // Zoom to hospital
    if (map.current) {
      map.current.flyTo({
        center: match.hospital.location,
        zoom: 14,
        duration: 2000
      });
    }

    setTimeout(() => {
      setCurrentStatus('ambulance_en_route_to_patient');
      setTimeout(() => {
        setCurrentStatus('patient_picked_up');
        setTimeout(() => {
          setCurrentStatus('en_route_to_hospital');
          setTimeout(() => {
            setCurrentStatus('arriving_at_hospital');
            setTimeout(() => {
              setCurrentStatus('arrived_at_hospital');
            }, 3000);
          }, 5000);
        }, 3000);
      }, 5000);
    }, 2000);
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
    <div className={`h-screen flex flex-col overflow-hidden transition-colors duration-500 ${isDarkMode
      ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
      : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
      }`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors ${isDarkMode
        ? 'bg-slate-900/50 border-white/10'
        : 'bg-white/50 border-gray-200/50'
        }`}>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`p-2 rounded-xl transition-all ${isDarkMode
                  ? 'bg-white/5 hover:bg-white/10 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
              >
                {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode
                ? 'bg-gradient-to-br from-red-500 to-pink-600'
                : 'bg-gradient-to-br from-red-500 to-pink-500'
                } shadow-lg shadow-red-500/50`}>
                <span className="text-2xl">🚑</span>
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                  Emergency Response
                </h1>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                  AI-Powered Medical Dispatch
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <button className={`p-3 rounded-xl transition-all ${isDarkMode
                ? 'bg-white/5 hover:bg-white/10 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                } border ${isDarkMode ? 'border-white/10' : 'border-gray-200'
                }`}>
                <Phone className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-3 rounded-xl transition-all ${isDarkMode
                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white'
                  : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                  } shadow-lg hover:scale-105`}
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Status Banner */}
      {currentStatus !== 'idle' && (
        <div className="px-6 py-3 z-40">
          <div className={`rounded-2xl p-4 backdrop-blur-xl border ${isDarkMode
            ? 'bg-blue-500/10 border-blue-500/30'
            : 'bg-blue-100/80 border-blue-300/50'
            }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${currentStatus === 'arrived_at_hospital'
                  ? isDarkMode ? 'bg-green-500/20' : 'bg-green-100'
                  : isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
                  }`}>
                  <Activity className={`w-6 h-6 ${currentStatus === 'arrived_at_hospital'
                    ? isDarkMode ? 'text-green-400' : 'text-green-600'
                    : isDarkMode ? 'text-blue-400 animate-pulse' : 'text-blue-600 animate-pulse'
                    }`} />
                </div>
                <div>
                  <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Emergency Active
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} capitalize`}>
                    {currentStatus.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              {currentStatus !== 'arrived_at_hospital' && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-200/50'
                  }`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${isDarkMode ? 'bg-blue-400' : 'bg-blue-600'
                    }`} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-700'
                    }`}>
                    In Progress
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className={`${isSidebarOpen ? 'w-96' : 'w-0'
          } transition-all duration-300 overflow-hidden flex-shrink-0`}>
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
              <div className={`max-w-md rounded-3xl p-12 backdrop-blur-xl border pointer-events-auto ${isDarkMode
                ? 'bg-gradient-to-br from-white/5 to-white/10 border-white/10'
                : 'bg-gradient-to-br from-white/80 to-white/60 border-gray-200/50'
                } shadow-2xl`}>
                <div className="text-center space-y-6">
                  <div className="relative inline-block">
                    <div className={`absolute inset-0 rounded-full blur-2xl ${isDarkMode ? 'bg-blue-500/30' : 'bg-blue-400/30'
                      }`} />
                    <div className={`relative w-24 h-24 mx-auto rounded-full flex items-center justify-center ${isDarkMode
                      ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                      : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                      } shadow-2xl`}>
                      <span className="text-5xl">🎤</span>
                    </div>
                  </div>

                  <div>
                    <h2 className={`text-3xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                      Get Immediate Help
                    </h2>
                    <p className={`text-base ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                      Open the sidebar and describe your symptoms using voice
                    </p>
                  </div>

                  <button
                    onClick={() => setIsSidebarOpen(true)}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all ${isDarkMode
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                      } shadow-lg hover:scale-105`}
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
