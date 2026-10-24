# TUFA · e-Filing (shtesë Chrome) · v1.2

Lidh TUFA Business AI me e-Filing (C@TS) në shfletuesin e përdoruesit, si lidhja e cis-client-2.

## Hyrja me e-Albania
- Te TUFA, te "Shtoni një subjekt" / "Shto certifikatën" ose te skeda **e-Filing**, shto **të dhënat e e-Albania** të subjektit (NUIS = NIPT i subjektit
  dhe fjalëkalimi). Ato mbahen vetëm në këtë shfletues: për sesionin, ose të enkriptuara me
  "fjalëkalimin e kasafortës" (AES-GCM, PBKDF2). Nuk dërgohen kurrë te serveri i TUFA.
- **Lidhu me e-Filing** (skeda e-Filing): shtesa hap portalin, klikon "e-Albania", zgjedh "Biznes", plotëson
  NUIS-in dhe fjalëkalimin dhe dërgon formularin **një herë**.
  - Kodi i verifikimit (OTP) shkruhet nga përdoruesi te TUFA.
  - CAPTCHA nuk prekët: përdoruesi e plotëson vetë në portal.
  - Hyrja e vjetër e e-Filing (përdorues/fjalëkalim i C@TS) nuk plotësohet kurrë.
- Fjalëkalimi qëndron te shtesa vetëm në `chrome.storage.session` (në kujtesë, i palexueshëm nga
  faqet) dhe fshihet sapo plotësohet, ose kur hyrja mbaron (maksimumi 4 minuta).

## Skeda e-Filing te TUFA (si FilingView i cis-client-2)
- `portal.js` gjenerohet nga `extension/src/portal.ts` (portal.ts i cis-client-2, pa ndryshime logjike):
  lexon formularët (pa fjalëkalime/CSRF/OTP), tabelat dhe lidhjet e sigurta të menysë së C@TS.
- **Menuja C@ts:** hap vetëm lidhjet që portal.js nxori nga i njëjti rishikim i faqes (jo dorëzim, pagesë, fshirje, dalje).
- **Rishiko draftin → Zbato:** vendos vlerat e rishikuara në fushat e formularit, vetëm nëse faqja nuk ka ndryshuar;
  formulari nuk dërgohet. Vlerësimi, dorëzimi dhe pagesa bëhen nga përdoruesi në portal.

## Leximi i faqeve
- Popup-i "Dërgo në TUFA": URL-ja, titulli, NIPT-i i vetëm në kokën e faqes dhe tabelat e dukshme.
  Fjalëkalimet dhe cookies nuk lexohen kurrë. Nuk dorëzohet asnjë deklaratë.
- Te skeda e-Filing: **Rifresko të dhënat e portalit**; listëpagesat kalojnë me "Importo te Listëpagesa".
- NIPT-i i faqes duhet të jetë i njëjtë me subjektin në TUFA.

## Instalimi (pa Chrome Web Store)
1. Shkarko `tufa-efiling.zip` nga TUFA → Listëpagesa → "Shtesa e-Filing" dhe hape (unzip).
2. Në Chrome hap `chrome://extensions`, aktivizo **Developer mode**.
3. **Load unpacked** → zgjidh dosjen `tufa-efiling` (ose **Reload** nëse e ke versionin e vjetër).
