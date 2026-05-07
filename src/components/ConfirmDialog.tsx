type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, message, confirmLabel = 'ยืนยัน', cancelLabel = 'ยกเลิก', danger = false, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
