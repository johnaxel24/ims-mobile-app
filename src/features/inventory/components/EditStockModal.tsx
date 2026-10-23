import { useRef } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { colors, contentWidth } from '@/theme/inventoryTheme';
import { useInventory } from '../InventoryProvider';
import type { StockRecord } from '../inventory.types';
import { StockForm } from './StockForm';
import { ReceiveStockForm } from './ReceiveStockForm';

export function EditStockModal({ stock, visible, onClose, mode = 'edit' }: { stock: StockRecord; visible: boolean; onClose: () => void; mode?: 'edit' | 'receive' }) {
  const { isSaving } = useInventory();
  const scrollRef = useRef<ScrollView>(null);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!isSaving) onClose(); }}>
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
          <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{mode === 'receive' ? 'Receive stock' : 'Update stock'}</Text>
              <Button title="Close" variant="ghost" onPress={onClose} disabled={isSaving} />
            </View>
            <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              <Text style={styles.name}>{stock.name}</Text>
              {visible && (mode === 'receive'
                ? <ReceiveStockForm key={`receive:${stock.id}`} stock={stock} onSaved={onClose} onCancel={onClose}
                  onFeedbackShown={() => requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))} />
                : <StockForm key={stock.id} stock={stock} onSaved={onClose} onCancel={onClose}
                  onFeedbackShown={() => requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))} />)}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  headerTitle: { flex: 1, color: colors.ink, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  content: { padding: 24, paddingBottom: 48, width: '100%', maxWidth: contentWidth, alignSelf: 'center' },
  name: { fontSize: 26, lineHeight: 34, fontWeight: '700', color: colors.ink, marginBottom: 24 },
});
