"""One command for a fresh, reproducible Guntur pipeline run."""
import subprocess,sys
S=['download_guntur_roads.py','clean_guntur_roads.py','generate_baseline_traffic.py','create_guntur_zones.py','create_guntur_events.py','generate_event_traffic.py','build_dynamic_graph.py','build_dynamic_index.py','run_guntur_experiment.py','validate_datasets.py','write_guntur_manifest.py']
for s in S:subprocess.run([sys.executable,str(__file__.replace('build_guntur_dataset.py',s))],check=True)
