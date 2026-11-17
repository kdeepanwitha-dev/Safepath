"""SafePath – Personal Safety Route Planner

A student MVP that compares the shortest walking route with a route that
prioritises mapped safety-supporting features from OpenStreetMap.

IMPORTANT: A map score is a planning aid, not a guarantee of safety. OSM data
can be incomplete or out of date. Crowd activity is only approximated from
mapped public places and transit stops; it is not live crowd data.
"""

from __future__ import annotations

import csv
import io
import math
import time
from typing import Any

import folium
import geopandas as gpd
import networkx as nx
import numpy as np
import osmnx as ox
import streamlit as st
from scipy.spatial import cKDTree
from streamlit_folium import st_folium


# -----------------------------------------------------------------------------
# App and OpenStreetMap configuration
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="SafePath | Personal Safety Route Planner",
    page_icon="🧭",
    layout="wide",
)

# Ask OSMnx to retain the tags needed for our scoring model.
# OSMnx 2.x exposes these settings as lists.
ox.settings.useful_tags_way = list(
    dict.fromkeys(
        list(ox.settings.useful_tags_way)
        + ["lit", "sidewalk", "sidewalk:both", "sidewalk:left", "sidewalk:right", "footway", "access"]
    )
)
ox.settings.requests_timeout = 180
ox.settings.use_cache = True

APP_TITLE = "SafePath"
ACTIVITY_AMENITIES = {
    "school", "college", "university", "library", "community_centre",
    "cafe", "restaurant", "bank", "pharmacy", "marketplace", "post_office",
}
EMERGENCY_AMENITIES = {"police", "fire_station", "hospital", "clinic", "doctors"}


# -----------------------------------------------------------------------------
# Small helper functions: normalising data and calculating scores
# -----------------------------------------------------------------------------
def first_tag(value: Any) -> str:
    """Return a normalised OSM tag value (OSMnx may store tags as lists)."""
    if isinstance(value, (list, tuple, set)):
        value = next(iter(value), "")
    if value is None:
        return ""
    return str(value).strip().lower()


def light_score(lit_value: Any) -> tuple[float, bool]:
    """Return lighting score and whether lighting is explicitly mapped."""
    value = first_tag(lit_value)
    if value in {"yes", "automatic", "24/7"}:
        return 100.0, True
    if value == "no":
        return 15.0, True
    return 50.0, False  # Unknown is neutral, not automatically unsafe.


def sidewalk_score(data: dict[str, Any]) -> tuple[float, bool]:
    """Score mapped pedestrian-sidewalk information."""
    values = [
        first_tag(data.get(key))
        for key in ("sidewalk", "sidewalk:both", "sidewalk:left", "sidewalk:right")
    ]
    positive = {"yes", "both", "left", "right", "separate", "left_only", "right_only"}
    if any(value in positive for value in values) or first_tag(data.get("footway")) == "sidewalk":
        return 100.0, True
    if any(value == "no" for value in values):
        return 20.0, True
    # A separately mapped pedestrian way is a useful indication of pedestrian access,
    # but it is not proof that the entire route has a good-quality footpath.
    highway = first_tag(data.get("highway"))
    if highway in {"footway", "pedestrian"}:
        return 75.0, True
    return 50.0, False


def road_context_score(highway_value: Any) -> float:
    """A modest context factor; road type alone cannot establish safety."""
    highway = first_tag(highway_value)
    scores = {
        "living_street": 85,
        "residential": 80,
        "pedestrian": 80,
        "footway": 75,
        "tertiary": 65,
        "tertiary_link": 60,
        "secondary": 55,
        "secondary_link": 50,
        "service": 50,
        "unclassified": 50,
        "path": 45,
        "primary": 40,
        "primary_link": 35,
        "track": 35,
    }
    return float(scores.get(highway, 50))


def proximity_score(distance_m: float | None, kind: str, query_succeeded: bool) -> float:
    """Convert nearest mapped-POI distance into a transparent proxy score."""
    if not query_succeeded:
        return 50.0  # Do not punish a route when the POI service failed.
    if distance_m is None or not math.isfinite(distance_m):
        return 50.0  # No mapped examples: unknown, not evidence of absence.

    if kind == "activity":
        if distance_m <= 100:
            return 100.0
        if distance_m <= 250:
            return 85.0
        if distance_m <= 500:
            return 60.0
        return 30.0

    # Emergency-support proximity: mapped facilities only; no availability implied.
    if distance_m <= 300:
        return 100.0
    if distance_m <= 700:
        return 80.0
    if distance_m <= 1500:
        return 60.0
    return 25.0


