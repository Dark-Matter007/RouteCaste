import sqlite3
import csv
from pathlib import Path

DB = Path("data/processed/traffic_state.db")
ROAD_FEATURES = Path("data/processed/road_features.csv")
OUTPUT = Path("data/processed/prediction_dataset.csv")

HORIZONS = [5, 10, 15, 30, 45, 60]

# Congestion based on speed relative to speed limit.
# These are modeling thresholds, not measured Guntur standards.
def congestion_class(speed_relative):
    if speed_relative >= 0.80:
        return "free"
    elif speed_relative >= 0.60:
        return "light"
    elif speed_relative >= 0.40:
        return "moderate"
    elif speed_relative >= 0.20:
        return "heavy"
    else:
        return "severe"


def load_road_features():
    features = {}

    with ROAD_FEATURES.open(
        "r",
        encoding="utf-8",
        newline=""
    ) as f:
        reader = csv.DictReader(f)

        for row in reader:
            features[row["edge_id"]] = {
                "length": float(row["length"]),
                "lanes": float(row["lanes"]),
                "speed_limit": float(row["speed_limit"]),
                "road_type": row["road_type"],
                "capacity": float(row["capacity"]),
            }

    return features


def main():
    if not DB.exists():
        raise FileNotFoundError(DB)

    if not ROAD_FEATURES.exists():
        raise FileNotFoundError(ROAD_FEATURES)

    road_features = load_road_features()

    conn = sqlite3.connect(DB)
    conn.execute("PRAGMA temp_store=FILE")
    conn.execute("PRAGMA cache_size=-200000")

    # ---------------------------------------------------------
    # Create indexed temporary table containing only rows
    # suitable for prediction.
    # ---------------------------------------------------------
    conn.execute("""
        DROP TABLE IF EXISTS prediction_base
    """)

    conn.execute("""
        CREATE TEMP TABLE prediction_base AS
        SELECT
            scenario_id,
            demand_level,
            time_period,
            seed,
            interval_begin,
            interval_end,
            edge_id,
            sampled_seconds,
            travel_time,
            density,
            lane_density,
            occupancy,
            waiting_time,
            time_loss,
            speed,
            speed_relative,
            flow,
            entered,
            left,
            data_quality,
            travel_time_valid
        FROM traffic_state
        WHERE travel_time_valid = 1
    """)

    conn.execute("""
        CREATE INDEX idx_prediction_base
        ON prediction_base(
            scenario_id,
            edge_id,
            interval_begin
        )
    """)

    # ---------------------------------------------------------
    # Output columns
    # ---------------------------------------------------------
    fields = [
        "scenario_id",
        "demand_level",
        "time_period",
        "seed",
        "interval_begin",
        "edge_id",

        "length",
        "lanes",
        "speed_limit",
        "road_type",
        "capacity",

        "sampled_seconds",
        "current_speed",
        "current_density",
        "current_lane_density",
        "current_occupancy",
        "current_flow",
        "current_entered",
        "current_left",
        "current_waiting_time",
        "current_time_loss",
        "current_speed_relative",
        "data_quality",
    ]

    for h in HORIZONS:
        fields.extend([
            f"future_{h}m_speed",
            f"future_{h}m_density",
            f"future_{h}m_occupancy",
            f"future_{h}m_flow",
            f"future_{h}m_travel_time",
            f"future_{h}m_speed_relative",
            f"future_{h}m_congestion",
        ])

    with OUTPUT.open(
        "w",
        encoding="utf-8",
        newline=""
    ) as fout:

        writer = csv.DictWriter(
            fout,
            fieldnames=fields
        )
        writer.writeheader()

        cursor = conn.execute("""
            SELECT
                scenario_id,
                demand_level,
                time_period,
                seed,
                interval_begin,
                edge_id,
                sampled_seconds,
                speed,
                density,
                lane_density,
                occupancy,
                flow,
                entered,
                left,
                waiting_time,
                time_loss,
                speed_relative,
                data_quality
            FROM prediction_base
            ORDER BY scenario_id, edge_id, interval_begin
        """)

        total = 0
        written = 0

        for row in cursor:
            total += 1

            (
                scenario_id,
                demand_level,
                time_period,
                seed,
                interval_begin,
                edge_id,
                sampled_seconds,
                speed,
                density,
                lane_density,
                occupancy,
                flow,
                entered,
                left,
                waiting_time,
                time_loss,
                speed_relative,
                data_quality,
            ) = row

            rf = road_features.get(edge_id)

            # EdgeData can contain only a subset of network edges.
            if rf is None:
                continue

            output = {
                "scenario_id": scenario_id,
                "demand_level": demand_level,
                "time_period": time_period,
                "seed": seed,
                "interval_begin": interval_begin,
                "edge_id": edge_id,

                "length": rf["length"],
                "lanes": rf["lanes"],
                "speed_limit": rf["speed_limit"],
                "road_type": rf["road_type"],
                "capacity": rf["capacity"],

                "sampled_seconds": sampled_seconds,
                "current_speed": speed,
                "current_density": density,
                "current_lane_density": lane_density,
                "current_occupancy": occupancy,
                "current_flow": flow,
                "current_entered": entered,
                "current_left": left,
                "current_waiting_time": waiting_time,
                "current_time_loss": time_loss,
                "current_speed_relative": speed_relative,
                "data_quality": data_quality,
            }

            # -------------------------------------------------
            # Look up future traffic for the SAME scenario,
            # SAME edge, at future timestamps.
            # -------------------------------------------------
            for h in HORIZONS:
                future_time = interval_begin + h * 60

                future = conn.execute("""
                    SELECT
                        speed,
                        density,
                        occupancy,
                        flow,
                        travel_time,
                        speed_relative
                    FROM prediction_base
                    WHERE scenario_id = ?
                      AND edge_id = ?
                      AND interval_begin = ?
                    LIMIT 1
                """, (
                    scenario_id,
                    edge_id,
                    future_time
                )).fetchone()

                if future is None:
                    output[f"future_{h}m_speed"] = ""
                    output[f"future_{h}m_density"] = ""
                    output[f"future_{h}m_occupancy"] = ""
                    output[f"future_{h}m_flow"] = ""
                    output[f"future_{h}m_travel_time"] = ""
                    output[f"future_{h}m_speed_relative"] = ""
                    output[f"future_{h}m_congestion"] = ""
                else:
                    (
                        fspeed,
                        fdensity,
                        foccupancy,
                        fflow,
                        ftravel,
                        fspeed_relative,
                    ) = future

                    output[f"future_{h}m_speed"] = fspeed
                    output[f"future_{h}m_density"] = fdensity
                    output[f"future_{h}m_occupancy"] = foccupancy
                    output[f"future_{h}m_flow"] = fflow
                    output[f"future_{h}m_travel_time"] = ftravel
                    output[f"future_{h}m_speed_relative"] = fspeed_relative
                    output[f"future_{h}m_congestion"] = congestion_class(
                        fspeed_relative
                    )

            writer.writerow(output)
            written += 1

            if written % 100000 == 0:
                print(
                    f"Processed: {total:,} | "
                    f"Written: {written:,}"
                )

    conn.close()

    print()
    print("=" * 70)
    print("PREDICTION DATASET BUILD COMPLETE")
    print("=" * 70)
    print(f"Input prediction rows : {total:,}")
    print(f"Output rows           : {written:,}")
    print(f"Output                : {OUTPUT}")
    print(
        f"Output size           : "
        f"{OUTPUT.stat().st_size / (1024 ** 2):.2f} MB"
    )
    print("=" * 70)


if __name__ == "__main__":
    main()