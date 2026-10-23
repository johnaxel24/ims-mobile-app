import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/theme/inventoryTheme';
import { useInventory } from '../InventoryProvider';
import { validateReceiveForm, type ReceiveFormErrors, type ReceiveFormValues } from '../inventory.form';
import { localToday, parseWholeNumber } from '../inventory.logic';
import type { StockRecord } from '../inventory.types';
import { DeliveryCostFields } from './DeliveryCostFields';

export function ReceiveStockForm({ stock, onSaved, onCancel, onFeedbackShown }: {
  stock: StockRecord; onSaved: () => void; onCancel: () => void; onFeedbackShown: () => void;
}) {
  const { receiveStock, isSaving } = useInventory();
  const [values, setValues] = useState<ReceiveFormValues>({ quantity: '', costPerUnit: '', totalAcquisitionCost: '', receivedDate: localToday(), explanation: '' });
  const [errors, setErrors] = useState<ReceiveFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitting = useRef(false);
  const quantity = parseWholeNumber(values.quantity);

  function change(key: keyof ReceiveFormValues, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    setSaveError(null);
  }

  async function submit() {
    if (submitting.current || isSaving) return;
    const result = validateReceiveForm(values, stock.quantity);
    Keyboard.dismiss();
    setErrors(result.ok ? {} : result.errors);
    if (!result.ok) { setSaveError(result.message); return; }
    submitting.current = true;
    setSaveError(null);
    try { await receiveStock(stock.id, result.input); onSaved(); }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save delivery. Please try again.'); }
    finally { submitting.current = false; }
  }

  return <View style={styles.form}>
    <Text style={styles.legend}><Text style={styles.required}>*</Text> Required field</Text>
    <TextField label="Received quantity" required value={values.quantity} onChangeText={(text) => change('quantity', text)}
      keyboardType="number-pad" error={errors.quantity} editable={!isSaving} />
    {quantity !== null && Number.isSafeInteger(stock.quantity + quantity) && (
      <Text style={styles.balance}>Available stock: {stock.quantity.toLocaleString()} → {(stock.quantity + quantity).toLocaleString()}</Text>
    )}
    <DeliveryCostFields quantity={quantity} values={values} errors={errors} disabled={isSaving} onChange={change} />
    <TextField label="Received date" required value={values.receivedDate} onChangeText={(text) => change('receivedDate', text)}
      placeholder="YYYY-MM-DD" autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation"
      error={errors.receivedDate} editable={!isSaving} />
    <TextField label="Delivery notes (optional)" value={values.explanation} onChangeText={(text) => change('explanation', text)} multiline editable={!isSaving} />
    {saveError && <View key={saveError} onLayout={onFeedbackShown}><Notice error message={saveError} /></View>}
    <Button title="Save delivery" loading={isSaving} onPress={() => { void submit(); }} />
    <Button title="Cancel" variant="secondary" disabled={isSaving} onPress={onCancel} />
  </View>;
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  legend: { color: colors.muted, fontSize: 12 },
  required: { color: colors.danger },
  balance: { color: colors.primary, fontWeight: '600', fontSize: 16 },
});
