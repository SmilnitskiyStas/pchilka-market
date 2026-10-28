'use client';

export default function VideoOptimizationOptions({ enabled, keepOriginal, onEnabledChange, onKeepOriginalChange, disabled = false }: {
  enabled: boolean; keepOriginal: boolean; onEnabledChange: (value: boolean) => void; onKeepOriginalChange: (value: boolean) => void; disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="min-w-0 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
    <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} />Оптимізувати відео на сервері</label>
    {enabled ? <>
      <label className="block">Оригінальне відео<select value={keepOriginal ? 'keep' : 'delete'} onChange={(event) => onKeepOriginalChange(event.target.value === 'keep')} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"><option value="keep">Залишити оригінал і нову вебверсію</option><option value="delete">Видалити оригінал після успішної оптимізації</option></select></label>
      <p className="text-xs text-slate-600">Для MP4, WebM, MOV і M4V до 512 МБ та 15 хвилин. Якщо обробка не вдасться або файл не стане меншим, оригінал залишиться.</p>
    </> : null}
  </fieldset>;
}