def nearest_distances(
    midpoints: list[Any], point_geometries: list[Any]
) -> list[float | None]:
    """Fast nearest-point distances in metres using a KD-tree."""
    if not point_geometries:
        return [None] * len(midpoints)
    poi_xy = np.asarray([[point.x, point.y] for point in point_geometries], dtype=float)
    midpoint_xy = np.asarray([[point.x, point.y] for point in midpoints], dtype=float)
    tree = cKDTree(poi_xy)
    distances, _ = tree.query(midpoint_xy, k=1)
    return [float(value) for value in distances]


def build_poi_point_lists(
    features: gpd.GeoDataFrame | None,
    target_crs: Any,
) -> tuple[list[Any], list[Any], list[tuple[float, float, str]]]:
    """Return projected activity/emergency points and map markers (lat, lon, type)."""
    if features is None or features.empty:
        return [], [], []

    projected = ox.projection.project_gdf(features, to_crs=target_crs)
    activity_points: list[Any] = []
    emergency_points: list[Any] = []
    map_markers: list[tuple[float, float, str]] = []

    for _, row in projected.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        point = geom if geom.geom_type == "Point" else geom.representative_point()
        amenity = first_tag(row.get("amenity"))
        shop = first_tag(row.get("shop"))
        highway = first_tag(row.get("highway"))
        public_transport = first_tag(row.get("public_transport"))

        if amenity in EMERGENCY_AMENITIES:
            emergency_points.append(point)
            if len(map_markers) < 120:
                # Convert projected point to WGS84 only for display.
                one_point = gpd.GeoDataFrame(geometry=[point], crs=target_crs).to_crs("EPSG:4326")
                map_markers.append((float(one_point.geometry.iloc[0].y), float(one_point.geometry.iloc[0].x), amenity))

        if (
            amenity in ACTIVITY_AMENITIES
            or shop in {"convenience", "supermarket", "mall"}
            or highway == "bus_stop"
            or public_transport in {"station", "platform", "stop_position"}
        ):
            activity_points.append(point)

    return activity_points, emergency_points, map_markers


def add_edge_scores(
    graph: nx.MultiDiGraph,
    features: gpd.GeoDataFrame | None,
    poi_query_succeeded: bool,
    safety_preference: float,
) -> None:
    """Attach component scores and a weighted route cost to every graph edge."""
    edge_records = list(graph.edges(keys=True, data=True))
    midpoints: list[Any] = []

    for u, v, key, data in edge_records:
        geometry = data.get("geometry")
        if geometry is None:
            from shapely.geometry import LineString
            geometry = LineString(
                [(graph.nodes[u]["x"], graph.nodes[u]["y"]),
                 (graph.nodes[v]["x"], graph.nodes[v]["y"])]
            )
        midpoints.append(geometry.interpolate(0.5, normalized=True))

    activity_points, emergency_points, emergency_markers = build_poi_point_lists(
        features, graph.graph["crs"]
    )
    activity_distances = nearest_distances(midpoints, activity_points)
    emergency_distances = nearest_distances(midpoints, emergency_points)

    for index, (u, v, key, data) in enumerate(edge_records):
        lighting, lighting_known = light_score(data.get("lit"))
        sidewalk, sidewalk_known = sidewalk_score(data)
        activity = proximity_score(activity_distances[index], "activity", poi_query_succeeded)
        emergency = proximity_score(emergency_distances[index], "emergency", poi_query_succeeded)
        context = road_context_score(data.get("highway"))

        # Transparent weights, totalling 100%:
        # lighting 30%, pedestrian infrastructure 25%, public-activity proxy 20%,
        # emergency-support proximity 15%, road context 10%.
        score = (
            0.30 * lighting
            + 0.25 * sidewalk
            + 0.20 * activity
            + 0.15 * emergency
            + 0.10 * context
        )
        length = max(float(data.get("length", 1.0)), 1.0)
        data["safe_score"] = round(score, 2)
        data["lighting_known"] = lighting_known
        data["sidewalk_known"] = sidewalk_known
        # Safety preference controls how strongly the search avoids low-scoring edges.
        data["safe_cost"] = length * (1.0 + safety_preference * (100.0 - score) / 100.0)

    graph.graph["emergency_markers"] = emergency_markers


