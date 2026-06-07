import { isAxiosError } from 'axios';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FileText,
  History,
  Plus,
  Save,
  Trash2,
  Undo,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useMakeSuperAdminLegalCurrent,
  usePublishSuperAdminLegal,
  useSuperAdminLegalCurrent,
  useSuperAdminLegalVersions,
} from '@/hooks/use-super-admin-legal';
import {
  LEGAL_DOC_TYPES,
  LEGAL_LANGUAGES,
  type LegalDocType,
  type LegalDocumentRow,
  type LegalLanguage,
  type LegalSection,
} from '@/lib/super-admin-api';

/**
 * Super-admin legal document editor (C10.4).
 *
 * Versioned T&C + Privacy Policy in AZ/RU/EN. Each (type, language)
 * combination has its own monotonic version history; at most one row
 * per combination is `isCurrent=true`. Publishing creates a new version
 * and flips the previous-current row in a single backend transaction.
 *
 * Layout (single scrolling page):
 *   - Header with title + subtitle + warning card
 *   - Top tabs: Terms / Privacy
 *   - Sub tabs: AZ / RU / EN
 *   - Current-version status card
 *   - Section editor (list of {heading, body} rows w/ reorder/delete +
 *     add-section)
 *   - Sticky-ish dirty save bar
 *   - Version history below w/ inline "Restore as current" confirmation
 *
 * Publishing model: NOT in-place edit. Every save creates a new
 * version row. Past versions are immutable; they can be re-pointed-to
 * as current via the rollback action.
 */
const HEADING_MAX = 200;
const BODY_MAX = 10000;

export function SuperAdminLegalPage() {
  const { t } = useTranslation();
  const currentQ = useSuperAdminLegalCurrent();

  const [activeType, setActiveType] = useState<LegalDocType>('terms');
  const [activeLang, setActiveLang] = useState<LegalLanguage>('az');

  if (currentQ.isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (currentQ.isError || !currentQ.data) {
    return (
      <div className="space-y-6">
        <Header />
        <Card className="border-error/20 bg-error-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-error font-medium">
              {t('superAdmin.legal.errors.loadFailed')}
            </p>
            <button
              type="button"
              onClick={() => void currentQ.refetch()}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('superAdmin.dashboard.retry')}
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentRow = currentQ.data[activeType][activeLang];

  return (
    <div className="space-y-6 max-w-4xl">
      <Header />

      <Card className="border-amber/20 bg-amber-50">
        <CardContent className="py-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber mt-0.5 shrink-0" />
          <p className="text-sm text-ink-900">{t('superAdmin.legal.warning')}</p>
        </CardContent>
      </Card>

      <TypeTabs active={activeType} onChange={setActiveType} />
      <LanguageTabs active={activeLang} onChange={setActiveLang} />

      <CurrentVersionCard type={activeType} language={activeLang} row={currentRow} />

      <Editor
        key={`${activeType}-${activeLang}`}
        type={activeType}
        language={activeLang}
        currentRow={currentRow}
      />

      <VersionHistory type={activeType} language={activeLang} currentRow={currentRow} />
    </div>
  );
}

function Header() {
  const { t } = useTranslation();
  return (
    <header>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">
        {t('superAdmin.legal.title')}
      </h1>
      <p className="mt-1 text-ink-500">{t('superAdmin.legal.subtitle')}</p>
    </header>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────

interface TypeTabsProps {
  active: LegalDocType;
  onChange: (type: LegalDocType) => void;
}

function TypeTabs({ active, onChange }: TypeTabsProps) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex gap-1 rounded-pill bg-line-soft p-1">
      {LEGAL_DOC_TYPES.map((type) => {
        const isActive = type === active;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-pill transition-colors ${
              isActive ? 'bg-bg-elev text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'
            }`}
          >
            {t(`superAdmin.legal.type.${type}`)}
          </button>
        );
      })}
    </div>
  );
}

interface LanguageTabsProps {
  active: LegalLanguage;
  onChange: (lang: LegalLanguage) => void;
}

function LanguageTabs({ active, onChange }: LanguageTabsProps) {
  return (
    <div className="inline-flex gap-1 rounded-pill bg-line-soft p-1">
      {LEGAL_LANGUAGES.map((lang) => {
        const isActive = lang === active;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => onChange(lang)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-pill transition-colors uppercase ${
              isActive ? 'bg-bg-elev text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'
            }`}
          >
            {lang}
          </button>
        );
      })}
    </div>
  );
}

