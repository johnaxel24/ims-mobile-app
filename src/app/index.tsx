import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Notice } from '@/components/Notice';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { useInventory } from '@/features/inventory/InventoryProvider';
import { InventoryGate } from '@/features/inventory/components/InventoryGate';
import { StockCard } from '@/features/inventory/components/StockCard';
import { DEFAULT_LIST_OPTIONS, selectStocks } from '@/features/inventory/inventory.logic';
import type { InventoryListOptions, StockSortField } from '@/features/inventory/inventory.types';
import { colors, contentWidth, radii } from '@/theme/tokens';

const SORTS: { key: StockSortField; label: string }[] = [
  { key: 'created_at', label: 'Date added' },
  { key: 'inventoryDate', label: 'Most recently received' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'location', label: 'Location' },
];

function orderLabel(field: StockSortField, ascending: boolean) {
  if (field === 'created_at' || field === 'inventoryDate') return ascending ? 'Oldest first' : 'Newest first';
  if (field === 'quantity') return ascending ? 'Lowest first' : 'Highest first';
  return ascending ? 'A to Z' : 'Z to A';
}

export default function InventoryScreen() {
  const { added } = useLocalSearchParams<{ added?: string }>();
  // Reset filters, sorting, and scroll after a new record is saved.
  return <InventoryList key={added ?? 'inventory'} />;
}

function InventoryList() {
  const { stocks, notice, dismissNotice } = useInventory();
  const [options, setOptions] = useState<InventoryListOptions>(DEFAULT_LIST_OPTIONS);
  const [sorting, setSorting] = useState(false);
  const visibleStocks = useMemo(() => selectStocks(stocks, options), [stocks, options]);
  const lowCount = stocks.filter((stock) => stock.quantity <= stock.quantityAlertThreshold).length;
  const filtered = options.lowStockOnly || options.search.trim().length > 0;
  const sortDescription = `${SORTS.find((sort) => sort.key === options.sortBy)?.label}, ${orderLabel(options.sortBy, options.direction === 'asc')}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <InventoryGate>
        <View style={styles.container}>
          <View style={styles.controls}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>Inventory</Text>
              <Button
                title="+ Add stock"
                onPress={() => {
                  dismissNotice();
                  router.push('/stocks/new');
                }}
              />
            </View>
            {notice && <Notice message={notice} onDismiss={dismissNotice} />}
            <TextField
              label="Search stocks"
              placeholder="Search by stock name…"
              value={options.search}
              onChangeText={(search) => setOptions((current) => ({ ...current, search }))}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            <View style={styles.filters}>
              {[false, true].map((lowOnly) => <Pressable
                key={String(lowOnly)} accessibilityRole="button" accessibilityState={{ selected: options.lowStockOnly === lowOnly }}
                onPress={() => setOptions((current) => ({ ...current, lowStockOnly: lowOnly }))}
                style={[styles.filter, options.lowStockOnly === lowOnly && styles.activeFilter]}>
                <Text style={[styles.filterText, options.lowStockOnly === lowOnly && styles.activeFilterText]}>{lowOnly ? 'Low stock' : 'All'} ({lowOnly ? lowCount : stocks.length})</Text>
              </Pressable>)}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Sort stocks. ${sortDescription}`}
                accessibilityState={{ expanded: sorting }}
                onPress={() => {
                  Keyboard.dismiss();
                  setSorting(true);
                }}
                style={styles.sortButton}>
                <Text style={styles.sortText}>Sort ▾</Text>
              </Pressable>
            </View>
          </View>
          <FlatList
            data={visibleStocks}
            keyExtractor={(stock) => stock.id}
            renderItem={({ item }) => (
              <StockCard
                stock={item}
                onPress={() => router.push({ pathname: '/stocks/[id]', params: { id: item.id } })}
              />
            )}
            ListHeaderComponent={filtered ? <Text accessibilityLiveRegion="polite" style={styles.results}>{visibleStocks.length} matching {visibleStocks.length === 1 ? 'stock' : 'stocks'}</Text> : null}
            ListEmptyComponent={<EmptyState
              title={stocks.length === 0 ? 'Add your first stock' : 'No matching stock'}
              description={stocks.length === 0 ? 'Keep quantities, locations, and costs together in one place.' : 'Try another name or clear your filters.'}
              actionLabel={stocks.length === 0 ? 'Add stock' : 'Clear search & filters'}
              onAction={() => stocks.length === 0 ? router.push('/stocks/new') : setOptions(DEFAULT_LIST_OPTIONS)}
            />}
            ListFooterComponent={<Text style={styles.footer}>Saved on this device · Available offline</Text>}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          />
        </View>
        <Sheet title="Sort inventory" visible={sorting} onClose={() => setSorting(false)}>
          <ScrollView style={styles.sortScroll} contentContainerStyle={styles.sortContent}>
            {SORTS.map((sort) => (
              <Pressable
                key={sort.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: options.sortBy === sort.key }}
                onPress={() => setOptions((current) => ({
                  ...current,
                  sortBy: sort.key,
                  direction: sort.key === 'created_at' || sort.key === 'inventoryDate' ? 'desc' : 'asc',
                }))}
                style={[styles.sortOption, options.sortBy === sort.key && styles.selectedOption]}>
                <Text style={styles.optionText}>{sort.label}</Text>
                <Text style={styles.sortText}>{options.sortBy === sort.key ? '✓' : ''}</Text>
              </Pressable>
            ))}
            <Text style={styles.orderHeading}>Order</Text>
            {(['asc', 'desc'] as const).map((direction) => (
              <Pressable
                key={direction}
                accessibilityRole="radio"
                accessibilityState={{ checked: options.direction === direction }}
                onPress={() => setOptions((current) => ({ ...current, direction }))}
                style={[styles.sortOption, options.direction === direction && styles.selectedOption]}>
                <Text style={styles.optionText}>{orderLabel(options.sortBy, direction === 'asc')}</Text>
                <Text style={styles.sortText}>{options.direction === direction ? '✓' : ''}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Sheet>
      </InventoryGate>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, width: '100%', maxWidth: contentWidth, alignSelf: 'center' },
  controls: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '700', color: colors.ink },
  filters: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  filter: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  activeFilter: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  activeFilterText: { color: colors.surface },
  sortButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, marginLeft: 'auto' },
  sortText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  list: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  results: { color: colors.muted, paddingVertical: 10, fontSize: 12 },
  footer: { textAlign: 'center', color: colors.muted, fontSize: 11, paddingVertical: 20 },
  sortContent: { gap: 8, paddingBottom: 16 },
  sortScroll: { flexGrow: 0, flexShrink: 1 },
  sortOption: { minHeight: 48, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderRadius: radii.sm },
  selectedOption: { backgroundColor: colors.primarySoft },
  optionText: { flex: 1, fontSize: 15, color: colors.ink },
  orderHeading: { marginTop: 12, paddingHorizontal: 14, color: colors.muted, fontSize: 13, fontWeight: '600' },
});
