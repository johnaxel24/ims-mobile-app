import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/theme/inventoryTheme';
import { useInventory } from '../InventoryProvider';
import { validateStockSubmission } from '../inventory.form';
import { emptyStockForm, parseWholeNumber, stockFormValues } from '../inventory.logic';
import type { QuantityChangeReason, StockFormErrors, StockFormValues, StockRecord } from '../inventory.types';
import { LocationSelect } from './LocationSelect';
import { QuantityAdjustment } from './QuantityAdjustment';
import { DeliveryCostFields } from './DeliveryCostFields';

interface StockFormProps {
  stock?: StockRecord;
  onSaved: (record: StockRecord) => void;
  onCancel?: () => void;
  onFeedbackShown?: () => void;
}

export function StockForm({ stock, onSaved, onCancel, onFeedbackShown }: StockFormProps) {
  const { addStock, editStock, isSaving } = useInventory();
  const [values, setValues] = useState<StockFormValues>(() => stock ? stockFormValues(stock) : emptyStockForm());
  const [errors, setErrors] = useState<StockFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reason, setReason] = useState<QuantityChangeReason | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const submitting = useRef(false);
  const quantity = parseWholeNumber(values.quantity);

  function change<K extends keyof StockFormValues>(key: K, value: StockFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    if (key === 'quantity') setReasonError(null);
    setSaveError(null);
  }

  async function submit() {
    if (submitting.current || isSaving) return;
    const result = validateStockSubmission(values, stock?.quantity, reason);
    setErrors(result.ok ? {} : result.errors);
    setReasonError(result.ok ? null : result.reasonError);
    Keyboard.dismiss();
    if (!result.ok) { setSaveError(result.message); return; }
    submitting.current = true;
    setSaveError(null);
    try {
      const record = stock ? await editStock(stock.id, {
        quantity: result.input.quantity, notes: result.input.notes, name: result.input.name,
        location: result.input.location, measurementPerUnit: result.input.measurementPerUnit,
        quantityAlertThreshold: result.input.quantityAlertThreshold,
        quantityChangeReason: reason ?? undefined, quantityChangeExplanation: explanation,
      }) : await addStock(result.input);
      onSaved(record);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save stock. Please try again.');
    } finally { submitting.current = false; }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.requiredLegend}><Text style={styles.required}>*</Text> Required field</Text>
      <TextField label="Stock name" required value={values.name} onChangeText={(text) => change('name', text)}
        error={errors.name} editable={!isSaving} autoCapitalize="sentences" />
      <LocationSelect value={values.location} onChange={(location) => change('location', location)} error={errors.location} disabled={isSaving} />
      <TextField label="Measurement per unit (optional)" value={values.measurementPerUnit}
        onChangeText={(text) => change('measurementPerUnit', text)} editable={!isSaving} />
      <QuantityAdjustment currentQuantity={stock?.quantity} value={values.quantity} error={errors.quantity}
        reason={reason} reasonError={reasonError} explanation={explanation} disabled={isSaving}
        onQuantityChange={(text) => change('quantity', text)}
        onReasonChange={(next) => { setReason(next); setReasonError(null); setSaveError(null); }}
        onExplanationChange={(text) => { setExplanation(text); setSaveError(null); }} />
      <TextField label="Low-stock alert threshold" required value={values.quantityAlertThreshold}
        onChangeText={(text) => change('quantityAlertThreshold', text)} keyboardType="number-pad"
        error={errors.quantityAlertThreshold} editable={!isSaving} />
      {!stock && <>
        <DeliveryCostFields quantity={quantity} values={values} errors={errors} disabled={isSaving} onChange={change} />
        <TextField label="Received date" required value={values.inventoryDate} onChangeText={(text) => change('inventoryDate', text)}
          placeholder="YYYY-MM-DD" autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation"
          error={errors.inventoryDate} editable={!isSaving} />
      </>}
      <TextField label="Notes (optional)" value={values.notes} onChangeText={(text) => change('notes', text)}
        multiline error={errors.notes} editable={!isSaving} />
      <View style={styles.actions}>
        {saveError && <View key={saveError} onLayout={onFeedbackShown}><Notice error message={saveError} /></View>}
        <Button title={stock ? 'Save changes' : 'Add stock'} onPress={() => { void submit(); }} loading={isSaving} />
        {onCancel && <Button title="Cancel" onPress={onCancel} variant="secondary" disabled={isSaving} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  requiredLegend: { color: colors.muted, fontSize: 12 },
  required: { color: colors.danger },
  actions: { gap: spacing.md },
});
