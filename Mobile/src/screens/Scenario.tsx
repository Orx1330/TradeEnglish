import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UNITS, unitScenarios } from '../data/course';
import { sfx, speak, stopAudio } from '../lib/audio';
import { shuffle } from '../lib/engine';
import { haptic } from '../lib/haptics';
import { LessonResult, useStore } from '../state/store';
import { C, ROW, ROW_EN } from '../theme';
import { Card, Glass } from '../ui/Glass';
import { Bar, Btn, E, Icon, IconBtn, SpeakBtn, T, Tap } from '../ui/kit';
import { Background, Pop, styles, useShake } from '../ui/parts';
import { Complete } from './Lesson';

/**
 * Deal lab: three short negotiation moments with a supplier. The learner reads the situation,
 * hears the supplier, and picks the reply that serves their goal. A wrong pick is a nudge to
 * think again, not a failure — the point is the reasoning shown after the right one.
 */
export function ScenarioScreen({ unit, onExit }: { unit: number; onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const { s, completeCase } = useStore();
  const u = UNITS[unit];
  const cases = useMemo(() => unitScenarios(unit), [unit]);
  const [i, setI] = useState(0);
  const [solved, setSolved] = useState(false);
  const [tried, setTried] = useState<number[]>([]);
  const [shakeN, setShakeN] = useState(0);
  const [result, setResult] = useState<LessonResult | null>(null);
  const slips = useRef(0);
  const startedAt = useRef(Date.now());
  const item = cases[i];
  const order = useMemo(() => shuffle([0, 1, 2]), [i]);
  const shake = useShake(shakeN);

  useEffect(() => {
    if (result || !s.settings.autoplay) return;
    const t = setTimeout(() => speak(item.id), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, result]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      stopAudio();
      onExit();
      return true;
    });
    return () => {
      sub.remove();
      stopAudio();
    };
  }, [onExit]);

  if (result) {
    const total = cases.length + slips.current;
    return (
      <Complete
        result={result}
        seconds={Math.round((Date.now() - startedAt.current) / 1000)}
        accuracy={Math.round((cases.length / total) * 100)}
        accent={u.color}
        accentDark={u.dark}
        isLesson={false}
        partner
        heading="صفقة موفّقة!"
        title={`مختبر الصفقات · ${u.title}`}
        note="جرّب الآن قول الردود الثلاثة بصوتك دون النظر إليها."
        onExit={onExit}
      />
    );
  }

  const pick = (choice: number) => {
    if (solved) return;
    if (choice === item.correct) {
      setSolved(true);
      haptic.success();
      sfx('correct');
    } else {
      slips.current += 1;
      setTried((t) => [...t, choice]);
      setShakeN((n) => n + 1);
      haptic.error();
      sfx('wrong');
    }
  };

  const next = () => {
    stopAudio();
    if (i + 1 < cases.length) {
      setI(i + 1);
      setSolved(false);
      setTried([]);
    } else {
      sfx('complete');
      setResult(completeCase(unit));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Background tint={u.color} />
      <View style={styles.screen}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 10, flexDirection: ROW, alignItems: 'center', gap: 12 }}>
          <IconBtn
            icon="close"
            size={40}
            color={C.sub}
            onPress={() => {
              stopAudio();
              onExit();
            }}
            label="إغلاق"
          />
          <View style={{ flex: 1 }}>
            <Bar value={(i + (solved ? 1 : 0)) / cases.length} color={u.color} height={16} />
          </View>
          <E size={13} bold color={C.mute}>
            {i + 1}/{cases.length}
          </E>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 260, gap: 14 }} showsVerticalScrollIndicator={false}>
          <Animated.View key={i} entering={FadeInDown.duration(300)} style={{ gap: 14 }}>
            <View style={{ flexDirection: ROW, alignItems: 'center', gap: 8 }}>
              <Icon name="forum" size={22} color={u.dark} />
              <T size={22} w="black">
                مختبر الصفقات
              </T>
            </View>

            <Card radius={22} color={C.goldSoft} style={{ padding: 14, flexDirection: ROW, gap: 10 }}>
              <Icon name="target" size={22} color={C.goldDark} />
              <T size={16} w="medium" style={{ flex: 1 }}>
                {item.context}
              </T>
            </Card>

            {/* the supplier speaks: a chat bubble on the left, English side */}
            <View style={{ flexDirection: ROW_EN, alignItems: 'flex-end', gap: 10 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: u.color, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="account-tie" size={26} color={C.white} />
              </View>
              <Card radius={22} depth={2} style={{ flex: 1, padding: 14, gap: 8, borderBottomLeftRadius: 6 }}>
                <T size={12} w="bold" color={u.dark} style={{ textAlign: 'left' }}>
                  المورد
                </T>
                <E size={19} bold>
                  {item.supplier}
                </E>
                {solved && item.supplierAr ? (
                  <Animated.View entering={FadeIn}>
                    <T size={14} color={C.sub}>
                      {item.supplierAr}
                    </T>
                  </Animated.View>
                ) : null}
                <View style={{ flexDirection: ROW_EN, gap: 10 }}>
                  <SpeakBtn clip={item.id} text={item.supplier} size={40} color={u.color} />
                  <SpeakBtn clip={item.id} text={item.supplier} size={40} color={u.color} slow />
                </View>
              </Card>
            </View>

            <T size={17} w="bold">
              ما الرد الأنسب لتحقيق هدفك؟
            </T>
            <Animated.View style={[{ gap: 10 }, shake]}>
              {order.map((c, n) => {
                const right = solved && c === item.correct;
                const wrong = tried.includes(c);
                const dim = solved && !right;
                return (
                  <Animated.View key={c} entering={FadeIn.delay(120 + n * 70)}>
                    <Tap onPress={() => pick(c)} disabled={solved || wrong} scale={0.97} sound>
                      <View
                        style={{
                          borderRadius: 18,
                          padding: 14,
                          gap: 4,
                          backgroundColor: right ? C.greenSoft : wrong ? C.redSoft : 'rgba(255,255,255,0.85)',
                          borderWidth: 1.5,
                          borderBottomWidth: 4,
                          borderColor: right ? C.green : wrong ? C.red : 'rgba(29,50,41,0.12)',
                          borderBottomColor: right ? C.greenDark : wrong ? C.redDark : 'rgba(29,50,41,0.18)',
                          opacity: dim && !wrong ? 0.5 : 1,
                        }}>
                        <View style={{ flexDirection: ROW_EN, alignItems: 'center', gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <E size={16.5} color={right ? '#1F6B33' : wrong ? '#96311F' : C.ink}>
                              {item.choices[c]}
                            </E>
                          </View>
                          {right ? <Icon name="check-circle" size={22} color={C.green} /> : wrong ? <Icon name="close-circle" size={22} color={C.red} /> : null}
                        </View>
                        {(right || wrong) && item.choicesAr[c] ? (
                          <T size={13.5} color={C.sub} style={{ lineHeight: 20 }}>
                            {item.choicesAr[c]}
                          </T>
                        ) : null}
                      </View>
                    </Tap>
                  </Animated.View>
                );
              })}
            </Animated.View>
            {!solved && tried.length ? (
              <T size={14} color={C.redDark} center>
                فكّر في هدفك من هذا الموقف، ثم اختر ردًا يحققه.
              </T>
            ) : null}
          </Animated.View>
        </ScrollView>

        {solved ? (
          <Animated.View entering={SlideInDown.springify().damping(20).stiffness(220)} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            <Glass radius={30} tint={C.green} intensity={85} depth={3} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingHorizontal: 20, paddingTop: 18, paddingBottom: Math.max(insets.bottom, 12) + 10, gap: 12 }}>
              <View style={{ flexDirection: ROW, alignItems: 'flex-start', gap: 12 }}>
                <Pop>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="lightbulb-on" size={24} color={C.white} />
                  </View>
                </Pop>
                <View style={{ flex: 1 }}>
                  <T size={18} w="black" color="#1F6B33">
                    لماذا هذا الرد؟
                  </T>
                  <T size={15} style={{ lineHeight: 23 }}>
                    {item.why}
                  </T>
                </View>
              </View>
              <Btn title={i + 1 < cases.length ? 'الموقف التالي' : 'إنهاء المحاكاة'} onPress={next} height={56} size={18} />
            </Glass>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}
