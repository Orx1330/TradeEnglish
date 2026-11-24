import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UNITS, phrase } from '../data/course';
import { NOUN, count } from '../lib/ar';
import { caseUnlocked, dueIds, useStore } from '../state/store';
import { C, ROW, ROW_EN } from '../theme';
import { Card } from '../ui/Glass';
import { LaithSays } from '../ui/Laith';
import { Btn, E, Icon, Ring, SpeakBtn, T, Tap } from '../ui/kit';

const BOXES = ['اليوم', 'يوم', '3 أيام', 'أسبوع', 'أسبوعان', 'شهر'];

export function ReviewScreen({ onStartReview, onStartCase }: { onStartReview: (ids: string[], title: string) => void; onStartCase: (unit: number) => void }) {
  const insets = useSafeAreaInsets();
  const { s } = useStore();
  const due = dueIds(s);
  const learned = Object.keys(s.review);
  const weak = learned.filter((id) => s.review[id].box === 0).slice(0, 6);
  const counts = BOXES.map((_, box) => learned.filter((id) => s.review[id].box === box).length);
  const peak = Math.max(1, ...counts);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 18, paddingBottom: insets.bottom + 130, gap: 16 }}>
      <View>
        <T size={30} w="black">
          المراجعة الذكية
        </T>
      </View>
      <LaithSays
        mood={due.length ? 'idle' : learned.length ? 'happy' : 'wave'}
        text={due.length ? `${count(due.length, NOUN.phrase)} تنتظرنا اليوم. الجملة التي نخطئ فيها تعود، والتي نتقنها تتباعد حتى شهر.` : learned.length ? 'أنجزنا مراجعة اليوم! يمكنك التدرّب بحرية متى شئت.' : 'أكمل أول درس معي، ثم نراجع هنا ما تعلّمناه.'}
      />

      <Card radius={28} depth={2} style={{ padding: 18, gap: 16 }}>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: 16 }}>
          <Ring value={learned.length ? 1 - due.length / learned.length : 0} size={92} stroke={9} color={C.green}>
            <E size={30} bold center color={due.length ? C.ink : C.green}>
              {due.length}
            </E>
          </Ring>
          <View style={{ flex: 1 }}>
            <T size={19} w="bold">
              {due.length ? 'جمل تنتظر مراجعتك' : learned.length ? 'لا مراجعات مستحقة الآن' : 'لم تبدأ بعد'}
            </T>
            <T size={14} color={C.sub}>
              {learned.length ? `تعلّمت ${count(learned.length, NOUN.phrase)} حتى الآن` : 'أكمل أول درس لتبدأ قائمة المراجعة.'}
            </T>
          </View>
        </View>
        <Btn title={due.length ? `ابدأ المراجعة · ${count(Math.min(10, due.length), NOUN.phrase)}` : 'لا شيء مستحق اليوم'} icon="play" disabled={!due.length} onPress={() => onStartReview(due, 'مراجعة ذكية')} height={56} />
        {learned.length >= 4 ? (
          <Btn title="تدريب حر على جمل سابقة" icon="shuffle-variant" color="rgba(255,255,255,0.95)" dark="rgba(29,50,41,0.18)" text={C.ink} onPress={() => onStartReview(learned, 'تدريب حر')} height={50} size={15.5} />
        ) : null}
        {s.favorites.length >= 4 ? (
          <Btn title={`تدريب المفضلة · ${s.favorites.length}`} icon="heart" color="rgba(255,255,255,0.95)" dark="rgba(29,50,41,0.18)" text="#C0486A" onPress={() => onStartReview(s.favorites, 'تدريب المفضلة')} height={50} size={15.5} />
        ) : null}
      </Card>

      <Card radius={26} style={{ padding: 18, gap: 12 }}>
        <T size={18} w="bold">
          صناديق الحفظ
        </T>
        <View style={{ flexDirection: ROW, alignItems: 'flex-end', gap: 8, height: 132 }}>
          {counts.map((n, box) => (
            <View key={box} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <E size={13} bold color={n ? C.ink : C.mute} center>
                {n}
              </E>
              <View style={{ width: '100%', height: 8 + (n / peak) * 66, borderRadius: 10, backgroundColor: n ? ['#E2604F', '#F0802F', '#F2B33D', '#8CC152', '#3FAE5A', '#27A397'][box] : 'rgba(29,50,41,0.08)' }} />
              <T size={11} color={C.sub} center style={{ lineHeight: 15 }}>
                {BOXES[box]}
              </T>
            </View>
          ))}
        </View>
        <T size={12.5} color={C.mute}>
          كل إجابة صحيحة تنقل الجملة إلى الصندوق التالي، وكل خطأ يعيدها إلى صندوق اليوم.
        </T>
      </Card>

      {weak.length ? (
        <Card radius={26} style={{ padding: 18, gap: 4 }}>
          <T size={18} w="bold">
            تحتاج تدريبًا أكثر
          </T>
          {weak.map((id, i) => {
            const p = phrase(id);
            return (
              <View key={id} style={{ flexDirection: ROW_EN, alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <SpeakBtn clip={p.id} text={p.en} size={36} color={C.red} />
                <View style={{ flex: 1 }}>
                  <E size={15} bold>
                    {p.en}
                  </E>
                  <T size={13} color={C.sub} style={{ lineHeight: 19 }}>
                    {p.ar}
                  </T>
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}

      <View style={{ gap: 10 }}>
        <T size={20} w="black">
          مختبرات الصفقات
        </T>
        {UNITS.map((u) => {
          const open = caseUnlocked(s, u.id);
          const done = s.cases.includes(u.id);
          return (
            <Tap key={u.id} onPress={() => open && onStartCase(u.id)} disabled={!open} scale={0.97} sound>
              <Card radius={22} style={{ padding: 14, flexDirection: ROW, alignItems: 'center', gap: 12, opacity: open ? 1 : 0.6 }}>
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: done ? C.gold : open ? u.color : C.lock, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={open ? 'forum' : 'lock'} size={24} color={C.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <T size={16} w="bold">
                    {u.title}
                  </T>
                  <T size={13} color={C.sub} style={{ lineHeight: 19 }}>
                    {done ? 'أُنجز · أعد المحاولة متى شئت' : open ? '3 مواقف تفاوضية · 30 نقطة' : 'أكمل دروس الوحدة لفتحه'}
                  </T>
                </View>
                <Icon name={done ? 'check-decagram' : 'chevron-left'} size={24} color={done ? C.goldDark : C.mute} />
              </Card>
            </Tap>
          );
        })}
      </View>
    </ScrollView>
  );
}
