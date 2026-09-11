# Guntur pipeline runbook

From PowerShell:

```powershell
python -m pip install "osmnx>=1.9,<2.1" "scikit-learn>=1.4,<1.7" "PyYAML>=6,<7"
python scripts/build_guntur_dataset.py
python scripts/train_traffic_model.py
python -m unittest discover -s tests -v
pnpm install
pnpm build
```

The first command that contacts OSM is `python scripts/download_guntur_roads.py`. It uses the configurable query, writes retrieval metadata, and may need network permission. The raw GraphML is deliberately ignored; rerun that command to refresh it. To use the new app panel, run `pnpm dev`, open RouteCast, and use **Guntur event routing**; its label identifies modeled traffic and it leaves the original synthetic event mode available.
