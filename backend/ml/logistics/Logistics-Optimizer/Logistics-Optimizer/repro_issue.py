"""
repro_issue.py — Regression tests for the missing-delivery-points fix.

Tests verify:
  1. All stops with demand > 0 are included (basic routing)
  2. Stops with demand = 0 (waypoints) are included in the route
  3. Total demand > total capacity → 400 error (not silent drops)
  4. TSP fast path is only used when a single vehicle can hold all demand
  5. Multi-vehicle routing distributes all stops correctly
"""

import os
import subprocess
import requests
import time
import json
import sys

python_cmd = "py" if os.name == "nt" else "python"
p = subprocess.Popen(
    [python_cmd, "vrp-service/main.py"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
)
time.sleep(3)  # Allow Flask to start

BASE_URL = "http://127.0.0.1:5001/solve"
PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"

results = []


def run_test(name: str, payload: dict, expect_status: int, check_fn=None):
    """Run a single test case. Returns True on pass."""
    try:
        resp = requests.post(BASE_URL, json=payload, timeout=30)
        status_ok = resp.status_code == expect_status

        detail = ""
        check_ok = True
        if check_fn and resp.status_code == 200:
            data = resp.json()
            check_ok, detail = check_fn(data)

        passed = status_ok and check_ok
        label = PASS if passed else FAIL
        print(f"{label} {name}")
        if not status_ok:
            print(f"       Expected HTTP {expect_status}, got {resp.status_code}")
            print(f"       Body: {resp.text[:300]}")
        if not check_ok:
            print(f"       Check failed: {detail}")

        results.append(passed)
        return passed

    except Exception as e:
        print(f"{FAIL} {name} — exception: {e}")
        results.append(False)
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Shared 4-node matrix (nodes 0-3):
#   0 = depot, 1/2/3 = delivery stops
# ─────────────────────────────────────────────────────────────────────────────
MATRIX_4 = [
    [0,  10, 20, 30],
    [10,  0, 10, 20],
    [20, 10,  0, 10],
    [30, 20, 10,  0],
]
TW_OPEN = [[0, 86400]] * 4  # fully open — solver should ignore


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Basic — all 3 stops (demand>0) must appear in the route
# ─────────────────────────────────────────────────────────────────────────────
def check_all_stops_visited(data):
    route = data["routes"][0]
    nodes = set(route["nodes"])
    missing = {1, 2, 3} - nodes
    if missing:
        return False, f"Missing nodes: {missing}"
    return True, ""


run_test(
    "TC1: All demand>0 stops included (single vehicle, TSP path)",
    payload={
        "travel_time_matrix": MATRIX_4,
        "num_vehicles": 1,
        "depot": 0,
        "destination": 0,
        "demands": [0, 5, 5, 5],        # total=15, capacity=50
        "vehicle_capacities": [50],
        "vehicle_types": ["van"],
        "time_windows": TW_OPEN,
    },
    expect_status=200,
    check_fn=check_all_stops_visited,
)


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Stops with demand=0 (waypoints) must be included
# ─────────────────────────────────────────────────────────────────────────────
def check_zero_demand_stop_included(data):
    # Nodes 1 and 3 have demand=0; they should still appear in the route.
    route = data["routes"][0]
    nodes = set(route["nodes"])
    missing = {1, 2, 3} - nodes
    if missing:
        return False, f"0-demand nodes missing from route: {missing}"
    return True, ""


run_test(
    "TC2: 0-demand waypoints are included in route",
    payload={
        "travel_time_matrix": MATRIX_4,
        "num_vehicles": 1,
        "depot": 0,
        "destination": 0,
        "demands": [0, 0, 5, 0],        # nodes 1 and 3 have 0 demand
        "vehicle_capacities": [50],
        "vehicle_types": ["van"],
        "time_windows": TW_OPEN,
    },
    expect_status=200,
    check_fn=check_zero_demand_stop_included,
)


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Total demand > total capacity → must return 400 (not drop stops)
# ─────────────────────────────────────────────────────────────────────────────
run_test(
    "TC3: Demand > capacity returns 400, not silent drops",
    payload={
        "travel_time_matrix": MATRIX_4,
        "num_vehicles": 2,
        "depot": [0, 0],
        "destination": 0,
        "demands": [0, 10, 10, 10],     # total demand=30
        "vehicle_capacities": [5, 5],   # total capacity=10 — infeasible
        "vehicle_types": ["van", "van"],
        "time_windows": TW_OPEN,
    },
    expect_status=400,
)


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Single vehicle, demand > vehicle capacity → must NOT use TSP path
#         (TSP path would silently succeed; solver must report infeasibility)
# ─────────────────────────────────────────────────────────────────────────────
run_test(
    "TC4: TSP fast path blocked when demand > vehicle capacity",
    payload={
        "travel_time_matrix": MATRIX_4,
        "num_vehicles": 1,
        "depot": 0,
        "destination": 0,
        "demands": [0, 10, 10, 10],     # total demand=30
        "vehicle_capacities": [20],     # capacity=20 — infeasible
        "vehicle_types": ["van"],
        "time_windows": TW_OPEN,
    },
    expect_status=400,
)


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Multi-vehicle — all stops must be distributed across vehicles
# ─────────────────────────────────────────────────────────────────────────────
def check_all_stops_across_vehicles(data):
    visited = set()
    for route in data["routes"]:
        visited.update(route["nodes"])
    missing = {1, 2, 3} - visited
    if missing:
        return False, f"Nodes {missing} not visited by any vehicle"
    return True, ""


run_test(
    "TC5: Multi-vehicle covers all stops",
    payload={
        "travel_time_matrix": MATRIX_4,
        "num_vehicles": 2,
        "depot": [0, 0],
        "destination": 0,
        "demands": [0, 5, 5, 5],        # total=15, capacity=10+10=20
        "vehicle_capacities": [10, 10],
        "vehicle_types": ["van", "van"],
        "time_windows": TW_OPEN,
    },
    expect_status=200,
    check_fn=check_all_stops_across_vehicles,
)


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: All stops have demand=0 (all waypoints) — every node still visited
# ─────────────────────────────────────────────────────────────────────────────
def check_all_zero_demand_visited(data):
    route = data["routes"][0]
    nodes = set(route["nodes"])
    missing = {1, 2, 3} - nodes
    if missing:
        return False, f"All-zero-demand nodes missing: {missing}"
    return True, ""


run_test(
    "TC6: All-zero-demand stops (all waypoints) still routed",
    payload={
        "travel_time_matrix": MATRIX_4,
        "num_vehicles": 1,
        "depot": 0,
        "destination": 0,
        "demands": [0, 0, 0, 0],        # every stop is a waypoint
        "vehicle_capacities": [50],
        "vehicle_types": ["van"],
        "time_windows": TW_OPEN,
    },
    expect_status=200,
    check_fn=check_all_zero_demand_visited,
)


# ─────────────────────────────────────────────────────────────────────────────
# Test 7: droppedNodes field is present and empty for a feasible problem
# ─────────────────────────────────────────────────────────────────────────────
def check_no_dropped_nodes(data):
    dropped = data.get("droppedNodes", [])
    if dropped:
        return False, f"Solver dropped nodes unexpectedly: {dropped}"
    return True, ""


run_test(
    "TC7: droppedNodes is empty for a feasible problem",
    payload={
        "travel_time_matrix": MATRIX_4,
        "num_vehicles": 1,
        "depot": 0,
        "destination": 0,
        "demands": [0, 3, 3, 3],
        "vehicle_capacities": [50],
        "vehicle_types": ["van"],
        "time_windows": TW_OPEN,
    },
    expect_status=200,
    check_fn=check_no_dropped_nodes,
)


# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
passed = sum(results)
total  = len(results)
print(f"\n{'='*50}")
print(f"Results: {passed}/{total} tests passed")
print('='*50)

# Teardown
try:
    if os.name == "nt":
        subprocess.call(["taskkill", "/F", "/T", "/PID", str(p.pid)])
    else:
        p.terminate()
        p.wait(timeout=5)
except Exception:
    pass

sys.exit(0 if passed == total else 1)