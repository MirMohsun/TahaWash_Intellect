import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  Card,
  FilterChip,
  FilterSheet,
  Icon,
  Pill,
  RemoteImage,
  Skeleton,
  TenantMark,
} from '../../src/components/ui';
import { useMyTransactions } from '../../src/hooks/use-transactions';
import {
  bakuDateString,
  bakuToday,
  bakuYesterday,
  bakuStartOfMonth,
  formatHistoryDate,
} from '../../src/lib/baku-date';
import { formatTetri, parseAznToTetri } from '../../src/lib/charge-amount';
import type { CustomerTx, CustomerTxStatus } from '../../src/lib/transactions-api';
import { colors } from '../../src/theme/tokens';

/**
 * A8.1 History tab — 1:1 port of Design_Mobile_App/app/screens-c.jsx →
 * ScreenHistory, with two derived bits:
 *   - "Spent this month" derives from the real transaction list.
 *   - Mini bar chart shows spend per Baku-day for the last 7 days.
 *
 * Sections: Today / Yesterday / Earlier — Baku-local day boundaries.
 * Pull-to-refresh, skeleton loading, empty state, error state.
 */
export default function HistoryTab() {
  const { t } = useTranslation();
  const txQuery = useMyTransactions(1, 50);
  const tabBarHeight = useBottomTabBarHeight();

  const items: CustomerTx[] = txQuery.data?.items ?? [];

  const [statusKey, setStatusKey] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilter = statusKey !== 'all';

  const filteredItems = useMemo(() => {
    const f = STATUS_FILTERS.find((x) => x.key === statusKey) ?? STATUS_FILTERS[0]!;
    return items.filter((tx) => f.match(tx.status));
  }, [items, statusKey]);

  // Group the FILTERED list (drives the rows); spend stats stay on the full list.
  const grouped = useMemo(() => groupByDay(filteredItems), [filteredItems]);
  const monthSpendTetri = useMemo(() => computeMonthSpend(items), [items]);
  const barData = useMemo(() => computeLast7DaysSpend(items), [items]);

  const isEmpty = !txQuery.isLoading && items.length === 0;
  const noMatches = !txQuery.isLoading && !isEmpty && filteredItems.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={txQuery.isRefetching}
            onRefresh={() => void txQuery.refetch()}
            tintColor={colors.brand[500]}
          />
        }
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: 8,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text
              style={{
                fontFamily: 'Inter_800ExtraBold',
                fontSize: 30,
                letterSpacing: -0.8,
                color: colors.ink[900],
              }}
            >
              {t('history.title')}
            </Text>
            {txQuery.data ? (
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13,
                  color: colors.ink[500],
                }}
              >
                {t('history.washCountThisMonth', {
                  count: items.filter(
                    (tx) => bakuDateString(new Date(tx.createdAt)) >= bakuStartOfMonth(),
                  ).length,
                })}
              </Text>
            ) : null}
          </View>
          {/* Filter button — plain icon, no circle bg / border / shadow. */}
          <Pressable
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('history.filterTitle', { defaultValue: 'Filter' })}
            hitSlop={8}
            android_ripple={{ color: 'rgba(14,122,231,0.18)', borderless: true }}
            style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name="filter"
              size={22}
              color={activeFilter ? colors.brand[600] : colors.ink[700]}
            />
            {activeFilter ? (
              <View
                style={{
                  position: 'absolute',
                  top: 7,
                  right: 7,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.brand[500],
                }}
              />
            ) : null}
          </Pressable>
        </View>

        {/* Spend card + mini bar chart */}
        {!txQuery.isLoading && !isEmpty ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Card
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              padding={14}
            >
              <View>
                <Text
                  style={{
                    fontFamily: 'Inter_700Bold',
                    fontSize: 11,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: colors.ink[500],
                  }}
                >
                  {t('history.spentThisMonth')}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontFamily: 'Inter_800ExtraBold',
                    fontSize: 22,
                    letterSpacing: -0.6,
                    color: colors.ink[900],
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatTetri(monthSpendTetri)}
                </Text>
              </View>
              <MiniBarChart data={barData} />
            </Card>
          </View>
        ) : null}

        {/* States */}
        {txQuery.isLoading ? (
          <LoadingState />
        ) : txQuery.isError ? (
          <ErrorState onRetry={() => void txQuery.refetch()} />
        ) : isEmpty ? (
          <EmptyState />
        ) : noMatches ? (
          <NoMatchesState onClear={() => setStatusKey('all')} />
        ) : (
          <>
            {grouped.today.length > 0 ? (
              <Section title={t('history.today')} items={grouped.today} />
            ) : null}
            {grouped.yesterday.length > 0 ? (
              <Section title={t('history.yesterday')} items={grouped.yesterday} />
            ) : null}
            {grouped.earlier.length > 0 ? (
              <Section title={t('history.earlier')} items={grouped.earlier} />
            ) : null}
          </>
        )}
      </ScrollView>

      <FilterSheet
        visible={filterOpen}
        title={t('history.filterTitle', { defaultValue: 'Filter' })}
        onClose={() => setFilterOpen(false)}
        onReset={activeFilter ? () => setStatusKey('all') : undefined}
        resetLabel={t('common.reset', { defaultValue: 'Reset' })}
        doneLabel={t('common.done', { defaultValue: 'Done' })}
      >
        <Text
          style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
            color: colors.ink[500],
            marginBottom: 10,
          }}
        >
          {t('history.filterByStatus', { defaultValue: 'Status' })}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {STATUS_FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={t(`history.statusFilter.${f.key}`, { defaultValue: f.defaultLabel })}
              active={statusKey === f.key}
              onPress={() => setStatusKey(f.key)}
            />
          ))}
        </View>
      </FilterSheet>
    </SafeAreaView>
  );
}

