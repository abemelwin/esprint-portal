'use client';
/**
 * ConfirmDialog — reusable confirmation popup.
 * Direct port from esprint-check-monitoring/components/ConfirmDialog.tsx.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open:         boolean;
  title:        string;
  message:      string;
  confirmText?: string;
  cancelText?:  string;
  danger?:      boolean;
  onConfirm:    () => void;
  onCancel:     () => void;
}

export default function ConfirmDialog({
  open, title, message,
  confirmText = 'Confirm', cancelText = 'Cancel',
  danger = true, onConfirm, onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !open) return null;

  return createPortal(
    <div style={{ position:'fixed', inset:0, zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
      onClick={onCancel}>
      <div style={{ position:'absolute', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(2px)' }} />
      <div style={{ position:'relative', background:'#fff', borderRadius:16, boxShadow:'0 20px 60px rgba(0,0,0,0.25)', width:'100%', maxWidth:400, padding:'28px 28px 24px' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <div style={{ width:40, height:40, borderRadius:'50%', flexShrink:0, background: danger?'#fef2f2':'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
            {danger ? '🗑️' : 'ℹ️'}
          </div>
          <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:'#111827' }}>{title}</h2>
        </div>
        <p style={{ margin:'0 0 24px', fontSize:14, color:'#4b5563', lineHeight:1.6 }}>{message}</p>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onCancel} style={{ padding:'9px 20px', borderRadius:8, fontSize:13, fontWeight:600, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#374151' }}>{cancelText}</button>
          <button onClick={onConfirm} style={{ padding:'9px 20px', borderRadius:8, fontSize:13, fontWeight:700, border:'none', cursor:'pointer', color:'#fff', background: danger?'#dc2626':'#1e3a8a' }}>{confirmText}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
