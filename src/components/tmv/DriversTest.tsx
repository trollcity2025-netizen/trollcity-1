import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const QUESTIONS = [
  { q: "What is the speed limit in Troll City?", options: ["40 mph", "No Limit", "100 mph", "Whatever you want"], a: "A" }, 
  { q: "What happens if your license expires?", options: ["Nothing", "Court Summons", "Free Gas", "You get a medal"], a: "B" },
   { q: "How often must you renew your license? (Admins never need to renew)", options: ["Every year", "Every 30 days", "Never (Admins only)", "Every week"], a: "B" },
  { q: "Who pays for gas?", options: ["Admins", "Staff", "Everyone except Staff", "Nobody"], a: "C" },
  { q: "What is the gas consumption per action?", options: ["1%", "5%", "10%", "20%"], a: "B" },
  { q: "Can you drive with a suspended license?", options: ["Yes", "No", "Maybe", "Only at night"], a: "B" },
  { q: "How much does gas refill cost?", options: ["Free", "100 coins", "300 coins per 5%", "1000 coins"], a: "C" },
  { q: "What does TMV stand for?", options: ["Troll Motor Vehicle", "Too Many Vehicles", "The Motor Van", "Troll Money Vault"], a: "A" },
  { q: "Where do you check your vehicle status?", options: ["Bank", "TMV Dashboard", "Hospital", "Church"], a: "B" },
  { q: "What happens if you fail this test?", options: ["Banned", "Try again", "Pay fine", "Nothing"], a: "B" },
];

export default function DriversTest({ onComplete }: { onComplete: () => void }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; score: number } | null>(null);

  const handleSubmit = async () => {
     if (Object.keys(answers).length < 10) return toast.error('Answer all questions');
     
     setSubmitting(true);
     try {
        const payload: Record<string, string> = {};
        QUESTIONS.forEach((_, i) => {
           payload[(i + 1).toString()] = answers[i] || '';
        });
        
        const { data, error } = await supabase.rpc('submit_driver_test', { answers: payload });
        if (error) throw error;
        
        setResult(data);
        if (data.passed) {
           toast.success('Congratulations! You passed!');
        } else {
           toast.error('You failed. Try again.');
        }
     } catch (e: any) {
        toast.error(e.message || 'Error submitting test');
        // Fallback for dev if RPC not applied
        if (e.message?.includes('function public.submit_driver_test') && e.message?.includes('does not exist')) {
            toast.info('Dev Mode: Assuming pass for UI test');
            setResult({ passed: true, score: 10 });
        }
     } finally {
        setSubmitting(false);
     }
  };

  if (result) {
     return (
        <div className="bg-zinc-900 p-8 rounded-xl border border-zinc-800 text-center">
           <h2 className="text-2xl font-bold mb-4">{result.passed ? 'PASSED!' : 'FAILED'}</h2>
           <p className="text-4xl font-bold mb-6">{result.score} / 10</p>
           <button onClick={onComplete} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
              {result.passed ? 'Get License' : 'Try Again'}
           </button>
        </div>
     );
  }

  return (
    <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
       <h2 className="text-xl font-bold mb-6">Driver's License Written Test</h2>
       <div className="space-y-6">
          {QUESTIONS.map((q, i) => (
             <div key={i} className="space-y-2">
                <p className="font-medium text-white">{i + 1}. {q.q}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                   {q.options.map((opt, optIndex) => {
                      const letter = String.fromCharCode(65 + optIndex); // A, B, C, D
                      return (
                         <button
                           key={letter}
                           onClick={() => setAnswers(prev => ({ ...prev, [i]: letter }))}
                           className={`p-2 rounded text-left text-sm border transition ${answers[i] === letter ? 'bg-purple-600 border-purple-500 text-white' : 'bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700'}`}
                         >
                            <span className="font-bold mr-2">{letter}.</span> {opt}
                         </button>
                      );
                   })}
                </div>
             </div>
          ))}
       </div>
       <div className="mt-8 flex justify-end">
          <button 
            onClick={handleSubmit} 
            disabled={submitting}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold disabled:opacity-50"
          >
             {submitting ? 'Grading...' : 'Submit Test'}
          </button>
       </div>
    </div>
  );
}
