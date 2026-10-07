import { useEffect, useState } from 'react';
import { canPrompt, isIos, isStandalone, promptInstall, subscribeInstall } from '../services/installService';

export function useInstall() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeInstall(() => setTick((n) => n + 1)), []);
  return { standalone: isStandalone(), canPrompt: canPrompt(), ios: isIos(), prompt: promptInstall };
}