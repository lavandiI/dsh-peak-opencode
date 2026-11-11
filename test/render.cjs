// The assertions below use Minsk local time; keep the suite independent of the
// machine timezone (CI runs in UTC and sets the same variable in the job env).
process.env.TZ = "Europe/Minsk";

// Smoke test for dsh-peak-opencode client.js without a browser.
// Renders the registered components with a minimal React hook shim and
// checks the Russian labels and phase logic.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const file = path.join(__dirname, "..", "lib", "client.js");
const source = fs.readFileSync(file, "utf8");

// ---------- React shim ----------
let hookIndex = 0;
let hookState = [];
const refs = [];

function resetHooks() {
  hookIndex = 0;
  hookState = [];
}
function useState(initial) {
  const at = hookIndex++;
  if (at >= hookState.length) hookState[at] = typeof initial === "function" ? initial() : initial;
  return [hookState[at], (next) => {
    hookState[at] = typeof next === "function" ? next(hookState[at]) : next;
  }];
}
function useReducer(_reducer, initial) {
  return useState(initial);
}
function useRef(initial) {
  const at = hookIndex++;
  if (refs[at] === undefined) refs[at] = { current: initial };
  return refs[at];
}
function useEffect() {}
function useLayoutEffect() {}
function useSyncExternalStore(_subscribe, getSnapshot) {
  return getSnapshot();
}
function useCallback(callback) {
  return callback;
}
const react = {
  createElement(type, props, ...children) {
    return { type, props: { ...(props || {}), children: children.flat() } };
  },
  useState,
  useReducer,
  useRef,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
  useCallback
};

// ---------- browser shim ----------
const createdTags = [];
const styleTags = [];
const documentShim = {
  documentElement: { style: { setProperty() {} }, lang: "ru" },
  head: { appendChild(tag) { styleTags.push(tag); } },
  createElement() {
    const tag = { dataset: {}, textContent: "", style: {} };
    createdTags.push(tag);
    return tag;
  },
  querySelector(selector) {
    if (selector === "style[data-pc-theme]") return createdTags.find((tag) => tag.dataset.pcTheme !== undefined) || null;
    if (selector === "style[data-pc-custom]") return createdTags.find((tag) => tag.dataset.pcCustom !== undefined) || null;
    return null;
  }
};
const localStorageData = {};
const windowShim = {
  __ModuleLoader__: { load(definition) { windowShim.definition = definition; } },
  localStorage: {
    getItem(key) { return Object.prototype.hasOwnProperty.call(localStorageData, key) ? localStorageData[key] : null; },
    setItem(key, value) { localStorageData[key] = value; }
  },
  setInterval() { return 0; },
  clearInterval() {},
  setTimeout() { return 0; },
  clearTimeout() {},
  requestAnimationFrame() { return 0; },
  cancelAnimationFrame() {},
  addEventListener() {},
  removeEventListener() {}
};
global.window = windowShim;
global.document = documentShim;

vm.runInThisContext(source, { filename: file });
const definition = windowShim.definition;
if (definition === undefined) throw new Error("client.js did not register a module");
if (definition.id !== "dsh-peak-opencode") throw new Error("unexpected module id: " + definition.id);

const exported = definition.factory((name) => {
  if (name === "react") return react;
  throw new Error("unexpected require: " + name);
});

// ---------- host shim ----------
const current = { provider: "opencode-go", model: "deepseek-v4.1-flash" };
const store = {
  getSnapshot() { return { current }; },
  subscribe() { return () => {}; },
  load() {}
};
const directories = {
  directoryFor() { return { store, load() {} }; }
};
const registrations = [];
const localeListeners = new Set();
const localeService = {
  active: "ru",
  getSnapshot() { return { active: localeService.active, locales: [], revision: 0 }; },
  subscribe(listener) { localeListeners.add(listener); return () => localeListeners.delete(listener); }
};
function setDshLocale(id) {
  localeService.active = id;
  for (const listener of localeListeners) listener();
}
const ctx = {
  get(name) {
    if (name === "modelDirectories") return directories;
    if (name === "locale") return localeService;
    return undefined;
  },
  slots: {
    inject(_name, callback) { callback(); return () => {}; },
    register(slot, component) { registrations.push({ slot, component }); return () => {}; }
  }
};

