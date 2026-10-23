import type { ReactNode } from 'react';

import { EmptyState } from '@/components/EmptyState';
import { useInventory } from '../InventoryProvider';

export function InventoryGate({ children }: { children: ReactNode }) {
  const { isLoading, loadError, retryLoad } = useInventory();
  if (isLoading) return <EmptyState loading title="Opening your stockroom" description="Loading your saved inventory…" />;
  if (loadError) return <EmptyState title="Inventory couldn't be opened" description={`${loadError} Existing data will not be overwritten.`} actionLabel="Try again" onAction={() => { void retryLoad(); }} />;
  return <>{children}</>;
}
