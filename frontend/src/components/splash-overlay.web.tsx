import { StyleSheet, View } from 'react-native';

import { SparshMark } from '@/components/sparsh-logo';
import { BRAND_COLOR } from '@/constants/brand';
import { useSession } from '@/context/session';

/** Web has no native splash; just cover the page until the saved session has loaded. */
export function SplashOverlay() {
  const { isLoading } = useSession();

  if (!isLoading) return null;

  return (
    <View style={styles.overlay}>
      <SparshMark size={110} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BRAND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
