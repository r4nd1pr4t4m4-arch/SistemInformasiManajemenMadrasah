export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeofenceCheckResult {
  distanceMeters: number;
  isWithinGeofence: boolean;
  radiusMeters: number;
}

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Menghitung jarak antara dua koordinat GPS menggunakan formula Haversine (dalam meter).
 */
export function calculateDistanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h = Math.min(
    1,
    Math.max(
      0,
      sinDLat * sinDLat +
        Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinDLng * sinDLng
    )
  );

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Memvalidasi apakah posisi guru berada di dalam radius geofencing madrasah/sekolah.
 */
export function verifyGeofence(
  teacherPos: Coordinates,
  schoolPos: Coordinates,
  radiusMeters: number
): GeofenceCheckResult {
  const distanceMeters = calculateDistanceMeters(teacherPos, schoolPos);
  return {
    distanceMeters,
    isWithinGeofence: distanceMeters <= radiusMeters,
    radiusMeters,
  };
}
