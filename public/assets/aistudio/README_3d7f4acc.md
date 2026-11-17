# SafePath – Personal Safety Route Planner

A Python experiential-learning MVP that compares two **walking** routes:

1. **Shortest route** – minimises distance.
2. **Safety-prioritised route** – minimises distance adjusted by a transparent score based on mapped street lighting, sidewalk information, nearby public-activity proxies, emergency-support facilities and road context.

The app uses OpenStreetMap data through OSMnx, NetworkX for pathfinding, and Streamlit + Folium for the interface and map.

## 1. Requirements

- Python 3.10 or newer (Python 3.11 is a good choice for a student project).
- Internet connection (the app downloads map data when a route is searched).
- Windows, macOS or Linux.

## 2. Run on Windows

Open Command Prompt in this folder and run:

```bat
py -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m streamlit run app.py
```

If PowerShell blocks activation, use Command Prompt or run the Python/Streamlit command from an activated environment created through your IDE.

## 3. Run on macOS/Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m streamlit run app.py
```

Streamlit opens the application in a browser. Enter a start and destination with the city name, then select **Find and compare routes**.

## 4. Example input

- Starting point: `Jain University, Bengaluru`
- Destination: `Jayanagar Metro Station, Bengaluru`

The geocoder may return a different match if the place name is ambiguous. Check the map markers before interpreting the comparison.

## 5. Scoring model

| Factor | Weight | Interpretation |
|---|---:|---|
| Street lighting | 30% | Mapped `lit=yes` scores higher than `lit=no`; missing data is neutral/unknown. |
| Sidewalk information | 25% | Mapped sidewalk/pedestrian-way tags. |
| Public activity proxy | 20% | Proximity to mapped shops, public places and transit stops. This is **not live crowd density**. |
| Emergency-support proximity | 15% | Proximity to mapped police, fire and medical locations. This does **not** verify availability. |
| Road context | 10% | A weak context score based on the street type. |

For each street segment:

`adjusted_cost = segment_length × (1 + safety_preference × (100 − segment_score) / 100)`

The safety-prioritised route is the path with the lowest total adjusted cost. The score is an explainable heuristic, not a scientifically validated personal-risk measure.

## 6. Important limitations

- OpenStreetMap coverage varies by neighbourhood. Missing lighting/sidewalk tags do not prove that a street is unlit or lacks a footpath.
- The application does not currently access real-time crowd levels, live traffic, verified police availability, emergency call services, or a validated incident dataset.
- A mapped police station, hospital or public place may be closed, unavailable or inaccurately mapped.
- The route comparison is not a safety guarantee. Users should use local judgement and trusted, official information.
- OSM public services may temporarily rate-limit requests. Retry later if a query fails.
- The app is a working academic prototype, not a certified navigation or emergency-response product.

## 7. Python concepts demonstrated

- **Functions:** geocoding, feature processing, scoring, route calculation and map creation.
- **Lists:** route node sequences, map coordinates, POI point collections.
- **Dictionaries:** OSM tags, score weights, route metrics and Streamlit session results.
- **Conditional statements:** missing-data handling, score calculation and error handling.
- **File handling:** `requirements.txt` and this README; a natural extension is exporting route reports to CSV/JSON.
- **Graph algorithms:** NetworkX weighted shortest path / Dijkstra-style routing.

## Data attribution

Map data © OpenStreetMap contributors. OSM data is available under the Open Database License (ODbL). Follow the OpenStreetMap attribution and usage policies when presenting or deploying the project.
