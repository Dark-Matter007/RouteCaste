"""
Step 33: Train RouteCast Production ML Models
Uses Dataset 2 (routecast_ml_dataset.csv.gz) to train:
  1. Travel Time (ETA) Regressor -> models/eta.onnx
  2. Multi-Horizon Congestion Forecaster -> models/congestion.onnx
  3. Validation Evaluation Report -> models/metrics.json
"""

import sys
import os

# Add ml folder to path
ML_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ml"))
if ML_DIR not in sys.path:
    sys.path.insert(0, ML_DIR)

from train import main

if __name__ == "__main__":
    main()
