from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET


# ============================================================
# PATHS
# ============================================================

SUMO = Path(r"C:\Program Files (x86)\Eclipse\Sumo\bin\sumo.exe")

ROOT = Path(__file__).resolve().parents[1]

NET_FILE = ROOT / "data" / "raw" / "sumo_network" / "guntur_city.net.xml"

ROUTE_DIR = ROOT / "data" / "scenarios" / "baseline"

CONFIG_DIR = ROOT / "data" / "scenarios" / "baseline" / "config" / "generated"

EDGE_DIR = ROOT / "data" / "simulation" / "edge"


# ============================================================
# SCENARIO TIME WINDOWS
# ============================================================

TIME_PERIODS = {
    "morning_peak": (7 * 3600, 10 * 3600),
    "midday": (11 * 3600, 14 * 3600),
    "evening_peak": (17 * 3600, 20 * 3600),
    "night": (21 * 3600, 24 * 3600),
}


# ============================================================
# SCENARIO FILENAME
# ============================================================

SCENARIO_PATTERN = re.compile(
    r"^baseline_"
    r"(low|normal|high)_"
    r"(morning_peak|midday|evening_peak|night)_"
    r"seed(\d+)"
    r"\.validated\.rou\.xml$"
)


# ============================================================
# HELPERS
# ============================================================

def expected_intervals(begin, end, freq=60):
    """Expected number of EdgeData intervals."""
    return (end - begin) // freq


def edge_file_is_complete(edge_file, begin, end):
    """
    Check whether EdgeData exists, is valid XML,
    and contains approximately the expected number
    of time intervals.
    """

    if not edge_file.exists():
        return False

    if edge_file.stat().st_size < 1000:
        return False

    try:
        tree = ET.parse(edge_file)
        root = tree.getroot()

        intervals = root.findall("interval")

        expected = expected_intervals(begin, end)

        # Allow a small tolerance around the expected count.
        if len(intervals) < expected - 2:
            return False

        return True

    except ET.ParseError:
        return False
    except Exception:
        return False


def create_edge_config(scenario):
    """
    Create EdgeData configuration.

    The configuration lives inside:
    data/scenarios/baseline/config/generated/

    Therefore the relative path to:
    data/simulation/edge/
    is ../../../../simulation/edge/
    """

    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    config_file = CONFIG_DIR / f"{scenario}.edgeData.xml"

    edge_output = (
        f"../../../../simulation/edge/{scenario}.edge.xml"
    )

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<additional>
    <edgeData
        id="edge_{scenario}"
        file="{edge_output}"
        freq="60"
        excludeEmpty="true"
        withInternal="false"
        minSamples="1"
        meanData="true"
    />
