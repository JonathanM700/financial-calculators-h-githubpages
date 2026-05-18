const form = document.getElementById('tbillForm');
const faceValueInput = document.getElementById('faceValue');
const interestRateInput = document.getElementById('interestRate');
const daysSelect = document.getElementById('days');
const expensesList = document.getElementById('expensesList');
const addExpenseButton = document.getElementById('addExpenseButton');
const computeButton = document.getElementById('computeButton');
const resetButton = document.getElementById('resetButton');
const priceOutput = document.getElementById('price');
const taxAmountOutput = document.getElementById('taxAmount');
const totalPaymentOutput = document.getElementById('totalPayment');
const netInterestOutput = document.getElementById('netInterest');
const totalExpenditureOutput = document.getElementById('totalExpenditure');
const earningBeforeOutput = document.getElementById('earningBefore');
const earningAfterOutput = document.getElementById('earningAfter');
const taxRateDisplay = document.getElementById('taxRateDisplay');
const taxRateRow = document.getElementById('taxRateRow');
const taxRateEdit = document.getElementById('taxRateEdit');
const editTaxButton = document.getElementById('editTaxButton');
const saveTaxButton = document.getElementById('saveTaxButton');
const taxRateInput = document.getElementById('taxRate');
const popover = document.getElementById('popover');
const infoButtons = document.querySelectorAll('.info-button[data-info]');

let taxEnabled = true;
let currentTaxRate = 15.0;
let expenseIndex = 0;

const infoCopy = {
  faceValue: 'Enter the bill face value in Kenyan shillings. Only whole numbers of 50,000 KES or more are accepted.',
  taxOption: 'Choose Yes to include tax in final payment. If No, no tax will be added to the calculation.',
  interestRate: 'Enter the published CBK bill rate as a percentage, up to four decimal places, for example 12.7500.',
  days: 'Select the treasury bill tenor: 91, 182, or 364 days. This determines the discount period for the bill.',
  price: 'The amount you pay today to acquire the bill at the selected rate and tenor.',
  taxAmount: 'The tax payable on the interest earned from the bill, calculated at the selected tax rate.',
  totalPayment: 'The amount payable directly to CBK, including bill price and tax but excluding extra transaction charges.',
  totalExpenditure: 'The full cash outflow including bill price, interest tax, and all additional charges or expenses.',
  netInterest: 'The gross interest earned from the bill before tax and expenses are deducted.',
  earningBefore: 'Interest earned minus tax, before expenses. Displayed as absolute amount, percentage for the tenor period, and annualized equivalent.',
  earningAfter: 'Final net profit after tax and all expenses. Displayed as absolute amount, percentage for the tenor period, and annualized equivalent.',
};

const expenseExample = 'Example: RTGS fees, broker fees, or processing charges. For example 500 KES plus 15% VAT results in 575 KES total.';

function showPopover(text, anchor) {
  popover.innerHTML = `<p>${text}</p>`;
  popover.classList.remove('hidden');
  const rect = anchor.getBoundingClientRect();
  const top = window.scrollY + rect.bottom + 10;
  const left = window.scrollX + rect.left;

  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
  popover.style.maxWidth = '360px';

  const popoverRect = popover.getBoundingClientRect();
  if (popoverRect.right > window.innerWidth - 16) {
    popover.style.left = `${Math.max(16, window.innerWidth - popoverRect.width - 16)}px`;
  }

  if (popoverRect.bottom > window.innerHeight - 16) {
    popover.style.top = `${Math.max(16, window.scrollY + rect.top - popoverRect.height - 10)}px`;
  }
}

function hidePopover() {
  popover.classList.add('hidden');
}

infoButtons.forEach(button => {
  button.addEventListener('click', event => {
    event.stopPropagation();
    const infoKey = button.dataset.info;
    showPopover(infoCopy[infoKey], button);
  });
});

document.addEventListener('click', event => {
  if (!popover.contains(event.target)) {
    hidePopover();
  }
});

function createExpenseRow(amount = '', description = '') {
  const row = document.createElement('div');
  row.className = 'expense-row';
  row.dataset.index = expenseIndex;

  const amountLabel = document.createElement('label');
  amountLabel.textContent = 'Expense Amount (KES)';
  const amountInput = document.createElement('input');
  amountInput.type = 'number';
  amountInput.min = '0';
  amountInput.step = '1';
  amountInput.placeholder = '500';
  amountInput.value = amount;
  amountLabel.appendChild(amountInput);

  const descLabel = document.createElement('label');
  descLabel.textContent = 'Expense Description';
  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.placeholder = 'e.g. RTGS charge, broker fee';
  descInput.value = description;
  descLabel.appendChild(descInput);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'remove-expense';
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('click', () => {
    row.remove();
  });

  const example = document.createElement('p');
  example.className = 'hint';
  example.textContent = expenseExample;

  row.appendChild(amountLabel);
  row.appendChild(descLabel);
  row.appendChild(removeButton);
  row.appendChild(example);
  expensesList.appendChild(row);
  expenseIndex += 1;
}

