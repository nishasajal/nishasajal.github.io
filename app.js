const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let language = "en";
let translations = {};
const textBindings = [];
fetch("./translations.json?v=family-greetings")
  .then((r) => r.json())
  .then((data) => {
    translations = data;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest("[data-i18n]")) continue;
      const key = Object.keys(data).find(
        (k) => data[k].en === node.textContent.replace(/\s+/g, " ").trim(),
      );
      if (key) textBindings.push({ node, key });
    }
  })
  .catch(console.error);
const languageButtons = $$(".fixed.top-4 button");
languageButtons.forEach((button, index) =>
  button.addEventListener("click", () => {
    language = index ? "hi" : "en";
    document.documentElement.lang = language;
    for (const { node, key } of textBindings)
      node.textContent = translations[key][language];
    $$("[data-i18n]").forEach((el) => {
      const entry = translations[el.dataset.i18n];
      if (!entry) return;
      if (el.classList.contains("event-story")) {
        el.replaceChildren(...entry[language].split("\n").flatMap((line, index) => {
          const verse = document.createElement("span");
          verse.className = "event-verse-line";
          verse.textContent = line;
          return index ? [document.createTextNode("\n"), verse] : [verse];
        }));
      } else el.textContent = entry[language];
    });
    languageButtons.forEach((b, i) => {
      b.setAttribute("aria-pressed", String(index === i));
      b.style.background = index === i ? "#1E2A4F" : "transparent";
      b.style.color = index === i ? "#FFFFFF" : "#1E2A4F";
    });
    const labels =
      language === "hi" ? ["जनवरी", "३१", "२०२७"] : ["January", "31", "2027"];
    $$("canvas").forEach((c, i) => {
      $("span", c.parentElement).textContent = labels[i];
    });
    $("footer .eyebrow").textContent =
      language === "hi"
        ? "लैंसडाउन · ३०–३१ जनवरी २०२७"
        : "Lansdowne · 30–31 January 2027";
    updateMusicLabel();
    updateRsvpAvailability();
    renderRsvpState();
  }),
);
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 },
);
$$(".reveal").forEach((el) => observer.observe(el));
const eventChapters = $$(".event-chapter");
const rsvpSection = $("#rsvp");
const musicButton = $("#music-toggle");
const musicDock = $("#music-dock");
const musicContext = $("#music-context");
const soundtrack = new EventSoundtrack(updateMusicLabel);
function updateMusicLabel() {
  const playing = soundtrack.enabled;
  const labels =
    language === "hi"
      ? {
          welcome: "निमंत्रण · ओ सजनी रे",
          haldi: "हल्दी · ओ सजनी रे",
          sangeet: "संगीत · ओ सजनी रे",
          wedding: "विवाह · ओ सजनी रे",
          rsvp: "उपस्थिति · ओ सजनी रे",
        }
      : {
          welcome: "Invitation · O Sajni Re",
          haldi: "Haldi · O Sajni Re",
          sangeet: "Sangeet · O Sajni Re",
          wedding: "Wedding · O Sajni Re",
          rsvp: "RSVP · O Sajni Re",
        };
  musicButton.setAttribute(
    "aria-label",
    language === "hi"
      ? playing
        ? "संगीत रोकें"
        : "संगीत चलाएँ"
      : playing
        ? "Pause music"
        : "Play music",
  );
  musicButton.setAttribute("aria-pressed", String(playing));
  musicButton.innerHTML = playing
    ? '<span aria-hidden="true">Ⅱ</span>'
    : '<span aria-hidden="true" style="font-size:20px">♫</span>';
  musicContext.textContent = soundtrack.failed
    ? language === "hi"
      ? "फिर से चलाएँ"
      : "Tap to retry"
    : !playing
      ? language === "hi"
        ? "संगीत बंद"
        : "Music off"
      : soundtrack.loading
        ? language === "hi"
          ? "संगीत लोड हो रहा है…"
          : "Loading music…"
        : soundtrack.backgroundMusic?.title || labels[soundtrack.scene];
  musicDock.dataset.scene = soundtrack.scene;
  musicDock.dataset.playing = String(playing);
  musicDock.dataset.loading = String(soundtrack.loading);
}
function playMusic() {
  return soundtrack.enable();
}
musicButton.addEventListener("click", () =>
  soundtrack.enabled ? soundtrack.stop() : playMusic(),
);
updateMusicLabel();
let sceneFrame = false;
function updateActiveScene() {
  const middle = innerHeight * 0.5;
  let active = null;
  eventChapters.forEach((chapter) => {
    const rect = chapter.getBoundingClientRect();
    const visible =
      rect.top < innerHeight * 0.75 && rect.bottom > innerHeight * 0.25;
    chapter.classList.toggle("in-view", visible);
    if (rect.top <= middle && rect.bottom > middle) active = chapter;
  });
  document.documentElement.classList.toggle("snap-events", Boolean(active));
  let scene = active?.id || "welcome";
  if (!active && eventChapters.at(-1).getBoundingClientRect().bottom <= middle)
    scene = "wedding";
  if (!active && rsvpSection.getBoundingClientRect().top <= middle)
    scene = "rsvp";
  soundtrack.setScene(scene);
  sceneFrame = false;
}
function requestSceneUpdate() {
  if (!sceneFrame) {
    sceneFrame = true;
    requestAnimationFrame(updateActiveScene);
  }
}
window.addEventListener("scroll", requestSceneUpdate, { passive: true });
window.addEventListener("resize", requestSceneUpdate);
window.addEventListener("pageshow", requestSceneUpdate);
updateActiveScene();
const hero = $("section");
const doorButton = $("button", hero);
doorButton.addEventListener("click", async () => {
  doorButton.disabled = true;
  hero.classList.add("door-open");
  doorButton.style.opacity = 0;
  doorButton.style.pointerEvents = "none";
  const video = $("video", hero);
  video.style.opacity = 1;
  $("img", hero).style.opacity = 0;
  playMusic();
  let failed = false;
  try {
    await video.play();
  } catch {
    failed = true;
    $("img", hero).style.opacity = 1;
  }
  const revealDelay = reducedMotion || failed ? 0 : 6000;
  setTimeout(
    () => {
      $$(".z-25, .z-30", hero).forEach((el) => {
        el.style.opacity = 1;
        el.style.transform = "none";
      });
    },
    revealDelay,
  );
  setTimeout(
    () => {
      if (window.scrollY < hero.clientHeight / 2)
        $("#intro").scrollIntoView({
          behavior: reducedMotion ? "instant" : "smooth",
        });
    },
    revealDelay + 10000,
  );
});
const countdown = $("#countdown");
function tick() {
  const total = Math.max(
    0,
    Math.floor((new Date("2027-01-30T11:00:00-05:00") - Date.now()) / 1000),
  );
  const values = [
    Math.floor(total / 86400),
    Math.floor(total / 3600) % 24,
    Math.floor(total / 60) % 60,
    total % 60,
  ];
  $$(".tabular-nums", countdown).forEach(
    (el, i) => (el.textContent = String(values[i]).padStart(2, "0")),
  );
}
tick();
setInterval(tick, 1000);
let revealed = 0;
$$("canvas").forEach((canvas, index) => {
  const size = 116,
    ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = canvas.height = size * ratio;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.scale(ratio, ratio);
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  [
    [0, "#f0dca4"],
    [0.35, "#c9a44c"],
    [0.55, "#f7ecc8"],
    [0.8, "#b8902f"],
    [1, "#e2c67d"],
  ].forEach(([stop, color]) => gradient.addColorStop(stop, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = i % 2 ? "#fff" : "#8a6a1c";
    ctx.fillRect(
      Math.random() * size,
      Math.random() * size,
      Math.random() * 14 + 2,
      1,
    );
  }
  ctx.globalAlpha = 1;
  let down = false,
    last = null,
    done = false;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "button");
  canvas.setAttribute(
    "aria-label",
    `Reveal date ${["month", "day", "year"][index]}`,
  );
  function complete() {
    if (done) return;
    done = true;
    revealed++;
    canvas.style.opacity = 0;
    canvas.style.pointerEvents = "none";
    canvas.setAttribute(
      "aria-label",
      $("span", canvas.parentElement).textContent,
    );
    if (revealed === 3) {
      const date = $("#intro .text-gold");
      date.style.opacity = 1;
      date.style.transform = "none";
      confetti();
    }
  }
  canvas.addEventListener("keydown", (e) => {
    if (["Enter", " "].includes(e.key)) {
      e.preventDefault();
      complete();
    }
  });
  function draw(e) {
    const bounds = canvas.getBoundingClientRect();
    const p = {
      x: ((e.clientX - bounds.left) * size) / bounds.width,
      y: ((e.clientY - bounds.top) * size) / bounds.height,
    };
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 30;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (last) {
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    ctx.fill();
    last = p;
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (done) return;
    down = true;
    last = null;
    canvas.setPointerCapture(e.pointerId);
    draw(e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (down && !done) draw(e);
  });
  function finish() {
    down = false;
    last = null;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let empty = 0,
      count = 0;
    for (let i = 3; i < pixels.length; i += 96) {
      count++;
      if (pixels[i] < 40) empty++;
    }
    if (empty / count > 0.5) complete();
  }
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);
});
function confetti() {
  if (reducedMotion) return;
  const wrap = document.createElement("div");
  wrap.className = "celebration-confetti";
  wrap.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    Object.assign(piece.style, {
      left: `${Math.random() * 100}%`,
      backgroundColor: ["#d4af37", "#1e2a4f", "#c77088", "#fff"][i % 4],
      animationDelay: `${Math.random() * 2}s`,
      animationDuration: `${4 + Math.random() * 3}s`,
    });
    piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 160}px`);
    wrap.append(piece);
  }
  document.body.append(wrap);
  setTimeout(() => wrap.remove(), 9000);
}
