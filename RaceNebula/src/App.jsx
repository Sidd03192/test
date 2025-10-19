"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cloud, Wind, Droplets, Gauge, Zap, Circle, Fuel, Play, Pause, TrendingUp, Target, Users } from "lucide-react";

// Backend API configuration
const API_BASE_URL = "http://localhost:5001/api";

const App = () => {
  // Playback controls
  const [sessionTime, setSessionTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Driver selection
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [allDriversData, setAllDriversData] = useState([]);

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
  });

  const [drivers, setDrivers] = useState([]);
  const [positionHistory, setPositionHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Scenario planner state
  const [tireCompound, setTireCompound] = useState(1);
  const [tirePressure, setTirePressure] = useState([23]);
  const [fuelLoad, setFuelLoad] = useState([65]);
  const [prediction, setPrediction] = useState(null);

  // Fetch race data from backend
  const fetchRaceData = async (time) => {
    try {
      setError(null);
      console.log(`Fetching data for time: ${time}`);
      const response = await fetch(`${API_BASE_URL}/race_state_by_time?time=${time}`);

      if (!response.ok) {
        console.error('Backend response not OK:', response.status);
        setError(`Backend error: ${response.status}`);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      console.log('Received data:', data);

      if (data.drivers && data.drivers.length > 0) {
        // Filter out invalid drivers (those with NaN or missing Driver field)
        const validDrivers = data.drivers.filter(d => d.Driver && d.Driver !== 'NaN' && typeof d.Driver === 'string');
        console.log('Valid drivers:', validDrivers.length);

        setAllDriversData(validDrivers);

        // Update available drivers list (only once)
        if (availableDrivers.length === 0) {
          const uniqueDrivers = [...new Set(validDrivers.map(d => d.Driver))].filter(Boolean);
          console.log('Unique drivers:', uniqueDrivers);
          setAvailableDrivers(uniqueDrivers);
          if (!selectedDriver && uniqueDrivers.length > 0) {
            setSelectedDriver(uniqueDrivers[0]);
          }
        }

        // Update drivers positions for track map
        const driversWithPositions = validDrivers
          .filter(d => d.X && d.Y && !isNaN(d.X) && !isNaN(d.Y))
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

        // Find selected driver's data
        const focusedDriver = validDrivers.find(d => d.Driver === selectedDriver) || validDrivers[0];

        setRaceState({
          lap: focusedDriver.LapNumber || 0,
          totalLaps: 58,
          position: focusedDriver.Position || 0,
          driver: focusedDriver.Driver || "",
          team: focusedDriver.Team || "",
          sessionTime: time,
        });

        setTelemetry({
          RPM: focusedDriver.RPM || 0,
          maxRpm: 15000,
          nGear: focusedDriver.nGear || 0,
          Throttle: focusedDriver.Throttle || 0,
          Brake: focusedDriver.Brake || false,
          Speed: focusedDriver.Speed || 0,
          DRS: focusedDriver.DRS || 0,
          Compound: focusedDriver.Compound || "MEDIUM",
          TyreLife: focusedDriver.TyreLife || 0,
          X: focusedDriver.X || 0,
          Y: focusedDriver.Y || 0,
        });

        // Track position history
        setPositionHistory(prev => {
          const newHistory = [...prev, focusedDriver.Position || 0];
          return newHistory.slice(-20); // Keep last 20 data points
        });

        // Fetch weather data
        try {
          const weatherResponse = await fetch(`${API_BASE_URL}/weather_by_time?time=${time}`);
          const weatherData = await weatherResponse.json();
          setWeather({
            AirTemp: weatherData.AirTemp || 0,
            TrackTemp: weatherData.TrackTemp || 0,
            WindSpeed: weatherData.WindSpeed || 0,
            Rainfall: weatherData.Rainfall || false,
          });
        } catch (err) {
          console.log("Weather data not available");
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
    if (isPlaying) {
      const interval = setInterval(() => {
        setSessionTime((prev) => {
          const newTime = prev + playbackSpeed;
          fetchRaceData(newTime);
          return newTime;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, playbackSpeed, selectedDriver]);

  // Initial data load & reload when driver changes
  useEffect(() => {
    if (selectedDriver) {
      fetchRaceData(sessionTime);
    }
  }, [selectedDriver]);

  const tireCompounds = ["SOFT", "MEDIUM", "HARD"];

  const handlePredictScenario = async () => {
    try {
      const compound = tireCompounds[tireCompound];
      const response = await fetch(`${API_BASE_URL}/predict_scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modifications: {
            next_compound: compound,
            pit_lap: raceState.lap + 5,
            tire_pressure: tirePressure[0],
            fuel_load: fuelLoad[0],
          }
        })
      });
      const data = await response.json();
      setPrediction(data.scenario?.notes || "Prediction calculated");
    } catch (error) {
      console.error("Error predicting scenario:", error);
      setPrediction("Unable to calculate prediction");
    }
  };

  // Normalize X,Y coordinates to percentage for rendering
  const normalizeCoordinates = (drivers) => {
    if (drivers.length === 0) return [];

    const xValues = drivers.map(d => d.x).filter(x => x !== 0);
    const yValues = drivers.map(d => d.y).filter(y => y !== 0);

    if (xValues.length === 0 || yValues.length === 0) return drivers;

    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    return drivers.map(d => ({
      ...d,
      normalizedX: ((d.x - minX) / (maxX - minX)) * 80 + 10,
      normalizedY: ((d.y - minY) / (maxY - minY)) * 80 + 10,
    }));
  };

  const normalizedDrivers = normalizeCoordinates(drivers);

  // Get tire compound color
  const getTireColor = (compound) => {
    switch(compound?.toUpperCase()) {
      case 'SOFT': return 'bg-red-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'HARD': return 'bg-gray-200';
      default: return 'bg-gray-400';
    }
  };

  // Show loading or error state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 p-4 md:p-6 flex items-center justify-center">
        <Card className="border-border bg-card/95 backdrop-blur shadow-xl p-8">
          <div className="text-center space-y-4">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <h2 className="text-2xl font-bold text-primary">Loading Race Data...</h2>
            <p className="text-muted-foreground">Connecting to backend at {API_BASE_URL}</p>
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
            <h2 className="text-2xl font-bold text-destructive">Connection Error</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => { setError(null); setIsLoading(true); fetchRaceData(0); }}>
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
                <p className="text-sm text-muted-foreground mt-1">Real-time Race Analytics & Strategy Dashboard</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground font-semibold">SELECT DRIVER</label>
                  <select
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                    className="bg-secondary text-foreground rounded-lg px-4 py-2 font-bold text-lg border-2 border-primary/50 hover:border-primary transition-all cursor-pointer"
                  >
                    {availableDrivers.map(driver => (
                      <option key={driver} value={driver}>{driver}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-4 py-2">
                  <Users className="h-5 w-5 text-primary" />
                  <div className="text-sm">
                    <div className="text-muted-foreground">Total Drivers</div>
                    <div className="font-bold text-lg">{availableDrivers.length}</div>
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
                className={`${isPlaying ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'} transition-all shadow-lg`}
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </Button>
              <div className="flex-1">
                <Slider
                  value={[sessionTime]}
                  onValueChange={(val) => {
                    setSessionTime(val[0]);
                    fetchRaceData(val[0]);
                  }}
                  min={0}
                  max={7200}
                  step={1}
                  className="w-full"
                />
              </div>
              <div className="text-lg font-mono font-bold bg-secondary px-4 py-2 rounded-lg">
                {Math.floor(sessionTime / 60)}:{String(Math.floor(sessionTime % 60)).padStart(2, '0')}
              </div>
              <div className="flex gap-2">
                {[1, 2, 5, 10].map(speed => (
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Driver Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Driver Status</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">LAP</span>
                      <span className="text-3xl font-bold text-primary">
                        {raceState.lap}
                      </span>
                      <span className="text-muted-foreground">/ {raceState.totalLaps}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">P</span>
                      <span className="text-4xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                        {raceState.position}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-base px-4 py-2 font-bold">
                    {raceState.driver} | {raceState.team}
                  </Badge>
                </div>
              </div>

              {/* Weather */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Weather</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-5 w-5 text-orange-500" />
                      <div>
                        <div className="text-xs text-muted-foreground">Track</div>
                        <div className="text-xl font-bold">{weather.TrackTemp?.toFixed(1)}°C</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-5 w-5 text-blue-400" />
                      <div>
                        <div className="text-xs text-muted-foreground">Air</div>
                        <div className="text-xl font-bold">{weather.AirTemp?.toFixed(1)}°C</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Wind className="h-5 w-5 text-cyan-400" />
                      <div>
                        <div className="text-xs text-muted-foreground">Wind</div>
                        <div className="text-lg font-bold">{weather.WindSpeed?.toFixed(1)} km/h</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Droplets className={`h-5 w-5 ${weather.Rainfall ? 'text-blue-500' : 'text-muted'}`} />
                      <div>
                        <div className="text-xs text-muted-foreground">Rain</div>
                        <div className="text-lg font-bold">{weather.Rainfall ? "Yes" : "No"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Position Trend */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Position Trend</h3>
                </div>
                <div className="h-24 bg-secondary/30 rounded-lg p-2 relative overflow-hidden">
                  <svg className="w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="none">
                    <polyline
                      points={positionHistory.map((pos, i) =>
                        `${(i / (positionHistory.length - 1 || 1)) * 200},${80 - (pos / 20) * 80}`
                      ).join(' ')}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-primary"
                    />
                  </svg>
                  <div className="absolute top-2 right-2 text-xs text-muted-foreground">
                    Last 20 updates
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {/* RPM */}
          <Card className="border-border bg-gradient-to-br from-card to-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">RPM</div>
                <div className="text-3xl font-bold text-primary">{telemetry.RPM?.toLocaleString()}</div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${telemetry.RPM > 13000 ? 'bg-destructive' : 'bg-primary'}`}
                    style={{ width: `${(telemetry.RPM / telemetry.maxRpm) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Speed */}
          <Card className="border-border bg-gradient-to-br from-card to-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Speed</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                  {telemetry.Speed?.toFixed(0)}
                </div>
                <div className="text-xs text-muted-foreground">km/h</div>
              </div>
            </CardContent>
          </Card>

          {/* Gear */}
          <Card className="border-border bg-gradient-to-br from-card to-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Gear</div>
                <div className="text-5xl font-bold text-primary text-center">{telemetry.nGear}</div>
              </div>
            </CardContent>
          </Card>

          {/* Throttle */}
          <Card className="border-border bg-gradient-to-br from-card to-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Throttle</div>
                <div className="text-3xl font-bold text-green-500">{telemetry.Throttle?.toFixed(0)}%</div>
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
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Brake</div>
                <div className="flex items-center justify-center h-16">
                  <Circle
                    className={`h-10 w-10 transition-all ${telemetry.Brake ? 'fill-destructive text-destructive animate-pulse' : 'text-muted'}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DRS */}
          <Card className="border-border bg-gradient-to-br from-card to-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">DRS</div>
                <div className="flex items-center justify-center h-16">
                  <Badge
                    variant={telemetry.DRS > 0 ? "default" : "secondary"}
                    className={`text-xl px-6 py-3 font-bold ${telemetry.DRS > 0 ? 'bg-primary animate-pulse' : ''}`}
                  >
                    {telemetry.DRS > 0 ? "OPEN" : "CLOSED"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tires */}
          <Card className="border-border bg-gradient-to-br from-card to-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Tires</div>
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-full ${getTireColor(telemetry.Compound)}`}></div>
                  <Badge variant="secondary" className="text-sm px-3 py-1 font-bold">
                    {telemetry.Compound}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">Life: {telemetry.TyreLife?.toFixed(0)} laps</div>
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
                <Badge variant="secondary" className="ml-auto">{drivers.length} Drivers</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full aspect-square bg-gradient-to-br from-secondary/30 to-secondary/10 rounded-xl border-2 border-border overflow-hidden">
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
                        <div className="font-bold text-primary">{driver.name}</div>
                        <div className="text-muted-foreground">{driver.team}</div>
                        <div className="text-accent font-semibold">{driver.speed?.toFixed(0)} km/h</div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Legend */}
                <div className="absolute top-4 right-4 bg-card/90 backdrop-blur border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">POSITIONS</div>
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
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scenario Planner */}
          <Card className="lg:col-span-4 border-border bg-card/95 backdrop-blur shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Zap className="h-5 w-5 text-accent" />
                Strategy Simulator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-muted-foreground">Tire Compound</label>
                <div className="flex gap-2">
                  {tireCompounds.map((compound, idx) => (
                    <Button
                      key={compound}
                      variant={tireCompound === idx ? "default" : "outline"}
                      onClick={() => setTireCompound(idx)}
                      className="flex-1 font-bold"
                    >
                      <div className={`w-3 h-3 rounded-full mr-2 ${getTireColor(compound)}`}></div>
                      {compound}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-sm font-semibold text-muted-foreground">Tire Pressure</label>
                  <span className="text-sm font-bold text-primary">{tirePressure[0]} PSI</span>
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
                  <label className="text-sm font-semibold text-muted-foreground">Fuel Load</label>
                  <span className="text-sm font-bold text-primary">{fuelLoad[0]} kg</span>
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
                onClick={handlePredictScenario}
                className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg"
                size="lg"
              >
                <Zap className="h-5 w-5 mr-2" />
                Run Prediction
              </Button>

              {prediction && (
                <div className="p-4 bg-gradient-to-r from-secondary/50 to-accent/10 rounded-lg border-2 border-accent/50 shadow-lg animate-in slide-in-from-bottom">
                  <h4 className="text-sm font-semibold text-accent mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Prediction Result
                  </h4>
                  <p className="text-sm text-foreground leading-relaxed font-medium">{prediction}</p>
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
