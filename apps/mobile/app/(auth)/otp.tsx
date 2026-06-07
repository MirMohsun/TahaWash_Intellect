import { formatAzPhone } from '@tahawash/shared-utils';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, Icon } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/auth';
import { colors } from '../../src/theme/tokens';

/**
 * A1.3 OTP entry.
 *
 * Ported 1:1 from the locked design (Design_Mobile_App/app/screens-a.jsx
 * → ScreenOTP):
 *   - BackButton top-left
 *   - "Enter the code" display title
 *   - Subtitle with masked phone bolded
 *   - 6 digit boxes, focused box has brand border + glow
 *   - Brand-tinted "Autofilling from SMS…" toast appears while we wait
 *   - 60s resend countdown
 *
 * Auto-fill plumbing:
 *   - iOS:     TextInput textContentType="oneTimeCode" + autoComplete="sms-otp"
 *   - Android: TextInput autoComplete="sms-otp" (relies on Google's
 *              SMS Retriever API; Tahawash will be added to the SMS
 *              allowlist post-launch — until then it's manual entry)
 *
 * State model:
 *   - Single source of truth: `value` string (length 0-6)
 *   - The 6 visible boxes are rendered from `value`; cursor position
 *     is at value.length
 *   - One hidden TextInput captures keystrokes (single-field pattern —
 *     avoids the 6-input focus-juggling hell)
 */
export default function OtpScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = params.phone ?? '';

  const [value, setValue] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);

  // Resend countdown
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  // Auto-verify once 6 digits arrive
  useEffect(() => {
    if (value.length === 6 && !verifying) {
      void doVerify(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Force-focus the capture input on mount. Plain `autoFocus` is unreliable
  // on Fabric (focus manager skips views layout hasn't settled on), so we
  // schedule one micro-task focus after first paint.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Keyboard visibility — same pattern as PhoneScreen so the footer/insets
  // collapse the wasted nav-bar inset behind the keyboard.
  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEv, () => setKeyboardUp(true));
    const hideSub = Keyboard.addListener(hideEv, () => setKeyboardUp(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const doVerify = async (code: string) => {
    if (!phone) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyOtp(phone, code);
      // Replace the auth stack with the permission flow.
      router.replace('/(auth)/permissions');
    } catch (err) {
      const errCode = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      switch (errCode) {
        case 'OTP_INVALID':
          setError(t('auth.otp.invalid'));
          break;
        case 'OTP_EXPIRED':
          setError(t('auth.otp.expired'));
          break;
        case 'OTP_LOCKED':
          setError(t('auth.otp.locked'));
          break;
        default:
          setError(t('auth.otp.networkError'));
      }
      // Clear the field so the user can retry.
      setValue('');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || !phone) return;
    setError(null);
    setValue('');
    setSecondsLeft(60);
    try {
      await requestOtp(phone);
    } catch {
      // Resend failures are silent — the resend timer reset is what
      // matters to the user; they'll retry the verify flow with the new code.
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView
        style={{
          flex: 1,
          paddingBottom: keyboardUp ? 0 : Math.max(12, insets.bottom),
        }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          // Narrower horizontal padding (was 24 → 20) so 6 flex cells fit
          // comfortably on a 360dp phone with a readable 8dp gap.
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignSelf: 'flex-start', marginBottom: 32 }}>
            <BackButton onPress={() => router.back()} />
          </View>

          <Text
            style={{
              fontFamily: 'Inter_800ExtraBold',
              fontSize: 32,
              lineHeight: 36,
              letterSpacing: -1,
              color: colors.ink[900],
              marginBottom: 10,
            }}
          >
            {t('auth.otp.title')}
          </Text>
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 16,
              lineHeight: 23,
              color: colors.ink[500],
            }}
          >
            {t('auth.otp.subtitle')}{' '}
            <Text style={{ fontFamily: 'Inter_700Bold', color: colors.ink[900] }}>
              {phone ? formatAzPhone(phone, { mask: true }) : ''}
            </Text>
          </Text>

          {/* Digit boxes.
              Cells use `flex: 1` so 6 of them always fit the screen width
              regardless of device (was fixed 50dp × 6 + gaps = ~398dp which
              overflowed 360dp Android phones).
              The capture TextInput is overlaid on top with opacity:0 so any
              tap on the row reliably routes to the input (the previous
              left:-1000 off-screen input was unreachable on Fabric and
              autoFocus would silently no-op). */}
          <View style={{ marginTop: 40, position: 'relative' }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const digit = value[i] ?? '';
                const filled = digit !== '';
                const focused = i === value.length;
                return (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 60,
                      borderRadius: 12,
                      borderWidth: focused ? 2 : 1.5,
                      borderColor: focused
                        ? error
                          ? colors.error
                          : colors.brand[500]
                        : filled
                          ? colors.ink[300]
                          : colors.line,
                      backgroundColor: colors.bgElev,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter_700Bold',
                        fontSize: 24,
                        color: colors.ink[900],
                      }}
                    >
                      {digit}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Capture input — overlaid on top of the cells, full-row, opacity 0.
                User taps anywhere on the row → focus → keyboard opens. Pasted /
                SMS-autofilled values still land in `value` the same way. */}
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, '').slice(0, 6);
                setValue(digits);
                if (error) setError(null);
              }}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              autoFocus
              caretHidden
              selectionColor="transparent"
              maxLength={6}
              accessibilityLabel={t('auth.otp.title')}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: 0,
                fontSize: 24,
                color: 'transparent',
              }}
            />
          </View>

          {/* Autofill / verifying toast (matches the design — brand-tinted) */}
          {verifying ? (
            <View
              style={{
                marginTop: 24,
                padding: 12,
                paddingRight: 14,
                backgroundColor: colors.brand[50],
                borderWidth: 1,
                borderColor: colors.brand[200],
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
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
                <Icon name="zap" size={16} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 13,
                    color: colors.brand[900],
                  }}
                >
                  {t('auth.otp.verifying')}
                </Text>
                <Text
                  style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 11,
                    color: colors.brand[700],
                  }}
                >
                  {t('common.appName')}
                </Text>
              </View>
            </View>
          ) : null}

          {error ? (
            <Text
              style={{
                marginTop: 16,
                fontFamily: 'Inter_500Medium',
                fontSize: 13,
                color: colors.error,
                textAlign: 'center',
              }}
            >
              {error}
            </Text>
          ) : null}

          {/* Resend control */}
          <View style={{ marginTop: 28, alignItems: 'center' }}>
            {secondsLeft > 0 ? (
              <Text
                style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.ink[500] }}
              >
                {t('auth.otp.resendIn')}{' '}
                <Text
                  style={{
                    fontFamily: 'Inter_700Bold',
                    color: colors.ink[900],
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatCountdown(secondsLeft)}
                </Text>
              </Text>
            ) : (
              <Pressable onPress={handleResend} hitSlop={8}>
                <Text
                  style={{
                    fontFamily: 'Inter_700Bold',
                    fontSize: 14,
                    color: colors.brand[600],
                  }}
                >
                  {t('auth.otp.resendNow')}
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
