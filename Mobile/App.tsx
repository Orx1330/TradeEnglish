import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { I18nManager, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown, SlideOutDown, ZoomIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LESSONS, UNITS } from './src/data/course';
import { initAudio } from './src/lib/audio';
import { cancelDaily, scheduleDaily } from './src/lib/reminders';
import { LessonScreen, Session } from './src/screens/Lesson';
import { PathScreen } from './src/screens/Path';
import { PhrasebookScreen } from './src/screens/Phrasebook';
import { ProfileScreen } from './src/screens/Profile';
import { ReviewScreen } from './src/screens/Review';
import { ScenarioScreen } from './src/screens/Scenario';
import { WelcomeScreen } from './src/screens/Welcome';
import { StoreProvider, currentLesson, dueIds, isDone, streak, useStore } from './src/state/store';
import { C, FONT_FILES, MAX_W, ROW } from './src/theme';
import { Glass } from './src/ui/Glass';
import { Bubble, Laith, laithLine } from './src/ui/Laith';
import { Icon, T, Tap, fill } from './src/ui/kit';
import { Background, styles } from './src/ui/parts';

// The layout is written Arabic-first by hand (see theme.ts), so the system must not mirror it again.
I18nManager.allowRTL(false);

type Tab = 'path' | 'review' | 'phrases' | 'me';
type Overlay = { kind: 'session'; session: Session; n: number } | { kind: 'case'; unit: number; n: number } | null;

const TABS: { id: Tab; label: string; icon: string; on: string }[] = [
  { id: 'path', label: 'المسار', icon: 'map-marker-path', on: 'map-marker-path' },
  { id: 'review', label: 'المراجعة', icon: 'cards-outline', on: 'cards' },
  { id: 'phrases', label: 'الجمل', icon: 'book-open-page-variant-outline', on: 'book-open-page-variant' },
  { id: 'me', label: 'أنا', icon: 'account-circle-outline', on: 'account-circle' },
];

function TabItem({ tab, active, badge, onPress }: { tab: (typeof TABS)[number]; active: boolean; badge?: number; onPress: () => void }) {
  const a = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    a.value = withSpring(active ? 1 : 0, { damping: 14, stiffness: 220, mass: 0.7 });
  }, [active, a]);
  const pill = useAnimatedStyle(() => ({ opacity: a.value, transform: [{ scale: 0.6 + a.value * 0.4 }] }));
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -a.value * 1.5 }, { scale: 1 + a.value * 0.08 }] }));
  return (
    <Tap onPress={onPress} scale={0.9} sound outer={{ flex: 1 }} label={tab.label} hitSlop={0}>
      <View style={{ height: 58, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ position: 'absolute', top: 5, bottom: 5, left: 4, right: 4, borderRadius: 22, backgroundColor: 'rgba(88,204,2,0.18)' }, pill]} />
        <Animated.View style={[{ alignItems: 'center' }, lift]}>
          <Icon name={active ? tab.on : tab.icon} size={25} color={active ? C.greenDark : C.sub} />
          <T size={11.5} w={active ? 'bold' : 'medium'} color={active ? C.greenDark : C.sub} center style={{ lineHeight: 16 }}>
            {tab.label}
          </T>
        </Animated.View>
        {badge ? (
          <View style={{ position: 'absolute', top: 6, right: '22%', minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: C.white }}>
            <T size={10} w="bold" color={C.white} center style={{ lineHeight: 14 }}>
              {badge > 99 ? '99+' : badge}
            </T>
          </View>
        ) : null}
      </View>
    </Tap>
  );
}

/**
 * Laith runs out to say hello each time the app opens: a greeting for the time of day, and what
 * the two of them are doing next. It leaves on its own after a moment, or at once on a tap.
 */
