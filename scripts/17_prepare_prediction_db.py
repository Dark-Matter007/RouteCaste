import csv
import sqlite3
from pathlib import Path

DB = Path("data/processed/traffic_state.db")
ROAD_FEATURES = Path("data/processed/road_features.csv")

conn = sqlite3.connect(DB)
cur = conn.cursor()

print("Creating road_features table...")

cur.execute("DROP TABLE IF EXISTS road_features")

cur.execute("""
CREATE TABLE road_features (
    edge_id TEXT PRIMARY KEY,
    from_node TEXT,
    to_node TEXT,
    length REAL,
    lanes REAL,
    speed_limit REAL,
    road_type TEXT,
    capacity REAL
)
""")

with ROAD_FEATURES.open("r", encoding="utf-8", newline="") as f:
    reader = csv.DictReader(f)

    batch = []

    for row in reader:
        batch.append((
            row["edge_id"],
            row["from_node"],
            row["to_node"],
            float(row["length"]),
            float(row["lanes"]),
            float(row["speed_limit"]),
            row["road_type"],
            float(row["capacity"]),
        ))

        if len(batch) >= 5000:
            cur.executemany("""
                INSERT INTO road_features
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, batch)
            conn.commit()
            batch.clear()

    if batch:
        cur.executemany("""
            INSERT INTO road_features
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, batch)

conn.commit()

print("Creating indexes...")

cur.execute("""
CREATE INDEX IF NOT EXISTS idx_traffic_scenario_edge_time
ON traffic_state(scenario_id, edge_id, interval_begin)
""")

cur.execute("""
CREATE INDEX IF NOT EXISTS idx_traffic_scenario_time
ON traffic_state(scenario_id, interval_begin)
""")

cur.execute("""
CREATE INDEX IF NOT EXISTS idx_traffic_edge_time
ON traffic_state(edge_id, interval_begin)
""")

conn.commit()

count = cur.execute(
    "SELECT COUNT(*) FROM road_features"
).fetchone()[0]

print(f"Road features loaded: {count:,}")

print("Running integrity check...")

result = cur.execute("""
SELECT COUNT(*)
FROM traffic_state t
LEFT JOIN road_features r
ON t.edge_id = r.edge_id
WHERE r.edge_id IS NULL
""").fetchone()[0]

print(f"Traffic rows without road features: {result:,}")

conn.close()

print("PREPARATION COMPLETE")