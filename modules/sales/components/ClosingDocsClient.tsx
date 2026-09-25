"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCurrency } from "../lib/calculator";

// ── Tab config (matches orig CLOSING_DOC_TABS) ────────────────────────────────
type DocTab = "terms-conditions" | "delivery-instructions" | "cac" | "pdc" | "pullout";

const TABS: { id: DocTab; label: string }[] = [
  { id: "terms-conditions",      label: "Terms & Conditions"    },
  { id: "delivery-instructions", label: "Delivery Instructions" },
  { id: "cac",                   label: "Customer Acceptance"   },
  { id: "pdc",                   label: "PDC Schedule"          },
  { id: "pullout",               label: "Trade-In Pullout"      },
];

// ── Number → words (mirrors orig numWords()) ─────────────────────────────────
const ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
  "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
function numWords(n: number): string {
  let num = Math.floor(Math.abs(n) || 0);
  if (num === 0) return "Zero";
  function b3(x: number): string {
    let s = "";
    if (x >= 100) { s += ONES[Math.floor(x/100)] + " Hundred"; x %= 100; if (x) s += " "; }
    if (x >= 20)  { s += TENS[Math.floor(x/10)]; x %= 10; if (x) s += " " + ONES[x]; }
    else if (x > 0) s += ONES[x];
    return s;
  }
  let out = "";
  for (const [u, lbl] of [[1e9,"Billion"],[1e6,"Million"],[1e3,"Thousand"],[1,""]] as [number,string][]) {
    if (num >= u) { const c = Math.floor(num/u); num %= u; out += (out?" ":"") + b3(c) + (lbl?" "+lbl:""); }
  }
  return out.trim();
}

