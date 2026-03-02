export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6">
        <h1 className="text-2xl font-bold title-glow">Вход</h1>
        <p className="mt-2 text-sm muted">Войди или создай аккаунт.</p>

        <div className="mt-6 grid gap-3">
          <div>
            <div className="mb-2 text-xs text-white/60">Email</div>
            <input className="input" placeholder="you@mail.com" />
          </div>

          <div>
            <div className="mb-2 text-xs text-white/60">Пароль</div>
            <input className="input" type="password" placeholder="••••••••" />
          </div>

          <button className="btn-primary mt-2 w-full">Войти</button>
          <button className="btn-ghost w-full">Регистрация</button>

          <div className="pt-2 text-center text-xs text-white/60">
            Позже подключим Supabase Auth (у тебя он уже есть в lib).
          </div>
        </div>
      </div>
    </div>
  );
}