// ---------- render helpers ----------
function render(component, props) {
  resetHooks();
  refs.length = 0;
  return component(props);
}
// Повторный рендер с сохранением состояния хуков: нужен для кнопок и
// подтверждения сброса, которые живут в useState.
function renderKept(component, props) {
  hookIndex = 0;
  return component(props);
}
function text(node, out = []) {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") { out.push(String(node)); return out; }
  if (Array.isArray(node)) { for (const child of node) text(child, out); return out; }
  if (node.props && node.props.children !== undefined) text(node.props.children, out);
  return out;
}
function find(node, predicate) {
  if (node === null || node === undefined || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const child of node) { const hit = find(child, predicate); if (hit) return hit; } return null; }
  if (predicate(node)) return node;
  return find(node.props ? node.props.children : null, predicate);
}
function assert(condition, message) {
  if (!condition) throw new Error("FAIL: " + message);
  console.log("ok - " + message);
}

// ---------- run ----------
// Каталог в форме реального эндпоинта: одна пиковая модель и одна с единым тарифом.
const fakeCatalog = {
  source: "test",
  updatedAt: Date.parse("2026-11-10T12:00:00Z"),
  data: [
    {
      id: "deepseek-v4.1-flash",
      name: "DeepSeek V4.1 Flash",
      limit: { context: 1000000, output: 384000 },
      cost: {
        text: { input: { price: 0.15, cache: { read: 0.003 } }, output: { price: 0.6 } },
        multipliers: [{
          when: {
            utc_days: { in: ["mon", "tue", "wed", "thu", "fri"] },
            any: [
              { all: [{ utc_hours: { gte: "01:00" } }, { utc_hours: { lt: "04:00" } }] },
              { all: [{ utc_hours: { gte: "06:00" } }, { utc_hours: { lt: "10:00" } }] }
            ]
          },
          factor: 2
        }]
      }
    },
    {
      id: "glm-5.3",
      name: "GLM-5.3",
      limit: { context: 1000000, output: 131072 },
      cost: { text: { input: { price: 1.4, cache: { read: 0.26 } }, output: { price: 4.4 } } }
    },
    {
      id: "beam-free",
      name: "Beam Free",
      limit: { context: 1048576, output: 131072 },
      cost: { text: { input: { price: 0 }, output: { price: 0 } } }
    },
    {
      // DSH называет модель «LongCat 2.5 Preview Free», а публичный каталог —
      // `longcat-2.5-free`: id не совпадают, но цена всё равно нулевая.
      id: "longcat-2.5-free",
      name: "LongCat 2.5 Free",
      limit: { context: 1000000, output: 131072 },
      cost: { text: { input: { price: 0, cache: { read: 0 } }, output: { price: 0 } } }
    },
    {
      // Платная модель, на которую иначе совпал бы бесплатный id
      // `step-5-preview-free` после срезания суффикса `-free`.
      id: "step-5-preview",
      name: "Step 5 Preview",
      limit: { context: 1000000, output: 65536 },
      cost: { text: { input: { price: 1, cache: { read: 0.1 } }, output: { price: 2.7 } } }
    },
    {
      id: "kimi-k3",
      name: "Kimi K3",
      limit: { context: 1048576, output: 131072 },
      cost: { text: { input: { price: 3, cache: { read: 0.3, write: { "30m": 3 } } }, output: { price: 15 } } }
    },
    {
      // Множитель по дате, а не по часам: до 01.12.2026 льготная цена, дальше ×2.
      id: "gemini-4-argon",
      name: "Gemini 4 Argon",
      limit: { context: 1048576, output: 65536 },
      cost: {
        text: { input: { price: 2, cache: { read: 0.1 } }, output: { price: 10 } },
        multipliers: [{ when: { date: { gte: "2026-12-01" } }, factor: 2 }]
      }
    }
  ]
};
// Хостовый маршрут отвечает устаревшим форматом (без since) — как запущенный
// старый хост. Клиент должен это заметить и взять публичный эндпоинт.
const legacyHostPayload = {
  ok: true,
  format: 1,
  updatedAt: Date.parse("2026-11-10T00:00:00Z"),
  models: [
    { id: "glm-5.3", name: "GLM-5.3", input: 1.4, outputPrice: 4.4, cacheRead: 0.26, peak: null },
    { id: "gemini-4-argon", name: "Gemini 4 Argon", input: 2, outputPrice: 10, cacheRead: 0.1, peak: null }
  ]
};

