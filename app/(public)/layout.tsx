import "@/app/globals.css";
import Header from "@/components/Header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cyber text-white">
      
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>

      <footer className="mt-10 border-t border-white/10 bg-black/20">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-white/70">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <span>© {new Date().getFullYear()} Турниры</span>
            <span className="text-white/60">support@tournaments</span>
          </div>
        </div>
      </footer>
    </div>
  );
}