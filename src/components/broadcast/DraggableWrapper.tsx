import React, { useState, useRef, useEffect } from 'react';

interface DraggableWrapperProps {
  children: React.ReactNode;
  initialPos?: { x: number; y: number };
  bounds?: { left?: number; right?: number; top?: number; bottom?: number };
}

export default function DraggableWrapper({
  children,
  initialPos = { x: 20, y: 20 },
  bounds = { left: 0, right: window.innerWidth - 400, top: 0, bottom: window.innerHeight - 400 }
}: DraggableWrapperProps) {
  const [position, setPosition] = useState(initialPos);
  const [isDragging, setIsDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      let newX = e.clientX - offsetRef.current.x;
      let newY = e.clientY - offsetRef.current.y;
      
      if (bounds.left !== undefined) newX = Math.max(bounds.left, newX);
      if (bounds.right !== undefined) newX = Math.min(bounds.right, newX);
      if (bounds.top !== undefined) newY = Math.max(bounds.top, newY);
      if (bounds.bottom !== undefined) newY = Math.min(bounds.bottom, newY);
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, bounds]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    offsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  return (
    <div
      className="fixed z-50 cursor-move"
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  );
}