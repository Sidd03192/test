import fastf1 as ff1
import pandas as pd
import os
import numpy as np

# --- CONFIGURATION ---
YEAR = 2023
GRAND_PRIX = 'Silverstone'
SESSION = 'R'
OUTPUT_FILE = 'race_data_timeseries.csv'
SAMPLE_RATE = '1S'  # Sample telemetry data every 1 second

def process_race_data(year, grand_prix, session):
    """
    Fetches detailed time-series telemetry and position data for a given F1 session,
    processes it into a consistent time-based format, and returns a pandas DataFrame.
    """
    print(f"Fetching data for {year} {grand_prix} {session}...")
    
    # --- 1. SETUP CACHE AND LOAD SESSION DATA ---
    cache_path = os.path.join(os.path.expanduser('~'), 'fastf1_cache')
    if not os.path.exists(cache_path):
        os.makedirs(cache_path)
    ff1.Cache.enable_cache(cache_path)

    # Updated to no longer load weather data
    race_session = ff1.get_session(year, grand_prix, session)
    race_session.load(telemetry=True, messages=True)
    laps = race_session.laps
    
    print("Data loaded. Processing time-series telemetry for all drivers...")

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
        
        # --- Merge lap-specific context data onto telemetry ---
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
        return pd.DataFrame()
        
    full_telemetry_df = pd.concat(all_driver_telemetry)

    # --- 3. MERGE WEATHER DATA (REMOVED) ---
    # This section has been removed as requested.
    
    # --- 4. RESAMPLE DATA TO A CONSISTENT FREQUENCY ---
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

    # --- 5. FINAL DATA CLEANING AND FORMATTING ---
    if full_telemetry_df.empty:
        print("Processing resulted in an empty DataFrame after resampling.")
        return pd.DataFrame()

    # Updated to remove weather-related columns
    final_columns = [
        'Date', 'SessionTime', 'Driver', 'Team', 'LapNumber', 'Position', 'Stint',
        'Compound', 'TyreLife', 'Speed', 'RPM', 'nGear', 'Throttle', 'Brake',
        'DRS', 'X', 'Y', 'Z', 'TrackStatus'
    ]
    
    existing_columns = [col for col in final_columns if col in full_telemetry_df.columns]
    final_df = full_telemetry_df[existing_columns].copy()
    
    for col in ['Position', 'LapNumber', 'Stint', 'TyreLife', 'DRS', 'nGear']:
        if col in final_df: 
            final_df[col] = pd.to_numeric(final_df[col], errors='coerce').fillna(0).astype(int)

    if 'SessionTime' in final_df: 
        if pd.api.types.is_timedelta64_dtype(final_df['SessionTime']):
            final_df['SessionTime'] = final_df['SessionTime'].dt.total_seconds()

    if 'Brake' in final_df: final_df['Brake'] = final_df['Brake'].astype(bool)
    if 'TrackStatus' in final_df: 
        final_df['IsRaceNeutralized'] = ~final_df['TrackStatus'].astype(str).isin(['1'])
        final_df = final_df.drop(columns=['TrackStatus'])
            
    print("Processing complete.")
    return final_df

if __name__ == '__main__':
    time_series_df = process_race_data(YEAR, GRAND_PRIX, SESSION)
    
    if not time_series_df.empty:
        time_series_df.to_csv(OUTPUT_FILE, index=False)
        print(f"✅ Successfully exported time-series data to {OUTPUT_FILE}")
        print("\n--- Time-Series Data Preview ---")
        print(time_series_df.head())
        print(f"\nTotal data points processed: {len(time_series_df)}")

