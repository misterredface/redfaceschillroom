(function () {
    "use strict";

    var perm = new Uint8Array(512);
    (function seed() {
        var p = [];
        for (var i = 0; i < 256; i++) p[i] = i;
        for (var j = 255; j > 0; j--) {
            var k = Math.floor(Math.random() * (j + 1));
            var t = p[j]; p[j] = p[k]; p[k] = t;
        }
        for (var m = 0; m < 512; m++) perm[m] = p[m & 255];
    })();

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(a, b, t) { return (1 - t) * a + t * b; }
    function grad(h, x, y) { var v = h & 3; return ((v & 1) ? -x : x) + ((v & 2) ? -y : y); }

    function perlin(x, y) {
        var xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
        var xf = x - Math.floor(x), yf = y - Math.floor(y);
        var u = fade(xf), v = fade(yf);
        var aa = perm[perm[xi] + yi], ab = perm[perm[xi] + yi + 1];
        var ba = perm[perm[xi + 1] + yi], bb = perm[perm[xi + 1] + yi + 1];
        return lerp(
            lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
            lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
            v
        );
    }

    var CELL_SIZE = 10;
    var PAD = 40;
    var REPEL_RADIUS = 80;

    function setupGrid(containerEl, triggerEl, defaultMinOpacity) {
        var cvs = containerEl.querySelector("canvas");
        if (!cvs) return;

        var style = getComputedStyle(containerEl);
        var c1 = style.getPropertyValue('--grid-c1').trim() || "#b23a3a";
        var c2 = style.getPropertyValue('--grid-c2').trim() || "#1a0707";

        var isVisible = false;
        var fadeToOpacity = (defaultMinOpacity !== undefined) ? defaultMinOpacity : 0;

        var ctx = null;
        var points = null;
        var COLS = 20, ROWS = 10;
        var elapsedSecs = 0, prevTs = 0, animId = null;
        var mouseX = 0, mouseY = 0;
        var smX = 0, smY = 0, mSpeed = 0;

        var alphaVal = fadeToOpacity;
        var targetAlpha = fadeToOpacity;

        var initialized = false;

        var BASE_W = 220, BASE_H = 64;
        var target = triggerEl || containerEl;

        function buildGrid(w, h) {
            var totalW = w + PAD * 2;
            var totalH = h + PAD * 2;
            COLS = Math.max(10, Math.round(totalW / CELL_SIZE));
            ROWS = Math.max(6, Math.round(totalH / CELL_SIZE));
            var cW = totalW / COLS;
            var cH = totalH / ROWS;

            points = [];
            for (var li = 0; li <= COLS; li++) {
                var row = [];
                for (var pi = 0; pi <= ROWS; pi++) {
                    row.push({
                        bx: -PAD + cW * li,
                        by: -PAD + cH * pi,
                        wx: 0, wy: 0, cx: 0, cy: 0
                    });
                }
                points.push(row);
            }
        }

        function update(ts) {
            var ddx = mouseX - smX, ddy = mouseY - smY;
            mSpeed += (Math.sqrt(ddx * ddx + ddy * ddy) - mSpeed) * 0.2;
            mSpeed = Math.max(0, Math.min(60, mSpeed));
            smX += (mouseX - smX) * 0.1;
            smY += (mouseY - smY) * 0.1;

            for (var li = 0; li <= COLS; li++) {
                for (var pi = 0; pi <= ROWS; pi++) {
                    var pt = points[li][pi];
                    var move = perlin(pt.bx * 0.03 + ts * 0.5, pt.by * 0.03 + ts * 0.4);
                    pt.wx = move * 14;
                    pt.wy = perlin(pt.bx * 0.03 + 7.3, pt.by * 0.03 + ts * 0.4) * 14;
                    var pdx = pt.bx - smX, pdy = pt.by - smY;
                    var dist = Math.sqrt(pdx * pdx + pdy * pdy);
                    if (dist < REPEL_RADIUS && dist > 0.5) {
                        var s = 1 - dist / REPEL_RADIUS;
                        pt.cx += (pdx > 0 ? 1 : -1) * s * mSpeed * 0.01;
                        pt.cy += (pdy > 0 ? 1 : -1) * s * mSpeed * 0.01;
                    }
                    pt.cx *= 0.925;
                    pt.cy *= 0.925;
                }
            }
        }

        function draw(cw, ch) {
            ctx.clearRect(0, 0, cw, ch);
            ctx.lineWidth = 0.9;
            ctx.shadowColor = c1;
            ctx.shadowBlur = 4;

            function getColor(m) {
                if (m > 4) return c1;
                return c2;
            }

            for (var r = 0; r <= ROWS; r++) {
                ctx.beginPath();
                var m = 0;
                for (var c = 0; c <= COLS; c++) {
                    var px = points[c][r].wx, py = points[c][r].wy;
                    m += Math.sqrt(px * px + py * py);
                }
                m /= (COLS + 1);
                ctx.strokeStyle = getColor(m);
                var f = points[0][r];
                ctx.moveTo(f.bx + f.wx + f.cx, f.by + f.wy + f.cy);
                for (var c = 1; c <= COLS; c++) {
                    var p = points[c][r];
                    ctx.lineTo(p.bx + p.wx + p.cx, p.by + p.wy + p.cy);
                }
                ctx.stroke();
            }

            for (var c = 0; c <= COLS; c++) {
                ctx.beginPath();
                var m = 0;
                for (var r = 0; r <= ROWS; r++) {
                    var px = points[c][r].wx, py = points[c][r].wy;
                    m += Math.sqrt(px * px + py * py);
                }
                m /= (ROWS + 1);
                ctx.strokeStyle = getColor(m);
                var f = points[c][0];
                ctx.moveTo(f.bx + f.wx + f.cx, f.by + f.wy + f.cy);
                for (var r = 1; r <= ROWS; r++) {
                    var p = points[c][r];
                    ctx.lineTo(p.bx + p.wx + p.cx, p.by + p.wy + p.cy);
                }
                ctx.stroke();
            }
        }

        function tick(ts) {
            if (containerEl.clientWidth > 0 &&
                (containerEl.clientWidth !== BASE_W || containerEl.clientHeight !== BASE_H)) {
                BASE_W = containerEl.clientWidth;
                BASE_H = containerEl.clientHeight;
                cvs.width = BASE_W;
                cvs.height = BASE_H;
                if (!ctx) ctx = cvs.getContext("2d");
                buildGrid(BASE_W, BASE_H);
                initialized = true;
            }

            elapsedSecs += (ts - prevTs) * 0.001;
            prevTs = ts;
            update(elapsedSecs);

            if (alphaVal < targetAlpha) alphaVal = Math.min(targetAlpha, alphaVal + 0.1);
            else if (alphaVal > targetAlpha) alphaVal = Math.max(targetAlpha, alphaVal - 0.1);
            cvs.style.opacity = alphaVal.toFixed(3);

            if (targetAlpha === 0 && alphaVal < 0.02) {
                cancelAnimationFrame(animId);
                animId = null;
                ctx.clearRect(0, 0, cvs.width, cvs.height);
                return;
            }

            if (initialized && isVisible) draw(cvs.width, cvs.height);
            animId = requestAnimationFrame(tick);
        }

        function activate(e) {
            if (!initialized) {
                BASE_W = containerEl.clientWidth || 220;
                BASE_H = containerEl.clientHeight || 64;
                cvs.width = BASE_W;
                cvs.height = BASE_H;
                ctx = cvs.getContext("2d");
                buildGrid(BASE_W, BASE_H);
                initialized = true;
            }

            if (e.type === "focus") {
                mouseX = BASE_W / 2;
                mouseY = BASE_H / 2;
            } else {
                var rect = containerEl.getBoundingClientRect();
                mouseX = e.clientX - rect.left;
                mouseY = e.clientY - rect.top;
            }
            smX = mouseX; smY = mouseY; mSpeed = 0;
            targetAlpha = 1;

            if (!animId && isVisible) {
                prevTs = performance.now();
                animId = requestAnimationFrame(tick);
            }
        }

        function onPointerMove(e) {
            var rect = containerEl.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        }

        function deactivate() {
            targetAlpha = fadeToOpacity;
        }

        target.addEventListener("pointerenter", activate);
        target.addEventListener("pointermove", onPointerMove);
        target.addEventListener("pointerleave", deactivate);
        target.addEventListener("focus", activate);
        target.addEventListener("blur", deactivate);

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                isVisible = entry.isIntersecting;
                if (isVisible && !animId) {
                    prevTs = performance.now();
                    animId = requestAnimationFrame(tick);
                } else if (!isVisible && animId && targetAlpha === 0 && alphaVal < 0.02) {
                    cancelAnimationFrame(animId);
                    animId = null;
                    if (ctx) ctx.clearRect(0, 0, cvs.width, cvs.height);
                }
            });
        }, { threshold: 0 });

        observer.observe(containerEl);

        if (fadeToOpacity > 0) {
            prevTs = performance.now();
            animId = requestAnimationFrame(tick);
        }
    }

    function init() {
        var buttons = document.querySelectorAll(".grid-button");
        for (var i = 0; i < buttons.length; i++) {
            setupGrid(buttons[i], null, 0);
        }

        var navBar = document.querySelector(".nav-bar");
        var highlight = document.querySelector(".nav-highlight");
        if (navBar && highlight) {
            setupGrid(highlight, navBar, 0.3);
        }

        var boxes = document.querySelectorAll(".grid-box, .grid-text-bg");
        for (var j = 0; j < boxes.length; j++) {
            setupGrid(boxes[j], null, 0);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();