// ─── Current version card ─────────────────────────────────────────

interface CurrentVersionCardProps {
  type: LegalDocType;
  language: LegalLanguage;
  row: LegalDocumentRow | null;
}

function CurrentVersionCard({ type, language, row }: CurrentVersionCardProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-500" />
          {t('superAdmin.legal.currentTitle', {
            type: t(`superAdmin.legal.type.${type}`),
            lang: language.toUpperCase(),
          })}
        </CardTitle>
        <CardDescription>
          {row
            ? t('superAdmin.legal.currentMeta', {
                version: row.version,
                when: new Date(row.publishedAt).toLocaleString(),
                count: row.sections.length,
              })
            : t('superAdmin.legal.neverPublished')}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

// ─── Editor ───────────────────────────────────────────────────────

interface EditorProps {
  type: LegalDocType;
  language: LegalLanguage;
  currentRow: LegalDocumentRow | null;
}

function Editor({ type, language, currentRow }: EditorProps) {
  const { t } = useTranslation();
  const publish = usePublishSuperAdminLegal(type, language);

  const initialSections: LegalSection[] = useMemo(
    () =>
      currentRow?.sections.length ? currentRow.sections.map((s) => ({ ...s })) : [emptySection()],
    [currentRow],
  );
  const [sections, setSections] = useState<LegalSection[]>(initialSections);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    setSections(initialSections);
    setGlobalError(null);
  }, [initialSections]);

  const dirty = !sectionsEqual(sections, initialSections);

  const onResetSections = () => {
    setSections(initialSections);
    setGlobalError(null);
  };

  const onUpdateSection = (index: number, patch: Partial<LegalSection>) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const onAddSection = () => {
    setSections((prev) => [...prev, emptySection()]);
  };

  const onDeleteSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const onMoveSection = (index: number, direction: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const a = next[index];
      const b = next[target];
      if (!a || !b) return prev;
      next[index] = b;
      next[target] = a;
      return next;
    });
  };

  const onPublish = async () => {
    const err = validate(sections, t);
    if (err) {
      setGlobalError(err);
      return;
    }
    setGlobalError(null);
    try {
      await publish.mutateAsync({
        sections: sections.map((s) => ({ heading: s.heading.trim(), body: s.body.trim() })),
      });
      toast.success(
        t('superAdmin.legal.toastPublished', {
          type: t(`superAdmin.legal.type.${type}`),
          lang: language.toUpperCase(),
        }),
      );
    } catch (e) {
      const message = mapServerError(e, t);
      setGlobalError(message);
      toast.error(message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('superAdmin.legal.editorTitle')}</CardTitle>
        <CardDescription>{t('superAdmin.legal.editorBody')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.map((section, index) => (
          <SectionRow
            key={index}
            index={index}
            section={section}
            isFirst={index === 0}
            isLast={index === sections.length - 1}
            canDelete={sections.length > 1}
            onUpdate={(patch) => onUpdateSection(index, patch)}
            onMoveUp={() => onMoveSection(index, -1)}
            onMoveDown={() => onMoveSection(index, 1)}
            onDelete={() => onDeleteSection(index)}
          />
        ))}

        <Button type="button" variant="outline" size="md" onClick={onAddSection}>
          <Plus className="h-4 w-4" />
          {t('superAdmin.legal.addSection')}
        </Button>

        {globalError && (
          <div className="rounded-card-sm border border-error/20 bg-error-50 px-3 py-2">
            <p className="text-sm text-error font-medium">{globalError}</p>
          </div>
        )}

        {dirty && (
          <div className="rounded-card-sm border border-brand-200 bg-brand-50 px-3 py-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-ink-900 font-medium">
              {currentRow
                ? t('superAdmin.legal.dirtyHintWithCurrent', { version: currentRow.version + 1 })
                : t('superAdmin.legal.dirtyHintFirst')}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="md"
                variant="outline"
                onClick={onResetSections}
                disabled={publish.isPending}
              >
                <Undo className="h-4 w-4" />
                {t('superAdmin.tenantDetail.reset')}
              </Button>
              <Button
                type="button"
                size="md"
                onClick={() => void onPublish()}
                disabled={publish.isPending}
              >
                <Save className="h-4 w-4" />
                {publish.isPending
                  ? t('superAdmin.legal.publishing')
                  : t('superAdmin.legal.publish')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SectionRowProps {
  index: number;
  section: LegalSection;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onUpdate: (patch: Partial<LegalSection>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

function SectionRow({
  index,
  section,
  isFirst,
  isLast,
  canDelete,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
}: SectionRowProps) {
  const { t } = useTranslation();
  const headingOver = section.heading.length > HEADING_MAX;
  const bodyOver = section.body.length > BODY_MAX;

  return (
    <div className="rounded-card-sm border border-line bg-bg-elev p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
          {t('superAdmin.legal.sectionLabel', { index: index + 1 })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={t('superAdmin.legal.moveUp')}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={t('superAdmin.legal.moveDown')}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onDelete}
            disabled={!canDelete}
            aria-label={t('superAdmin.legal.deleteSection')}
            className="text-error"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`heading-${index}`}>{t('superAdmin.legal.heading')}</Label>
        <Input
          id={`heading-${index}`}
          value={section.heading}
          onChange={(e) => onUpdate({ heading: e.target.value })}
          placeholder={t('superAdmin.legal.headingPlaceholder')}
          aria-invalid={headingOver}
        />
        {headingOver && (
          <p className="text-xs text-error font-medium">
            {t('superAdmin.legal.errors.headingTooLong', { max: HEADING_MAX })}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor={`body-${index}`}>{t('superAdmin.legal.body')}</Label>
          <span className={`text-xs ${bodyOver ? 'text-error font-medium' : 'text-ink-400'}`}>
            {t('superAdmin.legal.charsUsage', { used: section.body.length, max: BODY_MAX })}
          </span>
        </div>
        <textarea
          id={`body-${index}`}
          rows={6}
          className="w-full rounded-card-sm border border-line bg-bg-elev px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 resize-y"
          placeholder={t('superAdmin.legal.bodyPlaceholder')}
          value={section.body}
          onChange={(e) => onUpdate({ body: e.target.value })}
          aria-invalid={bodyOver}
        />
      </div>
    </div>
  );
}

// ─── Version history ──────────────────────────────────────────────

interface VersionHistoryProps {
  type: LegalDocType;
  language: LegalLanguage;
  currentRow: LegalDocumentRow | null;
}

function VersionHistory({ type, language, currentRow }: VersionHistoryProps) {
  const { t } = useTranslation();
  const versionsQ = useSuperAdminLegalVersions(type, language);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-4 w-4 text-brand-500" />
          {t('superAdmin.legal.historyTitle')}
        </CardTitle>
        <CardDescription>{t('superAdmin.legal.historyBody')}</CardDescription>
      </CardHeader>
      <CardContent>
        {versionsQ.isLoading ? (
          <p className="text-sm text-ink-400">{t('superAdmin.legal.historyLoading')}</p>
        ) : versionsQ.isError || !versionsQ.data ? (
          <p className="text-sm text-error font-medium">
            {t('superAdmin.legal.errors.historyFailed')}
          </p>
        ) : versionsQ.data.items.length === 0 ? (
          <p className="text-sm text-ink-400 italic">{t('superAdmin.legal.historyEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {versionsQ.data.items.map((row) => (
              <VersionRow
                key={row.id}
                row={row}
                isCurrent={currentRow?.id === row.id}
                type={type}
                language={language}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface VersionRowProps {
  row: LegalDocumentRow;
  isCurrent: boolean;
  type: LegalDocType;
  language: LegalLanguage;
}

function VersionRow({ row, isCurrent, type, language }: VersionRowProps) {
  const { t } = useTranslation();
  const restore = useMakeSuperAdminLegalCurrent(type, language);
  const [confirming, setConfirming] = useState(false);

  const onRestore = async () => {
    try {
      await restore.mutateAsync(row.id);
      toast.success(t('superAdmin.legal.toastRestored', { version: row.version }));
      setConfirming(false);
    } catch (e) {
      toast.error(mapServerError(e, t));
    }
  };

  return (
    <li className="rounded-card-sm border border-line bg-bg-elev px-3 py-2.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-ink-900">
            {t('superAdmin.legal.versionLabel', { version: row.version })}
          </span>
          {isCurrent && (
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-pill bg-success-50 text-success flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {t('superAdmin.legal.currentPill')}
            </span>
          )}
          <span className="text-xs text-ink-500">{new Date(row.publishedAt).toLocaleString()}</span>
          <span className="text-xs text-ink-400">
            {t('superAdmin.legal.sectionCount', { count: row.sections.length })}
          </span>
        </div>
        {!isCurrent && !confirming && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setConfirming(true)}
            disabled={restore.isPending}
          >
            {t('superAdmin.legal.restoreCta')}
          </Button>
        )}
        {!isCurrent && confirming && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-700">{t('superAdmin.legal.restoreConfirmHint')}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={restore.isPending}
            >
              {t('superAdmin.legal.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void onRestore()}
              disabled={restore.isPending}
            >
              {restore.isPending
                ? t('superAdmin.legal.restoring')
                : t('superAdmin.legal.restoreConfirm')}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function emptySection(): LegalSection {
  return { heading: '', body: '' };
}

function sectionsEqual(a: LegalSection[], b: LegalSection[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (!left || !right) return false;
    if (left.heading !== right.heading || left.body !== right.body) return false;
  }
  return true;
}

function validate(
  sections: LegalSection[],
  t: (k: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (sections.length === 0) return t('superAdmin.legal.errors.atLeastOne');
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (!s) continue;
    if (s.heading.trim().length === 0) {
      return t('superAdmin.legal.errors.headingRequired', { index: i + 1 });
    }
    if (s.body.trim().length === 0) {
      return t('superAdmin.legal.errors.bodyRequired', { index: i + 1 });
    }
    if (s.heading.length > HEADING_MAX) {
      return t('superAdmin.legal.errors.headingTooLong', { max: HEADING_MAX });
    }
    if (s.body.length > BODY_MAX) {
      return t('superAdmin.legal.errors.bodyTooLong', { max: BODY_MAX });
    }
  }
  return null;
}

function mapServerError(
  err: unknown,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  if (isAxiosError(err)) {
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    if (code === 'UNKNOWN_LEGAL_TYPE' || code === 'UNKNOWN_LEGAL_LANGUAGE') {
      return t('superAdmin.legal.errors.unknownTarget');
    }
    if (code === 'LEGAL_DOCUMENT_NOT_FOUND') {
      return t('superAdmin.legal.errors.notFound');
    }
    if (err.response?.status === 400) {
      return t('superAdmin.legal.errors.validation');
    }
    if (!err.response) {
      return t('superAdmin.legal.errors.network');
    }
  }
  return t('superAdmin.legal.errors.publishFailed');
}
