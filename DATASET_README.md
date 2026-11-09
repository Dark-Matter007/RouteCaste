# RouteCast — Traffic & Event Prediction Dataset

## 1. Project Overview

**RouteCast** is an urban traffic digital-twin project for **Guntur City, Andhra Pradesh, India**.

The overall system is intended to:

```text
Real-world Guntur road network
        ↓
Baseline traffic simulation
        ↓
Upcoming event information
        ↓
SUMO traffic simulation
        ↓
Traffic-state data
        ↓
ML traffic prediction
        ↓
Predicted future road conditions
        ↓
Dynamic road weights
        ↓
Dijkstra / A* / Bidirectional routing
        ↓
Better routes during event-induced congestion
```

The dataset-generation work described in this document is focused on providing the **traffic, road-network, event, and spatial data required by the ML team**.

The ML model itself, model selection, training, evaluation, and routing integration are separate tasks.

---

# 2. Current Pilot Objective

The current pilot focuses on:

> **Predicting event-induced changes in traffic on roads near an event in urban Guntur.**

The event pilot currently covers:

* Guntur urban area
* Evening peak traffic
* Normal baseline demand
* 8 representative event locations
* Concert events
* Large events
* Attendance of 5,000
* 3 simulation seeds per location
* Roads within 1 km of the event
* Prediction horizons from 5 to 60 minutes

This is sufficient for demonstrating the feasibility of event-aware traffic prediction.

It should **not** be interpreted as a fully generalized model for every possible event, location, traffic condition, or attendance level.

---

# 3. Geographic Study Area

The project uses **urban Guntur**, not the entire Guntur district.

Study-area bounding box:

```text
WEST  = 80.38
EAST  = 80.55
SOUTH = 16.25
NORTH = 16.40
```

The raw OSM network is retained separately for reproducibility.

---

# 4. Road Network

## Raw OSMnx Network

```text
data/raw/osm/guntur_drive.graphml
```

Original network:

* 68,541 nodes
* 180,590 edges
* CRS: EPSG:4326

This file should be treated as the **raw source network** and should not be modified.

## City Network

```text
data/raw/osm/guntur_city_drive.graphml
```

Contains:

* 23,034 nodes
* 61,518 edges

## SUMO Network

```text
data/raw/sumo_network/guntur_city_bbox.osm.xml
data/raw/sumo_network/guntur_city.net.xml
```

The SUMO network is particularly important for GNN development because it contains the road topology and connectivity.

The converted SUMO network contains:

* ~321,110 edges
* ~325,108 lanes
* ~77,316 junctions

The network uses UTM Zone 44 for simulation coordinates.

---

# 5. Baseline Traffic Scenarios

Baseline traffic was generated using SUMO.

The baseline matrix contains:

### Demand levels

```text
low
normal
high
```

### Time periods

```text
morning_peak   07:00–10:00
midday         11:00–14:00
evening_peak   17:00–20:00
night          21:00–24:00
```

### Random seeds

```text
101
202
303
```

Total:

```text
3 demand levels
× 4 time periods
× 3 seeds
= 36 baseline scenarios
```

Each scenario contains 180 one-minute traffic intervals.

The validated baseline route files are used for simulation.

---

# 6. Baseline Vehicle Mix

The baseline simulation uses the following modeling assumptions:

```text
car         55%
motorcycle  30%
bus          5%
truck       10%
```

These are **simulation assumptions**, not measured Guntur traffic percentages.

---

# 7. Event Pilot Scenarios

The event pilot was intentionally kept small enough to run reliably on the available hardware.

The current event matrix contains:

```text
8 event locations
× 3 seeds
× 1 event type
× 1 event size
= 24 event scenarios
```

## Event conditions

```text
Event type:       concert
Event size:       large
Attendance:       5,000
Traffic period:   normal evening peak
Event duration:   120 minutes
Event start:      18:00
Arrival rate:     0.35
Departure rate:   0.35
```

All event scenarios are based on **normal evening baseline traffic**.

---

# 8. Event Locations

