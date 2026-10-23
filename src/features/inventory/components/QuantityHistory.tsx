import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { colors, contentWidth, radii, shadows } from '@/theme/inventoryTheme';
import { receiptAcquisitionCost, formatInventoryDate, formatMoney, formatTimestamp, selectQuantityHistory } from '../inventory.logic';
import type { QuantityHistoryEntry } from '../inventory.types';
import { useInventory } from '../InventoryProvider';
import { DeliveryCostEditor } from './DeliveryCostEditor';

function HistoryRow({ entry }: { entry: QuantityHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [editingCosts, setEditingCosts] = useState(false);
  const { isSaving, dismissNotice } = useInventory();
  const difference = entry.newQuantity !== null && entry.previousQuantity !== null ? entry.newQuantity - entry.previousQuantity : null;
  const receipt = entry.receipt;
  const body = <>
    {receipt ? <>
      <Text style={styles.change}>{entry.kind === 'legacy-receipt' ? 'Imported receipt' : 'Delivery received'} · {receipt.quantityReceived === null ? 'Quantity unknown' : `${receipt.quantityReceived.toLocaleString()} units`}</Text>
      <Text style={styles.meta}>Received {formatInventoryDate(receipt.receivedDate)} · {receipt.location}</Text>
      <Text style={styles.meta}>Unit cost: {formatMoney(receipt.costPerUnitMinor)}</Text>
      <Text style={styles.change}>Acquisition cost: {formatMoney(receiptAcquisitionCost(receipt))}</Text>
      {receipt.costUpdatedAt && <Text style={styles.meta}>Costs updated {formatTimestamp(receipt.costUpdatedAt)}</Text>}
    </> : difference !== null && <Text style={styles.change}>{difference > 0 ? '+' : '−'}{Math.abs(difference).toLocaleString()} units · {entry.reason}</Text>}
    {entry.previousQuantity !== null && entry.newQuantity !== null && <Text style={styles.meta}>
      {entry.kind === 'legacy-adjustment' ? 'Original delivery balance: ' : 'Available stock: '}
      {entry.previousQuantity.toLocaleString()} → {entry.newQuantity.toLocaleString()} units
    </Text>}
    <Text style={styles.meta}>{formatTimestamp(entry.timestamp)}</Text>
    {entry.explanation && <Text style={styles.expandLabel}>{expanded ? 'Hide explanation ▴' : 'Show explanation ▾'}</Text>}
    {expanded && <Text selectable style={styles.explanation}>{entry.explanation}</Text>}
  </>;
  return <View style={styles.entry}>
    {entry.explanation
      ? <Pressable style={styles.body} accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)}>{body}</Pressable>
      : <View style={styles.body}>{body}</View>}
    {receipt && (editingCosts
      ? <DeliveryCostEditor stockId={entry.stockId} entryId={entry.id} receipt={receipt} explanation={entry.explanation} onClose={() => setEditingCosts(false)} />
      : <Button title="Edit delivery costs" variant="ghost" disabled={isSaving} onPress={() => { dismissNotice(); setEditingCosts(true); }} />)}
  </View>;
}

export function QuantityHistory({ stockId, stockName, entries }: { stockId: string; stockName: string; entries: readonly QuantityHistoryEntry[] }) {
  const { isSaving } = useInventory();
  const [viewingAll, setViewingAll] = useState(false);
  const history = useMemo(() => selectQuantityHistory(entries, stockId), [entries, stockId]);
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>Stock history</Text>
        {history.length > 3 && <Button title={`View all (${history.length})`} variant="ghost" onPress={() => setViewingAll(true)} />}
      </View>
      {history.length === 0 && <Text style={styles.meta}>No stock history recorded yet.</Text>}
      {history.slice(0, 3).map((entry) => <HistoryRow key={entry.id} entry={entry} />)}
      <Modal visible={viewingAll} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!isSaving) setViewingAll(false); }}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
              <View style={styles.modalHeader}>
                <View style={styles.headingText}><Text accessibilityRole="header" style={styles.title}>Stock history</Text><Text style={styles.meta}>{stockName}</Text></View>
                <Button title="Close" variant="ghost" disabled={isSaving} onPress={() => setViewingAll(false)} />
              </View>
              <FlatList data={history} keyExtractor={(entry) => entry.id} renderItem={({ item }) => <HistoryRow entry={item} />}
                automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.historyList} />
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...shadows.card, padding: 16, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  entry: { paddingVertical: 14, minHeight: 72, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  body: { gap: 6 },
  change: { color: colors.ink, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  expandLabel: { color: colors.primary, fontSize: 12, fontWeight: '600', lineHeight: 20 },
  explanation: { color: colors.ink, fontSize: 14, lineHeight: 22, paddingTop: 4 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, width: '100%', maxWidth: contentWidth, alignSelf: 'center' },
  modalHeader: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headingText: { flex: 1, gap: 4 },
  historyList: { paddingHorizontal: 20, paddingBottom: 24 },
});
