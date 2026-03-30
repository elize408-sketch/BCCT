import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { markOnboardingDone } from '@/utils/tipsStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ORANGE = '#F28C28';

const SCREENS = [
  {
    id: 1,
    icon: 'home-outline' as const,
    title: 'Welkom bij jouw coaching dashboard',
    subtitle: 'Breng structuur en rust in je praktijk',
    bg: '#FFF7ED',
    isCTA: false,
  },
  {
    id: 2,
    icon: 'people-outline' as const,
    title: 'Beheer je cliënten eenvoudig',
    subtitle: 'Houd overzicht en werk professioneel',
    bg: '#FFF7ED',
    isCTA: false,
  },
  {
    id: 3,
    icon: 'calendar-outline' as const,
    title: 'Plan afspraken en blijf verbonden',
    subtitle: 'Alles op één plek',
    bg: '#FFF7ED',
    isCTA: false,
  },
  {
    id: 4,
    icon: 'rocket-outline' as const,
    title: 'Klaar om te starten?',
    subtitle: 'Voeg je eerste cliënt toe en begin vandaag',
    bg: '#FFF7ED',
    isCTA: true,
  },
];

export default function CoachWelcomeOnboarding() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const currentScreen = SCREENS[currentIndex];

  const handleFinish = async () => {
    console.log('[CoachWelcomeOnboarding] Finishing onboarding, marking done');
    await markOnboardingDone();
    router.replace('/(tabs)');
  };

  const handleSkip = async () => {
    console.log('[CoachWelcomeOnboarding] Skip pressed at screen:', currentIndex + 1);
    await markOnboardingDone();
    router.replace('/(tabs)');
  };

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    console.log('[CoachWelcomeOnboarding] Next pressed, going to screen:', nextIndex + 1);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -30,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentIndex(nextIndex);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const isLast = currentIndex === SCREENS.length - 1;
  const showSkip = !isLast;

  return (
    <View style={[styles.container, { backgroundColor: currentScreen.bg }]}>
      <SafeAreaView style={styles.safeArea}>
        {/* Skip button */}
        <View style={styles.topBar}>
          {showSkip ? (
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipText}>Overslaan</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.skipButton} />
          )}
        </View>

        {/* Animated content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.iconContainer}>
            <Ionicons name={currentScreen.icon} size={80} color={ORANGE} />
          </View>
          <Text style={styles.title}>{currentScreen.title}</Text>
          <Text style={styles.subtitle}>{currentScreen.subtitle}</Text>
        </Animated.View>

        {/* Bottom area */}
        <View style={styles.bottom}>
          {/* Dot indicators */}
          <View style={styles.dotsRow}>
            {SCREENS.map((_, i) => {
              const isActive = i === currentIndex;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    isActive ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              );
            })}
          </View>

          {/* CTA / Next button */}
          {isLast ? (
            <TouchableOpacity style={styles.ctaButton} onPress={handleFinish} activeOpacity={0.85}>
              <Text style={styles.ctaButtonText}>Start met je eerste cliënt</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
              <Text style={styles.nextButtonText}>Volgende</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={styles.nextIcon} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 80,
    alignItems: 'flex-end',
  },
  skipText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FEE9D1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
    gap: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: ORANGE,
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#E5E7EB',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: SCREEN_WIDTH - 48,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  nextIcon: {
    marginLeft: 8,
  },
  ctaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: SCREEN_WIDTH - 48,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
