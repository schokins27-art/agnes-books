/* Image-based StPageFlip: do not construct HTML pages manually. */
(async () => {
  const el = document.getElementById('flipbook');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const error = document.getElementById('error');
  try {
    if (!el || !prev || !next || !error) throw new Error('Не найдены элементы интерфейса книги.');
    if (!window.St?.PageFlip) throw new Error('Не загрузилась библиотека перелистывания.');
    const path = new URLSearchParams(location.search).get('book') || 'books/tommy/book.json';
    const response = await fetch(path, {cache:'no-cache'});
    if (!response.ok) throw new Error('Не найден файл книги: ' + path);
    const cfg = await response.json();
    const base = new URL('.', new URL(path, location.href));
    const files = [cfg.cover, ...(cfg.pages || []), cfg.back].filter(Boolean);
    if (files.length < 4 || files.length % 2) throw new Error('Нужно чётное число изображений, включая обложки.');
    const urls = files.map(file => new URL(file, base).href);
    await Promise.all(urls.map(src => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = () => reject(new Error('Не загрузилась страница: ' + src));
      img.src = src;
    })));
    const flip = new St.PageFlip(el, {
      width: 720, height: 1020, size: 'stretch',
      minWidth: 240, maxWidth: 720, minHeight: 340, maxHeight: 1020,
      showCover: true, drawShadow: true, maxShadowOpacity: 0.5,
      flippingTime: 1050, usePortrait: false, startPage: 0,
      autoSize: true, mobileScrollSupport: false,
      showPageCorners: false, disableFlipByClick: true
    });
    // Crucial: image renderer creates its own canvas and event target.
    flip.loadFromImages(urls);
    const sync = () => {
      const index = flip.getCurrentPageIndex();
      prev.disabled = index <= 0;
      next.disabled = index >= files.length - 1;
    };
    flip.on('flip', sync);
    flip.on('init', sync);
    sync();
    prev.addEventListener('click', () => flip.flipPrev('bottom'));
    next.addEventListener('click', () => flip.flipNext('bottom'));
    el.addEventListener('click', () => {
      if (flip.getCurrentPageIndex() === 0) flip.flipNext('bottom');
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') flip.flipNext('bottom');
      if (event.key === 'ArrowLeft') flip.flipPrev('bottom');
    });
  } catch (e) {
    if (error) {error.hidden = false; error.textContent = e.message;}
    console.error('Book of Tommy:', e);
  }
})();
