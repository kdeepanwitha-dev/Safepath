"""SafePath – Personal Safety Route Planner (Flask Backend)

A Python-based multi-objective personal safety route planner for Bengaluru.
Demonstrates Python functions, dictionaries, lists, conditional statements,
graph pathfinding, sensitivity & robustness analysis, and JSON file handling.

Run locally with Flask:
    pip install -r requirements.txt
    python app.py
"""

from __future__ import annotations

import datetime
import json
import math
import os
import random
import re
import sqlite3
import sys
import urllib.parse
import urllib.request
from typing import Any

try:
    from flask import Flask, Response, jsonify, render_template, request
    HAS_FLASK = True
except ImportError:
    HAS_FLASK = False


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPORTS_DIR = os.path.join(BASE_DIR, "saved_reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

ROAD_GEOM_FILE = os.path.join(BASE_DIR, "road_geometries.json")
ROAD_GEOMETRIES: dict[str, list[list[float]]] = {}
if os.path.exists(ROAD_GEOM_FILE):
    try:
        with open(ROAD_GEOM_FILE, "r", encoding="utf-8") as _fh:
            ROAD_GEOMETRIES = json.load(_fh)
    except Exception:
        ROAD_GEOMETRIES = {}


# -----------------------------------------------------------------------------
# 1. Predefined Bengaluru City Network (12 Locations, 26 Multi-Segment Roads)
# -----------------------------------------------------------------------------
LOCATIONS: list[dict[str, Any]] = [
    {"id": "malleshwaram", "name": "Malleshwaram Circle", "area": "North-West", "lat": 13.0031, "lng": 77.5643},
    {"id": "majestic", "name": "Kempegowda Bus Stn (Majestic)", "area": "Central Transit", "lat": 12.9776, "lng": 77.5713},
    {"id": "vidhana", "name": "Vidhana Soudha / Cubbon Park", "area": "Civic Core", "lat": 12.9797, "lng": 77.5908},
    {"id": "mg_road", "name": "MG Road Metro Station", "area": "CBD / Commercial", "lat": 12.9756, "lng": 77.6066},
    {"id": "ulsoor", "name": "Ulsoor Lake / Halasuru", "area": "East-Central", "lat": 12.9817, "lng": 77.6285},
    {"id": "indiranagar", "name": "Indiranagar 100ft Road", "area": "East Commercial", "lat": 12.9719, "lng": 77.6412},
    {"id": "vv_puram", "name": "VV Puram / Jain University", "area": "South-West Core", "lat": 12.9492, "lng": 77.5772},
    {"id": "lalbagh", "name": "Lalbagh Botanical Garden", "area": "South Park", "lat": 12.9507, "lng": 77.5848},
    {"id": "shanthinagar", "name": "Shanthinagar TTMC", "area": "Central-South", "lat": 12.9565, "lng": 77.5968},
    {"id": "koramangala", "name": "Koramangala 5th Block", "area": "South-East Hub", "lat": 12.9352, "lng": 77.6245},
    {"id": "jayanagar", "name": "Jayanagar 4th Block", "area": "South Residential", "lat": 12.9255, "lng": 77.5838},
    {"id": "silk_board", "name": "Silk Board Junction", "area": "Outer Ring South", "lat": 12.9177, "lng": 77.6238},
]

LOCATION_MAP: dict[str, dict[str, Any]] = {loc["id"]: loc for loc in LOCATIONS}

EMERGENCY_POIS: list[dict[str, Any]] = [
    # Bengaluru Police Stations
    {"name": "Upparpet Police Station", "type": "police", "lat": 12.9762, "lng": 77.5754, "city": "Bengaluru"},
    {"name": "Cubbon Park Police Station", "type": "police", "lat": 12.9781, "lng": 77.5992, "city": "Bengaluru"},
    {"name": "Halasuru Police Station", "type": "police", "lat": 12.9802, "lng": 77.6224, "city": "Bengaluru"},
    {"name": "Indiranagar Police Station", "type": "police", "lat": 12.9739, "lng": 77.6388, "city": "Bengaluru"},
    {"name": "Koramangala Police Station", "type": "police", "lat": 12.9369, "lng": 77.6212, "city": "Bengaluru"},
    {"name": "Jayanagar Police Station", "type": "police", "lat": 12.9288, "lng": 77.5821, "city": "Bengaluru"},
    {"name": "Malleshwaram Police Station", "type": "police", "lat": 13.0046, "lng": 77.5682, "city": "Bengaluru"},
    {"name": "Whitefield Police Station", "type": "police", "lat": 12.9698, "lng": 77.7499, "city": "Bengaluru"},
    {"name": "HSR Layout Police Station", "type": "police", "lat": 12.9116, "lng": 77.6412, "city": "Bengaluru"},
    {"name": "Electronic City Police Station", "type": "police", "lat": 12.8452, "lng": 77.6602, "city": "Bengaluru"},
    {"name": "Yelahanka Police Station", "type": "police", "lat": 13.1007, "lng": 77.5963, "city": "Bengaluru"},
    {"name": "Marathahalli Police Station", "type": "police", "lat": 12.9562, "lng": 77.7019, "city": "Bengaluru"},
    {"name": "Banashankari Police Station", "type": "police", "lat": 12.9255, "lng": 77.5468, "city": "Bengaluru"},
    {"name": "Hebbal Police Station", "type": "police", "lat": 13.0358, "lng": 77.5970, "city": "Bengaluru"},
    {"name": "Sadashivanagar Police Station", "type": "police", "lat": 13.0068, "lng": 77.5813, "city": "Bengaluru"},
    # Major Indian City Police Stations
    {"name": "Connaught Place Police Station", "type": "police", "lat": 28.6328, "lng": 77.2197, "city": "New Delhi"},
    {"name": "Colaba Police Station", "type": "police", "lat": 18.9151, "lng": 72.8258, "city": "Mumbai"},
    {"name": "Banjara Hills Police Station", "type": "police", "lat": 17.4156, "lng": 78.4347, "city": "Hyderabad"},
    {"name": "T Nagar Police Station", "type": "police", "lat": 13.0418, "lng": 80.2341, "city": "Chennai"},
    {"name": "Devaraja Police Station", "type": "police", "lat": 12.3114, "lng": 76.6529, "city": "Mysuru"},
    {"name": "Shivajinagar Police Station", "type": "police", "lat": 18.5308, "lng": 73.8475, "city": "Pune"},
    {"name": "Park Street Police Station", "type": "police", "lat": 22.5513, "lng": 88.3524, "city": "Kolkata"},
    {"name": "Calangute Police Station", "type": "police", "lat": 15.5439, "lng": 73.7681, "city": "Goa"},
    {"name": "MI Road Kotwali Police Station", "type": "police", "lat": 26.9182, "lng": 75.8124, "city": "Jaipur"},
    {"name": "Ernakulam Central Police Station", "type": "police", "lat": 9.9816, "lng": 76.2830, "city": "Kochi"},
    # Bengaluru Hospitals
    {"name": "Victoria Hospital & Trauma Care", "type": "hospital", "lat": 12.9635, "lng": 77.5742, "city": "Bengaluru"},
    {"name": "St. Martha's Hospital", "type": "hospital", "lat": 12.9698, "lng": 77.5859, "city": "Bengaluru"},
    {"name": "St. Philomena's Hospital", "type": "hospital", "lat": 12.9602, "lng": 77.6061, "city": "Bengaluru"},
    {"name": "St. John's Medical Hospital", "type": "hospital", "lat": 12.9296, "lng": 77.6208, "city": "Bengaluru"},
    {"name": "Jayadeva Institute of Cardiology", "type": "hospital", "lat": 12.9178, "lng": 77.5999, "city": "Bengaluru"},
    {"name": "Manipal Hospital HAL", "type": "hospital", "lat": 12.9589, "lng": 77.6486, "city": "Bengaluru"},
    {"name": "Apollo Hospital Bannerghatta", "type": "hospital", "lat": 12.8959, "lng": 77.5985, "city": "Bengaluru"},
    {"name": "Sakra World Hospital Bellandur", "type": "hospital", "lat": 12.9279, "lng": 77.6844, "city": "Bengaluru"},
]

POPULAR_PRESETS: list[dict[str, str]] = [
    {"label": "Majestic → Koramangala", "from": "majestic", "to": "koramangala"},
    {"label": "VV Puram → Indiranagar", "from": "vv_puram", "to": "indiranagar"},
    {"label": "Malleshwaram → Jayanagar", "from": "malleshwaram", "to": "jayanagar"},
    {"label": "MG Road → Silk Board", "from": "mg_road", "to": "silk_board"},
    {"label": "Vidhana Soudha → Koramangala", "from": "vidhana", "to": "koramangala"},
    {"label": "Lalbagh → Indiranagar", "from": "lalbagh", "to": "indiranagar"},
]

DEFAULT_FACTOR_WEIGHTS: dict[str, float] = {
    "lighting": 0.25,
    "crowd": 0.15,
    "cctv": 0.15,
    "emergency": 0.15,
    "isolation_inv": 0.15,
    "risk_inv": 0.15,
}

TRAVEL_MODE_CONFIG: dict[str, dict[str, Any]] = {
    "walk": {
        "label": "Walk",
        "speed_kmh": 4.8,
        "adaptive_boost": 0.08,
    },
    "bike": {
        "label": "Bike / Two-Wheeler",
        "time_multiplier": 0.78,
        "adaptive_boost": 0.04,
    },
    "car": {
        "label": "Car / Cab",
        "time_multiplier": 1.0,
        "adaptive_boost": 0.0,
    },
}

FACTOR_LABELS: dict[str, str] = {
    "lighting": "Street Lighting",
    "crowd": "Pedestrian / Crowd Density",
    "cctv": "CCTV Coverage",
    "emergency": "Police & Emergency Access",
    "isolation_inv": "Low Road Isolation",
    "risk_inv": "Low Incident Risk",
}

# Each edge defines 0–10 factor scores + distance (km), time (min), and curved GPS waypoints
BASE_EDGES: list[dict[str, Any]] = [
    {"id": "e1", "from": "malleshwaram", "to": "majestic", "road": "Sampige Main Rd", "dist": 2.9, "time": 11, "lighting": 8.4, "crowd": 8.2, "cctv": 7.8, "emergency": 7.6, "isolation": 2.0, "incident_risk": 2.2, "night_light_drop": 0.5, "night_crowd_drop": 1.5, "waypoints": [[12.9905, 77.5698]]},
    {"id": "e2", "from": "malleshwaram", "to": "vidhana", "road": "Sankey Tank Boulevard", "dist": 3.4, "time": 13, "lighting": 6.2, "crowd": 5.4, "cctv": 5.5, "emergency": 6.5, "isolation": 4.5, "incident_risk": 3.4, "night_light_drop": 1.6, "night_crowd_drop": 2.4, "waypoints": [[12.9958, 77.5798]]},
    {"id": "e3", "from": "malleshwaram", "to": "ulsoor", "road": "Palace Perimeter Bypass", "dist": 6.8, "time": 18, "lighting": 3.8, "crowd": 2.8, "cctv": 3.0, "emergency": 3.8, "isolation": 7.5, "incident_risk": 6.8, "night_light_drop": 1.8, "night_crowd_drop": 1.6, "waypoints": [[13.0010, 77.5960], [12.9922, 77.6145]]},
    {"id": "e4", "from": "majestic", "to": "vidhana", "road": "KG Rd – Police HQ Ave", "dist": 2.4, "time": 10, "lighting": 9.1, "crowd": 8.5, "cctv": 9.2, "emergency": 9.5, "isolation": 1.5, "incident_risk": 1.6, "night_light_drop": 0.3, "night_crowd_drop": 1.2, "waypoints": [[12.9765, 77.5812]]},
    {"id": "e5", "from": "majestic", "to": "vv_puram", "road": "Chamarajpet Market Link", "dist": 3.2, "time": 12, "lighting": 6.4, "crowd": 7.2, "cctv": 5.2, "emergency": 6.4, "isolation": 3.8, "incident_risk": 4.2, "night_light_drop": 1.5, "night_crowd_drop": 2.6, "waypoints": [[12.9632, 77.5728]]},
    {"id": "e6", "from": "majestic", "to": "shanthinagar", "road": "Goods Shed Underpass Shortcut", "dist": 3.6, "time": 10, "lighting": 2.6, "crowd": 3.0, "cctv": 2.0, "emergency": 4.0, "isolation": 8.2, "incident_risk": 7.8, "night_light_drop": 1.4, "night_crowd_drop": 1.8, "waypoints": [[12.9665, 77.5825]]},
    {"id": "e7", "from": "vidhana", "to": "mg_road", "road": "Kasturba – MG Metro Rd", "dist": 2.0, "time": 9, "lighting": 9.4, "crowd": 8.9, "cctv": 9.5, "emergency": 9.2, "isolation": 1.2, "incident_risk": 1.4, "night_light_drop": 0.2, "night_crowd_drop": 1.0, "waypoints": [[12.9768, 77.5992]]},
    {"id": "e8", "from": "vidhana", "to": "shanthinagar", "road": "Richmond Circle Connector", "dist": 2.8, "time": 11, "lighting": 6.8, "crowd": 6.2, "cctv": 6.4, "emergency": 7.0, "isolation": 3.6, "incident_risk": 3.5, "night_light_drop": 1.0, "night_crowd_drop": 1.8, "waypoints": [[12.9668, 77.5955]]},
    {"id": "e9", "from": "vidhana", "to": "lalbagh", "road": "KH Rd Hospital Corridor", "dist": 3.4, "time": 13, "lighting": 7.5, "crowd": 6.8, "cctv": 6.9, "emergency": 8.8, "isolation": 2.8, "incident_risk": 2.6, "night_light_drop": 0.8, "night_crowd_drop": 1.8, "waypoints": [[12.9652, 77.5872]]},
    {"id": "e10", "from": "mg_road", "to": "ulsoor", "road": "Trinity – Dickenson Rd", "dist": 2.5, "time": 10, "lighting": 8.9, "crowd": 8.4, "cctv": 8.6, "emergency": 8.2, "isolation": 1.8, "incident_risk": 2.0, "night_light_drop": 0.4, "night_crowd_drop": 1.3, "waypoints": [[12.9772, 77.6195]]},
    {"id": "e11", "from": "mg_road", "to": "shanthinagar", "road": "Brigade – Langford Rd", "dist": 2.4, "time": 11, "lighting": 8.7, "crowd": 8.3, "cctv": 8.5, "emergency": 7.9, "isolation": 2.0, "incident_risk": 2.3, "night_light_drop": 0.4, "night_crowd_drop": 1.2, "waypoints": [[12.9658, 77.6032]]},
    {"id": "e12", "from": "mg_road", "to": "koramangala", "road": "Residency – Ejipura Arterial", "dist": 5.0, "time": 18, "lighting": 7.5, "crowd": 7.3, "cctv": 7.0, "emergency": 7.0, "isolation": 3.2, "incident_risk": 3.4, "night_light_drop": 0.7, "night_crowd_drop": 1.5, "waypoints": [[12.9612, 77.6148], [12.9462, 77.6215]]},
    {"id": "e13", "from": "ulsoor", "to": "indiranagar", "road": "CMH Rd Metro Boulevard", "dist": 2.1, "time": 9, "lighting": 9.2, "crowd": 9.0, "cctv": 8.8, "emergency": 8.1, "isolation": 1.5, "incident_risk": 1.8, "night_light_drop": 0.3, "night_crowd_drop": 1.1, "waypoints": [[12.9786, 77.6358]]},
    {"id": "e14", "from": "ulsoor", "to": "koramangala", "road": "Domlur Service Flyover Lane", "dist": 4.9, "time": 14, "lighting": 3.4, "crowd": 2.5, "cctv": 2.6, "emergency": 4.0, "isolation": 7.8, "incident_risk": 7.0, "night_light_drop": 1.6, "night_crowd_drop": 1.5, "waypoints": [[12.9602, 77.6335], [12.9448, 77.6305]]},
    {"id": "e15", "from": "indiranagar", "to": "koramangala", "road": "100ft Rd – Inner Ring Commercial", "dist": 4.6, "time": 17, "lighting": 8.9, "crowd": 8.7, "cctv": 8.4, "emergency": 7.8, "isolation": 1.8, "incident_risk": 2.2, "night_light_drop": 0.4, "night_crowd_drop": 1.2, "waypoints": [[12.9575, 77.6410], [12.9432, 77.6328]]},
    {"id": "e16", "from": "indiranagar", "to": "silk_board", "road": "ORR Service Bypass", "dist": 6.8, "time": 20, "lighting": 3.6, "crowd": 2.2, "cctv": 2.8, "emergency": 3.5, "isolation": 8.4, "incident_risk": 7.5, "night_light_drop": 1.8, "night_crowd_drop": 1.4, "waypoints": [[12.9502, 77.6552], [12.9278, 77.6425]]},
    {"id": "e17", "from": "vv_puram", "to": "lalbagh", "road": "KR Rd – Minerva Circle", "dist": 1.4, "time": 7, "lighting": 7.6, "crowd": 7.8, "cctv": 6.8, "emergency": 7.4, "isolation": 2.6, "incident_risk": 2.8, "night_light_drop": 0.8, "night_crowd_drop": 2.0, "waypoints": [[12.9498, 77.5811]]},
    {"id": "e18", "from": "vv_puram", "to": "jayanagar", "road": "Basavanagudi – South End Rd", "dist": 2.9, "time": 12, "lighting": 8.2, "crowd": 7.4, "cctv": 7.2, "emergency": 7.9, "isolation": 2.2, "incident_risk": 2.1, "night_light_drop": 0.6, "night_crowd_drop": 1.7, "waypoints": [[12.9368, 77.5792]]},
    {"id": "e19", "from": "lalbagh", "to": "shanthinagar", "road": "Lalbagh East Park Wall Lane", "dist": 1.9, "time": 8, "lighting": 3.1, "crowd": 2.8, "cctv": 2.4, "emergency": 4.6, "isolation": 7.8, "incident_risk": 6.8, "night_light_drop": 1.8, "night_crowd_drop": 1.8, "waypoints": [[12.9522, 77.5918]]},
    {"id": "e20", "from": "lalbagh", "to": "jayanagar", "road": "Ashoka Pillar – 11th Main", "dist": 2.8, "time": 11, "lighting": 8.8, "crowd": 8.5, "cctv": 8.0, "emergency": 8.2, "isolation": 1.6, "incident_risk": 1.8, "night_light_drop": 0.4, "night_crowd_drop": 1.4, "waypoints": [[12.9388, 77.5844]]},
    {"id": "e21", "from": "lalbagh", "to": "koramangala", "road": "Dairy Circle Industrial Cut", "dist": 4.6, "time": 13, "lighting": 2.8, "crowd": 2.5, "cctv": 2.1, "emergency": 4.4, "isolation": 8.2, "incident_risk": 7.4, "night_light_drop": 1.5, "night_crowd_drop": 1.5, "waypoints": [[12.9412, 77.6032]]},
    {"id": "e22", "from": "shanthinagar", "to": "koramangala", "road": "Adugodi Crosslane Shortcut", "dist": 3.8, "time": 11, "lighting": 5.3, "crowd": 5.6, "cctv": 4.6, "emergency": 5.2, "isolation": 4.6, "incident_risk": 4.9, "night_light_drop": 2.3, "night_crowd_drop": 2.6, "waypoints": [[12.9445, 77.6110]]},
    {"id": "e23", "from": "jayanagar", "to": "koramangala", "road": "BTM – Bannerghatta Main Rd", "dist": 4.8, "time": 17, "lighting": 8.2, "crowd": 8.0, "cctv": 7.7, "emergency": 8.5, "isolation": 2.2, "incident_risk": 2.5, "night_light_drop": 0.5, "night_crowd_drop": 1.4, "waypoints": [[12.9225, 77.6042]]},
    {"id": "e24", "from": "jayanagar", "to": "silk_board", "road": "Jayadeva Hospital – BTM Rd", "dist": 4.6, "time": 17, "lighting": 8.5, "crowd": 8.3, "cctv": 8.1, "emergency": 9.0, "isolation": 2.0, "incident_risk": 2.3, "night_light_drop": 0.4, "night_crowd_drop": 1.3, "waypoints": [[12.9178, 77.6012]]},
    {"id": "e25", "from": "koramangala", "to": "silk_board", "road": "Hosur Rd – Madivala Hub", "dist": 2.2, "time": 10, "lighting": 7.2, "crowd": 8.4, "cctv": 7.0, "emergency": 7.5, "isolation": 2.6, "incident_risk": 4.1, "night_light_drop": 0.6, "night_crowd_drop": 1.6, "waypoints": [[12.9265, 77.6215]]},
    {"id": "e26", "from": "vv_puram", "to": "shanthinagar", "road": "Wilson Garden Alleyway", "dist": 2.6, "time": 10, "lighting": 5.5, "crowd": 4.9, "cctv": 4.2, "emergency": 5.6, "isolation": 5.1, "incident_risk": 4.7, "night_light_drop": 1.6, "night_crowd_drop": 2.0, "waypoints": [[12.9515, 77.5882]]},
]


# -----------------------------------------------------------------------------
# 1B. Pan-Bengaluru & Pan-India Places Registry (Areas, Famous Places, Shops & Food)
# -----------------------------------------------------------------------------
EXTRA_PLACES: list[dict[str, Any]] = [
    # Bengaluru Neighborhoods & Suburbs
    {"id": "blr_whitefield", "name": "Whitefield Main / Hope Farm", "area": "Whitefield", "city": "Bengaluru", "category": "hub", "lat": 12.9698, "lng": 77.7500, "keywords": "itpl east suburb bangalore"},
    {"id": "blr_ecity", "name": "Electronic City Phase 1", "area": "Electronic City", "city": "Bengaluru", "category": "tech", "lat": 12.8452, "lng": 77.6602, "keywords": "infosys tech park south bangalore"},
    {"id": "blr_hsr", "name": "HSR Layout 27th Main", "area": "HSR Layout", "city": "Bengaluru", "category": "hub", "lat": 12.9121, "lng": 77.6446, "keywords": "startup residential south east"},
    {"id": "blr_marathahalli", "name": "Marathahalli Bridge", "area": "Marathahalli", "city": "Bengaluru", "category": "hub", "lat": 12.9591, "lng": 77.6974, "keywords": "orr east transit market"},
    {"id": "blr_bellandur", "name": "Bellandur / Ecospace", "area": "Bellandur", "city": "Bengaluru", "category": "tech", "lat": 12.9279, "lng": 77.6762, "keywords": "rmz ecospace orr tech park"},
    {"id": "blr_btm", "name": "BTM Layout 2nd Stage", "area": "BTM Layout", "city": "Bengaluru", "category": "hub", "lat": 12.9166, "lng": 77.6101, "keywords": "south bangalore udupi garden"},
    {"id": "blr_jpnagar", "name": "JP Nagar 3rd Phase", "area": "JP Nagar", "city": "Bengaluru", "category": "hub", "lat": 12.9063, "lng": 77.5857, "keywords": "south residential rangashankara"},
    {"id": "blr_bsk", "name": "Banashankari TTMC", "area": "Banashankari", "city": "Bengaluru", "category": "transit", "lat": 12.9255, "lng": 77.5468, "keywords": "temple bus stand metro south"},
    {"id": "blr_rajajinagar", "name": "Rajajinagar 1st Block", "area": "Rajajinagar", "city": "Bengaluru", "category": "hub", "lat": 12.9982, "lng": 77.5530, "keywords": "west bangalore metro"},
    {"id": "blr_vijayanagar", "name": "Vijayanagar Metro Hub", "area": "Vijayanagar", "city": "Bengaluru", "category": "hub", "lat": 12.9719, "lng": 77.5332, "keywords": "west metro food street"},
    {"id": "blr_yeshwanthpur", "name": "Yeshwanthpur Railway Junction", "area": "Yeshwanthpur", "city": "Bengaluru", "category": "transit", "lat": 13.0250, "lng": 77.5504, "keywords": "train station metro north west"},
    {"id": "blr_yelahanka", "name": "Yelahanka New Town", "area": "Yelahanka", "city": "Bengaluru", "category": "hub", "lat": 13.1007, "lng": 77.5963, "keywords": "north airport road"},
    {"id": "blr_hebbal", "name": "Hebbal Flyover & Esteem Mall", "area": "Hebbal", "city": "Bengaluru", "category": "transit", "lat": 13.0358, "lng": 77.5970, "keywords": "airport highway north"},
    {"id": "blr_sarjapur", "name": "Sarjapur Road / Wipro Gate", "area": "Sarjapur", "city": "Bengaluru", "category": "tech", "lat": 12.9094, "lng": 77.6845, "keywords": "tech park residential south east"},
    {"id": "blr_kengeri", "name": "Kengeri Metro Terminal", "area": "Kengeri", "city": "Bengaluru", "category": "transit", "lat": 12.9077, "lng": 77.4820, "keywords": "mysore road metro south west"},
    {"id": "blr_krpuram", "name": "KR Puram Hanging Bridge", "area": "KR Puram", "city": "Bengaluru", "category": "transit", "lat": 13.0012, "lng": 77.6766, "keywords": "east railway tin factory"},
    {"id": "blr_domlur", "name": "Domlur Flyover / Embassy GolfLinks", "area": "Domlur", "city": "Bengaluru", "category": "tech", "lat": 12.9610, "lng": 77.6387, "keywords": "egl office tech park"},
    {"id": "blr_shivajinagar", "name": "Shivajinagar Bus Stand & Russell Market", "area": "Shivajinagar", "city": "Bengaluru", "category": "shop", "lat": 12.9857, "lng": 77.6057, "keywords": "market shopping street"},
    {"id": "blr_kalyannagar", "name": "Kalyan Nagar / Kammanahalli", "area": "Kalyan Nagar", "city": "Bengaluru", "category": "food", "lat": 13.0221, "lng": 77.6431, "keywords": "cafes restaurants north east"},
    {"id": "blr_frazer", "name": "Frazer Town / Mosque Road", "area": "Frazer Town", "city": "Bengaluru", "category": "food", "lat": 12.9968, "lng": 77.6130, "keywords": "kebabs food street evening"},
    # Bengaluru Famous Shops, Markets & Malls
    {"id": "blr_commercial_st", "name": "Commercial Street Shopping Hub", "area": "Tasker Town", "city": "Bengaluru", "category": "shop", "lat": 12.9822, "lng": 77.6083, "keywords": "clothes jewelry street shopping famous"},
    {"id": "blr_brigade_rd", "name": "Brigade Road Retail Street", "area": "CBD / MG Road", "city": "Bengaluru", "category": "shop", "lat": 12.9718, "lng": 77.6074, "keywords": "fashion shops bookstores cafes"},
    {"id": "blr_church_st", "name": "Church Street & Blossom Book House", "area": "Shanthala Nagar", "city": "Bengaluru", "category": "shop", "lat": 12.9752, "lng": 77.6045, "keywords": "books restaurants bars pedestrian street"},
    {"id": "blr_chickpet", "name": "Chickpet Wholesale Silk & Saree Market", "area": "Chickpet", "city": "Bengaluru", "category": "shop", "lat": 12.9688, "lng": 77.5750, "keywords": "wholesale sarees shops market"},
    {"id": "blr_kr_market", "name": "KR Market (Krishna Rajendra Flower Market)", "area": "City Market", "city": "Bengaluru", "category": "shop", "lat": 12.9628, "lng": 77.5764, "keywords": "flowers spice wholesale market"},
    {"id": "blr_phoenix", "name": "Phoenix Marketcity Mall", "area": "Mahadevapura / Whitefield", "city": "Bengaluru", "category": "shop", "lat": 12.9957, "lng": 77.6964, "keywords": "shopping mall cinema dining"},
    {"id": "blr_orion", "name": "Orion Mall Brigade Gateway", "area": "Rajajinagar", "city": "Bengaluru", "category": "shop", "lat": 13.0110, "lng": 77.5549, "keywords": "mall cinema shopping lake"},
    {"id": "blr_ubcity", "name": "UB City Luxury Mall", "area": "Vittal Mallya Road", "city": "Bengaluru", "category": "shop", "lat": 12.9716, "lng": 77.5960, "keywords": "luxury shopping fine dining"},
    {"id": "blr_mantri", "name": "Mantri Square Mall", "area": "Malleshwaram", "city": "Bengaluru", "category": "shop", "lat": 12.9916, "lng": 77.5707, "keywords": "shopping mall metro"},
    {"id": "blr_nexus", "name": "Nexus Mall (Forum Koramangala)", "area": "Koramangala", "city": "Bengaluru", "category": "shop", "lat": 12.9345, "lng": 77.6113, "keywords": "forum mall pvr shopping dining"},
    {"id": "blr_garuda", "name": "Garuda Mall", "area": "Magrath Road", "city": "Bengaluru", "category": "shop", "lat": 12.9702, "lng": 77.6099, "keywords": "shopping mall cbd"},
    {"id": "blr_vega", "name": "Vega City Mall", "area": "Bannerghatta Road / BTM", "city": "Bengaluru", "category": "shop", "lat": 12.9078, "lng": 77.6009, "keywords": "shopping mall cinema"},
    {"id": "blr_lulu", "name": "Lulu Mall Bengaluru", "area": "Rajajinagar / Gopalapura", "city": "Bengaluru", "category": "shop", "lat": 12.9806, "lng": 77.5621, "keywords": "hypermarket shopping food court"},
    {"id": "blr_avenue", "name": "Avenue Road Book & Paper Market", "area": "Old Bengaluru", "city": "Bengaluru", "category": "shop", "lat": 12.9707, "lng": 77.5768, "keywords": "textbooks stationery shops"},
    # Bengaluru Famous Food Streets, Restaurants & Cafes
    {"id": "blr_rameshwaram_ind", "name": "The Rameshwaram Cafe (Indiranagar)", "area": "Indiranagar 12th Main", "city": "Bengaluru", "category": "food", "lat": 12.9781, "lng": 77.6406, "keywords": "dosa idli filter coffee ghee podi food"},
    {"id": "blr_rameshwaram_brook", "name": "The Rameshwaram Cafe (Brookefield)", "area": "Brookefield", "city": "Bengaluru", "category": "food", "lat": 12.9669, "lng": 77.7176, "keywords": "dosa idli famous south indian food"},
    {"id": "blr_vidyarthi", "name": "Vidyarthi Bhavan (Gandhi Bazaar)", "area": "Basavanagudi", "city": "Bengaluru", "category": "food", "lat": 12.9450, "lng": 77.5714, "keywords": "masala dosa heritage food restaurant"},
    {"id": "blr_mtr", "name": "MTR (Mavalli Tiffin Rooms)", "area": "Lalbagh Road", "city": "Bengaluru", "category": "food", "lat": 12.9551, "lng": 77.5855, "keywords": "tiffin breakfast rava idli famous food"},
    {"id": "blr_ctr", "name": "CTR Shri Sagar (Benne Masala Dosa)", "area": "Malleshwaram 7th Cross", "city": "Bengaluru", "category": "food", "lat": 12.9985, "lng": 77.5698, "keywords": "butter dosa heritage food restaurant"},
    {"id": "blr_vvpuram_food", "name": "VV Puram Food Street (Thindi Beedi)", "area": "VV Puram", "city": "Bengaluru", "category": "food", "lat": 12.9519, "lng": 77.5753, "keywords": "street food chaat sweets night market"},
    {"id": "blr_truffles_krm", "name": "Truffles Ice & Spice (Koramangala)", "area": "Koramangala 5th Block", "city": "Bengaluru", "category": "food", "lat": 12.9336, "lng": 77.6143, "keywords": "burgers cafe dining famous"},
    {"id": "blr_truffles_stmarks", "name": "Truffles (St. Marks Road)", "area": "St. Marks Road", "city": "Bengaluru", "category": "food", "lat": 12.9719, "lng": 77.6010, "keywords": "burgers cafe cbd food"},
    {"id": "blr_toit", "name": "Toit Brewpub & Kitchen", "area": "Indiranagar 100ft Road", "city": "Bengaluru", "category": "food", "lat": 12.9794, "lng": 77.6407, "keywords": "restaurant dining pizza pub"},
    {"id": "blr_brahmins", "name": "Brahmin's Coffee Bar", "area": "Shankarapuram / Basavanagudi", "city": "Bengaluru", "category": "food", "lat": 12.9537, "lng": 77.5689, "keywords": "idli vada coffee breakfast"},
    {"id": "blr_veena", "name": "Veena Stores", "area": "Malleshwaram 15th Cross", "city": "Bengaluru", "category": "food", "lat": 13.0054, "lng": 77.5692, "keywords": "idli vada khara bath breakfast"},
    {"id": "blr_meghana", "name": "Meghana Foods Biryani (Koramangala)", "area": "Koramangala 5th Block", "city": "Bengaluru", "category": "food", "lat": 12.9344, "lng": 77.6163, "keywords": "andhra biryani restaurant food"},
    {"id": "blr_taaza", "name": "Taaza Thindi", "area": "Jayanagar 4th T Block", "city": "Bengaluru", "category": "food", "lat": 12.9242, "lng": 77.5934, "keywords": "dosa idli coffee tiffin"},
    {"id": "blr_thirdwave", "name": "Third Wave Coffee Roasters (Church St)", "area": "Church Street", "city": "Bengaluru", "category": "food", "lat": 12.9746, "lng": 77.6054, "keywords": "cafe coffee hangout"},
    {"id": "blr_koshys", "name": "Koshy's Parade Cafe", "area": "St. Marks Road", "city": "Bengaluru", "category": "food", "lat": 12.9756, "lng": 77.6001, "keywords": "heritage cafe breakfast restaurant"},
    {"id": "blr_airlines", "name": "Airlines Hotel Open-Air Drive-In", "area": "Lavelle Road", "city": "Bengaluru", "category": "food", "lat": 12.9723, "lng": 77.5976, "keywords": "chole bhature dosa banyan tree cafe"},
    # Bengaluru Transit, Airports, Landmarks & Tech Parks
    {"id": "blr_airport", "name": "Kempegowda International Airport (BLR)", "area": "Devanahalli", "city": "Bengaluru", "category": "transit", "lat": 13.1986, "lng": 77.7066, "keywords": "airport flight terminal kia"},
    {"id": "blr_ksr_rail", "name": "KSR Bengaluru City Railway Station", "area": "Majestic", "city": "Bengaluru", "category": "transit", "lat": 12.9784, "lng": 77.5686, "keywords": "train railway sbc station"},
    {"id": "blr_smvt", "name": "SMVT Baiyappanahalli Railway Terminal", "area": "Baiyappanahalli", "city": "Bengaluru", "category": "transit", "lat": 12.9963, "lng": 77.6499, "keywords": "train railway terminal east"},
    {"id": "blr_iskcon", "name": "ISKCON Temple Bengaluru", "area": "Rajajinagar", "city": "Bengaluru", "category": "landmark", "lat": 13.0096, "lng": 77.5511, "keywords": "temple famous tourist spot"},
    {"id": "blr_palace", "name": "Bengaluru Palace", "area": "Vasanth Nagar", "city": "Bengaluru", "category": "landmark", "lat": 12.9988, "lng": 77.5921, "keywords": "palace tourist landmark heritage"},
    {"id": "blr_iisc", "name": "IISc Bengaluru (Indian Institute of Science)", "area": "Malleswaram / Mathikere", "city": "Bengaluru", "category": "landmark", "lat": 13.0219, "lng": 77.5671, "keywords": "university college campus"},
    {"id": "blr_manyata", "name": "Manyata Embassy Business Park", "area": "Nagavara / Hebbal", "city": "Bengaluru", "category": "tech", "lat": 13.0458, "lng": 77.6203, "keywords": "it tech park north"},
    {"id": "blr_itpl", "name": "ITPL International Tech Park", "area": "Whitefield", "city": "Bengaluru", "category": "tech", "lat": 12.9854, "lng": 77.7367, "keywords": "tech park offices whitefield"},
    {"id": "blr_bagmane", "name": "Bagmane Tech Park", "area": "CV Raman Nagar", "city": "Bengaluru", "category": "tech", "lat": 12.9794, "lng": 77.6615, "keywords": "it park offices east"},
    # Pan-India Cities, Famous Landmarks, Markets/Shops & Food Hubs
    {"id": "in_del_indiagate", "name": "India Gate & Kartavya Path", "area": "Central Delhi", "city": "New Delhi", "category": "landmark", "lat": 28.6129, "lng": 77.2295, "keywords": "delhi monument famous india"},
    {"id": "in_del_cp", "name": "Connaught Place (CP) Shopping & Dining", "area": "New Delhi", "city": "New Delhi", "category": "shop", "lat": 28.6315, "lng": 77.2167, "keywords": "delhi market shops cafes metro"},
    {"id": "in_del_chandni", "name": "Chandni Chowk & Paranthe Wali Gali", "area": "Old Delhi", "city": "New Delhi", "category": "food", "lat": 28.6506, "lng": 77.2303, "keywords": "delhi street food bazaar shopping"},
    {"id": "in_del_khan", "name": "Khan Market", "area": "New Delhi", "city": "New Delhi", "category": "shop", "lat": 28.6001, "lng": 77.2270, "keywords": "delhi boutiques cafes shops"},
    {"id": "in_del_qutub", "name": "Qutub Minar", "area": "Mehrauli", "city": "New Delhi", "category": "landmark", "lat": 28.5245, "lng": 77.1855, "keywords": "delhi heritage monument"},
    {"id": "in_mum_gateway", "name": "Gateway of India & Taj Mahal Palace", "area": "Colaba", "city": "Mumbai", "category": "landmark", "lat": 18.9220, "lng": 72.8347, "keywords": "mumbai famous monument seafront"},
    {"id": "in_mum_marine", "name": "Marine Drive Queen's Necklace", "area": "South Mumbai", "city": "Mumbai", "category": "landmark", "lat": 18.9432, "lng": 72.8235, "keywords": "mumbai promenade famous"},
    {"id": "in_mum_colaba", "name": "Colaba Causeway & Leopold Cafe", "area": "Colaba", "city": "Mumbai", "category": "shop", "lat": 18.9182, "lng": 72.8312, "keywords": "mumbai street shopping food cafe"},
    {"id": "in_mum_bkc", "name": "Bandra Kurla Complex (BKC) & Jio World", "area": "Bandra East", "city": "Mumbai", "category": "tech", "lat": 19.0653, "lng": 72.8682, "keywords": "mumbai business mall hub"},
    {"id": "in_mum_csmt", "name": "Chhatrapati Shivaji Terminus (CSMT)", "area": "Fort", "city": "Mumbai", "category": "transit", "lat": 18.9398, "lng": 72.8355, "keywords": "mumbai railway station heritage"},
    {"id": "in_hyd_charminar", "name": "Charminar & Laad Bazaar", "area": "Old City", "city": "Hyderabad", "category": "landmark", "lat": 17.3616, "lng": 78.4747, "keywords": "hyderabad monument bangle shops food"},
    {"id": "in_hyd_paradise", "name": "Paradise Biryani (Secunderabad)", "area": "Secunderabad", "city": "Hyderabad", "category": "food", "lat": 17.4418, "lng": 78.4875, "keywords": "hyderabad biryani famous food"},
    {"id": "in_hyd_hitech", "name": "HITEC City Cyber Towers", "area": "Madhapur", "city": "Hyderabad", "category": "tech", "lat": 17.4504, "lng": 78.3808, "keywords": "hyderabad it hub tech"},
    {"id": "in_chn_marina", "name": "Marina Beach Promenade", "area": "Triplicane", "city": "Chennai", "category": "landmark", "lat": 13.0500, "lng": 80.2824, "keywords": "chennai beach famous landmark"},
    {"id": "in_chn_tnagar", "name": "T. Nagar Pondy Bazaar Shopping Hub", "area": "T. Nagar", "city": "Chennai", "category": "shop", "lat": 13.0418, "lng": 80.2341, "keywords": "chennai silk sarees jewelry shopping"},
    {"id": "in_chn_saravana", "name": "Hotel Saravana Bhavan (Mylapore)", "area": "Mylapore", "city": "Chennai", "category": "food", "lat": 13.0338, "lng": 80.2676, "keywords": "chennai south indian restaurant food"},
    {"id": "in_mys_palace", "name": "Mysuru Palace (Amba Vilas)", "area": "Sayyaji Rao Road", "city": "Mysuru", "category": "landmark", "lat": 12.3051, "lng": 76.6551, "keywords": "mysore palace tourist karnataka"},
    {"id": "in_mys_market", "name": "Devaraja Market & Mylari Dosa", "area": "Mysuru Central", "city": "Mysuru", "category": "shop", "lat": 12.3112, "lng": 76.6515, "keywords": "mysore silk market food dosa"},
    {"id": "in_pun_fc", "name": "Fergusson College Road & Vaishali Cafe", "area": "Shivajinagar", "city": "Pune", "category": "food", "lat": 18.5227, "lng": 73.8414, "keywords": "pune food cafes shopping street"},
    {"id": "in_pun_shaniwar", "name": "Shaniwar Wada Fort", "area": "Kasba Peth", "city": "Pune", "category": "landmark", "lat": 18.5195, "lng": 73.8553, "keywords": "pune heritage fort"},
    {"id": "in_kol_park", "name": "Park Street & Flurys Bakery", "area": "Park Street", "city": "Kolkata", "category": "food", "lat": 22.5535, "lng": 88.3526, "keywords": "kolkata cafes restaurants shopping"},
    {"id": "in_kol_victoria", "name": "Victoria Memorial", "area": "Maidan", "city": "Kolkata", "category": "landmark", "lat": 22.5448, "lng": 88.3426, "keywords": "kolkata monument landmark"},
    {"id": "in_jai_hawa", "name": "Hawa Mahal & Johari Bazaar", "area": "Pink City", "city": "Jaipur", "category": "landmark", "lat": 26.9239, "lng": 75.8267, "keywords": "jaipur rajasthan palace jewelry market"},
    {"id": "in_agr_taj", "name": "Taj Mahal", "area": "Dharmapuri", "city": "Agra", "category": "landmark", "lat": 27.1751, "lng": 78.0421, "keywords": "agra wonder monument uttar pradesh"},
    {"id": "in_amr_golden", "name": "Golden Temple (Sri Harmandir Sahib)", "area": "Katra Ahluwalia", "city": "Amritsar", "category": "landmark", "lat": 31.6200, "lng": 74.8765, "keywords": "amritsar punjab temple food street"},
    {"id": "in_goa_baga", "name": "Baga Beach & Tito's Lane", "area": "North Goa", "city": "Goa", "category": "landmark", "lat": 15.5553, "lng": 73.7517, "keywords": "goa beach nightlife cafes"},
    {"id": "in_koc_fort", "name": "Fort Kochi & Chinese Fishing Nets", "area": "Fort Kochi", "city": "Kochi", "category": "landmark", "lat": 9.9658, "lng": 76.2421, "keywords": "kochi kerala heritage cafes"},
    {"id": "in_ahm_manek", "name": "Manek Chowk Night Food Market", "area": "Old City", "city": "Ahmedabad", "category": "food", "lat": 23.0258, "lng": 72.5873, "keywords": "ahmedabad gujarat street food night"},
    {"id": "in_ind_sarafa", "name": "Sarafa Bazaar Night Food Street", "area": "Rajwada", "city": "Indore", "category": "food", "lat": 22.7177, "lng": 75.8545, "keywords": "indore poha chaat night street food"},
    {"id": "in_var_ghat", "name": "Dashashwamedh Ghat", "area": "Varanasi", "city": "Varanasi", "category": "landmark", "lat": 25.3069, "lng": 83.0104, "keywords": "kashi banaras ganga aarti"},
    {"id": "in_uda_lake", "name": "City Palace & Lake Pichola", "area": "Old City", "city": "Udaipur", "category": "landmark", "lat": 24.5764, "lng": 73.6835, "keywords": "udaipur rajasthan lake palace"},
    {"id": "in_chd_sec17", "name": "Sector 17 Plaza Shopping Center", "area": "Sector 17", "city": "Chandigarh", "category": "shop", "lat": 30.7415, "lng": 76.7830, "keywords": "chandigarh shopping plaza"},
    {"id": "in_lko_tunday", "name": "Tunday Kababi (Aminabad)", "area": "Aminabad", "city": "Lucknow", "category": "food", "lat": 26.8470, "lng": 80.9277, "keywords": "lucknow kebabs street food"},
    {"id": "in_ggn_cyber", "name": "DLF CyberHub Dining & Tech", "area": "DLF Phase 2", "city": "Gurugram", "category": "food", "lat": 28.4950, "lng": 77.0895, "keywords": "gurgaon ncr restaurants corporate"},
    {"id": "in_noi_18", "name": "Sector 18 Atta Market & DLF Mall", "area": "Sector 18", "city": "Noida", "category": "shop", "lat": 28.5677, "lng": 77.3211, "keywords": "noida mall shopping market"},
    {"id": "in_cbe_rs", "name": "RS Puram Shopping & Annapoorna", "area": "RS Puram", "city": "Coimbatore", "category": "food", "lat": 11.0085, "lng": 76.9502, "keywords": "coimbatore tamil nadu food shops"},
    {"id": "in_ris_laxman", "name": "Laxman Jhula & Tapovan Cafes", "area": "Rishikesh", "city": "Rishikesh", "category": "landmark", "lat": 30.1257, "lng": 78.3292, "keywords": "rishikesh uttarakhand river cafes"},
    {"id": "in_shi_mall", "name": "The Mall Road & Ridge", "area": "Shimla", "city": "Shimla", "category": "shop", "lat": 31.1048, "lng": 77.1734, "keywords": "shimla himachal shopping cafes"},
]

PLACE_CATALOG: list[dict[str, Any]] = [
    {**loc, "city": "Bengaluru", "category": "hub", "keywords": "bengaluru bangalore core hub"}
    for loc in LOCATIONS
] + EXTRA_PLACES


# -----------------------------------------------------------------------------
# 1C. Persistent SQLite Database (Citizen Identity, Family Details & Police SOS)
# -----------------------------------------------------------------------------
DB_PATH = os.path.join(BASE_DIR, "safepath_emergency.db")


def _db_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_emergency_db() -> None:
    with _db_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS citizen_profiles (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                full_name TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL DEFAULT '',
                age TEXT DEFAULT '',
                gender TEXT DEFAULT '',
                blood_group TEXT DEFAULT '',
                home_address TEXT DEFAULT '',
                medical_notes TEXT DEFAULT '',
                vehicle_info TEXT DEFAULT '',
                family_primary_name TEXT NOT NULL DEFAULT '',
                family_primary_relation TEXT DEFAULT '',
                family_primary_phone TEXT NOT NULL DEFAULT '',
                family_secondary_name TEXT DEFAULT '',
                family_secondary_phone TEXT DEFAULT '',
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sos_incidents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_code TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                citizen_name TEXT NOT NULL,
                citizen_phone TEXT NOT NULL,
                citizen_age TEXT DEFAULT '',
                citizen_gender TEXT DEFAULT '',
                blood_group TEXT DEFAULT '',
                medical_notes TEXT DEFAULT '',
                home_address TEXT DEFAULT '',
                vehicle_info TEXT DEFAULT '',
                family_primary_name TEXT NOT NULL,
                family_primary_relation TEXT DEFAULT '',
                family_primary_phone TEXT NOT NULL,
                family_secondary_name TEXT DEFAULT '',
                family_secondary_phone TEXT DEFAULT '',
                live_lat REAL NOT NULL,
                live_lng REAL NOT NULL,
                detected_location_name TEXT NOT NULL,
                destination_name TEXT DEFAULT '',
                travel_mode TEXT DEFAULT 'car',
                police_station_name TEXT NOT NULL,
                police_station_lat REAL NOT NULL,
                police_station_lng REAL NOT NULL,
                police_station_dist_km REAL NOT NULL,
                route_safety_score REAL DEFAULT 0,
                route_time_min REAL DEFAULT 0,
                route_dist_km REAL DEFAULT 0,
                route_corridor TEXT DEFAULT '',
                dispatch_payload_json TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS safety_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_code TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL,
                source_name TEXT NOT NULL,
                dest_name TEXT NOT NULL,
                travel_mode TEXT DEFAULT 'car',
                time_of_day TEXT DEFAULT 'night',
                safety_score REAL DEFAULT 0,
                travel_time_min REAL DEFAULT 0,
                route_dist_km REAL DEFAULT 0,
                high_risk_count INTEGER DEFAULT 0,
                report_text TEXT NOT NULL
            )
            """
        )
        existing_cols = {r["name"] for r in conn.execute("PRAGMA table_info(sos_incidents)").fetchall()}
        for col_name, col_def in (
            ("citizen_age", "TEXT DEFAULT ''"),
            ("citizen_gender", "TEXT DEFAULT ''"),
            ("route_dist_km", "REAL DEFAULT 0"),
        ):
            if col_name not in existing_cols:
                conn.execute(f"ALTER TABLE sos_incidents ADD COLUMN {col_name} {col_def}")
        conn.commit()


init_emergency_db()


def get_citizen_profile() -> dict[str, Any]:
    with _db_conn() as conn:
        row = conn.execute("SELECT * FROM citizen_profiles WHERE id = 1").fetchone()
        if not row:
            return {
                "full_name": "",
                "phone": "",
                "age": "",
                "gender": "",
                "blood_group": "",
                "home_address": "",
                "medical_notes": "",
                "vehicle_info": "",
                "family_primary_name": "",
                "family_primary_relation": "Mother",
                "family_primary_phone": "",
                "family_secondary_name": "",
                "family_secondary_phone": "",
                "updated_at": "",
                "is_configured": False,
            }
        d = dict(row)
        d.pop("id", None)
        d["is_configured"] = bool(d.get("full_name", "").strip() and d.get("family_primary_phone", "").strip())
        return d


def save_citizen_profile(profile: dict[str, Any]) -> dict[str, Any]:
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    existing = get_citizen_profile()
    merged = {
        "full_name": str(profile.get("full_name", existing.get("full_name", ""))).strip(),
        "phone": str(profile.get("phone", existing.get("phone", ""))).strip(),
        "age": str(profile.get("age", existing.get("age", ""))).strip(),
        "gender": str(profile.get("gender", existing.get("gender", ""))).strip(),
        "blood_group": str(profile.get("blood_group", existing.get("blood_group", ""))).strip(),
        "home_address": str(profile.get("home_address", existing.get("home_address", ""))).strip(),
        "medical_notes": str(profile.get("medical_notes", existing.get("medical_notes", ""))).strip(),
        "vehicle_info": str(profile.get("vehicle_info", existing.get("vehicle_info", ""))).strip(),
        "family_primary_name": str(profile.get("family_primary_name", existing.get("family_primary_name", ""))).strip(),
        "family_primary_relation": str(profile.get("family_primary_relation", existing.get("family_primary_relation", "Mother"))).strip(),
        "family_primary_phone": str(profile.get("family_primary_phone", existing.get("family_primary_phone", ""))).strip(),
        "family_secondary_name": str(profile.get("family_secondary_name", existing.get("family_secondary_name", ""))).strip(),
        "family_secondary_phone": str(profile.get("family_secondary_phone", existing.get("family_secondary_phone", ""))).strip(),
    }
    with _db_conn() as conn:
        conn.execute(
            """
            INSERT INTO citizen_profiles (
                id, full_name, phone, age, gender, blood_group, home_address, medical_notes, vehicle_info,
                family_primary_name, family_primary_relation, family_primary_phone,
                family_secondary_name, family_secondary_phone, updated_at
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                full_name=excluded.full_name,
                phone=excluded.phone,
                age=excluded.age,
                gender=excluded.gender,
                blood_group=excluded.blood_group,
                home_address=excluded.home_address,
                medical_notes=excluded.medical_notes,
                vehicle_info=excluded.vehicle_info,
                family_primary_name=excluded.family_primary_name,
                family_primary_relation=excluded.family_primary_relation,
                family_primary_phone=excluded.family_primary_phone,
                family_secondary_name=excluded.family_secondary_name,
                family_secondary_phone=excluded.family_secondary_phone,
                updated_at=excluded.updated_at
            """,
            (
                merged["full_name"],
                merged["phone"],
                merged["age"],
                merged["gender"],
                merged["blood_group"],
                merged["home_address"],
                merged["medical_notes"],
                merged["vehicle_info"],
                merged["family_primary_name"],
                merged["family_primary_relation"],
                merged["family_primary_phone"],
                merged["family_secondary_name"],
                merged["family_secondary_phone"],
                now,
            ),
        )
        conn.commit()
    return get_citizen_profile()


def list_sos_incidents(limit: int = 20) -> list[dict[str, Any]]:
    with _db_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM sos_incidents ORDER BY id DESC LIMIT ?",
            (int(limit),),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            try:
                d["dispatch_packet"] = json.loads(d.pop("dispatch_payload_json", "{}"))
            except Exception:
                d["dispatch_packet"] = {}
            out.append(d)
        return out


def update_sos_incident(
    incident_code: str,
    status: str | None = None,
    profile_override: dict[str, Any] | None = None,
    live_lat: float | None = None,
    live_lng: float | None = None,
) -> dict[str, Any] | None:
    if not incident_code:
        return None
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if profile_override:
        prof = save_citizen_profile(profile_override)
    else:
        prof = get_citizen_profile()

    with _db_conn() as conn:
        row = conn.execute("SELECT * FROM sos_incidents WHERE incident_code = ?", (incident_code,)).fetchone()
        if not row:
            return None
        packet = json.loads(row["dispatch_payload_json"] or "{}")
        new_status = status or row["status"]
        new_lat = round(float(live_lat), 6) if live_lat is not None else row["live_lat"]
        new_lng = round(float(live_lng), 6) if live_lng is not None else row["live_lng"]
        if live_lat is not None and live_lng is not None:
            loc_pkt = packet.get("live_location") or {}
            loc_pkt["lat"] = new_lat
            loc_pkt["lng"] = new_lng
            loc_pkt["maps_link"] = f"https://www.openstreetmap.org/?mlat={new_lat:.6f}&mlon={new_lng:.6f}#map=17/{new_lat:.6f}/{new_lng:.6f}"
            packet["live_location"] = loc_pkt
        if profile_override:
            packet["citizen"] = {
                "full_name": prof["full_name"] or "Unregistered Citizen",
                "phone": prof["phone"] or "Not Provided",
                "age": prof["age"],
                "gender": prof["gender"],
                "blood_group": prof["blood_group"],
                "home_address": prof["home_address"],
                "medical_notes": prof["medical_notes"],
                "vehicle_info": prof["vehicle_info"],
            }
            packet["family_contacts"] = {
                "primary": {
                    "name": prof["family_primary_name"] or "Not Provided",
                    "relation": prof["family_primary_relation"] or "Family",
                    "phone": prof["family_primary_phone"] or "Not Provided",
                    "alert_status": "DISPATCHED" if prof["family_primary_phone"] else "PENDING_CONTACT",
                },
                "secondary": {
                    "name": prof["family_secondary_name"],
                    "phone": prof["family_secondary_phone"],
                    "alert_status": "DISPATCHED" if prof["family_secondary_phone"] else "NOT_SET",
                },
            }
        packet["status"] = new_status
        packet["updated_at"] = now

        conn.execute(
            """
            UPDATE sos_incidents SET
                status = ?,
                updated_at = ?,
                citizen_name = ?,
                citizen_phone = ?,
                citizen_age = ?,
                citizen_gender = ?,
                blood_group = ?,
                medical_notes = ?,
                home_address = ?,
                vehicle_info = ?,
                family_primary_name = ?,
                family_primary_relation = ?,
                family_primary_phone = ?,
                family_secondary_name = ?,
                family_secondary_phone = ?,
                live_lat = ?,
                live_lng = ?,
                dispatch_payload_json = ?
            WHERE incident_code = ?
            """,
            (
                new_status,
                now,
                prof["full_name"] or row["citizen_name"],
                prof["phone"] or row["citizen_phone"],
                prof["age"] or row["citizen_age"],
                prof["gender"] or row["citizen_gender"],
                prof["blood_group"] or row["blood_group"],
                prof["medical_notes"] or row["medical_notes"],
                prof["home_address"] or row["home_address"],
                prof["vehicle_info"] or row["vehicle_info"],
                prof["family_primary_name"] or row["family_primary_name"],
                prof["family_primary_relation"] or row["family_primary_relation"],
                prof["family_primary_phone"] or row["family_primary_phone"],
                prof["family_secondary_name"] or row["family_secondary_name"],
                prof["family_secondary_phone"] or row["family_secondary_phone"],
                new_lat,
                new_lng,
                json.dumps(packet),
                incident_code,
            ),
        )
        conn.commit()
    items = [it for it in list_sos_incidents(25) if it["incident_code"] == incident_code]
    return items[0] if items else None


# -----------------------------------------------------------------------------
# 2. Helper Functions: Normalization, Segment Scoring & Graph Pathfinding
# -----------------------------------------------------------------------------
def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometers between two lat/lng coordinates."""
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2.0) ** 2
    )
    return r * 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))


