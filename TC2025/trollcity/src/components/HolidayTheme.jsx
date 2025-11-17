import React, { useState, useEffect } from 'react';

const HOLIDAYS = {
  '01-01': { name: "New Year's Day", theme: 'new-year', colors: ['#FFD700', '#FF6B6B', '#4ECDC4'] },
  '02-14': { name: "Valentine's Day", theme: 'valentine', colors: ['#FF6B6B', '#FF8E8E', '#FFB3B3'] },
  '03-17': { name: "St. Patrick's Day", theme: 'st-patrick', colors: ['#4CAF50', '#8BC34A', '#CDDC39'] },
  '04-01': { name: "April Fool's Day", theme: 'april-fool', colors: ['#FF9800', '#FFC107', '#FFEB3B'] },
  '05-01': { name: "May Day", theme: 'may-day', colors: ['#FF69B4', '#FFB6C1', '#FFC0CB'] },
  '06-19': { name: "Juneteenth", theme: 'juneteenth', colors: ['#000000', '#FF0000', '#00FF00'] },
  '07-04': { name: "Independence Day", theme: 'independence', colors: ['#B22222', '#FFFFFF', '#4169E1'] },
  '09-02': { name: "Labor Day", theme: 'labor-day', colors: ['#8B4513', '#A0522D', '#CD853F'] },
  '10-31': { name: "Halloween", theme: 'halloween', colors: ['#FF6B35', '#1A1A1A', '#8B4513'] },
  '11-11': { name: "Veterans Day", theme: 'veterans', colors: ['#B22222', '#FFFFFF', '#4169E1'] },
  '11-28': { name: "Thanksgiving", theme: 'thanksgiving', colors: ['#8B4513', '#D2691E', '#FF8C00'] },
  '12-25': { name: "Christmas", theme: 'christmas', colors: ['#DC143C', '#228B22', '#FFD700'] },
  '12-31': { name: "New Year's Eve", theme: 'new-year-eve', colors: ['#4B0082', '#FFD700', '#FF1493'] }
};

const HolidayTheme = ({ children }) => {
  const [currentHoliday, setCurrentHoliday] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationShown, setCelebrationShown] = useState(false);

  useEffect(() => {
    const checkHoliday = () => {
      const today = new Date();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const day = today.getDate().toString().padStart(2, '0');
      const dateKey = `${month}-${day}`;
      
      const holiday = HOLIDAYS[dateKey];
      if (holiday) {
        setCurrentHoliday(holiday);
        
        // Only show celebration once per day
        const todayKey = `holiday_celebration_${dateKey}`;
        const hasShownToday = localStorage.getItem(todayKey);
        
        if (!hasShownToday && !celebrationShown) {
          setShowCelebration(true);
          setCelebrationShown(true);
          localStorage.setItem(todayKey, 'true');
          
          // Hide celebration after 5 seconds
          setTimeout(() => {
            setShowCelebration(false);
          }, 5000);
        }
      } else {
        setCurrentHoliday(null);
        setCelebrationShown(false);
      }
    };

    checkHoliday();
    // Check again every hour in case the date changes
    const interval = setInterval(checkHoliday, 3600000);
    
    return () => clearInterval(interval);
  }, [celebrationShown]);

  const getHolidayStyles = () => {
    if (!currentHoliday) return {};
    
    const [primary, secondary, accent] = currentHoliday.colors;
    
    return {
      '--holiday-primary': primary,
      '--holiday-secondary': secondary,
      '--holiday-accent': accent,
    };
  };

  const getHolidayClassName = () => {
    if (!currentHoliday) return '';
    return `holiday-theme-${currentHoliday.theme}`;
  };

  return (
    <div 
      className={`holiday-theme-container ${getHolidayClassName()}`}
      style={getHolidayStyles()}
    >
      {children}
      
      {/* Holiday indicator badge */}
      {currentHoliday && (
        <div className="holiday-indicator">
          <span className="holiday-badge">🎊 {currentHoliday.name} 🎊</span>
        </div>
      )}
      
      {showCelebration && currentHoliday && (
        <div className="holiday-celebration-overlay" onClick={() => setShowCelebration(false)}>
          <div className="holiday-celebration-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="holiday-title">🎉 Happy {currentHoliday.name}! 🎉</h2>
            <p className="holiday-message">Enjoy the special holiday theme!</p>
            <button 
              className="holiday-close-btn" 
              onClick={() => setShowCelebration(false)}
            >
              Continue to App
            </button>
          </div>
          
          {/* Floating elements for celebration */}
          <div className="holiday-particles">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="holiday-particle"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${3 + Math.random() * 2}s`,
                  backgroundColor: currentHoliday.colors[Math.floor(Math.random() * currentHoliday.colors.length)],
                  width: `${8 + Math.random() * 12}px`,
                  height: `${8 + Math.random() * 12}px`,
                }}
              />
            ))}
          </div>
        </div>
      )}
      
      <style jsx>{`
        .holiday-theme-container {
          position: relative;
          min-height: 100vh;
        }
        
        .holiday-celebration-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.5s ease-in-out;
        }
        
        .holiday-celebration-content {
          text-align: center;
          background: linear-gradient(135deg, var(--holiday-primary), var(--holiday-secondary));
          padding: 2rem;
          border-radius: 1rem;
          box-shadow: 0 0 50px rgba(255, 255, 255, 0.3);
          animation: celebrationPulse 2s ease-in-out infinite;
        }
        
        .holiday-title {
          color: white;
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }
        
        .holiday-message {
          color: white;
          font-size: 1.2rem;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
        }
        
        .holiday-particles {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
        }
        
        .holiday-particle {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          animation: floatUp 5s ease-in-out infinite;
          opacity: 0;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes celebrationPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes floatUp {
          0% {
            transform: translateY(100vh) scale(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) scale(1.5);
            opacity: 0;
          }
        }
        
        /* Holiday-specific themes */
        .holiday-theme-christmas {
          background: linear-gradient(135deg, #DC143C, #228B22, #FFD700);
        }
        
        .holiday-theme-halloween {
          background: linear-gradient(135deg, #FF6B35, #1A1A1A, #8B4513);
        }
        
        .holiday-theme-valentine {
          background: linear-gradient(135deg, #FF6B6B, #FF8E8E, #FFB3B3);
        }
        
        .holiday-theme-independence {
          background: linear-gradient(135deg, #B22222, #FFFFFF, #4169E1);
        }
        
        .holiday-theme-new-year {
          background: linear-gradient(135deg, #FFD700, #FF6B6B, #4ECDC4);
        }
        
        .holiday-theme-st-patrick {
          background: linear-gradient(135deg, #4CAF50, #8BC34A, #CDDC39);
        }
        
        .holiday-theme-thanksgiving {
          background: linear-gradient(135deg, #8B4513, #D2691E, #FF8C00);
        }
        
        .holiday-theme-april-fool {
          background: linear-gradient(135deg, #FF9800, #FFC107, #FFEB3B);
        }
        
        .holiday-theme-new-year-eve {
          background: linear-gradient(135deg, #4B0082, #FFD700, #FF1493);
        }
        
        /* Holiday indicator badge */
        .holiday-indicator {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1000;
          animation: holidaySlideIn 0.5s ease-out;
        }
        
        .holiday-badge {
          background: linear-gradient(135deg, var(--holiday-primary), var(--holiday-secondary));
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255, 255, 255, 0.2);
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
        }
        
        .holiday-close-btn {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.3);
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 16px;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }
        
        .holiday-close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        
        @keyframes holidaySlideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default HolidayTheme;