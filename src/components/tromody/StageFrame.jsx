import React from 'react';

const StageFrame = ({
  children,
  side,
  isLive = false,
  giftCount = 0,
  onJoin,
  disabled = false,
  joinText = 'Join Stage',
  curtainsOpen = false,
  crowdLevel = 0
}) => {
  return (
    <div className={`stage-frame ${side} ${isLive ? 'live' : ''} ${curtainsOpen ? 'curtains-open' : ''} ${crowdLevel > 0 ? `shake-${crowdLevel}` : ''}`}>
      {/* Left Curtain */}
      <div className="curtain curtain-left" />

      {/* Right Curtain */}
      <div className="curtain curtain-right" />

      {/* Stage Interior */}
      <div className="stage-inner">
        {children || (
          <button
            onClick={onJoin}
            disabled={disabled}
            className="join-stage"
          >
            {joinText}
          </button>
        )}
      </div>

      {/* Stage Footer */}
      <div className="stage-footer">
        🎁 Gifts: <span className={`gift-count ${side}`}>{giftCount}</span>
      </div>

      {/* Spotlight Effect */}
      {isLive && <div className="spotlight" />}
    </div>
  );
};

export default StageFrame;