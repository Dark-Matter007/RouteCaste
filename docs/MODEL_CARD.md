# Guntur traffic model card

**Target:** event-period directed-road travel time in seconds. Labels are BPR-derived modeled values, so the trained models are calibration/reconstruction prototypes—not validated real-world Guntur predictors.

Features: road length/type, lanes, free-flow speed, capacity, hour/weekend, baseline volume/speed, attendance/event type, geometry-derived distance to venue, time relative to event, assigned event vehicles, weather, and incidents. The split holds out entire event IDs: events 001–002 train, 003 validates, and 004 tests. This prevents rows for one event/time from leaking across partitions.

The run report in `models/reports/guntur_traffic_model_report.json` records exact metrics, seed, date, features, dataset rows, and artifacts. It compares free flow, baseline-only BPR, exact event BPR, Ridge, and HistGradientBoosting. Analytical BPR is intentionally the routing default because it is the source of the simulated label; a model should replace it only after calibrated observed data are available.
