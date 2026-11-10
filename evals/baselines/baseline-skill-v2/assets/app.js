/*
  spec-it artifact runtime. Offline, no dependencies.
  - Fills [data-bind] from window.FIXTURES (stress overrides with ?stress=1), formatted by [data-format].
  - ?state=<name> shows [data-state~=name] containers; default from <body data-default-state>.
  - ?variant=<key> shows [data-variant=key] containers.
  - Floating switcher pill (hide with ?pill=0). Keys: ←/→ state, S stress, V variant, A overlay.
  - A overlay labels [data-fr] and [data-ec] elements with their IDs.
  - <form data-next="x.html"> navigates to x.html on submit.
*/
(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var F = window.FIXTURES || {};
  var meta = F.meta || {};
  var locale = meta.locale || "en-US";
  var stress = params.get("stress") === "1";

  function get(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  function lookup(path) {
    if (stress && F.stress) {
      var s = get(F.stress, path);
      if (s !== undefined) return s;
    }
    return get(F, path);
  }

  // Date-only strings ("2026-11-03") are calendar days, not UTC instants: parse them as local midnight
  // so a viewer west of UTC does not see the previous day.
  function toDate(value) {
    var m = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  }

  function format(value, kind) {
    if (value == null) return "";
    try {
      switch (kind) {
        case "money":
          return new Intl.NumberFormat(locale, { style: "currency", currency: meta.currency || "USD" }).format(value);
        case "number":
          return new Intl.NumberFormat(locale).format(value);
        case "date":
          return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(toDate(value));
        case "datetime":
          return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(toDate(value));
        case "relative": {
          var today = meta.today ? toDate(meta.today) : new Date();
          var days = Math.round((toDate(value) - today) / 86400000);
          return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
        }
        default:
          return String(value);
      }
    } catch (e) {
      return String(value);
    }
  }

  function bind() {
    document.querySelectorAll("[data-bind]").forEach(function (el) {
      var v = lookup(el.getAttribute("data-bind"));
      if (v === undefined) {
        el.setAttribute("data-bind-missing", "");
        console.warn("spec-it: no fixture value for", el.getAttribute("data-bind"));
        return;
      }
      el.textContent = format(v, el.getAttribute("data-format"));
    });
  }

  function tokens(attr) {
    var seen = [];
    document.querySelectorAll("[" + attr + "]").forEach(function (el) {
      el.getAttribute(attr).split(/\s+/).forEach(function (t) {
        if (t && seen.indexOf(t) === -1) seen.push(t);
      });
    });
    return seen;
  }

  var states = tokens("data-state");
  var variants = tokens("data-variant");
  var state = params.get("state") || document.body.getAttribute("data-default-state") || states[0] || null;
  var variant = params.get("variant") || variants[0] || null;

  // <body data-states="all"> (API and CLI reference pages) keeps every state visible;
  // ?state= then scrolls to that state and marks it instead of hiding the others.
  var showAll = document.body.getAttribute("data-states") === "all";

  function applyStates() {
    document.querySelectorAll("[data-state]").forEach(function (el) {
      var match = el.getAttribute("data-state").split(/\s+/).indexOf(state) !== -1;
      if (showAll) {
        el.classList.toggle("specit-current", match && params.has("state"));
      } else {
        el.hidden = !match;
      }
    });
    if (showAll && params.has("state")) {
      var target = document.querySelector('[data-state~="' + state + '"]');
      if (target) target.scrollIntoView({ block: "center" });
    }
    document.querySelectorAll("[data-variant]").forEach(function (el) {
      el.hidden = el.getAttribute("data-variant") !== variant;
    });
    document.documentElement.classList.toggle("is-stress", stress);
  }

  function syncUrl() {
    var p = new URLSearchParams(location.search);
    if (state) p.set("state", state); else p.delete("state");
    if (variant && variants.length > 1) p.set("variant", variant); else p.delete("variant");
    if (stress) p.set("stress", "1"); else p.delete("stress");
    history.replaceState(null, "", location.pathname + "?" + p.toString() + location.hash);
  }

  function cycle(list, current, step) {
    if (!list.length) return current;
    var i = list.indexOf(current);
    return list[(i + step + list.length) % list.length];
  }

  /* Overlay */
  var overlayOn = false;
  var layer = null;

  function drawOverlay() {
    if (layer) layer.remove();
    layer = null;
    if (!overlayOn) return;
    layer = document.createElement("div");
    layer.className = "specit-layer";
    layer.setAttribute("aria-hidden", "true");
    document.querySelectorAll("[data-fr], [data-ec]").forEach(function (el) {
      if (el.closest("[hidden]")) return;
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      var box = document.createElement("div");
      box.className = "specit-box";
      box.style.cssText = "left:" + (r.left + scrollX) + "px;top:" + (r.top + scrollY) + "px;width:" + r.width + "px;height:" + r.height + "px";
      var tag = document.createElement("span");
      tag.className = "specit-tag";
      tag.textContent = [el.getAttribute("data-fr"), el.getAttribute("data-ec")].filter(Boolean).join(" ");
      box.appendChild(tag);
      layer.appendChild(box);
    });
    document.body.appendChild(layer);
  }

  /* Pill */
  var pill = null;

  function button(label, title, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.addEventListener("click", onClick);
    return b;
  }

  function renderPill() {
    if (params.get("pill") === "0") return;
    if (pill) pill.remove();
    pill = document.createElement("div");
    pill.className = "specit-pill";
    pill.setAttribute("role", "toolbar");
    pill.setAttribute("aria-label", "Mockup controls");
    if (states.length) {
      pill.appendChild(button("‹", "Previous state", function () { setState(cycle(states, state, -1)); }));
      var label = document.createElement("span");
      label.className = "specit-label";
      label.textContent = "state: " + state;
      pill.appendChild(label);
      pill.appendChild(button("›", "Next state", function () { setState(cycle(states, state, 1)); }));
    }
    if (variants.length > 1) {
      pill.appendChild(button("variant " + variant, "Next variant (V)", function () { setVariant(cycle(variants, variant, 1)); }));
    }
    pill.appendChild(button(stress ? "stress on" : "stress off", "Toggle stress data (S)", toggleStress));
    pill.appendChild(button(overlayOn ? "IDs on" : "IDs off", "Toggle requirement IDs (A)", toggleOverlay));
    document.body.appendChild(pill);
  }

  function refresh() { applyStates(); syncUrl(); renderPill(); drawOverlay(); }
  function setState(s) { state = s; params.set("state", s); refresh(); }
  function setVariant(v) { variant = v; refresh(); }
  function toggleStress() { stress = !stress; bind(); refresh(); }
  function toggleOverlay() { overlayOn = !overlayOn; refresh(); }

  function typing(e) {
    var t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  document.addEventListener("keydown", function (e) {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowRight" && states.length) setState(cycle(states, state, 1));
    else if (e.key === "ArrowLeft" && states.length) setState(cycle(states, state, -1));
    else if (e.key === "s" || e.key === "S") toggleStress();
    else if ((e.key === "v" || e.key === "V") && variants.length > 1) setVariant(cycle(variants, variant, 1));
    else if (e.key === "a" || e.key === "A") toggleOverlay();
  });

  window.addEventListener("resize", drawOverlay);

  // Mockups have no server: a form with data-next navigates there instead of submitting.
  // The current stress and variant settings carry over; form values never go into the URL.
  document.addEventListener("submit", function (e) {
    var next = e.target.getAttribute && e.target.getAttribute("data-next");
    if (!next) return;
    e.preventDefault();
    var p = new URLSearchParams();
    if (stress) p.set("stress", "1");
    if (params.get("pill") === "0") p.set("pill", "0");
    var q = p.toString();
    location.href = next + (q ? (next.indexOf("?") === -1 ? "?" : "&") + q : "");
  });

  var css = document.createElement("style");
  css.textContent = [
    ".specit-pill{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483646;display:flex;gap:4px;align-items:center;padding:4px;border-radius:999px;background:#111;color:#fff;font:500 12px/1 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35)}",
    ".specit-pill button{all:unset;cursor:pointer;padding:8px 10px;border-radius:999px;color:#fff}",
    ".specit-pill button:hover{background:#333}",
    ".specit-pill button:focus-visible{outline:2px solid #ffd400;outline-offset:1px}",
    ".specit-label{padding:0 4px;white-space:nowrap}",
    ".specit-layer{position:absolute;left:0;top:0;width:0;height:0;z-index:2147483645;pointer-events:none}",
    ".specit-box{position:absolute;outline:2px dashed #ff2d7a;outline-offset:-1px}",
    ".specit-tag{position:absolute;left:0;top:-18px;background:#ff2d7a;color:#fff;font:600 11px/16px system-ui,sans-serif;padding:0 4px;border-radius:3px;white-space:nowrap}",
    ".specit-current{outline:3px solid #ff2d7a;outline-offset:4px}",
    "@media print{.specit-pill,.specit-layer{display:none}}"
  ].join("");
  document.head.appendChild(css);

  bind();
  refresh();
})();
