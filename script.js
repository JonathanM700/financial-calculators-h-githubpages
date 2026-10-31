const LAST_AUCTION = {
  asOf: "21 September 2026",
  issueDate: "2026-09-21",
  auctionDate: "2026-09-17",
  valueDate: "2026-09-21",
  sourceLabel: "CBK results released 17 September 2026",
  sourceUrl: "https://www.centralbank.go.ke/bills-bonds/treasury-bills/",
  rates: {
    91: 8.7837,
    182: 8.9099,
    364: 9.0566,
  },
  marketRates: {
    91: 8.7844,
    182: 8.9099,
    364: 9.0602,
  },
  maturities: {
    91: "2026-12-21",
    182: "2027-03-22",
    364: "2027-09-20",
  },
};

const STORAGE_KEY = "kenya-tbill-calculator-v3";
const FACE_PRESETS = [50000, 100000, 500000, 1000000, 2000000];
const EXPENSE_PRESETS = [
  { amount: 300, description: "Typical bank KEPSS/RTGS", vat: false },
  { amount: 500, description: "Higher-end RTGS", vat: false },
];
const DAYS_IN_YEAR = 365;
const VAT_RATE = 0.16;
const MIN_FACE = 50000;
const FACE_STEP = 50000;
const COMPETITIVE_MIN = 2000000;
const PUBLISHED_PRICE_DECIMALS = 4;

const KENYA_HOLIDAYS_2026 = new Set([
  "2026-01-01",
  "2026-04-03",
  "2026-04-06",
  "2026-05-01",
  "2026-06-01",
  "2026-10-20",
  "2026-12-25",
  "2026-12-26",
]);

const form = document.getElementById("tbillForm");
const faceValueInput = document.getElementById("faceValue");
const interestRateInput = document.getElementById("interestRate");
const daysSelect = document.getElementById("days");
const expensesList = document.getElementById("expensesList");
const addExpenseButton = document.getElementById("addExpenseButton");
const resetButton = document.getElementById("resetButton");
const copyButton = document.getElementById("copyButton");
const printButton = document.getElementById("printButton");
const shareButton = document.getElementById("shareButton");
const usePublishedRateButton = document.getElementById("usePublishedRate");
const priceOutput = document.getElementById("price");
const taxAmountOutput = document.getElementById("taxAmount");
const totalPaymentOutput = document.getElementById("totalPayment");
const totalPaymentDetail = document.getElementById("totalPaymentDetail");
const netInterestOutput = document.getElementById("netInterest");
const totalExpenditureOutput = document.getElementById("totalExpenditure");
const expensesTotalOutput = document.getElementById("expensesTotal");
const earningBeforeOutput = document.getElementById("earningBefore");
const earningAfterOutput = document.getElementById("earningAfter");
const taxRateDisplay = document.getElementById("taxRateDisplay");
const taxRateRow = document.getElementById("taxRateRow");
const taxRateEdit = document.getElementById("taxRateEdit");
const editTaxButton = document.getElementById("editTaxButton");
const saveTaxButton = document.getElementById("saveTaxButton");
const taxRateInput = document.getElementById("taxRate");
const popover = document.getElementById("popover");
const formError = document.getElementById("formError");
const faceValueError = document.getElementById("faceValueError");
const interestRateError = document.getElementById("interestRateError");
const resultsStatus = document.getElementById("resultsStatus");
const pricePer100Output = document.getElementById("pricePer100");
const maturityValueOutput = document.getElementById("maturityValue");
const netProfitOutput = document.getElementById("netProfit");
const timeline = document.getElementById("timeline");
const dateHint = document.getElementById("dateHint");
const auctionBadge = document.getElementById("auctionBadge");
const rateAsOf = document.getElementById("rateAsOf");
const rateChips = document.getElementById("rateChips");
const faceChips = document.getElementById("faceChips");
const expensePresets = document.getElementById("expensePresets");
const compare91 = document.getElementById("compare91");
const compare182 = document.getElementById("compare182");
const compare364 = document.getElementById("compare364");
const compareBody = document.getElementById("compareBody");
const themeToggle = document.getElementById("themeToggle");
const cashBreakdown = document.getElementById("cashBreakdown");
const yieldInsight = document.getElementById("yieldInsight");
const yearValueBody = document.getElementById("yearValueBody");
const formulaCheck = document.getElementById("formulaCheck");

let taxEnabled = true;
let currentTaxRate = 15;
let expenseIndex = 0;
let lastResult = null;
let activeInfoButton = null;

