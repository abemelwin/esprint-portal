"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { CatalogMachine } from "../types";
import { formatCurrency } from "../lib/calculator";

// Matches orig CLOSING_DOC_TABS
type DocType = "terms-conditions" | "delivery-instructions" | "cac" | "pdc" | "pullout";

const DOC_TABS: { key: DocType; label: string }[] = [
  { key: "terms-conditions",    label: "Terms & Conditions" },
  { key: "delivery-instructions", label: "Delivery Instructions" },
  { key: "cac",                 label: "Credit App (CAC)" },
  { key: "pdc",                 label: "Post-Dated Checks" },
  { key: "pullout",             label: "Pull-Out" },
];

export function ClosingDocsClient() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const quoteId       = searchParams.get("id");

  const [docType, setDocType] = useState<DocType>("delivery-instructions");
  const [catalog, setCatalog]     = useState<CatalogMachine[]>([]);
  const [loading, setLoading]     = useState(true);
  const [quoteLoaded, setQuoteLoaded] = useState(false);

  // Closing doc parameters (pre-filled from saved quote, editable by user)
  const [clientName,   setClientName]   = useState("");
  const [company,      setCompany]      = useState("");
  const [address,      setAddress]      = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [aeName,       setAeName]       = useState("Account Executive");
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [serialNo,     setSerialNo]     = useState("");
  const [drNumber,     setDrNumber]     = useState(() => `DR-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${Math.floor(1000+Math.random()*9000)}`);
  const [contractPrice, setContractPrice] = useState(0);
  const [downpayment,  setDownpayment]  = useState(0);
  const [termMonths,   setTermMonths]   = useState(12);
  const [monthlyAmort, setMonthlyAmort] = useState(0);
  const [letterhead,   setLetterhead]   = useState("ES Print Media Inc.");
  const [warrantyMonths, setWarrantyMonths] = useState(12);
  const [printheadWarranty, setPrintheadWarranty] = useState("0 mo.");
  const [quoteDate,    setQuoteDate]    = useState(() => new Date().toISOString().slice(0,10));

  // Load catalog
  useEffect(() => {
    fetch("/api/sales/catalog")
      .then(r => r.json())
      .then(d => {
        if (d.machines) setCatalog(d.machines);
      })
      .finally(() => setLoading(false));
  }, []);

  // Load quote data when quoteId + catalog are available
  useEffect(() => {
    if (!quoteId || quoteLoaded) return;
    async function load() {
      try {
        const res = await fetch(`/api/sales/quotes/${quoteId}`);
        if (!res.ok) return;
        const { quote } = await res.json();
        if (!quote) return;
        setClientName(quote.client_name || "");
        setCompany(quote.company || "");
        setAddress(quote.address || "");
        setContactPerson(quote.client_name || "");
        setAeName(quote.ae_name || "Account Executive");
        if (quote.machine_id) setSelectedMachineId(quote.machine_id);
        if (quote.contract_price != null) setContractPrice(Number(quote.contract_price));
        if (quote.quote_date) setQuoteDate(quote.quote_date.slice(0,10));
        if (quote.letterhead) setLetterhead(quote.letterhead);
        // Compute amortization: (contractPrice - downPayment) / months
        const dp = Number((quote.term_options?.[0]?.down_payment ?? 0));
        const mo = Number((quote.term_options?.[0]?.months ?? 12));
        setDownpayment(dp);
        setTermMonths(mo);
        if (quote.contract_price && mo > 0) {
          setMonthlyAmort(Math.round(((Number(quote.contract_price) - dp) / mo) * 100) / 100);
        }
        setQuoteLoaded(true);
      } catch (err) {
        console.error("Failed to load quote for closing docs:", err);
      }
    }
    load();
  }, [quoteId, quoteLoaded]);

  // When catalog loads and machine is set, copy warranty fields
  const selectedMachine = useMemo(() => catalog.find(m => m.id === selectedMachineId), [catalog, selectedMachineId]);
  useEffect(() => {
    if (!selectedMachine) return;
    setWarrantyMonths(selectedMachine.machine_warranty_months ?? 12);
    setPrintheadWarranty(selectedMachine.printhead_warranty || "0 mo.");
  }, [selectedMachine]);

  const fmtDate = (d: string) => {
    try {
      const parts = d.split("-");
      return new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]))
        .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    } catch { return d; }
  };

  // Shared paper header (letterhead text — images not available in closing docs)
  const PaperHeader = () => (
    <div className="border-b-2 border-[#c0392b] pb-3 mb-5 text-center">
      <div className="text-[13pt] font-black tracking-tight text-[#c0392b] uppercase">{letterhead}</div>
      <div className="text-[8pt] text-[#555]">141-143 West Avenue, Quezon City, Philippines · (02) 8372-8888</div>
    </div>
  );

  // Shared signature line
  const SigLine = ({ name, role }: { name: string; role: string }) => (
    <div className="text-center text-[8pt]">
      <div className="w-36 border-b border-slate-700 mx-auto mb-0.5" />
      <div className="font-bold">{name}</div>
      <div className="text-[7pt] text-slate-500">{role}</div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-40px)] overflow-hidden bg-[#f1f5f9]">
      {/* ── LEFT: Controls ── */}
      <aside className="w-full md:w-[300px] shrink-0 h-full overflow-y-auto bg-white border-r border-slate-200 p-4 print:hidden space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => router.back()} className="text-[11px] text-slate-500 hover:text-[#c0392b]">← Back</button>
            {quoteId && <span className="text-[10px] text-slate-400">Quote loaded</span>}
          </div>
          <h2 className="text-[13px] font-bold text-[#c0392b]">Closing Documents</h2>
          <p className="text-[10px] text-slate-500 mt-0.5">Select a document type to preview and print.</p>
        </div>

        {/* Document type tabs */}
        <div className="space-y-1">
          {DOC_TABS.map(tab => (
            <button key={tab.key} onClick={() => setDocType(tab.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-[12px] font-semibold transition-all ${
                docType === tab.key
                  ? "bg-[#c0392b] text-white shadow-sm"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <hr className="border-slate-200" />

        {/* Editable fields */}
        <div className="space-y-2 text-[11px]">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Document Details</h3>
          {[
            { label: "Client Name",    val: clientName,    set: setClientName },
            { label: "Company",        val: company,       set: setCompany },
            { label: "Address",        val: address,       set: setAddress },
            { label: "Contact Person", val: contactPerson, set: setContactPerson },
            { label: "AE Name",        val: aeName,        set: setAeName },
            { label: "DR Number",      val: drNumber,      set: setDrNumber },
            { label: "Serial Number",  val: serialNo,      set: setSerialNo },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-[10px] font-semibold text-slate-500 mb-[2px]">{f.label}</label>
              <input value={f.val} onChange={e => f.set(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-[11px]" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-[2px]">Contract Price</label>
              <input type="number" value={contractPrice} onChange={e => setContractPrice(Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-[11px]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-[2px]">Downpayment</label>
              <input type="number" value={downpayment} onChange={e => setDownpayment(Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-[11px]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-[2px]">Months</label>
              <input type="number" value={termMonths} onChange={e => { const m=Number(e.target.value)||12; setTermMonths(m); setMonthlyAmort(Math.round(((contractPrice-downpayment)/m)*100)/100); }}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-[11px]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-[2px]">Monthly Amort.</label>
              <input type="number" value={monthlyAmort} onChange={e => setMonthlyAmort(Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-[11px]" />
            </div>
          </div>
          {/* Machine selector */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-[2px]">Machine</label>
            <select value={selectedMachineId} onChange={e => setSelectedMachineId(e.target.value)}
              className="w-full px-2 py-1.5 border border-slate-300 rounded text-[11px] bg-white">
              <option value="">— Select —</option>
              {catalog.map(m => <option key={m.id} value={m.id}>{m.brand} {m.model.slice(0,40)}</option>)}
            </select>
          </div>
        </div>

        <button onClick={() => window.print()}
          className="w-full py-2 bg-[#c0392b] text-white text-[12px] font-bold rounded-lg hover:bg-[#a93226]">
          🖨 Print Document
        </button>
      </aside>

      {/* ── RIGHT: Document Preview ── */}
      <section className="flex-1 h-full overflow-y-auto bg-[#e5e7eb] p-4 flex justify-center items-start">
        <div className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-md rounded p-[14mm] flex flex-col justify-between text-[9pt]">

          {/* ── DELIVERY INSTRUCTIONS ── */}
          {docType === "delivery-instructions" && (
            <div>
              <PaperHeader />
              <div className="text-center mb-4">
                <div className="text-[12pt] font-black uppercase tracking-wide">DELIVERY RECEIPT</div>
                <div className="text-[8pt] text-slate-500">DR No. {drNumber} · {fmtDate(quoteDate)}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4 text-[8pt]">
                <div>
                  <div className="font-bold text-slate-500 text-[7.5pt] uppercase">Delivered To:</div>
                  <div className="font-bold">{clientName || "—"}</div>
                  {company && <div>{company}</div>}
                  {address && <div className="text-slate-500">{address}</div>}
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-500 text-[7.5pt] uppercase">Contract Details:</div>
                  <div>Total: <strong>{formatCurrency(contractPrice)}</strong></div>
                  <div>Paid DP: {formatCurrency(downpayment)}</div>
                </div>
              </div>
              <table className="w-full border-collapse text-[8pt] mb-4">
                <thead>
                  <tr className="bg-[#c0392b] text-white">
                    <th className="p-[3px_6px] text-left">Item / Model</th>
                    <th className="p-[3px_6px] text-left">Serial Number</th>
                    <th className="p-[3px_6px] text-center">Qty</th>
                    <th className="p-[3px_6px] text-left">Condition</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="p-[4px_6px] font-bold">{selectedMachine ? `${selectedMachine.brand} ${selectedMachine.model}` : "—"}</td>
                    <td className="p-[4px_6px] font-mono">{serialNo || "—"}</td>
                    <td className="p-[4px_6px] text-center">1 Unit</td>
                    <td className="p-[4px_6px]">{selectedMachine?.unit_condition || "Brand New"}</td>
                  </tr>
                </tbody>
              </table>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[8pt] text-slate-600 mb-6">
                Received the above items in good order and complete condition along with standard accessories and documentation.
              </div>
              <div className="mt-10 grid grid-cols-2 gap-16">
                <SigLine name={aeName} role="Account Executive, ESPMI" />
                <SigLine name={contactPerson || clientName} role="Client / Authorized Representative" />
              </div>
            </div>
          )}

          {/* ── TERMS & CONDITIONS ── */}
          {docType === "terms-conditions" && (
            <div>
              <PaperHeader />
              <div className="text-center mb-4">
                <div className="text-[12pt] font-black uppercase tracking-wide">EQUIPMENT SALES AGREEMENT</div>
                <div className="text-[8pt] text-slate-500">{fmtDate(quoteDate)}</div>
              </div>
              <p className="mb-3 text-[8pt]">
                This Sales Agreement is entered into between <strong>ES Print Media Inc.</strong> (hereinafter "Seller")
                and <strong>{clientName || "the Buyer"}</strong>{company ? ` (${company})` : ""} (hereinafter "Buyer")
                for the purchase of the following equipment:
              </p>
              <div className="p-3 bg-slate-50 border rounded mb-3 text-[8pt] space-y-0.5">
                <div><strong>Unit:</strong> {selectedMachine ? `${selectedMachine.brand} ${selectedMachine.model}` : "—"}</div>
                <div><strong>Serial No.:</strong> {serialNo || "—"}</div>
                <div><strong>Total Contract Price:</strong> {formatCurrency(contractPrice)}</div>
                <div><strong>Downpayment:</strong> {formatCurrency(downpayment)}</div>
                {termMonths > 0 && contractPrice > downpayment && (
                  <div><strong>Balance:</strong> {formatCurrency(contractPrice - downpayment)} payable in {termMonths} monthly installments of {formatCurrency(monthlyAmort)}</div>
                )}
              </div>
              <div className="space-y-2 text-[7.5pt] text-slate-700 leading-relaxed">
                <p><strong>1. Title & Ownership.</strong> Title to the equipment shall remain with the Seller until the Buyer has paid the entire Contract Price in full.</p>
                <p><strong>2. Delivery.</strong> The Seller shall deliver the equipment to the address specified. Risk of loss transfers to Buyer upon delivery.</p>
                <p><strong>3. Warranty.</strong> The equipment is covered by a {warrantyMonths}-month limited warranty from the date of delivery, subject to proper use and maintenance.</p>
                <p><strong>4. Default.</strong> In case of default, the Seller reserves the right to repossess the equipment without prior notice and demand payment of damages.</p>
                <p><strong>5. Governing Law.</strong> This Agreement shall be governed by the laws of the Republic of the Philippines.</p>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-16">
                <SigLine name={aeName} role="Account Executive, ESPMI" />
                <SigLine name={contactPerson || clientName} role="Buyer / Authorized Representative" />
              </div>
            </div>
          )}

          {/* ── CAC (Credit Application Card) ── */}
          {docType === "cac" && (
            <div>
              <PaperHeader />
              <div className="text-center mb-4">
                <div className="text-[12pt] font-black uppercase tracking-wide">CREDIT APPLICATION CARD</div>
              </div>
              <div className="space-y-3 text-[8pt]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-slate-300 rounded p-2">
                    <div className="text-[7pt] text-slate-500 font-bold uppercase mb-1">Applicant Name</div>
                    <div className="font-bold">{clientName || "—"}</div>
                  </div>
                  <div className="border border-slate-300 rounded p-2">
                    <div className="text-[7pt] text-slate-500 font-bold uppercase mb-1">Company</div>
                    <div>{company || "—"}</div>
                  </div>
                  <div className="border border-slate-300 rounded p-2">
                    <div className="text-[7pt] text-slate-500 font-bold uppercase mb-1">Address</div>
                    <div>{address || "—"}</div>
                  </div>
                  <div className="border border-slate-300 rounded p-2">
                    <div className="text-[7pt] text-slate-500 font-bold uppercase mb-1">Equipment Applied For</div>
                    <div>{selectedMachine ? `${selectedMachine.brand} ${selectedMachine.model}` : "—"}</div>
                  </div>
                  <div className="border border-slate-300 rounded p-2">
                    <div className="text-[7pt] text-slate-500 font-bold uppercase mb-1">Contract Price</div>
                    <div className="font-bold">{formatCurrency(contractPrice)}</div>
                  </div>
                  <div className="border border-slate-300 rounded p-2">
                    <div className="text-[7pt] text-slate-500 font-bold uppercase mb-1">Monthly Amortization</div>
                    <div className="font-bold">{formatCurrency(monthlyAmort)}</div>
                  </div>
                </div>
                <div className="border border-slate-300 rounded p-3 mt-3">
                  <div className="text-[7.5pt] text-slate-600 mb-2 font-bold uppercase">Certify and Authorize:</div>
                  <p className="text-[7.5pt] text-slate-600 leading-relaxed">
                    I/We hereby certify that all information stated herein is true and correct, and authorize ES Print Media Inc.
                    to verify the same from any source deemed appropriate.
                  </p>
                </div>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-16">
                <SigLine name={clientName || "Applicant"} role="Applicant Signature over Printed Name" />
                <SigLine name={aeName} role="Sales Representative" />
              </div>
            </div>
          )}

          {/* ── PDC (Post-Dated Checks) ── */}
          {docType === "pdc" && (
            <div>
              <PaperHeader />
              <div className="text-center mb-4">
                <div className="text-[12pt] font-black uppercase tracking-wide">POST-DATED CHECK SCHEDULE</div>
                <div className="text-[8pt] text-slate-500">{fmtDate(quoteDate)}</div>
              </div>
              <p className="mb-3 text-[8pt]">
                <strong>{clientName || "Buyer"}</strong> commits to submit the following post-dated checks as payment for the balance
                of <strong>{formatCurrency(contractPrice - downpayment)}</strong>:
              </p>
              <table className="w-full border-collapse text-[8pt] mb-4">
                <thead>
                  <tr className="bg-[#c0392b] text-white">
                    <th className="p-[3px_6px] text-center">No.</th>
                    <th className="p-[3px_6px] text-left">Due Date</th>
                    <th className="p-[3px_6px] text-left">Bank / Check No.</th>
                    <th className="p-[3px_6px] text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.min(termMonths, 24) }, (_, i) => {
                    const d = new Date(quoteDate);
                    d.setMonth(d.getMonth() + i + 1);
                    return (
                      <tr key={i} className="border-b border-slate-200">
                        <td className="p-[3px_6px] text-center">{i + 1}</td>
                        <td className="p-[3px_6px]">{d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td className="p-[3px_6px] text-slate-400 italic">_______________</td>
                        <td className="p-[3px_6px] text-right font-bold">{formatCurrency(monthlyAmort)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-6 grid grid-cols-2 gap-16">
                <SigLine name={clientName} role="Client / Authorized Representative" />
                <SigLine name={aeName} role="Account Executive, ESPMI" />
              </div>
            </div>
          )}

          {/* ── PULLOUT ── */}
          {docType === "pullout" && (
            <div>
              <PaperHeader />
              <div className="text-center mb-4">
                <div className="text-[12pt] font-black uppercase tracking-wide">PULL-OUT REQUEST FORM</div>
                <div className="text-[8pt] text-slate-500">{fmtDate(quoteDate)}</div>
              </div>
              <div className="space-y-3 text-[8pt]">
                <p>This is to authorize ES Print Media Inc. to pull out the following equipment from the premises of the client:</p>
                <div className="p-3 bg-slate-50 border rounded space-y-0.5">
                  <div><strong>Client:</strong> {clientName || "—"}</div>
                  <div><strong>Company:</strong> {company || "—"}</div>
                  <div><strong>Address:</strong> {address || "—"}</div>
                  <div><strong>Equipment:</strong> {selectedMachine ? `${selectedMachine.brand} ${selectedMachine.model}` : "—"}</div>
                  <div><strong>Serial No.:</strong> {serialNo || "—"}</div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[7.5pt] text-amber-800">
                  <strong>Reason for Pull-Out:</strong> <span className="text-slate-500 italic">___________________________________________</span>
                </div>
                <p className="text-[7.5pt] text-slate-500 leading-relaxed">
                  The client acknowledges and agrees to the pull-out of the above equipment. Any outstanding balance remains due and payable.
                </p>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-16">
                <SigLine name={contactPerson || clientName} role="Client / Authorized Representative" />
                <SigLine name={aeName} role="Account Executive, ESPMI" />
              </div>
            </div>
          )}

        </div>
      </section>
    </div>
  );
}
