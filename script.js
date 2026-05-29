<<<<<<< HEAD
(() => {
  "use strict";

  const CATEGORIES = ["Alimentación", "Transporte", "Servicios", "Ocio", "Otros"];

  const CURRENCIES = {
    CLP: { locale: "es-CL", symbol: "$", decimals: 0 },
    USD: { locale: "en-US", symbol: "$", decimals: 2 },
  };

  const TIME_FILTERS = {
    semana: "semana",
    mes: "mes",
    anio: "anio",
    todo: "todo",
  };

  const $ = (id) => document.getElementById(id);

  const authScreen = $("auth-screen");
  const appMain = $("app-main");
  const authEmailInput = $("auth-email");
  const authPasswordInput = $("auth-password");
  const authLoginBtn = $("auth-login-btn");
  const authRegisterBtn = $("auth-register-btn");
  const logoutBtn = $("logout-btn");

  const form = $("expense-form");
  const amountInput = $("amount");
  const descriptionInput = $("description");
  const categorySelect = $("category");
  const errorEl = $("form-error");

  const totalSpentEl = $("total-spent");
  const breakdownEl = $("category-breakdown");
  const expenseListEl = $("expense-list");
  const emptyStateEl = $("empty-state");
  const expenseCountEl = $("expense-count");
  const clearBtn = $("clear-btn");
  const currencySelect = $("currency-select");
  const timeFilterEl = $("time-filter");

  /** @type {import('@supabase/supabase-js').SupabaseClient | null} */
  let supabase = null;

  /** @type {import('@supabase/supabase-js').Session | null} */
  let currentSession = null;

  /** @type {Array<{id:string, amount:number, description:string, category:string, createdAt:number}>} */
  let allExpenses = [];

  let currency = localStorage.getItem("currency") || "CLP";
  let timeFilter = localStorage.getItem("timeFilter") || TIME_FILTERS.todo;
  let appEventsBound = false;

  const formatMoney = (amount) => {
    const cfg = CURRENCIES[currency] ?? CURRENCIES.CLP;
    const formatted = Number(amount).toLocaleString(cfg.locale, {
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
    });
    return `${cfg.symbol}${formatted}`;
  };

  const formatMoneyExpense = (amount) => {
    const value = formatMoney(amount);
    if (value.startsWith("-")) return value;
    return `- ${value}`;
  };

  const formatDate = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const mapRowToExpense = (row) => ({
    id: String(row.id),
    amount: Number(row.monto),
    description: String(row.descripcion ?? ""),
    category: String(row.categoria ?? ""),
    createdAt: new Date(row.fecha).getTime(),
  });

  const getFilterRange = (filter) => {
    const now = new Date();
    if (filter === TIME_FILTERS.todo) return null;

    if (filter === TIME_FILTERS.semana) {
      const start = new Date(now);
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return { start: start.getTime(), end: now.getTime() };
    }

    if (filter === TIME_FILTERS.mes) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: start.getTime(), end: end.getTime() };
    }

    if (filter === TIME_FILTERS.anio) {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start: start.getTime(), end: end.getTime() };
    }

    return null;
  };

  const getFilteredExpenses = () => {
    const range = getFilterRange(timeFilter);
    if (!range) return [...allExpenses];
    return allExpenses.filter((exp) => exp.createdAt >= range.start && exp.createdAt <= range.end);
  };

  const getCurrentUserId = () => currentSession?.user?.id ?? null;

  const showAuthUI = () => {
    authScreen?.classList.remove("hidden");
    appMain?.classList.add("hidden");
  };

  const showAppUI = () => {
    authScreen?.classList.add("hidden");
    appMain?.classList.remove("hidden");
  };

  const showError = (message) => {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  };

  const hideError = () => {
    if (!errorEl) return;
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  };

  const setLoading = (isLoading) => {
    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = isLoading;
    if (clearBtn) clearBtn.disabled = isLoading;
  };

  const setAuthLoading = (isLoading) => {
    if (authLoginBtn) authLoginBtn.disabled = isLoading;
    if (authRegisterBtn) authRegisterBtn.disabled = isLoading;
  };

  const updateTimeFilterUI = () => {
    if (!timeFilterEl) return;
    timeFilterEl.querySelectorAll("[data-period]").forEach((btn) => {
      const active = btn.dataset.period === timeFilter;
      btn.classList.toggle("bg-white", active);
      btn.classList.toggle("text-neutral-900", active);
      btn.classList.toggle("shadow-sm", active);
      btn.classList.toggle("text-neutral-500", !active);
    });
  };

  const initSupabase = () => {
    if (!window.supabase?.createClient) {
      throw new Error("No se cargó la librería de Supabase. Revisa el CDN.");
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "TU_CLAVE_ANON_AQUI") {
      throw new Error(
        "Configura SUPABASE_ANON_KEY en config.js con tu clave pública anon del dashboard."
      );
    }
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  };

  const loadExpenses = async () => {
    if (!getCurrentUserId()) return;

    const { data, error } = await supabase
      .from("gastos")
      .select("id, monto, descripcion, categoria, fecha")
      .order("fecha", { ascending: false });

    if (error) throw error;

    allExpenses = (data ?? [])
      .map(mapRowToExpense)
      .filter(
        (x) =>
          Number.isFinite(x.amount) &&
          x.amount >= 0 &&
          x.description.trim().length > 0 &&
          CATEGORIES.includes(x.category) &&
          Number.isFinite(x.createdAt)
      );
  };

  const insertExpense = async (expense) => {
    const userId = getCurrentUserId();
    if (!userId) throw new Error("Debes iniciar sesión para registrar gastos.");

    const { data, error } = await supabase
      .from("gastos")
      .insert({
        user_id: userId,
        monto: expense.amount,
        descripcion: expense.description,
        categoria: expense.category,
        fecha: new Date(expense.createdAt).toISOString(),
      })
      .select("id, monto, descripcion, categoria, fecha")
      .single();

    if (error) throw error;
    return mapRowToExpense(data);
  };

  const clearAllExpenses = async () => {
    const userId = getCurrentUserId();
    if (!userId) throw new Error("Debes iniciar sesión.");

    const { error } = await supabase.from("gastos").delete().eq("user_id", userId);
    if (error) throw error;
    allExpenses = [];
  };

  const buildBreakdown = (expenses) => {
    const totalsByCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
    for (const exp of expenses) {
      totalsByCategory[exp.category] += exp.amount;
    }
    return totalsByCategory;
  };

  const render = () => {
    const expenses = getFilteredExpenses();
    const totalSpent = expenses.reduce((acc, x) => acc + x.amount, 0);
    totalSpentEl.textContent = formatMoney(totalSpent);

    const totalsByCategory = buildBreakdown(expenses);
    const total = totalSpent > 0 ? totalSpent : 1;

    breakdownEl.innerHTML = "";
    for (const category of CATEGORIES) {
      const categoryTotal = totalsByCategory[category] ?? 0;
      const pct = Math.round((categoryTotal / total) * 100);

      const card = document.createElement("div");
      card.className = "rounded-lg border border-slate-200 bg-white p-3";

      const topRow = document.createElement("div");
      topRow.className = "flex items-center justify-between gap-3";

      const left = document.createElement("div");
      left.className = "min-w-0";
      const name = document.createElement("div");
      name.className = "text-sm font-semibold text-slate-700 truncate";
      name.textContent = category;
      const pctText = document.createElement("div");
      pctText.className = "text-xs text-slate-500";
      pctText.textContent = `${pct}%`;

      left.appendChild(name);
      left.appendChild(pctText);

      const amount = document.createElement("div");
      amount.className = "text-sm font-semibold text-slate-900 whitespace-nowrap";
      amount.textContent = formatMoney(categoryTotal);

      topRow.appendChild(left);
      topRow.appendChild(amount);

      const barWrap = document.createElement("div");
      barWrap.className = "mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden";
      const bar = document.createElement("div");
      bar.className = "h-full rounded-full bg-indigo-600";
      bar.style.width = `${categoryTotal === 0 ? 0 : pct}%`;
      barWrap.appendChild(bar);

      card.appendChild(topRow);
      card.appendChild(barWrap);
      breakdownEl.appendChild(card);
    }

    expenseListEl.innerHTML = "";
    expenseCountEl.textContent = String(expenses.length);
    emptyStateEl.classList.toggle("hidden", expenses.length !== 0);

    for (const exp of expenses) {
      const li = document.createElement("li");
      li.className = "rounded-lg border border-slate-200 bg-white p-4";
      li.dataset.amount = String(exp.amount);

      const row = document.createElement("div");
      row.className = "flex items-start justify-between gap-3";

      const left = document.createElement("div");
      left.className = "min-w-0";

      const desc = document.createElement("div");
      desc.className = "truncate text-sm font-semibold text-slate-900";
      desc.textContent = exp.description;

      const meta = document.createElement("div");
      meta.className = "mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600";

      const cat = document.createElement("div");
      cat.textContent = exp.category;
      const date = document.createElement("div");
      date.textContent = formatDate(exp.createdAt);

      meta.appendChild(cat);
      meta.appendChild(date);
      left.appendChild(desc);
      left.appendChild(meta);

      const amt = document.createElement("div");
      amt.className = "text-right text-sm font-semibold text-slate-900 whitespace-nowrap expense-amount-raw";
      amt.textContent = formatMoney(exp.amount);

      row.appendChild(left);
      row.appendChild(amt);
      li.appendChild(row);
      expenseListEl.appendChild(li);
    }

    document.dispatchEvent(new CustomEvent("expenses:rendered"));
  };

  const normalizeAmount = (value) => {
    const s = String(value).trim().replace(",", ".");
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
  };

  const validateAndBuildExpense = () => {
    const amount = normalizeAmount(amountInput.value);
    if (amount === null || amount < 0) return { ok: false, error: "Monto inválido." };

    const description = descriptionInput.value.trim();
    if (description.length === 0) return { ok: false, error: "La descripción es requerida." };

    const category = categorySelect.value;
    if (!CATEGORIES.includes(category)) return { ok: false, error: "Categoría inválida." };

    const decimals = CURRENCIES[currency]?.decimals ?? 0;
    const factor = decimals === 0 ? 1 : 100;

    return {
      ok: true,
      expense: {
        amount: Math.round(amount * factor) / factor,
        description,
        category,
        createdAt: Date.now(),
      },
    };
  };

  const enterApp = async (session) => {
    if (!session?.user) return;

    currentSession = session;
    showAppUI();

    window.AppFormat = {
      formatMoney,
      formatMoneyExpense,
      getCurrency: () => currency,
    };

    setLoading(true);
    hideError();
    try {
      await loadExpenses();
      render();
    } catch (err) {
      showError(err.message ?? "Error al cargar tus gastos.");
    } finally {
      setLoading(false);
    }
  };

  const leaveApp = () => {
    currentSession = null;
    allExpenses = [];
    showAuthUI();
    if (expenseListEl) expenseListEl.innerHTML = "";
    if (totalSpentEl) totalSpentEl.textContent = formatMoney(0);
    if (breakdownEl) breakdownEl.innerHTML = "";
    if (expenseCountEl) expenseCountEl.textContent = "0";
    if (emptyStateEl) emptyStateEl.classList.remove("hidden");
  };

  const getAuthCredentials = () => {
    const email = authEmailInput?.value.trim() ?? "";
    const password = authPasswordInput?.value ?? "";
    if (!email || !password) {
      alert("Ingresa email y contraseña.");
      return null;
    }
    return { email, password };
  };

  const onLogin = async () => {
    const credentials = getAuthCredentials();
    if (!credentials) return;

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      if (error) {
        alert(error.message);
        return;
      }
      await enterApp(data.session);
    } finally {
      setAuthLoading(false);
    }
  };

  const onRegister = async () => {
    const credentials = getAuthCredentials();
    if (!credentials) return;

    if (credentials.password.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp(credentials);
      if (error) {
        alert(error.message);
        return;
      }

      if (data.session) {
        await enterApp(data.session);
        return;
      }

      alert("Cuenta creada. Si tu proyecto requiere confirmación por email, revisa tu bandeja de entrada.");
    } finally {
      setAuthLoading(false);
    }
  };

  const onLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(error.message);
      return;
    }
    leaveApp();
  };

  const onCurrencyChange = () => {
    currency = currencySelect.value;
    localStorage.setItem("currency", currency);
    const cfg = CURRENCIES[currency];
    amountInput.step = cfg.decimals === 0 ? "1" : "0.01";
    render();
  };

  const onTimeFilterClick = (e) => {
    const btn = e.target.closest("[data-period]");
    if (!btn) return;
    timeFilter = btn.dataset.period;
    localStorage.setItem("timeFilter", timeFilter);
    updateTimeFilterUI();
    render();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    hideError();

    const result = validateAndBuildExpense();
    if (!result.ok) {
      showError(result.error);
      return;
    }

    setLoading(true);
    try {
      const saved = await insertExpense(result.expense);
      allExpenses.unshift(saved);
      render();
      form.reset();
    } catch (err) {
      showError(err.message ?? "No se pudo guardar el gasto en Supabase.");
    } finally {
      setLoading(false);
    }
  };

  const onClear = async () => {
    if (allExpenses.length === 0) return;
    const ok = window.confirm("¿Seguro que deseas eliminar todos tus gastos?");
    if (!ok) return;

    setLoading(true);
    hideError();
    try {
      await clearAllExpenses();
      render();
    } catch (err) {
      showError(err.message ?? "No se pudo limpiar el historial.");
    } finally {
      setLoading(false);
    }
  };

  const bindAppEvents = () => {
    if (appEventsBound) return;
    appEventsBound = true;

    form?.addEventListener("submit", onSubmit);
    clearBtn?.addEventListener("click", onClear);

    if (currencySelect) {
      currencySelect.value = currency;
      const cfg = CURRENCIES[currency];
      amountInput.step = cfg.decimals === 0 ? "1" : "0.01";
      currencySelect.addEventListener("change", onCurrencyChange);
    }

    if (timeFilterEl) {
      updateTimeFilterUI();
      timeFilterEl.addEventListener("click", onTimeFilterClick);
    }
  };

  const bindAuthEvents = () => {
    authLoginBtn?.addEventListener("click", onLogin);
    authRegisterBtn?.addEventListener("click", onRegister);
    logoutBtn?.addEventListener("click", onLogout);

    authPasswordInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onLogin();
    });
  };

  const init = async () => {
    try {
      supabase = initSupabase();
      bindAuthEvents();
      bindAppEvents();

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        alert(sessionError.message);
        showAuthUI();
        return;
      }

      if (session) {
        await enterApp(session);
      } else {
        showAuthUI();
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          const alreadyIn =
            currentSession?.user?.id === session.user.id && !appMain?.classList.contains("hidden");
          currentSession = session;
          if (!alreadyIn) await enterApp(session);
        } else if (event === "SIGNED_OUT") {
          leaveApp();
        }
      });
    } catch (err) {
      alert(err.message ?? "Error al inicializar la aplicación.");
      showAuthUI();
    }
  };

  document.addEventListener("DOMContentLoaded", init);
})();
=======
(() => {
  "use strict";

  const CATEGORIES = ["Alimentación", "Transporte", "Servicios", "Ocio", "Otros"];

  const CURRENCIES = {
    CLP: { locale: "es-CL", symbol: "$", decimals: 0 },
    USD: { locale: "en-US", symbol: "$", decimals: 2 },
  };

  const TIME_FILTERS = {
    semana: "semana",
    mes: "mes",
    anio: "anio",
    todo: "todo",
  };

  const $ = (id) => document.getElementById(id);

  const authScreen = $("auth-screen");
  const appMain = $("app-main");
  const authEmailInput = $("auth-email");
  const authPasswordInput = $("auth-password");
  const authLoginBtn = $("auth-login-btn");
  const authRegisterBtn = $("auth-register-btn");
  const logoutBtn = $("logout-btn");

  const form = $("expense-form");
  const amountInput = $("amount");
  const descriptionInput = $("description");
  const categorySelect = $("category");
  const errorEl = $("form-error");

  const totalSpentEl = $("total-spent");
  const breakdownEl = $("category-breakdown");
  const expenseListEl = $("expense-list");
  const emptyStateEl = $("empty-state");
  const expenseCountEl = $("expense-count");
  const clearBtn = $("clear-btn");
  const currencySelect = $("currency-select");
  const timeFilterEl = $("time-filter");

  /** @type {import('@supabase/supabase-js').SupabaseClient | null} */
  let supabase = null;

  /** @type {import('@supabase/supabase-js').Session | null} */
  let currentSession = null;

  /** @type {Array<{id:string, amount:number, description:string, category:string, createdAt:number}>} */
  let allExpenses = [];

  let currency = localStorage.getItem("currency") || "CLP";
  let timeFilter = localStorage.getItem("timeFilter") || TIME_FILTERS.todo;
  let appEventsBound = false;

  const formatMoney = (amount) => {
    const cfg = CURRENCIES[currency] ?? CURRENCIES.CLP;
    const formatted = Number(amount).toLocaleString(cfg.locale, {
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
    });
    return `${cfg.symbol}${formatted}`;
  };

  const formatMoneyExpense = (amount) => {
    const value = formatMoney(amount);
    if (value.startsWith("-")) return value;
    return `- ${value}`;
  };

  const formatDate = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const mapRowToExpense = (row) => ({
    id: String(row.id),
    amount: Number(row.monto),
    description: String(row.descripcion ?? ""),
    category: String(row.categoria ?? ""),
    createdAt: new Date(row.fecha).getTime(),
  });

  const getFilterRange = (filter) => {
    const now = new Date();
    if (filter === TIME_FILTERS.todo) return null;

    if (filter === TIME_FILTERS.semana) {
      const start = new Date(now);
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return { start: start.getTime(), end: now.getTime() };
    }

    if (filter === TIME_FILTERS.mes) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: start.getTime(), end: end.getTime() };
    }

    if (filter === TIME_FILTERS.anio) {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start: start.getTime(), end: end.getTime() };
    }

    return null;
  };

  const getFilteredExpenses = () => {
    const range = getFilterRange(timeFilter);
    if (!range) return [...allExpenses];
    return allExpenses.filter((exp) => exp.createdAt >= range.start && exp.createdAt <= range.end);
  };

  const getCurrentUserId = () => currentSession?.user?.id ?? null;

  const showAuthUI = () => {
    authScreen?.classList.remove("hidden");
    appMain?.classList.add("hidden");
  };

  const showAppUI = () => {
    authScreen?.classList.add("hidden");
    appMain?.classList.remove("hidden");
  };

  const showError = (message) => {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  };

  const hideError = () => {
    if (!errorEl) return;
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  };

  const setLoading = (isLoading) => {
    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = isLoading;
    if (clearBtn) clearBtn.disabled = isLoading;
  };

  const setAuthLoading = (isLoading) => {
    if (authLoginBtn) authLoginBtn.disabled = isLoading;
    if (authRegisterBtn) authRegisterBtn.disabled = isLoading;
  };

  const updateTimeFilterUI = () => {
    if (!timeFilterEl) return;
    timeFilterEl.querySelectorAll("[data-period]").forEach((btn) => {
      const active = btn.dataset.period === timeFilter;
      btn.classList.toggle("bg-white", active);
      btn.classList.toggle("text-neutral-900", active);
      btn.classList.toggle("shadow-sm", active);
      btn.classList.toggle("text-neutral-500", !active);
    });
  };

  const initSupabase = () => {
    if (!window.supabase?.createClient) {
      throw new Error("No se cargó la librería de Supabase. Revisa el CDN.");
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "TU_CLAVE_ANON_AQUI") {
      throw new Error(
        "Configura SUPABASE_ANON_KEY en config.js con tu clave pública anon del dashboard."
      );
    }
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  };

  const loadExpenses = async () => {
    if (!getCurrentUserId()) return;

    const { data, error } = await supabase
      .from("gastos")
      .select("id, monto, descripcion, categoria, fecha")
      .order("fecha", { ascending: false });

    if (error) throw error;

    allExpenses = (data ?? [])
      .map(mapRowToExpense)
      .filter(
        (x) =>
          Number.isFinite(x.amount) &&
          x.amount >= 0 &&
          x.description.trim().length > 0 &&
          CATEGORIES.includes(x.category) &&
          Number.isFinite(x.createdAt)
      );
  };

  const insertExpense = async (expense) => {
    const userId = getCurrentUserId();
    if (!userId) throw new Error("Debes iniciar sesión para registrar gastos.");

    const { data, error } = await supabase
      .from("gastos")
      .insert({
        user_id: userId,
        monto: expense.amount,
        descripcion: expense.description,
        categoria: expense.category,
        fecha: new Date(expense.createdAt).toISOString(),
      })
      .select("id, monto, descripcion, categoria, fecha")
      .single();

    if (error) throw error;
    return mapRowToExpense(data);
  };

  const clearAllExpenses = async () => {
    const userId = getCurrentUserId();
    if (!userId) throw new Error("Debes iniciar sesión.");

    const { error } = await supabase.from("gastos").delete().eq("user_id", userId);
    if (error) throw error;
    allExpenses = [];
  };

  const buildBreakdown = (expenses) => {
    const totalsByCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
    for (const exp of expenses) {
      totalsByCategory[exp.category] += exp.amount;
    }
    return totalsByCategory;
  };

  const render = () => {
    const expenses = getFilteredExpenses();
    const totalSpent = expenses.reduce((acc, x) => acc + x.amount, 0);
    totalSpentEl.textContent = formatMoney(totalSpent);

    const totalsByCategory = buildBreakdown(expenses);
    const total = totalSpent > 0 ? totalSpent : 1;

    breakdownEl.innerHTML = "";
    for (const category of CATEGORIES) {
      const categoryTotal = totalsByCategory[category] ?? 0;
      const pct = Math.round((categoryTotal / total) * 100);

      const card = document.createElement("div");
      card.className = "rounded-lg border border-slate-200 bg-white p-3";

      const topRow = document.createElement("div");
      topRow.className = "flex items-center justify-between gap-3";

      const left = document.createElement("div");
      left.className = "min-w-0";
      const name = document.createElement("div");
      name.className = "text-sm font-semibold text-slate-700 truncate";
      name.textContent = category;
      const pctText = document.createElement("div");
      pctText.className = "text-xs text-slate-500";
      pctText.textContent = `${pct}%`;

      left.appendChild(name);
      left.appendChild(pctText);

      const amount = document.createElement("div");
      amount.className = "text-sm font-semibold text-slate-900 whitespace-nowrap";
      amount.textContent = formatMoney(categoryTotal);

      topRow.appendChild(left);
      topRow.appendChild(amount);

      const barWrap = document.createElement("div");
      barWrap.className = "mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden";
      const bar = document.createElement("div");
      bar.className = "h-full rounded-full bg-indigo-600";
      bar.style.width = `${categoryTotal === 0 ? 0 : pct}%`;
      barWrap.appendChild(bar);

      card.appendChild(topRow);
      card.appendChild(barWrap);
      breakdownEl.appendChild(card);
    }

    expenseListEl.innerHTML = "";
    expenseCountEl.textContent = String(expenses.length);
    emptyStateEl.classList.toggle("hidden", expenses.length !== 0);

    for (const exp of expenses) {
      const li = document.createElement("li");
      li.className = "rounded-lg border border-slate-200 bg-white p-4";
      li.dataset.amount = String(exp.amount);

      const row = document.createElement("div");
      row.className = "flex items-start justify-between gap-3";

      const left = document.createElement("div");
      left.className = "min-w-0";

      const desc = document.createElement("div");
      desc.className = "truncate text-sm font-semibold text-slate-900";
      desc.textContent = exp.description;

      const meta = document.createElement("div");
      meta.className = "mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600";

      const cat = document.createElement("div");
      cat.textContent = exp.category;
      const date = document.createElement("div");
      date.textContent = formatDate(exp.createdAt);

      meta.appendChild(cat);
      meta.appendChild(date);
      left.appendChild(desc);
      left.appendChild(meta);

      const amt = document.createElement("div");
      amt.className = "text-right text-sm font-semibold text-slate-900 whitespace-nowrap expense-amount-raw";
      amt.textContent = formatMoney(exp.amount);

      row.appendChild(left);
      row.appendChild(amt);
      li.appendChild(row);
      expenseListEl.appendChild(li);
    }

    document.dispatchEvent(new CustomEvent("expenses:rendered"));
  };

  const normalizeAmount = (value) => {
    const s = String(value).trim().replace(",", ".");
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
  };

  const validateAndBuildExpense = () => {
    const amount = normalizeAmount(amountInput.value);
    if (amount === null || amount < 0) return { ok: false, error: "Monto inválido." };

    const description = descriptionInput.value.trim();
    if (description.length === 0) return { ok: false, error: "La descripción es requerida." };

    const category = categorySelect.value;
    if (!CATEGORIES.includes(category)) return { ok: false, error: "Categoría inválida." };

    const decimals = CURRENCIES[currency]?.decimals ?? 0;
    const factor = decimals === 0 ? 1 : 100;

    return {
      ok: true,
      expense: {
        amount: Math.round(amount * factor) / factor,
        description,
        category,
        createdAt: Date.now(),
      },
    };
  };

  const enterApp = async (session) => {
    if (!session?.user) return;

    currentSession = session;
    showAppUI();

    window.AppFormat = {
      formatMoney,
      formatMoneyExpense,
      getCurrency: () => currency,
    };

    setLoading(true);
    hideError();
    try {
      await loadExpenses();
      render();
    } catch (err) {
      showError(err.message ?? "Error al cargar tus gastos.");
    } finally {
      setLoading(false);
    }
  };

  const leaveApp = () => {
    currentSession = null;
    allExpenses = [];
    showAuthUI();
    if (expenseListEl) expenseListEl.innerHTML = "";
    if (totalSpentEl) totalSpentEl.textContent = formatMoney(0);
    if (breakdownEl) breakdownEl.innerHTML = "";
    if (expenseCountEl) expenseCountEl.textContent = "0";
    if (emptyStateEl) emptyStateEl.classList.remove("hidden");
  };

  const getAuthCredentials = () => {
    const email = authEmailInput?.value.trim() ?? "";
    const password = authPasswordInput?.value ?? "";
    if (!email || !password) {
      alert("Ingresa email y contraseña.");
      return null;
    }
    return { email, password };
  };

  const onLogin = async () => {
    const credentials = getAuthCredentials();
    if (!credentials) return;

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      if (error) {
        alert(error.message);
        return;
      }
      await enterApp(data.session);
    } finally {
      setAuthLoading(false);
    }
  };

  const onRegister = async () => {
    const credentials = getAuthCredentials();
    if (!credentials) return;

    if (credentials.password.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp(credentials);
      if (error) {
        alert(error.message);
        return;
      }

      if (data.session) {
        await enterApp(data.session);
        return;
      }

      alert("Cuenta creada. Si tu proyecto requiere confirmación por email, revisa tu bandeja de entrada.");
    } finally {
      setAuthLoading(false);
    }
  };

  const onLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(error.message);
      return;
    }
    leaveApp();
  };

  const onCurrencyChange = () => {
    currency = currencySelect.value;
    localStorage.setItem("currency", currency);
    const cfg = CURRENCIES[currency];
    amountInput.step = cfg.decimals === 0 ? "1" : "0.01";
    render();
  };

  const onTimeFilterClick = (e) => {
    const btn = e.target.closest("[data-period]");
    if (!btn) return;
    timeFilter = btn.dataset.period;
    localStorage.setItem("timeFilter", timeFilter);
    updateTimeFilterUI();
    render();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    hideError();

    const result = validateAndBuildExpense();
    if (!result.ok) {
      showError(result.error);
      return;
    }

    setLoading(true);
    try {
      const saved = await insertExpense(result.expense);
      allExpenses.unshift(saved);
      render();
      form.reset();
    } catch (err) {
      showError(err.message ?? "No se pudo guardar el gasto en Supabase.");
    } finally {
      setLoading(false);
    }
  };

  const onClear = async () => {
    if (allExpenses.length === 0) return;
    const ok = window.confirm("¿Seguro que deseas eliminar todos tus gastos?");
    if (!ok) return;

    setLoading(true);
    hideError();
    try {
      await clearAllExpenses();
      render();
    } catch (err) {
      showError(err.message ?? "No se pudo limpiar el historial.");
    } finally {
      setLoading(false);
    }
  };

  const bindAppEvents = () => {
    if (appEventsBound) return;
    appEventsBound = true;

    form?.addEventListener("submit", onSubmit);
    clearBtn?.addEventListener("click", onClear);

    if (currencySelect) {
      currencySelect.value = currency;
      const cfg = CURRENCIES[currency];
      amountInput.step = cfg.decimals === 0 ? "1" : "0.01";
      currencySelect.addEventListener("change", onCurrencyChange);
    }

    if (timeFilterEl) {
      updateTimeFilterUI();
      timeFilterEl.addEventListener("click", onTimeFilterClick);
    }
  };

  const bindAuthEvents = () => {
    authLoginBtn?.addEventListener("click", onLogin);
    authRegisterBtn?.addEventListener("click", onRegister);
    logoutBtn?.addEventListener("click", onLogout);

    authPasswordInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onLogin();
    });
  };

  const init = async () => {
    try {
      supabase = initSupabase();
      bindAuthEvents();
      bindAppEvents();

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        alert(sessionError.message);
        showAuthUI();
        return;
      }

      if (session) {
        await enterApp(session);
      } else {
        showAuthUI();
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          const alreadyIn =
            currentSession?.user?.id === session.user.id && !appMain?.classList.contains("hidden");
          currentSession = session;
          if (!alreadyIn) await enterApp(session);
        } else if (event === "SIGNED_OUT") {
          leaveApp();
        }
      });
    } catch (err) {
      alert(err.message ?? "Error al inicializar la aplicación.");
      showAuthUI();
    }
  };

  document.addEventListener("DOMContentLoaded", init);
})();
>>>>>>> 9235a599529d598551bf7caa349d18f4af67bafe
