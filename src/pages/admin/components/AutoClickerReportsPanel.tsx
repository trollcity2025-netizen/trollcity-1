
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const AutoClickerReportsPanel = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('auto_clicker_reports')
        .select('*, user:user_profiles(username)')
        .eq('reviewed', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching auto-clicker reports:', error);
      } else {
        setReports(data);
      }
      setLoading(false);
    };

    fetchReports();
  }, []);

  const markAsReviewed = async (reportId: number) => {
    await supabase
      .from('auto_clicker_reports')
      .update({ reviewed: true })
      .eq('id', reportId);
    setReports(reports.filter((r) => r.id !== reportId));
  };

  const issueCourtSummon = (userId: string) => {
    // This would be a call to a Supabase function that creates a court case
    // and notifies the user.
    console.log(`Issuing court summon for user ${userId}`);
    supabase.functions.invoke('issue-court-summon', { body: { user_id: userId } });
  };

  if (loading) {
    return <div>Loading reports...</div>;
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Auto-Clicker Reports</h2>
      {reports.length === 0 ? (
        <p>No new reports.</p>
      ) : (
        <ul className="space-y-4">
          {reports.map((report) => (
            <li key={report.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
              <div>
                <p>User: {report.user?.username || report.user_id}</p>
                <p>Clicks: {report.click_count}</p>
                <p>Date: {new Date(report.created_at).toLocaleString()}</p>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => issueCourtSummon(report.user_id)}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded"
                >
                  Issue Court Summon
                </button>
                <button
                  onClick={() => markAsReviewed(report.id)}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                  Mark as Reviewed
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AutoClickerReportsPanel;
