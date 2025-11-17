import React from "react";

const SidebarContext = React.createContext({ openMobile: false, setOpenMobile: () => {} });

export function SidebarProvider({ children }) {
  const [openMobile, setOpenMobile] = React.useState(false);
  const value = React.useMemo(() => ({ openMobile, setOpenMobile }), [openMobile]);
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  return React.useContext(SidebarContext);
}

export function Sidebar({ children, className = "" }) {
  return <aside className={className}>{children}</aside>;
}
export function SidebarHeader({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}
export function SidebarFooter({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}
export function SidebarContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}
export function SidebarGroup({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}
export function SidebarGroupLabel({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}
export function SidebarGroupContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}
export function SidebarMenu({ children, className = "" }) {
  const base = "list-none m-0 p-0 space-y-2";
  return <ul className={[base, className].filter(Boolean).join(" ")}>{children}</ul>;
}
export function SidebarMenuItem({ children, className = "" }) {
  const base = "list-none";
  return <li className={[base, className].filter(Boolean).join(" ")}>{children}</li>;
}
export function SidebarMenuButton({ children, className = "", onClick, asChild = false }) {
  if (asChild && React.isValidElement(children)) {
    const child = children;
    const mergedClass = [child.props.className, className].filter(Boolean).join(" ");
    const mergedOnClick = (e) => {
      if (typeof child.props.onClick === "function") child.props.onClick(e);
      if (typeof onClick === "function") onClick(e);
    };
    return React.cloneElement(child, { className: mergedClass, onClick: mergedOnClick });
  }
  return (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  );
}

export function SidebarTrigger({ children, className = "" }) {
  const { openMobile, setOpenMobile } = useSidebar();
  return (
    <button className={className} onClick={() => setOpenMobile(!openMobile)}>
      {children || (openMobile ? "Close" : "Open")}
    </button>
  );
}
