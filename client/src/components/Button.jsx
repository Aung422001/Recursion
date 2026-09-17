const VARIANTS = {
  primary:
    'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 active:bg-slate-100 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:text-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-300',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled,
  children,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold
        transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
