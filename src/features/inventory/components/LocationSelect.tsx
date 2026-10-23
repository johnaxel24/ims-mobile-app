import { useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { FieldLabel } from '@/components/FieldLabel';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { colors, radii } from '@/theme/inventoryTheme';
import { useInventory } from '../InventoryProvider';
import { isSameLocation } from '../inventory.logic';

interface LocationSelectProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function LocationSelect({ value, onChange, error, disabled }: LocationSelectProps) {
  const { locations, addLocation, deleteLocation, isSaving } = useInventory();
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState<string | null>(null);
  const busy = useRef(false);
  const confirming = useRef(false);
  const unavailable = Boolean(disabled || isSaving || saving || deletingLocation !== null);

  async function removeLocation(location: string) {
    if (busy.current || disabled || isSaving) return;
    busy.current = true;
    setDeletingLocation(location);
    setLocationError(null);
    try {
      await deleteLocation(location);
      if (isSameLocation(value, location)) onChange('');
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Location could not be deleted. Please try again.');
    } finally {
      busy.current = false;
      setDeletingLocation(null);
    }
  }

  function confirmDeletion(location: string) {
    if (unavailable || busy.current || confirming.current) return;
    Keyboard.dismiss();
    confirming.current = true;
    Alert.alert('Delete location?', `Remove “${location}” from your saved locations? Existing delivery history will be kept.`, [
      { text: 'Cancel', style: 'cancel', onPress: () => { confirming.current = false; } },
      { text: 'Delete', style: 'destructive', onPress: () => { confirming.current = false; void removeLocation(location); } },
    ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  }

  async function saveLocation() {
    if (busy.current || unavailable) return;
    if (!name.trim()) { setLocationError('Enter a location name.'); return; }
    busy.current = true;
    setSaving(true);
    setLocationError(null);
    Keyboard.dismiss();
    try {
      const location = await addLocation(name);
      onChange(location);
      setName('');
      setAdding(false);
      setExpanded(false);
    } catch {
      setLocationError('Location could not be saved. Your entry is still here; please try again.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={styles.field}>
      <FieldLabel label="Location" required />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Location, required: ${value || 'Select a location'}`}
        accessibilityState={{ expanded, disabled: unavailable }}
        disabled={unavailable}
        onPress={() => { Keyboard.dismiss(); setExpanded((current) => !current); }}
        style={[styles.control, error && styles.invalid]}>
        <Text style={[styles.value, !value && styles.placeholder]}>{value || 'Select a location'}</Text>
        <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {expanded && (
        <View style={styles.dropdown}>
          {locations.length > 0 ? (
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={styles.options}>
              {locations.map((location) => {
                const selected = isSameLocation(value, location);
                return (
                  <View key={location} style={[styles.optionRow, selected && styles.selected]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: unavailable }}
                    disabled={unavailable}
                    onPress={() => {
                      onChange(location);
                      setExpanded(false);
                      setAdding(false);
                      setLocationError(null);
                    }}
                    style={styles.option}>
                    <Text style={styles.optionText}>{location}</Text>
                    {selected && <Text style={styles.check}>✓</Text>}
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Delete location ${location}`}
                    accessibilityState={{ disabled: unavailable }} disabled={unavailable}
                    onPress={() => confirmDeletion(location)} style={styles.deleteButton}>
                    <Text style={styles.deleteText}>{deletingLocation === location ? 'Deleting…' : 'Delete'}</Text>
                  </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.empty}>No locations yet. Add your first location below.</Text>
          )}
          {!adding ? (
            <Button
              title="+ Add new location"
              variant="ghost"
              disabled={unavailable}
              onPress={() => {
                setAdding(true);
                setLocationError(null);
              }}
            />
          ) : (
            <View style={styles.newLocation}>
              <TextField
                label="New location name"
                required
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setLocationError(null);
                }}
                placeholder="e.g. Shelf A"
                editable={!unavailable}
                autoCapitalize="sentences"
                autoFocus
              />
              <Button
                title="Save location"
                loading={saving}
                disabled={unavailable && !saving}
                onPress={() => { void saveLocation(); }}
              />
              <Button
                title="Cancel"
                variant="ghost"
                disabled={unavailable}
                onPress={() => {
                  setAdding(false);
                  setLocationError(null);
                }}
              />
            </View>
          )}
          {locationError && <View style={styles.feedback}><Notice error message={locationError} /></View>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 7 },
  control: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm },
  value: { flex: 1, fontSize: 16, lineHeight: 22, color: colors.ink },
  placeholder: { color: colors.muted },
  chevron: { color: colors.primary, fontSize: 18 },
  invalid: { borderColor: colors.danger },
  dropdown: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.surface, overflow: 'hidden' },
  options: { maxHeight: 220 },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  option: { flex: 1, minHeight: 48, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteButton: { minHeight: 48, minWidth: 64, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  feedback: { padding: 14 },
  optionText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 22 },
  selected: { backgroundColor: colors.primarySoft },
  check: { color: colors.primary, fontSize: 16 },
  newLocation: { padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
  empty: { padding: 14, color: colors.muted, fontSize: 13, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
});
