import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SegmentedControlProps<T extends string> = {
  /** Accessible name for the group, e.g. the field label. */
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  invalid?: boolean;
};

/** A row of mutually exclusive choices, like radio buttons. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  invalid = false,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View
      role="radiogroup"
      aria-label={label}
      style={[
        styles.group,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: invalid ? theme.danger : theme.backgroundSelected,
        },
      ]}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            role="radio"
            aria-checked={selected}
            onPress={() => onChange(option)}
            style={[styles.option, selected && { backgroundColor: theme.tint }]}>
            <ThemedText type="smallBold" style={{ color: selected ? theme.onTint : theme.text }}>
              {option}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.one,
    gap: Spacing.one,
  },
  option: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
