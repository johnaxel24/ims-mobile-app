import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { colors, contentWidth, radii, shadows } from '@/theme/tokens';
import { formatTimestamp, selectQuantityHistory } from '../inventory.logic';
import type { QuantityHistoryEntry } from '../inventory.types';

function HistoryRow({ entry }: { entry: QuantityHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const difference = entry.newQuantity - entry.previousQuantity;
  const body = <>
    <Text style={styles.change}>{difference > 0 ? '+' : '−'}{Math.abs(difference).toLocaleString()} units · {entry.reason}</Text>
    <Text style={styles.meta}>{entry.previousQuantity.toLocaleString()} → {entry.newQuantity.toLocaleString()} units</Text>
    <Text style={styles.meta}>{formatTimestamp(entry.timestamp)}</Text>
    {entry.explanation && <Text style={styles.expandLabel}>{expanded ? 'Hide explanation ▴' : 'Show explanation ▾'}</Text>}
    {expanded && <Text selectable style={styles.explanation}>{entry.explanation}</Text>}
  </>;
  return entry.explanation
    ? <Pressable style={styles.entry} accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)}>{body}</Pressable>
    : <View style={styles.entry}>{body}</View>;
}

export function QuantityHistory({ stockId, stockName, entries }: { stockId: string; stockName: string; entries: readonly QuantityHistoryEntry[] }) {
  const [viewingAll, setViewingAll] = useState(false);
  const history = useMemo(() => selectQuantityHistory(entries, stockId), [entries, stockId]);
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>Quantity history</Text>
        {history.length > 3 && <Button title={`View all (${history.length})`} variant="ghost" onPress={() => setViewingAll(true)} />}
      </View>
      {history.length === 0 && <Text style={styles.meta}>No quantity updates recorded yet.</Text>}
      {history.slice(0, 3).map((entry) => <HistoryRow key={entry.id} entry={entry} />)}
      <Text style={styles.help}>History starts with updates saved in this version. Earlier quantity changes weren’t recorded.</Text>
      <Modal visible={viewingAll} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setViewingAll(false)}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
              <View style={styles.modalHeader}>
                <View style={styles.headingText}><Text accessibilityRole="header" style={styles.title}>Quantity history</Text><Text style={styles.meta}>{stockName}</Text></View>
                <Button title="Close" variant="ghost" onPress={() => setViewingAll(false)} />
              </View>
              <FlatList data={history} keyExtractor={(entry) => entry.id} renderItem={({ item }) => <HistoryRow entry={item} />}
                contentContainerStyle={styles.historyList}
                ListHeaderComponent={<Text style={styles.help}>Newest updates first. Tap an entry with an explanation to read it.</Text>} />
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
  change: { color: colors.ink, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  expandLabel: { color: colors.primary, fontSize: 12, fontWeight: '600', lineHeight: 20 },
  explanation: { color: colors.ink, fontSize: 14, lineHeight: 22, paddingTop: 4 },
  help: { color: colors.muted, fontSize: 11, lineHeight: 18, paddingTop: 8 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, width: '100%', maxWidth: contentWidth, alignSelf: 'center' },
  modalHeader: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headingText: { flex: 1, gap: 4 },
  historyList: { paddingHorizontal: 20, paddingBottom: 24 },
});
