"""
NEXUS-SCM | Anomaly Detector - TITAN V4 SOVEREIGN OVERHAUL
Uses Isolation Forest to detect Causal Outliers (Supply Lags + Industrial Inflection).
Anchored on v4_titan_intelligence_fabric.
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("nexus-scm.ml.detector")

class AnomalyDetector:
    """
    NEXUS-SCM | Sovereign-Grade Anomaly Detection.
    Detects "Supply Anomalies" using Asian Battery Import lags
    and "Demand Anomalies" using regional EV registration spikes.
    """
    
    def __init__(self, contamination: float = 0.05):
        self.model = IsolationForest(
            n_estimators=100,
            max_samples='auto',
            contamination=contamination,
            random_state=42
        )
        self.is_fitted = False

    def prepare_v4_data(self, fabric_data: List[Dict[str, Any]]) -> pd.DataFrame:
        """
        Extracts multi-variate causal signals for anomaly scanning.
        """
        if not fabric_data:
            return pd.DataFrame()
            
        df = pd.DataFrame(fabric_data)
        
        # FEATURE SET: Causal Signals + Demand Variance
        # We look for anomalies in the relationship between Asian Imports (Lead Signal)
        # and regional demand inflection (Industrial regs).
        features = [
            'target_demand', 
            'battery_lead_signal', 
            'ev_penetration_rate', 
            'reg_industrial'
        ]
        
        # Ensure all required features are numeric and present
        available = [f for f in features if f in df.columns]
        if not available:
            return pd.DataFrame()
            
        for f in available:
            df[f] = pd.to_numeric(df[f], errors='coerce').fillna(0)
            
        return df[available].copy()

    def detect_v4_anomalies(self, fabric_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Fits Isolation Forest on Titan V4 signals and returns disruption matrix.
        """
        df = self.prepare_v4_data(fabric_data)
        
        if df.empty or len(df) < 5:
            return []

        # Fit and predict (-1 for anomalies, 1 for normal)
        self.model.fit(df)
        preds = self.model.predict(df)
        
        # Score samples (lower is more anomalous)
        scores = self.model.decision_function(df)
        
        anomalies = []
        for i, status in enumerate(preds):
            if status == -1:
                record = fabric_data[i]
                
                # Z-Score Equivalent proxy for visual UI
                # We normalize the isolation score to a 0-10 severity scale
                raw_score = abs(scores[i])
                severity_val = min(int(raw_score * 40), 10) 
                
                # Determine "Story" context
                bat_sig = float(record.get('battery_lead_signal') or 0)
                ind_reg = float(record.get('reg_industrial') or 0)
                
                if bat_sig < 50:
                    severity = "critical"
                    reason = "BATTERY STARVATION DETECTED"
                    msg = f"Asian supply leads (Signal: {bat_sig:.1f}) indicate a 60-day registration crash risk."
                elif ind_reg > df['reg_industrial'].mean() * 1.5:
                    severity = "critical"
                    reason = "INDUSTRIAL INFLECTION ANOMALY"
                    msg = f"Unusual industrial demand spike ({ind_reg:.0f} regs) detected relative to regional baseline."
                else:
                    severity = "warning"
                    reason = "Causal Outlier"
                    msg = f"Multi-variate variance detected in regional demand vs supply precedence."
                
                anomalies.append({
                    "id": i,
                    "entity_id": record.get('region_name'),
                    "entity_type": "supplier",
                    "entity_name": f"{record.get('region_name')} Titan Hub",
                    "severity": severity,
                    "title": reason,
                    "message": msg,
                    "anomaly_z_score": round(raw_score * 10, 2), # UI gauge anchor
                    "logic_score": int(raw_score * 100),
                    "details": {
                        "demand": record.get('target_demand'),
                        "battery": bat_sig,
                        "industrial": ind_reg
                    }
                })
        
        return anomalies