function fmtN(v: number | null | undefined) {
  return (Number(v)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtDate(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v + "T00:00:00");
  if (isNaN(d.getTime())) return v;
  const M = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${M[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ── "Edit Details" prompt fields (filled by user, feeds into documents) ───────
interface PromptDetails {
  buyerName: string;
  sigPosition: string;
  company: string;
  regAddress: string;
  deliveryAddress: string;
  machineOrigin: string;
  accountExec: string;
  soNumber: string;
  freight: string;
  contactPerson: string;
  contactNumber: string;
  deliveryDate: string;
  installDate: string;
  dpDate: string;
  pdcCollect: string;
  otherInstr: string;
  docsWho: string;
  tradeBrandModel: string;
  pulloutAddr: string;
  pulloutInstr: string;
  custRep: string;
  serialNumber: string;
  firstPdcDate: string;
  additionalItems: string; // newline-separated
}

function blankPrompt(): PromptDetails {
  return {
    buyerName:"",sigPosition:"OWNER",company:"",regAddress:"",deliveryAddress:"",
    machineOrigin:"",accountExec:"",soNumber:"",freight:"",contactPerson:"",
    contactNumber:"",deliveryDate:"",installDate:"",dpDate:"",pdcCollect:"UPON DELIVERY",
    otherInstr:"NONE",docsWho:"Technician who will install machine",tradeBrandModel:"",
    pulloutAddr:"",pulloutInstr:"",custRep:"",serialNumber:"",firstPdcDate:"",
    additionalItems:"",
  };
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ClosingDocsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const quoteId = searchParams.get("id");

  const [activeTab, setActiveTab] = useState<DocTab>("terms-conditions");
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState<PromptDetails>(blankPrompt());

  // Load quote
  useEffect(() => {
    if (!quoteId) { setLoading(false); return; }
    fetch(`/api/sales/quotes/${quoteId}`)
      .then(r => r.json())
      .then(d => {
        if (d.quote) {
          setQuote(d.quote);
          // Pre-fill prompt from quote
          const q = d.quote;
          setPrompt(prev => ({
            ...prev,
            buyerName: q.client_conforme || q.client_name || "",
            company: q.company || "",
            regAddress: q.address || "",
            deliveryAddress: q.address || "",
            contactPerson: q.client_name || "",
            contactNumber: q.contact || "",
            accountExec: q.ae_name || "",
            pdcCollect: q.deal_type?.toLowerCase().includes("term") ? "UPON DELIVERY" : "NONE",
            tradeBrandModel: Array.isArray(q.trade_ins)
              ? q.trade_ins.filter((t: any) => t.description?.trim()).map((t: any) => t.description).join("; ")
              : "",
            pulloutAddr: q.address || "",
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [quoteId]);

  // Derived values from quote + prompt
  const q = quote ?? {};
  const price = Number(q.contract_price ?? 0);
  const priceFig = Math.round(price);
  const priceWords = numWords(priceFig);
  const dealType = String(q.deal_type ?? "Standard Cash");
  const isTerms = dealType.toLowerCase().includes("term");
  const ptDown = Number(q.term_options?.[0]?.down_payment ?? 0);
  const tradeIns = Array.isArray(q.trade_ins) ? q.trade_ins : [];
  const validTradeIns = tradeIns.filter((t: any) => t.description?.trim() || Number(t.value) > 0);
  const tradeInSum = validTradeIns.reduce((s: number, t: any) => s + (Number(t.value) || 0), 0);
  const isTI = dealType.toLowerCase().includes("trade") || (validTradeIns.length > 0 && tradeInSum > 0);
  const months = Number(q.term_options?.[0]?.months ?? 0) || (isTerms ? 12 : 0);
  const balance = Math.max(price - (isTerms ? ptDown : 0) - tradeInSum, 0);
  const monthly = isTerms && months > 0 ? balance / months : 0;
  const machineModel = q.selectedModel ?? (q.machine_id ? "(Machine)" : "EQUIPMENT");
  const machineCondition = q.unit_condition_override ?? "";
  const machineLabel = machineModel + (machineCondition ? ` (${machineCondition})` : "");
  const hasPrinthead = !!(q.has_printhead || q.selectedMachine?.has_printhead);
  const coName = (q.warranty_company ?? "ES Print Media Inc.").trim() || "ES Print Media Inc.";

  // PDC rows
  const pdcRows = (() => {
    const rows: { no: string; date: string; amount: string }[] = [];
    const dpD = prompt.dpDate ? fmtDate(prompt.dpDate) : "";
    rows.push({ no: "DOWNPAYMENT", date: dpD, amount: fmtN(ptDown) });
    for (let i = 1; i <= months; i++) {
      let dtStr = "";
      if (prompt.firstPdcDate) {
        const base = new Date(prompt.firstPdcDate + "T00:00:00");
        base.setMonth(base.getMonth() + i - 1);
        dtStr = fmtDate(base.toISOString().slice(0, 10));
      }
      rows.push({ no: String(i), date: dtStr, amount: fmtN(monthly) });
    }
    return rows;
  })();

  const tiDesc = prompt.tradeBrandModel || validTradeIns.map((t: any) => t.description?.trim()).filter(Boolean).join("; ");

  const letterheadHeader = q.letterhead === "ACS / Alternative"
    ? "/letterhead/letterhead-acs-1.jpg"
    : "/letterhead/letterhead-espmi-1.jpg";
  const letterheadFooter = q.letterhead === "ACS / Alternative"
    ? "/letterhead/letterhead-acs-2.jpg"
    : "/letterhead/letterhead-espmi-2.jpg";

  if (loading) return <div className="flex items-center justify-center h-screen text-sm text-slate-400">Loading…</div>;

  return (
    <div className="flex flex-col h-screen bg-[#555] select-none overflow-hidden">
      {/* ── Top tab bar (red, matches orig) ─────────────────────────────────── */}
      <div className="flex items-center gap-0 bg-[#c0392b] px-3 h-[38px] shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1 text-[12px] font-bold whitespace-nowrap rounded-[4px] mr-1 transition-colors cursor-pointer border-0 ${
              activeTab === t.id
                ? "bg-white text-[#c0392b]"
                : "bg-transparent text-white hover:bg-white/20"
            }`}>
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setShowPrompt(true)}
          className="px-3 py-1 text-[12px] font-bold text-white border border-white/60 rounded cursor-pointer hover:bg-white/20 mr-1">
          ✏ Edit Details
        </button>
        <button onClick={() => window.print()}
          className="px-3 py-1 text-[12px] font-bold text-white border border-white/60 rounded cursor-pointer hover:bg-white/20 mr-1">
          💾 Save as PDF
        </button>
        <button onClick={() => router.back()}
          className="px-3 py-1 text-[12px] font-bold text-white border border-white/60 rounded cursor-pointer hover:bg-white/20">
          ✕ Close
        </button>
      </div>

      {/* ── Document preview area ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 flex justify-center items-start">
        <div id="tc-paper" className="w-[210mm] min-h-[297mm] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex flex-col justify-between text-black print:shadow-none print:w-full">
          {/* Header letterhead */}
          <div className="border-b-[2px] border-[#c0392b] mb-[4mm]">
            <img src={letterheadHeader} alt="Letterhead" className="w-full block" />
          </div>

          <div className="px-[16mm] pb-[4mm] flex-1 text-[9.5pt] leading-[1.5] text-black">
            {/* ── TERMS & CONDITIONS ── */}
            {activeTab === "terms-conditions" && (
              <div>
                <div className="text-center text-[13pt] font-bold tracking-[1px] underline mb-[4mm]">TERMS AND CONDITIONS</div>
                <p className="mb-[2.5mm] text-justify">WHEREAS, the SELLER offered to sell to the BUYER a/an {machineLabel.toUpperCase()};</p>
                <p className="mb-[2.5mm] text-justify">WHEREAS, the BUYER has accepted the offer of the SELLER.</p>
                <p className="mb-[2.5mm] text-justify">NOW THEREFORE, for and in consideration of the total sum of {priceWords} (Php{priceFig}) Philippine Currency, and of the covenants herein after set forth the SELLER agrees to sell and the BUYER agrees to buy the aforesaid product subject to the following terms and conditions:</p>
                <ol className="list-decimal pl-[8mm] space-y-[2mm] text-justify">
                  <li>That this agreement shall be treated as a General Supply Agreement where SELLER agrees and covenants to supply the BUYER all the supplies/services required by the subject unit, as BUYER may order, and such parts and/or services that it may require subsequent to the delivery and beyond the warranty period.</li>
                  {isTerms ? (
                    <li>That BUYER commits itself to pay SELLER the sum of {priceWords} (Php{priceFig}) payable in the following terms:
                      <table className="border-collapse my-[2mm] ml-[6mm] text-[9pt] w-full max-w-[380px]">
                        <tbody>
                          <tr><td className="pr-[14px] font-normal">CONTRACT PRICE</td><td className="text-right font-semibold">PHP {fmtN(price)}</td></tr>
                          {isTI && <tr><td className="pr-[14px]">TRADE-IN VALUE</td><td className="text-right font-semibold">PHP {fmtN(tradeInSum)}</td></tr>}
                          <tr><td className="pr-[14px]">DOWNPAYMENT</td><td className="text-right font-semibold">PHP {fmtN(ptDown)}</td></tr>
                          <tr><td className="pr-[14px]">BALANCE</td><td className="text-right font-semibold">PHP {fmtN(balance)}</td></tr>
                          <tr><td className="pr-[14px]">TERMS</td><td className="text-right font-semibold">{months} months</td></tr>
                          <tr><td className="pr-[14px]">MONTHLY AMORTIZATION</td><td className="text-right font-semibold">PHP {fmtN(monthly)}</td></tr>
                        </tbody>
                      </table>
                    </li>
                  ) : isTI ? (
                    <li>That BUYER commits itself to pay SELLER in CASH the net amount computed as follows:
                      <table className="border-collapse my-[2mm] ml-[6mm] text-[9pt] w-full max-w-[380px]">
                        <tbody>
                          <tr><td className="pr-[14px]">CONTRACT PRICE</td><td className="text-right font-semibold">PHP {fmtN(price)}</td></tr>
                          <tr><td className="pr-[14px]">TRADE-IN VALUE</td><td className="text-right font-semibold">PHP {fmtN(tradeInSum)}</td></tr>
                          <tr><td className="pr-[14px]">NET AMOUNT</td><td className="text-right font-semibold">PHP {fmtN(balance)}</td></tr>
                        </tbody>
                      </table>
                    </li>
                  ) : (
                    <li>That BUYER commits itself to pay SELLER the sum of {priceWords} (Php{priceFig}) payable in CASH;</li>
                  )}
                  {isTerms && <li>That should Buyer fail to make one (1) monthly payment for any reason whatsoever when the monthly payment respectively falls due, the Seller shall give a written notice, to the Buyer of said fact and shall give Buyer a grace period of five (5) working days to settle the outstanding monthly payment in cash. Should the Buyer fail to pay within this five (5) day period, the Buyer grants the Seller the option to demand full payment of the outstanding balance and/or to pull out the machine upon giving notice 48-hours prior thereto.</li>}
                  {isTI && tiDesc && <li>That the trade-in machine is a {tiDesc}, and that the buyer warrants this machine and its parts are free from any liens and encumbrances whatsoever and that the buyer has a good, valid and full right, ownership and interest on the said machine.</li>}
                  <li>The BUYER's failure to abide by the payment terms for the machine, consumables and other items set forth shall give Seller the right to charge interest of one and a half percent (1.5%) per month and/or penalties amounting to one percent (1%) per month on the outstanding balance. Returned checks will be deposited after five (5) working days.</li>
                  <li>That BUYER allows the Seller to conduct regular and random inspection of the subject {hasPrinthead?"printer":"equipment"}, provided that Seller would inform BUYER of the desired inspection one (1) day prior the date of inspection requested.</li>
                  <li>That BUYER acknowledges that the use of {hasPrinthead?"inks, cleaning solution and spare parts":"spare parts"} other than those supplied by {coName} will void equipment's warranty.</li>
                  <li>That the Buyer agrees not to transfer, relocate, move the equipment without the supervision of {coName} trained Engineers. Damage(s) caused by improper handling will not be covered by warranty.</li>
                  <li>The BUYER is expected to exercise diligence of a good father of a family in maintaining and keeping the subject machine away from damage or disaster, such as ensuring that the elected installation site is flood and water-free.</li>
                  <li>Seller shall have the right to withhold warranty coverage service to the BUYER should the latter refuse to sign the Customer Acceptance Certificate or to delay the signing of the said certificate for any unjustifiable reason.</li>
                  <li>BUYER agrees that the Seller may unilaterally deem the warranty coverage terminated, even prior to its expiration, should the BUYER fail to pay in full to the Seller.</li>
                  <li>The parties promise to faithfully comply with the terms and conditions stated in the CAC and Limited Warranty Certificate.</li>
                  <li>BUYER shall not at all times directly or indirectly solicit, induce, recruit, encourage or otherwise endeavor to cause or attempt to cause any employee or consultant of the Seller to terminate their relationship with Seller.</li>
                  <li>It is an essential consideration of this Agreement that all matters pertaining to the supply by {coName} to the BUYER shall be held in the strictest confidence.</li>
                  <li>This Terms and Condition shall be governed by the laws of the Philippines and the parties mutually agree that any and all suits arising out of this Agreement shall be filed in the proper courts of Makati City, Philippines.</li>
                </ol>
                <div className="mt-[12mm] text-[9.5pt] leading-[2.3]">
                  Signature:<br/>
                  Name: <span className="inline-block min-w-[72mm] border-b border-black ml-1">{prompt.buyerName}</span><br/>
                  Company: <span className="inline-block min-w-[72mm] border-b border-black ml-1">{prompt.company}</span><br/>
                  Position: <span className="inline-block min-w-[72mm] border-b border-black ml-1">{prompt.sigPosition}</span><br/>
                  Date: <span className="inline-block min-w-[72mm] border-b border-black ml-1"></span>
                </div>
              </div>
            )}

            {/* ── DELIVERY INSTRUCTIONS ── */}
            {activeTab === "delivery-instructions" && (
              <div>
                <div className="text-center text-[13pt] font-bold tracking-[1px] underline mb-[4mm]">DELIVERY INSTRUCTIONS</div>
                <table className="w-full border-collapse text-[9.5pt] mb-[3mm]">
                  <tbody>
                    {[
                      ["MACHINE ORIGIN", prompt.machineOrigin],
                      ["MACHINE MODEL", machineLabel],
                      ["ACCOUNT EXECUTIVE", prompt.accountExec],
                      ["SO NUMBER", prompt.soNumber],
                      ["COMPANY NAME", prompt.company],
                      ["COMPANY ADDRESS", prompt.regAddress],
                    ].map(([l, v]) => (
                      <tr key={l}><td className="w-[42mm] font-bold bg-[#f6f6f6] border border-[#333] p-[2mm_3mm]">{l}</td><td className="border border-[#333] p-[2mm_3mm]">{v}</td></tr>
                    ))}
                    <tr><td colSpan={2} className="bg-[#c0392b] text-white font-bold text-center tracking-[0.5px] border border-[#333] p-[2mm]">DELIVERY INSTRUCTIONS</td></tr>
                    {[
                      ["REGISTERED ADDRESS", prompt.regAddress],
                      ["DELIVERY ADDRESS", prompt.deliveryAddress],
                      ["FREIGHT ARRANGEMENT", prompt.freight],
                      ["CONTACT PERSON", prompt.contactPerson],
                      ["CONTACT NUMBER", prompt.contactNumber],
                      ["DELIVERY DATE", fmtDate(prompt.deliveryDate)],
                      ["INSTALLATION DATE", fmtDate(prompt.installDate)],
                      ["VAT IN / VAT EX ?", q.vat_inclusive ? "VAT IN" : "VAT EX"],
                      ["ADDITIONAL DELIVERY ITEMS", prompt.additionalItems || "NONE"],
                    ].map(([l, v]) => (
                      <tr key={l}><td className="w-[42mm] font-bold bg-[#f6f6f6] border border-[#333] p-[2mm_3mm]">{l}</td><td className="border border-[#333] p-[2mm_3mm] whitespace-pre-line">{v}</td></tr>
                    ))}
                    {isTI && <>
                      <tr><td colSpan={2} className="bg-[#c0392b] text-white font-bold text-center tracking-[0.5px] border border-[#333] p-[2mm]">TRADE-IN PULLOUT</td></tr>
                      <tr><td className="w-[42mm] font-bold bg-[#f6f6f6] border border-[#333] p-[2mm_3mm]">BRAND AND MODEL OF TRADE-IN</td><td className="border border-[#333] p-[2mm_3mm]">{tiDesc}</td></tr>
                      <tr><td className="w-[42mm] font-bold bg-[#f6f6f6] border border-[#333] p-[2mm_3mm]">PULLOUT INSTRUCTIONS</td><td className="border border-[#333] p-[2mm_3mm]">{prompt.pulloutInstr}</td></tr>
                      <tr><td className="w-[42mm] font-bold bg-[#f6f6f6] border border-[#333] p-[2mm_3mm]">PULLOUT ADDRESS</td><td className="border border-[#333] p-[2mm_3mm]">{prompt.pulloutAddr}</td></tr>
                    </>}
                    <tr><td colSpan={2} className="bg-[#c0392b] text-white font-bold text-center tracking-[0.5px] border border-[#333] p-[2mm]">COLLECTION INSTRUCTIONS</td></tr>
                    {[
                      ["DATE OF DP", prompt.dpDate ? fmtDate(prompt.dpDate) : "TO FOLLOW"],
                      ["WHEN TO COLLECT PDCs", prompt.pdcCollect],
                      ["OTHERS", prompt.otherInstr],
                    ].map(([l, v]) => (
                      <tr key={l}><td className="w-[42mm] font-bold bg-[#f6f6f6] border border-[#333] p-[2mm_3mm]">{l}</td><td className="border border-[#333] p-[2mm_3mm]">{v}</td></tr>
                    ))}
                    <tr><td colSpan={2} className="bg-[#c0392b] text-white font-bold text-center tracking-[0.5px] border border-[#333] p-[2mm]">DOCUMENTATION INSTRUCTIONS</td></tr>
                    <tr><td className="w-[42mm] font-bold bg-[#f6f6f6] border border-[#333] p-[2mm_3mm]">WHO WILL GET DOCS?</td><td className="border border-[#333] p-[2mm_3mm]">{prompt.docsWho}</td></tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ── CUSTOMER ACCEPTANCE CERTIFICATE (CAC) ── */}
            {activeTab === "cac" && (
              <div>
                <div className="text-center text-[13pt] font-bold tracking-[1px] underline mb-[4mm]">CUSTOMER ACCEPTANCE CERTIFICATE<br/>AND LIMITED WARRANTY CERTIFICATE</div>
                <table className="w-full border-collapse text-[9.5pt] mb-[3mm]">
                  <tbody>
                    {[
                      ["CUSTOMER NAME", prompt.company || q.client_name],
                      ["REGISTERED ADDRESS", prompt.regAddress],
                      ["DELIVERY ADDRESS", prompt.deliveryAddress],
                      ["CUSTOMER REPRESENTATIVE", prompt.custRep || q.client_name],
                    ].map(([l, v]) => (
                      <tr key={l}><td className="w-[42mm] font-bold bg-[#f6f6f6] border border-[#333] p-[2mm_3mm]">{l}</td><td className="border border-[#333] p-[2mm_3mm]">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="mb-[2mm] text-justify">This Acceptance is based on the successful completion of the {coName.toUpperCase()} Product Installation.</p>
                <p className="mb-[2mm] text-justify">By signing below, the undersigned hereby agrees to the acceptance of the following machine in good condition and that the installed product performance meets {coName} specifications.</p>
                <table className="w-full border-collapse text-[9.5pt] mb-[3mm]">
                  <tbody>
                    {[
                      ["MAKE", q.selectedBrand || ""],
                      ["MODEL", machineLabel],
                      ["SERIAL NUMBER", prompt.serialNumber],
                    ].map(([l, v]) => (
                      <tr key={l}><td className="w-[42mm] font-bold bg-[#f6f6f6] border border-[#333] p-[2mm_3mm]">{l}</td><td className="border border-[#333] p-[2mm_3mm]">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="mb-[2mm] text-justify">The undersigned hereby agrees to the start of the warranty period, and to pay the balance of the payment terms (if any) indicated in the Payment Terms section of {coName.toUpperCase()}'s Quotation and/or Terms and Conditions and that all contractual terms commence or remain in full affect.</p>
                <p className="mb-[1.5mm]">The undersigned also agrees that the following are NOT COVERED BY WARRANTY:</p>
                <ol className="list-[lower-alpha] pl-[8mm] space-y-[1mm] text-justify">
                  {hasPrinthead ? <>
                    <li>Routine cleaning, normal cosmetic and mechanical wear.</li>
                    <li>Clogged or damaged print head caused by: poor maintenance, head-strike, long-storage, power surge, poor working environment, or use of longer cleaning options in de-clogging print nozzles.</li>
                    <li>Damage caused by improper handling and non-compliance on environment requirements.</li>
                    <li>Damage from misuse, abuse, neglect and use outside the machine's usage parameters.</li>
                    <li>Damage from use of parts, supplies and service other than those supplied by {coName}.</li>
                    <li>Damage from modification or incorporation into other machine / products.</li>
                    <li>Damage resulting from fire, flood, act of nature, or any other cause beyond control of {coName}.</li>
                    <li>Incorrect voltage / current of mains supply, or physical, environmental or electrical stress.</li>
                    <li>Work station, heat press, automatic voltage regulator (if any). Software problem including viruses.</li>
                    <li>Damage caused by vermin / insects.</li>
                  </> : <>
                    <li>Routine cleaning, normal cosmetic and mechanical wear.</li>
                    <li>Damages caused by improper handling and non-compliance on environment requirements.</li>
                    <li>Damage from misuse, abuse and neglect.</li>
                    <li>Damage from use outside the machine's usage parameters.</li>
                    <li>Damage from use of parts, supplies and service other than those supplied by {coName}.</li>
                    <li>Damage from modification or incorporation into other machine / products.</li>
                    <li>Damage resulting from fire, flood, act of God, or any other cause beyond the control of {coName}.</li>
                    <li>Incorrect voltage/current of mains supply, or physical, environmental or electrical stress.</li>
                    <li>Warranty shall be rendered null and void if the Product is damaged by vermin / insects.</li>
                  </>}
                </ol>
                <div className="flex gap-[8mm] mt-[10mm] text-[8.5pt]">
                  {[["CUSTOMER SIGNATURE OVER PRINTED NAME"],["FIELD SERVICE ENGINEER SIGNATURE OVER PRINTED NAME"],["WITNESS SIGNATURE OVER PRINTED NAME"]].map(([r]) => (
                    <div key={r} className="flex-1 text-center">
                      <div className="border-b border-black min-h-[9mm] mb-1" />
                      <div className="text-[7.5pt]">{r}</div>
                      <div className="text-[7.5pt] mt-1">Date: __________</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── PDC SCHEDULE ── */}
            {activeTab === "pdc" && (
              <div>
                <div className="text-center text-[13pt] font-bold tracking-[1px] underline mb-[4mm]">PAYMENT SCHEDULE</div>
                {!isTerms ? (
                  <div className="text-center text-[#c0392b] py-[30mm] text-[11pt]">PDC Schedule applies to installment deals only. Set the Deal Type to an installment option in the Quote Generator.</div>
                ) : <>
                  <p className="text-center mb-[1mm]">Machine: <strong>{machineLabel}</strong></p>
                  <p className="text-center mb-[3mm]">Please make checks payable to: <strong>{coName.toUpperCase()}</strong></p>
                  <table className="w-full border-collapse text-[9pt]">
                    <thead>
                      <tr className="bg-[#c0392b] text-white">
                        {["NO.","DATE","AMOUNT","NOTES"].map(h => <th key={h} className="border border-[#333] p-[2mm] text-center">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {pdcRows.map((r, i) => (
                        <tr key={i} className={i%2===0?"bg-white":"bg-slate-50"}>
                          <td className="border border-[#333] p-[1.5mm_3mm] text-center">{r.no}</td>
                          <td className="border border-[#333] p-[1.5mm_3mm]">{r.date}</td>
                          <td className="border border-[#333] p-[1.5mm_3mm] text-right">{r.amount}</td>
                          <td className="border border-[#333] p-[1.5mm_3mm]"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[8.5pt] text-slate-500 mt-[4mm]">Contract Price: PHP {fmtN(price)} · Downpayment: PHP {fmtN(ptDown)} · Balance: PHP {fmtN(balance)} · Terms: {months} months</p>
                </>}
              </div>
            )}

            {/* ── TRADE-IN PULLOUT ── */}
            {activeTab === "pullout" && (
              <div>
                <div className="text-center text-[13pt] font-bold tracking-[1px] underline mb-[4mm]">TRADE-IN MACHINE PULL OUT FORM</div>
                {!isTI ? (
                  <div className="text-center text-[#c0392b] py-[30mm] text-[11pt]">Trade-in Pullout Form applies to trade-in deals only. Set the Deal Type to a Trade-In option in the Quote Generator.</div>
                ) : <>
                  <p className="mb-[2mm]">DATE: <span className="inline-block min-w-[60mm] border-b border-black ml-1"></span></p>
                  <p className="mb-[2mm]">PULLOUT ADDRESS: <strong>{prompt.pulloutAddr}</strong></p>
                  <p className="mb-[2mm] text-justify">The following machine and its parts are voluntarily surrendered by <strong>{prompt.company || q.client_name || "____________"}</strong> to {coName}:</p>
                  <table className="w-full border-collapse text-[9.5pt] mb-[3mm]">
                    <thead>
                      <tr className="bg-[#f0f0f0]">
                        {["QUANTITY","DESCRIPTION","SERIAL NUMBER"].map(h => <th key={h} className="border border-[#333] p-[2mm] font-bold text-center">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(validTradeIns.length > 0 ? validTradeIns : tiDesc ? [{ description: tiDesc }] : []).map((u: any, i: number) => (
                        <tr key={i}><td className="border border-[#333] p-[2mm] text-center">1</td><td className="border border-[#333] p-[2mm]">{u.description || tiDesc}</td><td className="border border-[#333] p-[2mm]"></td></tr>
                      ))}
                      {Array.from({ length: Math.max(0, 10 - (validTradeIns.length || (tiDesc ? 1 : 0))) }, (_, i) => (
                        <tr key={"b"+i}><td className="border border-[#333] h-[7mm]"></td><td className="border border-[#333]"></td><td className="border border-[#333]"></td></tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mb-[4mm] text-justify text-[9.5pt]">This also serves as a certification that the above machine and its parts are free from any liens and encumbrances whatsoever and that the client has a good, valid and full right, ownership and interest on the said machine.</p>
                  <div className="flex gap-[8mm] mt-[12mm] text-[8.5pt]">
                    {[["Prepared by:"],["Acknowledged and Confirmed by:"],["Witnessed by:"]].map(([r]) => (
                      <div key={r} className="flex-1">
                        <div className="text-[7.5pt] mb-2">{r}</div>
                        <div className="border-b border-black min-h-[9mm] mb-1" />
                        <div className="text-[7.5pt]">Signature over Printed Name</div>
                      </div>
                    ))}
                  </div>
                </>}
              </div>
            )}
          </div>

          {/* Footer letterhead */}
          <footer>
            <img src={letterheadFooter} alt="Footer" className="w-full block" />
          </footer>
        </div>
      </div>

      {/* ── Edit Details Modal ─────────────────────────────────────────────────── */}
      {showPrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setShowPrompt(false); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5 my-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[15px]">Edit Details</h3>
              <button onClick={() => setShowPrompt(false)} className="text-slate-400 hover:text-slate-700 text-[20px]">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              {([
                ["buyerName","Buyer Name (T&C signature)","text"],
                ["sigPosition","Buyer Position","text"],
                ["company","Company Name","text"],
                ["regAddress","Registered Address","text"],
                ["deliveryAddress","Delivery Address","text"],
                ["machineOrigin","Machine Origin","text"],
                ["accountExec","Account Executive","text"],
                ["soNumber","SO Number","text"],
                ["freight","Freight Arrangement","text"],
                ["contactPerson","Contact Person","text"],
                ["contactNumber","Contact Number","text"],
                ["deliveryDate","Delivery Date","date"],
                ["installDate","Installation Date","date"],
                ["dpDate","Date of Downpayment","date"],
                ["pdcCollect","When to Collect PDCs","text"],
                ["otherInstr","Other Collection Instructions","text"],
                ["docsWho","Who Will Get Documents?","text"],
                ["serialNumber","Serial Number (CAC)","text"],
                ["custRep","Customer Representative (CAC)","text"],
                ["tradeBrandModel","Trade-In Brand & Model","text"],
                ["pulloutAddr","Pullout Address","text"],
                ["pulloutInstr","Pullout Instructions","text"],
                ["firstPdcDate","First PDC Date (PDC Schedule)","date"],
              ] as [keyof PromptDetails, string, string][]).map(([key, label, type]) => (
                <div key={key} className={type === "text" && label.length > 25 ? "col-span-2" : ""}>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">{label}</label>
                  <input type={type} value={prompt[key]} onChange={e => setPrompt(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-[12px]" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Additional Delivery Items (one per line)</label>
                <textarea value={prompt.additionalItems} rows={3}
                  onChange={e => setPrompt(prev => ({ ...prev, additionalItems: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-[12px]" />
              </div>
            </div>
            <div className="flex justify-end mt-4 gap-2">
              <button onClick={() => setShowPrompt(false)}
                className="px-4 py-2 bg-[#c0392b] text-white text-[12px] font-bold rounded cursor-pointer hover:bg-[#a93226]">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body > *:not(#tc-paper) { display: none !important; }
          #tc-paper { width: 210mm !important; min-height: 297mm !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
