import sqlite3

DB = "data/processed/traffic_state.db"

def time_to_seconds(value):
    if value is None:
        return None

    value = str(value)

    if ":" in value:
        parts = value.split(":")
        if len(parts) == 3:
            h, m, s = parts
            return int(h) * 3600 + int(m) * 60 + float(s)

    return float(value)


conn = sqlite3.connect(DB)
cur = conn.cursor()

print("=" * 70)
print("PREDICTION DATASET DIAGNOSTIC")
print("=" * 70)


# ------------------------------------------------------------
# 0. Inspect actual time storage
# ------------------------------------------------------------

print("\n0. Time storage inspection")

samples = cur.execute("""
    SELECT current_time, future_time, horizon_minutes
    FROM prediction_targets
    LIMIT 5
""").fetchall()

for row in samples:
    print(
        f"  current_time={row[0]!r}, "
        f"future_time={row[1]!r}, "
        f"horizon={row[2]}"
    )


# ------------------------------------------------------------
# 1. Future-time consistency
# ------------------------------------------------------------

print("\n1. Future-time consistency")

rows = cur.execute("""
    SELECT current_time, future_time, horizon_minutes
    FROM prediction_targets
    LIMIT 100000
""").fetchall()

bad = 0

for current, future, horizon in rows:
    try:
        c = time_to_seconds(current)
        f = time_to_seconds(future)
        expected = c + int(horizon) * 60

        if abs(f - expected) > 0.001:
            bad += 1

    except Exception:
        bad += 1

print(f"Checked sample rows : {len(rows):,}")
print(f"Sample mismatches    : {bad:,}")


# ------------------------------------------------------------
# 2. Duplicate diagnosis
# ------------------------------------------------------------

print("\n2. Duplicate diagnosis")

duplicate_groups = cur.execute("""
    SELECT COUNT(*)
    FROM (
        SELECT
            scenario_id,
            edge_id,
            current_time,
            horizon_minutes,
            COUNT(*) AS n
        FROM prediction_targets
        GROUP BY
            scenario_id,
            edge_id,
            current_time,
            horizon_minutes
        HAVING COUNT(*) > 1
    )
""").fetchone()[0]

duplicate_rows = cur.execute("""
    SELECT COALESCE(SUM(n), 0)
    FROM (
        SELECT COUNT(*) AS n
        FROM prediction_targets
        GROUP BY
            scenario_id,
            edge_id,
            current_time,
            horizon_minutes
        HAVING COUNT(*) > 1
    )
""").fetchone()[0]

print(f"Duplicate groups       : {duplicate_groups:,}")
print(f"Rows in duplicate groups: {duplicate_rows:,}")


if duplicate_groups > 0:

    print("\nExample prediction duplicates:")

    examples = cur.execute("""
        SELECT
            scenario_id,
            edge_id,
            current_time,
            horizon_minutes,
            COUNT(*) AS n
        FROM prediction_targets
        GROUP BY
            scenario_id,
            edge_id,
            current_time,
            horizon_minutes
        HAVING COUNT(*) > 1
        LIMIT 10
    """).fetchall()

    for row in examples:
        print(
            f"  scenario={row[0]}, "
            f"edge={row[1]}, "
            f"time={row[2]}, "
            f"horizon={row[3]}, "
            f"rows={row[4]}"
        )


# ------------------------------------------------------------
# 3. Scenario temporal coverage
# ------------------------------------------------------------

print("\n3. Scenario temporal coverage")

rows = cur.execute("""
    SELECT
        scenario_id,
        COUNT(DISTINCT current_time),
        MIN(current_time),
        MAX(current_time),
        MIN(future_time),
        MAX(future_time)
    FROM prediction_targets
    GROUP BY scenario_id
    ORDER BY scenario_id
""").fetchall()

print(
    f"{'Scenario':<42}"
    f"{'Times':>8}"
    f"{'Current Min':>14}"
    f"{'Current Max':>14}"
)

print("-" * 82)

for scenario, count, cmin, cmax, fmin, fmax in rows:

    print(
        f"{scenario:<42}"
        f"{count:>8}"
        f"{str(cmin):>14}"
        f"{str(cmax):>14}"
    )


