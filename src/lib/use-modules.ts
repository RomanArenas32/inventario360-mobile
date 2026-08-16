import { useAuthContext } from './auth-context';
import type { Module } from './types';

/**
 * Single source of truth for module-based access control.
 *
 * Rules:
 *   - owner  → staffModules = null  → can() always returns true
 *   - staff  → staffModules = array → can() checks inclusion
 */
export function useModules() {
  const { user, tenantRole } = useAuthContext();
  const isOwner = tenantRole === 'owner';
  const staffModules: Module[] | null = user?.staffModules ?? null;

  function can(module: Module): boolean {
    return staffModules === null || staffModules.includes(module);
  }

  return {
    isOwner,
    staffModules,
    can,
    canProducts: can('products'),
    canStock:    can('stock'),
    canTurns:    can('turns'),
    canSales:    can('sales'),
  };
}
