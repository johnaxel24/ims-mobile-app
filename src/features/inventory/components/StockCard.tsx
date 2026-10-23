import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StockSummary } from '../inventory.types';
import { colors, radii, shadows } from '@/theme/inventoryTheme';

export function StockBadge({ low }: { low: boolean }) {
  return <View style={[styles.badge, low && styles.lowBadge]}><Text style={[styles.badgeText, low && styles.lowText]}>{low ? 'Low stock' : 'In stock'}</Text></View>;
}

export function StockCard({ stock, onPress }: { stock: StockSummary; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button"
      accessibilityLabel={`${stock.name}, ${stock.quantity} units available, ${stock.location}${stock.measurementPerUnit ? `, ${stock.measurementPerUnit} per unit` : ''}${stock.isLowStock ? ', low stock' : ''}. View stock details.`}
      onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.information}>
        <Text style={styles.name}>{stock.name}</Text>
        <Text style={styles.location}>{stock.location}{stock.measurementPerUnit ? ` · ${stock.measurementPerUnit} per unit` : ''}</Text>
      </View>
      <View style={styles.quantityGroup}>
        <Text style={styles.quantity}>{stock.quantity.toLocaleString()}</Text>
        <Text style={styles.units}>available</Text>
        {stock.isLowStock && <StockBadge low />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { ...shadows.card, minHeight: 88, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 14, paddingVertical: 16, gap: 12, marginBottom: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  pressed: { backgroundColor: colors.primarySoft },
  information: { flex: 1, minWidth: 120, gap: 5 },
  name: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: colors.ink },
  location: { fontSize: 12, lineHeight: 18, color: colors.muted },
  quantityGroup: { alignItems: 'flex-end', gap: 4, flexShrink: 1 },
  quantity: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  units: { fontSize: 11, lineHeight: 16, color: colors.muted },
  badge: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.successSoft, borderRadius: radii.pill },
  badgeText: { color: colors.success, fontSize: 11, fontWeight: '600' },
  lowBadge: { backgroundColor: colors.warningSoft },
  lowText: { color: colors.warning },
});
