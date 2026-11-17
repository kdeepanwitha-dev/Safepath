'use client';

import { JourneySimulation } from '@/lib/safepath-engine';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { BarChart3, ShieldCheck, Sliders } from 'lucide-react';

interface MultiObjectiveAnalysisProps {
  simulation: JourneySimulation;
}

export default function MultiObjectiveAnalysis({ simulation }: MultiObjectiveAnalysisProps) {
  const comparisonData = simulation.strategies.map((s) => ({
    name: s.name.split('.')[1] || s.name,
    safetyScore: s.safetyScore,
    travelTimeMin: s.travelTimeMin,
    distanceKm: s.distanceKm,
    highRisk: s.highRiskSegmentsCount,
  }));

  return (
    <div className="space-y-6 text-slate-900">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold flex items-center space-x-2 text-slate-900">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <span>Multi-Objective Optimization Trade-off Analysis</span>
            </h3>
            <p className="text-xs text-slate-500">
              Evaluating safety score (higher is safer) vs travel time (minutes) and high-risk segments across all 4 strategies in Bangalore.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Safety Score vs Travel Time Bar Chart */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center space-x-2 text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
              <span>Safety Score (0-100) vs Travel Time (min)</span>
            </h4>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', fontSize: '12px', color: '#0f172a' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="safetyScore" name="Safety Score" fill="#059669" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="travelTimeMin" name="Travel Time (min)" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sensitivity Analysis Line Chart */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center space-x-2 text-purple-700">
              <Sliders className="w-4 h-4" />
              <span>Sensitivity Analysis: Safety Weight ($\lambda$) vs Score</span>
            </h4>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simulation.sensitivityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="weight" stroke="#64748b" fontSize={11} label={{ value: 'Safety Weight (λ)', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 11 }} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', fontSize: '12px', color: '#0f172a' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="shortestScore" name="Shortest" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="safetyOnlyScore" name="Safety-Only" stroke="#dc2626" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fixedScore" name="Fixed Weighted" stroke="#d97706" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="adaptiveScore" name="Adaptive (Proposed)" stroke="#059669" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
