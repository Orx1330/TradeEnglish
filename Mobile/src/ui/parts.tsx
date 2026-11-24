import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { gloss, tokens } from '../data/course';
import { haptic } from '../lib/haptics';
import { C, EN_FONT, MAX_W, ROW, ROW_EN } from '../theme';
import { Glass } from './Glass';
import { E, T, fill } from './kit';

/* ---------- living background ---------- */
function Orb({ color, size, x, y, drift, delay }: { color: string; size: number; x: number; y: number; drift: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 9000 + delay * 2, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
  }, [delay, t]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: (t.value - 0.5) * drift }, { translateY: (0.5 - t.value) * drift * 0.7 }, { scale: 1 + t.value * 0.08 }],
  }));
  const id = `orb${color.replace('#', '')}${size}`;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size }, anim]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.55} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.2} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Soft drifting light behind every screen. Glass needs something to refract, and a still, flat
 * backdrop makes it look like plain white cards.
 */
export function Background({ tint = C.green }: { tint?: string }) {
  const { width, height } = useWindowDimensions();
  const w = Math.min(width, MAX_W + 200);
  return (
    <View pointerEvents="none" style={[fill, { backgroundColor: C.bg, overflow: 'hidden' }]}>
      <Orb color={tint} size={w * 1.15} x={w * 0.82} y={height * 0.1} drift={46} delay={0} />
      <Orb color="#F2B33D" size={w * 0.95} x={w * 0.08} y={height * 0.46} drift={56} delay={900} />
      <Orb color="#59B7D9" size={w * 1.05} x={w * 0.78} y={height * 0.88} drift={50} delay={1700} />
    </View>
  );
}

/* ---------- bottom sheet ---------- */
export function Sheet({
  visible,
  onClose,
  children,
  tint,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  tint?: string;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const p = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      p.value = withSpring(1, { damping: 22, stiffness: 240, mass: 0.9 });
    } else if (mounted) {
      p.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) });
      const t = setTimeout(() => setMounted(false), 210);
      return () => clearTimeout(t);
    }
  }, [visible, mounted, p]);

  const backdrop = useAnimatedStyle(() => ({ opacity: p.value }));
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - p.value) * 520 }] }));

  if (!mounted) return null;
  const body = <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>{children}</View>;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[fill, { backgroundColor: 'rgba(20,34,28,0.34)' }, backdrop]}>
          <Pressable style={fill} onPress={onClose} accessibilityLabel="إغلاق" />
        </Animated.View>
        <Animated.View style={[{ width: '100%', maxWidth: MAX_W, alignSelf: 'center' }, panel]}>
          <Glass radius={34} tint={tint} intensity={80} depth={3} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, maxHeight: height * 0.86 }}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 8 }}>
              <View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: 'rgba(29,50,41,0.2)' }} />
            </View>
            {scroll ? (
              <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {body}
              </ScrollView>
            ) : (
              body
            )}
          </Glass>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ---------- confetti ---------- */
const CONFETTI = ['#3FAE5A', '#F2B33D', '#2E9BC4', '#D96C86', '#8571C9', '#FFFFFF'];
function Piece({ i, width, height }: { i: number; width: number; height: number }) {
  const seed = useMemo(() => ({ x: Math.random() * width, drift: (Math.random() - 0.5) * 160, dur: 1800 + Math.random() * 1600, delay: Math.random() * 500, size: 7 + Math.random() * 7, spin: 360 + Math.random() * 720 }), [width]);
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(seed.delay, withTiming(1, { duration: seed.dur, easing: Easing.out(Easing.quad) }));
  }, [seed, t]);
  const anim = useAnimatedStyle(() => ({
    opacity: t.value < 0.8 ? 1 : (1 - t.value) * 5,
    transform: [{ translateX: seed.x + seed.drift * t.value }, { translateY: -30 + (height * 0.75 + 30) * t.value }, { rotate: `${seed.spin * t.value}deg` }],
  }));
  return (
    <Animated.View
      style={[{ position: 'absolute', top: 0, left: 0, width: seed.size, height: seed.size * (i % 3 === 0 ? 1 : 0.5), borderRadius: i % 4 === 0 ? seed.size : 2, backgroundColor: CONFETTI[i % CONFETTI.length] }, anim]}
    />
  );
}
export function Confetti({ count = 44 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  const w = Math.min(width, MAX_W);
  return (
    <View pointerEvents="none" style={[fill, { overflow: 'hidden' }]}>
      {Array.from({ length: count }, (_, i) => (
        <Piece key={i} i={i} width={w} height={height} />
      ))}
    </View>
  );
}

/* ---------- tappable English sentence ---------- */
/**
 * Shows a sentence word by word. Tapping a word reveals its Arabic meaning underneath —
 * the small hint that lets a learner unblock themselves without leaving the exercise.
 */
export function WordLine({ en, size = 26, color = C.ink, center }: { en: string; size?: number; color?: string; center?: boolean }) {
  const words = useMemo(() => tokens(en), [en]);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => setOpen(null), [en]);
  const meaning = open != null ? gloss(words[open]) : undefined;
  return (
    <View>
      <View style={{ flexDirection: ROW_EN, flexWrap: 'wrap', justifyContent: center ? 'center' : 'flex-start', columnGap: size * 0.28, rowGap: 4 }}>
        {words.map((word, i) => {
          const on = open === i;
          return (
            <Pressable
              key={i}
              hitSlop={4}
              onPress={() => {
                haptic.tap();
                setOpen(on ? null : i);
              }}>
              <View style={{ borderBottomWidth: 2, borderStyle: 'dotted', borderBottomColor: on ? C.blue : 'rgba(29,50,41,0.22)', paddingBottom: 1, backgroundColor: on ? C.blueSoft : 'transparent', borderRadius: 4 }}>
                <E size={size} bold color={on ? C.blue : color} style={{ fontFamily: EN_FONT }}>
                  {word}
                </E>
              </View>
            </Pressable>
          );
        })}
      </View>
      {open != null ? (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(100)} style={{ marginTop: 10, alignSelf: center ? 'center' : 'stretch' }}>
          <View style={{ flexDirection: ROW, alignItems: 'center', gap: 8, backgroundColor: C.blueSoft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, alignSelf: center ? 'center' : 'stretch' }}>
            <T size={15} w="medium" color={C.ink} style={{ flexShrink: 1 }}>
              {meaning ?? 'لا يوجد شرح لهذه الكلمة'}
            </T>
            <E size={14} color={C.blue} bold>
              {words[open].replace(/[.,!?;:]+$/, '')}
            </E>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Scales in with a small overshoot — for trophies, check marks and badges. */
export function Pop({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withDelay(delay, withSpring(1, { damping: 9, stiffness: 160, mass: 0.7 }));
  }, [delay, s]);
  const anim = useAnimatedStyle(() => ({ opacity: Math.min(1, s.value * 2), transform: [{ scale: s.value }] }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}

/** Quick left-right shake for a wrong answer. Bump `trigger` to play it. */
export function useShake(trigger: number) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (trigger > 0) {
      x.value = withSequence(
        withTiming(-9, { duration: 45 }),
        withTiming(9, { duration: 70 }),
        withTiming(-6, { duration: 60 }),
        withTiming(6, { duration: 60 }),
        withTiming(0, { duration: 50 })
      );
    }
  }, [trigger, x]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
}

export const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: MAX_W, alignSelf: 'center' },
});