def selected_route_edges(
    graph: nx.MultiDiGraph, path: list[int], weight_name: str
) -> list[tuple[int, int, int, dict[str, Any]]]:
    """Choose the parallel edge used for each step in a MultiDiGraph path."""
    chosen = []
    for u, v in zip(path[:-1], path[1:]):
        edge_options = graph.get_edge_data(u, v)
        if not edge_options:
            continue
        key = min(edge_options, key=lambda item: float(edge_options[item].get(weight_name, math.inf)))
        chosen.append((u, v, key, edge_options[key]))
    return chosen


def route_metrics(
    graph: nx.MultiDiGraph,
    path: list[int],
    weight_name: str,
    walking_speed_kmh: float,
) -> dict[str, float]:
    """Summarise distance, estimated time, safety score and mapped coverage."""
    route_edges = selected_route_edges(graph, path, weight_name)
    total_length = sum(float(edge[3].get("length", 0.0)) for edge in route_edges)
    if total_length <= 0:
        raise ValueError("The selected route has no measurable length.")

    weighted_score = sum(
        float(data.get("safe_score", 50.0)) * float(data.get("length", 0.0))
        for _, _, _, data in route_edges
    ) / total_length

    light_known_length = sum(
        float(data.get("length", 0.0)) for _, _, _, data in route_edges if data.get("lighting_known")
    )
    sidewalk_known_length = sum(
        float(data.get("length", 0.0)) for _, _, _, data in route_edges if data.get("sidewalk_known")
    )

    return {
        "distance_km": total_length / 1000.0,
        "time_min": (total_length / 1000.0) / walking_speed_kmh * 60.0,
        "safety_score": weighted_score,
        "lighting_coverage_pct": 100.0 * light_known_length / total_length,
        "sidewalk_coverage_pct": 100.0 * sidewalk_known_length / total_length,
        "mapped_street_coverage_pct": 50.0 * (light_known_length + sidewalk_known_length) / total_length,
    }


def route_to_wgs84_lines(
    graph: nx.MultiDiGraph, path: list[int], weight_name: str
) -> list[list[tuple[float, float]]]:
    """Convert selected route edge geometries to (lat, lon) sequences for Folium."""
    lines: list[list[tuple[float, float]]] = []
    route_edges = selected_route_edges(graph, path, weight_name)
    geometries = []
    for u, v, key, data in route_edges:
        geometry = data.get("geometry")
        if geometry is None:
            from shapely.geometry import LineString
            geometry = LineString(
                [(graph.nodes[u]["x"], graph.nodes[u]["y"]),
                 (graph.nodes[v]["x"], graph.nodes[v]["y"])]
            )
        geometries.append(geometry)

    if not geometries:
        return lines

    route_gdf = gpd.GeoDataFrame(geometry=geometries, crs=graph.graph["crs"]).to_crs("EPSG:4326")
    for geometry in route_gdf.geometry:
        if geometry.geom_type == "LineString":
            coords = [(float(lat), float(lon)) for lon, lat in geometry.coords]
            lines.append(coords)
        elif geometry.geom_type == "MultiLineString":
            for part in geometry.geoms:
                coords = [(float(lat), float(lon)) for lon, lat in part.coords]
                lines.append(coords)
    return lines


# -----------------------------------------------------------------------------
# OpenStreetMap data retrieval
# -----------------------------------------------------------------------------
@st.cache_data(ttl=24 * 60 * 60, show_spinner=False)
def geocode_place(place: str) -> tuple[float, float]:
    """Geocode an address/place name using OpenStreetMap Nominatim via OSMnx."""
    result = ox.geocoder.geocode(place)
    if not result:
        raise ValueError(f"Could not find this place: {place}")
    return float(result[0]), float(result[1])


@st.cache_resource(ttl=60 * 60, show_spinner=False)
def download_walk_graph(center_lat: float, center_lon: float, dist_m: int) -> nx.MultiDiGraph:
    """Download the walkable street network around the journey."""
    return ox.graph.graph_from_point(
        (center_lat, center_lon),
        dist=dist_m,
        dist_type="bbox",
        network_type="walk",
        simplify=True,
        retain_all=True,
    )


