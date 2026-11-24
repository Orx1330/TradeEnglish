import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { C, shadow } from '../theme';

/** Real Liquid Glass exists on iOS 26 and later; everything else gets the frosted fallback. */
export const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable();

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Colour washed into the glass. */
  tint?: string;
  /** Lets the glass react to touch (iOS 26 only). */
  interactive?: boolean;
  /** Blur strength of the fallback, 0–100. */
  intensity?: number;
  depth?: 1 | 2 | 3;
};

/**
 * Floating chrome: tab bar, top bar, sheets, feedback panel. On iOS 26+ this is the system
 * Liquid Glass material; on older iOS, Android and the web it is a blurred, lit, bordered pane.
 */
export function Glass({ children, style, radius = 28, tint, interactive, intensity = 55, depth = 2 }: Props) {
  if (LIQUID) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive={interactive}
        tintColor={tint}
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[{ borderRadius: radius }, shadow(depth), style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
        <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.82)', 'rgba(255,255,255,0.50)']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.16 }]} /> : null}
        {/* specular edge: bright on top, fading down, like light catching the rim */}
        <LinearGradient
          colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 }}
        />
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1, borderColor: C.hairline }]} />
      </View>
      {children}
    </View>
  );
}

/**
 * Android draws an elevation shadow under the whole view, so a see-through background lets it
 * show as a grey frame around a pale box. There, elevated surfaces get the same colour made opaque
 * over the page background, which looks identical without the artefact.
 */
const PAGE = [0xff, 0xfc, 0xf5];
function opaque(color: string) {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(color);
  if (!m) return color;
  const a = Number(m[4]);
  return `rgb(${PAGE.map((bg, i) => Math.round(Number(m[i + 1]) * a + bg * (1 - a))).join(',')})`;
}

/**
 * Content surface inside scrolling pages. Deliberately not real glass: Apple reserves Liquid Glass
 * for the navigation layer, and dozens of live blurs in a list would cost frames.
 */
export function Card({
  children,
  style,
  radius = 24,
  color = C.surface,
  depth = 1,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  color?: string;
  depth?: 1 | 2 | 3;
}) {
  return (
    <View
      style={[
        { borderRadius: radius, backgroundColor: Platform.OS === 'android' ? opaque(color) : color, borderWidth: 1, borderColor: C.hairline },
        shadow(depth),
        style,
      ]}>
      {children}
    </View>
  );
}