</additional>
"""

    config_file.write_text(xml, encoding="utf-8")

    return config_file


def run_scenario(route_file):
    match = SCENARIO_PATTERN.match(route_file.name)

    if not match:
        return None

    demand_level = match.group(1)
    time_period = match.group(2)
    seed = match.group(3)

    scenario = (
        f"baseline_{demand_level}_{time_period}_seed{seed}"
    )

    begin, end = TIME_PERIODS[time_period]

    edge_file = EDGE_DIR / f"{scenario}.edge.xml"

    # --------------------------------------------------------
    # Skip already-complete simulations
    # --------------------------------------------------------

    if edge_file_is_complete(edge_file, begin, end):

        print()
        print("=" * 70)
        print(f"SKIP: {scenario}")
        print("Reason: EdgeData already exists and appears complete.")
        print("=" * 70)

        return True

    # --------------------------------------------------------
    # Remove incomplete EdgeData
    # --------------------------------------------------------

    if edge_file.exists():

        print()
        print(f"Removing incomplete EdgeData: {edge_file.name}")

        try:
            edge_file.unlink()
        except Exception as exc:
            print(f"ERROR removing old EdgeData: {exc}")
            return False

    # --------------------------------------------------------
    # Create EdgeData configuration
    # --------------------------------------------------------

    config_file = create_edge_config(scenario)

    # --------------------------------------------------------
    # SUMO command
    # --------------------------------------------------------

    command = [
        str(SUMO),

        "--net-file",
        str(NET_FILE),

        "--route-files",
        str(route_file),

        "--begin",
        str(begin),

        "--end",
        str(end),

        "--additional-files",
        str(config_file),

        "--duration-log.statistics",
    ]

    print()
    print("=" * 70)
    print(f"RUNNING: {scenario}")
    print(f"Demand : {demand_level}")
    print(f"Period : {time_period}")
    print(f"Seed   : {seed}")
    print(f"Time   : {begin} -> {end}")
    print("=" * 70)

    print()
    print("SUMO command:")
    print(" ".join(command))
    print()

    # --------------------------------------------------------
    # Run SUMO
    # --------------------------------------------------------

    try:

        result = subprocess.run(
            command,
            cwd=ROOT,
            check=False,
        )

    except Exception as exc:

        print()
        print(f"FAILED TO START SUMO: {exc}")
        return False

    # --------------------------------------------------------
    # Check SUMO exit status
    # --------------------------------------------------------

    if result.returncode != 0:

        print()
        print("=" * 70)
        print(f"FAILED: {scenario}")
        print(f"SUMO return code: {result.returncode}")
        print("=" * 70)

        return False

    # --------------------------------------------------------
    # Validate EdgeData
    # --------------------------------------------------------

    if not edge_file_is_complete(edge_file, begin, end):

        print()
        print("=" * 70)
        print(f"FAILED: {scenario}")
        print("SUMO exited successfully, but EdgeData is incomplete.")
        print("=" * 70)

        return False

    print()
    print("=" * 70)
    print(f"SUCCESS: {scenario}")
    print(
        f"EdgeData size: "
        f"{edge_file.stat().st_size:,} bytes"
    )
    print("=" * 70)

    return True


# ============================================================
# MAIN
# ============================================================

def main():

    EDGE_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    if not SUMO.exists():

        print(f"ERROR: SUMO executable not found:")
        print(SUMO)
        return

    if not NET_FILE.exists():

        print(f"ERROR: Network not found:")
        print(NET_FILE)
        return

    route_files = sorted(
        ROUTE_DIR.glob("baseline_*.validated.rou.xml")
    )

    # Only accept original validated routes.
    route_files = [
        f for f in route_files
        if SCENARIO_PATTERN.match(f.name)
    ]

    print("=" * 70)
    print("RouteCast Baseline Simulation Runner")
    print("=" * 70)

    print(f"Network: {NET_FILE}")
    print(f"Route files: {len(route_files)}")
    print()

    if len(route_files) != 36:

        print(
            f"WARNING: Expected 36 scenarios, "
            f"found {len(route_files)}."
        )

    successful = 0
    failed = 0
    skipped = 0

    # --------------------------------------------------------
    # Run ONE scenario at a time
    # --------------------------------------------------------

    for index, route_file in enumerate(route_files, start=1):

        print()
        print(
            f"[{index}/{len(route_files)}] "
            f"{route_file.name}"
        )

        before = EDGE_DIR / (
            route_file.name
            .replace(".validated.rou.xml", ".edge.xml")
        )

        was_complete = False

        match = SCENARIO_PATTERN.match(route_file.name)

        if match:

            period = match.group(2)
            begin, end = TIME_PERIODS[period]

            was_complete = edge_file_is_complete(
                before,
                begin,
                end,
            )

        result = run_scenario(route_file)

        if result is True:

            if was_complete:
                skipped += 1
            else:
                successful += 1

        else:

            failed += 1

    # ========================================================
    # FINAL SUMMARY
    # ========================================================

    edge_files = list(
        EDGE_DIR.glob("baseline_*.edge.xml")
    )

    nonempty = [
        f for f in edge_files
        if f.stat().st_size > 1000
    ]

    print()
    print()
    print("=" * 70)
    print("FINAL SUMMARY")
    print("=" * 70)

    print(f"Total scenarios : {len(route_files)}")
    print(f"New successful  : {successful}")
    print(f"Skipped         : {skipped}")
    print(f"Failed          : {failed}")
    print(f"EdgeData files  : {len(edge_files)}")
    print(f"Non-empty       : {len(nonempty)}")

    if failed == 0 and len(route_files) == 36:

        print()
        print("ALL BASELINE SIMULATIONS COMPLETED SUCCESSFULLY.")

    else:

        print()
        print("SOME BASELINE SIMULATIONS STILL NEED ATTENTION.")


if __name__ == "__main__":
    main()