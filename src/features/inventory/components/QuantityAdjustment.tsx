import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldLabel } from '@/components/FieldLabel';
import { TextField } from '@/components/TextField';
import { colors, radii, shadows, spacing } from '@/theme/inventoryTheme';
import { EDIT_QUANTITY_CHANGE_REASONS, parseWholeNumber } from '../inventory.logic';
import type { QuantityChangeReason } from '../inventory.types';

interface QuantityAdjustmentProps {
  currentQuantity?: number;
  value: string;
  error?: string;
  reason: QuantityChangeReason | null;
  reasonError: string | null;
  explanation: string;
  disabled: boolean;
  onQuantityChange: (value: string) => void;
  onReasonChange: (reason: QuantityChangeReason) => void;
  onExplanationChange: (value: string) => void;
}

/** Owns picker expansion; submitted values and validation stay with the form. */
export function QuantityAdjustment({
  currentQuantity, value, error, reason, reasonError, explanation, disabled,
  onQuantityChange, onReasonChange, onExplanationChange,
}: QuantityAdjustmentProps) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const quantity = parseWholeNumber(value);
  const editing = currentQuantity !== undefined;
  const changed = currentQuantity !== undefined && quantity !== null && quantity !== currentQuantity;

  return (
    <View style={styles.section}>
      {currentQuantity !== undefined && (
        <Text style={styles.currentQuantity}>
          Current quantity: {currentQuantity.toLocaleString()} units
        </Text>
      )}
      <TextField
        label={editing ? 'Available quantity' : 'Initial quantity'}
        required
        value={value}
        onChangeText={onQuantityChange}
        placeholder="0"
        keyboardType="number-pad"
        error={error}
        editable={!disabled}
      />
      {changed && currentQuantity !== undefined && quantity !== null && (
        <>
          <View style={styles.preview} accessibilityLiveRegion="polite">
            <Text style={styles.previewText}>
              {currentQuantity.toLocaleString()} → {quantity.toLocaleString()} units
            </Text>
            <Text style={styles.previewText}>
              {quantity > currentQuantity ? '+' : '−'}{Math.abs(quantity - currentQuantity).toLocaleString()}
            </Text>
          </View>
          <View style={styles.reasonGroup}>
            <FieldLabel label="Reason" required />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reason, required when quantity changes: ${reason ?? 'Choose a reason'}`}
              accessibilityState={{ expanded: reasonOpen, disabled }}
              disabled={disabled}
              onPress={() => {
                Keyboard.dismiss();
                setReasonOpen((open) => !open);
              }}
              style={[styles.option, reasonError && styles.invalid]}>
              <Text style={styles.optionText}>{reason ?? 'Choose a reason'}</Text>
              <Text style={styles.optionText}>{reasonOpen ? '▴' : '▾'}</Text>
            </Pressable>
            {reasonError && <Text accessibilityRole="alert" style={styles.error}>{reasonError}</Text>}
            {reasonOpen && (
              <View style={styles.options}>
                {EDIT_QUANTITY_CHANGE_REASONS.map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: option === reason, disabled }}
                    disabled={disabled}
                    style={[styles.option, option === reason && styles.selected]}
                    onPress={() => {
                      onReasonChange(option);
                      setReasonOpen(false);
                    }}>
                    <Text style={styles.optionText}>{option}{option === reason ? ' ✓' : ''}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <TextField
            label="Additional explanation (optional)"
            value={explanation}
            onChangeText={onExplanationChange}
            placeholder="Details about this quantity change…"
            editable={!disabled}
            multiline
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xl },
  currentQuantity: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  preview: { ...shadows.card, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: 16, backgroundColor: colors.primarySoft, borderRadius: radii.sm },
  previewText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  reasonGroup: { gap: spacing.sm },
  option: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.surface },
  invalid: { borderColor: colors.danger },
  optionText: { color: colors.ink, fontSize: 15, flexShrink: 1 },
  error: { color: colors.danger, fontSize: 13 },
  options: { gap: spacing.xs },
  selected: { backgroundColor: colors.primarySoft },
});
