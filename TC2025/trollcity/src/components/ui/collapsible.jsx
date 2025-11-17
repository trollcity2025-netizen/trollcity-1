import React from "react";

const CollapsibleContext = React.createContext({ value: false, setValue: () => {} });

export function Collapsible({ open, onOpenChange, children, className = "" }) {
  const [value, setValue] = React.useState(Boolean(open));
  React.useEffect(() => {
    if (typeof open === "boolean") setValue(open);
  }, [open]);
  const set = (v) => {
    setValue(v);
    onOpenChange && onOpenChange(v);
  };
  return (
    <CollapsibleContext.Provider value={{ value, setValue: set }}>
      <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
  );
}

export function CollapsibleTrigger({ children, className = "", asChild = false }) {
  const { value, setValue } = React.useContext(CollapsibleContext);
  const props = {
    className,
    onClick: () => setValue(!value),
  };
  return asChild ? React.cloneElement(children, props) : <button {...props}>{children}</button>;
}

export function CollapsibleContent({ children, className = "" }) {
  const { value } = React.useContext(CollapsibleContext);
  return <div className={className} style={{ display: value ? "block" : "none" }}>{children}</div>;
}

