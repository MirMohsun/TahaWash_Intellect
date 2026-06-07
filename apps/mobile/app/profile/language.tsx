import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton, Card, Icon } from '../../src/components/ui';
import { useUpdateMe } from '../../src/hooks/use-me';
import { setStoredLanguage } from '../../src/lib/language-store';
import { colors } from '../../src/theme/tokens';

/**
 * A9.3 Language picker.
 *
 * Tap a language → call i18next.changeLanguage immediately (UI flips)
 * AND PATCH /me with the new language so the server remembers (push
 * notifications, future emails localize to the customer's actual
 * preference, not just the device).
 *
 * The PATCH is fire-and-forget — local UI doesn't wait. If the
 * network is down the picker still works locally; the server will
 * pick up the language on the next /me write.
 */
const LANGUAGES: ReadonlyArray<{
  code: 'az' | 'ru' | 'en';
  nativeName: string;
  englishName: string;
}> = [
  { code: 'az', nativeName: 'Azərbaycan dili', englishName: 'Azerbaijani' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian' },
  { code: 'en', nativeName: 'English', englishName: 'English' },
];

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const updateMe = useUpdateMe();
  const current = (i18n.resolvedLanguage ?? 'az') as 'az' | 'ru' | 'en';

  const pick = async (code: 'az' | 'ru' | 'en') => {
    if (code === current) return;
    // Persist locally FIRST so the choice survives a cold start (boot i18n
    // restores from here), then flip the live UI and sync to the server.
    await setStoredLanguage(code);
    await i18n.changeLanguage(code);
    updateMe.mutate({ language: code });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <BackButton onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text
          style={{
            paddingHorizontal: 4,
            fontFamily: 'Inter_800ExtraBold',
            fontSize: 28,
            letterSpacing: -0.8,
            color: colors.ink[900],
          }}
        >
          {t('language.title')}
        </Text>
        <Text
          style={{
            marginTop: 6,
            paddingHorizontal: 4,
            fontFamily: 'Inter_400Regular',
            fontSize: 15,
            color: colors.ink[500],
          }}
        >
          {t('language.subtitle')}
        </Text>

        <View style={{ height: 16 }} />

        <Card padding={0} style={{ overflow: 'hidden' }}>
          {LANGUAGES.map((lang, idx) => {
            const active = lang.code === current;
            return (
              <Pressable
                key={lang.code}
                onPress={() => void pick(lang.code)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    gap: 12,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: colors.line,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: 'Inter_700Bold',
                        fontSize: 16,
                        color: colors.ink[900],
                      }}
                    >
                      {lang.nativeName}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontFamily: 'Inter_400Regular',
                        fontSize: 12,
                        color: colors.ink[500],
                      }}
                    >
                      {lang.englishName}
                    </Text>
                  </View>
                  {active ? (
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: colors.brand[500],
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="check" size={16} color={colors.white} />
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
