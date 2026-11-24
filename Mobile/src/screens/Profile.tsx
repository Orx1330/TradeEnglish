import React, { useMemo, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LESSONS, LESSONS_PER_UNIT, PHRASES, UNITS, VOICES } from '../data/course';
import { speak } from '../lib/audio';
import { NOUN, count } from '../lib/ar';
import { haptic } from '../lib/haptics';
import { PERSISTENT, recordingsSize } from '../lib/recStore';
import { REMINDERS_SUPPORTED, cancelDaily, enableReminders } from '../lib/reminders';
import { addDays, badges, dayKey, masteredCount, streak, unitDoneCount, useStore } from '../state/store';
import { C, ROW, ROW_EN } from '../theme';
import { Card } from '../ui/Glass';
import { Bar, Btn, Chip, E, Icon, T } from '../ui/kit';
import { Sheet } from '../ui/parts';

export const REMINDER_HOURS = [
  { hour: 9, label: '9 صباحًا' },
  { hour: 13, label: '1 ظهرًا' },
  { hour: 20, label: '8 مساءً' },
  { hour: 22, label: '10 ليلًا' },
];
const DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const rank = (xp: number) => (xp < 200 ? 'تاجر ناشئ' : xp < 800 ? 'مشترٍ واثق' : xp < 1800 ? 'مفاوض ماهر' : 'خبير توريد');
const mb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} ك.ب` : `${(bytes / 1024 / 1024).toFixed(1)} م.ب`);

function Tile({ icon, color, value, label }: { icon: string; color: string; value: string; label: string }) {
  return (
    <Card radius={22} style={{ flex: 1, padding: 14, gap: 2 }}>
      <View style={{ flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' }}>
        <Icon name={icon} size={24} color={color} />
        <E size={24} bold color={C.ink}>
          {value}
        </E>
      </View>
      <T size={13} color={C.sub}>
        {label}
      </T>
    </Card>
  );
}

function Toggle({ icon, title, hint, value, onChange }: { icon: string; title: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: ROW, alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <Icon name={icon} size={22} color={C.sub} />
      <View style={{ flex: 1 }}>
        <T size={15.5} w="medium">
          {title}
        </T>
        {hint ? (
          <T size={12.5} color={C.mute} style={{ lineHeight: 18 }}>
            {hint}
          </T>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          haptic.tap();
          onChange(v);
        }}
        trackColor={{ false: 'rgba(29,50,41,0.16)', true: C.green }}
        thumbColor={C.white}
        ios_backgroundColor="rgba(29,50,41,0.16)"
      />
    </View>
  );
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { s, setSettings, resetProgress } = useStore();
  const [confirm, setConfirm] = useState(false);
  const [reminderNote, setReminderNote] = useState<string | null>(null);
  const lessonsDone = Object.keys(s.done).length;
  const recs = Object.keys(s.recordings).length;
  const size = useMemo(() => {
    try {
      return recordingsSize();
    } catch {
      return 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recs]);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(i - 6);
    return { key: dayKey(d), label: DAYS[d.getDay()], xp: s.days[dayKey(d)] ?? 0 };
  });
  const peak = Math.max(s.settings.goal, ...week.map((d) => d.xp));
  const earned = badges(s);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 18, paddingBottom: insets.bottom + 130, gap: 16 }}>
      <View style={{ flexDirection: ROW, alignItems: 'center', gap: 14 }}>
        <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.8)' }}>
          <T size={30} w="black" color={C.white} center style={{ lineHeight: 44 }}>
            {(s.name || 'ت').trim().charAt(0)}
          </T>
        </View>
        <View style={{ flex: 1 }}>
          <T size={26} w="black">
            {s.name || 'التاجر'}
          </T>
          <T size={14.5} color={C.sub}>
            {rank(s.xp)} · {s.xp} نقطة خبرة
          </T>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: ROW, gap: 10 }}>
          <Tile icon="fire" color="#F0802F" value={String(streak(s))} label="أيام متتالية" />
          <Tile icon="school-outline" color={C.green} value={`${lessonsDone}/${LESSONS.length}`} label="دروس مكتملة" />
        </View>
        <View style={{ flexDirection: ROW, gap: 10 }}>
          <Tile icon="brain" color="#8571C9" value={`${masteredCount(s)}/${PHRASES.length}`} label="جمل متقنة" />
          <Tile icon="microphone" color={C.red} value={String(recs)} label="تسجيلات بصوتك" />
        </View>
      </View>

      <Card radius={26} style={{ padding: 18, gap: 12 }}>
        <View style={{ flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' }}>
          <T size={18} w="bold">
            آخر 7 أيام
          </T>
          <T size={13} color={C.sub}>
            الهدف اليومي {s.settings.goal} نقطة
          </T>
        </View>
        <View style={{ flexDirection: ROW, alignItems: 'flex-end', gap: 8, height: 124 }}>
          {week.map((d, i) => {
            const hit = d.xp >= s.settings.goal;
            return (
              <View key={d.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <E size={11.5} bold color={d.xp ? C.ink : 'transparent'} center>
                  {d.xp}
                </E>
                <View style={{ width: '100%', height: 6 + (d.xp / peak) * 70, borderRadius: 9, backgroundColor: hit ? C.gold : d.xp ? C.green : 'rgba(29,50,41,0.08)' }} />
                <T size={10.5} color={i === 6 ? C.ink : C.sub} w={i === 6 ? 'bold' : 'regular'} center style={{ lineHeight: 15 }}>
                  {i === 6 ? 'اليوم' : d.label}
                </T>
              </View>
            );
          })}
        </View>
      </Card>

      <Card radius={26} style={{ padding: 18, gap: 12 }}>
        <T size={18} w="bold">
          تقدّم الوحدات
        </T>
        {UNITS.map((u) => {
          const n = unitDoneCount(s, u.id);
          return (
            <View key={u.id} style={{ flexDirection: ROW, alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: n ? u.color : C.lock, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={u.icon} size={19} color={C.white} />
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <View style={{ flexDirection: ROW, justifyContent: 'space-between' }}>
                  <T size={14.5} w="medium" style={{ lineHeight: 20 }}>
                    {u.title}
                  </T>
                  <E size={12} bold color={C.sub}>
                    {u.level} · {n}/{LESSONS_PER_UNIT}
                  </E>
                </View>
                <Bar value={n / LESSONS_PER_UNIT} color={u.color} height={8} />
              </View>
            </View>
          );
        })}
      </Card>

      <Card radius={26} style={{ padding: 18, gap: 12 }}>
        <View style={{ flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' }}>
          <T size={18} w="bold">
            الأوسمة
          </T>
          <T size={13} color={C.sub}>
            {earned.filter((b) => b.earned).length} من {earned.length}
          </T>
        </View>
        <View style={{ flexDirection: ROW, flexWrap: 'wrap', rowGap: 14 }}>
          {earned.map((b) => (
            <View key={b.id} style={{ width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: 4 }}>
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: b.earned ? C.goldSoft : 'rgba(29,50,41,0.06)', borderWidth: 2, borderColor: b.earned ? C.gold : 'rgba(29,50,41,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={b.icon} size={28} color={b.earned ? C.goldDark : C.lockDark} />
              </View>
              <T size={12.5} w="bold" color={b.earned ? C.ink : C.mute} center style={{ lineHeight: 17 }}>
                {b.title}
              </T>
              <T size={10.5} color={C.mute} center style={{ lineHeight: 14 }}>
                {b.hint}
              </T>
            </View>
          ))}
        </View>
      </Card>

      <Card radius={26} style={{ padding: 18, gap: 10 }}>
        <T size={18} w="bold">
          صوت القراءة
        </T>
        <T size={13} color={C.sub}>
          كل الأصوات محفوظة داخل التطبيق وتعمل دون إنترنت. «عشوائي» يغيّر المتحدث مع كل جملة لتعتاد أذنك لهجات مختلفة.
        </T>
        <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8 }}>
          <Chip label="عشوائي" icon="shuffle-variant" active={s.settings.voice === 'random'} onPress={() => setSettings({ voice: 'random' })} />
          {VOICES.map((v) => (
            <Chip
              key={v.id}
              label={`${v.name} · ${v.note}`}
              active={s.settings.voice === v.id}
              onPress={() => {
                setSettings({ voice: v.id });
                speak('p000', { voice: v.id });
              }}
            />
          ))}
        </View>
      </Card>

      <Card radius={26} style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
        <Toggle icon="vibrate" title="الاهتزاز عند اللمس" value={s.settings.haptics} onChange={(haptics) => setSettings({ haptics })} />
        <View style={{ height: 1, backgroundColor: C.line }} />
        <Toggle icon="music-note" title="المؤثرات الصوتية" value={s.settings.sfx} onChange={(sfx) => setSettings({ sfx })} />
        <View style={{ height: 1, backgroundColor: C.line }} />
        <Toggle icon="play-circle-outline" title="تشغيل الجملة تلقائيًا" hint="تُقرأ كل جملة جديدة فور ظهورها" value={s.settings.autoplay} onChange={(autoplay) => setSettings({ autoplay })} />
        <View style={{ height: 1, backgroundColor: C.line }} />
        <Toggle icon="keyboard-outline" title="تمارين الكتابة" hint="اكتب الجملة والإملاء السمعي في نهاية الدرس" value={s.settings.typing} onChange={(typing) => setSettings({ typing })} />
      </Card>

      <Card radius={26} style={{ paddingHorizontal: 18, paddingVertical: 10, gap: 6 }}>
        <Toggle
          icon="bell-ring-outline"
          title="التذكير اليومي"
          hint={REMINDERS_SUPPORTED ? 'ليث يذكّرك بدرسك كل يوم في الوقت الذي تختاره' : 'متاح في تطبيق الهاتف'}
          value={s.settings.reminder}
          onChange={async (on) => {
            setReminderNote(null);
            if (!on) {
              setSettings({ reminder: false });
              cancelDaily();
              return;
            }
            if (await enableReminders()) setSettings({ reminder: true });
            else setReminderNote(REMINDERS_SUPPORTED ? 'اسمح للتطبيق بالإشعارات من إعدادات الجهاز ثم أعد المحاولة.' : 'التذكير يعمل في تطبيق الهاتف فقط.');
          }}
        />
        {s.settings.reminder ? (
          <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
            {REMINDER_HOURS.map((r) => (
              <Chip key={r.hour} label={r.label} icon="clock-outline" active={s.settings.reminderHour === r.hour} onPress={() => setSettings({ reminderHour: r.hour })} />
            ))}
          </View>
        ) : null}
        {reminderNote ? (
          <T size={13} color={C.redDark} style={{ paddingBottom: 8 }}>
            {reminderNote}
          </T>
        ) : null}
      </Card>

      <Card radius={26} style={{ padding: 18, gap: 10 }}>
        <T size={18} w="bold">
          الهدف اليومي
        </T>
        <View style={{ flexDirection: ROW, gap: 8 }}>
          {[
            { xp: 30, label: 'خفيف · 30' },
            { xp: 60, label: 'منتظم · 60' },
            { xp: 120, label: 'جادّ · 120' },
          ].map((g) => (
            <Chip key={g.xp} label={g.label} active={s.settings.goal === g.xp} onPress={() => setSettings({ goal: g.xp })} />
          ))}
        </View>
      </Card>

      <Card radius={26} style={{ padding: 18, gap: 10 }}>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: 10 }}>
          <Icon name="shield-lock-outline" size={24} color={C.green} />
          <T size={18} w="bold" style={{ flex: 1 }}>
            كل شيء على جهازك
          </T>
        </View>
        <T size={14} color={C.sub}>
          الدروس و1,997 مقطعًا صوتيًا وتقدّمك وتسجيلاتك محفوظة داخل التطبيق. لا حساب، لا إنترنت، ولا يُرسل أي شيء خارج الجهاز.
        </T>
        <T size={13.5} color={C.ink}>
          {PERSISTENT ? recs ? `تسجيلاتك: ${count(recs, NOUN.recording)} · ${mb(size)}` : 'لم تسجّل أي جملة بعد.' : 'معاينة المتصفح: التسجيلات مؤقتة حتى إغلاق الصفحة.'}
        </T>
        <Btn title="مسح التقدّم والتسجيلات" icon="restore" color="rgba(255,255,255,0.95)" dark="rgba(29,50,41,0.18)" text={C.redDark} height={48} size={15} onPress={() => setConfirm(true)} />
      </Card>

      <T size={12} color={C.mute} center>
        Trade English · رحلة التاجر · الإصدار 1.0
      </T>

      <Sheet visible={confirm} onClose={() => setConfirm(false)} scroll={false}>
        <View style={{ gap: 12, paddingTop: 6 }}>
          <T size={21} w="black" center>
            مسح كل شيء والبدء من جديد؟
          </T>
          <T size={15} color={C.sub} center>
            سيُحذف تقدّمك في الدروس والمراجعة والمفضلة{recs ? ` و${count(recs, NOUN.recording)} بصوتك` : ''} نهائيًا. لا يمكن التراجع عن هذه الخطوة.
          </T>
          <Btn
            title="نعم، امسح كل شيء"
            color={C.red}
            dark={C.redDark}
            onPress={() => {
              resetProgress();
              setConfirm(false);
              haptic.warn();
            }}
          />
          <Btn title="إلغاء" color="rgba(255,255,255,0.95)" dark="rgba(29,50,41,0.18)" text={C.ink} onPress={() => setConfirm(false)} />
        </View>
      </Sheet>
    </ScrollView>
  );
}
