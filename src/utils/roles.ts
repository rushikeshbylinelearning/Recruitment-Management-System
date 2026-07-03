/** Normalize role strings for reliable comparisons (trim + lowercase). */
export function normalizeRole(role?: string | null): string {
  return (role ?? '').trim().toLowerCase();
}

export function isRecruiterRole(role?: string | null): boolean {
  return normalizeRole(role) === 'recruiter';
}

export function isAdminRole(role?: string | null): boolean {
  return normalizeRole(role) === 'admin';
}

/** Recruiters must not see Admin accounts on the team page. */
export function shouldHideAdminTeamMembers(viewerRole?: string | null): boolean {
  return isRecruiterRole(viewerRole);
}

export function filterTeamMembersForViewer<T extends { role?: string }>(
  members: T[],
  viewerRole?: string | null
): T[] {
  if (!shouldHideAdminTeamMembers(viewerRole)) {
    return members;
  }
  return members.filter((member) => !isAdminRole(member.role));
}
