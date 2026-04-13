const axios = require('axios');

const payload = {
  "vehicles": [
    {
      "id": "v1",
      "type": "container_truck",
      "startLocation": {
        "lat": 16.5833,
        "lng": 78.3333,
        "address": "Nagarkurnool, Telangana, India"
      },
      "capacityUnits": 60
    },
    {
      "id": "v2",
      "type": "container_truck",
      "startLocation": {
        "lat": 16.3167,
        "lng": 78.9333,
        "address": "Achampet, Achampet mandal, Nagarkurnool"
      },
      "capacityUnits": 50
    },
    {
      "id": "v3",
      "type": "container_truck",
      "startLocation": {
        "lat": 16.6974,
        "lng": 78.9322,
        "address": "Devarakonda, Devarakonda mandal, Nalgonda"
      },
      "capacityUnits": 50
    },
    {
      "id": "v4",
      "type": "container_truck",
      "startLocation": {
        "lat": 17.0709,
        "lng": 78.2066,
        "address": "Shadnagar, Farooqnagar mandal, Ranga reddy"
      },
      "capacityUnits": 50
    },
    {
      "id": "v5",
      "type": "container_truck",
      "startLocation": {
        "lat": 17.3364,
        "lng": 78.5834,
        "address": "BN Reddy Nagar, Hayathnagar mandal, GHMC East zone, hyderabad"
      },
      "capacityUnits": 50
    }
  ],
  "depot": {
    "lat": 16.5659006,
    "lng": 78.4266007
  },
  "destination": {
    "lat": 17.4284936,
    "lng": 78.5528098
  },
  "stops": [
    { "lat": 16.6721316, "lng": 78.4880729, "demand": 10 },
    { "lat": 16.9847566, "lng": 78.4997445, "demand": 10 },
    { "lat": 17.2090428, "lng": 78.4767822, "demand": 10 },
    { "lat": 17.5022292, "lng": 78.5088584, "demand": 10 },
    { "lat": 17.4346769, "lng": 78.5047567, "demand": 10 },
    { "lat": 17.4696885, "lng": 78.3851526, "demand": 10 },
    { "lat": 16.4464448, "lng": 78.456038, "demand": 10 }
  ],
  "demands": [10, 10, 10, 10, 10, 10, 10],
  "evProfile": {
    "batteryCapacity_Wh": 50000,
    "initialCharge_Wh": 40000,
    "minChargeAtDestination_Wh": 10000,
    "batteryCapacityKwh": 100,
    "currentSocPercent": 100,
    "minReturnSocPercent": 20,
    "consumptionKwhPer100km": 20
  },
  "materialType": "ev_vehicle",
  "materialWeight": 500
};

async function test() {
  try {
    const res = await axios.post('http://127.0.0.1:5000/api/optimization/optimize', payload);
    console.log("Success:", res.data);
  } catch (err) {
    if (err.response) {
      console.error("Error Response:", err.response.status, err.response.data);
    } else {
      console.error("Error:", err.message);
    }
  }
}

test();
