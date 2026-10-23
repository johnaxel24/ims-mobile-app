import { parseWholeNumber, validateStockForm } from './inventory.logic';
import type { QuantityChangeReason, StockFormValues, StockSubmissionResult } from './inventory.types';

const FIELD_LABELS: Record<keyof StockFormValues, string> = {
  name: 'Stock name',
  quantity: 'Quantity',
  location: 'Location',
  costPerUnit: 'Cost per unit',
  measurementPerUnit: 'Measurement per unit',
  quantityAlertThreshold: 'Low-stock alert threshold',
  notes: 'Notes',
  inventoryDate: 'Most recently received date',
};

/** Collects field and conditional-reason errors together for inline and bottom feedback. */
export function validateStockSubmission(
  values: StockFormValues,
  currentQuantity: number | undefined,
  reason: QuantityChangeReason | null,
): StockSubmissionResult {
  const result = validateStockForm(values);
  const quantity = parseWholeNumber(values.quantity);
  const missingReason = currentQuantity !== undefined && quantity !== null
    && quantity !== currentQuantity && !reason;
  if (result.ok && !missingReason) return result;

  const errors = result.ok ? {} : result.errors;
  const fields = (Object.keys(errors) as (keyof StockFormValues)[]).map((field) => FIELD_LABELS[field]);
  if (missingReason) fields.push('Reason (required when quantity changes)');
  return {
    ok: false,
    errors,
    reasonError: missingReason ? 'Choose a reason for the quantity change.' : null,
    message: `Please complete or correct: ${fields.join(', ')}.`,
  };
}
