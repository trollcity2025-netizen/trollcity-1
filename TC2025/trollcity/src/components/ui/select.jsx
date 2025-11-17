import React from "react";

const SelectContext = React.createContext({ value: undefined, onValueChange: () => {}, open: false, setOpen: () => {} });

export function Select({ value, onValueChange, children, className = "" }) {
  const [open, setOpen] = React.useState(false);
  const ctx = React.useMemo(() => ({ value, onValueChange: onValueChange || (() => {}), open, setOpen }), [value, onValueChange, open]);
  return <div className={className}><SelectContext.Provider value={ctx}>{children}</SelectContext.Provider></div>;
}

export function SelectTrigger({ children, className = "" }) {
  const { open, setOpen } = React.useContext(SelectContext);
  return <button type="button" className={className} aria-expanded={open} onClick={() => setOpen(!open)}>{children}</button>;
}

export function SelectValue({ children }) {
  const { value } = React.useContext(SelectContext);
  return <span>{children || String(value || "")}</span>;
}

export function SelectContent({ children, className = "" }) {
  const { open } = React.useContext(SelectContext);
  const cls = [className, open ? "block" : "hidden"].filter(Boolean).join(" ");
  return <div className={cls} role="listbox">{children}</div>;
}

export function SelectItem({ value, children, className = "", onSelect }) {
  const { onValueChange, setOpen } = React.useContext(SelectContext);
  const handleClick = () => {
    if (onSelect) onSelect(value);
    if (onValueChange) onValueChange(value);
    setOpen(false);
  };
  return <div className={["px-2 py-1 cursor-pointer", className].filter(Boolean).join(" ")} role="option" aria-selected={false} onClick={handleClick}>{children}</div>;
}
