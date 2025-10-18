import React, { useState, useEffect, useCallback } from "react";

// --- HELPER & UI COMPONENTS ---

const Icon = ({ path, className = "h-6 w-6" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const SunIcon = () => (
  <Icon path="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
);
const CloudIcon = () => (
  <Icon path="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
);
const WindIcon = () => <Icon path="M5 8h14M5 12h14M5 16h14" />;

const StatBox = ({ title, value, unit = "", className = "", children }) => (
  <div
    className={`flex flex-col p-3 bg-white/5 rounded-lg backdrop-blur-sm ${className}`}
  >
    <span className="text-xs text-gray-400 uppercase tracking-wider">
      {title}
    </span>
    <span className="text-2xl font-semibold text-white">
      {value}
      <span className="text-lg ml-1 text-gray-300">{unit}</span>
      {children}
    </span>
  </div>
);

const Gauge = ({ label, value, color = "bg-cyan-400", height = "h-2" }) => (
  <div className="w-full">
    <div className="flex justify-between items-center text-xs mb-1">
      <span className="text-gray-300">{label}</span>
      <span className="font-bold text-white">{value}%</span>
    </div>
    <div className={`w-full bg-white/10 rounded-full ${height}`}>
      <div
        className={`${color} ${height} rounded-full transition-all duration-500`}
        style={{ width: `${value}%` }}
      ></div>
    </div>
  </div>
);

const TireIndicator = ({ compound, wear, temp, label }) => {
  const getCompoundColor = (c) =>
    c === "S"
      ? "border-red-500"
      : c === "M"
      ? "border-yellow-400"
      : "border-gray-200";
  const getTempColor = (t) =>
    t < 80 ? "bg-blue-500" : t > 110 ? "bg-red-600" : "bg-green-500";

  return (
    <div className="flex items-center gap-3">
      <div
        className={`relative w-12 h-12 rounded-full border-4 ${getCompoundColor(
          compound
        )} flex items-center justify-center bg-gray-800`}
      >
        <div
          className="absolute inset-0 rounded-full bg-gray-600"
          style={{
            transform: `scaleY(${wear / 100})`,
            transformOrigin: "bottom",
          }}
        ></div>
        <span className="relative font-bold text-lg z-10">{compound}</span>
      </div>
      <div className="flex-grow">
        <p className="text-sm font-bold text-white">{label}</p>
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <span>Wear: {wear}%</span>
          <div
            className={`w-3 h-3 rounded-full ${getTempColor(temp)}`}
            title={`Temp: ${temp}°C`}
          ></div>
        </div>
      </div>
    </div>
  );
};

// --- DASHBOARD PANEL COMPONENTS ---

const TopPanel = ({ raceState }) => (
  <header className="col-span-4 bg-black/20 backdrop-blur-sm rounded-lg p-3 flex justify-between items-center border-b border-white/10">
    <div className="flex items-center gap-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">
        NORTHMARK F1 | PIT WALL
      </h1>
      <StatBox title="Lap" value={`${raceState.lap} / 58`} />
      <StatBox title="Position" value={`P${raceState.position}`} />
    </div>
    <div className="flex items-center gap-4">
      <StatBox
        title="Gap Ahead"
        value={raceState.gapAhead.toFixed(1)}
        unit="s"
      />
      <StatBox
        title="Gap Behind"
        value={`+${raceState.gapBehind.toFixed(1)}`}
        unit="s"
      />
      <StatBox title="S.C. Risk" value={raceState.safetyCarRisk} unit="%" />
      <div className="flex items-center gap-3 text-white p-3 bg-white/5 rounded-lg">
        {raceState.weather === "Sunny" ? <SunIcon /> : <CloudIcon />}
        <span>{raceState.trackTemp}°C</span>
        <WindIcon />
        <span style={{ transform: `rotate(${raceState.windDirection}deg)` }}>
          ↑
        </span>
        <span>{raceState.windSpeed} km/h</span>
      </div>
    </div>
  </header>
);

const LeftPanel = ({ ai, driver, handleSafetyCar }) => (
  <div className="col-span-1 row-span-2 bg-black/20 backdrop-blur-sm rounded-lg p-5 flex flex-col justify-between border-b border-white/10">
    <div>
      <h2 className="text-sm uppercase text-cyan-400 tracking-widest font-bold mb-2">
        Strategy AI
      </h2>
      <p className="text-3xl font-medium text-white leading-tight">
        {ai.recommendation}
      </p>
      <p className="text-sm text-gray-400 mt-2">{ai.reason}</p>
      <div className="mt-4 flex gap-4">
        <StatBox
          title="Confidence"
          value={ai.confidence}
          unit="%"
          className="flex-1"
        />
        <StatBox
          title="Overtake Prob."
          value={ai.overtakeProbability}
          unit="%"
          className="flex-1"
        />
      </div>
    </div>
    <div className="flex flex-col gap-4">
      <button
        onClick={handleSafetyCar}
        className="w-full p-2 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors"
      >
        SIMULATE SAFETY CAR
      </button>
      <h2 className="text-sm uppercase text-cyan-400 tracking-widest font-bold">
        Driver Vitals
      </h2>
      <StatBox
        title="Pace Delta"
        value={
          driver.paceDelta > 0
            ? `+${driver.paceDelta.toFixed(3)}`
            : driver.paceDelta.toFixed(3)
        }
        unit="s"
        className="bg-black/20"
      />
      <Gauge label="ERS Battery" value={driver.ers} color="bg-green-500" />
      <Gauge
        label="Consistency"
        value={driver.consistency}
        color="bg-purple-500"
      />
    </div>
  </div>
);

const RightPanel = ({ car }) => (
  <div className="col-span-1 row-span-2 bg-black/20 backdrop-blur-sm rounded-lg p-5 flex flex-col justify-between border-b border-white/10">
    <div>
      <h2 className="text-sm uppercase text-cyan-400 tracking-widest font-bold mb-4">
        Tire Status
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <TireIndicator label="Front Left" {...car.tires.fl} />
        <TireIndicator label="Front Right" {...car.tires.fr} />
        <TireIndicator label="Rear Left" {...car.tires.rl} />
        <TireIndicator label="Rear Right" {...car.tires.rr} />
      </div>
    </div>
    <div className="flex flex-col gap-4">
      <h2 className="text-sm uppercase text-cyan-400 tracking-widest font-bold">
        Core Systems
      </h2>
      <div
        className={`p-3 rounded-lg font-bold text-center text-lg transition-colors ${
          car.drsAvailable
            ? "bg-green-500 text-white"
            : "bg-gray-700 text-gray-400"
        }`}
      >
        DRS {car.drsAvailable ? "AVAILABLE" : "UNAVAILABLE"}
      </div>
      <Gauge
        label="Fuel Load"
        value={Math.round((car.fuel / 110) * 100)}
        color="bg-orange-500"
      />
      <Gauge
        label="Brake Wear"
        value={Math.round(car.brakeWear)}
        color="bg-red-500"
      />
    </div>
  </div>
);

const CenterPanel = ({ strategies, raceState, rivals }) => {
  const trackPath =
    "M 50 200 C 50 100, 150 100, 150 200 S 250 300, 250 200 S 350 100, 350 200 S 450 300, 450 200";
  const pathRef = React.useRef(null);

  const getPointAtLap = useCallback((lap, path) => {
    if (!path) return { x: 50, y: 200 };
    const totalLength = path.getTotalLength();
    const point = path.getPointAtLength((lap / 58) * totalLength);
    return { x: point.x, y: point.y };
  }, []);

  const currentPos = getPointAtLap(raceState.lap, pathRef.current);

  return (
    <div className="col-span-2 row-span-2 bg-black/20 backdrop-blur-sm rounded-lg p-4 relative overflow-hidden border-b border-white/10">
      <h2 className="absolute top-4 left-4 text-sm uppercase text-cyan-400 tracking-widest font-bold z-10">
        Strategy & Track View
      </h2>
      <svg width="100%" height="100%" viewBox="0 0 500 300">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          ref={pathRef}
          d={trackPath}
          stroke="#4A5568"
          strokeWidth="15"
          fill="none"
        />

        {strategies.map((strat, index) => {
          const pitPoint = getPointAtLap(strat.pitLap, pathRef.current);
          const isOptimal = index === 0;
          return (
            <g key={strat.id} opacity={isOptimal ? 1 : 0.4}>
              <circle
                cx={pitPoint.x}
                cy={pitPoint.y}
                r="8"
                fill={isOptimal ? "#06B6D4" : "white"}
                stroke="black"
                strokeWidth="2"
              />
              <text
                x={pitPoint.x}
                y={pitPoint.y}
                dy="4"
                textAnchor="middle"
                fill="black"
                fontSize="10px"
                fontWeight="bold"
              >
                {strat.nextTire}
              </text>
            </g>
          );
        })}

        {rivals.map((rival) => {
          const rivalPos = getPointAtLap(
            raceState.lap + rival.delta,
            pathRef.current
          );
          return (
            <circle
              key={rival.id}
              cx={rivalPos.x}
              cy={rivalPos.y}
              r="6"
              fill={rival.color}
            />
          );
        })}

        <circle
          cx={currentPos.x}
          cy={currentPos.y}
          r="8"
          fill="#0EA5E9"
          stroke="white"
          strokeWidth="2"
          style={{ filter: "url(#glow)" }}
        />
      </svg>
    </div>
  );
};

// --- MOCK DATA & SIMULATION LOGIC ---

const generateInitialState = () => ({
  raceState: {
    lap: 1,
    position: 3,
    gapAhead: 2.5,
    gapBehind: 1.8,
    weather: "Sunny",
    trackTemp: 45,
    safetyCarRisk: 5,
    windSpeed: 10,
    windDirection: 45,
  },
  ai: {
    recommendation: "Focus on tire management.",
    reason: "Initial stint is crucial. Plan A is on track.",
    confidence: 95,
    overtakeProbability: 15,
  },
  driver: { paceDelta: -0.05, ers: 90, consistency: 98, aggression: 5 },
  car: {
    fuel: 110.0,
    brakeWear: 12,
    drsAvailable: false,
    tires: {
      fl: { compound: "M", wear: 5, temp: 95 },
      fr: { compound: "M", wear: 6, temp: 96 },
      rl: { compound: "M", wear: 8, temp: 105 },
      rr: { compound: "M", wear: 9, temp: 106 },
    },
  },
  strategies: [
    { id: "A", pitLap: 28, nextTire: "H" },
    { id: "B", pitLap: 22, nextTire: "H" },
    { id: "C", pitLap: 35, nextTire: "S" },
  ],
  rivals: [
    { id: "VER", delta: -0.2, color: "#3671C6" },
    { id: "LEC", delta: 0.3, color: "#F91536" },
  ],
});

// --- MAIN APP COMPONENT ---

export default function App() {
  const [simState, setSimState] = useState(generateInitialState());

  const handleSafetyCar = () => {
    setSimState((prev) => ({
      ...prev,
      raceState: { ...prev.raceState, safetyCarRisk: 90 },
      ai: {
        recommendation: "SAFETY CAR DEPLOYED! BOX NOW!",
        reason: "Cheap pit stop available. Switch to Plan C (Softs).",
        confidence: 98,
        overtakeProbability: 85,
      },
      strategies: [
        { id: "C", pitLap: prev.raceState.lap + 1, nextTire: "S" },
        { id: "A", pitLap: 28, nextTire: "H" },
        { id: "B", pitLap: 22, nextTire: "H" },
      ],
    }));
  };

  useEffect(() => {
    const simInterval = setInterval(() => {
      setSimState((prevState) => {
        const newLap = prevState.raceState.lap + 1;
        if (newLap > 58) {
          clearInterval(simInterval);
          return prevState;
        }

        let newRec = "Maintain pace. Monitor tire wear.";
        let newReason = "Plan A is optimal. No immediate threats.";
        if (newLap === 27) {
          newRec = "Prepare to box. Pit window opening.";
          newReason = "Optimal lap to switch to Hards is approaching.";
        } else if (newLap === 28) {
          newRec = "BOX BOX BOX! Pit for Hards.";
          newReason = "Executing Plan A. Defend against undercut.";
        }

        return {
          ...prevState,
          raceState: {
            ...prevState.raceState,
            lap: newLap,
            gapAhead: Math.max(
              0.5,
              prevState.raceState.gapAhead - 0.05 + Math.random() * 0.1
            ),
            gapBehind: Math.max(
              0.5,
              prevState.raceState.gapBehind + 0.05 - Math.random() * 0.1
            ),
            safetyCarRisk: Math.max(5, prevState.raceState.safetyCarRisk - 1),
          },
          car: {
            ...prevState.car,
            fuel: Math.max(0, prevState.car.fuel - 1.8),
            brakeWear: Math.min(100, prevState.car.brakeWear + 0.5),
            drsAvailable: prevState.raceState.gapAhead < 1.0,
            tires: {
              fl: {
                ...prevState.car.tires.fl,
                wear: prevState.car.tires.fl.wear + 2,
                temp: 95 + Math.random() * 10,
              },
              fr: {
                ...prevState.car.tires.fr,
                wear: prevState.car.tires.fr.wear + 2,
                temp: 96 + Math.random() * 10,
              },
              rl: {
                ...prevState.car.tires.rl,
                wear: prevState.car.tires.rl.wear + 3,
                temp: 105 + Math.random() * 10,
              },
              rr: {
                ...prevState.car.tires.rr,
                wear: prevState.car.tires.rr.wear + 3,
                temp: 106 + Math.random() * 10,
              },
            },
          },
          driver: {
            ...prevState.driver,
            ers: 80 + Math.floor(Math.random() * 20),
            consistency: 95 + Math.floor(Math.random() * 5),
            paceDelta: Math.random() * 0.4 - 0.2,
          },
          ai: { ...prevState.ai, recommendation: newRec, reason: newReason },
        };
      });
    }, 2000);
    return () => clearInterval(simInterval);
  }, []);

  return (
    <div
      className="bg-gray-900 text-gray-200 font-sans h-screen"
      style={{
        background:
          "radial-gradient(circle, rgba(23,37,84,1) 0%, rgba(17,24,39,1) 100%)",
      }}
    >
      <div className="grid grid-cols-4 grid-rows-[auto_1fr] h-full gap-4 p-4">
        <TopPanel raceState={simState.raceState} />
        <LeftPanel
          ai={simState.ai}
          driver={simState.driver}
          handleSafetyCar={handleSafetyCar}
        />
        <CenterPanel
          strategies={simState.strategies}
          raceState={simState.raceState}
          rivals={simState.rivals}
        />
        <RightPanel car={simState.car} />
      </div>
    </div>
  );
}
