import L from 'leaflet';

// ─────────────────────────────────────────────────────────────────────────────
// Styles — injected once into <head>
//
// .vrp-vehicle-rot  → CSS transition makes every bearing update a smooth turn
// .vrp-vehicle-wrap → receives .vrp-done to trigger CSS fade-out on completion
// vrp-dest-bounce   → destination pin animation (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function injectStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('vrp-icon-styles')) return;
  const s = document.createElement('style');
  s.id = 'vrp-icon-styles';
  s.textContent = `
    @keyframes vrp-dest-bounce {
      0%,100% { transform:translateY(0);    }
      40%     { transform:translateY(-5px); }
    }
    @keyframes vrp-fade-out {
      from { opacity:1; }
      to   { opacity:0; pointer-events:none; }
    }
    /* Bearing rotation — CSS handles the interpolation, JS just writes the value */
    .vrp-vehicle-rot {
      will-change: transform;
      transition: transform 260ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
      transform-origin: 50% 50%;
      line-height: 0;
    }
    /* Adding this class triggers the fade-out animation */
    .vrp-vehicle-wrap.vrp-done {
      animation: vrp-fade-out 700ms ease-out 150ms forwards;
    }
  `;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// Color utilities
// ─────────────────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3 ? h.split('').map(c => c + c).join('') : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map(v =>
        Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0'),
      )
      .join('')
  );
}
function lighten(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + a, g + a, b + a);
}
function darken(hex: string, a: number): string {
  return lighten(hex, -a);
}

// ─────────────────────────────────────────────────────────────────────────────
// Scale factor from zoom level
// Zoom  6 → 0.45   Zoom 11 → 0.85   Zoom 13 → 1.0   Zoom 17 → 1.5
// ─────────────────────────────────────────────────────────────────────────────
export function zoomToScale(zoom: number): number {
  const raw = 0.3 + (zoom - 6) * 0.095;
  return Math.min(1.6, Math.max(0.4, raw));
}

// ─────────────────────────────────────────────────────────────────────────────
// TOP-DOWN COMPACT VEHICLE SVGs
//
// Icons are oriented with the vehicle's FRONT pointing UP (north at bearing=0).
// JS rotation then steers them onto the actual road heading.
//
// Design: flat overhead view, wide relative to height (Uber/Google Maps style),
// windshield glint, coloured roof panel, ground shadow ellipse.
// The previous tall portrait side-view icons have been replaced entirely.
// ─────────────────────────────────────────────────────────────────────────────

/** Large truck — overhead view, wide cab + long trailer */
const SVG_TRUCK = (color: string, sc: number) => {
  const w = Math.round(28 * sc);
  const h = Math.round(52 * sc);
  const d = darken(color, 22);
  const l = lighten(color, 30);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 52" width="${w}" height="${h}">
  <defs>
    <radialGradient id="tsh${sc}" cx="50%" cy="40%" r="60%">
      <stop offset="0%"   stop-color="#000" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="tbg${sc}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${l}"/>
      <stop offset="40%"  stop-color="${color}"/>
      <stop offset="60%"  stop-color="${d}"/>
      <stop offset="100%" stop-color="${l}"/>
    </linearGradient>
  </defs>
  <ellipse cx="14" cy="28" rx="12" ry="23" fill="url(#tsh${sc})"/>
  <rect x="5" y="18" width="18" height="30" rx="2" fill="url(#tbg${sc})"/>
  <rect x="4" y="4"  width="20" height="16" rx="4" fill="${color}"/>
  <rect x="6" y="5"  width="16" height="5"  rx="2.5" fill="${lighten(color,40)}" opacity="0.5"/>
  <rect x="7" y="6"  width="14" height="7"  rx="2"
        fill="rgba(180,225,255,0.75)" stroke="${d}" stroke-width="0.5"/>
  <polygon points="8,7 13,7 10,12" fill="white" opacity="0.35"/>
  <rect x="5"  y="4"  width="4"  height="2.5" rx="1" fill="white"   opacity="0.95"/>
  <rect x="19" y="4"  width="4"  height="2.5" rx="1" fill="white"   opacity="0.95"/>
  <rect x="5"  y="46" width="4"  height="2"   rx="1" fill="#ff3030" opacity="0.9"/>
  <rect x="19" y="46" width="4"  height="2"   rx="1" fill="#ff3030" opacity="0.9"/>
  <line x1="4" y1="20" x2="24" y2="20" stroke="${d}" stroke-width="1"/>
  <rect x="1"  y="7"  width="3"  height="2" rx="0.5" fill="${d}"/>
  <rect x="24" y="7"  width="3"  height="2" rx="0.5" fill="${d}"/>
</svg>`;
};

/** Delivery van — compact squarish body */
const SVG_VAN = (color: string, sc: number) => {
  const w = Math.round(24 * sc);
  const h = Math.round(38 * sc);
  const d = darken(color, 20);
  const l = lighten(color, 32);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 38" width="${w}" height="${h}">
  <defs>
    <radialGradient id="vsh${sc}" cx="50%" cy="45%" r="55%">
      <stop offset="0%"   stop-color="#000" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="vbg${sc}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${l}"/>
      <stop offset="50%"  stop-color="${color}"/>
      <stop offset="100%" stop-color="${l}"/>
    </linearGradient>
  </defs>
  <ellipse cx="12" cy="20" rx="10" ry="17" fill="url(#vsh${sc})"/>
  <rect x="3" y="6" width="18" height="28" rx="4" fill="url(#vbg${sc})"/>
  <rect x="5" y="7" width="14" height="5"  rx="2.5" fill="${lighten(color,38)}" opacity="0.5"/>
  <rect x="5" y="7" width="14" height="8"  rx="2.5"
        fill="rgba(180,225,255,0.72)" stroke="${d}" stroke-width="0.4"/>
  <polygon points="6,8 11,8 8,14" fill="white" opacity="0.3"/>
  <rect x="3"    y="6"  width="3.5" height="2"   rx="0.8" fill="white"   opacity="0.95"/>
  <rect x="17.5" y="6"  width="3.5" height="2"   rx="0.8" fill="white"   opacity="0.95"/>
  <rect x="3"    y="32" width="3.5" height="2"   rx="0.8" fill="#ff3030" opacity="0.9"/>
  <rect x="17.5" y="32" width="3.5" height="2"   rx="0.8" fill="#ff3030" opacity="0.9"/>
  <rect x="0.5"  y="9"  width="2.5" height="1.5" rx="0.4" fill="${d}"/>
  <rect x="21"   y="9"  width="2.5" height="1.5" rx="0.4" fill="${d}"/>
</svg>`;
};