Eight representative event locations were selected from the Guntur urban network.

| ID  | Location                    | Category      |
| --- | --------------------------- | ------------- |
| E01 | NTR Indoor Sports Complex   | sports        |
| E02 | Harihar Mahal Theatre       | entertainment |
| E03 | Nazz Theater                | entertainment |
| E04 | S Convention                | convention    |
| E05 | URBAN MAIDAAN SPORTS CENTER | sports        |
| E06 | Mirchi yard                 | marketplace   |
| E07 | Chalapathi Ground           | ground        |
| E08 | Garden Function Hall        | community     |

The locations are represented in:

```text
data/scenarios/events/event_locations.csv
```

Each location has a mapped SUMO road edge.

---

# 9. Event Traffic Modeling

For the 5,000-person event, event demand was generated using the following modeling assumptions:

```text
Vehicle occupancy:

car         2.2 persons
motorcycle  1.2 persons
bus         35.0 persons
```

Vehicle shares:

```text
car         45%
motorcycle  25%
bus         30%
```

This produces approximately:

```text
car          1,023
motorcycle   1,042
bus             43
------------------
event demand 2,108 vehicles
```

Both arrival and departure traffic are modeled.

These values are **synthetic simulation assumptions**, not observed attendance-to-vehicle measurements.

---

# 10. Event Impact Validation

The event simulations were compared against their corresponding normal evening baseline simulations.

The comparison was performed using:

* exact edge IDs
* exact one-minute intervals
* roads within 1 km of the event
* paired event vs. baseline observations

The analysis showed a consistent local event signal:

```text
Event traffic:
    ↓ speed
    ↑ density
    ↑ travel time
```

Across all 8 event locations and 3 seeds, the event scenarios showed negative speed changes and positive density changes in the nearby-road analysis.

The strongest effects were observed around:

```text
E05
E01
E08
E07
E02
E06
E03
E04
```

This supports the use of the generated event scenarios as a pilot dataset for event-impact prediction.

Supporting file:

```text
data/processed/event_baseline_paired_impact.csv
```

---

# 11. Prediction Horizons

The datasets contain the following prediction horizons:

```text
5 minutes
10 minutes
15 minutes
30 minutes
45 minutes
60 minutes
```

The basic learning task is:

```text
Current traffic state
        +
Road features
        +
Event information
        +
Spatial relationship to event
        ↓
Future traffic state
```

Possible targets include:

```text
future_speed
future_density
future_occupancy
future_flow
future_travel_time
future_waiting_time
future_time_loss
future_congestion
```

---

# 12. Main ML Dataset

The primary handoff dataset is:

```text
data/processed/routecast_ml_dataset.csv.gz
```

Statistics:

```text
Rows:       1,224,000
Columns:    50
Scenarios:  60
Missing:    0
Duplicates: 0
```

Composition:

```text
Baseline:  1,080,000
Event:       144,000
```

This should be the **first dataset the ML team examines**.

---

# 13. Main Dataset Schema

The unified dataset contains 50 columns.

```text
01 scenario_type
02 scenario_id
03 baseline_scenario
04 demand_level
05 time_period
06 seed
07 edge_id
08 current_time
09 future_time
10 horizon_minutes

11 current_speed
12 current_density
13 current_occupancy
14 current_flow
15 current_travel_time
16 current_waiting_time
17 current_time_loss

18 future_speed
19 future_density
20 future_occupancy
21 future_flow
22 future_travel_time
23 future_waiting_time
24 future_time_loss

25 length
26 lanes
27 speed_limit
28 road_type
29 capacity

30 event_location_id
31 event_name
32 event_category
33 latitude
34 longitude
35 event_edge
36 event_road_type
37 mapping_distance_m

38 distance_to_event_m
39 within_250m
40 within_500m
41 within_1000m
42 distance_weight

43 event_type
44 event_size
45 attendance
46 event_duration_min
47 event_start_minute
48 event_arrival_rate
49 event_departure_rate

50 future_congestion
```

---

# 14. Dataset Distribution

## Scenario types

