'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  Send, User, LogOut, MessageSquare, Loader2, ShieldCheck, Users,
  Check, CheckCheck, ChevronLeft, Settings, UserCircle, Plus, Trash2,
  Camera, Edit3, X, ImageIcon, FileImage, Search, Crown, ArrowLeft,
  Reply, CornerUpLeft, Pencil, WifiOff, Wifi, RefreshCw,
} from 'lucide-react';
import { useNetworkStatus } from '@/lib/useNetworkStatus';

type Tab = 'chat' | 'settings' | 'profile';

const DARK = {
  bg:'#0d0d14', bgCard:'rgba(255,255,255,0.05)', bgCard2:'rgba(255,255,255,0.08)',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.12)',
  header:'rgba(13,13,20,0.97)', text:'#f1f5f9', textSub:'#6b7280', textMuted:'#3d4451',
  scrollThumb:'#2d2d3a', inputBg:'rgba(255,255,255,0.07)',
  navBg:'rgba(255,255,255,0.05)', navBorder:'rgba(255,255,255,0.08)',
  iconInactive:'#4b5563', msgIn:'#1e2235',
  msgInBorder:'1px solid rgba(255,255,255,0.08)', msgInText:'#e2e8f0',
  msgTimeIn:'#4b5563', datePill:'rgba(255,255,255,0.07)', datePillText:'#6b7280',
  modalBg:'#13131f', toggleOff:'rgba(255,255,255,0.1)', activeTab:'rgba(79,70,229,0.2)',
  deleteBtn:'rgba(239,68,68,0.12)', deleteTxt:'#f87171',
  signOutBg:'rgba(239,68,68,0.08)', signOutBdr:'rgba(239,68,68,0.15)', signOutTxt:'#f87171',
  onlineDot:'#4ade80',
  replyBg:'rgba(255,255,255,0.06)', replyBorder:'rgba(129,140,248,0.4)',
  ctxMenu:'#1a1a2e', ctxBorder:'rgba(255,255,255,0.1)',
};
const LIGHT = {
  bg:'#eef0f7', bgCard:'#ffffff', bgCard2:'#f5f6fb',
  border:'rgba(0,0,0,0.07)', border2:'rgba(0,0,0,0.12)',
  header:'rgba(238,240,247,0.97)', text:'#0f172a', textSub:'#64748b', textMuted:'#94a3b8',
  scrollThumb:'#cbd5e1', inputBg:'#ffffff',
  navBg:'#ffffff', navBorder:'rgba(0,0,0,0.08)',
  iconInactive:'#94a3b8', msgIn:'#ffffff',
  msgInBorder:'1px solid rgba(0,0,0,0.06)', msgInText:'#1e293b',
  msgTimeIn:'#94a3b8', datePill:'rgba(0,0,0,0.06)', datePillText:'#64748b',
  modalBg:'#ffffff', toggleOff:'rgba(0,0,0,0.12)', activeTab:'rgba(79,70,229,0.1)',
  deleteBtn:'rgba(239,68,68,0.08)', deleteTxt:'#ef4444',
  signOutBg:'rgba(239,68,68,0.06)', signOutBdr:'rgba(239,68,68,0.15)', signOutTxt:'#ef4444',
  onlineDot:'#22c55e',
  replyBg:'rgba(79,70,229,0.06)', replyBorder:'rgba(79,70,229,0.35)',
  ctxMenu:'#ffffff', ctxBorder:'rgba(0,0,0,0.1)',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Home() {
  const router = useRouter();
  const [loading, setLoading]   = useState(true);
  const [dark, setDark]         = useState(true);
  const [currentUser, setCU]    = useState<any>(null);
  const [profile, setProfile]   = useState<any>(null);
  const [isAdmin, setIsAdmin]   = useState(false);
  const [users, setUsers]       = useState<any[]>([]);
  const [groups, setGroups]     = useState<any[]>([]);

  const [onlineIds, setOnlineIds]   = useState<Set<string>>(new Set());
  const knownUserIdsRef             = useRef<Set<string>>(new Set());

  const [unread, setUnread]         = useState<Record<string,number>>({});
  const [activeTab, setActiveTab]   = useState<Tab>('chat');

  const [selUser,  setSelUser]   = useState<any>(null);
  const [selGroup, setSelGroup]  = useState<any>(null);
  const [messages, setMessages]  = useState<any[]>([]);
  const [newMsg, setNewMsg]      = useState('');
  const [sending, setSending]    = useState(false);
  const [mediaPrev, setMediaPrev] = useState<{file:File;url:string;type:'image'|'video'}|null>(null);

  const [msgSearch, setMsgSearch]   = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // ── Reply state ────────────────────────────────────────────────────────────
  const [replyTo, setReplyTo] = useState<any>(null); // message being replied to

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editingMsg, setEditingMsg] = useState<any>(null); // message being edited
  const [editContent, setEditContent] = useState('');

  // ── Context menu state ─────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{msg:any; x:number; y:number} | null>(null);

  const [showAddMember, setShowAddMember] = useState(false);
  const [editGrp, setEditGrp]   = useState<any>(null);
  const [editGrpName, setEditGrpName] = useState('');
  const [grpMembers, setGrpMembers]   = useState<string[]>([]);
  const [editUsr, setEditUsr]   = useState<any>(null);
  const [editUsrName, setEditUsrName] = useState('');
  const [editUsrAdmin, setEditUsrAdmin] = useState(false);
  const [newEmail, setNewEmail]   = useState('');
  const [newPass,  setNewPass]    = useState('');

  const [allowFiles, setAllowFiles] = useState(false);
  const adminIdRef = useRef<string|null>(null);

  const [editingName, setEditingName] = useState(false);
  const [newFullName, setNewFullName] = useState('');

  // ── Network ────────────────────────────────────────────────────────────────
  const [realInternetCheck, setRealInternetCheck] = useState<boolean>(()=>{
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('realInternetCheck');
    return saved === null ? true : saved === 'true';
  });
  const { isOnline, checkReal, checking } = useNetworkStatus(realInternetCheck);

  const toggleRealCheck = () => {
    const v = !realInternetCheck;
    setRealInternetCheck(v);
    localStorage.setItem('realInternetCheck', String(v));
  };

  const avatarRef  = useRef<HTMLInputElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const selUserRef = useRef<any>(null);
  const selGrpRef  = useRef<any>(null);
  const cuRef      = useRef<any>(null);

  useEffect(()=>{ selUserRef.current = selUser; },[selUser]);
  useEffect(()=>{ selGrpRef.current  = selGroup; },[selGroup]);
  useEffect(()=>{ cuRef.current      = currentUser; },[currentUser]);

  const T = dark ? DARK : LIGHT;
  const fmt  = (d:string) => new Date(d).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
  const fmtD = (d:string) => {
    const dt = new Date(d);
    return dt.toDateString()===new Date().toDateString()
      ? 'Today'
      : dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  };

  const refreshUnread = async (uid:string) => {
    const { data } = await supabase.from('messages').select('sender_id')
      .eq('receiver_id',uid).eq('is_read',false);
    const m:Record<string,number> = {};
    data?.forEach((r:any)=>{ m[r.sender_id]=(m[r.sender_id]||0)+1; });
    setUnread(m);
  };

  // Close context menu on outside click
  useEffect(()=>{
    const handler = () => setCtxMenu(null);
    if (ctxMenu) {
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  },[ctxMenu]);

  // ── INIT ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    const init = async () => {
      const { data:{session} } = await supabase.auth.getSession();
      if (!session){ router.push('/login'); return; }
      const user = session.user;
      setCU(user); cuRef.current = user;

      const { data:prof } = await supabase.from('profiles').select('*').eq('id',user.id).single();
      setProfile(prof);
      const amAdmin = prof?.is_admin||false;
      setIsAdmin(amAdmin);

      const { data:others } = await supabase.from('profiles').select('*').neq('id',user.id);
      const otherList = others||[];
      setUsers(otherList);

      const ids = new Set<string>(otherList.map((p:any)=>p.id));
      ids.add(user.id);
      knownUserIdsRef.current = ids;

      if (amAdmin) {
        adminIdRef.current = user.id;
        setAllowFiles(prof?.settings_allow_files||false);
      } else {
        const adminProf = otherList.find((p:any)=>p.is_admin);
        if (adminProf) {
          adminIdRef.current = adminProf.id;
          setAllowFiles(adminProf.settings_allow_files||false);
        }
      }

      const { data:grps } = await supabase.from('groups').select('*');
      setGroups(grps||[]);
      await refreshUnread(user.id);
      setLoading(false);
    };
    init();
  },[router]);

  // ── REALTIME: profiles ─────────────────────────────────────────────────────
  useEffect(()=>{
    if (!currentUser || !isOnline) return;
    const ch = supabase.channel('profiles-live')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles'},(payload)=>{
        const updated = payload.new as any;
        if (updated.id === adminIdRef.current) {
          setAllowFiles(updated.settings_allow_files||false);
        }
        if (cuRef.current && updated.id === cuRef.current.id) {
          setProfile((p:any)=>({...p,...updated}));
        }
        setUsers(prev=>prev.map(u=>u.id===updated.id?{...u,...updated}:u));
      })
      .subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  },[currentUser, isOnline]);

  // ── REALTIME: messages + presence ─────────────────────────────────────────
  useEffect(()=>{
    if (!currentUser || !isOnline) return;
    const ch = supabase.channel('chat-room',{config:{presence:{key:currentUser.id}}});
    ch
      .on('presence',{event:'sync'},()=>{
        const keys = Object.keys(ch.presenceState());
        const known = knownUserIdsRef.current;
        const realOnline = keys.filter(k => UUID_RE.test(k) && known.has(k) && k!==currentUser.id);
        setOnlineIds(new Set(realOnline));
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async(p)=>{
        const msg = p.new as any;
        const cu  = cuRef.current;
        const su  = selUserRef.current;
        const sg  = selGrpRef.current;
        if (!cu) return;
        const inView = sg
          ? String(msg.group_id)===String(sg.id)
          : su && (msg.sender_id===su.id||msg.sender_id===cu.id);
        if (inView){
          setMessages(prev=>prev.find(m=>m.id===msg.id)?prev:[...prev,msg]);
          if (msg.receiver_id===cu.id)
            await supabase.from('messages').update({is_read:true}).eq('id',msg.id);
        } else if (msg.receiver_id===cu.id){
          setUnread(prev=>({...prev,[msg.sender_id]:(prev[msg.sender_id]||0)+1}));
        }
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages'},(p)=>{
        setMessages(prev=>prev.map(m=>m.id===p.new.id?{...m,...p.new}:m));
      })
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages'},(p)=>{
        setMessages(prev=>prev.filter(m=>m.id!==p.old.id));
      })
      .subscribe(async(s)=>{ if(s==='SUBSCRIBED') await ch.track({online_at:new Date().toISOString()}); });
    return ()=>{
      supabase.removeChannel(ch);
      // آفلاین شدیم — list آنلاین‌ها رو پاک کن
      setOnlineIds(new Set());
    };
  },[currentUser, isOnline]);

  useEffect(()=>{ scrollRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);

  // ── Fetch messages ─────────────────────────────────────────────────────────
  const selUserId  = selUser?.id  ?? null;
  const selGrpId   = selGroup?.id ?? null;

  const fetchMessages = useCallback(async()=>{
    const cu = cuRef.current;
    if (!cu||(!selUserId&&!selGrpId)){ setMessages([]); return; }
    let q = supabase.from('messages').select('*');
    if (selGrpId) q=q.eq('group_id',selGrpId);
    else q=q.or(`and(sender_id.eq.${cu.id},receiver_id.eq.${selUserId}),and(sender_id.eq.${selUserId},receiver_id.eq.${cu.id})`);
    const { data,error } = await q.order('created_at',{ascending:true});
    if (!error) setMessages(data||[]);
    if (selUserId){
      await supabase.from('messages').update({is_read:true})
        .eq('sender_id',selUserId).eq('receiver_id',cu.id).eq('is_read',false);
      setUnread(prev=>({...prev,[selUserId]:0}));
    }
  },[selUserId,selGrpId]);
  useEffect(()=>{ fetchMessages(); },[fetchMessages]);

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMsg = async(e:React.FormEvent)=>{
    e.preventDefault();
    if((!newMsg.trim()&&!mediaPrev)||sending||!currentUser) return;
    setSending(true);
    if(mediaPrev){
      const ext=mediaPrev.file.name.split('.').pop();
      const path=`${currentUser.id}/${Date.now()}.${ext}`;
      const {data:up,error:ue}=await supabase.storage.from('chat-media').upload(path,mediaPrev.file);
      if(!ue&&up){
        const {data:{publicUrl}}=supabase.storage.from('chat-media').getPublicUrl(path);
        const p:any={content:publicUrl,sender_id:currentUser.id,is_image:true};
        if(selGroup) p.group_id=selGroup.id; else if(selUser) p.receiver_id=selUser.id;
        if(replyTo) p.reply_to=replyTo.id;
        await supabase.from('messages').insert([p]);
      }
      setMediaPrev(null);
    }
    if(newMsg.trim()){
      const p:any={content:newMsg,sender_id:currentUser.id};
      if(selGroup) p.group_id=selGroup.id; else if(selUser) p.receiver_id=selUser.id;
      if(replyTo) p.reply_to=replyTo.id;
      await supabase.from('messages').insert([p]);
    }
    setNewMsg('');
    setReplyTo(null);
    setSending(false);
  };

  // ── Delete message ─────────────────────────────────────────────────────────
  const deleteMsg = async(msg:any)=>{
    if(!currentUser||msg.sender_id!==currentUser.id) return;
    await supabase.from('messages').delete().eq('id',msg.id);
    // realtime DELETE event will remove it from state
  };

  // ── Edit message ───────────────────────────────────────────────────────────
  const startEdit = (msg:any)=>{
    setEditingMsg(msg);
    setEditContent(msg.content||'');
    setCtxMenu(null);
    setTimeout(()=>inputRef.current?.focus(),50);
  };

  const saveEdit = async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!editContent.trim()||!editingMsg) return;
    const {error}=await supabase.from('messages')
      .update({content:editContent,edited_at:new Date().toISOString()})
      .eq('id',editingMsg.id);
    if(!error){
      setMessages(prev=>prev.map(m=>m.id===editingMsg.id?{...m,content:editContent,edited_at:new Date().toISOString()}:m));
    }
    setEditingMsg(null);
    setEditContent('');
  };

  const cancelEdit = ()=>{ setEditingMsg(null); setEditContent(''); };

  // ── Context menu ───────────────────────────────────────────────────────────
  const openCtxMenu=(e:React.MouseEvent,msg:any)=>{
    e.preventDefault();
    e.stopPropagation();
    const isMe = currentUser && msg.sender_id===currentUser.id;
    // Only show menu if there's something to do
    setCtxMenu({msg,x:e.clientX,y:e.clientY});
  };

  const onFileChange=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0]; if(!f) return;
    setMediaPrev({file:f,url:URL.createObjectURL(f),type:f.type.startsWith('video')?'video':'image'});
    e.target.value='';
  };

  const onAvatarChange=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0]; if(!f||!currentUser) return;
    const ext=f.name.split('.').pop()||'jpg';
    const path=`avatars/${currentUser.id}_${Date.now()}.${ext}`;
    const {data:up,error:upErr}=await supabase.storage.from('chat-media').upload(path,f);
    if(upErr){ console.error('Avatar upload error:',upErr.message); e.target.value=''; return; }
    if(up){
      const {data:{publicUrl}}=supabase.storage.from('chat-media').getPublicUrl(path);
      const {error:dbErr}=await supabase.from('profiles').update({avatar_url:publicUrl}).eq('id',currentUser.id);
      if(dbErr){ console.error('Profile update error:',dbErr.message); }
      else { setProfile((p:any)=>({...p,avatar_url:publicUrl})); }
    }
    e.target.value='';
  };

  const toggleFiles=async()=>{
    if(!isAdmin||!currentUser) return;
    const v=!allowFiles;
    setAllowFiles(v);
    await supabase.from('profiles').update({settings_allow_files:v}).eq('id',currentUser.id);
  };

  // ── Group CRUD ─────────────────────────────────────────────────────────────
  const openEditGrp=async(g:any)=>{
    setEditGrp(g); setEditGrpName(g.name);
    const {data}=await supabase.from('group_members').select('user_id').eq('group_id',g.id);
    setGrpMembers(data?.map((r:any)=>r.user_id)||[]);
  };

  const saveGrp=async()=>{
    if(!editGrp?.id) return;
    if(editGrpName.trim()&&editGrpName!==editGrp.name){
      const {error}=await supabase.from('groups').update({name:editGrpName}).eq('id',editGrp.id);
      if(!error) setGroups(prev=>prev.map(g=>g.id===editGrp.id?{...g,name:editGrpName}:g));
    }
    const {data:ex}=await supabase.from('group_members').select('user_id').eq('group_id',editGrp.id);
    const exIds:string[]=ex?.map((r:any)=>r.user_id)||[];
    const toAdd=grpMembers.filter(id=>!exIds.includes(id));
    const toDel=exIds.filter(id=>!grpMembers.includes(id));
    if(toAdd.length) await supabase.from('group_members').insert(toAdd.map(uid=>({group_id:editGrp.id,user_id:uid})));
    if(toDel.length) await supabase.from('group_members').delete().eq('group_id',editGrp.id).in('user_id',toDel);
    setEditGrp(null);
  };

  const createGrp=async()=>{
    if(!currentUser||!editGrpName.trim()) return;
    const {data:g,error}=await supabase.from('groups')
      .insert([{name:editGrpName.trim(),created_by:currentUser.id}]).select().single();
    if(error||!g) return;
    const rows=[...grpMembers.map(uid=>({group_id:g.id,user_id:uid})),{group_id:g.id,user_id:currentUser.id}];
    await supabase.from('group_members').insert(rows);
    setGroups(prev=>[...prev,g]);
    setEditGrp(null); setEditGrpName(''); setGrpMembers([]);
  };

  const deleteGrp=async(id:string)=>{
    if(!confirm('Delete this group?')) return;
    await supabase.from('groups').delete().eq('id',id);
    setGroups(prev=>prev.filter(g=>g.id!==id));
  };

  // ── User CRUD ──────────────────────────────────────────────────────────────
  const openEditUsr=(u:any)=>{ setEditUsr(u); setEditUsrName(u.full_name||''); setEditUsrAdmin(u.is_admin||false); };

  const saveUsr=async()=>{
    if(!editUsr) return;
    const {error}=await supabase.from('profiles')
      .update({full_name:editUsrName,is_admin:editUsrAdmin}).eq('id',editUsr.id);
    if(!error){
      setUsers(prev=>prev.map(u=>u.id===editUsr.id?{...u,full_name:editUsrName,is_admin:editUsrAdmin}:u));
    } else { alert('Save failed: '+error.message); }
    setEditUsr(null);
  };

  const deleteUsr=async(id:string)=>{
    if(!confirm('Delete this member?')) return;
    await supabase.from('profiles').delete().eq('id',id);
    setUsers(prev=>prev.filter(u=>u.id!==id));
  };

  const saveName=async()=>{
    if(!newFullName.trim()||!currentUser) return;
    const {error}=await supabase.from('profiles').update({full_name:newFullName}).eq('id',currentUser.id);
    if(!error){ setProfile((p:any)=>({...p,full_name:newFullName})); setEditingName(false); }
  };

  const addMember=async()=>{
    if(!newEmail||!newPass) return;
    const {error}=await supabase.auth.signUp({email:newEmail,password:newPass});
    if(!error){ setShowAddMember(false); setNewEmail(''); setNewPass(''); alert('Member added!'); }
    else alert(error.message);
  };

  // ── Message search ─────────────────────────────────────────────────────────
  const filteredMsgs = msgSearch.trim()
    ? messages.filter(m=>!m.is_image && (m.content||'').toLowerCase().includes(msgSearch.toLowerCase()))
    : messages;

  const highlight=(text:string)=>{
    if(!msgSearch.trim()) return text;
    const esc=msgSearch.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return text.replace(new RegExp(`(${esc})`,'gi'),'<mark class="hl">$1</mark>');
  };

  // Helper: get reply preview info
  const getReplyPreview=(msg:any)=>{
    if(!msg.reply_to) return null;
    const orig = messages.find(m=>m.id===msg.reply_to);
    if(!orig) return {text:'Message deleted',senderName:'',isImage:false};
    const sender = orig.sender_id===currentUser?.id
      ? 'You'
      : (users.find((u:any)=>u.id===orig.sender_id)?.full_name || 'Unknown');
    return {
      text: orig.is_image ? '📷 Photo' : (orig.content||'').slice(0,60)+(orig.content?.length>60?'…':''),
      senderName: sender,
      isImage: orig.is_image,
    };
  };

  const totalUnread=Object.values(unread).reduce((a,b)=>a+b,0);
  const onlineCount=onlineIds.size;
  const inChat=!!(selUser||selGroup);

  if(loading) return (
    <div className="h-screen flex items-center justify-center" style={{background:DARK.bg}}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
          <MessageSquare className="text-white" size={28}/>
        </div>
        <Loader2 className="animate-spin" size={20} style={{color:'#6366f1'}}/>
      </div>
    </div>
  );

  const card  = {background:T.bgCard,  border:`1px solid ${T.border}`};
  const card2 = {background:T.bgCard2, border:`1px solid ${T.border}`};

  const ThemeToggle=()=>(
    <button onClick={()=>setDark(d=>!d)} title={dark?'Light mode':'Dark mode'}
      style={{position:'relative',width:56,height:28,borderRadius:14,cursor:'pointer',
        background:dark?'#1e1e3a':'#dde3ff',
        border:dark?'1px solid rgba(99,102,241,0.4)':'1px solid rgba(79,70,229,0.25)',
        transition:'all 0.3s',flexShrink:0,display:'flex',alignItems:'center',padding:'0 4px'}}>
      <span style={{position:'absolute',left:6,fontSize:10,opacity:dark?0.5:0}}>🌙</span>
      <span style={{position:'absolute',right:6,fontSize:10,opacity:dark?0:0.7}}>☀️</span>
      <div style={{width:20,height:20,borderRadius:10,flexShrink:0,
        background:dark?'linear-gradient(135deg,#818cf8,#6366f1)':'linear-gradient(135deg,#fbbf24,#f59e0b)',
        boxShadow:dark?'0 0 8px rgba(99,102,241,0.6)':'0 0 8px rgba(251,191,36,0.5)',
        transform:dark?'translateX(0)':'translateX(28px)',
        transition:'transform 0.3s cubic-bezier(0.4,0,0.2,1),background 0.3s',
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:10}}>
        {dark?'🌙':'☀️'}
      </div>
    </button>
  );

  const Toggle=({on,onToggle,color='#4f46e5'}:{on:boolean,onToggle:()=>void,color?:string})=>(
    <button onClick={onToggle} className="w-12 h-6 rounded-full relative shrink-0"
      style={{background:on?color:T.toggleOff,transition:'background 0.2s'}}>
      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
        style={{left:on?'26px':'2px',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.25)'}}/>
    </button>
  );

  // ── Reply preview bar (inside input area) ──────────────────────────────────
  const ReplyBar=()=>{
    if(!replyTo) return null;
    const senderName = replyTo.sender_id===currentUser?.id
      ? 'Yourself'
      : (users.find((u:any)=>u.id===replyTo.sender_id)?.full_name||'Unknown');
    return (
      <div className="px-4 pt-2 shrink-0" style={{background:T.header}}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{background:T.replyBg,borderLeft:`3px solid ${T.replyBorder}`}}>
          <CornerUpLeft size={14} style={{color:'#818cf8',flexShrink:0}}/>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{color:'#818cf8'}}>{senderName}</p>
            <p className="text-xs truncate" style={{color:T.textSub}}>
              {replyTo.is_image?'📷 Photo':replyTo.content?.slice(0,80)}
            </p>
          </div>
          <button onClick={()=>setReplyTo(null)} className="shrink-0 p-1"><X size={13} style={{color:T.textSub}}/></button>
        </div>
      </div>
    );
  };

  // ── Edit bar (inside input area) ───────────────────────────────────────────
  const EditBar=()=>{
    if(!editingMsg) return null;
    return (
      <div className="px-4 pt-2 shrink-0" style={{background:T.header}}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{background:dark?'rgba(79,209,197,0.08)':'rgba(20,184,166,0.07)',borderLeft:'3px solid #14b8a6'}}>
          <Pencil size={14} style={{color:'#14b8a6',flexShrink:0}}/>
          <p className="flex-1 text-xs font-medium" style={{color:'#14b8a6'}}>Editing message</p>
          <button onClick={cancelEdit} className="shrink-0 p-1"><X size={13} style={{color:T.textSub}}/></button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden"
      style={{background:T.bg,color:T.text,transition:'background 0.3s,color 0.3s'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;} body{font-family:'DM Sans',sans-serif;margin:0;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${T.scrollThumb};border-radius:2px;}
        .tab-btn{transition:all 0.22s cubic-bezier(0.4,0,0.2,1);}
        .ci{transition:background 0.15s ease;cursor:pointer;}
        .mb{animation:fu 0.18s ease;}
        @keyframes fu{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        .pb{transition:all 0.18s ease;} .pb:active{transform:scale(0.97);}
        .sb{transition:all 0.15s ease;} .sb:active{transform:scale(0.9);}
        input{outline:none;} .t{transition:background 0.3s,border-color 0.3s,color 0.3s;}
        mark.hl{background:rgba(251,191,36,0.4);color:inherit;border-radius:2px;padding:0 1px;}
        .msg-wrap:hover .msg-actions{opacity:1;}
        .msg-actions{opacity:0;transition:opacity 0.15s ease;}
        .ctx-menu{position:fixed;z-index:100;border-radius:14px;overflow:hidden;
          box-shadow:0 8px 32px rgba(0,0,0,0.3);min-width:160px;}
        .ctx-item{display:flex;align-items:center;gap:10px;padding:11px 16px;
          font-size:13px;cursor:pointer;transition:background 0.12s;}
      `}</style>


      {/* ═══════════ CONTEXT MENU ══════════════════════════════════════ */}
      {ctxMenu&&(
        <div className="ctx-menu" onClick={e=>e.stopPropagation()}
          style={{left:Math.min(ctxMenu.x,window.innerWidth-180),top:Math.min(ctxMenu.y,window.innerHeight-160),
            background:T.ctxMenu,border:`1px solid ${T.ctxBorder}`}}>
          {/* Reply — always available */}
          <div className="ctx-item" style={{color:'#818cf8'}}
            onClick={()=>{ setReplyTo(ctxMenu.msg); setCtxMenu(null); inputRef.current?.focus(); }}>
            <Reply size={15}/> Reply
          </div>
          {/* Edit — only own text messages */}
          {currentUser&&ctxMenu.msg.sender_id===currentUser.id&&!ctxMenu.msg.is_image&&(
            <div className="ctx-item" style={{color:'#14b8a6'}}
              onClick={()=>startEdit(ctxMenu.msg)}>
              <Pencil size={15}/> Edit
            </div>
          )}
          {/* Delete — only own messages */}
          {currentUser&&ctxMenu.msg.sender_id===currentUser.id&&(
            <div className="ctx-item" style={{color:'#f87171'}}
              onClick={()=>{ deleteMsg(ctxMenu.msg); setCtxMenu(null); }}>
              <Trash2 size={15}/> Delete
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ CHAT VIEW ═══════════════════════════════════ */}
      {inChat && (
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0 t"
            style={{background:T.header,borderBottom:`1px solid ${T.border}`,backdropFilter:'blur(20px)'}}>
            <button onClick={()=>{setSelUser(null);setSelGroup(null);setMediaPrev(null);setSearchOpen(false);setMsgSearch('');setReplyTo(null);setEditingMsg(null);}}
              className="p-2 rounded-xl shrink-0 t" style={{background:dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}}>
              <ChevronLeft size={20} style={{color:'#818cf8'}}/>
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
              style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
              {selGroup?<Users size={18} className="text-white"/>
                :selUser?.avatar_url?<img src={selUser.avatar_url} className="w-full h-full object-cover" alt=""/>
                :<User size={18} className="text-white"/>}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm truncate" style={{fontFamily:'Syne,sans-serif',color:T.text}}>
                {selGroup?selGroup.name:(selUser?.full_name||selUser?.username?.split('@')[0]||'')}
              </h2>
              {selGroup
                ? <p className="text-xs" style={{color:'#818cf8'}}>Group Chat</p>
                : <p className="text-xs" style={{color:selUser&&onlineIds.has(selUser.id)?T.onlineDot:T.textSub}}>
                    {selUser&&onlineIds.has(selUser.id)?'● Online':'Offline'}
                  </p>
              }
            </div>
            <button onClick={()=>{setSearchOpen(s=>!s);setMsgSearch('');}}
              className="p-2 rounded-xl t"
              style={{background:searchOpen?(dark?'rgba(129,140,248,0.2)':'rgba(79,70,229,0.1)'):(dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'),color:searchOpen?'#818cf8':T.iconInactive}}>
              <Search size={18}/>
            </button>
            <ThemeToggle/>
          </div>

          {/* Search bar */}
          {searchOpen && (
            <div className="px-4 py-2 shrink-0 t" style={{background:T.header,borderBottom:`1px solid ${T.border}`}}>
              <div className="flex items-center gap-2 px-3 rounded-xl t"
                style={{background:T.inputBg,border:`1px solid ${T.border2}`,height:38}}>
                <Search size={14} style={{color:T.textMuted,flexShrink:0}}/>
                <input value={msgSearch} onChange={e=>setMsgSearch(e.target.value)}
                  placeholder="Search in messages…" autoFocus
                  className="flex-1 bg-transparent text-sm t" style={{color:T.text,border:'none'}}/>
                {msgSearch&&<span className="text-xs shrink-0 font-medium" style={{color:'#818cf8'}}>{filteredMsgs.length}</span>}
                {msgSearch&&<button onClick={()=>setMsgSearch('')}><X size={13} style={{color:T.textMuted}}/></button>}
              </div>
            </div>
          )}

          {/* Offline banner */}
          {!isOnline&&(
            <div className="flex items-center justify-between gap-2 px-4 py-2 shrink-0"
              style={{background:"rgba(239,68,68,0.12)",borderBottom:"1px solid rgba(239,68,68,0.2)"}}>
              <div className="flex items-center gap-2">
                <WifiOff size={14} style={{color:"#f87171",flexShrink:0}}/>
                <p className="text-xs font-medium" style={{color:"#f87171"}}>آفلاین — ارسال پیام غیرفعال است</p>
              </div>
              {realInternetCheck&&(
                <button onClick={checkReal} disabled={checking}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                  style={{background:"rgba(239,68,68,0.15)",color:"#f87171"}}>
                  <RefreshCw size={11} className={checking?"animate-spin":""}/> چک
                </button>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 t" style={{background:T.bg}}
            onClick={()=>ctxMenu&&setCtxMenu(null)}>
            {messages.length===0&&(
              <div className="flex flex-col items-center justify-center h-full gap-2 opacity-30">
                <MessageSquare size={32} style={{color:T.textSub}}/>
                <p className="text-sm" style={{color:T.textSub}}>No messages yet</p>
              </div>
            )}
            {msgSearch.trim()&&filteredMsgs.length===0&&messages.length>0&&(
              <div className="flex flex-col items-center justify-center h-full gap-2 opacity-30">
                <Search size={28} style={{color:T.textSub}}/>
                <p className="text-sm" style={{color:T.textSub}}>Nothing found for "{msgSearch}"</p>
              </div>
            )}
            {filteredMsgs.map((msg:any,idx:number)=>{
              const isMe   = !!currentUser&&msg.sender_id===currentUser.id;
              const showDt = idx===0||fmtD(filteredMsgs[idx-1].created_at)!==fmtD(msg.created_at);
              const isImg  = msg.is_image;
              const sender = users.find((u:any)=>u.id===msg.sender_id);
              const replyPrev = getReplyPreview(msg);

              return (
                <div key={msg.id??idx} className="mb msg-wrap">
                  {showDt&&(
                    <div className="flex justify-center my-4">
                      <span className="text-xs px-3 py-1 rounded-full"
                        style={{background:T.datePill,color:T.datePillText}}>{fmtD(msg.created_at)}</span>
                    </div>
                  )}
                  <div className={`flex mb-1.5 ${isMe?'justify-end':'justify-start'} items-end gap-1`}>

                    {/* Floating action buttons — left side for own msgs */}
                    {isMe&&(
                      <div className="msg-actions flex items-center gap-1 mb-1">
                        <button onClick={(e)=>openCtxMenu(e,msg)}
                          className="p-1.5 rounded-lg"
                          style={{background:dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)',color:T.textMuted}}>
                          <Edit3 size={13}/>
                        </button>
                      </div>
                    )}

                    <div style={{maxWidth:'78%',overflow:'hidden'}}>

                      {/* Reply preview bubble */}
                      {replyPrev&&(
                        <div className={`mb-1 px-3 py-2 rounded-xl ${isMe?'ml-auto':'mr-auto'}`}
                          style={{
                            background:T.replyBg,
                            borderLeft:`3px solid ${T.replyBorder}`,
                            maxWidth:'100%',
                          }}>
                          <p className="text-[10px] font-semibold mb-0.5" style={{color:'#818cf8'}}>{replyPrev.senderName}</p>
                          <p className="text-xs truncate" style={{color:T.textSub}}>{replyPrev.text}</p>
                        </div>
                      )}

                      {/* Message bubble */}
                      <div
                        onContextMenu={(e)=>openCtxMenu(e,msg)}
                        style={{
                          padding:isImg?'6px':'10px 14px',
                          borderRadius:isMe?'18px 18px 4px 18px':'18px 18px 18px 4px',
                          background:isMe?'linear-gradient(135deg,#4f46e5,#7c3aed)':T.msgIn,
                          border:isMe?'none':T.msgInBorder,
                          cursor:'context-menu',
                        }}>
                        {selGroup&&!isMe&&(
                          <p className="text-xs font-semibold mb-1" style={{color:'#818cf8'}}>
                            {sender?.full_name||sender?.username?.split('@')[0]||''}
                          </p>
                        )}
                        {isImg?(
                          <div className="rounded-xl overflow-hidden">
                            {/\.(mp4|webm|mov)$/i.test(msg.content)
                              ?<video src={msg.content} controls className="max-w-full rounded-xl" style={{maxHeight:220}}/>
                              :<img src={msg.content} className="max-w-full rounded-xl" style={{maxHeight:220,display:'block'}} alt="media"/>}
                            <div className={`flex items-center gap-1 mt-1 px-1 pb-1 ${isMe?'justify-end':'justify-start'}`}>
                              <span className="text-[10px]" style={{color:isMe?'rgba(255,255,255,0.5)':T.msgTimeIn}}>{fmt(msg.created_at)}</span>
                              {isMe&&(msg.is_read?<CheckCheck size={13} style={{color:'#a5b4fc'}}/>:<Check size={13} style={{color:'rgba(255,255,255,0.35)'}}/>)}
                            </div>
                          </div>
                        ):(
                          <>
                            <p className="text-sm leading-relaxed break-words"
                              style={{color:isMe?'#fff':T.msgInText}}
                              dangerouslySetInnerHTML={{__html:highlight(msg.content||'')}}>
                            </p>
                            <div className={`flex items-center gap-1 mt-1 ${isMe?'justify-end':'justify-start'}`}>
                              {msg.edited_at&&(
                                <span className="text-[9px] italic" style={{color:isMe?'rgba(255,255,255,0.4)':T.msgTimeIn}}>edited</span>
                              )}
                              <span className="text-[10px]" style={{color:isMe?'rgba(255,255,255,0.45)':T.msgTimeIn}}>{fmt(msg.created_at)}</span>
                              {isMe&&(msg.is_read?<CheckCheck size={13} style={{color:'#a5b4fc'}}/>:<Check size={13} style={{color:'rgba(255,255,255,0.35)'}}/>)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Floating reply button — right side for others' msgs */}
                    {!isMe&&(
                      <div className="msg-actions flex items-center gap-1 mb-1">
                        <button onClick={()=>{setReplyTo(msg);inputRef.current?.focus();}}
                          className="p-1.5 rounded-lg"
                          style={{background:dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)',color:T.textMuted}}>
                          <Reply size={13}/>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef}/>
          </div>

          {/* Edit bar */}
          <EditBar/>

          {/* Reply bar */}
          {!editingMsg&&<ReplyBar/>}

          {/* Media preview */}
          {mediaPrev&&(
            <div className="px-4 pt-2 shrink-0 t" style={{background:T.header,borderTop:`1px solid ${T.border}`}}>
              <div className="flex items-center gap-2 p-2 rounded-2xl" style={card}>
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                  {mediaPrev.type==='video'?<video src={mediaPrev.url} className="w-full h-full object-cover"/>
                    :<img src={mediaPrev.url} className="w-full h-full object-cover" alt=""/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{color:T.text}}>{mediaPrev.file.name}</p>
                  <p className="text-[10px]" style={{color:T.textSub}}>{(mediaPrev.file.size/1024).toFixed(0)} KB</p>
                </div>
                <button onClick={()=>setMediaPrev(null)} className="p-1.5 rounded-lg shrink-0"
                  style={{background:'rgba(239,68,68,0.1)',color:'#f87171'}}><X size={14}/></button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 shrink-0 t" style={{background:T.header,borderTop:`1px solid ${T.border}`}}>
            {/* Edit mode */}
            {editingMsg?(
              <form onSubmit={saveEdit} className="flex items-center gap-2">
                <div className="flex-1 flex items-center px-4 rounded-2xl t"
                  style={{background:T.inputBg,border:'1px solid #14b8a6',minHeight:'48px'}}>
                  <input ref={inputRef} value={editContent} onChange={e=>setEditContent(e.target.value)}
                    placeholder="Edit message…" autoFocus
                    className="flex-1 bg-transparent text-sm py-3 t" style={{color:T.text,border:'none'}}/>
                </div>
                <button type="submit" disabled={!editContent.trim()}
                  className="sb w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{background:editContent.trim()?'#14b8a6':(dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)')}}>
                  <Check size={18} style={{color:editContent.trim()?'#fff':T.iconInactive}}/>
                </button>
                <button type="button" onClick={cancelEdit}
                  className="sb w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{background:dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}}>
                  <X size={18} style={{color:T.iconInactive}}/>
                </button>
              </form>
            ):(
              /* Normal send mode */
              <form onSubmit={sendMsg} className="flex items-center gap-2">
                {allowFiles&&(
                  <>
                    <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFileChange} className="hidden"/>
                    <button type="button" onClick={()=>fileRef.current?.click()}
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 t"
                      style={{background:mediaPrev?'linear-gradient(135deg,#4f46e5,#7c3aed)':(dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'),border:`1px solid ${T.border}`}}>
                      <FileImage size={18} style={{color:mediaPrev?'#fff':'#818cf8'}}/>
                    </button>
                  </>
                )}
                <div className="flex-1 flex items-center px-4 rounded-2xl t"
                  style={{background:T.inputBg,border:`1px solid ${T.border2}`,minHeight:'48px'}}>
                  <input ref={inputRef} value={newMsg} onChange={e=>setNewMsg(e.target.value)}
                    placeholder={mediaPrev?'Add a caption…':'Message…'}
                    className="flex-1 bg-transparent text-sm py-3 t" style={{color:T.text,border:'none'}}/>
                </div>
                <button type="submit" disabled={sending||!isOnline} className="sb w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{background:(newMsg.trim()||mediaPrev)?'linear-gradient(135deg,#4f46e5,#7c3aed)':(dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)')}}>
                  {sending?<Loader2 size={18} className="animate-spin text-white"/>
                    :<Send size={18} style={{color:(newMsg.trim()||mediaPrev)?'#fff':T.iconInactive}}/>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ TABBED VIEW ═════════════════════════════════ */}
      {!inChat&&(
        <div className="flex flex-col h-full">
          <div className="px-5 pt-12 pb-4 shrink-0 t" style={{background:T.bg}}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold" style={{fontFamily:'Syne,sans-serif',color:T.text}}>
                  {activeTab==='chat'?'Messages':activeTab==='settings'?'Settings':'Profile'}
                </h1>
                {activeTab==='chat'&&<p className="text-xs mt-0.5" style={{color:T.textSub}}>{onlineCount} online</p>}
              </div>
              <ThemeToggle/>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto t" style={{background:T.bg}}>

            {/* CHAT TAB */}
            {activeTab==='chat'&&(
              <div className="px-4 pb-4">
                {groups.length>0&&(
                  <>
                    <p className="text-xs font-semibold px-1 mb-2 uppercase tracking-widest" style={{color:T.textSub}}>Groups</p>
                    {groups.map((g:any)=>(
                      <div key={g.id} onClick={()=>{setSelGroup(g);setSelUser(null);}}
                        className="ci flex items-center gap-3 p-3 rounded-2xl mb-1 t" style={card}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                          style={{background:dark?'linear-gradient(135deg,#1e1b4b,#312e81)':'linear-gradient(135deg,#e0e7ff,#c7d2fe)'}}>
                          <Users size={20} style={{color:'#818cf8'}}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate" style={{fontFamily:'Syne,sans-serif',color:T.text}}>{g.name}</h3>
                          <p className="text-xs" style={{color:T.textSub}}>Group Chat</p>
                        </div>
                      </div>
                    ))}
                    <div className="h-4"/>
                  </>
                )}
                <p className="text-xs font-semibold px-1 mb-2 uppercase tracking-widest" style={{color:T.textSub}}>People</p>
                {users.map((u:any)=>{
                  const isOn=onlineIds.has(u.id);
                  const cnt=unread[u.id]||0;
                  return (
                    <div key={u.id} onClick={()=>{setSelUser(u);setSelGroup(null);}}
                      className="ci flex items-center gap-3 p-3 rounded-2xl mb-1 t" style={card}>
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden t"
                          style={{background:dark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)'}}>
                          {u.avatar_url?<img src={u.avatar_url} className="w-full h-full object-cover" alt=""/>:<User size={20} style={{color:T.textSub}}/>}
                        </div>
                        {isOn&&<div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                          style={{background:T.onlineDot,borderColor:T.bg}}/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate" style={{fontFamily:'Syne,sans-serif',color:T.text}}>
                          {u.full_name||u.username?.split('@')[0]}
                        </h3>
                        <p className="text-xs" style={{color:isOn?T.onlineDot:T.textSub}}>{isOn?'● Online':'Offline'}</p>
                      </div>
                      {cnt>0&&<div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{background:'#ef4444',color:'#fff'}}>{cnt}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab==='settings'&&isAdmin&&(
              <div className="px-4 pb-32 space-y-6">
                <div>
                  <p className="text-xs font-semibold px-1 mb-3 uppercase tracking-widest" style={{color:T.textSub}}>Quick Actions</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={()=>setShowAddMember(true)} className="pb flex flex-col items-start gap-2 p-4 rounded-2xl"
                      style={{background:dark?'linear-gradient(135deg,#1e1b4b,#312e81)':'linear-gradient(135deg,#e0e7ff,#c7d2fe)',border:'1px solid rgba(129,140,248,0.25)'}}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'rgba(129,140,248,0.2)'}}>
                        <Plus size={18} style={{color:'#818cf8'}}/>
                      </div>
                      <span className="text-sm font-semibold" style={{fontFamily:'Syne,sans-serif',color:dark?'#c7d2fe':'#4338ca'}}>Add Member</span>
                    </button>
                    <button onClick={()=>{setEditGrp({id:null});setEditGrpName('');setGrpMembers([]);}}
                      className="pb flex flex-col items-start gap-2 p-4 rounded-2xl t" style={card}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center t"
                        style={{background:dark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)'}}>
                        <Users size={18} style={{color:T.textSub}}/>
                      </div>
                      <span className="text-sm font-semibold" style={{fontFamily:'Syne,sans-serif',color:T.textSub}}>New Group</span>
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold px-1 mb-3 uppercase tracking-widest" style={{color:T.textSub}}>Permissions</p>
                  <div className="flex items-center justify-between p-4 rounded-2xl t" style={card}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'rgba(129,140,248,0.1)'}}>
                        <ImageIcon size={18} style={{color:'#818cf8'}}/>
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{color:T.text}}>Allow Media</p>
                        <p className="text-xs" style={{color:T.textSub}}>Photos & videos for everyone</p>
                      </div>
                    </div>
                    <Toggle on={allowFiles} onToggle={toggleFiles}/>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold px-1 mb-3 uppercase tracking-widest" style={{color:T.textSub}}>Members</p>
                  <div className="space-y-2">
                    {users.map((u:any)=>(
                      <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl t" style={card}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0 t"
                          style={{background:dark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)'}}>
                          {u.avatar_url?<img src={u.avatar_url} className="w-full h-full object-cover" alt=""/>:<User size={16} style={{color:T.textSub}}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-semibold truncate" style={{color:T.text}}>{u.full_name||u.username?.split('@')[0]}</p>
                            {u.is_admin&&<Crown size={11} style={{color:'#fbbf24',flexShrink:0}}/>}
                          </div>
                          <p className="text-xs truncate" style={{color:T.textSub}}>{u.username}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={()=>openEditUsr(u)} className="p-2 rounded-xl"
                            style={{background:dark?'rgba(129,140,248,0.1)':'rgba(79,70,229,0.08)',color:'#818cf8'}}>
                            <Edit3 size={14}/>
                          </button>
                          <button onClick={()=>deleteUsr(u.id)} className="p-2 rounded-xl"
                            style={{background:T.deleteBtn,color:T.deleteTxt}}>
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold px-1 mb-3 uppercase tracking-widest" style={{color:T.textSub}}>Groups</p>
                  <div className="space-y-2">
                    {groups.map((g:any)=>(
                      <div key={g.id} className="flex items-center gap-3 p-3 rounded-2xl t" style={card}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{background:'rgba(129,140,248,0.1)'}}>
                          <Users size={16} style={{color:'#818cf8'}}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{color:T.text}}>{g.name}</p>
                          <p className="text-xs" style={{color:T.textSub}}>Group</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={()=>openEditGrp(g)} className="p-2 rounded-xl"
                            style={{background:dark?'rgba(129,140,248,0.1)':'rgba(79,70,229,0.08)',color:'#818cf8'}}>
                            <Edit3 size={14}/>
                          </button>
                          <button onClick={()=>deleteGrp(g.id)} className="p-2 rounded-xl"
                            style={{background:T.deleteBtn,color:T.deleteTxt}}>
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab==='profile'&&(
              <div className="px-4 pb-32">
                <div className="flex flex-col items-center py-8 gap-3">
                  <input ref={avatarRef} type="file" accept="image/*" onChange={onAvatarChange} className="hidden"/>
                  <div className="relative" onClick={()=>avatarRef.current?.click()} style={{cursor:'pointer'}}>
                    <div className="w-24 h-24 rounded-3xl overflow-hidden flex items-center justify-center"
                      style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
                      {profile?.avatar_url?<img src={profile.avatar_url} className="w-full h-full object-cover" alt=""/>:<User size={36} className="text-white"/>}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{background:'#4f46e5'}}><Camera size={14} className="text-white"/></div>
                  </div>
                  <div className="text-center mt-1">
                    <h2 className="text-xl font-bold" style={{fontFamily:'Syne,sans-serif',color:T.text}}>
                      {profile?.full_name||profile?.username?.split('@')[0]||'You'}
                    </h2>
                    <p className="text-sm mt-0.5" style={{color:T.textSub}}>{profile?.username}</p>
                    {isAdmin&&<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mt-2"
                      style={{background:'rgba(129,140,248,0.15)',color:'#818cf8'}}><ShieldCheck size={11}/> Admin</span>}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold px-1 uppercase tracking-widest" style={{color:T.textSub}}>Account</p>
                  <div className="p-4 rounded-2xl t" style={card}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs" style={{color:T.textSub}}>Display Name</p>
                      <button onClick={()=>{setEditingName(v=>!v);setNewFullName(profile?.full_name||'');}}
                        className="p-1.5 rounded-lg" style={{background:'rgba(129,140,248,0.1)',color:'#818cf8'}}>
                        <Edit3 size={13}/>
                      </button>
                    </div>
                    {editingName?(
                      <div className="flex gap-2 mt-2">
                        <input value={newFullName} onChange={e=>setNewFullName(e.target.value)}
                          placeholder="Your name…" className="flex-1 px-3 py-2 rounded-xl text-sm t"
                          style={{background:T.inputBg,border:'1px solid rgba(129,140,248,0.3)',color:T.text}}/>
                        <button onClick={saveName} className="px-4 py-2 rounded-xl text-sm font-semibold"
                          style={{background:'#4f46e5',color:'#fff'}}>Save</button>
                      </div>
                    ):(
                      <p className="text-sm font-medium" style={{color:T.text}}>{profile?.full_name||'Not set'}</p>
                    )}
                  </div>
                  <div className="p-4 rounded-2xl t" style={card}>
                    <p className="text-xs mb-1" style={{color:T.textSub}}>Email</p>
                    <p className="text-sm font-medium" style={{color:T.text}}>{currentUser?.email}</p>
                  </div>
                  <p className="text-xs font-semibold px-1 uppercase tracking-widest mt-4 mb-2" style={{color:T.textSub}}>Network</p>
                  <div className="flex items-center justify-between p-4 rounded-2xl t" style={card}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:realInternetCheck?"rgba(129,140,248,0.1)":"rgba(100,116,139,0.1)"}}>
                        {isOnline?<Wifi size={18} style={{color:realInternetCheck?"#818cf8":"#64748b"}}/>:<WifiOff size={18} style={{color:"#f87171"}}/>}
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{color:T.text}}>Real Internet Check</p>
                        <p className="text-xs" style={{color:T.textSub}}>{isOnline?"آنلاین":"آفلاین"} · {realInternetCheck?"چک سفارشی":"navigator.onLine"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {realInternetCheck&&<button onClick={checkReal} disabled={checking} className="p-2 rounded-xl" style={{background:"rgba(129,140,248,0.1)",color:"#818cf8"}}><RefreshCw size={13} className={checking?"animate-spin":""}/></button>}
                      <Toggle on={realInternetCheck} onToggle={toggleRealCheck}/>
                    </div>
                  </div>
                  <button onClick={()=>supabase.auth.signOut().then(()=>router.push('/login'))}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl mt-2 font-semibold text-sm t"
                    style={{background:T.signOutBg,border:`1px solid ${T.signOutBdr}`,color:T.signOutTxt}}>
                    <LogOut size={16}/> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Nav */}
          <div className="shrink-0 px-4 pb-8 pt-2 t" style={{background:T.bg,borderTop:`1px solid ${T.border}`}}>
            <div className="flex items-center justify-around py-2 px-2 rounded-3xl t"
              style={{background:T.navBg,border:`1px solid ${T.navBorder}`}}>
              {(['chat','settings','profile'] as Tab[])
                .filter(t=>t!=='settings'||isAdmin)
                .map(t=>(
                  <button key={t} onClick={()=>setActiveTab(t)} className="tab-btn flex flex-col items-center gap-1 px-6 py-2 rounded-2xl"
                    style={{background:activeTab===t?T.activeTab:'transparent'}}>
                    <div className="relative">
                      {t==='chat'?<MessageSquare size={22} style={{color:activeTab===t?'#818cf8':T.iconInactive}}/>
                        :t==='settings'?<Settings size={22} style={{color:activeTab===t?'#818cf8':T.iconInactive}}/>
                        :<UserCircle size={22} style={{color:activeTab===t?'#818cf8':T.iconInactive}}/>}
                      {t==='chat'&&totalUnread>0&&(
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                          style={{background:'#ef4444',color:'#fff'}}>{totalUnread}</div>
                      )}
                    </div>
                    <span className="text-[10px] font-medium capitalize" style={{color:activeTab===t?'#818cf8':T.iconInactive}}>{t}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ MODALS ══════════════════════════════════════ */}

      {/* Add Member */}
      {showAddMember&&(
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{background:'rgba(0,0,0,0.7)',backdropFilter:'blur(8px)'}}>
          <div className="w-full max-w-md p-6 pb-12 rounded-t-3xl t" style={{background:T.modalBg,border:`1px solid ${T.border}`}}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{fontFamily:'Syne,sans-serif',color:T.text}}>Add Member</h2>
              <button onClick={()=>setShowAddMember(false)} className="p-2 rounded-xl"
                style={{background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',color:T.textSub}}><X size={18}/></button>
            </div>
            <div className="space-y-3">
              <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} type="email" placeholder="Email address"
                className="w-full px-4 py-3 rounded-2xl text-sm t"
                style={{background:T.inputBg,border:`1px solid ${T.border2}`,color:T.text}}/>
              <input value={newPass} onChange={e=>setNewPass(e.target.value)} type="password" placeholder="Password"
                className="w-full px-4 py-3 rounded-2xl text-sm t"
                style={{background:T.inputBg,border:`1px solid ${T.border2}`,color:T.text}}/>
            </div>
            <button onClick={addMember} className="w-full mt-5 py-4 rounded-2xl font-semibold text-sm"
              style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)',color:'#fff'}}>Create Account</button>
          </div>
        </div>
      )}

      {/* Group edit / new */}
      {editGrp!==null&&(
        <div className="fixed inset-0 z-50 flex flex-col t" style={{background:T.bg}}>
          <div className="flex items-center gap-3 px-4 shrink-0 t"
            style={{background:T.header,borderBottom:`1px solid ${T.border}`,paddingTop:'3rem',paddingBottom:'1rem'}}>
            <button onClick={()=>setEditGrp(null)} className="p-2 rounded-xl"
              style={{background:dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}}>
              <ArrowLeft size={20} style={{color:'#818cf8'}}/>
            </button>
            <h2 className="text-lg font-bold flex-1" style={{fontFamily:'Syne,sans-serif',color:T.text}}>
              {editGrp.id?'Edit Group':'New Group'}
            </h2>
            <button onClick={editGrp.id?saveGrp:createGrp}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)',color:'#fff'}}>
              {editGrp.id?'Save':'Create'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div>
              <p className="text-xs font-semibold px-1 mb-2 uppercase tracking-widest" style={{color:T.textSub}}>Group Name</p>
              <input value={editGrpName} onChange={e=>setEditGrpName(e.target.value)}
                placeholder="Enter group name…" className="w-full px-4 py-3 rounded-2xl text-sm t"
                style={{background:T.inputBg,border:`1px solid ${T.border2}`,color:T.text}}/>
            </div>
            <div>
              <p className="text-xs font-semibold px-1 mb-2 uppercase tracking-widest" style={{color:T.textSub}}>
                Members <span style={{color:T.textMuted}}>({grpMembers.length} selected)</span>
              </p>
              <div className="space-y-2">
                {users.map((u:any)=>{
                  const sel=grpMembers.includes(u.id);
                  return (
                    <div key={u.id}
                      onClick={()=>setGrpMembers(prev=>sel?prev.filter(id=>id!==u.id):[...prev,u.id])}
                      className="ci flex items-center gap-3 p-3 rounded-2xl t" style={card}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0 t"
                        style={{background:dark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)'}}>
                        {u.avatar_url?<img src={u.avatar_url} className="w-full h-full object-cover" alt=""/>:<User size={16} style={{color:T.textSub}}/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{color:T.text}}>{u.full_name||u.username?.split('@')[0]}</p>
                        <p className="text-xs truncate" style={{color:T.textSub}}>{u.username}</p>
                      </div>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{background:sel?'#4f46e5':T.toggleOff,transition:'background 0.2s'}}>
                        {sel&&<Check size={13} style={{color:'#fff'}}/>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User edit */}
      {editUsr&&(
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{background:'rgba(0,0,0,0.7)',backdropFilter:'blur(8px)'}}>
          <div className="w-full max-w-md p-6 pb-12 rounded-t-3xl t" style={{background:T.modalBg,border:`1px solid ${T.border}`}}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{fontFamily:'Syne,sans-serif',color:T.text}}>Edit Member</h2>
              <button onClick={()=>setEditUsr(null)} className="p-2 rounded-xl"
                style={{background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',color:T.textSub}}><X size={18}/></button>
            </div>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center shrink-0"
                style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
                {editUsr.avatar_url?<img src={editUsr.avatar_url} className="w-full h-full object-cover" alt=""/>:<User size={22} className="text-white"/>}
              </div>
              <div><p className="text-sm font-semibold" style={{color:T.text}}>{editUsr.username}</p>
                <p className="text-xs" style={{color:T.textSub}}>Member</p></div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium mb-1.5" style={{color:T.textSub}}>Display Name</p>
                <input value={editUsrName} onChange={e=>setEditUsrName(e.target.value)}
                  placeholder="Display name…" className="w-full px-4 py-3 rounded-2xl text-sm t"
                  style={{background:T.inputBg,border:`1px solid ${T.border2}`,color:T.text}}/>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl t" style={card}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'rgba(251,191,36,0.1)'}}>
                    <Crown size={16} style={{color:'#fbbf24'}}/>
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{color:T.text}}>Admin</p>
                    <p className="text-xs" style={{color:T.textSub}}>Full settings access</p>
                  </div>
                </div>
                <Toggle on={editUsrAdmin} onToggle={()=>setEditUsrAdmin(v=>!v)} color="#f59e0b"/>
              </div>
            </div>
            <button onClick={saveUsr} className="w-full mt-5 py-4 rounded-2xl font-semibold text-sm"
              style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)',color:'#fff'}}>Save Changes</button>
          </div>
        </div>
      )}
    </div>
  );
}