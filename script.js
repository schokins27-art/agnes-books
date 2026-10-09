/* Book of Tommy — edge and wheel navigation, stable spread sizing. */
(async () => {
  const host = document.getElementById('flipbook');
  const error = document.getElementById('error');
  let flip;
  try {
    if (!host || !window.St?.PageFlip) throw new Error('Не удалось загрузить механизм перелистывания.');
    const path = new URLSearchParams(location.search).get('book') || 'books/tommy/book.json';
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error('Не найден файл книги: ' + path);
    const cfg = await res.json();
    const base = new URL('.', new URL(path, location.href));
    const names = [cfg.cover, ...(cfg.pages || []), cfg.back].filter(Boolean);
    if (names.length < 4 || names.length % 2) throw new Error('Нужно чётное количество изображений, включая обложки.');
    const urls = names.map(name => new URL(name, base).href);
    await Promise.all(urls.map(src => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = () => reject(new Error('Не загрузилась страница: ' + src));
      img.src = src;
    })));

    // Reserve exactly two page widths, even while one cover is visible.
    const vw = window.innerWidth, vh = window.innerHeight;
    const pageWidth = Math.max(100, Math.floor(Math.min(vw * 0.46, vh * 0.86 * 720 / 1020)));
    const pageHeight = Math.round(pageWidth * 1020 / 720);
    host.style.width = `${pageWidth * 2}px`;
    host.style.height = `${pageHeight}px`;
    flip = new St.PageFlip(host, {
      width: pageWidth, height: pageHeight, size: 'fixed',
      showCover: true, usePortrait: false, autoSize: false,
      drawShadow: true, maxShadowOpacity: 0.38, flippingTime: 1050,
      mobileScrollSupport: false, showPageCorners: false,
      disableFlipByClick: true, startPage: 0
    });
    flip.loadFromImages(urls);

    let busy = false;
    let unlock = 0;
    const turn = direction => {
      if (busy) return;
      const i = flip.getCurrentPageIndex();
      if (direction > 0 && i >= names.length - 1) return;
      if (direction < 0 && i <= 0) return;
      busy = true;
      clearTimeout(unlock);
      // The library's flip event fires at the START of the turn, not the end.
      unlock = setTimeout(() => { busy = false; }, 1120);
      if (direction > 0) flip.flipNext('bottom');
      else flip.flipPrev('bottom');
    };

    // Clicking the right/left outer edge turns one sheet. Covers respond too.
    host.addEventListener('click', event => {
      const rect = host.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      if (x >= 0.70) turn(1);
      else if (x <= 0.30) turn(-1);
    });
    // Mouse wheel works without moving the tldraw canvas while hovered.
    let wheelSum = 0;
    host.addEventListener('wheel', event => {
      event.preventDefault();
      event.stopPropagation();
      if (busy) return;
      wheelSum += event.deltaY;
      if (Math.abs(wheelSum) >= 32) {
        const direction = Math.sign(wheelSum);
        wheelSum = 0;
        turn(direction);
      }
    }, { passive: false });
    document.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') turn(1);
      if (event.key === 'ArrowLeft') turn(-1);
    });
  } catch (e) {
    if (error) { error.hidden = false; error.textContent = e.message; }
    console.error('Book of Tommy:', e);
  }
})();
