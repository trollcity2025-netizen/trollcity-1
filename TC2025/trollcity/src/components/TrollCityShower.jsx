import React, { useMemo } from "react";

export default function TrollCityShower({ count = 40 }) {
  const streaks = useMemo(() => {
    return Array.from({ length: count }).map(() => {
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const rotate = -20 + Math.random() * 40;
      const width = 2 + Math.random() * 3;
      const length = 80 + Math.random() * 160;
      const delay = Math.random() * 2.5;
      const duration = 1.6 + Math.random() * 3.2;
      const colorStop = Math.random() > 0.5 ? "rgba(255,255,255,0.9)" : "rgba(0, 242, 255, 0.9)";
      return { left, top, rotate, width, length, delay, duration, colorStop };
    });
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-40">
      <style>{`
        @keyframes lightningFlash {
          0% { opacity: 0; filter: blur(0px); }
          5% { opacity: 0.9; filter: blur(0.5px); }
          10% { opacity: 0.3; filter: blur(1px); }
          15% { opacity: 1; filter: blur(0.2px); }
          25% { opacity: 0; filter: blur(0px); }
          100% { opacity: 0; filter: blur(0px); }
        }
        @keyframes ambientGlow {
          0% { opacity: 0.05; }
          50% { opacity: 0.12; }
          100% { opacity: 0.05; }
        }
      `}</style>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60vh 60vh at 10% 10%, rgba(0, 242, 255, 0.10), transparent 60%)," +
            "radial-gradient(50vh 50vh at 85% 30%, rgba(255,255,255,0.06), transparent 60%)",
          mixBlendMode: "screen",
          animation: "ambientGlow 6s ease-in-out infinite",
        }}
      />
      {streaks.map((s, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            transform: `rotate(${s.rotate}deg)`,
            width: `${s.length}px`,
            height: `${s.width}px`,
            background: `linear-gradient(90deg, ${s.colorStop}, rgba(255,255,255,0) 60%)`,
            boxShadow: `0 0 12px ${s.colorStop}`,
            opacity: 0,
            animation: `lightningFlash ${s.duration}s ${s.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}
