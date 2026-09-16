/* Temporada · Quintana Roo — v3, para el viajero.
 * Palabras e imágenes, no tecnicismos. Cuatro idiomas (contenido.js), tres escenas
 * 3D (escenas3d.js), asistente sin servidor (asistente.js) y animación con GSAP + Lenis.
 * Los datos salen de /api/viaja/* (servidor local) o de datos.js (sitio estático). */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const C = window.TEMPORADA_CONTENIDO;
  const OLAS = { tranquilo: 1, moderado: 2, concurrido: 3, lleno: 4 };
  const PREVIA = { tranquilo: 45, moderado: 63, concurrido: 80, lleno: 90 };
  const AEROPUERTO = { cancun: ["CUN", "Cancún"], riviera_maya: ["TQO", "Tulum"], gran_costa_maya: ["CTM", "Chetumal"] };
  const FOTO_DESTINO = { cancun: "img/postal_cancun.jpg", riviera_maya: "img/tulum.jpg", gran_costa_maya: "img/postal_bacalar.jpg" };
  const NOMBRE = { cancun: "Cancún", riviera_maya: "Riviera Maya", gran_costa_maya: "Gran Costa Maya" };
  const LOCALE = { es: "es-MX", en: "en-US", fr: "fr-FR", pt: "pt-BR" };
  const COCINA = { regional: "regional", yucatecan: "yucateca", mayan: "maya", local: "local", seafood: "mariscos", fish: "pescado", mexican: "mexicana" };
  const ICONO = {
    alto: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M14 20c.3-2.6 1.8-4.5 4-4.5 2 0 3 1.4 3 4.5"/></svg>',
    bajo: '<svg viewBox="0 0 24 24"><path d="M3 15c3-3 6-3 9 0s6 3 9 0M3 10c3-3 6-3 9 0s6 3 9 0"/></svg>',
    medio: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    alerta: '<svg viewBox="0 0 24 24"><path d="M4 17c2-1.5 4-1.5 6 0s4 1.5 6 0 3-1.2 4-.5M6 12c1-3 3-5 6-5 2 0 3 1 4 3"/></svg>',
    info: '<svg viewBox="0 0 24 24"><path d="M2.5 15.5l19-7-2-2.5-7 2.5-6-4.5-2 .8 4 5-4 1.5-2.5-1.5-1.5.6 2 3.6z"/></svg>',
  };
  const RUTA_ICONO = [
    '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="3"/><path d="M3 10h18M7 20v-3M17 20v-3"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M4 16l2-6h12l2 6v3H4z"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/></svg>',
    '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="14" rx="4"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M2.5 15.5l19-7-2-2.5-7 2.5-6-4.5-2 .8 4 5-4 1.5-2.5-1.5-1.5.6 2 3.6z"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M3 17c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0M5 14l1-5h12l1 5M9 9V5h6v4"/></svg>',
  ];
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hayGsap = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
  const hay3D = typeof THREE !== "undefined" && window.Escenas;

  const hoy = new Date();
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const periodoHoy = hoyIso.slice(0, 7);
  const estado = { destino: "cancun", fecha: "2027-01-15", meta: null, plan: null, fechas: { festivos: [], periodos: [] }, escenas: {}, interpretada: null, creditos: {} };
  const q = new URLSearchParams(location.search);
  if (NOMBRE[q.get("destino")]) estado.destino = q.get("destino");
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.get("fecha") || "")) estado.fecha = q.get("fecha");

  // ------------------------------------------------------------------ idioma
  let idioma = (() => {
    const pedido = q.get("lang");
    if (C.ui[pedido]) return pedido;
    try { const g = localStorage.getItem("temporada-idioma"); if (C.ui[g]) return g; } catch (e) { /* sin almacenamiento */ }
    for (const l of navigator.languages || [navigator.language || "es"]) {
      const b = String(l).slice(0, 2).toLowerCase();
      if (C.ui[b]) return b;
    }
    return "es";
  })();
  const t = (k, v = {}) => {
    const s = C.ui[idioma][k] ?? C.ui.es[k] ?? k;
    return typeof s === "string" ? s.replace(/\{(\w+)\}/g, (m, x) => (v[x] ?? m)) : s;
  };
  const fmt = (iso, op) => new Intl.DateTimeFormat(LOCALE[idioma], { timeZone: "UTC", ...op }).format(new Date(`${iso}T12:00:00Z`));
  const mes = (periodo) => fmt(`${periodo}-15`, { month: "long" });
  const mesCorto = (periodo) => fmt(`${periodo}-15`, { month: "short" }).replace(".", "");
  const fechaLarga = (iso) => fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fechaCorta = (iso) => fmt(iso, { day: "numeric", month: "long" });
  const nivelTxt = (n) => C.niveles[idioma][n];
  const lugarTxt = (l) => (idioma === "es" ? [l.nombre, l.descripcion, l.consejo] : (C.lugares[idioma][l.id] || [l.nombre, l.descripcion, l.consejo]));
  const festivoTxt = (n) => (idioma === "es" ? n : (C.festivos[idioma][n] || n));
  const destinoTxt = (d) => (idioma === "es" ? [d.region, d.lema] : C.destinos[idioma][d.id]);
  const platillo = (id) => C.platillos[id][idioma] || C.platillos[id].es;

  async function api(url) {
    if (window.TemporadaAPI) return window.TemporadaAPI(url);
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.detail || "error");
    return j;
  }
  const olitas = (n) => `<span class="olitas" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
  const creditoDe = (clave) => estado.creditos[clave];
  const foto = (clave) => (creditoDe(clave) ? `img/${creditoDe(clave).archivo}` : "");
  const fotoHTML = (f, alt) => (f ? `<img src="${esc(f.src || f)}" alt="${esc(alt)}" loading="lazy" decoding="async">` : '<div class="sin-foto"></div>');
  const gente = (p50) => Math.max(0.02, Math.pow(Math.min(1, Math.max(0, (p50 - 38) / 48)), 2.3));
  const mitad = (periodo) => { const f = `${periodo}-15`; return f < hoyIso ? hoyIso : f; };

  function normalizarFecha(texto) {
    let s = (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const [k, v] of Object.entries(C.fechas_palabras)) s = s.replace(new RegExp(`\\b${k}\\b`, "g"), v);
    return s.replace(/\bthe\b|\bof\b|\bde\b|\bdu\b|\bdo\b|\bon\b|\ble\b|\bem\b/g, " ").replace(/(\d+)(st|nd|rd|th|er)\b/g, "$1").replace(/\s+/g, " ").trim();
  }

  // --------------------------------------------------------------- partir texto
  function partir(el, html) {
    el.innerHTML = html;
    const recorrer = (nodo) => {
      [...nodo.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            const s = document.createElement("span");
            s.className = "pal";
            s.innerHTML = `<span>${esc(p)}</span>`;
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) recorrer(n);
      });
    };
    recorrer(el);
    if (hayGsap && !reducido) gsap.from($$(".pal > span", el), { yPercent: 110, duration: 1.1, stagger: 0.06, ease: "expo.out" });
  }

  // ------------------------------------------------------------------ movimiento
  let lenis = null;
  function irA(el) {
    if (lenis) lenis.scrollTo(el, { offset: -10, duration: 1.5 });
    else el.scrollIntoView({ behavior: reducido ? "auto" : "smooth" });
  }
  function aparecer(selector, contenedor) {
    if (!hayGsap || reducido) return;
    const els = $$(selector, contenedor);
    if (els.length) gsap.from(els, { y: 40, duration: 1, stagger: 0.07, ease: "expo.out", overwrite: true });
  }

  function momentoDelDia(p) {
    const sec = $("#dia");
    const tarde = Math.min(1, Math.max(0, (p - 0.26) / 0.2));
    const noche = Math.min(1, Math.max(0, (p - 0.6) / 0.18));
    sec.style.setProperty("--tarde", tarde.toFixed(3));
    sec.style.setProperty("--noche", noche.toFixed(3));
    const m = p < 0.36 ? "manana" : p < 0.7 ? "tarde" : "noche";
    if (sec.dataset.momento !== m) {
      sec.dataset.momento = m;
      $$(".momento", sec).forEach((el, i) => el.classList.toggle("activo", ["manana", "tarde", "noche"][i] === m));
    }
    const arco = $("#arco-sol"), bola = $("#bola-sol"), sombra = $("#sombra-luna");
    const pt = arco.getPointAtLength(Math.min(1, p * 1.05) * arco.getTotalLength());
    bola.setAttribute("cx", pt.x); bola.setAttribute("cy", pt.y);
    sombra.setAttribute("cx", pt.x + 7); sombra.setAttribute("cy", pt.y - 4);
    sombra.style.opacity = noche;
  }

  function iniciarMovimiento() {
    if (!hayGsap) return;
    gsap.registerPlugin(ScrollTrigger);
    if (!reducido && typeof Lenis !== "undefined") {
      lenis = new Lenis({ lerp: 0.09 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((x) => lenis.raf(x * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const d = $(a.getAttribute("href"));
      if (!d) return;
      e.preventDefault();
      irA(d);
    }));
    ScrollTrigger.create({ trigger: ".marquesina", start: "top 80px", onEnter: () => $("#barra").classList.add("solida"), onLeaveBack: () => $("#barra").classList.remove("solida") });

    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const st = ScrollTrigger.create({ trigger: ".dia-ideal", start: "top top", end: "+=170%", pin: true, scrub: true,
        onUpdate: (s) => { momentoDelDia(s.progress); $("#barra").classList.toggle("sobre-noche", s.isActive && s.progress > 0.7); },
        onLeave: () => $("#barra").classList.remove("sobre-noche"), onLeaveBack: () => $("#barra").classList.remove("sobre-noche") });
      const pista = $("#carrusel");
      const distancia = () => Math.max(0, pista.scrollWidth - window.innerWidth);
      const tw = gsap.to(pista, { x: () => -distancia(), ease: "none",
        scrollTrigger: { trigger: ".lugares", start: "top top", end: () => "+=" + distancia(), pin: true, scrub: 0.8, invalidateOnRefresh: true } });
      return () => { st.kill(); tw.kill(); };
    });
    mm.add("(max-width: 899px)", () => {
      const st = ScrollTrigger.create({ trigger: ".dia-ideal", start: "top 70%", end: "bottom 30%", scrub: true, onUpdate: (s) => momentoDelDia(s.progress) });
      return () => st.kill();
    });
    momentoDelDia(0);
    if (reducido) return;

    gsap.timeline({ defaults: { ease: "expo.out" } })
      .from(".antetitulo, .bajada", { y: 30, opacity: 0, duration: 1.2, stagger: 0.12 }, 0.3)
      .from(".buscador", { y: 70, opacity: 0, duration: 1.4 }, 0.55)
      .from(".sugerencias", { y: 20, opacity: 0, duration: 0.9 }, 0.9)
      .from(".sol-disco", { scale: 0.4, opacity: 0, duration: 2.4 }, 0);
    ScrollTrigger.create({ trigger: ".portada", start: "top top", end: "bottom top", scrub: true,
                           onUpdate: (s) => estado.escenas.agua && estado.escenas.agua.setProgreso(s.progress) });
    gsap.to(".portada-contenido", { yPercent: -18, ease: "none", scrollTrigger: { trigger: ".portada", start: "top top", end: "bottom top", scrub: true } });
    $$(".titulo-seccion, .pie-grande").forEach((el) => {
      gsap.from(el, { y: 80, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 92%", once: true } });
    });
    gsap.fromTo(".alt-foto", { clipPath: "inset(10% 7% 10% 7% round 48px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none",
      scrollTrigger: { trigger: ".alternativa", start: "top 90%", end: "top 15%", scrub: true } });
    gsap.fromTo(".alt-foto img", { scale: 1.3 }, { scale: 1.05, ease: "none", scrollTrigger: { trigger: ".alternativa", start: "top bottom", end: "bottom top", scrub: true } });

    $$(".magnetico").forEach((b) => {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.18, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.5, ease: "power3.out" });
      });
      b.addEventListener("pointerleave", () => gsap.to(b, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, .4)" }));
    });
  }

  function animarViaje() {
    const letrero = $("#viaje-letrero"), bienvenida = $("#v-bienvenida");
    const paradas = () => $$(".parada");
    const fases = [["mov_bus", [0, 1]], ["mov_tren", [2]], ["mov_avion", [3]], ["mov_lancha", [4]], ["mov_bienvenida", [0, 1, 2, 3, 4]]];
    let fase = -1;
    const ponerFase = (f) => {
      if (f === fase) return;
      fase = f;
      letrero.textContent = t(fases[f][0]);
      letrero.classList.remove("entra"); void letrero.offsetWidth; letrero.classList.add("entra");
      paradas().forEach((el, i) => el.classList.toggle("activa", fases[f][1].includes(i)));
    };
    estado.faseViaje = () => { const f = fase; fase = -1; ponerFase(Math.max(0, f)); bienvenida.textContent = t("mov_bienvenida"); };
    bienvenida.textContent = t("mov_bienvenida");
    const ruta = $("#v-ruta"), largo = ruta.getTotalLength();
    ruta.style.strokeDasharray = `${largo}`;
    if (!hayGsap || reducido) {
      $("#v-qroo").setAttribute("opacity", 1);
      $$("#v-bus, #v-tren, #v-avion, #v-agua").forEach((el) => el.setAttribute("opacity", 0));
      ruta.style.strokeDashoffset = 0;
      ponerFase(4);
      return;
    }
    ruta.style.strokeDashoffset = largo;
    const tl = gsap.timeline({ defaults: { ease: "none" }, onUpdate: () => {
      const x = tl.time();
      ponerFase(x < 0.9 ? 0 : x < 1.8 ? 1 : x < 2.85 ? 2 : x < 4.1 ? 3 : 4);
    } });
    tl.fromTo("#v-bus", { x: -340 }, { x: 1300, duration: 1 }, 0)
      .fromTo("#v-tren", { x: -900 }, { x: 1300, duration: 1 }, 0.8)
      .fromTo("#v-avion", { x: -300, y: 340, rotation: -4, transformOrigin: "50% 50%" }, { x: 1320, y: 150, rotation: -10, duration: 1.1 }, 1.7)
      .fromTo("#v-agua", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 2.75)
      .fromTo("#v-lancha", { x: -300, y: 0 }, { x: 1320, y: -20, duration: 1.15 }, 2.9)
      .fromTo("#v-velero", { x: -200 }, { x: 700, duration: 1.3 }, 2.8)
      .to("#v-paisaje", { opacity: 0, duration: 0.4 }, 4.1)
      .to("#v-agua", { opacity: 0, duration: 0.4 }, 4.1)
      .fromTo("#v-qroo", { opacity: 0 }, { opacity: 1, duration: 0.5 }, 4.1)
      .fromTo("#v-mapa", { scale: 0.45, transformOrigin: "50% 50%", rotation: -8 }, { scale: 0.84, rotation: 0, duration: 0.7, ease: "back.out(1.4)" }, 4.15)
      .to(ruta, { strokeDashoffset: 0, duration: 0.7 }, 4.55)
      .fromTo(".pin", { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.3, stagger: 0.08, ease: "back.out(3)" }, 4.55)
      .to({}, { duration: 0.3 });
    ScrollTrigger.create({ trigger: ".moverse", start: "top top", end: () => "+=" + window.innerHeight * 3.2, pin: true, scrub: 0.6, animation: tl, anticipatePin: 1 });
  }

  function animarMosaico() {
    if (!hayGsap || reducido) return;
    $$(".tesela img").forEach((img, i) => {
      gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });
    gsap.from(".tesela", { y: 70, opacity: 0, duration: 1.1, stagger: 0.06, ease: "expo.out", scrollTrigger: { trigger: "#mosaico", start: "top 85%", once: true } });
    gsap.from(".plato", { y: 60, opacity: 0, rotate: (i) => (i % 2 ? 2 : -2), duration: 1, stagger: 0.08, ease: "expo.out", scrollTrigger: { trigger: "#platos", start: "top 85%", once: true } });
  }


  // ------------------------------------------------------------- modo nocturno
  (function tema() {
    const btn = $("#tema");
    let guardado = null;
    try { guardado = localStorage.getItem("temporada-tema"); } catch (e) { /* sin almacenamiento */ }
    const aplicar = (noche) => {
      document.documentElement.dataset.tema = noche ? "noche" : "dia";
      btn.setAttribute("aria-pressed", String(noche));
      btn.setAttribute("aria-label", t(noche ? "tema_dia" : "tema_noche"));
      btn.title = btn.getAttribute("aria-label");
    };
    aplicar(guardado ? guardado === "noche" : matchMedia("(prefers-color-scheme: dark)").matches);
    btn.addEventListener("click", () => {
      const noche = document.documentElement.dataset.tema !== "noche";
      aplicar(noche);
      try { localStorage.setItem("temporada-tema", noche ? "noche" : "dia"); } catch (e) { /* sin almacenamiento */ }
    });
    estado.temaTexto = () => aplicar(document.documentElement.dataset.tema === "noche");
  })();

  // ------------------------------------------------------------- mapa de Google
  const modal = $("#mapa-modal");
  function abrirMapa(nombre, embed, enlace) {
    $("#mapa-titulo").textContent = nombre;
    $("#mapa-iframe").src = embed;
    $("#mapa-abrir").href = enlace;
    if (modal.showModal) modal.showModal(); else window.open(enlace, "_blank", "noopener");
  }
  $("#mapa-cerrar").addEventListener("click", () => { modal.close(); $("#mapa-iframe").src = "about:blank"; });
  modal.addEventListener("click", (e) => { if (e.target === modal) { modal.close(); $("#mapa-iframe").src = "about:blank"; } });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mapa]");
    if (!b) return;
    e.preventDefault();
    abrirMapa(b.dataset.nombre, b.dataset.mapa, b.getAttribute("href"));
  });
  const FOTOS_ZONA = { "Cancún": ["postal_cancun", "cancun", "el_rey", "museo_maya_cancun", "palapas"],
                       "Playa del Carmen": ["postal_playa", "playa", "quinta_avenida"], "Tulum": ["postal_tulum", "tulum", "dos_ojos", "sian_kaan"],
                       "Bacalar": ["postal_bacalar", "bacalar", "bacalar_manana", "canal_piratas", "bacalar_orilla"],
                       "Mahahual": ["mahahual_barcas", "mahahual", "mahahual_malecon"], "Chetumal": ["postal_chetumal", "chetumal", "museo_maya"] };
  const fotoZona = (zona, i) => { const l = FOTOS_ZONA[zona] || ["postal_cancun"]; return foto(l[i % l.length]); };

  // ---------------------------------------------------------- rueda del año
  let rueda = null;
  function pintarRueda(meta) {
    const svg = $("#rueda");
    const cal = meta.calendario.filter((c) => c.periodo >= periodoHoy);
    const periodos = [...new Set(cal.map((c) => c.periodo))].slice(0, 12);
    const orden = ["cancun", "riviera_maya", "gran_costa_maya"];
    const COLOR = { tranquilo: "#2bc4b3", moderado: "#1fa4ae", concurrido: "#f2a541", lleno: "#e5472d" };
    const CX = 360, CY = 360, N = periodos.length, paso = (Math.PI * 2) / N;
    const anillo = { cancun: [250, 330], riviera_maya: [172, 244], gran_costa_maya: [96, 166] };
    const punto = (r, a) => [CX + r * Math.sin(a), CY - r * Math.cos(a)];
    const arco = (r0, r1, a0, a1) => {
      const [x0, y0] = punto(r1, a0), [x1, y1] = punto(r1, a1), [x2, y2] = punto(r0, a1), [x3, y3] = punto(r0, a0);
      return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
    };
    let html = `<defs><filter id="sombra-rueda"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-opacity=".25"/></filter></defs>
      <circle cx="${CX}" cy="${CY}" r="344" class="rueda-fondo"/>`;
    orden.forEach((id) => {
      const [r0, rMax] = anillo[id];
      periodos.forEach((p, i) => {
        const c = cal.find((x) => x.destino_id === id && x.periodo === p);
        const k = Math.max(0.25, Math.min(1, (c.p50 - 30) / 60));
        const r1 = r0 + (rMax - r0) * k;
        const a0 = i * paso + 0.02, a1 = (i + 1) * paso - 0.02;
        html += `<path class="gajo" d="${arco(r0, r1, a0, a1)}" fill="${COLOR[c.nivel]}" data-periodo="${p}" data-destino="${id}" style="--i:${i}"></path>`;
      });
      const [lx, ly] = punto((r0 + rMax) / 2, -0.001);
      html += `<text class="rueda-anillo" x="${CX + 6}" y="${CY - r0 - 6}">${NOMBRE[id]}</text>`;
    });
    periodos.forEach((p, i) => {
      const [x, y] = punto(356, (i + 0.5) * paso);
      html += `<text class="rueda-mes" x="${x}" y="${y}" data-periodo="${p}" text-anchor="middle" dominant-baseline="middle">${mesCorto(p)}${+p.slice(5) === 1 ? "·" + p.slice(2, 4) : ""}</text>`;
    });
    html += `<circle cx="${CX}" cy="${CY}" r="88" class="rueda-centro-fondo"/>
      <text class="rueda-centro-mes" id="rc-mes" x="${CX}" y="${CY - 8}" text-anchor="middle"></text>
      <text class="rueda-centro-sub" id="rc-sub" x="${CX}" y="${CY + 22}" text-anchor="middle"></text>`;
    svg.innerHTML = html;
    svg.setAttribute("aria-label", t("cuando_nota"));

    const leyenda = $("#rueda-leyenda");
    const centro = (p) => {
      $("#rc-mes").textContent = p ? capital(mes(p)) : "";
      $("#rc-sub").textContent = p ? p.slice(0, 4) : t("rueda_centro");
      leyenda.innerHTML = p ? orden.map((id) => {
        const c = cal.find((x) => x.destino_id === id && x.periodo === p);
        return `<div data-nivel="${c.nivel}"><b>${NOMBRE[id]}</b>${olitas(OLAS[c.nivel])}<span>${esc(nivelTxt(c.nivel)[1])}</span></div>`;
      }).join("") : Object.keys(OLAS).map((n) => `<div data-nivel="${n}"><b>${esc(nivelTxt(n)[1])}</b>${olitas(OLAS[n])}</div>`).join("");
    };
    const marcar = (p, clase) => {
      $$(".gajo, .rueda-mes", svg).forEach((g) => g.classList.toggle(clase, g.dataset.periodo === p));
    };
    let fijo = null;
    $$(".gajo, .rueda-mes", svg).forEach((g) => {
      g.addEventListener("pointerenter", () => { marcar(g.dataset.periodo, "hover"); centro(g.dataset.periodo); });
      g.addEventListener("click", () => planear(estado.destino, mitad(g.dataset.periodo), true));
    });
    svg.addEventListener("pointerleave", () => { marcar(null, "hover"); centro(fijo); });
    centro(null);
    if (hayGsap && !reducido) {
      gsap.from($$(".gajo", svg), { scale: 0, transformOrigin: `${CX}px ${CY}px`, duration: 0.9, ease: "expo.out",
        stagger: { each: 0.012 }, scrollTrigger: { trigger: svg, start: "top 80%", once: true } });
    }
    rueda = {
      elegir(p, destino) {
        fijo = periodos.includes(p) ? p : null;
        marcar(fijo, "elegido");
        $$(".gajo", svg).forEach((g) => g.classList.toggle("atenuado", g.dataset.destino !== destino));
        centro(fijo);
      },
    };
  }

  // ----------------------------------------------------------- descubrimos
  const ICONO_PERSONA = '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="3.2"/><path d="M6 21v-5.5A4.5 4.5 0 0 1 10.5 11h3a4.5 4.5 0 0 1 4.5 4.5V21z"/></svg>';
  const ICONO_PERFIL = {
    crucerista: '<svg viewBox="0 0 24 24"><path d="M3 15h18l-2.5 5h-13zM6 15V9h12v6M9 9V5h6v4M3 21c2 1 4 1 6 0s4-1 6 0 4 1 6 0"/></svg>',
    fronterizo: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 16h6"/></svg>',
    pasajero_tren: RUTA_ICONO[2],
    huesped_norte: '<svg viewBox="0 0 24 24"><rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V4h6v3M9 12h6"/></svg>',
  };
  async function pintarDescubre() {
    let d;
    try { d = await api("/api/viaja/descubre"); } catch (e) { return; }
    const orden = ["cancun", "riviera_maya", "gran_costa_maya"];
    const por = Object.fromEntries(d.destinos.map((x) => [x.id, x]));
    $("#personitas").innerHTML = orden.map((id) => {
      const n = Math.round(por[id].retencion * 10);
      return `<div class="fila-personas"><b>${NOMBRE[id]}</b><div>${Array.from({ length: 10 }, (_, i) =>
        `<i class="${i < n ? "duerme" : "se-va"}">${ICONO_PERSONA}</i>`).join("")}</div></div>`;
    }).join("") + `<p class="personas-ley"><i class="duerme">${ICONO_PERSONA}</i>${esc(t("se_quedan"))}<i class="se-va">${ICONO_PERSONA}</i>${esc(t("se_van"))}</p>`;
    const maxUsd = Math.max(...d.destinos.map((x) => x.usd_por_visitante));
    $("#monedas").innerHTML = orden.map((id) => {
      const n = Math.max(1, Math.round((por[id].usd_por_visitante / maxUsd) * 12));
      return `<div class="pila"><div class="pila-monedas">${Array.from({ length: n }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div><b>${NOMBRE[id]}</b></div>`;
    }).join("");
    // flujos: forma del estado y puntos que viajan
    const pos = { cancun: [303, 51], riviera_maya: [254, 138], gran_costa_maya: [150, 350] };
    const lin = [];
    const pares = {};
    d.viajes.forEach((v) => {
      const k = [v.origen, v.destino].sort().join("|");
      pares[k] = (pares[k] || 0) + v.viajes_est;
    });
    const maxV = Math.max(...Object.values(pares));
    let svgF = `<g transform="translate(50 20) scale(.95)"><use href="#qroo-forma" class="flujo-tierra"/>`;
    Object.entries(pares).forEach(([k, v], j) => {
      const [a, b] = k.split("|"), [x0, y0] = pos[a], [x1, y1] = pos[b];
      const mx = (x0 + x1) / 2 + 40, my = (y0 + y1) / 2;
      const d0 = `M${x0} ${y0} Q${mx} ${my} ${x1} ${y1}`;
      const grosor = 1.5 + 8 * Math.sqrt(v / maxV);
      const puntos = Math.max(1, Math.round(10 * Math.sqrt(v / maxV)));
      svgF += `<path d="${d0}" class="flujo-ruta" stroke-width="${grosor}"/>`;
      for (let i = 0; i < puntos; i++) {
        svgF += `<circle r="3.2" class="flujo-punto"><animateMotion dur="${(3 + j).toFixed(1)}s" begin="${(i * (3 + j) / puntos).toFixed(2)}s" repeatCount="indefinite" keyPoints="${i % 2 ? "1;0" : "0;1"}" keyTimes="0;1" calcMode="linear" path="${d0}"/></circle>`;
      }
    });
    orden.forEach((id) => {
      const [x, y] = pos[id];
      svgF += `<circle cx="${x}" cy="${y}" r="9" class="flujo-pin"/><text x="${id === "gran_costa_maya" ? x - 14 : x + 14}" y="${y + 5}" text-anchor="${id === "gran_costa_maya" ? "end" : "start"}" class="flujo-txt">${NOMBRE[id]}</text>`;
    });
    $("#flujos").innerHTML = svgF + "</g>";
    const perf = C.ui[idioma].perfiles || C.ui.es.perfiles;
    $("#perfiles").innerHTML = d.perfiles.map((p) => {
      const [n, inv, mom] = perf[p.id] || [p.id, "", ""];
      return `<article class="perfil"><span class="perfil-icono">${ICONO_PERFIL[p.id] || ""}</span><div><h4>${esc(n)}</h4><p>“${esc(inv)}”</p><small>${esc(mom)}</small></div></article>`;
    }).join("");
    if (hayGsap && !reducido) {
      gsap.from(".fila-personas i", { y: 20, opacity: 0, duration: 0.5, stagger: 0.02, ease: "back.out(2)", scrollTrigger: { trigger: "#personitas", start: "top 85%", once: true } });
      gsap.from(".pila-monedas i", { y: -120, opacity: 0, duration: 0.7, stagger: 0.03, ease: "bounce.out", scrollTrigger: { trigger: "#monedas", start: "top 85%", once: true } });
    }
  }

  function pintarNosotros() {
    $("#tuberia").innerHTML = t("tuberia").map((x) => `<li><span>${esc(x)}</span></li>`).join("");
    const ICON = [
      '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/><circle cx="18" cy="17" r="2"/></svg>',
      '<svg viewBox="0 0 24 24"><path d="M3 20h18M5 16l4-6 4 3 5-8"/></svg>',
      '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.3"/><circle cx="15" cy="15" r="1.3"/><circle cx="15" cy="9" r="1.3"/><circle cx="9" cy="15" r="1.3"/></svg>',
      '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M8 6l8 5M8 18l8-5"/></svg>',
      '<svg viewBox="0 0 24 24"><path d="M4 18c4-8 12-8 16-12M15 6h5v5"/></svg>',
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>',
    ];
    $("#metodos").innerHTML = t("metodos").map(([n, x], i) => `<article class="metodo"><span>${ICON[i]}</span><h3>${esc(n)}</h3><p>${esc(x)}</p></article>`).join("");
  }

  // ------------------------------------------------------------------ buscador
  const inp = $("#fecha-texto"), pista = $("#fecha-pista");
  let reloj = 0, pendiente = null;
  function ponerPista(texto, e) { pista.dataset.estado = e || ""; pista.textContent = texto; }
  async function interpretar(texto) {
    if (!texto.trim()) { estado.interpretada = null; ponerPista(""); return null; }
    try {
      const r = await api(`/api/viaja/interpretar?texto=${encodeURIComponent(normalizarFecha(texto))}`);
      if (inp.value !== texto) return null;
      if (!r.en_rango) {
        estado.interpretada = null;
        ponerPista(r.fecha < hoyIso ? t("err_pasada") : t("err_rango"), "error");
        return null;
      }
      estado.interpretada = { ...r, entrada: texto };
      ponerPista(`${capital(fechaLarga(r.fecha))}${r.motivo && idioma === "es" ? " · " + r.motivo : ""}${r.precision === "mes" ? " · " + t("pista_mes") : ""}`, "ok");
      return r;
    } catch (e) {
      estado.interpretada = null;
      ponerPista(t("err_fecha"), "error");
      return null;
    }
  }
  inp.addEventListener("input", () => { clearTimeout(reloj); reloj = setTimeout(() => { pendiente = interpretar(inp.value); }, 250); });
  $("#buscador").addEventListener("submit", async (e) => {
    e.preventDefault();
    clearTimeout(reloj);
    let r = estado.interpretada && estado.interpretada.entrada === inp.value ? estado.interpretada : await interpretar(inp.value);
    if (!r && pendiente) r = await pendiente;
    if (r) planear(estado.destino, r.fecha, true);
    else if (!pista.textContent) ponerPista(t("err_vacia"), "error");
  });
  function pintarSugerencias() {
    $("#sugerencias").innerHTML = `<span>${esc(t("prueba"))}</span>` + t("sugerencias").map((s) => `<button type="button">${esc(s)}</button>`).join("");
    $$("#sugerencias button").forEach((b) => b.addEventListener("click", async () => {
      inp.value = b.textContent;
      const r = await interpretar(inp.value);
      if (r) planear(estado.destino, r.fecha, true);
    }));
  }

  const lista = $("#destino-lista"), botonDestino = $("#destino-boton");
  function pintarListaDestinos() {
    lista.innerHTML = Object.keys(NOMBRE).map((id) => {
      const lema = idioma === "es" ? { cancun: "El Caribe que todos conocen", riviera_maya: "Ruinas frente al mar y cenotes", gran_costa_maya: "Bacalar, Mahahual y Chetumal" }[id] : C.destinos[idioma][id][1];
      return `<li><button type="button" role="option" data-destino="${id}" aria-selected="${id === estado.destino}"><img src="${FOTO_DESTINO[id]}" alt=""><span><b>${NOMBRE[id]}</b><small>${esc(lema)}</small></span></button></li>`;
    }).join("");
    $$("button", lista).forEach((b) => b.addEventListener("click", () => {
      elegirDestino(b.dataset.destino);
      lista.hidden = true;
      botonDestino.setAttribute("aria-expanded", "false");
      if (estado.plan && estado.plan.destino.id !== b.dataset.destino) planear(b.dataset.destino, estado.fecha, false);
    }));
  }
  let fondoActual = null, relojFondo = 0;
  function pintarFondo(id) {
    if (fondoActual === id) return;
    fondoActual = id;
    const cfg = C.fondos[id];
    const caja = $("#fondo-destino");
    clearInterval(relojFondo);
    const capa = document.createElement("div");
    capa.className = "fondo-capa";
    if (cfg.video) {
      const poster = cfg.tomas.find(foto);
      capa.innerHTML = `<video src="img/${esc(cfg.video)}" ${poster ? `poster="${foto(poster)}"` : ""} ${reducido ? "" : "autoplay"} muted loop playsinline preload="auto"></video>`;
      const v = $("video", capa);
      v.muted = true;
      if (!reducido) v.play().catch(() => {});
    } else {
      capa.innerHTML = cfg.tomas.filter(foto).map((k, i) => `<img class="toma${i === 0 ? " activa" : ""}" src="${foto(k)}" alt="">`).join("");
      const tomas = $$(".toma", capa);
      let i = 0;
      if (!reducido && tomas.length > 1) relojFondo = setInterval(() => {
        tomas[i].classList.remove("activa");
        i = (i + 1) % tomas.length;
        tomas[i].classList.add("activa");
      }, 7000);
    }
    caja.appendChild(capa);
    requestAnimationFrame(() => capa.classList.add("visible"));
    $$(".fondo-capa", caja).slice(0, -1).forEach((v) => { v.classList.remove("visible"); setTimeout(() => v.remove(), 1400); });
  }
  function elegirDestino(id) {
    estado.destino = id;
    if (Object.keys(estado.creditos).length) pintarFondo(id);
    $("#destino-nombre").textContent = NOMBRE[id];
    $("#destino-img").src = FOTO_DESTINO[id];
    $$("button", lista).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.destino === id)));
    if (!$("#cal-pop").hidden) pintarMeses(estado.fecha.slice(0, 7));
  }
  botonDestino.addEventListener("click", () => { lista.hidden = !lista.hidden; botonDestino.setAttribute("aria-expanded", String(!lista.hidden)); });
  $("#cambiar-fecha").addEventListener("click", () => {
    irA($("#inicio"));
    setTimeout(() => { inp.focus(); inp.select(); abrirCalendario(); }, reducido ? 0 : 900);
  });

  const pop = $("#cal-pop");
  function abrirCalendario() {
    pop.hidden = false;
    $("#abrir-cal").setAttribute("aria-expanded", "true");
    pintarMeses((estado.interpretada?.fecha || estado.fecha).slice(0, 7));
    if (lenis) lenis.scrollTo($("#buscador"), { offset: -90, duration: 1 });
    if (hayGsap && !reducido) gsap.from(pop, { y: -12, opacity: 0, duration: 0.5, ease: "expo.out" });
  }
  function cerrarCalendario() { pop.hidden = true; $("#abrir-cal").setAttribute("aria-expanded", "false"); }
  $("#abrir-cal").addEventListener("click", () => (pop.hidden ? abrirCalendario() : cerrarCalendario()));
  $("#cal-cerrar").addEventListener("click", cerrarCalendario);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { cerrarCalendario(); lista.hidden = true; } });
  document.addEventListener("click", (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !$("#abrir-cal").contains(e.target)) cerrarCalendario();
    if (!lista.hidden && !lista.contains(e.target) && !botonDestino.contains(e.target)) lista.hidden = true;
  });
  function pintarMeses(activo) {
    if (!estado.meta) return;
    const cal = estado.meta.calendario.filter((c) => c.destino_id === estado.destino && c.periodo >= periodoHoy);
    if (!cal.some((c) => c.periodo === activo)) activo = cal[0]?.periodo;
    $("#cal-meses").innerHTML = cal.map((c) => `<button type="button" class="cal-mes${c.periodo === activo ? " activo" : ""}" data-periodo="${c.periodo}" data-nivel="${c.nivel}">
        <b>${mes(c.periodo)}</b><small>${c.periodo.slice(0, 4)}</small>${olitas(OLAS[c.nivel])}<span>${nivelTxt(c.nivel)[1]}</span></button>`).join("");
    $$(".cal-mes").forEach((b) => b.addEventListener("click", () => {
      $$(".cal-mes").forEach((x) => x.classList.toggle("activo", x === b));
      pintarDias(b.dataset.periodo);
    }));
    const act = $(".cal-mes.activo");
    if (act) act.scrollIntoView({ block: "nearest", inline: "center" });
    pintarDias(activo);
  }
  function pintarDias(periodo) {
    const [a, m] = periodo.split("-").map(Number);
    const desfase = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7;
    const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const festivos = Object.fromEntries(estado.fechas.festivos.map((f) => [f.fecha, festivoTxt(f.nombre)]));
    const elegida = estado.interpretada?.fecha || estado.fecha;
    const cab = [...Array(7)].map((_, i) => fmt(`2024-01-0${i + 1}`, { weekday: "narrow" }));
    let html = cab.map((d) => `<span class="cal-cab">${d}</span>`).join("") + "<span></span>".repeat(desfase);
    for (let d = 1; d <= total; d++) {
      const iso = `${periodo}-${String(d).padStart(2, "0")}`;
      const vac = estado.fechas.periodos.find((p) => iso >= p.desde && iso <= p.hasta);
      const finde = (desfase + d - 1) % 7 >= 5;
      const titulo = [festivos[iso], vac && festivoTxt(vac.nombre === "Vacaciones de invierno" ? "Vacaciones de invierno (periodo aproximado)" : vac.nombre)].filter(Boolean).join(" · ");
      html += `<button type="button" class="cal-dia${finde ? " finde" : ""}${festivos[iso] ? " festivo" : ""}${vac ? " vacaciones" : ""}${iso === elegida ? " elegido" : ""}"
        data-fecha="${iso}" ${iso < hoyIso ? "disabled" : ""} ${titulo ? `title="${esc(titulo)}"` : ""} aria-label="${esc(fechaLarga(iso))}${titulo ? ", " + esc(titulo) : ""}">${d}</button>`;
    }
    $("#cal-titulo").textContent = `${mes(periodo)} ${a}`;
    $("#cal-dias").innerHTML = html;
    $$(".cal-dia:not(:disabled)").forEach((b) => b.addEventListener("click", () => elegirFecha(b.dataset.fecha)));
  }
  function elegirFecha(iso) {
    inp.value = fmt(iso, { day: "numeric", month: "long", year: "numeric" });
    estado.interpretada = { fecha: iso, precision: "dia", en_rango: true, entrada: inp.value };
    ponerPista(capital(fechaLarga(iso)), "ok");
    cerrarCalendario();
    planear(estado.destino, iso, true);
  }

  // ------------------------------------------------------------ contenido fijo
  function pintarIdiomaFijo() {
    document.documentElement.lang = idioma;
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.dataset.i18nHtml);
      if (el.id === "titular" && hayGsap && !reducido) partir(el, el.innerHTML);
    });
    $$("[data-i18n-attr]").forEach((el) => {
      const [attr, k] = el.dataset.i18nAttr.split(":");
      el.setAttribute(attr, t(k));
    });
    pintarSugerencias();
    pintarListaDestinos();

    $("#mosaico").innerHTML = C.postales.map((p, i) => {
      const cr = creditoDe(p.foto);
      return `<figure class="tesela t${i % 6}"><img src="${foto(p.foto)}" alt="${esc(p[idioma])}" loading="lazy">
        <figcaption>${esc(p[idioma])}${cr ? `<a href="${esc(cr.fuente)}" target="_blank" rel="noopener">${esc(cr.autor || "")} · ${esc(cr.licencia)}</a>` : ""}</figcaption></figure>`;
    }).join("");
    $("#ruta").innerHTML = C.moverse[idioma].map(([titulo, texto], i) =>
      `<article class="parada"><span class="parada-icono">${RUTA_ICONO[i]}</span><div><h3>${esc(titulo)}</h3><p>${esc(texto)}</p></div></article>`).join("");
    $("#faq-lista").innerHTML = C.faq.map((f, i) => {
      const [pregunta, respuesta] = f[idioma] || f.es;
      return `<details class="pregunta"${i === 0 ? " open" : ""}><summary><span>${esc(pregunta)}</span><i aria-hidden="true"></i></summary><p>${esc(respuesta)}</p></details>`;
    }).join("");
    $("#consejos-comida").innerHTML = C.consejos_comida[idioma].map((c) => `<li>${esc(c)}</li>`).join("");
    const sel = $("#idioma");
    sel.innerHTML = Object.entries(C.idiomas).map(([k, v]) => `<option value="${k}"${k === idioma ? " selected" : ""}>${v}</option>`).join("");
    const cred = estado.creditos;
    $("#creditos").innerHTML = `<li>${esc(t("osm_credito"))}</li>` + Object.values(cred).map((c) =>
      `<li><a href="${esc(c.fuente)}" target="_blank" rel="noopener">${esc(c.titulo || c.archivo)}</a> — ${esc(c.autor || "—")} · ${esc(c.licencia)}</li>`).join("");
    $("#playa-niveles").innerHTML = Object.keys(OLAS).map((n) =>
      `<button type="button" data-nivel="${n}" title="${esc(t("playa_ayuda"))}">${olitas(OLAS[n])}<span>${esc(nivelTxt(n)[1])}</span></button>`).join("");
    $$("#playa-niveles button").forEach((b) => {
      const ver = () => { const p = estado.escenas.playa; if (p) { p.setGente(gente(PREVIA[b.dataset.nivel])); p.setVentanas(PREVIA[b.dataset.nivel] / 100); } b.classList.add("viendo"); };
      const volver = () => { b.classList.remove("viendo"); if (estado.plan) aplicarPlaya(estado.plan); };
      b.addEventListener("pointerenter", ver);
      b.addEventListener("focus", ver);
      b.addEventListener("pointerleave", volver);
      b.addEventListener("blur", volver);
      b.addEventListener("click", ver);
    });
  }
  $("#idioma").addEventListener("change", (e) => {
    idioma = e.target.value;
    try { localStorage.setItem("temporada-idioma", idioma); } catch (x) { /* sin almacenamiento */ }
    pintarIdiomaFijo();
    if (estado.meta) pintarMeta(estado.meta, true);
    if (estado.plan) pintarPlan(estado.plan, false);
    inp.value = fmt(estado.fecha, { day: "numeric", month: "long" });
    estado.interpretada = { fecha: estado.fecha, precision: "dia", en_rango: true, entrada: inp.value };
    ponerPista(capital(fechaLarga(estado.fecha)), "ok");
    if (estado.asistente) estado.asistente.idiomaCambiado();
    if (estado.faseViaje) estado.faseViaje();
    if (estado.temaTexto) estado.temaTexto();
    pintarNosotros();
    pintarDescubre();
    if (hayGsap) ScrollTrigger.refresh();
  });
  $("#faq-bot").addEventListener("click", () => estado.asistente && estado.asistente.preguntar(C.bot[idioma].sugerencias[1]));

  // ----------------------------------------------------------------------- meta
  function pintarMeta(meta, soloTextos) {
    const cal = meta.calendario.filter((c) => c.periodo >= periodoHoy);
    const periodos = [...new Set(cal.map((c) => c.periodo))];
    const items = periodos.slice(1, 4).flatMap((p) => cal.filter((c) => c.periodo === p).map((c) =>
      `<span data-nivel="${c.nivel}">${capital(mes(p))} <b>${NOMBRE[c.destino_id]}</b> ${olitas(OLAS[c.nivel])} <em>${esc(nivelTxt(c.nivel)[1])}</em></span>`)).join("");
    $("#marquesina").innerHTML = items + items;

    const orden = ["gran_costa_maya", "riviera_maya", "cancun"];
    pintarRueda(meta);
    if (false) {
      const series = orden.map((id) => ({ id, nombre: NOMBRE[id], valores: periodos.map((p) => cal.find((c) => c.destino_id === id && c.periodo === p).p50) }));
      const tip = $("#ola-tip");
      try {
        estado.escenas.ola = Escenas.ola($("#ola"), { series, periodos }, (p) => planear(estado.destino, mitad(p), true), (p, x, y) => {
          if (!p) { tip.hidden = true; return; }
          tip.innerHTML = `<b>${mes(p)} ${p.slice(0, 4)}</b>` + orden.slice().reverse().map((id) => {
            const c = cal.find((k) => k.destino_id === id && k.periodo === p);
            return `<div data-nivel="${c.nivel}"><span>${NOMBRE[id]}</span>${olitas(OLAS[c.nivel])}</div>`;
          }).join("");
          tip.style.left = `${x}px`;
          tip.style.top = `${y}px`;
          tip.hidden = false;
        });
      } catch (e) { console.warn("WebGL", e); }
    }
    if (false) estado.escenas.ola.setEtiquetasMes((p) => (+p.slice(5) === 1 ? `${mesCorto(p)}<br><b>${p.slice(0, 4)}</b>` : mesCorto(p)));

    $("#acordeon").innerHTML = meta.destinos.map((d, i) => {
      const propios = cal.filter((c) => c.destino_id === d.id && c.sargazo !== "alto").sort((a, b) => a.p50 - b.p50).slice(0, 2);
      const meses = [...new Set(propios.map((c) => mes(c.periodo)))];
      const [region, lema] = destinoTxt(d);
      return `<button type="button" class="panel${i === 2 ? " abierto" : ""}" data-destino="${d.id}">
        ${fotoHTML(d.foto, d.nombre)}
        <span class="panel-info">
          <small>${esc(t("region_de", { r: region }))}</small>
          <strong>${esc(d.nombre)}</strong>
          <em>${esc(lema)}</em>
          <span class="panel-detalle"><p>${esc(t("con_calma", { m: meses.join(C.bot[idioma].y) }))}</p><span>${esc(t("planear_aqui"))}</span></span>
        </span>
      </button>`;
    }).join("");
    $$(".panel").forEach((p) => {
      const abrir = () => $$(".panel").forEach((x) => x.classList.toggle("abierto", x === p));
      p.addEventListener("mouseenter", abrir);
      p.addEventListener("focus", abrir);
      p.addEventListener("click", () => { elegirDestino(p.dataset.destino); planear(p.dataset.destino, estado.fecha, true); });
    });
  }

  // ------------------------------------------------------------------------ plan
  function eventos(p) {
    const ev = [];
    const pr = p.prediccion, d = p.destino.nombre, m = mes(p.mes.periodo);
    const cal = estado.meta.calendario.filter((c) => c.destino_id === p.destino.id);
    const rango = cal.filter((c) => c.p50 <= pr.ocupacion_p50_est).length / cal.length;
    if (rango >= 0.75) ev.push(["alto", t("ev_mas_t"), t("ev_mas_x", { m: capital(m), d })]);
    else if (rango <= 0.3) ev.push(["bajo", t("ev_menos_t"), t("ev_menos_x", { m })]);
    if (p.dia.periodo_vacacional) ev.push(["alto", festivoTxt(p.dia.periodo_vacacional), t("ev_vac_x")]);
    p.dia.festivos_cercanos.filter((f) => !(p.dia.periodo_vacacional && /Santo|Navidad|Año Nuevo/.test(f.nombre))).forEach((f) => {
      const puente = f.nombre.includes("puente");
      ev.push(puente ? ["medio", t("ev_puente_t"), t("ev_puente_x", { f: festivoTxt(f.nombre).replace(/ \(.*\)/, "") })] : ["medio", festivoTxt(f.nombre), t("ev_festivo_x")]);
    });
    if (p.dia.fin_de_semana && !p.dia.periodo_vacacional && !p.dia.festivos_cercanos.length) ev.push(["medio", t("ev_finde_t"), t("ev_finde_x")]);
    if (p.sargazo?.nivel === "alto") ev.push(["alerta", t("ev_sarg_alto_t"), t("ev_sarg_alto_x")]);
    else if (p.sargazo?.nivel === "medio") ev.push(["alerta", t("ev_sarg_medio_t"), t("ev_sarg_medio_x")]);
    if (pr.turistas_p50_est) {
      const miles = (Math.round(pr.turistas_p50_est / 10000) * 10).toLocaleString(LOCALE[idioma]);
      ev.push(["info", t("ev_visit_t", { n: miles }), t("ev_visit_x", { d, m })]);
    }
    return ev.slice(0, 4);
  }

  function aplicarPlaya(p) {
    const e = estado.escenas.playa;
    if (!e) return;
    e.setGente(gente(p.prediccion.ocupacion_p50_est));
    e.setVentanas(p.prediccion.ocupacion_p50_est / 100);
    e.setSargazo(p.sargazo?.nivel);
  }

  function pintarPlan(p, animar) {
    const pr = p.prediccion;
    const [titulo, , frase] = nivelTxt(pr.nivel);
    $("#resultado").dataset.nivel = pr.nivel;
    $("#res-fecha").textContent = capital(fechaLarga(p.fecha));
    $("#res-destino").textContent = t("estara", { d: p.destino.nombre });
    if (animar) partir($("#res-nivel"), esc(titulo)); else $("#res-nivel").textContent = titulo;
    $("#res-olitas").innerHTML = olitas(OLAS[pr.nivel]);
    $("#res-olitas").dataset.nivel = pr.nivel;
    if (hayGsap && !reducido && animar) gsap.from("#res-olitas i.on", { scaleX: 0, transformOrigin: "left", duration: 0.8, stagger: 0.12, ease: "expo.out", delay: 0.2 });
    $("#res-frase").textContent = frase;
    $("#eventos").innerHTML = eventos(p).map(([tono, tt, x]) => `<li class="evento" data-tono="${tono}"><span class="evento-icono">${ICONO[tono]}</span><div><h4>${esc(tt)}</h4><p>${esc(x)}</p></div></li>`).join("");
    if (animar) aparecer(".evento", $("#eventos"));
    $$("#playa-niveles button").forEach((b) => b.classList.toggle("actual", b.dataset.nivel === pr.nivel));

    const [codigo, ciudad] = AEROPUERTO[p.destino.id];
    const vuelos = `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights to ${codigo} on ${p.fecha}`)}&hl=${idioma}`;
    $("#vuelos").href = vuelos;
    $("#vuelos-barra").href = vuelos;
    $("#vuelos-barra").target = "_blank";
    $("#vuelos-texto").textContent = t("vuelos_a", { c: ciudad, f: fmt(p.fecha, { day: "numeric", month: "short" }) });
    aplicarPlaya(p);

    const actual = { periodo: p.mes.periodo, nivel: pr.nivel, actual: true };
    const dia = Math.min(+p.fecha.slice(8), 28);
    $("#vecinos").innerHTML = [...p.meses_vecinos, actual].sort((a, b) => a.periodo.localeCompare(b.periodo)).map((v) =>
      `<button type="button" class="vecino${v.actual ? " actual" : ""}" data-periodo="${v.periodo}" data-nivel="${v.nivel}" ${v.actual ? 'aria-current="true"' : ""}>
        <b>${mes(v.periodo)}</b>${olitas(OLAS[v.nivel])}<small>${esc(nivelTxt(v.nivel)[1])}</small></button>`).join("");
    $$(".vecino:not(.actual)").forEach((b) => b.addEventListener("click", () => {
      const iso = `${b.dataset.periodo}-${String(dia).padStart(2, "0")}`;
      planear(estado.destino, iso < hoyIso ? hoyIso : iso, false);
    }));

    const rec = p.recomendacion, alt = $("#alternativa");
    alt.hidden = !rec;
    if (rec) {
      if (rec.foto) { $("#alt-img").src = rec.foto.src; $("#alt-img").alt = rec.nombre; }
      $("#alt-titulo").innerHTML = t("alt_titulo", { d: esc(rec.nombre) });
      $("#alt-parrafo").textContent = t("argumento")[rec.destino_id];
      const fc = fechaCorta(p.fecha);
      $("#alt-comparar").innerHTML = [[p.destino.nombre, pr.nivel], [rec.nombre, rec.nivel]].map(([n, nv]) =>
        `<div data-nivel="${nv}"><b>${esc(n)}</b>${olitas(OLAS[nv])}<small>${esc(t("nivel_el", { n: nivelTxt(nv)[1], f: fc }))}</small></div>`).join("");
      $("#alt-boton").innerHTML = `${esc(t("alt_boton", { d: rec.nombre, f: fc }))} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`;
      $("#alt-boton").onclick = () => { elegirDestino(rec.destino_id); planear(rec.destino_id, p.fecha, true); };
    }

    $("#mejores-titulo").textContent = t("mejores", { d: p.destino.nombre });
    $("#mejores").innerHTML = p.mejores_meses.map((m) =>
      `<button type="button" class="mejor" data-periodo="${m.periodo}" data-nivel="${m.nivel}"><strong>${mes(m.periodo)}</strong><small>${m.anio}</small>${olitas(OLAS[m.nivel])}<span>${esc(t("planear_mes", { m: mes(m.periodo) }))}</span></button>`).join("");
    $$(".mejor").forEach((b) => b.addEventListener("click", () => planear(estado.destino, mitad(b.dataset.periodo), true)));
    if (rueda) rueda.elegir(p.mes.periodo, p.destino.id);

    const porId = Object.fromEntries(p.lugares.map((l) => [l.id, l]));
    const claves = { "mañana": "manana", tarde: "tarde", noche: "noche" };
    const momentoActual = $("#dia").dataset.momento;
    $("#itinerario").innerHTML = ["mañana", "tarde", "noche"].filter((k) => p.itinerario[k]).map((k) => {
      const l = porId[p.itinerario[k].id];
      const [n, dsc, cons] = lugarTxt(l);
      return `<li class="momento${claves[k] === momentoActual ? " activo" : ""}"><div class="momento-foto">${fotoHTML(l.foto, n)}<span class="hora">${esc(t(claves[k]))}</span></div>
        <h3>${esc(n)}</h3><p>${esc(dsc)}</p><p class="consejo">${esc(cons)}</p></li>`;
    }).join("");

    $("#lugares-titulo").innerHTML = t("lugares_titulo", { d: esc(p.destino.nombre) });
    const tipos = t("tipos");
    $("#carrusel").innerHTML = p.lugares.map((l) => {
      const [n, dsc, cons] = lugarTxt(l);
      return `<article class="lugar">
        ${fotoHTML(l.foto, n)}${l.foto ? `<a class="credito" href="${esc(l.foto.fuente)}" target="_blank" rel="noopener">${esc(l.foto.autor)}</a>` : ""}
        <div class="lugar-info">
          <div class="lugar-etiquetas"><span>${esc(tipos[l.tipo] || l.tipo)}</span><span>${esc(t("ve_de", { m: t(claves[l.momento]).toLowerCase() }))}</span>${l.aviso_sargazo ? `<span class="alerta">${esc(t("posible_sargazo"))}</span>` : ""}</div>
          <h3>${esc(n)}</h3><p>${esc(dsc)}</p><p class="lugar-consejo">${esc(cons)}</p>
        </div></article>`;
    }).join("");

    $("#platos").innerHTML = C.comida[p.destino.id].map((id) => {
      const [n, nota] = platillo(id);
      const cr = creditoDe(C.platillos[id].foto);
      return `<article class="plato"><div class="plato-foto"><img src="${foto(C.platillos[id].foto)}" alt="${esc(n)}" loading="lazy">${cr ? `<a href="${esc(cr.fuente)}" target="_blank" rel="noopener">${esc(cr.autor || "")}</a>` : ""}</div><h3>${esc(n)}</h3><p>${esc(nota)}</p></article>`;
    }).join("");
    $("#donde-comer").textContent = t("donde_comer", { d: p.destino.nombre });
    const pintarRest = (zona) => {
      $("#restaurantes").innerHTML = p.restaurantes.filter((r) => !zona || r.zona === zona).map((r) => {
        const coc = idioma === "es" ? r.cocina.map((c) => COCINA[c]).filter(Boolean).slice(0, 2).join(" · ") : "";
        return `<li><span class="rest-nombre">${esc(r.nombre)}</span><small>${esc(r.zona)}${coc ? " · " + esc(coc) : ""}</small>
          <a class="resena" href="${esc(r.maps)}" data-mapa="${esc(r.mapa_embed)}" data-nombre="${esc(r.nombre)}" target="_blank" rel="noopener">${esc(t("ver_calificacion"))}</a></li>`;
      }).join("");
    };
    const pintarHoteles = (zona) => {
      $("#hoteles").innerHTML = p.hoteles.filter((h) => !zona || h.zona === zona).map((h, i) => `<article class="hotel">
        <div class="hotel-foto"><img src="${esc(h.imagen || fotoZona(h.zona, i))}" alt="" loading="lazy" referrerpolicy="no-referrer"
          onerror="this.onerror=null;this.src='${fotoZona(h.zona, i)}'"><span class="hotel-tipo">${esc(t("tipo_" + h.tipo))}</span></div>
        <h3>${esc(h.nombre)}</h3>
        <p>${esc(h.zona)}${h.estrellas ? ` · <span class="hotel-estrellas" title="${esc(t("estrellas_cat", { n: h.estrellas }))}">${"★".repeat(h.estrellas)}</span>` : ""}</p>
        <div class="hotel-acciones"><a class="resena" href="${esc(h.maps)}" data-mapa="${esc(h.mapa_embed)}" data-nombre="${esc(h.nombre)}" target="_blank" rel="noopener">${esc(t("ver_calificacion"))}</a>${h.web ? `<a href="${esc(h.web)}" target="_blank" rel="noopener">${esc(t("sitio_web"))} ↗</a>` : ""}</div>
      </article>`).join("");
      aparecer(".hotel", $("#hoteles"));
    };
    const chips = (cont, lista, pintar) => {
      const zonas = [...new Set(lista.map((x) => x.zona))];
      cont.hidden = zonas.length < 2;
      cont.innerHTML = [["", t("todas")], ...zonas.map((z) => [z, z])].map(([v, txt], i) => `<button type="button" data-zona="${esc(v)}" class="${i === 0 ? "activa" : ""}">${esc(txt)}</button>`).join("");
      $$("button", cont).forEach((b) => b.addEventListener("click", () => {
        $$("button", cont).forEach((x) => x.classList.toggle("activa", x === b));
        pintar(b.dataset.zona);
      }));
      pintar("");
    };
    chips($("#zonas-comer"), p.restaurantes, pintarRest);
    chips($("#zonas-dormir"), p.hoteles, pintarHoteles);

    elegirDestino(p.destino.id);
    try { history.replaceState(null, "", `?destino=${p.destino.id}&fecha=${p.fecha}${idioma !== "es" ? "&lang=" + idioma : ""}${location.hash}`); } catch (e) { /* vista embebida */ }
    if (hayGsap) requestAnimationFrame(() => { animarMosaicoUnaVez(); ScrollTrigger.refresh(); });
  }
  let mosaicoAnimado = false;
  function animarMosaicoUnaVez() { if (!mosaicoAnimado) { mosaicoAnimado = true; animarMosaico(); animarViaje(); } }

  let turno = 0;
  async function planear(destino, fecha, desplazar) {
    const id = ++turno;
    estado.destino = destino;
    estado.fecha = fecha;
    try {
      const p = await api(`/api/viaja/plan?destino=${encodeURIComponent(destino)}&fecha=${encodeURIComponent(fecha)}`);
      if (id !== turno) return;
      const primera = !estado.plan;
      estado.plan = p;
      pintarPlan(p, !primera || desplazar);
      if (desplazar) irA($("#resultado"));
    } catch (e) {
      ponerPista(t("err_rango"), "error");
    }
  }

  // --------------------------------------------------------------------- inicio
  async function iniciar() {
    try { estado.creditos = await fetch("img/creditos.json").then((r) => r.json()); } catch (e) { estado.creditos = {}; }
    pintarIdiomaFijo();
    pintarNosotros();
    pintarDescubre();
    iniciarMovimiento();
    if (hay3D) {
      try {
        estado.escenas.playa = Escenas.playa($("#playa"));
      } catch (e) { console.warn("WebGL no disponible", e); }
    }
    inp.value = fmt(estado.fecha, { day: "numeric", month: "long" });
    elegirDestino(estado.destino);
    try {
      const [meta, fechas] = await Promise.all([api("/api/viaja/destinos"), api("/api/viaja/fechas").catch(() => ({ festivos: [], periodos: [] }))]);
      estado.meta = meta;
      estado.fechas = fechas;
      pintarMeta(meta);
      estado.interpretada = { fecha: estado.fecha, precision: "dia", en_rango: true, entrada: inp.value };
      ponerPista(capital(fechaLarga(estado.fecha)), "ok");
      await planear(estado.destino, estado.fecha, false);
    } catch (e) {
      $("#res-nivel").textContent = t("sin_conexion_t");
      $("#res-frase").textContent = t("sin_conexion_x");
    }
    if (window.Asistente) {
      estado.asistente = Asistente.iniciar({
        api, C, t, idioma: () => idioma, meta: () => estado.meta,
        fechaLarga, mes, nivel: nivelTxt, nombreDestino: (id) => NOMBRE[id],
        nombreLugar: (l) => lugarTxt(l)[0],
        destinoActual: () => estado.destino,
        vuelos: (d, f) => `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights to ${AEROPUERTO[d][0]} on ${f}`)}&hl=${idioma}`,
        planear: (d, f) => { elegirDestino(d); planear(d, f, true); },
        ir: (sel, d) => { if (d !== estado.destino) planear(d, estado.fecha, false); irA($(sel)); },
      });
    }
  }
  iniciar();
})();
