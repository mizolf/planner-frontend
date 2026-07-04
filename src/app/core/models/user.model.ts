import { Interest } from './trip.model';

export interface User {
  id: number;
  fullName: string;
  email: string;
  preferredInterests: Interest[];
  onboardingCompleted: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdatePreferencesRequest {
  interests: Interest[];
}
