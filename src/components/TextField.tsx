import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radii } from '@/theme/tokens';
import { FieldLabel } from './FieldLabel';

interface TextFieldProps extends TextInputProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
}

export function TextField({ label, required = false, error, hint, style, onFocus, onBlur, ...props }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <FieldLabel label={label} required={required} />
      <TextInput
        {...props}
        accessibilityLabel={`${props.accessibilityLabel ?? label}${required ? ', required' : ''}`}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.faint}
        selectionColor={colors.primary}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[styles.input, props.multiline && styles.multiline, focused && styles.focused, error && styles.invalid, props.editable === false && styles.readOnly, style]}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 7, minWidth: 0 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, fontSize: 16, lineHeight: 22 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: colors.danger },
  readOnly: { backgroundColor: colors.background, color: colors.muted },
  hint: { fontSize: 12, lineHeight: 18, color: colors.muted },
  error: { fontSize: 12, lineHeight: 18, color: colors.danger },
});
