
import React, { useState, useEffect } from 'react';
import useGlobalActivity from '../../hooks/useGlobalActivity';
import '../../styles/ticker.css';

const GlobalTicker = () => {
  const events = useGlobalActivity();
  const [isHeartbeating, setIsHeartbeating] = useState(false);

  useEffect(() => {
    if (events.length > 0 && events[0].priority === 'high') {
      setIsHeartbeating(true);
      const timer = setTimeout(() => setIsHeartbeating(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [events]);

  return (
    <div className={`ticker-wrap ${isHeartbeating ? 'heartbeat' : ''}`}>
      <div className="ticker">
        {events.map((event) => (
          <div key={event.id} className="ticker-item">
            {event.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GlobalTicker;