# -----------------------------------------------------------------------------
# 2B. Pan-Bengaluru & Pan-India Place Search (Curated + Live OSM Photon/Nominatim)
# -----------------------------------------------------------------------------
def _classify_osm_category(osm_key: str, osm_val: str) -> str:
    k = (osm_key or "").lower()
    v = (osm_val or "").lower()
    if k == "shop" or v in {"mall", "marketplace", "supermarket", "department_store", "clothes", "bakery"}:
        return "shop"
    if v in {"restaurant", "cafe", "fast_food", "food_court", "ice_cream", "pub", "bar"}:
        return "food"
    if k in {"railway", "aeroway"} or v in {"station", "bus_station", "subway_entrance", "aerodrome", "halt"}:
        return "transit"
    if v in {"hospital", "clinic"}:
        return "hospital"
    if k == "tourism" or v in {"attraction", "monument", "temple", "place_of_worship", "park", "police"}:
        return "landmark"
    if k == "place":
        return "city"
    return "hub"


def _query_external_india_geocoder(query: str, lat: float | None, lng: float | None, limit: int = 8) -> list[dict[str, Any]]:
    """Query OpenStreetMap Photon + Nominatim across India for shops, food, streets & cities."""
    results: list[dict[str, Any]] = []
    try:
        bias_lat = lat if lat is not None else 12.9716
        bias_lng = lng if lng is not None else 77.5946
        params = urllib.parse.urlencode({
            "q": query,
            "lat": round(bias_lat, 4),
            "lon": round(bias_lng, 4),
            "limit": limit + 4,
            "lang": "en",
        })
        req = urllib.request.Request(
            f"https://photon.komoot.io/api/?{params}",
            headers={"User-Agent": "SafePath-India-RoutePlanner/2.0"},
        )
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        for feat in data.get("features", []):
            props = feat.get("properties") or {}
            coords = (feat.get("geometry") or {}).get("coordinates") or []
            if len(coords) < 2:
                continue
            p_lng, p_lat = float(coords[0]), float(coords[1])
            country = str(props.get("countrycode") or props.get("country") or "").upper()
            if country and country not in {"IN", "INDIA"}:
                continue
            if not (6.0 <= p_lat <= 38.0 and 67.0 <= p_lng <= 98.5):
                continue
            name = props.get("name") or props.get("street") or props.get("city") or query
            area_parts = [p for p in [props.get("street"), props.get("district"), props.get("locality"), props.get("city")] if p and p != name]
            city_parts = [p for p in [props.get("city") or props.get("county"), props.get("state")] if p]
            results.append({
                "id": f"osm_{abs(hash((name, round(p_lat, 4), round(p_lng, 4))))}",
                "name": name,
                "area": ", ".join(area_parts[:2]) or props.get("state") or "India",
                "city": ", ".join(city_parts[:2]) or "India",
                "category": _classify_osm_category(props.get("osm_key", ""), props.get("osm_value", "")),
                "lat": round(p_lat, 6),
                "lng": round(p_lng, 6),
                "source": "osm",
            })
    except Exception:
        pass

    if len(results) >= 4:
        return results[:limit]

    try:
        params = urllib.parse.urlencode({
            "q": query,
            "countrycodes": "in",
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": limit,
        })
        req = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/search?{params}",
            headers={"User-Agent": "SafePath-India-RoutePlanner/2.0"},
        )
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            items = json.loads(resp.read().decode("utf-8"))
        for item in items:
            p_lat = float(item["lat"])
            p_lng = float(item["lon"])
            addr = item.get("address") or {}
            name = item.get("name") or str(item.get("display_name", "")).split(",")[0].strip()
            area = addr.get("suburb") or addr.get("neighbourhood") or addr.get("road") or addr.get("city_district") or ""
            city = addr.get("city") or addr.get("town") or addr.get("state_district") or addr.get("state") or "India"
            results.append({
                "id": f"nom_{item.get('place_id', abs(hash(name)))}",
                "name": name,
                "area": area or city,
                "city": city,
                "category": _classify_osm_category(item.get("category", ""), item.get("type", "")),
                "lat": round(p_lat, 6),
                "lng": round(p_lng, 6),
                "source": "osm",
            })
    except Exception:
        pass

    return results[:limit]


