
import React from 'react';

interface Performer {
  user?: {
    username: string;
    avatar_url: string;
  };
  total_votes: number;
}

interface BracketMatchupProps {
  performer1?: Performer;
  performer2?: Performer;
  title: string;
}

const BracketParticipant = ({ performer }: { performer?: Performer }) => (
  <div className={`flex items-center justify-between p-2 rounded ${performer ? 'bg-slate-700' : 'bg-slate-800'}`}>
    <div className="flex items-center gap-2">
      <img src={performer?.user?.avatar_url || 'https://ui-avatars.com/api/?name=?&background=random'} className="w-8 h-8 rounded-full" />
      <span className="font-bold text-white">{performer?.user?.username || 'TBD'}</span>
    </div>
    <span className="text-xs text-yellow-400">{performer?.total_votes?.toLocaleString() || '-'}</span>
  </div>
);

const BracketMatchup: React.FC<BracketMatchupProps> = ({ performer1, performer2, title }) => {
  return (
    <div className="flex flex-col gap-2 bg-slate-800/50 p-3 rounded-lg border border-white/10 w-64">
      <h4 className="text-xs font-bold text-center text-slate-400 mb-2">{title}</h4>
      <BracketParticipant performer={performer1} />
      <div className="text-center text-slate-500 text-xs font-bold">VS</div>
      <BracketParticipant performer={performer2} />
    </div>
  );
};

export default BracketMatchup;
