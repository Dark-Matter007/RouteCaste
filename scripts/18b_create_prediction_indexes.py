import sqlite3

DB = "data/processed/traffic_state.db"

conn = sqlite3.connect(DB)
cur = conn.cursor()

print("Creating prediction indexes...")

indexes = [
    """
    CREATE INDEX IF NOT EXISTS idx_prediction_scenario_time
    ON prediction_targets(scenario_id, "current_time")
    """,

    """
    CREATE INDEX IF NOT EXISTS idx_prediction_horizon
    ON prediction_targets(horizon_minutes)
    """,

    """
    CREATE INDEX IF NOT EXISTS idx_prediction_edge
    ON prediction_targets(edge_id)
    """,

    """
    CREATE INDEX IF NOT EXISTS idx_prediction_lookup
    ON prediction_targets(
        scenario_id,
        edge_id,
        "current_time",
        horizon_minutes
    )
    """
]

for sql in indexes:
    cur.execute(sql)
    conn.commit()

    print("  Index created.")

print("\nChecking prediction table...")

rows = cur.execute(
    "SELECT COUNT(*) FROM prediction_targets"
).fetchone()[0]

print(f"Prediction rows: {rows:,}")

print("\nChecking horizons...")

for horizon in [5, 10, 15, 30, 45, 60]:
    count = cur.execute(
        """
        SELECT COUNT(*)
        FROM prediction_targets
        WHERE horizon_minutes = ?
        """,
        (horizon,)
    ).fetchone()[0]

    print(f"  {horizon:>2} min : {count:,}")

print("\nChecking scenarios...")

scenarios = cur.execute(
    """
    SELECT COUNT(DISTINCT scenario_id)
    FROM prediction_targets
    """
).fetchone()[0]

print(f"Scenarios: {scenarios}")

print("\nDatabase integrity check...")

integrity = cur.execute(
    "PRAGMA integrity_check"
).fetchone()[0]

print(f"Integrity: {integrity}")

conn.close()

print("\nPREDICTION INDEXING COMPLETE")