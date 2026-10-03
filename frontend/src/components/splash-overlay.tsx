import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SparshMark } from '@/components/sparsh-logo';
import { BRAND_COLOR } from '@/constants/brand';
import { useSession } from '@/context/session';

const DURATION = 600;
/** Matches the splash image's imageWidth in app.json, so the native splash hands off seamlessly. */
const MARK_SIZE = 110;

const exitKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1 }],
    opacity: 1,
  },
  20: {
    opacity: 1,
  },
  70: {
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 0,
    transform: [{ scale: 1.15 }],
    easing: Easing.elastic(0.7),
  },
});

/**
 * Takes over from the native splash screen and stays up until the saved session has loaded, so
 * the login screen never flashes for a patient who is already logged in.
 */
export function SplashOverlay() {
  const { isLoading } = useSession();
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const mark = <SparshMark size={MARK_SIZE} color="#FFFFFF" />;

  return nativeSplashHidden && !isLoading ? (
    <Animated.View
      entering={exitKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.overlay}>
      {mark}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setNativeSplashHidden(true);
        });
      }}
      style={styles.overlay}>
      {mark}
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