global.fetch = async (url) => {
  const target = String(url);
  if (target.includes("/dsh-peak-opencode/models")) {
    return { ok: true, json: async () => legacyHostPayload };
  }
  if (target.includes("opencode.ai")) {
    return { ok: true, json: async () => fakeCatalog };
  }
  throw new Error("unexpected fetch: " + url);
};

async function main() {
  exported.apply(ctx);
  // Даём каталогу загрузиться (fetch → json → setState).
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert(registrations.length === 2, "apply registers the dock and the bundle config");
const dock = registrations.find((entry) => entry.slot.name === "conversation.input.dock");
const settings = registrations.find((entry) => entry.slot.name === "plugins.bundle.config");
assert(dock !== undefined && settings !== undefined, "both slots are present");
assert(settings.slot.key === "dsh-peak-opencode", "bundle config is keyed by the package name");
assert(settings.slot.id === undefined && settings.slot.label === undefined, "bundle config needs neither id nor label");

const themeTag = createdTags.find((tag) => tag.dataset.pcTheme !== undefined);
const customTag = createdTags.find((tag) => tag.dataset.pcCustom !== undefined);
assert(themeTag === undefined, "no theme style tag: the plugin has no themes");
assert(customTag !== undefined, "custom CSS tag is created");

const realNow = Date.now;
try {
  // Valley: Wednesday 2026-11-11 03:30 Beijing, ends 09:00 Beijing.
  Date.now = () => Date.parse("2026-11-10T22:30:00+03:00");
  const valley = render(dock.component, { ctx, sessionId: "session-1" });
  const valleyText = text(valley).join(" ");
  assert(valley.props["data-phase"] === "valley", "valley phase detected");
  assert(valleyText.includes("Льготный тариф"), "valley label rendered: " + valleyText);
  assert(valleyText.includes("до ср 04:00"), "local end time rendered: " + valleyText);
  assert(valleyText.includes("5 ч 30 мин"), "remaining duration rendered: " + valleyText);
  assert(valleyText.includes("вход $0.15 · выход $0.60 · кэш $0.003 / 1M"), "valley price rendered: " + valleyText);

  // Peak: Wednesday 2026-11-10 09:00 Beijing.
  Date.now = () => Date.parse("2026-11-10T04:00:00+03:00");
  const peak = render(dock.component, { ctx, sessionId: "session-1" });
  const peakText = text(peak).join(" ");
  assert(peak.props["data-phase"] === "peak", "peak phase detected");
  assert(peakText.includes("Пиковый тариф"), "peak label rendered: " + peakText);
  assert(peakText.includes("до 07:00"), "peak end in local time: " + peakText);
  assert(peakText.includes("вход $0.30 · выход $1.20 · кэш $0.006 / 1M"), "peak price rendered: " + peakText);

  // DeepSeek account (deepseek-flash = V4.1 Flash 1017) uses the built-in prices.
  current.provider = "deepseek-account";
  current.model = "deepseek-flash";
  Date.now = () => Date.parse("2026-11-10T22:30:00+03:00");
  const account = render(dock.component, { ctx, sessionId: "session-1" });
  const accountText = text(account).join(" ");
  assert(account.props["data-phase"] === "valley", "deepseek-account phase detected");
  assert(accountText.includes("вход $0.15 · выход $0.60 · кэш $0.003 / 1M"), "deepseek-account fallback price rendered: " + accountText);

  // A Chinese public holiday is valley even on a weekday.
  Date.now = () => Date.parse("2026-10-01T05:00:00+03:00");
  const holiday = render(dock.component, { ctx, sessionId: "session-1" });
  assert(holiday.props["data-phase"] === "valley", "holiday is valley: " + text(holiday).join(" "));

  // A Go model without peak hours: the band is flat (blue).
  current.provider = "opencode-go";
  current.model = "glm-5.3";
  Date.now = () => Date.parse("2026-11-10T22:30:00+03:00");
  const flat = render(dock.component, { ctx, sessionId: "session-1" });
  const flatText = text(flat).join(" ");
  assert(flat.props["data-phase"] === "flat", "flat phase for a model without peak hours");
  assert(flatText.includes("Единый тариф"), "flat label rendered: " + flatText);
  assert(flatText.includes("вход $1.40 · выход $4.40 · кэш $0.26 / 1M"), "flat price rendered: " + flatText);

  // Cache write (Kimi K3) is rendered as «зап.».
  current.provider = "opencode-go";
  current.model = "kimi-k3";
  const kimi = render(dock.component, { ctx, sessionId: "session-1" });
  const kimiText = text(kimi).join(" ");
  assert(kimi.props["data-phase"] === "flat", "Kimi K3 uses the flat band");
  assert(kimiText.includes("вход $3.00 · выход $15.00 · кэш $0.30 · зап. $3.00 / 1M"), "cache write price rendered: " + kimiText);

  // A model with a date multiplier is not flat: it is valley until the date.
  // Каталог при этом обязан прийти из публичного эндпоинта, а не из старого хоста.
  current.provider = "opencode-go";
  current.model = "gemini-4-argon";
  Date.now = () => Date.parse("2026-11-10T22:30:00+03:00");
  const datedBefore = render(dock.component, { ctx, sessionId: "session-1" });
  const datedBeforeText = text(datedBefore).join(" ");
  assert(datedBefore.props["data-phase"] === "valley", "dated model is valley before the multiplier date: " + datedBeforeText);
  assert(datedBeforeText.includes("Льготный тариф"), "dated model shows the valley label: " + datedBeforeText);
  assert(datedBeforeText.includes("до 1 дек."), "dated model shows the multiplier date: " + datedBeforeText);
  assert(datedBeforeText.includes("вход $2.00 · выход $10.00 · кэш $0.10 / 1M"), "dated model shows the base price: " + datedBeforeText);

  // On and after the date the multiplier applies: peak band and ×2 prices.
  Date.now = () => Date.parse("2026-12-02T12:00:00+03:00");
  const datedAfter = render(dock.component, { ctx, sessionId: "session-1" });
  const datedAfterText = text(datedAfter).join(" ");
  assert(datedAfter.props["data-phase"] === "peak", "dated model is peak after the multiplier date: " + datedAfterText);
  assert(datedAfterText.includes("Пиковый тариф"), "dated model shows the peak label: " + datedAfterText);
  assert(datedAfterText.includes("вход $4.00 · выход $20.00 · кэш $0.20 / 1M"), "dated model applies ×2: " + datedAfterText);

  // Тот же Argon, но провайдер называет модель с суффиксом варианта доступа —
  // как в DSH: gemini-4-argon-contributor должен попасть в запись каталога.
  current.provider = "opencode-go";
  current.model = "gemini-4-argon-contributor";
  Date.now = () => Date.parse("2026-11-10T22:30:00+03:00");
  const contrib = render(dock.component, { ctx, sessionId: "session-1" });
  const contribText = text(contrib).join(" ");
  assert(contrib.props["data-phase"] === "valley", "-contributor id resolves to the catalog model: " + contribText);
  assert(contribText.includes("вход $2.00 · выход $10.00 · кэш $0.10 / 1M"), "-contributor id keeps the base price: " + contribText);

  // Идентификатор с префиксом провайдера тоже распознаётся.
  current.model = "opencode-go/gemini-4-argon-contributor";
  const prefixed = render(dock.component, { ctx, sessionId: "session-1" });
  assert(prefixed.props["data-phase"] === "valley", "provider-prefixed id resolves to the catalog model");

  // A model with no multipliers at all stays flat (blue).
  current.provider = "opencode-go";
  current.model = "glm-5.3";
  Date.now = () => Date.parse("2026-11-10T22:30:00+03:00");
  const stillFlat = render(dock.component, { ctx, sessionId: "session-1" });
  assert(stillFlat.props["data-phase"] === "flat", "a model without multipliers stays flat");

  // A free model shows «бесплатно» instead of zeros and gets its own green band.
  current.provider = "opencode-go";
  current.model = "beam-free";
  const free = render(dock.component, { ctx, sessionId: "session-1" });
  const freeText = text(free).join(" ");
  assert(free.props["data-phase"] === "free", "free model uses the free (green) band");
  assert(freeText.includes("бесплатно"), "free price label rendered: " + freeText);
  assert(freeText.includes("Бесплатный тариф"), "free model shows the free tariff label: " + freeText);
  assert(String(free.props["aria-label"]).startsWith("Бесплатный тариф"), "free model is announced as the free tariff");
  const freeCss = styleTags.map((tag) => tag.textContent).join("\n");
  assert(freeCss.includes(".pc-bar[data-phase=\"free\"]"), "free phase styles are injected");
  assert(freeCss.includes("--pc-c-free"), "free band color is a CSS variable");
  assert(freeCss.includes(":has(.pc-bar[data-phase=\"free\"])"), "the composer outline follows the free band");

  // Бесплатная модель, которую каталог Go переименовал: в DSH id с `preview`
  // (`longcat-2.5-preview-free`), в публичном каталоге — `longcat-2.5-free`.
  // Совпадения нет, но цена известна из суффикса `-free` — «бесплатно» слева
  // должно быть и без записи в каталоге.
  current.model = "longcat-2.5-preview-free";
  Date.now = () => Date.parse("2026-11-10T22:30:00+03:00");
  const renamedFree = render(dock.component, { ctx, sessionId: "session-1" });
  const renamedFreeText = text(renamedFree).join(" ");
  assert(renamedFree.props["data-phase"] === "free", "renamed free model uses the free (green) band");
  assert(renamedFreeText.includes("бесплатно"), "renamed free model shows «бесплатно»: " + renamedFreeText);
  assert(renamedFree.props["data-hero-price"] === "true", "renamed free model reserves the price line");
  assert(String(renamedFree.props.title).includes("$0 за 1M"), "renamed free hint explains the zero price: " + renamedFree.props.title);
  assert(String(renamedFree.props["aria-label"]).includes("бесплатно"), "renamed free model is announced as free");

  // Бесплатная модель не должна получить цену платной тёзки: `-free` в id
  // срезается, и `step-5-preview-free` иначе совпал бы с платным `step-5-preview`.
  current.model = "step-5-preview-free";
  const freeTwin = render(dock.component, { ctx, sessionId: "session-1" });
  const freeTwinText = text(freeTwin).join(" ");
  assert(freeTwin.props["data-phase"] === "free", "free twin of a paid model uses the free (green) band");
  assert(freeTwinText.includes("бесплатно"), "free twin shows «бесплатно»: " + freeTwinText);
  assert(!freeTwinText.includes("$1.00") && !freeTwinText.includes("$2.70"), "free twin never inherits the paid price: " + freeTwinText);

  // A non-DeepSeek model hides the bar.
  current.provider = "openrouter";
  current.model = "claude-sonnet";
  Date.now = () => Date.parse("2026-11-10T22:30:00+03:00");
  const hidden = render(dock.component, { ctx, sessionId: "session-1" });
  assert(hidden === null, "bar hidden for a non-DeepSeek model");

  // Plugin page config renders all Russian blocks.
  const settingsTree = render(settings.component, {});
  const settingsText = text(settingsTree).join(" ");
  for (const label of ["Каталог моделей", "Пиковые окна", "Поведение", "Свой CSS", "Справка по настройке", "Вернуть официальные окна"]) {
    assert(settingsText.includes(label), "settings contains " + label);
  }
  // Themes were removed: no theme block and no theme chips.
  for (const gone of ["Тема", "Мята", "Лаванда", "Сакура"]) {
    assert(!settingsText.includes(gone), "settings no longer mentions " + gone);
  }

  // Язык в настройках больше не выбирается: плагин всегда следует DSH.
  current.provider = "opencode-go";
  current.model = "beam-free";
  Date.now = () => Date.parse("2026-11-10T22:30:00+03:00");
  assert(find(render(settings.component, {}), (node) => node.props && node.props.className === "pc-select") === null, "settings have no manual language selector");

  setDshLocale("en");
  const englishText = text(render(dock.component, { ctx, sessionId: "session-1" })).join(" ");
  assert(englishText.includes("Free tariff"), "the band follows the DSH language: " + englishText);
  assert(englishText.includes("no peak hours"), "English band labels are translated");
  const englishSettingsText = text(render(settings.component, {})).join(" ");
  assert(englishSettingsText.includes("Model catalog"), "settings follow the DSH language");
  assert(!/settings\.|guide\.|hint\.|bar\./.test(englishSettingsText), "no raw message keys leak into the English settings");

  // Все остальные языки DSH тоже дают перевод, а не ключи.
  const expectedFree = {
    zh: "免费费率",
    ja: "無料料金",
    es: "Tarifa gratuita",
    fr: "Tarif gratuit",
    de: "Kostenloser Tarif",
    pt: "Tarifa gratuita"
  };
  for (const [id, label] of Object.entries(expectedFree)) {
    setDshLocale(id);
    const localizedText = text(render(dock.component, { ctx, sessionId: "session-1" })).join(" ");
    assert(localizedText.includes(label), id + " free band label: " + localizedText);
    const localizedSettings = text(render(settings.component, {})).join(" ");
    assert(localizedSettings.length > 200, id + " settings are rendered");
    assert(!/settings\.|guide\.|hint\.|bar\./.test(localizedSettings), id + " settings have no raw keys");
  }
  setDshLocale("ru");
  const russianText = text(render(dock.component, { ctx, sessionId: "session-1" })).join(" ");
  assert(russianText.includes("Бесплатный тариф"), "band returns to Russian with the DSH locale: " + russianText);

  // CSS-блок: «Применить» активна только при изменениях, статус виден после действия.
  const cssPanel = render(settings.component, {});
  const cssArea = find(cssPanel, (node) => node.props && node.props.className === "pc-css");
  assert(cssArea !== undefined && cssArea !== null, "settings have the custom CSS field");
  assert(String(cssArea.props.placeholder).startsWith("Пусто"), "the CSS placeholder says the field is empty: " + cssArea.props.placeholder);
  const applyButton = () => find(renderKept(settings.component, {}), (node) => node.props && typeof node.props.onClick === "function" && text(node).join(" ").trim() === "Применить");
  assert(applyButton().props.disabled === true, "Apply is disabled while the CSS is unchanged");
  cssArea.props.onChange({ target: { value: ":root{--pc-c-valley:#ff0000}" } });
  const applyEdited = applyButton();
  assert(applyEdited.props.disabled === false, "Apply enables after editing");
  applyEdited.props.onClick();
  assert(JSON.parse(localStorageData["dsh-peak-opencode:settings"]).customCss.includes("#ff0000"), "Apply saves the draft CSS");
  const afterSaveText = text(renderKept(settings.component, {})).join(" ");
  assert(afterSaveText.includes("CSS сохранён."), "the CSS block reports the save: " + afterSaveText);

  // «Очистить» удаляет CSS и сообщает об этом.
  const clearButton = find(renderKept(settings.component, {}), (node) => node.props && typeof node.props.onClick === "function" && text(node).join(" ").trim() === "Очистить");
  clearButton.props.onClick();
  assert(JSON.parse(localStorageData["dsh-peak-opencode:settings"]).customCss === "", "Clear removes the saved CSS");
  const afterClearText = text(renderKept(settings.component, {})).join(" ");
  assert(afterClearText.includes("Свой CSS очищен."), "the CSS block reports the clear: " + afterClearText);

  // Сброс вынесен из блока CSS и требует подтверждения.
  const openReset = find(renderKept(settings.component, {}), (node) => node.props && typeof node.props.onClick === "function" && text(node).join(" ").trim() === "Сбросить настройки плагина");
  assert(openReset !== undefined && openReset !== null, "reset lives in its own block");
  openReset.props.onClick();
  const confirmText = text(renderKept(settings.component, {})).join(" ");
  assert(confirmText.includes("Да, сбросить") && confirmText.includes("Отмена"), "reset asks for confirmation: " + confirmText.slice(0, 200));
  const confirmResetButton = find(renderKept(settings.component, {}), (node) => node.props && typeof node.props.onClick === "function" && text(node).join(" ").trim() === "Да, сбросить");
  confirmResetButton.props.onClick();
  const afterResetText = text(renderKept(settings.component, {})).join(" ");
  assert(afterResetText.includes("Настройки плагина сброшены."), "reset reports completion: " + afterResetText);
  assert(JSON.parse(localStorageData["dsh-peak-opencode:settings"]).customCss === "", "reset clears the saved CSS");

  // Метаданные локали и detail-страница для менеджера плагинов есть на всех языках DSH.
  for (const id of ["en", "ru", "zh", "ja", "es", "fr", "de", "pt"]) {
    const meta = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "locale", id + ".json"), "utf8"));
    assert(meta.meta.title === "OpenCode Go cost/peak" && meta.meta.description.length > 30, id + " locale metadata is present");
    assert(meta.meta.detail === "detail/" + id + ".md", id + " declares its localized detail document");
    const detailFile = path.join(__dirname, "..", meta.meta.detail);
    assert(fs.existsSync(detailFile), id + " detail document exists");
    const detailText = fs.readFileSync(detailFile, "utf8");
    assert(detailText.length > 150, id + " detail document has content");
    if (id !== "ru") {
      assert(!/[\u0400-\u04FF]/.test(detailText), id + " detail document has no Russian text");
    }
  }

  // npm берёт основной README из README.md; русская версия названа так, чтобы он её не выбрал.
  const mainReadme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
  assert(/^# dsh-peak-opencode/.test(mainReadme), "README.md is the package readme");
  assert(!/Полоса|тариф|Бесплатн|Настройк|Плагин/.test(mainReadme), "README.md has no Russian prose");
  assert(!/\]\((?!https?:|#)[^)]+\)/.test(mainReadme), "README.md uses absolute links (npm cannot resolve relative ones)");
  assert(fs.existsSync(path.join(__dirname, "..", "README-ru.md")), "Russian README is README-ru.md");

  // Hero geometry: a lone chip row must not lift the band, a two-chip row must.
  current.provider = "opencode-go";
  current.model = "deepseek-v4.1-flash";
  global.ResizeObserver = class { observe() {} disconnect() {} };
  global.MutationObserver = class { observe() {} disconnect() {} };

  function makeRow(top, height) {
    const row = {
      top,
      height,
      chips: [],
      style: { position: "", zIndex: "", removeProperty(name) { this[name] = ""; } },
      contains() { return false; },
      querySelectorAll(selector) { return selector === "[aria-haspopup]" ? row.chips : []; },
      getBoundingClientRect() { return { top: row.top, height: row.height, bottom: row.top + row.height }; }
    };
    return row;
  }
  function makeChip(row) {
    return { parentElement: row };
  }
  function makeSeat(rows) {
    return {
      querySelectorAll(selector) {
        return selector === "[aria-haspopup]" ? rows.flatMap((row) => row.chips) : [];
      }
    };
  }
  function makeBar(top, seat) {
    const attrs = new Map();
    const styles = new Map();
    return {
      attrs,
      styles,
      style: {
        setProperty(name, value) { styles.set(name, value); },
        removeProperty(name) { styles.delete(name); }
      },
      firstElementChild: { getBoundingClientRect() { return { height: 16 }; } },
      closest(selector) { return selector === "[data-composer-seat]" ? seat : null; },
      getBoundingClientRect() { return { top }; },
      setAttribute(name, value) { attrs.set(name, value); },
      removeAttribute(name) { attrs.delete(name); },
      contains() { return false; }
    };
  }

  const statsRow = makeRow(990, 24);
  statsRow.chips.push(makeChip(statsRow));
  const statsBarElement = render(dock.component, { ctx, sessionId: "session-1" });
  const statsBar = makeBar(1030, makeSeat([statsRow]));
  statsBarElement.props.ref(statsBar);
  assert(!statsBar.attrs.has("data-hero"), "a one-chip row above the bar does not lift it");

  const heroRow = makeRow(990, 30);
  heroRow.chips.push(makeChip(heroRow), makeChip(heroRow));
  const heroBarElement = render(dock.component, { ctx, sessionId: "session-1" });
  const heroBar = makeBar(1030, makeSeat([heroRow]));
  heroBarElement.props.ref(heroBar);
  assert(heroBar.attrs.get("data-hero") === "true", "the two-chip workspace row lifts the band");
  assert(heroBar.styles.get("--pc-hero-lift") === "42px", "the measured lift is written to the bar: " + heroBar.styles.get("--pc-hero-lift"));
  assert(heroBar.styles.get("--pc-hero-row") === "30px", "the row height is written to the bar");
  assert(heroBarElement.props["data-hero-price"] === "true", "the hero band gets the second line for the price");
  const heroCss = styleTags.map((tag) => tag.textContent).join("\n");
  assert(heroCss.includes(".pc-bar[data-hero][data-hero-price]"), "hero price line styles are injected");
  assert(heroCss.includes("top:calc(var(--pc-hero-row,30px) + 6px)"), "hero price is placed under the chip row");

  // A Go model outside the catalog has no price: no second line is reserved.
  current.model = "unknown-go-model";
  const noPrice = render(dock.component, { ctx, sessionId: "session-1" });
  assert(noPrice.props["data-phase"] === "flat", "an unknown Go model is flat");
  assert(noPrice.props["data-hero-price"] === undefined, "no price line when the price label is empty");
} finally {
  Date.now = realNow;
}

console.log("\nall render checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


