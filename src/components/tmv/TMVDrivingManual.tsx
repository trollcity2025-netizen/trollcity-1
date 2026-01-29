import React, { useState, useEffect } from 'react';

const DRIVING_MANUAL_KEY = 'tmv_driving_manual_acknowledged';

const manualText = `TROLL CITY™\nTMV OFFICIAL DRIVING MANUAL\n\nIMPORTANT NOTICE\nThis manual may only be read once. By proceeding, you acknowledge full responsibility for\nunderstanding Troll City transportation laws. Failure to comply may result in penalties, court summons,\nor loss of driving privileges.\n\nSpeed Regulations\nAll vehicles operating within Troll City are subject to a maximum speed regulation. Speed enforcement\nis automated and monitored continuously. Exceeding the legal limit is considered a serious offense and\nmay lead to immediate penalties or court review.\n\nLicense Validity\nEvery driver must maintain an active TMV-issued license. Driving with an expired license is a violation\nof Troll City law and automatically triggers a court summons. Ignorance of expiration status is not an\nacceptable defense.\n\nLicense Renewal Cycle\nTMV licenses are issued on a limited validity cycle. Drivers are required to renew their license every 30\ndays to retain driving privileges. Failure to renew on time results in automatic suspension.\n\nFuel Responsibility\nFuel expenses are the responsibility of all drivers except authorized staff. Gas usage is tracked per\ndriving action and deducted automatically from your fuel reserves.\n\nFuel Consumption\nEach vehicle action consumes fuel at a fixed rate. Operators are expected to monitor fuel levels and\nplan refills accordingly to avoid immobilization or penalties.\n\nSuspended Licenses\nDriving while your license is suspended is strictly prohibited. Any attempt to operate a vehicle under\nsuspension will result in immediate enforcement actions.\n\nFuel Refill Policy\nFuel refills are not free. Refills are purchased using Troll City coins and are priced incrementally. Abuse\nof fuel systems or attempts to bypass charges will be prosecuted.\n\nTMV Authority\nTMV stands for Troll Motor Vehicle. TMV is the sole authority governing vehicle registration, driver\nlicensing, fuel enforcement, and compliance monitoring within Troll City.\n\nVehicle Status Monitoring\nAll drivers are required to regularly review their vehicle status. License validity, fuel levels, and\nviolations are accessible through the official TMV Dashboard.\n\nTest Failure\nFailure to pass the TMV certification exam does not permanently bar access. Drivers may retest after\nreviewing all applicable regulations. Repeated failures may trigger review.\n\nACKNOWLEDGEMENT\nBy proceeding to the TMV examination, you confirm that you have read and understood this manual in\nits entirety. Troll City recognizes no appeals based on failure to read or misinterpretation of these rules.`;

export default function TMVDrivingManual({ onAcknowledge }: { onAcknowledge?: () => void }) {
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(DRIVING_MANUAL_KEY);
    if (seen) setAcknowledged(true);
  }, []);

  const handleAcknowledge = () => {
    localStorage.setItem(DRIVING_MANUAL_KEY, '1');
    setAcknowledged(true);
    if (onAcknowledge) onAcknowledge();
  };

  if (acknowledged) return null;

  return (
    <div className="max-w-2xl mx-auto bg-zinc-900 p-8 rounded-xl border border-zinc-800 mt-12 text-white shadow-2xl">
      <h1 className="text-3xl font-bold mb-4 text-center text-purple-300">TROLL CITY™<br/>TMV OFFICIAL DRIVING MANUAL</h1>
      <div className="text-sm whitespace-pre-line mb-8 text-zinc-200" style={{ lineHeight: 1.7 }}>{manualText}</div>
      <button
        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-lg mt-4 shadow-lg"
        onClick={handleAcknowledge}
      >
        I have read and understand the TMV Driving Manual
      </button>
    </div>
  );
}
