import React, { useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { haptic } from '../lib/haptics';
import { LaithRive, RIVE_AVAILABLE } from './LaithRive';
import { C, ROW, shadow } from '../theme';
import { T } from './kit';

/*
 * Laith (ليث) — a lion cub who is learning English alongside the learner — and the lioness who
 * turns up to celebrate with him when a stage is finished.
 *
 * Each is drawn as stacked layers on one 200x200 artboard, every layer animated on its own:
 *   tail · body · head · eyes · book · two arms
 *
 * There are two engines behind <Laith />, with the same moods and touch reactions:
 *   - Rive: assets/rive/laith.riv (state machine "Mood"), played by LaithRive wherever a Rive
 *     runtime is available;
 *   - LaithSvg, below: the same artwork as layered SVG moved by Reanimated. It needs no native
 *     library, so it is what runs in Expo Go, and it takes over if the Rive file fails to load.
 */

export type Mood =
  /** Calm: breathing, blinking, tail swaying. */
  | 'idle'
  /** Standing by the next lesson: calm, with two eager little hops every few seconds. */
  | 'wait'
  /** A right answer: bounces, eyes squeeze shut in a smile. */
  | 'happy'
  /** A wrong answer: head drops to one side, small frown. */
  | 'sad'
  /** A stage finished: jumps with both arms up. */
  | 'cheer'
  /** Audio is playing: nods along, mouth a small "o". */
  | 'listen'
  /** Greeting: waves one paw. */
  | 'wave';

/** Where the character was touched. Each spot answers differently. */
export type Zone = 'head' | 'book' | 'tail';
export type Who = 'laith' | 'lioness';

const INK = '#4A2610';
const CREAM = '#FDEBC6';
const PINK = '#F4A3A0';
const LOOK = {
  laith: { fur: '#F6C262', furDark: '#E9A73F', mane: '#D9812A', maneDark: '#BF6A1C', tuft: '#BF6A1C', blush: '#F59C84' },
  lioness: { fur: '#F9D892', furDark: '#EDBC62', mane: '#EDBC62', maneDark: '#E0A94B', tuft: '#C98A3A', blush: '#F58FA0' },
};

const BOX = 200;
const fillBox: ViewStyle = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 };

/** One artboard-sized layer; every layer shares the same coordinates so the parts line up. */
function Layer({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
      {children}
    </Svg>
  );
}

const MANE_TUFTS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { x: 100 + Math.cos(a) * 49, y: 88 + Math.sin(a) * 47 };
});

type Face = 'calm' | 'smile' | 'sad' | 'ooh';
type EyeKind = 'open' | 'smile' | 'sad' | 'wide';

