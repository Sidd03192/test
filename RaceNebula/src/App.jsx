"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Cloud,
  Wind,
  Droplets,
  Gauge,
  Zap,
  Circle,
  Fuel,
  Play,
  Pause,
  TrendingUp,
  Target,
  Users,
  Thermometer,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";

// Backend API configuration
const API_BASE_URL = "http://localhost:5001/api";

// === DELTA SIMULATION HELPER ===
const applyDeltas = (
  driverData,
  weather,
  tirePressure,
  fuelLoad,
  compound,
  performancePenalty = 1.0
) => {
  if (!driverData) return { telemetry: driverData, weather };

  const basePressure = 23;
  const pressureDiff = tirePressure - basePressure;
  const fuelDiff = 65 - fuelLoad; // lighter car => positive = faster

  // Compound performance multipliers
  const compoundEffect = {
    SOFT: { speed: +5, wear: -2 },
    MEDIUM: { speed: 0, wear: 0 },
    HARD: { speed: -3, wear: +1 },
  }[compound] || { speed: 0, wear: 0 };

  // --- Apply deltas to telemetry values ---
  // --- Apply deltas to telemetry values ---
  const adjustedTelemetry = {
    ...driverData,
    Speed:
      ((driverData.Speed || 0) +
        compoundEffect.speed +
        fuelDiff * 0.4 -
        Math.abs(pressureDiff) * 1.5) *
      performancePenalty, // <-- APPLY PENALTY
    RPM:
      ((driverData.RPM || 0) + (compoundEffect.speed + fuelDiff * 0.2) * 20) *
      performancePenalty, // <-- APPLY PENALTY
    Throttle: Math.max(
      0,
      Math.min(100, (driverData.Throttle || 0) + fuelDiff * 0.3)
    ),
    TyreLife:
      (driverData.TyreLife || 0) +
      compoundEffect.wear -
      Math.abs(pressureDiff) * 1.0,
    X:
      (driverData.X || 0) +
      (compoundEffect.speed + fuelDiff * 0.2) * 0.15 * performancePenalty, // <-- APPLY PENALTY
    Y:
      (driverData.Y || 0) +
      (compoundEffect.speed + fuelDiff * 0.2) * 0.09 * performancePenalty, // <-- APPLY PENALTY
  };

  // --- Apply deltas to weather values (tiny effects) ---
  const adjustedWeather = {
    AirTemp: 0, // Set to 0 or base value if you remove the separate API call
    TrackTemp: 0, // Set to 0 or base value
    WindSpeed: 0,
    Rainfall: weather?.Rainfall || false,
  };

  return { telemetry: adjustedTelemetry, weather: adjustedWeather };
};

