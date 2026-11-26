/* If I Could Tell You, I Would — proof of concept.
   Flow: first round (blank page) -> the room -> the reveal -> the mirror -> free play. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  /* ================= pitch ================= */
  var SCALE = [0, 2, 4, 5, 7, 9, 11];
  var NAMES = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  function midi(d, key) {
    var o = Math.floor(d / 7), s = ((d % 7) + 7) % 7;
    return 60 + key + 12 * o + SCALE[s];
  }
  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function noteName(d, key) { return NAMES[((midi(d, key) % 12) + 12) % 12]; }
  function degree(d) { return (((d % 7) + 7) % 7) + 1; }

  /* ================= audio ================= */
  var ctx = null, playId = 0, timers = [];
  function audio() {
    try {
      if (!ctx) { var A = window.AudioContext || window.webkitAudioContext; ctx = new A(); }
      if (ctx.state === "suspended") { ctx.resume(); }
      return ctx;
    } catch (e) { return null; }
  }
  function tone(c, t, m, dur, gain, glide, fade) {
    var o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
    o.type = "triangle"; o2.type = "sine";
    o.frequency.setValueAtTime(freq(m), t);
    o2.frequency.setValueAtTime(freq(m) * 2, t);
    if (glide) {
      o.frequency.linearRampToValueAtTime(freq(m + glide), t + dur * 0.9);
      o2.frequency.linearRampToValueAtTime(freq(m + glide) * 2, t + dur * 0.9);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    if (fade) { g.gain.linearRampToValueAtTime(0.0001, t + dur); }
    else {
      g.gain.exponentialRampToValueAtTime(gain * 0.6, t + dur * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(c.destination);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function stopHighlights() { timers.forEach(clearTimeout); timers = []; playId++; }
  function playEvents(events, onStep) {
    var c = audio();
    stopHighlights();
    if (!c) { return; }
    var id = playId, t = c.currentTime + 0.06, at = 0;
    events.forEach(function (ev, i) {
      tone(c, t + at, ev.m, ev.dur, ev.gain, ev.glide, ev.fade);
      timers.push(setTimeout(function () { if (id === playId) { onStep(i); } }, (at + 0.06) * 1000));
      at += ev.dur + (ev.rest || 0);
    });
    timers.push(setTimeout(function () { if (id === playId) { onStep(-1); } }, (at + 0.1) * 1000));
  }

  /* ================= the words ================= */
  var WORDS = [
    { w: "if", d: 5 }, { w: "I", d: 7 }, { w: "could", d: 8 },
    { w: "tell", d: 9 }, { w: "you", d: 11 }, { w: "would", d: 4 }
  ];
  var BY = {}; WORDS.forEach(function (x) { BY[x.w] = x; });
  var ORIGINAL = ["if", "I", "could", "tell", "you", "I", "would"];
  var ORIG_COUNT = { "if": 1, "I": 2, "could": 1, "tell": 1, "you": 1, "would": 1 };

  /* Free text -> tokens. Accepts any order, repeats, omissions and punctuation.
     Returns the words that are not in the sentence as `bad`. */
  function parseTyped(str) {
    var s = String(str).replace(/\.{3}/g, "…");
    var re = /([A-Za-z]+)([^A-Za-z]*)/g, m, out = [], bad = [];
    while ((m = re.exec(s))) {
      var w = m[1].toLowerCase(); if (w === "i") { w = "I"; }
      if (!BY[w]) { bad.push(m[1]); continue; }
      var tail = m[2], p = "", bangs = (tail.match(/!/g) || []).length;
      if (bangs) { p = "!!!".slice(0, Math.min(3, bangs)); }
      else if (tail.indexOf("?") >= 0) { p = "?"; }
      else if (tail.indexOf("…") >= 0) { p = "…"; }
      else if (tail.indexOf(",") >= 0) { p = ","; }
      else if (tail.indexOf(".") >= 0) { p = "."; }
      out.push({ w: w, p: p });
    }
    return { phrase: out, bad: bad };
  }
  function parse(text) { return parseTyped(text).phrase; }
  function show(tok) { return tok.p === "!!!" ? tok.w.charAt(0).toUpperCase() + tok.w.slice(1) : tok.w; }
  function text(phrase) { return phrase.map(function (t) { return show(t) + t.p; }).join(" "); }
  function copy(phrase) { return phrase.map(function (t) { return { w: t.w, p: t.p }; }); }

  var MOVES = [
    { id: "reorder", name: "Reorder", hint: "new word order", eg: "would you tell",
      nudge: "Every word is still in its old place. Start from the last word and see what the line wants to say." },
    { id: "omit", name: "Leave words out", short: "Leave out", hint: "fewer words", eg: "if you could",
      nudge: "You have used all seven. What is the shortest thing these words can say?" },
    { id: "repeat", name: "Say a word again", short: "Repeat", hint: "a word again", eg: "tell! tell!! Tell!!!",
      nudge: "Nothing says a word can only be used once. Say one again, right after itself." },
    { id: "accent", name: "Raise your voice", short: "Accent", hint: "! marks", eg: "one mark, then two, then three",
      nudge: "The words are flat so far. Put ! on one, then !! on the next, and listen." },
    { id: "question", name: "Ask", short: "Question", hint: "end on ?", eg: "if?",
      nudge: "Every line so far is a statement. Turn one into a question and hear the note lift." },
    { id: "breath", name: "Breathe", short: "Breath", hint: ", . or …", eg: "",
      nudge: "There is one move nobody has shown you yet. Try a comma, or an ellipsis." }
  ];

  function movesOf(ph) {
    var found = {}, words = ph.map(function (t) { return t.w; });
    if (!words.length) { return found; }
    var j = 0;
    words.forEach(function (w) {
      while (j < ORIGINAL.length && ORIGINAL[j] !== w) { j++; }
      if (j >= ORIGINAL.length) { found.reorder = true; } else { j++; }
    });
    if (words.length < ORIGINAL.length) { found.omit = true; }
    var c = {};
    words.forEach(function (w) { c[w] = (c[w] || 0) + 1; if (c[w] > ORIG_COUNT[w]) { found.repeat = true; } });
    ph.forEach(function (t, i) {
      if (t.p.indexOf("!") >= 0) { found.accent = true; }
      if (t.p === "?") { found.question = true; }
      if (t.p === "…" || ((t.p === "," || t.p === ".") && i < ph.length - 1)) { found.breath = true; }
    });
    return found;
  }
  function isGiven(ph) {
    return ph.length === ORIGINAL.length && ph.every(function (t, i) {
      return t.w === ORIGINAL[i] && (t.p === "" || t.p === "," || t.p === ".");
    });
  }

  function eventsOf(ph) {
    return ph.map(function (t) {
      var ev = { m: midi(BY[t.w].d, 0), dur: 0.34, gain: 0.16, glide: 0, fade: false, rest: 0.02 };
      var bangs = (t.p.match(/!/g) || []).length;
      if (bangs) { ev.gain = [0.24, 0.34, 0.46][bangs - 1]; ev.dur = [0.28, 0.24, 0.5][bangs - 1]; ev.rest = 0.08; }
      else if (t.p === "?") { ev.glide = 2; ev.dur = 0.55; ev.rest = 0.2; }
      else if (t.p === ",") { ev.rest = 0.26; }
      else if (t.p === ".") { ev.dur = 0.8; ev.rest = 0.2; }
      else if (t.p === "…") { ev.dur = 0.7; ev.fade = true; ev.rest = 0.6; }
      return ev;
    });
  }

  function renderTokens(el, ph, active, emptyText) {
    el.textContent = "";
    if (!ph.length && emptyText) {
      var e = document.createElement("span"); e.className = "empty"; e.textContent = emptyText;
      el.appendChild(e);
    }
    ph.forEach(function (t, i) {
      var bangs = (t.p.match(/!/g) || []).length;
      var s = document.createElement("span");
      s.className = "tok" + (bangs ? " b" + bangs : "") + (i === active ? " on" : "");
      s.appendChild(document.createTextNode(show(t)));
      if (t.p) { var b = document.createElement("b"); b.textContent = t.p; s.appendChild(b); }
      el.appendChild(s);
    });
  }

  /* ================= the room =================
     Swap this object for a shared backend (room code + realtime list) to make the wall live.
     For the proof of concept the classmates are canned, typical first-round answers. */
  var Room = {
    live: false,
    others: function () {
      return [
        "I would tell you if I could",
        "would I tell you if I could",
        "I could tell you if I would",
        "could I tell you if I would",
        "if I would tell you I could",
        "tell you I would if I could",
        "I would if I could tell you"
      ];
    }
  };

  /* The three sentences shown in the session. */
  var REVEALS = ["if you could", "would you tell", "tell! tell!! tell!!! if?"].map(parse);

  /* ================= state ================= */
  var firstTyped = [];   /* the student's two sentences, as typed */
  var first = [];        /* the same, parsed */
  var revealAt = 0;
  var phrase = [];       /* free play: sentence in progress */
  var mine = [];         /* free play: sentences the student kept */

  var STAGES = ["first", "room", "reveal", "mirror", "play"];
  var BAND = {
    first: ["Round one", "Seven words"], room: ["The room", ""], reveal: ["Three more", ""],
    mirror: ["Your two", "Round one"], play: ["Free play", "Seven words"]
  };
  function go(stage, right) {
    stopHighlights();
    STAGES.forEach(function (s) { $("stage-" + s).hidden = s !== stage; });
    document.body.classList.toggle("brass", stage === "reveal");   /* the room changes colour for the reveal */
    $("band-left").textContent = BAND[stage][0];
    $("band-right").textContent = right !== undefined ? right : BAND[stage][1];
    window.scrollTo(0, 0);
  }

  /* ---------- 1. first round ---------- */
  $("first-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var err = $("first-error"), raw = [$("s1").value.trim(), $("s2").value.trim()];
    if (!raw[0] || !raw[1]) { err.textContent = "Write two."; return; }
    var parsed = raw.map(parseTyped);
    var bad = parsed[0].bad.concat(parsed[1].bad);
    if (bad.length) { err.textContent = "“" + bad[0] + "” is not one of the words."; return; }
    if (!parsed[0].phrase.length || !parsed[1].phrase.length) { err.textContent = "Use the words."; return; }
    if (isGiven(parsed[0].phrase) || isGiven(parsed[1].phrase)) { err.textContent = "That is the sentence you were given. Write a new one."; return; }
    err.textContent = "";
    firstTyped = raw;
    first = parsed.map(function (p) { return p.phrase; });
    go("room", renderRoom() + " sentences");
  });

  /* ---------- 2. the room ---------- */
  function wallItem(str, tag, you) {
    var li = document.createElement("li"); if (you) { li.className = "you"; }
    var s = document.createElement("span"); s.className = "s"; s.textContent = str;
    var t = document.createElement("span"); t.className = "t"; t.textContent = tag;
    li.appendChild(s); li.appendChild(t);
    return li;
  }
  function renderRoom() {
    var wall = $("wall"); wall.textContent = "";
    var others = Room.others(), rows = others.map(function (s) { return { s: s, you: false }; });
    /* drop the student's two in among the others, not on top */
    rows.splice(2, 0, { s: firstTyped[0], you: true });
    rows.splice(6, 0, { s: firstTyped[1], you: true });
    rows.forEach(function (r) { wall.appendChild(wallItem(r.s, r.you ? "you" : "", r.you)); });
    $("room-note").textContent = Room.live ? "" : "Demo room. The other sentences are sample answers.";
    return rows.length;
  }
  $("room-next").addEventListener("click", function () { revealAt = 0; go("reveal"); showReveal(true); });

  /* ---------- 3. the reveal ---------- */
  function showReveal(play) {
    var ph = REVEALS[revealAt], el = $("reveal-sentence");
    $("band-right").textContent = (revealAt + 1) + " of " + REVEALS.length;
    $("reveal-next").textContent = revealAt === REVEALS.length - 1 ? "Continue" : "Next";
    renderTokens(el, ph, -1);
    if (play) { playEvents(eventsOf(ph), function (i) { renderTokens(el, ph, i); }); }
  }
  $("reveal-again").addEventListener("click", function () { showReveal(true); });
  $("reveal-next").addEventListener("click", function () {
    if (revealAt < REVEALS.length - 1) { revealAt++; showReveal(true); }
    else { renderMirror(); go("mirror"); }
  });

  /* ---------- 4. the mirror ---------- */
  function renderMirror() {
    var yours = $("mirror-yours"); yours.textContent = "";
    firstTyped.forEach(function (s) { yours.appendChild(wallItem(s, "you", true)); });
    var did = {};
    first.forEach(function (ph) { var f = movesOf(ph); Object.keys(f).forEach(function (k) { did[k] = true; }); });
    var ul = $("mirror-moves"); ul.textContent = "";
    MOVES.forEach(function (mv) {
      if (mv.id === "breath") { return; }   /* not shown by the three; left to find in free play */
      var li = document.createElement("li"); if (did[mv.id]) { li.className = "found"; }
      var a = document.createElement("strong"); a.textContent = mv.name;
      var st = document.createElement("span"); st.className = "st"; st.textContent = did[mv.id] ? "you did" : "you didn’t";
      var eg = document.createElement("span"); eg.className = "eg"; eg.textContent = mv.eg;
      li.appendChild(a); li.appendChild(st); li.appendChild(eg);
      ul.appendChild(li);
    });
  }
  $("mirror-next").addEventListener("click", function () { enterPlay(); });

  /* ---------- 5. free play: words ---------- */
  function enterPlay() {
    phrase = [];
    mine = first.map(copy);
    go("play"); showTab("words"); renderWords();
  }

  function renderSentence(active) {
    renderTokens($("sentence"), phrase, active, "Tap words. Each one is a note now.");
    $("count").textContent = phrase.length + (phrase.length === 1 ? " word" : " words") +
      (phrase.length ? " · " + phrase.map(function (t) { return noteName(BY[t.w].d, 0); }).join(" ") : "");
  }
  function renderMoves() {
    var all = {};
    mine.concat([phrase]).forEach(function (ph) {
      var f = movesOf(ph); Object.keys(f).forEach(function (k) { all[k] = true; });
    });
    var box = $("moves"); box.textContent = "";
    var n = 0, next = null;
    MOVES.forEach(function (mv) {
      var d = document.createElement("div"); d.className = "move" + (all[mv.id] ? " found" : "");
      var s = document.createElement("strong"); s.textContent = mv.short || mv.name;
      var h = document.createElement("span"); h.textContent = mv.hint;
      d.appendChild(s); d.appendChild(h); box.appendChild(d);
      if (all[mv.id]) { n++; } else if (!next) { next = mv; }
    });
    $("moves-label").textContent = "Moves you have found · " + n + " of " + MOVES.length;
    $("coach").textContent = next ? next.nudge
      : "All six. Now combine them: a three-word line with a repeat, an accent and a question.";
  }
  function renderKept() {
    var ul = $("kept"); ul.textContent = "";
    var items = mine.map(function (ph, i) { return { phrase: ph, tag: i < first.length ? "round one" : "yours" }; }).reverse()
      .concat(REVEALS.map(function (ph) { return { phrase: ph, tag: "shown" }; }));
    items.forEach(function (item) {
      var li = document.createElement("li"), b = document.createElement("button");
      var s = document.createElement("span"); s.className = "s"; s.textContent = text(item.phrase);
      var t = document.createElement("span"); t.className = "t"; t.textContent = item.tag;
      b.appendChild(s); b.appendChild(t);
      b.addEventListener("click", function () { phrase = copy(item.phrase); renderWords(); playWords(); });
      li.appendChild(b); ul.appendChild(li);
    });
  }
  function renderWords() { renderSentence(-1); renderMoves(); renderKept(); $("keep").disabled = !phrase.length; }
  function playWords() {
    if (phrase.length) { playEvents(eventsOf(phrase), function (i) { renderSentence(i); }); }
  }

  WORDS.forEach(function (x) {
    var b = document.createElement("button");
    b.id = "word-" + x.w.toLowerCase();
    var w = document.createElement("span"); w.className = "w"; w.textContent = x.w;
    var n = document.createElement("span"); n.className = "n"; n.textContent = noteName(x.d, 0);
    b.appendChild(w); b.appendChild(n);
    b.addEventListener("click", function () {
      if (phrase.length >= 16) { return; }
      stopHighlights();
      phrase.push({ w: x.w, p: "" });
      var c = audio(); if (c) { tone(c, c.currentTime + 0.02, midi(x.d, 0), 0.3, 0.16, 0, false); }
      renderWords();
    });
    $("bank").appendChild(b);
  });

  function punct(mark) {
    if (!phrase.length) { return; }
    var last = phrase[phrase.length - 1];
    if (mark === "!") {
      var bangs = (last.p.match(/^!+$/) || [""])[0].length;
      last.p = bangs >= 3 ? "" : "!!!".slice(0, bangs + 1);
    } else { last.p = last.p === mark ? "" : mark; }
    stopHighlights();
    var c = audio();
    if (c) { var ev = eventsOf([last])[0]; tone(c, c.currentTime + 0.02, ev.m, ev.dur, ev.gain, ev.glide, ev.fade); }
    renderWords();
  }
  $("p-bang").addEventListener("click", function () { punct("!"); });
  $("p-q").addEventListener("click", function () { punct("?"); });
  $("p-comma").addEventListener("click", function () { punct(","); });
  $("p-dot").addEventListener("click", function () { punct("."); });
  $("p-ell").addEventListener("click", function () { punct("…"); });
  $("undo").addEventListener("click", function () { stopHighlights(); phrase.pop(); renderWords(); });
  $("clear").addEventListener("click", function () { stopHighlights(); phrase = []; renderWords(); });
  $("play-words").addEventListener("click", playWords);
  $("keep").addEventListener("click", function () {
    if (!phrase.length) { return; }
    var t = text(phrase);
    if (!mine.some(function (ph) { return text(ph) === t; })) { mine.push(copy(phrase)); }
    phrase = [];
    renderWords();
  });

  /* ---------- 5. free play: motif ---------- */
  var WORKSHOP = [5, 8, 7, 9, 6];   /* scale degrees 6 2 8 3 7 */
  var motif = { base: WORKSHOP.slice(), cur: WORKSHOP.slice(), key: 0, trail: [], source: "Workshop motif" };

  function fit(arr) {
    var lo = Math.min.apply(null, arr), hi = Math.max.apply(null, arr), a = arr.slice();
    while (lo < -3) { a = a.map(function (d) { return d + 7; }); lo += 7; hi += 7; }
    while (hi > 17) { a = a.map(function (d) { return d - 7; }); lo -= 7; hi -= 7; }
    return a;
  }
  function steps(arr) { var o = []; for (var i = 1; i < arr.length; i++) { o.push(arr[i] - arr[i - 1]); } return o; }
  function semis(arr, key) { var o = []; for (var i = 1; i < arr.length; i++) { o.push(midi(arr[i], key) - midi(arr[i - 1], key)); } return o; }
  function signed(n) { return n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0"; }
  function arrow(n) { return n > 0 ? "↑" + n : n < 0 ? "↓" + Math.abs(n) : "→"; }
  function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }

  var NS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, txt) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (txt !== undefined) { e.textContent = txt; }
    return e;
  }

  function renderMotif(active) {
    var plot = $("plot"); plot.textContent = "";
    var W = 380, padX = 34, top = 18, bottom = 150;
    var all = motif.base.concat(motif.cur);
    var lo = Math.min.apply(null, all) - 1, hi = Math.max.apply(null, all) + 1;
    var n = Math.max(motif.cur.length, motif.base.length);
    function x(i) { return n <= 1 ? W / 2 : padX + i * (W - 2 * padX) / (n - 1); }
    function y(d) { return bottom - (d - lo) * (bottom - top) / (hi - lo); }
    for (var d = lo; d <= hi; d++) {
      var tonic = (((d % 7) + 7) % 7) === 0;
      plot.appendChild(svg("line", { x1: 8, x2: W - 8, y1: y(d), y2: y(d), stroke: tonic ? "#5a64a8" : "#262d63", "stroke-width": 1 }));
    }
    function pts(arr) { return arr.map(function (v, i) { return x(i) + "," + y(v); }).join(" "); }
    plot.appendChild(svg("polyline", { points: pts(motif.base), fill: "none", stroke: "#7c86c9", "stroke-width": 2, "stroke-dasharray": "4 5" }));
    plot.appendChild(svg("polyline", { points: pts(motif.cur), fill: "none", stroke: "#e0a93b", "stroke-width": 3.5, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    motif.cur.forEach(function (v, i) {
      var on = i === active;
      plot.appendChild(svg("circle", { cx: x(i), cy: y(v), r: on ? 10 : 7, fill: on ? "#f5efe0" : "#e0a93b", stroke: "#171c45", "stroke-width": 2 }));
      plot.appendChild(svg("text", { x: x(i), y: 176, "text-anchor": "middle", "font-family": "DM Sans, sans-serif", "font-size": 15, "font-weight": 700, fill: "#f5efe0" }, String(degree(v))));
      plot.appendChild(svg("text", { x: x(i), y: 196, "text-anchor": "middle", "font-family": "DM Sans, sans-serif", "font-size": 12, fill: "#9aa3d6" }, noteName(v, motif.key)));
    });

    var sB = steps(motif.base), sC = steps(motif.cur), iB = semis(motif.base, 0), iC = semis(motif.cur, motif.key);
    var ro = $("readout"); ro.textContent = "";
    function line(label, value, cls) {
      var row = document.createElement("div"), a = document.createElement("span"), b = document.createElement("span");
      a.textContent = label; b.textContent = value; b.className = cls;
      row.appendChild(a); row.appendChild(b); ro.appendChild(row);
    }
    var shapeSame = same(sB, sC), intSame = same(iB, iC);
    line("Shape", sC.map(arrow).join("  ") + (shapeSame ? "   same as start" : "   changed"), shapeSame ? "same" : "changed");
    line("Half steps", iC.map(signed).join("  ") + (intSame ? "   same as start" : "   changed"), intSame ? "same" : "changed");

    $("keyname").textContent = NAMES[motif.key] + " major";
    $("motif-source").textContent = motif.source + " · dashed line is where you started";
    $("trail").textContent = motif.trail.length ? "Path: start → " + motif.trail.join(" → ") : "Path: start. Step up once and watch the two rows.";
  }

  function playMotif() {
    var ev = motif.cur.map(function (d) { return { m: midi(d, motif.key), dur: 0.36, gain: 0.17, glide: 0, fade: false, rest: 0.02 }; });
    if (ev.length) { ev[ev.length - 1].dur = 0.7; }
    playEvents(ev, function (i) { renderMotif(i); });
  }
  function apply(name, fn) {
    stopHighlights();
    motif.cur = fit(fn(motif.cur.slice()));
    motif.trail.push(name);
    if (motif.trail.length > 8) { motif.trail = ["…"].concat(motif.trail.slice(-7)); }
    renderMotif(-1); playMotif();
  }
  function stepBy(k) {
    var pin = $("pin").checked;
    apply((k > 0 ? "step up" : "step down") + (pin ? " (first held)" : ""), function (a) {
      return a.map(function (d, i) { return pin && i === 0 ? d : d + k; });
    });
  }
  function keyBy(k) {
    stopHighlights(); motif.key = (motif.key + k + 12) % 12; motif.trail.push(NAMES[motif.key]);
    renderMotif(-1); playMotif();
  }
  $("op-up").addEventListener("click", function () { stepBy(1); });
  $("op-down").addEventListener("click", function () { stepBy(-1); });
  $("op-rev").addEventListener("click", function () { apply("reverse", function (a) { return a.reverse(); }); });
  $("op-mir").addEventListener("click", function () {
    apply("mirror", function (a) { var f = a[0]; return a.map(function (d) { return 2 * f - d; }); });
  });
  $("op-reset").addEventListener("click", function () {
    stopHighlights(); motif.cur = motif.base.slice(); motif.key = 0; motif.trail = []; renderMotif(-1);
  });
  $("key-up").addEventListener("click", function () { keyBy(1); });
  $("key-down").addEventListener("click", function () { keyBy(-1); });
  $("play-motif").addEventListener("click", playMotif);

  function loadMotif(arr, source) {
    motif.base = arr.slice(); motif.cur = arr.slice(); motif.key = 0; motif.trail = []; motif.source = source;
    renderMotif(-1);
  }
  function sentenceMotif() {
    var ph = phrase.length ? phrase : (mine.length ? mine[mine.length - 1] : parse("if I could tell you I would"));
    return ph.map(function (t) { return BY[t.w].d; });
  }
  $("src-workshop").addEventListener("click", function () { stopHighlights(); loadMotif(WORKSHOP, "Workshop motif"); playMotif(); });
  $("src-sentence").addEventListener("click", function () { stopHighlights(); loadMotif(sentenceMotif(), "Your sentence"); playMotif(); });

  function showTab(which) {
    stopHighlights();
    ["words", "motif"].forEach(function (k) {
      $("tab-" + k).setAttribute("aria-selected", String(k === which));
      $("view-" + k).hidden = k !== which;
    });
    if (which === "words") { renderSentence(-1); } else { renderMotif(-1); }
  }
  $("tab-words").addEventListener("click", function () { showTab("words"); });
  $("tab-motif").addEventListener("click", function () { showTab("motif"); });
  $("to-motif").addEventListener("click", function () {
    loadMotif(sentenceMotif(), "Your sentence"); showTab("motif"); playMotif();
  });

  /* ---------- footer ---------- */
  $("restart").addEventListener("click", function () {
    firstTyped = []; first = []; phrase = []; mine = [];
    $("s1").value = ""; $("s2").value = ""; $("first-error").textContent = "";
    go("first");
  });
  $("skip").addEventListener("click", function () { firstTyped = []; first = []; enterPlay(); });

  renderMotif(-1);
})();
