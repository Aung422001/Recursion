import { Button } from './Button';

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-300 border-t-emerald-600" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  const message =
    error?.status === 0 || error?.message === 'Failed to fetch'
      ? 'Could not reach the server. Is it running on port 4000?'
      : (error?.message ?? 'Unexpected error');

  return (
    <div className="card mx-auto max-w-md p-8 text-center" role="alert">
      <div className="text-3xl" aria-hidden="true">
        ⚠️
      </div>
      <h2 className="mt-3 font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
      {onRetry && (
        <Button className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon = '🗂️', title, description, action }) {
  return (
    <div className="card p-10 text-center">
      <div className="text-4xl" aria-hidden="true">
        {icon}
      </div>
      <h2 className="mt-3 font-semibold text-slate-900">{title}</h2>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
