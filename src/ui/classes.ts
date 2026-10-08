/** Shared Tailwind class recipes for the developer-tool look. */
export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40',
  ghost:
    'inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40',
  danger:
    'inline-flex items-center justify-center gap-1 rounded-md border border-rose-900 bg-rose-950/60 px-2 py-1 text-xs font-medium text-rose-300 transition hover:bg-rose-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-40',
};

export const inputCls =
  'w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50';

export const selectCls = inputCls;

export const cardCls = 'rounded-lg border border-zinc-800 bg-zinc-900/60 p-4';

export const labelCls = 'mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400';

export const sectionTitleCls = 'text-sm font-semibold text-zinc-100';
