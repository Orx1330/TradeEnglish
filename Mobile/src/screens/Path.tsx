import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { I18nManager, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path as SvgPath } from 'react-native-svg';

import { LESSONS, LESSONS_PER_UNIT, Lesson, UNITS, Unit, unitLessons } from '../data/course';
import { sfx } from '../lib/audio';
import { haptic } from '../lib/haptics';
import { State, caseUnlocked, currentLesson, isDone, isUnlocked, streak, todayXp, unitDoneCount, useStore } from '../state/store';
import { C, MAX_W, ROW, ROW_EN, shadow } from '../theme';
import { Card, Glass } from '../ui/Glass';
import { Bar, Bob, Btn, E, Icon, Ring, SpeakBtn, T, Tap } from '../ui/kit';
import { Sheet } from '../ui/parts';

const NODE = 76;
const ROW_H = 122;
const HEADER_H = 150;
const UNIT_GAP = 26;
/** Room above the first stop of a unit for its floating "start" bubble. */
const TRAIL_TOP = 34;
const NODES_PER_UNIT = LESSONS_PER_UNIT + 1; // six lessons and the deal lab
const UNIT_H = HEADER_H + TRAIL_TOP + NODES_PER_UNIT * ROW_H + UNIT_GAP;
/** Horizontal sway of the trail; one continuous wave across all units. */
const sway = (k: number) => Math.sin(k * 0.86) * 78;

type NodeState = 'locked' | 'open' | 'current' | 'done';

