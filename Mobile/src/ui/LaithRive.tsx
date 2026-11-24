import Constants, { ExecutionEnvironment } from 'expo-constants';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

import type { Mood, Who, Zone } from './Laith';

/*
 * The Rive engine for Laith and the lioness on iOS and Android.
 *
 * It plays assets/rive/laith.riv (made by design/laith/build_riv.py) through @rive-app/react-native,
 * the official native runtime. That library is native code, so it exists only in a real build of
 * the app (the IPA / APK from .github/workflows/mobile.yml), not in Expo Go. Wherever it is missing,
 * or the file fails to load, RIVE_AVAILABLE is false or onFail fires, and <Laith /> draws the
 * characters with its SVG engine instead — same moods, same touch reactions.
 *
 * The file's own touch listeners are not used here: touches never reach the native view (the
 * parent Pressable owns them), so the app decides what a touch means and fires the trigger itself.
 */

type RiveModule = typeof import('@rive-app/react-native');

function loadRive(): RiveModule | null {
  // Expo Go has no Rive native code; requiring the library there would throw
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    return require('@rive-app/react-native') as RiveModule;
  } catch {
    return null;
  }
}

const Rive = loadRive();
export const RIVE_AVAILABLE = Rive != null;

const FILE = require('../../assets/rive/laith.riv');
const MOODS: Mood[] = ['idle', 'wait', 'happy', 'sad', 'cheer', 'listen', 'wave'];
const TRIGGER: Record<Zone, string> = { head: 'pat', tail: 'tail', book: 'book' };
const MACHINE = 'Mood';
/** If the view has not reported ready by then, give up and draw the SVG version. */
const READY_TIMEOUT_MS = 6000;

export type RiveProps = {
  mood: Mood;
  size: number;
  who: Who;
  flip?: boolean;
  /** Filled in with a function that plays the reaction for a touched zone. */
  fire: React.MutableRefObject<((zone: Zone) => void) | null>;
  onReady: () => void;
  /** The runtime or the file could not be loaded: the caller falls back to the drawn version. */
  onFail: () => void;
};

export function LaithRive(props: RiveProps) {
  if (!Rive) return null;
  return <NativeLaith {...props} rive={Rive} />;
}

function NativeLaith({ mood, size, who, flip, fire, onReady, onFail, rive }: RiveProps & { rive: RiveModule }) {
  const { riveFile, error } = rive.useRiveFile(FILE);
  const { riveViewRef, setHybridRef } = rive.useRive();
  const callbacks = useRef({ onReady, onFail });
  callbacks.current = { onReady, onFail };
  // Laith has a mirrored artboard whose book still reads; the lioness is simply flipped.
  const artboard = who === 'lioness' ? 'Lioness' : flip ? 'LaithMirror' : 'Laith';

  useEffect(() => {
    if (error || riveViewRef === null) callbacks.current.onFail();
  }, [error, riveViewRef]);

  useEffect(() => {
    if (riveViewRef) return;
    const t = setTimeout(() => callbacks.current.onFail(), READY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [riveViewRef]);

  useEffect(() => {
    if (!riveViewRef) return;
    callbacks.current.onReady();
  }, [riveViewRef]);

  useEffect(() => {
    if (!riveViewRef) return;
    const apply = () => {
      try {
        riveViewRef.setNumberInputValue('mood', MOODS.indexOf(mood));
      } catch (e) {
        console.warn('[Laith] mood input failed:', e);
      }
    };
    apply();
    // the native view can rebuild its state machine right after it reports ready (a reload when its
    // surface arrives), which would drop the value set above; set it again once things settle
    const timers = [setTimeout(apply, 400), setTimeout(apply, 1500)];
    fire.current = (zone) => {
      try {
        riveViewRef.triggerInput(TRIGGER[zone]);
      } catch (e) {
        console.warn('[Laith] trigger failed:', zone, e);
      }
    };
    return () => {
      timers.forEach(clearTimeout);
      fire.current = null;
    };
  }, [mood, riveViewRef, fire]);

  if (!riveFile) return null;
  return (
    <View style={{ width: size, height: size, transform: who === 'lioness' && flip ? [{ scaleX: -1 }] : undefined }}>
      <rive.RiveView
        file={riveFile}
        artboardName={artboard}
        stateMachineName={MACHINE}
        autoPlay
        fit={rive.Fit.Contain}
        hybridRef={setHybridRef}
        onError={() => callbacks.current.onFail()}
        style={{ width: size, height: size }}
      />
    </View>
  );
}
