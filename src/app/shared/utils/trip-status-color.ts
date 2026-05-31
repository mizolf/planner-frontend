import { TripStatus } from '../../core/models/trip.model';

const STATUS_COLORS: Record<TripStatus, string> = {
  UPCOMING: 'bg-secondary/10 text-secondary',
  IN_PROGRESS: 'bg-tertiary/10 text-tertiary',
  COMPLETED: 'bg-on-surface-variant/10 text-on-surface-variant',
};

export function getTripStatusColor(status: TripStatus): string {
  return STATUS_COLORS[status];
}
