import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii } from '@/theme/inventoryTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, accessibilityLabel }: ButtonProps) {
  const inactive = Boolean(disabled || loading);
  const filled = variant === 'primary' || variant === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[variant], pressed && (variant === 'primary' ? styles.primaryPressed : styles.pressed), inactive && styles.disabled, style]}>
      {loading && <ActivityIndicator size="small" color={filled ? colors.surface : colors.primary} />}
      <Text style={[styles.label, !filled && styles.secondaryLabel]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 13, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primary: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  primaryPressed: { backgroundColor: colors.primaryPressed },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: colors.surface },
  secondaryLabel: { color: colors.primary },
});
