import { localToday } from './inventory.logic';
import type { MovementPeriodDays, QuantityChangeReason, QuantityHistoryEntry, StockMovementSummary } from './inventory.types';

function displayCount(value: bigint): number | null {
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  return value > limit || value < -limit ? null : Number(value);
}

/** Includes today and the previous 6/29 local calendar days, through the current instant. */
export function summarizeStockMovements(
  entries: readonly QuantityHistoryEntry[],
  stockId: string,
  days: MovementPeriodDays,
  now = new Date(),
): StockMovementSummary {
  if ((days !== 7 && days !== 30) || !Number.isFinite(now.getTime())) throw new Error('Choose a valid movement summary period.');
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const first = entries.find((entry) => entry.stockId === stockId);
  const openingId = first?.kind === 'delivery' && first.previousQuantity === 0 ? first.id : null;
  const totals: Record<QuantityChangeReason, bigint> = {
    Restocked: 0n, Sold: 0n, Damaged: 0n, 'Count correction': 0n, Other: 0n,
  };
  let netChange = 0n;
  let entryCount = 0;
  let hasImportedReceipts = false;

  for (const entry of entries) {
    if (entry.stockId !== stockId) continue;
    if (entry.kind === 'legacy-receipt') { hasImportedReceipts = true; continue; }
    if (entry.id === openingId || entry.previousQuantity === null || entry.newQuantity === null) continue;
    const savedAt = Date.parse(entry.timestamp);
    if (!Number.isFinite(savedAt) || savedAt < start.getTime() || savedAt > now.getTime()) continue;
    const difference = BigInt(entry.newQuantity) - BigInt(entry.previousQuantity);
    totals[entry.reason] += difference;
    netChange += difference;
    entryCount += 1;
  }

  return {
    startsOn: localToday(start), endsOn: localToday(now),
    totals: {
      Restocked: displayCount(totals.Restocked), Sold: displayCount(totals.Sold),
      Damaged: displayCount(totals.Damaged), 'Count correction': displayCount(totals['Count correction']),
      Other: displayCount(totals.Other),
    },
    netChange: displayCount(netChange), entryCount, hasImportedReceipts,
  };
}
