'use client';

import { useState } from 'react';
import { JourneySimulation } from '@/lib/safepath-engine';
import { Sparkles, Bot, AlertCircle } from 'lucide-react';
import Markdown from 'react-markdown';

interface AiAdvisorPanelProps {
  simulation: JourneySimulation;
}

export default function AiAdvisorPanel({ simulation }: AiAdvisorPanelProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAiAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: simulation.origin,
          destination: simulation.destination,
          timeOfDay: simulation.timeOfDay,
          strategies: simulation.strategies,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch AI analysis');
      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-900 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center space-x-2 text-slate-900">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>AI Safety & Route Advisor (Powered by Gemini)</span>
          </h3>
          <p className="text-xs text-slate-500">
            Get expert AI-driven multi-objective route trade-off explanations, risk factors, and emergency preparedness guidance for Bangalore.
          </p>
        </div>

        <button
          onClick={fetchAiAnalysis}
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 font-bold text-white text-xs shadow-md shadow-amber-500/20 transition flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Analyzing Bangalore Route...</span>
            </>
          ) : (
            <>
              <Bot className="w-4 h-4" />
              <span>Generate AI Safety Brief</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {analysis ? (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 prose max-w-none text-sm leading-relaxed text-slate-800">
          <Markdown>{analysis}</Markdown>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
            <Sparkles className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-900 text-sm">Ready for AI Safety Analysis</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Click &ldquo;Generate AI Safety Brief&rdquo; above to analyze the current Bangalore journey ({simulation.origin} to {simulation.destination}) under {simulation.timeOfDay} conditions.
          </p>
        </div>
      )}
    </div>
  );
}