function Greeting({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { s } = useStore();
  const [reply, setReply] = useState<string | null>(null);
  const next = LESSONS[currentLesson(s)];
  const days = streak(s);
  const hello = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
  const plan = isDone(s, next.id) ? 'أنهينا كل الدروس! هيا نراجع ما تعلّمناه.' : Object.keys(s.done).length ? `درسنا التالي: «${next.title}». هيا نكمل!` : `سنبدأ بدرس «${next.title}». أنا متحمّس!`;

  // stay a little longer if he was touched, so the reaction can be read
  useEffect(() => {
    const t = setTimeout(onDone, reply ? 2600 : 3200);
    return () => clearTimeout(t);
  }, [reply, onDone]);

  return (
    <Animated.View exiting={FadeOut.duration(260)} style={[fill, { backgroundColor: C.bg }]}>
      <Background tint="#FFC800" />
      <Pressable style={[styles.screen, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingTop: insets.top, paddingBottom: insets.bottom }]} onPress={onDone} accessibilityLabel="متابعة">
        <Animated.View entering={FadeInDown.delay(520).duration(320)} style={{ alignSelf: 'stretch', marginBottom: 6 }}>
          <Bubble style={{ alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 24 }}>{reply ?? `${hello}${s.name ? `، ${s.name}` : ''}! ${plan}`}</Bubble>
          <View style={{ alignSelf: 'center', width: 16, height: 16, backgroundColor: C.white, transform: [{ rotate: '45deg' }], marginTop: -9, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: 'rgba(217,129,42,0.35)' }} />
        </Animated.View>
        <Animated.View entering={ZoomIn.springify().damping(10).stiffness(140)}>
          <Laith size={230} mood="wave" onZone={(zone) => setReply(laithLine(zone))} />
        </Animated.View>
        {days > 1 ? (
          <Animated.View entering={FadeIn.delay(900)} style={{ flexDirection: ROW, alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Icon name="fire" size={22} color="#F0802F" />
            <T size={15} w="bold" color={C.sub}>
              {days} أيام متتالية
            </T>
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function Shell() {
  const insets = useSafeAreaInsets();
  const { s, ready } = useStore();
  const [tab, setTab] = useState<Tab>('path');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [n, setN] = useState(0);
  // Greet returning learners on launch. A first-time learner has just met Laith on the welcome screen.
  const [greeting, setGreeting] = useState<boolean | null>(null);
  useEffect(() => {
    if (ready && greeting === null) setGreeting(s.onboarded);
  }, [ready, greeting, s.onboarded]);
  const endGreeting = React.useCallback(() => setGreeting(false), []);

  // Rewrite tomorrow's reminder whenever progress or the chosen hour changes, so it always names
  // the lesson that is really next and the current streak.
  const nextTitle = LESSONS[currentLesson(s)].title;
  const days = streak(s);
  const allDone = isDone(s, LESSONS.length - 1);
  useEffect(() => {
    if (!ready) return;
    if (!s.settings.reminder) {
      cancelDaily();
      return;
    }
    const body = allDone
      ? 'أنهينا كل الدروس! خمس دقائق من المراجعة تحفظ ما تعلّمناه.'
      : days > 1
        ? `سلسلتك ${days} أيام، لا تقطعها! درسنا التالي: «${nextTitle}».`
        : `درسنا التالي: «${nextTitle}». خمس دقائق معي تكفي.`;
    scheduleDaily(s.settings.reminderHour, 0, { title: 'ليث ينتظرك 🦁', body });
  }, [ready, s.settings.reminder, s.settings.reminderHour, nextTitle, days, allDone]);

  if (!ready) return <Background />;
  if (!s.onboarded) return <WelcomeScreen />;

  const open = (next: { kind: 'session'; session: Session } | { kind: 'case'; unit: number }) => {
    setN(n + 1);
    setOverlay({ ...next, n: n + 1 });
  };
  const startLesson = (lessonId: number) => open({ kind: 'session', session: { type: 'lesson', lessonId } });
  const startReview = (ids: string[], title: string) => open({ kind: 'session', session: { type: 'review', ids, title } });
  const startCase = (unit: number) => open({ kind: 'case', unit });
  const tint = UNITS[Math.floor(currentLesson(s) / 6)].color;
  const due = dueIds(s).length;

  return (
    <View style={{ flex: 1 }}>
      <Background tint={tint} />
      {/* tabs stay mounted so the trail keeps its scroll position while a lesson is open */}
      <View style={[styles.screen, { display: overlay ? 'none' : 'flex' }]}>
        <View style={{ flex: 1, display: tab === 'path' ? 'flex' : 'none' }}>
          <PathScreen onStartLesson={startLesson} onStartCase={startCase} active={!overlay && !greeting && tab === 'path'} />
        </View>
        {tab === 'review' ? (
          <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1 }}>
            <ReviewScreen onStartReview={startReview} onStartCase={startCase} />
          </Animated.View>
        ) : null}
        {tab === 'phrases' ? (
          <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1 }}>
            <PhrasebookScreen />
          </Animated.View>
        ) : null}
        {tab === 'me' ? (
          <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1 }}>
            <ProfileScreen />
          </Animated.View>
        ) : null}

        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 10) + 4, alignItems: 'center' }}>
          <Glass radius={32} interactive depth={3} intensity={70} style={{ width: '90%', maxWidth: MAX_W - 50, paddingHorizontal: 6, flexDirection: ROW, alignItems: 'center' }}>
            {TABS.map((t) => (
              <TabItem key={t.id} tab={t} active={tab === t.id} badge={t.id === 'review' ? due : undefined} onPress={() => setTab(t.id)} />
            ))}
          </Glass>
        </View>
      </View>

      {overlay ? (
        <Animated.View key={overlay.n} entering={SlideInDown.duration(320)} exiting={SlideOutDown.duration(220)} style={[fill, { backgroundColor: C.bg }]}>
          {overlay.kind === 'session' ? <LessonScreen session={overlay.session} onExit={() => setOverlay(null)} /> : <ScenarioScreen unit={overlay.unit} onExit={() => setOverlay(null)} />}
        </Animated.View>
      ) : null}

      {greeting ? <Greeting onDone={endGreeting} /> : null}
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  useEffect(() => {
    initAudio();
  }, []);
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="dark" />
        {fontsLoaded || fontError ? (
          <StoreProvider>
            <Shell />
          </StoreProvider>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}
