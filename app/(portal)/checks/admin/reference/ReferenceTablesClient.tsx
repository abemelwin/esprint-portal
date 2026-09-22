'use client';
/**
 * ReferenceTablesClient — interactive reference data editor.
 * Ported from esprint-check-monitoring/app/admin/reference/page.tsx.
 * Calls /api/reference/[table] for upsert/rename/delete.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/modules/checks/components/ConfirmDialog';
import { useToast } from '@/modules/checks/components/Toast';
import type { BankRow, BranchRow } from '@/modules/checks/lib/database.types';

interface Props {
  initialSubsidiaries:  string[];
  initialAeList:        string[];
  initialBanks:         BankRow[];
  initialBranches:      BranchRow[];
  checksPerSubsidiary:  Record<string, number>;
  checksPerAe:          Record<string, number>;
  clientsPerAe:         Record<string, number>;
  checksPerBank:        Record<string, number>;
  checksPerBranch:      Record<string, number>;
  clientsPerBranch:     Record<string, number>;
  checksCount:          number;
}

type Section = 'subsidiaries' | 'ae_list' | 'banks' | 'branches';
interface EditState { key: string; value: string; value2?: string; sub?: string }
interface ConfirmState { open: boolean; title: string; message: string; onConfirm: () => void }
const CLOSED: ConfirmState = { open:false, title:'', message:'', onConfirm:()=>{} };

export function ReferenceTablesClient({
  initialSubsidiaries, initialAeList, initialBanks, initialBranches,
  checksPerSubsidiary, checksPerAe, clientsPerAe, checksPerBank,
  checksPerBranch, clientsPerBranch,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();

  const [subsidiaries, setSubsidiaries] = useState(initialSubsidiaries);
  const [aeList,       setAeList]       = useState(initialAeList);
  const [banks,        setBanks]        = useState(initialBanks);
  const [branches,     setBranches]     = useState(initialBranches);

  const [section,  setSection]  = useState<Section>('subsidiaries');
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState('');
  const [editing,  setEditing]  = useState<EditState | null>(null);
  const [confirm,  setConfirm]  = useState<ConfirmState>(CLOSED);

  const [newItem, setNewItem]   = useState('');
  const [newCode, setNewCode]   = useState('');
  const [newName, setNewName]   = useState('');
  const [newSub,  setNewSub]    = useState('');

  // Local usage counters (start from server-rendered counts)
  const [cpSub,  setCpSub]  = useState(checksPerSubsidiary);
  const [cpAe,   setCpAe]   = useState(checksPerAe);
  const [clAe,   setClAe]   = useState(clientsPerAe);
  const [cpBank, setCpBank] = useState(checksPerBank);
  const [cpBr,   setCpBr]   = useState(checksPerBranch);
  const [clBr,   setClBr]   = useState(clientsPerBranch);

  function askConfirm(title: string, message: string, onConfirm: () => void) {
    setConfirm({ open:true, title, message, onConfirm });
  }

  async function apiFetch(table: string, method: string, body: object) {
    const res  = await fetch(`/api/reference/${table}`, {
      method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? 'Save failed');
    return json;
  }

  async function refUpsert(table: string, row: object) {
    setSaving(true);
    try {
      await apiFetch(table, 'POST', { op:'upsert', row });
      showToast('Saved', 'success');
      router.refresh();
    } catch (err) { showToast((err as Error).message ?? 'Error', 'error'); }
    finally { setSaving(false); setEditing(null); }
  }

  async function refRename(table: string, oldPk: string, row: object, cascadeChecks?: object, cascadeClients?: object) {
    setSaving(true);
    try {
      const json = await apiFetch(table, 'POST', { op:'rename', oldPk, row, cascadeChecks, cascadeClients });
      showToast(json.merged ? 'Merged and deleted' : 'Saved', 'success');
      router.refresh();
    } catch (err) { showToast((err as Error).message ?? 'Error', 'error'); }
    finally { setSaving(false); setEditing(null); }
  }

  async function refDelete(table: string, pk: string) {
    setSaving(true);
    try {
      await apiFetch(table, 'DELETE', { pk });
      showToast('Removed', 'success');
      setSearch('');
      router.refresh();
    } catch (err) { showToast((err as Error).message ?? 'Error', 'error'); }
    finally { setSaving(false); }
  }

  function switchSection(s: Section) { setSection(s); setNewItem(''); setNewCode(''); setNewName(''); setNewSub(''); setEditing(null); setSearch(''); }

  // ── Subsidiaries ───────────────────────────────────────────────────────────
  async function addSubsidiary() {
    const v = newItem.trim().toUpperCase(); if (!v) return;
    if (subsidiaries.includes(v)) { showToast('Already exists','warn'); return; }
    await refUpsert('subsidiaries', { name:v });
    setSubsidiaries(p => [...p, v]); setNewItem('');
  }
  async function saveSubsidiary(oldName: string, newName_: string) {
    const n = newName_.trim().toUpperCase(); if (!n) return;
    if (n === oldName) { setEditing(null); return; }
    const doRename = () => refRename('subsidiaries', oldName, { name:n }, { field:'subsidiary', oldValue:oldName, newValue:n });
    if (subsidiaries.includes(n)) {
      askConfirm('Merge Subsidiary', `"${n}" already exists. Merge "${oldName}" into "${n}"?`, doRename);
      return;
    }
    await doRename();
  }
  async function removeSubsidiary(s: string) {
    if ((cpSub[s]??0) > 0) { showToast(`Cannot delete — ${cpSub[s]} check(s) reference this subsidiary.`,'error'); return; }
    askConfirm('Remove Subsidiary', `Remove subsidiary "${s}"?`, async () => {
      await refDelete('subsidiaries', s);
      setSubsidiaries(p => p.filter(x => x !== s));
    });
  }

  // ── AE List ────────────────────────────────────────────────────────────────
  async function addAE() {
    const v = newItem.trim().toUpperCase(); if (!v) return;
    if (aeList.includes(v)) { showToast('Already exists','warn'); return; }
    await refUpsert('ae_list', { name:v });
    setAeList(p => [...p, v]); setNewItem('');
  }
  async function saveAE(oldName: string, newName_: string) {
    const n = newName_.trim().toUpperCase(); if (!n) return;
    if (n === oldName) { setEditing(null); return; }
    const doRename = () => refRename('ae_list', oldName, { name:n }, { field:'ae', oldValue:oldName, newValue:n }, { field:'ae', oldValue:oldName, newValue:n });
    if (aeList.includes(n)) {
      askConfirm('Merge AE', `"${n}" already exists. Merge "${oldName}" into "${n}"?`, doRename);
      return;
    }
    await doRename();
  }
  async function removeAE(ae: string) {
    const c = (cpAe[ae]??0), cl = (clAe[ae]??0);
    if (c||cl) { showToast(`Cannot delete — ${c} check(s) and ${cl} client(s) reference this AE.`,'error'); return; }
    askConfirm('Remove AE', `Remove AE "${ae}"?`, async () => {
      await refDelete('ae_list', ae);
      setAeList(p => p.filter(x => x !== ae));
    });
  }

  // ── Banks ──────────────────────────────────────────────────────────────────
  async function addBank() {
    const code = newCode.trim().toUpperCase(); const name_ = newName.trim();
    if (!code||!name_) { showToast('Code and name required','warn'); return; }
    if (banks.find(b=>b.code===code)) { showToast('Code already exists','warn'); return; }
    await refUpsert('banks', { code, name:name_ });
    setBanks(p => [...p, { code, name:name_ }]); setNewCode(''); setNewName('');
  }
  async function saveBank(oldCode: string, newCode_: string, newFullName: string) {
    const nc = newCode_.trim().toUpperCase(); const n = newFullName.trim();
    if (!nc||!n) { showToast('Code and name required','warn'); return; }
    if (nc !== oldCode && banks.find(b=>b.code===nc)) { showToast('Bank code already exists','warn'); return; }
    if (nc === oldCode) await refUpsert('banks', { code:nc, name:n });
    else await refRename('banks', oldCode, { code:nc, name:n }, { field:'bank', oldValue:oldCode, newValue:nc });
  }
  async function removeBank(code: string) {
    if ((cpBank[code]??0)>0) { showToast(`Cannot delete — ${cpBank[code]} check(s) use this bank.`,'error'); return; }
    askConfirm('Remove Bank', `Remove bank "${code}"?`, async () => {
      await refDelete('banks', code);
      setBanks(p => p.filter(b => b.code !== code));
    });
  }

  // ── Branches ───────────────────────────────────────────────────────────────
  async function addBranch() {
    const id = newCode.trim().toUpperCase(); const nm = newName.trim().toUpperCase(); const sub = newSub.trim().toUpperCase()||null;
    if (!id||!nm) { showToast('ID and name required','warn'); return; }
    if (!/^[A-Za-z0-9]{1,6}$/.test(id)) { showToast('Code must be 1–6 letters/digits','warn'); return; }
    if (branches.find(b=>b.id===id)) { showToast('ID already exists','warn'); return; }
    await refUpsert('branches', { id, name:nm, subsidiary:sub });
    setBranches(p => [...p, { id, name:nm, subsidiary:sub }]); setNewCode(''); setNewName(''); setNewSub('');
  }
  async function saveBranch(id: string, newFullName: string, newSubsidiary: string) {
    const n = newFullName.trim().toUpperCase(); const sub = newSubsidiary.trim().toUpperCase()||null;
    if (!n) return;
    await refUpsert('branches', { id, name:n, subsidiary:sub });
  }
  async function removeBranch(id: string) {
    const c = (cpBr[id]??0), cl = (clBr[id]??0);
    if (c||cl) { showToast(`Cannot delete — referenced by ${c} check(s) and ${cl} client(s).`,'error'); return; }
    askConfirm('Remove Branch', `Remove branch "${id}"?`, async () => {
      await refDelete('branches', id);
      setBranches(p => p.filter(b => b.id !== id));
    });
  }

  const inp = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 placeholder:text-gray-400';
  const addBtn = 'px-4 py-2 rounded-xl text-sm font-bold text-white bg-[#1e3a8a] hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap';
  const TABS: { key:Section; label:string; count:number }[] = [
    { key:'subsidiaries', label:'Subsidiaries', count:subsidiaries.length },
    { key:'ae_list',      label:'AE List',      count:aeList.length },
    { key:'banks',        label:'Banks',        count:banks.length },
    { key:'branches',     label:'Branches',     count:branches.length },
  ];

  return (
    <>
      <div className="animate-fade-in space-y-5 max-w-3xl p-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reference Data</h1>
          <p className="text-sm text-gray-500">Manage lookup lists used across the system.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit flex-wrap">
          {TABS.map(t => (
            <button key={t.key} onClick={() => switchSection(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 ${section===t.key?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
              <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          {/* Subsidiaries */}
          {section==='subsidiaries' && (
            <>
              <div className="px-5 py-4 border-b border-slate-100 space-y-2">
                <p className="text-xs text-gray-500">Subsidiaries tag checks (e.g. ESPMI, ESCGI, APSI, ESPII). Renaming propagates to all referencing checks.</p>
                <div className="flex gap-2">
                  <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSubsidiary()} className={inp+' flex-1'} placeholder="New subsidiary code (e.g. ESPMI)" />
                  <button onClick={addSubsidiary} disabled={saving||!newItem.trim()} className={addBtn}>+ Add</button>
                </div>
                <input value={search} onChange={e=>setSearch(e.target.value)} className={inp+' w-full'} placeholder="Search subsidiaries…" />
              </div>
              <ul className="divide-y divide-gray-100">
                {subsidiaries.length===0 && <li className="px-5 py-4 text-sm text-gray-400 italic">No subsidiaries yet</li>}
                {subsidiaries.filter(s=>!search||s.toLowerCase().includes(search.toLowerCase())).map(s=>(
                  <li key={s} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 gap-3">
                    {editing?.key===s ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input autoFocus value={editing.value} onChange={e=>setEditing(ed=>ed?{...ed,value:e.target.value}:ed)}
                          onKeyDown={e=>{if(e.key==='Enter')saveSubsidiary(s,editing.value);if(e.key==='Escape')setEditing(null);}}
                          className={inp+' flex-1'} />
                        <button onClick={()=>saveSubsidiary(s,editing.value)} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#1e3a8a] disabled:opacity-50">Save</button>
                        <button onClick={()=>setEditing(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-gray-800 font-mono">{s}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{cpSub[s]??0} checks</span>
                          <button onClick={()=>setEditing({key:s,value:s})} className="text-xs text-blue-600 hover:text-blue-800 font-semibold">Edit</button>
                          <button onClick={()=>removeSubsidiary(s)} className="text-xs text-red-500 hover:text-red-700 font-semibold">Remove</button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* AE List */}
          {section==='ae_list' && (
            <>
              <div className="px-5 py-4 border-b border-slate-100 space-y-2">
                <p className="text-xs text-gray-500">AE codes. Renaming propagates to all referencing checks and clients.</p>
                <div className="flex gap-2">
                  <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addAE()} className={inp+' flex-1'} placeholder="New AE code (e.g. DELA CRUZ)" />
                  <button onClick={addAE} disabled={saving||!newItem.trim()} className={addBtn}>+ Add</button>
                </div>
                <input value={search} onChange={e=>setSearch(e.target.value)} className={inp+' w-full'} placeholder="Search AE…" />
              </div>
              <ul className="divide-y divide-gray-100">
                {aeList.length===0 && <li className="px-5 py-4 text-sm text-gray-400 italic">No AEs yet</li>}
                {aeList.filter(ae=>!search||ae.toLowerCase().includes(search.toLowerCase())).map(ae=>(
                  <li key={ae} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 gap-3">
                    {editing?.key===ae ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input autoFocus value={editing.value} onChange={e=>setEditing(ed=>ed?{...ed,value:e.target.value}:ed)}
                          onKeyDown={e=>{if(e.key==='Enter')saveAE(ae,editing.value);if(e.key==='Escape')setEditing(null);}}
                          className={inp+' flex-1'} />
                        <button onClick={()=>saveAE(ae,editing.value)} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#1e3a8a] disabled:opacity-50">Save</button>
                        <button onClick={()=>setEditing(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-gray-800 font-mono">{ae}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{cpAe[ae]??0}C · {clAe[ae]??0}Cl</span>
                          <button onClick={()=>setEditing({key:ae,value:ae})} className="text-xs text-blue-600 hover:text-blue-800 font-semibold">Edit</button>
                          <button onClick={()=>removeAE(ae)} className="text-xs text-red-500 hover:text-red-700 font-semibold">Remove</button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Banks */}
          {section==='banks' && (
            <>
              <div className="px-5 py-4 border-b border-slate-100 space-y-2">
                <p className="text-xs text-gray-500">Code = short identifier (e.g. BDO). Name = full name in dropdown.</p>
                <div className="flex gap-2 flex-wrap">
                  <input value={newCode} onChange={e=>setNewCode(e.target.value)} className={inp} placeholder="Code (e.g. BDO)" style={{width:110}} />
                  <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addBank()} className={inp+' flex-1 min-w-[200px]'} placeholder="Full name (e.g. BDO – Banco De Oro)" />
                  <button onClick={addBank} disabled={saving||!newCode.trim()||!newName.trim()} className={addBtn}>+ Add</button>
                </div>
                <input value={search} onChange={e=>setSearch(e.target.value)} className={inp+' w-full'} placeholder="Search banks…" />
              </div>
              <ul className="divide-y divide-gray-100">
                {banks.length===0 && <li className="px-5 py-4 text-sm text-gray-400 italic">No banks yet</li>}
                {[...banks].sort((a,b)=>a.code.localeCompare(b.code)).filter(b=>!search||b.code.toLowerCase().includes(search.toLowerCase())||b.name.toLowerCase().includes(search.toLowerCase())).map(b=>(
                  <li key={b.code} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 gap-3">
                    {editing?.key===b.code ? (
                      <div className="flex flex-1 items-center gap-2 flex-wrap">
                        <input autoFocus value={editing.value2??''} onChange={e=>setEditing(ed=>ed?{...ed,value2:e.target.value.toUpperCase()}:ed)} className={inp+' font-mono font-bold'} style={{width:100}} placeholder="Code" maxLength={10} />
                        <input value={editing.value} onChange={e=>setEditing(ed=>ed?{...ed,value:e.target.value}:ed)} onKeyDown={e=>{if(e.key==='Enter')saveBank(b.code,editing.value2??b.code,editing.value);if(e.key==='Escape')setEditing(null);}} className={inp+' flex-1 min-w-[180px]'} placeholder="Full bank name" />
                        <button onClick={()=>saveBank(b.code,editing.value2??b.code,editing.value)} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#1e3a8a] disabled:opacity-50">Save</button>
                        <button onClick={()=>setEditing(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <div><span className="text-sm font-semibold text-gray-800 font-mono">{b.code}</span><span className="text-xs text-gray-500 ml-2">{b.name}</span></div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{cpBank[b.code]??0} checks</span>
                          <button onClick={()=>setEditing({key:b.code,value:b.name,value2:b.code})} className="text-xs text-blue-600 hover:text-blue-800 font-semibold">Edit</button>
                          <button onClick={()=>removeBank(b.code)} className="text-xs text-red-500 hover:text-red-700 font-semibold">Remove</button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Branches */}
          {section==='branches' && (
            <>
              <div className="px-5 py-4 border-b border-slate-100 space-y-2">
                <p className="text-xs text-gray-500">Branch IDs are 1–6 letter codes (e.g. MKT). ID cannot be changed after creation.</p>
                <div className="flex gap-2 flex-wrap">
                  <input value={newCode} onChange={e=>setNewCode(e.target.value)} className={inp} placeholder="ID (e.g. MKT)" style={{width:90}} maxLength={6} />
                  <input value={newName} onChange={e=>setNewName(e.target.value)} className={inp+' flex-1 min-w-[140px]'} placeholder="Name (e.g. MAKATI)" />
                  <select value={newSub} onChange={e=>setNewSub(e.target.value)} className={inp} style={{minWidth:120}}>
                    <option value="">— Subsidiary —</option>
                    {subsidiaries.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={addBranch} disabled={saving||!newCode.trim()||!newName.trim()} className={addBtn}>+ Add</button>
                </div>
                <input value={search} onChange={e=>setSearch(e.target.value)} className={inp+' w-full'} placeholder="Search branches…" />
              </div>
              <ul className="divide-y divide-gray-100">
                {branches.length===0 && <li className="px-5 py-4 text-sm text-gray-400 italic">No branches yet</li>}
                {[...branches].sort((a,b)=>a.name.localeCompare(b.name)).filter(b=>!search||b.id.toLowerCase().includes(search.toLowerCase())||b.name.toLowerCase().includes(search.toLowerCase())).map(b=>(
                  <li key={b.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 gap-3">
                    {editing?.key===b.id ? (
                      <div className="flex flex-1 items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-bold text-gray-700 shrink-0">{b.id}</span>
                        <input autoFocus value={editing.value} onChange={e=>setEditing(ed=>ed?{...ed,value:e.target.value}:ed)} onKeyDown={e=>{if(e.key==='Escape')setEditing(null);}} className={inp+' flex-1 min-w-[130px]'} placeholder="Branch name" />
                        <select value={editing.sub??''} onChange={e=>setEditing(ed=>ed?{...ed,sub:e.target.value}:ed)} className={inp}>
                          <option value="">— Subsidiary —</option>
                          {subsidiaries.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={()=>saveBranch(b.id,editing.value,editing.sub??'')} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#1e3a8a] disabled:opacity-50">Save</button>
                        <button onClick={()=>setEditing(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-semibold text-gray-800">{b.id}</span>
                          <span className="text-xs text-gray-600">{b.name}</span>
                          {b.subsidiary && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800">{b.subsidiary}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{cpBr[b.id]??0}C · {clBr[b.id]??0}Cl</span>
                          <button onClick={()=>setEditing({key:b.id,value:b.name,sub:b.subsidiary??''})} className="text-xs text-blue-600 hover:text-blue-800 font-semibold">Edit</button>
                          <button onClick={()=>removeBranch(b.id)} className="text-xs text-red-500 hover:text-red-700 font-semibold">Remove</button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog open={confirm.open} title={confirm.title} message={confirm.message} confirmText="Confirm" danger
        onConfirm={()=>{ setConfirm(CLOSED); confirm.onConfirm(); }} onCancel={()=>setConfirm(CLOSED)} />
    </>
  );
}
