import type { ReactNode } from 'react';

import { useI18n } from '../shared/i18n/react';
import { cardCls, sectionTitleCls } from './classes';

export function Spinner({ label }: { label?: string }): ReactNode {
  const { t } = useI18n();
  return (
    <div
      className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-400"
      role="status"
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400"
      />
      {label ?? t('spinnerLoading')}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center">
      {icon ? <div className="mb-1 text-zinc-500">{icon}</div> : null}
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function StatusBanner({
  kind,
  children,
}: {
  kind: 'success' | 'error' | 'info';
  children: ReactNode;
}): ReactNode {
  const styles =
    kind === 'success'
      ? 'border-emerald-800 bg-emerald-950/60 text-emerald-300'
      : kind === 'error'
        ? 'border-rose-900 bg-rose-950/60 text-rose-300'
        : 'border-zinc-700 bg-zinc-800/60 text-zinc-300';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-md border px-3 py-2 text-xs ${styles}`}
    >
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <section className={cardCls}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={sectionTitleCls}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: number }): ReactNode {
  const { t } = useI18n();
  const pct = Math.round(confidence * 100);
  const cls =
    confidence >= 0.9
      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
      : confidence >= 0.75
        ? 'bg-amber-950 text-amber-300 border-amber-800'
        : 'bg-rose-950 text-rose-300 border-rose-800';
  return (
    <span
      title={t('confidenceTitle', { pct })}
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${cls}`}
    >
      {pct}%
    </span>
  );
}

export function LogoMark({ size = 20 }: { size?: number }): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="2" y="3" width="20" height="18" rx="4" fill="#059669" />
      <circle cx="9" cy="10" r="2.4" fill="#09090b" />
      <path
        d="M5.5 16.5c.8-2 2-3 3.5-3s2.7 1 3.5 3"
        stroke="#09090b"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M15 8.5h4M15 12h4M15 15.5h2.5"
        stroke="#09090b"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
