import React from 'react';

interface TMVDrivingManualProps {
  onAcknowledge: () => void;
}

const TMVDrivingManual: React.FC<TMVDrivingManualProps> = ({ onAcknowledge }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg text-black">
      <h2 className="text-2xl font-bold mb-4">TMV Driving Manual</h2>
      <p className="mb-4">This is the driving manual. Please read it carefully.</p>
      <button
        onClick={onAcknowledge}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Acknowledge
      </button>
    </div>
  );
};

export default TMVDrivingManual;