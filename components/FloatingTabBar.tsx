
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Href } from 'expo-router';

const BRAND_ORANGE = '#F28C28';
const INACTIVE_COLOR = '#9CA3AF';
const ACTIVE_BG = 'rgba(242, 140, 40, 0.12)';

export interface TabBarItem {
  name: string;
  route: Href;
  icon: 'home' | 'chat' | 'documenten' | 'profiel';
  label: string;
}

interface FloatingTabBarProps {
  tabs: TabBarItem[];
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const ICON_MAP: Record<TabBarItem['icon'], { active: IoniconsName; inactive: IoniconsName }> = {
  home: { active: 'home', inactive: 'home-outline' },
  chat: { active: 'chatbubble', inactive: 'chatbubble-outline' },
  documenten: { active: 'folder', inactive: 'folder-outline' },
  profiel: { active: 'person', inactive: 'person-outline' },
};

export default function FloatingTabBar({ tabs }: FloatingTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const activeTabIndex = React.useMemo(() => {
    let bestMatch = -1;
    let bestMatchScore = 0;

    tabs.forEach((tab, index) => {
      let score = 0;
      if (pathname === tab.route) {
        score = 100;
      } else if (pathname.startsWith(tab.route as string)) {
        score = 80;
      } else if (pathname.includes(tab.name)) {
        score = 60;
      }
      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatch = index;
      }
    });

    return bestMatch >= 0 ? bestMatch : 0;
  }, [pathname, tabs]);

  const handleTabPress = (route: Href, label: string) => {
    console.log(`[TabBar] Tab pressed: ${label} → ${String(route)}`);
    router.push(route);
  };

  const paddingBottom = insets.bottom > 0 ? insets.bottom : 12;

  return (
    <View style={[styles.container, { paddingBottom }]}>
      <View style={styles.tabsRow}>
        {tabs.map((tab, index) => {
          const isActive = activeTabIndex === index;
          const iconName = isActive ? ICON_MAP[tab.icon].active : ICON_MAP[tab.icon].inactive;
          const iconColor = isActive ? BRAND_ORANGE : INACTIVE_COLOR;
          const labelColor = isActive ? BRAND_ORANGE : INACTIVE_COLOR;

          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tab}
              onPress={() => handleTabPress(tab.route, tab.label)}
              activeOpacity={0.7}
            >
              <View style={[styles.tabInner, isActive && styles.tabInnerActive]}>
                <Ionicons name={iconName} size={24} color={iconColor} />
                <Text style={[styles.tabLabel, { color: labelColor }, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 3,
  },
  tabInnerActive: {
    backgroundColor: ACTIVE_BG,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  tabLabelActive: {
    fontWeight: '600',
  },
});
