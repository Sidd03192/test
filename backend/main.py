from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import os

# --- INITIALIZATION ---
app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
DATA_FILE = 'race_data_timeseries.csv'
RACE_DATA_DF = None

def load_data():
    """
    Loads the time-series race data from the CSV file.
    """
    global RACE_DATA_DF
    if os.path.exists(DATA_FILE):
        print(f"Loading time-series data from {DATA_FILE}...")
        RACE_DATA_DF = pd.read_csv(DATA_FILE)
        print("Data loaded successfully.")
    else:
        print(f"ERROR: {DATA_FILE} not found. Please run the data exporter script first.")
        RACE_DATA_DF = pd.DataFrame()

# --- API ENDPOINTS ---

@app.route('/api/race_state_by_time', methods=['GET'])
def get_race_state_by_time():
    """
    Returns the state of all drivers at a specific session time.
    Query Parameters:
        time (float): The elapsed session time in seconds.
    """
    if RACE_DATA_DF is None or RACE_DATA_DF.empty:
        return jsonify({"error": "Race data not loaded."}), 500

    try:
        session_time = float(request.args.get('time', 0))
    except ValueError:
        return jsonify({"error": "Invalid 'time' parameter. Must be a number."}), 400

    # Find the closest data point in time
    time_data = RACE_DATA_DF.iloc[(RACE_DATA_DF['SessionTime'] - session_time).abs().argsort()[:20]]
    
    result = time_data.to_dict(orient='records')
    return jsonify({"time": session_time, "drivers": result})

@app.route('/api/predict_scenario', methods=['POST'])
def predict_scenario():
    """
    A simplified predictive model. In a real scenario, this would be a complex statistical model.
    For the hackathon, we simulate the impact based on predefined deltas.
    """
    scenario = request.json
    current_lap = scenario.get('current_lap')
    modifications = scenario.get('modifications')
    
    # --- Simplified Predictive Logic ---
    # 1. Calculate Tire Delta
    tire_gain = 0
    if modifications.get('next_compound') == 'SOFT':
        tire_gain = -1.2  # Softs are 1.2s faster per lap
    elif modifications.get('next_compound') == 'HARD':
        tire_gain = 0.5   # Hards are 0.5s slower but last longer
    
    # 2. Calculate Pit Stop Time Delta
    pit_lap_diff = modifications.get('pit_lap') - 30 # Baseline pit lap is 30
    pit_time_impact = pit_lap_diff * 0.1 # Each lap later/earlier has a small impact on traffic
    
    # 3. Calculate Final Time Impact
    total_time_impact = (tire_gain * 15) + pit_time_impact # Assume new tires last 15 laps
    
    return jsonify({
        "scenario": {
            "predicted_position_change": -1 if total_time_impact < -5 else 0,
            "predicted_time_gain": total_time_impact,
            "notes": f"Pitting on lap {modifications.get('pit_lap')} for {modifications.get('next_compound')}s is predicted to be {abs(total_time_impact):.2f}s {'faster' if total_time_impact < 0 else 'slower'}."
        }
    })


if __name__ == '__main__':
    load_data()
    app.run(host='0.0.0.0', port=5001, debug=True)

