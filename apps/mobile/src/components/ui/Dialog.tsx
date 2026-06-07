import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Text, View } from 'react-native';
import { colors } from '../../theme/tokens';
import { Button } from './Button';

/**
 * App-themed dialogs — a drop-in replacement for React Native's
 * `Alert.alert` (which renders the unstyleable OS-native system alert).
 *
 * Imperative API (matches Alert's ergonomics so call sites swap 1:1):
 *   const dialog = useDialog();
 *   await dialog.alert({ title, message? });
 *   if (await dialog.confirm({ title, message?, destructive? })) { ... }
 *
 * Rendered by a single <DialogProvider> mounted near the app root. Backdrop
 * tap and the Android hardware-back button both dismiss (resolve as cancel /
 * void). Styling is flat (no elevation) on a dim backdrop to avoid the
 * Fabric rounded-shadow artifacts noted elsewhere in the app.
 */

interface AlertOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Render the confirm action in the destructive (red) style. */
  destructive?: boolean;
}

interface DialogApi {
  alert: (opts: AlertOptions) => Promise<void>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

type ActiveDialog =
  | ({ kind: 'alert'; resolve: () => void } & AlertOptions)
  | ({ kind: 'confirm'; resolve: (value: boolean) => void } & ConfirmOptions);

const DialogContext = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<ActiveDialog | null>(null);

  const alert = useCallback((opts: AlertOptions) => {
    return new Promise<void>((resolve) => {
      setActive({ kind: 'alert', ...opts, resolve });
    });
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setActive({ kind: 'confirm', ...opts, resolve });
    });
  }, []);

  const api = useMemo<DialogApi>(() => ({ alert, confirm }), [alert, confirm]);

  // Resolve + close helpers. We capture `active` then clear state first so a
  // resolve callback that opens another dialog isn't immediately wiped.
  const onConfirm = useCallback(() => {
    setActive((cur) => {
      if (cur) {
        if (cur.kind === 'confirm') cur.resolve(true);
        else cur.resolve();
      }
      return null;
    });
  }, []);

  const onCancel = useCallback(() => {
    setActive((cur) => {
      if (cur) {
        if (cur.kind === 'confirm') cur.resolve(false);
        else cur.resolve();
      }
      return null;
    });
  }, []);

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal
        visible={active !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onCancel}
      >
        <Pressable
          onPress={onCancel}
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 28,
          }}
        >
          {/* Inner Pressable absorbs taps so tapping the card doesn't dismiss. */}
          <Pressable
            onPress={() => {}}
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: colors.bgElev,
              borderRadius: 24,
              padding: 22,
            }}
          >
            {active ? (
              <>
                <Text
                  style={{
                    fontFamily: 'Inter_800ExtraBold',
                    fontSize: 18,
                    letterSpacing: -0.3,
                    color: colors.ink[900],
                  }}
                >
                  {active.title}
                </Text>
                {active.message ? (
                  <Text
                    style={{
                      marginTop: 8,
                      fontFamily: 'Inter_400Regular',
                      fontSize: 14,
                      lineHeight: 20,
                      color: colors.ink[500],
                    }}
                  >
                    {active.message}
                  </Text>
                ) : null}

                <View style={{ marginTop: 22, gap: 8 }}>
                  <Button
                    variant={active.kind === 'confirm' && active.destructive ? 'danger' : 'primary'}
                    full
                    onPress={onConfirm}
                  >
                    {active.confirmLabel ?? t('common.done', { defaultValue: 'OK' })}
                  </Button>
                  {active.kind === 'confirm' ? (
                    <Button variant="ghost" full onPress={onCancel}>
                      {active.cancelLabel ?? t('common.cancel', { defaultValue: 'Cancel' })}
                    </Button>
                  ) : null}
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used within a <DialogProvider>');
  }
  return ctx;
}