const App = () => {
  // Playback controls
  const [sessionTime, setSessionTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [engineHeat, setEngineHeat] = useState(85.0); // Temperature in Celsius
  // Driver selection
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [allDriversData, setAllDriversData] = useState([]);
  const [tireWear, setTireWear] = useState(100.0); // Tire wear as a percentage
  const [alerts, setAlerts] = useState([]); // An array to hold active alerts
  const prevSessionTimeRef = useRef(sessionTime); // To calculate time delta
  const [performancePenalty, setPerformancePenalty] = useState(1.0); // 1.0 = 100% speed
  const [raceState, setRaceState] = useState({
    lap: 0,
    totalLaps: 58,
    position: 0,
    driver: "",
    team: "",
    sessionTime: 0,
  });

  const [weather, setWeather] = useState({
    AirTemp: 0,
    TrackTemp: 0,
    WindSpeed: 0,
    Rainfall: false,
  });

  const [telemetry, setTelemetry] = useState({
    RPM: 0,
    maxRpm: 15000,
    nGear: 0,
    Throttle: 0,
    Brake: false,
    Speed: 0,
    DRS: 0,
    Compound: "MEDIUM",
    TyreLife: 0,
    X: 0,
    Y: 0,
    DriverAhead: null,
    GapToAhead: null,
  });

  const [previousGap, setPreviousGap] = useState(null);
  const [teamInfo, setTeamInfo] = useState({
    TeamColor: null,
    HeadshotUrl: null,
    TeamName: null,
  });

  const [drivers, setDrivers] = useState([]);
  const [positionHistory, setPositionHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trackOutline, setTrackOutline] = useState([]);

  // Scenario planner state
  const [tireCompound, setTireCompound] = useState(1);
  const [tirePressure, setTirePressure] = useState([23]);
  const [fuelLoad, setFuelLoad] = useState([65]);
  const [prediction, setPrediction] = useState(null);

  // Digital Twin Ghost Car state
  const [ghostCar, setGhostCar] = useState(null);
  const [showGhost, setShowGhost] = useState(false);
  const [simulationActive, setSimulationActive] = useState(false);
  const [pitLap, setPitLap] = useState([30]);
  const [engineMode, setEngineMode] = useState(1); // 0=ECO, 1=NORMAL, 2=POWER

  // Fetch race data from backend
  const fetchRaceData = async (time) => {
    try {
      setError(null);
      const response = await fetch(
        `${API_BASE_URL}/race_state_by_time?time=${time}`
      );

      if (!response.ok) {
        setError(`Backend error: ${response.status}`);
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (data.drivers && data.drivers.length > 0) {
        const validDrivers = data.drivers.filter(
          (d) => d.Driver && d.Driver !== "NaN" && typeof d.Driver === "string"
        );

        setAllDriversData(validDrivers);

        if (availableDrivers.length === 0) {
          const uniqueDrivers = [
            ...new Set(validDrivers.map((d) => d.Driver)),
          ].filter(Boolean);
          setAvailableDrivers(uniqueDrivers);
          if (!selectedDriver && uniqueDrivers.length > 0) {
            setSelectedDriver(uniqueDrivers[0]);
          }
        }

        const driversWithPositions = validDrivers
          .filter((d) => d.X && d.Y && !isNaN(d.X) && !isNaN(d.Y))
          .map((d, idx) => ({
            id: idx,
            name: d.Driver || "UNK",
            position: d.Position || 0,
            team: d.Team || "Unknown",
            x: d.X || 0,
            y: d.Y || 0,
            speed: d.Speed || 0,
          }));

        setDrivers(driversWithPositions);

        const focusedDriver =
          validDrivers.find((d) => d.Driver === selectedDriver) ||
          validDrivers[0];

        // === APPLY DELTAS HERE ===
        const { telemetry: adjustedTelemetry, weather: adjustedWeather } =
          applyDeltas(
            focusedDriver,
            weather,
            tirePressure[0],
            fuelLoad[0],
            ["SOFT", "MEDIUM", "HARD"][tireCompound],
            performancePenalty // <-- Pass the state variable here
          );

        setRaceState({
          lap: focusedDriver.LapNumber || 0,
          totalLaps: 58,
          position: focusedDriver.Position || 0,
          driver: focusedDriver.Driver || "",
          team: focusedDriver.Team || "",
          sessionTime: time,
        });

        // Track previous gap for color indication
        const newGap = focusedDriver.GapToAhead || null;
        if (newGap !== null && telemetry.GapToAhead !== null) {
          setPreviousGap(telemetry.GapToAhead);
        }

        setTelemetry({
          RPM: adjustedTelemetry.RPM || 0,
          maxRpm: 15000,
          nGear: adjustedTelemetry.nGear || 0,
          Throttle: adjustedTelemetry.Throttle || 0,
          Brake: adjustedTelemetry.Brake || false,
          Speed: adjustedTelemetry.Speed || 0,
          DRS: adjustedTelemetry.DRS || 0,
          Compound: adjustedTelemetry.Compound || "MEDIUM",
          TyreLife: adjustedTelemetry.TyreLife || 0,
          X: adjustedTelemetry.X || 0,
          Y: adjustedTelemetry.Y || 0,
          DriverAhead: adjustedTelemetry.DriverAhead || null,
          GapToAhead: adjustedTelemetry.GapToAhead || null,
        });

        setPositionHistory((prev) => {
          const newHistory = [...prev, focusedDriver.Position || 0];
          return newHistory.slice(-20);
        });

        // Fetch and apply weather
        try {
          const weatherResponse = await fetch(
            `${API_BASE_URL}/weather_by_time?time=${time}`
          );
          const weatherData = await weatherResponse.json();
          setWeather({
            AirTemp: (weatherData.AirTemp || 0) + adjustedWeather.AirTemp,
            TrackTemp: (weatherData.TrackTemp || 0) + adjustedWeather.TrackTemp,
            WindSpeed: weatherData.WindSpeed || 0,
            Rainfall: weatherData.Rainfall || false,
          });
        } catch {
          console.log("Weather data unavailable");
        }
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching race data:", error);
      setError(`Failed to fetch data: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Playback effect
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setSessionTime((prev) => prev + playbackSpeed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // Initial load
  useEffect(() => {
    setSessionTime(3700);
    fetchRaceData(3700);
  }, []);

  // Refetch when time changes
  useEffect(() => {
    if (selectedDriver && sessionTime !== 0) {
      fetchRaceData(sessionTime);
    }
  }, [sessionTime]);

  // ... after the useEffect that refetches when the driver changes

  // === UPGRADED: USEEFFECT FOR MANAGING ALERTS & PENALTIES ===
  // ... after the [sessionTime] useEffect

  // === CONSOLIDATED HOOK FOR REAL-TIME CALCULATIONS ===
  useEffect(() => {
    const deltaTime = sessionTime - prevSessionTimeRef.current;
    prevSessionTimeRef.current = sessionTime;

    if (isPlaying && deltaTime > 0) {
      // --- 1. Tire Wear Logic ---
      const baseWearRate = 0.05;
      const compoundModifiers = { SOFT: 1.6, MEDIUM: 1.0, HARD: 0.7 };
      const currentCompound = ["SOFT", "MEDIUM", "HARD"][tireCompound];
      const compoundModifier = compoundModifiers[currentCompound] || 1.0;
      const fuelModifier = 1 + (fuelLoad[0] / 110) * 0.4;
      const wearAmount =
        deltaTime * baseWearRate * compoundModifier * fuelModifier;
      setTireWear((prevWear) => Math.max(0, prevWear - wearAmount));

      // --- 2. Engine Heat Logic ---
      const heatRates = {
        0: -0.8, // ECO: cools down
        1: 1.1, // NORMAL: cools slightly
        2: 1.5, // POWER: heats up quickly
      };
      const heatRate = heatRates[engineMode] || -0.2;
      const heatChange = deltaTime * heatRate;
      setEngineHeat((prevHeat) =>
        Math.max(70, Math.min(130, prevHeat + heatChange))
      );
    }
  }, [sessionTime, isPlaying, tireCompound, fuelLoad, engineMode]);

  // ... after the tire wear calculation use

  // Find your existing "TIRE WEAR CALCULATION" useEffect and add to it

  useEffect(() => {
    if (selectedDriver) {
      fetchTrackOutline(selectedDriver);
      fetchDriverInfo(selectedDriver);
      fetchRaceData(sessionTime);
    }
  }, [selectedDriver]);

  // Optional live delta updates when sliders move
  useEffect(() => {
    if (selectedDriver && allDriversData.length > 0) {
      const focusedDriver =
        allDriversData.find((d) => d.Driver === selectedDriver) ||
        allDriversData[0];
      const { telemetry: adjustedTelemetry, weather: adjustedWeather } =
        applyDeltas(
          focusedDriver,
          weather,
          tirePressure[0],
          fuelLoad[0],
          ["SOFT", "MEDIUM", "HARD"][tireCompound],
          performancePenalty // <-- Pass the state variable here
        );
      setTelemetry(adjustedTelemetry);
      setWeather(adjustedWeather);
    }
  }, [tirePressure, fuelLoad, tireCompound]);

  const fetchTrackOutline = async (driver) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/track_outline?driver=${driver}`
      );
      if (response.ok) {
        const data = await response.json();
        setTrackOutline(data.positions || []);
      }
    } catch (err) {
      console.error("Failed to fetch track outline:", err);
    }
  };

  const fetchDriverInfo = async (driver) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/driver_info?driver=${driver}`
      );
      if (response.ok) {
        const data = await response.json();
        setTeamInfo({
          TeamColor: data.TeamColor || null,
          HeadshotUrl: data.HeadshotUrl || null,
          TeamName: data.TeamName || null,
        });
      }
    } catch (err) {
      console.error("Failed to fetch driver info:", err);
    }
  };

  const tireCompounds = ["SOFT", "MEDIUM", "HARD"];

  const handlePredictScenario = async () => {
    try {
      const compound = tireCompounds[tireCompound];
      const response = await fetch(`${API_BASE_URL}/predict_scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modifications: {
            next_compound: compound,
            pit_lap: raceState.lap + 5,
            tire_pressure: tirePressure[0],
            fuel_load: fuelLoad[0],
          },
        }),
      });
      const data = await response.json();
      setPrediction(data.scenario?.notes || "Prediction calculated");
    } catch {
      setPrediction("Unable to calculate prediction");
    }
  };

  const handleRunSimulation = async () => {
    setSimulationActive(true);
    setPrediction(null);
    try {
      const response = await fetch(`${API_BASE_URL}/run_simulation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver: selectedDriver,
          current_lap: raceState.lap,
          pit_lap: pitLap[0],
          pit_compound: tireCompounds[tireCompound],
          tire_pressure: tirePressure[0],
          fuel_load: fuelLoad[0],
          engine_mode: engineMode,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setPrediction(`Simulation error: ${data.error}`);
        setGhostCar(null);
      } else {
        setGhostCar(data.simulated_laps);
        setShowGhost(true);

        // Set prediction summary
        const finalLap = data.simulated_laps[data.simulated_laps.length - 1];
        const positionChange = finalLap.position - raceState.position;
        setPrediction(
          `Digital Twin completed! Final position: P${finalLap.position} (${
            positionChange > 0 ? "+" : ""
          }${positionChange}). Total time: ${(
            finalLap.cumulative_time / 60
          ).toFixed(2)} min.`
        );
      }
      setSimulationActive(false);
    } catch (err) {
      console.error("Simulation failed:", err);
      setPrediction("Unable to run simulation. Check console for details.");
      setSimulationActive(false);
    }
  };

  // Find your existing "MANAGING ALERTS" useEffect and add to it

  useEffect(() => {
    const activeAlerts = [];

    // --- Tire Wear Alerts (existing) ---
    if (tireWear <= 20) {
      activeAlerts.push({
        id: "tire_wear_critical",
        variant: "destructive",
        title: "⚠️ Critical Tire Wear!",
        description: `Tire integrity is at ${tireWear.toFixed(
          1
        )}%. Pit immediately!`,
      });
    } else if (tireWear <= 40) {
      activeAlerts.push({
        id: "tire_wear_warning",
        variant: "default",
        title: "Low Tire Wear Warning",
        description: `Tire life is at ${tireWear.toFixed(
          1
        )}%. Consider a pit stop soon.`,
      });
    }

    // === NEW: ENGINE HEAT ALERTS ===
    if (engineHeat >= 115) {
      activeAlerts.push({
        id: "engine_heat_critical",
        variant: "destructive",
        title: "🔥 ENGINE OVERHEATING!",
        description: `Temperature at ${engineHeat.toFixed(
          1
        )}°C. Switch to ECO mode or risk engine damage!`,
      });
    } else if (engineHeat >= 105) {
      activeAlerts.push({
        id: "engine_heat_warning",
        variant: "default",
        title: "High Engine Temperature",
        description: `Temperature at ${engineHeat.toFixed(
          1
        )}°C. Consider using a lower engine mode to cool down.`,
      });
    }
    // === END OF NEW ALERTS ===

    setAlerts(activeAlerts);
  }, [tireWear, engineHeat]); // <-- Add engineHeat to dependencies

  // === Normalize, render, and UI unchanged ===
  // (the rest of your render code below stays identical)

  // Normalize X,Y coordinates using unified bounds for track and drivers
  const normalizeWithUnifiedBounds = (drivers, trackOutline) => {
    const allXValues = [];
    const allYValues = [];

    // Collect all X,Y values from track outline (prioritize if available)
    if (trackOutline && trackOutline.length > 0) {
      trackOutline.forEach((p) => {
        if (p.x && !isNaN(p.x)) allXValues.push(p.x);
        if (p.y && !isNaN(p.y)) allYValues.push(p.y);
      });
    }

    // Also collect from drivers
    if (drivers && drivers.length > 0) {
      drivers.forEach((d) => {
        if (d.x && !isNaN(d.x) && d.x !== 0) allXValues.push(d.x);
        if (d.y && !isNaN(d.y) && d.y !== 0) allYValues.push(d.y);
      });
    }

    if (allXValues.length === 0 || allYValues.length === 0) {
      return {
        drivers: drivers || [],
        trackOutline: [],
        path: "",
      };
    }

    const minX = Math.min(...allXValues);
    const maxX = Math.max(...allXValues);
    const minY = Math.min(...allYValues);
    const maxY = Math.max(...allYValues);

    // Normalize drivers
    const normalizedDrivers = (drivers || []).map((d) => ({
      ...d,
      normalizedX: ((d.x - minX) / (maxX - minX)) * 80 + 10,
      normalizedY: ((d.y - minY) / (maxY - minY)) * 80 + 10,
    }));

    // Normalize track outline
    const normalizedTrack = (trackOutline || []).map((p) => ({
      x: ((p.x - minX) / (maxX - minX)) * 80 + 10,
      y: ((p.y - minY) / (maxY - minY)) * 80 + 10,
    }));

    // Create SVG path
    const path =
      normalizedTrack.length > 0
        ? normalizedTrack
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ") + " Z"
        : "";

    return {
      drivers: normalizedDrivers,
      trackOutline: normalizedTrack,
      path,
    };
  };

  const normalized = normalizeWithUnifiedBounds(drivers, trackOutline);
  const normalizedDrivers = normalized.drivers;
  const trackOutlinePath = normalized.path;

  // Get tire compound color
  const getTireColor = (compound) => {
    switch (compound?.toUpperCase()) {
      case "SOFT":
        return "bg-red-500";
      case "MEDIUM":
        return "bg-yellow-500";
      case "HARD":
        return "bg-gray-200";
      default:
        return "bg-gray-400";
    }
  };

  // Show loading or error state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 p-4 md:p-6 flex items-center justify-center">
        <Card className="border-border bg-card/95 backdrop-blur shadow-xl p-8">
          <div className="text-center space-y-4">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <h2 className="text-2xl font-bold text-primary">
              Loading Race Data...
            </h2>
            <p className="text-muted-foreground">
              Connecting to backend at {API_BASE_URL}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 p-4 md:p-6 flex items-center justify-center">
        <Card className="border-destructive bg-card/95 backdrop-blur shadow-xl p-8">
          <div className="text-center space-y-4">
            <div className="text-destructive text-6xl">⚠️</div>
            <h2 className="text-2xl font-bold text-destructive">
              Connection Error
            </h2>
            <p className="text-muted-foreground">{error}</p>
            <Button
              onClick={() => {
                setError(null);
                setIsLoading(true);
                fetchRaceData(0);
              }}
            >
              Retry Connection
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 p-4 md:p-6">
      <div className="grid grid-cols-1 gap-4 max-w-[2000px] mx-auto">
        {/* Header with Driver Selection */}
        <Card className="border-border bg-card/95 backdrop-blur shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  RACENEBULA F1
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Real-time Race Analytics & Strategy Dashboard
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground font-semibold">
                    SELECT DRIVER
                  </label>
                  <select
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                    className="bg-secondary text-foreground rounded-lg px-4 py-2 font-bold text-lg border-2 border-primary/50 hover:border-primary transition-all cursor-pointer"
                  >
                    {availableDrivers.map((driver) => (
                      <option key={driver} value={driver}>
                        {driver}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-4 py-2">
                  <Users className="h-5 w-5 text-primary" />
                  <div className="text-sm">
                    <div className="text-muted-foreground">Total Drivers</div>
                    <div className="font-bold text-lg">
                      {availableDrivers.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Playback Controls */}
        <Card className="border-border bg-card/95 backdrop-blur shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setIsPlaying(!isPlaying)}
                size="lg"
                className={`${
                  isPlaying
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-primary hover:bg-primary/90"
                } transition-all shadow-lg`}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6" />
                )}
              </Button>
              <div className="flex-1">
                <Slider
                  value={[sessionTime]}
                  onValueChange={(val) => {
                    setSessionTime(val[0]);
                    fetchRaceData(val[0]);
                  }}
                  min={3700}
                  max={9000}
                  step={1}
                  className="w-full"
                />
              </div>
              <div className="text-lg font-mono font-bold bg-secondary px-4 py-2 rounded-lg">
                {Math.floor(sessionTime / 60)}:
                {String(Math.floor(sessionTime % 60)).padStart(2, "0")}
              </div>
              <div className="flex gap-2">
                {[1, 2, 5, 10].map((speed) => (
                  <Button
                    key={speed}
                    variant={playbackSpeed === speed ? "default" : "outline"}
                    onClick={() => setPlaybackSpeed(speed)}
                    size="sm"
                    className="font-bold"
                  >
                    {speed}x
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Race State & Weather */}
        <Card className="border-border bg-card/95 backdrop-blur shadow-lg">
          <CardContent className="p-6">
            <div className="flex justify-between">
              {/* Driver Info */}
              <div className="space-y-3">
                <Badge
                  variant="secondary"
                  className="text-base px-4 py-2 font-bold flex items-center gap-2"
                  style={{
                    borderLeft: teamInfo.TeamColor
                      ? `4px solid #${teamInfo.TeamColor}`
                      : "none",
                  }}
                >
                  {teamInfo.HeadshotUrl && (
                    <img
                      src={teamInfo.HeadshotUrl}
                      alt={raceState.driver}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  )}
                  {raceState.driver} | {teamInfo.TeamName || raceState.team}
                </Badge>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Driver Status
                  </h3>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">LAP</span>
                      <span className="text-3xl font-bold text-primary">
                        {raceState.lap}
                      </span>
                      <span className="text-muted-foreground">
                        / {raceState.totalLaps}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">P</span>
                      <span className="text-4xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                        {raceState.position}
                      </span>
                    </div>
                  </div>

                  {/* Gap to driver ahead */}
                  {telemetry.DriverAhead && telemetry.GapToAhead !== null && (
                    <div className="flex items-center gap-2 mt-2 bg-secondary/50 rounded-lg px-3 py-2">
                      <Target className="h-4 w-4 text-white" />
                      <div>
                        <span className="text-xs text-white-foreground">
                          Gap to{" "}
                        </span>
                        <span className="text-sm font-bold text-white">
                          {telemetry.DriverAhead}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          :{" "}
                        </span>
                        <span
                          className={`text-lg font-bold ${
                            previousGap !== null &&
                            telemetry.GapToAhead !== null
                              ? telemetry.GapToAhead > previousGap
                                ? "text-red-500"
                                : "text-green-500"
                              : "text-primary"
                          }`}
                        >
                          {telemetry.GapToAhead > 0
                            ? `+${telemetry.GapToAhead.toFixed(1)}m`
                            : `${telemetry.GapToAhead.toFixed(1)}m`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Alerts */}

              {/* In the Race State & Weather Card, find the "Alerts" section */}

              {/* === REPLACE YOUR STATIC ALERT WITH THIS DYNAMIC BLOCK === */}
              <div className="space-y-3 min-w-[500px] align-center h-full justify-center ">
                {alerts.length > 0 ? (
                  alerts.map((alert) => (
                    <Alert key={alert.id} variant={alert.variant}>
                      <AlertTitle>{alert.title}</AlertTitle>
                      <AlertDescription>{alert.description}</AlertDescription>
                    </Alert>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full bg-secondary/30 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      ✅ No active alerts
                    </p>
                  </div>
                )}
              </div>
              {/* === END OF REPLACEMENT === */}
              {/* Weather */}
              <div className="space-y-3 ">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Weather
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-5 w-5 text-orange-500" />
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Track
                        </div>
                        <div className="text-xl font-bold">
                          {weather.TrackTemp?.toFixed(1)}°C
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-5 w-5 text-blue-400" />
                      <div>
                        <div className="text-xs text-muted-foreground">Air</div>
                        <div className="text-xl font-bold">
                          {weather.AirTemp?.toFixed(1)}°C
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Wind className="h-5 w-5 text-cyan-400" />
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Wind
                        </div>
                        <div className="text-lg font-bold">
                          {weather.WindSpeed?.toFixed(1)} km/h
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Droplets
                        className={`h-5 w-5 ${
                          weather.Rainfall ? "text-blue-500" : "text-muted"
                        }`}
                      />
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Rain
                        </div>
                        <div className="text-lg font-bold">
                          {weather.Rainfall ? "Yes" : "No"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* RPM */}
          <Card className="border-border bg-gradient-to-br from-card to-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                  RPM
                </div>
                <div className="text-3xl font-bold text-primary">
                  {telemetry.RPM?.toLocaleString()}
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      telemetry.RPM > 13000 ? "bg-destructive" : "bg-primary"
                    }`}
                    style={{
                      width: `${(telemetry.RPM / telemetry.maxRpm) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Speed */}
          <Card className="border-border bg-gradient-to-br from-card to-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                  Speed
                </div>
                <div className="text-3xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                  {telemetry.Speed?.toFixed(0)}
                </div>
                <div className="text-xs text-muted-foreground">km/h</div>
              </div>
            </CardContent>
          </Card>

          {/* Gear */}
          {/* Tires Card */}
          <Card className="border-border bg-gradient-to-br from-card to-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-4">
              <div className="space-y-2">
                {/* ... The existing content (Tires title, tire color circle, compound badge) remains the same ... */}
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                  Tires
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-8 w-8 rounded-full ${getTireColor(
                      telemetry.Compound
                    )}`}
                  ></div>
                  <Badge
                    variant="secondary"
                    className="text-sm px-3 py-1 font-bold"
                  >
                    {telemetry.Compound}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Life: {telemetry.TyreLife?.toFixed(0)} laps
                </div>

                {/* === ADD THIS NEW SECTION FOR TIRE WEAR === */}
                <div className="pt-2">
                  <div className="text-xs text-muted-foreground font-semibold flex justify-between items-center">
                    <span>WEAR</span>
                    <span className="text-primary font-bold text-base">
                      {tireWear.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all duration-300 ${
                        tireWear <= 20
                          ? "bg-destructive"
                          : tireWear <= 40
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{ width: `${tireWear}%` }}
                    />
                  </div>
                </div>
                {/* === END OF NEW SECTION === */}
              </div>
            </CardContent>
          </Card>

          {/* Throttle */}
          <Card className="border-border bg-gradient-to-br from-card to-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                  Throttle
                </div>
                <div className="text-3xl font-bold text-green-500">
                  {telemetry.Throttle?.toFixed(0)}%
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${telemetry.Throttle}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Brake */}
          <Card className="border-border bg-gradient-to-br from-card to-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                  Brake
                </div>
                <div className="flex items-center justify-center h-16">
                  <Circle
                    className={`h-10 w-10 transition-all ${
                      telemetry.Brake
                        ? "fill-destructive text-destructive animate-pulse"
                        : "text-muted"
                    }`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DRS */}
          <Card className="border-border bg-gradient-to-br from-card to-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                  <Thermometer className="h-4 w-4" />
                  <span>Engine Heat</span>
                </div>
                <div className="text-3xl font-bold text-primary">
                  {engineHeat.toFixed(1)}°C
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      engineHeat >= 115
                        ? "bg-destructive"
                        : engineHeat >= 105
                        ? "bg-yellow-500"
                        : "bg-blue-500"
                    }`}
                    style={{
                      width: `${((engineHeat - 70) / (130 - 70)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Live Track Map */}
          <Card className="lg:col-span-8 border-border bg-card/95 backdrop-blur shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Live Track Map
                <Badge variant="secondary" className="ml-auto">
                  {drivers.length} Drivers
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full aspect-square bg-gradient-to-br from-secondary/30 to-secondary/10 rounded-xl border-2 border-border overflow-hidden">
                {/* Track outline SVG */}
                {trackOutlinePath && (
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <path
                      d={trackOutlinePath}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="0.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-primary/50"
                    />
                  </svg>
                )}

                {/* Track visualization using actual X,Y coordinates */}
                {normalizedDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className="absolute transition-all duration-500 ease-linear"
                    style={{
                      left: `${driver.normalizedX}%`,
                      top: `${driver.normalizedY}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="relative group">
                      <div
                        className={`w-10 h-10 rounded-full border-3 flex items-center justify-center text-sm font-bold shadow-lg transition-all ${
                          driver.name === selectedDriver
                            ? "bg-accent border-accent text-accent-foreground ring-4 ring-accent/50 scale-125 z-10"
                            : driver.position === 1
                            ? "bg-yellow-500 border-yellow-600 text-black"
                            : driver.position === 2
                            ? "bg-gray-300 border-gray-400 text-black"
                            : driver.position === 3
                            ? "bg-orange-500 border-orange-600 text-white"
                            : "bg-primary border-primary/50 text-primary-foreground"
                        }`}
                      >
                        {driver.position}
                      </div>
                      {/* Trail effect for selected driver */}
                      {driver.name === selectedDriver && (
                        <div className="absolute inset-0 bg-accent rounded-full animate-ping opacity-20"></div>
                      )}
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-card border-2 border-border rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-20 shadow-xl">
                        <div className="font-bold text-primary">
                          {driver.name}
                        </div>
                        <div className="text-muted-foreground">
                          {driver.team}
                        </div>
                        <div className="text-accent font-semibold">
                          {driver.speed?.toFixed(0)} km/h
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Ghost Car Visualization */}
                {showGhost &&
                  ghostCar &&
                  (() => {
                    const currentLap = raceState.lap;
                    const ghostLapData = ghostCar.find(
                      (l) => l.lap === currentLap
                    );

                    if (!ghostLapData) return null;

                    // Find actual driver position for reference
                    const actualDriver = normalizedDrivers.find(
                      (d) => d.name === selectedDriver
                    );
                    if (!actualDriver) return null;

                    // Offset ghost car slightly for visibility
                    return (
                      <div
                        className="absolute transition-all duration-500"
                        style={{
                          left: `${actualDriver.normalizedX + 3}%`,
                          top: `${actualDriver.normalizedY + 3}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <div className="relative z-20">
                          <div className="w-10 h-10 rounded-full border-3 border-dashed border-purple-500 bg-purple-500/30 flex items-center justify-center text-sm font-bold shadow-lg">
                            {ghostLapData.position}
                          </div>
                          <div className="absolute inset-0 bg-purple-500 rounded-full animate-ping opacity-10"></div>
                          {/* Ghost tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-purple-900/90 border-2 border-purple-500 rounded-lg text-xs whitespace-nowrap shadow-xl">
                            <div className="font-bold text-purple-300">
                              GHOST CAR
                            </div>
                            <div className="text-purple-200">
                              P{ghostLapData.position}
                            </div>
                            <div className="text-purple-400 text-[10px]">
                              {ghostLapData.compound} ({ghostLapData.tyre_life}{" "}
                              laps)
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                {/* Legend */}
                <div className="absolute top-4 right-4 bg-card/90 backdrop-blur border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    POSITIONS
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-yellow-500 border-2 border-yellow-600"></div>
                    <span className="text-xs">P1</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-300 border-2 border-gray-400"></div>
                    <span className="text-xs">P2</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-orange-500 border-2 border-orange-600"></div>
                    <span className="text-xs">P3</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-accent border-2 border-accent ring-2 ring-accent/50"></div>
                    <span className="text-xs font-bold">Selected</span>
                  </div>
                  {showGhost && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border-2 border-dashed border-purple-500 bg-purple-500/30"></div>
                      <span className="text-xs font-bold text-purple-400">
                        Ghost
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Digital Twin Simulator */}
          <Card className="lg:col-span-4 border-border bg-card/95 backdrop-blur shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-500" />
                Ghost Racer 
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-muted-foreground">
                  Pit Stop Lap
                </label>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-muted-foreground">
                    Lap {pitLap[0]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Current: {raceState.lap}
                  </span>
                </div>
                <Slider
                  value={pitLap}
                  onValueChange={setPitLap}
                  min={Math.max(raceState.lap + 1, 1)}
                  max={52}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-muted-foreground">
                  Tire Compound for Pit
                </label>
                <div className="flex gap-2">
                  {tireCompounds.map((compound, idx) => (
                    <Button
                      key={compound}
                      variant={tireCompound === idx ? "default" : "outline"}
                      onClick={() => setTireCompound(idx)}
                      className="flex-1 font-bold text-xs"
                    >
                      <div
                        className={`w-3 h-3 rounded-full mr-1 ${getTireColor(
                          compound
                        )}`}
                      ></div>
                      {compound}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-muted-foreground">
                  Engine Mode
                </label>
                <div className="flex gap-2">
                  {["ECO", "NORMAL", "POWER"].map((mode, idx) => (
                    <Button
                      key={mode}
                      variant={engineMode === idx ? "default" : "outline"}
                      onClick={() => setEngineMode(idx)}
                      className="flex-1 font-bold text-xs"
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-sm font-semibold text-muted-foreground">
                    Tire Pressure
                  </label>
                  <span className="text-sm font-bold text-primary">
                    {tirePressure[0]} PSI
                  </span>
                </div>
                <Slider
                  value={tirePressure}
                  onValueChange={setTirePressure}
                  min={19}
                  max={27}
                  step={0.5}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-sm font-semibold text-muted-foreground">
                    Fuel Load
                  </label>
                  <span className="text-sm font-bold text-primary">
                    {fuelLoad[0]} kg
                  </span>
                </div>
                <Slider
                  value={fuelLoad}
                  onValueChange={setFuelLoad}
                  min={0}
                  max={110}
                  step={5}
                  className="w-full"
                />
              </div>

              <Button
                onClick={handleRunSimulation}
                disabled={simulationActive}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg disabled:opacity-50"
                size="lg"
              >
                {simulationActive ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Run Ghost Raceer simulation
                  </>
                )}
              </Button>

              {prediction && (
                <div className="p-4 bg-gradient-to-r from-secondary/50 to-accent/10 rounded-lg border-2 border-accent/50 shadow-lg animate-in slide-in-from-bottom">
                  <h4 className="text-sm font-semibold text-accent mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Prediction Result
                  </h4>
                  <p className="text-sm text-foreground leading-relaxed font-medium">
                    {prediction}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default App;
