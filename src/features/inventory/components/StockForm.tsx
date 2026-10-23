import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { colors, radii, shadows, spacing } from '@/theme/tokens';
import { useInventory } from '../InventoryProvider';
import { validateStockSubmission } from '../inventory.form';
import { emptyStockForm, formatMoney, localToday, parseMoney, parseWholeNumber, stockFormValues } from '../inventory.logic';
import type { QuantityChangeReason, StockFormErrors, StockFormValues, StockRecord } from '../inventory.types';
import { LocationSelect } from './LocationSelect';
import { QuantityAdjustment } from './QuantityAdjustment';

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
  const editing = Boolean(stock);
  const quantity = parseWholeNumber(values.quantity);
  const unitCost = parseMoney(values.costPerUnit);
  const total = quantity !== null && unitCost !== null && Number.isSafeInteger(quantity * unitCost) ? quantity * unitCost : null;
  const threshold = parseWholeNumber(values.quantityAlertThreshold);
  const low = quantity !== null && threshold !== null && quantity <= threshold;
  const costProvided = values.costPerUnit.trim().length > 0;
  const totalValue = !costProvided ? 'Not provided' : total === null ? '—' : formatMoney(total);
  const totalHint = !costProvided
    ? 'Cost per unit was not provided.'
    : total !== null && quantity !== null && unitCost !== null
      ? `${quantity.toLocaleString()} units × ${formatMoney(unitCost)} per unit`
      : 'Enter a valid quantity and cost to calculate the total.';

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
    if (!result.ok) {
      setSaveError(result.message);
      Keyboard.dismiss();
      return;
    }
    submitting.current = true;
    setSaveError(null);
    Keyboard.dismiss();
    try {
      const record = stock
        ? await editStock(stock.id, {
          quantity: result.input.quantity, notes: result.input.notes,
          name: result.input.name, location: result.input.location,
          costPerUnitMinor: result.input.costPerUnitMinor,
          measurementPerUnit: result.input.measurementPerUnit,
          quantityAlertThreshold: result.input.quantityAlertThreshold,
          inventoryDate: result.input.inventoryDate,
          quantityChangeReason: reason ?? undefined, quantityChangeExplanation: explanation,
        })
        : await addStock(result.input);
      onSaved(record);
    } catch (error) {
      setSaveError(`${error instanceof Error ? error.message : 'We couldn’t save this stock.'} Your entries are still here; please try again.`);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <View style={styles.form}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Stock information</Text>
        <Text style={styles.sectionSubtitle}>{editing ? 'Update stock details, including the most recently received date.' : 'A few details to keep everything in order.'}</Text>
        <Text style={styles.helpText}><Text style={styles.required}>*</Text> Required field</Text>
      </View>
      <TextField
        label="Stock name"
        required
        value={values.name}
        onChangeText={(text) => change('name', text)}
        placeholder="e.g. Jasmine rice, 1 kg"
        error={errors.name}
        editable={!isSaving}
        autoCapitalize="sentences"
      />
      <LocationSelect
        value={values.location}
        onChange={(location) => change('location', location)}
        error={errors.location}
        disabled={isSaving}
      />
      <TextField
        label="Measurement per unit (optional)"
        value={values.measurementPerUnit}
        onChangeText={(text) => change('measurementPerUnit', text)}
        placeholder="e.g. 500 g, 1 L, or 12 pieces per box"
        editable={!isSaving}
        hint="Describes the size or contents of one inventory unit."
      />
      <QuantityAdjustment
        currentQuantity={stock?.quantity}
        value={values.quantity}
        error={errors.quantity}
        reason={reason}
        reasonError={reasonError}
        explanation={explanation}
        disabled={isSaving}
        onQuantityChange={(text) => change('quantity', text)}
        onReasonChange={(selectedReason) => {
          setReason(selectedReason);
          setReasonError(null);
          setSaveError(null);
        }}
        onExplanationChange={(text) => {
          setExplanation(text);
          setSaveError(null);
        }}
      />
      <TextField
        label="Cost per unit (optional)"
        value={values.costPerUnit}
        onChangeText={(text) => change('costPerUnit', text)}
        placeholder="0.00"
        keyboardType="decimal-pad"
        error={errors.costPerUnit}
        editable={!isSaving}
        hint="Leave blank if unknown. Use the same currency for all stock."
      />
      <TextField
        label="Low-stock alert threshold"
        required
        value={values.quantityAlertThreshold}
        onChangeText={(text) => change('quantityAlertThreshold', text)}
        placeholder="e.g. 5"
        keyboardType="number-pad"
        error={errors.quantityAlertThreshold}
        editable={!isSaving}
        hint="A Low Stock badge appears at or below this quantity."
      />
      <View style={styles.dateHeading}>
        <Text style={styles.sectionTitle}>Receipt date</Text>
        <Button title="Use today" variant="ghost" disabled={isSaving} onPress={() => change('inventoryDate', localToday())} />
      </View>
      <TextField
        label="Most recently received date"
        required
        value={values.inventoryDate}
        onChangeText={(text) => change('inventoryDate', text)}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.inventoryDate}
        editable={!isSaving}
        hint="YYYY-MM-DD · Enter the date of the latest stock delivery."
      />
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>TOTAL ACQUISITION COST</Text>
        <Text style={styles.totalValue}>{totalValue}</Text>
        <Text style={styles.totalHint}>{totalHint}</Text>
      </View>
      {low && <View style={styles.lowNotice}><Text style={styles.lowText}>Low Stock · This quantity is at or below the alert threshold of {threshold}.</Text></View>}
      <TextField
        label="Notes (optional)"
        value={values.notes}
        onChangeText={(text) => change('notes', text)}
        placeholder="Anything useful to remember about this stock…"
        multiline
        error={errors.notes}
        editable={!isSaving}
      />
      {!editing && <Text style={styles.helpText}>You can update the received date later. Creation and last-updated timestamps are recorded automatically.</Text>}
      <View style={styles.actions}>
        {saveError && <View key={saveError} onLayout={onFeedbackShown}><Notice error message={saveError} /></View>}
        <Button
          title={isSaving ? 'Saving…' : editing ? 'Save changes' : 'Add stock'}
          onPress={() => { void submit(); }}
          loading={isSaving}
          style={styles.submit}
        />
        {onCancel && <Button title="Cancel" onPress={onCancel} variant="secondary" disabled={isSaving} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  required: { color: colors.danger },
  form: { gap: spacing.xl },
  sectionHeading: { gap: 6, marginBottom: 4 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  sectionSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  dateHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -18 },
  totalCard: { ...shadows.card, backgroundColor: colors.primarySoft, borderRadius: radii.md, padding: 20, gap: 8 },
  totalLabel: { color: colors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  totalValue: { color: colors.ink, fontSize: 32, lineHeight: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
  totalHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  lowNotice: { padding: 14, borderRadius: radii.sm, backgroundColor: colors.warningSoft },
  lowText: { fontSize: 13, lineHeight: 20, color: colors.warning },
  helpText: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  actions: { gap: 10, marginTop: 4 },
  submit: { minHeight: 52 },
});
