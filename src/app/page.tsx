'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Send, User, LogOut, MessageSquare, 
  Loader2, UserPlus, ShieldCheck, Users, Check, CheckCheck, ChevronLeft
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  // Time formatted in English (en-US)
  const formatTime = (dateStr: string) => 
    new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (d.toDateString() === new Date().toDateString()) return 'Today';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // 1. Initial Load
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setCurrentUser(session.user);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile?.is_admin) setIsAdmin(true);

      const { data: profiles } = await supabase.from('profiles').select('*').neq('id', session.user.id);
      const { data: groupList } = await supabase.from('groups').select('*');
      
      const { data: unreads } = await supabase.from('messages').select('sender_id').eq('receiver_id', session.user.id).eq('is_read', false);
      const unreadMap: any = {};
      unreads?.forEach(m => unreadMap[m.sender_id] = (unreadMap[m.sender_id] || 0) + 1);
      
      setUnreadMessages(unreadMap);
      setUsers(profiles || []);
      setGroups(groupList || []);
      setLoading(false);
    };
    init();
  }, [router]);

  // 2. Fetch Messages
  const fetchMessages = useCallback(async () => {
    if (!currentUser || (!selectedUser && !selectedGroup)) return;
    
    let query = supabase.from('messages').select('*');
    if (selectedGroup) {
      query = query.eq('group_id', selectedGroup.id);
    } else {
      query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentUser.id})`);
    }
    
    const { data } = await query.order('created_at', { ascending: true });
    setMessages(data || []);

    if (selectedUser) {
      await supabase.from('messages').update({ is_read: true }).match({ sender_id: selectedUser.id, receiver_id: currentUser.id, is_read: false });
      setUnreadMessages(prev => ({ ...prev, [selectedUser.id]: 0 }));
    }
  }, [selectedUser, selectedGroup, currentUser]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // 3. Presence & Real-time
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('chat-main', { config: { presence: { key: currentUser.id } } });

    channel
      .on('presence', { event: 'sync' }, () => setOnlineUsers(Object.keys(channel.presenceState())))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new;
        const isCurrent = selectedGroup ? msg.group_id === selectedGroup.id : (selectedUser && (msg.sender_id === selectedUser.id || msg.sender_id === currentUser.id));
        if (isCurrent) {
          setMessages(prev => [...prev, msg]);
          if (msg.receiver_id === currentUser.id) await supabase.from('messages').update({ is_read: true }).eq('id', msg.id);
        } else if (msg.receiver_id === currentUser.id) {
          setUnreadMessages(prev => ({ ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 }));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() });
      });

    return () => { supabase.removeChannel(channel); };
  }, [currentUser, selectedUser, selectedGroup]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    const payload: any = { content: newMessage, sender_id: currentUser.id };
    if (selectedGroup) payload.group_id = selectedGroup.id; else payload.receiver_id = selectedUser.id;
    await supabase.from('messages').insert([payload]);
    setNewMessage('');
    setSending(false);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* English Modern Font */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        body { font-family: 'Inter', -apple-system, sans-serif; direction: ltr !important; }
      `}</style>

      {/* Sidebar */}
      <div className={`${(selectedUser || selectedGroup) ? 'hidden md:flex' : 'flex'} w-full md:w-80 bg-white border-r border-slate-200 flex-col shrink-0 shadow-xl z-20`}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white"><MessageSquare size={18} fill="currentColor" /></div>
            <h1 className="text-xl font-black text-slate-800 italic">FamilyNetwork</h1>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="p-2 text-slate-400 hover:text-red-500 transition-all"><LogOut size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isAdmin && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => setShowAdminModal(true)} className="bg-blue-600 text-white p-3 rounded-xl text-[10px] font-bold shadow-md">ADD MEMBER</button>
              <button onClick={() => setShowGroupModal(true)} className="bg-slate-800 text-white p-3 rounded-xl text-[10px] font-bold">NEW GROUP</button>
            </div>
          )}
          
          <p className="text-[10px] font-bold text-slate-400 uppercase px-2 tracking-widest">Messages</p>
          
          {[...groups, ...users].map((item: any) => {
            const isGroup = !!item.name;
            const isSel = isGroup ? selectedGroup?.id === item.id : selectedUser?.id === item.id;
            const isOnline = !isGroup && onlineUsers.includes(item.id);

            return (
              <div key={item.id} onClick={() => { isGroup ? setSelectedGroup(item) : setSelectedUser(item); isGroup ? setSelectedUser(null) : setSelectedGroup(null); }}
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer border transition-all ${
                  isSel ? 'bg-blue-600 border-blue-600 shadow-lg' : 'bg-slate-50/50 border-slate-100 hover:border-blue-200 hover:bg-white'
                }`}>
                <div className="relative">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSel ? 'bg-blue-500 text-white' : 'bg-white text-blue-600 border border-slate-100'}`}>
                    {isGroup ? <Users size={24} /> : <User size={24} />}
                  </div>
                  {isOnline && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold text-sm truncate ${isSel ? 'text-white' : 'text-slate-800'}`}>{isGroup ? item.name : item.username?.split('@')[0]}</h3>
                  <p className={`text-[10px] font-medium ${isSel ? 'text-blue-100' : 'text-slate-400'}`}>
                    {isGroup ? 'Group Chat' : (isOnline ? 'Online' : 'Offline')}
                  </p>
                </div>
                {unreadMessages[item.id] > 0 && !isSel && <div className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-lg">{unreadMessages[item.id]}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`${!(selectedUser || selectedGroup) ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-slate-50 relative h-full`}>
        {(selectedUser || selectedGroup) ? (
          <>
            <div className="p-4 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center gap-3 z-10 shadow-sm">
              <button onClick={() => {setSelectedUser(null); setSelectedGroup(null);}} className="md:hidden p-2 -ml-2 text-slate-500"><ChevronLeft size={24}/></button>
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">{selectedGroup ? <Users size={20}/> : <User size={20}/>}</div>
              <div className="flex-1">
                <h2 className="font-bold text-slate-800 text-sm leading-none">{selectedGroup ? selectedGroup.name : selectedUser.username.split('@')[0]}</h2>
                <span className="text-[10px] text-green-500 font-bold uppercase">{selectedGroup ? 'Family Group' : (onlineUsers.includes(selectedUser.id) ? 'Online' : 'Offline')}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {messages.map((msg, idx) => {
                const isMe = msg.sender_id === currentUser.id;
                const showDate = idx === 0 || formatDateLabel(messages[idx-1].created_at) !== formatDateLabel(msg.created_at);
                return (
                  <div key={msg.id || idx}>
                    {showDate && <div className="flex justify-center my-6"><span className="bg-slate-200 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full uppercase">{formatDateLabel(msg.created_at)}</span></div>}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] md:max-w-[70%] p-3 px-4 rounded-2xl shadow-sm relative ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                        {selectedGroup && !isMe && <p className="text-[10px] font-black mb-1 text-blue-500 uppercase">{users.find(u => u.id === msg.sender_id)?.username.split('@')[0]}</p>}
                        <p className="text-[14px] leading-relaxed break-words" style={{ direction: 'ltr', textAlign: 'left' }}>{msg.content}</p>
                        <div className={`flex items-center gap-1 mt-1 opacity-80 text-[10px] ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <span className={isMe ? 'text-blue-100' : 'text-slate-400'}>{formatTime(msg.created_at)}</span>
                          {isMe && (
                            msg.is_read 
                              ? <CheckCheck size={15} className="text-cyan-300 drop-shadow-sm" strokeWidth={2.5} /> 
                              : <Check size={15} className="text-blue-200" strokeWidth={2.5} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            <div className="p-4 md:p-5 bg-white border-t border-slate-200">
              <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex items-center gap-2 bg-slate-100 p-1.5 pl-4 rounded-2xl border border-slate-200 focus-within:ring-2 ring-blue-500/20 transition-all">
                <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 bg-transparent border-none outline-none text-slate-700 text-sm py-2" style={{ direction: 'ltr' }} />
                <button type="submit" disabled={sending} className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95">
                   {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-slate-300">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-4 shadow-sm border border-slate-100"><ShieldCheck size={32} className="text-blue-500" /></div>
            <h2 className="text-slate-800 font-black text-xl">Family Network</h2>
            <p className="text-sm">Select a conversation to start</p>
          </div>
        )}
      </div>
      
      {/* Admin: Add Member Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <h2 className="text-2xl font-black mb-2 text-slate-800">Add Member</h2>
            <p className="text-slate-500 text-sm mb-6">New members can login with these credentials.</p>
            <div className="space-y-4">
              <input id="new-email" type="email" placeholder="Email" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" />
              <input id="new-password" type="password" placeholder="Password" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" />
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={async () => {
                const email = (document.getElementById('new-email') as HTMLInputElement).value;
                const password = (document.getElementById('new-password') as HTMLInputElement).value;
                if (!email || !password) return;
                const { error } = await supabase.auth.signUp({ email, password });
                if (!error) { alert('Member added!'); setShowAdminModal(false); } else { alert(error.message); }
              }} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg">Create</button>
              <button onClick={() => setShowAdminModal(false)} className="flex-1 py-4 text-slate-400 font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <h2 className="text-2xl font-black mb-6 text-slate-800">New Group</h2>
            <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Group Name" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none mb-4" />
            <div className="flex gap-3 mt-4">
              <button onClick={async () => {
                if (!newGroupName) return;
                const { data: group } = await supabase.from('groups').insert([{ name: newGroupName, created_by: currentUser.id }]).select().single();
                if (group) {
                  const members = users.map(u => ({ group_id: group.id, user_id: u.id }));
                  members.push({ group_id: group.id, user_id: currentUser.id });
                  await supabase.from('group_members').insert(members);
                  setGroups([...groups, group]);
                  setShowGroupModal(false);
                  setNewGroupName('');
                }
              }} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg">Create</button>
              <button onClick={() => setShowGroupModal(false)} className="flex-1 py-4 text-slate-400 font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}