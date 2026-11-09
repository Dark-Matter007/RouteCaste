# Guntur data methodology

RouteCast's Guntur pipeline has four connected datasets. `guntur_nodes.csv` and `guntur_roads.csv` are sourced geographical data; `traffic_baseline.csv`, `event_traffic.csv`, and BPR weights are modeled, not measured sensor observations.

## Geography and provenance

The road graph was retrieved from OpenStreetMap on the timestamp in `data/raw/guntur_osm/retrieval_metadata.json`, through OSMnx with `network_type=drive` and simplification enabled. The default is a reproducible 7 km central-Guntur radius at the configured coordinate, selected because the Nominatim administrative result covers a much larger region. The GraphML source file is intentionally ignored as a reproducible raw download; the derived node/road tables retain OSM way IDs, directed endpoints, and sourced WKT geometry. OpenStreetMap data is © OpenStreetMap contributors and available under the [ODbL](https://www.openstreetmap.org/copyright); redistribution or public use of substantial extracted data must preserve attribution and meet ODbL share-alike/database obligations.

`lanes` and `max_speed_kph` are OSM values where tags exist; `lanes_source` and `speed_source` label road-class imputations otherwise. Capacity is always a modeled lane-count × road-class capacity assumption. The configurable defaults are 1,800/1,700/1,500/1,300/1,000/700/500 vph per lane for motorway/trunk/primary/secondary/tertiary/residential/service respectively.

## Modeled traffic and events

The baseline is explicitly labeled **“Modeled baseline traffic — not measured road-sensor data.”** It uses deterministic road-class demand, weekday/weekend profiles, morning/evening Gaussian peaks, a midday component, a fixed seed, and a monotone speed–volume relationship. It contains representative Friday and Saturday periods (morning, midday, evening, and night) rather than claiming a continuous sensor archive.

Events use documented Guntur venue names. The event script queries Nominatim at generation time and only calls coordinates verified when that lookup succeeds; failures use a real OSM road node and set `is_synthetic_scenario=true`. The central concert is deliberately a synthetic, graph-grounded demonstration. Zone shares, modal split (car 30%, bike 40%, bus 15%, auto 10%, walk 5%), and occupancies (2.2, 1.3, 35, 2.0) are versioned in `config/guntur.yaml` and are modeled assumptions.

For each zone/event direction, attendance × zone share is converted to motorized vehicle batches; each batch follows repository-owned Dijkstra on the directed OSM graph. Two early/late batches represent arrivals/departures and conserve the batch demand. Unreachable zones are printed and excluded rather than silently assigned.

`dynamic_roads.csv` combines baseline and assigned vehicles, with `V=baseline+event` and `T=T0*(1+0.15*(min(V/C,4))^4)`. The V/C cap of 4 avoids unbounded numerical values and is declared in configuration. Use measured speeds, counts, travel times, incident feeds, survey-based mode share, and venue attendance/parking counts to calibrate or replace these assumptions.

## Limitations and ethics

This is a planning prototype, not a live traffic product. It must not be used for emergency dispatch, enforcement, or claims about congestion experienced by people. Coverage, map freshness, OSM tags, event venue matching, model transfer, and demographic effects can be biased. Future observed data should be consented/aggregated, spatially and temporally representative, and accompanied by calibration, uncertainty, drift, and fairness checks.
