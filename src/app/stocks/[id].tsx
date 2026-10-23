import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Notice } from '@/components/Notice';
import { useInventory } from '@/features/inventory/InventoryProvider';
import { EditStockModal } from '@/features/inventory/components/EditStockModal';
import { InventoryGate } from '@/features/inventory/components/InventoryGate';
import { QuantityHistory } from '@/features/inventory/components/QuantityHistory';
import { StockBadge } from '@/features/inventory/components/StockCard';
import { formatInventoryDate, formatMoney, formatTimestamp, summarizeStock } from '@/features/inventory/inventory.logic';
import { colors, contentWidth, radii, shadows } from '@/theme/tokens';

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.detailRow, last && styles.lastRow]}><Text style={styles.detailLabel}>{label}</Text><Text selectable style={styles.detailValue}>{value}</Text></View>;
}

export default function StockDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { stocks, quantityHistory, notice, dismissNotice } = useInventory();
  const [editing, setEditing] = useState(false);
  const record = stocks.find((stock) => stock.id === id);
  const stock = record ? summarizeStock(record) : null;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <InventoryGate>
        {!stock ? <EmptyState title="Stock not found" description="This record isn't available on this device. Return to your inventory to choose another item." actionLabel="Back to inventory" onAction={() => router.replace('/')} /> : <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.heading}>
              <View style={styles.headingText}>
                <Text style={styles.eyebrow}>STOCK DETAILS</Text>
                <Text accessibilityRole="header" style={styles.title}>{stock.name}</Text>
                <Text style={styles.location}>{stock.location}</Text>
              </View>
              <StockBadge low={stock.isLowStock} />
            </View>
            {notice && <Notice message={notice} onDismiss={dismissNotice} />}
            <View style={styles.quantityCard}>
              <Text style={styles.quantityLabel}>AVAILABLE QUANTITY</Text>
              <View style={styles.quantityRow}><Text style={styles.quantity}>{stock.quantity.toLocaleString()}</Text><Text style={styles.units}>units</Text></View>
              <Text style={styles.threshold}>Low-stock alert at {stock.quantityAlertThreshold.toLocaleString()} units or below</Text>
              {stock.isLowStock && <View style={styles.alertCard}><Text style={styles.alertTitle}>Time to replenish</Text><Text style={styles.alertText}>Your quantity is at or below the alert threshold. Update the quantity when new stock arrives.</Text></View>}
            </View>
            <QuantityHistory stockId={stock.id} stockName={stock.name} entries={quantityHistory} />
            <View style={styles.detailCard}>
              <Text accessibilityRole="header" style={styles.detailsTitle}>Stock details</Text>
              <DetailRow label="Location" value={stock.location} />
              <DetailRow label="Cost per unit" value={formatMoney(stock.costPerUnitMinor)} />
              <DetailRow label="Measurement per unit" value={stock.measurementPerUnit ?? 'Not provided'} />
              <DetailRow label="Most recently received date" value={formatInventoryDate(stock.inventoryDate)} />
              <DetailRow label="Date added" value={formatTimestamp(stock.created_at)} />
              <DetailRow label="Last updated" value={formatTimestamp(stock.lastUpdatedAt)} last />
            </View>
            <View style={styles.notesCard}><Text style={styles.notesTitle}>Notes</Text><Text selectable style={stock.notes.trim() ? styles.notes : styles.emptyNotes}>{stock.notes.trim() ? stock.notes : 'No notes added yet.'}</Text></View>
            <View style={styles.costCard}>
              <Text style={styles.eyebrow}>TOTAL ACQUISITION COST</Text>
              <Text style={styles.cost}>{stock.totalAcquisitionCostMinor === null ? '—' : formatMoney(stock.totalAcquisitionCostMinor)}</Text>
              <Text style={styles.formula}>{stock.costPerUnitMinor === null ? 'Cost per unit was not provided.' : `${stock.quantity.toLocaleString()} units × ${formatMoney(stock.costPerUnitMinor)} per unit`}</Text>
            </View>
            <Button title="Edit stock details" onPress={() => { dismissNotice(); setEditing(true); }} />
          </ScrollView>
          <EditStockModal stock={stock} visible={editing} onClose={() => setEditing(false)} />
        </>}
      </InventoryGate>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: contentWidth, alignSelf: 'center', padding: 24, paddingBottom: 40, gap: 24 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 4 },
  headingText: { flex: 1, minWidth: 150, gap: 8 },
  eyebrow: { color: colors.primary, fontSize: 10, lineHeight: 16, letterSpacing: 1.4, fontWeight: '700' },
  title: { fontSize: 30, lineHeight: 38, color: colors.ink, fontWeight: '700', letterSpacing: -0.8 },
  location: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  quantityCard: { ...shadows.card, padding: 24, borderRadius: radii.lg, backgroundColor: colors.ink, gap: 12 },
  quantityLabel: { color: colors.onDarkMuted, fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: 1.5 },
  quantityRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  quantity: { color: colors.surface, fontSize: 52, lineHeight: 64, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1 },
  units: { color: colors.onDarkMuted, fontSize: 16 },
  threshold: { color: colors.onDarkMuted, fontSize: 12, lineHeight: 19 },
  alertCard: { ...shadows.card, backgroundColor: colors.warningSoft, borderColor: colors.warningBorder, borderWidth: 1, borderRadius: radii.md, padding: 18, gap: 6 },
  alertTitle: { color: colors.warning, fontSize: 14, fontWeight: '700' },
  alertText: { color: colors.warning, fontSize: 13, lineHeight: 21 },
  costCard: { ...shadows.card, padding: 22, backgroundColor: colors.primarySoft, borderRadius: radii.md, gap: 8 },
  cost: { color: colors.ink, fontSize: 32, lineHeight: 42, fontWeight: '700', fontVariant: ['tabular-nums'] },
  formula: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  detailCard: { ...shadows.card, backgroundColor: colors.surface, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md },
  detailsTitle: { paddingTop: 18, color: colors.ink, fontSize: 14, fontWeight: '700' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: colors.border },
  lastRow: { borderBottomWidth: 0 },
  detailLabel: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 20 },
  detailValue: { flex: 1.4, textAlign: 'right', color: colors.ink, fontSize: 13, lineHeight: 20, fontWeight: '500' },
  notesCard: { ...shadows.card, padding: 20, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  notesTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  notes: { color: colors.ink, fontSize: 14, lineHeight: 23 },
  emptyNotes: { color: colors.muted, fontSize: 14, lineHeight: 23 },
});
