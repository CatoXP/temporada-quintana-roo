/* Temporada · Quintana Roo — v2, para el viajero.
 * Todo en palabras y en imágenes: nada de porcentajes ni modelos a la vista.
 * Lee /api/viaja/*, dibuja tres escenas 3D (escenas3d.js) y anima con GSAP + Lenis. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const MES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const NIVEL = {
    tranquilo: { titulo: "Tranquilo", corto: "Tranquilo", frase: "Playas amplias, sin filas y mejores precios.", olas: 1 },
    moderado: { titulo: "Con buen ambiente", corto: "Buen ambiente", frase: "Hay gente, pero se disfruta sin prisas.", olas: 2 },
    concurrido: { titulo: "Muy concurrido", corto: "Concurrido", frase: "Mucha gente en los lugares famosos. Reserva con tiempo.", olas: 3 },
    lleno: { titulo: "A reventar", corto: "Lleno", frase: "Casi todos los hoteles llenos. Mejor otra fecha u otro destino.", olas: 4 },
  };
  const TIPO = { cultura: "Cultura maya", naturaleza: "Naturaleza", mar: "Mar", playa: "Playa", cenote: "Cenote", comida: "Para cenar" };
  const MOMENTO = { "mañana": "Mañana", tarde: "Tarde", noche: "Noche" };
  const COCINA = { regional: "Cocina regional", yucatecan: "Yucateca", mayan: "Maya", local: "Local", seafood: "Mariscos", fish: "Pescado",
                   mexican: "Mexicana", coffee_shop: "Café", breakfast: "Desayunos", pizza: "Pizza", italian: "Italiana", japanese: "Japonesa" };
  const AEROPUERTO = { cancun: ["CUN", "Cancún"], riviera_maya: ["TQO", "Tulum"], gran_costa_maya: ["CTM", "Chetumal"] };
  const FOTO_DESTINO = { cancun: "img/cancun.jpg", riviera_maya: "img/tulum.jpg", gran_costa_maya: "img/canal_piratas.jpg" };
  const NOMBRE = { cancun: "Cancún", riviera_maya: "Riviera Maya", gran_costa_maya: "Gran Costa Maya" };
  const ICONO = {
    alto: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M14 20c.3-2.6 1.8-4.5 4-4.5 2 0 3 1.4 3 4.5"/></svg>',
    bajo: '<svg viewBox="0 0 24 24"><path d="M3 15c3-3 6-3 9 0s6 3 9 0M3 10c3-3 6-3 9 0s6 3 9 0"/></svg>',
    medio: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    alerta: '<svg viewBox="0 0 24 24"><path d="M4 17c2-1.5 4-1.5 6 0s4 1.5 6 0 3-1.2 4-.5M6 12c1-3 3-5 6-5 2 0 3 1 4 3"/></svg>',
    info: '<svg viewBox="0 0 24 24"><path d="M2.5 15.5l19-7-2-2.5-7 2.5-6-4.5-2 .8 4 5-4 1.5-2.5-1.5-1.5.6 2 3.6z"/></svg>',
  };
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hayGsap = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
  const hay3D = typeof THREE !== "undefined" && window.Escenas;

  const hoy = new Date();
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const periodoHoy = hoyIso.slice(0, 7);
  const estado = { destino: "cancun", fecha: "2027-01-15", meta: null, plan: null, fechas: { festivos: [], periodos: [] }, escenas: {}, interpretada: null };
  const q = new URLSearchParams(location.search);
  if (NOMBRE[q.get("destino")]) estado.destino = q.get("destino");
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.get("fecha") || "")) estado.fecha = q.get("fecha");

  async function api(url) {
    if (window.TemporadaAPI) return window.TemporadaAPI(url);
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.detail || "Algo falló. Intenta de nuevo.");
    return j;
  }
  const olitas = (n) => `<span class="olitas" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
  const partes = (iso) => {
    const [a, m, d] = iso.split("-").map(Number);
    const dia = DIA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
    return { a, m, d, dia, mes: MES[m - 1], largo: `${dia} ${d} de ${MES[m - 1]} de ${a}`, corto: `${d} de ${MES[m - 1]}` };
  };
  const fotoHTML = (f, alt) => (f ? `<img src="${esc(f.src)}" alt="${esc(alt)}" loading="lazy" decoding="async">` : '<div class="sin-foto"></div>');
  const gente = (p50) => Math.min(1, Math.max(0.05, (p50 - 28) / 62));
  const mitad = (periodo) => {
    const f = `${periodo}-15`;
    return f < hoyIso ? hoyIso : f;
  };

  // --------------------------------------------------------------- partir texto
  function partir(el, html) {
    el.innerHTML = html;
    const recorrer = (nodo) => {
      [...nodo.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((t) => {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
            const s = document.createElement("span");
            s.className = "pal";
            s.innerHTML = `<span>${esc(t)}</span>`;
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
  function iniciarMovimiento() {
    if (!hayGsap) return;
    gsap.registerPlugin(ScrollTrigger);
    if (!reducido && typeof Lenis !== "undefined") {
      lenis = new Lenis({ lerp: 0.09 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const t = $(a.getAttribute("href"));
      if (!t) return;
      e.preventDefault();
      irA(t);
    }));
    ScrollTrigger.create({ trigger: ".marquesina", start: "top 80px", onEnter: () => $("#barra").classList.add("solida"), onLeaveBack: () => $("#barra").classList.remove("solida") });
    if (reducido) return;

    partir($("#titular"), $("#titular").innerHTML);
    gsap.timeline({ defaults: { ease: "expo.out" } })
      .from(".antetitulo, .bajada", { y: 30, opacity: 0, duration: 1.2, stagger: 0.12 }, 0.3)
      .from(".buscador", { y: 70, opacity: 0, duration: 1.4 }, 0.55)
      .from(".sugerencias > *", { y: 20, opacity: 0, duration: 0.9, stagger: 0.05 }, 0.9)
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

    const arco = $("#arco-sol"), bola = $("#bola-sol");
    if (arco && bola) {
      const largo = arco.getTotalLength(), o = { k: 0 };
      gsap.to(o, { k: 1, ease: "none", onUpdate: () => { const p = arco.getPointAtLength(o.k * largo); bola.setAttribute("cx", p.x); bola.setAttribute("cy", p.y); },
                   scrollTrigger: { trigger: ".dia-ideal", start: "top 70%", end: "bottom 60%", scrub: 0.6 } });
    }

    gsap.matchMedia().add("(min-width: 900px)", () => {
      const pista = $("#carrusel");
      const distancia = () => Math.max(0, pista.scrollWidth - window.innerWidth);
      const tw = gsap.to(pista, { x: () => -distancia(), ease: "none",
        scrollTrigger: { trigger: ".lugares", start: "top top", end: () => "+=" + distancia(), pin: true, scrub: 0.8, invalidateOnRefresh: true } });
      return () => tw.kill();
    });

    // botones magnéticos
    $$(".magnetico").forEach((b) => {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.18, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.5, ease: "power3.out" });
      });
      b.addEventListener("pointerleave", () => gsap.to(b, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, .4)" }));
    });
  }

  function irA(el) {
    if (lenis) lenis.scrollTo(el, { offset: -10, duration: 1.5 });
    else el.scrollIntoView({ behavior: reducido ? "auto" : "smooth" });
  }
  function aparecer(selector, contenedor) {
    if (!hayGsap || reducido) return;
    const els = $$(selector, contenedor);
    if (els.length) gsap.from(els, { y: 40, duration: 1, stagger: 0.07, ease: "expo.out", overwrite: true });
  }

  // ------------------------------------------------------------------- buscador
  const inp = $("#fecha-texto"), pista = $("#fecha-pista");
  let reloj = 0, pendiente = null;

  function ponerPista(texto, estadoPista) {
    pista.dataset.estado = estadoPista || "";
    pista.textContent = texto;
  }
  async function interpretar(texto) {
    if (!texto.trim()) { estado.interpretada = null; ponerPista(""); return null; }
    try {
      const r = await api(`/api/viaja/interpretar?texto=${encodeURIComponent(texto)}`);
      if (inp.value !== texto) return null;
      if (!r.en_rango) {
        estado.interpretada = null;
        ponerPista(r.fecha < hoyIso ? "Esa fecha ya pasó. Elige una próxima." : "Por ahora puedes planear hasta diciembre de 2027.", "error");
        return null;
      }
      estado.interpretada = { ...r, entrada: texto };
      ponerPista(`${r.texto}${r.motivo ? " · " + r.motivo : ""}${r.precision === "mes" ? " · o elige el día en el calendario" : ""}`, "ok");
      return r;
    } catch (e) {
      estado.interpretada = null;
      ponerPista(e.message, "error");
      return null;
    }
  }
  inp.addEventListener("input", () => {
    clearTimeout(reloj);
    reloj = setTimeout(() => { pendiente = interpretar(inp.value); }, 250);
  });

  $("#buscador").addEventListener("submit", async (e) => {
    e.preventDefault();
    clearTimeout(reloj);
    let r = estado.interpretada && estado.interpretada.entrada === inp.value ? estado.interpretada : await interpretar(inp.value);
    if (!r && pendiente) r = await pendiente;
    if (r) planear(estado.destino, r.fecha, true);
    else if (!pista.textContent) ponerPista("Escribe una fecha, por ejemplo «15 de enero».", "error");
  });

  $$("#sugerencias button").forEach((b) => b.addEventListener("click", async () => {
    inp.value = b.dataset.texto;
    const r = await interpretar(inp.value);
    if (r) planear(estado.destino, r.fecha, true);
  }));

  // selector de destino
  const lista = $("#destino-lista"), botonDestino = $("#destino-boton");
  function elegirDestino(id, replanear) {
    estado.destino = id;
    $("#destino-nombre").textContent = NOMBRE[id];
    $("#destino-img").src = FOTO_DESTINO[id];
    $$("button", lista).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.destino === id)));
    if (!$("#cal-pop").hidden) pintarMeses(estado.fecha.slice(0, 7));
    if (replanear && estado.plan) planear(id, estado.fecha, false);
  }
  botonDestino.addEventListener("click", () => {
    lista.hidden = !lista.hidden;
    botonDestino.setAttribute("aria-expanded", String(!lista.hidden));
  });
  $$("button", lista).forEach((b) => b.addEventListener("click", () => {
    elegirDestino(b.dataset.destino, false);
    lista.hidden = true;
    botonDestino.setAttribute("aria-expanded", "false");
  }));

  $("#cambiar-fecha").addEventListener("click", () => {
    irA($("#inicio"));
    setTimeout(() => { inp.focus(); inp.select(); abrirCalendario(); }, reducido ? 0 : 900);
  });

  // calendario visual
  const pop = $("#cal-pop");
  function abrirCalendario() {
    pop.hidden = false;
    $("#abrir-cal").setAttribute("aria-expanded", "true");
    const periodo = (estado.interpretada?.fecha || estado.fecha).slice(0, 7);
    pintarMeses(periodo);
    if (lenis) lenis.scrollTo($("#buscador"), { offset: -90, duration: 1 });
    if (hayGsap && !reducido) gsap.from(pop, { y: -12, opacity: 0, duration: 0.5, ease: "expo.out" });
  }
  function cerrarCalendario() {
    pop.hidden = true;
    $("#abrir-cal").setAttribute("aria-expanded", "false");
  }
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
    $("#cal-meses").innerHTML = cal.map((c) => {
      const m = +c.periodo.slice(5);
      return `<button type="button" class="cal-mes${c.periodo === activo ? " activo" : ""}" data-periodo="${c.periodo}" data-nivel="${c.nivel}">
        <b>${MES[m - 1]}</b><small>${c.periodo.slice(0, 4)}</small>${olitas(NIVEL[c.nivel].olas)}<span>${NIVEL[c.nivel].corto}</span></button>`;
    }).join("");
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
    const festivos = Object.fromEntries(estado.fechas.festivos.map((f) => [f.fecha, f.nombre]));
    const elegida = estado.interpretada?.fecha || estado.fecha;
    let html = ["L", "M", "M", "J", "V", "S", "D"].map((d) => `<span class="cal-cab">${d}</span>`).join("") + "<span></span>".repeat(desfase);
    for (let d = 1; d <= total; d++) {
      const iso = `${periodo}-${String(d).padStart(2, "0")}`;
      const vac = estado.fechas.periodos.find((p) => iso >= p.desde && iso <= p.hasta);
      const finde = (desfase + d - 1) % 7 >= 5;
      const titulo = [festivos[iso], vac?.nombre].filter(Boolean).join(" · ");
      html += `<button type="button" class="cal-dia${finde ? " finde" : ""}${festivos[iso] ? " festivo" : ""}${vac ? " vacaciones" : ""}${iso === elegida ? " elegido" : ""}"
        data-fecha="${iso}" ${iso < hoyIso ? "disabled" : ""} ${titulo ? `title="${esc(titulo)}"` : ""} aria-label="${partes(iso).largo}${titulo ? ", " + esc(titulo) : ""}">${d}</button>`;
    }
    $("#cal-titulo").textContent = `${MES[m - 1]} ${a}`;
    $("#cal-dias").innerHTML = html;
    $$(".cal-dia:not(:disabled)").forEach((b) => b.addEventListener("click", () => elegirFecha(b.dataset.fecha)));
  }
  function elegirFecha(iso) {
    const p = partes(iso);
    inp.value = `${p.d} de ${p.mes} de ${p.a}`;
    estado.interpretada = { fecha: iso, texto: p.largo, precision: "dia", en_rango: true, entrada: inp.value };
    ponerPista(p.largo, "ok");
    cerrarCalendario();
    planear(estado.destino, iso, true);
  }

  // ----------------------------------------------------------------------- meta
  function pintarMeta(meta) {
    const cal = meta.calendario.filter((c) => c.periodo >= periodoHoy);

    // marquesina: el próximo mes en los tres destinos
    const periodos = [...new Set(cal.map((c) => c.periodo))];
    const items = periodos.slice(1, 4).flatMap((p) => cal.filter((c) => c.periodo === p).map((c) =>
      `<span data-nivel="${c.nivel}">${capital(MES[+p.slice(5) - 1])} <b>${NOMBRE[c.destino_id]}</b> ${olitas(NIVEL[c.nivel].olas)} <em>${NIVEL[c.nivel].corto}</em></span>`)).join("");
    $("#marquesina").innerHTML = items + items;

    // cordillera 3D del año
    const orden = ["gran_costa_maya", "riviera_maya", "cancun"];
    const series = orden.map((id) => ({ id, nombre: NOMBRE[id], valores: periodos.map((p) => cal.find((c) => c.destino_id === id && c.periodo === p).p50) }));
    const tip = $("#ola-tip");
    if (hay3D) {
      estado.escenas.ola = Escenas.ola($("#ola"), { series, periodos }, (p) => planear(estado.destino, mitad(p), true), (p, x, y) => {
        if (!p) { tip.hidden = true; return; }
        const filas = orden.slice().reverse().map((id) => {
          const c = cal.find((k) => k.destino_id === id && k.periodo === p);
          return `<div data-nivel="${c.nivel}"><span>${NOMBRE[id]}</span>${olitas(NIVEL[c.nivel].olas)}</div>`;
        }).join("");
        tip.innerHTML = `<b>${MES[+p.slice(5) - 1]} ${p.slice(0, 4)}</b>${filas}`;
        tip.style.left = `${x}px`;
        tip.style.top = `${y}px`;
        tip.hidden = false;
      });
    }

    // acordeón de destinos
    $("#acordeon").innerHTML = meta.destinos.map((d, i) => {
      const propios = cal.filter((c) => c.destino_id === d.id && c.sargazo !== "alto").sort((a, b) => a.p50 - b.p50).slice(0, 2);
      const meses = propios.map((c) => MES[+c.periodo.slice(5) - 1]);
      const unicos = [...new Set(meses)];
      return `<button type="button" class="panel${i === 2 ? " abierto" : ""}" data-destino="${d.id}">
        ${fotoHTML(d.foto, d.nombre)}
        <span class="panel-info">
          <small>${esc(d.region)} de Quintana Roo</small>
          <strong>${esc(d.nombre)}</strong>
          <em>${esc(d.lema)}</em>
          <span class="panel-detalle">
            <p>Para ir con calma: ${unicos.join(" y ")}.</p>
            <span>Planear aquí</span>
          </span>
        </span>
      </button>`;
    }).join("");
    $$(".panel").forEach((p) => {
      const abrir = () => $$(".panel").forEach((x) => x.classList.toggle("abierto", x === p));
      p.addEventListener("mouseenter", abrir);
      p.addEventListener("focus", abrir);
      p.addEventListener("click", () => { elegirDestino(p.dataset.destino, false); planear(p.dataset.destino, estado.fecha, true); });
    });
  }

  // ------------------------------------------------------------------------ plan
  function eventos(p) {
    const ev = [];
    const pr = p.prediccion;
    const nombre = p.destino.nombre;
    const cal = estado.meta.calendario.filter((c) => c.destino_id === p.destino.id);
    const rango = cal.filter((c) => c.p50 <= pr.ocupacion_p50_est).length / cal.length;
    if (rango >= 0.75) ev.push({ tono: "alto", titulo: "De las fechas con más gente del año", texto: `${capital(p.mes.nombre)} es de los meses favoritos para ir a ${nombre}.` });
    else if (rango <= 0.3) ev.push({ tono: "bajo", titulo: "De las fechas más tranquilas del año", texto: `Pocos viajeros eligen ${p.mes.nombre}: tendrás más espacio para ti.` });
    if (p.dia.periodo_vacacional) {
      ev.push({ tono: "alto", titulo: p.dia.periodo_vacacional.replace(" (periodo aproximado)", ""),
                texto: "Esa semana viajan muchas familias mexicanas: sube la gente aunque el mes sea tranquilo. Reserva con tiempo." });
    }
    p.dia.festivos_cercanos.filter((f) => !(p.dia.periodo_vacacional && /Santo|Navidad|Año Nuevo/.test(f.nombre))).forEach((f) => {
      const puente = f.nombre.includes("puente");
      ev.push({ tono: "medio", titulo: puente ? "Fin de semana largo" : f.nombre, texto: puente ? `${f.nombre.replace(" (puente)", "")}: viajan más familias mexicanas.` : "Hay un día festivo cerca de tu fecha." });
    });
    if (p.dia.fin_de_semana && !p.dia.periodo_vacacional && !p.dia.festivos_cercanos.length) {
      ev.push({ tono: "medio", titulo: "Cae en fin de semana", texto: "Entre semana los lugares famosos tienen más espacio." });
    }
    if (p.sargazo?.nivel === "alto") ev.push({ tono: "alerta", titulo: "Temporada de sargazo", texto: "Puede llegar alga a las playas. La laguna de Bacalar y los cenotes siguen perfectos." });
    else if (p.sargazo?.nivel === "medio") ev.push({ tono: "alerta", titulo: "Puede haber sargazo", texto: "Algunas playas podrían tener alga esos días." });
    if (pr.turistas_p50_est) {
      const miles = Math.round(pr.turistas_p50_est / 10000) * 10;
      ev.push({ tono: "info", titulo: `Llegan unos ${miles.toLocaleString("es-MX")} mil visitantes`, texto: `a ${nombre} durante ${p.mes.nombre}.` });
    }
    return ev.slice(0, 4);
  }

  function pintarPlan(p, animar) {
    const pr = p.prediccion;
    const n = NIVEL[pr.nivel];
    const f = partes(p.fecha);
    const res = $("#resultado");
    res.dataset.nivel = pr.nivel;

    $("#res-fecha").textContent = capital(f.largo);
    $("#res-destino").textContent = `${p.destino.nombre} estará`;
    const nivelEl = $("#res-nivel");
    if (animar) partir(nivelEl, n.titulo); else nivelEl.textContent = n.titulo;
    $("#res-olitas").innerHTML = olitas(n.olas);
    $("#res-olitas").dataset.nivel = pr.nivel;
    if (hayGsap && !reducido && animar) gsap.from("#res-olitas i.on", { scaleX: 0, transformOrigin: "left", duration: 0.8, stagger: 0.12, ease: "expo.out", delay: 0.2 });
    $("#res-frase").textContent = n.frase;
    $("#eventos").innerHTML = eventos(p).map((e) => `<li class="evento" data-tono="${e.tono}"><span class="evento-icono">${ICONO[e.tono]}</span><div><h4>${esc(e.titulo)}</h4><p>${esc(e.texto)}</p></div></li>`).join("");
    if (animar) aparecer(".evento", $("#eventos"));

    const [codigo, ciudad] = AEROPUERTO[p.destino.id];
    const vuelos = `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights to ${codigo} on ${p.fecha}`)}`;
    $("#vuelos").href = vuelos;
    $("#vuelos-barra").href = vuelos;
    $("#vuelos-barra").target = "_blank";
    $("#vuelos-texto").textContent = `Vuelos a ${ciudad} · ${f.d} ${MES_C[f.m - 1]}`;

    if (estado.escenas.playa) {
      estado.escenas.playa.setGente(gente(pr.ocupacion_p50_est));
      estado.escenas.playa.setSargazo(p.sargazo?.nivel);
    }

    const actual = { periodo: p.mes.periodo, nivel: pr.nivel, actual: true };
    $("#vecinos").innerHTML = [...p.meses_vecinos, actual].sort((a, b) => a.periodo.localeCompare(b.periodo)).map((v) =>
      `<button type="button" class="vecino${v.actual ? " actual" : ""}" data-periodo="${v.periodo}" data-nivel="${v.nivel}" ${v.actual ? 'aria-current="true"' : ""}>
        <b>${MES[+v.periodo.slice(5) - 1]}</b>${olitas(NIVEL[v.nivel].olas)}<small>${NIVEL[v.nivel].corto}</small></button>`).join("");
    $$(".vecino:not(.actual)").forEach((b) => b.addEventListener("click", () => {
      const dia = String(Math.min(f.d, 28)).padStart(2, "0");
      const iso = `${b.dataset.periodo}-${dia}`;
      planear(estado.destino, iso < hoyIso ? hoyIso : iso, false);
    }));

    // alternativa
    const rec = p.recomendacion;
    const alt = $("#alternativa");
    alt.hidden = !rec;
    if (rec) {
      if (rec.foto) { $("#alt-img").src = rec.foto.src; $("#alt-img").alt = rec.nombre; }
      $("#alt-titulo").innerHTML = `¿Y si mejor vas a <em>${esc(rec.nombre)}?</em>`;
      $("#alt-parrafo").textContent = rec.argumento;
      $("#alt-comparar").innerHTML = [
        { nombre: p.destino.nombre, nivel: pr.nivel }, { nombre: rec.nombre, nivel: rec.nivel },
      ].map((x) => `<div data-nivel="${x.nivel}"><b>${esc(x.nombre)}</b>${olitas(NIVEL[x.nivel].olas)}<small>${NIVEL[x.nivel].corto} el ${f.corto}</small></div>`).join("");
      $("#alt-boton").innerHTML = `Ver ${esc(rec.nombre)} el ${f.corto} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`;
      $("#alt-boton").onclick = () => { elegirDestino(rec.destino_id, false); planear(rec.destino_id, p.fecha, true); };
    }

    // mejores fechas
    $("#mejores-destino").textContent = p.destino.nombre;
    $("#mejores").innerHTML = p.mejores_meses.map((m) =>
      `<button type="button" class="mejor" data-periodo="${m.periodo}" data-nivel="${m.nivel}"><strong>${m.mes}</strong><small>${m.anio}</small>${olitas(NIVEL[m.nivel].olas)}<span>Planear ${m.mes} →</span></button>`).join("");
    $$(".mejor").forEach((b) => b.addEventListener("click", () => planear(estado.destino, mitad(b.dataset.periodo), true)));
    if (estado.escenas.ola) { estado.escenas.ola.setElegido(p.mes.periodo); estado.escenas.ola.setDestacado(p.destino.id); }

    // itinerario
    const porId = Object.fromEntries(p.lugares.map((l) => [l.id, l]));
    $("#itinerario").innerHTML = ["mañana", "tarde", "noche"].filter((k) => p.itinerario[k]).map((k) => {
      const l = porId[p.itinerario[k].id];
      return `<li class="momento"><div class="momento-foto">${fotoHTML(l.foto, l.nombre)}<span class="hora">${MOMENTO[k]}</span></div>
        <h3>${esc(l.nombre)}</h3><p>${esc(l.descripcion)}</p><p class="consejo">${esc(l.consejo)}</p></li>`;
    }).join("");

    $("#lugares-titulo").innerHTML = `Imperdibles de <em>${esc(p.destino.nombre)}</em>`;
    $("#carrusel").innerHTML = p.lugares.map((l) => `<article class="lugar">
        ${fotoHTML(l.foto, l.nombre)}${l.foto ? `<a class="credito" href="${esc(l.foto.fuente)}" target="_blank" rel="noopener">Foto: ${esc(l.foto.autor)}</a>` : ""}
        <div class="lugar-info">
          <div class="lugar-etiquetas"><span>${TIPO[l.tipo] || l.tipo}</span><span>Ve de ${MOMENTO[l.momento].toLowerCase()}</span>${l.aviso_sargazo ? '<span class="alerta">Posible sargazo</span>' : ""}</div>
          <h3>${esc(l.nombre)}</h3><p>${esc(l.descripcion)}</p><p class="lugar-consejo">${esc(l.consejo)}</p>
        </div></article>`).join("");

    $("#platillos").innerHTML = p.probar.map((x) => `<li><strong>${esc(x.platillo)}</strong><span>${esc(x.nota)}</span></li>`).join("");
    $("#restaurantes").innerHTML = p.restaurantes.map((r) => {
      const coc = r.cocina.map((c) => COCINA[c]).filter(Boolean).slice(0, 2).join(" · ");
      return `<li><a href="${esc(r.osm)}" target="_blank" rel="noopener">${esc(r.nombre)}</a><small>${esc(r.zona)}${coc ? " · " + esc(coc) : ""}</small></li>`;
    }).join("");

    elegirDestino(p.destino.id, false);
    history.replaceState(null, "", `?destino=${p.destino.id}&fecha=${p.fecha}${location.hash}`);
    if (hayGsap) requestAnimationFrame(() => ScrollTrigger.refresh());
  }

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
      ponerPista(e.message, "error");
    }
  }

  // --------------------------------------------------------------------- inicio
  async function iniciar() {
    iniciarMovimiento();
    if (hay3D) {
      try {
        estado.escenas.agua = Escenas.agua($("#agua"));
        estado.escenas.playa = Escenas.playa($("#playa"));
      } catch (e) { console.warn("WebGL no disponible", e); }
    }
    const p0 = partes(estado.fecha);
    inp.value = `${p0.d} de ${p0.mes}`;
    elegirDestino(estado.destino, false);
    try {
      const [meta, fechas, creditos] = await Promise.all([
        api("/api/viaja/destinos"), api("/api/viaja/fechas").catch(() => ({ festivos: [], periodos: [] })),
        fetch("img/creditos.json").then((r) => r.json()).catch(() => ({})),
      ]);
      estado.meta = meta;
      estado.fechas = fechas;
      pintarMeta(meta);
      $("#creditos").innerHTML = '<li>Restaurantes: © colaboradores de OpenStreetMap (ODbL)</li>' + Object.values(creditos).map((c) =>
        `<li><a href="${esc(c.fuente)}" target="_blank" rel="noopener">${esc(c.titulo || c.archivo)}</a> — ${esc(c.autor || "sin autor")} · ${esc(c.licencia)}</li>`).join("");
      await interpretar(inp.value);
      await planear(estado.destino, estado.fecha, false);
    } catch (e) {
      $("#res-nivel").textContent = "Sin conexión";
      $("#res-frase").textContent = "Abre la página con el servidor local encendido.";
    }
  }
  iniciar();
})();
