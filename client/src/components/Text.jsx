import { LANGUAGES } from 'shared/constants.js';

const SCRIPT_CLASS = {
  latin: '',
  myanmar: 'font-myanmar leading-loose',
  thai: 'font-thai leading-loose',
  japanese: 'font-japanese',
  korean: 'font-korean',
  arabic: 'font-arabic',
  devanagari: 'font-devanagari leading-loose',
};

/**
 * Renders a word in a given language with the right font and direction.
 *
 * Getting this wrong is not cosmetic: Burmese, Thai and Devanagari render as
 * boxes in a font that does not cover them, stacked marks collide without extra
 * line height, and Arabic runs the wrong way without an explicit `dir`.
 */
export function Text({ lang, children, className = '', as: Tag = 'span', ...props }) {
  const meta = LANGUAGES[lang];
  const script = meta?.script ?? 'latin';

  return (
    <Tag
      lang={lang}
      dir={meta?.dir ?? 'ltr'}
      className={`${SCRIPT_CLASS[script] ?? ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </Tag>
  );
}

/** A word with its romanization underneath, when the script needs one. */
export function TextWithReading({ lang, text, romanization, className = '', readingClass = '' }) {
  return (
    <span className={className}>
      <Text lang={lang}>{text}</Text>
      {romanization && (
        <span className={`block font-sans text-sm font-normal italic text-slate-400 ${readingClass}`}>
          {romanization}
        </span>
      )}
    </span>
  );
}

export const languageName = (code) => LANGUAGES[code]?.name ?? code;
