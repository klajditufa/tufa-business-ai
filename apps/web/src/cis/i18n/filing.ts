export const filingEn = {
  "filing.statusUnavailable": "Connection status is unavailable. Reconnecting automatically…",
  "filing.pageReady":
    "Page data is available below: {tables} tables, {forms} forms. Choose a portal link or refresh the current page.",
  "filing.readingPage": "Reading the current C@ts page…",
  "filing.navigation": "C@ts menu",
  "filing.choosePage": "Choose a portal page",
  "filing.findPage": "Find a portal page",
  "filing.noNavigation":
    "No supported menu links were found on this page. Refresh or use the official portal.",
  "filing.navigationHelp":
    "Links read from the current portal page. Submission, payments and unsupported controls are completed in the official portal.",

  "filing.outcome.unknown": "Check the official portal and try again.",
  "filing.outcome.captureFailed": "This page could not be captured. Open a smaller section and retry.",
  "filing.outcome.expired": "The action expired. Retry the connection or capture.",
  "filing.outcome.unavailable": "e-Albania did not finish signing in. Retry the connection.",
  "filing.outcome.credentials":
    "e-Albania did not accept the NUIS or password. Change the credentials above.",
  "filing.outcome.captcha": "Complete the CAPTCHA in the official portal using the optional extension.",
  "filing.outcome.otp": "Enter the verification code sent by e-Albania.",
  "filing.outcome.authenticated": "Signed in to e-Filing. Business identity verified.",
  "filing.outcome.unsupported":
    "This portal control or login variant is not supported. Use the official portal.",
  "filing.outcome.login": "Complete e-Albania authentication in the official portal.",
  "filing.outcome.taxpayer": "The portal taxpayer does not match this business.",
  "filing.outcome.changed": "The portal form changed. Capture it again.",
  "filing.outcome.ok": "Action completed",
  "filing.cancelEdit": "Cancel",
  "filing.editCredentials": "Change e-Albania credentials",
  "setup.attachCertificateHint":
    "Add a fiscalization certificate to open sales, purchases, invoice items, operators and business units.",
  "filing.preparingConnection": "Preparing the e-Albania connection…",
  "filing.retryConnection": "Retry connection",
  "filing.advancedConnection": "Advanced: use the browser extension",
  "filing.verificationCode": "e-Albania verification code",
  "filing.verify": "Verify code",
  "filing.auth.connecting": "Signing in to e-Albania as this business…",
  "filing.auth.authenticated": "Signed in to e-Filing. Business identity verified.",
  "filing.auth.otp": "e-Albania requires the verification code sent to your phone, email or authenticator.",
  "filing.auth.captcha":
    "e-Albania requires a CAPTCHA. Complete it in the official portal using the optional browser extension.",
  "filing.auth.credentials": "Enter or check this business’s e-Albania NUIS and password.",
  "filing.auth.unavailable": "e-Albania did not finish signing in. Retry the connection.",
  "filing.auth.taxpayer":
    "The signed-in taxpayer does not match this business. Check its NUIS before continuing.",
  "filing.managedError.runtime":
    "Connection setup could not finish. Check that Node.js 22.18+ is installed, then retry.",
  "filing.managedError.launch": "The e-Albania connection could not start. Retry the connection.",
  "filing.managedError.install":
    "Browser setup did not complete. Check the network and Node/npm installation, then retry.",
  "filing.managedError.protocol": "The connection ended unexpectedly. Retry to sign in again.",
  "setup.chooseTitle": "Add a business",
  "setup.chooseLead": "Load a certificate for invoices, or add a business by NIPT for e-Filing.",
  "setup.withCertificate": "With certificate",
  "setup.filingOnly": "e-Filing only",
  "setup.filingLead":
    "Add the business NIPT and its e-Albania credentials to connect automatically. You can attach the fiscalization certificate later for invoices.",
  "setup.businessName": "Business name (optional)",
  "setup.addFiling": "Add e-Filing business",
  "setup.certificateNeeded":
    "A fiscalization certificate is needed for invoices, items and CIS registers. This business can use e-Filing independently.",
  "biz.profile": "Business details",
  "biz.addCertificate": "Add certificate for this business",
  "biz.remove": "Remove business from session",
  "tabs.filing": "e-Filing",
  "filing.add": "Add e-Albania credentials (optional)",
  "filing.credentialsHelp":
    "Use this business’s e-Albania NUIS and password. The app signs in to e-Filing automatically through e-Albania. Invoice retrieval uses the fiscalization certificate.",
  "filing.username": "e-Albania NUIS / NIPT",
  "filing.password": "e-Albania password",
  "filing.remember": "Remember encrypted on this computer",
  "filing.rememberHelp":
    "Unchecked uses these credentials for this session and keeps any earlier saved entry. Use Forget to delete saved credentials.",
  "filing.passphrase": "Vault passphrase",
  "filing.passphraseHelp":
    "At least 12 characters. Needed again after restarting the app; keep it separate from the portal password.",
  "filing.lead": "Prepare declarations and inspect account information through your own tax portal session.",
  "filing.limit":
    "Only the current portal page is shown. Complete validation, submission and payments in the official portal.",
  "filing.credentials": "Login details",
  "filing.save": "Save login details",
  "filing.saved": "Login details are available for this session.",
  "filing.locked": "Encrypted login details are saved. Unlock them with your vault passphrase.",
  "filing.unlock": "Unlock saved login details",
  "filing.forget": "Remove login details and saved entry",
  "filing.browser": "e-Albania connection",
  "filing.browserHelp":
    "Install the companion once in Chrome or Edge. Each business has its own paired portal tab. Keep the local app and portal tab open.",
  "filing.install": "Download browser companion",
  "filing.installHelp":
    "Extract the ZIP. In Chrome / Edge → Extensions, turn on Developer mode → Load unpacked → select the extracted folder containing manifest.json.",
  "filing.pair": "Generate pairing code",
  "filing.pairHelp":
    "Open the companion popup, enter this address and code, and click Connect. Reload an already open portal tab. The code expires after 5 minutes and works once.",
  "filing.address": "Local app address",
  "filing.code": "Pairing code",
  "filing.connected": "Connected",
  "filing.disconnected": "Disconnected",
  "filing.disconnect": "Disconnect",
  "filing.open": "Open e-Filing portal",
  "filing.focus": "Go to paired portal tab",
  "filing.loginHelp":
    "Sign in with e-Albania in the paired portal tab. The extension does not receive your e-Albania password.",
  "filing.capture": "Refresh portal data",
  "filing.captureHelp":
    "In the portal, select this business's taxpayer and open payroll (ESIG025), VAT, another declaration or the account balance. Its NIPT must be visible in the account header. Then capture the page here.",
  "filing.payroll":
    "For unchanged payroll, open the portal's prefilled ESIG025 for the correct period. Check employees, salaries, personal status and contributions before validating and submitting there. CIS invoice totals alone do not form a VAT return.",
  "filing.snapshot": "Portal page",
  "filing.captured": "Captured at {time}",
  "filing.noCapture": "Connect the companion and capture the portal section you want to review.",
  "filing.form": "Portal form",
  "filing.search": "Find a field by label",
  "filing.tables": "Portal tables ({n})",
  "filing.table": "Table {n}",
  "filing.confirm": "I checked the taxpayer, reporting period and all amounts on every relevant portal page.",
  "filing.review": "Review draft",
  "filing.reviewed": "Reviewed changes ({n})",
  "filing.field": "Field",
  "filing.before": "Portal value",
  "filing.after": "Reviewed value",
  "filing.noChanges":
    "No fields changed. Continue in the portal to validate and submit the prefilled declaration.",
  "filing.apply": "Apply reviewed edits to portal",
  "filing.applyHelp":
    "The companion checks that the taxpayer and page have not changed, applies these edits once, and captures the page again. Check portal calculations before filing.",
  "filing.export": "Download portal capture",
  "filing.pending": "Waiting for the paired portal tab…",
  "filing.manual": "Complete unsupported controls and pages directly in the portal.",
  "filing.column": "Column {n}",
  "filing.report": "Portal table report",
  "filing.reportNote":
    "Copy of the captured portal table. Includes the visible page only; amounts and labels are preserved as displayed.",
  // TUFA: lidhja përmes shtesës së Chrome në vend të shfletuesit lokal të cis-client.
  "filing.auth.otp-wrong": "The code was not accepted. Enter the new code e-Albania sent you.",
  "filing.auth.otp-failed": "The code was rejected several times. Retry the connection.",
  "filing.auth.verifying": "Verifying the code…",
  "filing.auth.portal": "Signed in, but the business NIPT was not found in the portal header. Check the portal tab.",
  "filing.auth.login": "Complete e-Albania authentication in the official portal.",
  "filing.auth.unsupported": "This login variant is not supported. Complete the sign-in in the official portal.",
  "filing.auth.cancelled": "Sign-in cancelled.",
  "filing.auth.closed": "The portal tab was closed.",
  "filing.auth.noextension": "The “TUFA · e-Filing” extension did not respond.",
  "filing.connect": "Connect to e-Filing",
  "filing.managedError.extension": "Install the “TUFA · e-Filing” extension once in Chrome (Advanced below), then return to this page.",
  "filing.managedError.extensionOld": "Update the “TUFA · e-Filing” extension to the latest version (Advanced below).",
  "filing.cancelConnect": "Cancel",
  "filing.tufaBrowserHelp":
    "TUFA signs in to e-Filing through the “TUFA · e-Filing” Chrome extension, in your own browser. Install it once; keep the portal tab open while you work.",
  "filing.extensionMissing": "Install the “TUFA · e-Filing” extension once in Chrome, then reload this page.",
  "filing.extensionOld": "Update the “TUFA · e-Filing” extension (you have {have}, {need} is required).",
  "filing.extensionReady": "Extension {version} connected",
  "filing.outcome.nopage": "Open the e-Filing portal in Chrome (or connect) and try again.",
  "filing.outcome.noextension": "The “TUFA · e-Filing” extension did not respond.",
  "filing.payrollDetected": "This page looks like a C@TS payroll. You can import it into TUFA's payroll.",
  "filing.openPayroll": "Import into payroll",
} as const;

