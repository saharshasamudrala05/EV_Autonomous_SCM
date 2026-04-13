from flask import Flask, request, jsonify
from flask_cors import CORS
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import math

app = Flask(__name__)
CORS(app)

import psycopg2
from psycopg2.extras import RealDictCursor

# Penalty for skipping a delivery stop.
DISJUNCTION_PENALTY = 100_000

# --- H3 to Lat/Lng Decoder (Surgical Fallback) ---
def h3_to_lat_lng(h3_hex):
    """
    Titan V4 Spatial Decoder. Converts H3 Hex strings to [lat, lng].
    Note: Real H3 conversion would use the 'h3' library. 
    This is a deterministic spatial anchor fallback for the presentation layer.
    """
    # Placeholder for the H3 library logic (using state centroids mapped earlier)
    # The database now contains valid loc_h3_index values.
    # For presentation, we extract the centroid from the H3 index if possible,
    # or return a jittered national center if metadata is missing.
    # In a full-scale deployment, this would be: return h3.h3_to_geo(h3_hex)
    try:
        # Simple hash-based jitter to ensure dots don't overlap as requested
        h = hash(h3_hex)
        jitter_lat = (h % 1000) / 10000.0
        jitter_lng = ((h >> 3) % 1000) / 10000.0
        
        # Base Coordinates (State Centroids mapped to H3 indices)
        # Using the anchors defined in the spatial recovery script
        anchors = {
            "86608b1b7ffffff": [19.75, 75.71],  # Maharashtra
            "863d146b7ffffff": [31.00, 75.40],  # Punjab
            "8660144afffffff": [15.30, 75.70],  # Karnataka
            "86618d487ffffff": [11.00, 78.00],  # Tamil Nadu
            "864101b27ffffff": [27.00, 81.00],  # Uttar Pradesh
            "8660deb2fffffff": [22.00, 71.50],  # Gujarat
        }
        base = anchors.get(h3_hex, [23.00, 77.00]) # National center fallback
        return [base[0] + jitter_lat, base[1] + jitter_lng]
    except:
        return [23.0, 77.0]

def get_db_connection():
    return psycopg2.connect('postgresql://postgres:saharsha@localhost:5432/nexus_scm')

@app.route('/api/nodes', methods=['GET'])
def get_network_nodes():
    state = request.args.get('state')
    print(f"[TITAN V4] Fetching network nodes for state: {state}")
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if state:
            query = "SELECT * FROM public.network_nodes WHERE name ILIKE %s"
            cur.execute(query, (f"%{state}%",))
        else:
            cur.execute("SELECT * FROM public.network_nodes LIMIT 100")
            
        rows = cur.fetchall()
        
        # Convert H3 to Lat/Lng for Leaflet compatibility
        for row in rows:
            coords = h3_to_lat_lng(row['loc_h3_index'])
            row['lat'] = coords[0]
            row['lng'] = coords[1]
            
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ── Helpers ───────────────────────────────────────────────────────────────────

def compute_distance_km(time_matrix, route_indices, speed_kmh=40.0):
    """Estimate route distance in km from travel time (seconds) and assumed speed."""
    total_seconds = sum(
        time_matrix[route_indices[i]][route_indices[i + 1]]
        for i in range(len(route_indices) - 1)
    )
    return round((total_seconds / 3600.0) * speed_kmh, 2)


def compute_co2_kg(distance_km, vehicle_type="container_truck"):
    """
    Estimate CO2 emissions in kg.
    Factors (kg CO2 per km):
      container_truck / car_carrier_truck : 0.9 / 1.1
      heavy_dump_truck                    : 1.3
      flatbed_truck                       : 0.85
      van                                 : 0.25
      delivery_bike / bike                : 0.05 / 0.0
      auto_rickshaw                       : 0.12
      default                             : 0.6
    """
    factors = {
        "container_truck":   0.9,
        "car_carrier_truck": 1.1,
        "heavy_dump_truck":  1.3,
        "flatbed_truck":     0.85,
        "van":               0.25,
        "delivery_bike":     0.05,
        "bike":              0.0,
        "auto_rickshaw":     0.12,
    }
    return round(distance_km * factors.get(vehicle_type, 0.6), 2)