```text
baseline    1,080,000
event         144,000
```

## Prediction horizons

```text
5 min     204,000
10 min    204,000
15 min    204,000
30 min    204,000
45 min    204,000
60 min    204,000
```

## Congestion classes

```text
free        232,410
light       230,234
moderate    274,578
heavy       227,273
severe      259,505
```

## Traffic periods

```text
morning_peak    270,000
midday          270,000
evening_peak    414,000
night           270,000
```

The larger evening count comes from the event scenarios being based on evening traffic.

---

# 15. Baseline ML Dataset

```text
data/processed/baseline_prediction_targets_reduced.csv.gz
```

Statistics:

```text
Rows:       1,080,000
Scenarios:  36
```

Selection structure:

```text
36 scenarios
× 6 horizons
× 5 congestion classes
× 1,000 rows
= 1,080,000 rows
```

Each scenario/horizon/congestion group contributes exactly 1,000 selected rows.

The selection was designed to preserve:

* data quality
* temporal diversity
* road-type diversity
* edge diversity
* congestion-class representation

The rows were **not selected as a purely random sample**.

---

# 16. Event ML Dataset

```text
data/processed/event_prediction_targets_reduced.csv.gz
```

Statistics:

```text
Rows:       144,000
Scenarios:  24
```

Selection structure:

```text
24 scenarios
× 6 horizons
× 1,000 rows
= 144,000 rows
```

Each event scenario/horizon group contributes 1,000 selected observations.

---

# 17. Road Features

```text
data/processed/road_features.csv
```

Contains road-level features for approximately 66,597 road edges.

Important fields include:

```text
edge_id
from_node
to_node
length
lanes
speed_limit
road_type
capacity
```

The capacity value is:

```text
lane_count × 1800
```

and is therefore a **modeling proxy**, not a measured road capacity.

---

# 18. Event Scenario Features

```text
data/processed/event_scenario_features.csv
```

Contains event-level information such as:

```text
event_location_id
event_name
event_category
latitude
longitude
event_edge
event_road_type
mapping_distance_m
event_type
event_size
attendance
time_period
seed
event_duration_min
event_start_minute
event_arrival_rate
event_departure_rate
```

---

# 19. Event Spatial Features

```text
data/processed/event_spatial_features.csv
```

Contains relationships between event locations and nearby road edges.

Spatial ranges:

```text
within 250 m
within 500 m
within 1 km
```

Important fields:

```text
event_location_id
edge_id
distance_to_event_m
within_250m
within_500m
within_1000m
distance_weight
```

The distance weight is calculated as:

```text
max(0, 1 - distance / 1000)
```

This is a **modeling feature**, not a physical traffic law.

---

# 20. Event Traffic Observations

```text
data/processed/event_traffic_1km.csv.gz
```

Contains event-simulation traffic observations for roads within 1 km of the event.

It contains approximately:

```text
366,049 rows
```

Important traffic fields include:

```text
speed
density
occupancy
flow
travel_time
waiting_time
time_loss
```

This file can be useful when the ML team wants to work specifically with event-region traffic rather than the complete unified dataset.

---

# 21. Event Impact Analysis

```text
data/processed/event_baseline_paired_impact.csv
```

Contains paired event-vs-baseline local impact measurements.

Useful for:

* checking whether an event produces measurable traffic changes
* exploratory analysis
* validating event scenarios
* understanding differences between event locations

This is primarily an **analysis/validation dataset**, rather than the main training dataset.

---

# 22. GNN / ST-GNN Compatibility

The dataset is suitable for a **Graph Neural Network** approach.

The most natural approach is to represent:

```text
road segment = graph node
```

and connect road segments when they are physically connected.

The topology can be obtained from:

```text
data/raw/sumo_network/guntur_city.net.xml
```

or:

```text
data/raw/osm/guntur_city_drive.graphml
```

The GNN can then use traffic and road features such as:

```text
current_speed
current_density
current_occupancy
current_flow
current_travel_time
current_waiting_time
current_time_loss

length
lanes
speed_limit
road_type

distance_to_event_m
within_250m
within_500m
within_1000m
distance_weight

attendance
event_duration_min
event_start_minute
event_arrival_rate
event_departure_rate
```

