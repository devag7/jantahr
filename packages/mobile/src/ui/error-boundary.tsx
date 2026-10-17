import * as React from 'react';
import { View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { Button, EmptyState, Text } from './kit';
import { space, useTheme } from './theme';

/** Shown instead of a blank screen when a screen fails to draw; "Try again" redraws it. */
export function ScreenError({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background, padding: space.xl }}>
      <EmptyState icon="alert-circle-outline" title="This screen hit a problem" message="Try again. If it keeps happening, tell us at jantahr@devshipit.com." action={<Button title="Try again" onPress={() => void retry()} />} />
      {__DEV__ && <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>{error.message}</Text>}
    </View>
  );
}
