'use client';

import React from 'react';
import { MapPin, Navigation, Building2, CheckCircle2, Clock } from 'lucide-react';
import { GlassmorphicCard } from './ui/glassmorphic-card';
import { EmergencyStatus } from '@/types';

interface JourneyStage {
    status: EmergencyStatus;
    label: string;
    icon: React.ReactNode;
    description: string;
}

interface JourneyTrackerProps {
    currentStatus: EmergencyStatus;
    driverName?: string;
    vehicleNumber?: string;
    hospitalName?: string;
    eta?: string;
    stages?: JourneyStage[];
}

const defaultStages: JourneyStage[] = [
    {
        status: 'dispatching',
        label: 'Ambulance Dispatched',
        icon: <Navigation className="w-4 h-4" />,
        description: 'Finding nearest ambulance'
    },
    {
        status: 'ambulance_en_route_to_patient',
        label: 'En Route to You',
        icon: <MapPin className="w-4 h-4" />,
        description: 'Ambulance is on the way'
    },
    {
        status: 'patient_picked_up',
        label: 'Patient Picked Up',
        icon: <CheckCircle2 className="w-4 h-4" />,
        description: 'Patient secured in ambulance'
    },
    {
        status: 'en_route_to_hospital',
        label: 'En Route to Hospital',
        icon: <Building2 className="w-4 h-4" />,
        description: 'Heading to medical facility'
    },
    {
        status: 'arriving_at_hospital',
        label: 'Arriving Soon',
        icon: <Clock className="w-4 h-4" />,
        description: 'Almost at hospital'
    },
    {
        status: 'arrived_at_hospital',
        label: 'Arrived',
        icon: <CheckCircle2 className="w-4 h-4" />,
        description: 'Reached hospital'
    }
];

export function JourneyTracker({
    currentStatus,
    driverName,
    vehicleNumber,
    hospitalName,
    eta,
    stages = defaultStages
}: JourneyTrackerProps) {
    const currentStageIndex = stages.findIndex(s => s.status === currentStatus);
    const isCompleted = currentStatus === 'arrived_at_hospital' || currentStatus === 'completed';

    return (
        <GlassmorphicCard className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Navigation className="w-6 h-6" />
                        Journey Tracker
                    </h3>
                    {eta && !isCompleted && (
                        <p className="text-sm text-muted-foreground mt-1">ETA: {eta}</p>
                    )}
                </div>
                {isCompleted && (
                    <div className="bg-green-500/20 text-green-500 px-3 py-1 rounded-full text-sm font-medium border border-green-500/30">
                        Completed
                    </div>
                )}
            </div>

            {/* Driver & Vehicle Info */}
            {(driverName || vehicleNumber) && (
                <div className="flex items-center justify-between bg-muted/20 rounded-xl p-3">
                    <div>
                        {driverName && (
                            <p className="text-foreground font-medium">{driverName}</p>
                        )}
                        {vehicleNumber && (
                            <p className="text-muted-foreground text-sm">{vehicleNumber}</p>
                        )}
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-xl">
                        🚑
                    </div>
                </div>
            )}

            {/* Hospital Info */}
            {hospitalName && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                    <p className="text-xs text-blue-500 mb-1">Destination</p>
                    <p className="text-foreground font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {hospitalName}
                    </p>
                </div>
            )}

            {/* Timeline */}
            <div className="relative">
                {stages.map((stage, idx) => {
                    const isActive = idx === currentStageIndex;
                    const isPast = idx < currentStageIndex;
                    const isFuture = idx > currentStageIndex;

                    return (
                        <div key={stage.status} className="relative">
                            {/* Connector Line */}
                            {idx < stages.length - 1 && (
                                <div className="absolute left-5 top-10 w-0.5 h-12 -ml-px">
                                    <div className={`h-full transition-all duration-500 ${isPast ? 'bg-gradient-to-b from-green-500 to-green-400' :
                                        isActive ? 'bg-gradient-to-b from-blue-500 to-transparent' :
                                            'bg-muted-foreground/20'
                                        }`} />
                                </div>
                            )}

                            {/* Stage Item */}
                            <div className="flex items-start gap-4 pb-4">
                                {/* Icon */}
                                <div className={`
                  relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                  ${isPast ? 'bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/50' :
                                        isActive ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/50 scale-110' :
                                            'bg-muted/20 border-2 border-muted-foreground/20'}
                `}>
                                    {isPast ? (
                                        <CheckCircle2 className="w-5 h-5 text-white" />
                                    ) : (
                                        <div className={isActive ? 'text-white' : 'text-muted-foreground'}>{stage.icon}</div>
                                    )}

                                    {/* Pulse Animation for Active */}
                                    {isActive && (
                                        <>
                                            <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
                                            <span className="absolute inset-0 rounded-full bg-blue-400 animate-pulse opacity-50" />
                                        </>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 pt-1">
                                    <p className={`font-semibold ${isPast ? 'text-green-500' :
                                        isActive ? 'text-foreground' :
                                            'text-muted-foreground'
                                        }`}>
                                        {stage.label}
                                    </p>
                                    <p className={`text-sm mt-0.5 ${isActive ? 'text-muted-foreground' : 'text-muted-foreground/60'
                                        }`}>
                                        {stage.description}
                                    </p>

                                    {/* Active Indicator */}
                                    {isActive && (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-blue-500">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                            In Progress
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Progress Bar */}
            <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>Progress</span>
                    <span>{Math.round((currentStageIndex / (stages.length - 1)) * 100)}%</span>
                </div>
                <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500 rounded-full"
                        style={{ width: `${(currentStageIndex / (stages.length - 1)) * 100}%` }}
                    />
                </div>
            </div>
        </GlassmorphicCard>
    );
}
