import sqlite3
import math

DB = "data/processed/traffic_state.db"

HORIZONS = [5, 10, 15, 30, 45, 60]
VALID_CONGESTION = {"free", "light", "moderate", "heavy", "severe"}

conn = sqlite3.connect(DB)
cur = conn.cursor()

print("=" * 70)
print("PREDICTION DATASET VALIDATION")
print("=" * 70)

# ------------------------------------------------------------
# 1. Total rows
# ------------------------------------------------------------

total = cur.execute("""
    SELECT COUNT(*)
    FROM prediction_targets
""").fetchone()[0]

print(f"\nTotal prediction rows : {total:,}")

# ------------------------------------------------------------
# 2. Scenario count
# ------------------------------------------------------------

scenarios = cur.execute("""
    SELECT COUNT(DISTINCT scenario_id)
    FROM prediction_targets
""").fetchone()[0]

print(f"Scenarios              : {scenarios}")

if scenarios == 36:
    print("Scenario coverage      : OK")
else:
    print("Scenario coverage      : FAIL")

# ------------------------------------------------------------
# 3. Horizon validation
# ------------------------------------------------------------

print("\nHorizon distribution:")

horizon_rows = cur.execute("""
    SELECT horizon_minutes, COUNT(*)
    FROM prediction_targets
    GROUP BY horizon_minutes
    ORDER BY horizon_minutes
""").fetchall()

found_horizons = {row[0] for row in horizon_rows}

for horizon, count in horizon_rows:
    print(f"  {horizon:>2} min : {count:,}")

if found_horizons == set(HORIZONS):
    print("Horizon values         : OK")
else:
    print("Horizon values         : FAIL")

# ------------------------------------------------------------
# 4. Future-time correctness
# ------------------------------------------------------------

bad_future_time = cur.execute("""
    SELECT COUNT(*)
    FROM prediction_targets
    WHERE future_time <= [current_time]
       OR future_time != [current_time] + horizon_minutes * 60
""").fetchone()[0]

print(
    f"\nInvalid future timestamps : "
    f"{bad_future_time:,}"
)

# ------------------------------------------------------------
# 5. Duplicate prediction samples
# ------------------------------------------------------------

print("\nChecking duplicate samples...")

duplicates = cur.execute("""
    SELECT COUNT(*)
    FROM (
        SELECT
            scenario_id,
            edge_id,
            [current_time],
            horizon_minutes,
            COUNT(*) AS n
        FROM prediction_targets
        GROUP BY
            scenario_id,
            edge_id,
            [current_time],
            horizon_minutes
        HAVING n > 1
    )
""").fetchone()[0]

print(f"Duplicate groups          : {duplicates:,}")

# ------------------------------------------------------------
# 6. Missing current features
# ------------------------------------------------------------

print("\nChecking current features...")

missing_current = cur.execute("""
    SELECT COUNT(*)
    FROM prediction_targets
    WHERE current_speed IS NULL
       OR current_density IS NULL
       OR current_occupancy IS NULL
       OR current_flow IS NULL
       OR length IS NULL
       OR lanes IS NULL
       OR speed_limit IS NULL
       OR capacity IS NULL
       OR road_type IS NULL
""").fetchone()[0]

print(
    f"Rows with missing current features : "
    f"{missing_current:,}"
)

# ------------------------------------------------------------
# 7. Missing future targets
# ------------------------------------------------------------

print("\nChecking future targets...")

missing_future = cur.execute("""
    SELECT COUNT(*)
    FROM prediction_targets
    WHERE future_speed IS NULL
       OR future_density IS NULL
       OR future_occupancy IS NULL
       OR future_flow IS NULL
       OR future_travel_time IS NULL
       OR future_speed_relative IS NULL
       OR future_congestion IS NULL
""").fetchone()[0]

print(
    f"Rows with missing future targets : "
    f"{missing_future:,}"
)

# ------------------------------------------------------------
# 8. Invalid numeric values
# ------------------------------------------------------------

print("\nChecking numeric ranges...")

invalid_numeric = cur.execute("""
    SELECT COUNT(*)
    FROM prediction_targets
    WHERE current_speed < 0
       OR current_density < 0
       OR current_occupancy < 0
       OR current_occupancy > 100
       OR current_flow < 0
       OR future_speed < 0
       OR future_density < 0
       OR future_occupancy < 0
       OR future_occupancy > 100
       OR future_flow < 0
       OR length <= 0
       OR lanes <= 0
       OR speed_limit <= 0
       OR capacity <= 0
""").fetchone()[0]

