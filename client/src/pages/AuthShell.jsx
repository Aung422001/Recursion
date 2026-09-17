export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-4xl" aria-hidden="true">
            🗣️
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Recursion</h1>
          <p className="text-sm text-slate-500">Ten languages, one lesson at a time</p>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold">{title}</h2>
          {subtitle && <p className="mb-5 mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

export function FormError({ error }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
    >
      {error}
    </p>
  );
}
