/* Book of Tommy v3.4 — hard covers, HTML sheets, edge and wheel navigation. */
(async () => {
  const host = document.getElementById('flipbook');
  const error = document.getElementById('error');
  try {
    if (!host || !window.St?.PageFlip) throw new Error('Не удалось загрузить механизм перелистывания.');
    const path = new URLSearchParams(location.search).get('book') || 'books/tommy/book.json';
    const response = await fetch(path, {cache:'no-store'});
    if (!response.ok) throw new Error('Не найден файл книги: ' + path);
    const cfg = await response.json();
    const base = new URL('.', new URL(path, location.href));
    const names = [cfg.cover, ...(cfg.pages || []), cfg.back].filter(Boolean);
    if (names.length < 4 || names.length % 2 !== 0) throw new Error('Нужно чётное количество изображений, включая обложки.');
    const urls = names.map(name => new URL(name, base).href);
    await Promise.all(urls.map(src => new Promise((resolve,reject) => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = () => reject(new Error('Не загрузилась страница: ' + src));
      image.src = src;
    })));
    const w = Math.max(100, Math.floor(Math.min(innerWidth * .46, innerHeight * .86 * 720 / 1020)));
    const h = Math.round(w * 1020 / 720);
    host.style.width = `${w * 2}px`;
    host.style.height = `${h}px`;
    const sheets = urls.map((url,index) => {
      const sheet = document.createElement('div');
      sheet.className = 'book-sheet' + (index === 0 || index === urls.length-1 ? ' book-cover' : '');
      if (index === 0 || index === urls.length-1) sheet.dataset.density = 'hard';
      const picture = document.createElement('img');
      picture.src = url;
      picture.alt = index === 0 ? 'Передняя обложка' : index === urls.length-1 ? 'Задняя обложка' : `Страница ${index}`;
      picture.draggable = false;
      sheet.append(picture);
      host.append(sheet);
      return sheet;
    });
    const flip = new St.PageFlip(host, {
      width:w, height:h, size:'fixed', showCover:true, usePortrait:false, autoSize:false,
      drawShadow:true, maxShadowOpacity:.34, flippingTime:1050,
      mobileScrollSupport:false, showPageCorners:false, disableFlipByClick:true, startPage:0
    });
    flip.loadFromHTML(sheets);
    // Quiet page-rustle sound generated locally: no audio downloads or external services.
    // Audio starts only after the reader clicks or scrolls, as required by browsers.
    let audioContext;
    function pageSound(isCover) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        audioContext ||= new AudioContextClass();
        if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
        const sr = audioContext.sampleRate;
        const duration = isCover ? 0.48 : 0.62;
        const buffer = audioContext.createBuffer(1, Math.ceil(sr * duration), sr);
        const samples = buffer.getChannelData(0);
        // Brown-ish noise with two overlapping rustle swells and a soft tail.
        let low = 0;
        for (let i = 0; i < samples.length; i++) {
          const t = i / sr;
          low = (low + 0.085 * (Math.random() * 2 - 1)) / 1.085;
          const swell1 = Math.exp(-Math.pow((t - duration * .25) / (duration * .17), 2));
          const swell2 = Math.exp(-Math.pow((t - duration * .65) / (duration * .22), 2));
          samples[i] = (low * .75 + (Math.random() * 2 - 1) * .16) * (swell1 * .55 + swell2 * .65);
        }
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        const filter = audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = isCover ? 420 : 850;
        filter.Q.value = .48;
        const gain = audioContext.createGain();
        gain.gain.value = isCover ? .14 : .11;
        source.connect(filter); filter.connect(gain); gain.connect(audioContext.destination);
        source.start();
        source.onended = () => {source.disconnect(); filter.disconnect(); gain.disconnect();};
      } catch (e) { console.warn('Page sound unavailable:', e); }
    }
    let busy = false;
    let unlock;
    const turn = direction => {
      if (busy) return;
      const i = flip.getCurrentPageIndex();
      if (direction > 0 && i >= urls.length - 1) return;
      if (direction < 0 && i <= 0) return;
      busy = true;
      pageSound(i === 0 || i >= urls.length - 2);
      clearTimeout(unlock);
      if (direction > 0) flip.flipNext('bottom');
      else flip.flipPrev('bottom');
      unlock = setTimeout(() => {busy = false;}, 1150);
    };
    host.addEventListener('click', event => {
      const rect = host.getBoundingClientRect();
      const x = (event.clientX - rect.left)/rect.width;
      // On a closed cover, clicking anywhere on the visible cover opens it.
      const i = flip.getCurrentPageIndex();
      if (i === 0 && x >= .45) turn(1);
      else if (i >= urls.length-1 && x <= .55) turn(-1);
      else if (x >= .70) turn(1);
      else if (x <= .30) turn(-1);
    });
    let wheelSum = 0;
    host.addEventListener('wheel', event => {
      event.preventDefault(); event.stopPropagation();
      if (busy) {wheelSum=0;return;}
      wheelSum += event.deltaY;
      if (Math.abs(wheelSum) >= 45) {const d = Math.sign(wheelSum);wheelSum=0;turn(d);}
    },{passive:false});
    document.addEventListener('keydown',event => {
      if (event.key === 'ArrowRight') turn(1);
      else if (event.key === 'ArrowLeft') turn(-1);
    });
  } catch(e) {
    if (error) {error.hidden = false;error.textContent = e.message;}
    console.error('Book of Tommy:',e);
  }
})();
