import React from 'react';
import { useParams } from 'react-router-dom';
import JailCall from './JailCall';

const JailVisitRoom: React.FC = () => {
  const { roomId, userId } = useParams<{ roomId: string; userId: string }>();

  return (
    <JailCall roomId={roomId} callType="video" otherUserId={userId} />
  );
};

export default JailVisitRoom;