function readExpenses() {
  const rows = expensesList.querySelectorAll('.expense-row');
  return Array.from(rows).reduce((acc, row) => {
    const amount = parseFloat(row.querySelector('input[type="number"]').value) || 0;
    const description = row.querySelector('input[type="text"]').value.trim();
    if (amount > 0 || description) {
      acc.push({ amount, description });
    }
    return acc;
  }, []);
}

function validateInputs() {
  const faceValue = parseInt(faceValueInput.value, 10);
  const interestRate = parseFloat(interestRateInput.value);
  const isFaceValueValid = Number.isInteger(faceValue) && faceValue >= 50000;
  const isInterestValid = !Number.isNaN(interestRate) && interestRate >= 0;

  if (!isFaceValueValid) {
    alert('Face Value must be a whole number of at least KES 50,000.');
    return false;
  }

  if (!isInterestValid) {
    alert('Please enter a valid bill rate with up to four decimal places.');
    return false;
  }

  return true;
}

function formatKES(value) {
  return Number(value).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeResults() {
  if (!validateInputs()) {
    return;
  }

  const faceValue = parseInt(faceValueInput.value, 10);
  const rate = parseFloat(interestRateInput.value) / 100;
  const days = parseInt(daysSelect.value, 10);
  const taxRate = currentTaxRate / 100;
  const expenses = readExpenses();

  const pricePer100 = 100 / (1 + rate * (days / 365));
  const billQuantity = faceValue / 100;
  const priceTotal = pricePer100 * billQuantity;
  const netInterest = faceValue - priceTotal;
  const taxAmount = taxEnabled ? netInterest * taxRate : 0;
  const expensesTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const earningBefore = netInterest - taxAmount;
  const earningAfter = earningBefore - expensesTotal;
  const totalOfferPayment = priceTotal + taxAmount;
  const totalExpenditure = totalOfferPayment + expensesTotal;

  const earningBeforePercent = (earningBefore / faceValue) * 100;
  const earningAfterPercent = (earningAfter / faceValue) * 100;
  const earningBeforeAnnualized = earningBeforePercent * (365 / days);
  const earningAfterAnnualized = earningAfterPercent * (365 / days);
  const earningBeforeAnnualizedAmount = earningBefore * (365 / days);
  const earningAfterAnnualizedAmount = earningAfter * (365 / days);

  priceOutput.textContent = formatKES(priceTotal);
  taxAmountOutput.textContent = formatKES(taxAmount);
  totalPaymentOutput.textContent = formatKES(totalOfferPayment);
  totalExpenditureOutput.textContent = formatKES(totalExpenditure);
  netInterestOutput.textContent = formatKES(netInterest);
  earningBeforeOutput.textContent = `${formatKES(earningBefore)} (${earningBeforePercent.toFixed(2)}%, ${earningBeforeAnnualized.toFixed(2)}% annualized, ${formatKES(earningBeforeAnnualizedAmount)} KES annualized)`;
  earningAfterOutput.textContent = `${formatKES(earningAfter)} (${earningAfterPercent.toFixed(2)}%, ${earningAfterAnnualized.toFixed(2)}% annualized, ${formatKES(earningAfterAnnualizedAmount)} KES annualized)`;
}

function resetForm() {
  form.reset();
  taxEnabled = true;
  currentTaxRate = 15.0;
  taxRateDisplay.textContent = `${currentTaxRate.toFixed(2)}%`;
  taxRateInput.value = currentTaxRate.toFixed(2);
  taxRateRow.classList.remove('hidden');
  taxRateEdit.classList.add('hidden');
  expensesList.innerHTML = '';
  priceOutput.textContent = '0.00';
  taxAmountOutput.textContent = '0.00';
  totalPaymentOutput.textContent = '0.00';
  totalExpenditureOutput.textContent = '0.00';
  netInterestOutput.textContent = '0.00';
  earningBeforeOutput.textContent = '0.00 (0.00%, 0.00% annualized, 0.00 KES annualized)';
  earningAfterOutput.textContent = '0.00 (0.00%, 0.00% annualized, 0.00 KES annualized)';
}

addExpenseButton.addEventListener('click', () => createExpenseRow());
computeButton.addEventListener('click', computeResults);
resetButton.addEventListener('click', resetForm);

editTaxButton.addEventListener('click', () => {
  taxRateEdit.classList.toggle('hidden');
});

saveTaxButton.addEventListener('click', () => {
  const rateValue = parseFloat(taxRateInput.value);
  if (isNaN(rateValue) || rateValue < 0 || rateValue > 100) {
    alert('Enter a valid tax percentage between 0 and 100.');
    return;
  }
  currentTaxRate = rateValue;
  taxRateDisplay.textContent = `${currentTaxRate.toFixed(2)}%`;
  taxRateEdit.classList.add('hidden');
});

const taxRadios = document.querySelectorAll('input[name="taxEnabled"]');

taxRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    taxEnabled = radio.value === 'yes';
    taxRateRow.style.display = taxEnabled ? 'flex' : 'none';
  });
});

resetForm();
createExpenseRow();
