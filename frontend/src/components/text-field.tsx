import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  /** Hides what is typed and adds a show/hide button. */
  password?: boolean;
};

export function TextField({ label, error, password = false, style, ...inputProps }: TextFieldProps) {
  const theme = useTheme();
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : theme.backgroundSelected,
          },
        ]}>
        <TextInput
          aria-label={label}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize={password ? 'none' : undefined}
          autoCorrect={password ? false : undefined}
          {...inputProps}
          secureTextEntry={password && hidden}
          style={[styles.input, { color: theme.text }, style]}
        />
        {password && (
          <Pressable
            role="button"
            aria-label={hidden ? 'Show password' : 'Hide password'}
            hitSlop={Spacing.two}
            onPress={() => setHidden((value) => !value)}
            style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
            <SymbolView
              name={
                hidden
                  ? { ios: 'eye', android: 'visibility', web: 'visibility' }
                  : { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }
              }
              size={20}
              tintColor={theme.textSecondary}
            />
          </Pressable>
        )}
      </View>
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one + Spacing.half,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  toggle: {
    paddingHorizontal: 14,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
