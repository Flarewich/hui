export default function PageShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="title">{title}</h1>
            {subtitle && <p className="mt-2 muted text-sm">{subtitle}</p>}
          </div>
          {right}
        </div>
      </div>
      {children}
    </div>
  );
}
