import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/api/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';

export default function AdminAIPanel() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gpt-5-nano');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      setResult({ error: 'OpenAI API not configured. Please add OPENAI_API_KEY to Supabase secrets or contact support.' });
    } catch (e) {
      setResult({ error: e?.message || String(e) });
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">Admin AI Console</h1>
        <Card className="p-4 mb-4">
          <div className="space-y-3">
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model (e.g. gpt-5-nano)" />
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Enter prompt or command" rows={6} />
            <div className="flex gap-2">
              <Button onClick={run} disabled={loading || !prompt} className="bg-emerald-600">{loading ? 'Running...' : 'Run'}</Button>
              <Button onClick={() => { setPrompt(''); setResult(null); }} className="bg-gray-600">Clear</Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold text-white mb-2">Result</h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-200 bg-[#0b0b10] rounded p-3">{result ? JSON.stringify(result, null, 2) : 'No result yet'}</pre>
        </Card>
      </div>
    </main>
  );
}
