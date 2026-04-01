import React from 'react';
import { PopupMessage } from '../../lib/events/aprilFools';

interface AprilFoolsPopupProps {
  popup: PopupMessage;
  onDismiss: () => void;
}

export default function AprilFoolsPopup({ popup, onDismiss }: AprilFoolsPopupProps) {
  return (
    <div className="af-popup-backdrop" onClick={onDismiss}>
      <div className="af-popup-card" onClick={(e) => e.stopPropagation()}>
        {popup.title && (
          <div className="af-popup-title">{popup.title}</div>
        )}
        <div className="af-popup-message">{popup.message}</div>
        <button className="af-popup-button" onClick={onDismiss}>
          {popup.buttonText || 'OK'}
        </button>
      </div>
    </div>
  );
}
