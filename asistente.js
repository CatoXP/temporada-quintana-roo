/* Asistente de Temporada: preguntas y respuestas sobre Quintana Roo, en el navegador.
 *
 * No usa servidor ni modelo externo: combina las preguntas frecuentes precargadas
 * (contenido.js) con respuestas calculadas a partir del mismo pronóstico que usa la
 * página (cómo estará un destino en una fecha, meses tranquilos, sargazo, qué hacer,
 * qué comer). Así funciona gratis, sin claves y también publicado como sitio estático.
 *
 *   Asistente.iniciar(ctx)
 *     ctx.api(url)            misma función de datos que usa la página
 *     ctx.idioma()            "es" | "en" | "fr" | "pt"
 *     ctx.C                   window.TEMPORADA_CONTENIDO
 *     ctx.t(clave, vars)      textos de la interfaz
 *     ctx.meta()              calendario y destinos cargados
 *     ctx.fechaLarga(iso)     "viernes 15 de enero de 2027" en el idioma activo
 *     ctx.mes(periodo)        nombre del mes en el idioma activo
 *     ctx.nivel(nivel)        [titulo, corto, frase]
 *     ctx.nombreLugar(lugar)  nombre traducido
 *     ctx.planear(destino, fecha)
 */
(function () {
  "use strict";
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:()"“”«»]/g, " ").replace(/\s+/g, " ").trim();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tiene = (t, lista) => lista.some((p) => new RegExp(`(^|\\s)${p}`).test(t));

  const DESTINOS = [
    ["gran_costa_maya", ["bacalar", "mahahual", "chetumal", "costa maya", "chacchoben", "kohunlich", "chinchorro"]],
    ["riviera_maya", ["riviera", "playa del carmen", "tulum", "akumal", "coba", "puerto morelos", "sian kaan"]],
    ["cancun", ["cancun", "zona hotelera"]],
  ];
  const INTENCION = {
    saludo: ["hola", "buenas", "hi", "hello", "hey", "bonjour", "salut", "ola", "oi"],
    sargazo: ["sargaz", "sargass", "sargac", "alga", "seaweed"],
    comer: ["comer", "comida", "restaurant", "cenar", "desayun", "platillo", "eat", "food", "dinner", "manger", "cuisine", "diner", "jantar", "almoc"],
    hacer: ["hacer", "que ver", "visitar", "actividad", "lugares", "atraccion", "things to", "to do", "see", "visit", "faire", "voir", "fazer", "passeio", "imperdible", "must"],
    mejor: ["mejor", "cuando", "epoca", "tranquil", "best", "when", "quiet", "meilleur", "quand", "calme", "melhor", "quando"],
    estado: ["como estara", "como esta", "lleno", "gente", "concurrid", "crowd", "busy", "full", "people", "monde", "affluence", "cheio", "lotado", "movimento", "how is", "how will"],
  };

  // ---- modelo pequeño entrenado en Python (cauce.viaja.asistente) -----------------
  const M = window.TEMPORADA_MODELO;
  const INDICE = M ? new Map(M.vocab.map((g, i) => [g, i])) : null;
  function clasificar(texto) {
    if (!M) return null;
    const t = (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
    const tf = new Map();
    for (const w0 of t.split(" ").filter(Boolean)) {
      const w = ` ${w0} `;
      for (let n = M.ngram[0]; n <= M.ngram[1]; n++) {
        // igual que sklearn char_wb
        let o = 0;
        const agregar = (g) => { const j = INDICE.get(g); if (j !== undefined) tf.set(j, (tf.get(j) || 0) + 1); };
        agregar(w.slice(o, o + n));
        while (o + n < w.length) { o++; agregar(w.slice(o, o + n)); }
      }
    }
    let norma = 0;
    const x = [];
    for (const [j, c] of tf) { const v = (1 + Math.log(c)) * M.idf[j]; x.push([j, v]); norma += v * v; }
    norma = Math.sqrt(norma) || 1;
    const z = M.intercepto.slice();
    for (const [j, v] of x) for (const [c, w] of M.pesos[j]) z[c] += w * (v / norma);
    const mx = Math.max(...z), ex = z.map((v) => Math.exp(v - mx)), suma = ex.reduce((a, b) => a + b, 0);
    let mejor = 0;
    ex.forEach((v, i) => { if (v > ex[mejor]) mejor = i; });
    return { id: M.clases[mejor], p: ex[mejor] / suma };
  }

  function crearUI(ctx) {
    const raiz = document.createElement("div");
    raiz.className = "asistente";
    raiz.innerHTML = `
      <button type="button" class="asis-boton" aria-expanded="false">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 18c4-4 8-4 12 0s8 4 12 0" /><path d="M4 12c4-4 8-4 12 0s8 4 12 0" opacity=".5"/><circle cx="24" cy="24" r="4"/></svg>
        <span class="asis-burbuja"></span>
      </button>
      <section class="asis-panel" hidden aria-live="polite">
        <header><div><b class="asis-titulo"></b><small class="asis-sub"></small></div><button type="button" class="asis-cerrar">×</button></header>
        <div class="asis-mensajes"></div>
        <div class="asis-sugerencias"></div>
        <form class="asis-form"><input type="text" autocomplete="off"><button type="submit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M12 5l7 7-7 7"/></svg></button></form>
      </section>`;
    document.body.appendChild(raiz);
    return raiz;
  }

  function iniciar(ctx) {
    const C = ctx.C;
    const raiz = crearUI(ctx);
    const boton = raiz.querySelector(".asis-boton"), panel = raiz.querySelector(".asis-panel");
    const mensajes = raiz.querySelector(".asis-mensajes"), form = raiz.querySelector(".asis-form");
    const entrada = form.querySelector("input"), sug = raiz.querySelector(".asis-sugerencias");
    const B = () => C.bot[ctx.idioma()] || C.bot.es;
    const planes = new Map();

    function textos() {
      boton.setAttribute("aria-label", ctx.t("bot_abrir"));
      raiz.querySelector(".asis-burbuja").textContent = ctx.t("bot_titulo");
      raiz.querySelector(".asis-titulo").textContent = ctx.t("bot_titulo");
      raiz.querySelector(".asis-sub").textContent = ctx.t("bot_sub");
      raiz.querySelector(".asis-cerrar").setAttribute("aria-label", ctx.t("bot_cerrar"));
      entrada.placeholder = ctx.t("bot_placeholder");
      form.querySelector("button").setAttribute("aria-label", ctx.t("bot_enviar"));
      sug.innerHTML = B().sugerencias.map((s) => `<button type="button">${esc(s)}</button>`).join("");
      sug.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => enviar(b.textContent)));
    }

    function agregar(quien, html, accion) {
      const m = document.createElement("div");
      m.className = `asis-msj ${quien}`;
      m.innerHTML = `<p>${html}</p>`;
      if (accion) {
        const a = document.createElement("button");
        a.type = "button";
        a.className = "asis-accion";
        a.textContent = accion.texto;
        a.addEventListener("click", accion.fn);
        m.appendChild(a);
      }
      mensajes.appendChild(m);
      mensajes.scrollTop = mensajes.scrollHeight;
      return m;
    }

    async function plan(destino, fecha) {
      const k = `${destino}|${fecha}`;
      if (!planes.has(k)) planes.set(k, ctx.api(`/api/viaja/plan?destino=${destino}&fecha=${fecha}`));
      return planes.get(k);
    }
    function proximaFecha() {
      const h = new Date();
      const d = new Date(Date.UTC(h.getFullYear(), h.getMonth() + 1, 15));
      return d.toISOString().slice(0, 10);
    }
    const lista = (xs) => {
      const y = B().y;
      return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")}${y}${xs[xs.length - 1]}`;
    };

    async function responder(pregunta) {
      let t = norm(pregunta);
      for (const [k, v] of Object.entries(C.fechas_palabras)) t = t.replace(new RegExp(`\\b${k}\\b`, "g"), v);
      const b = B();
      const quiere = Object.fromEntries(Object.entries(INTENCION).map(([k, v]) => [k, tiene(t, v)]));
      const destino = (DESTINOS.find(([, claves]) => claves.some((c) => t.includes(c))) || [])[0];

      let fecha = null;
      try {
        const r = await ctx.api(`/api/viaja/interpretar?texto=${encodeURIComponent(t.replace(/\bmar\b/g, " "))}`);
        if (r.en_rango) fecha = r;
      } catch (e) { /* sin fecha */ }

      const intent = clasificar(pregunta);
      const seguro = !!intent && intent.p >= M.umbral;
      const id = seguro ? intent.id : null;
      const hablaDe = (k) => id === k || (!seguro && quiere[k]);
      const AERO = { cancun: "Cancún (CUN)", riviera_maya: "Tulum (TQO)", gran_costa_maya: "Chetumal (CTM)" };

      if (id === "vuelos") {
        const d = destino || ctx.destinoActual();
        const f = fecha ? fecha.fecha : proximaFecha();
        return { texto: esc(`${ctx.t("vuelos_barra")}: ${AERO[d]} · ${ctx.fechaLarga(f)}`),
                 accion: { texto: ctx.t("vuelos_barra"), fn: () => window.open(ctx.vuelos(d, f), "_blank", "noopener") } };
      }
      if (hablaDe("sargazo")) {
        const f = fecha ? fecha.fecha : proximaFecha();
        const p = await plan("gran_costa_maya", f);
        const nivel = p.sargazo && p.sargazo.nivel;
        const clave = nivel === "alto" ? "sargazo_si" : nivel === "medio" ? "sargazo_medio" : "sargazo_no";
        return { texto: b[clave].replace("{m}", ctx.mes(f.slice(0, 7))) };
      }
      if (id === "dormir") {
        const d = destino || ctx.destinoActual();
        const p = await plan(d, proximaFecha());
        const nombres = p.hoteles.slice(0, 4).map((h) => h.nombre);
        return { texto: esc(`${ctx.t("dormir_eyebrow")} · ${ctx.nombreDestino(d)}: ${lista(nombres)}. ${ctx.t("resenas_nota").split(".")[0]}.`),
                 accion: { texto: ctx.t("dormir_eyebrow"), fn: () => ctx.ir("#dormir", d) } };
      }
      if (hablaDe("comer")) {
        const d = destino || ctx.destinoActual();
        const p = await plan(d, proximaFecha());
        const platos = C.comida[d].map((k) => (C.platillos[k][ctx.idioma()] || C.platillos[k].es)[0]).slice(0, 3);
        const rest = p.restaurantes.slice(0, 3).map((r) => r.nombre);
        return { texto: b.comer.replace("{d}", ctx.nombreDestino(d)).replace("{p}", lista(platos)).replace("{r}", lista(rest)),
                 accion: { texto: ctx.t("nav_comer"), fn: () => ctx.ir("#comida", d) } };
      }
      if (id === "hacer" || (!seguro && quiere.hacer && destino && !fecha)) {
        const d = destino || ctx.destinoActual();
        const p = await plan(d, proximaFecha());
        const nombres = p.lugares.filter((l) => !l.aviso_sargazo).slice(0, 4).map((l) => ctx.nombreLugar(l));
        return { texto: b.hacer.replace("{d}", ctx.nombreDestino(d)).replace("{l}", lista(nombres)),
                 accion: { texto: ctx.t("nav_hacer"), fn: () => ctx.ir("#lugares", d) } };
      }
      if (id === "mejor_epoca" || (!seguro && quiere.mejor && destino)) {
        const d = destino || ctx.destinoActual();
        const p = await plan(d, proximaFecha());
        const meses = p.mejores_meses.map((m) => `${ctx.mes(m.periodo)} ${m.anio}`);
        return { texto: b.mejor.replace("{d}", ctx.nombreDestino(d)).replace("{m}", lista(meses)) + " " + esc(ctx.t("inferido_chat")),
                 accion: { texto: ctx.t("nav_cuando"), fn: () => ctx.ir("#cuando", d) } };
      }
      if (id === "estado" || (!seguro && destino && (fecha || quiere.estado))) {
        const d = destino || ctx.destinoActual();
        const f = fecha ? fecha.fecha : proximaFecha();
        const p = await plan(d, f);
        const [titulo, , frase] = ctx.nivel(p.prediccion.nivel);
        let x = frase;
        if (p.recomendacion) x += ` ${ctx.t("alt_titulo", { d: ctx.nombreDestino(p.recomendacion.destino_id) }).replace(/<[^>]+>/g, "")}`;
        return { texto: b.estado.replace("{d}", ctx.nombreDestino(d)).replace("{f}", ctx.fechaLarga(f)).replace("{n}", `<b>${titulo}</b>`).replace("{x}", esc(x)) + ` <small>${esc(ctx.t("inferido_chat"))}</small>`,
                 accion: { texto: ctx.t("ver"), fn: () => ctx.planear(d, f) } };
      }
      if (seguro && M.respuestas[id]) {
        const r = M.respuestas[id];
        return { texto: esc(r[ctx.idioma()] || r.es) };
      }
      const f = seguro ? null : faq(t);
      if (f) return { texto: esc(f[1]) };
      if (fecha) return { texto: esc(b.pide_destino) };
      return { texto: esc(b.no_entendi) };
    }

    function faq(t) {
      const palabras = new Set(t.split(" ").filter((w) => w.length > 2));
      let mejor = null, puntos = 0;
      for (const f of C.faq) {
        const par = f[ctx.idioma()] || f.es;
        let p = f.claves.filter((c) => [...palabras].some((w) => w === c || (c.length > 4 && w.startsWith(c.slice(0, 5))))).length;
        p += norm(par[0]).split(" ").filter((w) => w.length > 4 && palabras.has(w)).length * 0.5;
        if (p > puntos) { puntos = p; mejor = par; }
      }
      return puntos >= 2 ? mejor : null;
    }

    async function enviar(texto) {
      texto = (texto || "").trim();
      if (!texto) return;
      agregar("yo", esc(texto));
      entrada.value = "";
      const pensando = agregar("bot pensando", "<span></span><span></span><span></span>");
      try {
        const r = await responder(texto);
        pensando.remove();
        agregar("bot", r.texto, r.accion);
      } catch (e) {
        pensando.remove();
        agregar("bot", esc(B().no_entendi));
      }
    }

    function abrir(si) {
      panel.hidden = !si;
      raiz.classList.toggle("abierto", si);
      boton.setAttribute("aria-expanded", String(si));
      if (si) {
        if (!mensajes.children.length) agregar("bot", esc(B().saludo));
        setTimeout(() => entrada.focus(), 50);
      }
    }
    boton.addEventListener("click", () => abrir(panel.hidden));
    raiz.querySelector(".asis-cerrar").addEventListener("click", () => abrir(false));
    form.addEventListener("submit", (e) => { e.preventDefault(); enviar(entrada.value); });
    textos();

    return {
      idiomaCambiado() {
        textos();
        mensajes.innerHTML = "";
        if (!panel.hidden) agregar("bot", esc(B().saludo));
      },
      preguntar: (texto) => { abrir(true); enviar(texto); },
    };
  }

  window.Asistente = { iniciar };
})();
