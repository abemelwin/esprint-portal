"use client";

import { useState, useEffect } from "react";
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
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [selectedConsumableIds, setSelectedConsumableIds] = useState<string[]>([]);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [interestRatePct, setInterestRatePct] = useState(14);
  const [termMonths, setTermMonths] = useState(12);
  const [notes, setNotes] = useState("");
  const [signatoryName, setSignatoryName] = useState(currentUserName);
  const [signatoryTitle, setSignatoryTitle] = useState("Account Executive");

  async function loadInitialData() {
    setLoading(true);
    try {
      const [catRes, qRes] = await Promise.all([
        fetch("/api/sales/catalog"),
        fetch("/api/sales/quotes"),
      ]);
      const catData = await catRes.json();
      const qData = await qRes.json();
      if (catData.machines) {
        setCatalog(catData.machines);
        if (catData.machines.length > 0) {
          setSelectedMachineId(catData.machines[0].id);
        }
      }
      if (qData.quotes) setSavedQuotes(qData.quotes);
    } catch (err) {
      console.error("Error loading quotes/catalog:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  const selectedMachine = catalog.find((m) => m.id === selectedMachineId);

  // Determine base machine price depending on deal type
  const machinePrice = selectedMachine
    ? dealType === "Cash"
      ? selectedMachine.cash_price || selectedMachine.srp
      : selectedMachine.srp
    : 0;

  // Selected consumables total
  const selectedConsumables = (selectedMachine?.consumables || []).filter((_, idx) =>
    selectedConsumableIds.includes(String(idx))
  );
  const consumablesTotal = selectedConsumables.reduce((acc, c) => acc + Number(c.default_price || 0), 0);

  const baseTotal = machinePrice + consumablesTotal;
  const downpaymentAmount = Math.round((baseTotal * downPaymentPct) / 100);

  const financial = computeFinancial(
    baseTotal,
    dealType === "Cash" ? baseTotal : downpaymentAmount,
    dealType === "In-House" ? interestRatePct : 0,
    dealType === "In-House" ? termMonths : 1
  );

  async function handleSaveQuote() {
    if (!clientName) {
      alert("Please enter Client Name");
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

  function handlePrint() {
    window.print();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
            Interactive Quote Builder
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Build, price, customize, and print formal quotation letters instantly.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-xs"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Quotation PDF
          </button>
          <button
            onClick={handleSaveQuote}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-all disabled:opacity-50"
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Panel */}
        <div className="lg:col-span-5 space-y-5 print:hidden">
          {/* Client Details */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Client & Proposal Info
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Client Contact Person <span className="text-red-500">*</span>
                </label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Company</label>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Apex Prints"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. 0917-000-0000"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Address</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Business Address, City"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Machine Selection & Consumables */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Machine & Equipment Select
            </h2>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Select Machine</label>
              <select
                value={selectedMachineId}
                onChange={(e) => {
                  setSelectedMachineId(e.target.value);
                  setSelectedConsumableIds([]);
                }}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
              >
                {catalog.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.brand} — {m.model} ({formatCurrency(dealType === "Cash" ? m.cash_price || m.srp : m.srp)})
                  </option>
                ))}
              </select>
            </div>

            {/* Letterhead & Deal Type */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Letterhead</label>
                <select
                  value={letterhead}
                  onChange={(e) => setLetterhead(e.target.value as LetterheadType)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
                >
                  <option value="ES Print Media Inc.">ES Print Media Inc.</option>
                  <option value="ACS / Alternative">ACS / Alternative</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Deal Type</label>
                <select
                  value={dealType}
                  onChange={(e) => setDealType(e.target.value as DealType)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
                >
                  <option value="Cash">Cash (Discounted)</option>
                  <option value="PDC">PDC (30/60/90 days)</option>
                  <option value="In-House">In-House Financing</option>
                  <option value="Straight">Straight Term</option>
                </select>
              </div>
            </div>

            {/* Financing Controls if In-House */}
            {dealType === "In-House" && (
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-700">Downpayment %</span>
                  <span className="font-bold text-red-600">{downPaymentPct}% ({formatCurrency(downpaymentAmount)})</span>
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
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Rate (%)</label>
                    <input
                      type="number"
                      value={interestRatePct}
                      onChange={(e) => setInterestRatePct(Number(e.target.value))}
                      className="w-full px-2 py-1 border border-slate-300 rounded-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Term (Mos)</label>
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

            {/* Consumables Addons */}
            {selectedMachine && selectedMachine.consumables.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-700 mb-2">
                  Optional Consumables & Bundles
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {selectedMachine.consumables.map((c, idx) => {
                    const idStr = String(idx);
                    const isChecked = selectedConsumableIds.includes(idStr);
                    return (
                      <label
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked ? "bg-blue-50 border-blue-300 font-bold" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedConsumableIds([...selectedConsumableIds, idStr]);
                              } else {
                                setSelectedConsumableIds(selectedConsumableIds.filter((x) => x !== idStr));
                              }
                            }}
                            className="rounded accent-blue-600"
                          />
                          <span>{c.item_name}</span>
                        </div>
                        <span className="text-slate-600">{formatCurrency(c.default_price)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Signatory Details */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Signatory Name</label>
              <input
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Title</label>
              <input
                value={signatoryTitle}
                onChange={(e) => setSignatoryTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Right Printable Quotation Document */}
        <div className="lg:col-span-7 bg-white p-8 sm:p-12 rounded-2xl border border-slate-300 shadow-md print:border-none print:shadow-none print:p-0">
          {/* Document Letterhead */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">{letterhead}</h2>
              <p className="text-[11px] text-slate-500">
                Official Equipment & Machinery Quotation Proposal
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold text-slate-900">
                Date: {new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
              </p>
              <p className="text-slate-500 font-mono text-[11px]">Ref: QT-PREVIEW</p>
            </div>
          </div>

          {/* Client Recipient */}
          <div className="py-4 border-b border-slate-200 text-xs">
            <p className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">
              PROPOSAL PREPARED FOR:
            </p>
            <p className="text-base font-extrabold text-slate-900">{clientName || "[Client Name]"}</p>
            {companyName && <p className="font-semibold text-slate-700">{companyName}</p>}
            {address && <p className="text-slate-500">{address}</p>}
            {contactNumber && <p className="text-slate-500">{contactNumber}</p>}
          </div>

          {/* Quotation Table */}
          <div className="py-4 space-y-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-2">Item Description</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedMachine && (
                  <tr>
                    <td className="py-3 pr-2">
                      <div className="font-black text-slate-900">
                        {selectedMachine.brand} {selectedMachine.model}
                      </div>
                      <div className="text-[10.5px] text-slate-500 mt-0.5">
                        Condition: {selectedMachine.unit_condition} · Machine Warranty:{" "}
                        {selectedMachine.machine_warranty_months} Months
                      </div>
                      {selectedMachine.inclusions.length > 0 && (
                        <div className="text-[10px] text-slate-400 mt-1">
                          Includes: {selectedMachine.inclusions.join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-center font-bold">1</td>
                    <td className="py-3 text-right font-bold text-slate-800">
                      {formatCurrency(machinePrice)}
                    </td>
                    <td className="py-3 text-right font-black text-slate-900">
                      {formatCurrency(machinePrice)}
                    </td>
                  </tr>
                )}

                {selectedConsumables.map((c, idx) => (
                  <tr key={idx}>
                    <td className="py-2 pr-2 text-slate-700">
                      <span className="font-semibold">{c.item_name}</span>
                      {c.package_description && (
                        <span className="text-slate-400 text-[10px] block">{c.package_description}</span>
                      )}
                    </td>
                    <td className="py-2 text-center font-semibold">1</td>
                    <td className="py-2 text-right text-slate-600">{formatCurrency(c.default_price)}</td>
                    <td className="py-2 text-right font-bold text-slate-900">{formatCurrency(c.default_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total Section */}
            <div className="border-t-2 border-slate-900 pt-3 flex flex-col items-end text-xs space-y-1">
              <div className="flex justify-between w-64 text-slate-600">
                <span>Subtotal (Base Price):</span>
                <span className="font-bold">{formatCurrency(baseTotal)}</span>
              </div>

              {dealType === "In-House" && (
                <>
                  <div className="flex justify-between w-64 text-slate-600">
                    <span>Downpayment ({downPaymentPct}%):</span>
                    <span className="font-bold text-red-600">{formatCurrency(downpaymentAmount)}</span>
                  </div>
                  <div className="flex justify-between w-64 text-slate-600">
                    <span>Add-on Interest ({interestRatePct}%):</span>
                    <span className="font-bold text-amber-600">+{formatCurrency(financial.totalInterest)}</span>
                  </div>
                  <div className="flex justify-between w-64 text-emerald-700 font-bold border-t border-slate-200 pt-1">
                    <span>Monthly Amortization:</span>
                    <span>{formatCurrency(financial.monthlyAmortization)} / mo</span>
                  </div>
                </>
              )}

              <div className="flex justify-between w-64 text-slate-900 font-black text-base border-t border-slate-900 pt-1">
                <span>Total Contract Price:</span>
                <span>{formatCurrency(financial.contractPrice)}</span>
              </div>
            </div>
          </div>

          {/* Terms and Signatures */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs">
            <div>
              <p className="text-slate-400 font-bold uppercase text-[10px] mb-1">Payment & Terms:</p>
              <p className="text-slate-700 font-medium">Deal Type: <span className="font-bold">{dealType}</span></p>
              {dealType === "In-House" && (
                <p className="text-slate-700 font-medium">Terms: {termMonths} Months installment</p>
              )}
              <p className="text-slate-500 text-[10.5px] mt-1">
                Quotation validity: 30 days from date issued.
              </p>
            </div>

            <div className="text-right">
              <p className="text-slate-400 font-bold uppercase text-[10px] mb-8">Prepared by:</p>
              <div className="border-b border-slate-900 w-44 ml-auto" />
              <p className="font-black text-slate-900 mt-1">{signatoryName}</p>
              <p className="text-slate-500 text-[10.5px]">{signatoryTitle}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
