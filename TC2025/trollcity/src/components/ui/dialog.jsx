import React from "react";

export function Dialog({ open, onOpenChange, children }) {
  const [isOpen, setIsOpen] = React.useState(Boolean(open));
  React.useEffect(() => {
    if (typeof open === "boolean") setIsOpen(open);
  }, [open]);
  const close = () => {
    setIsOpen(false);
    onOpenChange && onOpenChange(false);
  };
  return isOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={close}>
      <div className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  ) : null;
}

export function DialogContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}
export function DialogHeader({ children, className = "" }) {
  return <div className={`mb-2 ${className}`}>{children}</div>;
}
export function DialogTitle({ children, className = "" }) {
  return <h3 className={`text-white font-bold ${className}`}>{children}</h3>;
}
export function DialogDescription({ children, className = "" }) {
  return <p className={`text-gray-400 text-sm ${className}`}>{children}</p>;
}
export function DialogTrigger({ children, className = "", onClick }) {
  return (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  );
}

export function DialogFooter({ children, className = "" }) {
  return <div className={`mt-4 flex justify-end gap-2 ${className}`}>{children}</div>;
}
