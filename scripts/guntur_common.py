"""Shared, deterministic utilities for the Guntur pipeline."""
from __future__ import annotations
import csv, hashlib, json, math, os
from datetime import datetime, timezone
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CONFIG = ROOT / "config" / "guntur.yaml"

def cfg():
    with CONFIG.open(encoding="utf-8") as f: return yaml.safe_load(f)

def ensure_dirs():
    for name in ["raw/guntur_osm", "raw/traffic", "raw/events", "raw/weather", "raw/incidents", "interim", "processed"]:
        (DATA / name).mkdir(parents=True, exist_ok=True)
    (ROOT / "models/artifacts").mkdir(parents=True, exist_ok=True)
    (ROOT / "models/reports").mkdir(parents=True, exist_ok=True)

def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f: return list(csv.DictReader(f))

def write_csv(path, rows, fields):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader(); w.writerows(rows)

def n(v, default=0.0):
    try: return float(v)
    except (TypeError, ValueError): return default

def i(v, default=0): return int(round(n(v, default)))

def haversine_m(lat1, lon1, lat2, lon2):
    r=6371000; p=math.pi/180
    a=math.sin((lat2-lat1)*p/2)**2+math.cos(lat1*p)*math.cos(lat2*p)*math.sin((lon2-lon1)*p/2)**2
    return 2*r*math.asin(math.sqrt(a))

def iso_now(): return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

def checksum(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for chunk in iter(lambda:f.read(1024*1024), b""): h.update(chunk)
    return h.hexdigest()

def write_manifest(entries):
    out=[]
    for dataset_name, path, source, license_name, command, seed in entries:
        rows=max(0, sum(1 for _ in open(path, encoding="utf-8"))-1) if Path(path).exists() else 0
        header=next(csv.reader(open(path, encoding="utf-8")), []) if Path(path).exists() else []
        out.append({"dataset_name":dataset_name,"version":cfg()["version"],"created_at":iso_now(),"source":source,"license":license_name,"row_count":rows,"schema":header,"checksum":checksum(path) if Path(path).exists() else "","generation_command":command,"random_seed":seed})
    with open(DATA/"processed"/"manifest.json", "w", encoding="utf-8") as f: json.dump(out,f,indent=2)

def parse_first_number(value, default=None):
    if value is None or value == "": return default
    if isinstance(value, (list,tuple)): value=value[0] if value else None
    text=str(value).replace("mph","").replace("km/h","").replace("kph","")
    import re
    match=re.search(r"\d+(?:\.\d+)?", text)
    return float(match.group()) if match else default