/** Motorcycle / delivery bike */
const SVG_BIKE = (color: string, sc: number) => {
  const w = Math.round(14 * sc);
  const h = Math.round(30 * sc);
  const d = darken(color, 25);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 30" width="${w}" height="${h}">
  <defs>
    <radialGradient id="bksh${sc}" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#000" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="7" cy="15" rx="5" ry="13" fill="url(#bksh${sc})"/>
  <ellipse cx="7" cy="4"  rx="3" ry="3.5" fill="#1a1a1a"/>
  <ellipse cx="7" cy="4"  rx="1.5" ry="2" fill="#333"/>
  <ellipse cx="7" cy="26" rx="3" ry="3.5" fill="#1a1a1a"/>
  <ellipse cx="7" cy="26" rx="1.5" ry="2" fill="#333"/>
  <rect x="4" y="7" width="6" height="16" rx="2" fill="${color}"/>
  <rect x="5" y="8" width="4" height="4"  rx="1.5" fill="${lighten(color,35)}" opacity="0.55"/>
  <ellipse cx="7" cy="6"  rx="1.5" ry="1"   fill="white"   opacity="0.9"/>
  <ellipse cx="7" cy="24" rx="1.2" ry="0.8" fill="#ff3030" opacity="0.85"/>
  <line x1="3" y1="9" x2="11" y2="9" stroke="${d}" stroke-width="1.2" stroke-linecap="round"/>
</svg>`;
};

/** Auto-rickshaw */
const SVG_AUTO = (color: string, sc: number) => {
  const w = Math.round(22 * sc);
  const h = Math.round(30 * sc);
  const d = darken(color, 18);
  const l = lighten(color, 28);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 30" width="${w}" height="${h}">
  <defs>
    <radialGradient id="ash${sc}" cx="50%" cy="45%" r="55%">
      <stop offset="0%"   stop-color="#000" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="abg${sc}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${l}"/>
      <stop offset="50%"  stop-color="${color}"/>
      <stop offset="100%" stop-color="${l}"/>
    </linearGradient>
  </defs>
  <ellipse cx="11" cy="16" rx="9" ry="13" fill="url(#ash${sc})"/>
  <path d="M5 5 Q11 3 17 5 L18 24 Q11 27 4 24 Z" fill="url(#abg${sc})"/>
  <ellipse cx="11" cy="9" rx="6" ry="5" fill="${lighten(color,25)}" opacity="0.6"/>
  <path d="M6 6 Q11 4 16 6 L15 12 Q11 14 7 12 Z"
        fill="rgba(180,225,255,0.70)" stroke="${d}" stroke-width="0.4"/>
  <polygon points="7,7 11,7 9,11" fill="white" opacity="0.3"/>
  <ellipse cx="4"  cy="8"  rx="2" ry="2.5" fill="#1a1a1a"/>
  <ellipse cx="18" cy="8"  rx="2" ry="2.5" fill="#1a1a1a"/>
  <ellipse cx="11" cy="26" rx="2" ry="2.5" fill="#1a1a1a"/>
  <circle cx="6"  cy="5" r="1.2" fill="white" opacity="0.9"/>
  <circle cx="16" cy="5" r="1.2" fill="white" opacity="0.9"/>
</svg>`;
};

