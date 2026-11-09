import subprocess
from pathlib import Path

SUMO = r"C:\Program Files (x86)\Eclipse\Sumo\bin\sumo.exe"

NETWORK = Path("data/raw/sumo_network/guntur_city.net.xml")

print("Checking SUMO...")
print(f"Network: {NETWORK}")

result = subprocess.run(
    [SUMO, "-n", str(NETWORK), "--duration-log.statistics"],
    capture_output=True,
    text=True
)

print(result.stdout)

if result.returncode != 0:
    print("SUMO failed:")
    print(result.stderr)
    raise SystemExit(1)

print("SUMO network smoke test PASSED.")