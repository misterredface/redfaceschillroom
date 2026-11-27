document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const root = document.documentElement;

    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'light' || (!savedTheme && !systemPrefersDark)) {
        root.setAttribute('data-theme', 'light');
    } else {
        root.setAttribute('data-theme', 'dark');
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = root.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    const canvas = document.getElementById('mosaic-canvas');
    const ctx = canvas.getContext('2d');
    const container = document.querySelector('.mosaic-container');

    const img = new Image();
    img.src = 'assets/profile.webp';

    let isHovered = false;
    let currentPixelSize = 20;
    const targetPixelSize = 20;
    const revealedPixelSize = 1;

    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        renderMosaic();
    };

    img.onerror = () => {
        ctx.fillStyle = "var(--bg-card)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "var(--text-muted)";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Add assets/profile.webp", canvas.width / 2, canvas.height / 2);
    };

    function renderMosaic() {
        if (!img.complete || img.naturalHeight === 0) return;

        const w = Math.max(1, Math.floor(img.width / currentPixelSize));
        const h = Math.max(1, Math.floor(img.height / currentPixelSize));

        const offCanvas = document.createElement('canvas');
        offCanvas.width = w;
        offCanvas.height = h;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(img, 0, 0, w, h);

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height);
    }

    function animateMosaic() {
        const target = isHovered ? revealedPixelSize : targetPixelSize;

        if (Math.abs(currentPixelSize - target) > 0.1) {
            currentPixelSize += (target - currentPixelSize) * 0.15;
            renderMosaic();
            requestAnimationFrame(animateMosaic);
        } else {
            currentPixelSize = target;
            renderMosaic();
        }
    }

    container.addEventListener('mouseenter', () => { isHovered = true; requestAnimationFrame(animateMosaic); });
    container.addEventListener('mouseleave', () => { isHovered = false; requestAnimationFrame(animateMosaic); });
    container.addEventListener('click', () => { isHovered = !isHovered; requestAnimationFrame(animateMosaic); });
    container.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            isHovered = !isHovered;
            requestAnimationFrame(animateMosaic);
        }
    });

    const reveals = document.querySelectorAll('.reveal');
    const backToTop = document.getElementById('back-to-top');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    reveals.forEach(reveal => observer.observe(reveal));

    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    });

    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const webTags = document.querySelectorAll('.web-tag');

    webTags.forEach(tag => {
        let isDragging = false;
        let startX, startY;
        let anchorX, anchorY;

        const box = tag.closest('.web-box');
        const svg = box.querySelector('.web-lines');
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        svg.appendChild(line);

        tag.addEventListener('pointerdown', (e) => {
            isDragging = true;
            tag.setPointerCapture(e.pointerId);
            tag.classList.add('dragging');

            startX = e.clientX;
            startY = e.clientY;

            anchorX = tag.offsetLeft + tag.offsetWidth / 2;
            anchorY = tag.offsetTop + tag.offsetHeight / 2;

            line.setAttribute('x1', anchorX);
            line.setAttribute('y1', anchorY);
            line.setAttribute('x2', anchorX);
            line.setAttribute('y2', anchorY);
            line.style.opacity = '1';
        });

        tag.addEventListener('pointermove', (e) => {
            if (!isDragging) return;

            const currentX = e.clientX - startX;
            const currentY = e.clientY - startY;

            tag.style.transform = `translate(${currentX}px, ${currentY}px)`;

            line.setAttribute('x2', anchorX + currentX);
            line.setAttribute('y2', anchorY + currentY);
        });

        const endDrag = (e) => {
            if (!isDragging) return;
            isDragging = false;
            tag.releasePointerCapture(e.pointerId);
            tag.classList.remove('dragging');

            tag.style.transform = `translate(0, 0)`;
            line.style.opacity = '0';

            setTimeout(() => {
                line.setAttribute('x2', anchorX);
                line.setAttribute('y2', anchorY);
            }, 200);
        };

        tag.addEventListener('pointerup', endDrag);
        tag.addEventListener('pointercancel', endDrag);
    });
});