"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CatalogMachine, LetterheadType } from "../types";

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

interface ToggleableItem {
  id: string;
  description: string;
  enabled: boolean;
  isCustom?: boolean;
  sortOrder?: number;
}

interface ConsumablePriceItem {
  id: string;           // consumable UUID from catalog (for saving to quote_consumable_prices)
  name: string;
  pkg: string;
  price: number;
}

// ── numToWords: mirrors orig _numToWords helper (12 → "Twelve (12)") ──────────
const NUM_WORDS: Record<number, string> = {
  1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six",
  7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten", 11: "Eleven", 12: "Twelve",
  18: "Eighteen", 24: "Twenty-Four", 36: "Thirty-Six", 48: "Forty-Eight", 60: "Sixty",
};
function numToWords(n: number): string {
  return NUM_WORDS[n] ? `${NUM_WORDS[n]} (${n})` : String(n);
}

export function QuoteBuilderClient({
  currentUserEmail,
  currentUserName,
}: {
  currentUserEmail: string;
  currentUserName: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id"); // present when editing a saved quote

  const [catalog, setCatalog] = useState<CatalogMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(editId);
  const [showValidationBox, setShowValidationBox] = useState(false);

  // 1. Letterhead
  const [letterhead, setLetterhead] = useState<LetterheadType>("ES Print Media Inc.");

  // 2. Machine Selection
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedSubModel, setSelectedSubModel] = useState("");
  const [unitCondition, setUnitCondition] = useState<"Brand New" | "Re-certified" | "Demo Unit">("Brand New");

  // 3. Client Information
  const [clientName, setClientName] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [salutation, setSalutation] = useState("Dear Ma'am / Sir,");
  const [openingLine, setOpeningLine] = useState(
    "Thank you for your interest in our products and services. Below is our quote as per your inquiry:"
  );

  // 4. Deal Type
  const [dealType, setDealType] = useState<"Standard Cash" | "Standard Terms" | "Trade-In Cash" | "Trade-In Terms">("Standard Cash");

  // 5. Pricing
  const [contractPrice, setContractPrice] = useState<number>(0);
  const [downPayment, setDownPayment] = useState<number>(0);
  const [months, setMonths] = useState<number>(12);
  const [vatInclusive, setVatInclusive] = useState(false);
  const [collectionPayment, setCollectionPayment] = useState("Upon confirmation and before delivery");
  const [collectionDownpayment, setCollectionDownpayment] = useState("Upon confirmation and before delivery");
  const [collectionAmortization, setCollectionAmortization] = useState("After installation of machine");
  const [availability, setAvailability] = useState("ON STOCK");

  // Trade-Ins (Always 3 fixed rows in original)
  const [tradeIns, setTradeIns] = useState<TradeInItem[]>([
    { description: "", value: 0 },
    { description: "", value: 0 },
    { description: "", value: 0 },
  ]);

  // Term Options
  const [termOptions, setTermOptions] = useState<TermOption[]>([]);

  // Promo
  const [underPromo, setUnderPromo] = useState(false);
  const [freebies, setFreebies] = useState<string[]>([]);
  const [freebieInput, setFreebieInput] = useState("");
  const [promoValidity, setPromoValidity] = useState("");

  // Delivery & Computer Set
  const [includeDelivery, setIncludeDelivery] = useState(false);
  const [includeComputerSet, setIncludeComputerSet] = useState(false);
  const [computerSetSpec, setComputerSetSpec] = useState("");

  // Consumable Prices
  const [consumablePrices, setConsumablePrices] = useState<ConsumablePriceItem[]>([]);

  // Inclusions & Exclusions & Add-Ons
  const [inclusionItems, setInclusionItems] = useState<ToggleableItem[]>([]);
  const [showInclusionInput, setShowInclusionInput] = useState(false);
  const [newInclusionText, setNewInclusionText] = useState("");

  const [exclusionItems, setExclusionItems] = useState<ToggleableItem[]>([]);
  const [showExclusionInput, setShowExclusionInput] = useState(false);
  const [newExclusionText, setNewExclusionText] = useState("");

  const [addonItems, setAddonItems] = useState<ToggleableItem[]>([]);

  // Warranty
  const [warrantyCompany, setWarrantyCompany] = useState("ES Print Media Inc.");
  const [warrantySupplier, setWarrantySupplier] = useState("ESPMI");
  const [warrantyMachineDuration, setWarrantyMachineDuration] = useState("Twelve (12)");
  const [warrantyPrintheadDuration, setWarrantyPrintheadDuration] = useState("");
  const [warrantyPrintheadType, setWarrantyPrintheadType] = useState<string | null>(null);
  const [serviceFee, setServiceFee] = useState<number | null>(500);

  // Signatories
  const [aeName, setAeName] = useState(currentUserName || "ACCOUNT EXECUTIVE");
  const [clientConforme, setClientConforme] = useState("");
  const [notedByName, setNotedByName] = useState("Ness Deomano");
  const [notedByRole, setNotedByRole] = useState("Area Sales Manager");

  // Load catalog on mount
  useEffect(() => {
    async function loadCatalog() {
      setLoading(true);
      try {
        const res = await fetch("/api/sales/catalog");
        const data = await res.json();
        if (data.machines && data.machines.length > 0) {
          setCatalog(data.machines);
        }
      } catch (err) {
        console.error("Failed to load catalog:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, []);

  // Unique Brands
  const brands = useMemo(() => {
    return Array.from(new Set(catalog.map((m) => m.brand))).filter(Boolean).sort();
  }, [catalog]);

  function brandCount(b: string) {
    return catalog.filter((m) => m.brand === b).length;
  }

  // Models for selected Brand
  const uniqueModels = useMemo(() => {
    if (!selectedBrand) return [];
    return Array.from(new Set(catalog.filter((m) => m.brand === selectedBrand).map((m) => m.model))).sort();
  }, [catalog, selectedBrand]);

  // Selected Machine entry
  const selectedMachine = useMemo(() => {
    if (!selectedBrand || !selectedModel) return null;
    return catalog.find((m) => m.brand === selectedBrand && m.model === selectedModel) || null;
  }, [catalog, selectedBrand, selectedModel]);

  // Handle machine population
  useEffect(() => {
    if (!selectedMachine) {
      setContractPrice(0);
      setInclusionItems([]);
      setExclusionItems([]);
      setAddonItems([]);
      setConsumablePrices([]);
      return;
    }

    setUnitCondition((selectedMachine.unit_condition as any) || "Brand New");
    setLetterhead(selectedMachine.letterhead || "ES Print Media Inc.");
    setContractPrice(selectedMachine.srp || 0);

    // Inclusions
    const defaultIncls: ToggleableItem[] = (selectedMachine.inclusions || []).map((inc, i) => ({
      id: `inc-${i}`,
      description: inc,
      enabled: true,
    }));
    setInclusionItems(defaultIncls);

    // Exclusions
    const defaultExcls: ToggleableItem[] = (selectedMachine.exclusions || []).map((exc, i) => ({
      id: `exc-${i}`,
      description: exc,
      enabled: true,
    }));
    setExclusionItems(defaultExcls);

    // Addons
    const defaultAddons: ToggleableItem[] = (selectedMachine.addons || []).map((addon, i) => ({
      id: `addon-${i}`,
      description: addon,
      enabled: false,
    }));
    setAddonItems(defaultAddons);

    // Consumables
    if (selectedMachine.consumables && selectedMachine.consumables.length > 0) {
      setConsumablePrices(
        selectedMachine.consumables.map((c, i) => ({
          id: c.id || `c-${i}`,
          name: c.item_name,
          pkg: c.package_description || "",
          price: c.default_price,
        }))
      );
    } else {
      setConsumablePrices([]);
    }

    // Warranty — derive text from machine fields (matches orig _numToWords)
    const macWarranty = selectedMachine.machine_warranty_months ?? 12;
    setWarrantyMachineDuration(numToWords(macWarranty));
    // Printhead warranty: show only when has_printhead or has_laser_tube
    if (selectedMachine.has_printhead || selectedMachine.has_laser_tube) {
      const phWarranty = selectedMachine.printhead_warranty?.replace(/[^0-9]/g, "") ?? "";
      const phNum = parseInt(phWarranty) || 0;
      setWarrantyPrintheadDuration(phNum > 0 ? numToWords(phNum) : "");
      setWarrantyPrintheadType(selectedMachine.has_laser_tube ? "laser_tube" : "printhead");
    } else {
      setWarrantyPrintheadDuration("");
      setWarrantyPrintheadType(null);
    }
    setServiceFee(selectedMachine.service_fee ?? 500);
    setAvailability(selectedMachine.availability || "ON STOCK");
  }, [selectedMachine]);

  // Trade in sum
  const showTradeIns = dealType === "Trade-In Cash" || dealType === "Trade-In Terms";
  const tradeInSum = useMemo(() => {
    if (!showTradeIns) return 0;
    return tradeIns.reduce((sum, ti) => sum + (Number(ti.value) || 0), 0);
  }, [showTradeIns, tradeIns]);

  const tradeInDescriptions = useMemo(() => {
    return tradeIns.map((ti) => ti.description?.trim()).filter(Boolean);
  }, [tradeIns]);

  // Format currency helpers
  function formatMoney(val: number | null | undefined): string {
    if (val === null || val === undefined || val === 0) return "";
    return val.toLocaleString("en-PH");
  }

  function formatDisplayCurrency(val: number | null | undefined): string {
    if (val === null || val === undefined) return "—";
    return (
      "₱" +
      val.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  // Term options calculation
  function addTermOption() {
    if (termOptions.length >= 5) return;
    setTermOptions([
      ...termOptions,
      { dealType: "Installment", contractPrice: null, downPayment: 0, months: 12, monthlyAmortization: null },
    ]);
  }

  function removeTermOption(idx: number) {
    setTermOptions(termOptions.filter((_, i) => i !== idx));
  }

  // Pricing rows for table preview
  const pricingRows = useMemo(() => {
    const cp = contractPrice || 0;
    const isCash = dealType.toLowerCase().includes("cash");
    const rows: { downPayment: number; balance: number | null; paymentTerms: string; monthly: number | null }[] = [];

    // Primary row
    const dp = downPayment || 0;
    const m = months || 12;
    const balance = cp - dp - tradeInSum;
    const paymentTerms = isCash ? "CASH" : `${m} months`;
    const monthly = isCash ? null : balance > 0 && m > 0 ? balance / m : null;
    rows.push({ downPayment: dp, balance, paymentTerms, monthly });

    // Additional term options
    termOptions.forEach((term) => {
      const tCp = term.contractPrice || cp;
      const tDp = term.downPayment || 0;
      const tMonths = term.months || 12;
      const tIsCash = (term.dealType || "").toLowerCase().includes("cash");
      const tBalance = tCp - tDp - tradeInSum;
      const tPaymentTerms = tIsCash ? "CASH" : `${tMonths} months`;
      const tMonthly = tIsCash ? null : tBalance > 0 && tMonths > 0 ? tBalance / tMonths : null;
      rows.push({ downPayment: tDp, balance: tBalance, paymentTerms: tPaymentTerms, monthly: tMonthly });
    });

    return rows;
  }, [contractPrice, dealType, downPayment, months, tradeInSum, termOptions]);

  // Formatted proposal date
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

  // Warranty lines generator — mirrors QuotePreviewPanel.vue warranty section exactly
  const warrantyLines = useMemo(() => {
    const lines: { text: string; bold: boolean; heading?: boolean }[] = [];
    const modelUpper = (selectedModel || "").toUpperCase();

    // Special case: EPSON SC-T3130X (Authorized service center model)
    if (modelUpper.includes("SC-T3130X")) {
      return [
        { text: "24 months or 10,000 A1 Prints, whichever comes first.", bold: false },
        { text: "Authorized Epson Service Centers – Warranty and after-sales support are strictly provided by Epson's accredited service centers.", bold: false },
        { text: "End-users must coordinate directly with the Authorized Service Center to ensure streamlined communication and efficient support.", bold: false },
        { text: "Online Support — Email: customercare@epc.epson.com.ph", bold: false },
        { text: "Telephone Support — Toll-Free (PLDT): 1-800-1069-37766 · Metro Manila: (02) 8441-9030", bold: false },
        { text: "AFTER WARRANTY", bold: true, heading: true },
        { text: "All service and repairs beyond the warranty period shall be directly coordinated by the BUYER with the Authorized Service Center.", bold: false },
        { text: "ES Print Media Inc. shall not be responsible for service handling, transport, or repair costs after the warranty period.", bold: false },
        { text: "Standard service fees, if any, shall be charged by the Authorized Service Center in accordance with their prevailing rates.", bold: false },
      ];
    }

    // Machine warranty line
    if (warrantyMachineDuration.trim()) {
      const isCrGrDTF = modelUpper.includes("CREONS") || modelUpper.includes("GRANDO") || modelUpper.includes("DTF");
      const excl = selectedMachine?.exclude_software_concerns !== false;
      const softwareClause = excl ? " Excluding software related concerns." : "";
      if (isCrGrDTF) {
        // CREONS/GRANDO/DTF — excludes print head in the main warranty line
        lines.push({ text: `${warrantyMachineDuration} months limited warranty on Main unit (excluding print head(s)).${softwareClause} Terms and conditions apply.`, bold: false });
        lines.push({ text: `Use of parts and inks other than those supplied by ${warrantySupplier || "ESPMI"} will void the warranty.`, bold: true });
      } else {
        lines.push({ text: `${warrantyMachineDuration} months limited warranty on Main unit.${softwareClause} Terms and conditions apply.`, bold: false });
      }
    }

    // DTF models: add Powder Shaker warranty
    if ((selectedModel || "").toUpperCase().includes("DTF")) {
      lines.push({ text: "Twelve (12) months limited warranty on Powder Shaker Machine.", bold: false });
    }

    // Printhead / laser tube warranty
    if (warrantyPrintheadDuration.trim()) {
      const phTypeLabel = warrantyPrintheadType === "laser_tube" ? "Laser Tube" : "Print Head";
      lines.push({ text: `${warrantyPrintheadDuration} months limited warranty on ${phTypeLabel}.`, bold: false });
      lines.push({ text: `Use of parts and inks other than those supplied by ${warrantySupplier || "ESPMI"} will void the warranty.`, bold: true });
    }

    // IPRESS clam-type (on-site field service note instead of standard service fee)
    const isIpressClam = modelUpper.includes("IPRESS") && (modelUpper.includes("15X15") || modelUpper.includes("60X90") || modelUpper.includes("CLAM"));

    // No warranty for package inclusions
    if (isIpressClam) {
      lines.push({ text: "No warranty.", bold: false });
    } else {
      lines.push({ text: "No warranty for package inclusions.", bold: false });
    }

    // Epson T-series (not SC-T3130X — already handled): Epson service center block
    const isEpsonTSeries = modelUpper.includes("SC-T") && !modelUpper.includes("SC-T3130X");
    if (isEpsonTSeries) {
      lines.push({ text: "Authorized Epson Service Centers – Warranty and after-sales support are strictly provided by Epson's accredited service centers.", bold: false });
      lines.push({ text: "AFTER WARRANTY", bold: true, heading: true });
      lines.push({ text: "All service and repairs beyond the warranty period shall be directly coordinated by the BUYER with the Authorized Service Center.", bold: false });
    } else {
      // Standard service fee line
      const feeVal = serviceFee != null ? serviceFee * (vatInclusive ? 1.12 : 1) : null;
      const formattedFee = feeVal != null ? "₱" + feeVal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
      if (isIpressClam) {
        lines.push({ text: `If request for On-site Field Service, a service fee of ${formattedFee} per case will be charged.`, bold: false });
      } else {
        lines.push({ text: `After warranty, a service fee of ${formattedFee} per case will be charged.`, bold: false });
      }
    }

    // Confidentiality line
    lines.push({
      text: `It is an essential consideration of this Agreement that all matters pertaining to the supply by ${warrantyCompany} to the BUYER shall be held in the strictest confidence.`,
      bold: false,
    });

    return lines;
  }, [selectedModel, selectedMachine, warrantyMachineDuration, warrantyPrintheadDuration, warrantyPrintheadType, warrantySupplier, serviceFee, warrantyCompany, vatInclusive]);

  // Displayed inclusions & exclusions for preview (mirrors QuotePreviewPanel.vue logic)
  const displayedInclusions = useMemo(() => {
    let items = inclusionItems.filter((i) => i.enabled).map((i) => i.description);
    if (includeDelivery && !items.some((d) => d.toLowerCase().includes("delivery"))) {
      items = ["Delivery and installation in cities with ESPMI branches", ...items];
    }
    if (vatInclusive && !items.some((d) => d.toLowerCase().includes("value added tax") || d.toLowerCase().includes("vat"))) {
      items = [...items, "12% Value Added Tax (VAT) Included"];
    }
    return items;
  }, [inclusionItems, includeDelivery, vatInclusive]);

  const displayedExclusions = useMemo(() => {
    let items = exclusionItems.filter((i) => i.enabled).map((i) => i.description);
    if (includeDelivery) {
      items = items.filter((d) => !d.toLowerCase().includes("delivery") && !d.toLowerCase().includes("transportation and accommodation"));
    }
    if (vatInclusive) {
      items = items.filter((d) => !d.toLowerCase().includes("value added tax") && !d.toLowerCase().includes("vat"));
    }
    return items;
  }, [exclusionItems, includeDelivery, vatInclusive]);

  const letterheadHeaderImg =
    letterhead === "ACS / Alternative" ? "/letterhead/letterhead-acs-1.jpg" : "/letterhead/letterhead-espmi-1.jpg";
  const letterheadFooterImg =
    letterhead === "ACS / Alternative" ? "/letterhead/letterhead-acs-2.jpg" : "/letterhead/letterhead-espmi-2.jpg";

  // Validation
  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (!selectedBrand || !selectedModel) errs.push("Please select a Machine Model");
    if (!clientName.trim()) errs.push("Client Name is required");
    if (!contractPrice || contractPrice <= 0) errs.push("Contract Price must be greater than 0");
    return errs;
  }, [selectedBrand, selectedModel, clientName, contractPrice]);

  // ── Wire delivery checkbox → move "Delivery…" item between inclusions/exclusions ──
  useEffect(() => {
    const DELIVERY_KEYWORD = "delivery";
    setInclusionItems(prev => {
      const hasDeliveryIncl = prev.some(x => x.description.toLowerCase().includes(DELIVERY_KEYWORD));
      if (includeDelivery && !hasDeliveryIncl) {
        // Move from exclusions to inclusions
        const deliveryExcl = exclusionItems.find(x => x.description.toLowerCase().includes(DELIVERY_KEYWORD));
        if (deliveryExcl) {
          setExclusionItems(ex => ex.map(x => x.description.toLowerCase().includes(DELIVERY_KEYWORD) ? { ...x, enabled: false } : x));
          return [...prev, { ...deliveryExcl, id: `incl-del-${Date.now()}`, enabled: true }];
        }
      } else if (!includeDelivery) {
        // Remove delivery from inclusions (it lives in exclusions)
        return prev.filter(x => !x.description.toLowerCase().includes(DELIVERY_KEYWORD) || x.isCustom);
      }
      return prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeDelivery]);

  // ── Load existing quote when editing (URL ?id=<quoteId>) ──────────────────
  useEffect(() => {
    if (!editId || catalog.length === 0) return;
    async function loadQuote() {
      try {
        const res = await fetch(`/api/sales/quotes/${editId}`);
        if (!res.ok) return;
        const { quote } = await res.json();
        if (!quote) return;
        // Restore machine selection first
        if (quote.machine_id) {
          const m = catalog.find(x => x.id === quote.machine_id);
          if (m) {
            setSelectedBrand(m.brand);
            setSelectedModel(m.model);
          }
        }
        setLetterhead((quote.letterhead || "ES Print Media Inc.") as LetterheadType);
        setClientName(quote.client_name || "");
        setCompany(quote.company || "");
        setAddress(quote.address || "");
        setContact(quote.contact || "");
        setEmail(quote.email || "");
        if (quote.quote_date) setQuoteDate(quote.quote_date.slice(0, 10));
        if (quote.salutation) setSalutation(quote.salutation);
        if (quote.opening_line) setOpeningLine(quote.opening_line);
        if (quote.deal_type) setDealType(quote.deal_type as any);
        if (quote.contract_price != null) setContractPrice(Number(quote.contract_price));
        setVatInclusive(!!quote.vat_inclusive);
        setUnderPromo(!!quote.under_promo);
        if (quote.promo_validity) setPromoValidity(quote.promo_validity);
        if (quote.availability) setAvailability(quote.availability);
        if (quote.collection_payment) setCollectionPayment(quote.collection_payment);
        if (quote.collection_downpayment) setCollectionDownpayment(quote.collection_downpayment);
        if (quote.collection_amortization) setCollectionAmortization(quote.collection_amortization);
        setIncludeDelivery(!!quote.include_delivery);
        setIncludeComputerSet(!!quote.include_computer_set);
        if (quote.computer_set_spec) setComputerSetSpec(quote.computer_set_spec);
        if (quote.ae_name) setAeName(quote.ae_name);
        if (quote.client_conforme) setClientConforme(quote.client_conforme);
        if (quote.noted_by_name) setNotedByName(quote.noted_by_name);
        if (quote.noted_by_role) setNotedByRole(quote.noted_by_role);
        if (quote.warranty_company) setWarrantyCompany(quote.warranty_company);
        if (quote.warranty_supplier) setWarrantySupplier(quote.warranty_supplier);
        if (quote.freebies) setFreebies(Array.isArray(quote.freebies) ? quote.freebies : JSON.parse(quote.freebies || "[]"));
        // Toggleable items (JSONB arrays)
        if (Array.isArray(quote.inclusion_toggles)) setInclusionItems(quote.inclusion_toggles);
        if (Array.isArray(quote.exclusion_toggles)) setExclusionItems(quote.exclusion_toggles);
        if (Array.isArray(quote.addon_toggles)) setAddonItems(quote.addon_toggles);
        // Sub-tables
        if (Array.isArray(quote.trade_ins)) {
          setTradeIns([
            quote.trade_ins[0] || { description: "", value: 0 },
            quote.trade_ins[1] || { description: "", value: 0 },
            quote.trade_ins[2] || { description: "", value: 0 },
          ]);
        }
        if (Array.isArray(quote.term_options)) {
          setTermOptions(quote.term_options.map((t: any) => ({
            dealType: "Installment",
            contractPrice: t.contract_price ?? null,
            downPayment: t.down_payment ?? 0,
            months: t.months ?? 12,
            monthlyAmortization: t.monthly_amortization ?? null,
          })));
        }
        if (Array.isArray(quote.consumable_prices)) {
          setConsumablePrices(prev => prev.map(cp => {
            const saved = quote.consumable_prices.find((s: any) => s.consumable_id === cp.id);
            return saved ? { ...cp, price: Number(saved.custom_price) } : cp;
          }));
        }
        setSavedQuoteId(editId);
      } catch (err) {
        console.error("Failed to load quote:", err);
      }
    }
    loadQuote();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, catalog]);

  // ── Save quote to DB ────────────────────────────────────────────────────────
  const handleSave = useCallback(async (andPdf = false) => {
    if (validationErrors.length > 0) { setShowValidationBox(true); return; }
    setShowValidationBox(false);
    setSaving(true);
    try {
      const payload = {
        machine_id: selectedMachine?.id ?? null,
        client_name: clientName, company, address, contact, email,
        quote_date: quoteDate, salutation, opening_line: openingLine,
        deal_type: dealType, contract_price: contractPrice,
        vat_inclusive: vatInclusive, under_promo: underPromo, promo_validity: promoValidity,
        unit_condition_override: unitCondition !== selectedMachine?.unit_condition ? unitCondition : null,
        include_delivery: includeDelivery, include_computer_set: includeComputerSet, computer_set_spec: computerSetSpec,
        inclusion_toggles: inclusionItems,
        exclusion_toggles: exclusionItems,
        addon_toggles: addonItems,
        warranty_company: warrantyCompany, warranty_supplier: warrantySupplier,
        availability, collection_payment: collectionPayment,
        collection_downpayment: collectionDownpayment,
        collection_amortization: collectionAmortization,
        ae_name: aeName, client_conforme: clientConforme,
        noted_by_name: notedByName, noted_by_role: notedByRole,
        letterhead, freebies,
        term_options: termOptions.map((t, i) => ({
          down_payment: t.downPayment,
          months: t.months,
          monthly_amortization: t.monthlyAmortization,
          sort_order: i,
        })),
        trade_ins: tradeIns.filter(t => t.value > 0 || t.description.trim()).map((t, i) => ({
          description: t.description,
          value: t.value,
          sort_order: i,
        })),
        consumable_prices: consumablePrices.filter(c => c.id && !c.id.startsWith("c-")).map(c => ({
          consumable_id: c.id,
          custom_price: c.price,
        })),
      };

      const url = savedQuoteId
        ? `/api/sales/quotes/${savedQuoteId}`
        : "/api/sales/quotes";
      const method = savedQuoteId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      const qId = savedQuoteId || data.id;
      setSavedQuoteId(qId);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (!savedQuoteId) {
        // Replace URL so back button doesn't re-create
        router.replace(`/sales/quote-builder?id=${qId}`);
      }
      if (andPdf) window.print();
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save quote. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [
    validationErrors, selectedMachine, clientName, company, address, contact, email,
    quoteDate, salutation, openingLine, dealType, contractPrice, vatInclusive, underPromo,
    promoValidity, unitCondition, includeDelivery, includeComputerSet, computerSetSpec,
    inclusionItems, exclusionItems, addonItems, warrantyCompany, warrantySupplier,
    availability, collectionPayment, collectionDownpayment, collectionAmortization,
    aeName, clientConforme, notedByName, notedByRole, letterhead, freebies,
    termOptions, tradeIns, consumablePrices, savedQuoteId, router,
  ]);

  function handleSavePdf() {
    handleSave(true);
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-40px)] bg-[#fff] overflow-hidden">
      {/* ─── LEFT FORM PANEL (Exact mirror of QuoteFormPanel.vue) ─── */}
      <aside className="w-full md:w-[350px] lg:w-[360px] shrink-0 h-full overflow-y-auto bg-white border-r-2 border-[#c0392b] flex flex-col select-none print:hidden">
        {/* Header */}
        <div className="text-center py-2.5 px-0 border-b border-[#f0f0f0] shrink-0">
          <div className="text-[14px] font-bold text-[#c0392b]">ES PRINT MEDIA INC.</div>
          <div className="text-[10px] text-[#999]">Quotation Generator</div>
        </div>

        {/* Content area */}
        <div className="p-3 pb-8 space-y-2 text-[#222]">
          {/* LETTERHEAD */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-[0.5px] border-b-[1.5px] border-[#c0392b] pb-[3px] mb-[7px]">
              Letterhead
            </h2>
            <div className="mb-2">
              <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                Select Letterhead
              </label>
              <select
                value={letterhead}
                onChange={(e) => setLetterhead(e.target.value as LetterheadType)}
                className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
              >
                <option value="ES Print Media Inc.">ES Print Media Inc.</option>
                <option value="ACS / Alternative">ACS / Alternative</option>
              </select>
            </div>
          </div>

          <hr className="border-0 border-t border-[#eee] my-2" />

          {/* MACHINE */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-[0.5px] border-b-[1.5px] border-[#c0392b] pb-[3px] mb-[7px]">
              Machine
            </h2>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                  Brand
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    const filtered = catalog.filter((m) => m.brand === e.target.value);
                    if (filtered.length > 0) setSelectedModel(filtered[0].model);
                  }}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                >
                  <option value="" disabled>Select brand</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b} ({brandCount(b)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                  Machine Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={!selectedBrand}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none disabled:bg-[#f0f0f0] disabled:text-[#aaa]"
                >
                  <option value="" disabled>Select model</option>
                  {uniqueModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                  Unit Condition
                </label>
                <select
                  value={unitCondition}
                  onChange={(e) => setUnitCondition(e.target.value as any)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                >
                  <option value="Brand New">Brand New</option>
                  <option value="Re-certified">Re-certified</option>
                  <option value="Demo Unit">Demo Unit</option>
                </select>
              </div>
            </div>
          </div>

          <hr className="border-0 border-t border-[#eee] my-2" />

          {/* CLIENT INFORMATION */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-[0.5px] border-b-[1.5px] border-[#c0392b] pb-[3px] mb-[7px]">
              Client Information
            </h2>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                  Client Name
                </label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                  Company
                </label>
                <input
                  type="text"
                  placeholder="Company name"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                  Address
                </label>
                <input
                  type="text"
                  placeholder="City / Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                />
              </div>

              <div className="flex gap-1.5">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                    Contact No.
                  </label>
                  <input
                    type="tel"
                    placeholder="09XX XXX XXXX"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                    Email
                  </label>
                  <input
                    type="text"
                    placeholder="email@..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                  Date
                </label>
                <input
                  type="date"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                  Salutation
                </label>
                <input
                  type="text"
                  placeholder="Dear Ma'am / Sir,"
                  value={salutation}
                  onChange={(e) => setSalutation(e.target.value)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                  Opening Line
                </label>
                <input
                  type="text"
                  placeholder="Thank you for your interest..."
                  value={openingLine}
                  onChange={(e) => setOpeningLine(e.target.value)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <hr className="border-0 border-t border-[#eee] my-2" />

          {/* DEAL TYPE */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-[0.5px] border-b-[1.5px] border-[#c0392b] pb-[3px] mb-[7px]">
              Deal Type
            </h2>
            <div>
              <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                Type of Deal
              </label>
              <select
                value={dealType}
                onChange={(e) => setDealType(e.target.value as any)}
                className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
              >
                <option value="Standard Cash">Standard Cash</option>
                <option value="Standard Terms">Standard Terms</option>
                <option value="Trade-In Cash">Trade-In Cash</option>
                <option value="Trade-In Terms">Trade-In Terms</option>
              </select>
            </div>
          </div>

          <hr className="border-0 border-t border-[#eee] my-2" />

          {/* PRICING */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-[0.5px] border-b-[1.5px] border-[#c0392b] pb-[3px] mb-[7px]">
              Pricing
            </h2>
            {unitCondition === "Re-certified" && (
              <div className="inline-block mb-1.5 px-2 py-0.5 text-[10px] font-bold uppercase text-[#b45309] bg-[#fef3c7] border border-[#f59e0b] rounded-[3px]">
                RE-CERTIFIED
              </div>
            )}
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                  Contract Price (PHP)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={formatMoney(contractPrice)}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                    setContractPrice(cleaned ? parseFloat(cleaned) : 0);
                  }}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none font-bold"
                />
              </div>

              {/* Trade-Ins (3 rows) */}
              {showTradeIns && (
                <div className="space-y-1.5">
                  {[0, 1, 2].map((idx) => (
                    <div key={idx} className="flex gap-1.5">
                      <div className="w-[44%]">
                        <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                          Trade-In Value {idx + 1} (PHP)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={formatMoney(tradeIns[idx]?.value || 0)}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                            const val = cleaned ? parseFloat(cleaned) : 0;
                            const copy = [...tradeIns];
                            copy[idx] = { ...copy[idx], value: val };
                            setTradeIns(copy);
                          }}
                          className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                          Description {idx + 1}
                        </label>
                        <input
                          type="text"
                          placeholder={idx === 0 ? "Brand, model, heads…" : "Optional"}
                          value={tradeIns[idx]?.description || ""}
                          onChange={(e) => {
                            const copy = [...tradeIns];
                            copy[idx] = { ...copy[idx], description: e.target.value };
                            setTradeIns(copy);
                          }}
                          className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}

                  {tradeInSum > 0 && (
                    <div className="bg-[#fff8f8] border border-[#f5c6cb] rounded-[4px] p-[5px_8px] text-[11px] text-[#c0392b] font-bold mt-[3px]">
                      Total Trade-In: PHP {tradeInSum.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              )}

              {/* Downpayment */}
              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                  Downpayment (PHP)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={formatMoney(downPayment)}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                    setDownPayment(cleaned ? parseFloat(cleaned) : 0);
                  }}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                />
              </div>

              {/* Terms */}
              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                  Terms (No. of Months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  placeholder="12"
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value) || 12)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                />
              </div>

              {/* Additional Term Options */}
              <div className="mt-2">
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px] tracking-[0.3px]">
                  Additional Term Options (optional)
                </label>
                {termOptions.map((opt, idx) => (
                  <div key={idx} className="border border-[#e5c9c5] rounded-[6px] p-[6px_8px] mb-[6px] bg-[#fffafa]">
                    <div className="flex justify-between items-center text-[11px] font-bold text-[#c0392b] mb-[3px]">
                      <span>Additional Option</span>
                      <button
                        type="button"
                        onClick={() => removeTermOption(idx)}
                        className="w-[22px] h-[22px] border border-[#ddd] bg-white text-[#c0392b] rounded-[4px] flex items-center justify-center font-bold text-[14px] cursor-pointer hover:bg-[#fdecea]"
                      >
                        &times;
                      </button>
                    </div>

                    <div className="mb-2">
                      <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">Deal Type</label>
                      <select
                        value={opt.dealType}
                        onChange={(e) => {
                          const copy = [...termOptions];
                          copy[idx].dealType = e.target.value;
                          setTermOptions(copy);
                        }}
                        className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Installment">Installment</option>
                        <option value="Trade-In — Cash">Trade-In — Cash</option>
                        <option value="Trade-In — Installment">Trade-In — Installment</option>
                      </select>
                    </div>

                    <div className="mb-2">
                      <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">Contract Price</label>
                      <input
                        type="number"
                        placeholder="Defaults to main price"
                        value={opt.contractPrice || ""}
                        onChange={(e) => {
                          const copy = [...termOptions];
                          copy[idx].contractPrice = Number(e.target.value) || null;
                          setTermOptions(copy);
                        }}
                        className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                      />
                    </div>

                    <div className="flex gap-1.5">
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">Downpayment</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={opt.downPayment || ""}
                          onChange={(e) => {
                            const copy = [...termOptions];
                            copy[idx].downPayment = Number(e.target.value) || 0;
                            setTermOptions(copy);
                          }}
                          className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">Months</label>
                        <input
                          type="number"
                          placeholder="12"
                          value={opt.months}
                          onChange={(e) => {
                            const copy = [...termOptions];
                            copy[idx].months = Number(e.target.value) || 12;
                            setTermOptions(copy);
                          }}
                          className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {termOptions.length < 5 && (
                  <button
                    type="button"
                    onClick={addTermOption}
                    className="p-[5px_10px] bg-white text-[#c0392b] border border-[#c0392b] rounded-[5px] text-[11px] font-bold cursor-pointer hover:bg-[#fdecea] mt-1"
                  >
                    + Add Term Option
                  </button>
                )}
              </div>

              {/* VAT Inclusive */}
              <div className="flex items-center gap-[6px] py-[3px]">
                <input
                  type="checkbox"
                  id="chk-vat"
                  checked={vatInclusive}
                  onChange={(e) => setVatInclusive(e.target.checked)}
                  className="w-[14px] h-[14px] accent-[#c0392b] cursor-pointer"
                />
                <label htmlFor="chk-vat" className="text-[12px] text-[#333] cursor-pointer">
                  VAT Inclusive (moves VAT to Package)
                </label>
              </div>

              {/* Collections */}
              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">
                  Collection — Payment (cash)
                </label>
                <input
                  type="text"
                  value={collectionPayment}
                  onChange={(e) => setCollectionPayment(e.target.value)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">
                  Collection — Downpayment (terms)
                </label>
                <input
                  type="text"
                  value={collectionDownpayment}
                  onChange={(e) => setCollectionDownpayment(e.target.value)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">
                  Collection — Amortization (terms)
                </label>
                <input
                  type="text"
                  value={collectionAmortization}
                  onChange={(e) => setCollectionAmortization(e.target.value)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                />
              </div>

              {/* Availability */}
              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">
                  Availability
                </label>
                <input
                  type="text"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                />
              </div>

              {/* Under promo */}
              <div className="flex items-center gap-[6px] py-[3px]">
                <input
                  type="checkbox"
                  id="chk-promo"
                  checked={underPromo}
                  onChange={(e) => setUnderPromo(e.target.checked)}
                  className="w-[14px] h-[14px] accent-[#c0392b] cursor-pointer"
                />
                <label htmlFor="chk-promo" className="text-[12px] text-[#333] cursor-pointer font-bold">
                  UNDER PROMO
                </label>
              </div>

              {underPromo && (
                <div className="space-y-1.5 p-2 bg-red-50/50 border border-red-200 rounded">
                  <label className="block text-[10px] font-semibold text-[#666] uppercase">Freebies</label>
                  {freebies.map((fb, idx) => (
                    <div key={idx} className="flex justify-between items-center p-[3px_6px] bg-white border border-[#eee] rounded text-[12px]">
                      <span>{fb}</span>
                      <button
                        type="button"
                        onClick={() => setFreebies(freebies.filter((_, i) => i !== idx))}
                        className="text-[#c0392b] font-bold cursor-pointer"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Add a freebie item"
                      value={freebieInput}
                      onChange={(e) => setFreebieInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && freebieInput.trim()) {
                          setFreebies([...freebies, freebieInput.trim()]);
                          setFreebieInput("");
                        }
                      }}
                      className="flex-1 px-[7px] py-[5px] border border-[#ddd] rounded text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (freebieInput.trim()) {
                          setFreebies([...freebies, freebieInput.trim()]);
                          setFreebieInput("");
                        }
                      }}
                      className="p-[5px_8px] bg-white text-[#c0392b] border border-[#c0392b] rounded text-[11px] font-bold cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">Promo Validity</label>
                    <input
                      type="text"
                      placeholder="e.g., Valid until Dec 31, 2026"
                      value={promoValidity}
                      onChange={(e) => setPromoValidity(e.target.value)}
                      className="w-full px-[7px] py-[5px] border border-[#ddd] rounded text-[12px] bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <hr className="border-0 border-t border-[#eee] my-2" />

          {/* Delivery */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-[0.5px] border-b-[1.5px] border-[#c0392b] pb-[3px] mb-[7px]">
              Delivery
            </h2>
            <div className="flex items-center gap-[6px] py-[3px]">
              <input
                type="checkbox"
                id="chk-del"
                checked={includeDelivery}
                onChange={(e) => setIncludeDelivery(e.target.checked)}
                className="w-[14px] h-[14px] accent-[#c0392b] cursor-pointer"
              />
              <label htmlFor="chk-del" className="text-[12px] text-[#333] cursor-pointer">
                Include Delivery in Package Inclusions
              </label>
            </div>
            <p className="text-[10px] text-[#aaa] mt-0.5 mb-1.5">Unchecked = remains under Exclusives (default).</p>
          </div>

          {/* Computer Set (shown when machine has has_computer_set_option or always) */}
          {selectedMachine && (
            <div>
              <div className="flex items-center gap-[6px] py-[3px]">
                <input
                  type="checkbox"
                  id="chk-cs"
                  checked={includeComputerSet}
                  onChange={(e) => setIncludeComputerSet(e.target.checked)}
                  className="w-[14px] h-[14px] accent-[#c0392b] cursor-pointer"
                />
                <label htmlFor="chk-cs" className="text-[12px] text-[#333] cursor-pointer font-bold">
                  Include Computer Set
                </label>
              </div>
              {includeComputerSet && (
                <div className="mt-1">
                  <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">Computer Set Specifications</label>
                  <input
                    type="text"
                    placeholder="e.g., i5 Gen 12, 16GB RAM, 512GB SSD"
                    value={computerSetSpec}
                    onChange={(e) => setComputerSetSpec(e.target.value)}
                    className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                  />
                </div>
              )}
            </div>
          )}

          {/* Consumables - Prices */}
          {consumablePrices.length > 0 && (
            <div>
              <hr className="border-0 border-t border-[#eee] my-2" />
              <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-[0.5px] border-b-[1.5px] border-[#c0392b] pb-[3px] mb-[7px]">
                Consumables — Prices
              </h2>
              <p className="text-[10px] text-[#aaa] mb-1">Edit prices per client arrangement</p>
              <div className="flex text-[10px] font-semibold text-[#aaa] border-b border-[#f0f0f0] pb-0.5 mb-1">
                <span className="flex-1">ITEM</span>
                <span className="w-[68px] text-right">PKG</span>
                <span className="w-[70px] text-right">PRICE</span>
              </div>
              <div className="space-y-1">
                {consumablePrices.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-1 py-0.5 border-b border-[#f5f5f5]">
                    <span className="flex-1 text-[11px] text-[#444] truncate">{c.name}</span>
                    <span className="text-[10px] text-[#999] w-[68px] text-right truncate">{c.pkg}</span>
                    <div className="w-[70px]">
                      <input
                        type="number"
                        value={c.price}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const copy = [...consumablePrices];
                          copy[i].price = val;
                          setConsumablePrices(copy);
                        }}
                        className="w-full p-[3px_4px] border border-[#e0e0e0] rounded-[3px] text-[11px] text-right bg-[#fafafa] focus:bg-white focus:border-[#c0392b] focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Package Inclusions */}
          {inclusionItems.length > 0 && (
            <div>
              <hr className="border-0 border-t border-[#eee] my-2" />
              <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-[0.5px] border-b-[1.5px] border-[#c0392b] pb-[3px] mb-[7px]">
                Package Inclusions
              </h2>
              <p className="text-[10px] text-[#aaa] mb-1">Uncheck any item not included in this quote</p>
              <div className="space-y-1">
                {inclusionItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-[6px] py-[3px]">
                    <input
                      type="checkbox"
                      id={`incl-${item.id}`}
                      checked={item.enabled}
                      onChange={(e) => {
                        setInclusionItems(
                          inclusionItems.map((x) => (x.id === item.id ? { ...x, enabled: e.target.checked } : x))
                        );
                      }}
                      className="w-[14px] h-[14px] accent-[#c0392b] cursor-pointer"
                    />
                    <label htmlFor={`incl-${item.id}`} className="text-[12px] text-[#333] cursor-pointer flex-1">
                      {item.description}
                    </label>
                    {item.isCustom && (
                      <button type="button" onClick={() => setInclusionItems(inclusionItems.filter(x => x.id !== item.id))}
                        className="text-[#c0392b] font-bold text-[14px] leading-none cursor-pointer">&times;</button>
                    )}
                  </div>
                ))}
              </div>
              {/* Custom inclusion input */}
              {showInclusionInput ? (
                <div className="flex gap-1.5 mt-1">
                  <input type="text" placeholder="Custom inclusion…" value={newInclusionText}
                    onChange={e => setNewInclusionText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newInclusionText.trim()) {
                      setInclusionItems([...inclusionItems, { id: `ci-${Date.now()}`, description: newInclusionText.trim(), enabled: true, isCustom: true }]);
                      setNewInclusionText(""); setShowInclusionInput(false);
                    }}}
                    className="flex-1 px-[7px] py-[4px] border border-[#ddd] rounded text-[12px]" autoFocus />
                  <button type="button" onClick={() => { if (newInclusionText.trim()) {
                    setInclusionItems([...inclusionItems, { id: `ci-${Date.now()}`, description: newInclusionText.trim(), enabled: true, isCustom: true }]);
                    setNewInclusionText(""); setShowInclusionInput(false);
                  }}} className="p-[4px_8px] bg-[#c0392b] text-white rounded text-[11px] font-bold">Add</button>
                  <button type="button" onClick={() => setShowInclusionInput(false)} className="p-[4px_8px] border border-[#ddd] rounded text-[11px]">✕</button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowInclusionInput(true)}
                  className="mt-1.5 text-[11px] text-[#c0392b] border border-[#c0392b] rounded px-[8px] py-[3px] bg-white font-bold cursor-pointer hover:bg-[#fdecea]">
                  + Add Item
                </button>
              )}
            </div>
          )}

          {/* Exclusions */}
          {exclusionItems.length > 0 && (
            <div>
              <hr className="border-0 border-t border-[#eee] my-2" />
              <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-[0.5px] border-b-[1.5px] border-[#c0392b] pb-[3px] mb-[7px]">
                Exclusions
              </h2>
              <p className="text-[10px] text-[#aaa] mb-1">Uncheck any exclusion that does not apply</p>
              <div className="space-y-1">
                {exclusionItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-[6px] py-[3px]">
                    <input
                      type="checkbox"
                      id={`excl-${item.id}`}
                      checked={item.enabled}
                      onChange={(e) => {
                        setExclusionItems(
                          exclusionItems.map((x) => (x.id === item.id ? { ...x, enabled: e.target.checked } : x))
                        );
                      }}
                      className="w-[14px] h-[14px] accent-[#c0392b] cursor-pointer"
                    />
                    <label htmlFor={`excl-${item.id}`} className="text-[12px] text-[#333] cursor-pointer flex-1">
                      {item.description}
                    </label>
                    {item.isCustom && (
                      <button type="button" onClick={() => setExclusionItems(exclusionItems.filter(x => x.id !== item.id))}
                        className="text-[#c0392b] font-bold text-[14px] leading-none cursor-pointer">&times;</button>
                    )}
                  </div>
                ))}
              </div>
              {/* Custom exclusion input */}
              {showExclusionInput ? (
                <div className="flex gap-1.5 mt-1">
                  <input type="text" placeholder="Custom exclusion…" value={newExclusionText}
                    onChange={e => setNewExclusionText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newExclusionText.trim()) {
                      setExclusionItems([...exclusionItems, { id: `ce-${Date.now()}`, description: newExclusionText.trim(), enabled: true, isCustom: true }]);
                      setNewExclusionText(""); setShowExclusionInput(false);
                    }}}
                    className="flex-1 px-[7px] py-[4px] border border-[#ddd] rounded text-[12px]" autoFocus />
                  <button type="button" onClick={() => { if (newExclusionText.trim()) {
                    setExclusionItems([...exclusionItems, { id: `ce-${Date.now()}`, description: newExclusionText.trim(), enabled: true, isCustom: true }]);
                    setNewExclusionText(""); setShowExclusionInput(false);
                  }}} className="p-[4px_8px] bg-[#c0392b] text-white rounded text-[11px] font-bold">Add</button>
                  <button type="button" onClick={() => setShowExclusionInput(false)} className="p-[4px_8px] border border-[#ddd] rounded text-[11px]">✕</button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowExclusionInput(true)}
                  className="mt-1.5 text-[11px] text-[#c0392b] border border-[#c0392b] rounded px-[8px] py-[3px] bg-white font-bold cursor-pointer hover:bg-[#fdecea]">
                  + Add Item
                </button>
              )}
            </div>
          )}

          {/* Optional Add-Ons */}
          {addonItems.length > 0 && (
            <div>
              <hr className="border-0 border-t border-[#eee] my-2" />
              <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-[0.5px] border-b-[1.5px] border-[#c0392b] pb-[3px] mb-[7px]">
                Optional Add-Ons
              </h2>
              <div className="space-y-1">
                {addonItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-[6px] py-[3px]">
                    <input
                      type="checkbox"
                      id={`addon-${item.id}`}
                      checked={item.enabled}
                      onChange={(e) => {
                        setAddonItems(
                          addonItems.map((x) => (x.id === item.id ? { ...x, enabled: e.target.checked } : x))
                        );
                      }}
                      className="w-[14px] h-[14px] accent-[#c0392b] cursor-pointer"
                    />
                    <label htmlFor={`addon-${item.id}`} className="text-[12px] text-[#333] cursor-pointer flex-1">
                      {item.description}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <hr className="border-0 border-t border-[#eee] my-2" />

          {/* WARRANTY */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-[0.5px] border-b-[1.5px] border-[#c0392b] pb-[3px] mb-[7px]">
              Warranty
            </h2>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">
                  Company Name (confidentiality line)
                </label>
                <select
                  value={warrantyCompany}
                  onChange={(e) => setWarrantyCompany(e.target.value)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                >
                  <option value="ES Print Media Inc.">ES Print Media Inc.</option>
                  <option value="ACS Premium Solutions Inc.">ACS Premium Solutions Inc.</option>
                  <option value="ES Concept Group Inc.">ES Concept Group Inc.</option>
                  <option value="ES Print Industries Inc.">ES Print Industries Inc.</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">
                  Supplier Name (void-warranty line)
                </label>
                <input
                  type="text"
                  placeholder="ESPMI"
                  value={warrantySupplier}
                  onChange={(e) => setWarrantySupplier(e.target.value)}
                  className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                />
              </div>
            </div>
          </div>

          <hr className="border-0 border-t border-[#eee] my-2" />

          {/* SIGNATORIES */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-[0.5px] border-b-[1.5px] border-[#c0392b] pb-[3px] mb-[7px]">
              Signatories
            </h2>
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">Account Executive</label>
                  <input
                    type="text"
                    placeholder="AE name"
                    value={aeName}
                    onChange={(e) => setAeName(e.target.value)}
                    className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">Client Conforme</label>
                  <input
                    type="text"
                    placeholder="Client name"
                    value={clientConforme}
                    onChange={(e) => setClientConforme(e.target.value)}
                    className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                  />
                </div>
              </div>

              <div className="flex gap-1.5">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">Noted By (Name)</label>
                  <input
                    type="text"
                    placeholder="Ness Deomano"
                    value={notedByName}
                    onChange={(e) => setNotedByName(e.target.value)}
                    className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-[#666] uppercase mb-[2px]">Noted By (Role)</label>
                  <input
                    type="text"
                    placeholder="Area Sales Manager"
                    value={notedByRole}
                    onChange={(e) => setNotedByRole(e.target.value)}
                    className="w-full px-[7px] py-[5px] border border-[#ddd] rounded-[4px] text-[12px] bg-[#fafafa]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Validation errors box */}
          {showValidationBox && validationErrors.length > 0 && (
            <div className="p-[8px_10px] bg-[#fef2f2] border border-[#fca5a5] rounded-[6px] text-[#c0392b] text-[11px] mb-2">
              <div className="flex justify-between items-center font-bold mb-1">
                <span>Please fix the following before continuing:</span>
                <button
                  type="button"
                  onClick={() => setShowValidationBox(false)}
                  className="bg-transparent border-0 text-[#c0392b] font-bold text-[16px] cursor-pointer"
                >
                  &times;
                </button>
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <hr className="border-0 border-t border-[#eee] my-2" />

          {/* CLOSING DOCUMENTS SECTION */}
          <div>
            <h2 className="text-[11px] font-bold text-[#c0392b] uppercase tracking-[0.5px] border-b-[1.5px] border-[#c0392b] pb-[3px] mb-[7px]">
              Closing Documents
            </h2>
            <p className="text-[10px] text-[#aaa] mb-2 leading-normal">
              Prepare the delivery &amp; document details, then open the printable closing documents (T&amp;C, Delivery Instructions, Warranty, CAC, PDC, Pullout).
            </p>

            <button
              type="button"
              onClick={async () => {
                if (validationErrors.length > 0) { setShowValidationBox(true); return; }
                // Save first so closing docs can load the quote by ID
                setSaving(true);
                try {
                  const payload = {
                    machine_id: selectedMachine?.id ?? null,
                    client_name: clientName, company, address, contact, email,
                    quote_date: quoteDate, salutation, opening_line: openingLine,
                    deal_type: dealType, contract_price: contractPrice,
                    vat_inclusive: vatInclusive, under_promo: underPromo, promo_validity: promoValidity,
                    unit_condition_override: unitCondition !== selectedMachine?.unit_condition ? unitCondition : null,
                    include_delivery: includeDelivery, include_computer_set: includeComputerSet, computer_set_spec: computerSetSpec,
                    inclusion_toggles: inclusionItems, exclusion_toggles: exclusionItems, addon_toggles: addonItems,
                    warranty_company: warrantyCompany, warranty_supplier: warrantySupplier,
                    availability, collection_payment: collectionPayment,
                    collection_downpayment: collectionDownpayment, collection_amortization: collectionAmortization,
                    ae_name: aeName, client_conforme: clientConforme,
                    noted_by_name: notedByName, noted_by_role: notedByRole,
                    letterhead, freebies,
                    term_options: termOptions.map((t, i) => ({ down_payment: t.downPayment, months: t.months, monthly_amortization: t.monthlyAmortization, sort_order: i })),
                    trade_ins: tradeIns.filter(t => t.value > 0 || t.description.trim()).map((t, i) => ({ description: t.description, value: t.value, sort_order: i })),
                    consumable_prices: consumablePrices.filter(c => c.id && !c.id.startsWith("c-")).map(c => ({ consumable_id: c.id, custom_price: c.price })),
                  };
                  const url = savedQuoteId ? `/api/sales/quotes/${savedQuoteId}` : "/api/sales/quotes";
                  const res = await fetch(url, { method: savedQuoteId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Save failed");
                  const qId = savedQuoteId || data.id;
                  setSavedQuoteId(qId);
                  if (!savedQuoteId) router.replace(`/sales/quote-builder?id=${qId}`);
                  router.push(`/sales/closing-docs?id=${qId}`);
                } catch { alert("Failed to save before opening closing docs. Please try again."); }
                finally { setSaving(false); }
              }}
              className="w-full p-[10px] bg-[#c0392b] hover:bg-[#a93226] text-white rounded-[6px] font-bold text-[13px] tracking-[0.5px] cursor-pointer text-center block border-0 transition-colors shadow-xs mb-2"
            >
              {saving ? "SAVING…" : "OPEN CLOSING DOCUMENTS"}
            </button>

            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="w-full p-[10px] bg-[#c0392b] hover:bg-[#a93226] disabled:opacity-60 text-white rounded-[6px] font-bold text-[13px] tracking-[0.5px] cursor-pointer text-center block border-0 transition-colors shadow-xs"
            >
              {saving ? "SAVING…" : saveSuccess ? "✓ SAVED!" : "💾 SAVE AS PDF"}
            </button>
            <p className="text-[10px] text-[#aaa] text-center mt-1 mb-0">
              {savedQuoteId ? "Quote saved. In print dialog, set Destination to &quot;Save as PDF&quot;." : "Saves quote then opens print dialog."}
            </p>
          </div>
        </div>
      </aside>

      {/* ─── RIGHT LIVE DOCUMENT PREVIEW (Exact mirror of QuotePreviewPanel.vue) ─── */}
      <section className="flex-1 h-full overflow-y-auto bg-[#e5e7eb] px-2 py-3 flex justify-center items-start">
        <div
          id="quote-paper"
          className="w-full max-w-[820px] min-h-[297mm] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.08)] rounded-[2px] pb-[6mm] flex flex-col justify-between select-text"
        >
          <div>
            {/* Top Letterhead with red bottom bar */}
            <div className="border-b-[3px] border-[#c0392b] mb-[3mm]">
              <img
                src={letterheadHeaderImg}
                alt={`${letterhead} letterhead`}
                className="w-full block"
              />
              <div className="px-[14mm] py-[2px_4px] flex justify-end text-[7.5pt] text-[#555]">
                {formattedDate && <span>Date: {formattedDate}</span>}
              </div>
            </div>

            {/* Document Body */}
            <div className="px-[14mm]">
              {/* Client Info Block */}
              {(clientName || company || address || contact || email) && (
                <div className="mb-[3mm]">
                  {clientName && <p className="m-0 text-[10.5pt] font-bold text-[#111]">{clientName}</p>}
                  {company && <p className="m-0 text-[8.5pt] text-[#555] leading-[1.45]">{company}</p>}
                  {address && <p className="m-0 text-[8.5pt] text-[#555] leading-[1.45]">{address}</p>}
                  {contact && <p className="m-0 text-[8.5pt] text-[#555] leading-[1.45]">{contact}</p>}
                  {email && <p className="m-0 text-[8.5pt] text-[#555] leading-[1.45]">{email}</p>}
                </div>
              )}

              {/* Salutation */}
              {salutation && <p className="mt-[3mm] mb-[1mm] text-[8.5pt] text-[#333]">{salutation}</p>}

              {/* Opening Line */}
              {openingLine && <p className="mt-0 mb-[3mm] text-[8.5pt] text-[#555] leading-[1.55]">{openingLine}</p>}

              {/* Machine Title + Condition Badge */}
              <div className="text-[11pt] font-bold text-[#c0392b] text-center uppercase tracking-[0.5px] mb-[2mm] border-b border-[#f0f0f0] pb-[1.5mm]">
                {selectedMachine ? selectedMachine.model : "NO MACHINE SELECTED"}
                {selectedMachine && unitCondition && (
                  <span
                    className={`block text-[8pt] font-bold tracking-[1px] mt-[1mm] ${
                      unitCondition === "Brand New" ? "text-[#27ae60]" : "text-[#c0392b]"
                    }`}
                  >
                    {unitCondition.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Hero: image + features */}
              {selectedMachine && selectedMachine.features && selectedMachine.features.length > 0 && (() => {
                const pictureLink = selectedMachine.product_info_links?.find(
                  (l) => l.document_type === "picture" || l.document_type === "image"
                );
                const imgUrl = pictureLink?.url ?? null;
                return (
                  <div className="flex gap-[5mm] items-start mb-[2mm]">
                    {imgUrl && (
                      <div className="w-[70mm] shrink-0 text-center">
                        <img
                          src={imgUrl}
                          alt={selectedMachine.model}
                          className="max-w-[70mm] max-h-[62mm] object-contain mx-auto"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="text-[8pt] font-bold text-[#333] mb-[1mm] uppercase">
                        Product Specifications:
                      </div>
                      <ul className="list-disc pl-[14px] m-0 space-y-0 text-[8pt] text-[#444] leading-[1.55]">
                        {selectedMachine.features.map((f, i) => (
                          <li key={i}>{typeof f === "string" ? f : (f as any).description}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })()}

              {/* PRICING TABLE */}
              {contractPrice > 0 && (
                <div className="mb-[3mm]">
                  <div className="text-[8pt] font-bold text-[#c0392b] uppercase mt-[2mm] mb-0 tracking-[0.4px]">
                    Pricing
                    <span className="block w-full h-[1px] bg-[#c0392b] mt-[1mm] mb-[1.5mm]"></span>
                  </div>
                  <table className="w-full border-collapse mb-[1mm] text-[7.5pt]">
                    <thead>
                      <tr className="bg-[#c0392b] text-white">
                        <th className="p-[3px_4px] text-left font-bold">Model</th>
                        <th className="p-[3px_4px] text-right font-bold">Contract Price</th>
                        {showTradeIns && <th className="p-[3px_4px] text-right font-bold">Trade-In Value</th>}
                        <th className="p-[3px_4px] text-right font-bold">Down Payment</th>
                        <th className="p-[3px_4px] text-right font-bold">Balance</th>
                        <th className="p-[3px_4px] text-center font-bold">Payment Terms</th>
                        <th className="p-[3px_4px] text-right font-bold">Monthly Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricingRows.map((row, idx) => (
                        <tr key={idx} className="border-b border-[#eee]">
                          <td className="p-[3px_4px]">{idx === 0 ? selectedModel || "" : ""}</td>
                          <td className="p-[3px_4px] text-right">{formatDisplayCurrency(contractPrice)}</td>
                          {showTradeIns && (
                            <td className="p-[3px_4px] text-right">
                              {tradeInSum > 0 ? formatDisplayCurrency(tradeInSum) : "—"}
                            </td>
                          )}
                          <td className="p-[3px_4px] text-right">{row.downPayment ? formatDisplayCurrency(row.downPayment) : "—"}</td>
                          <td className="p-[3px_4px] text-right font-bold text-[#111]">{formatDisplayCurrency(row.balance)}</td>
                          <td className="p-[3px_4px] text-center">{row.paymentTerms}</td>
                          <td className="p-[3px_4px] text-right font-bold text-[#c0392b]">
                            {row.monthly !== null ? formatDisplayCurrency(row.monthly) : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={showTradeIns ? 7 : 6} className="p-[2px_4px]">
                          <div className="flex justify-between items-center">
                            {vatInclusive ? (
                              <span className="font-bold text-[#c0392b] tracking-[0.5px]">VAT INCLUSIVE</span>
                            ) : (
                              <span></span>
                            )}
                            <span className="italic text-[7pt] text-[#888]">
                              in Philippine Pesos. Prices may change without prior notice.
                            </span>
                          </div>
                        </td>
                      </tr>
                      {showTradeIns && tradeInDescriptions.length > 0 && (
                        <tr className="text-[7.5pt] text-[#444]">
                          <td colSpan={7} className="p-[2px_4px]">
                            <strong>Trade-In Unit(s):</strong> {tradeInDescriptions.join("; ")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* COLLECTION ARRANGEMENTS */}
              {(availability || collectionPayment || collectionDownpayment || collectionAmortization) && (
                <div className="mb-[2mm]">
                  <div className="text-[8pt] font-bold text-[#c0392b] uppercase mt-[2mm] mb-0 tracking-[0.4px]">
                    Collection Arrangements
                    <span className="block w-full h-[1px] bg-[#c0392b] mt-[1mm] mb-[1.5mm]"></span>
                  </div>
                  <div className="text-[8pt] text-[#333] p-[3px_8px] bg-[#f9f9f9] border-l-[3px] border-[#c0392b] my-[2mm] leading-[1.6]">
                    {collectionPayment && (
                      <p className="m-[0_0_1mm] text-[8pt]">
                        <span className="inline-block w-[80px] font-semibold text-[#555]">Payment:</span>
                        {formatDisplayCurrency(Math.max(0, contractPrice - tradeInSum))} — {collectionPayment}
                      </p>
                    )}
                    {collectionDownpayment && (
                      <p className="m-[0_0_1mm] text-[8pt]">
                        <span className="inline-block w-[80px] font-semibold text-[#555]">Down Payment:</span>
                        {collectionDownpayment}
                      </p>
                    )}
                    {collectionAmortization && (
                      <p className="m-0 text-[8pt]">
                        <span className="inline-block w-[80px] font-semibold text-[#555]">Amortization:</span>
                        {collectionAmortization}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* FREEBIES */}
              {underPromo && freebies.length > 0 && (
                <div className="mb-[2mm]">
                  <div className="text-[8pt] font-bold text-[#c0392b] uppercase mt-[2mm] mb-0 tracking-[0.4px]">
                    Freebies
                    <span className="block w-full h-[1px] bg-[#c0392b] mt-[1mm] mb-[1.5mm]"></span>
                  </div>
                  <ul className="list-none pl-0 mb-[2mm] space-y-0 text-[8pt] text-[#444] leading-[1.8]">
                    {freebies.map((freebie, idx) => (
                      <li key={idx}>
                        <span className="text-[#c0392b] mr-[5px]">▪</span> {freebie}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* PACKAGE INCLUSIONS / EXCLUSIONS */}
              {(displayedInclusions.length > 0 || displayedExclusions.length > 0) && (
                <div className="mb-[2mm]">
                  <div className="text-[8pt] font-bold text-[#c0392b] uppercase mt-[2mm] mb-0 tracking-[0.4px]">
                    Package Inclusions / Exclusions
                    <span className="block w-full h-[1px] bg-[#c0392b] mt-[1mm] mb-[1.5mm]"></span>
                  </div>
                  <div className="grid grid-cols-2 gap-[3mm] my-[2mm]">
                    {displayedInclusions.length > 0 && (
                      <div>
                        <div className="text-[8pt] font-bold uppercase text-white bg-[#c0392b] p-[3px_8px] rounded-t-[2px]">
                          Package Inclusions
                        </div>
                        <div className="border border-[#eee] border-t-0 p-[3px_8px] min-h-[12mm]">
                          <ul
                            className="list-disc pl-[14px] m-0"
                            style={{
                              columnCount: displayedInclusions.length >= 8 ? 2 : 1,
                              columnGap: "4mm",
                            }}
                          >
                            {displayedInclusions.map((item, idx) => (
                              <li key={idx} className="text-[7.5pt] text-[#333] leading-[1.55] break-inside-avoid">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                    {displayedExclusions.length > 0 && (
                      <div>
                        <div className="text-[8pt] font-bold uppercase text-white bg-[#c0392b] p-[3px_8px] rounded-t-[2px]">
                          Exclusive
                        </div>
                        <div className="border border-[#eee] border-t-0 p-[3px_8px] min-h-[12mm]">
                          <ul className="list-disc pl-[14px] m-0">
                            {displayedExclusions.map((item, idx) => (
                              <li key={idx} className="text-[7.5pt] text-[#333] leading-[1.55]">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* OPTIONAL ADD-ONS */}
              {addonItems.some((a) => a.enabled) && (
                <div className="mb-[2mm]">
                  <div className="text-[8pt] font-bold text-[#c0392b] uppercase mt-[2mm] mb-0 tracking-[0.4px]">
                    Optional Add-Ons
                    <span className="block w-full h-[1px] bg-[#c0392b] mt-[1mm] mb-[1.5mm]"></span>
                  </div>
                  <div className="space-y-[1px] text-[7.5pt] text-[#444] leading-[1.55]">
                    {addonItems.map((addon) => (
                      <div key={addon.id} className="flex items-baseline gap-1 py-[1px]">
                        <span className="shrink-0 text-[8.5pt]">{addon.enabled ? "☑" : "☐"}</span>
                        <span>{addon.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CONSUMABLES GRID */}
              {consumablePrices.length > 0 && (
                <div className="mb-[2mm]">
                  <div className="text-[8pt] font-bold text-[#c0392b] uppercase mt-[2mm] mb-0 tracking-[0.4px]">
                    Consumables
                    <span className="block w-full h-[1px] bg-[#c0392b] mt-[1mm] mb-[1.5mm]"></span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-[3mm] gap-y-0 mb-[2mm]">
                    {consumablePrices.map((c) => (
                      <div key={c.id} className="flex justify-between p-[1px_3px] border-b border-[#f5f5f5] text-[7.5pt]">
                        <span className="text-[#333] flex-1 truncate">{c.name}</span>
                        <span className="text-[#999] text-[7pt] mx-[3px] shrink-0">{c.pkg}</span>
                        <span className="text-[#c0392b] font-semibold shrink-0">
                          {formatDisplayCurrency(vatInclusive ? c.price * 1.12 : c.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* COMPUTER SET */}
              {includeComputerSet && computerSetSpec && (
                <div className="mb-[2mm]">
                  <div className="text-[8pt] font-bold text-[#c0392b] uppercase mt-[2mm] mb-0 tracking-[0.4px]">
                    Computer Set
                    <span className="block w-full h-[1px] bg-[#c0392b] mt-[1mm] mb-[1.5mm]"></span>
                  </div>
                  <p className="text-[8pt] text-[#444] m-0">{computerSetSpec}</p>
                </div>
              )}

              {/* AVAILABILITY */}
              {availability && (
                <div className="text-[8pt] text-[#333] my-[2mm]">
                  <strong>AVAILABILITY:</strong> {availability}
                </div>
              )}

              {/* WARRANTY */}
              {warrantyCompany && (
                <div className="mb-[2mm]">
                  <div className="text-[8pt] font-bold text-[#c0392b] uppercase mt-[2mm] mb-0 tracking-[0.4px]">
                    Warranty
                    <span className="block w-full h-[1px] bg-[#c0392b] mt-[1mm] mb-[1.5mm]"></span>
                  </div>
                  {warrantyLines.map((line, idx) =>
                    line.heading ? (
                      <div key={idx} className="text-[8pt] font-bold text-[#c0392b] uppercase mt-[2mm]">
                        {line.text}
                        <span className="block w-full h-[1px] bg-[#c0392b] mt-[1mm] mb-[1.5mm]"></span>
                      </div>
                    ) : (
                      <ul key={idx} className="list-disc pl-[14px] m-0">
                        <li
                          className={`text-[8pt] leading-[1.65] ${
                            line.bold ? "text-[#c0392b] font-bold" : "text-[#555]"
                          }`}
                        >
                          {line.text}
                        </li>
                      </ul>
                    )
                  )}
                </div>
              )}

              {/* Closing Text & Signatures */}
              <div className="mt-auto pt-[4mm] border-t-2 border-[#e5e7eb] print:break-inside-avoid">
                <p className="text-[8.5pt] text-[#555] leading-[1.6] mb-[5mm]">
                  Trusting that the above quotation will receive your favorable consideration and assuring you of our best
                  service at all times. Thank you very much.
                </p>

                <div className="grid grid-cols-2 gap-[4mm] mb-[6mm] text-[8.5pt] text-[#555] italic">
                  <span>Very truly yours,</span>
                  <span>Conforme:</span>
                </div>

                <div className="grid grid-cols-2 gap-[4mm] text-center mt-[8mm]">
                  <div className="flex flex-col items-center">
                    <div className="text-[8pt] text-[#111] font-bold uppercase min-h-[14px]">
                      {aeName || ""}
                    </div>
                    <span className="block w-full max-w-[200px] h-[1px] bg-[#333] my-[2px_3px]"></span>
                    <div className="text-[7.5pt] text-[#555]">Account Executive</div>
                    <div className="text-[6.5pt] text-[#999] italic">Signature over Printed Name</div>
                  </div>

                  <div>
                    <div className="text-[8pt] text-[#111] font-bold uppercase min-h-[14px]">
                      {clientConforme || clientName || ""}
                    </div>
                    <span className="block w-full max-w-[200px] h-[1px] bg-[#333] my-[2px_3px]"></span>
                    <div className="text-[7.5pt] text-[#555]">Client / Authorized Representative</div>
                    <div className="text-[6.5pt] text-[#999] italic">Signature over Printed Name</div>
                  </div>
                </div>

                {(notedByName || notedByRole) && (
                  <div className="mt-[4mm] flex flex-col items-start text-[7.5pt]">
                    <div className="text-[#777] mb-[1px]">Noted By:</div>
                    <div className="font-bold text-[#111] uppercase">{notedByName || ""}</div>
                    <span className="block w-[180px] h-[1px] bg-[#333] my-[2px_3px]"></span>
                    {notedByRole && <div className="text-[#555]">{notedByRole}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Letterhead Footer */}
          <footer className="mt-4">
            <img
              src={letterheadFooterImg}
              alt={`${letterhead} footer`}
              className="w-full block"
            />
          </footer>
        </div>
      </section>
    </div>
  );
}
