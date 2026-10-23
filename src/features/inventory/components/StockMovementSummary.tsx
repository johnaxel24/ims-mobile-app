import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, spacing } from '@/theme/inventoryTheme';
import { formatInventoryDate } from '../inventory.logic';
import { summarizeStockMovements } from '../inventory.movements';
import type { MovementPeriodDays, QuantityChangeReason, QuantityHistoryEntry } from '../inventory.types';

const CATEGORIES: readonly { reason: QuantityChangeReason; label: string }[] = [
  { reason: 'Restocked', label: 'Restocked' },
  { reason: 'Sold', label: 'Sold' },
  { reason: 'Damaged', label: 'Damaged' },
  { reason: 'Count correction', label: 'Corrections' },
  { reason: 'Other', label: 'Other' },
];

function signedUnits(value: number | null): string {
  if (value === null) return 'Too large to display';
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString()} units`;
}

export function StockMovementSummary({ stockId, entries }: { stockId: string; entries: readonly QuantityHistoryEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const [days, setDays] = useState<MovementPeriodDays>(7);
  const [now, setNow] = useState(() => new Date());
  const summary = useMemo(() => summarizeStockMovements(entries, stockId, days, now), [entries, stockId, days, now]);

  useEffect(() => {
    if (!expanded) return;
    // A newly saved entry can be newer than the last timer tick.
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [expanded, entries]);

  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel="Movement summary" accessibilityState={{ expanded }}
        onPress={() => { setNow(new Date()); setExpanded((value) => !value); }} style={styles.heading}>
        <Text style={styles.title}>Movement summary</Text>
        <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>
      {expanded && <View style={styles.body}>
        <View style={styles.periods}>
          {([7, 30] as const).map((period) => (
            <Pressable key={period} accessibilityRole="button" accessibilityLabel={`Last ${period} days`}
              accessibilityState={{ selected: days === period }}
              onPress={() => { setNow(new Date()); setDays(period); }}
              style={[styles.period, days === period && styles.selectedPeriod]}>
              <Text style={[styles.periodText, days === period && styles.selectedText]}>Last {period} days</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.caption}>Recorded {formatInventoryDate(summary.startsOn)} – {formatInventoryDate(summary.endsOn)}</Text>
        {summary.entryCount === 0 ? <Text style={styles.empty}>No quantity changes recorded in this period.</Text> : <>
          {CATEGORIES.map(({ reason, label }) => (
            <View key={reason} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{signedUnits(summary.totals[reason])}</Text>
            </View>
          ))}
          <View style={[styles.row, styles.netRow]}>
            <Text style={styles.netLabel}>Net movement</Text>
            <Text style={[styles.netValue, summary.netChange !== null && summary.netChange < 0 && styles.negative]}>
              {signedUnits(summary.netChange)}
            </Text>
          </View>
        </>}
        <Text style={styles.caption}>Opening balances excluded.</Text>
        {summary.hasImportedReceipts && <Text style={styles.caption}>Imported receipts excluded; earlier movements may be incomplete.</Text>}
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...shadows.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  heading: { minHeight: 56, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  title: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '700' },
  chevron: { color: colors.primary, fontSize: 18 },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  periods: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  period: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill },
  selectedPeriod: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  periodText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  selectedText: { color: colors.primary },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  empty: { color: colors.muted, fontSize: 14, lineHeight: 22, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  label: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  value: { color: colors.ink, fontSize: 14, lineHeight: 22, fontWeight: '600', fontVariant: ['tabular-nums'], flexShrink: 1 },
  netRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  netLabel: { color: colors.ink, fontSize: 14, lineHeight: 22, fontWeight: '700' },
  netValue: { color: colors.primary, fontSize: 16, lineHeight: 24, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1 },
  negative: { color: colors.danger },
});
