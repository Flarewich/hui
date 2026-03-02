import "./globals.css";
import Header from "@/components/Header";

export const metadata = {
  title: "CYBERHUB",
  description: "Tournament platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-black text-white">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}