# ------------------------------------------------------------
# 4. Source traffic-state duplicates
# ------------------------------------------------------------

print("\n4. Source traffic-state duplicate diagnosis")

source_duplicate_groups = cur.execute("""
    SELECT COUNT(*)
    FROM (
        SELECT
            scenario_id,
            edge_id,
            interval_begin,
            COUNT(*) AS n
        FROM traffic_state
        GROUP BY
            scenario_id,
            edge_id,
            interval_begin
        HAVING COUNT(*) > 1
    )
""").fetchone()[0]

source_duplicate_rows = cur.execute("""
    SELECT COALESCE(SUM(n), 0)
    FROM (
        SELECT COUNT(*) AS n
        FROM traffic_state
        GROUP BY
            scenario_id,
            edge_id,
            interval_begin
        HAVING COUNT(*) > 1
    )
""").fetchone()[0]

print(f"Source duplicate groups : {source_duplicate_groups:,}")
print(f"Source duplicate rows   : {source_duplicate_rows:,}")


if source_duplicate_groups > 0:

    print("\nExample source duplicates:")

    examples = cur.execute("""
        SELECT
            scenario_id,
            edge_id,
            interval_begin,
            COUNT(*) AS n
        FROM traffic_state
        GROUP BY
            scenario_id,
            edge_id,
            interval_begin
        HAVING COUNT(*) > 1
        LIMIT 10
    """).fetchall()

    for row in examples:
        print(
            f"  scenario={row[0]}, "
            f"edge={row[1]}, "
            f"time={row[2]}, "
            f"rows={row[3]}"
        )


# ------------------------------------------------------------
# 5. Prediction counts
# ------------------------------------------------------------

print("\n5. Prediction counts")

total = cur.execute("""
    SELECT COUNT(*)
    FROM prediction_targets
""").fetchone()[0]

print(f"Total rows : {total:,}")

for horizon in [5, 10, 15, 30, 45, 60]:

    count = cur.execute("""
        SELECT COUNT(*)
        FROM prediction_targets
        WHERE horizon_minutes = ?
    """, (horizon,)).fetchone()[0]

    print(f"  {horizon:>2} min : {count:,}")


# ------------------------------------------------------------
# 6. Extreme target check
# ------------------------------------------------------------

print("\n6. Extreme future targets")

extreme = cur.execute("""
    SELECT COUNT(*)
    FROM prediction_targets
    WHERE future_travel_time > 3600
      AND future_speed <= 0.10
""").fetchone()[0]

print(f"Extreme future targets : {extreme:,}")


# ------------------------------------------------------------
# 7. Check road feature uniqueness
# ------------------------------------------------------------

print("\n7. Road-feature uniqueness")

road_duplicate_groups = cur.execute("""
    SELECT COUNT(*)
    FROM (
        SELECT edge_id
        FROM road_features
        GROUP BY edge_id
        HAVING COUNT(*) > 1
    )
""").fetchone()[0]

print(f"Duplicate road feature IDs : {road_duplicate_groups:,}")


# ------------------------------------------------------------
# 8. Check whether prediction multiplication is caused
#    by road_features
# ------------------------------------------------------------

print("\n8. Join multiplication check")

traffic_sample = cur.execute("""
    SELECT
        t.scenario_id,
        t.edge_id,
        t.interval_begin,
        COUNT(*) AS n
    FROM traffic_state t
    JOIN road_features r
      ON t.edge_id = r.edge_id
    GROUP BY
        t.scenario_id,
        t.edge_id,
        t.interval_begin
    HAVING COUNT(*) > 1
    LIMIT 10
""").fetchall()

print(f"Duplicate joined groups found in sample: {len(traffic_sample)}")

for row in traffic_sample:
    print(
        f"  scenario={row[0]}, "
        f"edge={row[1]}, "
        f"time={row[2]}, "
        f"rows={row[3]}"
    )


conn.close()

print("\n" + "=" * 70)
print("DIAGNOSTIC COMPLETE")
print("=" * 70)