def search_places(
    query: str = "",
    lat: float | None = None,
    lng: float | None = None,
    limit: int = 18,
    category: str = "",
) -> dict[str, Any]:
    """Search curated Bengaluru & Pan-India places (landmarks, shops, food) + live OSM places."""
    q = (query or "").strip().lower()
    cat_filter = (category or "").strip().lower()
    ref_lat = float(lat) if lat is not None else 12.9716
    ref_lng = float(lng) if lng is not None else 77.5946

    curated_scored: list[tuple[float, dict[str, Any]]] = []
    tokens = [t for t in re.split(r"\s+", q) if t]

    for p in PLACE_CATALOG:
        if cat_filter and p.get("category") != cat_filter:
            continue
        hay = f"{p['name']} {p.get('area', '')} {p.get('city', '')} {p.get('category', '')} {p.get('keywords', '')}".lower()
        dist_km = round(haversine_km(ref_lat, ref_lng, float(p["lat"]), float(p["lng"])), 2)
        if not tokens:
            score = (1000.0 if p.get("city") == "Bengaluru" else 200.0) - min(dist_km, 500.0) * 0.2
            curated_scored.append((score, {**p, "dist_km": dist_km, "source": "curated"}))
            continue

        if all(tok in hay for tok in tokens):
            name_low = p["name"].lower()
            exact_bonus = 500.0 if name_low.startswith(q) else (250.0 if q in name_low else 100.0)
            blr_bonus = 60.0 if p.get("city") == "Bengaluru" else 0.0
            score = exact_bonus + blr_bonus - min(dist_km, 2500.0) * 0.03
            curated_scored.append((score, {**p, "dist_km": dist_km, "source": "curated"}))

    curated_scored.sort(key=lambda x: x[0], reverse=True)
    merged: list[dict[str, Any]] = [item for _, item in curated_scored[:limit]]

    if len(q) >= 2 and len(merged) < limit:
        ext = _query_external_india_geocoder(query.strip(), ref_lat, ref_lng, limit=10)
        for ep in ext:
            is_dup = any(
                haversine_km(float(m["lat"]), float(m["lng"]), float(ep["lat"]), float(ep["lng"])) < 0.25
                and m["name"].lower().split("(")[0].strip() in ep["name"].lower()
                for m in merged
            )
            if not is_dup:
                ep["dist_km"] = round(haversine_km(ref_lat, ref_lng, float(ep["lat"]), float(ep["lng"])), 2)
                merged.append(ep)

    return {"places": merged[:limit], "total": len(merged[:limit]), "query": query}


