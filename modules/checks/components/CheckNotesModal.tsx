'use client';
/**
 * CheckNotesModal — Phase 5 placeholder.
 * Full implementation coming in Phase 5.
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from './Toast';

interface Note {
  id:            string;
  content:       string;
  createdByName: string;
  createdAt:     string;
}

interface Props {
  checkId:      string;
  checkLabel:   string;
  onClose:      () => void;
  onCountChange: (id: string, count: number) => void;
}

function fmtDt(ts: string) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-PH', { timeZone:'Asia/Manila', year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function CheckNotesModal({ checkId, checkLabel, onClose, onCountChange }: Props) {
  const { showToast } = useToast();
  const [notes, setNotes]   = useState<Note[]>([]);
  const [text, setText]     = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch(`/api/checks/${checkId}/notes`)
      .then(r => r.json())
      .then(j => { if (j.notes) setNotes(j.notes); })
      .finally(() => setLoading(false));
  }, [checkId]);

  async function addNote() {
    if (!text.trim()) return;
    setSaving(true);
    const res  = await fetch(`/api/checks/${checkId}/notes`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ content:text.trim() }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.ok) {
      setNotes(json.notes ?? []);
      onCountChange(checkId, (json.notes ?? []).length);
      setText('');
      showToast('Note added', 'success');
    } else {
      showToast(json.error ?? 'Failed to add note', 'error');
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div style={{ position:'fixed',inset:0,zIndex:99999,background:'rgba(15,23,42,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}
      onClick={onClose}>
      <div style={{ background:'#fff',borderRadius:16,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',width:'100%',maxWidth:480,maxHeight:'80vh',display:'flex',flexDirection:'column' }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ padding:'14px 20px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div>
            <h2 style={{ margin:0,fontSize:14,fontWeight:700,color:'#111827' }}>📋 Notes</h2>
            <p style={{ margin:0,fontSize:11,color:'#9ca3af' }}>{checkLabel}</p>
          </div>
          <button onClick={onClose} style={{ background:'#f1f5f9',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:18,color:'#6b7280',display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
        </div>
        <div style={{ flex:1,overflowY:'auto',padding:'12px 20px' }}>
          {loading && <p style={{ fontSize:12,color:'#9ca3af',textAlign:'center',padding:16 }}>Loading…</p>}
          {!loading && notes.length===0 && <p style={{ fontSize:12,color:'#9ca3af',textAlign:'center',padding:16 }}>No notes yet. Add one below.</p>}
          {notes.map(n=>(
            <div key={n.id} style={{ padding:'10px 14px',background:'#f8fafc',borderRadius:10,marginBottom:8,border:'1px solid #f1f5f9' }}>
              <p style={{ margin:0,fontSize:13,color:'#1f2937',lineHeight:1.6 }}>{n.content}</p>
              <p style={{ margin:'5px 0 0',fontSize:11,color:'#9ca3af' }}>{n.createdByName} · {fmtDt(n.createdAt)}</p>
            </div>
          ))}
        </div>
        <div style={{ padding:'12px 20px',borderTop:'1px solid #f1f5f9' }}>
          <textarea value={text} onChange={e=>setText(e.target.value)} rows={2} placeholder="Write a note…"
            style={{ width:'100%',boxSizing:'border-box',border:'1px solid #d1d5db',borderRadius:10,padding:'8px 12px',fontSize:13,resize:'vertical',fontFamily:'inherit',outline:'none' }}
            onKeyDown={e=>{ if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)) addNote(); }} />
          <div style={{ display:'flex',justifyContent:'flex-end',gap:8,marginTop:8 }}>
            <button onClick={onClose} style={{ padding:'7px 16px',borderRadius:8,fontSize:13,fontWeight:600,border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',color:'#374151' }}>Close</button>
            <button onClick={addNote} disabled={saving||!text.trim()}
              style={{ padding:'7px 18px',borderRadius:8,fontSize:13,fontWeight:700,border:'none',background:text.trim()?'#1e3a8a':'#e5e7eb',color:text.trim()?'#fff':'#9ca3af',cursor:text.trim()?'pointer':'not-allowed' }}>
              {saving?'Saving…':'Add Note'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
