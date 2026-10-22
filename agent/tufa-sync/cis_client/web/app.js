"use strict";

(() => {
	// ---------------------------------------------------------------- i18n --

	const STRINGS = {
		en: {
			footer: "Data comes straight from the tax authority's CIS, requested with your own certificate.",
			"setup.title": "Load your fiscalization certificate",
			"setup.lead": "Use the .p12 / .pfx certificate that NAIS issued for your business, together with its password.",
			"setup.drop": "Drop the certificate here, or click to choose the file",
			"setup.change": "Choose another file",
			"setup.password": "Certificate password",
			"setup.environment": "Environment",
			"setup.load": "Load certificate",
			"setup.loading": "Checking the certificate with CIS…",
			"setup.noFile": "Choose the certificate file first.",
			"setup.privacy": "The certificate stays in this computer's memory only while the app is running. It is never saved and never sent anywhere: requests are signed here, and only the public part of the certificate travels with them to the tax authority.",
			"env.auto": "Automatic",
			"env.production": "Production",
			"env.test": "Test",
			"tabs.sales": "Sales",
			"tabs.purchases": "Purchases",
			"tabs.taxpayers": "Taxpayers",
			"tabs.operators": "Operators",
			"tabs.units": "Units & devices",
			"cert.title": "Certificate",
			"cert.business": "Business",
			"cert.nipt": "NIPT",
			"cert.issuer": "Issued by",
			"cert.validity": "Valid",
			"cert.serial": "Serial number",
			"cert.fingerprint": "SHA-256 fingerprint",
			"cert.environment": "Environment",
			"cert.status": "Status",
			"cert.verified": "Accepted by CIS",
			"cert.unverified": "Not yet confirmed by CIS",
			"cert.expired": "Expired",
			"cert.switch": "Switch to {env}",
			"cert.unload": "Remove certificate",
			"common.close": "Close",
			"common.copy": "Copy",
			"common.copied": "Copied",
			"common.yes": "Yes",
			"common.no": "No",
			"common.refresh": "Refresh",
			"common.loading": "Loading…",
			"common.seconds": "{n} s",
			"inv.from": "From",
			"inv.to": "To",
			"inv.period": "Period",
			"inv.fetch": "Get invoices",
			"inv.fic": "Invoice by FIC",
			"inv.ficPlaceholder": "e.g. 2ed48eff-f3d0-4315-a2a5-16618c63ad0b",
			"inv.open": "Open",
			"inv.loading": "Fetching invoices from CIS…",
			"inv.initial": "Choose a period and press “Get invoices”.",
			"inv.empty": "No invoices in this period.",
			"inv.noMatch": "No invoice matches the filter.",
			"inv.notFound": "CIS has no invoice with this FIC.",
			"inv.filter": "Filter by number, NIPT, name or code",
			"inv.periodLabel": "{from} – {to}",
			"preset.today": "Today",
			"preset.yesterday": "Yesterday",
			"preset.thisMonth": "This month",
			"preset.lastMonth": "Last month",
			"preset.thisYear": "This year",
			"preset.custom": "Custom",
			"type.all": "All types",
			"type.CASH": "Cash",
			"type.NONCASH": "Non-cash",
			"type.einvoice": "E-invoices",
			"type.corrective": "Corrective",
			"stats.count": "Invoices",
			"stats.of": "of {n}",
			"stats.net": "Without VAT",
			"stats.vat": "VAT",
			"stats.total": "Total",
			"export.csv": "CSV",
			"export.json": "JSON",
			"col.date": "Date",
			"col.number": "Number",
			"col.buyer": "Buyer",
			"col.seller": "Seller",
			"col.type": "Type",
			"col.net": "Without VAT",
			"col.vat": "VAT",
			"col.total": "Total",
			"badge.einvoice": "E-invoice",
			"badge.CORRECTIVE": "Corrective",
			"badge.CREDIT": "Credit",
			"badge.DEBIT": "Debit",
			"badge.badDebt": "Bad debt",
			"pager.range": "{from}–{to} of {total}",
			"pager.prev": "Previous",
			"pager.next": "Next",
			"detail.title": "Invoice {number}",
			"detail.loadingItems": "Loading the full invoice with its items…",
			"detail.issued": "Issued",
			"detail.registered": "Registered",
			"detail.paymentType": "Payment type",
			"detail.unit": "Business unit",
			"detail.tcr": "Cash register (TCR)",
			"detail.operator": "Operator",
			"detail.software": "Software",
			"detail.currency": "Currency",
			"detail.deadline": "Payment deadline",
			"detail.supply": "Supply period",
			"detail.reverse": "Reverse charge",
			"detail.selfIssue": "Self-issued",
			"detail.simplified": "Simplified",
			"detail.inVat": "Issuer in VAT",
			"detail.customs": "Customs declaration",
			"detail.items": "Items",
			"detail.taxes": "VAT breakdown",
			"detail.payments": "Payments",
			"detail.fees": "Fees",
			"detail.references": "References",
			"detail.corrects": "Corrects ({type})",
			"detail.badDebt": "Bad debt for",
			"detail.summarises": "Summarises",
			"detail.verify": "Verify on the CIS portal",
			"detail.pdf": "E-invoice PDF",
			"detail.json": "Copy JSON",
			"detail.totals": "Totals",
			"detail.taxFree": "Tax free",
			"detail.markUp": "Mark-up",
			"detail.export": "Exported goods",
			"detail.allAmounts": "Amounts in ALL",
			"party.address": "Address",
			"item.name": "Item",
			"item.code": "Code",
			"item.unit": "Unit",
			"item.qty": "Qty",
			"item.upb": "Price excl. VAT",
			"item.upa": "Price incl. VAT",
			"item.discount": "Disc. %",
			"item.vatRate": "VAT %",
			"item.net": "Without VAT",
			"item.vat": "VAT",
			"item.total": "Total",
			"tax.rate": "Rate",
			"tax.items": "Items",
			"tax.base": "Base",
			"tax.vat": "VAT",
			"tax.exempt": "Exemption",
			"pay.method": "Method",
			"pay.amount": "Amount",
			"tp.placeholder": "NIPT or business name (at least 3 characters)",
			"tp.search": "Search",
			"tp.initial": "Search the taxpayer registry by NIPT or by name.",
			"tp.empty": "No taxpayer found.",
			"tp.note": "The registry does not say whether a taxpayer is active.",
			"col.nipt": "NIPT",
			"col.name": "Name",
			"col.address": "Address",
			"col.town": "Town",
			"col.country": "Country",
			"op.empty": "No operators are registered.",
			"op.code": "Operator code",
			"op.id": "Personal no.",
			"op.validFrom": "Valid from",
			"op.validTo": "Valid to",
			"op.status": "Status",
			"op.note": "The operator code is the OperatorCode used when fiscalizing.",
			"status.active": "Active",
			"status.inactive": "Inactive",
			"units.bu": "Business units",
			"units.tcr": "Cash registers (TCR)",
			"units.empty": "Nothing is registered.",
			"bu.code": "Code",
			"bu.name": "Name",
			"bu.address": "Address",
			"bu.serial": "Serial no.",
			"tcr.code": "TCR code",
			"tcr.internal": "Internal ID",
			"tcr.unit": "Business unit",
			"tcr.type": "Type",
			"tcr.software": "Software",
			"tcr.maintainer": "Maintainer",
			"error.network": "The app is not responding. Make sure the CIS Client window is still open.",
			"error.code": "CIS code {code}",
			"error.noPdf": "CIS has no PDF for this e-invoice.",
		},
		sq: {
			footer: "Të dhënat vijnë drejtpërdrejt nga CIS i tatimeve, të kërkuara me certifikatën tuaj.",
			"setup.title": "Ngarkoni certifikatën e fiskalizimit",
			"setup.lead": "Përdorni certifikatën .p12 / .pfx që AKSHI ka lëshuar për biznesin tuaj, së bashku me fjalëkalimin.",
			"setup.drop": "Tërhiqeni certifikatën këtu ose klikoni për të zgjedhur skedarin",
			"setup.change": "Zgjidhni një skedar tjetër",
			"setup.password": "Fjalëkalimi i certifikatës",
			"setup.environment": "Mjedisi",
			"setup.load": "Ngarko certifikatën",
			"setup.loading": "Po verifikohet certifikata me CIS…",
			"setup.noFile": "Zgjidhni fillimisht skedarin e certifikatës.",
			"setup.privacy": "Certifikata qëndron vetëm në kujtesën e këtij kompjuteri sa kohë aplikacioni është i hapur. Nuk ruhet dhe nuk dërgohet askund: kërkesat nënshkruhen këtu dhe vetëm pjesa publike e certifikatës shkon me to te tatimet.",
			"env.auto": "Automatik",
			"env.production": "Production",
			"env.test": "Test",
			"tabs.sales": "Shitjet",
			"tabs.purchases": "Blerjet",
			"tabs.taxpayers": "Tatimpaguesit",
			"tabs.operators": "Operatorët",
			"tabs.units": "Njësitë & pajisjet",
			"cert.title": "Certifikata",
			"cert.business": "Biznesi",
			"cert.nipt": "NIPT",
			"cert.issuer": "Lëshuar nga",
			"cert.validity": "E vlefshme",
			"cert.serial": "Numri serial",
			"cert.fingerprint": "Gjurma SHA-256",
			"cert.environment": "Mjedisi",
			"cert.status": "Statusi",
			"cert.verified": "E pranuar nga CIS",
			"cert.unverified": "Ende e pakonfirmuar nga CIS",
			"cert.expired": "Ka skaduar",
			"cert.switch": "Kalo në {env}",
			"cert.unload": "Hiq certifikatën",
			"common.close": "Mbyll",
			"common.copy": "Kopjo",
			"common.copied": "U kopjua",
			"common.yes": "Po",
			"common.no": "Jo",
			"common.refresh": "Rifresko",
			"common.loading": "Po ngarkohet…",
			"common.seconds": "{n} s",
			"inv.from": "Nga",
			"inv.to": "Deri",
			"inv.period": "Periudha",
			"inv.fetch": "Merr faturat",
			"inv.fic": "Fatura sipas NIVF",
			"inv.ficPlaceholder": "p.sh. 2ed48eff-f3d0-4315-a2a5-16618c63ad0b",
			"inv.open": "Hap",
			"inv.loading": "Po merren faturat nga CIS…",
			"inv.initial": "Zgjidhni periudhën dhe shtypni “Merr faturat”.",
			"inv.empty": "Nuk ka fatura në këtë periudhë.",
			"inv.noMatch": "Asnjë faturë nuk përputhet me filtrin.",
			"inv.notFound": "CIS nuk ka faturë me këtë NIVF.",
			"inv.filter": "Filtro sipas numrit, NIPT-it, emrit ose kodit",
			"inv.periodLabel": "{from} – {to}",
			"preset.today": "Sot",
			"preset.yesterday": "Dje",
			"preset.thisMonth": "Ky muaj",
			"preset.lastMonth": "Muaji i kaluar",
			"preset.thisYear": "Ky vit",
			"preset.custom": "E zgjedhur",
			"type.all": "Të gjitha llojet",
			"type.CASH": "Me para në dorë",
			"type.NONCASH": "Pa para në dorë",
			"type.einvoice": "Fatura elektronike",
			"type.corrective": "Korrigjuese",
			"stats.count": "Fatura",
			"stats.of": "nga {n}",
			"stats.net": "Pa TVSH",
			"stats.vat": "TVSH",
			"stats.total": "Totali",
			"export.csv": "CSV",
			"export.json": "JSON",
			"col.date": "Data",
			"col.number": "Numri",
			"col.buyer": "Blerësi",
			"col.seller": "Shitësi",
			"col.type": "Lloji",
			"col.net": "Pa TVSH",
			"col.vat": "TVSH",
			"col.total": "Totali",
			"badge.einvoice": "E-faturë",
			"badge.CORRECTIVE": "Korrigjuese",
			"badge.CREDIT": "Kreditim",
			"badge.DEBIT": "Debitim",
			"badge.badDebt": "Borxh i keq",
			"pager.range": "{from}–{to} nga {total}",
			"pager.prev": "Para",
			"pager.next": "Pas",
			"detail.title": "Fatura {number}",
			"detail.loadingItems": "Po ngarkohet fatura e plotë me artikujt…",
			"detail.issued": "Lëshuar",
			"detail.registered": "Regjistruar",
			"detail.paymentType": "Lloji i pagesës",
			"detail.unit": "Njësia e biznesit",
			"detail.tcr": "Arka (TCR)",
			"detail.operator": "Operatori",
			"detail.software": "Softueri",
			"detail.currency": "Monedha",
			"detail.deadline": "Afati i pagesës",
			"detail.supply": "Periudha e furnizimit",
			"detail.reverse": "Autongarkesë",
			"detail.selfIssue": "Vetëfaturim",
			"detail.simplified": "E thjeshtuar",
			"detail.inVat": "Lëshuesi në TVSH",
			"detail.customs": "Deklarata doganore",
			"detail.items": "Artikujt",
			"detail.taxes": "Përmbledhja e TVSH-së",
			"detail.payments": "Pagesat",
			"detail.fees": "Tarifat",
			"detail.references": "Referencat",
			"detail.corrects": "Korrigjon ({type})",
			"detail.badDebt": "Borxh i keq për",
			"detail.summarises": "Përmbledh",
			"detail.verify": "Verifiko në portalin e tatimeve",
			"detail.pdf": "PDF e e-faturës",
			"detail.json": "Kopjo JSON",
			"detail.totals": "Totalet",
			"detail.taxFree": "Pa taksë",
			"detail.markUp": "Marzhi",
			"detail.export": "Eksport mallrash",
			"detail.allAmounts": "Shumat në ALL",
			"party.address": "Adresa",
			"item.name": "Artikulli",
			"item.code": "Kodi",
			"item.unit": "Njësia",
			"item.qty": "Sasia",
			"item.upb": "Çmimi pa TVSH",
			"item.upa": "Çmimi me TVSH",
			"item.discount": "Zbritje %",
			"item.vatRate": "TVSH %",
			"item.net": "Pa TVSH",
			"item.vat": "TVSH",
			"item.total": "Totali",
			"tax.rate": "Norma",
			"tax.items": "Artikuj",
			"tax.base": "Baza",
			"tax.vat": "TVSH",
			"tax.exempt": "Përjashtim",
			"pay.method": "Mënyra",
			"pay.amount": "Shuma",
			"tp.placeholder": "NIPT ose emri i biznesit (të paktën 3 shkronja)",
			"tp.search": "Kërko",
			"tp.initial": "Kërkoni në regjistrin e tatimpaguesve sipas NIPT-it ose emrit.",
			"tp.empty": "Nuk u gjet asnjë tatimpagues.",
			"tp.note": "Regjistri nuk tregon nëse tatimpaguesi është aktiv.",
			"col.nipt": "NIPT",
			"col.name": "Emri",
			"col.address": "Adresa",
			"col.town": "Qyteti",
			"col.country": "Shteti",
			"op.empty": "Nuk ka operatorë të regjistruar.",
			"op.code": "Kodi i operatorit",
			"op.id": "Nr. personal",
			"op.validFrom": "I vlefshëm nga",
			"op.validTo": "I vlefshëm deri",
			"op.status": "Statusi",
			"op.note": "Kodi i operatorit është OperatorCode që përdoret gjatë fiskalizimit.",
			"status.active": "Aktiv",
			"status.inactive": "Joaktiv",
			"units.bu": "Njësitë e biznesit",
			"units.tcr": "Arkat (TCR)",
			"units.empty": "Asgjë e regjistruar.",
			"bu.code": "Kodi",
			"bu.name": "Emri",
			"bu.address": "Adresa",
			"bu.serial": "Nr. serial",
			"tcr.code": "Kodi i TCR",
			"tcr.internal": "ID e brendshme",
			"tcr.unit": "Njësia",
			"tcr.type": "Lloji",
			"tcr.software": "Softueri",
			"tcr.maintainer": "Mirëmbajtësi",
			"error.network": "Aplikacioni nuk përgjigjet. Sigurohuni që dritarja e CIS Client është ende e hapur.",
			"error.code": "Kodi CIS {code}",
			"error.noPdf": "CIS nuk ka PDF për këtë e-faturë.",
		},
	};

	// Albanian explanations for common CIS fault codes; English ones come from the server.
	const HINTS_SQ = {
		2: "Ora e kompjuterit ndryshon shumë nga ora e tatimeve. Sinkronizoni orën dhe provoni sërish.",
		29: "Nënshkrimi i kërkesës u refuzua. Kontrolloni që certifikata dhe çelësi privat përkojnë.",
		30: "Nënshkrimi i kërkesës u refuzua. Kontrolloni që certifikata dhe çelësi privat përkojnë.",
		31: "Nënshkrimi i kërkesës u refuzua. Kontrolloni që certifikata dhe çelësi privat përkojnë.",
		34: "CIS nuk e pranon këtë certifikatë. Certifikata e testit punon vetëm në mjedisin Test dhe ajo e Production vetëm në Production: kontrolloni mjedisin e zgjedhur.",
		35: "Certifikata nuk është lëshuar nga AKSHI për këtë mjedis. Certifikatat e testit punojnë vetëm në mjedisin Test, ato të Production vetëm në Production.",
		36: "Certifikata ka skaduar. Kërkoni një certifikatë të re fiskalizimi.",
		38: "Certifikata është revokuar.",
		39: "CIS nuk arriti të verifikojë statusin e certifikatës. Provoni më vonë.",
		52: "Tatimpaguesi nuk ekziston në regjistër.",
		55: "Tatimpaguesi nuk është aktiv në regjistër.",
		87: "Periudha e kërkimit është shumë e gjatë ose ka shumë fatura. Zgjidhni një periudhë më të shkurtër.",
		88: "Kërkesa nuk ka parametra kërkimi.",
	};

	const LANG_KEY = "cis-client.lang";
	const TAB_KEY = "cis-client.tab";
	const PAGE_SIZE = 100;
	const API = "/api/v1/utilities";

	function storageGet(key) {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	}

	function storageSet(key, value) {
		try {
			localStorage.setItem(key, value);
		} catch {
			// Storage can be unavailable (private mode); preferences are optional.
		}
	}

	let lang = storageGet(LANG_KEY) || "sq"; // Albanian unless the user switched to English
	if (!STRINGS[lang]) lang = "sq";

	function t(key, vars) {
		let text = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
		if (vars) text = text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? ""));
		return text;
	}

	// ------------------------------------------------------------- helpers --

	function h(tag, props, ...children) {
		const element = document.createElement(tag);
		for (const [key, value] of Object.entries(props || {})) {
			if (value === null || value === undefined || value === false) continue;
			if (key === "class") element.className = value;
			else if (key === "text") element.textContent = value;
			else if (key.startsWith("on") && typeof value === "function") element.addEventListener(key.slice(2), value);
			else if (key === "value") element.value = value;
			else element.setAttribute(key, value === true ? "" : String(value));
		}
		for (const child of children.flat(Infinity)) {
			if (child === null || child === undefined || child === false) continue;
			element.append(child instanceof Node ? child : String(child));
		}
		return element;
	}

	// Browsers ship without Albanian number data and fall back unpredictably, so one format is used everywhere.
	const amountFormat = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	function money(value) {
		const number = Number(value);
		if (value === undefined || value === null || value === "" || !Number.isFinite(number)) return "";
		return amountFormat.format(number);
	}

	function quantity(value) {
		const number = Number(value);
		return Number.isFinite(number) ? String(number) : value || "";
	}

	// Dates are shown as CIS recorded them (dd/mm/yyyy hh:mm), without time zone conversion.
	function formatDate(value, withTime = true) {
		const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value || "");
		if (!match) return value || "";
		const day = `${match[3]}/${match[2]}/${match[1]}`;
		return withTime && match[4] ? `${day} ${match[4]}:${match[5]}` : day;
	}

	function isoDay(date) {
		const pad = (n) => String(n).padStart(2, "0");
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	function presetRange(preset) {
		const now = new Date();
		const y = now.getFullYear();
		const m = now.getMonth();
		switch (preset) {
			case "today":
				return [isoDay(now), isoDay(now)];
			case "yesterday": {
				const d = new Date(y, m, now.getDate() - 1);
				return [isoDay(d), isoDay(d)];
			}
			case "lastMonth":
				return [isoDay(new Date(y, m - 1, 1)), isoDay(new Date(y, m, 0))];
			case "thisYear":
				return [isoDay(new Date(y, 0, 1)), isoDay(new Date(y, 11, 31))];
			default:
				return [isoDay(new Date(y, m, 1)), isoDay(new Date(y, m + 1, 0))];
		}
	}

	function download(filename, content, type) {
		const blob = content instanceof Blob ? content : new Blob([content], { type });
		const url = URL.createObjectURL(blob);
		const link = h("a", { href: url, download: filename });
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 30000);
	}

	function base64ToBytes(text) {
		const binary = atob(text);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes;
	}

	function bytesToBase64(buffer) {
		const bytes = new Uint8Array(buffer);
		let binary = "";
		for (let i = 0; i < bytes.length; i += 0x8000) {
			binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
		}
		return btoa(binary);
	}

	function copyButton(getText, label = t("common.copy")) {
		const button = h("button", { type: "button", class: "btn btn-ghost btn-small" }, label);
		button.addEventListener("click", async (event) => {
			event.stopPropagation();
			try {
				await navigator.clipboard.writeText(getText());
				button.textContent = t("common.copied");
				setTimeout(() => { button.textContent = label; }, 1400);
			} catch {
				// Clipboard access can be refused; nothing else to do.
			}
		});
		return button;
	}

	function code(value) {
		return value ? h("code", { class: "mono" }, value) : "";
	}

	// ----------------------------------------------------------------- API --

	class ApiError extends Error {
		constructor(status, payload) {
			super((payload && payload.message) || `HTTP ${status}`);
			this.status = status;
			this.payload = payload || {};
		}
	}

	async function api(path, body, method = "POST") {
		const options = { method, cache: "no-store", credentials: "same-origin", headers: {} };
		if (body !== undefined) {
			options.headers["Content-Type"] = "application/json";
			options.body = JSON.stringify(body);
		}
		let response;
		try {
			response = await fetch(path, options);
		} catch {
			throw new ApiError(0, { message: t("error.network") });
		}
		let payload = null;
		try {
			payload = await response.json();
		} catch {
			payload = null;
		}
		if (!response.ok) {
			if (response.status === 401 && path.startsWith(API)) setTimeout(sessionLost, 0);
			throw new ApiError(response.status, payload);
		}
		return { data: payload, headers: response.headers };
	}

	// The server forgot the certificate (it was restarted): go back to the setup screen.
	function sessionLost() {
		if (!state.session || !state.session.loaded) return;
		state.session = { loaded: false };
		views = null;
		if (detailDialog.open) detailDialog.close();
		if (certDialog.open) certDialog.close();
		render();
	}

	function errorBox(error) {
		const payload = (error && error.payload) || {};
		const cis = payload.cisError;
		const faultCode = cis && cis.faultCode;
		const hint = (lang === "sq" && faultCode && HINTS_SQ[faultCode]) || payload.hint;
		const message = (cis && cis.faultString) || payload.message || String(error && error.message || error);
		return h("div", { class: "alert alert-error", role: "alert" },
			h("div", { class: "alert-title" },
				h("strong", { text: message }),
				faultCode ? h("span", { class: "chip chip-error", text: t("error.code", { code: faultCode }) }) : null),
			hint ? h("p", { class: "alert-hint", text: hint }) : null);
	}

	function notice(text, kind = "muted") {
		return h("div", { class: `notice notice-${kind}` }, text);
	}

	function spinner(text) {
		return h("div", { class: "notice notice-loading" }, h("span", { class: "spinner", "aria-hidden": "true" }), h("span", { text }));
	}

	function table(columns, rows, options = {}) {
		const head = h("tr", null, columns.map((column) => {
			const sortable = options.sort && column.sortKey;
			const active = sortable && options.sort.key === column.sortKey;
			const th = h("th", {
				class: [column.align === "right" ? "num" : "", sortable ? "sortable" : "", active ? "sorted" : ""].join(" ").trim(),
				scope: "col",
				"aria-sort": active ? (options.sort.dir > 0 ? "ascending" : "descending") : null,
			}, column.label, active ? h("span", { class: "sort-arrow", "aria-hidden": "true" }, options.sort.dir > 0 ? "▲" : "▼") : null);
			if (sortable) th.addEventListener("click", () => options.onSort(column.sortKey));
			return th;
		}));
		const body = h("tbody", null, rows.map((row) => {
			const tr = h("tr", { class: options.onRowClick ? "clickable" : null, tabindex: options.onRowClick ? "0" : null },
				columns.map((column) => h("td", { class: column.align === "right" ? "num" : column.className || null }, column.render(row))));
			if (options.onRowClick) {
				tr.addEventListener("click", () => options.onRowClick(row));
				tr.addEventListener("keydown", (event) => {
					if (event.key === "Enter") options.onRowClick(row);
				});
			}
			return tr;
		}));
		return h("div", { class: "table-wrap" }, h("table", { class: "table" }, h("thead", null, head), body));
	}

	function definitionList(entries) {
		return h("dl", { class: "facts" }, entries
			.filter(([, value]) => value !== null && value !== undefined && value !== "")
			.map(([label, value]) => h("div", { class: "fact" }, h("dt", { text: label }), h("dd", null, value))));
	}

	function yesNo(value) {
		if (value === "true") return t("common.yes");
		if (value === "false") return t("common.no");
		return "";
	}

	// ------------------------------------------------------- invoice data --

	// Date range lists from CIS leave out TotPriceWoVAT; it equals TotPrice - TotVATAmt.
	function netAmount(invoice) {
		if (invoice.TotPriceWoVAT !== undefined && invoice.TotPriceWoVAT !== "") return invoice.TotPriceWoVAT;
		if (invoice.TotPrice === undefined) return "";
		return ((Number(invoice.TotPrice) || 0) - (Number(invoice.TotVATAmt) || 0)).toFixed(2);
	}

	function counterparty(invoice, kind) {
		return (kind === "SALES" ? invoice.Buyer : invoice.Seller) || {};
	}

	function verificationUrl(invoice, environment) {
		if (!invoice.IIC) return null;
		const seller = invoice.Seller || {};
		const buyer = invoice.Buyer || {};
		const host = environment === "production" ? "efiskalizimi-app.tatime.gov.al" : "efiskalizimi-app-test.tatime.gov.al";
		const params = new URLSearchParams({
			iic: invoice.IIC,
			tin: (invoice.TypeOfSelfIss ? buyer.IDNum : seller.IDNum) || "",
			crtd: invoice.IssueDateTime || "",
			ord: invoice.InvOrdNum || "",
			bu: invoice.BusinUnitCode || "",
			cr: invoice.TCRCode || "",
			sw: invoice.SoftCode || "",
			prc: invoice.TotPrice || "",
		});
		return `https://${host}/invoice-check/#/verify?${params.toString()}`;
	}

	// Same columns as the command line CSV export (cis_client/convert.py).
	const CSV_COLUMNS = ["IssueDateTime", "InvNum", "TypeOfInv", "IsEinvoice", "SellerNIPT", "SellerName", "BuyerNIPT", "BuyerName",
		"Currency", "ExRate", "TotPriceWoVAT", "TotVATAmt", "TotPrice", "PayMethods", "BusinUnitCode", "TCRCode",
		"OperatorCode", "CorrectiveType", "CorrectiveIICRef", "FIC", "IIC", "EIC", "VerificationUrl"];

	function flatten(invoice, environment) {
		const seller = invoice.Seller || {};
		const buyer = invoice.Buyer || {};
		const currency = invoice.Currency || {};
		const corrective = invoice.CorrectiveInv || {};
		return {
			IssueDateTime: invoice.IssueDateTime, InvNum: invoice.InvNum || invoice.InvOrdNum, TypeOfInv: invoice.TypeOfInv,
			IsEinvoice: invoice.IsEinvoice, SellerNIPT: seller.IDNum, SellerName: seller.Name, BuyerNIPT: buyer.IDNum,
			BuyerName: buyer.Name, Currency: currency.Code || "ALL", ExRate: currency.ExRate, TotPriceWoVAT: netAmount(invoice),
			TotVATAmt: invoice.TotVATAmt, TotPrice: invoice.TotPrice,
			PayMethods: (invoice.PayMethods || []).map((item) => `${item.Type || ""}:${item.Amt || ""}`).join("; "),
			BusinUnitCode: invoice.BusinUnitCode, TCRCode: invoice.TCRCode, OperatorCode: invoice.OperatorCode,
			CorrectiveType: corrective.Type, CorrectiveIICRef: corrective.IICRef, FIC: invoice.FIC, IIC: invoice.IIC,
			EIC: invoice.EIC, VerificationUrl: verificationUrl(invoice, environment),
		};
	}

	function csvCell(value) {
		let text = value === undefined || value === null ? "" : String(value);
		// Keep spreadsheet apps from evaluating text that looks like a formula.
		if (/^[=+\-@\t\r]/.test(text) && !Number.isFinite(Number(text))) text = `'${text}`;
		return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	}

	function toCsv(rows, columns) {
		const lines = [columns.join(",")];
		for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(","));
		return `﻿${lines.join("\r\n")}\r\n`;
	}

	function typeBadges(invoice) {
		const badges = [h("span", { class: `chip ${invoice.TypeOfInv === "CASH" ? "chip-cash" : "chip-noncash"}`, text: t(`type.${invoice.TypeOfInv}`) })];
		if (invoice.IsEinvoice === "true" || invoice.EIC) badges.push(h("span", { class: "chip chip-info", text: t("badge.einvoice") }));
		const corrective = invoice.CorrectiveInv && invoice.CorrectiveInv.Type;
		if (corrective) badges.push(h("span", { class: "chip chip-warn", text: t(`badge.${corrective}`) }));
		if (invoice.IsBadDeb === "true" || invoice.BadDebtInv) badges.push(h("span", { class: "chip chip-warn", text: t("badge.badDebt") }));
		return h("span", { class: "chips" }, badges);
	}

	// --------------------------------------------------------------- state --

	const state = {
		session: null,
		tab: storageGet(TAB_KEY) || "sales",
		bootError: null,
	};

	const root = document.getElementById("app");
	const detailDialog = document.getElementById("detail-dialog");
	const certDialog = document.getElementById("cert-dialog");

	function environment() {
		return (state.session && state.session.environment) || "production";
	}

	// ------------------------------------------------------- invoice view --

	function createInvoiceView(kind) {
		const isSales = kind === "SALES";
		const endpoint = `${API}/cis-invoices/${isSales ? "sales" : "purchases"}`;
		const [from, to] = presetRange("thisMonth");
		const st = {
			from, to, preset: "thisMonth", fic: "", invoices: null, range: null, loading: false, error: null,
			ficError: null, ficLoading: false, filter: "", type: "all", sort: { key: "date", dir: -1 }, page: 0, startedAt: 0,
		};
		let refs = {};
		let ticker = null;

		const partyLabel = () => t(isSales ? "col.buyer" : "col.seller");

		function filtered() {
			const needle = st.filter.trim().toLowerCase();
			let rows = st.invoices || [];
			if (st.type !== "all") {
				rows = rows.filter((invoice) => {
					if (st.type === "einvoice") return invoice.IsEinvoice === "true" || Boolean(invoice.EIC);
					if (st.type === "corrective") return Boolean(invoice.CorrectiveInv);
					return invoice.TypeOfInv === st.type;
				});
			}
			if (needle) {
				rows = rows.filter((invoice) => {
					const party = counterparty(invoice, kind);
					return [invoice.InvNum, invoice.InvOrdNum, party.Name, party.IDNum, invoice.FIC, invoice.IIC, invoice.EIC,
						invoice.TCRCode, invoice.OperatorCode, invoice.BusinUnitCode]
						.some((value) => value && String(value).toLowerCase().includes(needle));
				});
			}
			const { key, dir } = st.sort;
			const value = {
				date: (invoice) => Date.parse(invoice.IssueDateTime) || 0,
				number: (invoice) => Number(invoice.InvOrdNum) || 0,
				party: (invoice) => (counterparty(invoice, kind).Name || "").toLowerCase(),
				net: (invoice) => Number(netAmount(invoice)) || 0,
				vat: (invoice) => Number(invoice.TotVATAmt) || 0,
				total: (invoice) => Number(invoice.TotPrice) || 0,
			}[key];
			// Keys are computed once per row: lists can hold tens of thousands of invoices.
			return rows
				.map((invoice) => [value(invoice), invoice])
				.sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0) * dir)
				.map(([, invoice]) => invoice);
		}

		async function fetchInvoices() {
			if (st.loading) return;
			st.loading = true;
			st.error = null;
			st.startedAt = Date.now();
			update();
			ticker = setInterval(updateStatus, 1000);
			try {
				const { data } = await api(endpoint, { FromDate: st.from, ToDate: st.to, All: true });
				st.invoices = data;
				st.range = [st.from, st.to];
				st.page = 0;
			} catch (error) {
				st.error = error;
			} finally {
				clearInterval(ticker);
				st.loading = false;
				update();
			}
		}

		async function openByFic() {
			const fic = st.fic.trim();
			if (!fic) return;
			st.ficLoading = true;
			st.ficError = null;
			update();
			try {
				const { data } = await api(endpoint, { FIC: fic });
				if (data.length) openInvoice(kind, data[0], true);
				else st.ficError = new ApiError(404, { message: t("inv.notFound") });
			} catch (error) {
				st.ficError = error;
			} finally {
				st.ficLoading = false;
				update();
			}
		}

		function exportRows(format) {
			const rows = filtered();
			const name = `${isSales ? "sales" : "purchases"}_${st.range[0]}_${st.range[1]}`;
			if (format === "csv") download(`${name}.csv`, toCsv(rows.map((row) => flatten(row, environment())), CSV_COLUMNS), "text/csv;charset=utf-8");
			else download(`${name}.json`, JSON.stringify(rows, null, 2), "application/json");
		}

		function setSort(key) {
			st.sort = st.sort.key === key ? { key, dir: -st.sort.dir } : { key, dir: key === "party" ? 1 : -1 };
			update();
		}

		function updateStatus() {
			if (!refs.status) return;
			const elapsed = Math.round((Date.now() - st.startedAt) / 1000);
			refs.status.replaceChildren(st.loading ? spinner(`${t("inv.loading")} ${elapsed ? t("common.seconds", { n: elapsed }) : ""}`) : "");
		}

		function update() {
			if (!refs.results) return;
			refs.fetch.disabled = st.loading;
			refs.ficButton.disabled = st.ficLoading;
			refs.ficStatus.replaceChildren(st.ficError ? errorBox(st.ficError) : "");
			updateStatus();
			const rows = st.invoices ? filtered() : [];
			refs.toolbar.hidden = !st.invoices || st.loading;
			const content = [];
			if (st.error) content.push(errorBox(st.error));
			if (!st.invoices && !st.loading && !st.error) content.push(notice(t("inv.initial")));
			if (st.invoices && !st.loading) {
				const all = st.invoices;
				const sum = (read) => rows.reduce((total, invoice) => total + (Number(read(invoice)) || 0), 0);
				content.push(h("div", { class: "stats" },
					h("div", { class: "stat" }, h("span", { class: "stat-label", text: t("stats.count") }),
						h("span", { class: "stat-value" }, String(rows.length)),
						rows.length !== all.length ? h("span", { class: "stat-sub", text: t("stats.of", { n: all.length }) }) : null),
					h("div", { class: "stat" }, h("span", { class: "stat-label", text: t("stats.net") }), h("span", { class: "stat-value" }, money(sum(netAmount)))),
					h("div", { class: "stat" }, h("span", { class: "stat-label", text: t("stats.vat") }), h("span", { class: "stat-value" }, money(sum((invoice) => invoice.TotVATAmt)))),
					h("div", { class: "stat stat-strong" }, h("span", { class: "stat-label", text: `${t("stats.total")} (ALL)` }), h("span", { class: "stat-value" }, money(sum((invoice) => invoice.TotPrice))))));
				content.push(h("p", { class: "range-note", text: t("inv.periodLabel", { from: formatDate(st.range[0], false), to: formatDate(st.range[1], false) }) }));
				if (!all.length) content.push(notice(t("inv.empty")));
				else if (!rows.length) content.push(notice(t("inv.noMatch")));
				else {
					const pages = Math.ceil(rows.length / PAGE_SIZE);
					st.page = Math.min(st.page, pages - 1);
					const start = st.page * PAGE_SIZE;
					const columns = [
						{ label: t("col.date"), sortKey: "date", render: (invoice) => formatDate(invoice.IssueDateTime) },
						{
							label: t("col.number"), sortKey: "number", render: (invoice) => [
								code(invoice.InvNum || invoice.InvOrdNum),
								!invoice.InvNum && invoice.TCRCode ? h("span", { class: "party-id mono", text: invoice.TCRCode }) : null,
							],
						},
						{
							label: partyLabel(), sortKey: "party", className: "party-cell", render: (invoice) => {
								const party = counterparty(invoice, kind);
								return [h("span", { class: "party-name", text: party.Name || "—" }), party.IDNum ? h("span", { class: "party-id mono", text: party.IDNum }) : null];
							},
						},
						{ label: t("col.type"), render: typeBadges },
						{ label: t("col.net"), sortKey: "net", align: "right", render: (invoice) => money(netAmount(invoice)) },
						{ label: t("col.vat"), sortKey: "vat", align: "right", render: (invoice) => money(invoice.TotVATAmt) },
						{ label: t("col.total"), sortKey: "total", align: "right", render: (invoice) => h("strong", null, money(invoice.TotPrice)) },
					];
					content.push(table(columns, rows.slice(start, start + PAGE_SIZE), {
						sort: st.sort, onSort: setSort, onRowClick: (invoice) => openInvoice(kind, invoice, false),
					}));
					if (pages > 1) {
						content.push(h("div", { class: "pager" },
							h("button", { type: "button", class: "btn btn-small", disabled: st.page === 0, onclick: () => { st.page -= 1; update(); } }, t("pager.prev")),
							h("span", { text: t("pager.range", { from: start + 1, to: Math.min(start + PAGE_SIZE, rows.length), total: rows.length }) }),
							h("button", { type: "button", class: "btn btn-small", disabled: st.page >= pages - 1, onclick: () => { st.page += 1; update(); } }, t("pager.next"))));
					}
				}
			}
			refs.results.replaceChildren(...content);
		}

		function render() {
			const presets = ["today", "yesterday", "thisMonth", "lastMonth", "thisYear", "custom"];
			const fromInput = h("input", { type: "date", value: st.from, required: true, oninput: (event) => { st.from = event.target.value; st.preset = "custom"; presetSelect.value = "custom"; } });
			const toInput = h("input", { type: "date", value: st.to, required: true, oninput: (event) => { st.to = event.target.value; st.preset = "custom"; presetSelect.value = "custom"; } });
			const presetSelect = h("select", {
				onchange: (event) => {
					st.preset = event.target.value;
					if (st.preset !== "custom") {
						[st.from, st.to] = presetRange(st.preset);
						fromInput.value = st.from;
						toInput.value = st.to;
					}
				},
			}, presets.map((preset) => h("option", { value: preset, selected: preset === st.preset }, t(`preset.${preset}`))));
			const fetchButton = h("button", { type: "submit", class: "btn btn-primary" }, t("inv.fetch"));
			const periodForm = h("form", {
				class: "filters",
				onsubmit: (event) => {
					event.preventDefault();
					fetchInvoices();
				},
			},
			h("label", { class: "field" }, h("span", { text: t("inv.period") }), presetSelect),
			h("label", { class: "field" }, h("span", { text: t("inv.from") }), fromInput),
			h("label", { class: "field" }, h("span", { text: t("inv.to") }), toInput),
			h("div", { class: "field field-action" }, fetchButton));

			const ficButton = h("button", { type: "submit", class: "btn" }, t("inv.open"));
			const ficForm = h("form", {
				class: "fic-form",
				onsubmit: (event) => {
					event.preventDefault();
					openByFic();
				},
			},
			h("label", { class: "field field-grow" }, h("span", { text: t("inv.fic") }),
				h("input", { type: "text", class: "mono", value: st.fic, placeholder: t("inv.ficPlaceholder"), spellcheck: "false", autocomplete: "off", oninput: (event) => { st.fic = event.target.value; } })),
			h("div", { class: "field field-action" }, ficButton));

			const filterInput = h("input", { type: "search", value: st.filter, placeholder: t("inv.filter"), oninput: (event) => { st.filter = event.target.value; st.page = 0; update(); } });
			const typeSelect = h("select", { onchange: (event) => { st.type = event.target.value; st.page = 0; update(); } },
				["all", "CASH", "NONCASH", "einvoice", "corrective"].map((type) => h("option", { value: type, selected: type === st.type }, t(`type.${type}`))));
			const toolbar = h("div", { class: "toolbar" },
				h("div", { class: "toolbar-filters" }, filterInput, typeSelect),
				h("div", { class: "toolbar-actions" },
					h("button", { type: "button", class: "btn btn-small", onclick: () => exportRows("csv") }, `↓ ${t("export.csv")}`),
					h("button", { type: "button", class: "btn btn-small", onclick: () => exportRows("json") }, `↓ ${t("export.json")}`)));

			refs = {
				fetch: fetchButton,
				ficButton,
				ficStatus: h("div", { class: "controls-status" }),
				status: h("div"),
				toolbar,
				results: h("div", { class: "results" }),
			};
			const node = h("div", { class: "view" },
				h("div", { class: "card controls" }, periodForm, h("div", { class: "divider" }), ficForm, refs.ficStatus),
				refs.status, toolbar, refs.results);
			update();
			return node;
		}

		return { render };
	}

	// ------------------------------------------------------ invoice detail --

	function section(title, ...content) {
		return h("section", { class: "detail-section" }, h("h3", { text: title }), ...content);
	}

	function partyCard(title, party) {
		if (!party) return null;
		const address = [party.Address, party.Town, party.Country].filter(Boolean).join(", ");
		return h("div", { class: "party-card" },
			h("span", { class: "eyebrow", text: title }),
			h("strong", { text: party.Name || "—" }),
			party.IDNum ? h("span", { class: "mono", text: `${party.IDType ? `${party.IDType} ` : ""}${party.IDNum}` }) : null,
			address ? h("span", { class: "muted", text: address }) : null);
	}

	async function downloadPdf(kind, invoice, button, status) {
		button.disabled = true;
		status.replaceChildren();
		try {
			const { data } = await api(`${API}/einvoice-pdf`, { EIC: invoice.EIC, PartyType: kind === "SALES" ? "SELLER" : "BUYER" });
			const name = (invoice.InvNum || invoice.EIC).replace(/[^\w.-]+/g, "_");
			download(`${name}.pdf`, new Blob([base64ToBytes(data.base64)], { type: "application/pdf" }));
		} catch (error) {
			status.replaceChildren(errorBox(error.status === 404 ? new ApiError(404, { message: t("error.noPdf") }) : error));
		} finally {
			button.disabled = false;
		}
	}

	function renderInvoiceDetail(kind, invoice, { loading, error }) {
		const currency = invoice.Currency;
		const supply = invoice.SupplyDateOrPeriod;
		const verify = verificationUrl(invoice, environment());
		const pdfStatus = h("div");
		const actions = h("div", { class: "detail-actions" },
			verify ? h("a", { class: "btn btn-small", href: verify, target: "_blank", rel: "noopener noreferrer" }, `${t("detail.verify")} ↗`) : null,
			invoice.EIC ? (() => {
				const button = h("button", { type: "button", class: "btn btn-small" }, `↓ ${t("detail.pdf")}`);
				button.addEventListener("click", () => downloadPdf(kind, invoice, button, pdfStatus));
				return button;
			})() : null,
			copyButton(() => JSON.stringify(invoice, null, 2), t("detail.json")));

		const parts = [
			h("div", { class: "detail-head" },
				h("div", null,
					h("h2", { text: t("detail.title", { number: invoice.InvNum || invoice.InvOrdNum || "" }) }),
					typeBadges(invoice)),
				h("div", { class: "detail-total" },
					h("span", { class: "eyebrow", text: `${t("stats.total")} (ALL)` }),
					h("span", { class: "detail-total-value", text: money(invoice.TotPrice) }))),
			actions,
			pdfStatus,
			h("div", { class: "parties" }, partyCard(t("col.seller"), invoice.Seller), partyCard(t("col.buyer"), invoice.Buyer)),
			definitionList([
				[t("detail.issued"), formatDate(invoice.IssueDateTime)],
				[t("detail.registered"), formatDate(invoice.SendDateTime)],
				[t("detail.paymentType"), invoice.TypeOfInv ? t(`type.${invoice.TypeOfInv}`) : ""],
				[t("detail.deadline"), formatDate(invoice.PayDeadline, false)],
				[t("detail.currency"), currency && currency.Code && currency.Code !== "ALL" ? `${currency.Code} · ${currency.ExRate}` : ""],
				[t("detail.supply"), supply ? `${formatDate(supply.Start, false)} – ${formatDate(supply.End, false)}` : ""],
				[t("detail.unit"), code(invoice.BusinUnitCode)],
				[t("detail.tcr"), code(invoice.TCRCode)],
				[t("detail.operator"), code(invoice.OperatorCode)],
				[t("detail.software"), code(invoice.SoftCode)],
				[t("detail.inVat"), yesNo(invoice.IsIssuerInVAT)],
				[t("detail.simplified"), invoice.IsSimplifiedInv === "true" ? t("common.yes") : ""],
				[t("detail.reverse"), invoice.IsReverseCharge === "true" ? t("common.yes") : ""],
				[t("detail.selfIssue"), invoice.TypeOfSelfIss || ""],
				[t("detail.customs"), invoice.ImpCustDecNum || ""],
				["NIVF / FIC", invoice.FIC ? h("span", { class: "with-copy" }, code(invoice.FIC), copyButton(() => invoice.FIC)) : ""],
				["NSLF / IIC", invoice.IIC ? h("span", { class: "with-copy" }, code(invoice.IIC), copyButton(() => invoice.IIC)) : ""],
				["EIC", invoice.EIC ? h("span", { class: "with-copy" }, code(invoice.EIC), copyButton(() => invoice.EIC)) : ""],
			]),
		];

		if (loading) parts.push(spinner(t("detail.loadingItems")));
		if (error) parts.push(errorBox(error));
		if (invoice.Items && invoice.Items.length) {
			parts.push(section(t("detail.items"), table([
				{ label: t("item.name"), render: (item) => [h("span", { text: item.N || "" }), item.EX ? h("span", { class: "chip chip-muted", text: item.EX }) : null] },
				{ label: t("item.code"), render: (item) => code(item.C) },
				{ label: t("item.unit"), render: (item) => item.U || "" },
				{ label: t("item.qty"), align: "right", render: (item) => quantity(item.Q) },
				{ label: t("item.upb"), align: "right", render: (item) => money(item.UPB) },
				{ label: t("item.upa"), align: "right", render: (item) => money(item.UPA) },
				{ label: t("item.discount"), align: "right", render: (item) => (item.R && Number(item.R) ? quantity(item.R) : "") },
				{ label: t("item.vatRate"), align: "right", render: (item) => (item.VR !== undefined ? quantity(item.VR) : "") },
				{ label: t("item.net"), align: "right", render: (item) => money(item.PB) },
				{ label: t("item.vat"), align: "right", render: (item) => money(item.VA) },
				{ label: t("item.total"), align: "right", render: (item) => h("strong", null, money(item.PA)) },
			], invoice.Items)));
		}
		parts.push(section(t("detail.totals"), definitionList([
			[t("stats.net"), money(netAmount(invoice))],
			[t("stats.vat"), money(invoice.TotVATAmt)],
			[t("detail.taxFree"), money(invoice.TaxFreeAmt)],
			[t("detail.markUp"), money(invoice.MarkUpAmt)],
			[t("detail.export"), money(invoice.GoodsExAmt)],
			[t("stats.total"), h("strong", null, money(invoice.TotPrice))],
		]), h("p", { class: "muted small", text: t("detail.allAmounts") })));
		if (invoice.SameTaxes && invoice.SameTaxes.length) {
			parts.push(section(t("detail.taxes"), table([
				{ label: t("tax.rate"), render: (tax) => (tax.VATRate !== undefined ? `${quantity(tax.VATRate)} %` : "") },
				{ label: t("tax.exempt"), render: (tax) => tax.ExemptFromVAT || "" },
				{ label: t("tax.items"), align: "right", render: (tax) => tax.NumOfItems || "" },
				{ label: t("tax.base"), align: "right", render: (tax) => money(tax.PriceBefVAT) },
				{ label: t("tax.vat"), align: "right", render: (tax) => money(tax.VATAmt) },
			], invoice.SameTaxes)));
		}
		if (invoice.PayMethods && invoice.PayMethods.length) {
			parts.push(section(t("detail.payments"), table([
				{ label: t("pay.method"), render: (pay) => [pay.Type || "", pay.CompCard ? h("span", { class: "muted", text: ` · ${pay.CompCard}` }) : null] },
				{ label: t("pay.amount"), align: "right", render: (pay) => money(pay.Amt) },
			], invoice.PayMethods)));
		}
		if (invoice.Fees && invoice.Fees.length) {
			parts.push(section(t("detail.fees"), table([
				{ label: t("pay.method"), render: (fee) => fee.Type || "" },
				{ label: t("pay.amount"), align: "right", render: (fee) => money(fee.Amt) },
			], invoice.Fees)));
		}
		const references = [];
		if (invoice.CorrectiveInv) references.push([t("detail.corrects", { type: invoice.CorrectiveInv.Type || "" }), h("span", null, code(invoice.CorrectiveInv.IICRef), " · ", formatDate(invoice.CorrectiveInv.IssueDateTime))]);
		if (invoice.BadDebtInv) references.push([t("detail.badDebt"), h("span", null, code(invoice.BadDebtInv.IICRef), " · ", formatDate(invoice.BadDebtInv.IssueDateTime))]);
		for (const ref of invoice.SumInvIICRefs || []) references.push([t("detail.summarises"), h("span", null, code(ref.IIC), " · ", formatDate(ref.IssueDateTime))]);
		if (references.length) parts.push(section(t("detail.references"), definitionList(references)));
		return parts;
	}

	function openInvoice(kind, invoice, complete) {
		let current = invoice;
		const close = h("button", { type: "button", class: "dialog-close", "aria-label": t("common.close"), onclick: () => detailDialog.close() }, "×");
		const body = h("div", { class: "dialog-body" });
		const draw = (status) => body.replaceChildren(...renderInvoiceDetail(kind, current, status));
		detailDialog.replaceChildren(close, body);
		draw({ loading: !complete && Boolean(invoice.FIC) });
		if (!detailDialog.open) detailDialog.showModal();
		if (complete || !invoice.FIC) return;
		const endpoint = `${API}/cis-invoices/${kind === "SALES" ? "sales" : "purchases"}`;
		api(endpoint, { FIC: invoice.FIC })
			.then(({ data }) => {
				if (data.length) current = data[0];
				if (detailDialog.contains(body)) draw({});
			})
			.catch((error) => {
				if (detailDialog.contains(body)) draw({ error });
			});
	}

	detailDialog.addEventListener("click", (event) => {
		if (event.target === detailDialog) detailDialog.close();
	});
	certDialog.addEventListener("click", (event) => {
		if (event.target === certDialog) certDialog.close();
	});

	// ----------------------------------------------------- taxpayer view --

	function createTaxpayerView() {
		const st = { term: "", results: null, loading: false, error: null };
		let results = null;
		let button = null;

		async function search() {
			const term = st.term.trim();
			if (term.length < 3 || st.loading) return;
			st.loading = true;
			st.error = null;
			update();
			try {
				st.results = (await api(`${API}/get-taxpayers`, { searchTerm: term })).data;
			} catch (error) {
				st.error = error;
			} finally {
				st.loading = false;
				update();
			}
		}

		function update() {
			if (!results) return;
			button.disabled = st.loading;
			const content = [];
			if (st.loading) content.push(spinner(t("common.loading")));
			else if (st.error) content.push(errorBox(st.error));
			else if (!st.results) content.push(notice(t("tp.initial")));
			else if (!st.results.length) content.push(notice(t("tp.empty")));
			else {
				content.push(table([
					{ label: t("col.nipt"), render: (row) => h("span", { class: "with-copy" }, code(row.Tin), copyButton(() => row.Tin)) },
					{ label: t("col.name"), render: (row) => h("strong", { text: row.Name }) },
					{ label: t("col.address"), render: (row) => row.Address },
					{ label: t("col.town"), render: (row) => row.Town },
					{ label: t("col.country"), render: (row) => row.Country },
				], st.results));
			}
			results.replaceChildren(...content);
		}

		function render() {
			button = h("button", { type: "submit", class: "btn btn-primary" }, t("tp.search"));
			results = h("div", { class: "results" });
			const node = h("div", { class: "view" },
				h("form", {
					class: "card controls search-form",
					onsubmit: (event) => {
						event.preventDefault();
						search();
					},
				},
				h("label", { class: "field field-grow" }, h("span", { text: `${t("col.nipt")} / ${t("col.name")}` }),
					h("input", { type: "search", value: st.term, placeholder: t("tp.placeholder"), minlength: "3", maxlength: "100", required: true, autocomplete: "off", oninput: (event) => { st.term = event.target.value; } })),
				h("div", { class: "field field-action" }, button),
				h("p", { class: "muted small form-note", text: t("tp.note") })),
				results);
			update();
			return node;
		}

		return { render };
	}

	// ---------------------------------------------- lists loaded on demand --

	function createListView(loaders, renderLists) {
		const st = { data: null, loading: false, error: null };
		let container = null;

		async function load() {
			if (st.loading) return;
			st.loading = true;
			st.error = null;
			update();
			try {
				st.data = await Promise.all(loaders.map((path) => api(path, {}).then((reply) => reply.data)));
			} catch (error) {
				st.error = error;
			} finally {
				st.loading = false;
				update();
			}
		}

		function update() {
			if (!container) return;
			const content = [];
			if (st.loading) content.push(spinner(t("common.loading")));
			if (st.error) content.push(errorBox(st.error));
			if (st.data && !st.loading) content.push(...renderLists(st.data));
			container.replaceChildren(...content);
		}

		function render() {
			container = h("div", { class: "results" });
			const node = h("div", { class: "view" },
				h("div", { class: "view-actions" }, h("button", { type: "button", class: "btn btn-small", onclick: load }, `↻ ${t("common.refresh")}`)),
				container);
			if (!st.data && !st.loading && !st.error) load();
			else update();
			return node;
		}

		return { render };
	}

	function isActive(validFrom, validTo) {
		const today = isoDay(new Date());
		return (!validFrom || validFrom <= today) && (!validTo || validTo >= today);
	}

	function statusChip(active) {
		return h("span", { class: `chip ${active ? "chip-ok" : "chip-muted"}`, text: t(active ? "status.active" : "status.inactive") });
	}

	function createOperatorsView() {
		return createListView([`${API}/get-operators`], ([operators]) => [
			h("p", { class: "muted small", text: t("op.note") }),
			operators.length ? table([
				{ label: t("col.name"), render: (row) => h("strong", { text: row.name }) },
				{ label: t("op.code"), render: (row) => h("span", { class: "with-copy" }, code(row.opCode), copyButton(() => row.opCode)) },
				{ label: t("op.id"), render: (row) => code(row.idNumber) },
				{ label: t("op.validFrom"), render: (row) => formatDate(row.validFrom, false) },
				{ label: t("op.validTo"), render: (row) => formatDate(row.validTo, false) },
				{ label: t("op.status"), render: (row) => statusChip(isActive(row.validFrom, row.validTo)) },
			], operators) : notice(t("op.empty")),
		]);
	}

	function createUnitsView() {
		return createListView([`${API}/get-business-units`, `${API}/get-tcrs`], ([units, tcrs]) => [
			h("h3", { class: "list-title", text: t("units.bu") }),
			units.length ? table([
				{ label: t("bu.code"), render: (row) => h("span", { class: "with-copy" }, code(row.BUCode), copyButton(() => row.BUCode)) },
				{ label: t("bu.name"), render: (row) => h("strong", { text: row.BUName || "" }) },
				{ label: t("bu.address"), render: (row) => row.BUStreetName || "" },
				{ label: t("bu.serial"), render: (row) => row.BUSerialNumber || "" },
				{ label: t("op.validFrom"), render: (row) => formatDate(row.BUValidFrom, false) },
				{ label: t("op.validTo"), render: (row) => formatDate(row.BUValidTo, false) },
				{ label: t("op.status"), render: (row) => statusChip(isActive(row.BUValidFrom, row.BUValidTo)) },
			], units) : notice(t("units.empty")),
			h("h3", { class: "list-title", text: t("units.tcr") }),
			tcrs.length ? table([
				{ label: t("tcr.code"), render: (row) => h("span", { class: "with-copy" }, code(row.TCRCode), copyButton(() => row.TCRCode)) },
				{ label: t("tcr.internal"), render: (row) => row.TCRIntID || "" },
				{ label: t("tcr.unit"), render: (row) => code(row.BusinUnitCode) },
				{ label: t("tcr.type"), render: (row) => row.Type || "" },
				{ label: t("tcr.software"), render: (row) => code(row.SoftCode) },
				{ label: t("tcr.maintainer"), render: (row) => code(row.MaintainerCode) },
				{ label: t("op.validFrom"), render: (row) => formatDate(row.ValidFrom, false) },
				{ label: t("op.validTo"), render: (row) => formatDate(row.ValidTo, false) },
				{ label: t("op.status"), render: (row) => statusChip(isActive(row.ValidFrom, row.ValidTo)) },
			], tcrs) : notice(t("units.empty")),
		]);
	}

	let views = null;

	function createViews() {
		views = {
			sales: createInvoiceView("SALES"),
			purchases: createInvoiceView("PURCHASES"),
			taxpayers: createTaxpayerView(),
			operators: createOperatorsView(),
			units: createUnitsView(),
		};
	}

	// --------------------------------------------------------- setup view --

	const setup = { file: null, password: "", environment: "auto", busy: false, error: null };

	function renderSetup() {
		const fileInput = h("input", { type: "file", id: "cert-file", class: "visually-hidden", accept: ".p12,.pfx,.pem" });
		const dropLabel = h("span", { class: "drop-title" });
		const dropMeta = h("span", { class: "drop-meta" });
		const drop = h("label", { class: "dropzone", for: "cert-file" },
			h("span", { class: "drop-icon", "aria-hidden": "true" }, "⇪"), dropLabel, dropMeta);
		const showFile = () => {
			drop.classList.toggle("has-file", Boolean(setup.file));
			dropLabel.textContent = setup.file ? setup.file.name : t("setup.drop");
			dropMeta.textContent = setup.file ? `${Math.max(1, Math.round(setup.file.size / 1024))} KB · ${t("setup.change")}` : ".p12 · .pfx · .pem";
		};
		fileInput.addEventListener("change", () => {
			setup.file = fileInput.files[0] || null;
			showFile();
		});
		drop.addEventListener("dragover", (event) => {
			event.preventDefault();
			drop.classList.add("dragging");
		});
		drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
		drop.addEventListener("drop", (event) => {
			event.preventDefault();
			drop.classList.remove("dragging");
			if (event.dataTransfer.files[0]) {
				setup.file = event.dataTransfer.files[0];
				showFile();
			}
		});
		showFile();

		const environments = ["auto", "production", "test"];
		const envGroup = h("div", { class: "segmented", role: "radiogroup", "aria-label": t("setup.environment") },
			environments.map((value) => h("label", { class: "segment" },
				h("input", { type: "radio", name: "environment", value, checked: setup.environment === value, onchange: () => { setup.environment = value; } }),
				h("span", { text: t(`env.${value}`) }))));

		const status = h("div", { class: "setup-status" });
		const submit = h("button", { type: "submit", class: "btn btn-primary btn-large" }, t("setup.load"));
		const showStatus = () => {
			submit.disabled = setup.busy;
			status.replaceChildren(setup.busy ? spinner(t("setup.loading")) : setup.error ? errorBox(setup.error) : "");
		};

		const form = h("form", {
			class: "setup-form",
			onsubmit: async (event) => {
				event.preventDefault();
				if (!setup.file) {
					setup.error = new ApiError(400, { message: t("setup.noFile") });
					showStatus();
					return;
				}
				setup.busy = true;
				setup.error = null;
				showStatus();
				try {
					const certificate = bytesToBase64(await setup.file.arrayBuffer());
					const { data } = await api("/api/session", {
						certificate,
						password: setup.password,
						environment: setup.environment === "auto" ? null : setup.environment,
						fileName: setup.file.name,
					});
					setup.password = "";
					setup.file = null;
					state.session = data;
					createViews();
					render();
				} catch (error) {
					setup.error = error;
				} finally {
					setup.busy = false;
					showStatus();
				}
			},
		},
		fileInput, drop,
		h("label", { class: "field" }, h("span", { text: t("setup.password") }),
			h("input", { type: "password", value: setup.password, autocomplete: "off", oninput: (event) => { setup.password = event.target.value; } })),
		h("div", { class: "field" }, h("span", { text: t("setup.environment") }), envGroup),
		submit, status);
		showStatus();

		return h("div", { class: "setup" },
			h("div", { class: "card setup-card" },
				h("h1", { text: t("setup.title") }),
				h("p", { class: "lead", text: t("setup.lead") }),
				form,
				h("p", { class: "privacy", text: t("setup.privacy") })));
	}

	// ---------------------------------------------------- session / shell --

	function envChip(env) {
		return h("span", { class: `env env-${env}`, text: t(`env.${env}`) });
	}

	function renderSessionSlot() {
		const slot = document.getElementById("session-slot");
		if (!state.session || !state.session.loaded) {
			slot.replaceChildren();
			return;
		}
		const cert = state.session.certificate;
		slot.replaceChildren(h("button", { type: "button", class: "session-chip", onclick: openCertificateDialog },
			envChip(state.session.environment),
			h("span", { class: "session-name", text: cert.name || cert.commonName || "" }),
			cert.nipt ? h("span", { class: "session-nipt mono", text: cert.nipt }) : null,
			cert.expired ? h("span", { class: "chip chip-error", text: t("cert.expired") }) : null));
	}

	function openCertificateDialog() {
		const session = state.session;
		const cert = session.certificate;
		const other = session.environment === "production" ? "test" : "production";
		const status = h("div");
		const switchButton = h("button", { type: "button", class: "btn" }, t("cert.switch", { env: t(`env.${other}`) }));
		switchButton.addEventListener("click", async () => {
			switchButton.disabled = true;
			status.replaceChildren(spinner(t("setup.loading")));
			try {
				state.session = (await api("/api/session/environment", { environment: other })).data;
				createViews();
				certDialog.close();
				render();
			} catch (error) {
				status.replaceChildren(errorBox(error));
			} finally {
				switchButton.disabled = false;
			}
		});
		const unload = h("button", { type: "button", class: "btn btn-danger" }, t("cert.unload"));
		unload.addEventListener("click", async () => {
			try {
				state.session = (await api("/api/session", undefined, "DELETE")).data;
			} catch (error) {
				status.replaceChildren(errorBox(error));
				return;
			}
			views = null;
			certDialog.close();
			render();
		});
		certDialog.replaceChildren(
			h("button", { type: "button", class: "dialog-close", "aria-label": t("common.close"), onclick: () => certDialog.close() }, "×"),
			h("div", { class: "dialog-body" },
				h("h2", { text: t("cert.title") }),
				definitionList([
					[t("cert.business"), cert.name || cert.commonName],
					[t("cert.nipt"), code(cert.nipt)],
					[t("cert.environment"), envChip(session.environment)],
					[t("cert.status"), session.verified ? h("span", { class: "chip chip-ok", text: t("cert.verified") }) : h("span", { class: "chip chip-warn", text: t("cert.unverified") })],
					[t("cert.validity"), h("span", null, `${formatDate(cert.validFrom, false)} – ${formatDate(cert.validTo, false)} `, cert.expired ? h("span", { class: "chip chip-error", text: t("cert.expired") }) : null)],
					[t("cert.issuer"), cert.issuer],
					[t("cert.serial"), code(cert.serialNumber)],
					[t("cert.fingerprint"), h("code", { class: "mono wrap", text: cert.fingerprintSha256 })],
				]),
				session.warning ? h("div", { class: "alert alert-warn", text: session.warning }) : null,
				status,
				h("div", { class: "dialog-actions" }, switchButton, unload)));
		certDialog.showModal();
	}

	function renderWorkspace() {
		if (!views) createViews();
		const tabs = ["sales", "purchases", "taxpayers", "operators", "units"];
		if (!tabs.includes(state.tab)) state.tab = "sales";
		const nav = h("nav", { class: "tabs", role: "tablist" }, tabs.map((tab) => h("button", {
			type: "button",
			role: "tab",
			class: "tab",
			"aria-selected": String(tab === state.tab),
			onclick: () => {
				state.tab = tab;
				storageSet(TAB_KEY, tab);
				render();
			},
		}, t(`tabs.${tab}`))));
		return h("div", { class: "workspace" },
			state.session.warning ? h("div", { class: "alert alert-warn", text: state.session.warning }) : null,
			nav,
			h("div", { class: "panel", role: "tabpanel" }, views[state.tab].render()));
	}

	function applyStaticText() {
		document.documentElement.lang = lang;
		for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
		for (const button of document.querySelectorAll("[data-lang]")) button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
	}

	function render() {
		applyStaticText();
		renderSessionSlot();
		if (state.bootError) {
			root.replaceChildren(errorBox(state.bootError));
			return;
		}
		root.replaceChildren(state.session && state.session.loaded ? renderWorkspace() : renderSetup());
	}

	for (const button of document.querySelectorAll("[data-lang]")) {
		button.addEventListener("click", () => {
			lang = button.dataset.lang;
			storageSet(LANG_KEY, lang);
			if (detailDialog.open) detailDialog.close();
			if (certDialog.open) certDialog.close();
			render();
		});
	}

	async function boot() {
		try {
			state.session = (await api("/api/session", undefined, "GET")).data;
		} catch (error) {
			state.bootError = error;
		}
		render();
	}

	boot();
})();
