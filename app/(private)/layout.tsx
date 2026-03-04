import { requireUser } from "@/lib/auth";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
