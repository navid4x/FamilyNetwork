'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  Send, User, LogOut, MessageSquare,
  Loader2, ShieldCheck, Users, Check, CheckCheck, ChevronLeft,
  Settings, UserCircle, Plus, Trash2, Camera, Edit3, X,
  ImageIcon, Sun, Moon, FileImage,
} from 'lucide-react';

type Tab = 'chat' | 'settings' | 'profile';

const DARK = {
  bg:'#0a0a0f', bgCard:'rgba(255,255,255,0.04)', bgCard2:'rgba(255,255,255,0.07)',
  border:'rgba(255,255,255,0.06)', border2:'rgba(255,255,255,0.09)',
  header:'rgba(10,10,15,0.97)', text:'#f1f5f9', textSub:'#6b7280', textMuted:'#374151',
  scrollThumb:'#2d2d3a', inputBg:'rgba(255,255,255,0.06)',
  navBg:'rgba(255,255,255,0.04)', navBorder:'rgba(255,255,255,0.07)',
  iconInactive:'#4b5563', msgIn:'rgba(255,255,255,0.07)',
  msgInBorder:'1px solid rgba(255,255,255,0.08)', msgInText:'#e2e8f0',
  msgTimeIn:'#4b5563', datePill:'rgba(255,255,255,0.06)', datePillText:'#6b7280',
  modalBg:'#111118', toggleOff:'rgba(255,255,255,0.1)', activeTab:'rgba(79,70,229,0.18)',
  groupDot:'#4f46e5', deleteBtn:'rgba(239,68,68,0.1)', deleteTxt:'#f87171',
  signOutBg:'rgba(239,68,68,0.08)', signOutBdr:'rgba(239,68,68,0.14)', signOutTxt:'#f87171',
};
const LIGHT = {
  bg:'#f0f2f8', bgCard:'#ffffff', bgCard2:'#f8f9fc',
  border:'rgba(0,0,0,0.07)', border2:'rgba(0,0,0,0.1)',
  header:'rgba(240,242,248,0.97)', text:'#0f172a', textSub:'#64748b', textMuted:'#94a3b8',
  scrollThumb:'#cbd5e1', inputBg:'#ffffff',
  navBg:'#ffffff', navBorder:'rgba(0,0,0,0.07)',
  iconInactive:'#94a3b8', msgIn:'#ffffff',
  msgInBorder:'1px solid rgba(0,0,0,0.06)', msgInText:'#1e293b',
  msgTimeIn:'#94a3b8', datePill:'rgba(0,0,0,0.06)', datePillText:'#64748b',
  modalBg:'#ffffff', toggleOff:'rgba(0,0,0,0.12)', activeTab:'rgba(79,70,229,0.1)',
  groupDot:'#4f46e5', deleteBtn:'rgba(239,68,68,0.08)', deleteTxt:'#ef4444',
  signOutBg:'rgba(239,68,68,0.06)', signOutBdr:'rgba(239,68,68,0.15)', signOutTxt:'#ef4444',
};

