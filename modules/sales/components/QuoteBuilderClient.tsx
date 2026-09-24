"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { CatalogMachine, DealType, LetterheadType, Quote } from "../types";
import { formatCurrency, computeFinancial } from "../lib/calculator";

interface TermOption {
  dealType: string;
  contractPrice: number | null;
  downPayment: number;
  months: number;
  monthlyAmortization: number | null;
}

interface TradeInItem {
  description: string;
  value: number;
}

interface CustomItem {
  id: string;
  description: string;
  enabled: boolean;
}

export function QuoteBuilderClient({
  currentUserEmail,
  currentUserName,
}: {
  currentUserEmail: string;
  currentUserName: string;
}) {
  const [catalog, setCatalog] = useState<CatalogMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quoteSuccessMsg, setQuoteSuccessMsg] = useState("");

  // Letterhead & Machine
  const [letterhead, setLetterhead] = useState<LetterheadType>("ES Print Media Inc.");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [unitCondition, setUnitCondition] = useState<"Brand New" | "Re-certified" | "Demo Unit">("Brand New");

  // Client Information
  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [salutation, setSalutation] = useState("Dear Ma'am / Sir,");
  const [openingLine, setOpeningLine] = useState(
    "Thank you for your interest in our products and services. Below is our quote as per your inquiry:"
  );

  // Deal Type & Pricing
  const [dealType, setDealType] = useState<"Standard Cash" | "Standard Terms" | "Trade-In Cash" | "Trade-In Terms">("Standard Cash");
  const [contractPrice, setContractPrice] = useState<number>(0);
  const [vatInclusive, setVatInclusive] = useState(false);
  const [downpayment, setDownpayment] = useState<number>(0);
  const [termMonths, setTermMonths] = useState<number>(12);

  // Trade-in items (3 rows)
  const [tradeIns, setTradeIns] = useState<TradeInItem[]>([
    { description: "", value: 0 },
    { description: "", value: 0 },
    { description: "", value: 0 },
  ]);

  // Additional Term Options
  const [termOptions, setTermOptions] = useState<TermOption[]>([
    { dealType: "Installment", contractPrice: null, downPayment: 0, months: 12, monthlyAmortization: null },
  ]);

  // Inclusions & Exclusions
  const [inclusions, setInclusions] = useState<CustomItem[]>([
    { id: "inc-1", description: "Main Equipment Unit & Accessories", enabled: true },
    { id: "inc-2", description: "RIP Software & License Dongle", enabled: true },
    { id: "inc-3", description: "Free 1 Set CMYK Inks / Starter Kit", enabled: true },
    { id: "inc-4", description: "On-site Installation & Technical Training", enabled: true },
    { id: "inc-5", description: "1-Year Full Technical Warranty", enabled: true },
  ]);
  const [newInclusionText, setNewInclusionText] = useState("");
  const [showInclusionInput, setShowInclusionInput] = useState(false);

  const [exclusions, setExclusions] = useState<CustomItem[]>([
    { id: "exc-1", description: "Value Added Tax (12% VAT)", enabled: true },
    { id: "exc-2", description: "Freight & Hauling outside Metro Manila", enabled: true },
    { id: "exc-3", description: "Electrical Power AVR / UPS & Dedicated Wiring", enabled: true },
    { id: "exc-4", description: "Computer Desktop / Laptop for RIP Workstation", enabled: true },
  ]);
  const [newExclusionText, setNewExclusionText] = useState("");
  const [showExclusionInput, setShowExclusionInput] = useState(false);

  // Consumables custom price list
  const [consumablePrices, setConsumablePrices] = useState<{ id: string; name: string; pkg: string; price: number }[]>([]);

  // Signatories
  const [signatoryName, setSignatoryName] = useState(currentUserName || "ACCOUNT EXECUTIVE");
  const [signatoryRole, setSignatoryRole] = useState("Account Executive");
  const [clientConforme, setClientConforme] = useState("");
  const [notedByName, setNotedByName] = useState("Ness Deomano");
  const [notedByRole, setNotedByRole] = useState("Area Sales Manager");

  async function loadInitialData() {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/catalog");
      const data = await res.json();
      if (data.machines && data.machines.length > 0) {
        setCatalog(data.machines);
        const first = data.machines[0];
        setSelectedBrand(first.brand);
        setSelectedModel(first.model);
        setContractPrice(first.srp || 0);
        if (first.consumables && first.consumables.length > 0) {
          setConsumablePrices(
            first.consumables.map((c: any, i: number) => ({
              id: c.id || `c-${i}`,
              name: c.item_name,
              pkg: c.package_description || "",
              price: c.default_price,
            }))
          );
        }
      }
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

  // Update machine details on select
  useEffect(() => {
    if (selectedMachine) {
      setContractPrice(selectedMachine.srp || 0);
      setUnitCondition(selectedMachine.unit_condition || "Brand New");
      if (selectedMachine.consumables && selectedMachine.consumables.length > 0) {
        setConsumablePrices(
          selectedMachine.consumables.map((c, i) => ({
            id: c.id || `c-${i}`,
            name: c.item_name,
            pkg: c.package_description || "",
            price: c.default_price,
          }))
        );
      }
      if (selectedMachine.inclusions && selectedMachine.inclusions.length > 0) {
        setInclusions(
          selectedMachine.inclusions.map((inc, i) => ({
            id: `inc-${i}`,
            description: inc,
            enabled: true,
          }))
        );
      }
    }
  }, [selectedMachine]);

  const showTradeIns = dealType === "Trade-In Cash" || dealType === "Trade-In Terms";
  const tradeInSum = useMemo(
    () => (showTradeIns ? tradeIns.reduce((acc, ti) => acc + (Number(ti.value) || 0), 0) : 0),
    [showTradeIns, tradeIns]
  );

  const netContractPrice = Math.max(0, contractPrice - tradeInSum);

  // Auto-calculate monthly amortizations for term options
  const computedTermOptions = useMemo(() => {
    return termOptions.map((opt) => {
      const price = opt.contractPrice !== null ? opt.contractPrice : netContractPrice;
      const dp = opt.downPayment || 0;
      const principal = Math.max(0, price - dp);
      // Flat 14% p.a. standard
      const interest = principal * (0.14 / 12) * (opt.months || 12);
      const balance = principal + interest;
      const monthly = (opt.months || 12) > 0 ? balance / (opt.months || 12) : 0;
      return {
        ...opt,
        balance,
        monthlyAmortization: monthly,
      };
    });
  }, [termOptions, netContractPrice]);

  function addTermOption() {
    if (termOptions.length >= 5) return;
    setTermOptions([
      ...termOptions,
      { dealType: "Installment", contractPrice: null, downPayment: 0, months: 12, monthlyAmortization: null },
    ]);
  }

  function removeTermOption(idx: number) {
    if (termOptions.length <= 1) return;
    setTermOptions(termOptions.filter((_, i) => i !== idx));
  }

  function handleAddInclusion() {
    if (!newInclusionText.trim()) return;
    setInclusions([...inclusions, { id: `inc-${Date.now()}`, description: newInclusionText.trim(), enabled: true }]);
    setNewInclusionText("");
    setShowInclusionInput(false);
  }

  function handleAddExclusion() {
    if (!newExclusionText.trim()) return;
    setExclusions([...exclusions, { id: `exc-${Date.now()}`, description: newExclusionText.trim(), enabled: true }]);
    setNewExclusionText("");
    setShowExclusionInput(false);
  }

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
          total_amount: contractPrice,
          monthly_payment: computedTermOptions[0]?.monthlyAmortization || 0,
          signatory_name: signatoryName,
          signatory_title: signatoryRole,
          items: selectedMachine
            ? [
                {
                  machine_id: selectedMachine.id,
                  machine_name: `${selectedMachine.brand} ${selectedMachine.model}`,
                  unit_price: contractPrice,
                  quantity: 1,
                  total_price: contractPrice,
                },
              ]
            : [],
        }),
      });

      if (res.ok) {
        const d = await res.json();
        setQuoteSuccessMsg(`Quote created successfully: ${d.quoteNumber}`);
        setTimeout(() => setQuoteSuccessMsg(""), 4000);
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
        return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      }
      return quoteDate;
    } catch {
      return quoteDate;
    }
  }, [quoteDate]);

  const letterheadHeaderImg =
    letterhead === "ACS / Alternative" ? "/letterhead/letterhead-acs-1.jpg" : "/letterhead/letterhead-espmi-1.jpg";
  const letterheadFooterImg =
    letterhead === "ACS / Alternative" ? "/letterhead/letterhead-acs-2.jpg" : "/letterhead/letterhead-espmi-2.jpg";

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-96px)] bg-[#eef4fb]">
      {/* ─── LEFT FORM PANEL (Exact matching QuoteFormPanel.vue) ─── */}
      <aside className="w-full lg:w-[360px] shrink-0 bg-white border-r-2 border-[#c0392b] flex flex-col overflow-y-auto shadow-md print:hidden select-none">
        {/* Header Title */}
        <div className="text-center py-2.5 px-4 border-b border-slate-100 shrink-0">
          <div className="text-sm font-black text-[#c0392b] tracking-wide">ES PRINT MEDIA INC.</div>
          <div className="text-[10px] text-slate-400 italic">Quotation Generator</div>
        </div>

        <div className="p-3 space-y-3.5 text-xs text-slate-700 flex-1">
          {/* 1. LETTERHEAD */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-wider border-b-[1.5px] border-[#c0392b] pb-0.5 mb-2">
              Letterhead
            </h2>
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-600 uppercase">Select Letterhead</label>
              <select
                value={letterhead}
                onChange={(e) => setLetterhead(e.target.value as LetterheadType)}
                className="w-full text-xs font-semibold px-2.5 py-1 bg-white border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none"
              >
                <option value="ES Print Media Inc.">ES Print Media Inc.</option>
                <option value="ACS / Alternative">ACS / Alternative</option>
              </select>
            </div>
          </div>

          {/* 2. MACHINE */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-wider border-b-[1.5px] border-[#c0392b] pb-0.5 mb-2">
              Machine
            </h2>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Brand</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    const first = catalog.find((m) => m.brand === e.target.value);
                    if (first) setSelectedModel(first.model);
                  }}
                  className="w-full text-xs font-semibold px-2.5 py-1 bg-white border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none"
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
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Machine Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={!selectedBrand}
                  className="w-full text-xs font-semibold px-2.5 py-1 bg-white border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none disabled:bg-slate-100"
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
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Unit Condition</label>
                <select
                  value={unitCondition}
                  onChange={(e) => setUnitCondition(e.target.value as any)}
                  className="w-full text-xs font-semibold px-2.5 py-1 bg-white border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none"
                >
                  <option value="Brand New">Brand New</option>
                  <option value="Re-certified">Re-certified</option>
                  <option value="Demo Unit">Demo Unit</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. CLIENT INFORMATION */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-wider border-b-[1.5px] border-[#c0392b] pb-0.5 mb-2">
              Client Information
            </h2>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Client Name</label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full text-xs px-2.5 py-1 border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Company</label>
                <input
                  type="text"
                  placeholder="Company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full text-xs px-2.5 py-1 border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Address</label>
                <input
                  type="text"
                  placeholder="City / Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs px-2.5 py-1 border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Contact No.</label>
                  <input
                    type="text"
                    placeholder="09XX XXX XXXX"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="w-full text-xs px-2.5 py-1 border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Email</label>
                  <input
                    type="email"
                    placeholder="email@..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs px-2.5 py-1 border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Date</label>
                <input
                  type="date"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1 border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Salutation</label>
                <input
                  type="text"
                  value={salutation}
                  onChange={(e) => setSalutation(e.target.value)}
                  className="w-full text-xs px-2.5 py-1 border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Opening Line</label>
                <textarea
                  rows={2}
                  value={openingLine}
                  onChange={(e) => setOpeningLine(e.target.value)}
                  className="w-full text-xs px-2.5 py-1 border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* 4. DEAL TYPE */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-wider border-b-[1.5px] border-[#c0392b] pb-0.5 mb-2">
              Deal Type
            </h2>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Type of Deal</label>
              <select
                value={dealType}
                onChange={(e) => setDealType(e.target.value as any)}
                className="w-full text-xs font-semibold px-2.5 py-1 bg-white border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none"
              >
                <option value="Standard Cash">Standard Cash</option>
                <option value="Standard Terms">Standard Terms</option>
                <option value="Trade-In Cash">Trade-In Cash</option>
                <option value="Trade-In Terms">Trade-In Terms</option>
              </select>
            </div>
          </div>

          {/* 5. PRICING */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-wider border-b-[1.5px] border-[#c0392b] pb-0.5 mb-2">
              Pricing
            </h2>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Contract Price (PHP)</label>
                <input
                  type="number"
                  value={contractPrice || ""}
                  onChange={(e) => setContractPrice(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full text-xs font-bold px-2.5 py-1 border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none"
                />
              </div>

              {/* Trade In Rows */}
              {showTradeIns && (
                <div className="p-2 bg-slate-50 border border-slate-200 rounded space-y-2">
                  <span className="font-bold text-[10px] text-slate-700 uppercase block">Trade-In Units</span>
                  {tradeIns.map((ti, i) => (
                    <div key={i} className="grid grid-cols-5 gap-1.5">
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder={`Value ${i + 1}`}
                          value={ti.value || ""}
                          onChange={(e) => {
                            const copy = [...tradeIns];
                            copy[i].value = Number(e.target.value) || 0;
                            setTradeIns(copy);
                          }}
                          className="w-full text-[11px] px-2 py-0.5 border border-slate-300 rounded"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder={`Unit ${i + 1} model/spec`}
                          value={ti.description}
                          onChange={(e) => {
                            const copy = [...tradeIns];
                            copy[i].description = e.target.value;
                            setTradeIns(copy);
                          }}
                          className="w-full text-[11px] px-2 py-0.5 border border-slate-300 rounded"
                        />
                      </div>
                    </div>
                  ))}
                  {tradeInSum > 0 && (
                    <div className="text-[11px] font-bold text-red-700 text-right pt-1">
                      Total Trade-In: {formatCurrency(tradeInSum)}
                    </div>
                  )}
                </div>
              )}

              {/* Term Options */}
              {(dealType === "Standard Terms" || dealType === "Trade-In Terms") && (
                <div className="space-y-2 pt-1">
                  <label className="block text-[10px] font-semibold text-slate-600 uppercase">Payment Term Options</label>
                  {termOptions.map((opt, idx) => (
                    <div key={idx} className="p-2 bg-red-50/50 border border-red-200 rounded space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold text-red-700">
                        <span>Option {idx + 1}</span>
                        {termOptions.length > 1 && (
                          <button type="button" onClick={() => removeTermOption(idx)} className="text-red-500 hover:text-red-800">
                            ✕ Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[9px] text-slate-500 block">Downpayment (PHP)</label>
                          <input
                            type="number"
                            value={opt.downPayment || ""}
                            onChange={(e) => {
                              const copy = [...termOptions];
                              copy[idx].downPayment = Number(e.target.value) || 0;
                              setTermOptions(copy);
                            }}
                            placeholder="0"
                            className="w-full text-[11px] px-2 py-0.5 border border-slate-300 rounded bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500 block">Terms (Months)</label>
                          <select
                            value={opt.months}
                            onChange={(e) => {
                              const copy = [...termOptions];
                              copy[idx].months = Number(e.target.value) || 12;
                              setTermOptions(copy);
                            }}
                            className="w-full text-[11px] px-2 py-0.5 border border-slate-300 rounded bg-white"
                          >
                            <option value={3}>3 Months</option>
                            <option value={6}>6 Months</option>
                            <option value={12}>12 Months</option>
                            <option value={18}>18 Months</option>
                            <option value={24}>24 Months</option>
                            <option value={36}>36 Months</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}

                  {termOptions.length < 5 && (
                    <button
                      type="button"
                      onClick={addTermOption}
                      className="w-full py-1 text-[11px] font-bold text-[#c0392b] border border-dashed border-[#c0392b] rounded hover:bg-red-50"
                    >
                      + Add Term Option
                    </button>
                  )}
                </div>
              )}

              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={vatInclusive}
                  onChange={(e) => setVatInclusive(e.target.checked)}
                  className="rounded accent-[#c0392b]"
                />
                <span className="font-semibold">VAT Inclusive</span>
              </label>
            </div>
          </div>

          {/* 6. FREEBIES & INCLUSIONS */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-wider border-b-[1.5px] border-[#c0392b] pb-0.5 mb-2">
              Package Inclusions
            </h2>
            <div className="space-y-1">
              {inclusions.map((inc) => (
                <label key={inc.id} className="flex items-start gap-1.5 text-[11px] text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inc.enabled}
                    onChange={(e) => {
                      setInclusions(inclusions.map((x) => (x.id === inc.id ? { ...x, enabled: e.target.checked } : x)));
                    }}
                    className="mt-0.5 rounded accent-[#c0392b]"
                  />
                  <span>{inc.description}</span>
                </label>
              ))}

              {showInclusionInput ? (
                <div className="flex gap-1 pt-1">
                  <input
                    type="text"
                    placeholder="Custom inclusion..."
                    value={newInclusionText}
                    onChange={(e) => setNewInclusionText(e.target.value)}
                    className="flex-1 text-[11px] px-2 py-0.5 border border-slate-300 rounded"
                  />
                  <button type="button" onClick={handleAddInclusion} className="px-2 py-0.5 bg-[#c0392b] text-white rounded text-[10px] font-bold">
                    Add
                  </button>
                  <button type="button" onClick={() => setShowInclusionInput(false)} className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px]">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowInclusionInput(true)}
                  className="text-[10px] font-bold text-[#c0392b] hover:underline pt-1 block"
                >
                  + Add Custom Inclusion
                </button>
              )}
            </div>
          </div>

          {/* 7. EXCLUSIONS */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-wider border-b-[1.5px] border-[#c0392b] pb-0.5 mb-2">
              Exclusions
            </h2>
            <div className="space-y-1">
              {exclusions.map((exc) => (
                <label key={exc.id} className="flex items-start gap-1.5 text-[11px] text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exc.enabled}
                    onChange={(e) => {
                      setExclusions(exclusions.map((x) => (x.id === exc.id ? { ...x, enabled: e.target.checked } : x)));
                    }}
                    className="mt-0.5 rounded accent-[#c0392b]"
                  />
                  <span>{exc.description}</span>
                </label>
              ))}

              {showExclusionInput ? (
                <div className="flex gap-1 pt-1">
                  <input
                    type="text"
                    placeholder="Custom exclusion..."
                    value={newExclusionText}
                    onChange={(e) => setNewExclusionText(e.target.value)}
                    className="flex-1 text-[11px] px-2 py-0.5 border border-slate-300 rounded"
                  />
                  <button type="button" onClick={handleAddExclusion} className="px-2 py-0.5 bg-[#c0392b] text-white rounded text-[10px] font-bold">
                    Add
                  </button>
                  <button type="button" onClick={() => setShowExclusionInput(false)} className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px]">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowExclusionInput(true)}
                  className="text-[10px] font-bold text-[#c0392b] hover:underline pt-1 block"
                >
                  + Add Custom Exclusion
                </button>
              )}
            </div>
          </div>

          {/* 8. SIGNATORIES */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-wider border-b-[1.5px] border-[#c0392b] pb-0.5 mb-2">
              Signatories
            </h2>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Account Executive</label>
                <input
                  type="text"
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  className="w-full text-xs px-2.5 py-1 border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-0.5">Client Conforme</label>
                <input
                  type="text"
                  placeholder="Client Authorized Signatory"
                  value={clientConforme}
                  onChange={(e) => setClientConforme(e.target.value)}
                  className="w-full text-xs px-2.5 py-1 border border-slate-300 rounded focus:border-[#c0392b] focus:outline-none"
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

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full py-2.5 bg-[#c0392b] hover:bg-[#a93226] text-white font-bold text-xs rounded shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>💾</span> SAVE AS PDF / PRINT
            </button>

            <button
              type="button"
              onClick={handleSaveQuote}
              disabled={saving}
              className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Formal Quote"}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── RIGHT LIVE DOCUMENT PREVIEW (Exact matching QuotePreviewPanel.vue) ─── */}
      <section className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center">
        <div className="w-full max-w-[800px] min-h-[1100px] bg-white shadow-2xl rounded-sm p-8 sm:p-12 flex flex-col justify-between text-slate-800 font-sans border border-slate-200 print:shadow-none print:border-none print:m-0 print:p-8">
          <div>
            {/* Top Letterhead Image */}
            <div className="w-full border-b border-slate-100 mb-4">
              <img
                src={letterheadHeaderImg}
                alt={`${letterhead} Header`}
                className="w-full h-auto object-contain block"
              />
            </div>

            {/* Proposal Date */}
            <div className="text-right text-[11px] text-slate-600 font-medium mb-3">
              Date: {formattedDate || "September 24, 2026"}
            </div>

            {/* Client block */}
            {(clientName || companyName || address || contactNumber || email) && (
              <div className="text-xs text-slate-700 leading-snug space-y-0.5 mb-4">
                {clientName && <p className="font-bold text-slate-900">{clientName}</p>}
                {companyName && <p>{companyName}</p>}
                {address && <p>{address}</p>}
                {contactNumber && <p>Tel: {contactNumber}</p>}
                {email && <p>Email: {email}</p>}
              </div>
            )}

            {/* Salutation & Intro */}
            <div className="text-xs text-slate-800 space-y-1 mb-4 leading-relaxed">
              <p className="font-semibold">{salutation}</p>
              <p>{openingLine}</p>
            </div>

            {/* Machine Content */}
            {!selectedMachine ? (
              <div className="my-10 text-center py-6 text-red-700 font-black text-sm tracking-wider uppercase border-t border-b border-red-100">
                NO MACHINE SELECTED
              </div>
            ) : (
              <div className="space-y-4 my-4 text-xs">
                {/* Machine Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      {selectedMachine.brand} {selectedMachine.model}
                    </h3>
                    <span
                      className={`text-[9.5px] font-black px-2 py-0.5 rounded tracking-wider uppercase ${
                        unitCondition === "Brand New"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {unitCondition}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Quotation Price</span>
                    <span className="text-sm font-black text-[#c0392b]">{formatCurrency(contractPrice)}</span>
                  </div>
                </div>

                {/* PRICING TABLE */}
                <div>
                  <div className="text-[10px] font-bold text-[#c0392b] uppercase tracking-wider mb-1">
                    Pricing & Payment Schedule
                  </div>
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#c0392b] text-white">
                        <th className="py-1.5 px-2 text-left font-semibold">Model</th>
                        <th className="py-1.5 px-2 text-right font-semibold">Contract Price</th>
                        {showTradeIns && <th className="py-1.5 px-2 text-right font-semibold">Trade-In Value</th>}
                        <th className="py-1.5 px-2 text-right font-semibold">Down Payment</th>
                        <th className="py-1.5 px-2 text-right font-semibold">Balance</th>
                        <th className="py-1.5 px-2 text-center font-semibold">Payment Terms</th>
                        <th className="py-1.5 px-2 text-right font-semibold">Monthly Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 border border-slate-200">
                      {dealType === "Standard Cash" || dealType === "Trade-In Cash" ? (
                        <tr>
                          <td className="py-1.5 px-2 font-bold">{selectedMachine.model}</td>
                          <td className="py-1.5 px-2 text-right font-semibold">{formatCurrency(contractPrice)}</td>
                          {showTradeIns && <td className="py-1.5 px-2 text-right text-red-600 font-bold">{formatCurrency(tradeInSum)}</td>}
                          <td className="py-1.5 px-2 text-right">—</td>
                          <td className="py-1.5 px-2 text-right font-bold text-slate-900">{formatCurrency(netContractPrice)}</td>
                          <td className="py-1.5 px-2 text-center">Cash</td>
                          <td className="py-1.5 px-2 text-right">—</td>
                        </tr>
                      ) : (
                        computedTermOptions.map((opt, i) => (
                          <tr key={i}>
                            <td className="py-1.5 px-2 font-bold">{i === 0 ? selectedMachine.model : `Option ${i + 1}`}</td>
                            <td className="py-1.5 px-2 text-right font-semibold">{formatCurrency(contractPrice)}</td>
                            {showTradeIns && <td className="py-1.5 px-2 text-right text-red-600 font-bold">{formatCurrency(tradeInSum)}</td>}
                            <td className="py-1.5 px-2 text-right font-medium">{formatCurrency(opt.downPayment)}</td>
                            <td className="py-1.5 px-2 text-right font-bold text-slate-900">{formatCurrency(opt.balance)}</td>
                            <td className="py-1.5 px-2 text-center">{opt.months} Months</td>
                            <td className="py-1.5 px-2 text-right font-black text-[#c0392b]">{formatCurrency(opt.monthlyAmortization)} / mo</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {vatInclusive && (
                    <div className="text-[10px] font-bold text-[#c0392b] text-right mt-0.5">
                      * VAT INCLUSIVE
                    </div>
                  )}
                </div>

                {/* TWO-COLUMN INCLUSIONS & EXCLUSIONS */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <div className="bg-[#c0392b] text-white text-[10px] font-bold uppercase px-2.5 py-1">
                      Package Inclusions
                    </div>
                    <ul className="p-2 space-y-1 list-disc list-inside text-[10.5px] text-slate-700">
                      {inclusions.filter((x) => x.enabled).map((inc) => (
                        <li key={inc.id}>{inc.description}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="border border-slate-200 rounded overflow-hidden">
                    <div className="bg-slate-700 text-white text-[10px] font-bold uppercase px-2.5 py-1">
                      Exclusive (Client Provision)
                    </div>
                    <ul className="p-2 space-y-1 list-disc list-inside text-[10.5px] text-slate-700">
                      {exclusions.filter((x) => x.enabled).map((exc) => (
                        <li key={exc.id}>{exc.description}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CONSUMABLES TABLE */}
                {consumablePrices.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[10px] font-bold text-[#c0392b] uppercase tracking-wider mb-1">
                      Standard Consumables & Ink Pricing
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10.5px]">
                      {consumablePrices.map((c) => (
                        <div key={c.id} className="flex justify-between border-b border-slate-100 py-0.5">
                          <span className="text-slate-700 font-medium">{c.name} {c.pkg ? `(${c.pkg})` : ""}</span>
                          <span className="text-[#c0392b] font-bold">{formatCurrency(c.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Closing text */}
            <div className="text-xs text-slate-700 leading-relaxed border-t border-slate-200 pt-3 mt-4">
              <p>
                Trusting that the above quotation will receive your favorable consideration and assuring you of our best service at all times. Thank you very much.
              </p>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mt-8 text-xs">
              <div>
                <p className="text-slate-600">Very truly yours,</p>
                <div className="mt-12 border-b border-slate-800 w-full max-w-[240px]" />
                <p className="font-black text-slate-900 uppercase tracking-tight mt-1">
                  {signatoryName || "ACCOUNT EXECUTIVE"}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">{signatoryRole || "Account Executive"}</p>
                <p className="text-[9.5px] text-slate-400 italic">Signature over Printed Name</p>
              </div>

              <div>
                <p className="text-slate-600">Conforme:</p>
                <div className="mt-12 border-b border-slate-800 w-full max-w-[240px]" />
                <p className="font-black text-slate-900 uppercase tracking-tight mt-1">
                  {clientConforme || clientName || "AUTHORIZED SIGNATORY"}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">Authorized Client Representative</p>
                <p className="text-[9.5px] text-slate-400 italic">Signature over Printed Name</p>
              </div>
            </div>
          </div>

          {/* Bottom Letterhead Footer Image */}
          <div className="w-full border-t border-slate-100 mt-6 pt-2">
            <img
              src={letterheadFooterImg}
              alt={`${letterhead} Footer`}
              className="w-full h-auto object-contain block"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