export const filingSq: Record<keyof typeof filingEn, string> = {
  "filing.statusUnavailable":
    "Gjendja e lidhjes nuk është e disponueshme. Po provohet përsëri automatikisht…",
  "filing.pageReady":
    "Të dhënat e faqes janë më poshtë: {tables} tabela, {forms} formularë. Zgjidhni një lidhje portali ose rifreskoni faqen aktuale.",
  "filing.readingPage": "Duke lexuar faqen aktuale C@ts…",
  "filing.navigation": "Menuja C@ts",
  "filing.choosePage": "Zgjidhni faqen e portalit",
  "filing.findPage": "Kërkoni faqen e portalit",
  "filing.noNavigation":
    "Nuk u gjetën lidhje menuje të mbështetura në këtë faqe. Rifreskoni ose përdorni portalin zyrtar.",
  "filing.navigationHelp":
    "Lidhje të lexuara nga faqja aktuale e portalit. Deklarimi, pagesat dhe kontrollet e pambështetura përfundohen në portalin zyrtar.",

  "filing.outcome.unknown": "Kontrolloni portalin zyrtar dhe provoni përsëri.",
  "filing.outcome.captureFailed": "Kjo faqe nuk u mor. Hapni një seksion më të vogël dhe riprovoni.",
  "filing.outcome.expired": "Veprimi skadoi. Riprovoni lidhjen ose marrjen e faqes.",
  "filing.outcome.unavailable": "e-Albania nuk e përfundoi hyrjen. Riprovoni lidhjen.",
  "filing.outcome.credentials":
    "e-Albania nuk pranoi NUIS-in ose fjalëkalimin. Ndryshoni të dhënat më sipër.",
  "filing.outcome.captcha": "Plotësoni CAPTCHA në portalin zyrtar duke përdorur shtesën opsionale.",
  "filing.outcome.otp": "Vendosni kodin e verifikimit të dërguar nga e-Albania.",
  "filing.outcome.authenticated": "Hyrja në e-Filing u krye. Identiteti i subjektit u verifikua.",
  "filing.outcome.unsupported": "Ky kontroll ose variant hyrjeje nuk mbështetet. Përdorni portalin zyrtar.",
  "filing.outcome.login": "Përfundoni identifikimin me e-Albania në portalin zyrtar.",
  "filing.outcome.taxpayer": "Subjekti në portal nuk përputhet me këtë biznes.",
  "filing.outcome.changed": "Formulari në portal ndryshoi. Merreni përsëri.",
  "filing.outcome.ok": "Veprimi përfundoi",
  "filing.cancelEdit": "Anulo",
  "filing.editCredentials": "Ndrysho të dhënat e e-Albania",
  "setup.attachCertificateHint":
    "Shtoni certifikatën e fiskalizimit për të hapur shitjet, blerjet, artikujt, operatorët dhe njësitë.",
  "filing.preparingConnection": "Duke përgatitur lidhjen me e-Albania…",
  "filing.retryConnection": "Riprovo lidhjen",
  "filing.advancedConnection": "Të avancuara: përdor shtesën e shfletuesit",
  "filing.verificationCode": "Kodi i verifikimit të e-Albania",
  "filing.verify": "Verifiko kodin",
  "filing.auth.connecting": "Duke hyrë në e-Albania si biznes…",
  "filing.auth.authenticated": "Hyrja në e-Filing u krye. Identiteti i subjektit u verifikua.",
  "filing.auth.otp": "e-Albania kërkon kodin e dërguar në telefon, email ose aplikacionin e autentifikimit.",
  "filing.auth.captcha":
    "e-Albania kërkon CAPTCHA. Plotësojeni në portalin zyrtar duke përdorur shtesën opsionale të shfletuesit.",
  "filing.auth.credentials":
    "Vendosni ose kontrolloni NUIS-in dhe fjalëkalimin e e-Albania për këtë subjekt.",
  "filing.auth.unavailable": "e-Albania nuk e përfundoi hyrjen. Riprovoni lidhjen.",
  "filing.auth.taxpayer":
    "Subjekti në portal nuk përputhet me këtë biznes. Kontrolloni NUIS-in përpara se të vazhdoni.",
  "filing.managedError.runtime":
    "Konfigurimi i lidhjes nuk përfundoi. Kontrolloni që Node.js 22.18+ është instaluar, pastaj riprovoni.",
  "filing.managedError.launch": "Lidhja me e-Albania nuk filloi. Riprovoni lidhjen.",
  "filing.managedError.install":
    "Instalimi nuk përfundoi. Kontrolloni rrjetin dhe instalimin e Node/npm, pastaj riprovoni.",
  "filing.managedError.protocol": "Lidhja u ndërpre papritur. Riprovoni për të hyrë përsëri.",
  "setup.chooseTitle": "Shtoni një subjekt",
  "setup.chooseLead": "Ngarkoni certifikatën për faturat, ose shtoni subjektin me NIPT për e-Filing.",
  "setup.withCertificate": "Me certifikatë",
  "setup.filingOnly": "Vetëm e-Filing",
  "setup.filingLead":
    "Shtoni NIPT-in dhe të dhënat e e-Albania të subjektit për lidhje automatike. Certifikatën e fiskalizimit për faturat mund ta shtoni më vonë.",
  "setup.businessName": "Emri i subjektit (opsional)",
  "setup.addFiling": "Shto subjektin në e-Filing",
  "setup.certificateNeeded":
    "Për faturat, artikujt dhe regjistrat CIS nevojitet certifikata e fiskalizimit. Ky subjekt mund të përdorë e-Filing në mënyrë të pavarur.",
  "biz.profile": "Detajet e subjektit",
  "biz.addCertificate": "Shto certifikatën për këtë subjekt",
  "biz.remove": "Hiq subjektin nga sesioni",
  "tabs.filing": "e-Filing",
  "filing.add": "Shto të dhënat e e-Albania (opsionale)",
  "filing.credentialsHelp":
    "Përdorni NUIS-in dhe fjalëkalimin e e-Albania të subjektit. Aplikacioni hyn automatikisht në e-Filing përmes e-Albania. Faturat merren me certifikatën e fiskalizimit.",
  "filing.username": "NUIS / NIPT i e-Albania",
  "filing.password": "Fjalëkalimi i e-Albania",
  "filing.remember": "Ruaji të enkriptuara në këtë kompjuter",
  "filing.rememberHelp":
    "Pa këtë zgjedhje, kredencialet përdoren për këtë sesion dhe ruhet kopja e mëparshme. Përdorni Harro për ta fshirë.",
  "filing.passphrase": "Fjalëkalimi i kasafortës",
  "filing.passphraseHelp":
    "Të paktën 12 karaktere. Kërkohet pas rinisjes së aplikacionit; mbajeni të ndarë nga fjalëkalimi i portalit.",
  "filing.lead": "Përgatitni deklaratat dhe shihni gjendjen përmes sesionit tuaj në portalin e tatimeve.",
  "filing.limit":
    "Shfaqet vetëm faqja aktuale e portalit. Verifikimi, deklarimi dhe pagesat përfundohen në portalin zyrtar.",
  "filing.credentials": "Të dhënat e hyrjes",
  "filing.save": "Ruaj të dhënat e hyrjes",
  "filing.saved": "Të dhënat e hyrjes janë të gatshme për këtë sesion.",
  "filing.locked":
    "Të dhënat e hyrjes janë ruajtur të enkriptuara. Zhbllokojini me fjalëkalimin e kasafortës.",
  "filing.unlock": "Zhblloko të dhënat e ruajtura",
  "filing.forget": "Hiq të dhënat nga sesioni dhe kasaforta",
  "filing.browser": "Lidhja me e-Albania",
  "filing.browserHelp":
    "Instaloni një herë shtesën në Chrome ose Edge. Çdo subjekt ka skedën e vet të lidhur. Mbajeni aplikacionin lokal dhe skedën e portalit të hapur.",
  "filing.install": "Shkarko shtesën e shfletuesit",
  "filing.installHelp":
    "Çpaketoni ZIP-in. Në Chrome / Edge → Extensions, aktivizoni Developer mode → Load unpacked → zgjidhni dosjen që përmban manifest.json.",
  "filing.pair": "Gjenero kodin e lidhjes",
  "filing.pairHelp":
    "Hapni shtesën, shkruani adresën dhe kodin, pastaj klikoni Connect. Ringarkoni skedën nëse ishte e hapur. Kodi skadon pas 5 minutash dhe përdoret vetëm një herë.",
  "filing.address": "Adresa e aplikacionit lokal",
  "filing.code": "Kodi i lidhjes",
  "filing.connected": "I lidhur",
  "filing.disconnected": "I shkëputur",
  "filing.disconnect": "Shkëputu",
  "filing.open": "Hap portalin e-Filing",
  "filing.focus": "Shko te skeda e lidhur e portalit",
  "filing.loginHelp":
    "Hyni me e-Albania në skedën e lidhur të portalit. Shtesa nuk merr fjalëkalimin tuaj të e-Albania.",
  "filing.capture": "Rifresko të dhënat e portalit",
  "filing.captureHelp":
    "Në portal, zgjidhni këtë subjekt dhe hapni listëpagesën (ESIG025), TVSH-në, një deklaratë tjetër ose gjendjen e llogarisë. NIPT-i duhet të duket te kreu i llogarisë. Pastaj merrni faqen këtu.",
  "filing.payroll":
    "Për listëpagesë pa ndryshime, hapni ESIG025 e parambushur për periudhën e saktë. Kontrolloni punonjësit, pagat, statusin personal dhe kontributet përpara vlerësimit dhe dorëzimit në portal. Vetëm totalet e CIS nuk përbëjnë deklaratën e TVSH-së.",
  "filing.snapshot": "Faqja e portalit",
  "filing.captured": "Marrë në {time}",
  "filing.noCapture": "Lidhni shtesën dhe merrni seksionin e portalit që dëshironi të kontrolloni.",
  "filing.form": "Formulari i portalit",
  "filing.search": "Gjej një fushë sipas emërtimit",
  "filing.tables": "Tabelat e portalit ({n})",
  "filing.table": "Tabela {n}",
  "filing.confirm":
    "Kontrollova subjektin, periudhën dhe të gjitha shumat në çdo faqe përkatëse të portalit.",
  "filing.review": "Rishiko draftin",
  "filing.reviewed": "Ndryshimet e kontrolluara ({n})",
  "filing.field": "Fusha",
  "filing.before": "Vlera në portal",
  "filing.after": "Vlera e kontrolluar",
  "filing.noChanges":
    "Nuk ka ndryshime. Vazhdoni në portal për të vlerësuar dhe dorëzuar deklaratën e parambushur.",
  "filing.apply": "Zbato ndryshimet e kontrolluara në portal",
  "filing.applyHelp":
    "Shtesa kontrollon që subjekti dhe faqja nuk kanë ndryshuar, zbaton ndryshimet një herë dhe merr faqen sërish. Kontrolloni llogaritjet e portalit para dorëzimit.",
  "filing.export": "Shkarko kopjen e faqes së portalit",
  "filing.pending": "Në pritje të skedës së lidhur të portalit…",
  "filing.manual": "Plotësoni fushat dhe faqet e pambështetura drejtpërdrejt në portal.",
  "filing.column": "Kolona {n}",
  "filing.report": "Raport i tabelës së portalit",
  "filing.reportNote":
    "Kopje e tabelës së marrë nga portali. Përfshin vetëm faqen e dukshme; shumat dhe emërtimet ruhen siç shfaqen.",
  "filing.auth.otp-wrong": "Kodi nuk u pranua. Shkruani kodin e ri që ju dërgoi e-Albania.",
  "filing.auth.otp-failed": "Kodi u refuzua disa herë. Riprovoni lidhjen.",
  "filing.auth.verifying": "Po verifikohet kodi…",
  "filing.auth.portal": "Hyrja u krye, por NIPT-i i subjektit nuk u gjet te kreu i portalit. Kontrolloni skedën e portalit.",
  "filing.auth.login": "Përfundoni identifikimin me e-Albania në portalin zyrtar.",
  "filing.auth.unsupported": "Ky variant hyrjeje nuk mbështetet. Përfundoni hyrjen në portalin zyrtar.",
  "filing.auth.cancelled": "Hyrja u anulua.",
  "filing.auth.closed": "Skeda e portalit u mbyll.",
  "filing.auth.noextension": "Shtesa “TUFA · e-Filing” nuk u përgjigj.",
  "filing.connect": "Lidhu me e-Filing",
  "filing.managedError.extension": "Instaloni një herë shtesën “TUFA · e-Filing” në Chrome (Të avancuara më sipër), pastaj kthehuni te kjo faqe.",
  "filing.managedError.extensionOld": "Përditësoni shtesën “TUFA · e-Filing” në versionin e fundit (Të avancuara më sipër).",
  "filing.cancelConnect": "Anulo",
  "filing.tufaBrowserHelp":
    "TUFA hyn në e-Filing përmes shtesës “TUFA · e-Filing” të Chrome, në shfletuesin tuaj. Instalojeni një herë; mbajeni skedën e portalit të hapur gjatë punës.",
  "filing.extensionMissing": "Instaloni një herë shtesën “TUFA · e-Filing” në Chrome, pastaj rifreskoni këtë faqe.",
  "filing.extensionOld": "Përditësoni shtesën “TUFA · e-Filing” (keni {have}, duhet {need}).",
  "filing.extensionReady": "Shtesa {version} është e lidhur",
  "filing.outcome.nopage": "Hapni portalin e-Filing në Chrome (ose lidhuni) dhe provoni sërish.",
  "filing.outcome.noextension": "Shtesa “TUFA · e-Filing” nuk u përgjigj.",
  "filing.payrollDetected": "Kjo faqe duket si listëpagesë e C@TS. Mund ta importoni te Listëpagesa e TUFA.",
  "filing.openPayroll": "Importo te Listëpagesa",
};
