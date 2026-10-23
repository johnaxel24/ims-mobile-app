import { StyleSheet, Text } from 'react-native';

import { colors } from '@/theme/tokens';

export function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <Text accessibilityLabel={required ? `${label}, required` : label} style={styles.label}>
      {label}{required && <Text style={styles.required}> *</Text>}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, lineHeight: 19, fontWeight: '600', color: colors.ink },
  required: { color: colors.danger },
});