/** Bicycle — very slim top-down */
const SVG_BICYCLE = (color: string, sc: number) => {
  const w = Math.round(10 * sc);
  const h = Math.round(28 * sc);
  const d = darken(color, 20);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 28" width="${w}" height="${h}">
  <defs>
    <radialGradient id="bcsh${sc}" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#000" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="5" cy="14" rx="4" ry="12" fill="url(#bcsh${sc})"/>
  <circle cx="5" cy="3.5"  r="3"   fill="none" stroke="#1a1a1a" stroke-width="1.8"/>
  <circle cx="5" cy="3.5"  r="1.2" fill="none" stroke="#444"    stroke-width="0.8"/>
  <circle cx="5" cy="24.5" r="3"   fill="none" stroke="#1a1a1a" stroke-width="1.8"/>
  <circle cx="5" cy="24.5" r="1.2" fill="none" stroke="#444"    stroke-width="0.8"/>
  <line x1="5" y1="6.5"  x2="5" y2="21.5" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  <line x1="2" y1="8"    x2="8" y2="8"    stroke="${d}"     stroke-width="1.5" stroke-linecap="round"/>
  <rect x="3" y="15" width="4" height="5" rx="1" fill="${d}"/>
  <circle cx="5" cy="5.5" r="1.2" fill="white" opacity="0.85"/>
</svg>`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Vehicle type → builder + base dimensions at scale=1.0 (w × h px)
// ─────────────────────────────────────────────────────────────────────────────
type SvgBuilder = (color: string, sc: number) => string;

const VEHICLE_SVG_MAP: Record<string, SvgBuilder> = {
  mining_haul_truck:  SVG_TRUCK,
  heavy_dump_truck:   SVG_TRUCK,
  bulk_powder_tanker: SVG_TRUCK,
  chemical_tanker:    SVG_TRUCK,
  container_truck:    SVG_TRUCK,
  forklift:           SVG_TRUCK,
  agv:                SVG_VAN,
  flatbed_truck:      SVG_TRUCK,
  tugger_train:       SVG_TRUCK,
  car_carrier_truck:  SVG_TRUCK,
  rail_car:           SVG_TRUCK,
  roro_cargo_ship:    SVG_TRUCK,
  bike:               SVG_BIKE,
  auto_rickshaw:      SVG_AUTO,
  van:                SVG_VAN,
  delivery_bike:      SVG_BICYCLE,
  ev_vehicle:         SVG_VAN,
};

const BASE_DIMS: Record<string, [number, number]> = {
  truck:   [28, 52],
  van:     [24, 38],
  bike:    [14, 30],
  auto:    [22, 30],
  bicycle: [10, 28],
};

function builderToDims(builder: SvgBuilder): [number, number] {
  if (builder === SVG_TRUCK)   return BASE_DIMS.truck;
  if (builder === SVG_VAN)     return BASE_DIMS.van;
  if (builder === SVG_BIKE)    return BASE_DIMS.bike;
  if (builder === SVG_AUTO)    return BASE_DIMS.auto;
  if (builder === SVG_BICYCLE) return BASE_DIMS.bicycle;
  return BASE_DIMS.truck;
}

// ─────────────────────────────────────────────────────────────────────────────
// getVehicleIcon
//
// Two-layer structure:
//   .vrp-vehicle-wrap  — receives .vrp-done → CSS fade-out on route completion
//   .vrp-vehicle-rot   — CSS transition rotates smoothly on every bearing update
// ─────────────────────────────────────────────────────────────────────────────
export function getVehicleIcon(
  vehicleType:  string,
  color:        string,
  bearing:      number  = 0,
  _isActive:    boolean = false,  // kept for API compat — no longer used
  zoom:         number  = 13,
): L.DivIcon {
  injectStyles();

  const sc      = zoomToScale(zoom);
  const builder = VEHICLE_SVG_MAP[vehicleType] ?? SVG_TRUCK;
  const svgBody = builder(color, sc);
  const [baseW, baseH] = builderToDims(builder);

  const W = Math.round(baseW * sc);
  const H = Math.round(baseH * sc);

  const html = `
    <div class="vrp-vehicle-wrap" style="
      position:relative; width:${W}px; height:${H}px;
      filter:drop-shadow(0 2px 5px rgba(0,0,0,0.6))
             drop-shadow(0 1px 2px rgba(0,0,0,0.4));
    ">
      <div class="vrp-vehicle-rot" style="
        width:${W}px; height:${H}px;
        transform:rotate(${bearing}deg);
      ">${svgBody}</div>
    </div>`;

  return L.divIcon({
    className:   '',
    html,
    iconSize:    [W + 12, H + 12],
    iconAnchor:  [(W + 12) / 2, (H + 12) / 2],
    popupAnchor: [0, -((H + 12) / 2 + 4)],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getVehicleBadgeSvg — fleet panels, always scale=1
// ─────────────────────────────────────────────────────────────────────────────
export function getVehicleBadgeSvg(vehicleType: string): string {
  const builder = VEHICLE_SVG_MAP[vehicleType] ?? SVG_TRUCK;
  return builder('#6b7280', 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Static markers — zoom-aware
// ─────────────────────────────────────────────────────────────────────────────

export function makeDepotIcon(zoom = 13): L.DivIcon {
  injectStyles();
  const sc   = zoomToScale(zoom);
  const size = Math.round(34 * sc);
  const icon = Math.round(16 * sc);
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px; height:${size}px;
        background:linear-gradient(145deg,#6366f1,#4338ca);
        border-radius:50%;
        border:${Math.max(2, Math.round(2.5 * sc))}px solid rgba(255,255,255,0.9);
        box-shadow:0 3px 10px rgba(67,56,202,0.65),0 1px 3px rgba(0,0,0,0.4);
        display:flex; align-items:center; justify-content:center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="${icon}" height="${icon}"
             viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>`,
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

export function makeStopIcon(index: number, zoom = 13): L.DivIcon {
  injectStyles();
  const sc   = zoomToScale(zoom);
  const size = Math.round(28 * sc);
  const fs   = Math.max(8, Math.round(11 * sc));
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px; height:${size}px;
        background:linear-gradient(145deg,#1e293b,#0f172a);
        border-radius:50%;
        border:${Math.max(1, Math.round(2 * sc))}px solid rgba(255,255,255,0.85);
        box-shadow:0 2px 6px rgba(0,0,0,0.55);
        display:flex; align-items:center; justify-content:center;
        color:white; font-size:${fs}px; font-weight:700;
        font-family:system-ui,-apple-system,sans-serif;
      ">${index}</div>`,
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

export function makeChargingIcon(zoom = 13): L.DivIcon {
  injectStyles();
  const sc   = zoomToScale(zoom);
  const size = Math.round(30 * sc);
  const icon = Math.round(14 * sc);
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px; height:${size}px;
        background:linear-gradient(145deg,#fbbf24,#d97706);
        border-radius:50%;
        border:${Math.max(2, Math.round(2 * sc))}px solid rgba(255,255,255,0.9);
        box-shadow:0 3px 8px rgba(217,119,6,0.65),0 1px 3px rgba(0,0,0,0.35);
        display:flex; align-items:center; justify-content:center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="${icon}" height="${icon}"
             viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </div>`,
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

// Destination pin — fixed size, pops on dark tiles
export const destinationIcon = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:40px;height:52px;
                animation:vrp-dest-bounce 2.4s ease-in-out infinite;">
      <div style="
        position:absolute;top:0;left:0;width:40px;height:40px;
        background:linear-gradient(145deg,#f87171,#dc2626);
        border-radius:50%;border:3px solid rgba(255,255,255,0.9);
        box-shadow:0 4px 14px rgba(220,38,38,0.7),0 2px 4px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19"
             viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div style="
        position:absolute;bottom:0;left:50%;transform:translateX(-50%);
        width:0;height:0;
        border-left:8px solid transparent;border-right:8px solid transparent;
        border-top:14px solid #dc2626;
        filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4));
      "></div>
    </div>`,
  iconSize:    [40, 52],
  iconAnchor:  [20, 52],
  popupAnchor: [0, -54],
});

// ─────────────────────────────────────────────────────────────────────────────
// Tile providers — exported so MapCanvas can switch on user preference.
//
// Dark  : CartoDB Dark Matter  — high contrast, coloured icons pop well
// Light : CartoDB Voyager      — clean bright style, close to Google Maps feel
// ─────────────────────────────────────────────────────────────────────────────
export const DARK_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export const LIGHT_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

// Both providers share the same attribution text.
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' +
  ' contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** @deprecated use TILE_ATTRIBUTION */
export const DARK_TILE_ATTRIBUTION = TILE_ATTRIBUTION;

// Legacy exports for backward compatibility
export const depotIcon    = makeDepotIcon(13);
export const chargingIcon = makeChargingIcon(13);
export const stopIcon     = (index: number) => makeStopIcon(index, 13);

export const routeColors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

export function calculateBearing(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const dLon = (lng2 - lng1) * (Math.PI / 180);
  const y    = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x    =
    Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}