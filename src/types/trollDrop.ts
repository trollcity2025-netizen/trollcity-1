export type TrollColor = 'red' | 'green';

export interface TrollDropParticipant {
  userId: string;
  username: string;
  claimedAt: number;
}

export interface TrollDrop {
  id: string;
  streamId: string;
  color: TrollColor;
  createdAt: number;
  expiresAt: number;
  participants: TrollDropParticipant[];
  totalAmount: number;
  claimed: boolean;
}

export interface TrollDropState {
  active: TrollDrop | null;
  history: TrollDrop[];
  dropCount: number;
}
