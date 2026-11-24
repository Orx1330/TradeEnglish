import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { I18nManager, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { UNITS } from './src/data/course';
import { initAudio } from './src/lib/audio';
import { LessonScreen, Session } from './src/screens/Lesson';
import { PathScreen } from './src/screens/Path';
import { PhrasebookScreen } from './src/screens/Phrasebook';
import { ProfileScreen } from './src/screens/Profile';
import { ReviewScreen } from './src/screens/Review';
import { ScenarioScreen } from './src/screens/Scenario';
import { WelcomeScreen } from './src/screens/Welcome';
import { StoreProvider, currentLesson, dueIds, useStore } from './src/state/store';
import { C, FONT_FILES, MAX_W, ROW } from './src/theme';
import { Glass } from './src/ui/Glass';
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
        <Animated.View style={[{ position: 'absolute', top: 5, bottom: 5, left: 4, right: 4, borderRadius: 22, backgroundColor: 'rgba(63,174,90,0.16)' }, pill]} />
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

function Shell() {
  const insets = useSafeAreaInsets();
  const { s, ready } = useStore();
  const [tab, setTab] = useState<Tab>('path');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [n, setN] = useState(0);

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
          <PathScreen onStartLesson={startLesson} onStartCase={startCase} />
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
