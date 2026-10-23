import { useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { FieldLabel } from '@/components/FieldLabel';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { colors, radii } from '@/theme/tokens';
import { useInventory } from '../InventoryProvider';
import { isSameLocation } from '../inventory.logic';

interface LocationSelectProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function LocationSelect({ value, onChange, error, disabled }: LocationSelectProps) {
  const { locations, addLocation } = useInventory();
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  async function saveLocation() {
    if (busy.current || disabled) return;
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
        accessibilityState={{ expanded, disabled: Boolean(disabled) }}
        disabled={disabled}
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
                  <Pressable
                    key={location}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: Boolean(disabled) }}
                    disabled={disabled}
                    onPress={() => {
                      onChange(location);
                      setExpanded(false);
                      setAdding(false);
                      setLocationError(null);
                    }}
                    style={[styles.option, selected && styles.selected]}>
                    <Text style={styles.optionText}>{location}</Text>
                    {selected && <Text style={styles.check}>✓</Text>}
                  </Pressable>
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
              disabled={disabled}
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
                editable={!disabled && !saving}
                autoCapitalize="sentences"
                autoFocus
              />
              {locationError && <Notice error message={locationError} />}
              <Button
                title="Save location"
                loading={saving}
                disabled={disabled && !saving}
                onPress={() => { void saveLocation(); }}
              />
              <Button
                title="Cancel"
                variant="ghost"
                disabled={disabled || saving}
                onPress={() => {
                  setAdding(false);
                  setLocationError(null);
                }}
              />
            </View>
          )}
        </View>
      )}
      <Text style={styles.hint}>Choose a saved location or add one for future stock records.</Text>
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
  option: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 22 },
  selected: { backgroundColor: colors.primarySoft },
  check: { color: colors.primary, fontSize: 16 },
  newLocation: { padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
  empty: { padding: 14, color: colors.muted, fontSize: 13, lineHeight: 20 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
});
