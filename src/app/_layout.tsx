import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

import { InventoryProvider, useInventory } from '@/features/inventory/InventoryProvider';
import { colors } from '@/theme/tokens';

export const unstable_settings = { initialRouteName: 'index' };

function InventoryStack() {
  const { isSaving } = useInventory();
  useEffect(() => {
    if (!isSaving) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [isSaving]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerBackVisible: !isSaving,
        gestureEnabled: !isSaving,
        contentStyle: { backgroundColor: colors.background },
      }}>
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Inventory' }} />
        <Stack.Screen name="stocks/new" options={{ title: 'Add stock' }} />
        <Stack.Screen name="stocks/[id]" options={{ title: 'Stock details' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return <InventoryProvider><InventoryStack /></InventoryProvider>;
}
