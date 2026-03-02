import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-cyber text-white">
      {/* Header уже есть в root layout (если нет — можно вставить сюда) */}
      <main className="mx-auto max-w-6xl px-4 py-12">
        <section className="card p-8 md:p-12">
          <div className="text-xs text-white/60">CYBER PLATFORM</div>
          <h1 className="mt-3 text-3xl md:text-5xl font-bold title-glow">
            Турниры, сетки, призы — всё в одном месте
          </h1>
          <p className="mt-4 max-w-2xl text-base md:text-lg muted">
            Регистрируйся на турниры, следи за расписанием, играй и забирай призы.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link className="btn-primary" href="/tournaments">Смотреть турниры</Link>
            <Link className="btn-ghost" href="/login">Войти / Регистрация</Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="card p-5">
              <div className="text-sm font-semibold">Быстрая регистрация</div>
              <div className="mt-2 text-sm muted">Записался — получил слот — играешь.</div>
            </div>
            <div className="card p-5">
              <div className="text-sm font-semibold">Сетка и расписание</div>
              <div className="mt-2 text-sm muted">Плей-офф, группы, матчи по времени.</div>
            </div>
            <div className="card p-5">
              <div className="text-sm font-semibold">Призы и магазин</div>
              <div className="mt-2 text-sm muted">Бонусы, мерч и награды за победы.</div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/20">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-white/70">
          © {new Date().getFullYear()} Турниры
        </div>
      </footer>
    </div>
  );
}