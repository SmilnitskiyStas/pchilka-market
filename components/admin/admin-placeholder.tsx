type AdminPlaceholderProps = {
  label: string;
  title: string;
  description: string;
  fields: string[];
};

export default function AdminPlaceholder({ label, title, description, fields }: AdminPlaceholderProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{label}</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
      <p className="mt-3 text-sm text-slate-700 sm:text-base">{description}</p>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">План форми для цього розділу:</p>
        <ul className="mt-2 space-y-1">
          {fields.map((field) => (
            <li key={field} className="text-sm text-slate-700">
              - {field}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