def reverse_place(lat: float, lng: float) -> dict[str, Any]:
    """Resolve coordinates into a human-readable Indian street/neighborhood name."""
    nearest = min(
        PLACE_CATALOG,
        key=lambda p: haversine_km(lat, lng, float(p["lat"]), float(p["lng"])),
    )
    near_dist = round(haversine_km(lat, lng, float(nearest["lat"]), float(nearest["lng"])), 2)
    fallback_name = (
        f"Near {nearest['name']}" if near_dist <= 8.0 else f"Current Location ({lat:.4f}, {lng:.4f})"
    )
    fallback_area = nearest.get("area") or nearest.get("city") or "India"

    try:
        params = urllib.parse.urlencode({"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 17})
        req = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/reverse?{params}",
            headers={"User-Agent": "SafePath-India-RoutePlanner/2.0"},
        )
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        addr = data.get("address") or {}
        road = addr.get("road") or addr.get("neighbourhood") or addr.get("suburb") or ""
        sub = addr.get("suburb") or addr.get("city_district") or addr.get("town") or addr.get("city") or ""
        city = addr.get("city") or addr.get("state_district") or addr.get("state") or nearest.get("city", "India")
        label = ", ".join([p for p in [road, sub] if p]) or data.get("name") or fallback_name
        return {
            "id": "current_location",
            "name": label,
            "area": sub or fallback_area,
            "city": city,
            "category": "hub",
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "nearest_hub_id": nearest["id"] if nearest["id"] in LOCATION_MAP else None,
        }
    except Exception:
        return {
            "id": "current_location",
            "name": fallback_name,
            "area": fallback_area,
            "city": nearest.get("city", "India"),
            "category": "hub",
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "nearest_hub_id": nearest["id"] if nearest["id"] in LOCATION_MAP else None,
        }


def normalize_weights(raw_weights: dict[str, float]) -> dict[str, float]:
    total = sum(max(0.0, float(raw_weights.get(k, 0.0))) for k in DEFAULT_FACTOR_WEIGHTS)
    if total <= 0:
        return dict(DEFAULT_FACTOR_WEIGHTS)
    return {k: max(0.0, float(raw_weights.get(k, 0.0))) / total for k in DEFAULT_FACTOR_WEIGHTS}


def compute_effective_edge(
    edge: dict[str, Any],
    time_of_day: str,
    disruptions: dict[str, dict[str, float]],
    norm_weights: dict[str, float],
    travel_mode: str = "car",
) -> dict[str, Any]:
    """Apply time-of-day, travel-mode & disruption modifiers, then compute 0–100 Safety Score & travel time."""
    light = float(edge["lighting"])
    crowd = float(edge["crowd"])
    risk = float(edge["incident_risk"])
    iso = float(edge["isolation"])

    if time_of_day == "evening":
        light -= edge["night_light_drop"] * 0.45
        crowd -= edge["night_crowd_drop"] * 0.35
        risk += iso * 0.08
    elif time_of_day == "night":
        light -= edge["night_light_drop"]
        crowd -= edge["night_crowd_drop"]
        risk += iso * 0.16

    # Travel mode adjustments: pedestrians are more exposed to dark/isolated stretches; cars have cabin enclosure
    mode = travel_mode if travel_mode in TRAVEL_MODE_CONFIG else "car"
    if mode == "walk":
        eff_time = round((float(edge["dist"]) / TRAVEL_MODE_CONFIG["walk"]["speed_kmh"]) * 60.0, 1)
        if iso >= 4.5 or light < 5.5:
            light -= 0.7
            crowd -= 0.4
            iso += 0.9
            risk += 0.8
        else:
            crowd += 0.3
    elif mode == "bike":
        eff_time = round(float(edge["time"]) * TRAVEL_MODE_CONFIG["bike"]["time_multiplier"], 1)
        if iso >= 5.0 or light < 5.0:
            light -= 0.3
            iso += 0.3
            risk += 0.4
    else:
        eff_time = round(float(edge["time"]) * TRAVEL_MODE_CONFIG["car"]["time_multiplier"], 1)
        iso -= 0.8
        risk -= 0.5
        light += 0.3

    dis = disruptions.get(edge["id"])
    if dis:
        light += float(dis.get("lighting_delta", 0.0))
        crowd += float(dis.get("crowd_delta", 0.0))
        risk += float(dis.get("risk_delta", 0.0))

    lighting = round(clamp(light, 0.5, 10.0), 1)
    crowd_val = round(clamp(crowd, 0.5, 10.0), 1)
    cctv = round(clamp(float(edge["cctv"]), 0.5, 10.0), 1)
    emergency = round(clamp(float(edge["emergency"]), 0.5, 10.0), 1)
    isolation = round(clamp(iso, 0.5, 10.0), 1)
    incident_risk = round(clamp(risk, 0.5, 10.0), 1)

    isolation_inv = round(10.0 - isolation, 1)
    risk_inv = round(10.0 - incident_risk, 1)

    weighted_01 = (
        norm_weights["lighting"] * (lighting / 10.0)
        + norm_weights["crowd"] * (crowd_val / 10.0)
        + norm_weights["cctv"] * (cctv / 10.0)
        + norm_weights["emergency"] * (emergency / 10.0)
        + norm_weights["isolation_inv"] * (isolation_inv / 10.0)
        + norm_weights["risk_inv"] * (risk_inv / 10.0)
    )
    safety_score = round(weighted_01 * 100.0, 1)

    return {
        **edge,
        "time": eff_time,
        "eff": {
            "lighting": lighting,
            "crowd": crowd_val,
            "cctv": cctv,
            "emergency": emergency,
            "isolation": isolation,
            "incident_risk": incident_risk,
            "isolation_inv": isolation_inv,
            "risk_inv": risk_inv,
        },
        "safety_score": safety_score,
        "is_high_risk": safety_score < 40.0,
        "is_disrupted": dis is not None,
    }


def edge_latlngs(edge: dict[str, Any], from_id: str, to_id: str) -> list[list[float]]:
    """Return ordered [lat, lng] road-snapped polyline coordinates along the segment direction."""
    road_pts = ROAD_GEOMETRIES.get(edge["id"])
    if road_pts and len(road_pts) >= 2:
        if from_id == edge["from"]:
            return list(road_pts)
        return list(reversed(road_pts))

    start = [LOCATION_MAP[from_id]["lat"], LOCATION_MAP[from_id]["lng"]]
    end = [LOCATION_MAP[to_id]["lat"], LOCATION_MAP[to_id]["lng"]]
    waypoints = edge.get("waypoints", [])
    if from_id == edge["from"]:
        return [start, *waypoints, end]
    return [start, *list(reversed(waypoints)), end]


def enumerate_candidate_paths(
    adj: dict[str, list[tuple[str, dict[str, Any]]]],
    source: str,
    dest: str,
    max_hops: int = 6,
) -> list[dict[str, Any]]:
    """Bounded DFS to discover all distinct simple routes up to max_hops."""
    paths: list[dict[str, Any]] = []
    visited = {source}

    def dfs(curr: str, nodes: list[str], edges: list[dict[str, Any]]) -> None:
        if len(paths) >= 260:
            return
        if curr == dest:
            paths.append({"nodes": list(nodes), "edges": list(edges)})
            return
        if len(edges) >= max_hops:
            return
        for nxt, edge in adj[curr]:
            if nxt not in visited:
                visited.add(nxt)
                nodes.append(nxt)
                edges.append(edge)
                dfs(nxt, nodes, edges)
                edges.pop()
                nodes.pop()
                visited.remove(nxt)

    dfs(source, [source], [])
    return paths


def score_candidate_path(path: dict[str, Any]) -> dict[str, Any]:
    """Aggregate segment metrics into full route distance, time, safety, and factor breakdown."""
    nodes = path["nodes"]
    edges = path["edges"]
    total_dist = sum(float(e["dist"]) for e in edges)
    total_time = sum(float(e["time"]) for e in edges)
    safe_dist = total_dist if total_dist > 0 else 1.0

    safety_score = sum(e["safety_score"] * e["dist"] for e in edges) / safe_dist
    min_seg_safety = min(e["safety_score"] for e in edges)
    high_risk_count = sum(1 for e in edges if e["is_high_risk"])

    factor_avgs = {
        k: round(sum(e["eff"][k] * e["dist"] for e in edges) / safe_dist, 1)
        for k in DEFAULT_FACTOR_WEIGHTS
    }

    segments_out = []
    for idx, edge in enumerate(edges):
        u, v = nodes[idx], nodes[idx + 1]
        segments_out.append({
            "id": edge["id"],
            "road": edge["road"],
            "from": u,
            "to": v,
            "from_name": LOCATION_MAP[u]["name"],
            "to_name": LOCATION_MAP[v]["name"],
            "dist": edge["dist"],
            "time": edge["time"],
            "safety_score": edge["safety_score"],
            "is_high_risk": edge["is_high_risk"],
            "is_disrupted": edge["is_disrupted"],
            "eff": edge["eff"],
            "coords": edge_latlngs(edge, u, v),
        })

    return {
        "key": "->".join(nodes),
        "nodes": nodes,
        "node_names": [LOCATION_MAP[n]["name"] for n in nodes],
        "segments": segments_out,
        "total_dist": round(total_dist, 2),
        "total_time": round(total_time, 1),
        "safety_score": round(safety_score, 1),
        "min_seg_safety": round(min_seg_safety, 1),
        "high_risk_count": high_risk_count,
        "factor_avgs": factor_avgs,
    }


def mark_pareto_frontier(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Identify non-dominated routes in (SafetyScore, -TotalTime) space."""
    result = []
    for c in candidates:
        dominated = any(
            o["key"] != c["key"]
            and o["safety_score"] >= c["safety_score"]
            and o["total_time"] <= c["total_time"]
            and (o["safety_score"] > c["safety_score"] or o["total_time"] < c["total_time"])
            for o in candidates
        )
        result.append({**c, "is_pareto": not dominated})
    return result


# -----------------------------------------------------------------------------
# 3. Four-Strategy Optimization Engine (Bengaluru Graph + Universal India Corridors)
# -----------------------------------------------------------------------------
def _resolve_place_obj(place_raw: Any, fallback_id: str) -> dict[str, Any]:
    if isinstance(place_raw, dict) and place_raw.get("lat") is not None and place_raw.get("lng") is not None:
        return {
            "id": str(place_raw.get("id") or "custom"),
            "name": str(place_raw.get("name") or "Selected Location"),
            "area": str(place_raw.get("area") or place_raw.get("city") or "India"),
            "city": str(place_raw.get("city") or "India"),
            "category": str(place_raw.get("category") or "hub"),
            "lat": float(place_raw["lat"]),
            "lng": float(place_raw["lng"]),
        }
    if isinstance(place_raw, str) and place_raw in LOCATION_MAP:
        loc = LOCATION_MAP[place_raw]
        return {**loc, "city": "Bengaluru", "category": "hub"}
    for p in PLACE_CATALOG:
        if p["id"] == fallback_id:
            return p
    loc = LOCATION_MAP["majestic"]
    return {**loc, "city": "Bengaluru", "category": "hub"}


def _make_synthetic_segment(
    seg_id: str,
    road: str,
    u_id: str,
    v_id: str,
    u_name: str,
    v_name: str,
    coords: list[list[float]],
    raw_factors: dict[str, float],
    time_of_day: str,
    disruptions: dict[str, dict[str, float]],
    norm_weights: dict[str, float],
    travel_mode: str,
    dist_override: float | None = None,
) -> dict[str, Any]:
    dist_km = float(dist_override) if dist_override is not None else sum(
        haversine_km(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1])
        for i in range(len(coords) - 1)
    )
    dist_km = round(max(0.25, dist_km * 1.15), 2)
    speed = 4.8 if travel_mode == "walk" else (24.0 if travel_mode == "bike" else 28.0)
    if dist_km > 35:
        speed = 4.8 if travel_mode == "walk" else (46.0 if travel_mode == "bike" else 58.0)
    base_time = round(max(1.5, (dist_km / speed) * 60.0), 1)
    fake_edge = {
        "id": seg_id,
        "from": u_id,
        "to": v_id,
        "road": road,
        "dist": dist_km,
        "time": base_time,
        **raw_factors,
    }
    eff = compute_effective_edge(fake_edge, time_of_day, disruptions, norm_weights, travel_mode)
    return {
        "id": seg_id,
        "road": road,
        "from": u_id,
        "to": v_id,
        "from_name": u_name,
        "to_name": v_name,
        "dist": eff["dist"],
        "time": eff["time"],
        "safety_score": eff["safety_score"],
        "is_high_risk": eff["is_high_risk"],
        "is_disrupted": eff["is_disrupted"],
        "eff": eff["eff"],
        "coords": coords,
    }


def _evaluate_universal_corridors(
    src_place: dict[str, Any],
    dst_place: dict[str, Any],
    time_of_day: str,
    mode: str,
    risk_preference: float,
    fixed_safety_weight: float,
    norm_weights: dict[str, float],
    overall_sens_balance: float,
    disruptions: dict[str, dict[str, float]],
    emergency_mode: bool,
) -> dict[str, Any]:
    """Generate & evaluate 4 multi-segment strategies between ANY two places in Bengaluru or India."""
    s_lat, s_lng = src_place["lat"], src_place["lng"]
    d_lat, d_lng = dst_place["lat"], dst_place["lng"]
    direct_km = max(0.35, haversine_km(s_lat, s_lng, d_lat, d_lng))
    is_intercity = direct_km > 35.0
    city_lbl = dst_place.get("city") or "India"

    dlat = d_lat - s_lat
    dlng = d_lng - s_lng
    span = math.hypot(dlat, dlng) or 0.01
    perp_lat = -dlng / span
    perp_lng = dlat / span
    offset_scale = min(0.25, max(0.0022, span * 0.14))

    def _corridor_pts(bias: float, factor: float = 1.0) -> list[list[float]]:
        m1_lat = s_lat + dlat * 0.34 + perp_lat * offset_scale * bias * factor
        m1_lng = s_lng + dlng * 0.34 + perp_lng * offset_scale * bias * factor
        m2_lat = s_lat + dlat * 0.68 + perp_lat * offset_scale * bias * 0.85 * factor
        m2_lng = s_lng + dlng * 0.68 + perp_lng * offset_scale * bias * 0.85 * factor
        return [[s_lat, s_lng], [round(m1_lat, 6), round(m1_lng, 6)], [round(m2_lat, 6), round(m2_lng, 6)], [d_lat, d_lng]]

    templates = [
        {
            "key": "shortest",
            "pts": _corridor_pts(-0.45),
            "mult": 1.0,
            "roads": [
                f"{src_place['name'].split(' (')[0]} Express Cut" if not is_intercity else "Direct Express Highway Cut",
                "Outer Bypass / Ring Shortcut",
                f"{dst_place['name'].split(' (')[0]} Direct Spur",
            ],
            "factors": [
                {"lighting": 3.4, "crowd": 3.2, "cctv": 2.8, "emergency": 4.2, "isolation": 7.6, "incident_risk": 7.2, "night_light_drop": 1.5, "night_crowd_drop": 1.6},
                {"lighting": 2.9, "crowd": 2.5, "cctv": 2.2, "emergency": 3.8, "isolation": 8.2, "incident_risk": 7.6, "night_light_drop": 1.6, "night_crowd_drop": 1.4},
                {"lighting": 5.8, "crowd": 6.0, "cctv": 5.4, "emergency": 5.9, "isolation": 4.1, "incident_risk": 4.2, "night_light_drop": 1.0, "night_crowd_drop": 1.5},
            ],
        },
        {
            "key": "safety",
            "pts": _corridor_pts(1.25),
            "mult": 1.24,
            "roads": [
                f"{city_lbl} Lit Civic Avenue" if not is_intercity else "Patrolled National Highway Toll Corridor",
                "CCTV Police Patrol Arterial Boulevard",
                f"{dst_place['name'].split(' (')[0]} Commercial Main Rd",
            ],
            "factors": [
                {"lighting": 9.1, "crowd": 8.6, "cctv": 9.0, "emergency": 9.2, "isolation": 1.5, "incident_risk": 1.6, "night_light_drop": 0.3, "night_crowd_drop": 1.0},
                {"lighting": 9.3, "crowd": 8.8, "cctv": 9.4, "emergency": 9.5, "isolation": 1.4, "incident_risk": 1.5, "night_light_drop": 0.2, "night_crowd_drop": 0.9},
                {"lighting": 8.7, "crowd": 8.9, "cctv": 8.6, "emergency": 8.4, "isolation": 1.8, "incident_risk": 2.0, "night_light_drop": 0.4, "night_crowd_drop": 1.1},
            ],
        },
        {
            "key": "fixed",
            "pts": _corridor_pts(0.55),
            "mult": 1.10,
            "roads": [
                "Main Arterial Connector",
                "Mid-Town Commercial Highway",
                f"{dst_place['name'].split(' (')[0]} Access Avenue",
            ],
            "factors": [
                {"lighting": 7.5, "crowd": 7.3, "cctv": 7.0, "emergency": 7.2, "isolation": 3.0, "incident_risk": 3.2, "night_light_drop": 0.7, "night_crowd_drop": 1.4},
                {"lighting": 6.8, "crowd": 6.6, "cctv": 6.4, "emergency": 6.9, "isolation": 3.6, "incident_risk": 3.8, "night_light_drop": 0.9, "night_crowd_drop": 1.6},
                {"lighting": 7.9, "crowd": 7.8, "cctv": 7.5, "emergency": 7.6, "isolation": 2.6, "incident_risk": 2.7, "night_light_drop": 0.5, "night_crowd_drop": 1.3},
            ],
        },
        {
            "key": "adaptive_fast",
            "pts": _corridor_pts(0.88),
            "mult": 1.14,
            "roads": [
                "Active Commercial Corridor",
                "Police-Covered Safe Arterial Link",
                f"{dst_place['name'].split(' (')[0]} Lit Approach",
            ],
            "factors": [
                {"lighting": 8.8, "crowd": 8.5, "cctv": 8.7, "emergency": 8.6, "isolation": 1.8, "incident_risk": 1.9, "night_light_drop": 0.3, "night_crowd_drop": 1.1},
                {"lighting": 8.6, "crowd": 8.2, "cctv": 8.4, "emergency": 8.8, "isolation": 2.0, "incident_risk": 2.1, "night_light_drop": 0.4, "night_crowd_drop": 1.2},
                {"lighting": 8.4, "crowd": 8.6, "cctv": 8.3, "emergency": 8.1, "isolation": 2.1, "incident_risk": 2.2, "night_light_drop": 0.4, "night_crowd_drop": 1.1},
            ],
        },
    ]

    candidates = []
    for tpl in templates:
        pts = tpl["pts"]
        segs = []
        for idx in range(3):
            seg_id = f"uni_{tpl['key']}_{idx + 1}"
            u_lbl = src_place["name"] if idx == 0 else f"Corridor Waypoint {idx}"
            v_lbl = dst_place["name"] if idx == 2 else f"Corridor Waypoint {idx + 1}"
            segs.append(
                _make_synthetic_segment(
                    seg_id=seg_id,
                    road=tpl["roads"][idx],
                    u_id=f"{src_place['id']}_{idx}",
                    v_id=f"{dst_place['id']}_{idx + 1}",
                    u_name=u_lbl,
                    v_name=v_lbl,
                    coords=[pts[idx], pts[idx + 1]],
                    raw_factors=tpl["factors"][idx],
                    time_of_day=time_of_day,
                    disruptions=disruptions,
                    norm_weights=norm_weights,
                    travel_mode=mode,
                    dist_override=max(0.15, (direct_km * tpl["mult"]) / 3.0),
                )
            )
        t_dist = round(sum(s["dist"] for s in segs), 2)
        t_time = round(sum(s["time"] for s in segs), 1)
        s_score = round(sum(s["safety_score"] * s["dist"] for s in segs) / (t_dist or 1.0), 1)
        min_seg = round(min(s["safety_score"] for s in segs), 1)
        hr_cnt = sum(1 for s in segs if s["is_high_risk"])
        f_avgs = {
            fk: round(sum(s["eff"][fk] * s["dist"] for s in segs) / (t_dist or 1.0), 1)
            for fk in DEFAULT_FACTOR_WEIGHTS
        }
        candidates.append({
            "key": tpl["key"],
            "nodes": [src_place["id"], dst_place["id"]],
            "node_names": [src_place["name"], dst_place["name"]],
            "segments": segs,
            "total_dist": t_dist,
            "total_time": t_time,
            "safety_score": s_score,
            "min_seg_safety": min_seg,
            "high_risk_count": hr_cnt,
            "factor_avgs": f_avgs,
            "is_pareto": True,
        })

    shortest = min(candidates, key=lambda c: (c["total_time"], -c["safety_score"]))
    safety_only = max(candidates, key=lambda c: (c["safety_score"], -c["total_time"]))
    w_fs = clamp(float(fixed_safety_weight), 0.0, 1.0)
    w_ft = round(1.0 - w_fs, 2)
    ref_min_t = shortest["total_time"]
    ref_max_t = max(safety_only["total_time"], ref_min_t + 1.0)
    ref_t_span = ref_max_t - ref_min_t
    fixed_weighted = min(
        candidates,
        key=lambda c: w_fs * (1.0 - c["safety_score"] / 100.0) + w_ft * clamp((c["total_time"] - ref_min_t) / ref_t_span, 0.0, 1.5),
    )

    if emergency_mode:
        adaptive_safety_w = 0.98
        adaptive_time_w = 0.02
    else:
        pref_base = 0.25 + (clamp(float(risk_preference), 0.0, 100.0) / 100.0) * 0.40
        time_boost = 0.24 if time_of_day == "night" else (0.12 if time_of_day == "evening" else 0.0)
        mode_boost = TRAVEL_MODE_CONFIG[mode]["adaptive_boost"]
        sens_delta = ((clamp(float(overall_sens_balance), 0.0, 100.0) - 50.0) / 50.0) * 0.15
        disruption_boost = 0.16 if disruptions else 0.0
        adaptive_safety_w = round(clamp(pref_base + time_boost + mode_boost + sens_delta + disruption_boost, 0.22, 0.92), 2)
        adaptive_time_w = round(1.0 - adaptive_safety_w, 2)

    zero_risk_pool = [c for c in candidates if c["high_risk_count"] == 0]
    pool = zero_risk_pool if zero_risk_pool else candidates
    ref_min_s = shortest["safety_score"]
    ref_max_s = max(safety_only["safety_score"], ref_min_s + 1.0)
    ref_s_span = ref_max_s - ref_min_s

    best_adaptive = None
    best_utility = -1e9
    for c in pool:
        u_safe = clamp((c["safety_score"] - ref_min_s) / ref_s_span, 0.0, 1.0)
        u_time = clamp((ref_max_t - c["total_time"]) / ref_t_span, 0.0, 1.0)
        utility = adaptive_safety_w * u_safe + adaptive_time_w * u_time + (c["min_seg_safety"] / 100.0) * 0.14 + 0.05
        if utility > best_utility:
            best_utility = utility
            best_adaptive = {**c, "utility": round(utility, 4)}

    strategies_dict = {
        "shortest": dict(shortest),
        "safety": dict(safety_only),
        "fixed": dict(fixed_weighted),
        "adaptive": dict(best_adaptive),
    }
    strategies_dict["shortest"]["reason"] = (
        f"Fastest path ({shortest['total_time']} min), "
        + (f"but traverses {shortest['high_risk_count']} high-risk segment(s)." if shortest["high_risk_count"] > 0 else "with acceptable baseline safety.")
    )
    strategies_dict["safety"]["reason"] = (
        f"Peak safety ({safety_only['safety_score']}/100) via patrolled lit highways, taking {safety_only['total_time']} min."
    )
    strategies_dict["fixed"]["reason"] = (
        f"Static {int(w_fs*100)}/{int(w_ft*100)} linear trade-off ({fixed_weighted['safety_score']}/100, {fixed_weighted['total_time']} min)."
    )
    t_diff = round(best_adaptive["total_time"] - shortest["total_time"], 1)
    s_gain = round(best_adaptive["safety_score"] - shortest["safety_score"], 1)
    adapt_reason = f"Adds +{t_diff} min over Fastest while gaining +{s_gain} safety pts along active lit corridors."
    strategies_dict["adaptive"]["reason"] = adapt_reason

    tie_priority = {"adaptive": 0, "fixed": 1, "safety": 2, "shortest": 3}
    for idx, k in enumerate(sorted(["adaptive", "fixed", "safety", "shortest"], key=lambda kk: (strategies_dict[kk]["high_risk_count"], -strategies_dict[kk]["safety_score"], tie_priority[kk])), start=1):
        strategies_dict[k]["rank"] = idx

    pareto_points = sorted(
        [{"time": c["total_time"], "safety": c["safety_score"], "key": c["key"]} for c in candidates],
        key=lambda p: p["time"],
    )

    return {
        "norm_weights": norm_weights,
        "strategies": strategies_dict,
        "pareto_points": pareto_points,
        "adaptive_meta": {
            "adaptive_safety_w": adaptive_safety_w,
            "adaptive_time_w": adaptive_time_w,
            "travel_mode": mode,
            "travel_mode_label": TRAVEL_MODE_CONFIG[mode]["label"],
            "soft_constraint_applied": bool(zero_risk_pool),
            "explanation": adapt_reason,
            "universal_routing": True,
        },
        "eff_edges": [],
    }


def evaluate_strategies(
    source: str = "majestic",
    dest: str = "koramangala",
    time_of_day: str = "night",
    travel_mode: str = "car",
    risk_preference: float = 50.0,
    fixed_safety_weight: float = 0.70,
    factor_weights: dict[str, float] | None = None,
    overall_sens_balance: float = 50.0,
    disruptions: dict[str, dict[str, float]] | None = None,
    emergency_mode: bool = False,
    source_place: dict[str, Any] | None = None,
    dest_place: dict[str, Any] | None = None,
) -> dict[str, Any]:
    mode = travel_mode if travel_mode in TRAVEL_MODE_CONFIG else "car"
    disruptions = disruptions or {}
    norm_weights = normalize_weights(factor_weights or DEFAULT_FACTOR_WEIGHTS)

    src_obj = _resolve_place_obj(source_place, source)
    dst_obj = _resolve_place_obj(dest_place, dest)

    if haversine_km(src_obj["lat"], src_obj["lng"], dst_obj["lat"], dst_obj["lng"]) < 0.05 and src_obj["id"] == dst_obj["id"]:
        raise ValueError("Source and destination must be two distinct locations.")

    src_near_hub = min(LOCATIONS, key=lambda l: haversine_km(src_obj["lat"], src_obj["lng"], l["lat"], l["lng"]))
    dst_near_hub = min(LOCATIONS, key=lambda l: haversine_km(dst_obj["lat"], dst_obj["lng"], l["lat"], l["lng"]))
    src_hub_dist = haversine_km(src_obj["lat"], src_obj["lng"], src_near_hub["lat"], src_near_hub["lng"])
    dst_hub_dist = haversine_km(dst_obj["lat"], dst_obj["lng"], dst_near_hub["lat"], dst_near_hub["lng"])

    use_graph = (
        source in LOCATION_MAP
        and dest in LOCATION_MAP
        and source_place is None
        and dest_place is None
    ) or (
        src_hub_dist <= 8.5
        and dst_hub_dist <= 8.5
        and src_near_hub["id"] != dst_near_hub["id"]
    )

    if not use_graph:
        return _evaluate_universal_corridors(
            src_place=src_obj,
            dst_place=dst_obj,
            time_of_day=time_of_day,
            mode=mode,
            risk_preference=risk_preference,
            fixed_safety_weight=fixed_safety_weight,
            norm_weights=norm_weights,
            overall_sens_balance=overall_sens_balance,
            disruptions=disruptions,
            emergency_mode=emergency_mode,
        )

    eff_src = source if (source in LOCATION_MAP and source_place is None) else src_near_hub["id"]
    eff_dst = dest if (dest in LOCATION_MAP and dest_place is None) else dst_near_hub["id"]
    source = eff_src
    dest = eff_dst
    eff_edges = [compute_effective_edge(e, time_of_day, disruptions, norm_weights, mode) for e in BASE_EDGES]

    adj: dict[str, list[tuple[str, dict[str, Any]]]] = {loc["id"]: [] for loc in LOCATIONS}
    for edge in eff_edges:
        adj[edge["from"]].append((edge["to"], edge))
        adj[edge["to"]].append((edge["from"], edge))

    raw_paths = enumerate_candidate_paths(adj, source, dest, max_hops=6)
    scored_map: dict[str, dict[str, Any]] = {}
    for p in raw_paths:
        scored = score_candidate_path(p)
        if scored["key"] not in scored_map:
            scored_map[scored["key"]] = scored

    candidates = mark_pareto_frontier(list(scored_map.values()))

    # Strategy 1: Shortest / Fastest Route
    shortest = min(candidates, key=lambda c: (c["total_time"], -c["safety_score"]))

    # Strategy 2: Safety-Only Route
    safety_only = max(candidates, key=lambda c: (c["safety_score"], -c["total_time"]))

    # Strategy 3: Fixed Weighted Safety + Time Route
    w_fs = clamp(float(fixed_safety_weight), 0.0, 1.0)
    w_ft = round(1.0 - w_fs, 2)
    ref_min_t = shortest["total_time"]
    ref_max_t = max(safety_only["total_time"], ref_min_t + 1.0)
    ref_t_span = ref_max_t - ref_min_t
    fixed_weighted = min(
        candidates,
        key=lambda c: w_fs * (1.0 - c["safety_score"] / 100.0) + w_ft * clamp((c["total_time"] - ref_min_t) / ref_t_span, 0.0, 1.5),
    )

    # Strategy 4: Adaptive / Multi-Objective Route (Proposed Method)
    if emergency_mode:
        adaptive_safety_w = 0.98
        adaptive_time_w = 0.02
    else:
        pref_base = 0.25 + (clamp(float(risk_preference), 0.0, 100.0) / 100.0) * 0.40
        time_boost = 0.24 if time_of_day == "night" else (0.12 if time_of_day == "evening" else 0.0)
        mode_boost = TRAVEL_MODE_CONFIG[mode]["adaptive_boost"]
        sens_delta = ((clamp(float(overall_sens_balance), 0.0, 100.0) - 50.0) / 50.0) * 0.15
        disruption_boost = 0.16 if disruptions else 0.0

        adaptive_safety_w = round(clamp(pref_base + time_boost + mode_boost + sens_delta + disruption_boost, 0.22, 0.92), 2)
        adaptive_time_w = round(1.0 - adaptive_safety_w, 2)

    zero_risk_pool = [c for c in candidates if c["high_risk_count"] == 0]
    min_hr = min(c["high_risk_count"] for c in candidates)
    adaptive_pool = zero_risk_pool if zero_risk_pool else [c for c in candidates if c["high_risk_count"] == min_hr]

    ref_min_s = shortest["safety_score"]
    ref_max_s = max(safety_only["safety_score"], ref_min_s + 1.0)
    ref_s_span = ref_max_s - ref_min_s

    best_adaptive = None
    best_utility = -1e9
    weakest_coef = 0.26 if emergency_mode else 0.14
    for c in adaptive_pool:
        u_safe = clamp((c["safety_score"] - ref_min_s) / ref_s_span, 0.0, 1.0)
        u_time = clamp((ref_max_t - c["total_time"]) / ref_t_span, 0.0, 1.0)
        weakest_bonus = (c["min_seg_safety"] / 100.0) * weakest_coef
        pareto_bonus = 0.05 if c["is_pareto"] else 0.0
        utility = adaptive_safety_w * u_safe + adaptive_time_w * u_time + weakest_bonus + pareto_bonus
        if utility > best_utility:
            best_utility = utility
            best_adaptive = {**c, "utility": round(utility, 4)}

    adaptive = best_adaptive

    def _attach_custom_spurs(route_dict: dict[str, Any]) -> dict[str, Any]:
        segs = list(route_dict["segments"])
        names = list(route_dict["node_names"])
        changed = False
        if source_place and src_hub_dist > 0.08:
            changed = True
            spur_in = _make_synthetic_segment(
                seg_id=f"spur_in_{src_near_hub['id']}",
                road=f"Approach from {src_obj['name'].split(' (')[0]}",
                u_id=src_obj["id"],
                v_id=src_near_hub["id"],
                u_name=src_obj["name"],
                v_name=src_near_hub["name"],
                coords=[[src_obj["lat"], src_obj["lng"]], [src_near_hub["lat"], src_near_hub["lng"]]],
                raw_factors={"lighting": 7.8, "crowd": 7.6, "cctv": 7.4, "emergency": 7.6, "isolation": 2.4, "incident_risk": 2.5, "night_light_drop": 0.5, "night_crowd_drop": 1.3},
                time_of_day=time_of_day,
                disruptions=disruptions,
                norm_weights=norm_weights,
                travel_mode=mode,
                dist_override=src_hub_dist,
            )
            segs.insert(0, spur_in)
            names.insert(0, src_obj["name"])
        if dest_place and dst_hub_dist > 0.08:
            changed = True
            spur_out = _make_synthetic_segment(
                seg_id=f"spur_out_{dst_near_hub['id']}",
                road=f"Last-Mile → {dst_obj['name'].split(' (')[0]}",
                u_id=dst_near_hub["id"],
                v_id=dst_obj["id"],
                u_name=dst_near_hub["name"],
                v_name=dst_obj["name"],
                coords=[[dst_near_hub["lat"], dst_near_hub["lng"]], [dst_obj["lat"], dst_obj["lng"]]],
                raw_factors={"lighting": 8.0, "crowd": 8.2, "cctv": 7.6, "emergency": 7.8, "isolation": 2.1, "incident_risk": 2.3, "night_light_drop": 0.5, "night_crowd_drop": 1.2},
                time_of_day=time_of_day,
                disruptions=disruptions,
                norm_weights=norm_weights,
                travel_mode=mode,
                dist_override=dst_hub_dist,
            )
            segs.append(spur_out)
            names.append(dst_obj["name"])
        if not changed:
            return dict(route_dict)
        t_dist = round(sum(s["dist"] for s in segs), 2)
        t_time = round(sum(s["time"] for s in segs), 1)
        s_score = round(sum(s["safety_score"] * s["dist"] for s in segs) / (t_dist or 1.0), 1)
        return {
            **route_dict,
            "node_names": names,
            "segments": segs,
            "total_dist": t_dist,
            "total_time": t_time,
            "safety_score": s_score,
            "min_seg_safety": round(min(s["safety_score"] for s in segs), 1),
            "high_risk_count": sum(1 for s in segs if s["is_high_risk"]),
        }

    # Assign rankings (1 = best overall adaptive utility / safety-time balance) & recommendation reasons
    strategies_dict = {
        "shortest": _attach_custom_spurs(shortest),
        "safety": _attach_custom_spurs(safety_only),
        "fixed": _attach_custom_spurs(fixed_weighted),
        "adaptive": _attach_custom_spurs(adaptive),
    }

    # Build concise recommendation reasons per strategy
    strategies_dict["shortest"]["reason"] = (
        f"Fastest arrival ({shortest['total_time']} min), "
        + (f"but traverses {shortest['high_risk_count']} high-risk segment(s)." if shortest["high_risk_count"] > 0 else "with acceptable baseline safety.")
    )
    strategies_dict["safety"]["reason"] = (
        f"Peak safety ({safety_only['safety_score']}/100) by maximizing bright arterial corridors, taking {safety_only['total_time']} min."
    )
    strategies_dict["fixed"]["reason"] = (
        f"Static {int(w_fs*100)}/{int(w_ft*100)} linear trade-off ({fixed_weighted['safety_score']}/100, {fixed_weighted['total_time']} min) without dynamic risk guardrails."
    )

    t_diff = round(adaptive["total_time"] - shortest["total_time"], 1)
    s_gain = round(adaptive["safety_score"] - shortest["safety_score"], 1)
    t_saved = round(safety_only["total_time"] - adaptive["total_time"], 1)
    hr_avoided = shortest["high_risk_count"] - adaptive["high_risk_count"]

    if emergency_mode:
        adapt_reason = (
            f"EMERGENCY MODE OVERRIDE (98% Safety / 2% Time): Highest-safety corridor selected "
            f"({adaptive['safety_score']}/100, {adaptive['total_time']} min, {adaptive['high_risk_count']} high-risk segments)."
        )
    elif adaptive["key"] == shortest["key"]:
        adapt_reason = f"Pareto-optimal: matches fastest time ({adaptive['total_time']} min) while maintaining {adaptive['safety_score']}/100 safety and {adaptive['high_risk_count']} high-risk segments."
    else:
        parts = [f"Adds +{t_diff} min over Fastest while gaining +{s_gain} safety pts"]
        if hr_avoided > 0:
            parts.append(f"eliminating {hr_avoided} high-risk segment(s)")
        if t_saved > 0.5:
            parts.append(f"and saving {t_saved} min vs. Safety-Only")
        adapt_reason = ", ".join(parts) + "."
    strategies_dict["adaptive"]["reason"] = adapt_reason

    # Rank all 4 strategies by multi-objective quality score (for table/cards)
    tie_priority = {"adaptive": 0, "fixed": 1, "safety": 2, "shortest": 3}
    rank_order = sorted(
        ["adaptive", "fixed", "safety", "shortest"],
        key=lambda k: (
            strategies_dict[k]["high_risk_count"],
            -round(
                adaptive_safety_w * clamp((strategies_dict[k]["safety_score"] - ref_min_s) / ref_s_span, 0.0, 1.0)
                + adaptive_time_w * clamp((ref_max_t - strategies_dict[k]["total_time"]) / ref_t_span, 0.0, 1.0)
                + (strategies_dict[k]["min_seg_safety"] / 100.0) * 0.14
                + (0.05 if strategies_dict[k].get("is_pareto") else 0.0),
                4,
            ),
            tie_priority[k],
        ),
    )
    for idx, key in enumerate(rank_order, start=1):
        strategies_dict[key]["rank"] = idx

    pareto_points = sorted(
        [{"time": c["total_time"], "safety": c["safety_score"], "key": c["key"]} for c in candidates if c["is_pareto"]],
        key=lambda p: p["time"],
    )

    return {
        "norm_weights": norm_weights,
        "strategies": strategies_dict,
        "pareto_points": pareto_points,
        "adaptive_meta": {
            "adaptive_safety_w": adaptive_safety_w,
            "adaptive_time_w": adaptive_time_w,
            "travel_mode": mode,
            "travel_mode_label": TRAVEL_MODE_CONFIG[mode]["label"],
            "soft_constraint_applied": bool(zero_risk_pool and any(c["high_risk_count"] > 0 for c in candidates)),
            "explanation": adapt_reason,
        },
        "eff_edges": eff_edges,
    }


def compute_sensitivity_tornado(params: dict[str, Any]) -> list[dict[str, Any]]:
    """Compute Safety Score swing for each factor when varied from low (2%) to high (65%)."""
    base_res = evaluate_strategies(**params)
    base_score = base_res["strategies"]["adaptive"]["safety_score"]
    base_weights = params.get("factor_weights") or dict(DEFAULT_FACTOR_WEIGHTS)

    tornado = []
    for key, label in FACTOR_LABELS.items():
        low_w = {**base_weights, key: 0.02}
        high_w = {**base_weights, key: 0.65}
        low_score = evaluate_strategies(**{**params, "factor_weights": low_w})["strategies"]["adaptive"]["safety_score"]
        high_score = evaluate_strategies(**{**params, "factor_weights": high_w})["strategies"]["adaptive"]["safety_score"]

        tornado.append({
            "key": key,
            "label": label,
            "low_delta": round(low_score - base_score, 1),
            "high_delta": round(high_score - base_score, 1),
            "swing": round(abs(high_score - low_score), 1),
        })

    tornado.sort(key=lambda item: item["swing"], reverse=True)
    return tornado


def simulate_robustness_change(params: dict[str, Any]) -> dict[str, Any]:
    """Degrade lighting, spike risk, and drop crowd on 2–3 active segments and compare reactions."""
    baseline = evaluate_strategies(**{**params, "disruptions": {}})
    base_strats = baseline["strategies"]
    safety_only_ids = {seg["id"] for seg in base_strats["safety"]["segments"]}

    # Target segments used by Shortest & Fixed routes (keeping Safety-Only arterial bypasses intact so Adaptive can re-route)
    pool_dict: dict[str, dict[str, Any]] = {}
    for seg in base_strats["shortest"]["segments"] + base_strats["fixed"]["segments"]:
        pool_dict[seg["id"]] = seg

    pool = list(pool_dict.values())
    bypass_pool = [s for s in pool if s["id"] not in safety_only_ids]
    candidates = bypass_pool if len(bypass_pool) >= 2 else pool

    random.shuffle(candidates)
    chosen = candidates[: min(3, max(1, len(candidates)))]

    disruptions: dict[str, dict[str, float]] = {}
    disruption_logs: list[str] = []
    for idx, seg in enumerate(chosen):
        l_delta = -(3.2 + (idx % 2) * 0.7)
        r_delta = +(3.3 + (idx % 2) * 0.6)
        c_delta = -2.4
        disruptions[seg["id"]] = {"lighting_delta": l_delta, "risk_delta": r_delta, "crowd_delta": c_delta}
        disruption_logs.append(
            f"{seg['road']} ({seg['from_name'].split(' ')[0]} ↔ {seg['to_name'].split(' ')[0]}): "
            f"Lighting {l_delta:+.1f}, Incident Risk {r_delta:+.1f}, Crowd {c_delta:+.1f}"
        )

    after = evaluate_strategies(**{**params, "disruptions": disruptions})
    after_strats = after["strategies"]

    comparison = []
    for key in ["shortest", "safety", "fixed", "adaptive"]:
        b = base_strats[key]
        a = after_strats[key]
        comparison.append({
            "strategy": key,
            "baseline_safety": b["safety_score"],
            "after_safety": a["safety_score"],
            "delta": round(a["safety_score"] - b["safety_score"], 1),
            "high_risk_count": a["high_risk_count"],
            "rerouted": a["key"] != b["key"],
            "after_time": a["total_time"],
        })

    return {
        "disruptions": disruptions,
        "logs": disruption_logs,
        "comparison": comparison,
        "after_analysis": after,
    }


# -----------------------------------------------------------------------------
# 3B. Emergency SOS: Nearest Police Station Detection & Max-Safety Rerouting
# -----------------------------------------------------------------------------
def _mode_speed_kmh(mode: str) -> float:
    if mode == "walk":
        return float(TRAVEL_MODE_CONFIG["walk"]["speed_kmh"])
    if mode == "bike":
        return 22.0
    return 24.0


def find_nearest_police_station(lat: float, lng: float) -> dict[str, Any]:
    """Identify the closest police station from EMERGENCY_POIS and its host network hub."""
    police_list = [p for p in EMERGENCY_POIS if p.get("type") == "police"]
    if not police_list:
        raise ValueError("No police stations available in emergency facilities registry.")

    ranked_stations = sorted(
        police_list,
        key=lambda p: haversine_km(lat, lng, float(p["lat"]), float(p["lng"])),
    )
    nearest = ranked_stations[0]
    direct_dist_km = round(haversine_km(lat, lng, float(nearest["lat"]), float(nearest["lng"])), 2)

    ranked_hubs = sorted(
        LOCATIONS,
        key=lambda loc: haversine_km(float(nearest["lat"]), float(nearest["lng"]), float(loc["lat"]), float(loc["lng"])),
    )
    host_hub = ranked_hubs[0]

    # Determine a distinct backup police station hub in case user is already at host_hub
    backup_hub = ranked_hubs[1]
    for cand in ranked_stations[1:]:
        cand_hub = min(
            LOCATIONS,
            key=lambda loc: haversine_km(float(cand["lat"]), float(cand["lng"]), float(loc["lat"]), float(loc["lng"])),
        )
        if cand_hub["id"] != host_hub["id"]:
            backup_hub = cand_hub
            break

    return {
        "station": nearest,
        "dist_km": direct_dist_km,
        "hub_id": host_hub["id"],
        "hub_name": host_hub["name"],
        "backup_hub_id": backup_hub["id"],
    }


def activate_emergency_sos(
    params: dict[str, Any],
    current_lat: float | None = None,
    current_lng: float | None = None,
    detected_location_name: str = "",
    profile_override: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Detect user's location, locate nearest police station, compute max-safety route, and persist dispatch record."""
    if isinstance(profile_override, dict) and any(str(v).strip() for v in profile_override.values() if v is not None):
        profile = save_citizen_profile(profile_override)
    else:
        profile = get_citizen_profile()

    src_obj = _resolve_place_obj(params.get("source_place"), params.get("source", "majestic"))
    dst_obj = _resolve_place_obj(params.get("dest_place"), params.get("dest", "koramangala"))

    cur_lat = float(current_lat) if current_lat is not None else float(src_obj["lat"])
    cur_lng = float(current_lng) if current_lng is not None else float(src_obj["lng"])
    loc_label = (detected_location_name or "").strip() or src_obj["name"]

    police_info = find_nearest_police_station(cur_lat, cur_lng)
    station = police_info["station"]
    police_hub_id = police_info["hub_id"]
    mode = params.get("travel_mode", "car")
    speed_kmh = _mode_speed_kmh(mode)

    eval_base = {
        "source": src_obj["id"] if src_obj["id"] in LOCATION_MAP else "majestic",
        "time_of_day": params.get("time_of_day", "night"),
        "travel_mode": mode,
        "risk_preference": 100.0,
        "fixed_safety_weight": params.get("fixed_safety_weight", 0.70),
        "factor_weights": params.get("factor_weights") or dict(DEFAULT_FACTOR_WEIGHTS),
        "overall_sens_balance": 100.0,
        "disruptions": params.get("disruptions") or {},
        "emergency_mode": True,
    }

    norm_weights = normalize_weights(eval_base["factor_weights"])
    nearest_grid_dist = min(haversine_km(cur_lat, cur_lng, l["lat"], l["lng"]) for l in LOCATIONS)
    station_grid_dist = haversine_km(
        float(station["lat"]),
        float(station["lng"]),
        float(LOCATION_MAP[police_hub_id]["lat"]),
        float(LOCATION_MAP[police_hub_id]["lng"]),
    )

    if nearest_grid_dist > 12.0 or station_grid_dist > 14.0:
        cur_place = {
            "id": "sos_origin",
            "name": loc_label,
            "area": src_obj.get("area", "India"),
            "city": src_obj.get("city", "India"),
            "category": "hub",
            "lat": cur_lat,
            "lng": cur_lng,
        }
        station_place = {
            "id": "sos_police",
            "name": station["name"],
            "area": station.get("city", "Police Station"),
            "city": station.get("city", "India"),
            "category": "police",
            "lat": float(station["lat"]),
            "lng": float(station["lng"]),
        }
        analysis = _evaluate_universal_corridors(
            src_place=cur_place,
            dst_place=station_place,
            time_of_day=eval_base["time_of_day"],
            mode=mode,
            risk_preference=100.0,
            fixed_safety_weight=eval_base["fixed_safety_weight"],
            norm_weights=norm_weights,
            overall_sens_balance=100.0,
            disruptions=eval_base["disruptions"],
            emergency_mode=True,
        )
        tornado = compute_sensitivity_tornado({
            **eval_base,
            "source": "sos_origin",
            "dest": "sos_police",
            "source_place": cur_place,
            "dest_place": station_place,
        })
        emergency_route = {
            **analysis["strategies"]["adaptive"],
            "dest_label": station["name"],
            "reason": (
                f"ACTIVE EMERGENCY ROUTE (98% Safety Priority): Direct lit arterial path to {station['name']} "
                f"({police_info['dist_km']} km, Safety {analysis['strategies']['adaptive']['safety_score']}/100)."
            ),
        }
        comparison_dest_name = station["name"]
    elif police_hub_id != eval_base["source"] and haversine_km(
        cur_lat, cur_lng, float(LOCATION_MAP[police_hub_id]["lat"]), float(LOCATION_MAP[police_hub_id]["lng"])
    ) > 0.6:
        cur_hub = min(LOCATIONS, key=lambda l: haversine_km(cur_lat, cur_lng, float(l["lat"]), float(l["lng"])))
        src_hub_id = cur_hub["id"] if cur_hub["id"] != police_hub_id else eval_base["source"]
        if src_hub_id == police_hub_id:
            src_hub_id = police_info["backup_hub_id"]
        analysis = evaluate_strategies(**{**eval_base, "source": src_hub_id, "dest": police_hub_id})
        tornado = compute_sensitivity_tornado({**eval_base, "source": src_hub_id, "dest": police_hub_id})
        adapt_base = analysis["strategies"]["adaptive"]

        hub_loc = LOCATION_MAP[police_hub_id]
        spur_km = round(max(0.15, haversine_km(hub_loc["lat"], hub_loc["lng"], float(station["lat"]), float(station["lng"]))), 2)
        spur_min = round(max(1.0, (spur_km / speed_kmh) * 60.0), 1)
        spur_seg = {
            "id": "sos_final",
            "road": f"Police Access → {station['name']}",
            "from": police_hub_id,
            "to": "sos_police",
            "from_name": hub_loc["name"],
            "to_name": station["name"],
            "dist": spur_km,
            "time": spur_min,
            "safety_score": 95.0,
            "is_high_risk": False,
            "is_disrupted": False,
            "eff": {
                "lighting": 9.5,
                "crowd": 8.6,
                "cctv": 9.8,
                "emergency": 10.0,
                "isolation": 1.0,
                "incident_risk": 1.0,
                "isolation_inv": 9.0,
                "risk_inv": 9.0,
            },
            "coords": [[hub_loc["lat"], hub_loc["lng"]], [float(station["lat"]), float(station["lng"])]],
        }
        em_segments = [*adapt_base["segments"], spur_seg]
        em_dist = round(adapt_base["total_dist"] + spur_km, 2)
        em_time = round(adapt_base["total_time"] + spur_min, 1)
        safe_div = em_dist if em_dist > 0 else 1.0
        em_safety = round(sum(seg["safety_score"] * seg["dist"] for seg in em_segments) / safe_div, 1)

        emergency_route = {
            **adapt_base,
            "dest_label": station["name"],
            "node_names": [loc_label, *adapt_base["node_names"][1:], station["name"]],
            "segments": em_segments,
            "total_dist": em_dist,
            "total_time": em_time,
            "safety_score": em_safety,
            "reason": (
                f"ACTIVE EMERGENCY ROUTE (98% Safety Priority): Guides you via {len(em_segments)} safe arterial segments "
                f"to {station['name']} ({em_safety}/100 safety, {em_time} min)."
            ),
        }
        comparison_dest_name = f"{station['name']} (via {hub_loc['name'].split(' (')[0]})"
    else:
        backup_hub = police_info["backup_hub_id"]
        analysis = evaluate_strategies(**{**eval_base, "source": police_hub_id, "dest": backup_hub})
        tornado = compute_sensitivity_tornado({**eval_base, "source": police_hub_id, "dest": backup_hub})

        adj_edges = [
            compute_effective_edge(e, eval_base["time_of_day"], eval_base["disruptions"], norm_weights, mode)
            for e in BASE_EDGES
            if e["from"] == police_hub_id or e["to"] == police_hub_id
        ]
        safest_adj = max(adj_edges, key=lambda e: e["safety_score"]) if adj_edges else None
        local_safety = round(max(86.0, safest_adj["safety_score"] if safest_adj else 90.0), 1)
        direct_km = round(max(0.25, police_info["dist_km"]), 2)
        direct_min = round(max(1.5, (direct_km / speed_kmh) * 60.0), 1)

        direct_seg = {
            "id": "sos_direct",
            "road": f"Emergency Police Approach → {station['name']}",
            "from": police_hub_id,
            "to": "sos_police",
            "from_name": loc_label,
            "to_name": station["name"],
            "dist": direct_km,
            "time": direct_min,
            "safety_score": local_safety,
            "is_high_risk": False,
            "is_disrupted": False,
            "eff": {
                "lighting": 9.2,
                "crowd": 8.4,
                "cctv": 9.4,
                "emergency": 10.0,
                "isolation": 1.2,
                "incident_risk": 1.4,
                "isolation_inv": 8.8,
                "risk_inv": 8.6,
            },
            "coords": [[cur_lat, cur_lng], [float(station["lat"]), float(station["lng"])]],
        }
        emergency_route = {
            "key": f"{police_hub_id}->sos_police",
            "nodes": [police_hub_id, "sos_police"],
            "node_names": [loc_label, station["name"]],
            "dest_label": station["name"],
            "segments": [direct_seg],
            "total_dist": direct_km,
            "total_time": direct_min,
            "safety_score": local_safety,
            "min_seg_safety": local_safety,
            "high_risk_count": 0,
            "is_pareto": True,
            "factor_avgs": {
                "lighting": 9.2,
                "crowd": 8.4,
                "cctv": 9.4,
                "emergency": 10.0,
                "isolation_inv": 8.8,
                "risk_inv": 8.6,
            },
            "reason": (
                f"IMMEDIATE POLICE PROXIMITY (98% Safety Priority): {station['name']} is only {direct_km} km away "
                f"({direct_min} min via {TRAVEL_MODE_CONFIG[mode]['label']}). Direct lit arterial approach selected."
            ),
        }
        comparison_dest_name = f"{LOCATION_MAP[backup_hub]['name']} (Patrol Benchmark)"

    incident_code = f"SP-SOS-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{random.randint(100, 999)}"
    now_ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    corridor_roads = " → ".join(seg["road"] for seg in emergency_route["segments"])

    citizen_name = profile["full_name"] or "Unregistered Citizen"
    citizen_phone = profile["phone"] or "Not Provided"
    fam_p_name = profile["family_primary_name"] or "Not Provided"
    fam_p_rel = profile["family_primary_relation"] or "Family"
    fam_p_phone = profile["family_primary_phone"] or "Not Provided"

    police_dispatch_packet = {
        "incident_code": incident_code,
        "status": "ACTIVE_DISPATCH",
        "dispatched_at": now_ts,
        "updated_at": now_ts,
        "citizen": {
            "full_name": citizen_name,
            "phone": citizen_phone,
            "age": profile["age"],
            "gender": profile["gender"],
            "blood_group": profile["blood_group"],
            "home_address": profile["home_address"],
            "medical_notes": profile["medical_notes"],
            "vehicle_info": profile["vehicle_info"],
        },
        "family_contacts": {
            "primary": {
                "name": fam_p_name,
                "relation": fam_p_rel,
                "phone": fam_p_phone,
                "alert_status": "DISPATCHED" if profile["family_primary_phone"] else "PENDING_CONTACT",
            },
            "secondary": {
                "name": profile["family_secondary_name"],
                "phone": profile["family_secondary_phone"],
                "alert_status": "DISPATCHED" if profile["family_secondary_phone"] else "NOT_SET",
            },
        },
        "live_location": {
            "lat": round(cur_lat, 6),
            "lng": round(cur_lng, 6),
            "address": loc_label,
            "intended_destination": dst_obj["name"],
            "travel_mode": mode,
            "maps_link": f"https://www.openstreetmap.org/?mlat={cur_lat:.6f}&mlon={cur_lng:.6f}#map=17/{cur_lat:.6f}/{cur_lng:.6f}",
        },
        "nearest_police": {
            "name": station["name"],
            "lat": float(station["lat"]),
            "lng": float(station["lng"]),
            "direct_dist_km": police_info["dist_km"],
            "city": station.get("city", "Bengaluru"),
        },
        "active_route": {
            "safety_score": emergency_route["safety_score"],
            "total_dist_km": emergency_route["total_dist"],
            "total_time_min": emergency_route["total_time"],
            "corridor_roads": corridor_roads,
        },
    }

    with _db_conn() as conn:
        conn.execute(
            """
            INSERT INTO sos_incidents (
                incident_code, status, created_at, updated_at,
                citizen_name, citizen_phone, citizen_age, citizen_gender,
                blood_group, medical_notes, home_address, vehicle_info,
                family_primary_name, family_primary_relation, family_primary_phone,
                family_secondary_name, family_secondary_phone,
                live_lat, live_lng, detected_location_name, destination_name, travel_mode,
                police_station_name, police_station_lat, police_station_lng, police_station_dist_km,
                route_safety_score, route_time_min, route_dist_km, route_corridor, dispatch_payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                incident_code,
                "ACTIVE_DISPATCH",
                now_ts,
                now_ts,
                citizen_name,
                citizen_phone,
                profile["age"],
                profile["gender"],
                profile["blood_group"],
                profile["medical_notes"],
                profile["home_address"],
                profile["vehicle_info"],
                fam_p_name,
                fam_p_rel,
                fam_p_phone,
                profile["family_secondary_name"],
                profile["family_secondary_phone"],
                round(cur_lat, 6),
                round(cur_lng, 6),
                loc_label,
                dst_obj["name"],
                mode,
                station["name"],
                float(station["lat"]),
                float(station["lng"]),
                police_info["dist_km"],
                emergency_route["safety_score"],
                emergency_route["total_time"],
                emergency_route["total_dist"],
                corridor_roads,
                json.dumps(police_dispatch_packet),
            ),
        )
        conn.commit()

    return {
        "emergency_active": True,
        "incident_code": incident_code,
        "dispatched_at": now_ts,
        "current_location": {
            "lat": cur_lat,
            "lng": cur_lng,
            "source_id": src_obj["id"],
            "source_name": loc_label,
        },
        "nearest_police": {
            "name": station["name"],
            "lat": float(station["lat"]),
            "lng": float(station["lng"]),
            "direct_dist_km": police_info["dist_km"],
            "hub_id": police_hub_id,
            "hub_name": police_info["hub_name"],
            "city": station.get("city", "Bengaluru"),
        },
        "comparison_dest_name": comparison_dest_name,
        "emergency_route": emergency_route,
        "analysis": analysis,
        "tornado": tornado,
        "profile": profile,
        "police_dispatch_packet": police_dispatch_packet,
        "incident_history": list_sos_incidents(15),
        "alert_message": (
            f"Emergency alert sent to {station['name']}. "
            + (
                f"Family contact {fam_p_name} ({fam_p_phone}) notified."
                if profile.get("family_primary_phone")
                else "Add your Citizen & Family Details below to attach next-of-kin phone numbers."
            )
        ),
    }


# -----------------------------------------------------------------------------
# 4. Python File Handling: JSON Save/Load & Safety Report Generation
# -----------------------------------------------------------------------------
def _safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "_", name).strip("_")
    return cleaned or "safepath_analysis"


def save_analysis_json(payload: dict[str, Any]) -> dict[str, Any]:
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    src = payload.get("params", {}).get("source", "src")
    dst = payload.get("params", {}).get("dest", "dst")
    filename = _safe_filename(f"safepath_{src}_to_{dst}_{timestamp}") + ".json"
    filepath = os.path.join(REPORTS_DIR, filename)

    record = {
        "filename": filename,
        "saved_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "params": payload.get("params", {}),
        "summary": payload.get("summary", {}),
    }
    with open(filepath, "w", encoding="utf-8") as fh:
        json.dump(record, fh, indent=2)
    return record


def list_saved_reports() -> list[dict[str, Any]]:
    records = []
    if not os.path.exists(REPORTS_DIR):
        return records
    for fname in sorted(os.listdir(REPORTS_DIR), reverse=True):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(REPORTS_DIR, fname)
        try:
            with open(fpath, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            records.append({
                "filename": fname,
                "saved_at": data.get("saved_at", ""),
                "params": data.get("params", {}),
                "summary": data.get("summary", {}),
            })
        except Exception:
            continue
    return records[:15]


def load_analysis_json(filename: str) -> dict[str, Any]:
    safe = os.path.basename(filename)
    fpath = os.path.join(REPORTS_DIR, safe)
    if not os.path.exists(fpath):
        raise FileNotFoundError(f"Saved report not found: {safe}")
    with open(fpath, "r", encoding="utf-8") as fh:
        return json.load(fh)


def delete_analysis_json(filename: str) -> bool:
    safe = os.path.basename(filename)
    fpath = os.path.join(REPORTS_DIR, safe)
    if os.path.exists(fpath):
        os.remove(fpath)
        return True
    return False


def save_safety_report_to_db(
    source_name: str,
    dest_name: str,
    travel_mode: str,
    time_of_day: str,
    adapt: dict[str, Any],
    report_text: str,
) -> str:
    now_dt = datetime.datetime.now()
    created_at = now_dt.strftime("%Y-%m-%d %H:%M:%S")
    report_code = f"SP-RPT-{now_dt.strftime('%Y%m%d%H%M%S')}-{random.randint(100, 999)}"
    with _db_conn() as conn:
        conn.execute(
            """
            INSERT INTO safety_reports (
                report_code, created_at, source_name, dest_name,
                travel_mode, time_of_day, safety_score, travel_time_min,
                route_dist_km, high_risk_count, report_text
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                report_code,
                created_at,
                source_name,
                dest_name,
                travel_mode,
                time_of_day,
                float(adapt.get("safety_score", 0)),
                float(adapt.get("total_time", 0)),
                float(adapt.get("total_dist", 0)),
                int(adapt.get("high_risk_count", 0)),
                report_text,
            ),
        )
        conn.commit()
    return report_code


def generate_text_report(params: dict[str, Any]) -> str:
    res = evaluate_strategies(**params)
    s = res["strategies"]
    adapt = s["adaptive"]
    meta = res["adaptive_meta"]
    src_obj = _resolve_place_obj(params.get("source_place"), params.get("source", "majestic"))
    dst_obj = _resolve_place_obj(params.get("dest_place"), params.get("dest", "koramangala"))
    src_name = src_obj["name"]
    dst_name = dst_obj["name"]
    src_area = ", ".join(x for x in (src_obj.get("area", ""), src_obj.get("city", "")) if x)
    dst_area = ", ".join(x for x in (dst_obj.get("area", ""), dst_obj.get("city", "")) if x)

    nearest_pol = min(
        [p for p in EMERGENCY_POIS if p.get("type") == "police"],
        key=lambda p: haversine_km(float(src_obj["lat"]), float(src_obj["lng"]), float(p["lat"]), float(p["lng"])),
    )
    nearest_hosp = min(
        [p for p in EMERGENCY_POIS if p.get("type") == "hospital"],
        key=lambda p: haversine_km(float(src_obj["lat"]), float(src_obj["lng"]), float(p["lat"]), float(p["lng"])),
    )
    pol_dist = round(haversine_km(float(src_obj["lat"]), float(src_obj["lng"]), float(nearest_pol["lat"]), float(nearest_pol["lng"])), 2)
    hosp_dist = round(haversine_km(float(src_obj["lat"]), float(src_obj["lng"]), float(nearest_hosp["lat"]), float(nearest_hosp["lng"])), 2)

    profile = get_citizen_profile()
    citizen_line = (
        f"{profile['full_name']} ({profile['phone']}) · Family Contact: {profile['family_primary_name']} ({profile['family_primary_phone']})"
        if profile.get("is_configured")
        else "Not configured yet"
    )

    lines = [
        "=" * 68,
        "SAFEPATH - PERSONAL SAFETY ROUTE REPORT",
        "Travel Confident. Choose Safety Over Shortcuts.",
        "=" * 68,
        f"Generated:       {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Origin:          {src_name}" + (f" ({src_area})" if src_area else "") + f" [{src_obj['lat']:.5f}, {src_obj['lng']:.5f}]",
        f"Destination:     {dst_name}" + (f" ({dst_area})" if dst_area else "") + f" [{dst_obj['lat']:.5f}, {dst_obj['lng']:.5f}]",
        f"Travel Mode:     {meta.get('travel_mode_label', 'Car / Cab')} | Time Window: {str(params.get('time_of_day', 'night')).upper()}",
        f"Risk Preference: {int(float(params.get('risk_preference', 50)))}/100",
        f"SOS Profile:     {citizen_line}",
        "",
        "--- RECOMMENDED ADAPTIVE ROUTE (ROUTE 1) ---",
        f"Safety Score:       {adapt['safety_score']}/100",
        f"Total Travel Time:  {adapt['total_time']} min",
        f"Route Length:       {adapt['total_dist']} km",
        f"High-Risk Segments: {adapt['high_risk_count']}",
        f"Adaptive Weights:   Safety {int(meta['adaptive_safety_w']*100)}% / Time {int(meta['adaptive_time_w']*100)}%",
        f"Rationale:          {meta['explanation']}",
        "",
        "6-Factor Route Safety Profile (0–10):",
        f"  Street Lighting:       {adapt['factor_avgs']['lighting']}",
        f"  Pedestrian Density:    {adapt['factor_avgs']['crowd']}",
        f"  CCTV Coverage:         {adapt['factor_avgs']['cctv']}",
        f"  Police/Emergency:      {adapt['factor_avgs']['emergency']}",
        f"  Low Road Isolation:    {adapt['factor_avgs']['isolation_inv']}",
        f"  Low Incident Risk:     {adapt['factor_avgs']['risk_inv']}",
        "",
        "Nearest Emergency Support (from Origin):",
        f"  Police Station: {nearest_pol['name']} ({pol_dist} km away)",
        f"  Hospital:       {nearest_hosp['name']} ({hosp_dist} km away)",
        "",
        "Segment-by-Segment Path:",
    ]
    for idx, seg in enumerate(adapt["segments"], start=1):
        lines.append(
            f"  {idx}. {seg['road']} ({seg['from_name']} -> {seg['to_name']}) | "
            f"{seg['dist']} km, {seg['time']} min | Safety: {seg['safety_score']}/100"
        )
    lines.extend([
        "",
        "--- SIDE-BY-SIDE 4-STRATEGY BENCHMARK COMPARISON ---",
        f"Route 1 (Adaptive):       Safety {adapt['safety_score']}/100 | {adapt['total_time']} min | {adapt['total_dist']} km | High-Risk: {adapt['high_risk_count']}",
        f"Route 2 (Fixed Weighted): Safety {s['fixed']['safety_score']}/100 | {s['fixed']['total_time']} min | {s['fixed']['total_dist']} km | High-Risk: {s['fixed']['high_risk_count']}",
        f"Route 3 (Safety-Only):    Safety {s['safety']['safety_score']}/100 | {s['safety']['total_time']} min | {s['safety']['total_dist']} km | High-Risk: {s['safety']['high_risk_count']}",
        f"Route 4 (Shortest):       Safety {s['shortest']['safety_score']}/100 | {s['shortest']['total_time']} min | {s['shortest']['total_dist']} km | High-Risk: {s['shortest']['high_risk_count']}",
        "=" * 68,
    ])
    report_str = "\n".join(lines)
    try:
        save_safety_report_to_db(
            source_name=src_name,
            dest_name=dst_name,
            travel_mode=str(params.get("travel_mode", "car")),
            time_of_day=str(params.get("time_of_day", "night")),
            adapt=adapt,
            report_text=report_str,
        )
    except Exception:
        pass
    return report_str


# -----------------------------------------------------------------------------
# 5. Flask Application Routes
# -----------------------------------------------------------------------------
if HAS_FLASK:
    app = Flask(__name__, template_folder="templates", static_folder="static")

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/api/init", methods=["GET"])
    def api_init():
        return jsonify({
            "locations": LOCATIONS,
            "all_places": PLACE_CATALOG[:36],
            "presets": POPULAR_PRESETS,
            "emergency_pois": EMERGENCY_POIS,
            "default_weights": DEFAULT_FACTOR_WEIGHTS,
            "factor_labels": FACTOR_LABELS,
            "profile": get_citizen_profile(),
        })

    @app.route("/api/places/search", methods=["GET", "POST"])
    def api_places_search():
        data = (request.get_json(silent=True) or {}) if request.method == "POST" else request.args
        q = str(data.get("q", ""))
        lat = float(data["lat"]) if data.get("lat") not in (None, "") else None
        lng = float(data["lng"]) if data.get("lng") not in (None, "") else None
        limit = int(data.get("limit", 18))
        category = str(data.get("category", ""))
        return jsonify(search_places(query=q, lat=lat, lng=lng, limit=limit, category=category))

    @app.route("/api/places/reverse", methods=["GET", "POST"])
    def api_places_reverse():
        data = (request.get_json(silent=True) or {}) if request.method == "POST" else request.args
        lat = float(data.get("lat", 12.9716))
        lng = float(data.get("lng", 77.5946))
        return jsonify(reverse_place(lat, lng))

    @app.route("/api/profile", methods=["GET", "POST"])
    def api_profile():
        if request.method == "GET":
            return jsonify({"profile": get_citizen_profile()})
        data = request.get_json(force=True) or {}
        saved = save_citizen_profile(data)
        return jsonify({"profile": saved})

    @app.route("/api/sos/history", methods=["GET", "POST"])
    def api_sos_history():
        if request.method == "GET":
            return jsonify({"incidents": list_sos_incidents(25)})
        data = request.get_json(force=True) or {}
        updated = update_sos_incident(
            incident_code=str(data.get("incident_code", "")),
            status=data.get("status"),
            profile_override=data.get("profile"),
        )
        return jsonify({"updated": updated, "incidents": list_sos_incidents(25)})

    @app.route("/api/analyze", methods=["POST"])
    def api_analyze():
        data = request.get_json(force=True) or {}
        params = _extract_params(data)
        analysis = evaluate_strategies(**params)
        tornado = compute_sensitivity_tornado(params)
        return jsonify({"analysis": analysis, "tornado": tornado})

    @app.route("/api/robustness", methods=["POST"])
    def api_robustness():
        data = request.get_json(force=True) or {}
        params = _extract_params(data)
        result = simulate_robustness_change(params)
        tornado = compute_sensitivity_tornado({**params, "disruptions": result["disruptions"]})
        return jsonify({**result, "tornado": tornado})

    @app.route("/api/reports", methods=["GET", "POST"])
    def api_reports():
        if request.method == "GET":
            return jsonify({"reports": list_saved_reports()})
        data = request.get_json(force=True) or {}
        record = save_analysis_json(data)
        return jsonify({"saved": record, "reports": list_saved_reports()})

    @app.route("/api/reports/<filename>", methods=["GET", "DELETE"])
    def api_report_item(filename: str):
        if request.method == "DELETE":
            deleted = delete_analysis_json(filename)
            return jsonify({"deleted": deleted, "reports": list_saved_reports()})
        return jsonify(load_analysis_json(filename))

    @app.route("/api/sos", methods=["POST"])
    def api_sos():
        data = request.get_json(force=True) or {}
        params = _extract_params(data)
        cur_lat = data.get("current_lat")
        cur_lng = data.get("current_lng")
        detected_name = str(data.get("detected_location_name") or "")
        prof_override = data.get("profile") if isinstance(data.get("profile"), dict) else None
        return jsonify(activate_emergency_sos(params, cur_lat, cur_lng, detected_name, prof_override))

    @app.route("/api/report/download", methods=["POST"])
    def api_report_download():
        data = request.get_json(force=True) or {}
        params = _extract_params(data)
        report_txt = generate_text_report(params)
        return Response(
            report_txt,
            mimetype="text/plain",
            headers={"Content-Disposition": f"attachment; filename=safepath_report_{params['source']}_{params['dest']}.txt"},
        )


def _extract_params(data: dict[str, Any]) -> dict[str, Any]:
    raw_mode = str(data.get("travel_mode", "car")).lower()
    return {
        "source": str(data.get("source", "majestic")),
        "dest": str(data.get("dest", "koramangala")),
        "source_place": data.get("source_place"),
        "dest_place": data.get("dest_place"),
        "time_of_day": str(data.get("time_of_day", "night")),
        "travel_mode": raw_mode if raw_mode in TRAVEL_MODE_CONFIG else "car",
        "risk_preference": float(data.get("risk_preference", 50.0)),
        "fixed_safety_weight": float(data.get("fixed_safety_weight", 0.70)),
        "factor_weights": data.get("factor_weights") or dict(DEFAULT_FACTOR_WEIGHTS),
        "overall_sens_balance": float(data.get("overall_sens_balance", 50.0)),
        "disruptions": data.get("disruptions") or {},
        "emergency_mode": bool(data.get("emergency_mode", False)),
    }


def handle_cli_invocation() -> None:
    """Allows executing Python backend endpoints cleanly via stdin/stdout JSON."""
    raw = sys.stdin.read().strip()
    req = json.loads(raw) if raw else {}
    action = req.get("action", "init")
    payload = req.get("payload", {})

    if action == "init":
        out = {
            "locations": LOCATIONS,
            "all_places": PLACE_CATALOG[:36],
            "presets": POPULAR_PRESETS,
            "emergency_pois": EMERGENCY_POIS,
            "default_weights": DEFAULT_FACTOR_WEIGHTS,
            "factor_labels": FACTOR_LABELS,
            "profile": get_citizen_profile(),
        }
    elif action == "places_search":
        lat_raw = payload.get("lat")
        lng_raw = payload.get("lng")
        out = search_places(
            query=str(payload.get("q", "")),
            lat=float(lat_raw) if lat_raw not in (None, "") else None,
            lng=float(lng_raw) if lng_raw not in (None, "") else None,
            limit=int(payload.get("limit", 18)),
            category=str(payload.get("category", "")),
        )
    elif action == "places_reverse":
        out = reverse_place(float(payload.get("lat", 12.9716)), float(payload.get("lng", 77.5946)))
    elif action == "profile_get":
        out = {"profile": get_citizen_profile()}
    elif action == "profile_save":
        out = {"profile": save_citizen_profile(payload if isinstance(payload, dict) else {})}
    elif action == "analyze":
        params = _extract_params(payload)
        out = {
            "analysis": evaluate_strategies(**params),
            "tornado": compute_sensitivity_tornado(params),
        }
    elif action == "robustness":
        params = _extract_params(payload)
        res = simulate_robustness_change(params)
        tornado = compute_sensitivity_tornado({**params, "disruptions": res["disruptions"]})
        out = {**res, "tornado": tornado}
    elif action == "sos":
        params = _extract_params(payload)
        prof_override = payload.get("profile") if isinstance(payload.get("profile"), dict) else None
        out = activate_emergency_sos(
            params,
            payload.get("current_lat"),
            payload.get("current_lng"),
            str(payload.get("detected_location_name") or ""),
            prof_override,
        )
    elif action == "sos_history":
        out = {"incidents": list_sos_incidents(int(payload.get("limit", 25)))}
    elif action == "sos_update":
        updated = update_sos_incident(
            incident_code=str(payload.get("incident_code", "")),
            status=payload.get("status"),
            profile_override=payload.get("profile") if isinstance(payload.get("profile"), dict) else None,
            live_lat=float(payload["live_lat"]) if payload.get("live_lat") is not None else None,
            live_lng=float(payload["live_lng"]) if payload.get("live_lng") is not None else None,
        )
        out = {"updated": updated, "incidents": list_sos_incidents(25)}
    elif action == "reports_list":
        out = {"reports": list_saved_reports()}
    elif action == "reports_save":
        rec = save_analysis_json(payload)
        out = {"saved": rec, "reports": list_saved_reports()}
    elif action == "reports_load":
        out = load_analysis_json(payload.get("filename", ""))
    elif action == "reports_delete":
        deleted = delete_analysis_json(payload.get("filename", ""))
        out = {"deleted": deleted, "reports": list_saved_reports()}
    elif action == "report_text":
        params = _extract_params(payload)
        out = {"text": generate_text_report(params)}
    else:
        raise ValueError(f"Unknown action: {action}")

    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    if "--cli" in sys.argv:
        handle_cli_invocation()
    elif HAS_FLASK:
        port = int(os.environ.get("PORT", 5000))
        app.run(host="0.0.0.0", port=port, debug=True)
    else:
        print("Flask is not installed. Run: pip install -r requirements.txt")