print(
    f"Invalid numeric/range rows : "
    f"{invalid_numeric:,}"
)

# ------------------------------------------------------------
# 9. Congestion classes
# ------------------------------------------------------------

print("\nChecking congestion classes...")

congestion_rows = cur.execute("""
    SELECT future_congestion, COUNT(*)
    FROM prediction_targets
    GROUP BY future_congestion
    ORDER BY future_congestion
""").fetchall()

invalid_classes = 0

for label, count in congestion_rows:

    print(
        f"  {str(label):>8} : "
        f"{count:,}"
    )

    if label not in VALID_CONGESTION:
        invalid_classes += 1

print(
    f"Invalid congestion classes : "
    f"{invalid_classes:,}"
)

# ------------------------------------------------------------
# 10. Scenario × horizon coverage
# ------------------------------------------------------------

print("\nScenario/horizon coverage:")

coverage = cur.execute("""
    SELECT
        COUNT(DISTINCT scenario_id),
        COUNT(DISTINCT horizon_minutes)
    FROM prediction_targets
""").fetchone()

print(
    f"  Distinct scenarios : {coverage[0]}"
)

print(
    f"  Distinct horizons  : {coverage[1]}"
)

# ------------------------------------------------------------
# 11. Target statistics
# ------------------------------------------------------------

print("\nTarget statistics:")

stats = cur.execute("""
    SELECT
        MIN(future_speed),
        MAX(future_speed),
        AVG(future_speed),

        MIN(future_density),
        MAX(future_density),
        AVG(future_density),

        MIN(future_travel_time),
        MAX(future_travel_time),
        AVG(future_travel_time)
    FROM prediction_targets
""").fetchone()

print(
    f"Future speed      : "
    f"min={stats[0]:.4f}, "
    f"max={stats[1]:.4f}, "
    f"mean={stats[2]:.4f}"
)

print(
    f"Future density    : "
    f"min={stats[3]:.4f}, "
    f"max={stats[4]:.4f}, "
    f"mean={stats[5]:.4f}"
)

print(
    f"Future travel time: "
    f"min={stats[6]:.4f}, "
    f"max={stats[7]:.4f}, "
    f"mean={stats[8]:.4f}"
)

# ------------------------------------------------------------
# 12. Check invalid extreme targets
# ------------------------------------------------------------

print("\nChecking extreme future travel times...")

extreme_targets = cur.execute("""
    SELECT COUNT(*)
    FROM prediction_targets
    WHERE future_travel_time > 3600
""").fetchone()[0]

print(
    f"Future travel_time > 3600 sec : "
    f"{extreme_targets:,}"
)

# ------------------------------------------------------------
# 13. Check scenario intervals
# ------------------------------------------------------------

print("\nChecking temporal coverage...")

interval_stats = cur.execute("""
    SELECT
        scenario_id,
        COUNT(DISTINCT [current_time]),
        MIN([current_time]),
        MAX([current_time])
    FROM prediction_targets
    GROUP BY scenario_id
    ORDER BY scenario_id
""").fetchall()

bad_scenarios = 0

for scenario, count, minimum, maximum in interval_stats:

    if count <= 0 or minimum >= maximum:
        bad_scenarios += 1

print(
    f"Scenarios with invalid time coverage : "
    f"{bad_scenarios}"
)

# ------------------------------------------------------------
# 14. Final result
# ------------------------------------------------------------

checks = {
    "scenario_coverage": scenarios == 36,
    "horizons": found_horizons == set(HORIZONS),
    "future_time": bad_future_time == 0,
    "duplicates": duplicates == 0,
    "missing_current": missing_current == 0,
    "missing_future": missing_future == 0,
    "numeric_ranges": invalid_numeric == 0,
    "congestion_classes": invalid_classes == 0,
    "bad_scenarios": bad_scenarios == 0,
}

print("\n" + "=" * 70)
print("VALIDATION SUMMARY")
print("=" * 70)

for name, passed in checks.items():

    status = "PASS" if passed else "FAIL"

    print(
        f"{status:>6} : {name}"
    )

if all(checks.values()):
    print("\nRESULT: PREDICTION DATASET VALID")
else:
    print("\nRESULT: PREDICTION DATASET REQUIRES REVIEW")

conn.close()
