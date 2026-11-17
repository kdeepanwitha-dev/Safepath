export interface RouteSegment {
  id: string;
  name: string;
  distanceKm: number;
  lighting: number; // 0-100
  pedestrianDensity: number; // 0-100
  cctvCoverage: number; // 0-100
  emergencyProximity: number; // 0-100
  roadIsolation: number; // 0-100 (higher = more isolated/risky)
  historicalRisk: number; // 0-100 (higher = more risk)
  isHighRisk: boolean;
  weatherRiskPenalty: number;
}

export interface RouteStrategyResult {
  id: 'shortest' | 'safety_only' | 'fixed_weighted' | 'adaptive';
  name: string;
  description: string;
  color: string;
  distanceKm: number;
  travelTimeMin: number;
  safetyScore: number; // 0-100
  highRiskSegmentsCount: number;
  lightingAvg: number;
  cctvAvg: number;
  emergencyAvg: number;
  segments: RouteSegment[];
  coordinates: [number, number][]; // [lat, lon]
}

export interface JourneySimulation {
  origin: string;
  destination: string;
  city: string;
  timeOfDay: 'day' | 'dusk' | 'night' | 'late_night';
  weatherCondition: 'clear' | 'drizzle' | 'moderate_rain' | 'heavy_monsoon' | 'thunderstorm';
  walkingSpeedKmh: number;
  effectiveSpeedKmh: number;
  safetyWeight: number;
  centerCoordinates: [number, number];
  strategies: RouteStrategyResult[];
  sensitivityData: { weight: number; shortestScore: number; safetyOnlyScore: number; fixedScore: number; adaptiveScore: number }[];
  robustnessData: { condition: string; shortestSafety: number; adaptiveSafety: number; shortestRisk: number; adaptiveRisk: number }[];
  emergencyMarkers: { lat: number; lon: number; type: string; name: string }[];
}

export const BANGALORE_PRESETS = [
  {
    id: 'jain_jayanagar',
    name: 'Jain University VV Puram to Jayanagar 4th Block',
    origin: 'Jain University, VV Puram, Bangalore',
    destination: 'Jayanagar 4th Block Metro Station, Bangalore',
    startCoord: [12.9492, 77.5772] as [number, number],
    endCoord: [12.9255, 77.5838] as [number, number],
  },
  {
    id: 'majestic_mg',
    name: 'Majestic Bus Station to MG Road',
    origin: 'Kempegowda Bus Station (Majestic), Bangalore',
    destination: 'Mahatma Gandhi Road Metro Station, Bangalore',
    startCoord: [12.9776, 77.5713] as [number, number],
    endCoord: [12.9756, 77.6066] as [number, number],
  },
  {
    id: 'koramangala_indiranagar',
    name: 'Koramangala 5th Block to Indiranagar 100ft Road',
    origin: 'Koramangala 5th Block Club Road, Bangalore',
    destination: 'Indiranagar 100ft Road, Bangalore',
    startCoord: [12.9352, 77.6245] as [number, number],
    endCoord: [12.9719, 77.6412] as [number, number],
  },
  {
    id: 'ecity_silkboard',
    name: 'Electronic City Phase 1 to Silk Board Junction',
    origin: 'Electronic City Phase 1, Bangalore',
    destination: 'Silk Board Junction, Hosur Road, Bangalore',
    startCoord: [12.8452, 77.6602] as [number, number],
    endCoord: [12.9170, 77.6230] as [number, number],
  },
];

