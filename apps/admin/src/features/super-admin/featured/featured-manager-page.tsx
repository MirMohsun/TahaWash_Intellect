import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isAxiosError } from 'axios';
import { GripVertical, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useAddSuperAdminFeatured,
  useRemoveSuperAdminFeatured,
  useReorderSuperAdminFeatured,
  useSuperAdminFeatured,
} from '@/hooks/use-super-admin-featured';
import { useSuperAdminTenants } from '@/hooks/use-super-admin-tenants';
import type { SuperAdminFeaturedRow, SuperAdminTenantListItem } from '@/lib/super-admin-api';

/**
 * Super-admin featured carwashes manager (C9.1).
 *
 * Two-column layout:
 *   - LEFT  Featured (sortable list, drag to reorder, remove button)
 *   - RIGHT Available active tenants (search + add-to-featured)
 *
 * Drag-and-drop via @dnd-kit/sortable. Persist-on-drop with rollback:
 *   1. PointerSensor + KeyboardSensor for mouse / touch / keyboard a11y
 *   2. On drag-end, optimistically rewrite the cache (instant feedback)
 *   3. Fire PATCH /super-admin/featured/reorder; on error the hook's
 *      onError restores the previous cache (the row visually snaps back)
 *
 * Available tenants filtered to status='active' + not already featured.
 * Single fetch w/ limit=100 (MVP scale). Graduates to debounced
 * autocomplete past ~100 tenants — same threshold as subscriptions list.
 */
