import { LANGUAGES } from 'shared/constants.js';

const TONE = {
  en: 'bg-slate-100 text-slate-700',
  my: 'bg-emerald-100 text-emerald-700',
  th: 'bg-violet-100 text-violet-700',
  ja: 'bg-rose-100 text-rose-700',
  ko: 'bg-sky-100 text-sky-700',
  vi: 'bg-amber-100 text-amber-700',
  id: 'bg-red-100 text-red-700',
  ms: 'bg-teal-100 text-teal-700',
  hi: 'bg-orange-100 text-orange-700',
  ar: 'bg-cyan-100 text-cyan-700',
};

/**
 * A short code chip standing in for the language.
 *
 * Flag emoji were the obvious choice and the wrong one: Windows ships no glyphs
 * for regional-indicator pairs, so every flag degrades to bare letters like
 * "SA". A language is not a country either — Arabic and Malay each span many.
 */
export function LanguageBadge({ code, className = '' }) {
  const meta = LANGUAGES[code];
  if (!meta) return null;

  return (
    <span
      aria-hidden="true"
      title={meta.name}
      className={`inline-flex h-6 min-w-[26px] items-center justify-center rounded-md px-1.5
        text-[11px] font-bold uppercase tracking-wide ${TONE[code] ?? TONE.en} ${className}`}
    >
      {code}
    </span>
  );
}

/** Plain-text label for places that cannot hold markup, such as <option>. */
export const languageLabel = (code) => {
  const meta = LANGUAGES[code];
  if (!meta) return code;
  return meta.name === meta.nativeName ? meta.name : `${meta.name} — ${meta.nativeName}`;
};
