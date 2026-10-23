import { isInventoryDate, parseWholeNumber, quantityReasonError, validateDeliveryCosts, validateStockForm } from './inventory.logic';
import type { QuantityChangeReason, ReceiveStockInput, StockFormValues, StockSubmissionResult } from './inventory.types';

const FIELD_LABELS: Record<keyof StockFormValues, string> = {
  name: 'Stock name',
  quantity: 'Quantity',
  location: 'Location',
  costPerUnit: 'Cost per unit',
  totalAcquisitionCost: 'Total acquisition cost',
  measurementPerUnit: 'Measurement per unit',
  quantityAlertThreshold: 'Low-stock alert threshold',
  notes: 'Notes',
  inventoryDate: 'Received date',
};

/** Collects field and conditional-reason errors together for inline and bottom feedback. */
export function validateStockSubmission(
  values: StockFormValues,
  currentQuantity: number | undefined,
  reason: QuantityChangeReason | null,
): StockSubmissionResult {
  const result = validateStockForm(values, currentQuantity !== undefined);
  const quantity = parseWholeNumber(values.quantity);
  const reasonError = currentQuantity !== undefined && quantity !== null && quantity !== currentQuantity
    ? quantityReasonError(reason, currentQuantity, quantity) : null;
  if (result.ok && !reasonError) return result;

  const errors = result.ok ? {} : result.errors;
  const fields = (Object.keys(errors) as (keyof StockFormValues)[]).map((field) => FIELD_LABELS[field]);
  if (reasonError) fields.push(`Reason (required when quantity changes): ${reasonError}`);
  return {
    ok: false,
    errors,
    reasonError,
    message: `Please complete or correct: ${fields.join(', ')}.`,
  };
}

export interface ReceiveFormValues {
  quantity: string;
  costPerUnit: string;
  totalAcquisitionCost: string;
  receivedDate: string;
  explanation: string;
}

export type ReceiveFormErrors = Partial<Record<keyof ReceiveFormValues, string>>;

export function validateReceiveForm(values: ReceiveFormValues, currentQuantity: number):
  | { ok: true; input: ReceiveStockInput }
  | { ok: false; errors: ReceiveFormErrors; message: string } {
  const errors: ReceiveFormErrors = {};
  const quantity = parseWholeNumber(values.quantity);
  const costs = validateDeliveryCosts(quantity, values.costPerUnit, values.totalAcquisitionCost ?? '');
  if (quantity === null || quantity === 0) errors.quantity = 'Enter a positive whole number.';
  else if (!Number.isSafeInteger(currentQuantity + quantity)) errors.quantity = 'The resulting stock quantity is too large.';
  Object.assign(errors, costs.errors);
  if (!isInventoryDate(values.receivedDate)) errors.receivedDate = 'Use a valid date in YYYY-MM-DD format.';
  if (Object.keys(errors).length || quantity === null) {
    const labels: Record<keyof ReceiveFormValues, string> = { quantity: 'Received quantity', costPerUnit: 'Cost per unit', totalAcquisitionCost: 'Total acquisition cost', receivedDate: 'Received date', explanation: 'Notes' };
    return { ok: false, errors, message: `Please complete or correct: ${(Object.keys(errors) as (keyof ReceiveFormValues)[]).map((key) => labels[key]).join(', ')}.` };
  }
  return { ok: true, input: { quantity, costPerUnitMinor: costs.costPerUnitMinor, totalAcquisitionCostMinor: costs.totalAcquisitionCostMinor, receivedDate: values.receivedDate, explanation: values.explanation } };
}