export default function Home() {
  const router = useRouter();
  const [loading, setLoading]         = useState(true);
  const [dark, setDark]               = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile]         = useState<any>(null);
  const [isAdmin, setIsAdmin]         = useState(false);
  const [users, setUsers]             = useState<any[]>([]);
  const [groups, setGroups]           = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Record<string,number>>({});
  const [activeTab, setActiveTab]     = useState<Tab>('chat');

  const [selectedUser,  setSelectedUser]  = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [messages, setMessages]           = useState<any[]>([]);
  const [newMessage, setNewMessage]       = useState('');
  const [sending, setSending]             = useState(false);
  const [mediaPreview, setMediaPreview]   = useState<{file:File;url:string;type:'image'|'video'}|null>(null);

  const [showAddMember, setShowAddMember] = useState(false);
  const [showNewGroup,  setShowNewGroup]  = useState(false);
  const [newGroupName, setNewGroupName]   = useState('');
  const [newEmail, setNewEmail]           = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [editingName, setEditingName]     = useState(false);
  const [newFullName, setNewFullName]     = useState('');
  const [allowFiles,  setAllowFiles]      = useState(false);

  const scrollRef    = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Refs: always up-to-date in realtime callbacks ─────────────────────────
  const selectedUserRef  = useRef<any>(null);
  const selectedGroupRef = useRef<any>(null);
  const currentUserRef   = useRef<any>(null);
  useEffect(() => { selectedUserRef.current  = selectedUser;  }, [selectedUser]);
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);
  useEffect(() => { currentUserRef.current   = currentUser;   }, [currentUser]);

  const T = dark ? DARK : LIGHT;

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });

  const formatDateLabel = (d: string) => {
    const date = new Date(d);
    if (date.toDateString() === new Date().toDateString()) return 'Today';
    return date.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  };

  // ── fetchUnreads: directly from messages table, no view needed ────────────
  const fetchUnreads = async (userId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('receiver_id', userId)
      .eq('is_read', false);
    const map: Record<string,number> = {};
    data?.forEach((m: any) => { map[m.sender_id] = (map[m.sender_id] || 0) + 1; });
    setUnreadMessages(map);
  };

  // ── 1. Init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const user = session.user;
      setCurrentUser(user);
      currentUserRef.current = user;

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);
      setAllowFiles(prof?.settings_allow_files || false);
      if (prof?.is_admin) setIsAdmin(true);

      const { data: profiles } = await supabase
        .from('profiles').select('*').neq('id', user.id);
      const { data: groupList } = await supabase.from('groups').select('*');

      // BUG FIX 2: fetch unreads directly, never rely on a view
      await fetchUnreads(user.id);

      setUsers(profiles || []);
      setGroups(groupList || []);
      setLoading(false);
    };
    init();
  }, [router]);

  // ── 2. Fetch messages — FIX 3: keyed on selectedUser/Group IDs ───────────
  //    Using IDs (primitives) as deps avoids the stale-ref / no-rerun bug.
  const selectedUserId  = selectedUser?.id  ?? null;
  const selectedGroupId = selectedGroup?.id ?? null;

  const fetchMessages = useCallback(async () => {
    const cu = currentUserRef.current;
    if (!cu) return;
    if (!selectedUserId && !selectedGroupId) { setMessages([]); return; }

    let query = supabase.from('messages').select('*');
    if (selectedGroupId) {
      query = query.eq('group_id', selectedGroupId);
    } else {
      query = query.or(
        `and(sender_id.eq.${cu.id},receiver_id.eq.${selectedUserId}),` +
        `and(sender_id.eq.${selectedUserId},receiver_id.eq.${cu.id})`
      );
    }
    const { data, error } = await query.order('created_at', { ascending: true });
    if (!error) setMessages(data || []);

    // Mark as read & refresh unread count
    if (selectedUserId) {
      await supabase.from('messages').update({ is_read: true })
        .eq('sender_id', selectedUserId)
        .eq('receiver_id', cu.id)
        .eq('is_read', false);
      setUnreadMessages(prev => ({ ...prev, [selectedUserId]: 0 }));
    }
  }, [selectedUserId, selectedGroupId]); // primitive deps — always triggers correctly

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // ── 3. Realtime + Presence ────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('chat-presence', {
      config: { presence: { key: currentUser.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineUsers(Object.keys(channel.presenceState()));
      })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as any;
          const cu  = currentUserRef.current;
          const su  = selectedUserRef.current;
          const sg  = selectedGroupRef.current;
          if (!cu) return;

          const isCurrentConv = sg
            ? String(msg.group_id) === String(sg.id)
            : su && (msg.sender_id === su.id || msg.sender_id === cu.id);

          if (isCurrentConv) {
            setMessages(prev => {
              // avoid duplicate if fetchMessages already added it
              if (prev.find(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });

            // BUG FIX 1: mark delivered only for DM messages (receiver_id exists)
            if (msg.receiver_id === cu.id) {
              await supabase.from('messages')
                .update({ is_read: true })
                .eq('id', msg.id);
            }
          } else if (msg.receiver_id === cu.id) {
            // incoming DM to a different conversation — bump unread
            setUnreadMessages(prev => ({
              ...prev,
              [msg.sender_id]: (prev[msg.sender_id] || 0) + 1,
            }));
          }
        }
      )
      // BUG FIX 1: listen to UPDATE so is_read change propagates to sender
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev =>
            prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m)
          );
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED')
          await channel.track({ online_at: new Date().toISOString() });
      });

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !mediaPreview) || sending || !currentUser) return;
    setSending(true);

    if (mediaPreview) {
      const ext  = mediaPreview.file.name.split('.').pop();
      const path = `${currentUser.id}/${Date.now()}.${ext}`;
      const { data: uploaded, error: upErr } = await supabase.storage
        .from('chat-media').upload(path, mediaPreview.file);
      if (!upErr && uploaded) {
        const { data: { publicUrl } } = supabase.storage
          .from('chat-media').getPublicUrl(path);
        const payload: any = { content: publicUrl, sender_id: currentUser.id, is_image: true };
        if (selectedGroup) payload.group_id = selectedGroup.id;
        else if (selectedUser) payload.receiver_id = selectedUser.id;
        await supabase.from('messages').insert([payload]);
      }
      setMediaPreview(null);
    }

    if (newMessage.trim()) {
      const payload: any = { content: newMessage, sender_id: currentUser.id };
      if (selectedGroup) payload.group_id = selectedGroup.id;
      else if (selectedUser) payload.receiver_id = selectedUser.id;
      await supabase.from('messages').insert([payload]);
    }

    setNewMessage('');
    setSending(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaPreview({ file, url: URL.createObjectURL(file), type: file.type.startsWith('video') ? 'video' : 'image' });
    e.target.value = '';
  };

  const handleDeleteUser  = async (id: string) => {
    if (!confirm('Delete this member?')) return;
    await supabase.from('profiles').delete().eq('id', id);
    setUsers(prev => prev.filter(u => u.id !== id));
  };
  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Delete this group?')) return;
    await supabase.from('groups').delete().eq('id', id);
    setGroups(prev => prev.filter(g => g.id !== id));
  };
  const handleUpdateName = async () => {
    if (!newFullName.trim() || !currentUser) return;
    await supabase.from('profiles').update({ full_name: newFullName }).eq('id', currentUser.id);
    setProfile((p: any) => ({ ...p, full_name: newFullName }));
    setEditingName(false);
  };
  const handleToggleFiles = async () => {
    if (!currentUser) return;
    const v = !allowFiles;
    setAllowFiles(v);
    await supabase.from('profiles').update({ settings_allow_files: v }).eq('id', currentUser.id);
  };
  const handleAddMember = async () => {
    if (!newEmail || !newPassword) return;
    const { error } = await supabase.auth.signUp({ email: newEmail, password: newPassword });
    if (!error) { setShowAddMember(false); setNewEmail(''); setNewPassword(''); alert('Member added!'); }
    else alert(error.message);
  };
  const handleCreateGroup = async () => {
    if (!newGroupName || !currentUser) return;
    const { data: group } = await supabase
      .from('groups').insert([{ name: newGroupName, created_by: currentUser.id }]).select().single();
    if (group) {
      const members = [...users.map((u: any) => ({ group_id: group.id, user_id: u.id })),
                       { group_id: group.id, user_id: currentUser.id }];
      await supabase.from('group_members').insert(members);
      setGroups(prev => [...prev, group]);
      setShowNewGroup(false);
      setNewGroupName('');
    }
  };

  const totalUnread = Object.values(unreadMessages).reduce((a, b) => a + b, 0);
  const inChat      = !!(selectedUser || selectedGroup);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="h-screen flex items-center justify-center" style={{ background: DARK.bg }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
          <MessageSquare className="text-white" size={28} />
        </div>
        <Loader2 className="animate-spin" size={20} style={{ color:'#6366f1' }} />
      </div>
    </div>
  );

  const card  = { background: T.bgCard,  border:`1px solid ${T.border}` };
  const card2 = { background: T.bgCard2, border:`1px solid ${T.border}` };

  const ThemeToggle = () => (
    <button onClick={() => setDark(d => !d)}
      style={{ width:36, height:36, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
        border:`1px solid ${T.border}`, color: dark ? '#fbbf24' : '#6366f1',
        borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink:0, cursor:'pointer', transition:'all 0.2s' }}>
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden"
      style={{ background: T.bg, color: T.text, transition:'background 0.3s,color 0.3s' }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;}
        body{font-family:'DM Sans',sans-serif;margin:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${T.scrollThumb};border-radius:2px;}
        .tab-btn{transition:all 0.22s cubic-bezier(0.4,0,0.2,1);}
        .chat-item{transition:background 0.15s ease;cursor:pointer;}
        .msg-bubble{animation:fadeUp 0.18s ease;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        .pill-btn{transition:all 0.18s ease;}
        .pill-btn:active{transform:scale(0.97);}
        .send-btn{transition:all 0.15s ease;}
        .send-btn:active{transform:scale(0.9);}
        input{outline:none;}
        .t{transition:background 0.3s,border-color 0.3s,color 0.3s;}
      `}</style>

      {/* ══════════════ CHAT VIEW ══════════════════════════════════ */}
      {inChat && (
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0 t"
            style={{ background:T.header, borderBottom:`1px solid ${T.border}`, backdropFilter:'blur(20px)' }}>
            <button onClick={() => { setSelectedUser(null); setSelectedGroup(null); setMediaPreview(null); }}
              className="p-2 rounded-xl shrink-0 t"
              style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <ChevronLeft size={20} style={{ color:'#818cf8' }} />
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
              style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              {selectedGroup ? <Users size={18} className="text-white" />
                : selectedUser?.avatar_url
                  ? <img src={selectedUser.avatar_url} className="w-full h-full object-cover" alt="" />
                  : <User size={18} className="text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm truncate"
                style={{ fontFamily:'Syne,sans-serif', color:T.text }}>
                {selectedGroup
                  ? selectedGroup.name
                  : (selectedUser?.full_name || selectedUser?.username?.split('@')[0] || '')}
              </h2>
              <p className="text-xs" style={{
                color: selectedGroup ? '#818cf8'
                  : (selectedUser && onlineUsers.includes(selectedUser.id) ? '#4ade80' : T.textSub) }}>
                {selectedGroup ? 'Group Chat'
                  : (selectedUser && onlineUsers.includes(selectedUser.id) ? '● Online' : 'Offline')}
              </p>
            </div>
            <ThemeToggle />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 t" style={{ background:T.bg }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
                <MessageSquare size={32} style={{ color:T.textSub }} />
                <p className="text-sm" style={{ color:T.textSub }}>No messages yet</p>
              </div>
            )}
            {messages.map((msg: any, idx: number) => {
              const isMe     = !!currentUser && msg.sender_id === currentUser.id;
              const showDate = idx === 0 ||
                formatDateLabel(messages[idx-1].created_at) !== formatDateLabel(msg.created_at);
              const isMedia  = msg.is_image;
              return (
                <div key={msg.id ?? idx} className="msg-bubble">
                  {showDate && (
                    <div className="flex justify-center my-4">
                      <span className="text-xs px-3 py-1 rounded-full"
                        style={{ background:T.datePill, color:T.datePillText }}>
                        {formatDateLabel(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={`flex mb-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div style={{
                      maxWidth:'78%', overflow:'hidden',
                      padding: isMedia ? '6px' : '10px 14px',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isMe ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : T.msgIn,
                      border: isMe ? 'none' : T.msgInBorder,
                    }}>
                      {selectedGroup && !isMe && (
                        <p className="text-xs font-semibold mb-1" style={{ color:'#818cf8', paddingLeft: isMedia?'2px':0 }}>
                          {users.find((u: any) => u.id === msg.sender_id)?.username?.split('@')[0] ?? ''}
                        </p>
                      )}
                      {isMedia ? (
                        <div className="rounded-xl overflow-hidden">
                          {/\.(mp4|webm|mov)$/i.test(msg.content)
                            ? <video src={msg.content} controls className="max-w-full rounded-xl" style={{ maxHeight:220 }} />
                            : <img src={msg.content} className="max-w-full rounded-xl" style={{ maxHeight:220, display:'block' }} alt="media" />}
                          <div className={`flex items-center gap-1 mt-1 px-1 pb-1 ${isMe?'justify-end':'justify-start'}`}>
                            <span className="text-[10px]"
                              style={{ color: isMe ? 'rgba(255,255,255,0.5)' : T.msgTimeIn }}>
                              {formatTime(msg.created_at)}
                            </span>
                            {isMe && (msg.is_read
                              ? <CheckCheck size={13} style={{ color:'#a5b4fc' }} />
                              : <Check     size={13} style={{ color:'rgba(255,255,255,0.35)' }} />)}
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm leading-relaxed break-words"
                            style={{ color: isMe ? '#fff' : T.msgInText }}>
                            {msg.content}
                          </p>
                          <div className={`flex items-center gap-1 mt-1 ${isMe?'justify-end':'justify-start'}`}>
                            <span className="text-[10px]"
                              style={{ color: isMe ? 'rgba(255,255,255,0.45)' : T.msgTimeIn }}>
                              {formatTime(msg.created_at)}
                            </span>
                            {isMe && (msg.is_read
                              ? <CheckCheck size={13} style={{ color:'#a5b4fc' }} />
                              : <Check     size={13} style={{ color:'rgba(255,255,255,0.35)' }} />)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>

          {/* Media preview */}
          {mediaPreview && (
            <div className="px-4 pt-2 shrink-0 t"
              style={{ background:T.header, borderTop:`1px solid ${T.border}` }}>
              <div className="flex items-center gap-2 p-2 rounded-2xl" style={card}>
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0"
                  style={{ background:'rgba(0,0,0,0.1)' }}>
                  {mediaPreview.type === 'video'
                    ? <video src={mediaPreview.url} className="w-full h-full object-cover" />
                    : <img src={mediaPreview.url} className="w-full h-full object-cover" alt="" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color:T.text }}>{mediaPreview.file.name}</p>
                  <p className="text-[10px]" style={{ color:T.textSub }}>
                    {(mediaPreview.file.size/1024).toFixed(0)} KB · {mediaPreview.type}
                  </p>
                </div>
                <button onClick={() => setMediaPreview(null)} className="p-1.5 rounded-lg shrink-0"
                  style={{ background:'rgba(239,68,68,0.1)', color:'#f87171' }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 shrink-0 t"
            style={{ background:T.header, borderTop:`1px solid ${T.border}` }}>
            <form onSubmit={sendMessage} className="flex items-center gap-2">
              {allowFiles && (
                <>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*"
                    onChange={handleFileSelect} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 t"
                    style={{
                      background: mediaPreview ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
                        : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                      border:`1px solid ${T.border}`,
                    }}>
                    <FileImage size={18} style={{ color: mediaPreview ? '#fff' : '#818cf8' }} />
                  </button>
                </>
              )}
              <div className="flex-1 flex items-center px-4 rounded-2xl t"
                style={{ background:T.inputBg, border:`1px solid ${T.border2}`, minHeight:'48px' }}>
                <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  placeholder={mediaPreview ? 'Add a caption…' : 'Message…'}
                  className="flex-1 bg-transparent text-sm py-3 t"
                  style={{ color:T.text, border:'none' }} />
              </div>
              <button type="submit" disabled={sending}
                className="send-btn w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: (newMessage.trim()||mediaPreview)
                  ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
                  : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)') }}>
                {sending
                  ? <Loader2 size={18} className="animate-spin text-white" />
                  : <Send size={18} style={{ color:(newMessage.trim()||mediaPreview)?'#fff':T.iconInactive }} />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ TABBED VIEW ════════════════════════════════ */}
      {!inChat && (
        <div className="flex flex-col h-full">

          {/* Top bar */}
          <div className="px-5 pt-12 pb-4 shrink-0 t" style={{ background:T.bg }}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold" style={{ fontFamily:'Syne,sans-serif', color:T.text }}>
                  {activeTab==='chat'?'Messages':activeTab==='settings'?'Settings':'Profile'}
                </h1>
                {activeTab==='chat' && (
                  <p className="text-xs mt-0.5" style={{ color:T.textSub }}>{onlineUsers.length} online</p>
                )}
              </div>
              <ThemeToggle />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto t" style={{ background:T.bg }}>

            {/* ── CHAT TAB ── */}
            {activeTab==='chat' && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 px-4 rounded-2xl mb-5 t"
                  style={{ ...card2, height:'44px' }}>
                  <MessageSquare size={15} style={{ color:T.textMuted }} />
                  <span className="text-sm" style={{ color:T.textMuted }}>Search conversations…</span>
                </div>

                {groups.length > 0 && (
                  <>
                    <p className="text-xs font-semibold px-1 mb-2 uppercase tracking-widest"
                      style={{ color:T.textSub }}>Groups</p>
                    {groups.map((group: any) => (
                      <div key={group.id}
                        onClick={() => { setSelectedGroup(group); setSelectedUser(null); }}
                        className="chat-item flex items-center gap-3 p-3 rounded-2xl mb-1 t" style={card}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: dark
                            ? 'linear-gradient(135deg,#1e1b4b,#312e81)'
                            : 'linear-gradient(135deg,#e0e7ff,#c7d2fe)' }}>
                          <Users size={20} style={{ color:'#818cf8' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate"
                            style={{ fontFamily:'Syne,sans-serif', color:T.text }}>{group.name}</h3>
                          <p className="text-xs" style={{ color:T.textSub }}>Group Chat</p>
                        </div>
                        <div className="w-2 h-2 rounded-full" style={{ background:T.groupDot }} />
                      </div>
                    ))}
                    <div className="h-4" />
                  </>
                )}

                <p className="text-xs font-semibold px-1 mb-2 uppercase tracking-widest"
                  style={{ color:T.textSub }}>People</p>
                {users.map((u: any) => {
                  const isOnline = onlineUsers.includes(u.id);
                  const unread   = unreadMessages[u.id] || 0;
                  return (
                    <div key={u.id}
                      onClick={() => { setSelectedUser(u); setSelectedGroup(null); }}
                      className="chat-item flex items-center gap-3 p-3 rounded-2xl mb-1 t" style={card}>
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden t"
                          style={{ background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                          {u.avatar_url
                            ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" />
                            : <User size={20} style={{ color:T.textSub }} />}
                        </div>
                        {isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                            style={{ background:'#4ade80', borderColor:T.bg }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate"
                          style={{ fontFamily:'Syne,sans-serif', color:T.text }}>
                          {u.full_name || u.username?.split('@')[0]}
                        </h3>
                        <p className="text-xs" style={{ color: isOnline ? '#4ade80' : T.textSub }}>
                          {isOnline ? '● Online' : 'Offline'}
                        </p>
                      </div>
                      {unread > 0 && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ background:'#ef4444', color:'#fff' }}>
                          {unread}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── SETTINGS TAB ── */}
            {activeTab==='settings' && isAdmin && (
              <div className="px-4 pb-32 space-y-6">
                <div>
                  <p className="text-xs font-semibold px-1 mb-3 uppercase tracking-widest"
                    style={{ color:T.textSub }}>Quick Actions</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setShowAddMember(true)}
                      className="pill-btn flex flex-col items-start gap-2 p-4 rounded-2xl"
                      style={{ background: dark
                        ? 'linear-gradient(135deg,#1e1b4b,#312e81)'
                        : 'linear-gradient(135deg,#e0e7ff,#c7d2fe)',
                        border:'1px solid rgba(129,140,248,0.25)' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background:'rgba(129,140,248,0.2)' }}>
                        <Plus size={18} style={{ color:'#818cf8' }} />
                      </div>
                      <span className="text-sm font-semibold"
                        style={{ fontFamily:'Syne,sans-serif', color: dark ? '#c7d2fe' : '#4338ca' }}>
                        Add Member
                      </span>
                    </button>
                    <button onClick={() => setShowNewGroup(true)}
                      className="pill-btn flex flex-col items-start gap-2 p-4 rounded-2xl t" style={card}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center t"
                        style={{ background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                        <Users size={18} style={{ color:T.textSub }} />
                      </div>
                      <span className="text-sm font-semibold"
                        style={{ fontFamily:'Syne,sans-serif', color:T.textSub }}>New Group</span>
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold px-1 mb-3 uppercase tracking-widest"
                    style={{ color:T.textSub }}>Permissions</p>
                  <div className="flex items-center justify-between p-4 rounded-2xl t" style={card}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background:'rgba(129,140,248,0.1)' }}>
                        <ImageIcon size={18} style={{ color:'#818cf8' }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color:T.text }}>Allow Media</p>
                        <p className="text-xs" style={{ color:T.textSub }}>Photos & videos in chat</p>
                      </div>
                    </div>
                    <button onClick={handleToggleFiles}
                      className="w-12 h-6 rounded-full relative shrink-0"
                      style={{ background: allowFiles ? '#4f46e5' : T.toggleOff, transition:'background 0.2s' }}>
                      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
                        style={{ left: allowFiles ? '26px' : '2px', transition:'left 0.2s',
                          boxShadow:'0 1px 4px rgba(0,0,0,0.25)' }} />
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold px-1 mb-3 uppercase tracking-widest"
                    style={{ color:T.textSub }}>Members</p>
                  <div className="space-y-2">
                    {users.map((u: any) => (
                      <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl t" style={card}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0 t"
                          style={{ background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                          {u.avatar_url
                            ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" />
                            : <User size={16} style={{ color:T.textSub }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color:T.text }}>
                            {u.full_name || u.username?.split('@')[0]}
                          </p>
                          <p className="text-xs truncate" style={{ color:T.textSub }}>{u.username}</p>
                        </div>
                        <button onClick={() => handleDeleteUser(u.id)}
                          className="p-2 rounded-xl shrink-0"
                          style={{ background:T.deleteBtn, color:T.deleteTxt }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold px-1 mb-3 uppercase tracking-widest"
                    style={{ color:T.textSub }}>Groups</p>
                  <div className="space-y-2">
                    {groups.map((g: any) => (
                      <div key={g.id} className="flex items-center gap-3 p-3 rounded-2xl t" style={card}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background:'rgba(129,140,248,0.1)' }}>
                          <Users size={16} style={{ color:'#818cf8' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color:T.text }}>{g.name}</p>
                          <p className="text-xs" style={{ color:T.textSub }}>Group</p>
                        </div>
                        <button onClick={() => handleDeleteGroup(g.id)}
                          className="p-2 rounded-xl shrink-0"
                          style={{ background:T.deleteBtn, color:T.deleteTxt }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── PROFILE TAB ── */}
            {activeTab==='profile' && (
              <div className="px-4 pb-32">
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-3xl overflow-hidden flex items-center justify-center"
                      style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                      {profile?.avatar_url
                        ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
                        : <User size={36} className="text-white" />}
                    </div>
                    <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background:'#4f46e5' }}>
                      <Camera size={14} className="text-white" />
                    </button>
                  </div>
                  <div className="text-center mt-1">
                    <h2 className="text-xl font-bold"
                      style={{ fontFamily:'Syne,sans-serif', color:T.text }}>
                      {profile?.full_name || profile?.username?.split('@')[0] || 'You'}
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color:T.textSub }}>{profile?.username}</p>
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mt-2"
                        style={{ background:'rgba(129,140,248,0.15)', color:'#818cf8' }}>
                        <ShieldCheck size={11} /> Admin
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold px-1 uppercase tracking-widest"
                    style={{ color:T.textSub }}>Account</p>
                  <div className="p-4 rounded-2xl t" style={card}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs" style={{ color:T.textSub }}>Display Name</p>
                      <button onClick={() => { setEditingName(!editingName); setNewFullName(profile?.full_name||''); }}
                        className="p-1.5 rounded-lg"
                        style={{ background:'rgba(129,140,248,0.1)', color:'#818cf8' }}>
                        <Edit3 size={13} />
                      </button>
                    </div>
                    {editingName ? (
                      <div className="flex gap-2 mt-2">
                        <input value={newFullName} onChange={e => setNewFullName(e.target.value)}
                          placeholder="Your name…" className="flex-1 px-3 py-2 rounded-xl text-sm t"
                          style={{ background:T.inputBg, border:'1px solid rgba(129,140,248,0.3)', color:T.text }} />
                        <button onClick={handleUpdateName}
                          className="px-4 py-2 rounded-xl text-sm font-semibold"
                          style={{ background:'#4f46e5', color:'#fff' }}>Save</button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium" style={{ color:T.text }}>
                        {profile?.full_name || 'Not set'}
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-2xl t" style={card}>
                    <p className="text-xs mb-1" style={{ color:T.textSub }}>Email</p>
                    <p className="text-sm font-medium" style={{ color:T.text }}>{currentUser?.email}</p>
                  </div>
                  <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl mt-2 font-semibold text-sm t"
                    style={{ background:T.signOutBg, border:`1px solid ${T.signOutBdr}`, color:T.signOutTxt }}>
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Nav */}
          <div className="shrink-0 px-4 pb-8 pt-2 t"
            style={{ background:T.bg, borderTop:`1px solid ${T.border}` }}>
            <div className="flex items-center justify-around py-2 px-2 rounded-3xl t"
              style={{ background:T.navBg, border:`1px solid ${T.navBorder}` }}>
              <button onClick={() => setActiveTab('chat')}
                className="tab-btn flex flex-col items-center gap-1 px-6 py-2 rounded-2xl"
                style={{ background: activeTab==='chat' ? T.activeTab : 'transparent' }}>
                <div className="relative">
                  <MessageSquare size={22} style={{ color: activeTab==='chat' ? '#818cf8' : T.iconInactive }} />
                  {totalUnread > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{ background:'#ef4444', color:'#fff' }}>{totalUnread}</div>
                  )}
                </div>
                <span className="text-[10px] font-medium"
                  style={{ color: activeTab==='chat' ? '#818cf8' : T.iconInactive }}>Chat</span>
              </button>
              {isAdmin && (
                <button onClick={() => setActiveTab('settings')}
                  className="tab-btn flex flex-col items-center gap-1 px-6 py-2 rounded-2xl"
                  style={{ background: activeTab==='settings' ? T.activeTab : 'transparent' }}>
                  <Settings size={22} style={{ color: activeTab==='settings' ? '#818cf8' : T.iconInactive }} />
                  <span className="text-[10px] font-medium"
                    style={{ color: activeTab==='settings' ? '#818cf8' : T.iconInactive }}>Settings</span>
                </button>
              )}
              <button onClick={() => setActiveTab('profile')}
                className="tab-btn flex flex-col items-center gap-1 px-6 py-2 rounded-2xl"
                style={{ background: activeTab==='profile' ? T.activeTab : 'transparent' }}>
                <UserCircle size={22} style={{ color: activeTab==='profile' ? '#818cf8' : T.iconInactive }} />
                <span className="text-[10px] font-medium"
                  style={{ color: activeTab==='profile' ? '#818cf8' : T.iconInactive }}>Profile</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODALS ════════════════════════════════════════════════ */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)' }}>
          <div className="w-full max-w-md p-6 pb-12 rounded-t-3xl t"
            style={{ background:T.modalBg, border:`1px solid ${T.border}` }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ fontFamily:'Syne,sans-serif', color:T.text }}>Add Member</h2>
              <button onClick={() => setShowAddMember(false)} className="p-2 rounded-xl"
                style={{ background: dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)', color:T.textSub }}>
                <X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                type="email" placeholder="Email address" className="w-full px-4 py-3 rounded-2xl text-sm t"
                style={{ background:T.inputBg, border:`1px solid ${T.border2}`, color:T.text }} />
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)}
                type="password" placeholder="Password" className="w-full px-4 py-3 rounded-2xl text-sm t"
                style={{ background:T.inputBg, border:`1px solid ${T.border2}`, color:T.text }} />
            </div>
            <button onClick={handleAddMember}
              className="w-full mt-5 py-4 rounded-2xl font-semibold text-sm"
              style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff' }}>
              Create Account
            </button>
          </div>
        </div>
      )}

      {showNewGroup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)' }}>
          <div className="w-full max-w-md p-6 pb-12 rounded-t-3xl t"
            style={{ background:T.modalBg, border:`1px solid ${T.border}` }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ fontFamily:'Syne,sans-serif', color:T.text }}>New Group</h2>
              <button onClick={() => setShowNewGroup(false)} className="p-2 rounded-xl"
                style={{ background: dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)', color:T.textSub }}>
                <X size={18} /></button>
            </div>
            <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              placeholder="Group name…" className="w-full px-4 py-3 rounded-2xl text-sm t"
              style={{ background:T.inputBg, border:`1px solid ${T.border2}`, color:T.text }} />
            <p className="text-xs mt-2 px-1" style={{ color:T.textSub }}>
              All current members will be added automatically.
            </p>
            <button onClick={handleCreateGroup}
              className="w-full mt-5 py-4 rounded-2xl font-semibold text-sm"
              style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff' }}>
              Create Group
            </button>
          </div>
        </div>
      )}
    </div>
  );
}