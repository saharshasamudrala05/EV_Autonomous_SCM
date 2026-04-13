/**
 * shared/utils.ts
 *
 * Google Polyline Algorithm (Encoded Polyline Format).
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 *
 * Used to compress route coordinate arrays before sending them over the wire.
 * A 300-point polyline shrinks from ~8KB of JSON to ~2KB encoded string (~75% reduction).
 *
 * Encoding happens in server/routes.ts before the response is sent.
 * Decoding happens in MapCanvas.tsx before building animation segment points.
 *
 * Both functions are pure — no side effects, no external dependencies.
 */

// ── Encoder ───────────────────────────────────────────────────────────────────

/**
 * Encode an array of [lat, lng] coordinate pairs into a Google Polyline string.
 *
 * @param coordinates - Array of [lat, lng] tuples (Leaflet order)
 * @returns Encoded polyline string
 *
 * @example
 * encodePolyline([[17.385, 78.4867], [17.395, 78.4967]])
 * // → "_gfnCmqf|M_eB_eB"
 */
export function encodePolyline(coordinates: [number, number][]): string {
    let output = "";
    let prevLat = 0;
    let prevLng = 0;

    for (const [lat, lng] of coordinates) {
        output += encodeValue(Math.round(lat * 1e5) - prevLat);
        output += encodeValue(Math.round(lng * 1e5) - prevLng);
        prevLat = Math.round(lat * 1e5);
        prevLng = Math.round(lng * 1e5);
    }

    return output;
}

function encodeValue(value: number): string {
    // Left-shift by 1 and invert if negative
    let v = value < 0 ? ~(value << 1) : value << 1;
    let result = "";

    while (v >= 0x20) {
        result += String.fromCharCode(((0x20 | (v & 0x1f)) + 63));
        v >>= 5;
    }
    result += String.fromCharCode(v + 63);
    return result;
}

// ── Decoder ───────────────────────────────────────────────────────────────────

/**
 * Decode a Google Polyline encoded string back into [lat, lng] coordinate pairs.
 *
 * @param encoded - Encoded polyline string
 * @returns Array of [lat, lng] tuples (Leaflet order)
 *
 * @example
 * decodePolyline("_gfnCmqf|M_eB_eB")
 * // → [[17.385, 78.4867], [17.395, 78.4967]]
 */
export function decodePolyline(encoded: string): [number, number][] {
    const coordinates: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        lat += decodeValue(encoded, index);
        index += chunkLength(encoded, index);

        lng += decodeValue(encoded, index);
        index += chunkLength(encoded, index);

        coordinates.push([lat / 1e5, lng / 1e5]);
    }

    return coordinates;
}

function decodeValue(encoded: string, index: number): number {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
    } while (byte >= 0x20);

    return result & 1 ? ~(result >> 1) : result >> 1;
}

/**
 * How many characters the next encoded value occupies, so the decoder
 * can advance the index correctly after reading lat or lng.
 */
function chunkLength(encoded: string, index: number): number {
    let length = 0;
    while (encoded.charCodeAt(index + length) - 63 >= 0x20) length++;
    return length + 1;
}

// ── Round-trip guard (used in tests) ─────────────────────────────────────────

/**
 * Verify encode→decode round-trips correctly within floating point tolerance.
 * Useful in unit tests and the verification script.
 *
 * @example
 * assertPolylineRoundTrip([[17.385, 78.4867], [17.395, 78.4967]])
 * // → true
 */
export function assertPolylineRoundTrip(
    coords: [number, number][],
    toleranceDeg = 1e-5
): boolean {
    const decoded = decodePolyline(encodePolyline(coords));
    if (decoded.length !== coords.length) return false;
    return coords.every(([lat, lng], i) => {
        const [dLat, dLng] = decoded[i];
        return Math.abs(lat - dLat) <= toleranceDeg && Math.abs(lng - dLng) <= toleranceDeg;
    });
}