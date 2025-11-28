'use client';

import React, { useState } from 'react';
import { Building2, MapPin, Star, Users, Bed, Droplets, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { GlassmorphicCard } from './ui/glassmorphic-card';
import { AnimatedButton } from './ui/animated-button';
import { HospitalMatch } from '@/types';

interface HospitalMatchPanelProps {
    matches: HospitalMatch[];
    onSelectHospital: (hospital: HospitalMatch) => void;
    selectedHospitalId?: string;
}

export function HospitalMatchPanel({ matches, onSelectHospital, selectedHospitalId }: HospitalMatchPanelProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (matches.length === 0) {
        return (
            <GlassmorphicCard className="p-6">
                <div className="text-center text-gray-600 dark:text-white/70">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No hospitals matched yet</p>
                    <p className="text-sm mt-1">Record your symptoms to find suitable hospitals</p>
                </div>
            </GlassmorphicCard>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-6 h-6" />
                    Matched Hospitals
                </h3>
                <span className="text-sm text-gray-600 dark:text-white/70 font-medium">{matches.length} found</span>
            </div>

            <div className="space-y-3">
                {matches.slice(0, 5).map((match, idx) => {
                    const isExpanded = expandedId === match.hospital.id;
                    const isSelected = selectedHospitalId === match.hospital.id;

                    return (
                        <GlassmorphicCard
                            key={match.hospital.id}
                            className={`p-4 transition-all ${isSelected ? 'border-green-500/70 bg-green-100/50 dark:bg-green-500/10' : ''
                                }`}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    {/* Rank Badge */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`
                      px-2 py-1 rounded-full text-xs font-bold
                      ${idx === 0 ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' :
                                                idx === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-white' :
                                                    idx === 2 ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white' :
                                                        'bg-gray-200 dark:bg-white/20 text-gray-700 dark:text-white/70'}
                    `}>
                                            #{idx + 1}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-white/50">
                                            {match.hospital.primarySpecialization}
                                        </span>
                                    </div>

                                    {/* Hospital Name */}
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                                        {match.hospital.name}
                                    </h4>

                                    {/* Quick Info */}
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-white/70">
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3" />
                                            {match.distance.toFixed(1)} km
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                            {match.hospital.rating}
                                        </span>
                                        <span className="text-green-600 dark:text-green-400 font-medium">
                                            ETA: {match.eta} min
                                        </span>
                                    </div>
                                </div>

                                {/* Match Score */}
                                <div className="text-center">
                                    <div className={`
                    w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg
                    ${match.score >= 80 ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                                            match.score >= 60 ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                                                'bg-gradient-to-br from-gray-500 to-gray-600'}
                    text-white shadow-lg
                  `}>
                                        {match.score}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-white/50 mt-1">Match</p>
                                </div>
                            </div>

                            {/* Match Reasons */}
                            <div className="mt-3 space-y-1">
                                {match.matchReasons.slice(0, isExpanded ? undefined : 2).map((reason: string, reasonIdx: number) => (
                                    <div key={reasonIdx} className="flex items-start gap-2 text-xs text-gray-700 dark:text-white/80">
                                        <Check className="w-3 h-3 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                        <span>{reason}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Availability Indicators */}
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs ${match.availabilityStatus.beds
                                        ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                                        : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
                                    }`}>
                                    <Bed className="w-3 h-3 inline mr-1" />
                                    Beds
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs ${match.availabilityStatus.doctors
                                        ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                                        : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
                                    }`}>
                                    <Users className="w-3 h-3 inline mr-1" />
                                    Doctors
                                </span>
                                {match.availabilityStatus.blood && (
                                    <span className="px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300">
                                        <Droplets className="w-3 h-3 inline mr-1" />
                                        Blood
                                    </span>
                                )}
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10 space-y-3">
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-white/50 mb-1 font-medium">Facilities</p>
                                        <div className="flex flex-wrap gap-1">
                                            {match.hospital.facilities.map((facility: string, facilityIdx: number) => (
                                                <span key={facilityIdx} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded text-xs">
                                                    {facility}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-white/50 mb-1 font-medium">Contact</p>
                                        <p className="text-sm text-gray-900 dark:text-white font-medium">{match.hospital.contactNumber}</p>
                                        <p className="text-xs text-gray-600 dark:text-white/70 mt-1">{match.hospital.address}</p>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-gray-100 dark:bg-white/5 rounded p-2">
                                            <p className="text-xs text-gray-500 dark:text-white/50">General Beds</p>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{match.hospital.beds.general.available}/{match.hospital.beds.general.total}</p>
                                        </div>
                                        <div className="bg-gray-100 dark:bg-white/5 rounded p-2">
                                            <p className="text-xs text-gray-500 dark:text-white/50">ICU Beds</p>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{match.hospital.beds.icu.available}/{match.hospital.beds.icu.total}</p>
                                        </div>
                                        <div className="bg-gray-100 dark:bg-white/5 rounded p-2">
                                            <p className="text-xs text-gray-500 dark:text-white/50">Emergency</p>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{match.hospital.beds.emergency.available}/{match.hospital.beds.emergency.total}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="mt-4 flex gap-2">
                                <AnimatedButton
                                    variant={isSelected ? 'success' : 'primary'}
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => onSelectHospital(match)}
                                    disabled={isSelected}
                                >
                                    {isSelected ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Selected
                                        </>
                                    ) : (
                                        'Select Hospital'
                                    )}
                                </AnimatedButton>

                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : match.hospital.id)}
                                    className="px-3 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 rounded-full transition-colors"
                                >
                                    {isExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-gray-700 dark:text-white" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-gray-700 dark:text-white" />
                                    )}
                                </button>
                            </div>
                        </GlassmorphicCard>
                    );
                })}
            </div>
        </div>
    );
}
