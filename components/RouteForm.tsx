'use client';

import { useState } from 'react';
import { BANGALORE_PRESETS } from '@/lib/safepath-engine';
import { Search, MapPin, Clock, Sliders, Moon, Sun, Sunset, CloudRain, CloudLightning } from 'lucide-react';

interface RouteFormProps {
  onCalculate: (
    origin: string,
    destination: string,
    cityPresetId: string,
    timeOfDay: 'day' | 'dusk' | 'night' | 'late_night',
    weatherCondition: 'clear' | 'drizzle' | 'moderate_rain' | 'heavy_monsoon' | 'thunderstorm',
    speed: number,
    weight: number
  ) => void;
  isLoading: boolean;
}

export default function RouteForm({ onCalculate, isLoading }: RouteFormProps) {
  const [selectedPreset, setSelectedPreset] = useState(BANGALORE_PRESETS[0].id);
  const [origin, setOrigin] = useState(BANGALORE_PRESETS[0].origin);
  const [destination, setDestination] = useState(BANGALORE_PRESETS[0].destination);
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'dusk' | 'night' | 'late_night'>('night');
  const [weatherCondition, setWeatherCondition] = useState<'clear' | 'drizzle' | 'moderate_rain' | 'heavy_monsoon' | 'thunderstorm'>('heavy_monsoon');
  const [walkingSpeed, setWalkingSpeed] = useState(4.5);
  const [safetyWeight, setSafetyWeight] = useState(1.8);

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = BANGALORE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setOrigin(preset.origin);
      setDestination(preset.destination);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) return;
    onCalculate(origin, destination, selectedPreset, timeOfDay, weatherCondition, walkingSpeed, safetyWeight);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-900 shadow-sm space-y-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold flex items-center space-x-2 text-slate-900">
            <Search className="w-5 h-5 text-emerald-600" />
            <span>Bangalore Route, Weather & Safety Parameters</span>
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Compare 4 optimization models across Bangalore incorporating rain density, waterlogging risk, lighting, density, and CCTV coverage.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Bangalore Journey Presets
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {BANGALORE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetChange(preset.id)}
                className={`p-3 rounded-xl text-left border text-xs font-medium transition flex flex-col justify-between ${
                  selectedPreset === preset.id
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm ring-1 ring-emerald-500/30'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span className="font-bold truncate w-full text-slate-900">{preset.id.replace('_', ' ').toUpperCase()}</span>
                <span className="text-[11px] text-slate-500 line-clamp-2 mt-1">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time of Day & Weather Condition */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Time of Day
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setTimeOfDay('day')}
                className={`py-2 rounded-lg text-xs font-medium flex flex-col items-center justify-center transition ${
                  timeOfDay === 'day' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5 mb-1" />
                <span>Day</span>
              </button>
              <button
                type="button"
                onClick={() => setTimeOfDay('dusk')}
                className={`py-2 rounded-lg text-xs font-medium flex flex-col items-center justify-center transition ${
                  timeOfDay === 'dusk' ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                <Sunset className="w-3.5 h-3.5 mb-1" />
                <span>Dusk</span>
              </button>
              <button
                type="button"
                onClick={() => setTimeOfDay('night')}
                className={`py-2 rounded-lg text-xs font-medium flex flex-col items-center justify-center transition ${
                  timeOfDay === 'night' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                <Moon className="w-3.5 h-3.5 mb-1" />
                <span>Night</span>
              </button>
              <button
                type="button"
                onClick={() => setTimeOfDay('late_night')}
                className={`py-2 rounded-lg text-xs font-medium flex flex-col items-center justify-center transition ${
                  timeOfDay === 'late_night' ? 'bg-purple-700 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                <Moon className="w-3.5 h-3.5 mb-1 text-purple-200" />
                <span>Late</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Bangalore Weather & Rain Density
            </label>
            <select
              value={weatherCondition}
              onChange={(e) => setWeatherCondition(e.target.value as any)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 transition"
            >
              <option value="clear">☀️ Clear & Dry</option>
              <option value="drizzle">🌦️ Light Drizzle</option>
              <option value="moderate_rain">🌧️ Moderate Rain</option>
              <option value="heavy_monsoon">⛈️ Heavy Monsoon Downpour (Waterlogging Risk)</option>
              <option value="thunderstorm">⚡ Severe Thunderstorm & Flooding</option>
            </select>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center space-x-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Starting Point (Bangalore)</span>
            </label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Enter start address or place in Bangalore"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center space-x-1.5">
              <MapPin className="w-4 h-4 text-red-600" />
              <span>Destination (Bangalore)</span>
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Enter destination address or place in Bangalore"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
              required
            />
          </div>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-700 flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Base Walking Speed</span>
              </span>
              <span className="font-bold text-emerald-700">{walkingSpeed} km/h</span>
            </div>
            <input
              type="range"
              min="3.0"
              max="6.0"
              step="0.5"
              value={walkingSpeed}
              onChange={(e) => setWalkingSpeed(parseFloat(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-700 flex items-center space-x-1.5">
                <Sliders className="w-4 h-4 text-purple-600" />
                <span>Safety Prioritization Weight ($\lambda$)</span>
              </span>
              <span className="font-bold text-emerald-700">{safetyWeight}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={safetyWeight}
              onChange={(e) => setSafetyWeight(parseFloat(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-bold text-white shadow-lg shadow-emerald-600/20 transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Optimizing Bangalore Routes with Weather Impact...</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>Compare 4 Routing Strategies & Optimize Bangalore Safety</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
