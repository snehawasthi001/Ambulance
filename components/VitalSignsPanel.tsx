'use client';

import React, { useEffect, useState } from 'react';
import { Heart, Activity, Droplet, Thermometer, Wind, Zap } from 'lucide-react';
import { GlassmorphicCard } from './ui/glassmorphic-card';
import { VitalSigns } from '@/types';
import { VitalSimulator } from '@/lib/vitalSimulator';

interface VitalSignsPanelProps {
    vitals: VitalSigns;
    realtime?: boolean;
}

export function VitalSignsPanel({ vitals: initialVitals, realtime = false }: VitalSignsPanelProps) {
    const [vitals, setVitals] = useState(initialVitals);
    const [abnormalities, setAbnormalities] = useState<string[]>([]);

    useEffect(() => {
        setVitals(initialVitals);
        const { abnormalities: detected } = VitalSimulator.isAbnormal(initialVitals);
        setAbnormalities(detected);
    }, [initialVitals]);

    // Real-time updates simulation
    useEffect(() => {
        if (!realtime) return;

        const interval = setInterval(() => {
            setVitals(prev => {
                const newVitals = VitalSimulator.simulateChange(prev, 'Moderate');
                const { abnormalities: detected } = VitalSimulator.isAbnormal(newVitals);
                setAbnormalities(detected);
                return newVitals;
            });
        }, 3000);

        return () => clearInterval(interval);
    }, [realtime]);

    const getStatusColor = (value: number, normal: [number, number]): string => {
        if (value < normal[0] || value > normal[1]) return 'text-red-400';
        return 'text-green-400';
    };

    const vitalCards = [
        {
            icon: Heart,
            label: 'Heart Rate',
            value: vitals.heartRate,
            unit: 'bpm',
            normal: [60, 100] as [number, number],
            color: 'from-red-500 to-pink-500'
        },
        {
            icon: Activity,
            label: 'Blood Pressure',
            value: `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}`,
            unit: 'mmHg',
            normal: [90, 140] as [number, number],
            color: 'from-purple-500 to-indigo-500',
            checkValue: vitals.bloodPressure.systolic
        },
        {
            icon: Droplet,
            label: 'Oxygen Saturation',
            value: vitals.oxygenSaturation,
            unit: '%',
            normal: [95, 100] as [number, number],
            color: 'from-blue-500 to-cyan-500'
        },
        {
            icon: Thermometer,
            label: 'Temperature',
            value: vitals.temperature.toFixed(1),
            unit: '°C',
            normal: [36, 37.5] as [number, number],
            color: 'from-orange-500 to-red-500'
        },
        {
            icon: Wind,
            label: 'Respiratory Rate',
            value: vitals.respiratoryRate,
            unit: '/min',
            normal: [12, 20] as [number, number],
            color: 'from-teal-500 to-green-500'
        },
        ...(vitals.glucoseLevel ? [{
            icon: Zap,
            label: 'Glucose Level',
            value: vitals.glucoseLevel,
            unit: 'mg/dL',
            normal: [70, 140] as [number, number],
            color: 'from-yellow-500 to-amber-500'
        }] : [])
    ];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Activity className="w-6 h-6" />
                    Vital Signs
                    {realtime && (
                        <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full border border-green-500/30">
                            Live
                        </span>
                    )}
                </h3>
                <span className="text-xs text-white/50">
                    {new Date(vitals.timestamp).toLocaleTimeString()}
                </span>
            </div>

            {/* Abnormalities Alert */}
            {abnormalities.length > 0 && (
                <GlassmorphicCard className="p-4 bg-red-500/20 border-red-500/50">
                    <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 animate-pulse" />
                        <div>
                            <p className="text-red-200 font-semibold text-sm">Abnormal Readings Detected</p>
                            <ul className="text-red-300 text-xs mt-1 space-y-0.5">
                                {abnormalities.map((abn, idx) => (
                                    <li key={idx}>• {abn}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </GlassmorphicCard>
            )}

            {/* Vital Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {vitalCards.map((vital, idx) => {
                    const Icon = vital.icon;
                    const checkValue = vital.checkValue || vital.value;
                    const isAbnormal = typeof checkValue === 'number' &&
                        (checkValue < vital.normal[0] || checkValue > vital.normal[1]);

                    return (
                        <GlassmorphicCard
                            key={idx}
                            className={`p-4 ${isAbnormal ? 'border-red-500/50 bg-red-500/10' : ''}`}
                            hover={false}
                        >
                            <div className="space-y-2">
                                {/* Icon and Label */}
                                <div className="flex items-center justify-between">
                                    <div className={`p-2 rounded-lg bg-gradient-to-br ${vital.color}`}>
                                        <Icon className="w-4 h-4 text-white" />
                                    </div>
                                    {isAbnormal && (
                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                    )}
                                </div>

                                {/* Value */}
                                <div>
                                    <p className={`text-2xl font-bold ${isAbnormal ? 'text-red-400' : 'text-white'
                                        }`}>
                                        {vital.value}
                                    </p>
                                    <p className="text-xs text-white/50">{vital.unit}</p>
                                </div>

                                {/* Label */}
                                <p className="text-xs text-white/70 font-medium">{vital.label}</p>

                                {/* Normal Range */}
                                <p className="text-xs text-white/40">
                                    Normal: {vital.normal[0]}-{vital.normal[1]}
                                </p>
                            </div>
                        </GlassmorphicCard>
                    );
                })}
            </div>

            {/* Overall Status */}
            <GlassmorphicCard className="p-4">
                <div className="flex items-center justify-between">
                    <span className="text-white/70 text-sm">Overall Status:</span>
                    <span className={`font-semibold ${abnormalities.length === 0 ? 'text-green-400' :
                            abnormalities.length <= 2 ? 'text-yellow-400' :
                                'text-red-400'
                        }`}>
                        {abnormalities.length === 0 ? 'Stable' :
                            abnormalities.length <= 2 ? 'Monitoring Required' :
                                'Critical - Immediate Attention'}
                    </span>
                </div>
            </GlassmorphicCard>
        </div>
    );
}
