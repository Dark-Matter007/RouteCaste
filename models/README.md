# Trained models go here

Drop your exported ONNX models in this folder:

- `eta.onnx` — travel-time / ETA model
- `congestion.onnx` — next-interval congestion model

Generate them with the training pipeline in [`../ml`](../ml/README.md)
(`python train.py`). The backend (`lib/ml.ts`) loads whichever of these files
exist and falls back to a built-in heuristic for any that are missing.

You can also point the backend at models elsewhere with the `ETA_MODEL_PATH`
and `CONGESTION_MODEL_PATH` environment variables.
