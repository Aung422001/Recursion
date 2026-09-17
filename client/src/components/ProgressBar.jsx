export function ProgressBar({ value, max = 1, label, className = '', tone = 'emerald' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const tones = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    sky: 'bg-sky-500',
  };

  return (
    <div
      className={`h-3 w-full overflow-hidden rounded-full bg-slate-200 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-out ${tones[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