const STATUS_FILTERS: {
  key: string;
  defaultLabel: string;
  match: (s: CustomerTxStatus) => boolean;
}[] = [
  { key: 'all', defaultLabel: 'All', match: () => true },
  { key: 'paid', defaultLabel: 'Paid', match: (s) => s === 'paid_credited' },
  {
    key: 'progress',
    defaultLabel: 'In progress',
    match: (s) => s === 'pending' || s === 'paid_crediting',
  },
  { key: 'declined', defaultLabel: 'Declined', match: (s) => s === 'declined' },
  { key: 'error', defaultLabel: 'Hardware error', match: (s) => s === 'paid_hardware_error' },
];

function NoMatchesState({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: 16,
            color: colors.ink[900],
            textAlign: 'center',
          }}
        >
          {t('history.noMatchesTitle', { defaultValue: 'No transactions match' })}
        </Text>
        <Pressable onPress={onClear} hitSlop={8}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.brand[600] }}>
            {t('common.reset', { defaultValue: 'Clear filter' })}
          </Text>
        </Pressable>
      </Card>
    </View>
  );
}

// ─── section + row ────────────────────────────────────────────

function Section({ title, items }: { title: string; items: CustomerTx[] }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        style={{
          paddingHorizontal: 20,
          paddingBottom: 8,
          fontFamily: 'Inter_700Bold',
          fontSize: 12,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: colors.ink[500],
        }}
      >
        {title}
      </Text>
      <View style={{ gap: 8, paddingHorizontal: 16 }}>
        {items.map((tx) => (
          <HistoryRow key={tx.id} tx={tx} />
        ))}
      </View>
    </View>
  );
}

function HistoryRow({ tx }: { tx: CustomerTx }) {
  const { t } = useTranslation();
  const visual = statusVisual(tx.status);
  const struck = tx.status !== 'paid_credited' && tx.status !== 'paid_crediting';

  return (
    <Pressable
      onPress={() => router.push(`/transaction/${tx.id}`)}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <Card padding={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <RemoteImage
            uri={tx.tenant.logoUrl}
            style={{ width: 44, height: 44, borderRadius: 22 }}
            fallback={<TenantMark name={tx.tenant.brandName} size={44} radius={22} />}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: 'Inter_700Bold',
                fontSize: 15,
                letterSpacing: -0.2,
                color: colors.ink[900],
              }}
            >
              {tx.tenant.brandName}{' '}
              <Text style={{ fontFamily: 'Inter_400Regular', color: colors.ink[500] }}>
                · {tx.bay.name}
              </Text>
            </Text>
            <Text
              numberOfLines={1}
              style={{
                marginTop: 2,
                fontFamily: 'Inter_400Regular',
                fontSize: 12,
                color: colors.ink[500],
              }}
            >
              {tx.location.name} · {formatHistoryDate(tx.createdAt, t)}
            </Text>
            <View style={{ marginTop: 6 }}>
              <Pill bg={visual.bg} color={visual.fg}>
                {visual.icon} {t(visual.labelKey)}
              </Pill>
            </View>
          </View>
          <Text
            style={{
              fontFamily: 'Inter_800ExtraBold',
              fontSize: 17,
              letterSpacing: -0.3,
              color: struck ? colors.ink[400] : colors.ink[900],
              fontVariant: ['tabular-nums'],
              textDecorationLine: struck ? 'line-through' : 'none',
            }}
          >
            {formatTetri(parseAznToTetri(tx.amountAzn))}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

// ─── bar chart ───────────────────────────────────────────────

function MiniBarChart({ data }: { data: number[] }) {
  // Normalize to 4-36pt height. Max bar in design is 36pt; preserve
  // proportions but clamp at min 4pt so empty days still render a tick.
  const max = Math.max(1, ...data);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 36, gap: 4 }}>
      {data.map((value, i) => {
        const height = Math.max(4, Math.round((value / max) * 36));
        const isToday = i === data.length - 1;
        return (
          <View
            key={i}
            style={{
              width: 6,
              height,
              borderRadius: 3,
              backgroundColor: isToday ? colors.brand[500] : colors.brand[100],
            }}
          />
        );
      })}
    </View>
  );
}

