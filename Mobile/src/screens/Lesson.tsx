import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LESSONS, UNITS, normal, tokens } from '../data/course';
import { NOUN, count } from '../lib/ar';
import { sfx, speak, stopAudio } from '../lib/audio';
import { KIND_LABEL, Step, again, judgeTiles, judgeTyped, lessonSession, reviewSession, tile } from '../lib/engine';
import { haptic } from '../lib/haptics';
import { LessonResult, useStore } from '../state/store';
import { C, ROW, ROW_EN } from '../theme';
import { Card, Glass } from '../ui/Glass';
import { Laith } from '../ui/Laith';
import { Bar, Btn, E, Icon, IconBtn, SpeakBtn, T } from '../ui/kit';
import { Background, Confetti, Pop, Sheet, styles } from '../ui/parts';
import { Answer, Arrange, Fill, LearnCard, Listen, Match, Meaning, Phase, Typing } from './exercises';

export type Session = { type: 'lesson'; lessonId: number } | { type: 'review'; ids: string[]; title?: string };

const PRAISE = ['ممتاز!', 'أحسنت!', 'إجابة صحيحة!', 'رائع، استمر!', 'بالضبط!'];
const AUDIO_KINDS = ['learn', 'meaning', 'listen', 'dictation'];

export function LessonScreen({ session, onExit }: { session: Session; onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const { s, completeLesson, completeReview } = useStore();
  const lesson = session.type === 'lesson' ? LESSONS[session.lessonId] : null;
  const accent = lesson ? UNITS[lesson.unit].color : C.blue;
  const accentDark = lesson ? UNITS[lesson.unit].dark : '#1F789B';

  const [steps, setSteps] = useState<Step[]>(() =>
    session.type === 'lesson' ? lessonSession(LESSONS[session.lessonId], s.settings.typing) : reviewSession(session.ids, s.settings.typing)
  );
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<Answer>(null);
  const [phase, setPhase] = useState<Phase>('answering');
  const [typo, setTypo] = useState(false);
  const [combo, setCombo] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [result, setResult] = useState<LessonResult | null>(null);

  const mistakes = useRef(0);
  const graded = useRef(0);
  const results = useRef<Record<string, boolean>>({});
  const retries = useRef<Record<string, number>>({});
  const startedAt = useRef(Date.now());
  const praise = useRef(PRAISE[0]);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const step = steps[i];
  const p = step.kind === 'match' ? null : step.p;

  // Say each new sentence once when its step appears.
  useEffect(() => {
    if (result || !p || !s.settings.autoplay || !AUDIO_KINDS.includes(step.kind)) return;
    const t = setTimeout(() => speak(p.id), 420);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, result]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (result) onExit();
      else setLeaving(true);
      return true;
    });
    return () => sub.remove();
  }, [result, onExit]);
  useEffect(() => () => stopAudio(), []);

  const resolve = (ok: boolean, ids: string[], opts: { requeue?: boolean; typo?: boolean } = {}) => {
    graded.current += 1;
    setTypo(!!opts.typo);
    if (ok) {
      praise.current = PRAISE[Math.floor(Math.random() * PRAISE.length)];
      ids.forEach((id) => (results.current[id] ??= true));
      setCombo((c) => c + 1);
      haptic.success();
      sfx('correct');
    } else {
      mistakes.current += 1;
      ids.forEach((id) => (results.current[id] = false));
      setCombo(0);
      haptic.error();
      sfx('wrong');
      // a missed step comes back at the end, with fresh options, at most twice
      const key = `${step.kind}:${ids.join()}`;
      const count = retries.current[key] ?? 0;
      if (opts.requeue !== false && count < 2) {
        retries.current[key] = count + 1;
        setSteps((cur) => [...cur, again(step)]);
      }
    }
    setPhase(ok ? 'correct' : 'wrong');
  };

  const check = () => {
    if (phase !== 'answering' || answer == null || !p) return;
    stopAudio();
    switch (step.kind) {
      case 'meaning':
      case 'listen':
        return resolve(answer === p.id, [p.id]);
      case 'arrange':
        return resolve(judgeTiles(answer as string[], p.en), [p.id]);
      case 'fill':
        return resolve(normal(answer as string) === normal(tile(tokens(p.en)[step.blank])), [p.id]);
      case 'type':
      case 'dictation': {
        const verdict = judgeTyped(answer as string, p.en);
        return resolve(verdict !== 'wrong', [p.id], { typo: verdict === 'typo' });
      }
    }
  };

  const next = () => {
    stopAudio();
    if (i + 1 < steps.length) {
      setI(i + 1);
      setAnswer(null);
      setPhase('answering');
      setTypo(false);
      scroll.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    const outcome = session.type === 'lesson' ? completeLesson(session.lessonId, mistakes.current, results.current) : completeReview(results.current);
    sfx('complete');
    haptic.success();
    setResult(outcome);
  };

  if (result) {
    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    const accuracy = graded.current ? Math.round(((graded.current - mistakes.current) / graded.current) * 100) : 100;
    return <Complete result={result} seconds={seconds} accuracy={accuracy} accent={accent} accentDark={accentDark} isLesson={!!lesson} title={lesson ? lesson.title : (session.type === 'review' && session.title) || 'مراجعة ذكية'} onExit={onExit} />;
  }

  const common = { phase, answer, onAnswer: (a: Answer) => phase === 'answering' && setAnswer(a), accent };
  const footerH = 86 + Math.max(insets.bottom, 12);

  return (
    <View style={{ flex: 1 }}>
      <Background tint={accent} />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* header: close, progress, combo */}
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 10, flexDirection: ROW, alignItems: 'center', gap: 12 }}>
          <IconBtn icon="close" size={40} color={C.sub} onPress={() => setLeaving(true)} label="إغلاق الدرس" />
          <View style={{ flex: 1 }}>
            <Bar value={i / steps.length} color={accent} height={16} />
          </View>
          <View style={{ minWidth: 44, flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            {combo >= 2 ? (
              <Animated.View key={combo} entering={ZoomIn.duration(220)} style={{ flexDirection: ROW, alignItems: 'center' }}>
                <Icon name="fire" size={22} color="#F0802F" />
                <E size={16} bold color="#F0802F">
                  {combo}
                </E>
              </Animated.View>
            ) : (
              <E size={13} color={C.mute} bold>
                {i + 1}/{steps.length}
              </E>
            )}
          </View>
        </View>

        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: footerH + 150 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View key={i} entering={FadeInDown.duration(280)} style={{ gap: 16 }}>
            <T size={23} w="black">
              {KIND_LABEL[step.kind]}
            </T>
            {step.kind === 'learn' ? <LearnCard p={step.p} accent={accent} /> : null}
            {step.kind === 'meaning' ? <Meaning step={step} {...common} /> : null}
            {step.kind === 'listen' ? <Listen step={step} {...common} /> : null}
            {step.kind === 'arrange' ? <Arrange step={step} {...common} /> : null}
            {step.kind === 'fill' ? <Fill step={step} {...common} /> : null}
            {step.kind === 'match' ? (
              <Match
                step={step}
                onDone={(wrong) =>
                  resolve(
                    wrong === 0,
                    step.pairs.map((x) => x.id),
                    { requeue: false }
                  )
                }
              />
            ) : null}
            {step.kind === 'type' || step.kind === 'dictation' ? <Typing step={step} {...common} onSubmit={check} /> : null}
          </Animated.View>
        </ScrollView>

        {/* footer: one primary action, replaced by the verdict panel after checking */}
        {phase === 'answering' ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingBottom: Math.max(insets.bottom, 12) + 8, paddingTop: 10 }}>
            {step.kind === 'learn' ? (
              <Btn title="فهمت، التالي" icon="arrow-left" color={accent} dark={accentDark} onPress={next} height={58} size={18} />
            ) : step.kind === 'match' ? null : (
              <Btn title="تحقّق" disabled={answer == null} onPress={check} height={58} size={18} />
            )}
          </View>
        ) : (
          <Animated.View entering={SlideInDown.springify().damping(20).stiffness(220)} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            <View style={{ position: 'absolute', left: 14, top: -70, zIndex: 2 }}>
              <Laith size={92} mood={phase === 'correct' ? 'happy' : 'sad'} />
            </View>
            <Glass radius={30} tint={phase === 'correct' ? C.green : C.red} intensity={85} depth={3} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingHorizontal: 20, paddingTop: 18, paddingBottom: Math.max(insets.bottom, 12) + 10, gap: 12 }}>
              <View style={{ flexDirection: ROW, alignItems: 'center', gap: 12 }}>
                <Pop>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: phase === 'correct' ? C.green : C.red, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={phase === 'correct' ? 'check-bold' : 'close-thick'} size={24} color={C.white} />
                  </View>
                </Pop>
                <View style={{ flex: 1 }}>
                  <T size={20} w="black" color={phase === 'correct' ? '#1F6B33' : '#96311F'}>
                    {phase === 'correct' ? (typo ? 'صحيح، مع خطأ إملائي بسيط' : praise.current) : step.kind === 'match' ? 'اكتملت المطابقة بعد محاولات' : 'ليست هذه الإجابة'}
                  </T>
                  {combo >= 3 && phase === 'correct' ? (
                    <T size={13} color="#C5661F" w="bold">
                      {combo} إجابات صحيحة متتالية
                    </T>
                  ) : null}
                </View>
              </View>
              {p && (phase === 'wrong' || typo || step.kind === 'listen' || step.kind === 'dictation') ? (
                <View style={{ flexDirection: ROW_EN, alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: 12 }}>
                  <SpeakBtn clip={p.id} text={p.en} size={40} color={phase === 'correct' ? C.green : C.red} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <E size={16} bold>
                      {p.en}
                    </E>
                    <T size={14} color={C.sub} style={{ lineHeight: 21 }}>
                      {p.ar}
                    </T>
                  </View>
                </View>
              ) : null}
              <Btn title="متابعة" color={phase === 'correct' ? C.green : C.red} dark={phase === 'correct' ? C.greenDark : C.redDark} onPress={next} height={56} size={18} />
            </Glass>
          </Animated.View>
        )}
      </KeyboardAvoidingView>

      <Sheet visible={leaving} onClose={() => setLeaving(false)} scroll={false}>
        <View style={{ gap: 12, paddingTop: 6 }}>
          <T size={21} w="black" center>
            هل تريد إنهاء التدريب الآن؟
          </T>
          <T size={15} color={C.sub} center>
            لن يُحفظ تقدّم هذه المحاولة، وتبقى دروسك المكتملة وتسجيلاتك كما هي.
          </T>
          <Btn title="أكمل التدريب" onPress={() => setLeaving(false)} />
          <Btn
            title="إنهاء والخروج"
            color="rgba(255,255,255,0.9)"
            dark="rgba(29,50,41,0.18)"
            text={C.redDark}
            onPress={() => {
              setLeaving(false);
              stopAudio();
              onExit();
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

/* ---------- completion ---------- */
function Stat({ icon, color, value, label, delay }: { icon: string; color: string; value: string; label: string; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(320)} style={{ flex: 1 }}>
      <Card radius={22} depth={2} style={{ alignItems: 'center', paddingVertical: 14, gap: 2, borderColor: color + '55', borderWidth: 1.5 }}>
        <Icon name={icon} size={24} color={color} />
        <E size={22} bold color={color} center>
          {value}
        </E>
        <T size={12.5} color={C.sub} center style={{ lineHeight: 17 }}>
          {label}
        </T>
      </Card>
    </Animated.View>
  );
}

export function Complete({
  result,
  seconds,
  accuracy,
  accent,
  accentDark,
  isLesson,
  title,
  onExit,
  heading,
  note,
  partner = isLesson,
}: {
  result: LessonResult;
  seconds: number;
  accuracy: number;
  accent: string;
  accentDark: string;
  isLesson: boolean;
  title: string;
  onExit: () => void;
  heading?: string;
  note?: string;
  /** The lioness comes out to celebrate with Laith when a stage of the trail is finished. */
  partner?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const perfect = accuracy === 100;
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const stars = useMemo(() => [0, 1, 2], []);
  return (
    <View style={{ flex: 1 }}>
      <Background tint={accent} />
      <View style={[styles.screen, { paddingTop: insets.top + 24, paddingHorizontal: 22, paddingBottom: Math.max(insets.bottom, 14) + 8 }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }}>
            {partner ? (
              <Animated.View entering={ZoomIn.delay(650).springify().damping(11)} style={{ marginRight: -26 }}>
                <Laith who="lioness" size={150} mood="cheer" flip />
              </Animated.View>
            ) : null}
            <Pop>
              <Laith size={176} mood="cheer" />
            </Pop>
          </View>
          {isLesson ? (
            <View style={{ flexDirection: ROW_EN, gap: 6 }}>
              {stars.map((n) => (
                <Pop key={n} delay={350 + n * 160}>
                  <Icon name="star" size={n === 1 ? 44 : 36} color={n < result.stars ? C.gold : 'rgba(29,50,41,0.14)'} style={{ marginTop: n === 1 ? 0 : 10 }} />
                </Pop>
              ))}
            </View>
          ) : null}
          <Animated.View entering={FadeIn.delay(200)} style={{ alignItems: 'center', gap: 2 }}>
            <T size={30} w="black" center>
              {heading ?? (perfect ? 'أداء مثالي!' : 'أحسنت، أنجزت التدريب!')}
            </T>
            <T size={16} color={C.sub} center>
              {title}
            </T>
          </Animated.View>
          <View style={{ flexDirection: ROW, gap: 10, alignSelf: 'stretch', marginTop: 8 }}>
            <Stat icon="star-four-points" color={C.goldDark} value={`‎+${result.xp}`} label="نقطة خبرة" delay={420} />
            <Stat icon="bullseye-arrow" color={C.green} value={`${accuracy}%`} label="الدقة" delay={520} />
            <Stat icon="timer-outline" color={C.blue} value={time} label="الوقت" delay={620} />
          </View>
          <Animated.View entering={FadeInDown.delay(760)} style={{ alignSelf: 'stretch' }}>
            <Card radius={20} style={{ padding: 14, flexDirection: ROW, alignItems: 'center', gap: 12 }}>
              <Icon name="fire" size={28} color="#F0802F" />
              <T size={15} w="medium" style={{ flex: 1 }}>
                {note ?? (result.streak > 1 ? `سلسلتك الآن ${count(result.streak, NOUN.day)} على التوالي. عُد غدًا لتحافظ عليها.` : 'بدأت سلسلة جديدة اليوم. عُد غدًا لتصبح يومين.')}
              </T>
            </Card>
          </Animated.View>
        </View>
        <Btn title="متابعة" color={accent} dark={accentDark} onPress={onExit} height={58} size={18} />
      </View>
      <Confetti />
    </View>
  );
}
