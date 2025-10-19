"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cloud, Wind, Droplets, Gauge, Zap, Circle, Fuel } from "lucide-react";

// Dummy data for the dashboard
const DUMMY_RACE_STATE = {
  lap: 42,
  totalLaps: 58,
  position: 3,
  driver: "NOR",
  team: "McLaren",
  sessionTime: 3847,
};

const DUMMY_WEATHER = {
  trackTemp: 42,
  airTemp: 28,
  windSpeed: 12,
  windDirection: "NE",
  rainfall: 0,
  humidity: 45,
};

const DUMMY_TELEMETRY = {
  rpm: 11200,
  maxRpm: 15000,
  gear: 6,
  throttle: 87,
  brake: false,
  speed: 287,
  drsEnabled: true,
  tireCompound: "MEDIUM",
  tireWear: 18,
  fuelCapacity: 68, // Added fuel capacity
};

const DUMMY_AI_RECOMMENDATION = {
  recommendation: "Box for SOFT tires",
  reason: "Track evolution favors softer compound. 12-lap window optimal.",
  confidence: 94,
};

const DUMMY_DRIVERS = [
  { id: 1, name: "VER", position: 1, x: 72, y: 45, team: "Red Bull" },
  { id: 2, name: "HAM", position: 2, x: 68, y: 52, team: "Mercedes" },
  { id: 3, name: "NOR", position: 3, x: 65, y: 48, team: "McLaren" },
  { id: 4, name: "LEC", position: 4, x: 58, y: 55, team: "Ferrari" },
  { id: 5, name: "SAI", position: 5, x: 52, y: 42, team: "Ferrari" },
  { id: 6, name: "PER", position: 6, x: 45, y: 58, team: "Red Bull" },
  { id: 7, name: "RUS", position: 7, x: 38, y: 48, team: "Mercedes" },
  { id: 8, name: "ALO", position: 8, x: 32, y: 52, team: "Aston Martin" },
];

