/**
 * Paywall Screen — BCCT Coaching
 *
 * BCCT-branded paywall with orange gradient CTA, Dutch copy,
 * Supabase profile update on successful purchase, and coach dashboard navigation.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { PurchasesPackage } from "react-native-purchases";
import { Ionicons } from "@expo/vector-icons";

import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/lib/supabase";
import { bcctColors, bcctTypography } from "@/styles/bcctTheme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const FEATURES = [
  {
    icon: "∞",
    title: "Onbeperkte cliënten",
    description: "Beheer al je cliënten zonder limiet",
  },
  {
    icon: "💬",
    title: "Chat & afspraken",
    description: "Communiceer en plan direct in de app",
  },
  {
    icon: "🧾",
    title: "Facturatie",
    description: "Stuur facturen vanuit de app",
  },
  {
    icon: "📅",
    title: "Agenda koppeling",
    description: "Sync met Google, Apple of Outlook",
  },
];

async function markSubscriptionActive() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    console.warn("[Paywall] No session found when marking subscription active");
    return;
  }
  const updatePayload = {
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  };
  console.log("[Paywall] updating profile (no subscription_plan):", updatePayload);
  const { error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", session.user.id);
  if (error) {
    console.error("[Paywall] Failed to update profile:", error.message);
  } else {
    console.log("[Paywall] Profile updated successfully for user:", session.user.id);
  }
}

export default function PaywallScreen() {
  const router = useRouter();

  const {
    packages,
    loading,
    isSubscribed,
    isWeb,
    purchasePackage,
    restorePurchases,
    mockWebPurchase,
    mockNativePurchase,
  } = useSubscription();

  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(packages[0] || null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [webMockState, setWebMockState] = useState<"idle" | "processing">("idle");
  const [webMockDialogState, setWebMockDialogState] = useState<"hidden" | "selecting" | "failed">("hidden");

  React.useEffect(() => {
    if (packages.length > 0 && !selectedPackage) {
      setSelectedPackage(packages[0]);
    }
  }, [packages, selectedPackage]);

  const navigateAfterSuccess = () => {
    console.log("[Paywall] Purchase/restore successful — navigating to coach dashboard");
    router.replace("/(app)/coach");
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    console.log("[Paywall] Purchase button pressed — package:", selectedPackage.identifier);
    setPurchaseError("");
    try {
      setPurchasing(true);
      const success = await purchasePackage(selectedPackage);
      if (success) {
        console.log("[Paywall] Purchase successful");
        await markSubscriptionActive();
        navigateAfterSuccess();
      } else {
        console.log("[Paywall] Purchase returned false (likely cancelled)");
        setPurchaseError("Abonnement niet geactiveerd");
      }
    } catch (error: any) {
      console.error("[Paywall] Purchase error:", error.message);
      setPurchaseError("Abonnement niet geactiveerd");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    console.log("[Paywall] Restore purchases pressed");
    setPurchaseError("");
    try {
      setRestoring(true);
      const restored = await restorePurchases();
      if (restored) {
        console.log("[Paywall] Restore successful");
        await markSubscriptionActive();
        navigateAfterSuccess();
      } else {
        console.log("[Paywall] No previous purchases found");
        setPurchaseError("Geen actief abonnement gevonden");
      }
    } catch (error: any) {
      console.error("[Paywall] Restore error:", error.message);
      setPurchaseError("Abonnement niet geactiveerd");
    } finally {
      setRestoring(false);
    }
  };

  const handleWebMockPurchase = async () => {
    if (!selectedPackage) return;
    console.log("[Paywall] Web mock purchase pressed");
    setWebMockState("processing");
    await new Promise((resolve) => setTimeout(resolve, 400));
    setWebMockState("idle");
    setWebMockDialogState("selecting");
  };

  // Already subscribed — redirect to dashboard
  if (isSubscribed) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.alreadySubscribedContainer}>
          <Ionicons name="checkmark-circle" size={72} color={bcctColors.success} />
          <Text style={styles.alreadySubscribedTitle}>Je bent al geabonneerd</Text>
          <Text style={styles.alreadySubscribedSubtitle}>
            Je Pro Plan is actief. Ga naar je dashboard.
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => {
              console.log("[Paywall] Already subscribed — go to dashboard pressed");
              router.replace("/(app)/coach");
            }}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaButtonText}>Naar dashboard</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={bcctColors.primaryOrange} />
          <Text style={styles.loadingText}>Laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isButtonDisabled = purchasing || (!selectedPackage && !isWeb);
  const planLabel = "Pro Plan (aanbevolen)";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>PRO</Text>
            </View>
          </View>
          <Text style={styles.title}>Start je coach account</Text>
          <Text style={styles.subtitle}>
            Probeer 7 dagen gratis. Daarna €39,99 per maand.
          </Text>
        </View>

        {/* Plan card */}
        <View style={styles.planCard}>
          <View style={styles.planCardHeader}>
            <View style={styles.planIconWrap}>
              <Ionicons name="star" size={20} color={bcctColors.primaryOrange} />
            </View>
            <Text style={styles.planName}>{planLabel}</Text>
            <View style={styles.planCheckWrap}>
              <Ionicons name="checkmark-circle" size={22} color={bcctColors.primaryOrange} />
            </View>
          </View>
          {packages.length > 0 && packages[0].product.priceString ? (
            <Text style={styles.planPrice}>{packages[0].product.priceString}</Text>
          ) : (
            <Text style={styles.planPrice}>€39,99 / maand</Text>
          )}
          <Text style={styles.planTrialNote}>7 dagen gratis proefperiode</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresCardTitle}>Wat je krijgt</Text>
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Text style={styles.featureIconText}>{feature.icon}</Text>
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* No packages in Expo Go */}
        {!isWeb && packages.length === 0 && !loading && (
          <View style={styles.noPackagesContainer}>
            <Text style={styles.noPackagesText}>
              Aankopen zijn niet beschikbaar in standaard Expo Go.
            </Text>
            <Text style={[styles.noPackagesText, { marginTop: 8, opacity: 0.6 }]}>
              Gebruik een development build om aankopen te testen.
            </Text>
            {__DEV__ && (
              <TouchableOpacity
                style={styles.devMockButton}
                onPress={async () => {
                  console.log("[Paywall] Dev: simulate purchase pressed");
                  await mockNativePurchase();
                  await markSubscriptionActive();
                  navigateAfterSuccess();
                }}
              >
                <Text style={styles.devMockButtonText}>Dev: Simuleer aankoop</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Bottom spacer for fixed CTA */}
        <View style={{ height: 200 }} />
      </ScrollView>

      {/* Fixed bottom CTA */}
      <View style={styles.bottomActions}>
        {/* Error message */}
        {!!purchaseError && (
          <Text style={styles.purchaseError}>{purchaseError}</Text>
        )}

        {/* Web mock flow */}
        {isWeb ? (
          <>
            <TouchableOpacity
              style={[styles.ctaButton, (webMockState === "processing") && styles.buttonDisabled]}
              onPress={handleWebMockPurchase}
              disabled={webMockState === "processing"}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={webMockState === "processing"
                  ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled]
                  : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                {webMockState === "processing" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaButtonText}>Start gratis proefperiode</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.cancelNote}>
              Je kunt op elk moment annuleren via je Apple account.
            </Text>
            <TouchableOpacity
              style={styles.restoreLink}
              onPress={handleRestore}
              disabled={restoring}
              activeOpacity={0.7}
            >
              {restoring ? (
                <ActivityIndicator size="small" color={bcctColors.textSecondary} />
              ) : (
                <Text style={styles.restoreLinkText}>Herstel aankoop</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.ctaButton, isButtonDisabled && styles.buttonDisabled]}
              onPress={handlePurchase}
              disabled={isButtonDisabled}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={isButtonDisabled
                  ? [bcctColors.primaryOrangeDisabled, bcctColors.primaryOrangeDisabled]
                  : [bcctColors.primaryOrange, bcctColors.primaryOrangeDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaButtonText}>Start gratis proefperiode</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.cancelNote}>
              Je kunt op elk moment annuleren via je Apple account.
            </Text>
            <TouchableOpacity
              style={styles.restoreLink}
              onPress={handleRestore}
              disabled={restoring}
              activeOpacity={0.7}
            >
              {restoring ? (
                <ActivityIndicator size="small" color={bcctColors.textSecondary} />
              ) : (
                <Text style={styles.restoreLinkText}>Herstel aankoop</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Web mock dialog */}
      {isWeb && webMockDialogState !== "hidden" && (
        <View style={styles.webDialogOverlay}>
          <View style={styles.webDialogBox}>
            {webMockDialogState === "selecting" && (
              <>
                <Text style={styles.webDialogTitle}>Test aankoop</Text>
                <Text style={styles.webDialogBody}>
                  {`Dit is een testmodus. In productie gebruik je een echte Apple/Google API key.\n\nPackage: ${selectedPackage?.identifier}`}
                </Text>
                <View style={styles.webDialogDivider} />
                <TouchableOpacity
                  style={styles.webDialogButton}
                  onPress={() => setWebMockDialogState("failed")}
                >
                  <Text style={[styles.webDialogButtonText, { color: "#FF3B30" }]}>
                    Test mislukte aankoop
                  </Text>
                </TouchableOpacity>
                <View style={styles.webDialogDivider} />
                <TouchableOpacity
                  style={styles.webDialogButton}
                  onPress={async () => {
                    setWebMockDialogState("hidden");
                    mockWebPurchase();
                    await markSubscriptionActive();
                    navigateAfterSuccess();
                  }}
                >
                  <Text style={[styles.webDialogButtonText, { color: bcctColors.primaryOrange }]}>
                    Test geldige aankoop
                  </Text>
                </TouchableOpacity>
                <View style={styles.webDialogDivider} />
                <TouchableOpacity
                  style={styles.webDialogButton}
                  onPress={() => setWebMockDialogState("hidden")}
                >
                  <Text style={[styles.webDialogButtonText, { color: bcctColors.textSecondary }]}>
                    Annuleren
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {webMockDialogState === "failed" && (
              <>
                <Text style={styles.webDialogTitle}>Aankoop mislukt</Text>
                <Text style={styles.webDialogBody}>
                  Test aankoop mislukt — geen echte transactie uitgevoerd.
                </Text>
                <View style={styles.webDialogDivider} />
                <TouchableOpacity
                  style={styles.webDialogButton}
                  onPress={() => setWebMockDialogState("hidden")}
                >
                  <Text style={[styles.webDialogButtonText, { color: bcctColors.primaryOrange }]}>
                    OK
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: bcctColors.lightBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    ...bcctTypography.body,
    color: bcctColors.textSecondary,
  },
  alreadySubscribedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  alreadySubscribedTitle: {
    ...bcctTypography.h2,
    color: bcctColors.textPrimary,
    textAlign: "center",
  },
  alreadySubscribedSubtitle: {
    ...bcctTypography.body,
    color: bcctColors.textSecondary,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  badgeRow: {
    marginBottom: 16,
  },
  badge: {
    backgroundColor: `${bcctColors.primaryOrange}18`,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${bcctColors.primaryOrange}40`,
  },
  badgeText: {
    ...bcctTypography.small,
    color: bcctColors.primaryOrange,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  title: {
    ...bcctTypography.h1,
    color: bcctColors.textPrimary,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    ...bcctTypography.body,
    color: bcctColors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },

  // Plan card
  planCard: {
    backgroundColor: bcctColors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: bcctColors.primaryOrange,
    shadowColor: bcctColors.primaryOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  planCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  planIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${bcctColors.primaryOrange}18`,
    alignItems: "center",
    justifyContent: "center",
  },
  planName: {
    ...bcctTypography.bodyMedium,
    color: bcctColors.textPrimary,
    flex: 1,
  },
  planCheckWrap: {
    marginLeft: "auto",
  },
  planPrice: {
    ...bcctTypography.h2,
    color: bcctColors.primaryOrange,
    marginBottom: 4,
  },
  planTrialNote: {
    ...bcctTypography.small,
    color: bcctColors.textSecondary,
  },

  // Features card
  featuresCard: {
    backgroundColor: bcctColors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featuresCardTitle: {
    ...bcctTypography.label,
    color: bcctColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${bcctColors.primaryOrange}12`,
    alignItems: "center",
    justifyContent: "center",
  },
  featureIconText: {
    fontSize: 20,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...bcctTypography.bodyMedium,
    color: bcctColors.textPrimary,
  },
  featureDescription: {
    ...bcctTypography.small,
    color: bcctColors.textSecondary,
    marginTop: 2,
  },

  // No packages
  noPackagesContainer: {
    padding: 20,
    alignItems: "center",
    backgroundColor: bcctColors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    marginBottom: 20,
  },
  noPackagesText: {
    ...bcctTypography.small,
    color: bcctColors.textSecondary,
    textAlign: "center",
  },
  devMockButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: bcctColors.borderGray,
    borderStyle: "dashed",
    alignItems: "center",
  },
  devMockButtonText: {
    ...bcctTypography.small,
    color: bcctColors.textSecondary,
  },

  // Bottom CTA
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    backgroundColor: bcctColors.lightBackground,
    borderTopWidth: 1,
    borderTopColor: bcctColors.borderGray,
    gap: 10,
    alignItems: "center",
  },
  purchaseError: {
    ...bcctTypography.small,
    color: bcctColors.error,
    textAlign: "center",
  },
  ctaButton: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: bcctColors.primaryOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaGradient: {
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButtonText: {
    color: "#fff",
    ...bcctTypography.button,
    fontSize: 17,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  cancelNote: {
    ...bcctTypography.small,
    color: bcctColors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  restoreLink: {
    paddingVertical: 4,
  },
  restoreLinkText: {
    ...bcctTypography.small,
    color: bcctColors.textSecondary,
    textDecorationLine: "underline",
  },

  // Web mock dialog
  webDialogOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  webDialogBox: {
    backgroundColor: "#f2f2f7",
    borderRadius: 14,
    width: "85%",
    maxWidth: 400,
    overflow: "hidden",
  },
  webDialogTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    textAlign: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
  },
  webDialogBody: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 20,
    lineHeight: 18,
  },
  webDialogDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  webDialogButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  webDialogButtonText: {
    fontSize: 17,
  },
});