// ─── states ──────────────────────────────────────────────────

function LoadingState() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} padding={14}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Skeleton width={44} height={44} radius={22} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="80%" height={12} />
              <Skeleton width="30%" height={14} radius={999} />
            </View>
            <Skeleton width={50} height={18} />
          </View>
        </Card>
      ))}
    </View>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.brand[50],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="history" size={28} color={colors.brand[600]} />
        </View>
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: 16,
            color: colors.ink[900],
            textAlign: 'center',
          }}
        >
          {t('history.emptyTitle')}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            color: colors.ink[500],
            textAlign: 'center',
            lineHeight: 19,
            maxWidth: 280,
          }}
        >
          {t('history.emptyBody')}
        </Text>
      </Card>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
      <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
        <Icon name="alert" size={32} color={colors.amber} />
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: 16,
            color: colors.ink[900],
            textAlign: 'center',
          }}
        >
          {t('history.errorTitle')}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            color: colors.ink[500],
            textAlign: 'center',
            lineHeight: 19,
          }}
        >
          {t('history.errorBody')}
        </Text>
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.brand[600] }}>
            {t('common.retry')}
          </Text>
        </Pressable>
      </Card>
    </View>
  );
}

// ─── helpers ─────────────────────────────────────────────────

function groupByDay(items: CustomerTx[]): {
  today: CustomerTx[];
  yesterday: CustomerTx[];
  earlier: CustomerTx[];
} {
  const today = bakuToday();
  const yesterday = bakuYesterday();
  const out = {
    today: [] as CustomerTx[],
    yesterday: [] as CustomerTx[],
    earlier: [] as CustomerTx[],
  };
  for (const tx of items) {
    const day = bakuDateString(new Date(tx.createdAt));
    if (day === today) out.today.push(tx);
    else if (day === yesterday) out.yesterday.push(tx);
    else out.earlier.push(tx);
  }
  return out;
}

function computeMonthSpend(items: CustomerTx[]): number {
  const start = bakuStartOfMonth();
  return items.reduce((acc, tx) => {
    const day = bakuDateString(new Date(tx.createdAt));
    if (day < start) return acc;
    if (tx.status !== 'paid_credited') return acc; // mirror design — only "successfully delivered" wash counts
    return acc + parseAznToTetri(tx.amountAzn);
  }, 0);
}

/** Sum per Baku-day for last 7 days ending today. Returns 7-length array, last = today. */
function computeLast7DaysSpend(items: CustomerTx[]): number[] {
  const today = bakuToday();
  const bins = new Map<string, number>();

  // Pre-fill all 7 buckets so the chart always renders 7 bars.
  for (let i = 6; i >= 0; i--) {
    const date = new Date(`${today}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - i);
    const key = date.toISOString().slice(0, 10);
    bins.set(key, 0);
  }

  for (const tx of items) {
    if (tx.status !== 'paid_credited') continue;
    const day = bakuDateString(new Date(tx.createdAt));
    if (!bins.has(day)) continue;
    bins.set(day, (bins.get(day) ?? 0) + parseAznToTetri(tx.amountAzn));
  }

  return Array.from(bins.values());
}

interface StatusVisual {
  labelKey: string;
  bg: string;
  fg: string;
  icon: string;
}

function statusVisual(status: CustomerTxStatus): StatusVisual {
  switch (status) {
    case 'paid_credited':
      return {
        labelKey: 'history.statusPaid',
        bg: colors.successSoft,
        fg: colors.success,
        icon: '●',
      };
    case 'paid_hardware_error':
      return {
        labelKey: 'history.statusHardwareError',
        bg: colors.amberSoft,
        fg: colors.amber,
        icon: '⚠',
      };
    case 'declined':
      return {
        labelKey: 'history.statusDeclined',
        bg: colors.errorSoft,
        fg: colors.error,
        icon: '✕',
      };
    case 'cancelled':
      return {
        labelKey: 'history.statusCancelled',
        bg: colors.lineSoft,
        fg: colors.ink[500],
        icon: '—',
      };
    case 'pending':
    case 'paid_crediting':
    default:
      return {
        labelKey: 'history.statusProcessing',
        bg: colors.lineSoft,
        fg: colors.ink[500],
        icon: '⋯',
      };
  }
}
