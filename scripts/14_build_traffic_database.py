import csv
import os
import sqlite3
import time

CSV_FILE = "data/processed/traffic_state.csv"
DB_FILE = "data/processed/traffic_state.db"

BATCH_SIZE = 10000

if os.path.exists(DB_FILE):
    print(f"Removing existing database: {DB_FILE}")
    os.remove(DB_FILE)

print("=" * 80)
print("BUILDING INDEXED TRAFFIC DATABASE")
print("=" * 80)

start_time = time.time()

conn = sqlite3.connect(DB_FILE)

# Improve write performance while building.
conn.execute("PRAGMA journal_mode=OFF")
conn.execute("PRAGMA synchronous=OFF")
conn.execute("PRAGMA temp_store=MEMORY")

conn.execute("""
CREATE TABLE traffic_state (
    scenario_id TEXT NOT NULL,
    demand_level TEXT NOT NULL,
    time_period TEXT NOT NULL,
    seed INTEGER NOT NULL,
    interval_begin REAL NOT NULL,
    interval_end REAL NOT NULL,
    edge_id TEXT NOT NULL,
    sampled_seconds REAL,
    travel_time REAL,
    overlap_travel_time REAL,
    density REAL,
    overlap_density REAL,
    lane_density REAL,
    occupancy REAL,
    waiting_time REAL,
    time_loss REAL,
    speed REAL,
    speed_relative REAL,
    flow REAL,
    departed REAL,
    arrived REAL,
    entered REAL,
    left REAL,
    lane_changed_from REAL,
    lane_changed_to REAL
)
""")

insert_sql = """
INSERT INTO traffic_state (
    scenario_id,
    demand_level,
    time_period,
    seed,
    interval_begin,
    interval_end,
    edge_id,
    sampled_seconds,
    travel_time,
    overlap_travel_time,
    density,
    overlap_density,
    lane_density,
    occupancy,
    waiting_time,
    time_loss,
    speed,
    speed_relative,
    flow,
    departed,
    arrived,
    entered,
    left,
    lane_changed_from,
    lane_changed_to
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""

batch = []
rows = 0

with open(CSV_FILE, "r", encoding="utf-8", newline="") as f:

    reader = csv.DictReader(f)

    for row in reader:

        batch.append((
            row["scenario_id"],
            row["demand_level"],
            row["time_period"],
            int(row["seed"]),
            float(row["interval_begin"]),
            float(row["interval_end"]),
            row["edge_id"],
            float(row["sampled_seconds"]),
            float(row["travel_time"]),
            float(row["overlap_travel_time"]),
            float(row["density"]),
            float(row["overlap_density"]),
            float(row["lane_density"]),
            float(row["occupancy"]),
            float(row["waiting_time"]),
            float(row["time_loss"]),
            float(row["speed"]),
            float(row["speed_relative"]),
            float(row["flow"]),
            float(row["departed"]),
            float(row["arrived"]),
            float(row["entered"]),
            float(row["left"]),
            float(row["lane_changed_from"]),
            float(row["lane_changed_to"]),
        ))

        if len(batch) >= BATCH_SIZE:

            conn.executemany(insert_sql, batch)
            rows += len(batch)
            batch.clear()

            if rows % 500000 == 0:
                elapsed = time.time() - start_time
                print(
                    f"Inserted {rows:,} rows "
                    f"({elapsed:.1f}s)"
                )

    if batch:
        conn.executemany(insert_sql, batch)
        rows += len(batch)
        batch.clear()

conn.commit()

print()
print("Creating index...")

conn.execute("""
CREATE INDEX idx_traffic_lookup
ON traffic_state (
    scenario_id,
    edge_id,
    interval_begin
)
""")

conn.commit()

print()
print("Running database integrity check...")

result = conn.execute(
    "PRAGMA integrity_check"
).fetchone()[0]

db_rows = conn.execute(
    "SELECT COUNT(*) FROM traffic_state"
).fetchone()[0]

conn.close()

elapsed = time.time() - start_time

print()
print("=" * 80)
print("DATABASE BUILD COMPLETE")
print("=" * 80)

print(f"CSV rows processed : {rows:,}")
print(f"Database rows      : {db_rows:,}")
print(f"Integrity check    : {result}")
print(f"Database           : {DB_FILE}")
print(f"Time               : {elapsed:.1f} seconds")
print("=" * 80)

if rows != db_rows:
    raise RuntimeError(
        f"Row mismatch: CSV={rows:,}, DB={db_rows:,}"
    )

if result != "ok":
    raise RuntimeError(
        f"SQLite integrity check failed: {result}"
    )