Possible targets:

```text
future_speed
future_density
future_flow
future_travel_time
future_congestion
```

---

# 23. Recommended GNN Formulation

For a GNN, the CSV should not be treated as independent tabular observations.

Instead, the ML pipeline should transform the data into graph snapshots:

```text
Graph G = (V, E)

V = road segments
E = road connectivity
```

For each time step:

```text
X_t = node features at time t
```

with the target:

```text
Y_(t+h) = future traffic state
```

For example:

```text
Guntur road graph
       +
traffic at 18:00
       +
event at E01
       ↓
GNN / ST-GNN
       ↓
predicted traffic at 18:15
```

A suitable pilot architecture could be:

```text
Traffic history
      ↓
Graph Convolution / GAT
      ↓
Temporal layer
(GRU/LSTM/Temporal module)
      ↓
Future traffic prediction
```

The existing files provide the information required to construct this representation.

The `edge_index` / adjacency structure itself still needs to be generated by the ML pipeline from the road-network files.

---

# 24. Important Interpretation

The project separates two different tasks:

### ML prediction

```text
Predict future traffic conditions
```

### Routing

```text
Use predicted traffic conditions
as dynamic road weights
```

The ML model does **not** need to calculate Dijkstra/A* routes during training.

A later routing system can use predictions such as:

```text
predicted travel time
```

to assign dynamic edge weights.

---

# 25. Dataset Quality Checks

The final unified dataset was checked for:

```text
Missing values:  0
Duplicates:      0
```

The baseline prediction dataset was checked for:

```text
Rows: 1,080,000
Scenarios: 36
Horizons: 6
Congestion classes: 5
Duplicate rows: 0
Missing values: 0
```

The event prediction dataset was checked for:

```text
Rows: 144,000
Scenarios: 24
Horizons: 6
Duplicate rows: 0
Missing values: 0
```

All 24 event EdgeData simulation files were also verified to contain:

```text
180 one-minute intervals
```

---

# 26. Files Available to the ML Team

## Primary files

```text
data/processed/routecast_ml_dataset.csv.gz

data/processed/baseline_prediction_targets_reduced.csv.gz

data/processed/event_prediction_targets_reduced.csv.gz
```

## Supporting feature files

```text
data/processed/road_features.csv

data/processed/event_scenario_features.csv

data/processed/event_spatial_features.csv

data/processed/event_traffic_1km.csv.gz
```

## Event impact analysis

```text
data/processed/event_baseline_paired_impact.csv

data/processed/event_baseline_impact.csv
```

## Network files

```text
data/raw/osm/guntur_city_drive.graphml

data/raw/sumo_network/guntur_city.net.xml

data/raw/sumo_network/guntur_city_bbox.osm.xml
```

---

# 27. Recommended Starting Point for ML

The simplest starting point is:

```text
routecast_ml_dataset.csv.gz
```

For a tabular baseline:

```text
Input:
current traffic
+
road features
+
event features
+
spatial features

Target:
future_speed / future_travel_time /
future_congestion
```

For a GNN:

```text
SUMO network
      ↓
Build graph topology
      ↓
Map road edge_id → graph node
      ↓
Join dataset features
      ↓
Create temporal graph snapshots
      ↓
Train GNN / ST-GNN
```

The ML team can then decide whether a:

```text
XGBoost / Random Forest
        vs.
GCN / GAT
        vs.
ST-GNN
```

is most appropriate for the pilot.

---

# 28. Current Limitations

This dataset is designed for a **pilot**, not a production traffic forecasting system.

### Event coverage

Currently:

```text
8 locations
1 event type
1 event size
1 attendance level
normal evening traffic
3 seeds
```

There are no current event simulations for:

```text
low-demand traffic
high-demand traffic
morning events
midday events
night events
multiple attendance levels
multiple event types
multiple event sizes
```

Therefore, the model's generalization beyond these conditions must be evaluated carefully.

