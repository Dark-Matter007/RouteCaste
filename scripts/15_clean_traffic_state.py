from pathlib import Path
import csv
import math
import sys

INPUT = Path("data/processed/traffic_state.csv")
OUTPUT = Path("data/processed/traffic_state_clean.csv")

REQUIRED_NUMERIC = [
    "interval_begin",
    "interval_end",
    "sampled_seconds",
    "travel_time",
    "overlap_travel_time",
    "density",
    "overlap_density",
    "lane_density",
    "occupancy",
    "waiting_time",
    "time_loss",
    "speed",
    "speed_relative",
    "flow",
    "departed",
    "arrived",
    "entered",
    "left",
    "lane_changed_from",
    "lane_changed_to",
]

NON_NEGATIVE_FIELDS = [
    "sampled_seconds",
    "travel_time",
    "overlap_travel_time",
    "density",
    "overlap_density",
    "lane_density",
    "occupancy",
    "waiting_time",
    "time_loss",
    "speed",
    "flow",
    "departed",
    "arrived",
    "entered",
    "left",
    "lane_changed_from",
    "lane_changed_to",
]

MAX_OCCUPANCY = 100.0

# Extremely large travel times combined with almost-zero speed
# are treated as unusable target observations.
EXTREME_TRAVEL_TIME = 3600.0       # 1 hour
NEAR_ZERO_SPEED = 0.10             # m/s


def parse_float(value):
    try:
        x = float(value)
        if not math.isfinite(x):
            return None
        return x
    except (ValueError, TypeError):
        return None


def main():
    if not INPUT.exists():
        print(f"ERROR: Input file not found: {INPUT}")
        sys.exit(1)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    total = 0
    kept = 0
    removed = 0

    reasons = {
        "invalid_numeric": 0,
        "negative_value": 0,
        "invalid_occupancy": 0,
        "extreme_travel_time": 0,
    }

    quality_counts = {
        "normal": 0,
        "low_sample": 0,
    }

    with INPUT.open("r", encoding="utf-8", newline="") as fin, \
         OUTPUT.open("w", encoding="utf-8", newline="") as fout:

        reader = csv.DictReader(fin)

        if reader.fieldnames is None:
            print("ERROR: CSV has no header.")
            sys.exit(1)

        missing = [
            col for col in REQUIRED_NUMERIC
            if col not in reader.fieldnames
        ]

        if missing:
            print("ERROR: Missing columns:")
            for col in missing:
                print(f"  {col}")
            sys.exit(1)

        output_fields = reader.fieldnames + [
            "data_quality",
            "travel_time_valid",
        ]

        writer = csv.DictWriter(
            fout,
            fieldnames=output_fields,
            extrasaction="ignore"
        )
        writer.writeheader()

        for row in reader:
            total += 1

            values = {}

            # --------------------------------------------------
            # 1. Numeric validation
            # --------------------------------------------------
            invalid_numeric = False

            for col in REQUIRED_NUMERIC:
                value = parse_float(row[col])

                if value is None:
                    invalid_numeric = True
                    break

                values[col] = value

            if invalid_numeric:
                removed += 1
                reasons["invalid_numeric"] += 1
                continue

            # --------------------------------------------------
            # 2. Physical non-negative validation
            # --------------------------------------------------
            negative = False

            for col in NON_NEGATIVE_FIELDS:
                if values[col] < 0:
                    negative = True
                    break

            if negative:
                removed += 1
                reasons["negative_value"] += 1
                continue

            # --------------------------------------------------
            # 3. Occupancy validation
            # --------------------------------------------------
            if values["occupancy"] > MAX_OCCUPANCY:
                removed += 1
                reasons["invalid_occupancy"] += 1
                continue

            # --------------------------------------------------
            # 4. Travel-time target quality
            #
            # Do NOT remove every travel_time > 300.
            #
            # Large travel times can represent real congestion.
            # Only remove clearly unusable extreme values when
            # accompanied by essentially zero speed.
            # --------------------------------------------------
            travel_time_valid = 1

            if (
                values["travel_time"] > EXTREME_TRAVEL_TIME
                and values["speed"] <= NEAR_ZERO_SPEED
            ):
                travel_time_valid = 0
                reasons["extreme_travel_time"] += 1

            # --------------------------------------------------
            # 5. Sampling quality
            #
            # Very short sampling windows are retained but marked
            # low-quality rather than silently deleted.
            # --------------------------------------------------
            if values["sampled_seconds"] < 10:
                data_quality = "low_sample"
                quality_counts["low_sample"] += 1
            else:
                data_quality = "normal"
                quality_counts["normal"] += 1

            row["data_quality"] = data_quality
            row["travel_time_valid"] = str(travel_time_valid)

            writer.writerow(row)
            kept += 1

    print()
    print("=" * 70)
    print("TRAFFIC STATE CLEANING COMPLETE")
    print("=" * 70)

    print(f"Input rows        : {total:,}")
    print(f"Rows kept         : {kept:,}")
    print(f"Rows removed      : {removed:,}")

    if total:
        print(f"Retention         : {kept / total * 100:.2f}%")
        print(f"Removed           : {removed / total * 100:.2f}%")

    print()
    print("Removal reasons")
    print("-" * 70)

    for reason, count in reasons.items():
        print(f"{reason:<25}: {count:,}")

    print()
    print("Quality flags")
    print("-" * 70)

    for quality, count in quality_counts.items():
        print(f"{quality:<25}: {count:,}")

    print()
    print(f"Output            : {OUTPUT}")
    print(f"Output size       : {OUTPUT.stat().st_size / (1024 ** 2):.2f} MB")
    print("=" * 70)


if __name__ == "__main__":
    main()