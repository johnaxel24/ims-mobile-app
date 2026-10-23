import { StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/TextField';
import { colors, radii, spacing } from '@/theme/inventoryTheme';
import { formatMoney, validateDeliveryCosts } from '../inventory.logic';

export interface DeliveryCostValues {
  costPerUnit: string;
  totalAcquisitionCost: string;
}

export function DeliveryCostFields({ quantity, values, errors, disabled, onChange }: {
  quantity: number | null;
  values: DeliveryCostValues;
  errors: Partial<Record<keyof DeliveryCostValues, string>>;
  disabled: boolean;
  onChange: (field: keyof DeliveryCostValues, value: string) => void;
}) {
  const suggestion = validateDeliveryCosts(quantity, values.costPerUnit, '');
  const result = validateDeliveryCosts(quantity, values.costPerUnit, values.totalAcquisitionCost);
  return <View style={styles.fields}>
    <TextField label="Cost per unit (optional)" value={values.costPerUnit}
      onChangeText={(text) => onChange('costPerUnit', text)} keyboardType="decimal-pad"
      error={errors.costPerUnit} editable={!disabled} />
    <TextField label="Total acquisition cost (optional)" value={values.totalAcquisitionCost}
      onChangeText={(text) => onChange('totalAcquisitionCost', text)} keyboardType="decimal-pad"
      placeholder={suggestion.totalAcquisitionCostMinor === null ? 'Enter delivery total' : `Calculated: ${formatMoney(suggestion.totalAcquisitionCostMinor)}`}
      error={errors.totalAcquisitionCost} editable={!disabled} />
    <View style={styles.preview}>
      <Text style={styles.label}>{values.totalAcquisitionCost.trim() ? 'DELIVERY TOTAL' : 'CALCULATED DELIVERY TOTAL'}</Text>
      <Text style={styles.amount}>{Object.keys(result.errors).length ? '—' : formatMoney(result.totalAcquisitionCostMinor)}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  fields: { gap: spacing.xl },
  preview: { padding: 20, gap: 8, borderRadius: radii.md, backgroundColor: colors.primarySoft },
  label: { color: colors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  amount: { color: colors.ink, fontSize: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