function Mouth({ face }: { face: Face }) {
  if (face === 'smile') {
    return (
      <G>
        <Path d="M86 106 Q100 126 114 106 Q100 111 86 106 Z" fill={INK} />
        <Path d="M93 114 Q100 121 107 114 Q100 111 93 114 Z" fill="#F08D8A" />
      </G>
    );
  }
  if (face === 'sad') return <Path d="M91 115 Q100 107 109 115" stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none" />;
  if (face === 'ooh') return <Ellipse cx={100} cy={112} rx={5} ry={5.5} fill={INK} />;
  return <Path d="M100 103 L100 107 M89 107 Q94.5 114 100 107 Q105.5 114 111 107" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

function Eyes({ kind, lashes }: { kind: EyeKind; lashes: boolean }) {
  if (kind === 'smile') {
    return (
      <G>
        <Path d="M71 87 Q80 76 89 87" stroke={INK} strokeWidth={4.2} strokeLinecap="round" fill="none" />
        <Path d="M111 87 Q120 76 129 87" stroke={INK} strokeWidth={4.2} strokeLinecap="round" fill="none" />
        {lashes ? <Path d="M70 86 L64 83 M130 86 L136 83" stroke={INK} strokeWidth={2.4} strokeLinecap="round" /> : null}
      </G>
    );
  }
  const look = kind === 'sad' ? 2 : 0;
  const ry = kind === 'wide' ? 11.5 : 10;
  return (
    <G>
      <Ellipse cx={80} cy={85 + look} rx={8} ry={ry} fill={INK} />
      <Ellipse cx={120} cy={85 + look} rx={8} ry={ry} fill={INK} />
      <Circle cx={83} cy={81 + look} r={3.2} fill="#fff" />
      <Circle cx={123} cy={81 + look} r={3.2} fill="#fff" />
      <Circle cx={77.5} cy={89 + look} r={1.5} fill="#fff" opacity={0.8} />
      <Circle cx={117.5} cy={89 + look} r={1.5} fill="#fff" opacity={0.8} />
      {lashes ? <Path d="M72 79 L66 74 M71 85 L64 83 M128 79 L134 74 M129 85 L136 83" stroke={INK} strokeWidth={2.4} strokeLinecap="round" /> : null}
      {kind === 'sad' ? (
        <G>
          <Path d="M70 73 L88 68" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <Path d="M130 73 L112 68" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </G>
      ) : null}
    </G>
  );
}

/** Which part is under a touch, in artboard coordinates. */
function zoneAt(x: number, y: number): Zone {
  if (x > 138 && y > 96 && y < 178) return 'tail';
  if (y < 136) return 'head';
  return 'book';
}

/** The zone a press landed on. The lioness carries no book, so her tummy counts as a pat. */
function zoneOfPress(e: GestureResponderEvent, size: number, flip: boolean | undefined, lioness: boolean): Zone {
  // native reports the touch as locationX/Y; a browser click carries offsetX/Y instead
  const at = e.nativeEvent as unknown as { locationX?: number; locationY?: number; offsetX?: number; offsetY?: number };
  const x = at.locationX ?? at.offsetX;
  const y = at.locationY ?? at.offsetY;
  // keyboard and screen-reader activation carry no position: treat it as a pat on the head
  if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return 'head';
  const k = size / BOX;
  const zone = zoneAt((flip ? size - x : x) / k, y / k);
  return lioness && zone === 'book' ? 'head' : zone;
}

type Props = {
  mood?: Mood;
  size?: number;
  /** Laith the cub (default), or the lioness: no mane, lighter fur, lashes and a bow. */
  who?: Who;
  /** Face the other way, so two characters can look at each other. */
  flip?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Called after the character's own reaction to a touch: a pat on the head brings a giggle, the
   * book is lifted up to be read, the tail whips with a startled jump. The screen decides what
   * else the touch means.
   */
  onZone?: (zone: Zone) => void;
  /** Turn off for small, decorative uses that should not take touches. */
  interactive?: boolean;
};

export function LaithSvg({ mood = 'idle', size = 120, who = 'laith', flip, style, onZone, interactive = true }: Props) {
  const look = LOOK[who];
  const lioness = who === 'lioness';
  // A touch overrides the mood for a moment.
  const [touched, setTouched] = useState<Zone | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const shown: Mood = touched === 'head' || touched === 'tail' ? 'happy' : touched === 'book' ? 'listen' : mood;
  const face: Face = touched === 'tail' ? 'ooh' : shown === 'happy' || shown === 'cheer' || shown === 'wave' ? 'smile' : shown === 'sad' ? 'sad' : shown === 'listen' ? 'ooh' : 'calm';
  const eyes: EyeKind = touched === 'tail' ? 'wide' : shown === 'happy' || shown === 'cheer' ? 'smile' : shown === 'sad' ? 'sad' : 'open';

  const breathe = useSharedValue(0);
  const tail = useSharedValue(0);
  const tailBoost = useSharedValue(0);
  const blink = useSharedValue(1);
  const head = useSharedValue(0); // tilt, degrees
  const nod = useSharedValue(0); // vertical bob of the head, artboard px
  const hop = useSharedValue(0); // whole body off the ground
  const arm = useSharedValue(0); // waving / cheering arm
  const squash = useSharedValue(0);
  const book = useSharedValue(0); // book lifted towards the viewer

  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true);
    tail.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true);
    blink.value = withRepeat(
      withSequence(withDelay(2600, withTiming(0.08, { duration: 70 })), withTiming(1, { duration: 110 }), withDelay(320, withTiming(0.08, { duration: 70 })), withTiming(1, { duration: 110 })),
      -1,
      false
    );
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(tail);
      cancelAnimation(blink);
    };
  }, [breathe, tail, blink]);

  useEffect(() => {
    const ease = { duration: 260, easing: Easing.out(Easing.quad) };
    cancelAnimation(head);
    cancelAnimation(nod);
    cancelAnimation(hop);
    cancelAnimation(arm);
    switch (shown) {
      case 'happy':
        head.value = withTiming(0, ease);
        nod.value = withTiming(0, ease);
        arm.value = withTiming(0, ease);
        hop.value = withSequence(withTiming(-16, { duration: 170, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 6, stiffness: 190, mass: 0.6 }));
        break;
      case 'cheer':
        head.value = withTiming(0, ease);
        nod.value = withTiming(0, ease);
        arm.value = withTiming(1, ease);
        hop.value = withRepeat(withSequence(withTiming(-18, { duration: 260, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }), withDelay(260, withTiming(0, { duration: 1 }))), -1, false);
        break;
      case 'sad':
        hop.value = withTiming(0, ease);
        arm.value = withTiming(0, ease);
        nod.value = withTiming(5, ease);
        head.value = withTiming(-11, { duration: 380, easing: Easing.out(Easing.quad) });
        break;
      case 'listen':
        hop.value = withTiming(0, ease);
        arm.value = withTiming(0, ease);
        head.value = withRepeat(withSequence(withTiming(6, { duration: 420, easing: Easing.inOut(Easing.sin) }), withTiming(-6, { duration: 420, easing: Easing.inOut(Easing.sin) })), -1, true);
        nod.value = withRepeat(withTiming(3, { duration: 210, easing: Easing.inOut(Easing.sin) }), -1, true);
        break;
      case 'wave':
        hop.value = withTiming(0, ease);
        nod.value = withTiming(0, ease);
        head.value = withTiming(5, ease);
        arm.value = withRepeat(withSequence(withTiming(1, { duration: 300, easing: Easing.inOut(Easing.sin) }), withTiming(0.72, { duration: 300, easing: Easing.inOut(Easing.sin) })), -1, true);
        break;
      case 'wait':
        nod.value = withTiming(0, ease);
        arm.value = withTiming(0, ease);
        head.value = withRepeat(withSequence(withTiming(4, { duration: 1500, easing: Easing.inOut(Easing.sin) }), withTiming(-3, { duration: 1500, easing: Easing.inOut(Easing.sin) })), -1, true);
        hop.value = withRepeat(
          withSequence(
            withDelay(2400, withTiming(-11, { duration: 150, easing: Easing.out(Easing.quad) })),
            withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }),
            withTiming(-8, { duration: 130, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 130, easing: Easing.in(Easing.quad) })
          ),
          -1,
          false
        );
        break;
      default:
        hop.value = withTiming(0, ease);
        nod.value = withTiming(0, ease);
        arm.value = withTiming(0, ease);
        head.value = withRepeat(withSequence(withTiming(2.5, { duration: 2200, easing: Easing.inOut(Easing.sin) }), withTiming(-2.5, { duration: 2200, easing: Easing.inOut(Easing.sin) })), -1, true);
    }
  }, [shown, head, nod, hop, arm]);

  const k = size / BOX;
  const whole = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value * k }, { scaleX: (flip ? -1 : 1) * (1 + squash.value * 0.1) }, { scaleY: 1 - squash.value * 0.1 + breathe.value * 0.012 }],
  }));
  const tailStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${(-9 + tail.value * 20) * (1 + tailBoost.value * 1.6)}deg` }] }));
  const headStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (nod.value - breathe.value * 1.4) * k }, { rotate: `${head.value}deg` }] }));
  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const bookStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -book.value * 20 * k }, { rotate: `${Math.sin(book.value * Math.PI * 3) * 7}deg` }, { scale: 1 + book.value * 0.28 }] }));
  // while the book is lifted both paws follow it up a little
  const armStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-arm.value * 138 - book.value * 30}deg` }] }));
  const otherArmStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${(shown === 'cheer' ? arm.value : 0) * 138 + book.value * 30}deg` }] }));

  const react = (zone: Zone) => {
    if (timer.current) clearTimeout(timer.current);
    setTouched(zone);
    timer.current = setTimeout(() => setTouched(null), zone === 'book' ? 1500 : 1100);
    if (zone === 'head') haptic.soft();
    if (zone === 'tail') {
      haptic.press();
      tailBoost.value = withSequence(withTiming(1, { duration: 120 }), withDelay(700, withTiming(0, { duration: 300 })));
      tail.value = withSequence(
        withRepeat(withTiming(0, { duration: 130, easing: Easing.inOut(Easing.sin) }), 6, true),
        withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true)
      );
    }
    if (zone === 'book') {
      haptic.tap();
      book.value = withSequence(withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.6)) }), withDelay(820, withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) })));
    }
    onZone?.(zone);
  };

  const art = (
    <Animated.View style={[{ width: size, height: size, transformOrigin: '50% 100%' }, whole]}>
      {/* soft ground shadow */}
      <View style={fillBox}>
        <Layer size={size}>
          <Ellipse cx={100} cy={193} rx={46} ry={6} fill="#1D3229" opacity={0.12} />
        </Layer>
      </View>

      <Animated.View style={[fillBox, { transformOrigin: '63% 82%' }, tailStyle]}>
        <Layer size={size}>
          <Path d="M126 164 C158 170 174 146 160 122" stroke={look.furDark} strokeWidth={9} strokeLinecap="round" fill="none" />
          <Ellipse cx={158} cy={115} rx={10.5} ry={14} fill={look.tuft} transform="rotate(-18 158 115)" />
        </Layer>
      </Animated.View>

      <View style={fillBox}>
        <Layer size={size}>
          <Ellipse cx={82} cy={188} rx={15} ry={8.5} fill={look.furDark} />
          <Ellipse cx={118} cy={188} rx={15} ry={8.5} fill={look.furDark} />
          <Ellipse cx={100} cy={158} rx={37} ry={34} fill={look.fur} />
          <Ellipse cx={100} cy={166} rx={22} ry={21} fill={CREAM} />
        </Layer>
      </View>

      <Animated.View style={[fillBox, { transformOrigin: '50% 66%' }, headStyle]}>
        <Layer size={size}>
          {lioness ? (
            <G>
              {/* no mane: soft round ears and a bow */}
              <Circle cx={58} cy={54} r={18} fill={look.fur} />
              <Circle cx={142} cy={54} r={18} fill={look.fur} />
              <Circle cx={58} cy={55} r={10} fill={PINK} />
              <Circle cx={142} cy={55} r={10} fill={PINK} />
              <Ellipse cx={100} cy={90} rx={48} ry={45} fill={look.fur} />
              <Ellipse cx={128} cy={45} rx={11} ry={7.5} fill="#EE6C8A" transform="rotate(-28 128 45)" />
              <Ellipse cx={150} cy={41} rx={11} ry={7.5} fill="#EE6C8A" transform="rotate(34 150 41)" />
              <Circle cx={139} cy={44} r={5.5} fill="#D9567A" />
            </G>
          ) : (
            <G>
              {/* fluffy mane: a ring of tufts around a solid core */}
              {MANE_TUFTS.map((t, i) => (
                <Circle key={i} cx={t.x} cy={t.y} r={17} fill={i % 2 ? look.mane : look.maneDark} />
              ))}
              <Circle cx={100} cy={88} r={51} fill={look.mane} />
              <Circle cx={60} cy={48} r={15} fill={look.fur} />
              <Circle cx={140} cy={48} r={15} fill={look.fur} />
              <Circle cx={60} cy={49} r={8} fill={PINK} />
              <Circle cx={140} cy={49} r={8} fill={PINK} />
              <Ellipse cx={100} cy={91} rx={45} ry={42} fill={look.fur} />
              <Path d="M92 52 Q100 40 108 52 Q100 58 92 52 Z" fill={look.mane} />
            </G>
          )}
          <Ellipse cx={100} cy={106} rx={23} ry={16.5} fill={CREAM} />
          <Circle cx={69} cy={103} r={8.5} fill={look.blush} opacity={0.5} />
          <Circle cx={131} cy={103} r={8.5} fill={look.blush} opacity={0.5} />
          <Path d="M92 95 Q100 90.5 108 95 Q105 102.5 100 103.5 Q95 102.5 92 95 Z" fill={INK} />
          <Mouth face={face} />
        </Layer>
        <Animated.View style={[fillBox, { transformOrigin: '50% 42.5%' }, eyesStyle]}>
          <Layer size={size}>
            <Eyes kind={eyes} lashes={lioness} />
          </Layer>
        </Animated.View>
      </Animated.View>

      {/* Laith's ABC book: carried everywhere, put down only to cheer. Mirrored back so it still reads when he is flipped. */}
      {lioness || shown === 'cheer' ? null : (
        <Animated.View style={[fillBox, { transformOrigin: '50% 82%' }, bookStyle]}>
          <View style={[fillBox, flip ? { transform: [{ scaleX: -1 }] } : null]}>
            <Layer size={size}>
              <Rect x={78} y={148} width={44} height={31} rx={5} fill="#2E9BC4" />
              <Rect x={78} y={148} width={7} height={31} rx={3} fill="#1F789B" />
              <Rect x={85} y={173} width={34} height={3.5} rx={1.5} fill="#EAF6FB" />
              <SvgText x={102.5} y={167} fontSize={13} fontWeight="700" fill="#FFFFFF" textAnchor="middle">
                ABC
              </SvgText>
            </Layer>
          </View>
        </Animated.View>
      )}

      {/* arms sit in front of the head so a raised paw stays visible */}
      <Animated.View style={[fillBox, { transformOrigin: '36% 71%' }, otherArmStyle]}>
        <Layer size={size}>
          <Ellipse cx={71} cy={160} rx={9.5} ry={19.5} fill={look.fur} transform="rotate(22 71 160)" />
          <Ellipse cx={77} cy={174} rx={8} ry={6.5} fill={look.furDark} />
        </Layer>
      </Animated.View>
      <Animated.View style={[fillBox, { transformOrigin: '64% 71%' }, armStyle]}>
        <Layer size={size}>
          <Ellipse cx={129} cy={160} rx={9.5} ry={19.5} fill={look.fur} transform="rotate(-22 129 160)" />
          <Ellipse cx={123} cy={174} rx={8} ry={6.5} fill={look.furDark} />
        </Layer>
      </Animated.View>
    </Animated.View>
  );

  if (!interactive) return <View style={style}>{art}</View>;
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={lioness ? 'اللبؤة' : 'ليث'}
      style={style}
      onPressIn={() => {
        squash.value = withTiming(1, { duration: 80 });
      }}
      onPressOut={() => {
        squash.value = withSpring(0, { damping: 5, stiffness: 240, mass: 0.6 });
      }}
      onPress={(e: GestureResponderEvent) => react(zoneOfPress(e, size, flip, lioness))}>
      {/* the layers take no touches themselves, so a touch is always measured against the whole character */}
      <View pointerEvents="none">{art}</View>
    </Pressable>
  );
}

/* ---------- the component screens use ---------- */
/** Laith or the lioness, drawn by Rive where it is available and by the SVG engine otherwise. */
export function Laith(props: Props) {
  const [failed, setFailed] = useState(false);
  if (!RIVE_AVAILABLE || failed) return <LaithSvg {...props} />;
  return <LaithOnRive {...props} onFail={() => setFailed(true)} />;
}

function LaithOnRive({ mood = 'idle', size = 120, who = 'laith', flip, style, onZone, interactive = true, onFail }: Props & { onFail: () => void }) {
  const fire = useRef<((zone: Zone) => void) | null>(null);
  const [ready, setReady] = useState(false);
  const body = (
    <View style={{ width: size, height: size }}>
      {/* the drawn version holds the place for the instant the Rive file takes to load */}
      {ready ? null : <LaithSvg mood={mood} size={size} who={who} flip={flip} interactive={false} />}
      <View style={[fillBox, { opacity: ready ? 1 : 0 }]}>
        <LaithRive mood={mood} size={size} who={who} flip={flip} fire={fire} onReady={() => setReady(true)} onFail={onFail} />
      </View>
    </View>
  );
  if (!interactive) return <View style={style}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={who === 'lioness' ? 'اللبؤة' : 'ليث'}
      style={style}
      onPress={(e: GestureResponderEvent) => {
        const zone = zoneOfPress(e, size, flip, who === 'lioness');
        haptic[zone === 'tail' ? 'press' : zone === 'book' ? 'tap' : 'soft']();
        fire.current?.(zone);
        onZone?.(zone);
      }}>
      <View pointerEvents="none">{body}</View>
    </Pressable>
  );
}

/* ---------- Laith with something to say ---------- */
const PAT = ['هههه، هذا يدغدغ!', 'أحب التعلّم معك.', 'أنت تتقدّم، استمر!', 'لا تخف من الخطأ.'];
const TAIL = ['هاي! هذا ذيلي!', 'أوه! فاجأتني.'];
const BOOK = ['كتابي المفضّل: ABC', 'جملة جديدة كل يوم.', 'قلها بصوت عالٍ!', 'سجّل صوتك وقارن.'];
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
/** What he says back when touched somewhere. */
export const laithLine = (zone: Zone) => pick(zone === 'head' ? PAT : zone === 'tail' ? TAIL : BOOK);

/** A small speech bubble in Laith's colours. */
export function Bubble({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: C.white, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: 'rgba(217,129,42,0.35)' }, shadow(1), style]}>
      <T size={15} w="medium" style={{ lineHeight: 23 }}>
        {children}
      </T>
    </View>
  );
}

/** Laith beside a speech bubble. Touching him swaps the bubble for his reaction. */
export function LaithSays({ text, mood = 'idle', size = 96 }: { text: string; mood?: Mood; size?: number }) {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => setLine(null), [text]);
  return (
    <View style={{ flexDirection: ROW, alignItems: 'center', gap: 4 }}>
      <Laith mood={mood} size={size} onZone={(zone) => setLine(laithLine(zone))} />
      <Bubble style={{ flex: 1 }}>{line ?? text}</Bubble>
    </View>
  );
}
