import sqlite3
from pathlib import Path
import time

DB = Path("data/processed/traffic_state.db")

HORIZONS = [5, 10, 15, 30, 45, 60]

conn = sqlite3.connect(DB)

# Performance / stability settings
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA synchronous=NORMAL")
conn.execute("PRAGMA temp_store=FILE")
conn.execute("PRAGMA cache_size=-200000")

cur = conn.cursor()

# ============================================================
# 1. CREATE PREDICTION TARGET TABLE
# ============================================================

print("Creating prediction_targets table...")

cur.execute("DROP TABLE IF EXISTS prediction_targets")

cur.execute("""
CREATE TABLE prediction_targets (

    scenario_id TEXT NOT NULL,
    demand_level TEXT NOT NULL,
    time_period TEXT NOT NULL,
    seed INTEGER NOT NULL,

    edge_id TEXT NOT NULL,

    current_time REAL NOT NULL,
    horizon_minutes INTEGER NOT NULL,
    future_time REAL NOT NULL,

    current_speed REAL,
    current_density REAL,
    current_occupancy REAL,
    current_flow REAL,
    current_travel_time REAL,
    current_waiting_time REAL,
    current_time_loss REAL,

    length REAL,
    lanes REAL,
    speed_limit REAL,
    road_type TEXT,
    capacity REAL,

    future_speed REAL,
    future_density REAL,
    future_occupancy REAL,
    future_flow REAL,
    future_travel_time REAL,
    future_waiting_time REAL,
    future_time_loss REAL,

    future_speed_relative REAL,
    future_departed REAL,
    future_arrived REAL,
    future_entered REAL,
    future_left REAL,

    future_congestion TEXT
)
""")

conn.commit()

# ============================================================
# 2. IDENTIFY INVALID EXTREME TARGETS
# ============================================================

print("Creating invalid target table...")

cur.execute("DROP TABLE IF EXISTS invalid_travel_targets")

cur.execute("""
CREATE TABLE invalid_travel_targets (

    scenario_id TEXT NOT NULL,
    edge_id TEXT NOT NULL,
    interval_begin REAL NOT NULL,

    PRIMARY KEY (
        scenario_id,
        edge_id,
        interval_begin
    )
)
""")

conn.commit()

print(
    "Identifying invalid extreme travel-time observations..."
)

cur.execute("""
INSERT INTO invalid_travel_targets
SELECT
    scenario_id,
    edge_id,
    interval_begin
FROM traffic_state
WHERE travel_time > 3600
  AND speed <= 0.10
""")

conn.commit()

invalid_count = cur.execute(
    "SELECT COUNT(*) FROM invalid_travel_targets"
).fetchone()[0]

print(
    f"Invalid target observations excluded: "
    f"{invalid_count:,}"
)

# ============================================================
# 3. BUILD PREDICTION DATA
# ============================================================

print("\nBuilding horizon targets...")

start_time = time.time()

for horizon in HORIZONS:

    seconds = horizon * 60

    print(
        f"  Processing horizon: "
        f"{horizon} minutes..."
    )

    cur.execute(
        f"""
        INSERT INTO prediction_targets (

            scenario_id,
            demand_level,
            time_period,
            seed,

            edge_id,

            current_time,
            horizon_minutes,
            future_time,

            current_speed,
            current_density,
            current_occupancy,
            current_flow,
            current_travel_time,
            current_waiting_time,
            current_time_loss,

            length,
            lanes,
            speed_limit,
            road_type,
            capacity,

            future_speed,
            future_density,
            future_occupancy,
            future_flow,
            future_travel_time,
            future_waiting_time,
            future_time_loss,

            future_speed_relative,
            future_departed,
            future_arrived,
            future_entered,
            future_left,

            future_congestion

        )

        SELECT

            c.scenario_id,
            c.demand_level,
            c.time_period,
            c.seed,

            c.edge_id,

            c.interval_begin,
            {horizon},
            c.interval_begin + {seconds},

            c.speed,
            c.density,
            c.occupancy,
            c.flow,
            c.travel_time,
            c.waiting_time,
            c.time_loss,

            r.length,
            r.lanes,
            r.speed_limit,
            r.road_type,
            r.capacity,

            f.speed,
            f.density,
            f.occupancy,
            f.flow,
            f.travel_time,
            f.waiting_time,
            f.time_loss,

            f.speed_relative,
            f.departed,
            f.arrived,
            f.entered,
            f.left,

            CASE

                WHEN f.speed_relative >= 0.80
                    THEN 'free'

                WHEN f.speed_relative >= 0.60
                    THEN 'light'

                WHEN f.speed_relative >= 0.40
                    THEN 'moderate'

                WHEN f.speed_relative >= 0.20
                    THEN 'heavy'

                ELSE 'severe'

            END

        FROM traffic_state AS c

        INNER JOIN traffic_state AS f

            ON f.scenario_id = c.scenario_id
           AND f.edge_id = c.edge_id
           AND f.interval_begin =
               c.interval_begin + {seconds}

        INNER JOIN road_features AS r

            ON r.edge_id = c.edge_id

        LEFT JOIN invalid_travel_targets AS bad

            ON bad.scenario_id = f.scenario_id
           AND bad.edge_id = f.edge_id
           AND bad.interval_begin = f.interval_begin

        WHERE bad.edge_id IS NULL
        """
    )

    conn.commit()

    count = cur.execute(
        """
        SELECT COUNT(*)
        FROM prediction_targets
        WHERE horizon_minutes = ?
        """,
        (horizon,)
    ).fetchone()[0]

    print(
        f"    Rows: {count:,}"
    )

