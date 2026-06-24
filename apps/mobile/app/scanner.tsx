import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScanFrame, SCAN_FRAME_SIZE } from '../src/components/scanner/ScanFrame';
import { Button, Icon } from '../src/components/ui';
import {
  type DeviceLookupErrorCode,
  extractLookupErrorCode,
  lookupDevice,
} from '../src/lib/devices-api';
import { colors } from '../src/theme/tokens';

/**
 * A6.1 Scanner + A6.3–A6.6 error states, in one screen.
 *
 * Full-screen camera with the brand-tinted scan frame, dim mask around
 * the frame, top header, hint text, and a flashlight toggle. Outside
 * the (tabs) group so the tab bar is hidden automatically — this is a
 * modal-style screen, not a tab.
 *
 * Implementation note on the camera library:
 *   Spec calls for `react-native-vision-camera` (locked stack). That
 *   library requires native code → EAS dev build → can't run in Expo
 *   Go. To keep visual QA viable in Expo Go through Phase 2 we use
 *   `expo-camera` here, which supports QR scanning out of the box.
 *   When we transition to EAS dev builds (Phase 2.5b + 2.14), the swap
 *   is mechanical — onBarCodeScanned semantics carry over.
 *
 * Scan handling:
 *   - First successful barcode read triggers lookup
 *   - lockRef guards against the camera firing multiple times for the
 *     same code while we're waiting for the API response
 *   - Success → navigate to /charge/[qrShortId]
 *   - Error → switch the screen into an "error state" view that shows
 *     the friendly message + "Try again" button (re-enables scanning)
 */
export default function ScannerScreen() {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [flashOn, setFlashOn] = useState(false);
  const [errorCode, setErrorCode] = useState<DeviceLookupErrorCode | 'NETWORK' | null>(null);
  const lockRef = useRef(false);

  const handleScan = useCallback(async (data: string) => {
    if (lockRef.current) return;
    lockRef.current = true;

    // Pull the qrShortId out of the scanned URL. Spec format:
    // https://app.tahawash.az/d/XXXXXX. Be permissive: if the camera
    // captures just "XXXXXX" we accept that too.
    const qrShortId = extractQrShortId(data);
    if (!qrShortId) {
      setErrorCode('UNKNOWN_DEVICE');
      return;
    }

    try {
      await lookupDevice(qrShortId);
      // Success — push to charge screen. The charge screen will
      // re-lookup if needed (cached by TanStack Query).
      router.replace(`/charge/${qrShortId}`);
    } catch (err) {
      const code = extractLookupErrorCode(err);
      setErrorCode(code ?? 'NETWORK');
    }
  }, []);

  const handleRetry = () => {
    setErrorCode(null);
    lockRef.current = false;
  };

  // Permission gate.
  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: '#0B0E12' }} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0E12' }} edges={['top', 'bottom']}>
        <View
          style={{
            flex: 1,
            padding: 24,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="qr" size={36} color={colors.white} />
          </View>
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 22,
              color: colors.white,
              textAlign: 'center',
              letterSpacing: -0.4,
            }}
          >
            {t('scanner.permTitle')}
          </Text>
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              lineHeight: 21,
              color: 'rgba(255,255,255,0.7)',
              textAlign: 'center',
            }}
          >
            {t('scanner.permBody')}
          </Text>
          <View style={{ height: 8 }} />
          {/* `full` stretches the pill to fill the centered column. Without
              it Button defaults to alignSelf:'flex-start', which collapses
              against the parent's alignItems:'center' and visibly left-anchors
              the CTA. The wrapping View constrains the maxWidth so on tablets
              the pill doesn't spread across the whole screen. */}
          <View style={{ alignSelf: 'stretch', maxWidth: 360 }}>
            <Button full onPress={() => void requestPermission()}>
              {t('scanner.permAllow')}
            </Button>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 14,
                color: 'rgba(255,255,255,0.7)',
                marginTop: 4,
              }}
            >
              {t('common.cancel')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Error-state overlay (full-screen, on top of stopped camera).
  if (errorCode !== null) {
    return (
      <ScannerErrorState code={errorCode} onRetry={handleRetry} onClose={() => router.back()} />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0E12' }}>
      {/* Camera screen is dark — flip status bar text to light so it's readable. */}
      <StatusBar style="light" />
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={flashOn}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          void handleScan(data);
        }}
      />

      {/* Dim mask + overlay */}
      <DimMask />
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        pointerEvents="none"
      >
        <ScanFrame />
      </View>

      <SafeAreaView
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        edges={['top']}
        pointerEvents="box-none"
      >
        {/* Header: title + close */}
        <View
          style={{
            paddingTop: 8,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 17,
              color: colors.white,
            }}
          >
            {t('scanner.title')}
          </Text>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.14)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.18)',
            }}
          >
            <Icon name="close" size={20} color={colors.white} />
          </Pressable>
        </View>
      </SafeAreaView>

      <SafeAreaView
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
        edges={['bottom']}
        pointerEvents="box-none"
      >
        <View style={{ alignItems: 'center', paddingBottom: 20, gap: 16 }}>
          {/* Hint text — sits just below the frame */}
          <Text
            style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 15,
              color: 'rgba(255,255,255,0.85)',
              textAlign: 'center',
              paddingHorizontal: 24,
            }}
          >
            {t('scanner.hint')}
          </Text>

          {/* Flashlight toggle */}
          <Pressable
            onPress={() => setFlashOn((v) => !v)}
            hitSlop={8}
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: flashOn ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <Icon name="flash" size={26} color={flashOn ? colors.ink[900] : colors.white} />
          </Pressable>

          {/* Support link */}
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              color: 'rgba(255,255,255,0.55)',
              textAlign: 'center',
            }}
          >
            {t('scanner.troubleHint')}{' '}
            <Text
              style={{
                color: colors.brand[500],
                fontFamily: 'Inter_600SemiBold',
              }}
            >
              {t('scanner.troubleAction')}
            </Text>
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── error state ──────────────────────────────────────────────────

