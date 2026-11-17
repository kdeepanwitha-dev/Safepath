'use client';

import { Shield, Compass, Sparkles, BookOpen, BarChart3, Activity } from 'lucide-react';

interface HeaderProps {
  activeTab: 'planner' | 'comparison' | 'robustness' | 'ai' | 'guide';
  setActiveTab: (tab: 'planner' | 'comparison' | 'robustness' | 'ai' | 'guide') => void;
}

export default function Header({ activeTab, setActiveTab }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 text-slate-900 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('planner')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-600/20 text-white">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-700 bg-clip-text text-transparent">
                SafePath Bangalore
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold">
                Satellite View
              </span>
            </div>
            <p className="text-xs text-slate-500">Personal Safety Route Planner & Multi-Objective Optimizer</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('planner')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
              activeTab === 'planner'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Route Planner</span>
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
              activeTab === 'comparison'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Multi-Objective & Sensitivity</span>
          </button>
          <button
            onClick={() => setActiveTab('robustness')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
              activeTab === 'robustness'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Robustness Simulator</span>
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
              activeTab === 'ai'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI Safety Advisor</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
              activeTab === 'guide'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Experiential Guide</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