const infoCopy = {
  faceValue: "Face value is the amount CBK pays you at maturity. Current CBK rule: minimum KES 50,000 for non-competitive bids, additional amounts in multiples of KES 50,000. Competitive bids start at KES 2,000,000.",
  taxOption: "Choose Yes to add withholding tax to the CBK settlement amount, matching the published CBK worked example. Choose Tax exempt if you will present a KRA tax exemption certificate. Companies and other entities may have different treatment.",
  interestRate: "Enter the published CBK weighted average bill rate, or the yield you will bid competitively, as a percent with up to four decimal places.",
  days: "Select 91, 182, or 364 days. That tenor is the discount period in the CBK price formula.",
  price: "The discounted amount you pay for the bill itself, before tax and bank fees. Price per 100 = 100 / (1 + yield × days / 365), rounded to four decimals to match CBK result sheets.",
  taxAmount: "Withholding tax on the discount (face value minus bill price). CBK adds this to the amount payable at settlement. You still receive full face value at maturity.",
  totalPayment: "Amount payable to CBK: bill price plus tax. This is the figure to match against DhowCSD Transactions, excluding your own bank transfer fees.",
  totalExpenditure: "Full cash outflow: CBK payment plus any extra expenses you listed.",
  netInterest: "Gross discount: face value minus bill price, before tax and expenses.",
  earningBefore: "Profit after tax but before extra expenses. Percentages use the CBK payment as the amount invested.",
  earningAfter: "Final net profit after tax and expenses. Percentages use total cash out. Simple annualized scales the holding-period return by 365/days. Compounded annual is the equivalent yearly rate if that return were repeated.",
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatKES(value) {
  return Number(value).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value, digits = 2) {
  return `${value.toFixed(digits)}%`;
}

function parseNumber(input) {
  if (!input) return NaN;
  const value = parseFloat(input.value);
  return Number.isFinite(value) ? value : NaN;
}

function isoDate(date) {
  const copy = new Date(date);
  const year = copy.getFullYear();
  const month = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isKenyaHoliday(date) {
  return KENYA_HOLIDAYS_2026.has(isoDate(date));
}

function nextWeekday(fromDate, weekday) {
  const date = new Date(fromDate);
  date.setHours(12, 0, 0, 0);
  const delta = (weekday - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + delta);
  return date;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function nextBusinessDay(date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  while (isWeekend(next) || isKenyaHoliday(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function formatDate(date) {
  return date.toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function auctionDates(from = new Date()) {
  const auction = nextWeekday(from, 4);
  const followingMonday = nextWeekday(addDays(auction, 1), 1);
  const settlement = nextBusinessDay(followingMonday);
  return { auction, settlement };
}

function publishedRate(days) {
  return LAST_AUCTION.rates[days];
}

function isPublishedRate(value) {
  return Object.values(LAST_AUCTION.rates).some((rate) => Math.abs(rate - value) < 1e-6);
}

function showPopover(text, anchor) {
  if (!popover) return;
  popover.innerHTML = `<p>${escapeHtml(text)}</p>`;
  popover.classList.remove("hidden");
  popover.style.position = "fixed";
  const rect = anchor.getBoundingClientRect();
  popover.style.top = `${rect.bottom + 10}px`;
  popover.style.left = `${Math.max(16, rect.left)}px`;

  const popoverRect = popover.getBoundingClientRect();
  if (popoverRect.right > window.innerWidth - 16) {
    popover.style.left = `${Math.max(16, window.innerWidth - popoverRect.width - 16)}px`;
  }
  if (popoverRect.bottom > window.innerHeight - 16) {
    popover.style.top = `${Math.max(16, rect.top - popoverRect.height - 10)}px`;
  }
  if (activeInfoButton && activeInfoButton !== anchor) {
    activeInfoButton.setAttribute("aria-expanded", "false");
  }
  activeInfoButton = anchor;
  anchor.setAttribute("aria-expanded", "true");
  popover.setAttribute("aria-hidden", "false");
}

function hidePopover() {
  if (!popover) return;
  popover.classList.add("hidden");
  popover.setAttribute("aria-hidden", "true");
  if (activeInfoButton) {
    activeInfoButton.setAttribute("aria-expanded", "false");
    activeInfoButton = null;
  }
}

function setFieldError(element, message) {
  if (!element) return;
  if (message) {
    element.hidden = false;
    element.textContent = message;
  } else {
    element.hidden = true;
    element.textContent = "";
  }
}

function createExpenseRow(amount = "", description = "", vat = false) {
  if (!expensesList) return;
  const row = document.createElement("div");
  row.className = "expense-row";
  row.dataset.index = String(expenseIndex);

  const amountLabel = document.createElement("label");
  amountLabel.textContent = "Expense amount (KES)";
  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.min = "0";
  amountInput.step = "0.01";
  amountInput.placeholder = "500";
  amountInput.value = amount;
  amountLabel.appendChild(amountInput);

  const descLabel = document.createElement("label");
  descLabel.textContent = "Description";
  const descInput = document.createElement("input");
  descInput.type = "text";
  descInput.placeholder = "e.g. KEPSS/RTGS charge";
  descInput.value = description;
  descLabel.appendChild(descInput);

  const vatLabel = document.createElement("label");
  vatLabel.className = "vat-toggle";
  const vatInput = document.createElement("input");
  vatInput.type = "checkbox";
  vatInput.checked = vat;
  vatLabel.append(vatInput, ` Add ${VAT_RATE * 100}% VAT`);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-expense";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    persistState();
    computeResults({ silent: true });
  });

  row.append(amountLabel, descLabel, vatLabel, removeButton);
  expensesList.appendChild(row);
  expenseIndex += 1;
  amountInput.addEventListener("input", onFormChange);
  descInput.addEventListener("input", persistState);
  vatInput.addEventListener("change", onFormChange);
}

function readExpenses() {
  if (!expensesList) return [];
  return Array.from(expensesList.querySelectorAll(".expense-row")).reduce((acc, row) => {
    const amount = parseFloat(row.querySelector('input[type="number"]').value) || 0;
    const description = row.querySelector('input[type="text"]').value.trim();
    const vat = row.querySelector('input[type="checkbox"]').checked;
    const total = round2(amount * (vat ? 1 + VAT_RATE : 1));
    if (total > 0 || description) {
      acc.push({ amount: total, description, vat });
    }
    return acc;
  }, []);
}

function pricePerHundred(ratePercent, days) {
  const raw = 100 / (1 + (ratePercent / 100) * (days / DAYS_IN_YEAR));
  return roundTo(raw, PUBLISHED_PRICE_DECIMALS);
}

function calculate(faceValue, ratePercent, days, includeTax, taxRatePercent, expenses) {
  const pricePer100 = pricePerHundred(ratePercent, days);
  const priceTotal = round2(pricePer100 * (faceValue / 100));
  const grossInterest = round2(faceValue - priceTotal);
  const taxAmount = includeTax ? round2(grossInterest * (taxRatePercent / 100)) : 0;
  const expensesTotal = round2(expenses.reduce((sum, item) => sum + item.amount, 0));
  const totalOfferPayment = round2(priceTotal + taxAmount);
  const totalExpenditure = round2(totalOfferPayment + expensesTotal);
  const earningBefore = round2(grossInterest - taxAmount);
  const earningAfter = round2(earningBefore - expensesTotal);
  const beforeBase = totalOfferPayment || faceValue;
  const afterBase = totalExpenditure || faceValue;
  const beforePeriod = (earningBefore / beforeBase) * 100;
  const afterPeriod = (earningAfter / afterBase) * 100;
  const beforeAnnual = beforePeriod * (DAYS_IN_YEAR / days);
  const afterAnnual = afterPeriod * (DAYS_IN_YEAR / days);
  const beforeCompound = (Math.pow(1 + earningBefore / beforeBase, DAYS_IN_YEAR / days) - 1) * 100;
  const afterCompound = (Math.pow(1 + earningAfter / afterBase, DAYS_IN_YEAR / days) - 1) * 100;
  const yearValue = round2(afterBase * (1 + afterCompound / 100));

  return {
    faceValue,
    ratePercent,
    days,
    pricePer100,
    priceTotal,
    grossInterest,
    taxAmount,
    expensesTotal,
    totalOfferPayment,
    totalExpenditure,
    earningBefore,
    earningAfter,
    beforePeriod,
    afterPeriod,
    beforeAnnual,
    afterAnnual,
    beforeCompound,
    afterCompound,
    yearValue,
  };
}

function validateInputs(showErrors) {
  if (!faceValueInput || !interestRateInput || !daysSelect) return null;
  const faceValue = parseInt(faceValueInput.value, 10);
  const interestRate = parseNumber(interestRateInput);
  const errors = [];

  const faceValid = Number.isInteger(faceValue) && faceValue >= MIN_FACE && faceValue % FACE_STEP === 0;
  const rateValid = !Number.isNaN(interestRate) && interestRate >= 0 && interestRate <= 100;

  if (!faceValid) {
    errors.push("Face value must be at least KES 50,000 and a multiple of KES 50,000.");
  }
  if (!rateValid) {
    errors.push("Enter a bill rate between 0 and 100.");
  }

  if (showErrors) {
    setFieldError(faceValueError, faceValid ? "" : "Use KES 50,000 or a multiple of 50,000.");
    setFieldError(interestRateError, rateValid ? "" : "Enter a valid bill rate.");
    setFieldError(formError, errors.length ? errors.join(" ") : "");
  }

  if (!faceValid || !rateValid) {
    return null;
  }

  return { faceValue, interestRate, days: parseInt(daysSelect.value, 10) };
}

function earningText(amount, period, annual, compound) {
  return `${formatKES(amount)} (${formatPercent(period)} this tenor, ${formatPercent(annual)} simple annualized, ${formatPercent(compound)} compounded annual)`;
}

function updateTimeline(result) {
  if (!timeline || !dateHint) return;
  const { settlement } = auctionDates();
  const maturity = addDays(settlement, result.days);
  timeline.innerHTML = `
    <li><strong>Bid deadline Thursday ${formatDate(auctionDates().auction)}</strong><span>Submit on DhowCSD or Treasury Mobile Direct by 2:00pm.</span></li>
    <li><strong>Settlement ${formatDate(settlement)}</strong><span>Pay KES ${formatKES(result.totalExpenditure)} (CBK ${formatKES(result.totalOfferPayment)} + expenses ${formatKES(result.expensesTotal)}) by 2:00pm.</span></li>
    <li><strong>Maturity ${formatDate(maturity)}</strong><span>Receive face value KES ${formatKES(result.faceValue)}.</span></li>
  `;
  dateHint.textContent = `Indicative value date ${formatDate(settlement)}. Maturity about ${formatDate(maturity)}. Actual dates follow the issue on offer; settlement skips weekends and Kenyan public holidays.`;
}

function renderCashBreakdown(result) {
  if (!cashBreakdown) return;
  const total = result.totalExpenditure || 1;
  const segments = [
    { label: "Bill price", value: result.priceTotal, className: "is-price" },
    { label: "WHT", value: result.taxAmount, className: "is-tax" },
    { label: "Bank fees", value: result.expensesTotal, className: "is-fees" },
  ].filter((item) => item.value > 0);

  if (!segments.length) {
    cashBreakdown.innerHTML = "";
    return;
  }

  cashBreakdown.innerHTML = `
    <p class="strip-label">Where settlement cash goes</p>
    <div class="breakdown-bar" role="img" aria-label="Cash split of total expenditure">
      ${segments.map((item) => `<span class="breakdown-seg ${item.className}" style="width:${((item.value / total) * 100).toFixed(2)}%"></span>`).join("")}
    </div>
    <ul class="breakdown-legend">
      ${segments.map((item) => `<li><span class="swatch ${item.className}"></span>${escapeHtml(item.label)}: KES ${formatKES(item.value)} (${formatPercent((item.value / total) * 100)})</li>`).join("")}
    </ul>
  `;
}

function renderYieldInsight(result) {
  if (!yieldInsight) return;
  const taxDrag = result.ratePercent - result.afterAnnual;
  const quotedGap = result.ratePercent - result.afterCompound;
  yieldInsight.innerHTML = `
    <p><strong>Quoted CBK yield ${formatPercent(result.ratePercent, 4)}</strong> is the pre-tax discount rate. Your money actually earns <strong>${formatPercent(result.afterAnnual)} simple</strong> and <strong>${formatPercent(result.afterCompound)} compounded</strong> after tax and fees.</p>
    <p class="hint compact">The gap of ${formatPercent(Math.max(0, taxDrag))} simple (or ${formatPercent(Math.max(0, quotedGap))} compounded) is mostly 15% WHT paid up front, plus any bank charges.</p>
  `;
}

function renderComparison() {
  if (!compareBody || !yearValueBody) return;
  const parsed = validateInputs(false);
  if (!parsed) {
    compareBody.innerHTML = `<tr><td colspan="8">Enter a valid face value to compare tenors.</td></tr>`;
    yearValueBody.innerHTML = `<tr><td colspan="4">Enter a valid face value to see a one-year reinvestment view.</td></tr>`;
    return;
  }

  const expenses = readExpenses();
  const rates = {
    91: parseFloat(compare91.value) || LAST_AUCTION.rates[91],
    182: parseFloat(compare182.value) || LAST_AUCTION.rates[182],
    364: parseFloat(compare364.value) || LAST_AUCTION.rates[364],
  };

  compareBody.innerHTML = "";
  yearValueBody.innerHTML = "";
  [91, 182, 364].forEach((days) => {
    const result = calculate(parsed.faceValue, rates[days], days, taxEnabled, currentTaxRate, expenses);
    const row = document.createElement("tr");
    if (days === parsed.days) {
      row.className = "is-selected";
    }
    row.innerHTML = `
      <td>${days} days @ ${result.ratePercent.toFixed(4)}%</td>
      <td>${result.pricePer100.toFixed(4)}</td>
      <td>${formatKES(result.totalOfferPayment)}</td>
      <td>${formatKES(result.earningAfter)}</td>
      <td>${formatPercent(result.afterPeriod)}</td>
      <td>${formatPercent(result.afterAnnual)}</td>
      <td>${formatPercent(result.afterCompound)}</td>
      <td>${formatPercent(result.ratePercent - result.afterAnnual)}</td>
    `;
    compareBody.appendChild(row);

    const yearRow = document.createElement("tr");
    if (days === parsed.days) {
      yearRow.className = "is-selected";
    }
    const rolls = DAYS_IN_YEAR / days;
    yearRow.innerHTML = `
      <td>${days} days</td>
      <td>${rolls.toFixed(2)}×</td>
      <td>${formatKES(result.totalExpenditure)}</td>
      <td>${formatKES(result.yearValue)}</td>
    `;
    yearValueBody.appendChild(yearRow);
  });
}

function computeResults({ silent = false } = {}) {
  if (!form || !resultsStatus) return null;
  const parsed = validateInputs(!silent);
  if (!parsed) {
    if (!silent) {
      resultsStatus.textContent = "Fix the highlighted fields, then compute again.";
    }
    return null;
  }

  setFieldError(faceValueError, "");
  setFieldError(interestRateError, "");
  setFieldError(formError, "");

  const expenses = readExpenses();
  const result = calculate(parsed.faceValue, parsed.interestRate, parsed.days, taxEnabled, currentTaxRate, expenses);
  lastResult = result;

  const bidNote =
    parsed.faceValue >= COMPETITIVE_MIN
      ? "This size can be bid competitively or non-competitively."
      : "This size is a non-competitive bid: you take the auction average rate.";

  resultsStatus.textContent = `${bidNote} Quoted yield ${result.ratePercent.toFixed(4)}% for ${result.days} days.`;
  if (pricePer100Output) pricePer100Output.textContent = result.pricePer100.toFixed(4);
  if (totalPaymentOutput) totalPaymentOutput.textContent = formatKES(result.totalOfferPayment);
  if (maturityValueOutput) maturityValueOutput.textContent = formatKES(result.faceValue);
  if (netProfitOutput) netProfitOutput.textContent = formatKES(result.earningAfter);
  if (priceOutput) priceOutput.textContent = formatKES(result.priceTotal);
  if (taxAmountOutput) taxAmountOutput.textContent = formatKES(result.taxAmount);
  if (totalPaymentDetail) totalPaymentDetail.textContent = formatKES(result.totalOfferPayment);
  if (expensesTotalOutput) expensesTotalOutput.textContent = formatKES(result.expensesTotal);
  if (totalExpenditureOutput) totalExpenditureOutput.textContent = formatKES(result.totalExpenditure);
  if (netInterestOutput) netInterestOutput.textContent = formatKES(result.grossInterest);
  if (earningBeforeOutput) earningBeforeOutput.textContent = earningText(result.earningBefore, result.beforePeriod, result.beforeAnnual, result.beforeCompound);
  if (earningAfterOutput) earningAfterOutput.textContent = earningText(result.earningAfter, result.afterPeriod, result.afterAnnual, result.afterCompound);
  updateTimeline(result);
  renderCashBreakdown(result);
  renderYieldInsight(result);
  renderComparison();
  persistState();
  syncQuery(result);
  return result;
}

function persistState() {
  if (!faceValueInput || !interestRateInput || !daysSelect) return;
  const expenses = Array.from((expensesList || document.createElement("div")).querySelectorAll(".expense-row")).map((row) => ({
    amount: row.querySelector('input[type="number"]').value,
    description: row.querySelector('input[type="text"]').value,
    vat: row.querySelector('input[type="checkbox"]').checked,
  }));
  const state = {
    faceValue: faceValueInput.value,
    interestRate: interestRateInput.value,
    days: daysSelect.value,
    taxEnabled,
    currentTaxRate,
    expenses,
    compare: {
      91: compare91 ? compare91.value : "",
      182: compare182 ? compare182.value : "",
      364: compare364 ? compare364.value : "",
    },
    theme: document.documentElement.getAttribute("data-theme") || "light",
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Ignore storage failures so the calculator still works in restricted browser modes.
  }
}

function getStoredTheme() {
  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (savedTheme) {
      const parsed = JSON.parse(savedTheme);
      if (parsed?.theme === "dark" || parsed?.theme === "light") {
        return parsed.theme;
      }
    }
  } catch (error) {
    // Ignore JSON parse issues and fall back to the browser preference.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", normalizedTheme);

  if (themeToggle) {
    const isDark = normalizedTheme === "dark";
    themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    themeToggle.setAttribute("aria-pressed", String(isDark));
  }

  const color = normalizedTheme === "dark" ? "#111827" : "#1f4d7a";
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", color);
  }
}

function loadState() {
  if (!faceValueInput || !interestRateInput || !daysSelect) return;
  const params = new URLSearchParams(window.location.search);
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (error) {
    saved = null;
  }

  const theme = saved?.theme || getStoredTheme();
  applyTheme(theme);

  daysSelect.value = params.get("d") || saved?.days || "91";
  const tenor = parseInt(daysSelect.value, 10);
  faceValueInput.value = params.get("fv") || saved?.faceValue || "";
  interestRateInput.value = params.get("r") || saved?.interestRate || publishedRate(tenor).toFixed(4);
  if (params.get("tax") === "0" || (saved?.taxEnabled === false && params.get("tax") == null)) {
    taxEnabled = false;
    const noTaxRadio = document.querySelector('input[name="taxEnabled"][value="no"]');
    if (noTaxRadio) noTaxRadio.checked = true;
  }
  if (params.get("tax") && params.get("tax") !== "0") {
    currentTaxRate = parseFloat(params.get("tax")) || currentTaxRate;
  } else if (typeof saved?.currentTaxRate === "number") {
    currentTaxRate = saved.currentTaxRate;
  }
  if (taxRateDisplay) taxRateDisplay.textContent = `${currentTaxRate.toFixed(2)}%`;
  if (taxRateInput) taxRateInput.value = currentTaxRate.toFixed(2);
  if (taxRateRow) taxRateRow.style.display = taxEnabled ? "flex" : "none";

  if (compare91) compare91.value = saved?.compare?.[91] || LAST_AUCTION.rates[91];
  if (compare182) compare182.value = saved?.compare?.[182] || LAST_AUCTION.rates[182];
  if (compare364) compare364.value = saved?.compare?.[364] || LAST_AUCTION.rates[364];

  if (expensesList) {
    expensesList.innerHTML = "";
    const expenses = saved?.expenses?.length ? saved.expenses : [{ amount: "", description: "", vat: false }];
    expenses.forEach((item) => createExpenseRow(item.amount, item.description, item.vat));
  }
}

function shareUrl(result) {
  const params = new URLSearchParams({
    fv: String(result.faceValue),
    r: String(result.ratePercent),
    d: String(result.days),
    tax: taxEnabled ? String(currentTaxRate) : "0",
  });
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function syncQuery(result) {
  if (!result || !window.history) return;
  const url = shareUrl(result);
  window.history.replaceState({}, "", `${window.location.pathname}?${url.split("?")[1]}`);
}

function resetForm() {
  if (!form || !daysSelect || !interestRateInput || !taxRateInput || !taxRateDisplay || !taxRateRow || !taxRateEdit) return;
  form.reset();
  taxEnabled = true;
  currentTaxRate = 15;
  const yesRadio = document.querySelector('input[name="taxEnabled"][value="yes"]');
  if (yesRadio) yesRadio.checked = true;
  taxRateDisplay.textContent = "15.00%";
  taxRateInput.value = "15.00";
  taxRateRow.style.display = "flex";
  taxRateEdit.classList.add("hidden");
  if (expensesList) {
    expensesList.innerHTML = "";
    createExpenseRow();
  }
  daysSelect.value = "91";
  interestRateInput.value = publishedRate(91).toFixed(4);
  if (compare91) compare91.value = LAST_AUCTION.rates[91];
  if (compare182) compare182.value = LAST_AUCTION.rates[182];
  if (compare364) compare364.value = LAST_AUCTION.rates[364];
  lastResult = null;
  if (resultsStatus) resultsStatus.textContent = "Enter a face value and bill rate to see pricing.";
  ["price", "taxAmount", "totalPaymentDetail", "expensesTotal", "totalExpenditure", "netInterest"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "0.00";
  });
  if (totalPaymentOutput) totalPaymentOutput.textContent = "—";
  if (pricePer100Output) pricePer100Output.textContent = "—";
  if (maturityValueOutput) maturityValueOutput.textContent = "—";
  if (netProfitOutput) netProfitOutput.textContent = "—";
  if (earningBeforeOutput) earningBeforeOutput.textContent = "0.00";
  if (earningAfterOutput) earningAfterOutput.textContent = "0.00";
  if (cashBreakdown) cashBreakdown.innerHTML = "";
  if (yieldInsight) yieldInsight.innerHTML = "";
  setFieldError(formError, "");
  setFieldError(faceValueError, "");
  setFieldError(interestRateError, "");
  persistState();
  window.history.replaceState({}, "", window.location.pathname);
  renderComparison();
}

function resultsCopy(result) {
  const { auction, settlement } = auctionDates();
  return [
    `Kenya T-bill estimate`,
    `Face value: KES ${formatKES(result.faceValue)}`,
    `Tenor: ${result.days} days at ${result.ratePercent.toFixed(4)}%`,
    `Price per 100: ${result.pricePer100.toFixed(4)}`,
    `Bill price: KES ${formatKES(result.priceTotal)}`,
    `Tax: KES ${formatKES(result.taxAmount)}`,
    `Pay CBK: KES ${formatKES(result.totalOfferPayment)}`,
    `Expenses: KES ${formatKES(result.expensesTotal)}`,
    `Total cash out: KES ${formatKES(result.totalExpenditure)}`,
    `Receive at maturity: KES ${formatKES(result.faceValue)}`,
    `Net profit: KES ${formatKES(result.earningAfter)} (${formatPercent(result.afterPeriod)} this tenor, ${formatPercent(result.afterAnnual)} simple annualized, ${formatPercent(result.afterCompound)} compounded annual)`,
    `Quoted yield ${formatPercent(result.ratePercent, 4)} vs net simple ${formatPercent(result.afterAnnual)}`,
    `Next auction ${formatDate(auction)}; typical value date ${formatDate(settlement)}`,
    `Estimator only. Confirm figures in DhowCSD.`,
    shareUrl(result),
  ].join("\n");
}

function onFormChange() {
  persistState();
  computeResults({ silent: true });
}

function applyPublishedRate(days = parseInt(daysSelect.value, 10)) {
  if (!interestRateInput) return;
  interestRateInput.value = publishedRate(days).toFixed(4);
  onFormChange();
}

function setupChips() {
  if (!rateAsOf || !rateChips || !faceChips || !expensePresets) return;
  rateAsOf.textContent = `Weighted average accepted rates from the ${LAST_AUCTION.asOf} issue (${LAST_AUCTION.sourceLabel}). Your allocated rate is the result of the auction you bid in, not this preview.`;
  Object.entries(LAST_AUCTION.rates).forEach(([days, rate]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rate-chip";
    button.textContent = `${days}d ${rate.toFixed(4)}%`;
    button.addEventListener("click", () => {
      if (daysSelect) daysSelect.value = days;
      applyPublishedRate(parseInt(days, 10));
    });
    rateChips.appendChild(button);
  });

  FACE_PRESETS.forEach((amount) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "amount-chip";
    button.textContent = `KES ${amount.toLocaleString("en-KE")}`;
    button.addEventListener("click", () => {
      if (faceValueInput) faceValueInput.value = String(amount);
      onFormChange();
    });
    faceChips.appendChild(button);
  });

  EXPENSE_PRESETS.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "amount-chip";
    button.textContent = `${preset.description} · ${preset.amount}`;
    button.addEventListener("click", () => {
      if (!expensesList) return;
      const empty = Array.from(expensesList.querySelectorAll(".expense-row")).find((row) => {
        const amount = row.querySelector('input[type="number"]').value;
        const description = row.querySelector('input[type="text"]').value;
        return !amount && !description;
      });
      if (empty) {
        empty.querySelector('input[type="number"]').value = String(preset.amount);
        empty.querySelector('input[type="text"]').value = preset.description;
      } else {
        createExpenseRow(preset.amount, preset.description, preset.vat);
      }
      onFormChange();
    });
    expensePresets.appendChild(button);
  });
}

function setupAuctionBadge() {
  if (!auctionBadge) return;
  const { auction, settlement } = auctionDates();
  auctionBadge.textContent = `Next Thursday auction ${formatDate(auction)} · pay by 2:00pm on ${formatDate(settlement)}`;
}

function setupFormulaCheck() {
  if (!formulaCheck) return;
  const known = pricePerHundred(8.7674, 91);
  const ok = Math.abs(known - 97.8609) < 0.00005;
  const p91 = pricePerHundred(LAST_AUCTION.rates[91], 91);
  const p182 = pricePerHundred(LAST_AUCTION.rates[182], 182);
  const p364 = pricePerHundred(LAST_AUCTION.rates[364], 364);
  formulaCheck.textContent = ok
    ? `Formula check passed: CBK 14 Sep 2026 91-day WASR 8.7674% prices at ${known.toFixed(4)} per 100 (published 97.8609). Latest issue prices at ${p91.toFixed(4)}, ${p182.toFixed(4)}, ${p364.toFixed(4)}.`
    : `Formula check warning: expected 97.8609, got ${known.toFixed(4)}.`;
}

async function copyResults() {
  if (!copyButton || !formError) return;
  const result = lastResult || computeResults({ silent: false });
  if (!result) return;
  try {
    await navigator.clipboard.writeText(resultsCopy(result));
    copyButton.textContent = "Copied";
    setTimeout(() => {
      copyButton.textContent = "Copy results";
    }, 1600);
  } catch (error) {
    setFieldError(formError, "Could not copy. Select the results and copy manually.");
  }
}

async function shareResults() {
  if (!shareButton || !formError) return;
  const result = lastResult || computeResults({ silent: false });
  if (!result) return;
  const url = shareUrl(result);
  const text = resultsCopy(result);
  try {
    if (navigator.share) {
      await navigator.share({ title: "Kenya T-bill estimate", text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    shareButton.textContent = "Link copied";
    setTimeout(() => {
      shareButton.textContent = "Share";
    }, 1600);
  } catch (error) {
    if (error?.name !== "AbortError") {
      setFieldError(formError, "Could not share. Copy the address bar instead.");
    }
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

function bindCalculatorEvents() {
  if (!form) return;
  document.querySelectorAll(".info-button[data-info]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "popover");
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (activeInfoButton === button && !popover.classList.contains("hidden")) {
        hidePopover();
        return;
      }
      showPopover(infoCopy[button.dataset.info], button);
    });
  });

  document.addEventListener("click", (event) => {
    if (popover && !popover.contains(event.target)) {
      hidePopover();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hidePopover();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    computeResults({ silent: false });
  });

  if (addExpenseButton) {
    addExpenseButton.addEventListener("click", () => {
      createExpenseRow();
      persistState();
    });
  }
  if (resetButton) resetButton.addEventListener("click", resetForm);
  if (printButton) printButton.addEventListener("click", () => window.print());
  if (copyButton) copyButton.addEventListener("click", copyResults);
  if (shareButton) shareButton.addEventListener("click", shareResults);
  if (usePublishedRateButton) usePublishedRateButton.addEventListener("click", () => applyPublishedRate());

  if (editTaxButton) {
    editTaxButton.addEventListener("click", () => {
      if (taxRateEdit) taxRateEdit.classList.toggle("hidden");
    });
  }

  if (saveTaxButton) {
    saveTaxButton.addEventListener("click", () => {
      const rateValue = parseFloat(taxRateInput.value);
      if (Number.isNaN(rateValue) || rateValue < 0 || rateValue > 100) {
        setFieldError(formError, "Enter a tax percentage between 0 and 100.");
        return;
      }
      currentTaxRate = rateValue;
      if (taxRateDisplay) taxRateDisplay.textContent = `${currentTaxRate.toFixed(2)}%`;
      if (taxRateEdit) taxRateEdit.classList.add("hidden");
      onFormChange();
    });
  }

  document.querySelectorAll('input[name="taxEnabled"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      taxEnabled = radio.value === "yes";
      if (taxRateRow) taxRateRow.style.display = taxEnabled ? "flex" : "none";
      onFormChange();
    });
  });

  [faceValueInput, interestRateInput, compare91, compare182, compare364].forEach((input) => {
    if (input) input.addEventListener("input", onFormChange);
  });

  if (daysSelect) {
    daysSelect.addEventListener("change", () => {
      const days = parseInt(daysSelect.value, 10);
      const current = parseFloat(interestRateInput.value);
      if (!interestRateInput.value || Number.isNaN(current) || isPublishedRate(current)) {
        interestRateInput.value = publishedRate(days).toFixed(4);
      }
      onFormChange();
    });
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, theme: next }));
      } catch (error) {
        // Ignore storage issues so the interface remains usable.
      }
      persistState();
    });
  }
}

function initializeCalculator() {
  if (!form) return;
  const initialTheme = getStoredTheme();
  applyTheme(initialTheme);
  setupAuctionBadge();
  setupChips();
  setupFormulaCheck();
  bindCalculatorEvents();
  loadState();
  computeResults({ silent: true });
  renderComparison();
  registerServiceWorker();
}

initializeCalculator();
