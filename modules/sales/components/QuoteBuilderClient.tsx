"use client";

import { useState, useEffect, useMemo } from "react";
import type { CatalogMachine, DealType, LetterheadType, Quote } from "../types";
import { formatCurrency, computeFinancial } from "../lib/calculator";

export function QuoteBuilderClient({
  currentUserEmail,
  currentUserName,
}: {
  currentUserEmail: string;
  currentUserName: string;
}) {
  const [catalog, setCatalog] = useState<CatalogMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedQuotes, setSavedQuotes] = useState<Quote[]>([]);
  const [saving, setSaving] = useState(false);
  const [quoteSuccessMsg, setQuoteSuccessMsg] = useState("");

  // Form State
  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [dealType, setDealType] = useState<DealType>("Cash");
  const [letterhead, setLetterhead] = useState<LetterheadType>("ES Print Media Inc.");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [interestRatePct, setInterestRatePct] = useState(14);
  const [termMonths, setTermMonths] = useState(12);
  const [notes, setNotes] = useState("");
  const [salutation, setSalutation] = useState("Dear Sir/Madam,");
  const [openingLine, setOpeningLine] = useState(
    "Thank you for giving us the opportunity to quote. We are pleased to submit our best proposal for your printing equipment requirements:"
  );
  const [signatoryName, setSignatoryName] = useState(currentUserName);
  const [signatoryTitle, setSignatoryTitle] = useState("Account Executive");

  // Addons and custom inclusions
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  async function loadInitialData() {
    setLoading(true);
    try {
      const [catRes, qRes] = await Promise.all([
        fetch("/api/sales/catalog"),
        fetch("/api/sales/quotes"),
      ]);
      const catData = await catRes.json();
      const qData = await qRes.json();
      if (catData.machines && catData.machines.length > 0) {
        setCatalog(catData.machines);
        setSelectedBrand(catData.machines[0].brand);
        setSelectedModel(catData.machines[0].model);
      }
      if (qData.quotes) setSavedQuotes(qData.quotes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  const brands = useMemo(() => Array.from(new Set(catalog.map((m) => m.brand))).filter(Boolean), [catalog]);
  const modelsForBrand = useMemo(
    () => catalog.filter((m) => !selectedBrand || m.brand === selectedBrand),
    [catalog, selectedBrand]
  );

  const selectedMachine = useMemo(
    () => catalog.find((m) => m.model === selectedModel) || catalog[0],
    [catalog, selectedModel]
  );

  // Price calculations
  const machinePrice = useMemo(() => {
    if (!selectedMachine) return 0;
    return dealType === "Cash"
      ? selectedMachine.cash_price || selectedMachine.srp
      : selectedMachine.srp;
  }, [selectedMachine, dealType]);

  const downpaymentAmount = Math.round((machinePrice * downPaymentPct) / 100);

  const financial = useMemo(() => {
    return computeFinancial(
      machinePrice,
      dealType === "Cash" ? machinePrice : downpaymentAmount,
      dealType === "In-House" ? interestRatePct : 0,
      dealType === "In-House" ? termMonths : 1
    );
  }, [machinePrice, dealType, downpaymentAmount, interestRatePct, termMonths]);

  async function handleSaveQuote() {
    if (!clientName.trim()) {
      alert("Please enter Client Contact Person Name");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/sales/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName,
          company_name: companyName,
          contact_number: contactNumber,
          email,
          address,
          deal_type: dealType,
          letterhead,
          term_months: dealType === "In-House" ? termMonths : 0,
          down_payment_pct: dealType === "In-House" ? downPaymentPct : 0,
          interest_rate_pct: dealType === "In-House" ? interestRatePct : 0,
          total_amount: financial.contractPrice,
          monthly_payment: dealType === "In-House" ? financial.monthlyAmortization : 0,
          signatory_name: signatoryName,
          signatory_title: signatoryTitle,
          notes,
          items: selectedMachine
            ? [
                {
                  machine_id: selectedMachine.id,
                  machine_name: `${selectedMachine.brand} ${selectedMachine.model}`,
                  unit_price: machinePrice,
                  quantity: 1,
                  total_price: machinePrice,
                },
              ]
            : [],
        }),
      });

      if (res.ok) {
        const d = await res.json();
        setQuoteSuccessMsg(`Quote created successfully: ${d.quoteNumber}`);
        setTimeout(() => setQuoteSuccessMsg(""), 4000);
        loadInitialData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to save quote");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving quote");
    } finally {
      setSaving(false);
    }
  }

  const letterheadHeaderImg =
    letterhead === "ACS / Alternative"
      ? "/letterhead/letterhead-acs-1.jpg"
      : "/letterhead/letterhead-espmi-1.jpg";

  const letterheadFooterImg =
    letterhead === "ACS / Alternative"
      ? "/letterhead/letterhead-acs-2.jpg"
      : "/letterhead/letterhead-espmi-2.jpg";

  return (
    <div className="p-4 sm:p-6 lg:p-7 space-y-4 max-w-[1700px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>📝</span> Quote Proposal Builder
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure machine packages, financing terms, and generate official proposal letters with authentic letterheads.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-xs"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Proposal PDF
          </button>
          <button
            onClick={handleSaveQuote}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Formal Quote"}
          </button>
        </div>
      </div>

      {quoteSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold print:hidden">
          ✓ {quoteSuccessMsg}
        </div>
      )}

      {/* Two-Pane Split Layout (Form on Left, Live Quotation Letter on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Panel */}
        <div className="lg:col-span-5 space-y-4 print:hidden text-xs">
          {/* Letterhead & Machine Choice */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="font-extrabold text-slate-800 uppercase text-[11px] tracking-wider text-slate-400">
              1. Letterhead & Machine Selection
            </h2>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Letterhead Branding</label>
                <select
                  value={letterhead}
                  onChange={(e) => setLetterhead(e.target.value as LetterheadType)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-800"
                >
                  <option value="ES Print Media Inc.">ES Print Media Inc.</option>
                  <option value="ACS / Alternative">ACS / Alternative</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Deal Type</label>
                <select
                  value={dealType}
                  onChange={(e) => setDealType(e.target.value as DealType)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-800"
                >
                  <option value="Cash">Cash (Discounted Promo)</option>
                  <option value="PDC">PDC (30/60/90 Days)</option>
                  <option value="In-House">In-House Financing</option>
                  <option value="Straight">Straight Terms</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Brand</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    const firstMatch = catalog.find((m) => m.brand === e.target.value);
                    if (firstMatch) setSelectedModel(firstMatch.model);
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl bg-white font-bold"
                >
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl bg-white font-bold"
                >
                  {modelsForBrand.map((m) => (
                    <option key={m.id} value={m.model}>
                      {m.model}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* In-House financing sliders */}
            {dealType === "In-House" && (
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-700">Downpayment %</span>
                  <span className="font-black text-red-600">
                    {downPaymentPct}% ({formatCurrency(downpaymentAmount)})
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={downPaymentPct}
                  onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                  className="w-full accent-red-600"
                />

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Interest Rate (%)</label>
                    <input
                      type="number"
                      value={interestRatePct}
                      onChange={(e) => setInterestRatePct(Number(e.target.value))}
                      className="w-full px-2 py-1 border border-slate-300 rounded-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Terms (Months)</label>
                    <input
                      type="number"
                      value={termMonths}
                      onChange={(e) => setTermMonths(Number(e.target.value))}
                      className="w-full px-2 py-1 border border-slate-300 rounded-lg font-bold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Client Details */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
            <h2 className="font-extrabold text-slate-800 uppercase text-[11px] tracking-wider text-slate-400">
              2. Client Proposal Information
            </h2>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Contact Person <span className="text-red-500">*</span>
              </label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company Name</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Prints Inc."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact Number</label>
                <input
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. 0917-123-4567"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Business Address</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, City, Province"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          {/* Signatory */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Signatory Name</label>
              <input
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Signatory Title</label>
              <input
                value={signatoryTitle}
                onChange={(e) => setSignatoryTitle(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Right Live Quotation Paper (Exact reproduction of original QuotePreviewPanel) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-300 shadow-md overflow-hidden print:border-none print:shadow-none">
          {/* A4 Sheet Paper */}
          <div className="w-full max-w-[800px] mx-auto bg-white flex flex-col justify-between p-8 sm:p-12 text-slate-900 text-xs">
            {/* Header Letterhead Image */}
            <div className="mb-4">
              <img
                src={letterheadHeaderImg}
                alt={letterhead + " letterhead header"}
                className="w-full object-contain rounded-t-md"
              />
              <div className="text-right mt-2 text-[11px] font-bold text-slate-600">
                Date: {new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>

            {/* Client Block */}
            <div className="mb-4 text-xs space-y-0.5">
              <p className="font-extrabold text-sm text-slate-900">{clientName || "[Client Name]"}</p>
              {companyName && <p className="font-semibold text-slate-700">{companyName}</p>}
              {address && <p className="text-slate-600">{address}</p>}
              {contactNumber && <p className="text-slate-600">{contactNumber}</p>}
            </div>

            {/* Salutation & Opening */}
            <p className="font-bold text-xs mb-1.5">{salutation}</p>
            <p className="text-slate-700 text-xs leading-relaxed mb-4">{openingLine}</p>

            {/* Machine Title & Condition Badge */}
            {selectedMachine && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-red-600 tracking-wider">
                    {selectedMachine.brand}
                  </span>
                  <h3 className="text-base font-black text-slate-900">{selectedMachine.model}</h3>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10.5px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                  {selectedMachine.unit_condition}
                </span>
              </div>
            )}

            {/* Inclusions & Features */}
            {selectedMachine && selectedMachine.inclusions.length > 0 && (
              <div className="mb-4 space-y-1 text-xs">
                <p className="font-bold text-slate-900 uppercase text-[10.5px]">Standard Inclusions:</p>
                <ul className="list-disc pl-5 space-y-0.5 text-slate-700">
                  {selectedMachine.inclusions.map((inc, i) => (
                    <li key={i}>{inc}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pricing Table (Matching exact ESPMI official format) */}
            <div className="border border-slate-900 rounded-xl overflow-hidden mb-5">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white font-extrabold text-[10.5px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Equipment / Package</th>
                    <th className="py-2.5 px-3 text-right">Official Price</th>
                    <th className="py-2.5 px-3 text-right">Downpayment</th>
                    <th className="py-2.5 px-3 text-right">Payment Terms</th>
                    <th className="py-2.5 px-3 text-right">Monthly Amort.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-semibold">
                  <tr>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{selectedMachine?.model}</div>
                      <div className="text-[10.5px] text-slate-500 font-normal">Deal Type: {dealType}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900">
                      {formatCurrency(financial.contractPrice)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-red-600">
                      {dealType === "Cash" ? formatCurrency(financial.contractPrice) : formatCurrency(financial.downpayment)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold">
                      {dealType === "Cash" ? "CASH" : `${termMonths} Months`}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-emerald-700">
                      {dealType === "In-House" ? `${formatCurrency(financial.monthlyAmortization)} / mo` : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Warranty & Confidentiality Statement */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10.5px] text-slate-700 space-y-1 mb-6">
              <p>
                <b>Warranty:</b> {selectedMachine?.machine_warranty_months || 12} Months limited warranty on machine parts & labor.
              </p>
              <p>
                <b>Printhead Warranty:</b> {selectedMachine?.printhead_warranty === "0" ? "No warranty on printhead (consumable)." : `${selectedMachine?.printhead_warranty} Months warranty on printhead.`}
              </p>
              <p className="text-slate-500 italic pt-1">
                All information in this quotation is confidential and intended solely for the recipient.
              </p>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-10 pt-4 border-t border-slate-300 text-xs">
              <div>
                <p className="text-slate-400 font-bold uppercase text-[10px] mb-8">Prepared by:</p>
                <div className="border-b border-slate-900 w-44" />
                <p className="font-black text-slate-900 mt-1">{signatoryName}</p>
                <p className="text-slate-500 text-[10.5px]">{signatoryTitle}</p>
              </div>

              <div className="text-right">
                <p className="text-slate-400 font-bold uppercase text-[10px] mb-8">Conforme / Accepted by:</p>
                <div className="border-b border-slate-900 w-44 ml-auto" />
                <p className="font-black text-slate-900 mt-1">{clientName || "Authorized Client Signature"}</p>
                <p className="text-slate-500 text-[10.5px]">Signature over Printed Name / Date</p>
              </div>
            </div>

            {/* Footer Letterhead Image */}
            <div className="mt-8 pt-4">
              <img
                src={letterheadFooterImg}
                alt={letterhead + " letterhead footer"}
                className="w-full object-contain rounded-b-md"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
