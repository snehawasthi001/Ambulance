'use client';

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { useEmergencyStore } from '@/lib/store';
import { geminiService } from '@/lib/geminiService';

interface VoiceRecorderProps {
    onSymptomAnalysis?: (analysis: any) => void;
}

export function VoiceRecorder({ onSymptomAnalysis }: VoiceRecorderProps) {
    const { isRecording, transcript, isSupported, error, startRecording, stopRecording, resetTranscript } = useVoiceRecording();
    const { setVoiceTranscript, setIsRecording: setStoreRecording } = useEmergencyStore();
    const [isProcessing, setIsProcessing] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);

    useEffect(() => {
        setStoreRecording(isRecording);
        setVoiceTranscript(transcript);
    }, [isRecording, transcript, setStoreRecording, setVoiceTranscript]);

    useEffect(() => {
        if (isRecording) {
            const interval = setInterval(() => {
                setAudioLevel(Math.random() * 100);
            }, 100);
            return () => clearInterval(interval);
        } else {
            setAudioLevel(0);
        }
    }, [isRecording]);

    const handleStartRecording = () => {
        resetTranscript();
        startRecording();
    };

    const handleStopAndProcess = async () => {
        stopRecording();

        if (transcript.trim()) {
            setIsProcessing(true);
            try {
                const analysis = await geminiService.analyzeSymptoms(transcript);
                if (onSymptomAnalysis) {
                    onSymptomAnalysis(analysis);
                }
            } catch (err) {
                console.error('Error analyzing symptoms:', err);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleQuickDispatch = () => {
        if (transcript.trim()) {
            handleStopAndProcess();
        }
    };

    if (!isSupported) {
        return (
            <div className="rounded-2xl p-6 backdrop-blur-xl border bg-white/60 dark:bg-white/5 border-gray-200 dark:border-white/10 shadow-xl">
                <div className="text-center">
                    <MicOff className="w-12 h-12 mx-auto mb-3 text-red-600 dark:text-red-400" />
                    <p className="text-gray-900 dark:text-white font-medium">Voice recording not supported</p>
                    <p className="text-gray-600 dark:text-white/70 text-sm mt-2">Please use Chrome or Edge browser</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-2xl p-6 backdrop-blur-xl border bg-white/60 dark:bg-white/5 border-gray-200 dark:border-white/10 shadow-xl space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Mic className="w-5 h-5" />
                        Describe Your Symptoms
                    </h3>
                    {isRecording && (
                        <span className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 animate-pulse font-medium">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                            Recording...
                        </span>
                    )}
                </div>

                {/* Microphone Button */}
                <div className="flex justify-center py-6">
                    <button
                        onClick={isRecording ? stopRecording : handleStartRecording}
                        disabled={isProcessing}
                        className={`
              relative w-24 h-24 rounded-full transition-all duration-300 transform
              ${isRecording
                                ? 'bg-gradient-to-br from-red-500 to-red-600 scale-110 shadow-2xl shadow-red-500/50'
                                : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:scale-105 shadow-xl shadow-blue-500/50'
                            }
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-2xl active:scale-95'}
            `}
                    >
                        {isRecording && (
                            <>
                                <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
                                <span className="absolute inset-0 rounded-full bg-red-400 animate-pulse opacity-50" />
                            </>
                        )}

                        <div className="relative z-10 flex items-center justify-center h-full">
                            {isProcessing ? (
                                <Loader2 className="w-10 h-10 text-white animate-spin" />
                            ) : isRecording ? (
                                <MicOff className="w-10 h-10 text-white" />
                            ) : (
                                <Mic className="w-10 h-10 text-white" />
                            )}
                        </div>
                    </button>
                </div>

                {/* Audio Visualizer */}
                {isRecording && (
                    <div className="flex items-center justify-center gap-1 h-16">
                        {[...Array(20)].map((_, i) => (
                            <div
                                key={i}
                                className="w-1 bg-gradient-to-t from-blue-500 to-purple-500 rounded-full transition-all duration-100"
                                style={{
                                    height: `${Math.max(10, (audioLevel + Math.random() * 30))}%`,
                                    opacity: 0.7 + Math.random() * 0.3
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Transcript Display - Real-time */}
                {transcript && (
                    <div className="bg-gray-100 dark:bg-black/30 rounded-xl p-4 max-h-32 overflow-y-auto border border-gray-200 dark:border-white/10">
                        <p className="text-sm text-gray-800 dark:text-white/90 leading-relaxed">
                            {transcript}
                            {isRecording && <span className="animate-pulse">|</span>}
                        </p>
                    </div>
                )}

                {/* Instructions */}
                {!isRecording && !transcript && (
                    <div className="text-center text-gray-600 dark:text-white/70 text-sm space-y-2">
                        <p className="font-medium">Click the microphone to start recording</p>
                        <p className="text-xs text-gray-500 dark:text-white/50">Describe your symptoms, pain level, and any medical concerns</p>
                    </div>
                )}

                {/* Error Display */}
                {error && error !== 'Error: no-speech' && (
                    <div className="bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/50 rounded-lg p-3">
                        <p className="text-red-700 dark:text-red-200 text-sm font-medium">{error}</p>
                    </div>
                )}

                {/* Processing Indicator */}
                {isProcessing && (
                    <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-300">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-medium">Analyzing symptoms with AI...</span>
                    </div>
                )}
            </div>

            {/* Quick Dispatch Button - Shows when there's transcript */}
            {transcript && !isRecording && !isProcessing && (
                <button
                    onClick={handleQuickDispatch}
                    className="w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all transform hover:scale-105 active:scale-95 bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-2xl shadow-red-500/50 flex items-center justify-center gap-3"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Quick Dispatch Emergency
                </button>
            )}
        </div>
    );
}
