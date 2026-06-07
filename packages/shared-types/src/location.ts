/**
 * Location — a physical carwash site owned by a tenant.
 * One tenant can have multiple locations (spec round 1).
 */

export type LocationStatus = 'active' | 'disabled';

export interface WorkingHoursDay {
  /** "HH:mm" 24h format. */
  open: string;
  /** "HH:mm" 24h format. */
  close: string;
}

/** Per-day-of-week working hours. Used when `is24_7` is false. */
export interface WorkingHours {
  mon: WorkingHoursDay | null;
  tue: WorkingHoursDay | null;
  wed: WorkingHoursDay | null;
  thu: WorkingHoursDay | null;
  fri: WorkingHoursDay | null;
  sat: WorkingHoursDay | null;
  sun: WorkingHoursDay | null;
}

export interface Location {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  contactPhone: string | null;
  workingHours: WorkingHours | null;
  is24_7: boolean;
  status: LocationStatus;
  createdAt: string;
}

/** Public view a customer sees in map + list + tenant brand page. */
export interface PublicLocation {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  workingHours: WorkingHours | null;
  is24_7: boolean;
  bayCount: number;
  isOpenNow: boolean;
  distanceKm?: number;
}
