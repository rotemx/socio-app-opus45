/**
 * Distance formatting utility with metric/imperial support
 *
 * Distance Display Rules:
 * Imperial:
 *   - Under 500ft: exact feet ("320 ft")
 *   - 500ft-1mi: 0.1 precision ("0.3 mi")
 *   - Beyond 1mi: 0.1 precision ("2.4 mi")
 *
 * Metric:
 *   - Under 150m: exact meters ("120 m")
 *   - 150m-1km: 0.1 precision ("0.5 km")
 *   - Beyond 1km: 0.1 precision ("2.4 km")
 */

export type DistanceUnit = 'imperial' | 'metric';

const FEET_PER_METER = 3.28084;
const METERS_PER_MILE = 1609.34;
const METERS_PER_KM = 1000;

export interface FormatDistanceOptions {
  /** Whether to include 'away' suffix */
  showAway?: boolean;
}

/**
 * Formats distance in meters to human-readable string
 * @param meters - Distance in meters
 * @param unit - 'imperial' (ft/mi) or 'metric' (m/km)
 * @param options - Additional formatting options
 * @returns Formatted distance string
 */
export function formatDistance(
  meters: number,
  unit: DistanceUnit = 'imperial',
  options: FormatDistanceOptions = {}
): string {
  const { showAway = false } = options;
  let result: string;

  if (unit === 'imperial') {
    result = formatImperial(meters);
  } else {
    result = formatMetric(meters);
  }

  return showAway ? `${result} away` : result;
}

/**
 * Format distance in imperial units (ft/mi)
 */
function formatImperial(meters: number): string {
  const feet = meters * FEET_PER_METER;
  const miles = meters / METERS_PER_MILE;

  // Under 500ft: exact feet
  if (feet < 500) {
    return `${Math.round(feet)} ft`;
  }

  // 500ft and beyond: miles with 0.1 precision
  return `${miles.toFixed(1)} mi`;
}

/**
 * Format distance in metric units (m/km)
 */
function formatMetric(meters: number): string {
  // Under 150m: exact meters
  if (meters < 150) {
    return `${Math.round(meters)} m`;
  }

  // 150m and beyond: kilometers with 0.1 precision
  const km = meters / METERS_PER_KM;
  return `${km.toFixed(1)} km`;
}

/**
 * Get the appropriate distance unit based on locale
 * @param locale - Locale string (e.g., 'en-US', 'en-GB')
 * @returns 'imperial' for US/UK, 'metric' for others
 */
export function getDefaultDistanceUnit(locale?: string): DistanceUnit {
  const imperialLocales = ['en-US', 'en-GB', 'en-MM', 'en-LR'];

  if (!locale) {
    return 'imperial'; // Default to imperial for US-centric app
  }

  return imperialLocales.some((imperialLocale) => {
    const parts = imperialLocale.split('-');
    const lang = parts[0];
    const country = parts[1];
    if (!lang || !country) {
      return false;
    }
    return locale.startsWith(lang) && locale.includes(country);
  })
    ? 'imperial'
    : 'metric';
}
