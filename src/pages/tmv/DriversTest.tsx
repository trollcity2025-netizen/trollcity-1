import React from 'react';

interface DriversTestProps {
  onComplete: () => void;
}

const DriversTest: React.FC<DriversTestProps> = ({ onComplete }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg text-black">
      <h2 className="text-2xl font-bold mb-4">Drivers Test</h2>
      <p className="mb-4">Please complete the drivers test to proceed.</p>
      <button
        onClick={onComplete}
        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
      >
        Complete Test
      </button>
    </div>
  );
};

export default DriversTest;