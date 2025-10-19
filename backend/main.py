from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import os

# --- INITIALIZATION ---
app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
TELEMETRY_DATA_FILE = 'race_data_timeseries.csv'
WEATHER_DATA_FILE = 'weather_data.csv'
TELEMETRY_DF = None
WEATHER_DF = None

def load_data():
    """
    Loads both the telemetry and weather data from their respective CSV files.
    """
    global TELEMETRY_DF, WEATHER_DF
    
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

# --- API ENDPOINTS ---

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

    # Find the closest data point in time for all drivers
    time_data = TELEMETRY_DF.iloc[(TELEMETRY_DF['SessionTime'] - session_time).abs().argsort()[:20]]
    
    result = time_data.to_dict(orient='records')
    return jsonify({"time": session_time, "drivers": result})

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
    
    result = weather_point.to_dict()
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

if __name__ == '__main__':
    load_data()
    app.run(host='0.0.0.0', port=5001, debug=True)

