// ────────────────────────────────────────────────────────
//   Grid Button — animated wireframe grid inside a button
//   Runs only while mouse hovers the button
// ────────────────────────────────────────────────────────

(function () {
    "use strict";

    // ── Perlin noise ────────────────────────────────────
    var perm = new Uint8Array(512);
    (function seed() {
        var p = [];
        for (var i = 0; i < 256; i++) p[i] = i;
        for (var i = 255; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = p[i]; p[i] = p[j]; p[j] = t;
        }
        for (var i = 0; i < 512; i++) perm[i] = p[i & 255];
    })();

    function fade(t) { return t*t*t*(t*(t*6-15)+10); }
    function lerp(a,b,t){return(1-t)*a+t*b;}
    function grad(h,x,y){var v=h&3;return((v&1)?-x:x)+((v&2)?-y:y);}

    function perlin(x,y){
        var xi=Math.floor(x)&255, yi=Math.floor(y)&255;
        var xf=x-Math.floor(x), yf=y-Math.floor(y);
        var u=fade(xf), v=fade(yf);
        var aa=perm[perm[xi]+yi], ab=perm[perm[xi]+yi+1];
        var ba=perm[perm[xi+1]+yi], bb=perm[perm[xi+1]+yi+1];
        return lerp(lerp(grad(aa,xf,yf),grad(ba,xf-1,yf),u),
                    lerp(grad(ab,xf,yf-1),grad(bb,xf-1,yf-1),u),v);
    }

    // ── Config ──────────────────────────────────────────
    var NUM_LINES  = 20;
    var PTS_PER_LN = 10;
    var COLORS     = [
        "#220000", "#440000", "#880000", "#D00000", "#FF2020"
    ];

    // ── State ───────────────────────────────────────────
    var btnEl, cvs, ctx;
    var points = null;
    var elapsedSecs = 0;
    var prevTs = 0;
    var animId = null;
    var mouseX = 0, mouseY = 0;
    var smX = 0, smY = 0;
    var mSpeed = 0;
    var alphaVal = 0, targetAlpha = 0;

    // FIXED button dimensions (content-box) — read ONCE on first hover
    var btnW = 0, btnH = 0;
    var initialized = false;

    // ── Build grid (ONCE, using fixed button dims) ──────
    function buildGrid() {
        var pad = 40;
        var gW = btnW + pad * 2;
        var gH = btnH + pad * 2;
        var cW = gW / NUM_LINES;
        var cH = gH / PTS_PER_LN;

        points = [];
        for (var li = 0; li <= NUM_LINES; li++) {
            var row = [];
            for (var pi = 0; pi <= PTS_PER_LN; pi++) {
                row.push({
                    bx: -pad + cW * li,
                    by: -pad + cH * pi,
                    wx: 0, wy: 0, cx: 0, cy: 0
                });
            }
            points.push(row);
        }
    }

    // ── Update physics ──────────────────────────────────
    function update(ts) {
        var rad = 80;
        var ddx = mouseX - smX;
        var ddy = mouseY - smY;
        mSpeed += (Math.sqrt(ddx*ddx + ddy*ddy) - mSpeed) * 0.2;
        mSpeed = Math.max(0, Math.min(60, mSpeed));
        smX += (mouseX - smX) * 0.1;
        smY += (mouseY - smY) * 0.1;

        for (var li = 0; li <= NUM_LINES; li++) {
            for (var pi = 0; pi <= PTS_PER_LN; pi++) {
                var pt = points[li][pi];
                var move = perlin(pt.bx * 0.03 + ts * 0.5,
                                  pt.by * 0.03 + ts * 0.4);
                pt.wx = move * 14;
                pt.wy = perlin(pt.bx * 0.03 + 7.3,
                               pt.by * 0.03 + ts * 0.4) * 14;

                var pdx = pt.bx - smX;
                var pdy = pt.by - smY;
                var dist = Math.sqrt(pdx*pdx + pdy*pdy);
                if (dist < rad && dist > 0.5) {
                    var s = 1 - dist / rad;
                    pt.cx += (pdx > 0 ? 1 : -1) * s * mSpeed * 0.01;
                    pt.cy += (pdy > 0 ? 1 : -1) * s * mSpeed * 0.01;
                }
                pt.cx *= 0.925;
                pt.cy *= 0.925;
            }
        }
    }

    // ── Draw ────────────────────────────────────────────
    function draw(cw, ch) {
        ctx.clearRect(0, 0, cw, ch);
        var stride = NUM_LINES + 1;

        var rowDisp = [];
        for (var r = 0; r <= PTS_PER_LN; r++) {
            var sum = 0;
            for (var c = 0; c <= NUM_LINES; c++) {
                var px = points[c][r].wx, py = points[c][r].wy;
                sum += Math.sqrt(px*px + py*py);
            }
            rowDisp[r] = sum / (NUM_LINES + 1);
        }

        var colDisp = [];
        for (var c = 0; c <= NUM_LINES; c++) {
            var sum = 0;
            for (var r = 0; r <= PTS_PER_LN; r++) {
                var px = points[c][r].wx, py = points[c][r].wy;
                sum += Math.sqrt(px*px + py*py);
            }
            colDisp[c] = sum / (PTS_PER_LN + 1);
        }

        function getColor(arr, idx) {
            var m = arr[idx];
            if      (m > 8)  return COLORS[4];
            else if (m > 5)  return COLORS[3];
            else if (m > 3)  return COLORS[2];
            else if (m > 1.5) return COLORS[1];
            else             return COLORS[0];
        }

        for (var r = 0; r <= PTS_PER_LN; r++) {
            ctx.beginPath();
            ctx.lineWidth = 0.9;
            ctx.shadowColor = "rgba(128,0,0,0.3)";
            ctx.shadowBlur = 6;
            ctx.strokeStyle = getColor(rowDisp, r);
            var f = points[0][r];
            ctx.moveTo(f.bx+f.wx+f.cx, f.by+f.wy+f.cy);
            for (var c = 1; c <= NUM_LINES; c++) {
                var p = points[c][r];
                ctx.lineTo(p.bx+p.wx+p.cx, p.by+p.wy+p.cy);
            }
            ctx.stroke();
        }

        for (var c = 0; c <= NUM_LINES; c++) {
            ctx.beginPath();
            ctx.lineWidth = 0.9;
            ctx.shadowColor = "rgba(128,0,0,0.3)";
            ctx.shadowBlur = 6;
            ctx.strokeStyle = getColor(colDisp, c);
            var fv = points[c][0];
            ctx.moveTo(fv.bx+fv.wx+fv.cx, fv.by+fv.wy+fv.cy);
            for (var r = 1; r <= PTS_PER_LN; r++) {
                var pv = points[c][r];
                ctx.lineTo(pv.bx+pv.wx+pv.cx, pv.by+pv.wy+pv.cy);
            }
            ctx.stroke();
        }
    }

    // ── Tick ────────────────────────────────────────────
    function tick(ts) {
        elapsedSecs += (ts - prevTs) * 0.001;
        prevTs = ts;
        update(elapsedSecs);

        if (alphaVal < targetAlpha) alphaVal = Math.min(targetAlpha, alphaVal + 0.06);
        else if (alphaVal > targetAlpha) alphaVal = Math.max(targetAlpha, alphaVal - 0.06);
        cvs.style.opacity = alphaVal.toFixed(3);

        if (targetAlpha === 0 && alphaVal < 0.01) {
            cancelAnimationFrame(animId);
            animId = null;
            if (ctx) ctx.clearRect(0, 0, cvs.width, cvs.height);
            return;
        }

        draw(cvs.width, cvs.height);
        animId = requestAnimationFrame(tick);
    }

    // ── Activate ────────────────────────────────────────
    function activate(e) {
        if (!initialized) {
            // BUG FIX: Use content-box dimensions ONLY (220x64 from CSS).
            // getBoundingClientRect() includes border with border-box.
            // We HARDCODE the known CSS content-box size.
            btnW = 220;
            btnH = 64;

            cvs.width  = btnW;
            cvs.height = btnH;
            ctx = cvs.getContext("2d");
            buildGrid();
            initialized = true;
        }

        var rect = btnEl.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        smX = mouseX; smY = mouseY; mSpeed = 0;

        targetAlpha = 1; alphaVal = 0;
        elapsedSecs = 0;
        prevTs = performance.now();
        animId = requestAnimationFrame(tick);
    }

    function onMouseMove(e) {
        var rect = btnEl.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    }

    function deactivate() {
        targetAlpha = 0;
    }

    // ── Boot ────────────────────────────────────────────
    function init() {
        btnEl = document.getElementById("grid-btn");
        if (!btnEl) return;
        cvs = btnEl.querySelector("canvas");
        if (!cvs) return;

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