@st.cache_data(ttl=60 * 60, show_spinner=False)
def download_safety_features(
    center_lat: float, center_lon: float, dist_m: int
) -> gpd.GeoDataFrame | None:
    """Download mapped public places, transit stops and emergency-support POIs."""
    tags = {
        "amenity": sorted(ACTIVITY_AMENITIES | EMERGENCY_AMENITIES),
        "shop": ["convenience", "supermarket", "mall"],
        "highway": "bus_stop",
        "public_transport": ["station", "platform", "stop_position"],
    }
    try:
        return ox.features.features_from_point((center_lat, center_lon), tags=tags, dist=dist_m)
    except Exception:
        # Routing still works using street tags; the UI will clearly flag missing POI data.
        return None


def calculate_journey(
    origin_text: str,
    destination_text: str,
    walking_speed_kmh: float,
    safety_preference: float,
) -> dict[str, Any]:
    """End-to-end route calculation. Returns graph, paths, metrics and coordinates."""
    origin_lat, origin_lon = geocode_place(origin_text)
    # Nominatim asks clients to avoid rapid repeated requests. Geocoding is cached.
    time.sleep(1.1)
    dest_lat, dest_lon = geocode_place(destination_text)

    straight_distance = ox.distance.great_circle(origin_lat, origin_lon, dest_lat, dest_lon)
    if straight_distance > 18000:
        raise ValueError(
            "This prototype is designed for local journeys up to about 18 km. "
            "Please choose closer start and destination points."
        )

    center_lat = (origin_lat + dest_lat) / 2.0
    center_lon = (origin_lon + dest_lon) / 2.0
    # A buffer around both endpoints so the graph can connect them to the network.
    download_radius = int(max(2500, min(14000, straight_distance / 2.0 + 2200)))

    graph_ll = download_walk_graph(center_lat, center_lon, download_radius)
    if graph_ll.number_of_nodes() == 0:
        raise ValueError("No walkable street network was returned for this area.")

    origin_node = ox.distance.nearest_nodes(graph_ll, X=origin_lon, Y=origin_lat)
    destination_node = ox.distance.nearest_nodes(graph_ll, X=dest_lon, Y=dest_lat)
    graph = ox.projection.project_graph(graph_ll)

    poi_features = download_safety_features(center_lat, center_lon, download_radius)
    poi_query_succeeded = poi_features is not None
    add_edge_scores(graph, poi_features, poi_query_succeeded, safety_preference)

    if not nx.has_path(graph, origin_node, destination_node):
        raise ValueError(
            "A continuous walking route could not be found between these points. "
            "The mapped pedestrian network may be incomplete or disconnected."
        )

    shortest_path = nx.shortest_path(graph, origin_node, destination_node, weight="length")
    safety_path = nx.shortest_path(graph, origin_node, destination_node, weight="safe_cost")

    shortest_metrics = route_metrics(graph, shortest_path, "length", walking_speed_kmh)
    safety_metrics = route_metrics(graph, safety_path, "safe_cost", walking_speed_kmh)

    return {
        "graph": graph,
        "origin": (origin_lat, origin_lon),
        "destination": (dest_lat, dest_lon),
        "shortest_path": shortest_path,
        "safety_path": safety_path,
        "shortest_metrics": shortest_metrics,
        "safety_metrics": safety_metrics,
        "shortest_lines": route_to_wgs84_lines(graph, shortest_path, "length"),
        "safety_lines": route_to_wgs84_lines(graph, safety_path, "safe_cost"),
        "poi_query_succeeded": poi_query_succeeded,
        "poi_features_found": 0 if poi_features is None else len(poi_features),
        "download_radius_m": download_radius,
        "emergency_markers": graph.graph.get("emergency_markers", []),
    }


# -----------------------------------------------------------------------------
# Presentation layer
# -----------------------------------------------------------------------------
def format_minutes(value: float) -> str:
    minutes = int(round(value))
    hours, remaining = divmod(minutes, 60)
    return f"{hours} hr {remaining} min" if hours else f"{remaining} min"



