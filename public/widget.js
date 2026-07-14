/*!
 * 613 Webring — embeddable widget
 * -------------------------------------------------------------------------
 * Drop this on your site to join the loop:
 *
 *   <div id="webring-613"></div>
 *   <script src="https://www.613webring.ca/widget.js" defer></script>
 *
 * The widget figures out which ring it belongs to from its own <script src>,
 * so it always points back to the right place. It renders inside a Shadow DOM
 * so it can't clash with — or be clobbered by — your site's styles.
 *
 * Optional <script> attributes:
 *   data-target="#some-element"   where to mount (default: #webring-613, else <body>)
 *   data-theme="light" | "dark" | "auto"   (default: auto)
 *   data-label="613 Webring"      center label text
 */
(function () {
  "use strict";

  var me =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      for (var i = s.length - 1; i >= 0; i--) {
        if (s[i].src && /widget\.js(\?|$)/.test(s[i].src)) return s[i];
      }
      return null;
    })();

  var base = "";
  try {
    base = new URL(me.src, location.href).origin;
  } catch (e) {
    base = "";
  }

  var origin = location.origin;
  var theme = (me && me.getAttribute("data-theme")) || "auto";
  var label = (me && me.getAttribute("data-label")) || "613 Webring";
  var targetSel = me && me.getAttribute("data-target");

  function hop(dir) {
    return base + "/nav?dir=" + dir + "&site=" + encodeURIComponent(origin);
  }

  /** Official BCO chrome mark — same asset as the site hero and favicon. */
  function markImg() {
    return (
      '<img class="mark" src="' +
      base +
      '/bco-logo.png" width="22" height="22" alt="" decoding="async" />'
    );
  }

  function mount() {
    var host = document.createElement("div");
    host.className = "webring-613-host";

    var target =
      (targetSel && document.querySelector(targetSel)) ||
      document.getElementById("webring-613");
    if (target) {
      target.appendChild(host);
    } else {
      document.body.appendChild(host);
    }

    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

    var dark =
      theme === "dark" ||
      (theme === "auto" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    var bg = dark ? "#111111" : "#ffffff";
    var fg = dark ? "#f0f0f0" : "#080808";
    var muted = dark ? "#9a9a9a" : "#666666";
    var border = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)";
    var hoverBg = dark ? "#1a1a1a" : "#f0f0f0";
    var shadow = dark
      ? "0 4px 20px rgba(0,0,0,0.45)"
      : "0 4px 16px rgba(0,0,0,0.08)";

    var css =
      ".wr{box-sizing:border-box;display:inline-flex;align-items:center;gap:.15rem;" +
      "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;" +
      "background:" +
      bg +
      ";color:" +
      fg +
      ";border:1px solid " +
      border +
      ";border-radius:999px;padding:.28rem .35rem;box-shadow:" +
      shadow +
      ";font-size:13px;line-height:1;max-width:100%}" +
      ".wr a{display:inline-flex;align-items:center;gap:.35rem;text-decoration:none;color:inherit;" +
      "padding:.38rem .55rem;border-radius:999px;transition:background .15s ease,color .15s ease}" +
      ".wr a:hover{background:" +
      hoverBg +
      ";color:" +
      fg +
      "}" +
      ".wr .arrow{font-family:ui-monospace,'JetBrains Mono',monospace;font-size:12px;font-weight:600;letter-spacing:.02em;color:" +
      muted +
      "}" +
      ".wr .arrow:hover{color:" +
      fg +
      "}" +
      ".wr .mid{font-weight:600;letter-spacing:-.01em;padding-inline:.15rem .25rem}" +
      ".wr .mid b{font-family:ui-monospace,'JetBrains Mono',monospace;font-weight:700}" +
      ".wr .dice{font-family:ui-monospace,monospace;font-size:13px;color:" +
      muted +
      "}" +
      ".wr .dice:hover{color:" +
      fg +
      "}" +
      ".wr .mark{display:block;flex-shrink:0;width:22px;height:22px;object-fit:contain}";

    var html =
      "<style>" +
      css +
      "</style>" +
      '<nav class="wr" aria-label="' +
      label +
      '">' +
      '<a class="arrow" href="' +
      hop("prev") +
      '" title="Previous site in the ring" rel="noopener">&larr;</a>' +
      '<a class="mid" href="' +
      base +
      '" title="' +
      label +
      '" rel="noopener" target="_blank">' +
      markImg() +
      "<span><b>613</b> Webring</span></a>" +
      '<a class="dice" href="' +
      hop("random") +
      '" title="Random site in the ring" rel="noopener">&#9166;</a>' +
      '<a class="arrow" href="' +
      hop("next") +
      '" title="Next site in the ring" rel="noopener">&rarr;</a>' +
      "</nav>";

    root.innerHTML = html;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
