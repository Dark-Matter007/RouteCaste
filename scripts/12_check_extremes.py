import csv

FILE = "data/processed/traffic_state.csv"

thresholds = {
    "density": 100,
    "occupancy": 100,
    "speed_relative": 1.0,
    "travel_time": 300,
    "waiting_time": 300,
    "time_loss": 300,
}

counts = {key: 0 for key in thresholds}

examples = {key: [] for key in thresholds}

total = 0

with open(FILE, "r", encoding="utf-8", newline="") as f:

    reader = csv.DictReader(f)

    for row in reader:

        total += 1

        for column, threshold in thresholds.items():

            value = float(row[column])

            if value > threshold:

                counts[column] += 1

                if len(examples[column]) < 5:
                    examples[column].append(
                        (
                            row["scenario_id"],
                            row["interval_begin"],
                            row["edge_id"],
                            value,
                        )
                    )

print()
print("=" * 90)
print("EXTREME VALUE ANALYSIS")
print("=" * 90)

print(f"Total rows: {total:,}")
print()

for column in thresholds:

    count = counts[column]
    percentage = (count / total) * 100

    print(
        f"{column:<20}"
        f" > {thresholds[column]:>7}"
        f" : {count:>10,}"
        f" ({percentage:>8.4f}%)"
    )

    if examples[column]:

        print("  Examples:")

        for scenario, interval, edge, value in examples[column]:

            print(
                f"    {scenario} | "
                f"t={interval} | "
                f"edge={edge} | "
                f"value={value}"
            )

    print()

print("=" * 90)
print("RESULT: EXTREME VALUE ANALYSIS COMPLETE")
print("=" * 90)