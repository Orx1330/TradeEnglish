import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { sfx, speak, speakText, usePlaying } from '../lib/audio';
import { haptic } from '../lib/haptics';
import { C, EN_FONT, F, LEFT, RIGHT, ROW } from '../theme';

/* ---------- text ---------- */
type TProps = TextProps & {
  size?: number;
  color?: string;
  w?: keyof typeof F;
  center?: boolean;
  style?: StyleProp<TextStyle>;
};

/** Arabic text: Thmanyah, right-to-left, right-aligned unless centred. */
export function T({ size = 16, color = C.ink, w = 'regular', center, style, ...rest }: TProps) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: F[w],
          fontSize: size,
          lineHeight: Math.round(size * 1.6),
          color,
          writingDirection: 'rtl',
          textAlign: center ? 'center' : RIGHT,
        },
        style,
      ]}
    />
  );
}

/** English text: system font, left-to-right. */
export function E({
  size = 18,
  color = C.ink,
  bold,
  center,
  style,
  ...rest
}: TextProps & { size?: number; color?: string; bold?: boolean; center?: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: EN_FONT,
          fontSize: size,
          lineHeight: Math.round(size * 1.35),
          color,
          fontWeight: bold ? '700' : '500',
          writingDirection: 'ltr',
          textAlign: center ? 'center' : LEFT,
          letterSpacing: size >= 22 ? -0.3 : 0,
        },
        style,
      ]}
    />
  );
}

/* ---------- icons ---------- */
export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
export function Icon({ name, size = 22, color = C.ink, style }: { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <MaterialCommunityIcons name={name as IconName} size={size} color={color} style={style} />;
}

/* ---------- touch ---------- */
type TapProps = {
  onPress?: () => void;
  onLongPress?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Style of the touch target itself (use for flex sizing inside rows). */
  outer?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** How far the element shrinks while held. */
  scale?: number;
  feel?: 'tap' | 'press' | 'soft' | 'none';
  sound?: boolean;
  hitSlop?: number;
  label?: string;
  /** A container that holds other buttons: skip the button role so controls are not nested. */
  plain?: boolean;
};

/** Every tappable thing springs under the finger and ticks the Taptic Engine. */
export function Tap({ onPress, onLongPress, children, style, outer, disabled, scale = 0.94, feel = 'tap', sound, hitSlop = 6, label, plain }: TapProps) {
  const pressed = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scale) }],
  }));
  return (
    <Pressable
      accessibilityRole={plain ? undefined : 'button'}
      accessibilityLabel={label}
      disabled={disabled}
      style={outer}
      hitSlop={hitSlop}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 70 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, { damping: 11, stiffness: 320, mass: 0.6 });
      }}
      onLongPress={onLongPress}
      onPress={() => {
        if (feel !== 'none') haptic[feel]();
        if (sound) sfx('tap');
        onPress?.();
      }}>
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

/* ---------- the chunky button ---------- */
type BtnProps = {
  title?: string;
  onPress?: () => void;
  color?: string;
  dark?: string;
  text?: string;
  icon?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  height?: number;
  size?: number;
  radius?: number;
  children?: React.ReactNode;
  feel?: 'tap' | 'press' | 'soft';
  english?: boolean;
};

/**
 * A button with a physical edge: the face sits on a darker base and sinks into it when pressed.
 * A soft gloss across the top half keeps it in the same material family as the glass around it.
 */
