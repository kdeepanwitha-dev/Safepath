'use client';

import { BookOpen, Shield, Code, Database, CheckCircle, Award } from 'lucide-react';

export default function EducationalGuide() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-900 shadow-sm space-y-6">
      <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-600/20 text-white">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Experiential Learning & Technical Guide</h3>
          <p className="text-xs text-slate-500">Personal Safety Route Planner Academic & Engineering Documentation (Bangalore)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700">
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
          <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Problem Statement & Objectives</span>
          </h4>
          <p className="leading-relaxed">
            Many travellers in Bangalore—especially women, senior citizens, students, and lone commuters—struggle to identify safe routes because traditional navigation apps focus strictly on distance or travel time. SafePath introduces a multi-objective optimization framework that jointly optimizes travel time and safety factors.
          </p>
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center space-x-2 text-slate-800">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Mapped Lighting & Sidewalk coverage</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-800">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>CCTV coverage & Police/Emergency proximity</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-800">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Road isolation & Historical incident risk</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
          <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
            <Code className="w-4 h-4 text-blue-600" />
            <span>Multi-Objective Optimization Formula</span>
          </h4>
          <p className="leading-relaxed">
            For each edge $e$ in the Bangalore graph network, adjusted routing cost is calculated as:
          </p>
          <div className="bg-white p-3 rounded-xl font-mono text-emerald-700 text-[11px] border border-slate-200 shadow-inner">
            Cost = Length × (1 + λ × (100 - SafetyScore) / 100)
          </div>
          <p className="leading-relaxed">
            Where $\lambda$ represents the user&apos;s safety prioritization weight. This penalizes low-scoring segments while preserving feasible routes without excessive detours.
          </p>
        </div>

        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
          <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
            <Database className="w-4 h-4 text-purple-600" />
            <span>Comparison of 4 Routing Strategies</span>
          </h4>
          <ul className="space-y-2">
            <li><strong className="text-slate-900">1. Shortest/Fastest:</strong> Minimizes distance; ignores environmental safety.</li>
            <li><strong className="text-slate-900">2. Safety-Only:</strong> Maximizes safety metrics but often causes impractical detours.</li>
            <li><strong className="text-slate-900">3. Fixed Weighted:</strong> Combines distance and safety linearly with static weights.</li>
            <li><strong className="text-slate-900">4. Adaptive Multi-Objective:</strong> Dynamically balances time penalties with risk thresholds (Recommended).</li>
          </ul>
        </div>

        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
          <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
            <Award className="w-4 h-4 text-amber-600" />
            <span>Python & Web Concepts Demonstrated</span>
          </h4>
          <p className="leading-relaxed">
            This project demonstrates core computer science and engineering concepts including graph traversal (Dijkstra / NetworkX), spatial indexing (KDTree), data normalisation, conditional weighting, and interactive satellite map visualisation across Bangalore.
          </p>
        </div>
      </div>
    </div>
  );
}
