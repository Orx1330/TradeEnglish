import React, { useMemo, useState } from 'react';
import { FlatList, Platform, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LESSONS, PHRASES, Phrase, UNITS, VOICES, lessonOf } from '../data/course';
import { voicesFor } from '../lib/audio';
import { isUnlocked, useStore } from '../state/store';
import { C, F, RIGHT, ROW, ROW_EN } from '../theme';
import { Card } from '../ui/Glass';
import { Recorder } from '../ui/Recorder';
import { Chip, E, Icon, SpeakBtn, T, Tap } from '../ui/kit';
import { Sheet, WordLine } from '../ui/parts';

type Filter = 'all' | 'fav' | 'rec';

/* ---------- one sentence in detail ---------- */
function PhraseDetail({ p }: { p: Phrase }) {
  const { s, toggleFavorite } = useStore();
  const lesson = lessonOf(p.id);
  const unit = UNITS[lesson.unit];
  const fav = s.favorites.includes(p.id);
  const available = voicesFor(p.id);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: 8, backgroundColor: unit.soft, paddingHorizontal: 12, height: 30, borderRadius: 15 }}>
          <Icon name={lesson.icon} size={15} color={unit.dark} />
          <T size={13} w="bold" color={unit.dark} style={{ lineHeight: 18 }}>
            {lesson.title}
          </T>
        </View>
        <Tap onPress={() => toggleFavorite(p.id)} scale={0.8} label="المفضلة">
          <Icon name={fav ? 'heart' : 'heart-outline'} size={28} color={fav ? '#E2607C' : C.mute} />
        </Tap>
      </View>
      <WordLine en={p.en} size={25} />
      <T size={18} w="medium" color={C.sub}>
        {p.ar}
      </T>
      <View style={{ flexDirection: ROW_EN, alignItems: 'center', gap: 12 }}>
        <SpeakBtn clip={p.id} text={p.en} size={56} color={unit.color} />
        <SpeakBtn clip={p.id} text={p.en} size={46} color={unit.color} slow />
      </View>
      <View style={{ gap: 8 }}>
        <T size={14} w="bold" color={C.sub}>
          اسمعها بأصوات مختلفة
        </T>
        <View style={{ flexDirection: ROW_EN, flexWrap: 'wrap', gap: 8 }}>
          {VOICES.filter((v) => available.includes(v.id)).map((v) => (
            <View key={v.id} style={{ flexDirection: ROW_EN, alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 20, paddingLeft: 4, paddingRight: 12, height: 40, borderWidth: 1, borderColor: C.hairline }}>
              <SpeakBtn clip={p.id} voice={v.id} size={32} color={unit.color} />
              <T size={13} w="medium" style={{ lineHeight: 18 }}>
                {v.name}
              </T>
            </View>
          ))}
        </View>
      </View>
      <Recorder phraseId={p.id} />
    </View>
  );
}

const Row = React.memo(function Row({ p, fav, rec, onOpen, onFav }: { p: Phrase; fav: boolean; rec: boolean; onOpen: (p: Phrase) => void; onFav: (id: string) => void }) {
  const unit = UNITS[lessonOf(p.id).unit];
  return (
    <Tap onPress={() => onOpen(p)} scale={0.98} style={{ marginBottom: 10 }} plain>
      <Card radius={20} style={{ padding: 12, flexDirection: ROW_EN, alignItems: 'center', gap: 10 }}>
        <SpeakBtn clip={p.id} text={p.en} size={40} color={unit.color} />
        <View style={{ flex: 1 }}>
          <E size={15.5} bold>
            {p.en}
          </E>
          <T size={13.5} color={C.sub} style={{ lineHeight: 20 }}>
            {p.ar}
          </T>
        </View>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Tap onPress={() => onFav(p.id)} scale={0.8} label="المفضلة">
            <Icon name={fav ? 'heart' : 'heart-outline'} size={22} color={fav ? '#E2607C' : C.mute} />
          </Tap>
          {rec ? <Icon name="microphone" size={17} color={C.red} /> : null}
        </View>
      </Card>
    </Tap>
  );
});

export function PhrasebookScreen() {
  const insets = useSafeAreaInsets();
  const { s, toggleFavorite } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Phrase | null>(null);
  const [shown, setShown] = useState<Phrase | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PHRASES.filter((p) => {
      if (filter === 'fav' && !s.favorites.includes(p.id)) return false;
      if (filter === 'rec' && !s.recordings[p.id]) return false;
      return !q || p.en.toLowerCase().includes(q) || p.ar.includes(q);
    });
  }, [query, filter, s.favorites, s.recordings]);

  const unlockedCount = LESSONS.filter((l) => isUnlocked(s, l.id)).length * 6;
  const openPhrase = (p: Phrase) => {
    setShown(p);
    setOpen(p);
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={9}
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 18, paddingBottom: insets.bottom + 130 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 14 }}>
            <View>
              <T size={30} w="black">
                قاموس الجمل
              </T>
              <T size={15} color={C.sub}>
                {PHRASES.length} جملة تجارية · {unlockedCount} منها ضمن دروسك المفتوحة
              </T>
            </View>
            <Card radius={20} color={C.surfaceStrong} style={{ flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 52 }}>
              <Icon name="magnify" size={22} color={C.mute} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="ابحث بالعربية أو الإنجليزية"
                placeholderTextColor={C.mute}
                autoCorrect={false}
                style={{ flex: 1, fontFamily: F.regular, fontSize: 16, color: C.ink, textAlign: RIGHT, height: 52, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) }}
              />
              {query ? (
                <Tap onPress={() => setQuery('')} scale={0.8} label="مسح البحث">
                  <Icon name="close-circle" size={20} color={C.mute} />
                </Tap>
              ) : null}
            </Card>
            <View style={{ flexDirection: ROW, gap: 8 }}>
              <Chip label="الكل" active={filter === 'all'} onPress={() => setFilter('all')} />
              <Chip label={`المفضلة ${s.favorites.length}`} icon="heart" color="#D9567A" active={filter === 'fav'} onPress={() => setFilter('fav')} />
              <Chip label={`تسجيلاتي ${Object.keys(s.recordings).length}`} icon="microphone" color={C.red} active={filter === 'rec'} onPress={() => setFilter('rec')} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', gap: 8, paddingTop: 40 }}>
            <Icon name={filter === 'rec' ? 'microphone-off' : filter === 'fav' ? 'heart-outline' : 'text-search'} size={46} color={C.mute} />
            <T size={16} color={C.sub} center>
              {filter === 'rec' ? 'لم تسجّل أي جملة بعد. افتح جملة واضغط الميكروفون.' : filter === 'fav' ? 'اضغط القلب بجانب أي جملة لحفظها هنا.' : 'لا توجد جمل تطابق بحثك.'}
            </T>
          </View>
        }
        renderItem={({ item }) => <Row p={item} fav={s.favorites.includes(item.id)} rec={!!s.recordings[item.id]} onOpen={openPhrase} onFav={toggleFavorite} />}
      />
      <Sheet visible={!!open} onClose={() => setOpen(null)} tint={shown ? UNITS[lessonOf(shown.id).unit].color : undefined}>
        {shown ? <PhraseDetail p={shown} /> : null}
      </Sheet>
    </View>
  );
}