def adaptive_time_limit(n: int, num_vehicles: int) -> int:
    """
    Return solver time limit in seconds scaled to problem size.
    Avoids burning 15s on a 4-stop problem that solves in 1s.

    Scale:
      n ≤ 8  nodes  → 3s
      n ≤ 15 nodes  → 5s
      n ≤ 30 nodes  → 8s
      n ≤ 60 nodes  → 12s
      n > 60 nodes  → 20s (hard cap; beyond this use a dedicated fleet solver)
    """
    if n <= 8:
        return 3
    if n <= 15:
        return 5
    if n <= 30:
        return 8
    if n <= 60:
        return 12
    return 20


# ── TSP fast path ────────────────────────────────────────────────────────────

def solve_tsp_nearest_neighbor(
    time_matrix: tuple,
    start: int,
    delivery_nodes: list,
    end: int,
) -> list:
    """
    Nearest-neighbor greedy TSP for single-vehicle problems.
    Returns a complete node sequence [start, ...stops..., end].
    Runs in O(n²) but n is small (≤30 typical) so it's <1ms.
    Used instead of OR-Tools when num_vehicles == 1 and no time windows,
    avoiding all model-building and search overhead (~2–5s saved).
    """
    unvisited = list(delivery_nodes)
    route = [start]
    current = start

    while unvisited:
        nearest = min(unvisited, key=lambda node: time_matrix[current][node])
        route.append(nearest)
        unvisited.remove(nearest)
        current = nearest

    if end != start:
        route.append(end)
    else:
        route.append(start)

    return route


# ── Solver endpoint ───────────────────────────────────────────────────────────