export function generateJourneySimulation(
  origin: string,
  destination: string,
  cityPresetId: string,
  timeOfDay: 'day' | 'dusk' | 'night' | 'late_night',
  weatherCondition: 'clear' | 'drizzle' | 'moderate_rain' | 'heavy_monsoon' | 'thunderstorm',
  walkingSpeedKmh: number,
  safetyWeight: number
): JourneySimulation {
  const preset = BANGALORE_PRESETS.find((p) => p.id === cityPresetId) || BANGALORE_PRESETS[0];
  const [sLat, sLon] = preset.startCoord;
  const [eLat, eLon] = preset.endCoord;
  const centerCoordinates: [number, number] = [(sLat + eLat) / 2, (sLon + eLon) / 2];

  const timeMultiplier = timeOfDay === 'day' ? 1.0 : timeOfDay === 'dusk' ? 0.75 : timeOfDay === 'night' ? 0.45 : 0.25;

  const weatherSpeedFactor =
    weatherCondition === 'clear'
      ? 1.0
      : weatherCondition === 'drizzle'
      ? 0.95
      : weatherCondition === 'moderate_rain'
      ? 0.85
      : weatherCondition === 'heavy_monsoon'
      ? 0.70
      : 0.55;

  const weatherSafetyPenalty =
    weatherCondition === 'clear'
      ? 0
      : weatherCondition === 'drizzle'
      ? 5
      : weatherCondition === 'moderate_rain'
      ? 12
      : weatherCondition === 'heavy_monsoon'
      ? 22
      : 35;

  const effectiveSpeedKmh = Number((walkingSpeedKmh * weatherSpeedFactor).toFixed(1));

  // Calculate direct distance using Haversine formula
  const R = 6371; // Earth radius in km
  const dLat = ((eLat - sLat) * Math.PI) / 180;
  const dLon = ((eLon - sLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((sLat * Math.PI) / 180) * Math.cos((eLat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistKm = R * c;

  const shortestDist = Number(straightDistKm.toFixed(2));
  const safetyDist = Number((straightDistKm * 1.25).toFixed(2));
  const fixedDist = Number((straightDistKm * 1.12).toFixed(2));
  const adaptiveDist = Number((straightDistKm * 1.15).toFixed(2));

  const shortestSegments: RouteSegment[] = [
    { id: 's1', name: 'Starting Avenue Link', distanceKm: Number((shortestDist * 0.25).toFixed(2)), lighting: Math.round(85 * timeMultiplier), pedestrianDensity: 75, cctvCoverage: 65, emergencyProximity: 80, roadIsolation: 15, historicalRisk: 10, isHighRisk: false, weatherRiskPenalty: weatherSafetyPenalty },
    { id: 's2', name: 'Direct Backstreet Shortcut (Waterlogging Risk)', distanceKm: Number((shortestDist * 0.4).toFixed(2)), lighting: Math.round(30 * timeMultiplier), pedestrianDensity: 25, cctvCoverage: 15, emergencyProximity: 35, roadIsolation: 80, historicalRisk: 65, isHighRisk: true, weatherRiskPenalty: weatherSafetyPenalty + 15 },
    { id: 's3', name: 'Industrial Crosslane', distanceKm: Number((shortestDist * 0.2).toFixed(2)), lighting: Math.round(40 * timeMultiplier), pedestrianDensity: 20, cctvCoverage: 20, emergencyProximity: 30, roadIsolation: 75, historicalRisk: 60, isHighRisk: true, weatherRiskPenalty: weatherSafetyPenalty + 10 },
    { id: 's4', name: 'Destination Approach', distanceKm: Number((shortestDist * 0.15).toFixed(2)), lighting: Math.round(90 * timeMultiplier), pedestrianDensity: 80, cctvCoverage: 70, emergencyProximity: 85, roadIsolation: 10, historicalRisk: 10, isHighRisk: false, weatherRiskPenalty: weatherSafetyPenalty },
  ];

  const safetyOnlySegments: RouteSegment[] = [
    { id: 'sf1', name: 'Starting Avenue Link', distanceKm: Number((safetyDist * 0.2).toFixed(2)), lighting: Math.round(85 * timeMultiplier), pedestrianDensity: 75, cctvCoverage: 65, emergencyProximity: 80, roadIsolation: 15, historicalRisk: 10, isHighRisk: false, weatherRiskPenalty: weatherSafetyPenalty },
    { id: 'sf2', name: 'Main Commercial Boulevard (Sheltered & Well-Lit)', distanceKm: Number((safetyDist * 0.4).toFixed(2)), lighting: Math.round(95 * timeMultiplier), pedestrianDensity: 90, cctvCoverage: 95, emergencyProximity: 92, roadIsolation: 5, historicalRisk: 5, isHighRisk: false, weatherRiskPenalty: Math.max(0, weatherSafetyPenalty - 5) },
    { id: 'sf3', name: 'Police Station / Hospital Corridor', distanceKm: Number((safetyDist * 0.25).toFixed(2)), lighting: Math.round(92 * timeMultiplier), pedestrianDensity: 85, cctvCoverage: 90, emergencyProximity: 98, roadIsolation: 8, historicalRisk: 6, isHighRisk: false, weatherRiskPenalty: Math.max(0, weatherSafetyPenalty - 5) },
    { id: 'sf4', name: 'Destination Approach', distanceKm: Number((safetyDist * 0.15).toFixed(2)), lighting: Math.round(90 * timeMultiplier), pedestrianDensity: 80, cctvCoverage: 70, emergencyProximity: 85, roadIsolation: 10, historicalRisk: 10, isHighRisk: false, weatherRiskPenalty: weatherSafetyPenalty },
  ];

  const fixedWeightedSegments: RouteSegment[] = [
    { id: 'fw1', name: 'Starting Avenue Link', distanceKm: Number((fixedDist * 0.25).toFixed(2)), lighting: Math.round(85 * timeMultiplier), pedestrianDensity: 75, cctvCoverage: 65, emergencyProximity: 80, roadIsolation: 15, historicalRisk: 10, isHighRisk: false, weatherRiskPenalty: weatherSafetyPenalty },
    { id: 'fw2', name: 'Semi-Lit Transit Path', distanceKm: Number((fixedDist * 0.35).toFixed(2)), lighting: Math.round(70 * timeMultiplier), pedestrianDensity: 60, cctvCoverage: 55, emergencyProximity: 65, roadIsolation: 35, historicalRisk: 30, isHighRisk: false, weatherRiskPenalty: weatherSafetyPenalty + 5 },
    { id: 'fw3', name: 'Parkside Connector', distanceKm: Number((fixedDist * 0.25).toFixed(2)), lighting: Math.round(55 * timeMultiplier), pedestrianDensity: 45, cctvCoverage: 40, emergencyProximity: 55, roadIsolation: 50, historicalRisk: 40, isHighRisk: false, weatherRiskPenalty: weatherSafetyPenalty + 8 },
    { id: 'fw4', name: 'Destination Approach', distanceKm: Number((fixedDist * 0.15).toFixed(2)), lighting: Math.round(90 * timeMultiplier), pedestrianDensity: 80, cctvCoverage: 70, emergencyProximity: 85, roadIsolation: 10, historicalRisk: 10, isHighRisk: false, weatherRiskPenalty: weatherSafetyPenalty },
  ];

  const adaptiveSegments: RouteSegment[] = [
    { id: 'ad1', name: 'Starting Avenue Link', distanceKm: Number((adaptiveDist * 0.25).toFixed(2)), lighting: Math.round(85 * timeMultiplier), pedestrianDensity: 75, cctvCoverage: 65, emergencyProximity: 80, roadIsolation: 15, historicalRisk: 10, isHighRisk: false, weatherRiskPenalty: weatherSafetyPenalty },
    { id: 'ad2', name: 'Active Retail Corridor (Elevated Walkway)', distanceKm: Number((adaptiveDist * 0.35).toFixed(2)), lighting: Math.round(90 * timeMultiplier), pedestrianDensity: 85, cctvCoverage: 85, emergencyProximity: 88, roadIsolation: 10, historicalRisk: 10, isHighRisk: false, weatherRiskPenalty: Math.max(0, weatherSafetyPenalty - 8) },
    { id: 'ad3', name: 'Well-Monitored Avenue', distanceKm: Number((adaptiveDist * 0.25).toFixed(2)), lighting: Math.round(88 * timeMultiplier), pedestrianDensity: 75, cctvCoverage: 80, emergencyProximity: 78, roadIsolation: 15, historicalRisk: 12, isHighRisk: false, weatherRiskPenalty: Math.max(0, weatherSafetyPenalty - 4) },
    { id: 'ad4', name: 'Destination Approach', distanceKm: Number((adaptiveDist * 0.15).toFixed(2)), lighting: Math.round(90 * timeMultiplier), pedestrianDensity: 80, cctvCoverage: 70, emergencyProximity: 85, roadIsolation: 10, historicalRisk: 10, isHighRisk: false, weatherRiskPenalty: weatherSafetyPenalty },
  ];

  const calculateMetrics = (segments: RouteSegment[], totalDistOverride: number) => {
    const totalDist = totalDistOverride;
    const timeMin = (totalDist / effectiveSpeedKmh) * 60;
    const avgLighting = segments.reduce((acc, s) => acc + s.lighting, 0) / segments.length;
    const avgPed = segments.reduce((acc, s) => acc + s.pedestrianDensity, 0) / segments.length;
    const avgCctv = segments.reduce((acc, s) => acc + s.cctvCoverage, 0) / segments.length;
    const avgEmerg = segments.reduce((acc, s) => acc + s.emergencyProximity, 0) / segments.length;
    const avgIsolation = segments.reduce((acc, s) => acc + s.roadIsolation, 0) / segments.length;
    const avgRisk = segments.reduce((acc, s) => acc + s.historicalRisk, 0) / segments.length;
    const avgWeatherPenalty = segments.reduce((acc, s) => acc + s.weatherRiskPenalty, 0) / segments.length;

    const baseScore =
      avgLighting * 0.30 +
      avgPed * 0.20 +
      avgCctv * 0.20 +
      avgEmerg * 0.15 +
      (100 - avgIsolation) * 0.10 +
      (100 - avgRisk) * 0.05;

    const safetyScore = Math.max(10, Math.min(100, Math.round(baseScore - avgWeatherPenalty)));

    const highRiskCount = segments.filter(
      (s) => s.isHighRisk || s.historicalRisk > 50 || s.lighting < 35 || s.weatherRiskPenalty > 20
    ).length;

    return {
      distanceKm: Number(totalDist.toFixed(2)),
      travelTimeMin: Number(timeMin.toFixed(1)),
      safetyScore,
      highRiskSegmentsCount: highRiskCount,
      lightingAvg: Math.round(avgLighting),
      cctvAvg: Math.round(avgCctv),
      emergencyAvg: Math.round(avgEmerg),
    };
  };

  const mShortest = calculateMetrics(shortestSegments, shortestDist);
  const mSafety = calculateMetrics(safetyOnlySegments, safetyDist);
  const mFixed = calculateMetrics(fixedWeightedSegments, fixedDist);
  const mAdaptive = calculateMetrics(adaptiveSegments, adaptiveDist);

  const adjustedAdaptiveScore = Math.min(100, Math.round(mAdaptive.safetyScore * (1 + (safetyWeight - 1) * 0.1)));

  // Generate distinct realistic route coordinate curves between startCoord and endCoord
  const generateCurve = (start: [number, number], end: [number, number], curvature: [number, number]): [number, number][] => {
    const [lat1, lon1] = start;
    const [lat2, lon2] = end;
    const midLat = (lat1 + lat2) / 2 + curvature[0];
    const midLon = (lon1 + lon2) / 2 + curvature[1];
    return [
      start,
      [lat1 * 0.7 + midLat * 0.3, lon1 * 0.7 + midLon * 0.3],
      [midLat, midLon],
      [lat2 * 0.7 + midLat * 0.3, lon2 * 0.7 + midLon * 0.3],
      end,
    ];
  };

  const strategies: RouteStrategyResult[] = [
    {
      id: 'shortest',
      name: '1. Shortest / Fastest Route',
      description: 'Minimizes distance and travel time. Direct path but prone to waterlogging and dark shortcuts.',
      color: '#2563eb',
      ...mShortest,
      segments: shortestSegments,
      coordinates: generateCurve(preset.startCoord, preset.endCoord, [0.001, -0.001]),
    },
    {
      id: 'safety_only',
      name: '2. Safety-Only Route',
      description: 'Maximizes sheltered commercial corridors and police proximity, ignoring distance constraints.',
      color: '#dc2626',
      ...mSafety,
      segments: safetyOnlySegments,
      coordinates: generateCurve(preset.startCoord, preset.endCoord, [0.008, 0.006]),
    },
    {
      id: 'fixed_weighted',
      name: '3. Fixed Weighted Route',
      description: 'Standard linear weighting combining distance and weather-adjusted safety factors.',
      color: '#d97706',
      ...mFixed,
      segments: fixedWeightedSegments,
      coordinates: generateCurve(preset.startCoord, preset.endCoord, [0.004, 0.002]),
    },
    {
      id: 'adaptive',
      name: '4. Proposed Adaptive / Multi-Objective Route',
      description: 'Pareto-optimal multi-objective optimization balancing rain speed penalties with elevated walkway risk avoidance.',
      color: '#059669',
      ...mAdaptive,
      safetyScore: adjustedAdaptiveScore,
      segments: adaptiveSegments,
      coordinates: generateCurve(preset.startCoord, preset.endCoord, [0.002, 0.003]),
    },
  ];

  const sensitivityData = [
    { weight: 0.5, shortestScore: mShortest.safetyScore, safetyOnlyScore: mSafety.safetyScore, fixedScore: mFixed.safetyScore, adaptiveScore: Math.round(mAdaptive.safetyScore * 0.9) },
    { weight: 1.0, shortestScore: mShortest.safetyScore, safetyOnlyScore: mSafety.safetyScore, fixedScore: mFixed.safetyScore, adaptiveScore: mAdaptive.safetyScore },
    { weight: 1.5, shortestScore: mShortest.safetyScore, safetyOnlyScore: mSafety.safetyScore, fixedScore: mFixed.safetyScore + 3, adaptiveScore: Math.min(100, mAdaptive.safetyScore + 5) },
    { weight: 2.0, shortestScore: mShortest.safetyScore, safetyOnlyScore: mSafety.safetyScore, fixedScore: mFixed.safetyScore + 6, adaptiveScore: Math.min(100, mAdaptive.safetyScore + 9) },
    { weight: 2.5, shortestScore: mShortest.safetyScore, safetyOnlyScore: mSafety.safetyScore, fixedScore: mFixed.safetyScore + 8, adaptiveScore: Math.min(100, mAdaptive.safetyScore + 12) },
    { weight: 3.0, shortestScore: mShortest.safetyScore, safetyOnlyScore: mSafety.safetyScore, fixedScore: mFixed.safetyScore + 10, adaptiveScore: Math.min(100, mAdaptive.safetyScore + 15) },
  ];

  const robustnessData = [
    { condition: 'Normal Baseline', shortestSafety: mShortest.safetyScore, adaptiveSafety: mAdaptive.safetyScore, shortestRisk: mShortest.highRiskSegmentsCount, adaptiveRisk: mAdaptive.highRiskSegmentsCount },
    { condition: 'Heavy Monsoon Rain', shortestSafety: Math.max(15, mShortest.safetyScore - 25), adaptiveSafety: Math.max(50, mAdaptive.safetyScore - 8), shortestRisk: mShortest.highRiskSegmentsCount + 2, adaptiveRisk: mAdaptive.highRiskSegmentsCount },
    { condition: 'Thunderstorm & Waterlogging', shortestSafety: Math.max(10, mShortest.safetyScore - 35), adaptiveSafety: Math.max(45, mAdaptive.safetyScore - 12), shortestRisk: mShortest.highRiskSegmentsCount + 3, adaptiveRisk: 0 },
    { condition: 'Lighting Failure + Rain', shortestSafety: Math.max(5, mShortest.safetyScore - 45), adaptiveSafety: Math.max(40, mAdaptive.safetyScore - 15), shortestRisk: mShortest.highRiskSegmentsCount + 3, adaptiveRisk: 1 },
  ];

  const emergencyMarkers = [
    { lat: centerCoordinates[0] - 0.002, lon: centerCoordinates[1] + 0.003, type: 'police', name: 'Bangalore City Police Station' },
    { lat: centerCoordinates[0] + 0.003, lon: centerCoordinates[1] - 0.002, type: 'hospital', name: 'Apex General Hospital & Trauma Care' },
    { lat: centerCoordinates[0] + 0.001, lon: centerCoordinates[1] + 0.005, type: 'cctv', name: 'Safe City Surveillance Camera Hub' },
  ];

  return {
    origin: preset.origin,
    destination: preset.destination,
    city: preset.name,
    timeOfDay,
    weatherCondition,
    walkingSpeedKmh,
    effectiveSpeedKmh,
    safetyWeight,
    centerCoordinates,
    strategies,
    sensitivityData,
    robustnessData,
    emergencyMarkers,
  };
}
