import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton, Card, Icon } from '../../src/components/ui';
import { colors } from '../../src/theme/tokens';

/**
 * A10.1 + A10.2 Legal screens — Terms of Service + Privacy Policy.
 *
 * Two routes funnel through one file via the [type] dynamic segment:
 *   /legal/terms    → t('legal.terms.*')
 *   /legal/privacy  → t('legal.privacy.*')
 *
 * Content lives in i18n keys for now. Once the lawyer-reviewed final
 * documents land (Phase 6), we'll either:
 *   (a) keep them in i18n if AZ/RU/EN versions are maintained as a
 *       single source of truth, or
 *   (b) swap to a backend-served format with versioning (the spec
 *       mentions a "T&C / Privacy editor (versioned)" feature deferred
 *       from Phase 1.10c).
 *
 * Either way, this screen scaffold doesn't change — only the content
 * source does.
 */
export default function LegalScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ type: string }>();
  const type = params.type === 'privacy' ? 'privacy' : 'terms';
  const k = `legal.${type}`;

  const sections = collectSections(t, k);
  const fullUrl = type === 'privacy' ? 'https://tahawash.az/privacy' : 'https://tahawash.az/terms';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <BackButton onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
      >
        <Text
          style={{
            paddingHorizontal: 4,
            fontFamily: 'Inter_800ExtraBold',
            fontSize: 28,
            letterSpacing: -0.8,
            color: colors.ink[900],
          }}
        >
          {t(`${k}.title`)}
        </Text>
        <Text
          style={{
            marginTop: 6,
            paddingHorizontal: 4,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            color: colors.ink[500],
          }}
        >
          {t(`${k}.lastUpdated`)}
        </Text>

        <View style={{ height: 16 }} />

        <Card>
          {sections.map((sec, i) => (
            <View key={i} style={{ marginTop: i === 0 ? 0 : 18 }}>
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontSize: 16,
                  color: colors.ink[900],
                  letterSpacing: -0.2,
                }}
              >
                {sec.heading}
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 14,
                  lineHeight: 22,
                  color: colors.ink[700],
                }}
              >
                {sec.body}
              </Text>
            </View>
          ))}
        </Card>

        <Pressable
          onPress={() => void Linking.openURL(fullUrl)}
          hitSlop={4}
          style={({ pressed }) => [{ marginTop: 14, opacity: pressed ? 0.7 : 1 }]}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: 12,
            }}
          >
            <Text
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.brand[600] }}
            >
              {t('legal.viewFullOnline')}
            </Text>
            <Icon name="arrowRight" size={14} color={colors.brand[600]} stroke={2} />
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Walk keys `${prefix}.section{N}.heading` / `.body` until the next
 * pair isn't translated (i.e. returns the key path itself). Lets us
 * grow the document by adding entries to az/ru/en.json without
 * touching this file.
 */
function collectSections(
  t: (key: string) => string,
  prefix: string,
): Array<{ heading: string; body: string }> {
  const out: Array<{ heading: string; body: string }> = [];
  for (let i = 1; i <= 20; i++) {
    const headingKey = `${prefix}.section${i}.heading`;
    const bodyKey = `${prefix}.section${i}.body`;
    const heading = t(headingKey);
    const body = t(bodyKey);
    if (heading === headingKey || body === bodyKey) break;
    out.push({ heading, body });
  }
  return out;
}
