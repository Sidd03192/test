from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import os
import numpy as np # Import numpy to handle NaN values explicitly

# --- INITIALIZATION ---
app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
TELEMETRY_DATA_FILE = 'race_data_timeseries.csv'
WEATHER_DATA_FILE = 'weather_data.csv'
DRIVER_INFO_FILE = 'driver_info.csv'
TELEMETRY_DF = None
WEATHER_DF = None
DRIVER_INFO_DF = None

def load_data():
    """
    Loads telemetry, weather, and driver info data from CSV files.
    """
    global TELEMETRY_DF, WEATHER_DF, DRIVER_INFO_DF

    if os.path.exists(TELEMETRY_DATA_FILE):
        print(f"Loading telemetry data from {TELEMETRY_DATA_FILE}...")
        TELEMETRY_DF = pd.read_csv(TELEMETRY_DATA_FILE)
        print("Telemetry data loaded successfully.")
    else:
        print(f"ERROR: {TELEMETRY_DATA_FILE} not found. Please run the data exporter script.")
        TELEMETRY_DF = pd.DataFrame()

    if os.path.exists(WEATHER_DATA_FILE):
        print(f"Loading weather data from {WEATHER_DATA_FILE}...")
        WEATHER_DF = pd.read_csv(WEATHER_DATA_FILE)
        print("Weather data loaded successfully.")
    else:
        print(f"ERROR: {WEATHER_DATA_FILE} not found. Please run the data exporter script.")
        WEATHER_DF = pd.DataFrame()

    if os.path.exists(DRIVER_INFO_FILE):
        print(f"Loading driver info from {DRIVER_INFO_FILE}...")
        DRIVER_INFO_DF = pd.read_csv(DRIVER_INFO_FILE)
        print("Driver info loaded successfully.")
    else:
        print(f"WARN: {DRIVER_INFO_FILE} not found.")
        DRIVER_INFO_DF = pd.DataFrame()

# --- API ENDPOINTS ---

@app.route('/', methods=['GET'])
def index():
    """
    Root endpoint to confirm the API is running.
    """
    return jsonify({"message": "Welcome to the NORTHMARK F1 Pit Wall API. Data is loaded and ready."})

