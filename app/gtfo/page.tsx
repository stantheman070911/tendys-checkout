export default function GtfoPage() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <div className="w-full rounded-3xl border border-stone-800 bg-stone-900/80 p-10 text-center shadow-2xl shadow-black/40">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
            Restricted Area
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-100">
            Wrong door.
          </h1>
          <p className="mt-4 text-base leading-7 text-stone-300">
            This route is not available. If you expected the admin panel, use
            the current admin entrypoint instead.
          </p>
        </div>
      </div>
    </main>
  );
}
