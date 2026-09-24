"use client";

import { useState, useEffect } from "react";
import type { CatalogMachine } from "../types";
import { formatCurrency } from "../lib/calculator";

type DocType = "dr" | "agreement" | "promissory" | "warranty";

export function ClosingDocsClient() {
  const [docType, setDocType] = useState<DocType>("dr");
  const [catalog, setCatalog] = useState<CatalogMachine[]>([]);
  const [loading, setLoading] = useState(true);

  // Form parameters
  const [clientName, setClientName] = useState("Acme Printing Corp.");
  const [contactPerson, setContactPerson] = useState("Juan Dela Cruz");
  const [address, setAddress] = useState("123 Industrial Road, Quezon City");
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [serialNo, setSerialNo] = useState("SN-2024-88991");
  const [drNumber, setDrNumber] = useState("DR-2024-001");
  const [contractPrice, setContractPrice] = useState(650000);
  const [downpayment, setDownpayment] = useState(130000);
  const [termMonths, setTermMonths] = useState(12);
  const [monthlyAmort, setMonthlyAmort] = useState(48500);

  useEffect(() => {
    fetch("/api/sales/catalog")
      .then((res) => res.json())
      .then((data) => {
        if (data.machines && data.machines.length > 0) {
          setCatalog(data.machines);
          setSelectedMachineId(data.machines[0].id);
          setContractPrice(data.machines[0].srp || 650000);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedMachine = catalog.find((m) => m.id === selectedMachineId);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-slate-900 animate-pulse" />
            Closing Documents Generator
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate formal Delivery Receipts, Sales Agreements, Promissory Notes & Warranty Certificates.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-all"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Document
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Panel */}
        <div className="lg:col-span-4 space-y-4 print:hidden">
          {/* Document Type Selector */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Select Document
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDocType("dr")}
                className={`p-2.5 rounded-xl text-xs font-bold border text-left transition-all ${
                  docType === "dr"
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Delivery Receipt (DR)
              </button>
              <button
                onClick={() => setDocType("agreement")}
                className={`p-2.5 rounded-xl text-xs font-bold border text-left transition-all ${
                  docType === "agreement"
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Sales Agreement
              </button>
              <button
                onClick={() => setDocType("promissory")}
                className={`p-2.5 rounded-xl text-xs font-bold border text-left transition-all ${
                  docType === "promissory"
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Promissory Note
              </button>
              <button
                onClick={() => setDocType("warranty")}
                className={`p-2.5 rounded-xl text-xs font-bold border text-left transition-all ${
                  docType === "warranty"
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Warranty Certificate
              </button>
            </div>
          </div>

          {/* Form Inputs */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">
              Closing Parameters
            </h3>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Company / Client Name</label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Contact Person</label>
              <input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Delivery Address</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Selected Machine</label>
              <select
                value={selectedMachineId}
                onChange={(e) => {
                  setSelectedMachineId(e.target.value);
                  const m = catalog.find((x) => x.id === e.target.value);
                  if (m) setContractPrice(m.srp);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-bold"
              >
                {catalog.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.brand} - {m.model}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Serial Number</label>
                <input
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">DR Number</label>
                <input
                  value={drNumber}
                  onChange={(e) => setDrNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Contract Price</label>
                <input
                  type="number"
                  value={contractPrice}
                  onChange={(e) => setContractPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Downpayment</label>
                <input
                  type="number"
                  value={downpayment}
                  onChange={(e) => setDownpayment(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Document Paper */}
        <div className="lg:col-span-8 bg-white p-8 sm:p-14 rounded-2xl border border-slate-300 shadow-md min-h-[700px] print:border-none print:shadow-none print:p-0 flex flex-col justify-between">
          <div>
            {/* Letterhead */}
            <div className="border-b-2 border-slate-900 pb-4 text-center">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">ES PRINT MEDIA INC.</h2>
              <p className="text-xs text-slate-600 font-medium">
                Main Office: 141-143 West Avenue, Quezon City, Philippines
              </p>
              <p className="text-[11px] text-slate-400">Tel: (02) 8372-8888 · info@esprintmedia.com</p>
            </div>

            {/* Document Specific Body */}
            {docType === "dr" && (
              <div className="py-6 space-y-6 text-xs text-slate-800">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <h3 className="text-base font-black text-slate-900 tracking-wider">
                    DELIVERY RECEIPT
                  </h3>
                  <div className="text-right font-mono">
                    <p className="font-bold text-red-600">{drNumber}</p>
                    <p className="text-slate-500">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl">
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Delivered to:</span>
                    <p className="font-bold text-sm text-slate-900">{clientName}</p>
                    <p>{contactPerson}</p>
                    <p className="text-slate-500">{address}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Reference:</span>
                    <p className="font-bold text-slate-900">Contract Total: {formatCurrency(contractPrice)}</p>
                    <p className="text-slate-600">Paid DP: {formatCurrency(downpayment)}</p>
                  </div>
                </div>

                <table className="w-full text-left border-collapse mt-4">
                  <thead>
                    <tr className="border-b border-slate-300 text-[11px] font-bold text-slate-600 uppercase">
                      <th className="py-2">Item / Model</th>
                      <th className="py-2">Serial Number</th>
                      <th className="py-2 text-center">Quantity</th>
                      <th className="py-2">Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    <tr>
                      <td className="py-3 font-bold text-slate-900">
                        {selectedMachine?.brand} {selectedMachine?.model}
                      </td>
                      <td className="py-3 font-mono text-slate-800">{serialNo}</td>
                      <td className="py-3 text-center">1 Unit</td>
                      <td className="py-3">{selectedMachine?.unit_condition || "Brand New"}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                  <p className="font-bold text-slate-800 mb-1">Acknowledgement:</p>
                  <p>
                    Received the above items in good order and complete condition along with standard accessories,
                    power cables, and user documentation.
                  </p>
                </div>
              </div>
            )}

            {docType === "agreement" && (
              <div className="py-6 space-y-4 text-xs text-slate-800">
                <div className="text-center pb-3 border-b border-slate-200">
                  <h3 className="text-base font-black text-slate-900 tracking-wider">
                    EQUIPMENT SALES AGREEMENT
                  </h3>
                </div>

                <p className="leading-relaxed">
                  This Sales Agreement is entered into between <span className="font-bold">ES Print Media Inc.</span> (Seller) and{" "}
                  <span className="font-bold">{clientName}</span> (Buyer) for the purchase of:
                </p>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-medium space-y-1">
                  <p><span className="font-bold">Unit:</span> {selectedMachine?.brand} {selectedMachine?.model}</p>
                  <p><span className="font-bold">Serial No:</span> {serialNo}</p>
                  <p><span className="font-bold">Total Contract Price:</span> {formatCurrency(contractPrice)}</p>
                  <p><span className="font-bold">Downpayment:</span> {formatCurrency(downpayment)}</p>
                </div>

                <p className="leading-relaxed text-[11px] text-slate-600">
                  1. Title & Ownership: Title remains with Seller until full payment of the Contract Price.<br/>
                  2. Warranty: Covered by standard {selectedMachine?.machine_warranty_months || 12}-month limited service warranty.
                </p>
              </div>
            )}

            {docType === "warranty" && (
              <div className="py-6 space-y-5 text-xs text-slate-800">
                <div className="text-center pb-3 border-b-2 border-emerald-600">
                  <h3 className="text-base font-black text-emerald-800 tracking-wider">
                    OFFICIAL WARRANTY CERTIFICATE
                  </h3>
                  <p className="text-[11px] text-slate-500">Certificate of Limited Warranty Coverage</p>
                </div>

                <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-2">
                  <p><span className="font-bold text-slate-700">Registered Owner:</span> {clientName}</p>
                  <p><span className="font-bold text-slate-700">Equipment:</span> {selectedMachine?.brand} {selectedMachine?.model}</p>
                  <p><span className="font-bold text-slate-700">Serial Number:</span> <span className="font-mono font-bold text-emerald-800">{serialNo}</span></p>
                  <p><span className="font-bold text-slate-700">Coverage Period:</span> {selectedMachine?.machine_warranty_months || 12} Months Parts & Labor</p>
                  <p><span className="font-bold text-slate-700">Printhead Warranty:</span> {selectedMachine?.printhead_warranty || "0"} Months</p>
                </div>
              </div>
            )}

            {docType === "promissory" && (
              <div className="py-6 space-y-4 text-xs text-slate-800">
                <div className="text-center pb-3 border-b border-slate-200">
                  <h3 className="text-base font-black text-slate-900 tracking-wider">
                    PROMISSORY NOTE
                  </h3>
                </div>

                <p className="leading-relaxed">
                  FOR VALUE RECEIVED, the undersigned <span className="font-bold">{clientName}</span> promises to pay to the order of{" "}
                  <span className="font-bold">ES Print Media Inc.</span> the principal sum of{" "}
                  <span className="font-bold">{formatCurrency(contractPrice - downpayment)}</span> payable in monthly amortizations.
                </p>
              </div>
            )}
          </div>

          {/* Signatures */}
          <div className="pt-10 border-t border-slate-200 grid grid-cols-2 gap-12 text-xs">
            <div>
              <p className="text-slate-400 font-bold uppercase text-[10px] mb-8">Authorized Representative (ESPMI):</p>
              <div className="border-b border-slate-900 w-44" />
              <p className="font-bold text-slate-900 mt-1">Authorized Signatory</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 font-bold uppercase text-[10px] mb-8">Client Received / Conforme:</p>
              <div className="border-b border-slate-900 w-44 ml-auto" />
              <p className="font-bold text-slate-900 mt-1">{contactPerson || "Client Representative"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
