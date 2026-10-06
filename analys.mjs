// Snölarm – analys av SMHI-prognos (snow1g v1).
// Ren logik utan nätverk, så den går att testa.

export const INSTALLNINGAR = {
  lat: 57.8706,          // Kungälv
  lon: 11.9805,
  fonsterTimmar: 12,     // larma när snö/halka väntas inom så här många timmar
  snoGransCm: 1,         // minsta snömängd (cm) i fönstret för snölarm
  halkaEfterRegnTimmar: 6, // regn inom X h före minusgrader = halkrisk
};

const SAKNAS = 9999;
const v = (x) => (x === undefined || x === null || x === SAKNAS ? null : x);

// Andel fruset (0–1). Använder SMHI:s frozen part, annars en gissning från temperaturen.
function frusenAndel(d) {
  const fp = v(d.precipitation_frozen_part);
  if (fp !== null && fp >= 0 && fp <= 100) return fp / 100;
  const t = v(d.air_temperature);
  if (t === null) return 0;
  if (t <= 0.5) return 1;
  if (t >= 2) return 0;
  return 0.5;
}

/**
 * Analyserar prognosen och returnerar { sno, halka } där varje är null eller ett larm-objekt.
 * @param {object} prognos SMHI-svar ({ timeSeries: [{ time, data }] })
 * @param {Date} nu
 */
export function analysera(prognos, nu = new Date(), inst = INSTALLNINGAR) {
  const slut = new Date(nu.getTime() + inst.fonsterTimmar * 3600e3);
  const tidigast = new Date(nu.getTime() - inst.halkaEfterRegnTimmar * 3600e3);

  const steg = (prognos.timeSeries || [])
    .map((s) => {
      const d = s.data || {};
      const nederbord = Math.max(0, v(d.precipitation_amount_mean) ?? 0); // mm sedan förra steget
      const temp = v(d.air_temperature);
      const fruset = frusenAndel(d);
      return {
        tid: new Date(s.time || s.validTime),
        temp,
        nederbord,
        snoCm: nederbord * fruset,          // tumregel: 1 mm vatten ≈ 1 cm snö
        regnMm: nederbord * (1 - fruset),
      };
    })
    .filter((s) => s.tid >= tidigast && s.tid <= slut)
    .sort((a, b) => a.tid - b.tid);

  const fonster = steg.filter((s) => s.tid > nu);

  // --- Snö ---
  let sno = null;
  const snoSteg = fonster.filter((s) => s.snoCm >= 0.1);
  const totalCm = fonster.reduce((sum, s) => sum + s.snoCm, 0);
  if (totalCm >= inst.snoGransCm && snoSteg.length) {
    sno = {
      typ: 'sno',
      start: snoSteg[0].tid,
      slut: snoSteg[snoSteg.length - 1].tid,
      cm: Math.round(totalCm * 10) / 10,
      minTemp: fonster.some((s) => s.temp !== null)
        ? Math.min(...fonster.map((s) => s.temp).filter((t) => t !== null))
        : null,
    };
  }

  // --- Halka ---
  // 1) Underkylt regn: regn när det är minusgrader.
  // 2) Blöta vägar fryser: minusgrader inom X timmar efter regn.
  let halka = null;
  for (const s of fonster) {
    if (s.temp === null || s.temp > 0) continue;
    if (s.regnMm >= 0.1) {
      halka = { typ: 'halka', orsak: 'underkylt', start: s.tid, temp: s.temp };
      break;
    }
    const fore = steg.filter(
      (p) => p.tid < s.tid &&
        p.tid >= new Date(s.tid.getTime() - inst.halkaEfterRegnTimmar * 3600e3) &&
        p.regnMm >= 0.1 && (p.temp ?? 0) > 0
    );
    if (fore.length) {
      halka = { typ: 'halka', orsak: 'fryser', start: s.tid, temp: s.temp };
      break;
    }
  }

  const temps = fonster.map((s) => s.temp).filter((t) => t !== null);
  const minTemp = temps.length ? Math.min(...temps) : null;
  return { sno, halka, minTemp };
}

const DAGAR = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
export function klockslag(d) {
  const sv = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
  const hh = String(sv.getHours()).padStart(2, '0');
  return `${DAGAR[sv.getDay()]} kl ${hh}`;
}

export function meddelande(larm) {
  if (larm.typ === 'sno') {
    return {
      title: '❄️ Snölarm – plogning trolig',
      body: `Ca ${String(larm.cm).replace('.', ',')} cm snö väntas i Kungälv från ${klockslag(larm.start)}.${larm.minTemp !== null ? ` Lägsta temp ${Math.round(larm.minTemp)}°.` : ''}`,
    };
  }
  return {
    title: '⚠️ Halkvarning',
    body: larm.orsak === 'underkylt'
      ? `Underkylt regn väntas i Kungälv ${klockslag(larm.start)} (${Math.round(larm.temp)}°). Sandning kan behövas.`
      : `Blöta vägar fryser i Kungälv ${klockslag(larm.start)} (${Math.round(larm.temp)}°). Sandning kan behövas.`,
  };
}
