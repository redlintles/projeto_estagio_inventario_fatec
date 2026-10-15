import React from "react";
export function BatchConfirmation({
  title,
  confirmLabel,
  busy,
  error,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  confirmLabel: string;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  const dialog = React.useRef<HTMLDialogElement>(null);
  const cancel = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const element = dialog.current!;
    element.showModal();
    cancel.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="batch-confirmation"
      aria-labelledby="batch-confirmation-title"
      aria-describedby="batch-confirmation-description"
      aria-busy={busy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="batch-confirmation-content">
        <p className="batch-confirmation-eyebrow">Alteração em lote</p>
        <h2 id="batch-confirmation-title">{title}</h2>
        <div id="batch-confirmation-description">{children}</div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {busy && <p role="status">Processando a operação. Aguarde…</p>}
        <div className="batch-confirmation-actions">
          <button
            ref={cancel}
            className="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button disabled={busy} onClick={onConfirm}>
            {busy ? "Processando…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
