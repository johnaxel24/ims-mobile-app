import { router } from "expo-router";
import { useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { InventoryGate } from "@/features/inventory/components/InventoryGate";
import { StockForm } from "@/features/inventory/components/StockForm";
import { colors, contentWidth } from "@/theme/inventoryTheme";

export default function AddInventoryItemScreen() {
  const scrollRef = useRef<ScrollView>(null);
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.fill}>
      <InventoryGate>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={100}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>GROW YOUR INVENTORY</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Add Inventory Item
            </Text>
            <StockForm
              onSaved={(stock) =>
                router.dismissTo({ pathname: "/", params: { added: stock.id } })
              }
              onFeedbackShown={() =>
                requestAnimationFrame(() =>
                  scrollRef.current?.scrollToEnd({ animated: true }),
                )
              }
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </InventoryGate>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 24,
    paddingBottom: 40,
    width: "100%",
    maxWidth: contentWidth,
    alignSelf: "center",
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 16,
    color: colors.primary,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 29,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.8,
    marginBottom: 24,
  },
});
