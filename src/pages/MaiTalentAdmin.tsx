
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import MaiTalentNav from '@/components/maitalent/MaiTalentNav';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

import MaiTalentLayout from '@/components/maitalent/MaiTalentLayout';

const ShowManagementTab = () => {
  const [shows, setShows] = useState<any[]>([]);
  const [showName, setShowName] = useState('');
  const [showDate, setShowDate] = useState('');

  useEffect(() => {
    const fetchShows = async () => {
      const { data, error } = await supabase.from('mai_talent_shows').select('*').order('scheduled_at', { ascending: false });
      if (error) console.error('Error fetching shows', error);
      else setShows(data);
    };
    fetchShows();
  }, []);

  const handleCreateShow = async () => {
    if (!showName || !showDate) {
      toast.error('Please provide a name and date for the show.');
      return;
    }
        const { error } = await supabase.from('mai_talent_shows').insert({ name: showName, scheduled_at: showDate, show_time: showDate });
    if (error) {
      toast.error('Failed to create show.');
      console.error(error);
    } else {
      toast.success('Show created successfully!');
      // Refresh list
      const { data } = await supabase.from('mai_talent_shows').select('*').order('scheduled_at', { ascending: false });
      if (data) setShows(data);
    }
  };

  const handleStartShow = async (showId: string) => {
    const { error } = await supabase.functions.invoke('mai-talent-v2-orchestrator', {
      body: { command: 'start-show', payload: { sessionId: showId } }
    });

    if (error) {
      toast.error('Failed to start show.');
      console.error(error);
    } else {
      toast.success('Show started successfully!');
    }
  };

  return (
    <Card className="bg-slate-900/80 border-white/10">
      <CardHeader>
        <CardTitle>Show Management</CardTitle>
        <CardDescription>Create, schedule, and manage talent shows.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h4 className="font-bold mb-4">Create New Show</h4>
          <div className="space-y-4">
            <div>
              <Label htmlFor="show-name">Show Name</Label>
              <Input id="show-name" value={showName} onChange={(e) => setShowName(e.target.value)} placeholder="e.g., Weekly Finals" />
            </div>
            <div>
              <Label htmlFor="show-date">Show Date & Time</Label>
              <Input id="show-date" type="datetime-local" value={showDate} onChange={(e) => setShowDate(e.target.value)} />
            </div>
            <Button onClick={handleCreateShow}>Create Show</Button>
          </div>
        </div>
        <div>
          <h4 className="font-bold mb-4">Upcoming Shows</h4>
          <div className="space-y-2">
            {shows.map(show => (
              <div key={show.id} className="p-3 bg-white/5 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-bold">{show.name}</p>
                  <p className="text-sm text-slate-400">{new Date(show.scheduled_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => handleStartShow(show.id)} variant="secondary" size="sm">Start Show</Button>
                  <Button variant="destructive" size="sm">Cancel</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const JudgeManagementTab = () => {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [displayedUsers, setDisplayedUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch all users on initial load
  useEffect(() => {
    const fetchAllUsers = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('user_profiles').select('id, username, avatar_url, is_judge');
      if (error) {
        console.error('Error fetching users', error);
        toast.error('Could not load users.');
      } else {
        setAllUsers(data);
        setDisplayedUsers(data);
      }
      setLoading(false);
    };
    fetchAllUsers();
  }, []);

  // Filter users based on search term
  useEffect(() => {
    if (searchTerm.length < 3) {
      setDisplayedUsers(allUsers);
    } else {
      const filtered = allUsers.filter(user => 
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setDisplayedUsers(filtered);
    }
  }, [searchTerm, allUsers]);

  const toggleJudgeRole = async (userToUpdate: any) => {
    const { error } = await supabase.from('user_profiles').update({ is_judge: !userToUpdate.is_judge }).eq('id', userToUpdate.id);
    if (error) {
      toast.error('Failed to update role.');
    } else {
      toast.success(`Role updated for ${userToUpdate.username}`);
      // Update the user in the main list, which will trigger the filter effect
      setAllUsers(prevUsers => 
        prevUsers.map(u => u.id === userToUpdate.id ? { ...u, is_judge: !userToUpdate.is_judge } : u)
      );
    }
  };

  return (
    <Card className="bg-slate-900/80 border-white/10">
      <CardHeader>
        <CardTitle>Judge Management</CardTitle>
        <CardDescription>Search for users and assign or revoke their judge role.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <Input 
            placeholder="Type at least 3 characters to search..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Accordion type="single" collapsible className="w-full">
          {loading ? <p>Loading users...</p> : displayedUsers.map(user => (
            <AccordionItem value={user.id} key={user.id}>
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <img src={user.avatar_url} className="w-10 h-10 rounded-full" />
                  <span className="font-bold">{user.username}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="p-4 bg-slate-800/50 rounded-b-lg">
                  <p className="text-sm text-slate-400 mb-4">Use the button below to manage this user&apos;s judge status.</p>
                  <Button onClick={() => toggleJudgeRole(user)} variant={user.is_judge ? 'secondary' : 'default'}>
                    {user.is_judge ? 'Revoke Judge' : 'Make Judge'}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

const QueueManagementTab = () => {
  const [queues, setQueues] = useState<any[]>([]);

  useEffect(() => {
    const fetchQueues = async () => {
      const { data, error } = await supabase
        .from('mai_talent_queue')
        .select('*, mai_talent_shows(name), user_profiles(username)')
        .order('created_at', { ascending: true });
      if (error) console.error('Error fetching queues', error);
      else setQueues(data);
    };
    fetchQueues();
  }, []);

  return (
    <Card className="bg-slate-900/80 border-white/10">
      <CardHeader>
        <CardTitle>Master Queue Management</CardTitle>
        <CardDescription>View and manage all audition queues.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {queues.map(item => (
            <div key={item.id} className="p-3 bg-white/5 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold">{item.user_profiles.username}</p>
                  <p className="text-sm text-slate-400">Show: {item.mai_talent_shows.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${item.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>
                    {item.status}
                  </span>
                  <Button variant="destructive" size="sm">Remove</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const MaiTalentAdmin = () => {
  const [activeTab, setActiveTab] = useState('shows');

  return (
    <MaiTalentLayout>
      <MaiTalentNav />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>

        <div className="flex border-b border-white/10 mb-8">
          <button onClick={() => setActiveTab('shows')} className={`px-6 py-3 font-medium ${activeTab === 'shows' ? 'text-white border-b-2 border-white' : 'text-slate-400'}`}>Shows</button>
          <button onClick={() => setActiveTab('judges')} className={`px-6 py-3 font-medium ${activeTab === 'judges' ? 'text-white border-b-2 border-white' : 'text-slate-400'}`}>Judges</button>
          <button onClick={() => setActiveTab('queue')} className={`px-6 py-3 font-medium ${activeTab === 'queue' ? 'text-white border-b-2 border-white' : 'text-slate-400'}`}>Queue</button>
        </div>

        <div>
          {activeTab === 'shows' && <ShowManagementTab />}

          {activeTab === 'judges' && <JudgeManagementTab />}

          {activeTab === 'queue' && <QueueManagementTab />}
        </div>
      </div>
    </MaiTalentLayout>
  );
};

export default MaiTalentAdmin;
