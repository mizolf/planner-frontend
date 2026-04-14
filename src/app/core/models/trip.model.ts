export type TripStatus = 'PLANNING' | 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';

export type Interest =
  | 'CULTURE'
  | 'FOOD'
  | 'ADVENTURE'
  | 'NATURE'
  | 'NIGHTLIFE'
  | 'SHOPPING'
  | 'RELAXATION'
  | 'HISTORY';

export interface TripResponse {
  id: number;
  name: string;
  description: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  budget: number;
  interests: Interest[];
  createdAt: string;
  updatedAt: string;
}
