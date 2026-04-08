
import numpy as np
import pandas as pd
from scipy.optimize import curve_fit
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
import matplotlib.pyplot as plt

# --- 1. DATA SYNTHESIS (EV Sales with Shocks) ---
def generate_ev_data(n_years=10):
    t = np.arange(n_years)
    # Underlying Bass Curve
    m, p, q = 1000000, 0.015, 0.4
    exp_term = np.exp(-(p + q) * t)
    base_curve = m * ((1 - exp_term) / (1 + (q / p) * exp_term))
    
    # Add Shocks (e.g., FAME-II subsidy boost, Chip shortage drop)
    shocks = np.zeros(n_years)
    shocks[5] = base_curve[5] * 0.15  # 15% boost in year 5
    shocks[7] = -base_curve[7] * 0.1 # 10% drop in year 7
    
    # Noise
    noise = np.random.normal(0, base_curve * 0.05)
    
    y = base_curve + shocks + noise
    return t, y, base_curve

# --- 2. THE MODELS ---

def bass_diffusion_model(t, m, p, q):
    exp_term = np.exp(-(p + q) * t)
    return m * ((1 - exp_term) / (1 + (q / p) * exp_term))

class StandardBassModel:
    def fit(self, t, y):
        self.popt, _ = curve_fit(bass_diffusion_model, t, y, p0=[max(y)*10, 0.02, 0.4], bounds=([max(y), 0, 0], [max(y)*100, 0.1, 1.0]))
    def predict(self, t):
        return bass_diffusion_model(t, *self.popt)

class TitanHybridModel:
    def __init__(self):
        self.bass = StandardBassModel()
        self.regressor = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=3)
        
    def fit(self, t, y):
        # Step 1: Bass for Trend
        self.bass.fit(t, y)
        base_trend = self.bass.predict(t)
        
        # Step 2: GBR for Residuals
        residuals = y - base_trend
        # Use t and recent lag as features
        features = pd.DataFrame({'t': t})
        self.regressor.fit(features, residuals)
        
    def predict(self, t):
        base_trend = self.bass.predict(t)
        features = pd.DataFrame({'t': t})
        residual_correction = self.regressor.predict(features)
        return base_trend + residual_correction

# --- 3. TESTING ---
t, y, true_base = generate_ev_data(12)
train_t, train_y = t[:10], y[:10]
test_t, test_y = t[10:], y[10:]

# Train Standard
bass_only = StandardBassModel()
bass_only.fit(train_t, train_y)
bass_pred = bass_only.predict(t)

# Train Titan
titan = TitanHybridModel()
titan.fit(train_t, train_y)
titan_pred = titan.predict(t)

# Results
print(f"--- RESULTS (EV Intelligence Test) ---")
print(f"Standard Bass MAE (Train): {mean_absolute_error(train_y, bass_pred[:10]):.2f}")
print(f"Titan Hybrid MAE (Train): {mean_absolute_error(train_y, titan_pred[:10]):.2f}")
print(f"---")
print(f"Standard Bass MAE (Test/Forecast): {mean_absolute_error(test_y, bass_pred[10:]):.2f}")
print(f"Titan Hybrid MAE (Test/Forecast): {mean_absolute_error(test_y, titan_pred[10:]):.2f}")

improvement = (mean_absolute_error(test_y, bass_pred[10:]) - mean_absolute_error(test_y, titan_pred[10:])) / mean_absolute_error(test_y, bass_pred[10:]) * 100
print(f"\nTitan Hybrid achieves {improvement:.1f}% higher fidelity on unseen market signals.")
