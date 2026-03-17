
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
const INACTIVE_COLOR = '#8E8E93';

export interface TabBarItem {
  name: string;
  route: Href;
  icon: string;
  label: string;
}

interface FloatingTabBarProps {
  tabs: TabBarItem[];
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const ICON_MAP: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  // folder-based routes
  '(home)': { active: 'home', inactive: 'home-outline' },
  home: { active: 'home', inactive: 'home-outline' },
  index: { active: 'home', inactive: 'home-outline' },
  chat: { active: 'chatbubble', inactive: 'chatbubble-outline' },
  documenten: { active: 'folder', inactive: 'folder-outline' },
  documents: { active: 'folder', inactive: 'folder-outline' },
  folder: { active: 'folder', inactive: 'folder-outline' },
  files: { active: 'folder', inactive: 'folder-outline' },
  profiel: { active: 'person', inactive: 'person-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
  person: { active: 'person', inactive: 'person-outline' },
  settings: { active: 'person', inactive: 'person-outline' },
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

  const safeBottom = insets.bottom;

  return (
    <View style={styles.container}>
      <View style={[styles.tabsRow, { paddingBottom: safeBottom }]}>
        {tabs.map((tab, index) => {
          const isActive = activeTabIndex === index;
          if (!ICON_MAP[tab.icon] && !ICON_MAP[tab.name]) {
            console.warn('FloatingTabBar: unknown tab key:', tab.icon, tab.name);
          }
          const iconConfig = ICON_MAP[tab.icon] ?? ICON_MAP[tab.name] ?? { active: 'ellipse' as IoniconsName, inactive: 'ellipse-outline' as IoniconsName };
          const iconName = isActive ? iconConfig.active : iconConfig.inactive;
          const iconColor = isActive ? '#FFFFFF' : INACTIVE_COLOR;
          const labelColor = isActive ? BRAND_ORANGE : INACTIVE_COLOR;

          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tab}
              onPress={() => handleTabPress(tab.route, tab.label)}
              activeOpacity={0.7}
            >
              <View style={styles.tabInner}>
                <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                  <Ionicons name={iconName} size={24} color={iconColor} />
                </View>
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
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 1,
    borderTopColor: '#E6EAF0',
    paddingTop: 8,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: BRAND_ORANGE,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  tabLabelActive: {
    fontWeight: '500',
  },
});
