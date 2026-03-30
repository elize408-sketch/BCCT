import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import {
  getCompletedSteps,
  markStepComplete as persistMarkStepComplete,
  toggleStep as persistToggleStep,
  TipStepId,
} from '@/utils/tipsStorage';

const TOTAL_STEPS = 5;
const ORANGE = '#F28C28';

interface TipsContextValue {
  completedSteps: TipStepId[];
  markComplete: (id: TipStepId) => Promise<void>;
  toggleComplete: (id: TipStepId) => Promise<void>;
  isComplete: (id: TipStepId) => boolean;
  progress: { completed: number; total: number };
}

const TipsContext = createContext<TipsContextValue>({
  completedSteps: [],
  markComplete: async () => {},
  toggleComplete: async () => {},
  isComplete: () => false,
  progress: { completed: 0, total: TOTAL_STEPS },
});

export function useTips(): TipsContextValue {
  return useContext(TipsContext);
}

export function TipsProvider({ children }: { children: React.ReactNode }) {
  const [completedSteps, setCompletedSteps] = useState<TipStepId[]>([]);
  const [toastVisible, setToastVisible] = useState(false);
  const toastAnim = useRef(new Animated.Value(80)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    console.log('[TipsContext] Loading completed steps from storage');
    getCompletedSteps().then((steps) => {
      console.log('[TipsContext] Loaded completed steps:', steps);
      setCompletedSteps(steps);
    });
  }, []);

  const showToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastAnim.setValue(80);
    toastOpacity.setValue(0);
    setToastVisible(true);

    Animated.parallel([
      Animated.spring(toastAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }),
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    toastTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastAnim, {
          toValue: 80,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToastVisible(false);
      });
    }, 2000);
  };

  const markComplete = async (id: TipStepId) => {
    console.log('[TipsContext] markComplete called for:', id);
    if (completedSteps.includes(id)) {
      console.log('[TipsContext] Step already complete, skipping:', id);
      return;
    }
    await persistMarkStepComplete(id);
    setCompletedSteps((prev) => [...prev, id]);
    showToast();
  };

  const toggleComplete = async (id: TipStepId) => {
    console.log('[TipsContext] toggleComplete called for:', id);
    const updated = await persistToggleStep(id);
    setCompletedSteps(updated);
    if (updated.includes(id)) {
      showToast();
    }
  };

  const isComplete = (id: TipStepId): boolean => completedSteps.includes(id);

  const progress = { completed: completedSteps.length, total: TOTAL_STEPS };

  return (
    <TipsContext.Provider value={{ completedSteps, markComplete, toggleComplete, isComplete, progress }}>
      {children}
      {toastVisible && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastAnim }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>Goed bezig! 🎉</Text>
        </Animated.View>
      )}
    </TipsContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: ORANGE,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 9999,
  },
  toastText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
