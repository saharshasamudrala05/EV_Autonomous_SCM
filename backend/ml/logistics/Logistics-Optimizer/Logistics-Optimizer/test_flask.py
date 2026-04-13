import subprocess
import requests
import time

p = subprocess.Popen(["python", "vrp-service/main.py"])
time.sleep(2) # wait for flask to start

payload = {
    "travel_time_matrix": [
        [0, 100, 200, 300],
        [100, 0, 100, 200],
        [200, 100, 0, 100],
        [300, 200, 100, 0]
    ],
    "num_vehicles": 2,
    "depot": [0, 1], 
    "destination": 3,
    "demands": [0, 0, 10, 0],
    "vehicle_capacities": [5, 15],
    "vehicle_types": ["van", "container_truck"],
    "time_windows": [
        [0, 86400],
        [0, 86400],
        [0, 86400],
        [0, 86400]
    ]
}

try:
    resp = requests.post("http://127.0.0.1:5001/solve", json=payload)
    print("Status code:", resp.status_code)
    print("Response:", resp.text)
finally:
    p.terminate()
