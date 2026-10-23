import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { BackHandler } from "react-native";

import {
  InventoryProvider,
  useInventory,
} from "@/features/inventory/InventoryProvider";
import { colors } from "@/theme/inventoryTheme";

// The initial route is configured in src/app/_layout.tsx.

function InventoryStack() {
  const { isSaving } = useInventory();
  useEffect(() => {
    if (!isSaving) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => subscription.remove();
  }, [isSaving]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          headerBackVisible: !isSaving,
          gestureEnabled: !isSaving,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ headerShown: false, title: "Inventory" }}
        />
        <Stack.Screen
          name="inventory/add-item"
          options={{ title: "Add Inventory Item" }}
        />
        <Stack.Screen name="inventory/[itemId]" options={{ title: "Stock details" }} />
      </Stack>
    </>
  );
}

export default function AppNavigator() {
  return (
    <InventoryProvider>
      <InventoryStack />
    </InventoryProvider>
  );
}