export function SuperAdminFeaturedManagerPage() {
  const { t } = useTranslation();
  const featuredQ = useSuperAdminFeatured();
  const tenantsQ = useSuperAdminTenants({
    status: 'active',
    sort: 'brandName:asc',
    page: 1,
    limit: 100,
  });
  const add = useAddSuperAdminFeatured();
  const remove = useRemoveSuperAdminFeatured();
  const reorder = useReorderSuperAdminFeatured();

  const [search, setSearch] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const featured = featuredQ.data ?? [];
  const featuredIds = useMemo(() => new Set(featured.map((f) => f.tenantId)), [featured]);

  const availableTenants = useMemo(() => {
    const tenants = tenantsQ.data?.items ?? [];
    const q = search.trim().toLowerCase();
    return tenants
      .filter((t) => !featuredIds.has(t.id))
      .filter((t) => {
        if (!q) return true;
        return (
          t.brandName.toLowerCase().includes(q) ||
          t.legalName.toLowerCase().includes(q) ||
          t.voen.includes(q)
        );
      });
  }, [tenantsQ.data, featuredIds, search]);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = featured.findIndex((f) => f.tenantId === active.id);
    const newIndex = featured.findIndex((f) => f.tenantId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(featured, oldIndex, newIndex);
    const payload = {
      items: reordered.map((row, idx) => ({ tenantId: row.tenantId, sortOrder: idx })),
    };

    reorder.mutate(payload, {
      onError: (err) => {
        toast.error(mapReorderError(err, t));
      },
    });
  };

  const onAdd = async (tenantId: string) => {
    try {
      await add.mutateAsync(tenantId);
      toast.success(t('superAdmin.featured.toastAdded'));
    } catch (err) {
      toast.error(mapAddError(err, t));
    }
  };

  const onRemove = async (tenantId: string, brandName: string) => {
    try {
      await remove.mutateAsync(tenantId);
      toast.success(t('superAdmin.featured.toastRemoved', { brand: brandName }));
    } catch {
      toast.error(t('superAdmin.tenantNew.errors.generic'));
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
          {t('superAdmin.featured.title')}
        </h1>
        <p className="mt-1 text-ink-500">{t('superAdmin.featured.subtitle')}</p>
      </header>

      {(featuredQ.isError || tenantsQ.isError) && (
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">{t('superAdmin.featured.loadError')}</p>
            <button
              type="button"
              onClick={() => {
                void featuredQ.refetch();
                void tenantsQ.refetch();
              }}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('superAdmin.dashboard.retry')}
            </button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* LEFT — featured list (sortable) + preview */}
        <div className="space-y-6 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-500" />
                {t('superAdmin.featured.currentTitle')}
              </CardTitle>
              <CardDescription>{t('superAdmin.featured.currentBody')}</CardDescription>
            </CardHeader>
            <CardContent>
              {featuredQ.isLoading ? (
                <ListSkeleton rows={3} />
              ) : featured.length === 0 ? (
                <EmptyHint text={t('superAdmin.featured.empty')} />
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext
                    items={featured.map((f) => f.tenantId)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="space-y-2">
                      {featured.map((row, idx) => (
                        <SortableRow
                          key={row.tenantId}
                          row={row}
                          position={idx + 1}
                          onRemove={() => void onRemove(row.tenantId, row.tenant.brandName)}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
            </CardContent>
          </Card>

          {/* Mobile preview */}
          {featured.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('superAdmin.featured.previewTitle')}</CardTitle>
                <CardDescription>{t('superAdmin.featured.previewBody')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-2 px-2 pb-2">
                  <div className="flex gap-3 min-w-min">
                    {featured.map((row) => (
                      <FeaturedTile key={row.tenantId} row={row} />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT — available tenants picker */}
        <aside className="lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('superAdmin.featured.availableTitle')}</CardTitle>
              <CardDescription>{t('superAdmin.featured.availableBody')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="featured-search" className="text-xs">
                  {t('superAdmin.tenants.search')}
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
                  <Input
                    id="featured-search"
                    placeholder={t('superAdmin.tenants.searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-ink-400 hover:text-ink-700"
                      aria-label={t('superAdmin.tenants.clearFilters')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {tenantsQ.isLoading ? (
                <ListSkeleton rows={4} />
              ) : availableTenants.length === 0 ? (
                <p className="text-sm text-ink-500 py-2">
                  {search ? t('superAdmin.featured.noMatch') : t('superAdmin.featured.allFeatured')}
                </p>
              ) : (
                <ul className="max-h-[420px] overflow-y-auto -mx-1 px-1 space-y-1">
                  {availableTenants.slice(0, 30).map((tenant) => (
                    <AvailableRow
                      key={tenant.id}
                      tenant={tenant}
                      onAdd={() => void onAdd(tenant.id)}
                    />
                  ))}
                </ul>
              )}
              {availableTenants.length > 30 && (
                <p className="text-xs text-ink-400">
                  {t('superAdmin.featured.searchMore', { count: availableTenants.length - 30 })}
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ─── Sortable row ──────────────────────────────────────────────────

function SortableRow({
  row,
  position,
  onRemove,
}: {
  row: SuperAdminFeaturedRow;
  position: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.tenantId,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-card-sm border border-line bg-bg-elev px-3 py-2 hover:border-brand-200 transition-colors"
    >
      <button
        type="button"
        className="text-ink-400 hover:text-ink-700 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600 shrink-0">
        {position}
      </span>
      <span
        aria-hidden
        className="h-8 w-8 rounded-card-sm shrink-0 ring-1 ring-line"
        style={{ backgroundColor: row.tenant.themeColor }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink-900 truncate">{row.tenant.brandName}</p>
        <p className="text-xs text-ink-500 tabular-nums">sortOrder {row.sortOrder}</p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

// ─── Available tenant row ──────────────────────────────────────────

function AvailableRow({ tenant, onAdd }: { tenant: SuperAdminTenantListItem; onAdd: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-card-sm px-2 py-2 hover:bg-line-soft transition-colors">
      <span
        aria-hidden
        className="h-7 w-7 rounded-card-sm shrink-0 ring-1 ring-line"
        style={{ backgroundColor: tenant.themeColor }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink-900 text-sm truncate">{tenant.brandName}</p>
        <p className="text-xs text-ink-500 truncate">{tenant.voen}</p>
      </div>
      <Button type="button" size="sm" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

// ─── Preview tile ──────────────────────────────────────────────────

function FeaturedTile({ row }: { row: SuperAdminFeaturedRow }) {
  return (
    <div className="shrink-0 w-32 rounded-card-sm bg-bg-elev border border-line p-3 text-center">
      <div
        aria-hidden
        className="h-12 w-12 rounded-card-sm mx-auto ring-1 ring-line"
        style={{ backgroundColor: row.tenant.themeColor }}
      />
      <p className="mt-2 text-xs font-semibold text-ink-900 truncate">{row.tenant.brandName}</p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-card-sm border border-line bg-bg-elev px-3 py-2"
        >
          <div className="h-4 w-4 bg-line-soft rounded" />
          <div className="h-7 w-7 rounded-full bg-line-soft" />
          <div className="h-8 w-8 rounded-card-sm bg-line-soft" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 bg-line-soft rounded" />
            <div className="h-2.5 w-1/3 bg-line-soft rounded" />
          </div>
          <div className="h-7 w-7 rounded-card-sm bg-line-soft" />
        </li>
      ))}
    </ul>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-ink-500 py-4 text-center">{text}</p>;
}

function mapReorderError(err: unknown, t: (k: string) => string): string {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (code === 'INVALID_TENANTS_IN_REORDER') {
      return t('superAdmin.featured.errors.invalidInReorder');
    }
    if (!err.response) return t('superAdmin.tenantNew.errors.network');
  }
  return t('superAdmin.featured.errors.reorderFailed');
}

function mapAddError(err: unknown, t: (k: string) => string): string {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (code === 'TENANT_NOT_ACTIVE') return t('superAdmin.featured.errors.notActive');
    if (code === 'TENANT_NOT_FOUND') return t('superAdmin.tenantDetail.errors.notFound');
    if (!err.response) return t('superAdmin.tenantNew.errors.network');
  }
  return t('superAdmin.tenantNew.errors.generic');
}
