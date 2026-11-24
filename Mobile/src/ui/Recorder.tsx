import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';

import { playUri, sfx, speak, stopAudio, usePlaying } from '../lib/audio';
import { haptic } from '../lib/haptics';
import { PERSISTENT, keepRecording, recordingUri } from '../lib/recStore';
import { useStore } from '../state/store';
import { C, ROW } from '../theme';
import { Icon, T, Tap } from './kit';

const MAX_MS = 20000;
const BARS = 22;

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function Meter({ levels, color }: { levels: number[]; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: 40, flex: 1 }}>
      {levels.map((v, i) => (
        <View key={i} style={{ width: 4, height: 5 + v * 33, borderRadius: 2, backgroundColor: color, opacity: 0.35 + v * 0.65 }} />
      ))}
    </View>
  );
}

function MiniBtn({ icon, label, onPress, color, active }: { icon: string; label: string; onPress: () => void; color: string; active?: boolean }) {
  return (
    <Tap onPress={onPress} scale={0.9} feel="soft" style={{ alignItems: 'center', gap: 4, minWidth: 62 }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: active ? color : 'rgba(255,255,255,0.9)', borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color={active ? C.white : color} />
      </View>
      <T size={12} w="medium" color={C.sub} center style={{ lineHeight: 16 }}>
        {label}
      </T>
    </Tap>
  );
}

/**
 * Record yourself saying a sentence, keep the take on the device, and play it back — alone or
 * straight after the reference voice. One take per sentence; a new take replaces the old one.
 */
export function Recorder({ phraseId, accent = C.red }: { phraseId: string; accent?: string }) {
  const { s, saveRecording, removeRecording } = useStore();
  const saved = s.recordings[phraseId];
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 90);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const recording = state.isRecording;
  const active = useRef(false);
  const mineKey = `mine:${phraseId}`;
  const cmpKey = `cmp:${phraseId}`;
  const playingMine = usePlaying(mineKey);
  const comparing = usePlaying(cmpKey);

  // Live level meter. Web has no metering, so it gets a gentle idle wave instead.
  useEffect(() => {
    if (!recording) return;
    const db = state.metering;
    const level = db == null ? 0.25 + Math.random() * 0.5 : Math.max(0, Math.min(1, (db + 55) / 50));
    setLevels((prev) => [...prev.slice(1), level]);
  }, [state.durationMillis, state.metering, recording]);

  const halo = useSharedValue(0);
  useEffect(() => {
    halo.value = recording ? withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), -1, false) : withTiming(0, { duration: 150 });
  }, [recording, halo]);
  const haloStyle = useAnimatedStyle(() => ({ opacity: recording ? 0.5 * (1 - halo.value) : 0, transform: [{ scale: 1 + halo.value * 0.7 }] }));
  const press = useSharedValue(0);
  const micStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.1 }] }));

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setNote('اسمح للتطبيق باستخدام الميكروفون من إعدادات الجهاز لتسجيل صوتك.');
        haptic.warn();
        return;
      }
      stopAudio();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      setLevels(Array(BARS).fill(0));
      recorder.record();
      active.current = true;
      haptic.press();
      sfx('start');
    } catch {
      setNote('تعذّر بدء التسجيل. تأكد من أن الميكروفون غير مستخدم في تطبيق آخر.');
    } finally {
      setBusy(false);
    }
  };

  const stop = async (keep = true) => {
    if (!active.current) return;
    active.current = false;
    setBusy(true);
    try {
      const ms = recorder.currentTime * 1000 || state.durationMillis;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      const uri = recorder.uri;
      if (!keep || !uri) return;
      if (ms < 500) {
        setNote('التسجيل قصير جدًا. اضغط وتكلّم ثم أوقف التسجيل.');
        return;
      }
      const file = await keepRecording(phraseId, uri);
      saveRecording(phraseId, { file, ms: Math.round(ms), at: Date.now() });
      haptic.success();
      setNote(null);
    } catch {
      setNote('تعذّر حفظ التسجيل على الجهاز.');
    } finally {
      setBusy(false);
    }
  };

  // Stop on the time limit, and never leave the microphone open after the view goes away.
  useEffect(() => {
    if (recording && state.durationMillis >= MAX_MS) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.durationMillis, recording]);
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => () => void stopRef.current(false), []);
  useEffect(() => {
    if (active.current) stopRef.current(false);
    setNote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phraseId]);

  const playMine = (key = mineKey) => {
    if (!saved) return;
    const uri = recordingUri(saved.file);
    if (!uri) {
      removeRecording(phraseId);
      setNote(PERSISTENT ? 'ملف التسجيل لم يعد موجودًا. سجّل من جديد.' : 'في معاينة المتصفح تبقى التسجيلات حتى إغلاق الصفحة فقط.');
      return;
    }
    playUri(uri, key);
  };

  return (
    <View style={{ borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: C.hairline, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: ROW, alignItems: 'center', gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recording ? 'إيقاف التسجيل' : 'تسجيل صوتي'}
          disabled={busy}
          onPressIn={() => {
            press.value = withTiming(1, { duration: 70 });
          }}
          onPressOut={() => {
            press.value = withSpring(0, { damping: 10, stiffness: 300 });
          }}
          onPress={() => (recording ? stop() : start())}>
          <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[{ position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: accent }, haloStyle]} />
            <Animated.View style={[{ width: 64, height: 64, borderRadius: 32, backgroundColor: recording ? accent : C.white, borderWidth: 2, borderColor: accent, alignItems: 'center', justifyContent: 'center' }, micStyle]}>
              <Icon name={recording ? 'stop' : 'microphone'} size={30} color={recording ? C.white : accent} />
            </Animated.View>
          </View>
        </Pressable>

        {recording ? (
          <>
            <Meter levels={levels} color={accent} />
            <T size={15} w="bold" color={accent} style={{ minWidth: 40, fontVariant: ['tabular-nums'] }}>
              {clock(state.durationMillis)}
            </T>
          </>
        ) : saved ? (
          <View style={{ flex: 1, flexDirection: ROW, alignItems: 'flex-start', justifyContent: 'space-around' }}>
            <MiniBtn icon={playingMine ? 'pause' : 'play'} label={`تسجيلي ${clock(saved.ms)}`} color={C.green} active={playingMine} onPress={() => (playingMine ? stopAudio() : playMine())} />
            <MiniBtn
              icon="compare-horizontal"
              label="قارن بالأصل"
              color={C.blue}
              active={comparing}
              onPress={() => {
                if (comparing) return stopAudio();
                // reference voice first, then the learner's take, back to back
                if (!speak(phraseId, { key: cmpKey, then: () => playMine(cmpKey) })) playMine(cmpKey);
              }}
            />
            <MiniBtn
              icon="trash-can-outline"
              label="حذف"
              color={C.mute}
              onPress={() => {
                stopAudio();
                removeRecording(phraseId);
                haptic.soft();
              }}
            />
          </View>
        ) : (
          <View style={{ flex: 1, gap: 2 }}>
            <T size={15} w="bold">
              سجّل الجملة بصوتك
            </T>
            <T size={13} color={C.sub} style={{ lineHeight: 19 }}>
              يُحفظ التسجيل داخل جهازك فقط لتسمعه وتقارنه متى شئت.
            </T>
          </View>
        )}
      </View>
      {recording ? (
        <T size={13} color={C.sub} center>
          جارٍ التسجيل… اضغط الزر للإيقاف والحفظ
        </T>
      ) : note ? (
        <T size={13} color={C.redDark} center>
          {note}
        </T>
      ) : saved ? (
        <T size={12} color={C.mute} center>
          {PERSISTENT ? 'محفوظ على جهازك · اضغط الميكروفون لتسجيل محاولة جديدة' : 'معاينة المتصفح: يبقى التسجيل حتى إغلاق الصفحة'}
        </T>
      ) : null}
    </View>
  );
}
