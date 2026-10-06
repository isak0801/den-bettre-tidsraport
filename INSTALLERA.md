# IHMT Tidrapport – kom igång (ca 30 min, gratis)

Appen ligger på GitHub Pages, sparar allt i Firebase och skickar snölarm 12 h innan snö eller halka.

## 1. Skapa Firebase-projektet
1. Gå till **console.firebase.google.com** → *Skapa projekt* → namn `ihmt-tidrapport` → Google Analytics: av → Skapa.
2. **Authentication** → Kom igång → *E-post/lösenord* → Aktivera → Spara.
3. **Firestore Database** → Skapa databas → plats **europe-north1** (Finland) → produktionsläge.
   Fliken *Regler*: ersätt allt med innehållet i `firestore.rules` → **Publicera**.
4. ⚙️ **Projektinställningar** → *Allmänt* → längst ner *Dina appar* → webbikonen `</>` → namn `Tidrapport` → Registrera.
   Kopiera värdena i `firebaseConfig` till `FIREBASE_CONFIG` högst upp i skriptet i `index.html`.
5. ⚙️ Projektinställningar → **Cloud Messaging** → *Web Push certificates* → **Generate key pair**.
   Kopiera nyckeln till `VAPID_KEY` i `index.html`.

## 2. Lägg upp på GitHub
1. Skapa ett konto på **github.com** om du inte har ett.
2. **New repository** → namn `tidrapport` → *Public* → Create.
3. *uploading an existing file* → dra in **allt innehåll** i den här mappen → Commit.
   Sedan: *Add file → Create new file* → skriv namnet `.github/workflows/snolarm.yml` → klistra in innehållet från filen `snolarm/snolarm.yml` → Commit. (Det är den som startar snölarmet varje timme.)
4. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)` → Save.
   Efter någon minut finns appen på `https://<ditt-användarnamn>.github.io/tidrapport/`.
5. Firebase → **Authentication → Settings → Authorized domains** → *Add domain* → `<ditt-användarnamn>.github.io`.

## 3. Snölarmet (körs automatiskt varje timme)
1. Firebase → ⚙️ Projektinställningar → **Tjänstkonton** → *Generera ny privat nyckel*. En JSON-fil laddas ner. **Dela den aldrig.**
2. GitHub-repot → **Settings → Secrets and variables → Actions**:
   - fliken *Secrets* → New: namn `FIREBASE_SERVICE_ACCOUNT`, värde = hela innehållet i JSON-filen.
   - fliken *Variables* → New: namn `APP_URL`, värde = appens adress från steg 2.4.
3. Radera JSON-filen från datorn när den är inlagd.

## 4. Börja använda
1. Öppna appen → **Skapa konto** med `ihallstrom08@gmail.com` → klicka på länken i mejlet → ladda om. Nu ser du ägarvyn (faktura, löner, alla pass).
2. Skicka länken till förarna. De skapar varsitt konto.
   **iPhone:** öppna i Safari → Dela → *Lägg till på hemskärmen* → öppna appen därifrån.
   **Android:** Chrome → ⋮ → *Installera app*.
3. Alla trycker **Slå på snölarm** → Tillåt.
4. Testa: GitHub → **Actions** → *Snölarm* → **Run workflow** → bocka i *Skicka testnotis* → Run. Alla ska få "❄️ Testlarm" inom en minut.

## Bra att veta
- Larmet går vid ≥ 1 cm snö eller halkrisk inom 12 h, max en gång per 12 h per typ. Ändra i `snolarm/analys.mjs` → `INSTALLNINGAR`.
- Varningen visas också som en blå ruta överst i appen så länge den gäller.
- GitHub pausar schemat om repot inte rörts på 60 dagar – du får ett mejl, klicka då *Enable workflow* (eller gör en liten ändring).
- Gratisnivåerna räcker gott: Firebase Spark-planen och GitHub Actions (obegränsat för publika repon).
