// Snölarm – körs varje timme av GitHub Actions.
// Hämtar SMHI-prognosen för Kungälv och skickar push till alla i tidrapportappen
// om snö eller halka väntas inom 12 timmar.
//
// Miljövariabler:
//   FIREBASE_SERVICE_ACCOUNT  JSON för Firebase-tjänstkontot (GitHub-secret)
//   APP_URL                   länk som öppnas när man trycker på notisen
//   TEST=1                    skicka en testnotis direkt, oavsett väder
//   TORRKORNING=1             skriv bara ut vad som skulle skickas

import admin from 'firebase-admin';
import { analysera, meddelande, INSTALLNINGAR } from './analys.mjs';

const TEST = process.env.TEST === '1';
const TORR = process.env.TORRKORNING === '1';
const APP_URL = process.env.APP_URL || '/';
const SPARR_TIMMAR = 12; // samma typ av larm skickas inte igen inom 12 h

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
const db = admin.firestore();

async function hamtaPrognos() {
  const { lat, lon } = INSTALLNINGAR;
  const url = `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon}/lat/${lat}/data.json`;
  const svar = await fetch(url);
  if (!svar.ok) throw new Error(`SMHI svarade ${svar.status}`);
  return svar.json();
}

async function skicka({ title, body }) {
  const snap = await db.collection('pushTokens').get();
  const tokens = snap.docs.map((d) => d.get('token')).filter(Boolean);
  console.log(`Skickar "${title}" till ${tokens.length} enheter: ${body}`);
  if (TORR || !tokens.length) return;

  // Data-meddelande – service workern i appen visar notisen själv.
  for (let i = 0; i < tokens.length; i += 500) {
    const grupp = tokens.slice(i, i + 500);
    const res = await admin.messaging().sendEachForMulticast({
      tokens: grupp,
      data: { title, body, link: APP_URL },
      webpush: { headers: { Urgency: 'high', TTL: String(6 * 3600) } },
    });
    // Rensa bort enheter som inte finns längre (avinstallerad app m.m.)
    await Promise.all(res.responses.map(async (r, j) => {
      const kod = r.error?.code || '';
      if (kod.includes('registration-token-not-registered') || kod.includes('invalid-registration-token')) {
        await db.collection('pushTokens').doc(grupp[j]).delete();
      } else if (r.error) {
        console.warn('Fel:', kod);
      }
    }));
    console.log(`Lyckades: ${res.successCount}, misslyckades: ${res.failureCount}`);
  }
}

async function main() {
  if (TEST) {
    await skicka({ title: '❄️ Testlarm', body: 'Snölarmet fungerar! Du får en notis 12 h innan snö eller halka.' });
    return;
  }

  const nu = new Date();
  const { sno, halka } = analysera(await hamtaPrognos(), nu);
  console.log('Analys:', JSON.stringify({ sno, halka }));

  // Varningen som visas överst i appen (uppdateras varje timme)
  const visa = sno || halka;
  const aktuell = visa
    ? {
        aktiv: true,
        typ: visa.typ,
        ...meddelande(visa),
        start: visa.start.toISOString(),
        giltigTill: new Date((visa.slut || visa.start).getTime() + 3 * 3600e3).toISOString(),
        uppdaterad: nu.toISOString(),
      }
    : { aktiv: false, uppdaterad: nu.toISOString() };
  if (!TORR) await db.collection('snolarm').doc('aktuell').set(aktuell);

  const statusRef = db.collection('snolarm').doc('status');
  const status = (await statusRef.get()).data() || {};

  for (const larm of [sno, halka].filter(Boolean)) {
    const senast = status[larm.typ]?.skickad?.toDate?.();
    if (senast && nu - senast < SPARR_TIMMAR * 3600e3) {
      console.log(`${larm.typ}: redan skickat ${senast.toISOString()}, hoppar över.`);
      continue;
    }
    await skicka(meddelande(larm));
    if (!TORR) {
      await statusRef.set(
        { [larm.typ]: { skickad: admin.firestore.Timestamp.fromDate(nu), start: larm.start.toISOString() } },
        { merge: true }
      );
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
