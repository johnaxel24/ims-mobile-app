import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { spacing } from '@/theme/inventoryTheme';
import { useInventory } from '../InventoryProvider';
import { formatMoney, receiptAcquisitionCost, validateDeliveryCosts } from '../inventory.logic';
import type { DeliveryReceipt } from '../inventory.types';
import { DeliveryCostFields, type DeliveryCostValues } from './DeliveryCostFields';

function moneyInput(value: number | null): string {
  return value === null ? '' : formatMoney(value).replace(/,/g, '');
}

export function DeliveryCostEditor({ stockId, entryId, receipt, explanation, onClose }: {
  stockId: string; entryId: string; receipt: DeliveryReceipt; explanation: string; onClose: () => void;
}) {
  const { editDeliveryCost, isSaving } = useInventory();
  const [values, setValues] = useState<DeliveryCostValues>(() => ({
    costPerUnit: moneyInput(receipt.costPerUnitMinor), totalAcquisitionCost: moneyInput(receiptAcquisitionCost(receipt)),
  }));
  const [notes, setNotes] = useState(explanation);
  const [errors, setErrors] = useState<Partial<Record<keyof DeliveryCostValues, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function save() {
    if (submitting.current || isSaving) return;
    Keyboard.dismiss();
    const result = validateDeliveryCosts(receipt.quantityReceived, values.costPerUnit, values.totalAcquisitionCost);
    setErrors(result.errors);
    const labels = Object.keys(result.errors).map((key) => key === 'costPerUnit' ? 'Cost per unit' : 'Total acquisition cost');
    if (labels.length) { setSaveError(`Please complete or correct: ${labels.join(', ')}.`); return; }
    submitting.current = true;
    setSaveError(null);
    try {
      await editDeliveryCost(stockId, entryId, {
        costPerUnitMinor: result.costPerUnitMinor, totalAcquisitionCostMinor: result.totalAcquisitionCostMinor, explanation: notes,
      });
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save delivery costs. Please try again.');
    } finally { submitting.current = false; }
  }

  return <View style={styles.form}>
    <DeliveryCostFields quantity={receipt.quantityReceived} values={values} errors={errors} disabled={isSaving}
      onChange={(key, value) => {
        setValues((current) => ({ ...current, [key]: value }));
        setErrors({}); setSaveError(null);
      }} />
    <Button title="Use calculated total" variant="ghost" disabled={isSaving}
      onPress={() => { setValues((current) => ({ ...current, totalAcquisitionCost: '' })); setErrors({}); setSaveError(null); }} />
    <TextField label="Delivery notes (optional)" value={notes} multiline editable={!isSaving}
      onChangeText={(value) => { setNotes(value); setSaveError(null); }} />
    {saveError && <Notice error message={saveError} />}
    <Button title="Save delivery costs" loading={isSaving} onPress={() => { void save(); }} />
    <Button title="Cancel" variant="secondary" disabled={isSaving} onPress={onClose} />
  </View>;
}

const styles = StyleSheet.create({ form: { gap: spacing.md, paddingTop: spacing.md } });