/* ---------- a stop on the trail ---------- */
function TrailNode({
  icon,
  state,
  color,
  dark,
  stars,
  square,
  onPress,
}: {
  icon: string;
  state: NodeState;
  color: string;
  dark: string;
  stars?: number;
  square?: boolean;
  onPress: () => void;
}) {
  const DEPTH = 7;
  const pressed = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (state === 'current') pulse.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false);
  }, [state, pulse]);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: pressed.value * DEPTH }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.4 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.5 }] }));
  const locked = state === 'locked';
  const faceColor = locked ? C.lock : color;
  const baseColor = locked ? C.lockDark : dark;
  const radius = square ? 26 : NODE / 2;
  return (
    <Pressable
      accessibilityRole="button"
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 70 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, { damping: 9, stiffness: 300, mass: 0.6 });
      }}
      onPress={() => {
        haptic.press();
        sfx('tap');
        onPress();
      }}>
      <View style={{ width: NODE, height: NODE + DEPTH }}>
        {state === 'current' ? <Animated.View style={[{ position: 'absolute', top: 0, width: NODE, height: NODE, borderRadius: radius, backgroundColor: color }, halo]} /> : null}
        <View style={{ position: 'absolute', top: DEPTH, width: NODE, height: NODE, borderRadius: radius, backgroundColor: baseColor }} />
        <Animated.View style={[{ width: NODE, height: NODE, borderRadius: radius, backgroundColor: faceColor, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: state === 'current' ? 4 : 0, borderColor: 'rgba(255,255,255,0.85)' }, face]}>
          <LinearGradient colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '52%' }} />
          <Icon name={locked ? 'lock' : icon} size={locked ? 28 : 34} color={locked ? '#8D9790' : C.white} />
        </Animated.View>
        {state === 'done' && stars != null ? (
          <View pointerEvents="none" style={{ position: 'absolute', bottom: -7, left: 0, right: 0, alignItems: 'center' }}>
            <View style={[{ flexDirection: ROW_EN, alignItems: 'center', height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: C.white }, shadow(1)]}>
              {[0, 1, 2].map((n) => (
                <Icon key={n} name="star" size={13} color={n < stars ? C.gold : 'rgba(29,50,41,0.16)'} />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/* ---------- unit banner ---------- */
function UnitHeader({ unit, done }: { unit: Unit; done: number }) {
  return (
    <View style={{ height: HEADER_H, paddingHorizontal: 16, justifyContent: 'center' }}>
      <View style={[{ borderRadius: 28 }, shadow(2)]}>
        <LinearGradient colors={[unit.color, unit.dark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 28, padding: 16, overflow: 'hidden' }}>
          <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%' }} />
          <View style={{ position: 'absolute', left: -18, bottom: -26, opacity: 0.16 }}>
            <Icon name={unit.icon} size={130} color={C.white} />
          </View>
          <View style={{ flexDirection: ROW, alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.24)', paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center' }}>
              <T size={12} w="bold" color={C.white} style={{ lineHeight: 17 }}>
                الوحدة {unit.id + 1}
              </T>
            </View>
            <E size={11} bold color="rgba(255,255,255,0.86)" style={{ letterSpacing: 1.1 }}>
              {unit.tag} · {unit.level}
            </E>
          </View>
          <T size={22} w="black" color={C.white} style={{ marginTop: 4 }}>
            {unit.title}
          </T>
          <T size={13.5} color="rgba(255,255,255,0.92)" numberOfLines={1}>
            {unit.goal}
          </T>
          <View style={{ flexDirection: ROW, alignItems: 'center', gap: 10, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Bar value={done / LESSONS_PER_UNIT} color={C.white} track="rgba(255,255,255,0.28)" height={8} />
            </View>
            <E size={12} bold color={C.white}>
              {done}/{LESSONS_PER_UNIT}
            </E>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

/* ---------- one unit: banner + winding trail ---------- */
const UnitTrail = React.memo(function UnitTrail({
  unit,
  s,
  width,
  current,
  onLesson,
  onCase,
}: {
  unit: Unit;
  s: State;
  width: number;
  current: number;
  onLesson: (l: Lesson) => void;
  onCase: (unit: number) => void;
}) {
  const lessons = unitLessons(unit.id);
  const first = unit.id * NODES_PER_UNIT;
  const centers = Array.from({ length: NODES_PER_UNIT }, (_, k) => ({ x: width / 2 + sway(first + k), y: TRAIL_TOP + k * ROW_H + ROW_H / 2 }));
  const states: NodeState[] = lessons.map((l) => (isDone(s, l.id) ? 'done' : l.id === current ? 'current' : isUnlocked(s, l.id) ? 'open' : 'locked'));
  const caseOpen = caseUnlocked(s, unit.id);
  const caseDone = s.cases.includes(unit.id);
  states.push(caseDone ? 'done' : caseOpen ? 'open' : 'locked');

  return (
    <View style={{ height: UNIT_H }}>
      <UnitHeader unit={unit} done={unitDoneCount(s, unit.id)} />
      <View style={{ height: TRAIL_TOP + NODES_PER_UNIT * ROW_H }}>
        <Svg width={width} height={TRAIL_TOP + NODES_PER_UNIT * ROW_H} style={{ position: 'absolute', transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }}>
          {centers.slice(0, -1).map((a, k) => {
            const b = centers[k + 1];
            const mid = (a.y + b.y) / 2;
            const reached = states[k + 1] !== 'locked';
            return (
              <SvgPath
                key={k}
                d={`M ${a.x} ${a.y} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`}
                stroke={reached ? unit.color : 'rgba(29,50,41,0.16)'}
                strokeOpacity={reached ? 0.55 : 1}
                strokeWidth={9}
                strokeLinecap="round"
                strokeDasharray="1 15"
                fill="none"
              />
            );
          })}
        </Svg>
        {centers.map((c, k) => {
          const lesson = lessons[k];
          const state = states[k];
          const onRight = c.x > width / 2;
          const labelWidth = (onRight ? c.x - NODE / 2 : width - c.x - NODE / 2) - 30;
          return (
            <React.Fragment key={k}>
              <View style={{ position: 'absolute', left: c.x - NODE / 2, top: c.y - NODE / 2 - 3 }}>
                <TrailNode
                  icon={lesson ? lesson.icon : 'forum'}
                  square={!lesson}
                  state={state}
                  color={!lesson && caseDone ? C.gold : unit.color}
                  dark={!lesson && caseDone ? C.goldDark : unit.dark}
                  stars={lesson ? s.done[lesson.id]?.stars : undefined}
                  onPress={() => (lesson ? onLesson(lesson) : onCase(unit.id))}
                />
              </View>
              {/* the title sits on the roomier side of the node */}
              <View pointerEvents="none" style={{ position: 'absolute', top: c.y - 24, height: 48, justifyContent: 'center', width: labelWidth, left: onRight ? 16 : c.x + NODE / 2 + 14 }}>
                <T size={14} w={state === 'current' ? 'bold' : 'medium'} color={state === 'locked' ? C.mute : C.ink} numberOfLines={2} style={{ textAlign: onRight ? 'right' : 'left', lineHeight: 21 }}>
                  {lesson ? lesson.title : 'مختبر الصفقات'}
                </T>
                {!lesson ? (
                  <T size={11.5} color={C.mute} style={{ textAlign: onRight ? 'right' : 'left', lineHeight: 16 }}>
                    حوار تفاوضي من 3 مواقف
                  </T>
                ) : null}
              </View>
              {state === 'current' ? (
                <Bob style={{ position: 'absolute', left: c.x - 44, top: c.y - NODE / 2 - 41, width: 88, alignItems: 'center' }}>
                  <View pointerEvents="none" style={[{ backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 14, height: 30, justifyContent: 'center', borderWidth: 1.5, borderColor: unit.color + '66' }, shadow(2)]}>
                    <T size={14} w="black" color={unit.dark} style={{ lineHeight: 20 }}>
                      ابدأ
                    </T>
                  </View>
                  <View pointerEvents="none" style={{ width: 12, height: 12, backgroundColor: C.white, transform: [{ rotate: '45deg' }], marginTop: -7, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: unit.color + '66' }} />
                </Bob>
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
});

/* ---------- lesson preview sheet ---------- */
function LessonPreview({ lesson, s, onStart }: { lesson: Lesson; s: State; onStart: () => void }) {
  const unit = UNITS[lesson.unit];
  const done = isDone(s, lesson.id);
  const open = isUnlocked(s, lesson.id);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: ROW, alignItems: 'center', gap: 14 }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: open ? unit.color : C.lock, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={open ? lesson.icon : 'lock'} size={30} color={C.white} />
        </View>
        <View style={{ flex: 1 }}>
          <T size={13} w="medium" color={unit.dark}>
            الوحدة {unit.id + 1} · الدرس {(lesson.id % LESSONS_PER_UNIT) + 1} · {unit.levelAr}
          </T>
          <T size={22} w="black">
            {lesson.title}
          </T>
        </View>
      </View>
      <T size={15.5} color={C.sub}>
        {lesson.goal}
      </T>

      {lesson.tip ? (
        <View style={{ flexDirection: ROW, gap: 10, backgroundColor: C.goldSoft, borderRadius: 18, padding: 12 }}>
          <Icon name="lightbulb-on-outline" size={22} color={C.goldDark} />
          <T size={14} style={{ flex: 1, lineHeight: 22 }}>
            {lesson.tip}
          </T>
        </View>
      ) : null}

      {lesson.keywords?.length ? (
        <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8 }}>
          {lesson.keywords.map((k) => (
            <View key={k.en} style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.hairline, alignItems: 'center' }}>
              <E size={14} bold color={unit.dark} center>
                {k.en}
              </E>
              <T size={12.5} color={C.sub} center style={{ lineHeight: 18 }}>
                {k.ar}
              </T>
            </View>
          ))}
        </View>
      ) : null}

      <Btn
        title={!open ? 'الدرس مقفل' : done ? 'تدرّب من جديد · 10 نقاط' : 'ابدأ الدرس · 60 نقطة'}
        icon={open ? 'play' : 'lock'}
        disabled={!open}
        color={unit.color}
        dark={unit.dark}
        onPress={onStart}
        height={58}
        size={17}
      />

      {open ? (
        <T size={14} w="bold" color={C.sub}>
          جمل هذا الدرس
        </T>
      ) : null}
      {open ? (
        <View style={{ borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: C.hairline, paddingHorizontal: 12 }}>
          {lesson.phrases.map((p, i) => (
            <View key={p.id} style={{ flexDirection: ROW_EN, alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
              <SpeakBtn clip={p.id} text={p.en} size={34} color={unit.color} />
              <View style={{ flex: 1 }}>
                <E size={14.5} bold>
                  {p.en}
                </E>
                <T size={13} color={C.sub} style={{ lineHeight: 19 }}>
                  {p.ar}
                </T>
              </View>
              {s.recordings[p.id] ? <Icon name="microphone" size={16} color={C.red} /> : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: 10, backgroundColor: 'rgba(29,50,41,0.06)', borderRadius: 18, padding: 14 }}>
          <Icon name="lock-outline" size={22} color={C.sub} />
          <T size={14.5} color={C.sub} style={{ flex: 1 }}>
            أكمل «{LESSONS[lesson.id - 1]?.title}» أولًا لفتح هذا الدرس.
          </T>
        </View>
      )}

    </View>
  );
}

/* ---------- floating status bar ---------- */
function Stat({ icon, color, value }: { icon: string; color: string; value: number }) {
  return (
    <View style={{ flexDirection: ROW_EN, alignItems: 'center', gap: 3 }}>
      <Icon name={icon} size={21} color={color} />
      <E size={16} bold color={C.ink}>
        {value}
      </E>
    </View>
  );
}

export function PathScreen({ onStartLesson, onStartCase }: { onStartLesson: (lessonId: number) => void; onStartCase: (unit: number) => void }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const width = Math.min(winW, MAX_W);
  const { s } = useStore();
  const [preview, setPreview] = useState<Lesson | null>(null);
  const [lockedCase, setLockedCase] = useState<number | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const current = currentLesson(s);
  const top = insets.top + 78;
  const goal = s.settings.goal;
  const today = todayXp(s);

  // Open on the learner's current stop instead of the top of the course.
  const jump = (animated: boolean) => {
    const lesson = LESSONS[current];
    const y = lesson.unit * UNIT_H + HEADER_H + TRAIL_TOP + (current % LESSONS_PER_UNIT) * ROW_H - winH * 0.3;
    scroll.current?.scrollTo({ y: Math.max(0, y), animated });
  };
  useEffect(() => {
    const t = setTimeout(() => jump(false), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const units = useMemo(() => UNITS, []);
  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: top, paddingBottom: insets.bottom + 130 }}>
        {units.map((u) => (
          <UnitTrail key={u.id} unit={u} s={s} width={width} current={current} onLesson={setPreview} onCase={(unit) => (caseUnlocked(s, unit) ? onStartCase(unit) : setLockedCase(unit))} />
        ))}
        <View style={{ alignItems: 'center', gap: 6, paddingTop: 4 }}>
          <Icon name="flag-checkered" size={34} color={C.mute} />
          <T size={14} color={C.mute} center>
            نهاية المسار الحالي · 48 درسًا و8 مختبرات
          </T>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', top: insets.top + 8, left: 14, right: 14 }}>
        <Glass radius={26} interactive style={{ height: 58, paddingHorizontal: 14, flexDirection: ROW, alignItems: 'center', gap: 12 }}>
          <Tap onPress={() => jump(true)} scale={0.9} label="اذهب إلى درسي الحالي">
            <Ring value={Math.min(1, today / goal)} size={40} stroke={4.5} color={today >= goal ? C.gold : C.green}>
              <Icon name={today >= goal ? 'check-bold' : 'lightning-bolt'} size={19} color={today >= goal ? C.goldDark : C.green} />
            </Ring>
          </Tap>
          <View style={{ flex: 1 }}>
            <T size={15} w="bold" numberOfLines={1} style={{ lineHeight: 21 }}>
              {s.name ? `مرحبًا، ${s.name}` : 'رحلة التاجر'}
            </T>
            <T size={12} color={C.sub} numberOfLines={1} style={{ lineHeight: 17 }}>
              {today >= goal ? 'أتممت هدف اليوم' : `هدف اليوم ${today} / ${goal} نقطة`}
            </T>
          </View>
          <Stat icon="fire" color="#F0802F" value={streak(s)} />
          <Stat icon="star-four-points" color={C.goldDark} value={s.xp} />
        </Glass>
      </View>

      <Sheet visible={!!preview} onClose={() => setPreview(null)} tint={preview ? UNITS[preview.unit].color : undefined}>
        {preview ? (
          <LessonPreview
            lesson={preview}
            s={s}
            onStart={() => {
              const id = preview.id;
              setPreview(null);
              sfx('start');
              setTimeout(() => onStartLesson(id), 180);
            }}
          />
        ) : null}
      </Sheet>

      <Sheet visible={lockedCase != null} onClose={() => setLockedCase(null)} scroll={false}>
        <View style={{ gap: 12, alignItems: 'center', paddingTop: 4 }}>
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: C.lock, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="forum" size={32} color={C.white} />
          </View>
          <T size={21} w="black" center>
            مختبر الصفقات مقفل
          </T>
          <T size={15} color={C.sub} center>
            أكمل دروس الوحدة الستة أولًا، ثم جرّب ما تعلّمته في حوار تفاوضي مع مورد.
          </T>
          <Btn title="حسنًا" onPress={() => setLockedCase(null)} style={{ alignSelf: 'stretch' }} />
        </View>
      </Sheet>
    </View>
  );
}

export { Card };
