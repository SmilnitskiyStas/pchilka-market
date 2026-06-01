export const inventoryUserRoles = ['admin', 'store_manager', 'manager', 'staff'] as const;

export type InventoryUserRole = (typeof inventoryUserRoles)[number];

export function normalizeInventoryUserRole(value: unknown): InventoryUserRole {
  const normalized = String(value ?? '').trim().toLowerCase();

  switch (normalized) {
    case 'admin':
      return 'admin';
    case 'store_manager':
      return 'store_manager';
    case 'manager':
      return 'manager';
    case 'user':
    case 'staff':
    default:
      return 'staff';
  }
}

export function canManageInventoryUsers(role: InventoryUserRole) {
  return role === 'admin' || role === 'store_manager' || role === 'manager';
}

export function canEditInventoryBatchExpiry(role: InventoryUserRole) {
  return role === 'admin' || role === 'store_manager';
}

export function canManageInventoryTaskMode(role: InventoryUserRole) {
  return role === 'admin' || role === 'store_manager';
}

export function canAssignInventoryRole(actingRole: InventoryUserRole, targetRole: InventoryUserRole) {
  if (actingRole === 'admin') return true;
  if (actingRole === 'store_manager') {
    return targetRole === 'manager' || targetRole === 'staff';
  }
  if (actingRole === 'manager') {
    return targetRole === 'staff';
  }
  return false;
}

export function canEditInventoryTargetRole(actingRole: InventoryUserRole, targetRole: InventoryUserRole) {
  if (actingRole === 'admin') return true;
  if (actingRole === 'store_manager') {
    return targetRole === 'manager' || targetRole === 'staff';
  }
  if (actingRole === 'manager') {
    return targetRole === 'staff';
  }
  return false;
}