export function Btn({
  title,
  onPress,
  color = C.green,
  dark = C.greenDark,
  text = C.white,
  icon,
  disabled,
  style,
  height = 54,
  size = 17,
  radius = 18,
  children,
  feel = 'press',
  english,
}: BtnProps) {
  const DEPTH = 5;
  const pressed = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: pressed.value * DEPTH }] }));
  const faceColor = disabled ? C.lock : color;
  const baseColor = disabled ? C.lockDark : dark;
  const textColor = disabled ? '#8D9790' : text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      style={style}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 60 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, { damping: 12, stiffness: 380, mass: 0.5 });
      }}
      onPress={() => {
        haptic[feel]();
        onPress?.();
      }}>
      <View style={{ paddingBottom: DEPTH }}>
        <View style={{ position: 'absolute', top: DEPTH, left: 0, right: 0, bottom: 0, borderRadius: radius, backgroundColor: baseColor }} />
        <Animated.View
          style={[
            { minHeight: height, borderRadius: radius, backgroundColor: faceColor, overflow: 'hidden', justifyContent: 'center' },
            face,
          ]}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0)']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%' }}
          />
          {children ?? (
            <View style={{ flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 8 }}>
              {icon ? <Icon name={icon} size={size + 4} color={textColor} /> : null}
              {english ? (
                <E size={size} color={textColor} bold center>
                  {title}
                </E>
              ) : (
                <T size={size} color={textColor} w="bold" center style={{ lineHeight: Math.round(size * 1.45) }}>
                  {title}
                </T>
              )}
            </View>
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
}

/* ---------- progress ---------- */
export function Bar({ value, color = C.green, height = 14, track = 'rgba(29,50,41,0.10)' }: { value: number; color?: string; height?: number; track?: string }) {
  const v = useSharedValue(value);
  useEffect(() => {
    v.value = withSpring(Math.max(0, Math.min(1, value)), { damping: 16, stiffness: 140 });
  }, [value, v]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(v.value, 0.04) * 100}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden', flexDirection: ROW }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color, overflow: 'hidden' }, fill]}>
        <View style={{ position: 'absolute', top: height * 0.22, left: height * 0.6, right: height * 0.6, height: height * 0.22, borderRadius: height, backgroundColor: 'rgba(255,255,255,0.38)' }} />
      </Animated.View>
    </View>
  );
}

export function Ring({
  value,
  size = 44,
  stroke = 5,
  color = C.green,
  track = 'rgba(29,50,41,0.10)',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${len * v} ${len}`}
        />
      </Svg>
      {children}
    </View>
  );
}

/* ---------- small pieces ---------- */
export function Chip({
  label,
  active,
  onPress,
  icon,
  color = C.green,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: string;
  color?: string;
}) {
  return (
    <Tap onPress={onPress} scale={0.92}>
      <View
        style={{
          flexDirection: ROW,
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          height: 38,
          borderRadius: 19,
          backgroundColor: active ? color : 'rgba(255,255,255,0.7)',
          borderWidth: 1,
          borderColor: active ? color : C.hairline,
        }}>
        {icon ? <Icon name={icon} size={16} color={active ? C.white : C.sub} /> : null}
        <T size={14} w="medium" color={active ? C.white : C.sub} style={{ lineHeight: 20 }}>
          {label}
        </T>
      </View>
    </Tap>
  );
}

/** Round icon button on a frosted disc. */
export function IconBtn({
  icon,
  onPress,
  size = 44,
  color = C.ink,
  bg = 'rgba(255,255,255,0.78)',
  label,
}: {
  icon: string;
  onPress?: () => void;
  size?: number;
  color?: string;
  bg?: string;
  label?: string;
}) {
  return (
    <Tap onPress={onPress} scale={0.88} label={label}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: C.hairline,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} size={size * 0.5} color={color} />
      </View>
    </Tap>
  );
}

/**
 * Speaker button. While its sound plays, rings ripple out of it so the learner can see which
 * control is talking.
 */
export function SpeakBtn({
  clip,
  text,
  slow,
  size = 52,
  color = C.blue,
  voice,
  playKey,
}: {
  /** Bundled clip id; falls back to on-device speech of `text` when absent. */
  clip?: string;
  text?: string;
  slow?: boolean;
  size?: number;
  color?: string;
  voice?: string;
  playKey?: string;
}) {
  const key = playKey ?? `${clip ?? text}:${slow ? 'slow' : 'normal'}:${voice ?? ''}`;
  const playing = usePlaying(key);
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = playing
      ? withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), -1, false)
      : withTiming(0, { duration: 150 });
  }, [playing, pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: playing ? 0.45 * (1 - pulse.value) : 0,
    transform: [{ scale: 1 + pulse.value * 0.55 }],
  }));
  return (
    <Tap
      scale={0.88}
      feel="soft"
      label={slow ? 'استماع ببطء' : 'استماع'}
      onPress={() => {
        if (clip && speak(clip, { slow, voice, key })) return;
        if (text) speakText(text, { slow, key });
      }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring]} />
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: slow ? 'rgba(255,255,255,0.85)' : color,
            borderWidth: slow ? 1.5 : 0,
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name={slow ? 'tortoise' : playing ? 'volume-high' : 'volume-medium'} size={size * 0.48} color={slow ? color : C.white} />
        </View>
      </View>
    </Tap>
  );
}

/** Gentle endless float, used by the "start here" bubble and trophies. */
export function Bob({ children, distance = 5, style }: { children: React.ReactNode; distance?: number; style?: StyleProp<ViewStyle> }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(-distance, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [distance, y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

export const fill = StyleSheet.absoluteFill;
