
import React, { useState } from 'react';
import { GoldenBuzzerGodMode } from './GoldenBuzzerGodMode'; // Adjust the import path as needed

const BuzzerExample = () => {
  const [isBuzzerActive, setIsBuzzerActive] = useState(false);

  const handleBuzzerPress = () => {
    // Prevent re-triggering while the animation is already running
    if (!isBuzzerActive) {
      setIsBuzzerActive(true);
    }
  };

  const handleAnimationComplete = () => {
    console.log("Buzzer animation complete. Ready for next trigger.");
    setIsBuzzerActive(false);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#1a1a1a'
    }}>
      <button 
        onClick={handleBuzzerPress}
        style={{
          padding: '20px 40px',
          fontSize: '2rem',
          fontWeight: 'bold',
          color: '#111',
          background: 'linear-gradient(145deg, #FFD700, #FFAA00)',
          border: 'none',
          borderRadius: '50px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4), 0 0 20px #FFD700',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        PRESS THE GOLDEN BUZZER
      </button>

      <GoldenBuzzerGodMode 
        trigger={isBuzzerActive} 
        judgeName="MaiCorp Admin"
        onComplete={handleAnimationComplete}
      />
    </div>
  );
};

export default BuzzerExample;
