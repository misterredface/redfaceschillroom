// ────────────────────────────────────────────────────────
//   Grid Button — animated wireframe grid inside a button
//   Runs only while mouse hovers the button
// ────────────────────────────────────────────────────────

(function () {
    "use strict";

    // ── Perlin 2D noise ─────────────────────────────────
    var perm = new Uint8Array(512);
    (function seed() {
        var p = [];
        for (var i = 0; i < 256; i++) p[i] = i;
        for (var i = 255; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = p[i]; p[i] = p[j]; p[j] = tmp;
        }
        for (var i = 0; i < 512; i++) perm[i] = p[i & 255];
    })();

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(a, b, t) { return (1 - t) * a + t * b; }

    function grad(hash, x, y) {
        var h = hash & 3;
        return ((h & 1) ? x : -x) + ((h & 2) ? y : -y);
    }

    /** 2-D gradient noise → [-1, 1] */
    function noise(x, y) {
        var xi = Math.floor(x) & 255;
        var yi = Math.floor(y) & 255;
        var xf = x - Math.floor(x);
        var yf = y - Math.floor(y);
        var u = fade(xf);
        var v = fade(yf);
        var aa = perm[perm[xi]     + yi], ab = perm[perm[xi]     + yi + 1];
        var ba = perm[perm[xi + 1] + yi], bb = perm[perm[xi + 1] + yi + 1];
        return lerp(
            lerp(grad(aa, xf,      y), grad(ba, xf - 1, y), u),
            lerp(grad(ab, xf,      y - 1), grad(bb, xf - 1, y - 1), u)
        );
    }

    // ── Config ──────────────────────────────────────────
    var C = {
        cols:       20,           // vertical lines
        rows:       10,           // points per line - 1
        ampX:       16,           // px wave amplitude X
        ampY:       16,           // px wave amplitude Y
        spX:        0.01,         // phase speeds
        spY:        0.008,
        fric:       0.925,        // cursor damping
        tens:       0.005,        // spring force
        rad:        60,           // mouse repulsion radius

        colors: [
            "rgba(24,0,0,0.12)",
            "rgba(69,0,0,0.22)",
            "rgba(128,0,0,0.38)",
            "rgba(208,0,0,0.55)",
            "rgba(255,32,32,0.80)",
        ]
    };

    // ── State ───────────────────────────────────────────
    var btnEl, cvs, ctx;
    var pts = null;              // Point[] flat array
    var nPts;                    // total count
    var gridCols, gridRows;      // cells (lines / segments)
    var isActive = false;

    // Smoothed mouse pos (relative to canvas top-left)
    var smx = -999, sny = -999;
    var mSpeed = 0;

    // Accumulated elapsed seconds (BUG FIX #1: proper delta accumulation)
    var elapsedSecs = 0;
    var prevTs = 0;
    var animId = null;

    // ── Build point grid ────────────────────────────────
    function buildGrid(w, h) {
        gridCols = C.cols;
        gridRows = C.rows;
        var cellW = w / C.cols;
        var cellH = h / C.rows;
        nPts = (gridCols + 1) * (gridRows + 1);

        pts = [];
        for (var row = 0; row <= gridRows; row++) {
            for (var col = 0; col <= gridCols; col++) {
                pts.push({
                    bx: col * cellW,   by: row * cellH,  // base position
                    wx: 0, wy: 0,                                // wave offset
                    cx: 0, cy: 0,                                // cursor offset
                });
            }
        }
    }

    // ── Update physics ──────────────────────────────────
    function update() {
        // Track mouse speed from movement delta
        var dx = smx;  // relative change tracked below
        var ddx = mx - smx;  // actual mouse move amount
        var ddy = my - sny;
        mSpeed += Math.sqrt(ddx * ddx + ddy * ddy) - mSpeed;
        mSpeed *= 0.9;
        mSpeed = Math.max(0, Math.min(60, mSpeed));

        for (var i = 0; i < nPts; i++) {
            var pt = pts[i];

            // Wave displacement from noise at scaled coordinates
            var move = noise(pt.bx * 0.03 + elapsedSecs * C.spX * 100,
                             pt.by * 0.03 + elapsedSecs * C.spY * 100) * 12;
            pt.wx = Math.cos(move) * C.ampX;
            pt.wy = Math.sin(move) * C.ampY;

            // Mouse repulsion
            var pdx = pt.bx - smx;
            var pdy = pt.by - sny;
            var dist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (dist < C.rad && dist > 0.5) {
                var s = 1 - dist / C.rad;
                pt.cx += (pdx > 0 ? 1 : -1) * s * mSpeed * 0.015;
                pt.cy += (pdy > 0 ? 1 : -1) * s * mSpeed * 0.015;
            }

            // Spring back to rest + damping
            pt.cx *= C.fric;
            pt.cy *= C.fric;
        }
    }

    var mx = -999, my = -999;

    // ── Draw all grid lines ─────────────────────────────
    function draw(cw, ch) {
        ctx.clearRect(0, 0, cw, ch);
        ctx.lineWidth = 0.9;
        ctx.shadowColor = "rgba(128,0,0,0.25)";
        ctx.shadowBlur = 5;

        var stride = gridCols + 1;  // points per row

        // Average displacement per row for color selection
        var rowDisp = [];
        for (var r = 0; r <= gridRows; r++) {
            var sum = 0;
            for (var c = 0; c <= gridCols; c++) {
                var idx = r * stride + c;
                var mag = Math.sqrt(pts[idx].wx * pts[idx].wx + pts[idx].wy * pts[idx].wy);
                sum += mag;
            }
            rowDisp[r] = sum / (gridCols + 1);
        }

        // Average displacement per column for color selection
        var colDisp = [];
        for (var c = 0; c <= gridCols; c++) {
            var sum = 0;
            for (var r = 0; r <= gridRows; r++) {
                var idx = r * stride + c;
                var mag = Math.sqrt(pts[idx].wx * pts[idx].wx + pts[idx].wy * pts[idx].wy);
                sum += mag;
            }
            colDisp[c] = sum / (gridRows + 1);
        }

        function getColor(arr, idx) {
            var m = arr[idx];
            if (m > 8)  return C.colors[4];
            if (m > 5)  return C.colors[3];
            if (m > 3)  return C.colors[2];
            if (m > 1.5) return C.colors[1];
            return C.colors[0];
        }

        // Horizontal lines (each row connected left-to-right)
        for (var r = 0; r <= gridRows; r++) {
            ctx.beginPath();
            var first = pts[r * stride];
            ctx.moveTo(first.bx + first.wx + first.cx, first.by + first.wy + first.cy);
            for (var c = 1; c <= gridCols; c++) {
                var p = pts[r * stride + c];
                ctx.lineTo(p.bx + p.wx + p.cx, p.by + p.wy + p.cy);
            }
            ctx.strokeStyle = getColor(rowDisp, r);
            ctx.stroke();
        }

        // Vertical lines (each col connected top-to-bottom)
        for (var c = 0; c <= gridCols; c++) {
            ctx.beginPath();
            var fV = pts[c];
            ctx.moveTo(fV.bx + fV.wx + fV.cx, fV.by + fV.wy + fV.cy);
            for (var r = 1; r <= gridRows; r++) {
                var pV = pts[r * stride + c];
                ctx.lineTo(pV.bx + pV.wx + pV.cx, pV.by + pV.wy + pV.cy);
            }
            ctx.strokeStyle = getColor(colDisp, c);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
    }

    // ── Animation loop ──────────────────────────────────
    // BUG FIX #1: Use DT (delta time), NOT raw timestamp
    function tick(ts) {
        elapsedSecs += (ts - prevTs) * 0.001;  // ← correct! dt in ms * 0.001 = seconds
        prevTs = ts;

        update();
        draw(cvs.width, cvs.height);
        animId = requestAnimationFrame(tick);
    }

    // ── Activate on hover ───────────────────────────────
    function activate(e) {
        if (!btnEl) return;
        isActive = true;

        var rect = btnEl.getBoundingClientRect();
        var w = rect.width || btnEl.offsetWidth;
        var h = rect.height || btnEl.offsetHeight;

        mx = e.clientX - rect.left;
        my = e.clientY - rect.top;
        smx = mx;
        sny = my;
        mSpeed = 0;

        // BUG FIX #2: Set both CSS display AND pixel dimensions
        cvs.style.display = "block";
        cvs.width = w | 0;    // ← CRITICAL: this sets the internal buffer size
        cvs.height = h | 0;   // ← same

        buildGrid(w, h);
        elapsedSecs = 0;
        prevTs = performance.now();
        animId = requestAnimationFrame(tick);
    }

    function onMouseMove(e) {
        if (!isActive) return;
        var rect = btnEl.getBoundingClientRect();
        mx = e.clientX - rect.left;
        my = e.clientY - rect.top;
    }

    // ── Deactivate on mouse leave ───────────────────────
    function deactivate() {
        isActive = false;
        if (animId !== null) {
            cancelAnimationFrame(animId);
            animId = null;
        }
        cvs.style.display = "none";
        if (ctx && cvs.width > 0) ctx.clearRect(0, 0, cvs.width, cvs.height);
    }

    // ── Boot ────────────────────────────────────────────
    function init() {
        btnEl = document.getElementById("grid-btn");
        if (!btnEl) return;

        cvs = btnEl.querySelector("canvas");
        if (!cvs) return;
        ctx = cvs.getContext("2d");
        if (!ctx) return;

        btnEl.addEventListener("mouseenter", activate);
        btnEl.addEventListener("mousemove", onMouseMove);
        btnEl.addEventListener("mouseleave", deactivate);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