export const App = () => {
  const [raceState, setRaceState] = useState(DUMMY_RACE_STATE);
  const [weather, setWeather] = useState(DUMMY_WEATHER);
  const [telemetry, setTelemetry] = useState(DUMMY_TELEMETRY);
  const [aiRecommendation, setAiRecommendation] = useState(
    DUMMY_AI_RECOMMENDATION
  );
  const [drivers, setDrivers] = useState(DUMMY_DRIVERS);

  // Scenario planner state
  const [tireCompound, setTireCompound] = useState(1); // 0: Soft, 1: Medium, 2: Hard
  const [tirePressure, setTirePressure] = useState([23]);
  const [fuelLoad, setFuelLoad] = useState([65]);
  const [windSpeed, setWindSpeed] = useState([12]);
  const [prediction, setPrediction] = (useState < string) | (null > null);

  // Simulate live data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        rpm: Math.floor(Math.random() * 5000) + 10000,
        throttle: Math.floor(Math.random() * 40) + 60,
        brake: Math.random() > 0.8,
        speed: Math.floor(Math.random() * 50) + 250,
        tireWear: prev.tireWear + 0.1,
        fuelCapacity: Math.max(0, prev.fuelCapacity - 0.05), // Simulate fuel consumption
      }));

      // Animate drivers on track
      setDrivers((prev) =>
        prev.map((driver) => ({
          ...driver,
          x: (driver.x + 0.5) % 100,
          y: driver.y + (Math.random() - 0.5) * 2,
        }))
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const tireCompounds = ["SOFT", "MEDIUM", "HARD"];

  const handlePredictScenario = () => {
    const compound = tireCompounds[tireCompound];
    setPrediction(
      `Predicted lap time: 1:32.${
        Math.floor(Math.random() * 900) + 100
      } with ${compound} tires at ${
        tirePressure[0]
      } PSI. Estimated stint length: ${
        Math.floor(Math.random() * 15) + 10
      } laps.`
    );
  };

  return (
    // <div className="min-h-screen bg-background p-4 md:p-6">
    //   <div className="grid grid-cols-1 gap-4 max-w-[1800px] mx-auto">
    //     <Card className="border-border bg-card">
    //       <CardContent className="p-4">
    //         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    //           {/* Title and Race State */}
    //           <div className="space-y-2">
    //             <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">
    //               NORTHMARK F1 | <span className="text-primary">PIT WALL</span>
    //             </h1>
    //             <div className="flex items-center gap-4 flex-wrap">
    //               <div className="flex items-center gap-2">
    //                 <span className="text-muted-foreground text-sm">LAP</span>
    //                 <span className="text-2xl font-bold text-primary">
    //                   {raceState.lap}
    //                 </span>
    //                 <span className="text-muted-foreground">
    //                   / {raceState.totalLaps}
    //                 </span>
    //               </div>
    //               <div className="flex items-center gap-2">
    //                 <span className="text-muted-foreground text-sm">POS</span>
    //                 <span className="text-3xl font-bold text-accent">
    //                   {raceState.position}
    //                 </span>
    //               </div>
    //               <Badge variant="secondary" className="text-sm px-3 py-1">
    //                 {raceState.driver} | {raceState.team}
    //               </Badge>
    //             </div>
    //           </div>

    //           {/* Weather Conditions */}
    //           <div className="space-y-2">
    //             <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
    //               Weather Conditions
    //             </h3>
    //             <div className="grid grid-cols-2 gap-3">
    //               <div className="flex items-center gap-2">
    //                 <Gauge className="h-4 w-4 text-primary" />
    //                 <div>
    //                   <div className="text-xs text-muted-foreground">Track</div>
    //                   <div className="text-lg font-bold">
    //                     {weather.trackTemp}°C
    //                   </div>
    //                 </div>
    //               </div>
    //               <div className="flex items-center gap-2">
    //                 <Cloud className="h-4 w-4 text-primary" />
    //                 <div>
    //                   <div className="text-xs text-muted-foreground">Air</div>
    //                   <div className="text-lg font-bold">
    //                     {weather.airTemp}°C
    //                   </div>
    //                 </div>
    //               </div>
    //               <div className="flex items-center gap-2">
    //                 <Wind className="h-4 w-4 text-primary" />
    //                 <div>
    //                   <div className="text-xs text-muted-foreground">Wind</div>
    //                   <div className="text-sm font-bold">
    //                     {weather.windSpeed} {weather.windDirection}
    //                   </div>
    //                 </div>
    //               </div>
    //               <div className="flex items-center gap-2">
    //                 <Droplets className="h-4 w-4 text-primary" />
    //                 <div>
    //                   <div className="text-xs text-muted-foreground">Rain</div>
    //                   <div className="text-lg font-bold">
    //                     {weather.rainfall}%
    //                   </div>
    //                 </div>
    //               </div>
    //             </div>
    //           </div>

    //           {/* Session Info */}
    //           <div className="space-y-2">
    //             <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
    //               Session Info
    //             </h3>
    //             <div className="space-y-1">
    //               <div className="text-xs text-muted-foreground">
    //                 Session Time
    //               </div>
    //               <div className="text-2xl font-bold text-primary">
    //                 {Math.floor(raceState.sessionTime / 60)}:
    //                 {String(raceState.sessionTime % 60).padStart(2, "0")}
    //               </div>
    //             </div>
    //           </div>
    //         </div>
    //       </CardContent>
    //     </Card>

    //     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
    //       {/* RPM Box */}
    //       <Card className="border-border bg-card">
    //         <CardContent className="p-4">
    //           <div className="space-y-2">
    //             <div className="text-xs text-muted-foreground uppercase tracking-wide">
    //               RPM
    //             </div>
    //             <div className="text-2xl font-bold text-primary">
    //               {telemetry.rpm.toLocaleString()}
    //             </div>
    //             <div className="h-2 bg-secondary rounded-full overflow-hidden">
    //               <div
    //                 className={`h-full transition-all duration-300 ${
    //                   telemetry.rpm > 13000 ? "bg-destructive" : "bg-primary"
    //                 }`}
    //                 style={{
    //                   width: `${(telemetry.rpm / telemetry.maxRpm) * 100}%`,
    //                 }}
    //               />
    //             </div>
    //           </div>
    //         </CardContent>
    //       </Card>

    //       {/* Speed Box */}
    //       <Card className="border-border bg-card">
    //         <CardContent className="p-4">
    //           <div className="space-y-2">
    //             <div className="text-xs text-muted-foreground uppercase tracking-wide">
    //               Speed
    //             </div>
    //             <div className="text-2xl font-bold text-accent">
    //               {telemetry.speed}
    //             </div>
    //             <div className="text-xs text-muted-foreground">km/h</div>
    //           </div>
    //         </CardContent>
    //       </Card>

    //       {/* Gear Box */}
    //       <Card className="border-border bg-card">
    //         <CardContent className="p-4">
    //           <div className="space-y-2">
    //             <div className="text-xs text-muted-foreground uppercase tracking-wide">
    //               Gear
    //             </div>
    //             <div className="text-3xl font-bold text-primary">
    //               {telemetry.gear}
    //             </div>
    //           </div>
    //         </CardContent>
    //       </Card>

    //       {/* Throttle Box */}
    //       <Card className="border-border bg-card">
    //         <CardContent className="p-4">
    //           <div className="space-y-2">
    //             <div className="text-xs text-muted-foreground uppercase tracking-wide">
    //               Throttle
    //             </div>
    //             <div className="text-2xl font-bold text-primary">
    //               {telemetry.throttle}%
    //             </div>
    //             <div className="h-2 bg-secondary rounded-full overflow-hidden">
    //               <div
    //                 className="h-full bg-primary transition-all duration-300"
    //                 style={{ width: `${telemetry.throttle}%` }}
    //               />
    //             </div>
    //           </div>
    //         </CardContent>
    //       </Card>

    //       {/* Brake Box */}
    //       <Card className="border-border bg-card">
    //         <CardContent className="p-4">
    //           <div className="space-y-2">
    //             <div className="text-xs text-muted-foreground uppercase tracking-wide">
    //               Brake
    //             </div>
    //             <div className="flex items-center justify-center h-12">
    //               <Circle
    //                 className={`h-8 w-8 transition-all ${
    //                   telemetry.brake
    //                     ? "fill-destructive text-destructive"
    //                     : "text-muted"
    //                 }`}
    //               />
    //             </div>
    //           </div>
    //         </CardContent>
    //       </Card>

    //       {/* DRS Box */}
    //       <Card className="border-border bg-card">
    //         <CardContent className="p-4">
    //           <div className="space-y-2">
    //             <div className="text-xs text-muted-foreground uppercase tracking-wide">
    //               DRS
    //             </div>
    //             <div className="flex items-center justify-center h-12">
    //               <Badge
    //                 variant={telemetry.drsEnabled ? "default" : "secondary"}
    //                 className="text-lg px-4 py-2"
    //               >
    //                 {telemetry.drsEnabled ? "ON" : "OFF"}
    //               </Badge>
    //             </div>
    //           </div>
    //         </CardContent>
    //       </Card>

    //       {/* Tire Status Box */}
    //       <Card className="border-border bg-card">
    //         <CardContent className="p-4">
    //           <div className="space-y-2">
    //             <div className="text-xs text-muted-foreground uppercase tracking-wide">
    //               Tires
    //             </div>
    //             <Badge variant="secondary" className="text-sm px-3 py-1">
    //               {telemetry.tireCompound}
    //             </Badge>
    //             <div className="text-xs text-muted-foreground">
    //               Wear: {telemetry.tireWear.toFixed(1)} laps
    //             </div>
    //           </div>
    //         </CardContent>
    //       </Card>

    //       {/* Fuel Capacity Box */}
    //       <Card className="border-border bg-card">
    //         <CardContent className="p-4">
    //           <div className="space-y-2">
    //             <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
    //               <Fuel className="h-3 w-3" />
    //               Fuel
    //             </div>
    //             <div className="text-2xl font-bold text-primary">
    //               {telemetry.fuelCapacity.toFixed(1)}
    //             </div>
    //             <div className="text-xs text-muted-foreground">kg</div>
    //           </div>
    //         </CardContent>
    //       </Card>
    //     </div>

    //     <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
    //       <Card className="lg:col-span-4 border-border bg-card">
    //         <CardHeader>
    //           <CardTitle className="text-lg">Scenario Planner</CardTitle>
    //         </CardHeader>
    //         <CardContent className="space-y-6">
    //           {/* Tire Compound */}
    //           <div className="space-y-3">
    //             <label className="text-sm font-medium text-muted-foreground">
    //               Tire Compound
    //             </label>
    //             <div className="flex gap-2">
    //               {tireCompounds.map((compound, idx) => (
    //                 <Button
    //                   key={compound}
    //                   variant={tireCompound === idx ? "default" : "outline"}
    //                   onClick={() => setTireCompound(idx)}
    //                   className="flex-1"
    //                 >
    //                   {compound}
    //                 </Button>
    //               ))}
    //             </div>
    //           </div>

    //           {/* Tire Pressure */}
    //           <div className="space-y-3">
    //             <div className="flex justify-between">
    //               <label className="text-sm font-medium text-muted-foreground">
    //                 Tire Pressure
    //               </label>
    //               <span className="text-sm font-bold text-primary">
    //                 {tirePressure[0]} PSI
    //               </span>
    //             </div>
    //             <Slider
    //               value={tirePressure}
    //               onValueChange={setTirePressure}
    //               min={19}
    //               max={27}
    //               step={0.5}
    //               className="w-full"
    //             />
    //           </div>

    //           {/* Fuel Load */}
    //           <div className="space-y-3">
    //             <div className="flex justify-between">
    //               <label className="text-sm font-medium text-muted-foreground">
    //                 Fuel Load
    //               </label>
    //               <span className="text-sm font-bold text-primary">
    //                 {fuelLoad[0]} kg
    //               </span>
    //             </div>
    //             <Slider
    //               value={fuelLoad}
    //               onValueChange={setFuelLoad}
    //               min={0}
    //               max={110}
    //               step={5}
    //               className="w-full"
    //             />
    //           </div>

    //           {/* Wind Speed */}
    //           <div className="space-y-3">
    //             <div className="flex justify-between">
    //               <label className="text-sm font-medium text-muted-foreground">
    //                 Wind Speed
    //               </label>
    //               <span className="text-sm font-bold text-primary">
    //                 {windSpeed[0]} km/h
    //               </span>
    //             </div>
    //             <Slider
    //               value={windSpeed}
    //               onValueChange={setWindSpeed}
    //               min={0}
    //               max={40}
    //               step={1}
    //               className="w-full"
    //             />
    //           </div>

    //           <Button
    //             onClick={handlePredictScenario}
    //             className="w-full"
    //             size="lg"
    //           >
    //             Run Prediction
    //           </Button>

    //           {prediction && (
    //             <div className="p-4 bg-secondary rounded-lg border border-border">
    //               <h4 className="text-sm font-semibold text-accent mb-2">
    //                 Prediction Result
    //               </h4>
    //               <p className="text-sm text-muted-foreground leading-relaxed">
    //                 {prediction}
    //               </p>
    //             </div>
    //           )}

    //           <div className="pt-4 border-t border-border space-y-3">
    //             <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
    //               <Zap className="h-4 w-4 text-accent" />
    //               AI Strategist
    //             </h3>
    //             <div className="space-y-2">
    //               <div className="flex items-center gap-2">
    //                 <Badge
    //                   variant="default"
    //                   className="bg-accent text-accent-foreground"
    //                 >
    //                   {aiRecommendation.confidence}% Confidence
    //                 </Badge>
    //               </div>
    //               <div className="text-lg font-bold text-accent">
    //                 {aiRecommendation.recommendation}
    //               </div>
    //               <p className="text-sm text-muted-foreground leading-relaxed">
    //                 {aiRecommendation.reason}
    //               </p>
    //             </div>
    //           </div>
    //         </CardContent>
    //       </Card>

    //       <Card className="lg:col-span-5 border-border bg-card">
    //         <CardHeader>
    //           <CardTitle className="text-lg">Live Track Map</CardTitle>
    //         </CardHeader>
    //         <CardContent>
    //           <div className="relative w-full aspect-square bg-secondary rounded-lg border border-border overflow-hidden">
    //             {/* Track outline */}
    //             <svg
    //               className="absolute inset-0 w-full h-full"
    //               viewBox="0 0 100 100"
    //             >
    //               <path
    //                 d="M 20 50 Q 20 20, 50 20 T 80 50 Q 80 80, 50 80 T 20 50"
    //                 fill="none"
    //                 stroke="currentColor"
    //                 strokeWidth="8"
    //                 className="text-muted opacity-30"
    //               />
    //             </svg>

    //             {/* Driver positions */}
    //             {drivers.map((driver) => (
    //               <div
    //                 key={driver.id}
    //                 className="absolute transition-all duration-1000 ease-linear"
    //                 style={{
    //                   left: `${driver.x}%`,
    //                   top: `${driver.y}%`,
    //                   transform: "translate(-50%, -50%)",
    //                 }}
    //               >
    //                 <div className="relative group">
    //                   <div
    //                     className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
    //                       driver.name === "NOR"
    //                         ? "bg-accent border-accent text-accent-foreground"
    //                         : "bg-primary border-primary text-primary-foreground"
    //                     }`}
    //                   >
    //                     {driver.position}
    //                   </div>
    //                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
    //                     {driver.name} - {driver.team}
    //                   </div>
    //                 </div>
    //               </div>
    //             ))}

    //             {/* Start/Finish line indicator */}
    //             <div className="absolute top-[20%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
    //               <div className="w-1 h-10 bg-primary" />
    //               <span className="text-xs font-bold text-primary">
    //                 START/FINISH
    //               </span>
    //             </div>
    //           </div>
    //         </CardContent>
    //       </Card>

    //       <Card className="lg:col-span-3 border-border bg-card">
    //         <CardHeader>
    //           <CardTitle className="text-lg">Leaderboard</CardTitle>
    //         </CardHeader>
    //         <CardContent>
    //           <div className="space-y-2">
    //             {drivers
    //               .sort((a, b) => a.position - b.position)
    //               .map((driver) => (
    //                 <div
    //                   key={driver.id}
    //                   className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
    //                     driver.name === "NOR"
    //                       ? "bg-accent/10 border-accent"
    //                       : "bg-secondary border-border hover:bg-secondary/80"
    //                   }`}
    //                 >
    //                   <div
    //                     className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
    //                       driver.position === 1
    //                         ? "bg-yellow-500 text-black"
    //                         : driver.position === 2
    //                         ? "bg-gray-400 text-black"
    //                         : driver.position === 3
    //                         ? "bg-orange-600 text-white"
    //                         : "bg-muted text-muted-foreground"
    //                     }`}
    //                   >
    //                     {driver.position}
    //                   </div>
    //                   <div className="flex-1">
    //                     <div
    //                       className={`font-bold ${
    //                         driver.name === "NOR" ? "text-accent" : ""
    //                       }`}
    //                     >
    //                       {driver.name}
    //                     </div>
    //                     <div className="text-xs text-muted-foreground">
    //                       {driver.team}
    //                     </div>
    //                   </div>
    //                 </div>
    //               ))}
    //           </div>
    //         </CardContent>
    //       </Card>
    //     </div>
    //   </div>
    // </div>
    <p>hello</p>
  );
};