elapsed = time.time() - start_time

print(
    f"\nTarget construction time: "
    f"{elapsed:.1f} seconds"
)

# ============================================================
# 4. CREATE INDEXES
# ============================================================

print("\nCreating prediction indexes...")

cur.execute("""
CREATE INDEX idx_prediction_scenario_time
ON prediction_targets(
    scenario_id,
    current_time
)
""")

cur.execute("""
CREATE INDEX idx_prediction_horizon
ON prediction_targets(
    horizon_minutes
)
""")

cur.execute("""
CREATE INDEX idx_prediction_edge
ON prediction_targets(
    edge_id
)
""")

cur.execute("""
CREATE INDEX idx_prediction_lookup
ON prediction_targets(
    scenario_id,
    edge_id,
    current_time,
    horizon_minutes
)
""")

conn.commit()

# ============================================================
# 5. FINAL STATISTICS
# ============================================================

print("\nFinal statistics:")

total = cur.execute(
    "SELECT COUNT(*) FROM prediction_targets"
).fetchone()[0]

print(
    f"Total prediction rows: "
    f"{total:,}"
)

print("\nRows by horizon:")

for horizon in HORIZONS:

    count = cur.execute(
        """
        SELECT COUNT(*)
        FROM prediction_targets
        WHERE horizon_minutes = ?
        """,
        (horizon,)
    ).fetchone()[0]

    print(
        f"  {horizon:>2} min : "
        f"{count:,}"
    )

# ============================================================
# 6. SCENARIO COUNT
# ============================================================

print("\nScenario count:")

scenario_count = cur.execute(
    """
    SELECT COUNT(DISTINCT scenario_id)
    FROM prediction_targets
    """
).fetchone()[0]

print(
    f"  {scenario_count}"
)

# ============================================================
# 7. CONGESTION DISTRIBUTION
# ============================================================

print("\nCongestion classes:")

rows = cur.execute(
    """
    SELECT
        future_congestion,
        COUNT(*)
    FROM prediction_targets
    GROUP BY future_congestion
    ORDER BY COUNT(*) DESC
    """
).fetchall()

for label, count in rows:

    print(
        f"  {label:>8} : "
        f"{count:,}"
    )

# ============================================================
# 8. NULL CHECK
# ============================================================

print("\nChecking target completeness...")

null_rows = cur.execute(
    """
    SELECT COUNT(*)
    FROM prediction_targets
    WHERE future_speed IS NULL
       OR future_density IS NULL
       OR future_travel_time IS NULL
       OR future_speed_relative IS NULL
    """
).fetchone()[0]

print(
    f"Rows with missing future targets: "
    f"{null_rows:,}"
)

# ============================================================
# 9. DUPLICATE CHECK
# ============================================================

print("\nChecking duplicate prediction samples...")

duplicate_groups = cur.execute(
    """
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
        HAVING n > 1
    )
    """
).fetchone()[0]

print(
    f"Duplicate groups: "
    f"{duplicate_groups:,}"
)

# ============================================================
# 10. DATABASE INTEGRITY
# ============================================================

print("\nDatabase integrity check...")

integrity = cur.execute(
    "PRAGMA integrity_check"
).fetchone()[0]

print(
    f"  {integrity}"
)

# ============================================================
# 11. CLOSE
# ============================================================

conn.close()

print("\nPREDICTION DATASET BUILD COMPLETE")