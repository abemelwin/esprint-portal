"use client";

import { useState, useMemo } from "react";

const DP_PRESETS = [0, 10, 20, 30, 50];
const RATE_PRESETS = [7, 10, 12, 14, 21, 28];
const TERM_PRESETS = [3, 6, 12, 18, 24];

interface DostRow {
  machine: string;
  dostVatIn: number;
  espmiPrice: number;
}

export function CalculatorClient() {
  const [activeTab, setActiveTab] = useState<"financial" | "dost">("financial");

  // Financial State
  const [basePrice, setBasePrice] = useState<number>(500000);
  const [downpayment, setDownpayment] = useState<number>(100000);
  const [annualInterestRate, setAnnualInterestRate] = useState<number>(14);
  const [termsMonths, setTermsMonths] = useState<number>(12);
  const [copiedFinancial, setCopiedFinancial] = useState(false);

  // DOST State
  const [dostRows, setDostRows] = useState<DostRow[]>([
    { machine: "CREONS 6090 UV FLATBED", dostVatIn: 850000, espmiPrice: 800000 },
  ]);
  const [copiedDost, setCopiedDost] = useState(false);

  // Calculations — ESPMI Formula
  const currentDpPercent = useMemo(() => {
    if (!basePrice || basePrice <= 0) return 0;
    return Math.round((downpayment / basePrice) * 100);
  }, [basePrice, downpayment]);

  const principalFinanced = useMemo(() => {
    return Math.max(0, (Number(basePrice) || 0) - (Number(downpayment) || 0));
  }, [basePrice, downpayment]);

  const totalInterest = useMemo(() => {
    const rate = Number(annualInterestRate) || 0;
    const terms = Number(termsMonths) || 0;
    if (rate === 7 || rate === 21 || rate === 28) {
      return principalFinanced * (rate / 100);
    }
    return principalFinanced * (rate / 100 / 12) * terms;
  }, [principalFinanced, annualInterestRate, termsMonths]);

  const contractPrice = useMemo(() => {
    return (Number(downpayment) || 0) + principalFinanced + totalInterest;
  }, [downpayment, principalFinanced, totalInterest]);

  const balance = useMemo(() => {
    return Math.max(0, contractPrice - (Number(downpayment) || 0));
  }, [contractPrice, downpayment]);

  const monthlyAmortization = useMemo(() => {
    const terms = Number(termsMonths) || 1;
    return terms > 0 ? balance / terms : 0;
  }, [balance, termsMonths]);

  function fmtCurrency(val: number): string {
    const n = Number(val) || 0;
    return "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function applyDpPercent(pct: number) {
    if (!basePrice) return;
    setDownpayment(Math.round((basePrice * pct) / 100));
  }

  function clearFinancial() {
    setBasePrice(0);
    setDownpayment(0);
    setAnnualInterestRate(0);
    setTermsMonths(0);
  }

  async function copyFinancialSummary() {
    const text = `=== ESPMI FINANCIAL CALCULATOR SUMMARY ===
BASE PRICE:             ${fmtCurrency(basePrice)}
DOWNPAYMENT:            ${fmtCurrency(downpayment)} (${currentDpPercent}%)
ANNUAL INTEREST RATE:   ${annualInterestRate}%
TERMS (IN MONTHS):      ${termsMonths} months
------------------------------------------
CONTRACT PRICE:         ${fmtCurrency(contractPrice)}
DOWNPAYMENT:            ${fmtCurrency(downpayment)}
BALANCE:                ${fmtCurrency(balance)}
TERMS:                  ${termsMonths} months
MONTHLY AMORTIZATION:   ${fmtCurrency(monthlyAmortization)} / month
------------------------------------------
Principal Financed:     ${fmtCurrency(principalFinanced)}
Total Interest Charges: ${fmtCurrency(totalInterest)}`;

    await navigator.clipboard.writeText(text);
    setCopiedFinancial(true);
    setTimeout(() => setCopiedFinancial(false), 2500);
  }

  // DOST Calculations
  const VAT_RATE = 0.12;
  const dostCalculations = useMemo(() => {
    return dostRows.map((r) => {
      const vat = r.dostVatIn - r.dostVatIn / (1 + VAT_RATE);
      const vatEx = r.dostVatIn / (1 + VAT_RATE);
      const op = vatEx - (r.espmiPrice || 0);
      return { ...r, vat, vatEx, op };
    });
  }, [dostRows]);

  const dostTotals = useMemo(() => {
    return {
      vatIn: dostCalculations.reduce((sum, r) => sum + (r.dostVatIn || 0), 0),
      vat: dostCalculations.reduce((sum, r) => sum + (r.vat || 0), 0),
      vatEx: dostCalculations.reduce((sum, r) => sum + (r.vatEx || 0), 0),
      espmi: dostCalculations.reduce((sum, r) => sum + (r.espmiPrice || 0), 0),
      op: dostCalculations.reduce((sum, r) => sum + (r.op || 0), 0),
      forEspmi: dostCalculations.reduce((sum, r) => sum + (r.vat || 0) + (r.espmiPrice || 0), 0),
    };
  }, [dostCalculations]);

  function addDostRow() {
    if (dostRows.length >= 10) return;
    setDostRows([...dostRows, { machine: "", dostVatIn: 0, espmiPrice: 0 }]);
  }

  function removeDostRow(idx: number) {
    if (dostRows.length <= 1) return;
    setDostRows(dostRows.filter((_, i) => i !== idx));
  }

  async function copyDostSummary() {
    const lines = dostCalculations
      .map(
        (r, i) =>
          `${r.machine || `Machine ${i + 1}`}: DOST ${fmtCurrency(r.dostVatIn)} | ESPMI ${fmtCurrency(r.espmiPrice)} | OP ${fmtCurrency(r.op)}`
      )
      .join("\n");

    const text = `=== DOST CALCULATOR SUMMARY ===
${lines}

TOTAL OVERPRICE FOR CLIENT:        ${fmtCurrency(dostTotals.op)}
TOTAL AMOUNT FOR ESPMI (VAT+COST): ${fmtCurrency(dostTotals.forEspmi)}
TOTAL FROM CLIENT:                  ${fmtCurrency(dostTotals.vatIn)}`;

    await navigator.clipboard.writeText(text);
    setCopiedDost(true);
    setTimeout(() => setCopiedDost(false), 2500);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto select-none">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab("financial")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "financial"
              ? "bg-[#c0392b] text-white shadow-md"
              : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          Financial Calculator
        </button>
        <button
          onClick={() => setActiveTab("dost")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "dost"
              ? "bg-[#c0392b] text-white shadow-md"
              : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
          }`}
        >
          DOST Calculator
        </button>
      </div>

      {activeTab === "financial" ? (
        <>
          {/* Header */}
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Machine Installment Calculator</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Compute Contract Price, Balance, and Monthly Amortizations instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* INPUTS CARD */}
            <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h2 className="text-xs font-bold text-[#c0392b] uppercase tracking-wider">
                  ⚙️ Calculation Inputs
                </h2>
                <button
                  onClick={clearFinancial}
                  className="text-[11px] font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
                >
                  🔄 Clear Inputs
                </button>
              </div>

              {/* Base Price */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Base Price (₱)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">₱</span>
                  <input
                    type="number"
                    value={basePrice || ""}
                    onChange={(e) => setBasePrice(Number(e.target.value) || 0)}
                    placeholder="e.g. 500,000"
                    className="w-full pl-8 pr-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:border-[#c0392b] focus:outline-none"
                  />
                </div>
              </div>

              {/* Downpayment */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-700">Downpayment (₱)</label>
                  <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                    {currentDpPercent}% of Base Price
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">₱</span>
                  <input
                    type="number"
                    value={downpayment || ""}
                    onChange={(e) => setDownpayment(Number(e.target.value) || 0)}
                    placeholder="e.g. 100,000"
                    className="w-full pl-8 pr-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:border-[#c0392b] focus:outline-none"
                  />
                </div>
                {/* Quick % pills */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-bold">Quick %:</span>
                  {DP_PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => applyDpPercent(p)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-colors ${
                        currentDpPercent === p
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Annual Interest Rate */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Annual Interest Rate (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={annualInterestRate || ""}
                    onChange={(e) => setAnnualInterestRate(Number(e.target.value) || 0)}
                    placeholder="e.g. 14"
                    className="w-full pl-3 pr-12 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:border-[#c0392b] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-bold text-xs">% / yr</span>
                </div>
                {/* Quick Rate pills */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-bold">Quick Rate:</span>
                  {RATE_PRESETS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setAnnualInterestRate(r)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-colors ${
                        annualInterestRate === r
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Terms in Months */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Payment Terms (in Months)</label>
                <input
                  type="number"
                  value={termsMonths || ""}
                  onChange={(e) => setTermsMonths(Number(e.target.value) || 0)}
                  placeholder="e.g. 12"
                  className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:border-[#c0392b] focus:outline-none"
                />
                {/* Quick Terms pills */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-bold">Quick Terms:</span>
                  {TERM_PRESETS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTermsMonths(t)}
                      className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md border transition-colors ${
                        termsMonths === t
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {t} Months
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RESULTS CARD */}
            <div className="lg:col-span-6 space-y-4">
              {/* Highlight Card */}
              <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">Monthly Amortization</span>
                  <button
                    onClick={copyFinancialSummary}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-slate-700"
                  >
                    {copiedFinancial ? "✓ Copied!" : "📋 Copy Summary"}
                  </button>
                </div>

                <div>
                  <div className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                    {fmtCurrency(monthlyAmortization)}
                    <span className="text-sm font-medium text-slate-400"> / month</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Payable for <span className="text-white font-bold">{termsMonths}</span> consecutive months
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800">
                  <div>
                    <span className="text-xs text-slate-400 block">Total Contract Price</span>
                    <span className="text-base font-bold text-white">{fmtCurrency(contractPrice)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Remaining Balance</span>
                    <span className="text-base font-bold text-white">{fmtCurrency(balance)}</span>
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Table */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-xs">
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100">
                  Detailed Calculation Breakdown
                </h3>
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Base Equipment Price</span>
                    <span className="font-bold text-slate-900">{fmtCurrency(basePrice)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Less: Downpayment ({currentDpPercent}%)</span>
                    <span className="font-bold text-red-600">- {fmtCurrency(downpayment)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Net Principal Financed</span>
                    <span className="font-bold text-slate-900">{fmtCurrency(principalFinanced)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Total Add-on Interest ({annualInterestRate}%)</span>
                    <span className="font-bold text-emerald-600">+ {fmtCurrency(totalInterest)}</span>
                  </div>
                  <div className="flex justify-between py-1 font-black text-slate-900 text-sm">
                    <span>Total Contract Price</span>
                    <span className="text-[#c0392b]">{fmtCurrency(contractPrice)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* DOST CALCULATOR */
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">DOST Equipment Breakdown Calculator</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Break down government bids with 12% VAT, ESPMI net price, and client overprice.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-[#c0392b] text-white">
                    <th className="py-2 px-3 font-semibold">Equipment Description</th>
                    <th className="py-2 px-3 font-semibold text-right">DOST Price (VAT Inc)</th>
                    <th className="py-2 px-3 font-semibold text-right">12% VAT</th>
                    <th className="py-2 px-3 font-semibold text-right">VAT Exclusive</th>
                    <th className="py-2 px-3 font-semibold text-right">ESPMI Base Price</th>
                    <th className="py-2 px-3 font-semibold text-right">Overprice / Comm</th>
                    <th className="py-2 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dostCalculations.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={row.machine}
                          onChange={(e) => {
                            const copy = [...dostRows];
                            copy[i].machine = e.target.value;
                            setDostRows(copy);
                          }}
                          placeholder={`Machine ${i + 1}`}
                          className="w-full px-2 py-1 border border-slate-300 rounded font-semibold text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          value={row.dostVatIn || ""}
                          onChange={(e) => {
                            const copy = [...dostRows];
                            copy[i].dostVatIn = Number(e.target.value) || 0;
                            setDostRows(copy);
                          }}
                          className="w-32 px-2 py-1 border border-slate-300 rounded font-bold text-xs text-right"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-600">{fmtCurrency(row.vat)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-800">{fmtCurrency(row.vatEx)}</td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          value={row.espmiPrice || ""}
                          onChange={(e) => {
                            const copy = [...dostRows];
                            copy[i].espmiPrice = Number(e.target.value) || 0;
                            setDostRows(copy);
                          }}
                          className="w-32 px-2 py-1 border border-slate-300 rounded font-bold text-xs text-right"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-black text-emerald-700">{fmtCurrency(row.op)}</td>
                      <td className="py-2 px-3 text-center">
                        {dostRows.length > 1 && (
                          <button
                            onClick={() => removeDostRow(i)}
                            className="text-red-500 hover:text-red-700 font-bold px-2 py-1"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={addDostRow}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                + Add Equipment Row
              </button>

              <button
                onClick={copyDostSummary}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                {copiedDost ? "✓ Copied DOST Summary!" : "📋 Copy DOST Summary"}
              </button>
            </div>

            {/* DOST Totals Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 block">TOTAL FROM CLIENT (VAT INC)</span>
                <span className="text-xl font-black text-slate-900">{fmtCurrency(dostTotals.vatIn)}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 block">ESPMI REVENUE (VAT + COST)</span>
                <span className="text-xl font-black text-blue-700">{fmtCurrency(dostTotals.forEspmi)}</span>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-xs text-emerald-700 block font-bold">TOTAL OVERPRICE / COMMISSION</span>
                <span className="text-xl font-black text-emerald-800">{fmtCurrency(dostTotals.op)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
