# TUFA · e-Filing (shtesë Chrome) · v1.1

Lidh TUFA Business AI me e-Filing (C@TS) në shfletuesin e përdoruesit, si lidhja e cis-client-2.

## Hyrja me e-Albania
- Te TUFA, në dritaren e certifikatës, shto **të dhënat e e-Albania** të subjektit (NUIS = NIPT i subjektit
  dhe fjalëkalimi). Ato mbahen vetëm në këtë shfletues: për sesionin, ose të enkriptuara me
  "fjalëkalimin e kasafortës" (AES-GCM, PBKDF2). Nuk dërgohen kurrë te serveri i TUFA.
- **Hyr në e-Filing** (Listëpagesa): shtesa hap portalin, klikon "e-Albania", zgjedh "Biznes", plotëson
  NUIS-in dhe fjalëkalimin dhe dërgon formularin **një herë**.
  - Kodi i verifikimit (OTP) shkruhet nga përdoruesi te TUFA.
  - CAPTCHA nuk prekët: përdoruesi e plotëson vetë në portal.
  - Hyrja e vjetër e e-Filing (përdorues/fjalëkalim i C@TS) nuk plotësohet kurrë.
- Fjalëkalimi qëndron te shtesa vetëm në `chrome.storage.session` (në kujtesë, i palexueshëm nga
  faqet) dhe fshihet sapo plotësohet, ose kur hyrja mbaron (maksimumi 4 minuta).

## Leximi i faqeve
- **Vetëm lexim:** URL-ja, titulli, NIPT-i i vetëm në kokën e faqes dhe tabelat e dukshme.
  Fushat e formularëve, fjalëkalimet dhe cookies nuk lexohen. Nuk dorëzohet asnjë deklaratë.
- Te TUFA: **Merr faqen e portalit**, ose ikona TUFA në Chrome → "Dërgo në TUFA".
- NIPT-i i faqes duhet të jetë i njëjtë me subjektin në TUFA.

## Instalimi (pa Chrome Web Store)
1. Shkarko `tufa-efiling.zip` nga TUFA → Listëpagesa → "Shtesa e-Filing" dhe hape (unzip).
2. Në Chrome hap `chrome://extensions`, aktivizo **Developer mode**.
3. **Load unpacked** → zgjidh dosjen `tufa-efiling` (ose **Reload** nëse e ke versionin e vjetër).
