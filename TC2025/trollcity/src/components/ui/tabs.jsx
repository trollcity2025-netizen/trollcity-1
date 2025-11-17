import React from "react";

const TabsContext = React.createContext({ value: undefined, setValue: () => {} });

export function Tabs({ value, onValueChange, children, className = "" }) {
  const [current, setCurrent] = React.useState(value);
  React.useEffect(() => setCurrent(value), [value]);
  const set = (v) => {
    setCurrent(v);
    onValueChange && onValueChange(v);
  };
  return (
    <TabsContext.Provider value={{ value: current, setValue: set }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

export function TabsTrigger({ value, children, className = "", asChild = false }) {
  const { value: current, setValue } = React.useContext(TabsContext);
  const isActive = current === value;
  const base = `px-3 py-1 text-sm rounded ${isActive ? "bg-cyan-600 text-white" : "bg-[#0a0a0f] border border-[#2a2a3a] text-gray-300"}`;
  const props = { className: `${base} ${className}`, onClick: () => setValue(value) };
  return asChild ? React.cloneElement(children, props) : <button {...props}>{children}</button>;
}

export function TabsContent({ value, children, className = "" }) {
  const { value: current } = React.useContext(TabsContext);
  return <div className={className} style={{ display: current === value ? "block" : "none" }}>{children}</div>;
}

