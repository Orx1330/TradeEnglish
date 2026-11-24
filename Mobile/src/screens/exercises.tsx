import React, { useEffect, useMemo, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, ZoomIn } from 'react-native-reanimated';

import { Phrase, lessonOf, tokens } from '../data/course';
import { sfx, speak } from '../lib/audio';
import { Step, shuffle, tile } from '../lib/engine';
import { haptic } from '../lib/haptics';
import { useStore } from '../state/store';
import { C, EN_FONT, ROW, ROW_EN } from '../theme';
import { Card } from '../ui/Glass';
import { Recorder } from '../ui/Recorder';
import { E, Icon, SpeakBtn, T, Tap } from '../ui/kit';
import { WordLine, useShake } from '../ui/parts';

export type Phase = 'answering' | 'correct' | 'wrong';
export type Answer = string | string[] | null;

type Common = { phase: Phase; accent: string; onAnswer: (a: Answer) => void; answer: Answer };

/* ---------- shared: one selectable option ---------- */
function Option({
  label,
  english,
  state,
  onPress,
  index,
}: {
  label: string;
  english?: boolean;
  state: 'idle' | 'picked' | 'right' | 'wrong' | 'dim';
  onPress: () => void;
  index: number;
}) {
  const palette = {
    idle: { bg: 'rgba(255,255,255,0.82)', border: 'rgba(29,50,41,0.12)', edge: 'rgba(29,50,41,0.16)', text: C.ink },
    picked: { bg: C.blueSoft, border: C.blue, edge: '#1F789B', text: '#155E7C' },
    right: { bg: C.greenSoft, border: C.green, edge: C.greenDark, text: '#1F6B33' },
    wrong: { bg: C.redSoft, border: C.red, edge: C.redDark, text: '#96311F' },
    dim: { bg: 'rgba(255,255,255,0.5)', border: 'rgba(29,50,41,0.07)', edge: 'rgba(29,50,41,0.08)', text: C.mute },
  }[state];
  return (
    <Animated.View entering={FadeIn.delay(60 + index * 55).duration(220)}>
      <Tap onPress={onPress} disabled={state === 'right' || state === 'wrong' || state === 'dim'} scale={0.97} sound>
        <View
          style={{
            flexDirection: english ? ROW_EN : ROW,
            alignItems: 'center',
            gap: 12,
            minHeight: 58,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 18,
            backgroundColor: palette.bg,
            borderWidth: 1.5,
            borderBottomWidth: 4,
            borderColor: palette.border,
            borderBottomColor: palette.edge,
          }}>
          <View style={{ width: 28, height: 28, borderRadius: 9, borderWidth: 1.5, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' }}>
            {state === 'right' ? (
              <Icon name="check-bold" size={16} color={C.green} />
            ) : state === 'wrong' ? (
              <Icon name="close-thick" size={16} color={C.red} />
            ) : (
              <E size={13} bold color={palette.text} center style={{ lineHeight: 17 }}>
                {index + 1}
              </E>
            )}
          </View>
          <View style={{ flex: 1 }}>
            {english ? (
              <E size={16.5} color={palette.text}>
                {label}
              </E>
            ) : (
              <T size={16.5} w="medium" color={palette.text} style={{ lineHeight: 25 }}>
                {label}
              </T>
            )}
          </View>
        </View>
      </Tap>
    </Animated.View>
  );
}

const optionState = (id: string, correctId: string, answer: Answer, phase: Phase) => {
  if (phase === 'answering') return answer === id ? 'picked' : 'idle';
  if (id === correctId) return 'right';
  if (answer === id) return 'wrong';
  return 'dim';
};

/* ---------- learn ---------- */
export function LearnCard({ p, accent }: { p: Phrase; accent: string }) {
  const { s, toggleFavorite } = useStore();
  const fav = s.favorites.includes(p.id);
  return (
    <View style={{ gap: 14 }}>
      <Card radius={28} depth={2} style={{ padding: 20, gap: 14 }}>
        <View style={{ flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: ROW, alignItems: 'center', gap: 6, backgroundColor: accent + '22', paddingHorizontal: 12, height: 30, borderRadius: 15 }}>
            <Icon name={lessonOf(p.id).icon} size={14} color={accent} />
            <T size={13} w="bold" color={accent} style={{ lineHeight: 18 }}>
              {lessonOf(p.id).title}
            </T>
          </View>
          <Tap onPress={() => toggleFavorite(p.id)} scale={0.8} label="المفضلة">
            <Icon name={fav ? 'heart' : 'heart-outline'} size={26} color={fav ? '#E2607C' : C.mute} />
          </Tap>
        </View>
        <WordLine en={p.en} size={27} />
        <T size={19} color={C.sub} w="medium">
          {p.ar}
        </T>
        <View style={{ flexDirection: ROW_EN, alignItems: 'center', gap: 12, marginTop: 2 }}>
          <SpeakBtn clip={p.id} text={p.en} size={58} color={accent} />
          <SpeakBtn clip={p.id} text={p.en} size={46} color={accent} slow />
          <T size={13} color={C.mute} style={{ flex: 1, lineHeight: 19 }}>
            استمع ثم كرّر بصوت مسموع. اضغط أي كلمة لمعرفة معناها.
          </T>
        </View>
      </Card>
      <Recorder phraseId={p.id} />
    </View>
  );
}

/* ---------- meaning ---------- */
export function Meaning({ step, phase, answer, onAnswer, accent }: Common & { step: Extract<Step, { kind: 'meaning' }> }) {
  return (
    <View style={{ gap: 12 }}>
      <Card radius={24} style={{ padding: 16, flexDirection: ROW_EN, alignItems: 'center', gap: 14 }}>
        <SpeakBtn clip={step.p.id} text={step.p.en} size={50} color={accent} />
        <View style={{ flex: 1 }}>
          <WordLine en={step.p.en} size={21} />
        </View>
      </Card>
      {step.options.map((o, i) => (
        <Option key={o.id} index={i} label={o.ar} state={optionState(o.id, step.p.id, answer, phase)} onPress={() => onAnswer(o.id)} />
      ))}
    </View>
  );
}

/* ---------- listen ---------- */
export function Listen({ step, phase, answer, onAnswer, accent }: Common & { step: Extract<Step, { kind: 'listen' }> }) {
  return (
    <View style={{ gap: 12 }}>
      <Card radius={28} style={{ paddingVertical: 22, alignItems: 'center', gap: 8 }}>
        <View style={{ flexDirection: ROW_EN, alignItems: 'center', gap: 18 }}>
          <SpeakBtn clip={step.p.id} text={step.p.en} size={84} color={accent} />
          <SpeakBtn clip={step.p.id} text={step.p.en} size={54} color={accent} slow />
        </View>
        <T size={14} color={C.sub} center>
          استمع جيدًا ثم اختر الجملة التي سمعتها
        </T>
      </Card>
      {step.options.map((o, i) => (
        <Option
          key={o.id}
          index={i}
          english
          label={o.en}
          state={optionState(o.id, step.p.id, answer, phase)}
          onPress={() => onAnswer(o.id)}
        />
      ))}
    </View>
  );
}

/* ---------- arrange ---------- */
function WordTile({ word, onPress, ghost, tone = 'idle' }: { word: string; onPress?: () => void; ghost?: boolean; tone?: 'idle' | 'right' | 'wrong' }) {
  const colors = { idle: ['rgba(255,255,255,0.95)', 'rgba(29,50,41,0.14)', 'rgba(29,50,41,0.2)', C.ink], right: [C.greenSoft, C.green, C.greenDark, '#1F6B33'], wrong: [C.redSoft, C.red, C.redDark, '#96311F'] }[tone];
  if (ghost) {
    return (
      <View style={{ height: 46, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(29,50,41,0.07)', justifyContent: 'center' }}>
        <E size={17} color="transparent">
          {word}
        </E>
      </View>
    );
  }
  return (
    <Tap onPress={onPress} scale={0.9} sound disabled={!onPress}>
      <View style={{ height: 46, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors[0], borderWidth: 1.5, borderBottomWidth: 4, borderColor: colors[1], borderBottomColor: colors[2], justifyContent: 'center' }}>
        <E size={17} color={colors[3]}>
          {word}
        </E>
      </View>
    </Tap>
  );
}

export function Arrange({ step, phase, onAnswer }: Common & { step: Extract<Step, { kind: 'arrange' }> }) {
  const [picked, setPicked] = useState<number[]>([]);
  useEffect(() => {
    onAnswer(picked.length ? picked.map((i) => step.tiles[i]) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);
  const locked = phase !== 'answering';
  const tone = phase === 'correct' ? 'right' : phase === 'wrong' ? 'wrong' : 'idle';
  return (
    <View style={{ gap: 16 }}>
      <Card radius={24} style={{ padding: 16, flexDirection: ROW, alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="translate" size={22} color={C.goldDark} />
        </View>
        <T size={19} w="medium" style={{ flex: 1 }}>
          {step.p.ar}
        </T>
      </Card>

      {/* answer tray: two ruled lines, like a notebook */}
      <View style={{ minHeight: 116, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.45)', borderWidth: 1, borderColor: C.hairline, padding: 10 }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 14, right: 14, top: 60, height: 1.5, backgroundColor: 'rgba(29,50,41,0.10)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 14, right: 14, top: 114, height: 0 }} />
        <View style={{ flexDirection: ROW_EN, flexWrap: 'wrap', gap: 8 }}>
          {picked.map((i) => (
            <Animated.View key={i} entering={ZoomIn.duration(150)} layout={LinearTransition.duration(160)}>
              <WordTile word={step.tiles[i]} tone={tone} onPress={locked ? undefined : () => setPicked((cur) => cur.filter((x) => x !== i))} />
            </Animated.View>
          ))}
          {!picked.length ? (
            <T size={14} color={C.mute} style={{ paddingHorizontal: 8, paddingTop: 10 }}>
              اضغط الكلمات بالترتيب الصحيح
            </T>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: ROW_EN, flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {step.tiles.map((word, i) => (
          <WordTile key={i} word={word} ghost={picked.includes(i)} onPress={locked ? undefined : () => setPicked((cur) => [...cur, i])} />
        ))}
      </View>
    </View>
  );
}

/* ---------- fill the blank ---------- */
export function Fill({ step, phase, answer, onAnswer }: Common & { step: Extract<Step, { kind: 'fill' }> }) {
  const words = useMemo(() => tokens(step.p.en), [step.p.en]);
  const correct = tile(words[step.blank]);
  const tail = words[step.blank].slice(correct.length); // punctuation that followed the word
  const chosen = typeof answer === 'string' ? answer : null;
  const shown = phase === 'wrong' ? correct : chosen;
  const blankColor = phase === 'correct' ? C.green : phase === 'wrong' ? C.red : chosen ? C.blue : 'rgba(29,50,41,0.3)';
  return (
    <View style={{ gap: 16 }}>
      <Card radius={26} depth={2} style={{ padding: 18, gap: 14 }}>
        <T size={17} color={C.sub} w="medium">
          {step.p.ar}
        </T>
        <View style={{ flexDirection: ROW_EN, flexWrap: 'wrap', alignItems: 'flex-end', columnGap: 7, rowGap: 10 }}>
          {words.map((w, i) =>
            i === step.blank ? (
              <View key={i} style={{ flexDirection: ROW_EN, alignItems: 'flex-end' }}>
                <View style={{ minWidth: 76, height: 38, borderBottomWidth: 3, borderBottomColor: blankColor, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: shown ? blankColor + '1F' : 'transparent', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
                  {shown ? (
                    <Animated.View key={shown} entering={ZoomIn.duration(140)}>
                      <E size={22} bold color={blankColor}>
                        {shown}
                      </E>
                    </Animated.View>
                  ) : null}
                </View>
                {tail ? (
                  <E size={22} bold>
                    {tail}
                  </E>
                ) : null}
              </View>
            ) : (
              <E key={i} size={22} bold>
                {w}
              </E>
            )
          )}
        </View>
      </Card>
      <View style={{ flexDirection: ROW_EN, flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
        {step.options.map((o, i) => {
          const state = phase === 'answering' ? (chosen === o ? 'picked' : 'idle') : o === correct ? 'right' : chosen === o ? 'wrong' : 'dim';
          const col = { idle: ['rgba(255,255,255,0.92)', 'rgba(29,50,41,0.14)', 'rgba(29,50,41,0.2)', C.ink], picked: [C.blueSoft, C.blue, '#1F789B', '#155E7C'], right: [C.greenSoft, C.green, C.greenDark, '#1F6B33'], wrong: [C.redSoft, C.red, C.redDark, '#96311F'], dim: ['rgba(255,255,255,0.5)', 'rgba(29,50,41,0.07)', 'rgba(29,50,41,0.08)', C.mute] }[state];
          return (
            <Animated.View key={o} entering={FadeIn.delay(80 + i * 50)} style={{ width: '47%' }}>
              <Tap onPress={() => onAnswer(o)} disabled={phase !== 'answering'} scale={0.94} sound>
                <View style={{ height: 56, borderRadius: 18, backgroundColor: col[0], borderWidth: 1.5, borderBottomWidth: 4, borderColor: col[1], borderBottomColor: col[2], alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
                  <E size={18} bold color={col[3]} center numberOfLines={1} adjustsFontSizeToFit>
                    {o}
                  </E>
                </View>
              </Tap>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

/* ---------- match pairs ---------- */
function MatchCard({ text, english, state, onPress, shake }: { text: string; english?: boolean; state: 'idle' | 'picked' | 'done' | 'wrong'; onPress: () => void; shake: number }) {
  const shakeStyle = useShake(shake);
  const col = { idle: ['rgba(255,255,255,0.9)', 'rgba(29,50,41,0.13)', 'rgba(29,50,41,0.18)', C.ink], picked: [C.blueSoft, C.blue, '#1F789B', '#155E7C'], done: [C.greenSoft, 'rgba(63,174,90,0.5)', 'rgba(63,174,90,0.5)', '#3C8A4F'], wrong: [C.redSoft, C.red, C.redDark, '#96311F'] }[state];
  return (
    <Animated.View style={shakeStyle}>
      <Tap onPress={onPress} disabled={state === 'done'} scale={0.95} sound>
        <View style={{ minHeight: 76, borderRadius: 16, backgroundColor: col[0], borderWidth: 1.5, borderBottomWidth: state === 'done' ? 1.5 : 4, borderColor: col[1], borderBottomColor: col[2], padding: 10, justifyContent: 'center', opacity: state === 'done' ? 0.62 : 1 }}>
          {english ? (
            <E size={14} color={col[3]} center style={{ lineHeight: 19 }}>
              {text}
            </E>
          ) : (
            <T size={14} w="medium" color={col[3]} center style={{ lineHeight: 21 }}>
              {text}
            </T>
          )}
        </View>
      </Tap>
    </Animated.View>
  );
}

export function Match({ step, onDone }: { step: Extract<Step, { kind: 'match' }>; onDone: (wrong: number) => void }) {
  const left = useMemo(() => shuffle(step.pairs), [step]);
  const right = useMemo(() => shuffle(step.pairs), [step]);
  const [en, setEn] = useState<string | null>(null);
  const [ar, setAr] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [bad, setBad] = useState<{ en: string; ar: string; n: number } | null>(null);
  const [wrong, setWrong] = useState(0);

  useEffect(() => {
    if (!en || !ar) return;
    if (en === ar) {
      haptic.success();
      sfx('correct');
      const next = [...done, en];
      setDone(next);
      setEn(null);
      setAr(null);
      if (next.length === step.pairs.length) setTimeout(() => onDone(wrong), 350);
    } else {
      haptic.error();
      sfx('wrong');
      setWrong((w) => w + 1);
      setBad({ en, ar, n: (bad?.n ?? 0) + 1 });
      const t = setTimeout(() => {
        setEn(null);
        setAr(null);
        setBad(null);
      }, 520);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [en, ar]);

  const stateOf = (id: string, picked: string | null, side: 'en' | 'ar') =>
    done.includes(id) ? 'done' : bad && bad[side] === id ? 'wrong' : picked === id ? 'picked' : 'idle';

  return (
    <View style={{ flexDirection: ROW_EN, gap: 10 }}>
      <View style={{ flex: 1, gap: 10 }}>
        {left.map((p) => (
          <MatchCard
            key={p.id}
            english
            text={p.en}
            state={stateOf(p.id, en, 'en')}
            shake={bad?.en === p.id ? bad.n : 0}
            onPress={() => {
              if (bad) return;
              setEn(p.id);
              speak(p.id);
            }}
          />
        ))}
      </View>
      <View style={{ flex: 1, gap: 10 }}>
        {right.map((p) => (
          <MatchCard key={p.id} text={p.ar} state={stateOf(p.id, ar, 'ar')} shake={bad?.ar === p.id ? bad.n : 0} onPress={() => !bad && setAr(p.id)} />
        ))}
      </View>
    </View>
  );
}

/* ---------- type / dictation ---------- */
export function Typing({ step, phase, answer, onAnswer, accent, onSubmit }: Common & { step: Extract<Step, { kind: 'type' | 'dictation' }>; onSubmit: () => void }) {
  const value = typeof answer === 'string' ? answer : '';
  const border = phase === 'correct' ? C.green : phase === 'wrong' ? C.red : value ? C.blue : 'rgba(29,50,41,0.16)';
  const lesson = lessonOf(step.p.id);
  return (
    <View style={{ gap: 14 }}>
      {step.kind === 'type' ? (
        <Card radius={24} style={{ padding: 16, flexDirection: ROW, alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="translate" size={22} color={C.goldDark} />
          </View>
          <T size={19} w="medium" style={{ flex: 1 }}>
            {step.p.ar}
          </T>
        </Card>
      ) : (
        <Card radius={28} style={{ paddingVertical: 20, alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: ROW_EN, alignItems: 'center', gap: 18 }}>
            <SpeakBtn clip={step.p.id} text={step.p.en} size={78} color={accent} />
            <SpeakBtn clip={step.p.id} text={step.p.en} size={52} color={accent} slow />
          </View>
          <T size={14} color={C.sub} center>
            اكتب ما تسمعه بالإنجليزية
          </T>
        </Card>
      )}
      <View style={{ borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 2, borderColor: border, minHeight: 118, padding: 14 }}>
        <TextInput
          value={value}
          onChangeText={(t) => onAnswer(t.trim().length ? t : null)}
          editable={phase === 'answering'}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardType={Platform.OS === 'ios' ? 'ascii-capable' : 'default'}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={onSubmit}
          placeholder="Type in English…"
          placeholderTextColor={C.mute}
          style={{ fontFamily: EN_FONT, fontSize: 20, lineHeight: 28, color: C.ink, textAlign: 'left', writingDirection: 'ltr', minHeight: 86, textAlignVertical: 'top', ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) }}
        />
      </View>
      <T size={12.5} color={C.mute} center>
        لا تهم الأحرف الكبيرة ولا علامات الترقيم · من درس «{lesson.title}»
      </T>
    </View>
  );
}
