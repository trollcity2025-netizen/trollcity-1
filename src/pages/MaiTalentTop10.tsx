
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy } from 'lucide-react';
import UserNameWithAge from '@/components/UserNameWithAge';

interface Audition {
  id: string;
  user_id: string;
  talent_name: string;
  category: string;
  total_votes: number;
  user?: {
    username: string;
    avatar_url: string;
    created_at?: string;
  };
}

import MaiTalentNav from '@/components/maitalent/MaiTalentNav';

import BracketMatchup from '@/components/maitalent/BracketMatchup';

import MaiTalentLayout from '@/components/maitalent/MaiTalentLayout';

const MaiTalentTop10 = () => {
  const [leaderboard, setLeaderboard] = useState<Audition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('mai_talent_leaderboard')
          .select('*, user_profiles(username, avatar_url, created_at)')
          .order('total_votes', { ascending: false })
          .limit(10);

        if (error) throw error;

        setLeaderboard(data as any[]);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const top8 = leaderboard.slice(0, 8);

  return (
    <MaiTalentLayout>
      <MaiTalentNav />
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4">Top 10 & Battle Bracket</h1>
        <p className="text-xl text-slate-400">The best of the best, competing for the crown.</p>
      </div>

      {/* Battle Bracket Section */}
      <div className="mb-16 overflow-x-auto pb-4">
        <h2 className="text-3xl font-bold text-center mb-8">Weekly Finals Bracket</h2>
        <div className="flex justify-center items-center gap-8 min-w-[900px]">
          {/* Quarterfinals */}
          <div className="flex flex-col gap-8">
            <BracketMatchup title="Quarterfinal 1" performer1={top8[0]} performer2={top8[7]} />
            <BracketMatchup title="Quarterfinal 2" performer1={top8[3]} performer2={top8[4]} />
          </div>
          {/* Semifinals */}
          <div className="flex flex-col justify-center">
            <BracketMatchup title="Semifinal 1" />
          </div>
          {/* Final */}
          <div className="flex flex-col justify-center">
            <BracketMatchup title="THE FINAL" />
          </div>
          {/* Semifinals */}
          <div className="flex flex-col justify-center">
            <BracketMatchup title="Semifinal 2" />
          </div>
          {/* Quarterfinals */}
          <div className="flex flex-col gap-8">
            <BracketMatchup title="Quarterfinal 3" performer1={top8[1]} performer2={top8[6]} />
            <BracketMatchup title="Quarterfinal 4" performer1={top8[2]} performer2={top8[5]} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500">Loading leaderboard...</div>
      ) : (
        <div className="bg-slate-900/80 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-slate-400 text-xs uppercase">
              <tr>
                <th className="p-4">Rank</th>
                <th className="p-4">Performer</th>
                <th className="p-4">Category</th>
                <th className="p-4 text-right">Total Votes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leaderboard.map((audition, index) => (
                <tr key={audition.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <span className={`font-bold text-2xl ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-slate-400'}`}>
                      #{index + 1}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-4">
                      <img src={audition.user_profiles?.avatar_url || 'https://ui-avatars.com/api/?background=random'} className="w-12 h-12 rounded-full border-2 border-white/10" />
                      <div>
                        <div className="font-bold text-white text-lg">{audition.talent_name}</div>
                        <UserNameWithAge 
                          user={{
                            username: audition.user_profiles?.username || 'Unknown',
                            id: audition.user_id,
                            created_at: audition.user_profiles?.created_at
                          }}
                          className="text-sm text-slate-500"
                          prefix="@"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 text-xs font-medium">{audition.category}</span>
                  </td>
                  <td className="p-4 text-right font-bold text-yellow-400 text-lg flex items-center justify-end gap-2">
                    <Trophy size={16} />
                    {audition.total_votes?.toLocaleString() || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MaiTalentLayout>
  );
};

export default MaiTalentTop10;
