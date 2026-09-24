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

  // Form State matching Screenshot 1
  const [letterhead, setLetterhead] = useState<LetterheadType>("ES Print Media Inc.");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [unitCondition, setUnitCondition] = useState("Brand New");

  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [quoteDate, setQuoteDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [salutation, setSalutation] = useState("Dear Ma'am / Sir,");
  const [openingLine, setOpeningLine] = useState(
    "Thank you for your interest in our products and services. Below is our quote as per your inquiry:"
  );

  const [dealType, setDealType] = useState<DealType>("Cash");
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [interestRatePct, setInterestRatePct] = useState(14);
  const [termMonths, setTermMonths] = useState(12);
  const [notes, setNotes] = useState("");
  const [signatoryName, setSignatoryName] = useState(currentUserName || "ACCOUNT EXECUTIVE");
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
      if (catData.machines && catData.machines.length > 0) {
        setCatalog(catData.machines);
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

  const brands = useMemo(
    () => Array.from(new Set(catalog.map((m) => m.brand))).filter(Boolean),
    [catalog]
  );
  const modelsForBrand = useMemo(
    () => catalog.filter((m) => !selectedBrand || m.brand === selectedBrand),
    [catalog, selectedBrand]
  );

  const selectedMachine = useMemo(
    () => (selectedModel ? catalog.find((m) => m.model === selectedModel) : null),
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

  const formattedDate = useMemo(() => {
    if (!quoteDate) return "";
    try {
      const parts = quoteDate.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      }
      return quoteDate;
    } catch {
      return quoteDate;
    }
  }, [quoteDate]);

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-46px)] bg-[#f1f5f9]">
      {/* LEFT FORM SIDEBAR (Exact Screenshot 1: Width ~340px, red sections, red underline) */}
      <aside className="w-full lg:w-[350px] shrink-0 bg-white border-r border-red-300 p-4 overflow-y-auto space-y-4 shadow-sm print:hidden select-none">
        {/* Header Branding */}
        <div className="text-center pb-2">
          <h2 className="text-sm font-black text-red-600 tracking-wide">
            ES PRINT MEDIA INC.
          </h2>
          <p className="text-[11px] text-slate-400 italic mt-0.5">
            Quotation Generator
          </p>
        </div>

        {/* SECTION 1: LETTERHEAD */}
        <div>
          <h3 className="text-xs font-black text-red-600 tracking-wider uppercase border-b border-red-400 pb-1 mb-2">
            LETTERHEAD
          </h3>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              SELECT LETTERHEAD
            </label>
            <select
              value={letterhead}
              onChange={(e) => setLetterhead(e.target.value as LetterheadType)}
              className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none"
            >
              <option value="ES Print Media Inc.">ES Print Media Inc.</option>
              <option value="ACS / Alternative">ACS / Alternative</option>
            </select>
          </div>
        </div>

        {/* SECTION 2: MACHINE */}
        <div>
          <h3 className="text-xs font-black text-red-600 tracking-wider uppercase border-b border-red-400 pb-1 mb-2">
            MACHINE
          </h3>
          <div className="space-y-2.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                BRAND
              </label>
              <select
                value={selectedBrand}
                onChange={(e) => {
                  setSelectedBrand(e.target.value);
                  setSelectedModel("");
                }}
                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none"
              >
                <option value="">Select brand</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                MACHINE MODEL
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!selectedBrand}
                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">Select model</option>
                {modelsForBrand.map((m) => (
                  <option key={m.id} value={m.model}>
                    {m.model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                UNIT CONDITION
              </label>
              <select
                value={unitCondition}
                onChange={(e) => setUnitCondition(e.target.value)}
                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none"
              >
                <option value="Brand New">Brand New</option>
                <option value="Refurbished">Refurbished</option>
                <option value="Demo Unit">Demo Unit</option>
                <option value="Good Condition">Good Condition</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 3: CLIENT INFORMATION */}
        <div>
          <h3 className="text-xs font-black text-red-600 tracking-wider uppercase border-b border-red-400 pb-1 mb-2">
            CLIENT INFORMATION
          </h3>
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                CLIENT NAME
              </label>
              <input
                type="text"
                placeholder="Full name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                COMPANY
              </label>
              <input
                type="text"
                placeholder="Company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                ADDRESS
              </label>
              <input
                type="text"
                placeholder="City / Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  CONTACT NO.
                </label>
                <input
                  type="text"
                  placeholder="09XX XXX XXXX"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                  EMAIL
                </label>
                <input
                  type="email"
                  placeholder="email@..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                DATE
              </label>
              <input
                type="date"
                value={quoteDate}
                onChange={(e) => setQuoteDate(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                SALUTATION
              </label>
              <input
                type="text"
                value={salutation}
                onChange={(e) => setSalutation(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                OPENING LINE
              </label>
              <textarea
                rows={2}
                value={openingLine}
                onChange={(e) => setOpeningLine(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: PAYMENT TERMS & FINANCING */}
        <div>
          <h3 className="text-xs font-black text-red-600 tracking-wider uppercase border-b border-red-400 pb-1 mb-2">
            TERMS & SIGNATORY
          </h3>
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                DEAL TYPE
              </label>
              <select
                value={dealType}
                onChange={(e) => setDealType(e.target.value as DealType)}
                className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none"
              >
                <option value="Cash">Cash (Discounted Promo)</option>
                <option value="PDC">PDC (30/60/90 Days)</option>
                <option value="In-House">In-House Financing</option>
                <option value="Straight">Straight Terms</option>
              </select>
            </div>

            {dealType === "In-House" && (
              <div className="p-2.5 bg-red-50/70 border border-red-200 rounded-md space-y-2">
                <div className="flex justify-between text-[11px] font-bold">
                  <span>Downpayment:</span>
                  <span className="text-red-700">{downPaymentPct}% ({formatCurrency(downpaymentAmount)})</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={downPaymentPct}
                  onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                  className="w-full accent-red-600 h-1.5"
                />

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">Interest %</label>
                    <input
                      type="number"
                      value={interestRatePct}
                      onChange={(e) => setInterestRatePct(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">Term (Mos)</label>
                    <select
                      value={termMonths}
                      onChange={(e) => setTermMonths(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                    >
                      <option value={6}>6 Months</option>
                      <option value={12}>12 Months</option>
                      <option value={18}>18 Months</option>
                      <option value={24}>24 Months</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                ACCOUNT EXECUTIVE
              </label>
              <input
                type="text"
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          {quoteSuccessMsg && (
            <div className="p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-bold rounded">
              ✓ {quoteSuccessMsg}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md shadow-xs transition-colors cursor-pointer"
            >
              Print / PDF
            </button>
            <button
              onClick={handleSaveQuote}
              disabled={saving}
              className="flex-1 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Quote"}
            </button>
          </div>
        </div>
      </aside>

      {/* RIGHT LIVE A4 SHEET PREVIEW (Exact Screenshot 1: ES logo with gradient bar, date on right, red divider, letter body, NO MACHINE SELECTED, signatures, footer) */}
      <section className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center">
        <div className="w-full max-w-[820px] min-h-[1050px] bg-white shadow-xl rounded-sm p-8 md:p-12 flex flex-col justify-between text-slate-800 font-sans border border-slate-200 print:shadow-none print:border-none print:m-0 print:p-8">
          {/* Top Letterhead Header */}
          <div>
            <div className="flex items-center justify-between gap-4">
              {/* Stylized Red ES Logo + Accent Bar */}
              <div className="flex items-center gap-3 flex-1">
                <div className="relative">
                  {/* Stylized ES Icon matching screenshot */}
                  <svg width="72" height="56" viewBox="0 0 100 75" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M10 15H42C44 15 45 17 43 19L38 27H18V35H36C38 35 39 37 37 39L32 47H18V55H42C44 55 45 57 43 59L38 67H8C4 67 2 64 2 60V22C2 18 4 15 10 15Z"
                      fill="#E11D48"
                    />
                    <path
                      d="M52 24C52 18 56 15 62 15H88C94 15 98 18 98 24V28C98 32 95 35 90 37L70 41C66 42 64 43 64 45V48C64 50 66 52 70 52H88V44H98V56C98 62 94 66 88 66H62C56 66 52 62 52 56V52C52 48 55 45 60 43L80 39C84 38 86 37 86 35V32C86 30 84 28 80 28H52V24Z"
                      fill="#E11D48"
                    />
                  </svg>
                </div>
                {/* Horizontal Pink Gradient Accent Bar */}
                <div className="flex-1 h-3.5 bg-gradient-to-r from-red-300 via-red-200/60 to-red-100/30 rounded-full" />
              </div>

              {/* Date */}
              <div className="text-right shrink-0">
                <span className="text-xs text-slate-700 font-medium">
                  Date: {formattedDate || "September 24, 2026"}
                </span>
              </div>
            </div>

            {/* Horizontal Dark Red Bar Divider */}
            <div className="w-full h-[2.5px] bg-[#991b1b] mt-3 mb-6" />

            {/* Salutation & Opening */}
            <div className="text-xs text-slate-800 space-y-1 leading-relaxed">
              <p className="font-semibold">{salutation}</p>
              <p>{openingLine}</p>
            </div>

            {/* Machine Content or NO MACHINE SELECTED */}
            <div className="my-8">
              {!selectedMachine ? (
                <div className="py-12 text-center">
                  <h4 className="text-base font-extrabold text-[#991b1b] tracking-wider uppercase">
                    NO MACHINE SELECTED
                  </h4>
                </div>
              ) : (
                <div className="space-y-4 border-t border-b border-slate-200 py-4 text-xs">
                  {/* Machine Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                        {selectedMachine.brand} {selectedMachine.model}
                      </h4>
                      <p className="text-slate-500 font-medium mt-0.5">
                        {selectedMachine.sub_model || "Printing Equipment"} · Condition: {unitCondition}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Quotation Price ({dealType})</span>
                      <span className="text-sm font-black text-red-600">
                        {formatCurrency(machinePrice)}
                      </span>
                    </div>
                  </div>

                  {/* Financial Breakdown Table */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <tbody>
                        <tr className="border-b border-slate-200/60">
                          <td className="py-1 text-slate-600">Payment Term:</td>
                          <td className="py-1 font-bold text-right text-slate-800">{dealType}</td>
                        </tr>
                        {dealType === "In-House" && (
                          <>
                            <tr className="border-b border-slate-200/60">
                              <td className="py-1 text-slate-600">Downpayment ({downPaymentPct}%):</td>
                              <td className="py-1 font-bold text-right text-slate-800">{formatCurrency(downpaymentAmount)}</td>
                            </tr>
                            <tr className="border-b border-slate-200/60">
                              <td className="py-1 text-slate-600">Monthly Amortization ({termMonths} mos):</td>
                              <td className="py-1 font-bold text-right text-red-600">{formatCurrency(financial.monthlyAmortization)} / mo</td>
                            </tr>
                          </>
                        )}
                        <tr>
                          <td className="py-1 text-slate-600">Total Proposal Amount:</td>
                          <td className="py-1 font-extrabold text-right text-slate-900">{formatCurrency(financial.contractPrice)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Machine Inclusions */}
                  {selectedMachine.inclusions && selectedMachine.inclusions.length > 0 && (
                    <div>
                      <span className="font-bold text-[11px] text-slate-700 block mb-1">Package Inclusions & Warranties:</span>
                      <ul className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 list-disc list-inside">
                        {selectedMachine.inclusions.map((inc, i) => (
                          <li key={i}>{inc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Closing text */}
            <div className="text-xs text-slate-700 leading-relaxed border-t border-slate-100 pt-4">
              <p>
                Trusting that the above quotation will receive your favorable consideration and assuring you of our best service at all times. Thank you very much.
              </p>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mt-12 text-xs">
              <div>
                <p className="text-slate-600">Very truly yours,</p>
                <div className="mt-14 border-b border-slate-700 w-full max-w-[240px]" />
                <p className="font-black text-slate-900 uppercase tracking-tight mt-1">
                  {signatoryName || "ACCOUNT EXECUTIVE"}
                </p>
                <p className="text-[10px] text-slate-400 italic">Signature over Printed Name</p>
              </div>

              <div>
                <p className="text-slate-600">Conforme:</p>
                <div className="mt-14 border-b border-slate-700 w-full max-w-[240px]" />
                <p className="font-black text-slate-900 uppercase tracking-tight mt-1">
                  {clientName || "CLIENT"}
                </p>
                <p className="text-[10px] text-slate-400 italic">Signature over Printed Name</p>
              </div>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="mt-12 pt-4">
            <div className="w-full h-[2px] bg-slate-300 mb-3" />
            <div className="flex items-center justify-end gap-1.5 text-xs font-bold text-slate-800">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>www.esprintmedia.com</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
