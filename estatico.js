/* Modo estático de Temporada (para publicar sin servidor, p. ej. GitHub Pages).
 *
 * Responde las mismas rutas que la API local (/api/viaja/*) usando datos
 * precalculados en datos.js (window.TEMPORADA_DATOS, generado por
 * `python -m cauce.viaja.estatico`). Lo que depende del día exacto (festivos,
 * Semana Santa, interpretar "15 de enero") se calcula aquí, igual que en
 * src/cauce/viaja/planear.py.
 */
(function () {
  "use strict";
  const D = window.TEMPORADA_DATOS;
  if (!D) return;
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const MES_TEXTO = Object.assign(Object.fromEntries(MESES.map((m, i) => [m, i + 1])), {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, set: 9, setiembre: 9, oct: 10, nov: 11, dic: 12,
  });

  const fecha = (a, m, d) => new Date(Date.UTC(a, m - 1, d));
  const valida = (a, m, d) => { const f = fecha(a, m, d); return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d ? f : null; };
  const sumar = (f, n) => new Date(f.getTime() + n * 864e5);
  const iso = (f) => f.toISOString().slice(0, 10);
  const wd = (f) => (f.getUTCDay() + 6) % 7;
  const hoyUTC = () => {
    if (window.TEMPORADA_HOY) { const [a, m, d] = window.TEMPORADA_HOY.split("-").map(Number); return fecha(a, m, d); }
    const h = new Date();
    return fecha(h.getFullYear(), h.getMonth() + 1, h.getDate());
  };
  const textoFecha = (f) => `${DIAS[wd(f)]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`;

  function pascua(anio) {
    const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    return fecha(anio, Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1);
  }
  function nLunes(a, m, n) {
    const d = fecha(a, m, 1);
    return sumar(d, (7 - wd(d)) % 7 + 7 * (n - 1));
  }
  function festivos(a) {
    const p = pascua(a);
    return [
      { fecha: fecha(a, 1, 1), nombre: "Año Nuevo" },
      { fecha: nLunes(a, 2, 1), nombre: "Día de la Constitución (puente)" },
      { fecha: nLunes(a, 3, 3), nombre: "Natalicio de Benito Juárez (puente)" },
      { fecha: sumar(p, -3), nombre: "Jueves Santo" },
      { fecha: sumar(p, -2), nombre: "Viernes Santo" },
      { fecha: fecha(a, 5, 1), nombre: "Día del Trabajo" },
      { fecha: fecha(a, 9, 16), nombre: "Día de la Independencia" },
      { fecha: nLunes(a, 11, 3), nombre: "Revolución Mexicana (puente)" },
      { fecha: fecha(a, 12, 25), nombre: "Navidad" },
    ];
  }
  function contextoDia(f) {
    const anio = f.getUTCFullYear(), p = pascua(anio);
    const cercanos = [];
    for (const a of [anio - 1, anio, anio + 1]) {
      for (const x of festivos(a)) {
        const dias = Math.round((x.fecha - f) / 864e5);
        if (Math.abs(dias) <= 3) cercanos.push({ fecha: iso(x.fecha), nombre: x.nombre, dias });
      }
    }
    let periodo = null;
    if (f >= sumar(p, -7) && f <= sumar(p, 7)) periodo = "Semana Santa y Pascua";
    else if ((f.getUTCMonth() === 11 && f.getUTCDate() >= 20) || (f.getUTCMonth() === 0 && f.getUTCDate() <= 6)) periodo = "Vacaciones de invierno (periodo aproximado)";
    const fin = wd(f) >= 5;
    let texto;
    if (periodo) texto = `Tu fecha cae en ${periodo.toLowerCase()}: es cuando viaja más gente dentro de México.`;
    else if (cercanos.length) texto = `Hay un día de descanso cerca (${cercanos[0].nombre}). Espera más visitantes nacionales ese fin de semana.`;
    else if (fin) texto = "Es fin de semana: los sitios cercanos a las ciudades reciben más visitantes locales.";
    else texto = "Día entre semana y sin festivos cerca: normalmente el mejor para los sitios más visitados.";
    return { fecha: iso(f), dia_semana: DIAS[wd(f)], fin_de_semana: fin, festivos_cercanos: cercanos, periodo_vacacional: periodo, texto };
  }

  function especiales(a) {
    const p = pascua(a);
    return [
      ["semana santa", sumar(p, -3), "Semana Santa"], ["pascua", sumar(p, 1), "Pascua"],
      ["nochebuena", fecha(a, 12, 24), "Nochebuena"], ["navidad", fecha(a, 12, 24), "Navidad"],
      ["fin de ano", fecha(a, 12, 30), "Fin de año"], ["ano nuevo", fecha(a, 12, 30), "Año Nuevo"],
      ["puente de febrero", sumar(nLunes(a, 2, 1), -2), "Puente de febrero"],
      ["puente de marzo", sumar(nLunes(a, 3, 3), -2), "Puente de marzo"],
      ["puente de noviembre", sumar(nLunes(a, 11, 3), -2), "Puente de noviembre"],
      ["dia de muertos", fecha(a, 11, 1), "Día de Muertos"],
      ["vacaciones de verano", fecha(a, 7, 15), "Vacaciones de verano"], ["verano", fecha(a, 7, 15), "Verano"],
      ["independencia", fecha(a, 9, 15), "Fiestas patrias"],
    ];
  }

  function interpretar(texto) {
    const hoy = hoyUTC(), Y = hoy.getUTCFullYear(), hasta = D.horizonte.hasta;
    const t = (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
    if (!t) return null;
    const emp = (f, precision, motivo = null) => ({ fecha: iso(f), precision, texto: textoFecha(f), motivo, en_rango: f >= hoy && iso(f).slice(0, 7) <= hasta });

    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) { const f = valida(+m[1], +m[2], +m[3]); return f ? emp(f, "dia") : null; }
    m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
    if (m) {
      let a = m[3] ? +m[3] : null;
      if (a !== null && a < 100) a += 2000;
      if (a) { const f = valida(a, +m[2], +m[1]); return f ? emp(f, "dia") : null; }
      for (const y of [Y, Y + 1]) {
        const f = valida(y, +m[2], +m[1]);
        if (!f) return null;
        if (f >= hoy) return emp(f, "dia");
      }
      return null;
    }
    const anioTxt = t.match(/\b(20\d{2})\b/);
    const anios = anioTxt ? [+anioTxt[1]] : [Y, Y + 1, Y + 2];
    for (const a of anios) {
      for (const [clave, f, motivo] of especiales(a)) {
        if (t.includes(clave) && (anioTxt || f >= hoy)) return emp(f, "dia", motivo);
      }
    }
    let mes = null;
    for (const p of t.match(/[a-z]+/g) || []) {
      if (Object.prototype.hasOwnProperty.call(MES_TEXTO, p)) { mes = MES_TEXTO[p]; break; }
    }
    if (mes === null) return null;
    const dm = t.replace(/\b20\d{2}\b/g, "").match(/\b(\d{1,2})\b/);
    const dia = dm ? +dm[1] : 15, precision = dm ? "dia" : "mes";
    for (const a of anios) {
      const f = valida(a, mes, dia);
      if (!f) return null;
      if (anioTxt || f >= hoy || (precision === "mes" && a === Y && mes === hoy.getUTCMonth() + 1)) {
        return emp(precision === "mes" && f < hoy ? hoy : f, precision);
      }
    }
    return null;
  }

  function plan(destino, fechaIso) {
    if (!D.lugares[destino]) throw new Error(`Destino desconocido: ${destino}.`);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso || "");
    const f = m && valida(+m[1], +m[2], +m[3]);
    if (!f) throw new Error("La fecha debe tener formato AAAA-MM-DD.");
    const periodo = fechaIso.slice(0, 7);
    const base = D.planes[`${destino}|${periodo}`];
    if (!base) throw new Error(`El pronóstico cubre de ${D.horizonte.desde} a ${D.horizonte.hasta}. Elige una fecha en ese rango.`);
    const hoy = hoyUTC();
    const siguiente = iso(fecha(hoy.getUTCFullYear(), hoy.getUTCMonth() + 2, 1)).slice(0, 7);
    const avisos = new Set(base.avisos);
    const lugares = D.lugares[destino].map((l) => ({ ...l, aviso_sargazo: avisos.has(l.id) }))
      .sort((x, y) => Number(x.aviso_sargazo) - Number(y.aviso_sargazo));
    return {
      ...base, fecha: fechaIso, dia: contextoDia(f), lugares,
      restaurantes: D.restaurantes[destino], hoteles: D.hoteles[destino], probar: D.probar[destino],
      mejores_meses: D.tranquilos[destino].filter((x) => x.periodo >= siguiente).filter((x, i, a) => a.findIndex((y) => y.mes === x.mes) === i).slice(0, 3),
    };
  }

  window.TemporadaAPI = async function (url) {
    const u = new URL(url, location.href), q = u.searchParams, ruta = u.pathname;
    if (ruta.endsWith("/api/viaja/destinos")) return { horizonte: D.horizonte, destinos: D.destinos, calendario: D.calendario, validacion: [] };
    if (ruta.endsWith("/api/viaja/fechas")) return D.fechas;
    if (ruta.endsWith("/api/viaja/interpretar")) {
      const r = interpretar(q.get("texto"));
      if (!r) throw new Error("No entendimos esa fecha. Prueba con «15 de enero», «marzo» o «Semana Santa».");
      return r;
    }
    if (ruta.endsWith("/api/viaja/plan")) return plan(q.get("destino"), q.get("fecha"));
    throw new Error("Ruta desconocida.");
  };
})();
