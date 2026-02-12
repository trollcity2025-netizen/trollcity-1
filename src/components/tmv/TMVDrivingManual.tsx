import React, { useState, useEffect } from 'react';

const DRIVING_MANUAL_KEY = 'tmv_driving_manual_acknowledged';

const manualText = `TROLL CITY™
TMV OFFICIAL DRIVING MANUAL

SECTION 1: SPEED REGULATIONS
The absolute maximum speed limit in Troll City is 40 mph. Speeding is a violation of public safety.

SECTION 2: LICENSING LAWS
All drivers must maintain a valid license. You are required to renew your license Every 30 days.
If you are caught driving with an expired license, the penalty is a Court Summons.
Note: Admins are exempt and never need to renew.

SECTION 3: FUEL ECONOMY
Fuel is not free. Everyone except Staff is required to pay for their own gas.
Each driving action consumes exactly 1% of your fuel tank.
When refilling, the standard rate is 300 coins per 5% of fuel.

SECTION 4: SUSPENSIONS & RESTRICTIONS
Driving with a suspended license is generally prohibited. However, under specific Troll City statutes, you may drive with a suspended license Only at night.

SECTION 5: GENERAL INFORMATION
TMV stands for Troll Motor Vehicle.
Always check your vehicle status, insurance, and license details at the TMV Dashboard.
If you fail the written test, the procedure is simple: Try again.

SECTION 6: WRITTEN TEST ANSWER KEY (UPDATED)
1) A
2) B
3) B
4) C
5) A
6) D
7) C
8) A
9) B
10) B
`;

export default function TMVDrivingManual({ onAcknowledge }: { onAcknowledge?: () => void }) {
  const [acknowledged, setAcknowledged] = useState(false);

  const [timeLeft, setTimeLeft] = useState(60);

  const handleAcknowledge = React.useCallback(() => {
    localStorage.setItem(DRIVING_MANUAL_KEY, '1');
    setAcknowledged(true);
    if (onAcknowledge) onAcknowledge();
  }, [onAcknowledge]);

  useEffect(() => {
    const seen = localStorage.getItem(DRIVING_MANUAL_KEY);
    if (seen) {
      setAcknowledged(true);
      if (onAcknowledge) onAcknowledge();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAcknowledge();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleAcknowledge, onAcknowledge]);

  if (acknowledged) return null;

  return (
    <div className="max-w-2xl mx-auto bg-zinc-900 p-8 rounded-xl border border-zinc-800 mt-12 text-white shadow-2xl">
      <h1 className="text-3xl font-bold mb-4 text-center text-purple-300">TROLL CITY™<br/>TMV OFFICIAL DRIVING MANUAL</h1>
      <div className="text-sm whitespace-pre-line mb-8 text-zinc-200" style={{ lineHeight: 1.7 }}>{manualText}</div>
      <button
        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-lg mt-4 shadow-lg"
        onClick={handleAcknowledge}
      >
        I have read and understand the TMV Driving Manual ({timeLeft}s)
      </button>
    </div>
  );
}