### Synthetic event demand

Event attendance, vehicle occupancy, vehicle shares, and arrival/departure rates are simulation assumptions.

They should not be presented as observed Guntur statistics.

### SUMO realism

The traffic data is simulation-generated.

It represents a digital-twin experiment rather than direct sensor measurements.

### Spatial approximation

Some spatial features use road-edge midpoint distance.

This is appropriate for the pilot but can be improved later with more detailed network geometry.

### Event location mapping

Event locations were mapped to nearby SUMO road edges. Mapping distances vary by location.

### Congestion labels

Congestion classes are model-derived labels based on traffic speed relative to the road speed limit.

They should therefore be treated as **simulation-derived classes**, not official traffic congestion categories.

---

# 29. What Has Already Been Completed

The dataset-generation pipeline has completed:

```text
✓ Urban Guntur study area defined

✓ OSM road network collected

✓ SUMO network generated

✓ Road features extracted

✓ 36 baseline scenarios generated

✓ Baseline scenarios simulated

✓ Baseline traffic prediction targets generated

✓ Baseline dataset reduced using quality/diversity selection

✓ 8 event locations selected

✓ Event scenarios generated

✓ 24 event simulations completed

✓ Event simulations validated

✓ Event vs baseline impact analyzed

✓ Event spatial features generated

✓ Event prediction targets generated

✓ Event dataset reduced

✓ Baseline + event datasets unified

✓ Final ML dataset validated
```

---

# 30. Current Dataset Status

The dataset-generation phase for the **pilot event-prediction problem is complete**.

The ML team now has:

```text
Traffic data
+
Road features
+
Road topology
+
Event features
+
Event spatial relationships
+
Future prediction targets
+
Baseline/event comparisons
```

This is sufficient to begin ML experimentation, including a **GNN/ST-GNN implementation**.

---

# 31. Important: Do Not Treat the Event Dataset as Fully Generalized

The correct project claim is:

> **The dataset supports a pilot study of predicting traffic changes caused by large concert-type events during normal evening traffic in representative locations across urban Guntur.**

A stronger generalized claim such as:

> "The model predicts traffic impacts for any event anywhere in Guntur"

would require additional event simulations covering different:

* event types
* event sizes
* attendance levels
* locations
* traffic demand levels
* time periods

Those can be added in a future expansion if required.

---

# 32. Storage / Intermediate Data

A large SQLite database was previously used as an intermediate processing store:

```text
traffic_state.db
```

It was approximately 10 GB.

It was used to construct the prediction datasets but is **not required for the final ML handoff**.

The final derived datasets have already been generated.

Therefore, the intermediate database can remain deleted to conserve disk space.

---

# 33. Final Handoff

### Start here

```text
data/processed/routecast_ml_dataset.csv.gz
```

### For GNN topology

```text
data/raw/sumo_network/guntur_city.net.xml
```

### For road features

```text
data/processed/road_features.csv
```

### For event features

```text
data/processed/event_scenario_features.csv
```

### For event-road spatial relationships

```text
data/processed/event_spatial_features.csv
```

### For event-only traffic

```text
data/processed/event_traffic_1km.csv.gz
```

### For event impact validation

```text
data/processed/event_baseline_paired_impact.csv
```

---

# 34. Final Summary

The RouteCast dataset pipeline has produced a **validated pilot-scale ML dataset for event-aware urban traffic prediction in Guntur**.

The main dataset contains:

```text
1,224,000 rows
50 features
36 baseline scenarios
24 event scenarios
8 event locations
6 prediction horizons
5 congestion classes
0 missing values
0 duplicates
```

The dataset contains the necessary information for both:

```text
Traditional ML
```

and:

```text
Graph Neural Network /
Spatio-Temporal GNN
```

approaches.

For a GNN, the key additional processing step is to construct the graph topology from the SUMO/OSM network and map each road segment to its corresponding traffic feature vector.

The dataset-generation responsibility is therefore complete for the current pilot. Model architecture, training, evaluation, and routing integration can proceed independently from this handoff.
