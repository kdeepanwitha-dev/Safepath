'use client';

import { JourneySimulation, RouteStrategyResult } from '@/lib/safepath-engine';
import { Shield, Clock, MapPin, AlertTriangle, Award } from 'lucide-react';

interface RouteComparisonCardsProps {
  simulation: JourneySimulation;
  activeStrategyId: string;
  onSelectStrategy: (id: string) => void;
}

export default function RouteComparisonCards({
  simulation,
  activeStrategyId,
  onSelectStrategy,
}: RouteComparisonCardsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            <span>Route Optimization Strategies Compared</span>
          </h3>
          <p className="text-xs text-slate-500">
            Click any strategy card to inspect its path and segment-by-segment safety breakdown on the satellite map.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {simulation.strategies.map((strategy) => {
          const isActive = activeStrategyId === strategy.id;
          const isAdaptive = strategy.id === 'adaptive';

          return (
            <div
              key={strategy.id}
              onClick={() => onSelectStrategy(strategy.id)}
              className={`cursor-pointer rounded-2xl p-5 border transition-all flex flex-col justify-between relative overflow-hidden ${
                isActive
                  ? 'bg-emerald-50/60 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              {isAdaptive && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-600 to-teal-600 text-white font-bold text-[10px] px-3 py-1 rounded-bl-xl shadow flex items-center space-x-1">
                  <Award className="w-3 h-3" />
                  <span>RECOMMENDED</span>
                </div>
              )}

              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: strategy.color }}
                  />
                  <h4 className="font-bold text-sm text-slate-900 truncate">{strategy.name}</h4>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 mb-4">{strategy.description}</p>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-500 flex items-center justify-center space-x-1">
                      <MapPin className="w-3 h-3 text-blue-600" />
                      <span>Dist</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5">{strategy.distanceKm} km</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-500 flex items-center justify-center space-x-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>Time</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5">{strategy.travelTimeMin} min</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-500 flex items-center justify-center space-x-1">
                      <Shield className="w-3 h-3 text-emerald-600" />
                      <span>Safety</span>
                    </div>
                    <div
                      className={`text-xs font-bold mt-0.5 ${
                        strategy.safetyScore >= 80
                          ? 'text-emerald-700'
                          : strategy.safetyScore >= 60
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}
                    >
                      {strategy.safetyScore}/100
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>High-Risk Segments:</span>
                  </span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full ${
                      strategy.highRiskSegmentsCount === 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {strategy.highRiskSegmentsCount}
                  </span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${strategy.safetyScore}%`,
                      backgroundColor: strategy.color,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