interface ErrorStateProps {
  code: DeviceLookupErrorCode | 'NETWORK';
  onRetry: () => void;
  onClose: () => void;
}

function ScannerErrorState({ code, onRetry, onClose }: ErrorStateProps) {
  const { t } = useTranslation();

  const titleKey = ERROR_TITLE_KEYS[code];
  const bodyKey = ERROR_BODY_KEYS[code];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0E12' }} edges={['top', 'bottom']}>
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: 'rgba(245,158,11,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="alert" size={40} color={colors.amber} />
        </View>
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: 22,
            color: colors.white,
            textAlign: 'center',
            letterSpacing: -0.4,
          }}
        >
          {t(titleKey)}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            lineHeight: 21,
            color: 'rgba(255,255,255,0.7)',
            textAlign: 'center',
          }}
        >
          {t(bodyKey)}
        </Text>
        <View style={{ height: 8 }} />
        {/* alignSelf:center — Button defaults to alignSelf:'flex-start', which
            otherwise pulls it to the left of this centered column. */}
        <Button onPress={onRetry} style={{ alignSelf: 'center' }}>
          {t('scanner.tryAgain')}
        </Button>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 14,
              color: 'rgba(255,255,255,0.7)',
              marginTop: 4,
            }}
          >
            {t('common.cancel')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const ERROR_TITLE_KEYS: Record<DeviceLookupErrorCode | 'NETWORK', string> = {
  UNKNOWN_DEVICE: 'scanner.error.unknownTitle',
  DEVICE_DELETED: 'scanner.error.deletedTitle',
  DEVICE_DISABLED: 'scanner.error.disabledTitle',
  TENANT_SUSPENDED: 'scanner.error.suspendedTitle',
  NETWORK: 'scanner.error.networkTitle',
};

const ERROR_BODY_KEYS: Record<DeviceLookupErrorCode | 'NETWORK', string> = {
  UNKNOWN_DEVICE: 'scanner.error.unknownBody',
  DEVICE_DELETED: 'scanner.error.deletedBody',
  DEVICE_DISABLED: 'scanner.error.disabledBody',
  TENANT_SUSPENDED: 'scanner.error.suspendedBody',
  NETWORK: 'scanner.error.networkBody',
};

// ─── helpers ──────────────────────────────────────────────────────

/**
 * Extract the 6-char qrShortId from the scanned URL. Accepts:
 *   https://app.tahawash.az/d/XXXXXX
 *   tahawash:///d/XXXXXX (custom scheme)
 *   plain XXXXXX (manual entry / weird camera read)
 */
function extractQrShortId(scanned: string): string | null {
  const trimmed = scanned.trim();
  const urlMatch = /\/d\/([A-Z0-9]{6})(?:[/?#]|$)/i.exec(trimmed);
  if (urlMatch) return urlMatch[1]!.toUpperCase();
  if (/^[A-Z0-9]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

function DimMask() {
  const { width, height } = Dimensions.get('window');
  const frameSize = SCAN_FRAME_SIZE;
  const topMaskHeight = (height - frameSize) / 2;
  const sideMaskWidth = (width - frameSize) / 2;
  const dim = 'rgba(0,0,0,0.55)';
  return (
    <View
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
      pointerEvents="none"
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: topMaskHeight,
          backgroundColor: dim,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: topMaskHeight,
          backgroundColor: dim,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: topMaskHeight,
          left: 0,
          width: sideMaskWidth,
          height: frameSize,
          backgroundColor: dim,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: topMaskHeight,
          right: 0,
          width: sideMaskWidth,
          height: frameSize,
          backgroundColor: dim,
        }}
      />
    </View>
  );
}
