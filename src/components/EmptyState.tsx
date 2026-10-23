import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors } from '@/theme/inventoryTheme';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
}

export function EmptyState({ title, description, actionLabel, onAction, loading }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.symbol}>
        {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.symbolText}>≡</Text>}
      </View>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} style={styles.action} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  symbol: { height: 64, width: 64, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  symbolText: { fontSize: 32, color: colors.primary, fontWeight: '500' },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  description: { fontSize: 14, lineHeight: 22, color: colors.muted, textAlign: 'center', maxWidth: 320 },
  action: { marginTop: 8 },
});