@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for monitoring.
    """
    return jsonify({"status": "ok"})


@app.route('/api/race_state_by_time', methods=['GET'])
def get_race_state_by_time():
    """
    Returns the state of all drivers at a specific session time.
    """
    if TELEMETRY_DF is None or TELEMETRY_DF.empty:
        return jsonify({"error": "Telemetry data not loaded."}), 500

    try:
        session_time = float(request.args.get('time', 0))
    except ValueError:
        return jsonify({"error": "Invalid 'time' parameter. Must be a number."}), 400

    # --- NEW, CORRECTED LOGIC ---
    # Find the closest data point for EACH driver independently to create a true snapshot.
    result_list = []
    # Get a list of unique drivers present in the dataset
    unique_drivers = TELEMETRY_DF['Driver'].dropna().unique()

    # Get all drivers data for this time
    all_drivers_data = {}
    for driver in unique_drivers:
        driver_df = TELEMETRY_DF[TELEMETRY_DF['Driver'] == driver].dropna(subset=['SessionTime'])
        if not driver_df.empty:
            closest_idx = (driver_df['SessionTime'] - session_time).abs().idxmin()
            driver_row = driver_df.loc[closest_idx].replace({np.nan: None}).to_dict()
            all_drivers_data[driver] = driver_row
            result_list.append(driver_row)

    # Calculate gap to driver ahead for each driver
    for driver_data in result_list:
        current_pos = driver_data.get('Position')
        if current_pos and current_pos > 1:
            # Find driver in position ahead
            for ahead_driver, ahead_data in all_drivers_data.items():
                if ahead_data.get('Position') == current_pos - 1:
                    driver_data['DriverAhead'] = ahead_driver
                    # Calculate distance using X,Y coordinates
                    if (driver_data.get('X') and driver_data.get('Y') and
                        ahead_data.get('X') and ahead_data.get('Y')):
                        gap = ((driver_data['X'] - ahead_data['X'])**2 +
                               (driver_data['Y'] - ahead_data['Y'])**2)**0.5
                        driver_data['GapToAhead'] = gap
                    break

    return jsonify({"time": session_time, "drivers": result_list})

@app.route('/api/track_outline', methods=['GET'])
def get_track_outline():
    """
    Returns all X,Y positions for a driver to draw track outline.
    """
    if TELEMETRY_DF is None or TELEMETRY_DF.empty:
        return jsonify({"error": "Telemetry data not loaded."}), 500

    driver = request.args.get('driver', 'VER')

    # Get all positions for this driver, ordered by time
    driver_data = TELEMETRY_DF[TELEMETRY_DF['Driver'] == driver].copy()
    driver_data = driver_data.dropna(subset=['X', 'Y', 'SessionTime'])
    driver_data = driver_data.sort_values('SessionTime')

    # Sample every 3rd point for better accuracy while keeping data size manageable
    sampled = driver_data.iloc[::3]

    positions = [{"x": float(row['X']), "y": float(row['Y'])}
                 for _, row in sampled.iterrows()]

    return jsonify({"driver": driver, "positions": positions})

@app.route('/api/driver_info', methods=['GET'])
def get_driver_info():
    """
    Returns driver and team info for a specific driver.
    """
    if DRIVER_INFO_DF is None or DRIVER_INFO_DF.empty:
        return jsonify({"error": "Driver info not loaded."}), 500

    driver = request.args.get('driver', 'VER')
    driver_data = DRIVER_INFO_DF[DRIVER_INFO_DF['Driver'] == driver]

    if driver_data.empty:
        return jsonify({"error": f"Driver {driver} not found."}), 404

    result = driver_data.iloc[0].replace({np.nan: None}).to_dict()
    return jsonify(result)

@app.route('/api/weather_by_time', methods=['GET'])
def get_weather_by_time():
    """
    Returns the weather conditions at a specific session time.
    """
    if WEATHER_DF is None or WEATHER_DF.empty:
        return jsonify({"error": "Weather data not loaded."}), 500

    try:
        session_time = float(request.args.get('time', 0))
    except ValueError:
        return jsonify({"error": "Invalid 'time' parameter. Must be a number."}), 400

    # Find the closest weather data point in time
    weather_point = WEATHER_DF.iloc[(WEATHER_DF['SessionTime'] - session_time).abs().argsort()[0]]
    
    # --- MORE ROBUST FIX: Explicitly replace np.nan with None ---
    cleaned_data = weather_point.replace({np.nan: None})
    result = cleaned_data.to_dict()
    return jsonify(result)

# This is a simplified prediction model for the hackathon
@app.route('/api/predict_scenario', methods=['POST'])
def predict_scenario():
    # ... (prediction logic remains the same)
    scenario = request.json
    modifications = scenario.get('modifications')
    tire_gain = -1.2 if modifications.get('next_compound') == 'SOFT' else 0.5
    pit_lap_diff = modifications.get('pit_lap') - 30
    pit_time_impact = pit_lap_diff * 0.1
    total_time_impact = (tire_gain * 15) + pit_time_impact
    return jsonify({"scenario": {"predicted_time_gain": total_time_impact, "notes": f"Pitting on lap {modifications.get('pit_lap')} for {modifications.get('next_compound')}s is predicted to be {abs(total_time_impact):.2f}s {'faster' if total_time_impact < 0 else 'slower'}."}})

# --- DIGITAL TWIN SIMULATION ---

# Realistic tire performance model with degradation cliffs
TIRE_DEGRADATION_MODEL = {
    "SOFT": {
        "base_performance": -0.4,  # 0.4s faster per lap initially
        "degradation_per_lap": 0.02,  # Gradual wear
        "cliff_point": 15,  # Performance cliff after 15 laps
        "cliff_penalty": 0.3,  # Additional 0.3s/lap after cliff
        "optimal_life": 12,
        "wear_multiplier": 1.0  # Base wear rate
    },
    "MEDIUM": {
        "base_performance": 0.0,  # Baseline compound
        "degradation_per_lap": 0.015,
        "cliff_point": 25,
        "cliff_penalty": 0.25,
        "optimal_life": 20,
        "wear_multiplier": 1.0
    },
    "HARD": {
        "base_performance": 0.3,  # 0.3s slower per lap initially
        "degradation_per_lap": 0.01,
        "cliff_point": 35,
        "cliff_penalty": 0.2,
        "optimal_life": 30,
        "wear_multiplier": 1.0
    }
}

# Engine mode model with heating effects
ENGINE_MODES = {
    "ECO": {
        "performance_delta": 0.15,  # 0.15s slower per lap
        "heating_rate": -1.0,  # Cooling effect (-1°C per lap)
        "fuel_efficiency": 0.85  # 15% less fuel consumption
    },
    "NORMAL": {
        "performance_delta": 0.0,  # Baseline
        "heating_rate": 0.0,  # Neutral
        "fuel_efficiency": 1.0  # Normal consumption
    },
    "POWER": {
        "performance_delta": -0.2,  # 0.2s faster per lap
        "heating_rate": 2.0,  # Generates heat (+2°C per lap)
        "fuel_efficiency": 1.25  # 25% more fuel consumption
    }
}

def create_driver_baseline(driver, start_lap):
    """
    Create performance baseline for driver based on actual race data.
    Returns average lap time, tire degradation rate, fuel consumption, etc.
    """
    driver_data = TELEMETRY_DF[TELEMETRY_DF['Driver'] == driver].copy()

    # Get laps around the start lap to establish baseline
    baseline_window = driver_data[
        (driver_data['LapNumber'] >= max(1, start_lap - 3)) &
        (driver_data['LapNumber'] <= start_lap + 3)
    ]

    if baseline_window.empty:
        return {
            "avg_lap_time": 90.0,
            "fuel_consumption_rate": 1.5,
            "tire_deg_rate": 1.0
        }

    # Calculate average lap time for this stint
    lap_times = []
    for lap in baseline_window['LapNumber'].unique():
        lap_data = baseline_window[baseline_window['LapNumber'] == lap]
        if not lap_data.empty:
            lap_time = lap_data['SessionTime'].max() - lap_data['SessionTime'].min()
            if lap_time > 0 and lap_time < 200:  # Filter out invalid lap times
                lap_times.append(lap_time)

    avg_lap_time = sum(lap_times) / len(lap_times) if lap_times else 90.0

    return {
        "avg_lap_time": float(avg_lap_time),
        "fuel_consumption_rate": 1.5,  # kg per lap (standard F1)
        "tire_deg_rate": 1.0  # Baseline multiplier
    }

def get_driver_lap_times(driver):
    """Extract lap times and metadata for a driver"""
    driver_data = TELEMETRY_DF[TELEMETRY_DF['Driver'] == driver].copy()
    lap_times = {}

    for lap in sorted(driver_data['LapNumber'].unique()):
        if lap == 0:
            continue
        lap_data = driver_data[driver_data['LapNumber'] == lap]
        if not lap_data.empty:
            start_time = lap_data['SessionTime'].min()
            end_time = lap_data['SessionTime'].max()
            lap_times[int(lap)] = {
                "LapTime": float(end_time - start_time) if end_time > start_time else 90.0,
                "Compound": str(lap_data.iloc[0]['Compound']) if not pd.isna(lap_data.iloc[0]['Compound']) else "MEDIUM",
                "TyreLife": int(lap_data.iloc[0]['TyreLife']) if not pd.isna(lap_data.iloc[0]['TyreLife']) else 1,
                "Position": int(lap_data.iloc[0]['Position']) if not pd.isna(lap_data.iloc[0]['Position']) else 10,
                "X": float(lap_data.iloc[0]['X']) if not pd.isna(lap_data.iloc[0]['X']) else 0.0,
                "Y": float(lap_data.iloc[0]['Y']) if not pd.isna(lap_data.iloc[0]['Y']) else 0.0
            }

    return lap_times

def calculate_tire_delta(compound, life, pressure, wear_multiplier=1.0):
    """
    Realistic tire performance model with degradation cliffs.
    Includes pressure effects on wear rate.
    """
    if compound not in TIRE_DEGRADATION_MODEL:
        compound = "MEDIUM"

    model = TIRE_DEGRADATION_MODEL[compound]

    # Base performance (faster compounds are negative delta)
    delta = model["base_performance"]

    # Gradual degradation
    degradation = model["degradation_per_lap"] * life * wear_multiplier

    # Cliff effect - massive penalty after optimal life
    if life > model["cliff_point"]:
        cliff_laps = life - model["cliff_point"]
        degradation += model["cliff_penalty"] * cliff_laps

    # Pressure impact on wear (under/over inflation accelerates degradation)
    if pressure < 22.5:
        degradation *= 1.2  # Under-inflated = faster wear
    elif pressure > 23.5:
        degradation *= 1.1  # Over-inflated = slightly faster wear

    return delta + degradation

def calculate_engine_mode_delta(mode, engine_temp):
    """
    Engine mode performance with heating effects.
    mode: 0=ECO, 1=NORMAL, 2=POWER
    engine_temp: current engine temperature in °C
    """
    mode_names = ["ECO", "NORMAL", "POWER"]
    mode_name = mode_names[mode] if 0 <= mode < 3 else "NORMAL"

    engine_model = ENGINE_MODES[mode_name]
    delta = engine_model["performance_delta"]

    # Overheating penalty (above 100°C)
    if engine_temp > 100:
        overheat_penalty = (engine_temp - 100) * 0.05  # 0.05s per degree over 100°C
        delta += overheat_penalty

    return delta

def calculate_pressure_delta(pressure):
    """
    Tire pressure impact on lap time.
    Optimal: 22.5-23.5 PSI
    """
    if 22.5 <= pressure <= 23.5:
        return 0.0  # Optimal range

    # Outside optimal range
    deviation = abs(pressure - 23.0)

    if pressure < 22.5:
        # Under-inflation: better grip initially, but worse cornering
        return deviation * 0.02
    else:
        # Over-inflation: less contact patch, worse corners
        return deviation * 0.03

def calculate_fuel_delta(fuel_load, current_lap, start_lap, fuel_efficiency=1.0):
    """
    Fuel load impact on performance (weight).
    Diminishing returns as fuel burns.
    """
    laps_completed = current_lap - start_lap
    fuel_consumed = laps_completed * 1.5 * fuel_efficiency
    remaining_fuel = max(0, fuel_load - fuel_consumed)

    # Weight penalty: each 10kg adds ~0.2s initially
    # Diminishing effect as car gets lighter
    baseline_fuel = 50  # Mid-race fuel load
    fuel_diff = remaining_fuel - baseline_fuel

    # Non-linear weight impact (heavier car = more penalty)
    return (fuel_diff / 10) * 0.02

def interpolate_track_position(session_time, driver):
    """
    Interpolate X, Y position on track based on session time.
    Uses telemetry data to find where the car would be at a given time.
    """
    driver_data = TELEMETRY_DF[TELEMETRY_DF['Driver'] == driver].copy()
    driver_data = driver_data.dropna(subset=['SessionTime', 'X', 'Y'])

    if driver_data.empty:
        return {"x": 0.0, "y": 0.0}

    # Find closest data points before and after the target time
    before = driver_data[driver_data['SessionTime'] <= session_time].tail(1)
    after = driver_data[driver_data['SessionTime'] >= session_time].head(1)

    if before.empty and after.empty:
        return {"x": 0.0, "y": 0.0}
    elif before.empty:
        row = after.iloc[0]
        return {"x": float(row['X']), "y": float(row['Y'])}
    elif after.empty:
        row = before.iloc[0]
        return {"x": float(row['X']), "y": float(row['Y'])}
    else:
        # Linear interpolation
        t1, x1, y1 = before.iloc[0]['SessionTime'], before.iloc[0]['X'], before.iloc[0]['Y']
        t2, x2, y2 = after.iloc[0]['SessionTime'], after.iloc[0]['X'], after.iloc[0]['Y']

        if t2 == t1:
            return {"x": float(x1), "y": float(y1)}

        ratio = (session_time - t1) / (t2 - t1)
        x = x1 + (x2 - x1) * ratio
        y = y1 + (y2 - y1) * ratio

        return {"x": float(x), "y": float(y)}

def analyze_pit_stop_needs(ghost_state, remaining_laps, engine_temp, fuel_remaining):
    """
    Analyze if additional pit stops are needed based on tire health, fuel, engine temp.
    Returns recommendations for pit stops.
    """
    recommendations = []
    needs_pit = False

    compound = ghost_state["current_compound"]
    tire_life = ghost_state["tyre_life"]

    if compound not in TIRE_DEGRADATION_MODEL:
        compound = "MEDIUM"

    model = TIRE_DEGRADATION_MODEL[compound]

    # Check tire cliff
    if tire_life >= model["cliff_point"]:
        needs_pit = True
        recommendations.append({
            "reason": f"Tire degradation cliff reached (lap {tire_life}/{model['cliff_point']})",
            "urgency": "critical",
            "recommended_compound": "HARD" if compound == "SOFT" else "MEDIUM"
        })
    elif tire_life >= model["optimal_life"]:
        recommendations.append({
            "reason": f"Tires past optimal life ({tire_life}/{model['optimal_life']} laps)",
            "urgency": "warning",
            "recommended_compound": "MEDIUM" if compound == "SOFT" else "HARD"
        })

    # Check fuel
    fuel_needed = remaining_laps * 1.5
    if fuel_remaining < fuel_needed:
        needs_pit = True
        recommendations.append({
            "reason": f"Insufficient fuel ({fuel_remaining:.1f}kg, need {fuel_needed:.1f}kg)",
            "urgency": "critical",
            "recommended_compound": compound  # Keep same compound if fuel-only stop
        })
    elif fuel_remaining < 10:
        recommendations.append({
            "reason": f"Low fuel warning ({fuel_remaining:.1f}kg remaining)",
            "urgency": "warning",
            "recommended_compound": compound
        })

    # Check engine overheating
    if engine_temp > 110:
        needs_pit = True
        recommendations.append({
            "reason": f"Engine overheating ({engine_temp:.1f}°C)",
            "urgency": "critical",
            "recommended_compound": compound
        })
    elif engine_temp > 100:
        recommendations.append({
            "reason": f"Engine temperature high ({engine_temp:.1f}°C), consider ECO mode",
            "urgency": "warning",
            "recommended_compound": compound
        })

    return {
        "needs_additional_pit": needs_pit,
        "recommendations": recommendations
    }

def calculate_position_at_lap(lap, cumulative_time):
    """Calculate position based on cumulative time vs other drivers"""
    lap_data = TELEMETRY_DF[TELEMETRY_DF['LapNumber'] == lap].copy()

    if lap_data.empty:
        return 10

    # Get session time for each driver at this lap
    driver_times = {}
    for driver in lap_data['Driver'].dropna().unique():
        driver_lap_data = lap_data[lap_data['Driver'] == driver]
        if not driver_lap_data.empty:
            driver_times[driver] = driver_lap_data['SessionTime'].min()

    # Count how many drivers are ahead
    position = 1
    for driver, time in driver_times.items():
        if time < cumulative_time:
            position += 1

    return min(position, 20)

@app.route('/api/run_simulation', methods=['POST'])
def run_simulation():
    """Run a lap-by-lap Digital Twin simulation"""
    if TELEMETRY_DF is None or TELEMETRY_DF.empty:
        return jsonify({"error": "Telemetry data not loaded."}), 500

    try:
        data = request.json
        driver = data.get('driver', 'VER')
        start_lap = int(data.get('current_lap', 1))
        pit_lap = int(data.get('pit_lap', 30))
        pit_compound = data.get('pit_compound', 'MEDIUM')
        tire_pressure = float(data.get('tire_pressure', 23))
        fuel_load = float(data.get('fuel_load', 65))
        engine_mode = int(data.get('engine_mode', 1))

        # Get historical lap times
        driver_laps = get_driver_lap_times(driver)

        if not driver_laps or start_lap not in driver_laps:
            return jsonify({"error": f"No lap data for driver {driver} at lap {start_lap}"}), 400

        # Create driver baseline
        baseline = create_driver_baseline(driver, start_lap)

        # Get engine mode configuration
        mode_names = ["ECO", "NORMAL", "POWER"]
        mode_name = mode_names[engine_mode] if 0 <= engine_mode < 3 else "NORMAL"
        engine_config = ENGINE_MODES[mode_name]

        # Initialize ghost state with realistic physics tracking
        ghost_state = {
            "current_compound": str(driver_laps[start_lap]["Compound"]),
            "tyre_life": int(driver_laps[start_lap]["TyreLife"]),
            "cumulative_time": 0.0,
            "cumulative_session_time": sum([driver_laps[l]["LapTime"] for l in range(1, start_lap) if l in driver_laps]),
            "position": int(driver_laps[start_lap]["Position"]),
            "engine_temp": 85.0,  # Start at normal operating temp
            "fuel_remaining": fuel_load
        }

        simulated_laps = []
        pit_stops = []
        warnings = []
        max_lap = max(driver_laps.keys())

        for lap in range(start_lap, min(max_lap + 1, 53)):
            if lap not in driver_laps:
                continue

            base_lap_time = driver_laps[lap]["LapTime"]
            remaining_laps = min(max_lap, 52) - lap

            # Calculate realistic deltas using new models
            tire_delta = calculate_tire_delta(
                ghost_state["current_compound"],
                ghost_state["tyre_life"],
                tire_pressure,
                baseline["tire_deg_rate"]
            )
            engine_delta = calculate_engine_mode_delta(engine_mode, ghost_state["engine_temp"])
            pressure_delta = calculate_pressure_delta(tire_pressure)
            fuel_delta = calculate_fuel_delta(
                ghost_state["fuel_remaining"],
                lap,
                start_lap,
                engine_config["fuel_efficiency"]
            )

            # Update engine temperature based on mode
            ghost_state["engine_temp"] += engine_config["heating_rate"]
            ghost_state["engine_temp"] = max(70, min(130, ghost_state["engine_temp"]))  # Clamp 70-130°C

            # Fuel consumption
            lap_fuel_consumption = baseline["fuel_consumption_rate"] * engine_config["fuel_efficiency"]
            ghost_state["fuel_remaining"] -= lap_fuel_consumption
            ghost_state["fuel_remaining"] = max(0, ghost_state["fuel_remaining"])

            # Apply pit stop
            if lap == pit_lap:
                lap_time = base_lap_time + 22.0  # Pit time penalty
                ghost_state["current_compound"] = pit_compound
                ghost_state["tyre_life"] = 0
                ghost_state["fuel_remaining"] = fuel_load  # Refuel
                ghost_state["engine_temp"] = max(70, ghost_state["engine_temp"] - 15)  # Cooling during pit
                pit_stops.append({
                    "lap": int(lap),
                    "reason": "Planned pit stop",
                    "compound": pit_compound
                })
            else:
                # Sum all deltas (capped to prevent unrealistic swings)
                total_delta = tire_delta + engine_delta + pressure_delta + fuel_delta
                total_delta = max(-0.5, min(0.5, total_delta))  # Cap at ±0.5s per lap
                lap_time = base_lap_time + total_delta

            ghost_state["cumulative_time"] += lap_time
            ghost_state["cumulative_session_time"] += lap_time
            ghost_state["tyre_life"] += 1

            # Calculate position and track coordinates
            new_position = calculate_position_at_lap(lap, ghost_state["cumulative_session_time"])
            ghost_track_pos = interpolate_track_position(ghost_state["cumulative_session_time"], driver)

            simulated_laps.append({
                "lap": int(lap),
                "lap_time": round(float(lap_time), 3),
                "cumulative_time": round(float(ghost_state["cumulative_time"]), 3),
                "cumulative_session_time": round(float(ghost_state["cumulative_session_time"]), 3),
                "position": int(new_position),
                "compound": str(ghost_state["current_compound"]),
                "tyre_life": int(ghost_state["tyre_life"]),
                "ghost_x": ghost_track_pos["x"],
                "ghost_y": ghost_track_pos["y"],
                "engine_temp": round(float(ghost_state["engine_temp"]), 1),
                "fuel_remaining": round(float(ghost_state["fuel_remaining"]), 1)
            })

            # Check if additional pit stops needed
            pit_analysis = analyze_pit_stop_needs(
                ghost_state,
                remaining_laps,
                ghost_state["engine_temp"],
                ghost_state["fuel_remaining"]
            )

            if pit_analysis["needs_additional_pit"] and lap < min(max_lap, 52) - 3:
                for rec in pit_analysis["recommendations"]:
                    if rec["urgency"] == "critical":
                        warnings.append(f"Lap {lap}: {rec['reason']}")

        # Calculate summary statistics
        final_lap = simulated_laps[-1]
        actual_final_time = sum([driver_laps[l]["LapTime"] for l in range(start_lap, max_lap + 1) if l in driver_laps])

        # Final analysis
        final_analysis = analyze_pit_stop_needs(
            ghost_state,
            0,
            ghost_state["engine_temp"],
            ghost_state["fuel_remaining"]
        )

        # Calculate tire health percentage
        model = TIRE_DEGRADATION_MODEL.get(ghost_state["current_compound"], TIRE_DEGRADATION_MODEL["MEDIUM"])
        tire_health_pct = max(0, int(100 - (ghost_state["tyre_life"] / model["cliff_point"]) * 100))

        return jsonify({
            "simulated_laps": simulated_laps,
            "summary": {
                "final_position": int(final_lap["position"]),
                "final_time": round(float(final_lap["cumulative_time"]), 3),
                "actual_time": round(float(actual_final_time), 3),
                "time_delta": round(float(final_lap["cumulative_time"] - actual_final_time), 3),
                "tire_health": tire_health_pct,
                "fuel_remaining": round(float(ghost_state["fuel_remaining"]), 1),
                "needs_additional_pit": final_analysis["needs_additional_pit"],
                "low_fuel_warning": ghost_state["fuel_remaining"] < 10,
                "pit_stops": pit_stops,
                "warnings": warnings,
                "recommendations": final_analysis["recommendations"],
                "engine_temp_final": round(float(ghost_state["engine_temp"]), 1),
                "total_laps_simulated": len(simulated_laps)
            }
        })

    except Exception as e:
        return jsonify({"error": f"Simulation failed: {str(e)}"}), 500

if __name__ == '__main__':
    load_data()
    app.run(host='0.0.0.0', port=5001, debug=True)

