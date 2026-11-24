import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sfx } from '../lib/audio';
import { REMINDERS_SUPPORTED, enableReminders } from '../lib/reminders';
import { useStore } from '../state/store';
import { C, F, ROW } from '../theme';
import { Card } from '../ui/Glass';
import { Laith } from '../ui/Laith';
import { Btn, Chip, E, Icon, T } from '../ui/kit';
import { Background, Pop, styles } from '../ui/parts';

const POINTS = [
  { icon: 'map-marker-path', color: C.green, title: 'مسار من 48 درسًا', text: 'من أول تعارف مع المورد حتى إغلاق الصفقة.' },
  { icon: 'microphone', color: C.red, title: 'سجّل صوتك وقارنه', text: 'تسجيلاتك تُحفظ على جهازك لتسمعها متى شئت.' },
  { icon: 'wifi-off', color: C.blue, title: 'يعمل دون إنترنت', text: 'سبعة أصوات إنجليزية محفوظة داخل التطبيق.' },
];

export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { finishOnboarding, setSettings } = useStore();
  const [remind, setRemind] = useState(REMINDERS_SUPPORTED);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState(60);
  return (
    <View style={{ flex: 1 }}>
      <Background />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 22, paddingBottom: 16, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Pop>
              <Laith mood="wave" size={148} />
            </Pop>
            <E size={15} bold color={C.green} center style={{ letterSpacing: 3 }}>
              TRADE ENGLISH
            </E>
            <T size={34} w="black" center>
              رحلة التاجر
            </T>
            <T size={16} color={C.sub} center>
              أهلًا! أنا ليث، وسأتعلّم معك إنجليزية تجارة الأغذية والحلويات خطوة بخطوة.
            </T>
          </View>

          <View style={{ gap: 10 }}>
            {POINTS.map((p, i) => (
              <Animated.View key={p.icon} entering={FadeInDown.delay(250 + i * 110).duration(360)}>
                <Card radius={22} style={{ padding: 14, flexDirection: ROW, alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: p.color, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={p.icon} size={24} color={C.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T size={16} w="bold">
                      {p.title}
                    </T>
                    <T size={13.5} color={C.sub} style={{ lineHeight: 20 }}>
                      {p.text}
                    </T>
                  </View>
                </Card>
              </Animated.View>
            ))}
          </View>

          <Card radius={24} color={C.surfaceStrong} style={{ padding: 16, gap: 12 }}>
            <T size={15} w="bold">
              ما اسمك؟
            </T>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="اكتب اسمك (اختياري)"
              placeholderTextColor={C.mute}
              maxLength={24}
              style={{ fontFamily: F.medium, fontSize: 18, color: C.ink, textAlign: 'center', height: 50, borderRadius: 16, backgroundColor: 'rgba(29,50,41,0.05)', ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) }}
            />
            <T size={15} w="bold">
              هدفك اليومي
            </T>
            <View style={{ flexDirection: ROW, gap: 8, justifyContent: 'center' }}>
              <Chip label="خفيف · 5 د" active={goal === 30} onPress={() => setGoal(30)} />
              <Chip label="منتظم · 10 د" active={goal === 60} onPress={() => setGoal(60)} />
              <Chip label="جادّ · 20 د" active={goal === 120} onPress={() => setGoal(120)} />
            </View>
            {REMINDERS_SUPPORTED ? (
              <View style={{ flexDirection: ROW, alignItems: 'center', gap: 10, paddingTop: 4 }}>
                <Icon name="bell-ring-outline" size={22} color={C.sub} />
                <T size={15} w="medium" style={{ flex: 1 }}>
                  ليث يذكّرني كل يوم الساعة 8 مساءً
                </T>
                <Switch value={remind} onValueChange={setRemind} trackColor={{ false: 'rgba(29,50,41,0.16)', true: C.green }} thumbColor={C.white} ios_backgroundColor="rgba(29,50,41,0.16)" />
              </View>
            ) : null}
          </Card>

        </ScrollView>
        <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 14) + 10 }}>
          <Btn
            title="ابدأ الرحلة"
            icon="arrow-left"
            height={60}
            size={19}
            onPress={() => {
              sfx('start');
              finishOnboarding(name.trim(), goal);
              // the permission prompt comes after the tap, so the learner knows why it is asked
              if (remind) enableReminders().then((ok) => ok && setSettings({ reminder: true, reminderHour: 20 }));
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
