import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/theme/inventoryTheme';

export function Notice({ message, onDismiss, error = false }: { message: string; onDismiss?: () => void; error?: boolean }) {
  return (
    <View accessibilityLiveRegion="polite" style={[styles.container, error && styles.error]}>
      <Text accessibilityRole={error ? 'alert' : undefined} style={[styles.message, error && styles.errorText]}>{message}</Text>
      {onDismiss && <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" hitSlop={4} onPress={onDismiss} style={styles.dismiss}><Text style={styles.close}>×</Text></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.successSoft, borderRadius: radii.sm, paddingLeft: 14, paddingVertical: 4, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48 },
  message: { flex: 1, color: colors.success, fontSize: 13, lineHeight: 20, paddingVertical: 8 },
  dismiss: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  close: { color: colors.muted, fontSize: 24 },
  error: { backgroundColor: colors.dangerSoft },
  errorText: { color: colors.danger },
});
