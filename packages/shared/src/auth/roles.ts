export const ROLES = ['owner', 'admin', 'controller', 'accountant', 'approver', 'auditor'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'org.manage',
  'user.manage',
  'entity.manage',
  'entity.view',
  'account.manage',
  'period.manage',
  'fx.manage',
  'journal.create',
  'journal.post',
  'journal.post_soft_closed',
  'journal.approve',
  'report.view',
  'audit.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const READ: readonly Permission[] = ['entity.view', 'report.view'];

/**
 * Role -> permission matrix (docs/security/threat-model.md §5). Segregation of
 * duties: accountants prepare and post routine entries; only controllers can
 * post into soft-closed periods; approvers approve but never create.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  owner: [...PERMISSIONS],
  admin: [...READ, 'org.manage', 'user.manage', 'entity.manage', 'audit.view'],
  controller: [
    ...READ,
    'entity.manage',
    'account.manage',
    'period.manage',
    'fx.manage',
    'journal.create',
    'journal.post',
    'journal.post_soft_closed',
    'audit.view',
  ],
  accountant: [...READ, 'journal.create', 'journal.post', 'fx.manage'],
  approver: [...READ, 'journal.approve'],
  auditor: [...READ, 'audit.view'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
