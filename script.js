// ────────────────────────────────────────────────────────
//   Red Wireframe Grid
//   Ported from interactive-waves (girishlade111)
//   Same algorithm, red color palette, single-path drawing
// ────────────────────────────────────────────────────────

(function () {
    "use strict";

    // ── Colors ──────────────────────────────────────────
    var RED_COLORS = [
        "rgba(24,0,0,0.12)",     // barely-visible
        "rgba(69,0,0,0.22)",
        "rgba(128,0,0,0.38)",
        "rgba(208,0,0,0.55)",
        "rgba(255,32,32,0.75)",  // highlight
    ];

    // ── Wave config ─────────────────────────────────────
    var SPEED_X       = 0.01;
    var SPEED_Y       = 0.008;
    var AMP_X         = 38;
    var AMP_Y         = 38;
    var FRICTION      = 0.925;
    var TENSION       = 0.005;
    var GRID_GAP      = 14;   // px between points
    var MOUSE_RADIUS  = 150;

    // ── Noise class (from interactive-waves) ────────────
    var Grad = function (x, y) { this.x = x; this.y = y; };
    Grad.prototype.dot2 = function (x, y) { return this.x * x + this.y * y; };

    var PERM_TABLE = [
        151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,
        140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,
        120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,
        177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
        74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,
        122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,
        143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,
        18,169,200,196,135,130,116,188,159,86,164,100,109,198,
        173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,
        126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,
        28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,
        153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,
        79,113,224,232,178,185,112,104,218,246,97,228,251,34,
        242,193,238,210,144,12,191,179,162,241,81,51,145,235,
        249,14,239,107,49,192,214,31,181,199,106,157,184,84,
        204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,
        114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
    ];

    var GRAD3 = [
        new Grad(1,1), new Grad(-1,1), new Grad(1,-1), new Grad(-1,-1),
        new Grad(1,0), new Grad(-1,0), new Grad(0,1), new Grad(0,-1)
    ];

    var noisePerm = new Array(512);
    var noiseGradP = new Array(512);
    for (var ni = 0; ni < 512; ni++) {
        noisePerm[ni] = PERM_TABLE[ni & 255];
        noiseGradP[ni] = GRAD3[noisePerm[ni] % 8];
    }

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(a, b, t) { return (1 - t) * a + t * b; }

    function perlin2(x, y) {
        var Xi = Math.floor(x) & 255;
        var Yi = Math.floor(y) & 255;
        var xf = x - Math.floor(x);
        var yf = y - Math.floor(y);
        var u = fade(xf);
        var v = fade(yf);
        var aa = noiseGradP[Xi + noisePerm[Yi]].dot2(xf, yf);
        var ba = noiseGradP[Xi + 1 + noisePerm[Yi]].dot2(xf - 1, yf);
        var ab = noiseGradP[Xi + noisePerm[Yi + 1]].dot2(xf, yf - 1);
        var bb = noiseGradP[Xi + 1 + noisePerm[Yi + 1]].dot2(xf - 1, yf - 1);
        return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
    }

    // ── State ───────────────────────────────────────────
    var canvas, ctx;
    var w, h;
    var lines;           // Point[][]
    var mousePos = { x: -100, y: -100, lx: 0, ly: 0 };
    var smoothMouse = { sx: -100, sy: -100, vs: 0 };
    var animId = null;

    // ── Build grid ──────────────────────────────────────
    function createGrid() {
        var totalLines = Math.ceil((w + 400) / GRID_GAP);
        var totalPoints = Math.ceil((h + 100) / GRID_GAP);
        var xOff = (w - totalLines * GRID_GAP) / 2;
        var yOff = (h - totalPoints * GRID_GAP) / 2;

        lines = [];
        for (var i = 0; i <= totalLines; i++) {
            var pts = [];
            for (var j = 0; j <= totalPoints; j++) {
                pts.push({
                    bx: xOff + GRID_GAP * i,     // base x
                    by: yOff + GRID_GAP * j,     // base y
                    wx: 0, wy: 0,               // wave offset
                    cx: 0, cy: 0,               // cursor offset
                    cvx: 0, cvy: 0             // cursor velocity
                });
            }
            lines.push(pts);
        }
    }

    // ── Update displacements ────────────────────────────
    function update(time) {
        var mx = smoothMouse.sx;
        var my = smoothMouse.sy;
        var spd = smoothMouse.vs;

        for (var li = 0; li < lines.length; li++) {
            var row = lines[li];
            for (var pi = 0; pi < row.length; pi++) {
                var pt = row[pi];

                // Noise-based wave displacement
                var move = perlin2((pt.bx + time * SPEED_X) * 0.002,
                                   (pt.by + time * SPEED_Y) * 0.002) * 12;
                pt.wx = Math.cos(move) * AMP_X;
                pt.wy = Math.sin(move) * AMP_Y;

                // Mouse repulsion
                var dx = pt.bx - mx;
                var dy = pt.by - my;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MOUSE_RADIUS) {
                    var s = 1 - dist / MOUSE_RADIUS;
                    var force = Math.cos(dist * 0.001) * s;
                    pt.cvx += force * spd * 0.006;
                    pt.cvy += force * spd * 0.006;
                }

                // Spring back to rest position
                pt.cvx += (0 - pt.cx) * TENSION;
                pt.cvy += (0 - pt.cy) * TENSION;
                pt.cvx *= FRICTION;
                pt.cvy *= FRICTION;
                pt.cx += pt.cvx;
                pt.cy += pt.cvy;
                pt.cx = Math.max(-100, Math.min(100, pt.cx));
                pt.cy = Math.max(-100, Math.min(100, pt.cy));
            }
        }
    }

    // ── Get final rendered position ─────────────────────
    function renderPt(pt) {
        return {
            x: pt.bx + pt.wx + pt.cx,
            y: pt.by + pt.wy + pt.cy
        };
    }

    // ── Draw all lines ──────────────────────────────────
    function draw() {
        ctx.clearRect(0, 0, w, h);
        ctx.lineWidth = 0.8;
        ctx.shadowColor = "rgba(80,0,0,0.15)";
        ctx.shadowBlur = 4;

        // Precompute average displacement per row/col for coloring
        var numCols = lines[0].length;
        var numRows = lines.length;
        var rowMag = [];
        var colMag = [];

        for (var r = 0; r < numRows; r++) {
            var sum = 0;
            for (var p = 0; p < lines[r].length; p++) {
                var mag = Math.sqrt(lines[r][p].wx * lines[r][p].wx + lines[r][p].wy * lines[r][p].wy);
                sum += mag;
            }
            rowMag[r] = sum / lines[r].length;
        }

        for (var c = 0; c < numCols; c++) {
            var sum = 0;
            for (var r = 0; r < numRows; r++) {
                var mag = Math.sqrt(lines[r][c].wx * lines[r][c].wx + lines[r][c].wy * lines[r][c].wy);
                sum += mag;
            }
            colMag[c] = sum / numRows;
        }

        function getColor(mag) {
            if (mag > 8)           return RED_COLORS[4];
            if (mag > 5.5)         return RED_COLORS[3];
            if (mag > 4)           return RED_COLORS[2];
            if (mag > 2.5)         return RED_COLORS[1];
            return RED_COLORS[0];
        }

        // Horizontal lines (each row = one subpath)
        for (var r = 0; r < numRows; r++) {
            ctx.beginPath();
            var firstR = renderPt(lines[r][0]);
            ctx.moveTo(firstR.x, firstR.y);
            for (var p = 1; p < lines[r].length; p++) {
                var pr = renderPt(lines[r][p]);
                ctx.lineTo(pr.x, pr.y);
            }
            ctx.strokeStyle = getColor(rowMag[r]);
            ctx.stroke();
        }

        // Vertical lines (each col = one subpath)
        for (var c = 0; c < numCols; c++) {
            ctx.beginPath();
            var firstV = renderPt(lines[0][c]);
            ctx.moveTo(firstV.x, firstV.y);
            for (var ri = 1; ri < numRows; ri++) {
                var pv = renderPt(lines[ri][c]);
                ctx.lineTo(pv.x, pv.y);
            }
            ctx.strokeStyle = getColor(colMag[c]);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
    }

    // ── Track mouse smoothly ────────────────────────────
    function updateMouse(ts) {
        smoothMouse.sx += (mousePos.x - smoothMouse.sx) * 0.1;
        smoothMouse.sy += (mousePos.y - smoothMouse.sy) * 0.1;

        var ddx = mousePos.x - mousePos.lx;
        var ddy = mousePos.y - mousePos.ly;
        var dd = Math.sqrt(ddx * ddx + ddy * ddy);
        smoothMouse.vs += (dd - smoothMouse.vs) * 0.1;
        smoothMouse.vs = Math.min(100, smoothMouse.vs);
        mousePos.lx = mousePos.x;
        mousePos.ly = mousePos.y;
    }

    // ── Animation loop ──────────────────────────────────
    function tick(ts) {
        updateMouse(ts);
        update(ts);
        draw();
        animId = requestAnimationFrame(tick);
    }

    // ── Resize ───────────────────────────────────────────
    function onResize() {
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = w;
        canvas.height = h;
        createGrid();
    }

    // ── Boot ────────────────────────────────────────────
    function init() {
        canvas = document.getElementById("grid-canvas");
        if (!canvas) return;
        ctx = canvas.getContext("2d");
        if (!ctx) return;

        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = w;
        canvas.height = h;

        createGrid();

        window.addEventListener("resize", onResize);

        window.addEventListener("mousemove", function (e) {
            mousePos.x = e.clientX;
            mousePos.y = e.clientY;
        });

        window.addEventListener("touchmove", function (e) {
            var touch = e.touches[0];
            mousePos.x = touch.clientX;
            mousePos.y = touch.clientY;
        }, { passive: true });

        animId = requestAnimationFrame(tick);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