def make_csv_report(result: dict[str, Any]) -> str:
    """Create a downloadable comparison report using Python file handling."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Route type", "Distance (km)", "Estimated walk (minutes)",
        "Mapped safety score (0-100)", "Lighting data coverage (%)",
        "Sidewalk data coverage (%)",
    ])
    for label, metrics in (
        ("Shortest walking route", result["shortest_metrics"]),
        ("Safety-prioritised route", result["safety_metrics"]),
    ):
        writer.writerow([
            label,
            round(metrics["distance_km"], 2),
            round(metrics["time_min"], 1),
            round(metrics["safety_score"], 1),
            round(metrics["lighting_coverage_pct"], 1),
            round(metrics["sidewalk_coverage_pct"], 1),
        ])
    return output.getvalue()

def make_map(result: dict[str, Any]) -> folium.Map:
    """Draw both routes and mapped emergency-support locations."""
    origin = result["origin"]
    destination = result["destination"]
    center = ((origin[0] + destination[0]) / 2, (origin[1] + destination[1]) / 2)
    map_object = folium.Map(location=center, zoom_start=14, control_scale=True)

    folium.Marker(
        location=origin,
        tooltip="Start",
        popup="Journey start",
        icon=folium.Icon(color="green", icon="play"),
    ).add_to(map_object)
    folium.Marker(
        location=destination,
        tooltip="Destination",
        popup="Journey destination",
        icon=folium.Icon(color="red", icon="flag"),
    ).add_to(map_object)

    for line in result["shortest_lines"]:
        folium.PolyLine(line, color="#2563eb", weight=5, opacity=0.75, tooltip="Shortest route").add_to(map_object)
    for line in result["safety_lines"]:
        folium.PolyLine(line, color="#16a34a", weight=6, opacity=0.85, tooltip="Safety-prioritised route").add_to(map_object)

    for lat, lon, facility_type in result["emergency_markers"]:
        label = facility_type.replace("_", " ").title()
        folium.CircleMarker(
            location=(lat, lon),
            radius=5,
            color="#7c3aed",
            fill=True,
            fill_opacity=0.85,
            tooltip=f"Mapped {label} (availability not verified)",
        ).add_to(map_object)

    folium.LayerControl().add_to(map_object)
    return map_object


def show_route_card(title: str, metrics: dict[str, float], caption: str) -> None:
    st.subheader(title)
    col1, col2, col3 = st.columns(3)
    col1.metric("Distance", f"{metrics['distance_km']:.2f} km")
    col2.metric("Estimated walk", format_minutes(metrics["time_min"]))
    col3.metric("Mapped safety score", f"{metrics['safety_score']:.0f}/100")
    st.caption(caption)


# -----------------------------------------------------------------------------
# User interface
# -----------------------------------------------------------------------------
st.title("🧭 SafePath – Personal Safety Route Planner")
st.write(
    "Compare the shortest walking route with a route that gives more weight to "
    "mapped lighting, pedestrian infrastructure, nearby public activity and "
    "emergency-support facilities."
)

st.warning(
    "SafePath is a prototype decision-support tool, not a guarantee of safety. "
    "OpenStreetMap may have missing or outdated information. The app does not "
    "have live crowd levels, verified crime reports, live police availability, "
    "or real-time incident alerts. Use local judgement and official emergency services."
)

with st.form("journey_form"):
    left, right = st.columns(2)
    with left:
        origin_input = st.text_input(
            "Starting point",
            placeholder="Example: Jain University, Bengaluru",
            help="Enter a recognisable place name or address. Include the city for better results.",
        )
    with right:
        destination_input = st.text_input(
            "Destination",
            placeholder="Example: Jayanagar Metro Station, Bengaluru",
            help="Enter a recognisable place name or address. Include the city for better results.",
        )

    settings_col1, settings_col2 = st.columns(2)
    with settings_col1:
        speed = st.slider("Walking speed (km/h)", min_value=3.0, max_value=6.0, value=4.5, step=0.5)
    with settings_col2:
        safety_preference = st.slider(
            "Safety prioritisation",
            min_value=0.5,
            max_value=3.0,
            value=1.8,
            step=0.1,
            help="Higher values make the algorithm avoid low-scoring map segments more strongly. This is a preference, not a risk probability.",
        )

    submitted = st.form_submit_button("Find and compare routes", type="primary", use_container_width=True)

if submitted:
    if not origin_input.strip() or not destination_input.strip():
        st.error("Please enter both a starting point and a destination.")
    else:
        try:
            with st.spinner("Finding places, downloading the walking network and analysing map features..."):
                st.session_state["safepath_result"] = calculate_journey(
                    origin_input.strip(),
                    destination_input.strip(),
                    speed,
                    safety_preference,
                )
                st.session_state["safepath_speed"] = speed
        except Exception as error:
            st.session_state.pop("safepath_result", None)
            st.error(f"Could not calculate this journey: {error}")
            st.info(
                "Check the spelling and city name, try a shorter local journey, "
                "and make sure the computer has an internet connection. OpenStreetMap "
                "servers may also temporarily limit requests."
            )

result = st.session_state.get("safepath_result")
if result:
    st.divider()
    st.header("Route comparison")
    show_route_card(
        "🔵 Shortest walking route",
        result["shortest_metrics"],
        "Minimises mapped walking distance. It is shown as a baseline, not automatically as the recommended route.",
    )
    st.divider()
    show_route_card(
        "🟢 Safety-prioritised route",
        result["safety_metrics"],
        "Minimises distance adjusted by the safety-priority score. It may be longer in order to favour better-mapped segments.",
    )

    short = result["shortest_metrics"]
    safe = result["safety_metrics"]
    detour_pct = ((safe["distance_km"] - short["distance_km"]) / short["distance_km"] * 100) if short["distance_km"] else 0
    score_gain = safe["safety_score"] - short["safety_score"]

    st.subheader("What changed?")
    c1, c2, c3 = st.columns(3)
    c1.metric("Extra distance", f"{max(0, safe['distance_km'] - short['distance_km']):.2f} km", f"{detour_pct:+.1f}% vs shortest")
    c2.metric("Score difference", f"{score_gain:+.1f} points")
    c3.metric("Extra walking time", format_minutes(max(0, safe["time_min"] - short["time_min"])))

    report_col1, report_col2 = st.columns([1, 3])
    with report_col1:
        st.download_button(
            "Download comparison CSV",
            data=make_csv_report(result),
            file_name="safepath_route_comparison.csv",
            mime="text/csv",
            use_container_width=True,
        )
    with report_col2:
        st.caption("The CSV contains route metrics only; it does not include the entered addresses.")

    st.subheader("Map and mapped support locations")
    st_folium(make_map(result), use_container_width=True, height=560, returned_objects=[])
    st.caption("Blue = shortest route · Green = safety-prioritised route · Purple = mapped emergency-support facility")

    st.subheader("How complete is the map information?")
    cov1, cov2 = st.columns(2)
    cov1.metric("Lighting information mapped", f"{safe['lighting_coverage_pct']:.0f}% of route length")
    cov2.metric("Sidewalk information mapped", f"{safe['sidewalk_coverage_pct']:.0f}% of route length")
    if safe["mapped_street_coverage_pct"] < 35:
        st.error(
            "Low mapped street-information coverage on the safety-prioritised route. "
            "Many lighting/sidewalk values are unknown, so the score is weak evidence. "
            "Do not treat this route as safer based on the score alone."
        )
    elif safe["mapped_street_coverage_pct"] < 70:
        st.warning(
            "Some lighting or sidewalk information is missing. Verify the route locally, "
            "especially after dark."
        )
    else:
        st.info(
            "A relatively large share of street segments has lighting/sidewalk tags, "
            "but mapped information can still be incomplete or outdated."
        )

    if not result["poi_query_succeeded"]:
        st.warning(
            "The public-place/emergency-facility map query was unavailable. "
            "Those components were treated neutrally; this run is based mainly on street tags."
        )
    else:
        st.caption(
            f"The map query returned {result['poi_features_found']} mapped features in the search area. "
            "A mapped facility is not proof that it is open, staffed or reachable at this moment."
        )

    with st.expander("How SafePath calculates the score"):
        st.markdown(
            """
            The route score is a **heuristic index**, not a probability of an incident.

            | Factor | Weight | What the app checks |
            |---|---:|---|
            | Mapped street lighting | 30% | `lit=yes/no`; missing values are treated as unknown |
            | Pedestrian infrastructure | 25% | Sidewalk tags and separately mapped pedestrian ways |
            | Nearby public activity proxy | 20% | Mapped shops, public places and transit stops |
            | Emergency-support proximity | 15% | Mapped police, fire and medical facilities |
            | Road context | 10% | Street type as a weak contextual factor |

            The algorithm first finds the shortest path. It then runs a weighted shortest-path
            search where each segment's distance is multiplied by a penalty based on its score.
            Increasing **Safety prioritisation** increases the penalty for lower-scoring segments.
            """
        )

    st.caption(
        "Map/data source: OpenStreetMap contributors. Geocoding and map data are retrieved online; "
        "results depend on current map coverage."
    )

st.divider()
st.caption(
    "SafePath student prototype · No account is required. The app does not intentionally save journey searches. "
    "Do not enter sensitive personal details."
)
