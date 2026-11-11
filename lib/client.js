/**
 * dsh-peak-opencode — «OpenCode Go cost/peak».
 *
 * Полоса над полем ввода показывает, что сейчас действует у текущей модели:
 * пиковый тариф (светло-розовый), льготный (светло-зелёный) или единый
 * (синий — у модели нет никаких множителей). Слева — цена текущего тарифа за 1M
 * токенов (вход, выход, кэш, запись в кэш), справа — фаза, конец периода по
 * местному времени и остаток; заливка показывает оставшуюся часть периода.
 *
 * Какие модели есть и у каких бывают пиковые часы, решает каталог OpenCode Go:
 * хостовая половина (lib/index.js) забирает его при старте и отдаёт браузеру.
 * Фаза считается по окнам из каталога, а если каталога нет — по официальным
 * правилам DeepSeek: пекинское время (UTC+8), будни 09:00–12:00 и 14:00–18:00 —
 * пик, всё остальное (обед, ночь, выходные, праздники Китая) — льготный тариф.
 * Время показывается в часовом поясе системы.
 */
window.__ModuleLoader__.load({
	id: "dsh-peak-opencode",
	factory: (require) => {
		const react = require("react");
		const h = react.createElement;

		//#region Языки
		// Плагин всегда следует активному языку DSH: своего переключателя нет.
		const LOCALE_IDS = new Set(["en", "zh", "ja", "es", "fr", "de", "ru", "pt"]);
		const FALLBACK_LOCALE = "en";

		// Словари плоские: ключ → строка с подстановками `{name}`. Недостающий
		// ключ падает обратно на английский, а не на пустоту.
		const MESSAGES = {
			en: {
				"common.perM": "per 1M",
				"common.model": "model",
				"common.offline": "no connection",
				"common.lessThanMinute": "less than a minute",
				"common.lessThanDay": "less than a day",
				"common.localTime": "local time",
				"price.input": "input",
				"price.output": "output",
				"price.cache": "cache",
				"price.cacheWrite": "write",
				"price.free": "free",
				"bar.peak": "Peak tariff",
				"bar.valley": "Off-peak tariff",
				"bar.flat": "Flat tariff",
				"bar.free": "Free tariff",
				"bar.noPeak": "no peak hours",
				"bar.until": "until {value}",
				"bar.from": "from {value}",
				"hint.freePrice": "Free — all tokens cost nothing ($0 per 1M: input · output · cache).",
				"hint.price": "Price per 1M: {parts}.",
				"hint.noPrice": "No price in the catalog.",
				"hint.catalogError": "The OpenCode Go catalog did not load — the tariff is not tracked.",
				"hint.notInCatalog": "The model is not in the Go catalog — a neutral tariff is shown.",
				"hint.freeTitle": "{model}: free tariff, no peak or off-peak hours.",
				"hint.flatTitle": "{model}: no peak or off-peak hours, the price is constant.",
				"hint.freeBand": "Free tariff band.",
				"hint.flatBand": "Flat tariff band.",
				"hint.datedTitle": "{model}: ×{factor} multiplier from {day}, no hourly windows.",
				"hint.datedPeakPrice": "The peak price is active: {parts} per 1M.",
				"hint.datedValleyPrice": "The off-peak price is active: {parts} per 1M; from {day} — ×{factor}.",
				"hint.datedPeakEnded": "The off-peak period ended on {day}.",
				"hint.datedLeft": "{duration} left until {day}.",
				"hint.peakTitle": "{model} — {phase}.",
				"hint.peakWindow": "{phase}: until {until} your time ({beijing} Beijing), {left} left.",
				"hint.peakRules": "Peak: {windows} Beijing time, weekdays.",
				"hint.peakPrices": "Peak ×{factor}: {peak} per 1M; off-peak: {valley}.",
				"aria.flat": "{phase}, no peak hours",
				"aria.dated": "{phase}, {when}",
				"aria.peak": "{phase}, until {until}, {left} left",
				"settings.cssPlaceholder": "Empty — the base styles are used. Example in the guide below.",
				"settings.cssSaved": "CSS saved.",
				"settings.cssCleared": "Custom CSS cleared.",
				"settings.reset": "Reset",
				"settings.resetHint": "Restore the peak windows, behavior and custom CSS to their defaults.",
				"settings.resetButton": "Reset plugin settings",
				"settings.resetConfirm": "Yes, reset",
				"settings.resetCancel": "Cancel",
				"settings.resetDone": "Plugin settings reset.",
				"settings.catalog": "Model catalog",
				"settings.catalogLoading": "Loading the OpenCode Go catalog…",
				"settings.catalogError": "The catalog did not load: {error}.",
				"settings.catalogIdle": "The catalog is not loaded yet.",
				"settings.catalogSummary": "OpenCode Go: {count} models; with peak hours: {peaks}{names}{dated}. Updated {updated}.",
				"settings.catalogNames": " ({names})",
				"settings.catalogDated": "; with a date multiplier: {names}",
				"settings.datedName": "{name} since {day}",
				"settings.catalogWarn": "The catalog did not load: {error}. DeepSeek works by built-in rules; other Go models are shown as the blue “Flat tariff”.",
				"settings.refresh": "Refresh catalog",
				"settings.refreshing": "Refreshing…",
				"settings.catalogHint": "Models and multiplier rules are fetched from opencode.ai on DSH startup and cached. Models with a multiplier (peak hours or date) are green/pink, free ones are green “Free tariff”, without a multiplier — blue “Flat tariff”.",
				"settings.windows": "Peak windows",
				"settings.windowsHint": "Official windows come from the OpenCode Go catalog: for DeepSeek they are weekdays 09:00–12:00 and 14:00–18:00 Beijing time. The fields below override the windows for models with peak hours; other models have none.",
				"settings.windowsModels": "Models with peak hours in the catalog: {names}.",
				"settings.windowsNone": "The catalog has no models with peak hours yet.",
				"settings.nowBeijing": "Now {time} Beijing time",
				"settings.nowLocal": "{time} your time",
				"settings.windowsNote": "The band shows the period end in your time zone; the windows themselves stay Beijing — that is how DeepSeek defines them.",
				"settings.holidaysWarn": "Chinese holidays are known only for 2026: in other years only weekends are considered, so on holidays the band may treat a weekday as peak.",
				"settings.resetWindows": "Restore official windows",
				"settings.behavior": "Behavior",
				"settings.showOutside": "Show for models outside the Go catalog",
				"settings.behaviorHint": "All OpenCode Go models are shown automatically: with a multiplier — green/pink (DeepSeek by peak hours, Gemini 4 Argon by date), free — green “Free tariff”, without a multiplier — blue “Flat tariff”. The checkbox adds the blue band for models from other providers.",
				"settings.css": "Custom CSS",
				"settings.cssHint": "Added after the base styles, so overrides work without !important.",
				"settings.apply": "Apply",
				"settings.clear": "Clear",
				"settings.resetAll": "Reset all",
				"settings.guide": "Setup guide",
				"settings.guideHooks": "Available hooks:",
				"settings.guideExample": "Example:",
				"settings.guideOutline": "The composer outline takes the phase color: the plugin changes only --dsw-elevation-stroke-color through data-composer-card and does not touch hashed classes.",
				"settings.localTimes": "{start}–{end} your time",
				"settings.invalidTime": "set the time",
				"settings.timeStartAria": "Start of peak window {n} in Beijing time",
				"settings.timeEndAria": "End of peak window {n} in Beijing time",
				"guide.root": "band and composer outline colors: --pc-c-valley, --pc-c-peak, --pc-c-flat and --pc-c-free (free models)",
				"guide.bar": "the band itself: --pc-band visible height, --pc-tuck depth under the card, --pc-lift text raise",
				"guide.hero": "top corners on the first screen: --pc-hero-radius",
				"guide.heroPrice": "second band row with the price on the first screen: --pc-hero-price-line, offset and position",
				"guide.phase": "peak tariff only (off-peak — valley, flat — flat, free — free)",
				"guide.pct": "remaining period percentage; the plugin writes it into the band live",
				"guide.labels": "labels: phase, period end in your time, time left",
				"guide.price": "left price of the tariff; on the first screen — the band's second row under the chips, hidden on narrow windows"
			},
			ru: {
				"common.perM": "за 1M",
				"common.model": "модель",
				"common.offline": "нет связи",
				"common.lessThanMinute": "меньше минуты",
				"common.lessThanDay": "меньше дня",
				"common.localTime": "местное время",
				"price.input": "вход",
				"price.output": "выход",
				"price.cache": "кэш",
				"price.cacheWrite": "зап.",
				"price.free": "бесплатно",
				"bar.peak": "Пиковый тариф",
				"bar.valley": "Льготный тариф",
				"bar.flat": "Единый тариф",
				"bar.free": "Бесплатный тариф",
				"bar.noPeak": "без пиковых часов",
				"bar.until": "до {value}",
				"bar.from": "с {value}",
				"hint.freePrice": "Бесплатно — все токены без оплаты ($0 за 1M: вход · выход · кэш).",
				"hint.price": "Цена за 1M: {parts}.",
				"hint.noPrice": "Цены нет в каталоге.",
				"hint.catalogError": "Каталог OpenCode Go не загрузился — тариф не отслеживается.",
				"hint.notInCatalog": "Модели нет в каталоге Go — показан нейтральный тариф.",
				"hint.freeTitle": "{model}: бесплатный тариф, пиковых и льготных часов нет.",
				"hint.flatTitle": "{model}: пиковых и льготных часов нет, цена постоянная.",
				"hint.freeBand": "Полоса бесплатного тарифа.",
				"hint.flatBand": "Полоса единого тарифа.",
				"hint.datedTitle": "{model}: множитель ×{factor} с {day}, часовых окон нет.",
				"hint.datedPeakPrice": "Сейчас пиковая цена: {parts} за 1M.",
				"hint.datedValleyPrice": "Сейчас льготная цена: {parts} за 1M; с {day} — ×{factor}.",
				"hint.datedPeakEnded": "Льготный период закончился {day}.",
				"hint.datedLeft": "До {day} осталось {duration}.",
				"hint.peakTitle": "{model} — {phase}.",
				"hint.peakWindow": "{phase}: до {until} по вашему времени ({beijing} по Пекину), осталось {left}.",
				"hint.peakRules": "Пик: {windows} по Пекину, будни.",
				"hint.peakPrices": "Пик ×{factor}: {peak} за 1M; льготный: {valley}.",
				"aria.flat": "{phase}, пиковых часов нет",
				"aria.dated": "{phase}, {when}",
				"aria.peak": "{phase}, до {until}, осталось {left}",
				"settings.cssPlaceholder": "Пусто — используются базовые стили. Пример — ниже в справке.",
				"settings.cssSaved": "CSS сохранён.",
				"settings.cssCleared": "Свой CSS очищен.",
				"settings.reset": "Сброс",
				"settings.resetHint": "Вернуть пиковые окна, поведение и свой CSS к значениям по умолчанию.",
				"settings.resetButton": "Сбросить настройки плагина",
				"settings.resetConfirm": "Да, сбросить",
				"settings.resetCancel": "Отмена",
				"settings.resetDone": "Настройки плагина сброшены.",
				"settings.catalog": "Каталог моделей",
				"settings.catalogLoading": "Загружаю каталог OpenCode Go…",
				"settings.catalogError": "Каталог не загрузился: {error}.",
				"settings.catalogIdle": "Каталог ещё не загружен.",
				"settings.catalogSummary": "OpenCode Go: {count} моделей; с пиковыми часами: {peaks}{names}{dated}. Обновлён {updated}.",
				"settings.catalogNames": " ({names})",
				"settings.catalogDated": "; с множителем по дате: {names}",
				"settings.datedName": "{name} с {day}",
				"settings.catalogWarn": "Каталог не загрузился: {error}. DeepSeek работает по встроенным правилам, остальные модели Go показываются синим «Единый тариф».",
				"settings.refresh": "Обновить каталог",
				"settings.refreshing": "Обновляю…",
				"settings.catalogHint": "Модели и правила множителей подтягиваются с opencode.ai при запуске DSH и кэшируются. Модели с множителем (пиковые часы или дата) — зелёный/розовый, бесплатные — зелёный «Бесплатный тариф», без множителя — синий «Единый тариф».",
				"settings.windows": "Пиковые окна",
				"settings.windowsHint": "Официальные окна приходят из каталога OpenCode Go: для DeepSeek это будни 09:00–12:00 и 14:00–18:00 по Пекину. Поля ниже переопределяют окна для моделей с пиком; у остальных моделей пиковых часов нет.",
				"settings.windowsModels": "С пиковыми часами в каталоге: {names}.",
				"settings.windowsNone": "В каталоге пока нет моделей с пиковыми часами.",
				"settings.nowBeijing": "Сейчас {time} по Пекину",
				"settings.nowLocal": "{time} по вашему времени",
				"settings.windowsNote": "Полоса показывает конец периода в вашем часовом поясе; сами окна остаются пекинскими — так их задаёт DeepSeek.",
				"settings.holidaysWarn": "Праздники Китая известны только для 2026 года: в другие годы учитываются лишь выходные, поэтому в праздники полоса может считать рабочий день пиковым.",
				"settings.resetWindows": "Вернуть официальные окна",
				"settings.behavior": "Поведение",
				"settings.showOutside": "Показывать для моделей вне каталога Go",
				"settings.behaviorHint": "Все модели OpenCode Go показываются автоматически: с множителем — зелёный/розовый (DeepSeek по пиковым часам, Gemini 4 Argon по дате), бесплатные — зелёный «Бесплатный тариф», без множителя — синий «Единый тариф». Галочка добавляет синюю полосу и для моделей других провайдеров.",
				"settings.css": "Свой CSS",
				"settings.cssHint": "Добавляется после базовых стилей, поэтому переопределять можно без !important.",
				"settings.apply": "Применить",
				"settings.clear": "Очистить",
				"settings.resetAll": "Сбросить всё",
				"settings.guide": "Справка по настройке",
				"settings.guideHooks": "Доступные хуки:",
				"settings.guideExample": "Пример:",
				"settings.guideOutline": "Обводка поля ввода берёт цвет фазы: плагин через data-composer-card меняет только --dsw-elevation-stroke-color и не трогает классы с хешами.",
				"settings.localTimes": "{start}–{end} у вас",
				"settings.invalidTime": "укажите время",
				"settings.timeStartAria": "Начало пикового окна {n} по Пекину",
				"settings.timeEndAria": "Конец пикового окна {n} по Пекину",
				"guide.root": "цвета полосы и обводки поля ввода: --pc-c-valley, --pc-c-peak, --pc-c-flat и --pc-c-free (бесплатные модели)",
				"guide.bar": "сама полоса: --pc-band видимая высота, --pc-tuck глубина под карточкой, --pc-lift подъём текста",
				"guide.hero": "верхние углы на первом экране: --pc-hero-radius",
				"guide.heroPrice": "вторая строка полосы с ценой на первом экране: --pc-hero-price-line, отступ и положение",
				"guide.phase": "только пиковый тариф (льготный — valley, единый — flat, бесплатный — free)",
				"guide.pct": "процент оставшегося периода, плагин пишет его в полосу в реальном времени",
				"guide.labels": "подписи: фаза, конец периода по вашему времени, остаток",
				"guide.price": "левая цена тарифа; на первом экране — вторая строка полосы под чипами, на узких окнах скрыта"
			},
			zh: {
				"common.perM": "每 100 万 token",
				"common.model": "模型",
				"common.offline": "无连接",
				"common.lessThanMinute": "不到一分钟",
				"common.lessThanDay": "不到一天",
				"common.localTime": "本地时间",
				"price.input": "输入",
				"price.output": "输出",
				"price.cache": "缓存",
				"price.cacheWrite": "写入",
				"price.free": "免费",
				"bar.peak": "高峰费率",
				"bar.valley": "低谷费率",
				"bar.flat": "统一费率",
				"bar.free": "免费费率",
				"bar.noPeak": "无高峰时段",
				"bar.until": "至 {value}",
				"bar.from": "自 {value}",
				"hint.freePrice": "免费——所有 token 均不收费（每 100 万 token：输入 · 输出 · 缓存 $0）。",
				"hint.price": "每 100 万 token 价格：{parts}。",
				"hint.noPrice": "目录中没有价格。",
				"hint.catalogError": "OpenCode Go 目录未加载——不跟踪费率。",
				"hint.notInCatalog": "该模型不在 Go 目录中——显示中性费率。",
				"hint.freeTitle": "{model}：免费费率，无高峰和低谷时段。",
				"hint.flatTitle": "{model}：无高峰和低谷时段，价格固定。",
				"hint.freeBand": "免费费率条。",
				"hint.flatBand": "统一费率条。",
				"hint.datedTitle": "{model}：自 {day} 起 ×{factor} 倍率，无按小时时段。",
				"hint.datedPeakPrice": "当前为高峰价格：每 100 万 token {parts}。",
				"hint.datedValleyPrice": "当前为低谷价格：每 100 万 token {parts}；自 {day} 起 ×{factor}。",
				"hint.datedPeakEnded": "低谷期已于 {day} 结束。",
				"hint.datedLeft": "距 {day} 还有 {duration}。",
				"hint.peakTitle": "{model}——{phase}。",
				"hint.peakWindow": "{phase}：至本地时间 {until}（北京时间 {beijing}），还剩 {left}。",
				"hint.peakRules": "高峰：北京时间工作日 {windows}。",
				"hint.peakPrices": "高峰 ×{factor}：每 100 万 token {peak}；低谷：{valley}。",
				"aria.flat": "{phase}，无高峰时段",
				"aria.dated": "{phase}，{when}",
				"aria.peak": "{phase}，至 {until}，还剩 {left}",
				"settings.cssPlaceholder": "为空 — 使用基础样式。示例见下方指南。",
				"settings.cssSaved": "CSS 已保存。",
				"settings.cssCleared": "自定义 CSS 已清除。",
				"settings.reset": "重置",
				"settings.resetHint": "将高峰时段、行为和自定义 CSS 恢复为默认值。",
				"settings.resetButton": "重置插件设置",
				"settings.resetConfirm": "确认重置",
				"settings.resetCancel": "取消",
				"settings.resetDone": "插件设置已重置。",
				"settings.catalog": "模型目录",
				"settings.catalogLoading": "正在加载 OpenCode Go 目录…",
				"settings.catalogError": "目录未加载：{error}。",
				"settings.catalogIdle": "目录尚未加载。",
				"settings.catalogSummary": "OpenCode Go：{count} 个模型；有高峰时段：{peaks}{names}{dated}。更新于 {updated}。",
				"settings.catalogNames": "（{names}）",
				"settings.catalogDated": "；按日期倍率：{names}",
				"settings.datedName": "{name} 自 {day}",
				"settings.catalogWarn": "目录未加载：{error}。DeepSeek 使用内置规则，其他 Go 模型显示为蓝色“统一费率”。",
				"settings.refresh": "刷新目录",
				"settings.refreshing": "正在刷新…",
				"settings.catalogHint": "模型和倍率规则在 DSH 启动时从 opencode.ai 获取并缓存。有倍率的模型（高峰时段或日期）为绿色/粉色，免费为绿色“免费费率”，无倍率为蓝色“统一费率”。",
				"settings.windows": "高峰时段",
				"settings.windowsHint": "官方时段来自 OpenCode Go 目录：DeepSeek 为北京时间工作日 09:00–12:00 和 14:00–18:00。下方字段会覆盖有高峰模型时段；其他模型没有高峰时段。",
				"settings.windowsModels": "目录中有高峰时段的模型：{names}。",
				"settings.windowsNone": "目录中暂时没有高峰模型。",
				"settings.nowBeijing": "北京时间 {time}",
				"settings.nowLocal": "本地时间 {time}",
				"settings.windowsNote": "费率条按你的时区显示时段结束；时段本身仍按北京时间——DeepSeek 就是这样定义的。",
				"settings.holidaysWarn": "中国节假日仅覆盖 2026 年：其他年份只考虑周末，因此节假日可能被误判为高峰。",
				"settings.resetWindows": "恢复官方时段",
				"settings.behavior": "行为",
				"settings.showOutside": "对 Go 目录之外的模型也显示",
				"settings.behaviorHint": "所有 OpenCode Go 模型自动显示：有倍率——绿色/粉色（DeepSeek 按高峰时段，Gemini 4 Argon 按日期），免费——绿色“免费费率”，无倍率——蓝色“统一费率”。勾选后其他提供商的模型也显示蓝色费率条。",
				"settings.css": "自定义 CSS",
				"settings.cssHint": "添加在基础样式之后，因此无需 !important 即可覆盖。",
				"settings.apply": "应用",
				"settings.clear": "清除",
				"settings.resetAll": "全部重置",
				"settings.guide": "设置指南",
				"settings.guideHooks": "可用钩子：",
				"settings.guideExample": "示例：",
				"settings.guideOutline": "输入框描边采用费率颜色：插件只通过 data-composer-card 修改 --dsw-elevation-stroke-color，不改动带哈希的类名。",
				"settings.localTimes": "{start}–{end}（你的时间）",
				"settings.invalidTime": "请设置时间",
				"settings.timeStartAria": "第 {n} 个高峰时段的开始时间（北京时间）",
				"settings.timeEndAria": "第 {n} 个高峰时段的结束时间（北京时间）",
				"guide.root": "费率条和输入框描边颜色：--pc-c-valley、--pc-c-peak、--pc-c-flat 和 --pc-c-free（免费模型）",
				"guide.bar": "费率条本身：--pc-band 可见高度、--pc-tuck 卡片下方深度、--pc-lift 文本抬升",
				"guide.hero": "首屏顶部圆角：--pc-hero-radius",
				"guide.heroPrice": "首屏第二行价格：--pc-hero-price-line、偏移和位置",
				"guide.phase": "仅高峰费率（低谷——valley，统一——flat，免费——free）",
				"guide.pct": "剩余时段百分比，插件实时写入费率条",
				"guide.labels": "标签：费率、你的时区的时段结束、剩余时间",
				"guide.price": "左侧费率价格；首屏为费率条第二行（chip 下方），窄窗口隐藏"
			},
			ja: {
				"common.perM": "1M トークンあたり",
				"common.model": "モデル",
				"common.offline": "接続なし",
				"common.lessThanMinute": "1 分未満",
				"common.lessThanDay": "1 日未満",
				"common.localTime": "現地時間",
				"price.input": "入力",
				"price.output": "出力",
				"price.cache": "キャッシュ",
				"price.cacheWrite": "書込",
				"price.free": "無料",
				"bar.peak": "ピーク料金",
				"bar.valley": "オフピーク料金",
				"bar.flat": "一律料金",
				"bar.free": "無料料金",
				"bar.noPeak": "ピーク時間なし",
				"bar.until": "{value} まで",
				"bar.from": "{value} から",
				"hint.freePrice": "無料 — すべてのトークンに料金はかかりません（1M あたり $0：入力 · 出力 · キャッシュ）。",
				"hint.price": "1M あたりの価格：{parts}。",
				"hint.noPrice": "カタログに価格がありません。",
				"hint.catalogError": "OpenCode Go カタログが読み込まれず、料金を追跡できません。",
				"hint.notInCatalog": "Go カタログにないモデルのため、中立の料金を表示しています。",
				"hint.freeTitle": "{model}：無料料金。ピーク・オフピーク時間はありません。",
				"hint.flatTitle": "{model}：ピーク・オフピーク時間はなく、価格は固定です。",
				"hint.freeBand": "無料料金のバンドです。",
				"hint.flatBand": "一律料金のバンドです。",
				"hint.datedTitle": "{model}：{day} から ×{factor} 倍率、時間帯なし。",
				"hint.datedPeakPrice": "現在はピーク価格：1M あたり {parts}。",
				"hint.datedValleyPrice": "現在はオフピーク価格：1M あたり {parts}；{day} から ×{factor}。",
				"hint.datedPeakEnded": "オフピーク期間は {day} に終了しました。",
				"hint.datedLeft": "{day} まで {duration}。",
				"hint.peakTitle": "{model} — {phase}。",
				"hint.peakWindow": "{phase}：あなたの時間で {until} まで（北京時間 {beijing}）、残り {left}。",
				"hint.peakRules": "ピーク：北京時間の平日 {windows}。",
				"hint.peakPrices": "ピーク ×{factor}：1M あたり {peak}；オフピーク：{valley}。",
				"aria.flat": "{phase}、ピーク時間なし",
				"aria.dated": "{phase}、{when}",
				"aria.peak": "{phase}、{until} まで、残り {left}",
				"settings.cssPlaceholder": "空 — 基本スタイルが使われます。例は下のガイドにあります。",
				"settings.cssSaved": "CSS を保存しました。",
				"settings.cssCleared": "カスタム CSS を消去しました。",
				"settings.reset": "リセット",
				"settings.resetHint": "ピーク時間帯、動作、カスタム CSS を既定値に戻します。",
				"settings.resetButton": "プラグイン設定をリセット",
				"settings.resetConfirm": "リセットする",
				"settings.resetCancel": "キャンセル",
				"settings.resetDone": "プラグイン設定をリセットしました。",
				"settings.catalog": "モデルカタログ",
				"settings.catalogLoading": "OpenCode Go カタログを読み込み中…",
				"settings.catalogError": "カタログを読み込めませんでした：{error}。",
				"settings.catalogIdle": "カタログはまだ読み込まれていません。",
				"settings.catalogSummary": "OpenCode Go：{count} モデル；ピーク時間あり：{peaks}{names}{dated}。更新 {updated}。",
				"settings.catalogNames": "（{names}）",
				"settings.catalogDated": "；日付による倍率：{names}",
				"settings.datedName": "{name}（{day} から）",
				"settings.catalogWarn": "カタログを読み込めませんでした：{error}。DeepSeek は組み込みルールで動作し、他の Go モデルは青い「一律料金」で表示されます。",
				"settings.refresh": "カタログを更新",
				"settings.refreshing": "更新中…",
				"settings.catalogHint": "モデルと倍率ルールは DSH 起動時に opencode.ai から取得してキャッシュします。倍率あり（ピーク時間または日付）は緑/ピンク、無料は緑の「無料料金」、倍率なしは青の「一律料金」です。",
				"settings.windows": "ピーク時間帯",
				"settings.windowsHint": "公式の時間帯は OpenCode Go カタログから取得します。DeepSeek は北京時間の平日 09:00–12:00 と 14:00–18:00 です。下のフィールドはピークのあるモデルの時間帯を上書きします。他のモデルにピークはありません。",
				"settings.windowsModels": "カタログでピーク時間のあるモデル：{names}。",
				"settings.windowsNone": "カタログにピーク時間のあるモデルはまだありません。",
				"settings.nowBeijing": "北京時間 {time}",
				"settings.nowLocal": "あなたの時間 {time}",
				"settings.windowsNote": "バンドはあなたのタイムゾーンで期間終了を表示します。時間帯自体は北京時間のままです（DeepSeek の定義）。",
				"settings.holidaysWarn": "中国の祝日は 2026 年分のみです。他の年は週末のみ考慮するため、祝日がピークと判定されることがあります。",
				"settings.resetWindows": "公式の時間帯に戻す",
				"settings.behavior": "動作",
				"settings.showOutside": "Go カタログ外のモデルにも表示",
				"settings.behaviorHint": "OpenCode Go の全モデルは自動で表示されます。倍率ありは緑/ピンク（DeepSeek はピーク時間、Gemini 4 Argon は日付）、無料は緑の「無料料金」、倍率なしは青の「一律料金」。チェックすると他プロバイダーのモデルにも青いバンドを表示します。",
				"settings.css": "カスタム CSS",
				"settings.cssHint": "基本スタイルの後に追加されるため、!important なしで上書きできます。",
				"settings.apply": "適用",
				"settings.clear": "クリア",
				"settings.resetAll": "すべてリセット",
				"settings.guide": "設定ガイド",
				"settings.guideHooks": "利用できるフック：",
				"settings.guideExample": "例：",
				"settings.guideOutline": "入力欄の枠線はフェーズ色を使います。プラグインは data-composer-card 経由で --dsw-elevation-stroke-color だけを変更し、ハッシュ付きクラスには触れません。",
				"settings.localTimes": "{start}–{end}（あなたの時間）",
				"settings.invalidTime": "時刻を入力",
				"settings.timeStartAria": "{n} 番目のピーク開始（北京時間）",
				"settings.timeEndAria": "{n} 番目のピーク終了（北京時間）",
				"guide.root": "バンドと入力欄の枠線の色：--pc-c-valley、--pc-c-peak、--pc-c-flat、--pc-c-free（無料モデル）",
				"guide.bar": "バンド自体：--pc-band 表示高さ、--pc-tuck カード下の深さ、--pc-lift テキストの持ち上げ",
				"guide.hero": "最初の画面の上部角：--pc-hero-radius",
				"guide.heroPrice": "最初の画面の 2 行目の価格：--pc-hero-price-line、オフセットと位置",
				"guide.phase": "ピーク料金のみ（オフピーク — valley、一律 — flat、無料 — free）",
				"guide.pct": "残り期間の割合。プラグインがリアルタイムで書き込みます",
				"guide.labels": "ラベル：フェーズ、あなたの時間での期間終了、残り時間",
				"guide.price": "左側の料金価格。最初の画面ではチップ下の 2 行目、狭いウィンドウでは非表示"
			},
			es: {
				"common.perM": "por 1M",
				"common.model": "modelo",
				"common.offline": "sin conexión",
				"common.lessThanMinute": "menos de un minuto",
				"common.lessThanDay": "menos de un día",
				"common.localTime": "hora local",
				"price.input": "entrada",
				"price.output": "salida",
				"price.cache": "caché",
				"price.cacheWrite": "escritura",
				"price.free": "gratis",
				"bar.peak": "Tarifa pico",
				"bar.valley": "Tarifa valle",
				"bar.flat": "Tarifa única",
				"bar.free": "Tarifa gratuita",
				"bar.noPeak": "sin horas pico",
				"bar.until": "hasta {value}",
				"bar.from": "desde {value}",
				"hint.freePrice": "Gratis: todos los tokens sin coste ($0 por 1M: entrada · salida · caché).",
				"hint.price": "Precio por 1M: {parts}.",
				"hint.noPrice": "No hay precio en el catálogo.",
				"hint.catalogError": "El catálogo de OpenCode Go no se cargó; la tarifa no se sigue.",
				"hint.notInCatalog": "El modelo no está en el catálogo Go; se muestra una tarifa neutral.",
				"hint.freeTitle": "{model}: tarifa gratuita, sin horas pico ni valle.",
				"hint.flatTitle": "{model}: sin horas pico ni valle, el precio es constante.",
				"hint.freeBand": "Banda de tarifa gratuita.",
				"hint.flatBand": "Banda de tarifa única.",
				"hint.datedTitle": "{model}: multiplicador ×{factor} desde {day}, sin franjas horarias.",
				"hint.datedPeakPrice": "Ahora rige el precio pico: {parts} por 1M.",
				"hint.datedValleyPrice": "Ahora rige el precio valle: {parts} por 1M; desde {day} — ×{factor}.",
				"hint.datedPeakEnded": "El periodo valle terminó el {day}.",
				"hint.datedLeft": "Quedan {duration} hasta {day}.",
				"hint.peakTitle": "{model} — {phase}.",
				"hint.peakWindow": "{phase}: hasta {until} tu hora ({beijing} en Pekín), quedan {left}.",
				"hint.peakRules": "Pico: {windows} hora de Pekín, días laborables.",
				"hint.peakPrices": "Pico ×{factor}: {peak} por 1M; valle: {valley}.",
				"aria.flat": "{phase}, sin horas pico",
				"aria.dated": "{phase}, {when}",
				"aria.peak": "{phase}, hasta {until}, quedan {left}",
				"settings.cssPlaceholder": "Vacío: se usan los estilos base. Ejemplo en la guía de abajo.",
				"settings.cssSaved": "CSS guardado.",
				"settings.cssCleared": "CSS personalizado borrado.",
				"settings.reset": "Restablecer",
				"settings.resetHint": "Restaurar las horas pico, el comportamiento y el CSS personalizado a sus valores predeterminados.",
				"settings.resetButton": "Restablecer ajustes del plugin",
				"settings.resetConfirm": "Sí, restablecer",
				"settings.resetCancel": "Cancelar",
				"settings.resetDone": "Ajustes del plugin restablecidos.",
				"settings.catalog": "Catálogo de modelos",
				"settings.catalogLoading": "Cargando el catálogo de OpenCode Go…",
				"settings.catalogError": "El catálogo no se cargó: {error}.",
				"settings.catalogIdle": "El catálogo aún no está cargado.",
				"settings.catalogSummary": "OpenCode Go: {count} modelos; con horas pico: {peaks}{names}{dated}. Actualizado {updated}.",
				"settings.catalogNames": " ({names})",
				"settings.catalogDated": "; con multiplicador por fecha: {names}",
				"settings.datedName": "{name} desde {day}",
				"settings.catalogWarn": "El catálogo no se cargó: {error}. DeepSeek usa reglas integradas; los demás modelos Go se muestran con la «Tarifa única» azul.",
				"settings.refresh": "Actualizar catálogo",
				"settings.refreshing": "Actualizando…",
				"settings.catalogHint": "Los modelos y las reglas de multiplicador se obtienen de opencode.ai al iniciar DSH y se guardan en caché. Con multiplicador (horas pico o fecha) — verde/rosa; gratuitos — verde «Tarifa gratuita»; sin multiplicador — azul «Tarifa única».",
				"settings.windows": "Horas pico",
				"settings.windowsHint": "Las franjas oficiales vienen del catálogo de OpenCode Go: para DeepSeek son los días laborables 09:00–12:00 y 14:00–18:00 hora de Pekín. Los campos siguientes sustituyen las franjas de los modelos con pico; los demás no tienen.",
				"settings.windowsModels": "Modelos con horas pico en el catálogo: {names}.",
				"settings.windowsNone": "El catálogo aún no tiene modelos con horas pico.",
				"settings.nowBeijing": "Ahora {time} hora de Pekín",
				"settings.nowLocal": "{time} tu hora",
				"settings.windowsNote": "La banda muestra el fin del periodo en tu zona horaria; las franjas siguen siendo de Pekín: así las define DeepSeek.",
				"settings.holidaysWarn": "Los festivos chinos solo se conocen para 2026: en otros años solo se consideran los fines de semana, así que en festivos la banda puede tratar un día laborable como pico.",
				"settings.resetWindows": "Restaurar franjas oficiales",
				"settings.behavior": "Comportamiento",
				"settings.showOutside": "Mostrar para modelos fuera del catálogo Go",
				"settings.behaviorHint": "Todos los modelos de OpenCode Go se muestran automáticamente: con multiplicador — verde/rosa (DeepSeek por horas pico, Gemini 4 Argon por fecha); gratuitos — verde «Tarifa gratuita»; sin multiplicador — azul «Tarifa única». La casilla añade la banda azul también a modelos de otros proveedores.",
				"settings.css": "CSS propio",
				"settings.cssHint": "Se añade después de los estilos base, así que se puede sobrescribir sin !important.",
				"settings.apply": "Aplicar",
				"settings.clear": "Borrar",
				"settings.resetAll": "Restablecer todo",
				"settings.guide": "Guía de configuración",
				"settings.guideHooks": "Hooks disponibles:",
				"settings.guideExample": "Ejemplo:",
				"settings.guideOutline": "El borde del campo de entrada toma el color de la fase: el plugin cambia solo --dsw-elevation-stroke-color mediante data-composer-card y no toca las clases con hash.",
				"settings.localTimes": "{start}–{end} tu hora",
				"settings.invalidTime": "indica la hora",
				"settings.timeStartAria": "Inicio de la franja pico {n} en hora de Pekín",
				"settings.timeEndAria": "Fin de la franja pico {n} en hora de Pekín",
				"guide.root": "colores de la banda y del borde del campo: --pc-c-valley, --pc-c-peak, --pc-c-flat y --pc-c-free (modelos gratuitos)",
				"guide.bar": "la banda: --pc-band altura visible, --pc-tuck profundidad bajo la tarjeta, --pc-lift elevación del texto",
				"guide.hero": "esquinas superiores en la primera pantalla: --pc-hero-radius",
				"guide.heroPrice": "segunda fila de la banda con el precio en la primera pantalla: --pc-hero-price-line, desplazamiento y posición",
				"guide.phase": "solo tarifa pico (valle — valley, única — flat, gratuita — free)",
				"guide.pct": "porcentaje del periodo restante; el plugin lo escribe en la banda en tiempo real",
				"guide.labels": "etiquetas: fase, fin del periodo en tu hora, tiempo restante",
				"guide.price": "precio izquierdo de la tarifa; en la primera pantalla — segunda fila bajo los chips, oculto en ventanas estrechas"
			},
			fr: {
				"common.perM": "par 1M",
				"common.model": "modèle",
				"common.offline": "pas de connexion",
				"common.lessThanMinute": "moins d'une minute",
				"common.lessThanDay": "moins d'un jour",
				"common.localTime": "heure locale",
				"price.input": "entrée",
				"price.output": "sortie",
				"price.cache": "cache",
				"price.cacheWrite": "écriture",
				"price.free": "gratuit",
				"bar.peak": "Tarif pointe",
				"bar.valley": "Tarif creux",
				"bar.flat": "Tarif unique",
				"bar.free": "Tarif gratuit",
				"bar.noPeak": "sans heures de pointe",
				"bar.until": "jusqu'à {value}",
				"bar.from": "à partir du {value}",
				"hint.freePrice": "Gratuit — tous les tokens sont sans frais (0 $ par 1M : entrée · sortie · cache).",
				"hint.price": "Prix par 1M : {parts}.",
				"hint.noPrice": "Pas de prix dans le catalogue.",
				"hint.catalogError": "Le catalogue OpenCode Go n'a pas été chargé — le tarif n'est pas suivi.",
				"hint.notInCatalog": "Le modèle n'est pas dans le catalogue Go — un tarif neutre est affiché.",
				"hint.freeTitle": "{model} : tarif gratuit, sans heures de pointe ni creuses.",
				"hint.flatTitle": "{model} : sans heures de pointe ni creuses, le prix est constant.",
				"hint.freeBand": "Bande du tarif gratuit.",
				"hint.flatBand": "Bande du tarif unique.",
				"hint.datedTitle": "{model} : multiplicateur ×{factor} à partir du {day}, sans plages horaires.",
				"hint.datedPeakPrice": "Le prix de pointe est actif : {parts} par 1M.",
				"hint.datedValleyPrice": "Le prix creux est actif : {parts} par 1M ; à partir du {day} — ×{factor}.",
				"hint.datedPeakEnded": "La période creuse s'est terminée le {day}.",
				"hint.datedLeft": "{duration} avant le {day}.",
				"hint.peakTitle": "{model} — {phase}.",
				"hint.peakWindow": "{phase} : jusqu'à {until} votre heure ({beijing} à Pékin), reste {left}.",
				"hint.peakRules": "Pointe : {windows} heure de Pékin, jours ouvrés.",
				"hint.peakPrices": "Pointe ×{factor} : {peak} par 1M ; creux : {valley}.",
				"aria.flat": "{phase}, sans heures de pointe",
				"aria.dated": "{phase}, {when}",
				"aria.peak": "{phase}, jusqu'à {until}, reste {left}",
				"settings.cssPlaceholder": "Vide — les styles de base sont utilisés. Exemple dans le guide ci-dessous.",
				"settings.cssSaved": "CSS enregistré.",
				"settings.cssCleared": "CSS personnalisé effacé.",
				"settings.reset": "Réinitialiser",
				"settings.resetHint": "Rétablir les heures de pointe, le comportement et le CSS personnalisé à leurs valeurs par défaut.",
				"settings.resetButton": "Réinitialiser les réglages du plugin",
				"settings.resetConfirm": "Oui, réinitialiser",
				"settings.resetCancel": "Annuler",
				"settings.resetDone": "Réglages du plugin réinitialisés.",
				"settings.catalog": "Catalogue des modèles",
				"settings.catalogLoading": "Chargement du catalogue OpenCode Go…",
				"settings.catalogError": "Le catalogue n'a pas été chargé : {error}.",
				"settings.catalogIdle": "Le catalogue n'est pas encore chargé.",
				"settings.catalogSummary": "OpenCode Go : {count} modèles ; avec heures de pointe : {peaks}{names}{dated}. Mis à jour {updated}.",
				"settings.catalogNames": " ({names})",
				"settings.catalogDated": " ; avec multiplicateur par date : {names}",
				"settings.datedName": "{name} à partir du {day}",
				"settings.catalogWarn": "Le catalogue n'a pas été chargé : {error}. DeepSeek fonctionne selon les règles intégrées ; les autres modèles Go s'affichent en bleu « Tarif unique ».",
				"settings.refresh": "Actualiser le catalogue",
				"settings.refreshing": "Actualisation…",
				"settings.catalogHint": "Les modèles et les règles de multiplicateur sont récupérés sur opencode.ai au démarrage de DSH et mis en cache. Avec multiplicateur (heures de pointe ou date) — vert/rose ; gratuits — vert « Tarif gratuit » ; sans multiplicateur — bleu « Tarif unique ».",
				"settings.windows": "Heures de pointe",
				"settings.windowsHint": "Les plages officielles viennent du catalogue OpenCode Go : pour DeepSeek, ce sont les jours ouvrés 09:00–12:00 et 14:00–18:00 heure de Pékin. Les champs ci-dessous remplacent les plages des modèles avec pointe ; les autres n'en ont pas.",
				"settings.windowsModels": "Modèles avec heures de pointe dans le catalogue : {names}.",
				"settings.windowsNone": "Le catalogue n'a pas encore de modèles avec heures de pointe.",
				"settings.nowBeijing": "Maintenant {time} heure de Pékin",
				"settings.nowLocal": "{time} votre heure",
				"settings.windowsNote": "La bande affiche la fin de la période dans votre fuseau ; les plages restent celles de Pékin — c'est ainsi que DeepSeek les définit.",
				"settings.holidaysWarn": "Les jours fériés chinois ne sont connus que pour 2026 : les autres années, seuls les week-ends sont pris en compte ; un jour férié peut donc être vu comme une pointe.",
				"settings.resetWindows": "Rétablir les plages officielles",
				"settings.behavior": "Comportement",
				"settings.showOutside": "Afficher pour les modèles hors catalogue Go",
				"settings.behaviorHint": "Tous les modèles OpenCode Go s'affichent automatiquement : avec multiplicateur — vert/rose (DeepSeek selon les heures de pointe, Gemini 4 Argon selon la date) ; gratuits — vert « Tarif gratuit » ; sans multiplicateur — bleu « Tarif unique ». La case ajoute la bande bleue aux modèles d'autres fournisseurs.",
				"settings.css": "CSS personnalisé",
				"settings.cssHint": "Ajouté après les styles de base, donc les remplacements fonctionnent sans !important.",
				"settings.apply": "Appliquer",
				"settings.clear": "Effacer",
				"settings.resetAll": "Tout réinitialiser",
				"settings.guide": "Guide de configuration",
				"settings.guideHooks": "Hooks disponibles :",
				"settings.guideExample": "Exemple :",
				"settings.guideOutline": "Le contour du champ de saisie prend la couleur de la phase : le plugin ne change que --dsw-elevation-stroke-color via data-composer-card et ne touche pas aux classes hachées.",
				"settings.localTimes": "{start}–{end} votre heure",
				"settings.invalidTime": "indiquez l'heure",
				"settings.timeStartAria": "Début de la plage de pointe {n} heure de Pékin",
				"settings.timeEndAria": "Fin de la plage de pointe {n} heure de Pékin",
				"guide.root": "couleurs de la bande et du contour du champ : --pc-c-valley, --pc-c-peak, --pc-c-flat et --pc-c-free (modèles gratuits)",
				"guide.bar": "la bande elle-même : --pc-band hauteur visible, --pc-tuck profondeur sous la carte, --pc-lift élévation du texte",
				"guide.hero": "coins supérieurs du premier écran : --pc-hero-radius",
				"guide.heroPrice": "deuxième ligne de la bande avec le prix sur le premier écran : --pc-hero-price-line, décalage et position",
				"guide.phase": "tarif de pointe uniquement (creux — valley, unique — flat, gratuit — free)",
				"guide.pct": "pourcentage de la période restante ; le plugin l'écrit dans la bande en direct",
				"guide.labels": "libellés : phase, fin de la période à votre heure, temps restant",
				"guide.price": "prix à gauche du tarif ; sur le premier écran — deuxième ligne sous les puces, masqué sur les fenêtres étroites"
			},
			de: {
				"common.perM": "pro 1M",
				"common.model": "Modell",
				"common.offline": "keine Verbindung",
				"common.lessThanMinute": "weniger als eine Minute",
				"common.lessThanDay": "weniger als ein Tag",
				"common.localTime": "Ortszeit",
				"price.input": "Eingabe",
				"price.output": "Ausgabe",
				"price.cache": "Cache",
				"price.cacheWrite": "Schreiben",
				"price.free": "kostenlos",
				"bar.peak": "Spitzen-Tarif",
				"bar.valley": "Nebenzeit-Tarif",
				"bar.flat": "Einheitstarif",
				"bar.free": "Kostenloser Tarif",
				"bar.noPeak": "keine Stoßzeiten",
				"bar.until": "bis {value}",
				"bar.from": "ab {value}",
				"hint.freePrice": "Kostenlos — alle Tokens ohne Gebühr ($0 pro 1M: Eingabe · Ausgabe · Cache).",
				"hint.price": "Preis pro 1M: {parts}.",
				"hint.noPrice": "Kein Preis im Katalog.",
				"hint.catalogError": "Der OpenCode-Go-Katalog wurde nicht geladen — der Tarif wird nicht verfolgt.",
				"hint.notInCatalog": "Das Modell ist nicht im Go-Katalog — ein neutraler Tarif wird angezeigt.",
				"hint.freeTitle": "{model}: kostenloser Tarif, keine Spitzen- oder Nebenzeit.",
				"hint.flatTitle": "{model}: keine Spitzen- oder Nebenzeit, der Preis ist konstant.",
				"hint.freeBand": "Band des kostenlosen Tarifs.",
				"hint.flatBand": "Band des Einheitstarifs.",
				"hint.datedTitle": "{model}: ×{factor}-Multiplikator ab {day}, keine Zeitfenster.",
				"hint.datedPeakPrice": "Jetzt gilt der Spitzenpreis: {parts} pro 1M.",
				"hint.datedValleyPrice": "Jetzt gilt der Nebenzeitpreis: {parts} pro 1M; ab {day} — ×{factor}.",
				"hint.datedPeakEnded": "Der Nebenzeitraum endete am {day}.",
				"hint.datedLeft": "Noch {duration} bis {day}.",
				"hint.peakTitle": "{model} — {phase}.",
				"hint.peakWindow": "{phase}: bis {until} deiner Zeit ({beijing} in Peking), noch {left}.",
				"hint.peakRules": "Spitze: {windows} Pekinger Zeit, Werktage.",
				"hint.peakPrices": "Spitze ×{factor}: {peak} pro 1M; Nebenzeit: {valley}.",
				"aria.flat": "{phase}, keine Stoßzeiten",
				"aria.dated": "{phase}, {when}",
				"aria.peak": "{phase}, bis {until}, noch {left}",
				"settings.cssPlaceholder": "Leer — es gelten die Basisstile. Beispiel im Leitfaden unten.",
				"settings.cssSaved": "CSS gespeichert.",
				"settings.cssCleared": "Eigenes CSS geleert.",
				"settings.reset": "Zurücksetzen",
				"settings.resetHint": "Stoßzeiten, Verhalten und eigenes CSS auf die Standardwerte zurücksetzen.",
				"settings.resetButton": "Plugin-Einstellungen zurücksetzen",
				"settings.resetConfirm": "Ja, zurücksetzen",
				"settings.resetCancel": "Abbrechen",
				"settings.resetDone": "Plugin-Einstellungen zurückgesetzt.",
				"settings.catalog": "Modellkatalog",
				"settings.catalogLoading": "OpenCode-Go-Katalog wird geladen…",
				"settings.catalogError": "Der Katalog wurde nicht geladen: {error}.",
				"settings.catalogIdle": "Der Katalog ist noch nicht geladen.",
				"settings.catalogSummary": "OpenCode Go: {count} Modelle; mit Stoßzeiten: {peaks}{names}{dated}. Aktualisiert {updated}.",
				"settings.catalogNames": " ({names})",
				"settings.catalogDated": "; mit Datums-Multiplikator: {names}",
				"settings.datedName": "{name} ab {day}",
				"settings.catalogWarn": "Der Katalog wurde nicht geladen: {error}. DeepSeek arbeitet nach eingebauten Regeln; andere Go-Modelle werden blau als „Einheitstarif“ angezeigt.",
				"settings.refresh": "Katalog aktualisieren",
				"settings.refreshing": "Aktualisiere…",
				"settings.catalogHint": "Modelle und Multiplikatorregeln werden beim DSH-Start von opencode.ai geladen und zwischengespeichert. Mit Multiplikator (Stoßzeit oder Datum) — grün/rosa; kostenlos — grün „Kostenloser Tarif“; ohne Multiplikator — blau „Einheitstarif“.",
				"settings.windows": "Stoßzeiten",
				"settings.windowsHint": "Offizielle Fenster kommen aus dem OpenCode-Go-Katalog: für DeepSeek sind es Werktage 09:00–12:00 und 14:00–18:00 Pekinger Zeit. Die Felder unten überschreiben die Fenster für Modelle mit Spitze; andere haben keine.",
				"settings.windowsModels": "Modelle mit Stoßzeiten im Katalog: {names}.",
				"settings.windowsNone": "Der Katalog enthält noch keine Modelle mit Stoßzeiten.",
				"settings.nowBeijing": "Jetzt {time} Pekinger Zeit",
				"settings.nowLocal": "{time} deiner Zeit",
				"settings.windowsNote": "Das Band zeigt das Periodenende in deiner Zeitzone; die Fenster bleiben Pekinger Zeit — so definiert DeepSeek sie.",
				"settings.holidaysWarn": "Chinesische Feiertage sind nur für 2026 bekannt: in anderen Jahren zählen nur Wochenenden, daher kann das Band an Feiertagen einen Werktag als Spitze werten.",
				"settings.resetWindows": "Offizielle Fenster wiederherstellen",
				"settings.behavior": "Verhalten",
				"settings.showOutside": "Für Modelle außerhalb des Go-Katalogs anzeigen",
				"settings.behaviorHint": "Alle OpenCode-Go-Modelle werden automatisch angezeigt: mit Multiplikator — grün/rosa (DeepSeek nach Stoßzeiten, Gemini 4 Argon nach Datum); kostenlos — grün „Kostenloser Tarif“; ohne Multiplikator — blau „Einheitstarif“. Die Checkbox ergänzt das blaue Band für Modelle anderer Anbieter.",
				"settings.css": "Eigenes CSS",
				"settings.cssHint": "Wird nach den Basisstilen eingefügt, daher sind Überschreibungen ohne !important möglich.",
				"settings.apply": "Anwenden",
				"settings.clear": "Leeren",
				"settings.resetAll": "Alles zurücksetzen",
				"settings.guide": "Einrichtungsleitfaden",
				"settings.guideHooks": "Verfügbare Hooks:",
				"settings.guideExample": "Beispiel:",
				"settings.guideOutline": "Der Rahmen des Eingabefelds übernimmt die Phasenfarbe: das Plugin ändert über data-composer-card nur --dsw-elevation-stroke-color und fasst gehashte Klassen nicht an.",
				"settings.localTimes": "{start}–{end} deiner Zeit",
				"settings.invalidTime": "Zeit angeben",
				"settings.timeStartAria": "Beginn des Stoßzeitfensters {n} Pekinger Zeit",
				"settings.timeEndAria": "Ende des Stoßzeitfensters {n} Pekinger Zeit",
				"guide.root": "Farben von Band und Eingabefeldrahmen: --pc-c-valley, --pc-c-peak, --pc-c-flat und --pc-c-free (kostenlose Modelle)",
				"guide.bar": "das Band selbst: --pc-band sichtbare Höhe, --pc-tuck Tiefe unter der Karte, --pc-lift Textanhebung",
				"guide.hero": "obere Ecken auf dem ersten Bildschirm: --pc-hero-radius",
				"guide.heroPrice": "zweite Bandzeile mit dem Preis auf dem ersten Bildschirm: --pc-hero-price-line, Versatz und Position",
				"guide.phase": "nur Spitzen-Tarif (Nebenzeit — valley, einheitlich — flat, kostenlos — free)",
				"guide.pct": "Prozent der verbleibenden Periode; das Plugin schreibt ihn live ins Band",
				"guide.labels": "Beschriftungen: Phase, Periodenende in deiner Zeit, Restzeit",
				"guide.price": "linker Preis des Tarifs; auf dem ersten Bildschirm — zweite Zeile unter den Chips, auf schmalen Fenstern ausgeblendet"
			},
			pt: {
				"common.perM": "por 1M",
				"common.model": "modelo",
				"common.offline": "sem conexão",
				"common.lessThanMinute": "menos de um minuto",
				"common.lessThanDay": "menos de um dia",
				"common.localTime": "hora local",
				"price.input": "entrada",
				"price.output": "saída",
				"price.cache": "cache",
				"price.cacheWrite": "gravação",
				"price.free": "grátis",
				"bar.peak": "Tarifa de pico",
				"bar.valley": "Tarifa fora de pico",
				"bar.flat": "Tarifa única",
				"bar.free": "Tarifa gratuita",
				"bar.noPeak": "sem horários de pico",
				"bar.until": "até {value}",
				"bar.from": "a partir de {value}",
				"hint.freePrice": "Grátis — todos os tokens sem custo ($0 por 1M: entrada · saída · cache).",
				"hint.price": "Preço por 1M: {parts}.",
				"hint.noPrice": "Não há preço no catálogo.",
				"hint.catalogError": "O catálogo do OpenCode Go não carregou — a tarifa não é acompanhada.",
				"hint.notInCatalog": "O modelo não está no catálogo Go — uma tarifa neutra é exibida.",
				"hint.freeTitle": "{model}: tarifa gratuita, sem horários de pico ou fora de pico.",
				"hint.flatTitle": "{model}: sem horários de pico ou fora de pico, o preço é constante.",
				"hint.freeBand": "Faixa da tarifa gratuita.",
				"hint.flatBand": "Faixa da tarifa única.",
				"hint.datedTitle": "{model}: multiplicador ×{factor} a partir de {day}, sem janelas horárias.",
				"hint.datedPeakPrice": "Agora vale o preço de pico: {parts} por 1M.",
				"hint.datedValleyPrice": "Agora vale o preço fora de pico: {parts} por 1M; a partir de {day} — ×{factor}.",
				"hint.datedPeakEnded": "O período fora de pico terminou em {day}.",
				"hint.datedLeft": "Faltam {duration} até {day}.",
				"hint.peakTitle": "{model} — {phase}.",
				"hint.peakWindow": "{phase}: até {until} na sua hora ({beijing} em Pequim), faltam {left}.",
				"hint.peakRules": "Pico: {windows} hora de Pequim, dias úteis.",
				"hint.peakPrices": "Pico ×{factor}: {peak} por 1M; fora de pico: {valley}.",
				"aria.flat": "{phase}, sem horários de pico",
				"aria.dated": "{phase}, {when}",
				"aria.peak": "{phase}, até {until}, faltam {left}",
				"settings.cssPlaceholder": "Vazio — os estilos base são usados. Exemplo no guia abaixo.",
				"settings.cssSaved": "CSS salvo.",
				"settings.cssCleared": "CSS personalizado removido.",
				"settings.reset": "Redefinir",
				"settings.resetHint": "Restaurar os horários de pico, o comportamento e o CSS personalizado para os padrões.",
				"settings.resetButton": "Redefinir configurações do plug-in",
				"settings.resetConfirm": "Sim, redefinir",
				"settings.resetCancel": "Cancelar",
				"settings.resetDone": "Configurações do plug-in redefinidas.",
				"settings.catalog": "Catálogo de modelos",
				"settings.catalogLoading": "Carregando o catálogo do OpenCode Go…",
				"settings.catalogError": "O catálogo não carregou: {error}.",
				"settings.catalogIdle": "O catálogo ainda não foi carregado.",
				"settings.catalogSummary": "OpenCode Go: {count} modelos; com horários de pico: {peaks}{names}{dated}. Atualizado {updated}.",
				"settings.catalogNames": " ({names})",
				"settings.catalogDated": "; com multiplicador por data: {names}",
				"settings.datedName": "{name} desde {day}",
				"settings.catalogWarn": "O catálogo não carregou: {error}. O DeepSeek usa regras internas; os demais modelos Go aparecem em azul como «Tarifa única».",
				"settings.refresh": "Atualizar catálogo",
				"settings.refreshing": "Atualizando…",
				"settings.catalogHint": "Modelos e regras de multiplicador são obtidos de opencode.ai na inicialização do DSH e armazenados em cache. Com multiplicador (horários de pico ou data) — verde/rosa; grátis — verde «Tarifa gratuita»; sem multiplicador — azul «Tarifa única».",
				"settings.windows": "Horários de pico",
				"settings.windowsHint": "As janelas oficiais vêm do catálogo do OpenCode Go: para o DeepSeek são dias úteis 09:00–12:00 e 14:00–18:00 no horário de Pequim. Os campos abaixo substituem as janelas dos modelos com pico; os demais não têm.",
				"settings.windowsModels": "Modelos com horários de pico no catálogo: {names}.",
				"settings.windowsNone": "O catálogo ainda não tem modelos com horários de pico.",
				"settings.nowBeijing": "Agora {time} horário de Pequim",
				"settings.nowLocal": "{time} na sua hora",
				"settings.windowsNote": "A faixa mostra o fim do período no seu fuso; as janelas continuam no horário de Pequim — é assim que o DeepSeek as define.",
				"settings.holidaysWarn": "Os feriados chineses são conhecidos apenas para 2026: em outros anos só os fins de semana são considerados, então em feriados a faixa pode tratar um dia útil como pico.",
				"settings.resetWindows": "Restaurar janelas oficiais",
				"settings.behavior": "Comportamento",
				"settings.showOutside": "Mostrar para modelos fora do catálogo Go",
				"settings.behaviorHint": "Todos os modelos do OpenCode Go aparecem automaticamente: com multiplicador — verde/rosa (DeepSeek por horários de pico, Gemini 4 Argon por data); grátis — verde «Tarifa gratuita»; sem multiplicador — azul «Tarifa única». A caixa adiciona a faixa azul também a modelos de outros provedores.",
				"settings.css": "CSS próprio",
				"settings.cssHint": "Adicionado após os estilos base, então dá para substituir sem !important.",
				"settings.apply": "Aplicar",
				"settings.clear": "Limpar",
				"settings.resetAll": "Redefinir tudo",
				"settings.guide": "Guia de configuração",
				"settings.guideHooks": "Hooks disponíveis:",
				"settings.guideExample": "Exemplo:",
				"settings.guideOutline": "A borda do campo de entrada assume a cor da fase: o plugin altera apenas --dsw-elevation-stroke-color via data-composer-card e não toca nas classes com hash.",
				"settings.localTimes": "{start}–{end} na sua hora",
				"settings.invalidTime": "informe a hora",
				"settings.timeStartAria": "Início da janela de pico {n} no horário de Pequim",
				"settings.timeEndAria": "Fim da janela de pico {n} no horário de Pequim",
				"guide.root": "cores da faixa e da borda do campo: --pc-c-valley, --pc-c-peak, --pc-c-flat e --pc-c-free (modelos gratuitos)",
				"guide.bar": "a própria faixa: --pc-band altura visível, --pc-tuck profundidade sob o cartão, --pc-lift elevação do texto",
				"guide.hero": "cantos superiores na primeira tela: --pc-hero-radius",
				"guide.heroPrice": "segunda linha da faixa com o preço na primeira tela: --pc-hero-price-line, deslocamento e posição",
				"guide.phase": "apenas tarifa de pico (fora de pico — valley, única — flat, gratuita — free)",
				"guide.pct": "percentual do período restante; o plugin grava na faixa em tempo real",
				"guide.labels": "rótulos: fase, fim do período na sua hora, tempo restante",
				"guide.price": "preço à esquerda da tarifa; na primeira tela — segunda linha sob os chips, oculto em janelas estreitas"
			}
		};

		function normalizeLocaleId(value) {
			const id = String(value === undefined || value === null ? "" : value).toLowerCase().split(/[-_]/)[0];
			return LOCALE_IDS.has(id) ? id : FALLBACK_LOCALE;
		}

		// Текущий язык DSH. Сначала берём сервис `locale` (он приходит из
		// dsh-client-locale), а если его ещё нет — язык документа/браузера:
		// DSH синхронизирует <html lang> при смене языка.
		const localeStore = (() => {
			let active = detect();
			let serviceBound = false;
			let observerBound = false;
			const listeners = new Set();
			function detect() {
				try {
					if (typeof document !== "undefined" && document.documentElement && document.documentElement.lang) {
						return normalizeLocaleId(document.documentElement.lang);
					}
					if (typeof navigator !== "undefined" && Array.isArray(navigator.languages)) {
						for (const language of navigator.languages) {
							const id = String(language).toLowerCase().split(/[-_]/)[0];
							if (LOCALE_IDS.has(id)) return id;
						}
					}
				} catch (_) {}
				return FALLBACK_LOCALE;
			}
			function publish(value) {
				const id = normalizeLocaleId(value);
				if (id === active) return;
				active = id;
				for (const listener of listeners) listener();
			}
			function bind(ctx) {
				if (!serviceBound && ctx !== null && ctx !== undefined && typeof ctx.get === "function") {
					let service = null;
					try {
						service = ctx.get("locale");
					} catch (_) {}
					if (service !== null && service !== undefined && typeof service.getSnapshot === "function" && typeof service.subscribe === "function") {
						serviceBound = true;
						const read = () => {
							try {
								const snapshot = service.getSnapshot();
								if (snapshot !== null && snapshot !== undefined && typeof snapshot.active === "string") publish(snapshot.active);
							} catch (_) {}
						};
						try {
							service.subscribe(read);
						} catch (_) {}
						read();
					}
				}
				if (!observerBound && typeof MutationObserver !== "undefined" && typeof document !== "undefined" && document.documentElement) {
					observerBound = true;
					try {
						const observer = new MutationObserver(() => publish(detect()));
						observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
					} catch (_) {}
				}
			}
			return {
				bind,
				get() {
					return active;
				},
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				}
			};
		})();

		function makeTranslator(locale) {
			const dictionary = MESSAGES[locale] || MESSAGES[FALLBACK_LOCALE];
			const fallback = MESSAGES[FALLBACK_LOCALE];
			return (key, params) => {
				const template = dictionary[key] !== undefined ? dictionary[key] : fallback[key] !== undefined ? fallback[key] : key;
				if (params === undefined || params === null) return template;
				return template.replace(/\{(\w+)\}/g, (match, name) => (params[name] === undefined || params[name] === null ? match : String(params[name])));
			};
		}

		function resolveLocale(dshLocale) {
			return LOCALE_IDS.has(dshLocale) ? dshLocale : FALLBACK_LOCALE;
		}

		let pluginCtx = null;

		function useDshLocale() {
			localeStore.bind(pluginCtx);
			return react.useSyncExternalStore(localeStore.subscribe, localeStore.get, localeStore.get);
		}

		function useTranslator() {
			const dshLocale = useDshLocale();
			const locale = resolveLocale(dshLocale);
			return { locale, t: makeTranslator(locale) };
		}
		//#endregion

		//#region Праздники Китая
		// Только нерабочие дни. Перенесённые рабочие субботы/воскресенья сюда не
		// попадают: DeepSeek смотрит на «будни / выходные / праздники», а не на
		// китайский календарь переносов, поэтому рабочая суббота всё равно льготная.
		const HOLIDAYS = new Set([
			"2026-01-01", "2026-01-02", "2026-01-03",
			"2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19",
			"2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",
			"2026-04-04", "2026-04-05", "2026-04-06",
			"2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
			"2026-06-19", "2026-06-20", "2026-06-21",
			"2026-09-25", "2026-09-26", "2026-09-27",
			"2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05",
			"2026-10-06", "2026-10-07"
		]);
		const KNOWN_YEARS = new Set([2026]);
		//#endregion

		//#region Время и фазы
		// Пекинское время — неизменный UTC+8 без перехода на летнее время, поэтому
		// смещение прибавляем к метке и читаем UTC-поля: так результат не зависит
		// от локали и часового пояса машины.
		const CN_OFFSET = 8 * 60 * 60 * 1000;
		const MINUTE = 60 * 1000;
		const DAY = 24 * 60 * MINUTE;
		// Самая длинная непрерывная фаза — праздники вместе с выходными по краям
		// (до двух недель), поэтому скан назад/вперёд чуть больше этого срока.
		const MAX_RUN = 14 * DAY;
		const OFFICIAL_WINDOWS = [["09:00", "12:00"], ["14:00", "18:00"]];
		const WEEKDAYS = new Set([1, 2, 3, 4, 5]);

		function pad2(value) {
			return value < 10 ? "0" + value : "" + value;
		}

		function beijingParts(ms) {
			const t = new Date(ms + CN_OFFSET);
			return {
				year: t.getUTCFullYear(),
				month: t.getUTCMonth() + 1,
				day: t.getUTCDate(),
				weekday: t.getUTCDay(),
				hours: t.getUTCHours(),
				minutes: t.getUTCMinutes()
			};
		}

		function isoDay(parts) {
			return parts.year + "-" + pad2(parts.month) + "-" + pad2(parts.day);
		}

		function isRestDay(parts, rule) {
			if (!rule.days.has(parts.weekday)) return true;
			return rule.holidays && HOLIDAYS.has(isoDay(parts));
		}

		function inWindow(minutes, windows) {
			for (const range of windows) {
				if (minutes >= range[0] && minutes < range[1]) return true;
			}
			return false;
		}

		// Пик — окна в рабочие дни модели. Для DeepSeek это два окна по Пекину;
		// остальные модели из каталога Go пиковых часов не имеют.
		function phaseAt(ms, rule) {
			const p = beijingParts(ms);
			if (isRestDay(p, rule)) return "valley";
			return inWindow(p.hours * 60 + p.minutes, rule.windows) ? "peak" : "valley";
		}

		// Фаза меняется только на границе минуты, поэтому достаточно найти границы
		// текущей серии минутным шагом и запомнить их до конца серии.
		let cachedRun = null;

		function runAt(now, rule, signature) {
			const hit = cachedRun;
			if (hit !== null && hit.signature === signature && now >= hit.start && now < hit.end) return hit;
			const base = Math.floor(now / MINUTE) * MINUTE;
			const phase = phaseAt(base, rule);
			let start = base;
			while (start - MINUTE > now - MAX_RUN && phaseAt(start - MINUTE, rule) === phase) start -= MINUTE;
			let end = base;
			while (end + MINUTE < now + MAX_RUN && phaseAt(end + MINUTE, rule) === phase) end += MINUTE;
			const run = { phase, start, end: end + MINUTE, signature };
			cachedRun = run;
			return run;
		}

		function ruleSignature(rule) {
			const days = Array.from(rule.days).sort().join(",");
			const windows = rule.windows.map((range) => range[0] + "-" + range[1]).join(",");
			return days + "|" + windows + "|" + (rule.holidays ? "holidays" : "plain");
		}

		function parseHM(value) {
			const match = /^(\d{1,2}):(\d{2})$/.exec(String(value === undefined || value === null ? "" : value).trim());
			if (match === null) return null;
			const hours = Number(match[1]);
			const minutes = Number(match[2]);
			if (hours > 23 || minutes > 59) return null;
			return hours * 60 + minutes;
		}

		function hmText(minutes) {
			return pad2(Math.floor(minutes / 60)) + ":" + pad2(minutes % 60);
		}

		// Настройки хранят строки "HH:MM". Невалидные строки пропускаем; если не
		// осталось ни одного окна, возвращаем официальное расписание, чтобы
		// случайная опечатка не превратила полосу в «вечный льготный тариф».
		function windowsOf(settings) {
			const rows = Array.isArray(settings.windows) ? settings.windows : [];
			const windows = [];
			for (const row of rows) {
				if (!Array.isArray(row) || row.length < 2) continue;
				const start = parseHM(row[0]);
				const end = parseHM(row[1]);
				if (start === null || end === null || start >= end) continue;
				windows.push([start, end]);
			}
			if (windows.length === 0) {
				return OFFICIAL_WINDOWS.map((row) => [parseHM(row[0]), parseHM(row[1])]);
			}
			return windows.sort((a, b) => a[0] - b[0]);
		}

		function windowsText(windows) {
			return windows.map((range) => hmText(range[0]) + "–" + hmText(range[1])).join(", ");
		}

		function isOfficialWindows(rows) {
			if (!Array.isArray(rows) || rows.length !== OFFICIAL_WINDOWS.length) return false;
			for (let index = 0; index < OFFICIAL_WINDOWS.length; index += 1) {
				const row = rows[index];
				if (!Array.isArray(row) || row[0] !== OFFICIAL_WINDOWS[index][0] || row[1] !== OFFICIAL_WINDOWS[index][1]) return false;
			}
			return true;
		}

		function unitText(locale, value, unit, display) {
			try {
				return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: display }).format(value);
			} catch (_) {
				return value + " " + unit;
			}
		}

		function durationLong(ms, t, locale) {
			const total = Math.max(0, Math.round(ms / MINUTE));
			const days = Math.floor(total / 1440);
			const hours = Math.floor((total % 1440) / 60);
			const minutes = total % 60;
			const parts = [];
			if (days > 0) parts.push(unitText(locale, days, "day", "long"));
			if (hours > 0) parts.push(unitText(locale, hours, "hour", "long"));
			if (minutes > 0) parts.push(unitText(locale, minutes, "minute", "long"));
			return parts.length > 0 ? parts.join(" ") : t("common.lessThanMinute");
		}

		function durationShort(ms, t, locale) {
			const total = Math.max(0, Math.round(ms / MINUTE));
			const days = Math.floor(total / 1440);
			const hours = Math.floor((total % 1440) / 60);
			const minutes = total % 60;
			const parts = [];
			if (days > 0) parts.push(unitText(locale, days, "day", "short"));
			if (hours > 0) parts.push(unitText(locale, hours, "hour", "short"));
			if (minutes > 0) parts.push(unitText(locale, minutes, "minute", "short"));
			return parts.length > 0 ? parts.join(" ") : t("common.lessThanMinute");
		}

		// Для множителя по дате остаток удобнее в днях: «20 дней», а не «20 дн 4 ч».
		function durationDays(ms, t, locale) {
			const days = Math.max(0, Math.ceil(ms / DAY));
			if (days <= 0) return t("common.lessThanDay");
			return unitText(locale, days, "day", "long");
		}

		// Цены каталога — за 1M токенов. Два знака после точки для обычных цен,
		// до трёх — для дробных вроде $0.0028.
		function formatMoney(value, factor = 1) {
			if (typeof value !== "number" || !Number.isFinite(value)) return "—";
			const result = value * factor;
			if (result === 0) return "0";
			const text = result.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
			if (!text.includes(".")) return text + ".00";
			return text.split(".")[1].length === 1 ? text + "0" : text;
		}

		function priceParts(t, info, factor = 1) {
			const parts = [];
			if (typeof info.input === "number") parts.push(t("price.input") + " $" + formatMoney(info.input, factor));
			if (typeof info.outputPrice === "number") parts.push(t("price.output") + " $" + formatMoney(info.outputPrice, factor));
			if (typeof info.cacheRead === "number") parts.push(t("price.cache") + " $" + formatMoney(info.cacheRead, factor));
			if (typeof info.cacheWrite === "number") parts.push(t("price.cacheWrite") + " $" + formatMoney(info.cacheWrite, factor));
			return parts.join(" · ");
		}

		function priceLabel(t, info, factor = 1) {
			if (info === null || info === undefined) return "";
			if (info.input === 0 && info.outputPrice === 0 && (info.cacheRead === 0 || info.cacheRead === null || info.cacheRead === undefined) && (info.cacheWrite === 0 || info.cacheWrite === null || info.cacheWrite === undefined)) {
				return t("price.free");
			}
			const text = priceParts(t, info, factor);
			return text === "" ? "" : text + " / 1M";
		}

		function formatter(locale, options) {
			try {
				return new Intl.DateTimeFormat(locale, options);
			} catch (_) {
				return new Intl.DateTimeFormat(FALLBACK_LOCALE, options);
			}
		}

		function clockText(ms, locale) {
			return formatter(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
		}

		function beijingClockText(ms, locale) {
			return formatter(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date(ms));
		}

		// Конец периода: сегодня — просто «13:00», в другой день — «пн 09:00».
		function endText(ms, now, locale) {
			const time = clockText(ms, locale);
			return new Date(ms).toDateString() === new Date(now).toDateString() ? time : formatter(locale, { weekday: "short" }).format(new Date(ms)) + " " + time;
		}

		// Дата смены множителя: «1 дек.» — точного времени у неё нет.
		function dayText(ms, locale) {
			return formatter(locale, { day: "numeric", month: "short" }).format(new Date(ms));
		}

		// Окна заданы по Пекину, а показываем их эквивалент в поясе пользователя
		// (на сегодняшнюю дату, чтобы учесть переход на летнее время, если он есть).
		function localWindowTime(value, locale) {
			const minutes = parseHM(value);
			if (minutes === null) return null;
			const today = beijingParts(Date.now());
			const instant = Date.UTC(today.year, today.month - 1, today.day, Math.floor(minutes / 60), minutes % 60) - CN_OFFSET;
			return clockText(instant, locale);
		}

		function timeZoneName(fallback) {
			try {
				return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
			} catch (_) {
				return fallback;
			}
		}
		//#endregion

		//#region Настройки
		// Цвета тарифов заданы в базовом CSS (--pc-c-valley, --pc-c-peak,
		// --pc-c-flat, --pc-c-free); своих тем у плагина нет — оттенки меняются
		// только через «Свой CSS», который добавляется позже и переопределяет
		// переменные.
		const DEFAULTS = {
			windows: [
				["09:00", "12:00"],
				["14:00", "18:00"]
			],
			customCss: "",
			allModels: false
		};
		const STORE_KEY = "dsh-peak-opencode:settings";
		//#endregion

		//#region Настройки
		function normalizeStored(raw) {
			const value = { ...DEFAULTS, windows: DEFAULTS.windows.map((row) => row.slice()) };
			if (raw === null || typeof raw !== "object") return value;
			if (Array.isArray(raw.windows)) {
				const rows = raw.windows
					.filter((row) => Array.isArray(row) && row.length >= 2)
					.map((row) => [String(row[0] === undefined || row[0] === null ? "" : row[0]), String(row[1] === undefined || row[1] === null ? "" : row[1])]);
				if (rows.length > 0) value.windows = rows;
			}
			if (typeof raw.customCss === "string") value.customCss = raw.customCss;
			if (typeof raw.allModels === "boolean") value.allModels = raw.allModels;
			return value;
		}

		function readStored() {
			try {
				const text = window.localStorage.getItem(STORE_KEY);
				if (text === null) return normalizeStored(null);
				return normalizeStored(JSON.parse(text));
			} catch (_) {
				return normalizeStored(null);
			}
		}

		// Пользовательский CSS — отдельным тегом после базовых стилей: порядок в
		// документе важнее специфичности, поэтому !important не нужен.
		function applyCustomCss(text) {
			let tag = document.querySelector("style[data-pc-custom]");
			if (tag === null) {
				tag = document.createElement("style");
				tag.dataset.pcCustom = "";
				document.head.appendChild(tag);
			}
			tag.textContent = typeof text === "string" ? text : "";
		}

		const settingsStore = (() => {
			let value = readStored();
			const listeners = new Set();
			const commit = () => {
				try {
					window.localStorage.setItem(STORE_KEY, JSON.stringify(value));
				} catch (_) {
					// Приватный режим или запрет хранилища: настройки живут до перезагрузки.
				}
				applyCustomCss(value.customCss);
				for (const listener of listeners) listener();
			};
			return {
				get() {
					return value;
				},
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				set(patch) {
					value = { ...value, ...patch };
					commit();
				},
				reset() {
					value = normalizeStored(null);
					commit();
				}
			};
		})();

		function useSettings() {
			return react.useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
		}
		//#endregion

		//#region Модель
		// Каталог моделей может ещё не быть готов на первых кадрах (сессия только
		// что создана), а результат inject кэшируется: поэтому ошибку не бросаем,
		// возвращаем null, а компонент сам ждёт появления каталога.
		function resolveModelStore(ctx, sessionId) {
			try {
				const directories = ctx.get("modelDirectories");
				if (directories === undefined || sessionId === undefined || sessionId === null) return null;
				const directory = directories.directoryFor(sessionId);
				const store = directory === undefined || directory === null ? void 0 : directory.store;
				if (store === undefined || store === null) return null;
				const snapshot = store.getSnapshot();
				if (snapshot === undefined || snapshot === null || snapshot.current === null || snapshot.current === void 0) {
					Promise.resolve(directory.load()).catch(() => {});
				}
				return store;
			} catch (_) {
				return null;
			}
		}

		function readCurrentModel(store) {
			try {
				const snapshot = store.getSnapshot();
				return snapshot === undefined || snapshot === null ? null : snapshot.current;
			} catch (_) {
				return null;
			}
		}

		function useModelSelection(store) {
			const [current, setCurrent] = react.useState(() => (store === undefined ? null : readCurrentModel(store)));
			react.useEffect(() => {
				if (store === undefined || store === null) {
					setCurrent(null);
					return;
				}
				const sync = () => setCurrent(readCurrentModel(store));
				sync();
				let unsubscribe = null;
				try {
					unsubscribe = store.subscribe(sync);
				} catch (_) {}
				return () => {
					if (typeof unsubscribe === "function") {
						try {
							unsubscribe();
						} catch (_) {}
					}
				};
			}, [store]);
			return current;
		}

		//#region Каталог моделей
		// Каталог OpenCode Go тянется при запуске Web GUI. Сначала пробуем
		// хостовый маршрут (он кеширует ответ на стороне DSH), затем — прямой
		// публичный эндпоинт: CORS у него открыт. Снимок кладём в localStorage,
		// чтобы полоса работала и без сети.
		const CATALOG_ROUTE = "/dsh-peak-opencode/models";
		const CATALOG_FALLBACK = "https://opencode.ai/inference/go/v1/models";
		// Версия формата ответа хоста: если хост старее, берём публичный эндпоинт.
		const CATALOG_FORMAT = 2;
		const CATALOG_CACHE_KEY = "dsh-peak-opencode:catalog:v3";
		const CATALOG_TTL = 6 * 60 * 60 * 1000;
		const DAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
		const FETCH_TIMEOUT = 7000;

		function toNumber(value) {
			return typeof value === "number" && Number.isFinite(value) ? value : null;
		}

		function firstNumber(value) {
			if (typeof value === "number" && Number.isFinite(value)) return value;
			if (value !== null && typeof value === "object") {
				for (const item of Object.values(value)) {
					if (typeof item === "number" && Number.isFinite(item)) return item;
				}
			}
			return null;
		}

		// Множитель пика из каталога: { days: ["mon",...], windows: [["01:00","04:00"],...], factor: 2 }.
		function peakRuleOf(raw) {
			const multipliers = raw?.cost?.multipliers;
			if (!Array.isArray(multipliers)) return null;
			for (const multiplier of multipliers) {
				if (!multiplier || !(Number(multiplier.factor) > 1)) continue;
				const days = multiplier.when?.utc_days?.in;
				const clauses = multiplier.when?.any;
				if (!Array.isArray(days) || !Array.isArray(clauses)) continue;
				const windows = [];
				for (const clause of clauses) {
					let start = null;
					let end = null;
					for (const entry of clause?.all ?? []) {
						const hours = entry?.utc_hours;
						if (hours === undefined || hours === null) continue;
						if (hours.gte !== undefined && hours.gte !== null) start = hours.gte;
						if (hours.lt !== undefined && hours.lt !== null) end = hours.lt;
					}
					if (start !== null && end !== null) windows.push([start, end]);
				}
				if (windows.length > 0) return { days, windows, factor: Number(multiplier.factor) };
			}
			return null;
		}

		// Множитель, привязанный к дате, а не к часам: у Gemini 4 Argon цена ×2
		// с 01.12.2026. Пиковых окон у таких моделей нет, поэтому льготный тариф
		// действует до этой даты, а дальше включается множитель.
		function dateMultiplierOf(raw) {
			const multipliers = raw?.cost?.multipliers;
			if (!Array.isArray(multipliers)) return null;
			for (const multiplier of multipliers) {
				if (!multiplier || !(Number(multiplier.factor) > 1)) continue;
				const gte = multiplier.when?.date?.gte;
				if (typeof gte !== "string") continue;
				const from = Date.parse(gte.length === 10 ? gte + "T00:00:00Z" : gte);
				if (!Number.isFinite(from)) continue;
				return { from, factor: Number(multiplier.factor) };
			}
			return null;
		}

		function normalizeModel(raw) {
			if (raw === null || typeof raw !== "object" || typeof raw.id !== "string" || raw.id === "") return null;
			const peak = raw.peak !== undefined ? raw.peak : peakRuleOf(raw);
			const since = raw.since !== undefined ? raw.since : dateMultiplierOf(raw);
			return {
				id: raw.id,
				name: typeof raw.name === "string" && raw.name !== "" ? raw.name : raw.id,
				context: raw.context ?? raw.limit?.context ?? null,
				output: raw.output ?? raw.limit?.output ?? null,
				input: raw.input ?? raw.cost?.text?.input?.price ?? null,
				outputPrice: raw.outputPrice ?? raw.cost?.text?.output?.price ?? null,
				cacheRead: raw.cacheRead ?? raw.cost?.text?.input?.cache?.read ?? null,
				cacheWrite: raw.cacheWrite ?? firstNumber(raw.cost?.text?.input?.cache?.write) ?? null,
				peak: peak === null || peak === undefined ? null : {
					days: Array.isArray(peak.days) ? peak.days : [],
					windows: Array.isArray(peak.windows) ? peak.windows : [],
					factor: Number(peak.factor) > 1 ? Number(peak.factor) : 2
				},
				since: since === null || since === undefined || !Number.isFinite(Number(since.from))
					? null
					: { from: Number(since.from), factor: Number(since.factor) > 1 ? Number(since.factor) : 2 }
			};
		}

		function normalizeCatalog(payload) {
			const rows = Array.isArray(payload?.models) ? payload.models : Array.isArray(payload?.data) ? payload.data : [];
			return rows.map(normalizeModel).filter((model) => model !== null);
		}

		function readCatalogCache() {
			try {
				const raw = window.localStorage.getItem(CATALOG_CACHE_KEY);
				if (raw === null) return null;
				const parsed = JSON.parse(raw);
				if (parsed === null || typeof parsed !== "object" || !Array.isArray(parsed.models)) return null;
				return {
					models: parsed.models.map(normalizeModel).filter((model) => model !== null),
					updatedAt: toNumber(parsed.updatedAt) ?? 0,
					source: typeof parsed.source === "string" ? parsed.source : ""
				};
			} catch (_) {
				return null;
			}
		}

		const catalogStore = (() => {
			const cached = readCatalogCache();
			let value = {
				status: cached !== null && cached.models.length > 0 ? "ready" : "idle",
				models: cached?.models ?? [],
				updatedAt: cached?.updatedAt ?? 0,
				source: cached?.source ?? "",
				error: null
			};
			const listeners = new Set();
			let inflight = null;
			const emit = () => {
				for (const listener of listeners) listener();
			};
			const set = (patch) => {
				value = { ...value, ...patch };
				emit();
			};
			function saveCache() {
				try {
					window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({
						models: value.models,
						updatedAt: value.updatedAt,
						source: value.source
					}));
				} catch (_) {}
			}
			async function fetchJson(url) {
				const controller = new AbortController();
				const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT);
				try {
					const response = await fetch(url, {
						cache: "no-store",
						credentials: "same-origin",
						signal: controller.signal
					});
					if (!response.ok) throw new Error("HTTP " + response.status);
					return await response.json();
				} finally {
					window.clearTimeout(timer);
				}
			}
			async function fetchCatalog(refreshHost) {
				const route = refreshHost ? CATALOG_ROUTE + "?refresh=1" : CATALOG_ROUTE;
				try {
					const payload = await fetchJson(route);
					// Хостовый маршрут мог ответить ошибкой, пустым каталогом или
					// устаревшим форматом (например, после обновления плагина без
					// перезапуска DSH) — тогда идём за публичным эндпоинтом напрямую.
					if (payload?.ok === false || Number(payload?.format ?? 0) < CATALOG_FORMAT || normalizeCatalog(payload).length === 0) {
						throw new Error("host catalog unavailable");
					}
					return payload;
				} catch (_) {
					return await fetchJson(CATALOG_FALLBACK);
				}
			}
			function load(force = false, refreshHost = false) {
				const fresh = value.updatedAt > 0 && Date.now() - value.updatedAt < CATALOG_TTL;
				if (!force && fresh) return Promise.resolve(value);
				if (inflight !== null) return inflight;
				set({ status: "loading", error: null });
				inflight = (async () => {
					try {
						const payload = await fetchCatalog(refreshHost);
						const models = normalizeCatalog(payload);
						if (models.length === 0) throw new Error("пустой каталог");
						set({
							status: "ready",
							models,
							updatedAt: toNumber(payload?.updatedAt) ?? Date.now(),
							source: typeof payload?.source === "string" ? payload.source : CATALOG_FALLBACK,
							error: null
						});
						saveCache();
					} catch (error) {
						set({
							status: value.models.length > 0 ? "stale" : "error",
							error: error instanceof Error ? error.message : String(error)
						});
					} finally {
						inflight = null;
					}
					return value;
				})();
				return inflight;
			}
			return {
				get() {
					return value;
				},
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				load,
				start() {
					load(true, false);
				}
			};
		})();

		function useCatalog() {
			return react.useSyncExternalStore(catalogStore.subscribe, catalogStore.get, catalogStore.get);
		}

		//#region Разбор тарифа
		function isGoSelection(selection) {
			return /opencode-go/i.test(String(selection?.provider || "")) || /opencode-go/i.test(String(selection?.model || ""));
		}

		function isDeepSeekSelection(selection) {
			return /deepseek/i.test(String(selection?.provider || "")) || /deepseek/i.test(String(selection?.model || ""));
		}

		// Бесплатная модель — та, у которой в id (или в названии) стоит суффикс
		// free: `beam-free`, `longcat-2.5-preview-free`. Опираться на каталог
		// здесь нельзя: Go переименовывает такие модели (`longcat-2.5-preview-free`
		// в каталоге стал `longcat-2.5-free`), и тогда цены у полосы не было бы.
		function isFreeModel(selection) {
			return /(^|[-_/:])free$/i.test(String(selection?.model || "")) || /(^|\s)free$/i.test(String(selection?.name || ""));
		}

		// Нулевая цена по всем каналам — так каталог Go помечает бесплатные модели.
		function isFreeInfo(info) {
			return info !== null && info !== undefined
				&& info.input === 0 && info.outputPrice === 0
				&& (info.cacheRead === 0 || info.cacheRead === null || info.cacheRead === undefined)
				&& (info.cacheWrite === 0 || info.cacheWrite === null || info.cacheWrite === undefined);
		}

		// Запись для бесплатной модели, которой нет в каталоге Go (или которая
		// в каталоге названа иначе). Цена нулевая, пиковых часов нет: полоса
		// показывает «бесплатно» вместо пустого места слева.
		function freeModelInfo(selection) {
			const id = String(selection?.model || "free");
			const name = typeof selection?.name === "string" && selection.name !== "" ? selection.name : id;
			return {
				id,
				name,
				context: null,
				output: null,
				input: 0,
				outputPrice: 0,
				cacheRead: 0,
				cacheWrite: 0,
				peak: null,
				since: null
			};
		}

		// Если каталог не загрузился, для известных моделей DeepSeek всё равно
		// показываем цену: окна пика придут из настроек/встроенного правила.
		// deepseek-flash — аккаунт DeepSeek, это тот же V4.1 Flash (1017).
		function fallbackDeepSeekInfo(selection) {
			const model = String(selection?.model || "").toLowerCase();
			if (model.includes("v4-pro")) {
				return { id: model, name: "DeepSeek V4 Pro", input: 0.66, cacheRead: 0.022, outputPrice: 1.98, peak: null };
			}
			if (model.includes("v4.1-flash") || model.includes("v4-flash") || model.includes("deepseek-flash")) {
				return { id: model, name: "DeepSeek V4.1 Flash", input: 0.15, cacheRead: 0.003, outputPrice: 0.6, peak: null };
			}
			return null;
		}

		// Провайдер может называть модель иначе, чем каталог: в DSH встречается
		// id с суффиксом варианта доступа (`gemini-4-argon-contributor`) или с
		// префиксом провайдера. Срезаем их и сравниваем по самому длинному
		// совпадению, чтобы не поймать случайную подстроку.
		function modelKeys(model) {
			const raw = String(model || "").toLowerCase().trim();
			const bare = raw.replace(/^[^/:]*[/:]/, "");
			return [raw, bare, bare.replace(/-(contributor|preview|free|latest)$/, "")];
		}

		function findCatalogModel(models, selection) {
			const keys = modelKeys(selection?.model);
			const wanted = keys.filter((key) => key !== "");
			if (wanted.length === 0) return null;
			for (const model of models) {
				const id = String(model.id || "").toLowerCase();
				if (wanted.includes(id)) return model;
			}
			let best = null;
			let bestLength = 0;
			for (const model of models) {
				const id = String(model.id || "").toLowerCase();
				for (const key of wanted) {
					const hit = key === id || key.startsWith(id + "-") || key.startsWith(id + ".") || key.includes("/" + id) || key.includes(":" + id);
					if (hit && id.length > bestLength) {
						best = model;
						bestLength = id.length;
					}
				}
			}
			return best;
		}

		function daysOfPeak(peak) {
			const days = new Set();
			for (const name of peak?.days ?? []) {
				const index = DAY_INDEX[String(name).toLowerCase().slice(0, 3)];
				if (index !== undefined) days.add(index);
			}
			return days.size > 0 ? days : WEEKDAYS;
		}

		// Каталог задаёт окна в UTC. Внутри плагина удобнее пекинские минуты:
		// так остаются прежние настройки, подписи и проверка праздников Китая.
		function windowsOfPeak(peak) {
			const windows = [];
			for (const row of peak?.windows ?? []) {
				if (!Array.isArray(row) || row.length < 2) continue;
				const start = parseHM(row[0]);
				const end = parseHM(row[1]);
				if (start === null || end === null || start === end) continue;
				const from = (start + 8 * 60) % 1440;
				let to = (end + 8 * 60) % 1440;
				if (to <= from) to += 1440;
				windows.push([from, to]);
			}
			return windows.length > 0 ? windows : null;
		}

		function tariffFor(selection, settings, catalog) {
			if (selection === null || selection === undefined) return null;
			const provider = String(selection.provider || "");
			const model = String(selection.model || "");
			if (isGoSelection(selection)) {
				const info = findCatalogModel(catalog.models, selection);
				// Бесплатная модель — отдельная зелёная фаза. Цен и множителей у неё
				// нет, но «единый тариф» — это про модели с постоянной платной ценой,
				// а не про ноль. Если каталог знает ту же модель и она у него
				// нулевая, берём его название; иначе собираем запись из id: Go
				// переименовывает free-модели (`longcat-2.5-preview-free` против
				// `longcat-2.5-free`), а `step-5-preview-free` после срезания
				// суффикса совпал бы с платным `step-5-preview`.
				if (isFreeModel(selection)) {
					return { kind: "free", info: info !== null && isFreeInfo(info) ? info : freeModelInfo(selection) };
				}
				if (info !== null) {
					if (info.peak !== null) return { kind: "peak", info };
					// Модель с множителем по дате — не «единый тариф»: до даты
					// действует льготная цена, после неё включается множитель.
					if (info.since !== null && info.since !== undefined) return { kind: "dated", info };
					return { kind: "flat", info };
				}
				if (isDeepSeekSelection(selection)) return { kind: "peak", info: fallbackDeepSeekInfo(selection), fallback: true };
				// Пока каталог грузится, модель Go уже получает синюю полосу; когда
				// данные придут, peak-модель (если появится) перекрасится.
				return { kind: "flat", info: null, unknown: true };
			}
			if (isDeepSeekSelection(selection)) {
				return isFreeModel(selection)
					? { kind: "free", info: freeModelInfo(selection) }
					: { kind: "peak", info: fallbackDeepSeekInfo(selection), fallback: true };
			}
			if (settings.allModels) return { kind: "flat", info: null, unknown: true };
			return null;
		}

		function ruleFor(tariff, settings) {
			if (tariff.kind === "peak" && tariff.info?.peak) {
				const official = windowsOfPeak(tariff.info.peak);
				const custom = !isOfficialWindows(settings.windows);
				return {
					windows: custom || official === null ? windowsOf(settings) : official,
					days: daysOfPeak(tariff.info.peak),
					holidays: /deepseek/i.test(tariff.info.id)
				};
			}
			return { windows: windowsOf(settings), days: WEEKDAYS, holidays: true };
		}
		//#endregion

		function useTicker(intervalMs) {
			const [now, setNow] = react.useState(() => Date.now());
			react.useEffect(() => {
				const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
				return () => window.clearInterval(timer);
			}, [intervalMs]);
			return now;
		}
		//#endregion

		//#region Полоса
		// Остаток показывается до минуты, поэтому частого обновления не нужно:
		// 10 секунд хватает, чтобы прогресс и минуты не отставали.
		const TICK_MS = 10000;
		const RETRY_MS = 500;
		const RETRY_MAX = 40;

		// «Первый экран» — единственное место, где над полосой стоит строка
		// «проект / режим». Ищем её только внутри посадочного места композера
		// (data-composer-seat): статистика прошлого ответа, чипы в переписке и
		// меню команд лежат снаружи. Иначе полоса на каждом нажатии клавиши
		// поднималась бы на несколько пикселей и перекрывала чужую строку.
		function findHeroRow(bar) {
			const seat = bar.closest("[data-composer-seat]");
			if (seat === null) return null;
			const barTop = bar.getBoundingClientRect().top;
			let found = null;
			let foundTop = Number.POSITIVE_INFINITY;
			for (const chip of seat.querySelectorAll("[aria-haspopup]")) {
				const row = chip.parentElement;
				if (row === null || row === bar || row.contains(bar)) continue;
				// Строка «проект / режим» — единственная, где два выпадающих чипа
				// стоят рядом (проект и режим). Статистика прошлого ответа,
				// уведомления и панель очереди под это условие не попадают.
				if (row.querySelectorAll("[aria-haspopup]").length < 2) continue;
				const box = row.getBoundingClientRect();
				// Слишком низкая строка — иконка, слишком высокая — блок контента.
				if (box.height < 18 || box.height > 72) continue;
				if (box.bottom >= barTop || barTop - box.bottom > 96) continue;
				if (box.top < foundTop) {
					found = { row, top: box.top, height: box.height };
					foundTop = box.top;
				}
			}
			return found;
		}

		function PeakBar(props) {
			const settings = useSettings();
			const catalog = useCatalog();
			const { locale, t } = useTranslator();
			const [store, setStore] = react.useState(() => resolveModelStore(props.ctx, props.sessionId));
			react.useEffect(() => {
				// Каталог моделей может появиться позже; ждём до двадцати секунд.
				if (store !== null) return;
				let tries = 0;
				const timer = window.setInterval(() => {
					const found = resolveModelStore(props.ctx, props.sessionId);
					if (found !== null) setStore(found);
					else if ((tries += 1) >= RETRY_MAX) window.clearInterval(timer);
				}, RETRY_MS);
				return () => window.clearInterval(timer);
			}, [store, props.ctx, props.sessionId]);
			const selection = useModelSelection(store);
			const now = useTicker(TICK_MS);
			const barRef = react.useRef(null);
			const heroRef = react.useRef(null);
			const detachRef = react.useRef(null);

			const restoreHero = react.useCallback(() => {
				const hero = heroRef.current;
				if (hero === null) return;
				hero.row.style.removeProperty("position");
				hero.row.style.removeProperty("z-index");
				heroRef.current = null;
			}, []);

			// Геометрию подъёма пересчитываем только когда меняется раскладка:
			// при появлении полосы, изменении ширины или структуры композера.
			// На каждый рендер (а ввод текста перерисовывает dock) этого делать
			// нельзя: полоса начинала бы подпрыгивать на каждом нажатии клавиши.
			const measureHero = react.useCallback((bar) => {
				restoreHero();
				bar.removeAttribute("data-hero");
				bar.style.removeProperty("--pc-hero-lift");
				bar.style.removeProperty("--pc-hero-row");
				bar.style.removeProperty("--pc-hero-pad");
				const row = findHeroRow(bar);
				if (row === null) return;
				const barTop = bar.getBoundingClientRect().top;
				// Полоса поднимается до верха строки с чипами и оставляет 2px воздуха.
				const lift = Math.round(barTop - row.top) + 2;
				if (lift <= 0) return;
				const rowHeight = Math.round(row.height);
				bar.style.setProperty("--pc-hero-lift", lift + "px");
				bar.style.setProperty("--pc-hero-row", rowHeight + "px");
				// Собственная строка текста измеряется, а не берётся из 16px: размер
				// шрифта зависит от темы, и на другой базе текст уехал бы с центра.
				const textHeight = bar.firstElementChild === null ? 0 : bar.firstElementChild.getBoundingClientRect().height;
				bar.style.setProperty("--pc-hero-pad", Math.max(0, Math.round((rowHeight - textHeight) / 2) + 2) + "px");
				bar.setAttribute("data-hero", "true");
				// Стили строки нужны только на первом экране; при переходе в диалог
				// убираем их, чтобы не оставлять следов в чужом DOM.
				row.row.style.position = "relative";
				row.row.style.zIndex = "1";
				heroRef.current = row;
			}, [restoreHero]);

			const attachObservers = react.useCallback((bar) => {
				let raf = 0;
				let lastBump = 0;
				const bump = () => {
					const stamp = Date.now();
					if (stamp - lastBump < 400) return;
					lastBump = stamp;
					window.cancelAnimationFrame(raf);
					raf = window.requestAnimationFrame(() => {
						const current = barRef.current;
						if (current !== null) measureHero(current);
					});
				};
				// Только ширина: высота меняется и от самой полосы, тогда получился бы
				// цикл «измерил — изменил — измерил».
				let width = null;
				const resize = new ResizeObserver((entries) => {
					const next = entries[0]?.contentRect.width ?? 0;
					if (width === null) {
						width = next;
						return;
					}
					if (Math.abs(next - width) < 1) return;
					width = next;
					bump();
				});
				resize.observe(bar);
				// Смена первого экрана и диалога меняет структуру, но не ширину.
				// Следим за посадочным местом композера, но игнорируем всё внутри
				// карточки ввода: набор текста не должен перезапускать измерение.
				const seat = bar.closest("[data-composer-seat]");
				const host = seat ?? bar.parentElement?.parentElement ?? bar.parentElement;
				const mutations = new MutationObserver((records) => {
					for (const record of records) {
						if (bar.contains(record.target)) continue;
						const target = record.target;
						if (target instanceof Element && target.closest("[data-composer-card]") !== null) continue;
						bump();
						return;
					}
				});
				if (host !== null) mutations.observe(host, { childList: true, subtree: true });
				window.addEventListener("resize", bump);
				return () => {
					resize.disconnect();
					mutations.disconnect();
					window.removeEventListener("resize", bump);
					window.cancelAnimationFrame(raf);
				};
			}, [measureHero]);

			const setBar = react.useCallback((node) => {
				if (detachRef.current !== null) {
					detachRef.current();
					detachRef.current = null;
				}
				barRef.current = node;
				if (node === null) {
					restoreHero();
					return;
				}
				measureHero(node);
				detachRef.current = attachObservers(node);
			}, [attachObservers, measureHero, restoreHero]);
			const tariff = tariffFor(selection, settings, catalog);
			if (tariff === null) return null;
			if (tariff.kind === "flat" || tariff.kind === "free") {
				const isFree = tariff.kind === "free";
				const info = tariff.info;
				const modelName = info?.name ?? String(selection.model || t("common.model"));
				const priceText = priceLabel(t, info, 1);
				const pricePartsText = info !== null ? priceParts(t, info, 1) : "";
				const priceLine = info !== null
					? priceLabel(t, info, 1) === t("price.free")
						? t("hint.freePrice")
						: pricePartsText === ""
							? t("hint.noPrice")
							: t("hint.price", { parts: pricePartsText })
					: catalog.status === "error"
						? t("hint.catalogError")
						: t("hint.notInCatalog");
				const phaseLabel = isFree ? t("bar.free") : t("bar.flat");
				const flatHint = [
					isFree ? t("hint.freeTitle", { model: modelName }) : t("hint.flatTitle", { model: modelName }),
					priceLine,
					isFree ? t("hint.freeBand") : t("hint.flatBand")
				].join("\n");
				return h("div", {
					className: "pc-bar",
					ref: setBar,
					"data-phase": isFree ? "free" : "flat",
					// На первом экране цена уезжает во вторую строку полосы:
					// атрибут включает её и добавляет высоту (см. CSS).
					"data-hero-price": priceText === "" ? undefined : "true",
					role: "status",
					title: flatHint,
					"aria-label": t("aria.flat", { phase: phaseLabel }) + (priceText === "" ? "" : ", " + priceText),
					style: { "--pc-pct": "100%" }
				}, h("div", { className: "pc-row" },
					priceText === "" ? null : h("span", { className: "pc-price" }, priceText),
					h("span", { className: "pc-spacer" }),
					h("span", { className: "pc-side" },
						h("span", { className: "pc-phase" }, phaseLabel),
						h("span", { className: "pc-sep pc-sep-until" }, "·"),
						h("span", { className: "pc-until" }, t("bar.noPeak"))
					)
				));
			}
			// Модель с множителем по дате (Gemini 4 Argon): часовых окон нет,
			// поэтому до даты — льготный тариф, после неё — пиковый с множителем.
			if (tariff.kind === "dated") {
				const info = tariff.info;
				const since = info.since;
				const isPeak = now >= since.from;
				const factor = isPeak ? since.factor : 1;
				const priceText = priceLabel(t, info, factor);
				const day = dayText(since.from, locale);
				const baseParts = priceParts(t, info ?? {}, 1);
				const peakParts = priceParts(t, info ?? {}, since.factor);
				const phaseLabel = isPeak ? t("bar.peak") : t("bar.valley");
				const left = isPeak ? "" : durationDays(since.from - now, t, locale);
				const hint = [
					t("hint.datedTitle", { model: info.name, factor: since.factor, day }),
					isPeak
						? t("hint.datedPeakPrice", { parts: peakParts })
						: t("hint.datedValleyPrice", { parts: baseParts, day, factor: since.factor }),
					isPeak
						? t("hint.datedPeakEnded", { day })
						: t("hint.datedLeft", { day, duration: durationLong(since.from - now, t, locale) })
				].join("\n");
				const when = t(isPeak ? "bar.from" : "bar.until", { value: day });
				return h("div", {
					className: "pc-bar",
					ref: setBar,
					"data-phase": isPeak ? "peak" : "valley",
					"data-hero-price": priceText === "" ? undefined : "true",
					role: "status",
					title: hint,
					"aria-label": t("aria.dated", { phase: phaseLabel, when }) + (priceText === "" ? "" : ", " + priceText),
					style: { "--pc-pct": "100%" }
				}, h("div", { className: "pc-row" },
					priceText === "" ? null : h("span", { className: "pc-price" }, priceText),
					h("span", { className: "pc-spacer" }),
					h("span", { className: "pc-side" },
						h("span", { className: "pc-phase" }, phaseLabel),
						h("span", { className: "pc-sep" }, "·"),
						h("span", { className: "pc-until" }, when),
						isPeak ? null : h("span", { className: "pc-sep pc-sep-until" }, "·"),
						isPeak ? null : h("span", { className: "pc-left" }, left)
					)
				));
			}
			const rule = ruleFor(tariff, settings);
			const signature = ruleSignature(rule);
			const run = runAt(now, rule, signature);
			const span = Math.max(run.end - run.start, 1);
			const percent = Math.min(100, Math.max(0, ((run.end - now) / span) * 100));
			const isPeak = run.phase === "peak";
			const phaseLabel = isPeak ? t("bar.peak") : t("bar.valley");
			const until = endText(run.end, now, locale);
			const left = durationShort(run.end - now, t, locale);
			const longLeft = durationLong(run.end - now, t, locale);
			const modelName = tariff.info?.name ?? (isDeepSeekSelection(selection) ? "DeepSeek" : String(selection.model || t("common.model")));
			const factor = tariff.info?.peak?.factor ?? 2;
			const priceText = priceLabel(t, tariff.info, isPeak ? factor : 1);
			const peakParts = priceParts(t, tariff.info ?? {}, factor);
			const valleyParts = priceParts(t, tariff.info ?? {}, 1);
			const priceLine = peakParts === ""
				? ""
				: t("hint.peakPrices", { factor, peak: peakParts, valley: valleyParts });
			const hint = [
				t("hint.peakTitle", { model: modelName, phase: phaseLabel }),
				t("hint.peakWindow", { phase: phaseLabel, until, beijing: beijingClockText(run.end, locale), left: longLeft }),
				t("hint.peakRules", { windows: windowsText(rule.windows) }) + (priceLine === "" ? "" : " " + priceLine)
			].join("\n");
			// Цвет уже разделяет фазы, поэтому подписи не получают собственного фона.
			return h("div", {
				className: "pc-bar",
				ref: setBar,
				"data-phase": run.phase,
				"data-hero-price": priceText === "" ? undefined : "true",
				role: "status",
				title: hint,
				"aria-label": t("aria.peak", { phase: phaseLabel, until, left: longLeft }) + (priceText === "" ? "" : ", " + priceText),
				style: { "--pc-pct": percent.toFixed(2) + "%" }
			}, h("div", { className: "pc-row" },
				priceText === "" ? null : h("span", { className: "pc-price" }, priceText),
				h("span", { className: "pc-spacer" }),
				h("span", { className: "pc-side" },
					h("span", { className: "pc-phase" }, phaseLabel),
					h("span", { className: "pc-sep" }, "·"),
					h("span", { className: "pc-until" }, t("bar.until", { value: until })),
					h("span", { className: "pc-sep pc-sep-until" }, "·"),
					h("span", { className: "pc-left" }, left)
				)
			));
		}
		//#endregion

		//#region Настройки: разметка
		const GUIDE = [
			[":root", "guide.root"],
			[".pc-bar", "guide.bar"],
			[".pc-bar[data-hero]", "guide.hero"],
			[".pc-bar[data-hero-price]", "guide.heroPrice"],
			[".pc-bar[data-phase=\"peak\"]", "guide.phase"],
			["--pc-pct", "guide.pct"],
			[".pc-phase, .pc-until, .pc-left", "guide.labels"],
			[".pc-price", "guide.price"]
		];
		const SAMPLE = ":root{ --pc-c-valley:#c8ecd8; --pc-c-peak:#ffb3ab; --pc-c-flat:#c7dcf5; --pc-c-free:#c8ecd8 }\n.pc-bar[data-hero]{ --pc-hero-radius:20px }\n.pc-left{ font-weight:600 }";

		function catalogSummary(catalog, t, locale) {
			const count = catalog.models.length;
			const peaks = catalog.models.filter((model) => model.peak !== null);
			const dated = catalog.models.filter((model) => model.peak === null && model.since !== null);
			const updated = catalog.updatedAt > 0
				? new Date(catalog.updatedAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })
				: "—";
			if (count === 0) {
				if (catalog.status === "loading") return t("settings.catalogLoading");
				if (catalog.status === "error") return t("settings.catalogError", { error: catalog.error || t("common.offline") });
				return t("settings.catalogIdle");
			}
			const names = peaks.map((model) => model.name).join(", ");
			const datedNames = dated.map((model) => t("settings.datedName", { name: model.name, day: dayText(model.since.from, locale) })).join(", ");
			return t("settings.catalogSummary", {
				count,
				peaks: peaks.length,
				names: names === "" ? "" : t("settings.catalogNames", { names }),
				dated: datedNames === "" ? "" : t("settings.catalogDated", { names: datedNames }),
				updated
			});
		}

		function SettingsPanel() {
			const settings = useSettings();
			const catalog = useCatalog();
			const { locale, t } = useTranslator();
			const now = useTicker(30000);
			const [draft, setDraft] = react.useState(settings.customCss);
			const [cssNotice, setCssNotice] = react.useState(null);
			const [resetNotice, setResetNotice] = react.useState(null);
			const [confirmReset, setConfirmReset] = react.useState(false);
			react.useEffect(() => {
				setDraft(settings.customCss);
			}, [settings.customCss]);
			const beijingToday = beijingParts(now);
			const peakModels = catalog.models.filter((model) => model.peak !== null);
			const peakWindows = (() => {
				const deepseek = peakModels.find((model) => /deepseek/i.test(model.id));
				const windows = deepseek === undefined ? null : windowsOfPeak(deepseek.peak);
				return windows === null ? null : windows.map((range) => [hmText(range[0]), hmText(range[1])]);
			})();
			const setWindow = (index, slot, value) => {
				const next = settings.windows.map((row) => row.slice());
				next[index][slot] = value;
				settingsStore.set({ windows: next });
			};
			const resetWindows = () => {
				settingsStore.set({ windows: (peakWindows ?? DEFAULTS.windows).map((row) => row.slice()) });
			};
			const rows = settings.windows.map((row, index) => {
				const localStart = localWindowTime(row[0], locale);
				const localEnd = localWindowTime(row[1], locale);
				const local = localStart !== null && localEnd !== null
					? t("settings.localTimes", { start: localStart, end: localEnd })
					: t("settings.invalidTime");
				return h("div", { className: "pc-times", key: index },
					h("input", {
						type: "time",
						className: "pc-input",
						value: row[0],
						"aria-label": t("settings.timeStartAria", { n: index + 1 }),
						onChange: (event) => setWindow(index, 0, event.target.value)
					}),
					h("span", { className: "pc-dash" }, "—"),
					h("input", {
						type: "time",
						className: "pc-input",
						value: row[1],
						"aria-label": t("settings.timeEndAria", { n: index + 1 }),
						onChange: (event) => setWindow(index, 1, event.target.value)
					}),
					h("span", { className: "pc-local" }, local)
				);
			});
			return h("div", { className: "pc-set" },
				h("div", { className: "pc-block" },
					h("div", { className: "pc-h" }, t("settings.catalog")),
					h("div", { className: "pc-hint" }, catalogSummary(catalog, t, locale)),
					catalog.error !== null
						? h("div", { className: "pc-warn" }, t("settings.catalogWarn", { error: catalog.error || t("common.offline") }))
						: null,
					h("div", { className: "pc-actions" },
						h("button", {
							type: "button",
							className: "pc-btn",
							disabled: catalog.status === "loading",
							onClick: () => catalogStore.load(true, true)
						}, catalog.status === "loading" ? t("settings.refreshing") : t("settings.refresh"))
					),
					h("div", { className: "pc-hint" }, t("settings.catalogHint"))
				),
				h("div", { className: "pc-block" },
					h("div", { className: "pc-h" }, t("settings.windows")),
					h("div", { className: "pc-hint" }, t("settings.windowsHint")),
					peakModels.length > 0
						? h("div", { className: "pc-hint" }, t("settings.windowsModels", { names: peakModels.map((model) => model.name).join(", ") }))
						: h("div", { className: "pc-hint" }, t("settings.windowsNone")),
					rows,
					h("div", { className: "pc-live" },
						h("span", null, t("settings.nowBeijing", { time: beijingClockText(now, locale) })),
						h("span", { className: "pc-sep" }, "·"),
						h("span", null, t("settings.nowLocal", { time: clockText(now, locale) })),
						h("span", { className: "pc-sep" }, "·"),
						h("span", { className: "pc-muted" }, timeZoneName(t("common.localTime")))
					),
					h("div", { className: "pc-hint" }, t("settings.windowsNote")),
					KNOWN_YEARS.has(beijingToday.year)
						? null
						: h("div", { className: "pc-warn" }, t("settings.holidaysWarn")),
					h("div", { className: "pc-actions" },
						h("button", {
							type: "button",
							className: "pc-btn",
							onClick: resetWindows
						}, t("settings.resetWindows"))
					)
				),
				h("div", { className: "pc-block" },
					h("div", { className: "pc-h" }, t("settings.behavior")),
					h("label", { className: "pc-check" },
						h("input", {
							type: "checkbox",
							checked: settings.allModels,
							onChange: (event) => settingsStore.set({ allModels: event.target.checked })
						}),
						h("span", null, t("settings.showOutside"))
					),
					h("div", { className: "pc-hint" }, t("settings.behaviorHint"))
				),
				h("div", { className: "pc-block" },
					h("div", { className: "pc-h" }, t("settings.css")),
					h("div", { className: "pc-hint" }, t("settings.cssHint")),
					h("textarea", {
						className: "pc-css",
						value: draft,
						spellCheck: false,
						placeholder: t("settings.cssPlaceholder"),
						onChange: (event) => {
							setDraft(event.target.value);
							setCssNotice(null);
						}
					}),
					h("div", { className: "pc-actions" },
						h("button", {
							type: "button",
							className: "pc-btn pc-btn-primary",
							disabled: draft === settings.customCss,
							onClick: () => {
								settingsStore.set({ customCss: draft });
								setCssNotice(t("settings.cssSaved"));
							}
						}, t("settings.apply")),
						h("button", {
							type: "button",
							className: "pc-btn",
							disabled: draft === "" && settings.customCss === "",
							onClick: () => {
								setDraft("");
								settingsStore.set({ customCss: "" });
								setCssNotice(t("settings.cssCleared"));
							}
						}, t("settings.clear"))
					),
					cssNotice === null ? null : h("div", { className: "pc-ok", role: "status" }, cssNotice)
				),
				h("div", { className: "pc-block" },
					h("div", { className: "pc-h" }, t("settings.reset")),
					h("div", { className: "pc-hint" }, t("settings.resetHint")),
					confirmReset
						? h("div", { className: "pc-actions" },
							h("button", {
								type: "button",
								className: "pc-btn pc-btn-primary",
								onClick: () => {
									settingsStore.reset();
									setDraft("");
									setConfirmReset(false);
									setResetNotice(t("settings.resetDone"));
								}
							}, t("settings.resetConfirm")),
							h("button", {
								type: "button",
								className: "pc-btn",
								onClick: () => setConfirmReset(false)
							}, t("settings.resetCancel"))
						)
						: h("div", { className: "pc-actions" },
							h("button", {
								type: "button",
								className: "pc-btn",
								onClick: () => setConfirmReset(true)
							}, t("settings.resetButton"))
						),
					resetNotice === null ? null : h("div", { className: "pc-ok", role: "status" }, resetNotice)
				),
				h("details", { className: "pc-guide" },
					h("summary", null, t("settings.guide")),
					h("div", { className: "pc-guide-body" },
						h("div", { className: "pc-tip" }, t("settings.guideHooks")),
						h("ul", { className: "pc-list" }, GUIDE.map((row, index) => h("li", { key: index },
							h("code", { className: "pc-k" }, row[0]),
							" — " + t(row[1])
						))),
						h("div", { className: "pc-tip" }, t("settings.guideExample")),
						h("pre", { className: "pc-code" }, SAMPLE),
						h("div", { className: "pc-tip" }, t("settings.guideOutline"))
					)
				)
			);
		}
		//#endregion

		//#region Стили
		// Геометрия: полоса — сосед поля ввода, отрицательный нижний отступ прячет
		// её край под карточкой. В вырезы верхних углов карточки просвечивает цвет
		// полосы, поэтому --pc-tuck не может быть меньше радиуса карточки.
		const CSS = `
:root{--pc-c-valley:#c3e6cf;--pc-c-peak:#f9cdc5;--pc-c-flat:#c7dcf5;--pc-c-free:#c3e6cf}
.pc-bar{
	/* Базовая единица: полоса растёт вместе с системным шрифтом, а не по пикселям. */
	--pc-band:calc(1em + 14px);
	/* Глубина «под карточкой» привязана к радиусу панели, чтобы плечи не ломались. */
	--pc-tuck:calc(var(--dsw-radius-panel,28px) + 2px);
	/* Верхний радиус: тот же, но на тонкой полосе ограничен высотой строки. */
	--pc-hero-radius:min(var(--dsw-radius-panel,28px),calc(var(--pc-hero-row,30px) * .55));
	--pc-lift:5px;
	box-sizing:border-box;
	position:relative;
	z-index:0;
	flex:none;
	display:flex;
	align-items:flex-end;
	width:calc(100% - 2 * var(--dsh-composer-side-clearance,16px));
	max-width:var(--dsh-composer-card-max-width,720px);
	height:calc(var(--pc-band) + var(--pc-tuck));
	padding:0 18px calc(var(--pc-tuck) + var(--pc-lift));
	margin:0 auto calc(-1 * (var(--pc-tuck) + var(--dsh-composer-stack-gap,6px)));
	border-radius:var(--dsw-radius-panel,28px) var(--dsw-radius-panel,28px) 0 0;
	background:linear-gradient(to right,var(--pc-c) 0 var(--pc-pct,100%),color-mix(in srgb,var(--pc-c) 26%,var(--dsw-specific-input-major,#fff)) var(--pc-pct,100%) 100%);
	color:color-mix(in srgb,var(--pc-c) 55%,var(--dsw-alias-label-primary,#1b1b1d));
	font-family:inherit;
	font-size:clamp(11px,.75em,13px);
	line-height:1.3333;
	user-select:none;
}
.pc-bar[data-phase="valley"]{--pc-c:var(--pc-c-valley,#c3e6cf)}
.pc-bar[data-phase="peak"]{--pc-c:var(--pc-c-peak,#f9cdc5)}
/* Единый тариф: у модели нет пиковых часов, поэтому заливка сплошная синяя. */
.pc-bar[data-phase="flat"]{--pc-c:var(--pc-c-flat,#c7dcf5);color:color-mix(in srgb,var(--pc-c) 35%,var(--dsw-alias-label-primary,#1b1b1d))}
/* Бесплатный тариф: зелёный, как льготный, но без периода и отсчёта. */
.pc-bar[data-phase="free"]{--pc-c:var(--pc-c-free,#c3e6cf)}
/* Первый экран: строка «проект / режим» ложится на полосу, карточка — сразу под ней.
   Сдвиг вверх, высота строки и вертикальный паддинг измеряются в компоненте. */
.pc-bar[data-hero]{
	height:calc(max(var(--pc-hero-row,30px) + 4px,var(--pc-hero-radius) + 6px) + var(--pc-tuck) + var(--pc-hero-price-line,0px));
	padding-top:var(--pc-hero-pad,calc(2px + (var(--pc-hero-row,30px) - 16px) / 2));
	margin-top:calc(-1 * var(--pc-hero-lift,32px));
	align-items:flex-start;
	border-top-left-radius:var(--pc-hero-radius);
	border-top-right-radius:var(--pc-hero-radius);
}
/* Первый экран: слева на полосе стоят чипы «проект / режим», рядом с ними
   цена не помещается. Поэтому цена уезжает во вторую строку полосы — под
   чипы, над карточкой ввода. Высота полосы растёт на строку цены, карточка
   сдвигается вниз, и строка остаётся внутри цветного поля. */
.pc-bar[data-hero][data-hero-price]{--pc-hero-price-line:calc(1.3333em + 8px)}
.pc-bar[data-hero][data-hero-price] .pc-price{
	display:block;
	position:absolute;
	left:18px;
	top:calc(var(--pc-hero-row,30px) + 6px);
	max-width:calc(100% - 36px);
	overflow:hidden;
	text-overflow:ellipsis;
}
.pc-row{display:flex;align-items:center;gap:8px;width:100%;min-width:0}
.pc-spacer{flex:1 1 auto;min-width:8px}
.pc-price{flex:none;white-space:nowrap;font-weight:500;font-variant-numeric:tabular-nums}
@media (max-width:640px){
	.pc-price{display:none}
	/* Узкое окно: цена скрыта, лишняя строка полосе не нужна. */
	.pc-bar[data-hero][data-hero-price]{--pc-hero-price-line:0px}
	.pc-bar[data-hero][data-hero-price] .pc-price{display:none}
}
.pc-side{flex:0 1 auto;display:inline-flex;align-items:center;gap:6px;min-width:0;white-space:nowrap;font-variant-numeric:tabular-nums}
.pc-phase{font-weight:600}
.pc-sep{opacity:.45}
.pc-until,.pc-left{font-weight:500}
/* На узком окне убираем подпись конца периода, чтобы текст не задевал чипы. */
@media (max-width:560px){ .pc-until,.pc-sep-until{display:none} }
[data-conversation-content]:has(.pc-bar[data-phase="valley"]) [data-composer-card]{--dsw-elevation-stroke-color:var(--pc-c-valley,#c3e6cf)}
[data-conversation-content]:has(.pc-bar[data-phase="peak"]) [data-composer-card]{--dsw-elevation-stroke-color:var(--pc-c-peak,#f9cdc5)}
[data-conversation-content]:has(.pc-bar[data-phase="flat"]) [data-composer-card]{--dsw-elevation-stroke-color:var(--pc-c-flat,#c7dcf5)}
[data-conversation-content]:has(.pc-bar[data-phase="free"]) [data-composer-card]{--dsw-elevation-stroke-color:var(--pc-c-free,#c3e6cf)}
.pc-set{display:flex;flex-direction:column;gap:18px;padding:4px 0 8px;font-size:13px}
.pc-block{display:flex;flex-direction:column;gap:8px}
.pc-h{font-size:13px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary)}
.pc-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.pc-warn{font-size:12px;line-height:18px;color:var(--dsw-alias-state-warning-primary,#b26a00)}
.pc-ok{font-size:12px;line-height:18px;color:var(--dsw-alias-state-success-primary,#2e7d32)}
.pc-muted{color:var(--dsw-alias-label-tertiary)}
.pc-live{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.pc-times{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.pc-input{height:32px;padding:0 10px;border-radius:var(--dsw-radius-sm,8px);border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform,#fff);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.pc-dash{color:var(--dsw-alias-label-tertiary)}
.pc-local{font-size:12px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.pc-check{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--dsw-alias-label-primary);cursor:pointer}
.pc-check input{accent-color:var(--dsw-alias-state-business-primary,#4d6bfe)}
.pc-css{box-sizing:border-box;width:100%;min-height:132px;resize:vertical;padding:10px 12px;border-radius:var(--dsw-radius-md,12px);border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform,#fff);color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;line-height:18px}
.pc-actions{display:flex;flex-wrap:wrap;gap:8px}
.pc-btn{height:30px;padding:0 12px;border-radius:var(--dsw-radius-sm,8px);border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform,#fff);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.pc-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.pc-btn:disabled{opacity:.55;cursor:default}
.pc-btn-primary{background:var(--dsw-alias-state-business-primary);border-color:transparent;color:#fff}
.pc-guide{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:12px}
.pc-guide>summary{cursor:pointer;font-size:13px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary)}
.pc-guide-body{display:flex;flex-direction:column;gap:6px;padding-top:8px}
.pc-tip{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.pc-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.pc-k{font-family:var(--ds-font-family-code,ui-monospace,monospace);color:var(--dsw-alias-label-primary)}
.pc-code{margin:0;padding:10px 12px;border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-module-platform,#fff);color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;line-height:18px;white-space:pre-wrap;overflow-x:auto}
`;

		function injectCss(id, text) {
			const key = JSON.stringify(id);
			if (document.querySelector("style[data-plugin-css=" + key + "]") !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-peak-opencode";
			tag.dataset.pluginCss = id;
			tag.textContent = text;
			document.head.appendChild(tag);
		}
		//#endregion

		function apply(ctx) {
			pluginCtx = ctx;
			localeStore.bind(ctx);
			injectCss("dsh-peak-opencode/base", CSS);
			applyCustomCss(settingsStore.get().customCss);
			// Каталог OpenCode Go подтягиваем при старте Web GUI; полоса не ждёт
			// сеть — для DeepSeek работают встроенные правила, остальные модели
			// станут синими, как только каталог загрузится.
			catalogStore.start();
			// order 60 — под панелью очереди и вплотную к карточке ввода.
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "peak-opencode",
				order: 60,
				inject: (sessionId) => ({ ctx, sessionId })
			}, PeakBar), "peak-opencode: composer dock");
			// Настройки плагина живут на его странице в «Плагинах», а не отдельным
			// разделом в «Настройках»: штатный слот DSH для этого — keyed
			// `plugins.bundle.config` по имени пакета.
			ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: "dsh-peak-opencode"
			}, SettingsPanel), "peak-opencode: bundle config");
		}

		return { apply, inject: ["slots"] };
	}
});
