import fastf1 as ff1
import pandas as pd
import os
import numpy as np

# --- CONFIGURATION ---
YEAR = 2023
GRAND_PRIX = 'Silverstone'
SESSION = 'R'
TELEMETRY_OUTPUT_FILE = 'race_data_timeseries.csv'
WEATHER_OUTPUT_FILE = 'weather_data.csv'
SAMPLE_RATE = '1S'  # Sample telemetry data every 1 second

def process_race_data(year, grand_prix, session):
    """
    Fetches detailed time-series telemetry and weather data for a given F1 session,
    processes them into two separate, consistent time-based formats, and returns two DataFrames.
    """
    print(f"Fetching data for {year} {grand_prix} {session}...")
    
    # --- 1. SETUP CACHE AND LOAD SESSION DATA ---
    cache_path = os.path.join(os.path.expanduser('~'), 'fastf1_cache')
    if not os.path.exists(cache_path):
        os.makedirs(cache_path)
    ff1.Cache.enable_cache(cache_path)

    race_session = ff1.get_session(year, grand_prix, session)
    race_session.load(telemetry=True, weather=True, messages=True)
    laps = race_session.laps
    
    print("Data loaded. Processing time-series telemetry and weather...")

    # --- 2. PROCESS TELEMETRY FOR EACH DRIVER ---
    drivers = race_session.results['Abbreviation'].dropna().unique()
    all_driver_telemetry = []

    for driver in drivers:
        print(f"  Processing driver: {driver}")
        driver_laps = laps.pick_drivers([driver])
        
        telemetry = driver_laps.get_telemetry()
        if telemetry.empty:
            continue
            
        telemetry['Driver'] = driver
        telemetry['Team'] = driver_laps.iloc[0]['Team']
        
        lap_context_data = driver_laps[[
            'LapNumber', 'Stint', 'Compound', 'TyreLife', 
            'Position', 'TrackStatus', 'LapStartTime'
        ]].rename(columns={'LapStartTime': 'SessionTime'})
        
        telemetry = pd.merge_asof(
            telemetry.sort_values('SessionTime'),
            lap_context_data.sort_values('SessionTime'),
            on='SessionTime',
            direction='backward'
        )
        all_driver_telemetry.append(telemetry)

    if not all_driver_telemetry:
        print("No telemetry data found for any driver.")
        return pd.DataFrame(), pd.DataFrame()
        
    full_telemetry_df = pd.concat(all_driver_telemetry)
    
    # --- 3. PROCESS WEATHER DATA ---
    weather_df = race_session.weather_data
    if not weather_df.empty and 'Time' in weather_df.columns:
        weather_df['SessionTime'] = weather_df['Time'].dt.total_seconds()
        # Select and keep only the necessary weather columns
        weather_df = weather_df[['SessionTime', 'AirTemp', 'TrackTemp', 'WindSpeed', 'WindDirection', 'Rainfall']].copy()
        weather_df['Rainfall'] = weather_df['Rainfall'].astype(bool)

    # --- 4. RESAMPLE TELEMETRY DATA ---
    if not full_telemetry_df.empty:
        resampled_list = []
        for name, group in full_telemetry_df.groupby('Driver'):
            if not group.empty and 'Date' in group.columns:
                group = group.set_index('Date').resample(SAMPLE_RATE).ffill()
                resampled_list.append(group)
        
        if resampled_list:
            full_telemetry_df = pd.concat(resampled_list).reset_index()
        else:
            full_telemetry_df = pd.DataFrame()

    # --- 5. CLEAN AND FORMAT TELEMETRY DATA ---
    if full_telemetry_df.empty:
        print("Processing resulted in an empty telemetry DataFrame after resampling.")
        return pd.DataFrame(), weather_df

    final_columns = [
        'Date', 'SessionTime', 'Driver', 'Team', 'LapNumber', 'Position', 'Stint',
        'Compound', 'TyreLife', 'Speed', 'RPM', 'nGear', 'Throttle', 'Brake',
        'DRS', 'X', 'Y', 'Z', 'TrackStatus'
    ]
    
    existing_columns = [col for col in final_columns if col in full_telemetry_df.columns]
    telemetry_final_df = full_telemetry_df[existing_columns].copy()
    
    for col in ['Position', 'LapNumber', 'Stint', 'TyreLife', 'DRS', 'nGear']:
        if col in telemetry_final_df: 
            telemetry_final_df[col] = pd.to_numeric(telemetry_final_df[col], errors='coerce').fillna(0).astype(int)

    if 'SessionTime' in telemetry_final_df: 
        if pd.api.types.is_timedelta64_dtype(telemetry_final_df['SessionTime']):
            telemetry_final_df['SessionTime'] = telemetry_final_df['SessionTime'].dt.total_seconds()

    if 'Brake' in telemetry_final_df: telemetry_final_df['Brake'] = telemetry_final_df['Brake'].astype(bool)
    if 'TrackStatus' in telemetry_final_df: 
        telemetry_final_df['IsRaceNeutralized'] = ~telemetry_final_df['TrackStatus'].astype(str).isin(['1'])
        telemetry_final_df = telemetry_final_df.drop(columns=['TrackStatus'])
            
    print("Processing complete.")
    return telemetry_final_df, weather_df

if __name__ == '__main__':
    telemetry_df, weather_df = process_race_data(YEAR, GRAND_PRIX, SESSION)
    
    if not telemetry_df.empty:
        telemetry_df.to_csv(TELEMETRY_OUTPUT_FILE, index=False)
        print(f"✅ Successfully exported telemetry data to {TELEMETRY_OUTPUT_FILE}")
        print("\n--- Telemetry Data Preview ---")
        print(telemetry_df.head())
    
    if not weather_df.empty:
        weather_df.to_csv(WEATHER_OUTPUT_FILE, index=False)
        print(f"✅ Successfully exported weather data to {WEATHER_OUTPUT_FILE}")
        print("\n--- Weather Data Preview ---")
        print(weather_df.head())

