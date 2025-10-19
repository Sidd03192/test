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

# Tire performance model
TIRE_DELTAS = {
    "SOFT": {"base": -1.2, "degradation": 0.08},
    "MEDIUM": {"base": 0.0, "degradation": 0.05},
    "HARD": {"base": 0.8, "degradation": 0.03}
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
                "Position": int(lap_data.iloc[0]['Position']) if not pd.isna(lap_data.iloc[0]['Position']) else 10
            }

    return lap_times

def calculate_tire_delta(compound, life):
    """Calculate lap time delta based on tire compound and age"""
    if compound not in TIRE_DELTAS:
        compound = "MEDIUM"
    delta = TIRE_DELTAS[compound]["base"]
    degradation = TIRE_DELTAS[compound]["degradation"] * life
    return delta + degradation

def calculate_brake_wear_delta(laps_completed):
    """Brake wear adds time penalty"""
    return (laps_completed // 10) * 0.02

def calculate_engine_mode_delta(mode):
    """Engine mode: 0=ECO, 1=NORMAL, 2=POWER"""
    return [-0.05, 0.0, -0.25][mode]

def calculate_pressure_delta(pressure):
    """Tire pressure delta from optimal 23 PSI"""
    optimal = 23
    return abs(pressure - optimal) * 0.03

def calculate_fuel_delta(fuel_load, current_lap, start_lap):
    """Lighter car = faster"""
    laps_completed = current_lap - start_lap
    remaining_fuel = max(0, fuel_load - (laps_completed * 1.5))
    return (remaining_fuel - 50) * 0.01

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

        # Initialize ghost state
        ghost_state = {
            "current_compound": str(driver_laps[start_lap]["Compound"]),
            "tyre_life": int(driver_laps[start_lap]["TyreLife"]),
            "cumulative_time": 0.0,
            "position": int(driver_laps[start_lap]["Position"])
        }

        simulated_laps = []
        max_lap = max(driver_laps.keys())

        for lap in range(start_lap, min(max_lap + 1, 53)):
            if lap not in driver_laps:
                continue

            base_lap_time = driver_laps[lap]["LapTime"]

            # Calculate deltas
            tire_delta = calculate_tire_delta(ghost_state["current_compound"], ghost_state["tyre_life"])
            brake_delta = calculate_brake_wear_delta(lap - start_lap)
            engine_delta = calculate_engine_mode_delta(engine_mode)
            pressure_delta = calculate_pressure_delta(tire_pressure)
            fuel_delta = calculate_fuel_delta(fuel_load, lap, start_lap)

            # Apply pit stop
            if lap == pit_lap:
                lap_time = base_lap_time + 22.0
                ghost_state["current_compound"] = pit_compound
                ghost_state["tyre_life"] = 0
            else:
                lap_time = base_lap_time + tire_delta + brake_delta + engine_delta + pressure_delta + fuel_delta

            ghost_state["cumulative_time"] += lap_time
            ghost_state["tyre_life"] += 1

            # Calculate position
            new_position = calculate_position_at_lap(lap, ghost_state["cumulative_time"])

            simulated_laps.append({
                "lap": int(lap),
                "lap_time": round(float(lap_time), 3),
                "cumulative_time": round(float(ghost_state["cumulative_time"]), 3),
                "position": int(new_position),
                "compound": str(ghost_state["current_compound"]),
                "tyre_life": int(ghost_state["tyre_life"])
            })

        return jsonify({"simulated_laps": simulated_laps})

    except Exception as e:
        return jsonify({"error": f"Simulation failed: {str(e)}"}), 500

if __name__ == '__main__':
    load_data()
    app.run(host='0.0.0.0', port=5001, debug=True)

