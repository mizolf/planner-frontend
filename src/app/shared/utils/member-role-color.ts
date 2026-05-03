import { MemberRole } from '../../core/models/trip.model';

const ROLE_COLORS: Record<MemberRole, string> = {
  OWNER: 'bg-primary/10 text-primary',
  EDITOR: 'bg-secondary/10 text-secondary',
  VIEWER: 'bg-surface-container-high text-on-surface-variant',
};

export function getMemberRoleColor(role: MemberRole): string {
  return ROLE_COLORS[role];
}