@app.route('/solve', methods=['POST'])
def solve_vrp():
    data = request.json

    # ── 1. Parse inputs ───────────────────────────────────────────────────────
    time_matrix_raw    = data.get('travel_time_matrix')
    num_vehicles       = data.get('num_vehicles')
    demands            = data.get('demands', [])
    vehicle_capacities = data.get('vehicle_capacities', [])
    vehicle_types      = data.get('vehicle_types', [])
    time_windows       = data.get('time_windows')       # [[early, late], ...] or None

    depot_input = data.get('depot', 0)
    if isinstance(depot_input, int):
        starts = [depot_input] * num_vehicles
    elif isinstance(depot_input, list):
        starts = list(depot_input)
    else:
        starts = [0] * num_vehicles

    destination = data.get('destination')

    # EV physics (optional)
    battery_capacities = data.get('battery_capacities')
    min_return_soc     = data.get('min_return_soc', 20)
    consumption_rate   = data.get('consumption_rate', 0.2)
    temperature_factor = data.get('temperature_factor', 1.0)

    # ── 2. Validate ───────────────────────────────────────────────────────────
    if not time_matrix_raw or not num_vehicles:
        return jsonify({"error": "Missing required fields: travel_time_matrix, num_vehicles"}), 400

    n = len(time_matrix_raw)
    if n < 2:
        return jsonify({"error": f"Matrix must have at least 2 nodes, got {n}"}), 400

    # Convert to tuple-of-tuples once — faster O(1) indexing in OR-Tools
    # callbacks (called millions of times during search).
    time_matrix = tuple(tuple(row) for row in time_matrix_raw)

    # Pad / trim vehicle_capacities
    if not vehicle_capacities:
        vehicle_capacities = [9999] * num_vehicles
    while len(vehicle_capacities) < num_vehicles:
        vehicle_capacities.append(vehicle_capacities[-1])
    vehicle_capacities = list(vehicle_capacities[:num_vehicles])

    # Pad / trim demands
    if not demands:
        return jsonify({"error": "demands array is required and must not be empty"}), 400
    while len(demands) < n:
        demands.append(0)
    demands = list(demands[:n])

    # Pad / trim starts
    while len(starts) < num_vehicles:
        starts.append(starts[-1] if starts else 0)
    starts = list(starts[:num_vehicles])

    for i, s in enumerate(starts):
        if s < 0 or s >= n:
            return jsonify({"error": f"Vehicle {i} start index {s} is out of bounds (n={n})"}), 400

    # Build ends
    if destination is not None:
        if destination < 0 or destination >= n:
            return jsonify({"error": f"Destination index {destination} is out of bounds (n={n})"}), 400
        ends = [destination] * num_vehicles
    else:
        ends = list(starts)

    # ── 3. Identify node categories ───────────────────────────────────────────
    depot_and_end_nodes = set(starts) | set(ends)
    if destination is not None:
        depot_and_end_nodes.add(destination)

    # FIX: Include ALL non-depot nodes as delivery nodes, regardless of demand.
    # Previously demand > 0 was required, which silently dropped 0-demand stops
    # (e.g. waypoints or stops where the user left demand blank).
    delivery_nodes = [
        node for node in range(n)
        if node not in depot_and_end_nodes
    ]

    print(f"[VRP] n={n}, vehicles={num_vehicles}, starts={starts}, ends={ends}")
    print(f"[VRP] depot_and_end_nodes={depot_and_end_nodes}")
    print(f"[VRP] delivery_nodes (all non-depot)={delivery_nodes}")
    print(f"[VRP] demands per node={demands}")

    # Log which nodes have 0 demand so we can trace the issue clearly.
    zero_demand_stops = [nd for nd in delivery_nodes if demands[nd] == 0]
    if zero_demand_stops:
        print(f"[VRP] NOTE: {len(zero_demand_stops)} stop(s) have 0 demand but will still be visited: {zero_demand_stops}")

    if not delivery_nodes:
        return jsonify({"error": "No delivery nodes found. Check that node indices are correct."}), 400

    # ── 3a. Early capacity check ──────────────────────────────────────────────
    # If total demand already exceeds total capacity we know no solution exists.
    # Return a clear 400 instead of letting OR-Tools spin for the full time limit.
    total_demand = sum(demands[nd] for nd in delivery_nodes)
    total_capacity = sum(vehicle_capacities)
    if total_demand > total_capacity:
        print(f"[VRP] INFEASIBLE: total_demand={total_demand} > total_capacity={total_capacity}")
        return jsonify({
            "error": (
                f"Total demand ({total_demand} units) exceeds total fleet capacity "
                f"({total_capacity} units). Add more vehicles or reduce stop demands."
            )
        }), 400

    print(f"[VRP] Capacity check passed: demand={total_demand}, capacity={total_capacity}")

    # Detect whether real time windows were provided.
    # "Real" means at least one delivery node has a window tighter than [0, 86400].
    # Default windows sent by routes.ts are always [0, 86400] — these must NOT
    # trigger OR-Tools since they carry no scheduling constraint.
    horizon_sec = 24 * 3600
    has_time_windows = False
    if time_windows and len(time_windows) == n:
        for node in delivery_nodes:
            tw = time_windows[node]
            if not tw or len(tw) < 2:
                continue
            early, late = int(tw[0]), int(tw[1])
            # Only treat as a real time window if it's actually constrained.
            # [0, 86400] is the default open window — skip it entirely.
            if early > 0 or late < horizon_sec:
                has_time_windows = True
                break

    # FIX: Add capacity check to TSP eligibility.
    # If the single vehicle can't hold all the demand, the TSP fast path must
    # not be used — OR-Tools needs to handle the infeasibility (or find a
    # multi-vehicle solution if num_vehicles > 1).
    single_vehicle_can_handle = (
        num_vehicles == 1 and
        total_demand <= vehicle_capacities[0]
    )
    tsp_eligible = (single_vehicle_can_handle and not has_time_windows)
    print(f"[VRP] has_time_windows={has_time_windows}, tsp_eligible={tsp_eligible}, "
          f"single_vehicle_can_handle={single_vehicle_can_handle}")

    # ── 4. TSP fast path (single vehicle, no time windows, capacity OK) ───────
    # When there is exactly one vehicle and no real time windows, the problem
    # is a plain TSP. Nearest-neighbor solves it in <1ms vs OR-Tools ~3–5s.
    if tsp_eligible:
        print("[VRP] Single-vehicle TSP fast path — skipping OR-Tools")
        node_sequence = solve_tsp_nearest_neighbor(
            time_matrix, starts[0], delivery_nodes, ends[0]
        )
        distance_km = compute_distance_km(time_matrix, node_sequence)
        vtype = vehicle_types[0] if vehicle_types else "container_truck"
        co2_kg = compute_co2_kg(distance_km, vtype)
        total_time = sum(
            time_matrix[node_sequence[i]][node_sequence[i + 1]]
            for i in range(len(node_sequence) - 1)
        )
        # Count load from nodes with non-zero demand only (waypoints have 0 demand)
        load = sum(demands[nd] for nd in node_sequence if nd in set(delivery_nodes))
        print(f"[VRP] TSP route: nodes={node_sequence}, load={load}, dist={distance_km}km")
        return jsonify({"routes": [{
            "vehicleId":        0,
            "nodes":            node_sequence,
            "loadUnits":        load,
            "capacityUnits":    vehicle_capacities[0],
            "distanceKm":       distance_km,
            "co2Kg":            co2_kg,
            "totalTimeSeconds": total_time,
        }]})

    # ── 5. Build OR-Tools model ───────────────────────────────────────────────
    manager = pywrapcp.RoutingIndexManager(n, num_vehicles, starts, ends)
    routing = pywrapcp.RoutingModel(manager)

    # ── 5a. Arc cost = travel time ────────────────────────────────────────────
    def time_callback(from_index, to_index):
        return time_matrix[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

    transit_cb = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_cb)

    # ── 5b. Capacity dimension ────────────────────────────────────────────────
    def demand_callback(from_index):
        return demands[manager.IndexToNode(from_index)]

    demand_cb = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_cb,
        0,
        vehicle_capacities,
        True,
        'Capacity'
    )

    # ── 5c. TIME dimension — only when time windows are actually set ───────────
    # Skipping this dimension when unneeded removes a significant chunk of
    # OR-Tools model overhead and lets the solver focus on cost + capacity.
    if has_time_windows:
        routing.AddDimension(
            transit_cb,
            30 * 60,      # max wait: 30 min
            horizon_sec,
            False,
            'Time'
        )
        time_dimension = routing.GetDimensionOrDie('Time')

        for node in range(n):
            if node in depot_and_end_nodes:
                continue
            tw = time_windows[node]
            if not tw or len(tw) < 2:
                continue
            early, late = int(tw[0]), int(tw[1])
            if late <= early or early < 0 or late > horizon_sec:
                continue
            index = manager.NodeToIndex(node)
            time_dimension.CumulVar(index).SetRange(early, late)
    else:
        # No time windows — penalise total travel time through arc cost only.
        # No extra dimension needed; the solver already minimises arc cost sum.
        print("[VRP] Skipping TIME dimension — no real time windows provided")

    # ── 5d. Stop distribution (multi-vehicle only) ────────────────────────────
    num_delivery = len(delivery_nodes)
    if num_vehicles > 1 and num_delivery > 1:
        max_stops_per_vehicle = math.ceil(num_delivery / num_vehicles) + 1

        # FIX: count ALL non-depot nodes (including 0-demand waypoints) in the
        # stop-distribution dimension, so they are included in routing.
        def count_callback(from_index):
            node = manager.IndexToNode(from_index)
            return 1 if node not in depot_and_end_nodes else 0

        count_cb = routing.RegisterUnaryTransitCallback(count_callback)
        routing.AddDimensionWithVehicleCapacity(
            count_cb,
            0,
            [max_stops_per_vehicle] * num_vehicles,
            True,
            'StopCount'
        )

        if num_delivery >= num_vehicles:
            stop_count_dim = routing.GetDimensionOrDie('StopCount')
            for vehicle_id in range(num_vehicles):
                stop_count_dim.CumulVar(routing.End(vehicle_id)).SetMin(1)

        print(f"[VRP] Distribution: {num_delivery} stops, max {max_stops_per_vehicle}/vehicle")

    # ── 5e. Mandatory visits ──────────────────────────────────────────────────
    # FIX: Use DISJUNCTION_PENALTY = 100_000 instead of 0.
    # With penalty=0 the solver was free to skip any stop at zero cost, which
    # is exactly the bug that caused delivery points to be dropped.
    # With penalty=100_000 skipping is astronomically expensive; the solver
    # will only do it if including the stop is *genuinely* impossible (e.g.
    # hard capacity overflow or irreconcilable time windows).
    dropped_nodes = []
    for node in delivery_nodes:
        routing.AddDisjunction([manager.NodeToIndex(node)], DISJUNCTION_PENALTY)

    # ── 5f. EV energy dimension (optional) ───────────────────────────────────
    if battery_capacities and len(battery_capacities) == num_vehicles:
        SPEED_MS = 40_000 / 3600  # 40 km/h in m/s

        def energy_callback(from_index, to_index):
            fn = manager.IndexToNode(from_index)
            tn = manager.IndexToNode(to_index)
            distance_km = (time_matrix[fn][tn] * SPEED_MS) / 1000.0
            kwh = distance_km * consumption_rate * temperature_factor * 1.1
            return int(kwh * 100)

        energy_cb = routing.RegisterTransitCallback(energy_callback)
        routing.AddDimensionWithVehicleCapacity(
            energy_cb,
            0,
            [int(cap * 100) for cap in battery_capacities],
            True,
            'Energy'
        )
        energy_dim = routing.GetDimensionOrDie('Energy')
        for vid in range(num_vehicles):
            max_expendable = int(
                battery_capacities[vid] * (1.0 - min_return_soc / 100.0) * 100
            )
            energy_dim.SetCumulVarSoftUpperBound(routing.End(vid), max_expendable, 50000)

    # ── 6. Search parameters ──────────────────────────────────────────────────
    search_params = pywrapcp.DefaultRoutingSearchParameters()

    # AUTOMATIC lets OR-Tools pick the best first-solution strategy for the
    # problem scale. For small instances it often finds the optimum before
    # GLS even starts — much faster than always using PATH_CHEAPEST_ARC.
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.AUTOMATIC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )

    # Adaptive time limit based on problem size — never burn 15s on a 4-node job.
    time_limit = adaptive_time_limit(n, num_vehicles)
    search_params.time_limit.seconds     = time_limit
    search_params.lns_time_limit.seconds = max(1, time_limit // 4)
    search_params.log_search             = False

    print(f"[VRP] Solver time limit: {time_limit}s (lns={max(1, time_limit // 4)}s), n={n}")

    # ── 7. Solve ──────────────────────────────────────────────────────────────
    solution = routing.SolveWithParameters(search_params)

    if not solution:
        return jsonify({
            "error":
                "No solution found. Possible causes: "
                "total demand exceeds capacity, time windows are too tight, "
                "or the road network is disconnected."
        }), 400

    # ── 7a. Check for dropped nodes and warn ──────────────────────────────────
    for node in delivery_nodes:
        index = manager.NodeToIndex(node)
        if solution.Value(routing.NextVar(index)) == index:
            dropped_nodes.append(node)

    if dropped_nodes:
        print(f"[VRP] WARNING: {len(dropped_nodes)} node(s) were dropped by solver "
              f"(genuine infeasibility): {dropped_nodes}")
        print(f"[VRP]   Demands at dropped nodes: "
              f"{[demands[nd] for nd in dropped_nodes]}")
    else:
        print(f"[VRP] All {len(delivery_nodes)} delivery nodes included in solution.")

    # ── 8. Extract results ────────────────────────────────────────────────────
    capacity_dim = routing.GetDimensionOrDie('Capacity')
    routes = []

    for vehicle_id in range(num_vehicles):
        index = routing.Start(vehicle_id)
        node_sequence = []

        while not routing.IsEnd(index):
            node_sequence.append(manager.IndexToNode(index))
            index = solution.Value(routing.NextVar(index))
        node_sequence.append(manager.IndexToNode(index))  # end node

        # FIX: A route is "used" if it visits ANY non-depot node (including
        # 0-demand waypoints), not just nodes with demand > 0.
        visited_delivery = [
            nd for nd in node_sequence
            if nd not in depot_and_end_nodes
        ]
        if not visited_delivery:
            print(f"[VRP] Vehicle {vehicle_id} unused — skipping")
            continue

        end_index  = routing.End(vehicle_id)
        load       = solution.Value(capacity_dim.CumulVar(end_index))
        distance_km = compute_distance_km(time_matrix, node_sequence)

        vtype  = vehicle_types[vehicle_id] if vehicle_id < len(vehicle_types) else "container_truck"
        co2_kg = compute_co2_kg(distance_km, vtype)

        total_time_seconds = sum(
            time_matrix[node_sequence[i]][node_sequence[i + 1]]
            for i in range(len(node_sequence) - 1)
        )

        routes.append({
            "vehicleId":        vehicle_id,
            "nodes":            node_sequence,
            "loadUnits":        load,
            "capacityUnits":    vehicle_capacities[vehicle_id],
            "distanceKm":       distance_km,
            "co2Kg":            co2_kg,
            "totalTimeSeconds": total_time_seconds,
        })

        print(f"[VRP] Vehicle {vehicle_id}: nodes={node_sequence}, "
              f"load={load}/{vehicle_capacities[vehicle_id]}, "
              f"dist={distance_km}km, CO2={co2_kg}kg")

    if not routes:
        return jsonify({
            "error":
                "Solver found a solution but all vehicles were unused. "
                "Possible causes: \n"
                "1. Stop demands exceed vehicle capacities.\n"
                "2. EV Battery Capacity is too small to complete the journey "
                "(Try increasing Battery Capacity or min SOC %)."
        }), 400

    return jsonify({
        "routes": routes,
        "droppedNodes": dropped_nodes,   # surface to caller for debugging
    })


if __name__ == '__main__':
    app.run(port=5001, host='127.0.0.1', debug=False)