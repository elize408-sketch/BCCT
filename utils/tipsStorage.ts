import AsyncStorage from '@react-native-async-storage/async-storage';

const COMPLETED_STEPS_KEY = 'tips_completed_steps';
const ONBOARDING_DONE_KEY = 'tips_onboarding_done';

export type TipStepId = 'add_client' | 'plan_appointment' | 'use_chat' | 'create_module' | 'ask_feedback';

export async function getCompletedSteps(): Promise<TipStepId[]> {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_STEPS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TipStepId[];
  } catch (e) {
    console.error('[tipsStorage] getCompletedSteps error:', e);
    return [];
  }
}

export async function markStepComplete(id: TipStepId): Promise<void> {
  try {
    const current = await getCompletedSteps();
    if (current.includes(id)) return;
    const updated = [...current, id];
    await AsyncStorage.setItem(COMPLETED_STEPS_KEY, JSON.stringify(updated));
    console.log('[tipsStorage] Marked step complete:', id);
  } catch (e) {
    console.error('[tipsStorage] markStepComplete error:', e);
  }
}

export async function unmarkStepComplete(id: TipStepId): Promise<void> {
  try {
    const current = await getCompletedSteps();
    const updated = current.filter((s) => s !== id);
    await AsyncStorage.setItem(COMPLETED_STEPS_KEY, JSON.stringify(updated));
    console.log('[tipsStorage] Unmarked step complete:', id);
  } catch (e) {
    console.error('[tipsStorage] unmarkStepComplete error:', e);
  }
}

export async function toggleStep(id: TipStepId): Promise<TipStepId[]> {
  try {
    const current = await getCompletedSteps();
    let updated: TipStepId[];
    if (current.includes(id)) {
      updated = current.filter((s) => s !== id);
      console.log('[tipsStorage] Toggled step OFF:', id);
    } else {
      updated = [...current, id];
      console.log('[tipsStorage] Toggled step ON:', id);
    }
    await AsyncStorage.setItem(COMPLETED_STEPS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('[tipsStorage] toggleStep error:', e);
    return await getCompletedSteps();
  }
}

export async function isOnboardingDone(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
    return value === 'true';
  } catch (e) {
    console.error('[tipsStorage] isOnboardingDone error:', e);
    return false;
  }
}

export async function markOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    console.log('[tipsStorage] Marked onboarding done');
  } catch (e) {
    console.error('[tipsStorage] markOnboardingDone error:', e);
  }
}

export async function resetAll(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([COMPLETED_STEPS_KEY, ONBOARDING_DONE_KEY]);
    console.log('[tipsStorage] Reset all tips storage');
  } catch (e) {
    console.error('[tipsStorage] resetAll error:', e);
  }
}
