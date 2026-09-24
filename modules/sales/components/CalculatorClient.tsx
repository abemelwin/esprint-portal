"use client";

import { useState } from "react";
import { computeFinancial, formatCurrency } from "../lib/calculator";

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

  // Financial Calc State
  const [basePrice, setBasePrice] = useState<number>(500000);
  const [downpayment, setDownpayment] = useState<number>(100000);
  const [interestRate, setInterestRate] = useState<number>(14);
  const [termMonths, setTermMonths] = useState<number>(12);
  const [copiedFinancial, setCopiedFinancial] = useState(false);

  // DOST Calc State
  const [dostRows, setDostRows] = useState<DostRow[]>([
    { machine: "CREONS 6090 UV FLATBED", dostVatIn: 850000, espmiPrice: 800000 },
  ]);
  const [copiedDost, setCopiedDost] = useState(false);

  // Financial Result
  const result = computeFinancial(basePrice, downpayment, interestRate, termMonths);

  function applyDpPercent(pct: number) {
    const dp = Math.round((basePrice * pct) / 100);
    setDownpayment(dp);
  }

  async function copyFinancialSummary() {
    const text = `=== ESPMI FINANCIAL CALCULATOR SUMMARY ===
BASE PRICE:             ${formatCurrency(result.basePrice)}
DOWNPAYMENT:            ${formatCurrency(result.downpayment)} (${result.dpPercent}%)
ANNUAL INTEREST RATE:   ${result.annualInterestRate}%
TERMS (IN MONTHS):      ${result.termsMonths} months
------------------------------------------
CONTRACT PRICE:         ${formatCurrency(result.contractPrice)}
DOWNPAYMENT:            ${formatCurrency(result.downpayment)}
BALANCE:                ${formatCurrency(result.balance)}
TERMS:                  ${result.termsMonths} months
MONTHLY AMORTIZATION:   ${formatCurrency(result.monthlyAmortization)} / month
------------------------------------------`;

    await navigator.clipboard.writeText(text);
    setCopiedFinancial(true);
    setTimeout(() => setCopiedFinancial(false), 2000);
  }

  // DOST Computations
  const VAT_RATE = 0.12;
  const dostCalculations = dostRows.map((r) => {
    const vat = r.dostVatIn - r.dostVatIn / (1 + VAT_RATE);
    const vatEx = r.dostVatIn / (1 + VAT_RATE);
    const op = vatEx - (r.espmiPrice || 0);
    return { ...r, vat, vatEx, op };
  });

  const dostTotals = {
    vatIn: dostCalculations.reduce((acc, r) => acc + r.dostVatIn, 0),
    vat: dostCalculations.reduce((acc, r) => acc + r.vat, 0),
    vatEx: dostCalculations.reduce((acc, r) => acc + r.vatEx, 0),
    espmi: dostCalculations.reduce((acc, r) => acc + r.espmiPrice, 0),
    op: dostCalculations.reduce((acc, r) => acc + r.op, 0),
  };

  async function copyDostSummary() {
    const lines = dostCalculations
      .map(
        (r, i) =>
          `${r.machine || `Machine ${i + 1}`}: DOST ${formatCurrency(r.dostVatIn)} | ESPMI ${formatCurrency(r.espmiPrice)} | OP ${formatCurrency(r.op)}`
      )
      .join("\n");

    const text = `=== DOST CALCULATOR SUMMARY ===
${lines}

TOTAL OVERPRICE FOR CLIENT:        ${formatCurrency(dostTotals.op)}
TOTAL AMOUNT FOR ESPMI (VAT+COST): ${formatCurrency(dostTotals.vat + dostTotals.espmi)}
TOTAL FROM CLIENT:                  ${formatCurrency(dostTotals.vatIn)}`;

    await navigator.clipboard.writeText(text);
    setCopiedDost(true);
    setTimeout(() => setCopiedDost(false), 2000);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
            Deal Financial Calculator
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Calculate payment schedules, monthly amortizations, in-house financing & DOST bids.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab("financial")}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === "financial"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Financial Terms Calculator
          </button>
          <button
            onClick={() => setActiveTab("dost")}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === "dost"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            DOST / Gov Bids Breakdown
          </button>
        </div>
      </div>

      {activeTab === "financial" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Inputs Form */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              Deal Parameters
            </h2>

            {/* Base Price */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Machine Base Price (PHP)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">₱</span>
                <input
                  type="number"
                  value={basePrice || ""}
                  onChange={(e) => setBasePrice(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2.5 text-base font-bold text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Downpayment */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Downpayment (PHP)</label>
                <span className="text-xs font-bold text-blue-600">{result.dpPercent}% of Base</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">₱</span>
                <input
                  type="number"
                  value={downpayment || ""}
                  onChange={(e) => setDownpayment(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2.5 text-base font-bold text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              {/* DP Presets */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10.5px] text-slate-400 font-medium mr-1">Presets:</span>
                {DP_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => applyDpPercent(pct)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                      result.dpPercent === pct
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Interest Rate */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Annual Interest Rate (%)</label>
                <span className="text-xs font-bold text-slate-500">{interestRate}%</span>
              </div>
              <input
                type="number"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
              />

              {/* Rate Presets */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10.5px] text-slate-400 font-medium mr-1">Standard Rates:</span>
                {RATE_PRESETS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setInterestRate(r)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                      interestRate === r
                        ? "bg-red-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>

            {/* Terms in Months */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Payment Terms (Months)</label>
                <span className="text-xs font-bold text-slate-500">{termMonths} mos</span>
              </div>
              <input
                type="number"
                value={termMonths}
                onChange={(e) => setTermMonths(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
              />

              {/* Term Presets */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10.5px] text-slate-400 font-medium mr-1">Preset Terms:</span>
                {TERM_PRESETS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTermMonths(t)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                      termMonths === t
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {t} Months
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Summary & Breakdown */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Monthly Amortization
                  </span>
                  <button
                    onClick={copyFinancialSummary}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    {copiedFinancial ? "✓ Copied!" : "Copy Summary"}
                  </button>
                </div>

                <div>
                  <p className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-400">
                    {formatCurrency(result.monthlyAmortization)}
                    <span className="text-xs font-semibold text-slate-400 ml-2">/ month</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Payable for <span className="text-white font-bold">{result.termsMonths} consecutive months</span>
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-700/60 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Total Contract Price:</span>
                    <p className="text-base font-extrabold text-white mt-0.5">
                      {formatCurrency(result.contractPrice)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Remaining Balance:</span>
                    <p className="text-base font-extrabold text-white mt-0.5">
                      {formatCurrency(result.balance)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Schedule Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Detailed Calculation Breakdown
              </h3>
              <div className="space-y-2 text-xs divide-y divide-slate-100">
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-600">Base Equipment Price</span>
                  <span className="font-bold text-slate-900">{formatCurrency(result.basePrice)}</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-600">
                    Less: Downpayment ({result.dpPercent}%)
                  </span>
                  <span className="font-bold text-red-600">- {formatCurrency(result.downpayment)}</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-600">Net Principal Financed</span>
                  <span className="font-bold text-slate-900">{formatCurrency(result.principalFinanced)}</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-600">
                    Total Add-on Interest ({result.annualInterestRate}%)
                  </span>
                  <span className="font-bold text-amber-600">+ {formatCurrency(result.totalInterest)}</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-800 font-bold">Total Contract Price</span>
                  <span className="font-black text-slate-900">{formatCurrency(result.contractPrice)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* DOST / Government Bid Calculator */
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">DOST / Government Bids Price Breakdown</h2>
              <p className="text-xs text-slate-500">
                Automatically isolates 12% VAT in and out, overprice margin, and exact net payable to ESPMI.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setDostRows([...dostRows, { machine: "", dostVatIn: 0, espmiPrice: 0 }])
                }
                className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                + Add Machine Row
              </button>
              <button
                onClick={copyDostSummary}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                {copiedDost ? "✓ Copied!" : "Copy Breakdown"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-3 px-3">Machine / Unit</th>
                  <th className="py-3 px-3">DOST Price (VAT-In)</th>
                  <th className="py-3 px-3">12% VAT</th>
                  <th className="py-3 px-3">DOST Price (VAT-Ex)</th>
                  <th className="py-3 px-3">ESPMI Price</th>
                  <th className="py-3 px-3">Overprice (OP)</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dostCalculations.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <input
                        value={row.machine}
                        onChange={(e) => {
                          const copy = [...dostRows];
                          copy[idx].machine = e.target.value;
                          setDostRows(copy);
                        }}
                        placeholder="Machine model"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        value={row.dostVatIn || ""}
                        onChange={(e) => {
                          const copy = [...dostRows];
                          copy[idx].dostVatIn = Number(e.target.value);
                          setDostRows(copy);
                        }}
                        placeholder="0.00"
                        className="w-36 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-600">
                      {formatCurrency(row.vat)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {formatCurrency(row.vatEx)}
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        value={row.espmiPrice || ""}
                        onChange={(e) => {
                          const copy = [...dostRows];
                          copy[idx].espmiPrice = Number(e.target.value);
                          setDostRows(copy);
                        }}
                        placeholder="0.00"
                        className="w-36 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-black text-emerald-600">
                      {formatCurrency(row.op)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {dostRows.length > 1 && (
                        <button
                          onClick={() => {
                            const copy = dostRows.filter((_, i) => i !== idx);
                            setDostRows(copy);
                          }}
                          className="text-red-500 font-bold hover:text-red-700"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-black border-t border-slate-200">
                <tr>
                  <td className="py-3 px-3">TOTALS</td>
                  <td className="py-3 px-3 text-blue-600">{formatCurrency(dostTotals.vatIn)}</td>
                  <td className="py-3 px-3 text-slate-600">{formatCurrency(dostTotals.vat)}</td>
                  <td className="py-3 px-3 text-slate-900">{formatCurrency(dostTotals.vatEx)}</td>
                  <td className="py-3 px-3 text-slate-900">{formatCurrency(dostTotals.espmi)}</td>
                  <td className="py-3 px-3 text-emerald-600">{formatCurrency(dostTotals.op)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
