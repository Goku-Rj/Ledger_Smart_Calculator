(function () {

      // --- FULL-STACK BACKEND API SYNC (WITH AUTOMATIC LOCALSTORAGE FALLBACK) ---
      const API_BASE = '/api';
      let backendOnline = false;

      async function syncFromBackend() {
        try {
          const [settingsRes, txRes] = await Promise.all([
            fetch(`${API_BASE}/settings`, { headers: { 'Accept': 'application/json' } }),
            fetch(`${API_BASE}/transactions`, { headers: { 'Accept': 'application/json' } })
          ]);
          if (settingsRes.ok && txRes.ok) {
            backendOnline = true;
            const settingsData = await settingsRes.json();
            const txData = await txRes.json();
            if (settingsData && settingsData.shopName) {
              state.shopName = settingsData.shopName;
            }
            if (settingsData && settingsData.theme) {
              state.theme = settingsData.theme;
            }
            if (Array.isArray(txData.transactions)) {
              state.transactions = txData.transactions;
            }
            syncShopNameUI();
            applyTheme(state.theme);
            renderRecentCustomerPills();
            renderRightPanel();
          }
        } catch (err) {
          // Running as static file or offline; localStorage remains active
          backendOnline = false;
        }
      }

      async function pushSettingsToBackend() {
        if (!backendOnline) return;
        try {
          await fetch(`${API_BASE}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shopName: state.shopName, theme: state.theme })
          });
        } catch (err) {
          // Ignore network error
        }
      }

      async function pushNewTransactionToBackend(tx) {
        if (!backendOnline) return;
        try {
          await fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx)
          });
        } catch (err) {
          // Ignore network error
        }
      }

      async function deleteTransactionFromBackend(txId) {
        if (!backendOnline) return;
        try {
          await fetch(`${API_BASE}/transactions/${encodeURIComponent(txId)}`, {
            method: 'DELETE'
          });
        } catch (err) {
          // Ignore network error
        }
      }

      async function clearOrRestoreBackendTransactions(restoreSample) {
        if (!backendOnline) return;
        try {
          await fetch(`${API_BASE}/transactions?restoreSample=${restoreSample ? 'true' : 'false'}`, {
            method: 'DELETE'
          });
        } catch (err) {
          // Ignore network error
        }
      }

// --- STORAGE KEYS ---
      const STORAGE_TX_KEY = 'smart_pos_ledger_transactions_v1';
      const STORAGE_THEME_KEY = 'smart_pos_ledger_theme_v1';
      const STORAGE_SHOP_KEY = 'smart_pos_ledger_shop_name_v1';

      // --- DEFAULT SAMPLE TRANSACTIONS ---
      const SAMPLE_TRANSACTIONS = [
        {
          id: 'tx-101',
          customerName: 'Aarav Sharma',
          phone: '9845012345',
          type: 'CREDIT',
          paymentMode: 'UPI',
          amount: 845,
          expression: '450 + 275 + 120',
          itemCount: 3,
          note: 'Groceries & Basmati Rice',
          timestamp: '2026-10-29 11:45 AM'
        },
        {
          id: 'tx-102',
          customerName: 'Priya Nair',
          phone: '9901234567',
          type: 'DEBIT',
          paymentMode: 'Cash',
          amount: 320,
          expression: '180 + 140',
          itemCount: 2,
          note: 'Monthly Dairy Udhaar',
          timestamp: '2026-10-29 10:30 AM'
        },
        {
          id: 'tx-103',
          customerName: 'Rohan Gowda',
          phone: '9731122334',
          type: 'CREDIT',
          paymentMode: 'Card',
          amount: 1450,
          expression: '1200 + 250',
          itemCount: 2,
          note: 'Cooking Oil & Dry Fruits',
          timestamp: '2026-10-29 09:50 AM'
        },
        {
          id: 'tx-104',
          customerName: 'Aarav Sharma',
          phone: '9845012345',
          type: 'DEBIT',
          paymentMode: 'UPI',
          amount: 150,
          expression: '150',
          itemCount: 1,
          note: 'Balance Carry Forward',
          timestamp: '2026-10-28 07:15 PM'
        },
        {
          id: 'tx-105',
          customerName: 'Ananya Rao',
          phone: '9448055667',
          type: 'CREDIT',
          paymentMode: 'Cash',
          amount: 560,
          expression: '220 + 190 + 150',
          itemCount: 3,
          note: 'Snacks & Beverages',
          timestamp: '2026-10-28 05:40 PM'
        }
      ];

      // --- APPLICATION STATE ---
      const STORAGE_SHOP_ADDR_KEY = 'smart_pos_ledger_shop_addr_v1';

      let state = {
        shopName: 'Chamundeshwari Provision Store',
        shopAddress: 'Mysuru • Ph: 9845011223',
        activePage: 'CALC', // 'CALC' or 'HISTORY'
        theme: 'light',
        soundEnabled: true,
        expression: '',
        displayValue: '0',
        lastEvaluatedExpr: '',
        paymentMode: 'UPI',
        viewMode: 'FEED', // 'FEED' or 'CUSTOMERS'
        filterDate: 'ALL', // 'ALL', 'TODAY', 'PENDING_KHATA'
        filterType: 'ALL',
        filterPay: 'ALL',
        searchQuery: '',
        currentReceiptTxId: null,
        transactions: []
      };

      // --- SAFE LOCALSTORAGE HELPERS ---
      function loadStateFromStorage() {
        try {
          const savedShop = localStorage.getItem(STORAGE_SHOP_KEY);
          if (savedShop && savedShop.trim()) {
            state.shopName = savedShop.trim();
          }
          const savedAddr = localStorage.getItem(STORAGE_SHOP_ADDR_KEY);
          if (savedAddr !== null) {
            state.shopAddress = savedAddr;
          }
          const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
          if (savedTheme && ['light', 'dark', 'retro', 'cyber'].includes(savedTheme)) {
            state.theme = savedTheme;
          }
          const savedTx = localStorage.getItem(STORAGE_TX_KEY);
          if (savedTx) {
            const parsed = JSON.parse(savedTx);
            if (Array.isArray(parsed)) {
              state.transactions = parsed;
              return;
            }
          }
        } catch (err) {
          // Ignore storage errors in sandboxed iframes
        }
        state.transactions = SAMPLE_TRANSACTIONS.slice();
      }

      function saveTransactionsToStorage() {
        try {
          localStorage.setItem(STORAGE_TX_KEY, JSON.stringify(state.transactions));
        } catch (err) {
          // Ignore storage errors
        }
      }

      function saveThemeToStorage() {
        try {
          localStorage.setItem(STORAGE_THEME_KEY, state.theme);
          pushSettingsToBackend();
        } catch (err) {
          // Ignore storage errors
        }
      }

      function saveShopNameToStorage() {
        try {
          localStorage.setItem(STORAGE_SHOP_KEY, state.shopName);
          pushSettingsToBackend();
          localStorage.setItem(STORAGE_SHOP_ADDR_KEY, state.shopAddress || '');
        } catch (err) {
          // Ignore storage errors
        }
      }

      // --- WEB AUDIO SYNTHESIZED TACTILE SOUND ---
      let audioCtx = null;
      function playTone(freq = 520, duration = 0.035, type = 'triangle') {
        if (!state.soundEnabled) return;
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) return;
          if (!audioCtx) audioCtx = new AudioContextClass();
          if (audioCtx.state === 'suspended') audioCtx.resume();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + duration);
        } catch (e) {
          // Audio blocked or unsupported
        }
      }

      // --- CURRENCY & NUMBER FORMATTING ---
      function formatINR(num) {
        const n = Number(num) || 0;
        return n.toLocaleString('en-IN', {
          minimumFractionDigits: n % 1 !== 0 ? 2 : 0,
          maximumFractionDigits: 2
        });
      }

      function formatINRWithDecimals(num) {
        const n = Number(num) || 0;
        return n.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }

      // --- SAFE ARITHMETIC EVALUATOR ---
      function evaluateMathExpression(rawExpr) {
        if (!rawExpr || !rawExpr.trim()) return 0;
        // Replace % with /100 and sanitize
        let cleaned = rawExpr
          .replace(/×/g, '*')
          .replace(/÷/g, '/')
          .replace(/−/g, '-')
          .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
        // Strip trailing operators
        cleaned = cleaned.replace(/[+\-*/.]+$/, '');
        if (!cleaned) return 0;
        if (!/^[0-9+\-*/().\s]+$/.test(cleaned)) return NaN;
        try {
          const result = Function('"use strict"; return (' + cleaned + ')')();
          if (typeof result !== 'number' || !isFinite(result)) return NaN;
          return Math.round(result * 100) / 100;
        } catch (e) {
          return NaN;
        }
      }

      function countItemsInExpression(expr) {
        const cleaned = (expr || '').trim().replace(/[+\-*/.]+$/, '');
        if (!cleaned) return 0;
        const parts = cleaned.split(/[+]/).filter(Boolean);
        return parts.length;
      }

      // --- DOM REFERENCES ---
      const shopNameInput = document.getElementById('shopNameInput');
      const shopAddressInput = document.getElementById('shopAddressInput');
      const headerShopNameDisplay = document.getElementById('headerShopNameDisplay');
      const leftCustomerKhataText = document.getElementById('leftCustomerKhataText');
      const viewSelectedCustomerHistoryBtn = document.getElementById('viewSelectedCustomerHistoryBtn');
      const modeSplitPercentText = document.getElementById('modeSplitPercentText');
      const barUpiWidth = document.getElementById('barUpiWidth');
      const barCashWidth = document.getElementById('barCashWidth');
      const barCardWidth = document.getElementById('barCardWidth');
      const khataDirectorySummaryHint = document.getElementById('khataDirectorySummaryHint');
      const whatsappReceiptBtn = document.getElementById('whatsappReceiptBtn');
      const pageCalculatorView = document.getElementById('pageCalculatorView');
      const pageHistoryView = document.getElementById('pageHistoryView');
      const navCalcPageBtn = document.getElementById('navCalcPageBtn');
      const navHistoryPageBtn = document.getElementById('navHistoryPageBtn');
      const navCustomerDirBtn = document.getElementById('navCustomerDirBtn');
      const navHistoryCountPill = document.getElementById('navHistoryCountPill');
      const backToCalcBtn = document.getElementById('backToCalcBtn');
      const jumpToHistoryBtn = document.getElementById('jumpToHistoryBtn');
      const openLatestReceiptBtn = document.getElementById('openLatestReceiptBtn');
      const latestSavedBannerText = document.getElementById('latestSavedBannerText');
      const summaryTotalCollectionVal = document.getElementById('summaryTotalCollectionVal');
      const collectionBreakdownText = document.getElementById('collectionBreakdownText');

      const customerCard = document.getElementById('customerCard');
      const customerNameInput = document.getElementById('customerNameInput');
      const customerPhoneInput = document.getElementById('customerPhoneInput');
      const purchaseNoteInput = document.getElementById('purchaseNoteInput');
      const clearCustomerBtn = document.getElementById('clearCustomerBtn');
      const recentCustomerPills = document.getElementById('recentCustomerPills');

      const calcDisplayBox = document.getElementById('calcDisplayBox');
      const calcItemBadge = document.getElementById('calcItemBadge');
      const calcExpressionText = document.getElementById('calcExpressionText');
      const calcMainDisplay = document.getElementById('calcMainDisplay');
      const activePaymentReadout = document.getElementById('activePaymentReadout');
      const customerStatusPreview = document.getElementById('customerStatusPreview');
      const calcLivePreview = document.getElementById('calcLivePreview');
      const selectedPaymentHint = document.getElementById('selectedPaymentHint');

      const recordCreditBtn = document.getElementById('recordCreditBtn');
      const recordDebitBtn = document.getElementById('recordDebitBtn');

      const summaryCreditVal = document.getElementById('summaryCreditVal');
      const summaryCreditCount = document.getElementById('summaryCreditCount');
      const summaryDebitVal = document.getElementById('summaryDebitVal');
      const summaryDebitCount = document.getElementById('summaryDebitCount');
      const summaryNetVal = document.getElementById('summaryNetVal');
      const summaryNetStatus = document.getElementById('summaryNetStatus');

      const historyCountBadge = document.getElementById('historyCountBadge');
      const viewFeedBtn = document.getElementById('viewFeedBtn');
      const viewCustomersBtn = document.getElementById('viewCustomersBtn');
      const exportCsvBtn = document.getElementById('exportCsvBtn');
      const openClearModalBtn = document.getElementById('openClearModalBtn');

      const historySearchInput = document.getElementById('historySearchInput');
      const resetSearchBtn = document.getElementById('resetSearchBtn');
      const historyListContainer = document.getElementById('historyListContainer');

      const soundToggleBtn = document.getElementById('soundToggleBtn');
      const soundIconOn = document.getElementById('soundIconOn');
      const soundIconOff = document.getElementById('soundIconOff');
      const soundLabel = document.getElementById('soundLabel');

      const receiptModal = document.getElementById('receiptModal');
      const receiptTextContent = document.getElementById('receiptTextContent');
      const closeReceiptModalBtn = document.getElementById('closeReceiptModalBtn');
      const closeReceiptBottomBtn = document.getElementById('closeReceiptBottomBtn');
      const copyReceiptBtn = document.getElementById('copyReceiptBtn');

      const clearConfirmModal = document.getElementById('clearConfirmModal');
      const cancelClearModalBtn = document.getElementById('cancelClearModalBtn');
      const restoreDemoDataBtn = document.getElementById('restoreDemoDataBtn');
      const confirmClearAllBtn = document.getElementById('confirmClearAllBtn');

      // --- TOAST HELPER ---
      function showToast(message, variant = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        const bgClass =
          variant === 'credit'
            ? 'bg-emerald-600 text-white'
            : variant === 'debit'
            ? 'bg-rose-600 text-white'
            : variant === 'error'
            ? 'bg-amber-600 text-white'
            : 'bg-slate-900 text-white border border-slate-700';

        toast.className = `${bgClass} px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 transition-all duration-200 pointer-events-auto`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(6px)';
          setTimeout(() => toast.remove(), 220);
        }, 2600);
      }

      // --- SHOP NAME & PAGE NAVIGATION MANAGEMENT ---
      function syncShopNameUI() {
        const displayTitle = state.shopName.trim() || 'Smart Ledger Calc';
        headerShopNameDisplay.textContent = displayTitle;
        if (document.activeElement !== shopNameInput) {
          shopNameInput.value = state.shopName;
        }
        if (shopAddressInput && document.activeElement !== shopAddressInput) {
          shopAddressInput.value = state.shopAddress || '';
        }
      }

      function updateLeftCustomerKhataPreview() {
        const cName = customerNameInput.value.trim().toLowerCase();
        const cPhone = customerPhoneInput.value.trim();
        if (!cName && !cPhone) {
          leftCustomerKhataText.textContent = 'Select or type customer to view balance';
          leftCustomerKhataText.className = 'text-xs font-bold mt-0.5';
          return;
        }
        const matches = state.transactions.filter((tx) => {
          if (cPhone && cPhone.length >= 4 && tx.phone === cPhone) return true;
          if (cName && tx.customerName.toLowerCase() === cName) return true;
          return false;
        });
        if (matches.length === 0) {
          leftCustomerKhataText.textContent = 'New Customer (No prior Khata history)';
          leftCustomerKhataText.className = 'text-xs font-bold mt-0.5 text-sky-500';
          return;
        }
        let cred = 0;
        let deb = 0;
        matches.forEach((m) => {
          if (m.type === 'CREDIT') cred += Number(m.amount) || 0;
          else deb += Number(m.amount) || 0;
        });
        const net = cred - deb;
        if (net < 0) {
          leftCustomerKhataText.textContent = `Udhaar Due: −₹${formatINR(Math.abs(net))} (${matches.length} bills)`;
          leftCustomerKhataText.className = 'text-xs font-bold mt-0.5 text-rose-500';
        } else if (net > 0) {
          leftCustomerKhataText.textContent = `Net Paid/Advance: +₹${formatINR(net)} (${matches.length} bills)`;
          leftCustomerKhataText.className = 'text-xs font-bold mt-0.5 text-emerald-500';
        } else {
          leftCustomerKhataText.textContent = `Account Settled: ₹0 (${matches.length} bills)`;
          leftCustomerKhataText.className = 'text-xs font-bold mt-0.5 text-emerald-500';
        }
      }

      function switchPage(page, subViewMode) {
        state.activePage = page;
        if (subViewMode) {
          state.viewMode = subViewMode;
        }
        const isCalc = page === 'CALC';
        pageCalculatorView.classList.toggle('hidden', !isCalc);
        pageHistoryView.classList.toggle('hidden', isCalc);
        pageHistoryView.classList.toggle('flex', !isCalc);

        const activeNavClass = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white transition flex items-center gap-1.5 shadow-xs';
        const inactiveNavClass = 'px-3 py-1.5 rounded-lg text-xs font-bold theme-muted hover:opacity-80 transition flex items-center gap-1.5';

        navCalcPageBtn.className = isCalc ? activeNavClass : inactiveNavClass;
        navHistoryPageBtn.className = (!isCalc && state.viewMode === 'FEED') ? activeNavClass : inactiveNavClass;
        navCustomerDirBtn.className = (!isCalc && state.viewMode === 'CUSTOMERS') ? activeNavClass : inactiveNavClass;

        viewFeedBtn.className = state.viewMode === 'FEED'
          ? 'px-2.5 py-1 rounded-lg bg-indigo-600 text-white transition'
          : 'px-2.5 py-1 rounded-lg theme-muted hover:opacity-80 transition';
        viewCustomersBtn.className = state.viewMode === 'CUSTOMERS'
          ? 'px-2.5 py-1 rounded-lg bg-indigo-600 text-white transition'
          : 'px-2.5 py-1 rounded-lg theme-muted hover:opacity-80 transition';

        renderRightPanel();
      }

      // --- THEME MANAGEMENT ---
      function applyTheme(themeName) {
        state.theme = themeName;
        if (themeName === 'light') {
          document.documentElement.removeAttribute('data-theme');
        } else {
          document.documentElement.setAttribute('data-theme', themeName);
        }
        document.querySelectorAll('.theme-switch-btn').forEach((btn) => {
          const isCurrent = btn.getAttribute('data-theme-btn') === themeName;
          if (isCurrent) {
            btn.classList.add('bg-indigo-600', 'text-white', 'shadow-xs');
          } else {
            btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-xs');
          }
        });
        saveThemeToStorage();
      }

      // --- PAYMENT MODE SELECTION ---
      function updatePaymentModeUI() {
        document.querySelectorAll('.pay-mode-btn').forEach((btn) => {
          const mode = btn.getAttribute('data-pay-mode');
          const active = mode === state.paymentMode;
          if (active) {
            btn.className =
              'pay-mode-btn py-2 px-3 rounded-xl border-2 border-indigo-500 bg-indigo-500/15 text-indigo-500 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs';
          } else {
            btn.className =
              'pay-mode-btn py-2 px-3 rounded-xl border theme-subtle text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-80 transition-all';
          }
        });
        activePaymentReadout.textContent = `PAID VIA ${state.paymentMode.toUpperCase()}`;
        selectedPaymentHint.textContent = `${state.paymentMode} Selected`;
      }

      // --- CALCULATOR DISPLAY & KEYPAD LOGIC ---
      function updateCalculatorScreen() {
        const prettyExpr = state.expression
          ? state.expression
              .replace(/\*/g, ' × ')
              .replace(/\//g, ' ÷ ')
              .replace(/\+/g, ' + ')
              .replace(/-/g, ' − ')
          : state.lastEvaluatedExpr || '0';

        calcExpressionText.textContent = prettyExpr;

        const evaluated = evaluateMathExpression(state.expression);
        const currentNumeric = !isNaN(evaluated) && state.expression ? evaluated : Number(state.displayValue) || 0;

        calcMainDisplay.textContent = state.expression
          ? formatINR(currentNumeric)
          : formatINR(state.displayValue);

        calcLivePreview.textContent = `Live Total: ₹${formatINRWithDecimals(currentNumeric)}`;

        const items = countItemsInExpression(state.expression || state.lastEvaluatedExpr);
        calcItemBadge.textContent = `${items} ${items === 1 ? 'item' : 'items'}`;

        const cName = customerNameInput.value.trim();
        const cPhone = customerPhoneInput.value.trim();
        if (cName || cPhone) {
          customerStatusPreview.textContent = `${cName || 'Customer'} ${cPhone ? '(' + cPhone + ')' : ''}`;
        } else {
          customerStatusPreview.textContent = 'Walk-in / Enter customer above';
        }
        updateLeftCustomerKhataPreview();
      }

      function handleCalculatorInput(key) {
        playTone(key === '=' ? 680 : 520, 0.03);

        if (key === 'C') {
          state.expression = '';
          state.displayValue = '0';
          state.lastEvaluatedExpr = '';
          updateCalculatorScreen();
          return;
        }

        if (key === 'BACKSPACE') {
          if (state.expression.length > 0) {
            state.expression = state.expression.slice(0, -1);
            if (!state.expression) {
              state.displayValue = '0';
            }
          } else {
            state.displayValue = '0';
          }
          updateCalculatorScreen();
          return;
        }

        if (key === '=') {
          if (!state.expression) return;
          const total = evaluateMathExpression(state.expression);
          if (isNaN(total)) {
            showToast('Invalid math expression', 'error');
            return;
          }
          state.lastEvaluatedExpr =
            state.expression
              .replace(/\*/g, ' × ')
              .replace(/\//g, ' ÷ ')
              .replace(/\+/g, ' + ')
              .replace(/-/g, ' − ') + ' =';
          state.displayValue = String(total);
          state.expression = String(total);
          updateCalculatorScreen();
          return;
        }

        const operators = ['+', '-', '*', '/'];
        const lastChar = state.expression.slice(-1);

        if (operators.includes(key)) {
          if (!state.expression && state.displayValue !== '0') {
            state.expression = state.displayValue + key;
          } else if (!state.expression) {
            if (key === '-') state.expression = '-';
          } else if (operators.includes(lastChar)) {
            state.expression = state.expression.slice(0, -1) + key;
          } else {
            state.expression += key;
          }
          updateCalculatorScreen();
          return;
        }

        if (key === '%') {
          if (state.expression && /\d$/.test(lastChar)) {
            state.expression += '%';
            updateCalculatorScreen();
          }
          return;
        }

        if (key === '.') {
          // Prevent multiple decimals in the current number token
          const tokens = state.expression.split(/[+\-*/]/);
          const currentToken = tokens[tokens.length - 1] || '';
          if (currentToken.includes('.')) return;
          state.expression = (state.expression || '0') + '.';
          updateCalculatorScreen();
          return;
        }

        // Numeric keys '0' - '9' or '00'
        if (state.expression === '0') {
          state.expression = key === '00' ? '0' : key;
        } else {
          state.expression += key;
        }
        state.lastEvaluatedExpr = '';
        updateCalculatorScreen();
      }

      // --- RECORD CREDIT OR DEBIT TRANSACTION ---
      function recordTransaction(txType) {
        const rawExpr = state.expression || state.displayValue;
        const amount = evaluateMathExpression(rawExpr);

        if (isNaN(amount) || amount <= 0) {
          calcDisplayBox.classList.remove('shake-anim');
          void calcDisplayBox.offsetWidth;
          calcDisplayBox.classList.add('shake-anim');
          playTone(220, 0.12, 'sawtooth');
          showToast('Enter an amount greater than ₹0 on the calculator first', 'error');
          return;
        }

        let customerName = customerNameInput.value.trim();
        let phone = customerPhoneInput.value.trim().replace(/\D/g, '');

        if (!customerName && !phone) {
          customerCard.classList.remove('shake-anim');
          void customerCard.offsetWidth;
          customerCard.classList.add('shake-anim');
          playTone(240, 0.12, 'sawtooth');
          showToast('Please enter Customer Name or Phone Number', 'error');
          customerNameInput.focus();
          return;
        }

        if (!customerName) customerName = 'Customer ' + phone.slice(-4);
        if (!phone) phone = '—';

        const cleanExprDisplay = (state.expression || String(amount))
          .replace(/[+\-*/.]+$/, '')
          .replace(/\*/g, ' × ')
          .replace(/\//g, ' ÷ ')
          .replace(/\+/g, ' + ')
          .replace(/-/g, ' − ');

        const itemCount = countItemsInExpression(state.expression || String(amount));
        const note = purchaseNoteInput.value.trim() || (txType === 'CREDIT' ? 'Store Purchase' : 'Customer Udhaar / Due');

        const now = new Date();
        const timestamp = now.toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: '2-digit'
        }) + ' ' + now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const newTx = {
          id: 'tx-' + Date.now(),
          customerName,
          phone,
          type: txType, // 'CREDIT' or 'DEBIT'
          paymentMode: state.paymentMode, // 'UPI', 'Cash', 'Card'
          amount,
          expression: cleanExprDisplay,
          itemCount: Math.max(1, itemCount),
          note,
          timestamp
        };

        state.transactions.unshift(newTx);
        saveTransactionsToStorage();
        pushNewTransactionToBackend(newTx);

        // Play confirmation chime
        playTone(txType === 'CREDIT' ? 780 : 440, 0.09, 'sine');

        // Reset calculator & note for next bill
        state.expression = '';
        state.displayValue = '0';
        state.lastEvaluatedExpr = `${cleanExprDisplay} = ₹${formatINR(amount)}`;
        purchaseNoteInput.value = '';

        updateCalculatorScreen();
        renderRecentCustomerPills();
        renderRightPanel();

        showToast(
          `${txType === 'CREDIT' ? 'Credit (+)' : 'Debit (−)'} ₹${formatINR(amount)} via ${state.paymentMode} saved for ${customerName}`,
          txType === 'CREDIT' ? 'credit' : 'debit'
        );
      }

      // --- RECENT CUSTOMERS QUICK PILLS ---
      function renderRecentCustomerPills() {
        const uniqueMap = new Map();
        state.transactions.forEach((tx) => {
          const key = `${tx.customerName.toLowerCase()}|${tx.phone}`;
          if (!uniqueMap.has(key) && tx.customerName) {
            uniqueMap.set(key, { name: tx.customerName, phone: tx.phone });
          }
        });

        const recentList = Array.from(uniqueMap.values()).slice(0, 4);
        recentCustomerPills.innerHTML = '';

        if (recentList.length === 0) {
          recentCustomerPills.innerHTML = '<span class="text-[11px] theme-muted">No saved customers yet</span>';
          return;
        }

        recentList.forEach((c) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className =
            'text-[11px] font-medium px-2 py-0.5 rounded-full theme-subtle border hover:border-indigo-500 transition flex items-center gap-1';
          btn.innerHTML = `<span class="font-semibold">${escapeHtml(c.name)}</span>`;
          btn.addEventListener('click', () => {
            customerNameInput.value = c.name;
            customerPhoneInput.value = c.phone === '—' ? '' : c.phone;
            updateCalculatorScreen();
            playTone(600, 0.03);
          });
          recentCustomerPills.appendChild(btn);
        });
      }

      function escapeHtml(str) {
        return String(str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      // --- FILTERED TRANSACTIONS HELPER ---
      function getCustomerNetMap() {
        const netMap = new Map();
        state.transactions.forEach((tx) => {
          const key = tx.phone !== '—' ? tx.phone : tx.customerName.toLowerCase();
          const cur = netMap.get(key) || 0;
          const delta = tx.type === 'CREDIT' ? (Number(tx.amount) || 0) : -(Number(tx.amount) || 0);
          netMap.set(key, cur + delta);
        });
        return netMap;
      }

      function getFilteredTransactions() {
        const q = state.searchQuery.trim().toLowerCase();
        const netMap = state.filterDate === 'PENDING_KHATA' ? getCustomerNetMap() : null;
        const todayStr = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });

        return state.transactions.filter((tx) => {
          if (state.filterType !== 'ALL' && tx.type !== state.filterType) return false;
          if (state.filterPay !== 'ALL' && tx.paymentMode !== state.filterPay) return false;
          if (state.filterDate === 'TODAY') {
            const isToday = tx.timestamp.includes('2026-10-29') || tx.timestamp.includes(todayStr);
            if (!isToday) return false;
          } else if (state.filterDate === 'PENDING_KHATA' && netMap) {
            const key = tx.phone !== '—' ? tx.phone : tx.customerName.toLowerCase();
            if ((netMap.get(key) || 0) >= 0) return false;
          }
          if (q) {
            const hay = `${tx.customerName} ${tx.phone} ${tx.note} ${tx.paymentMode}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
      }

      // --- PAYMENT BADGE HTML ---
      function getPaymentBadgeHtml(mode) {
        if (mode === 'UPI') {
          return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-500/15 text-violet-500 border border-violet-500/25">⚡ UPI</span>`;
        }
        if (mode === 'Card') {
          return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-500/15 text-sky-500 border border-sky-500/25">💳 Card</span>`;
        }
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/25">💵 Cash</span>`;
      }

      // --- RENDER RIGHT-HAND PANEL (SUMMARY + LIST / DIRECTORY) ---
      function renderRightPanel() {
        const filtered = getFilteredTransactions();

        // Calculate Summary Totals & Payment Breakdown
        let totalCredit = 0;
        let creditCount = 0;
        let totalDebit = 0;
        let debitCount = 0;
        let upiCollection = 0;
        let cashCollection = 0;
        let cardCollection = 0;

        filtered.forEach((tx) => {
          const amt = Number(tx.amount) || 0;
          if (tx.type === 'CREDIT') {
            totalCredit += amt;
            creditCount++;
            if (tx.paymentMode === 'UPI') upiCollection += amt;
            else if (tx.paymentMode === 'Cash') cashCollection += amt;
            else if (tx.paymentMode === 'Card') cardCollection += amt;
          } else {
            totalDebit += amt;
            debitCount++;
          }
        });

        const net = totalCredit - totalDebit;

        summaryTotalCollectionVal.textContent = `₹${formatINR(totalCredit)}`;
        collectionBreakdownText.textContent = `UPI: ₹${formatINR(upiCollection)} • Cash: ₹${formatINR(cashCollection)} • Card: ₹${formatINR(cardCollection)}`;

        const denom = totalCredit > 0 ? totalCredit : 1;
        const upiPct = totalCredit > 0 ? Math.round((upiCollection / denom) * 100) : 0;
        const cashPct = totalCredit > 0 ? Math.round((cashCollection / denom) * 100) : 0;
        const cardPct = totalCredit > 0 ? Math.max(0, 100 - upiPct - cashPct) : 0;
        modeSplitPercentText.textContent = `UPI ${upiPct}% • Cash ${cashPct}% • Card ${cardPct}%`;
        barUpiWidth.style.width = `${upiPct}%`;
        barCashWidth.style.width = `${cashPct}%`;
        barCardWidth.style.width = `${cardPct}%`;

        const uniqueCustCount = new Set(filtered.map((t) => t.phone !== '—' ? t.phone : t.customerName.toLowerCase())).size;
        khataDirectorySummaryHint.textContent = `${uniqueCustCount} ${uniqueCustCount === 1 ? 'Customer' : 'Customers'} • ${filtered.length} ${filtered.length === 1 ? 'Transaction' : 'Transactions'}`;

        summaryCreditVal.textContent = `₹${formatINR(totalCredit)}`;
        summaryCreditCount.textContent = `${creditCount} credit ${creditCount === 1 ? 'entry' : 'entries'}`;

        summaryDebitVal.textContent = `₹${formatINR(totalDebit)}`;
        summaryDebitCount.textContent = `${debitCount} debit ${debitCount === 1 ? 'entry' : 'entries'}`;

        summaryNetVal.textContent = `${net >= 0 ? '+' : '−'}₹${formatINR(Math.abs(net))}`;
        summaryNetVal.className = `font-mono-calc text-lg sm:text-2xl font-bold mt-1 ${
          net >= 0 ? 'text-emerald-500' : 'text-rose-500'
        }`;
        summaryNetStatus.textContent =
          net > 0 ? 'Net Positive (Inflow)' : net < 0 ? 'Net Pending (Receivable)' : 'Settled / Balanced';

        historyCountBadge.textContent = String(filtered.length);
        navHistoryCountPill.textContent = String(state.transactions.length);

        if (state.transactions.length > 0) {
          const latest = state.transactions[0];
          latestSavedBannerText.textContent = `${latest.customerName}: ${latest.type === 'CREDIT' ? '+' : '−'}₹${formatINR(latest.amount)} (${latest.paymentMode})`;
        } else {
          latestSavedBannerText.textContent = 'No transactions recorded yet';
        }
        resetSearchBtn.classList.toggle('hidden', !state.searchQuery.trim());

        // Render either Transactions Feed or Customer Ledger Directory
        historyListContainer.innerHTML = '';

        if (filtered.length === 0) {
          historyListContainer.innerHTML = `
            <div class="theme-subtle border border-dashed rounded-2xl p-8 text-center">
              <div class="text-sm font-bold">No matching customer transactions</div>
              <p class="text-xs theme-muted mt-1">Calculate an amount on the left and press CREDIT (+) or DEBIT (−) to log a purchase.</p>
            </div>
          `;
          return;
        }

        if (state.viewMode === 'CUSTOMERS') {
          renderCustomerDirectoryView(filtered);
        } else {
          renderTransactionFeedView(filtered);
        }
      }

      function renderTransactionFeedView(filtered) {
        filtered.forEach((tx) => {
          const isCredit = tx.type === 'CREDIT';
          const card = document.createElement('div');
          card.className =
            'theme-subtle border rounded-2xl p-3.5 transition hover:border-indigo-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3';

          card.innerHTML = `
            <div class="flex items-start gap-3 min-w-0">
              <!-- Avatar / Sign Badge -->
              <div class="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-bold text-sm ${
                isCredit
                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
              }">
                ${isCredit ? '+' : '−'}
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center flex-wrap gap-1.5">
                  <span class="font-bold text-sm truncate">${escapeHtml(tx.customerName)}</span>
                  <button type="button" data-filter-phone="${escapeHtml(tx.phone)}" class="filter-phone-chip text-[11px] font-mono-calc px-2 py-0.5 rounded-md theme-panel border hover:border-indigo-500 transition" title="Filter by this phone number">
                    📞 ${escapeHtml(tx.phone)}
                  </button>
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                    isCredit
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : 'bg-rose-500/15 text-rose-500'
                  }">
                    ${isCredit ? 'CREDIT' : 'DEBIT'}
                  </span>
                  ${getPaymentBadgeHtml(tx.paymentMode)}
                </div>

                <!-- Note & Math Expression Breakdown -->
                <div class="mt-1 flex items-center flex-wrap gap-2 text-xs">
                  <span class="font-medium">${escapeHtml(tx.note)}</span>
                  <span class="font-mono-calc text-[11px] px-2 py-0.5 rounded-md theme-panel border theme-muted">
                    Calc: ${escapeHtml(tx.expression)} (${tx.itemCount || 1} ${tx.itemCount === 1 ? 'item' : 'items'})
                  </span>
                </div>

                <div class="mt-1 text-[11px] theme-muted">
                  ${escapeHtml(tx.timestamp)}
                </div>
              </div>
            </div>

            <!-- Right Side Amount & Quick Actions -->
            <div class="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0" style="border-color: var(--border-color);">
              <div class="font-mono-calc text-base sm:text-lg font-extrabold ${
                isCredit ? 'text-emerald-500' : 'text-rose-500'
              }">
                ${isCredit ? '+' : '−'} ₹${formatINR(tx.amount)}
              </div>

              <div class="flex items-center gap-1.5">
                <button type="button" data-load-tx="${escapeHtml(tx.id)}" class="px-2 py-1 rounded-lg theme-panel border text-[11px] font-semibold hover:border-indigo-500 transition" title="Fill customer into calculator">
                  Select Customer
                </button>
                <button type="button" data-receipt-tx="${escapeHtml(tx.id)}" class="px-2 py-1 rounded-lg theme-panel border text-[11px] font-semibold hover:border-indigo-500 transition" title="View Receipt">
                  Receipt
                </button>
                <button type="button" data-delete-tx="${escapeHtml(tx.id)}" class="p-1 rounded-lg theme-panel border text-rose-500 hover:bg-rose-500/10 transition" title="Delete entry">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          `;

          historyListContainer.appendChild(card);
        });
      }

      function renderCustomerDirectoryView(filtered) {
        const groups = new Map();
        filtered.forEach((tx) => {
          const key = tx.phone !== '—' ? tx.phone : tx.customerName.toLowerCase();
          if (!groups.has(key)) {
            groups.set(key, {
              customerName: tx.customerName,
              phone: tx.phone,
              credit: 0,
              debit: 0,
              txCount: 0,
              lastSeen: tx.timestamp
            });
          }
          const g = groups.get(key);
          if (tx.type === 'CREDIT') g.credit += Number(tx.amount) || 0;
          else g.debit += Number(tx.amount) || 0;
          g.txCount++;
        });

        Array.from(groups.values()).forEach((cust) => {
          const net = cust.credit - cust.debit;
          const isDue = net < 0;
          const dueAmount = Math.abs(net);
          const row = document.createElement('div');
          row.className =
            'theme-subtle border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-500/50 transition';

          const settleBtnHtml = isDue
            ? `<button type="button" data-settle-cust-name="${escapeHtml(cust.customerName)}" data-settle-cust-phone="${escapeHtml(cust.phone)}" data-settle-amount="${dueAmount}" class="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition" title="Record Credit entry to settle pending Udhaar">
                Settle ₹${formatINR(dueAmount)}
              </button>`
            : `<span class="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[11px] font-bold">✓ Settled</span>`;

          row.innerHTML = `
            <div class="space-y-1">
              <div class="flex items-center flex-wrap gap-2">
                <span class="font-bold text-sm sm:text-base">${escapeHtml(cust.customerName)}</span>
                <span class="text-xs font-mono-calc px-2 py-0.5 rounded-md theme-panel border">📞 ${escapeHtml(cust.phone)}</span>
                <span class="text-[11px] px-2 py-0.5 rounded-full theme-panel border theme-muted">${cust.txCount} ${cust.txCount === 1 ? 'bill' : 'bills'}</span>
                <span class="text-[11px] theme-muted">Last: ${escapeHtml(cust.lastSeen)}</span>
              </div>
              <div class="flex items-center flex-wrap gap-3 text-xs font-mono-calc pt-0.5">
                <span class="text-emerald-500 font-semibold">Total Paid (Credit): +₹${formatINR(cust.credit)}</span>
                <span class="text-rose-500 font-semibold">Total Udhaar (Debit): −₹${formatINR(cust.debit)}</span>
              </div>
            </div>
            <div class="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 border-t sm:border-t-0 pt-2.5 sm:pt-0" style="border-color: var(--border-color);">
              <div class="text-left sm:text-right mr-1">
                <div class="text-[10px] uppercase font-bold theme-muted">${isDue ? 'Udhaar Due (Receivable)' : 'Net Customer Balance'}</div>
                <div class="font-mono-calc text-base sm:text-lg font-extrabold ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}">
                  ${net >= 0 ? '+' : '−'} ₹${formatINR(Math.abs(net))}
                </div>
              </div>
              <div class="flex items-center flex-wrap gap-1.5">
                ${settleBtnHtml}
                <button type="button" data-view-cust-ledger="${escapeHtml(cust.phone !== '—' ? cust.phone : cust.customerName)}" class="px-2.5 py-1.5 rounded-xl theme-panel border text-xs font-semibold hover:border-indigo-500 transition">
                  Transactions
                </button>
                <button type="button" data-select-cust-name="${escapeHtml(cust.customerName)}" data-select-cust-phone="${escapeHtml(cust.phone)}" class="px-2.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition">
                  Bill Customer
                </button>
              </div>
            </div>
          `;
          historyListContainer.appendChild(row);
        });
      }

      // --- RECEIPT MODAL (WITH DYNAMIC USER SHOP NAME & SHOP LOCATION/PHONE) ---
      function openReceiptModal(txId) {
        const tx = state.transactions.find((t) => t.id === txId);
        if (!tx) return;
        state.currentReceiptTxId = tx.id;
        const shopHeader = (state.shopName || 'SMART LEDGER POS').trim().toUpperCase();
        const padLen = Math.max(0, Math.floor((36 - shopHeader.length) / 2));
        const centeredShop = ' '.repeat(padLen) + shopHeader;
        const addrLine = (state.shopAddress || '').trim();
        const lines = [
          '====================================',
          centeredShop,
          ...(addrLine ? ['   ' + addrLine] : []),
          '         OFFICIAL POS RECEIPT       ',
          '====================================',
          `Shop Name  : ${state.shopName || 'Smart Ledger POS'}`,
          `Date       : ${tx.timestamp}`,
          `Customer   : ${tx.customerName}`,
          `Phone      : ${tx.phone}`,
          '------------------------------------',
          `Entry Type : ${tx.type} (${tx.type === 'CREDIT' ? 'Payment In' : 'Customer Due'})`,
          `Paid Via   : ${tx.paymentMode}`,
          `Items/Note : ${tx.note}`,
          `Calculation: ${tx.expression} (${tx.itemCount || 1} items)`,
          '------------------------------------',
          `TOTAL      : ₹${formatINRWithDecimals(tx.amount)}`,
          '====================================',
          `Thank you for visiting ${state.shopName || 'us'}!`
        ];
        receiptTextContent.textContent = lines.join('\n');
        receiptModal.classList.remove('hidden');
        receiptModal.classList.add('flex');
      }

      // --- EXPORT CSV ---
      function exportFilteredHistoryToCSV() {
        const filtered = getFilteredTransactions();
        if (filtered.length === 0) {
          showToast('No transactions to export', 'error');
          return;
        }
        const headers = ['Transaction ID', 'Timestamp', 'Customer Name', 'Phone', 'Type', 'Payment Mode', 'Calculation', 'Amount (INR)', 'Note'];
        const rows = filtered.map((tx) => [
          tx.id,
          tx.timestamp,
          `"${(tx.customerName || '').replace(/"/g, '""')}"`,
          tx.phone,
          tx.type,
          tx.paymentMode,
          `"${(tx.expression || '').replace(/"/g, '""')}"`,
          tx.amount,
          `"${(tx.note || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `customer_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Exported CSV file');
      }

      // --- WIRE ALL EVENT LISTENERS ---
      function initEventListeners() {
        // Theme switcher buttons
        document.querySelectorAll('.theme-switch-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const targetTheme = btn.getAttribute('data-theme-btn');
            applyTheme(targetTheme);
            playTone(620, 0.03);
          });
        });

        // Sound toggle button
        soundToggleBtn.addEventListener('click', () => {
          state.soundEnabled = !state.soundEnabled;
          soundIconOn.classList.toggle('hidden', !state.soundEnabled);
          soundIconOff.classList.toggle('hidden', state.soundEnabled);
          soundLabel.textContent = state.soundEnabled ? 'Sound On' : 'Muted';
          if (state.soundEnabled) playTone(660, 0.04);
        });

        // Customer inputs live update & phone auto-lookup
        customerNameInput.addEventListener('input', updateCalculatorScreen);
        customerPhoneInput.addEventListener('input', () => {
          customerPhoneInput.value = customerPhoneInput.value.replace(/\D/g, '').slice(0, 10);
          const enteredPhone = customerPhoneInput.value;
          if (enteredPhone.length >= 4 && !customerNameInput.value.trim()) {
            const match = state.transactions.find((t) => t.phone === enteredPhone);
            if (match) {
              customerNameInput.value = match.customerName;
              showToast(`Auto-filled customer: ${match.customerName}`);
            }
          }
          updateCalculatorScreen();
        });

        clearCustomerBtn.addEventListener('click', () => {
          customerNameInput.value = '';
          customerPhoneInput.value = '';
          purchaseNoteInput.value = '';
          updateCalculatorScreen();
          playTone(480, 0.03);
        });

        // Quick item note tags
        document.querySelectorAll('.note-tag-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-note-tag');
            const current = purchaseNoteInput.value.trim();
            purchaseNoteInput.value = current ? `${current}, ${tag}` : tag;
            playTone(580, 0.025);
          });
        });

        // Payment mode buttons
        document.querySelectorAll('.pay-mode-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            state.paymentMode = btn.getAttribute('data-pay-mode');
            updatePaymentModeUI();
            playTone(640, 0.03);
          });
        });

        // Calculator keypad buttons
        document.querySelectorAll('[data-calc-key]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-calc-key');
            handleCalculatorInput(key);
          });
        });

        // Keyboard support for calculator when not focused inside an input
        window.addEventListener('keydown', (e) => {
          const activeTag = document.activeElement ? document.activeElement.tagName : '';
          if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

          if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            handleCalculatorInput(e.key);
          } else if (['+', '-', '*', '/', '.', '%'].includes(e.key)) {
            e.preventDefault();
            handleCalculatorInput(e.key);
          } else if (e.key === 'Enter' || e.key === '=') {
            e.preventDefault();
            handleCalculatorInput('=');
          } else if (e.key === 'Backspace') {
            e.preventDefault();
            handleCalculatorInput('BACKSPACE');
          } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCalculatorInput('C');
          }
        });

        // Credit & Debit primary buttons
        recordCreditBtn.addEventListener('click', () => recordTransaction('CREDIT'));
        recordDebitBtn.addEventListener('click', () => recordTransaction('DEBIT'));

        // Shop Name & Address input live listeners
        shopNameInput.addEventListener('input', () => {
          state.shopName = shopNameInput.value;
          saveShopNameToStorage();
          syncShopNameUI();
        });

        if (shopAddressInput) {
          shopAddressInput.addEventListener('input', () => {
            state.shopAddress = shopAddressInput.value;
            saveShopNameToStorage();
          });
        }

        if (viewSelectedCustomerHistoryBtn) {
          viewSelectedCustomerHistoryBtn.addEventListener('click', () => {
            const cPhone = customerPhoneInput.value.trim();
            const cName = customerNameInput.value.trim();
            if (cPhone || cName) {
              state.searchQuery = cPhone || cName;
              historySearchInput.value = state.searchQuery;
            }
            switchPage('HISTORY', 'CUSTOMERS');
          });
        }

        // Date / Pending Khata filter pills
        document.querySelectorAll('.date-filter-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            state.filterDate = btn.getAttribute('data-filter-date');
            document.querySelectorAll('.date-filter-btn').forEach((b) => {
              const active = b.getAttribute('data-filter-date') === state.filterDate;
              b.className = active
                ? 'date-filter-btn px-2.5 py-1 rounded-lg bg-indigo-600 text-white'
                : 'date-filter-btn px-2.5 py-1 rounded-lg theme-muted';
            });
            renderRightPanel();
          });
        });

        // Top Menu Page Navigation listeners
        navCalcPageBtn.addEventListener('click', () => {
          switchPage('CALC');
          playTone(580, 0.03);
        });

        navHistoryPageBtn.addEventListener('click', () => {
          switchPage('HISTORY', 'FEED');
          playTone(620, 0.03);
        });

        navCustomerDirBtn.addEventListener('click', () => {
          switchPage('HISTORY', 'CUSTOMERS');
          playTone(640, 0.03);
        });

        backToCalcBtn.addEventListener('click', () => {
          switchPage('CALC');
          playTone(560, 0.03);
        });

        jumpToHistoryBtn.addEventListener('click', () => {
          switchPage('HISTORY', 'FEED');
          playTone(620, 0.03);
        });

        openLatestReceiptBtn.addEventListener('click', () => {
          if (state.transactions.length === 0) {
            showToast('No transactions available for receipt', 'error');
            return;
          }
          openReceiptModal(state.transactions[0].id);
        });

        // View mode toggle inside History page (Feed vs Customers)
        viewFeedBtn.addEventListener('click', () => {
          switchPage('HISTORY', 'FEED');
        });

        viewCustomersBtn.addEventListener('click', () => {
          switchPage('HISTORY', 'CUSTOMERS');
        });

        // Search & Filter controls
        historySearchInput.addEventListener('input', () => {
          state.searchQuery = historySearchInput.value;
          renderRightPanel();
        });

        resetSearchBtn.addEventListener('click', () => {
          state.searchQuery = '';
          historySearchInput.value = '';
          renderRightPanel();
        });

        document.querySelectorAll('.type-filter-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            state.filterType = btn.getAttribute('data-filter-type');
            document.querySelectorAll('.type-filter-btn').forEach((b) => {
              const active = b.getAttribute('data-filter-type') === state.filterType;
              b.className = active
                ? 'type-filter-btn px-2 py-1 rounded-lg bg-indigo-600 text-white'
                : 'type-filter-btn px-2 py-1 rounded-lg theme-muted';
            });
            renderRightPanel();
          });
        });

        document.querySelectorAll('.pay-filter-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            state.filterPay = btn.getAttribute('data-filter-pay');
            document.querySelectorAll('.pay-filter-btn').forEach((b) => {
              const active = b.getAttribute('data-filter-pay') === state.filterPay;
              b.className = active
                ? 'pay-filter-btn px-2 py-1 rounded-lg bg-indigo-600 text-white'
                : 'pay-filter-btn px-2 py-1 rounded-lg theme-muted';
            });
            renderRightPanel();
          });
        });

        // Delegated actions on History List (Select Customer, Receipt, Delete, Phone Filter)
        historyListContainer.addEventListener('click', (e) => {
          const loadBtn = e.target.closest('[data-load-tx]');
          if (loadBtn) {
            const txId = loadBtn.getAttribute('data-load-tx');
            const tx = state.transactions.find((t) => t.id === txId);
            if (tx) {
              customerNameInput.value = tx.customerName;
              customerPhoneInput.value = tx.phone === '—' ? '' : tx.phone;
              state.paymentMode = tx.paymentMode;
              updatePaymentModeUI();
              updateCalculatorScreen();
              switchPage('CALC');
              showToast(`Loaded customer: ${tx.customerName}`);
            }
            return;
          }

          const settleBtn = e.target.closest('[data-settle-cust-name]');
          if (settleBtn) {
            const cName = settleBtn.getAttribute('data-settle-cust-name');
            const cPhone = settleBtn.getAttribute('data-settle-cust-phone');
            const dueAmt = Number(settleBtn.getAttribute('data-settle-amount')) || 0;
            if (dueAmt > 0) {
              const now = new Date();
              const timestamp = now.toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: '2-digit'
              }) + ' ' + now.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              });
              const settlementTx = {
                id: 'tx-' + Date.now(),
                customerName: cName,
                phone: cPhone,
                type: 'CREDIT',
                paymentMode: state.paymentMode,
                amount: dueAmt,
                expression: String(dueAmt),
                itemCount: 1,
                note: 'Udhaar Full Settlement',
                timestamp
              };
              state.transactions.unshift(settlementTx);
              saveTransactionsToStorage();
              renderRecentCustomerPills();
              renderRightPanel();
              updateLeftCustomerKhataPreview();
              playTone(820, 0.09, 'sine');
              showToast(`Settled ₹${formatINR(dueAmt)} Udhaar for ${cName} via ${state.paymentMode}`, 'credit');
            }
            return;
          }

          const viewCustLedgerBtn = e.target.closest('[data-view-cust-ledger]');
          if (viewCustLedgerBtn) {
            const query = viewCustLedgerBtn.getAttribute('data-view-cust-ledger');
            state.searchQuery = query;
            historySearchInput.value = query;
            switchPage('HISTORY', 'FEED');
            showToast(`Showing all transactions for ${query}`);
            return;
          }

          const selectCustBtn = e.target.closest('[data-select-cust-name]');
          if (selectCustBtn) {
            const cName = selectCustBtn.getAttribute('data-select-cust-name');
            const cPhone = selectCustBtn.getAttribute('data-select-cust-phone');
            customerNameInput.value = cName;
            customerPhoneInput.value = cPhone === '—' ? '' : cPhone;
            updateCalculatorScreen();
            switchPage('CALC');
            showToast(`Ready to bill ${cName}`);
            return;
          }

          const receiptBtn = e.target.closest('[data-receipt-tx]');
          if (receiptBtn) {
            openReceiptModal(receiptBtn.getAttribute('data-receipt-tx'));
            return;
          }

          const deleteBtn = e.target.closest('[data-delete-tx]');
          if (deleteBtn) {
            const txId = deleteBtn.getAttribute('data-delete-tx');
            state.transactions = state.transactions.filter((t) => t.id !== txId);
            saveTransactionsToStorage();
            deleteTransactionFromBackend(txId);
            renderRecentCustomerPills();
            renderRightPanel();
            showToast('Transaction entry deleted');
            return;
          }

          const phoneChip = e.target.closest('[data-filter-phone]');
          if (phoneChip) {
            const phone = phoneChip.getAttribute('data-filter-phone');
            if (phone && phone !== '—') {
              state.searchQuery = phone;
              historySearchInput.value = phone;
              renderRightPanel();
            }
          }
        });

        // Export CSV
        exportCsvBtn.addEventListener('click', exportFilteredHistoryToCSV);

        // Receipt Modal controls
        const closeReceipt = () => {
          receiptModal.classList.add('hidden');
          receiptModal.classList.remove('flex');
        };
        closeReceiptModalBtn.addEventListener('click', closeReceipt);
        closeReceiptBottomBtn.addEventListener('click', closeReceipt);
        if (whatsappReceiptBtn) {
          whatsappReceiptBtn.addEventListener('click', () => {
            const text = receiptTextContent.textContent;
            const tx = state.transactions.find((t) => t.id === state.currentReceiptTxId);
            const digits = tx && tx.phone ? tx.phone.replace(/\D/g, '') : '';
            const phoneParam = digits.length === 10 ? `91${digits}` : digits;
            const waUrl = `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`;
            window.open(waUrl, '_blank', 'noopener,noreferrer');
          });
        }

        copyReceiptBtn.addEventListener('click', () => {
          const text = receiptTextContent.textContent;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => showToast('Receipt copied to clipboard'));
          } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Receipt copied to clipboard');
          }
        });

        // Clear History Modal controls
        const closeClearModal = () => {
          clearConfirmModal.classList.add('hidden');
          clearConfirmModal.classList.remove('flex');
        };
        openClearModalBtn.addEventListener('click', () => {
          clearConfirmModal.classList.remove('hidden');
          clearConfirmModal.classList.add('flex');
        });
        cancelClearModalBtn.addEventListener('click', closeClearModal);
        restoreDemoDataBtn.addEventListener('click', () => {
          state.transactions = SAMPLE_TRANSACTIONS.slice();
          saveTransactionsToStorage();
          clearOrRestoreBackendTransactions(true);
          renderRecentCustomerPills();
          renderRightPanel();
          closeClearModal();
          showToast('Sample customer transactions restored');
        });
        confirmClearAllBtn.addEventListener('click', () => {
          state.transactions = [];
          saveTransactionsToStorage();
          clearOrRestoreBackendTransactions(false);
          renderRecentCustomerPills();
          renderRightPanel();
          closeClearModal();
          showToast('All purchase history cleared');
        });
      }

      // --- INITIALIZE APP ---
      loadStateFromStorage();
      syncShopNameUI();
      applyTheme(state.theme);
      updatePaymentModeUI();
      updateCalculatorScreen();
      renderRecentCustomerPills();
      renderRightPanel();
      initEventListeners();
      syncFromBackend();
})();
