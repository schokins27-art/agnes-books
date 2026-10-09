/* Book of Tommy v3.7 — hard covers, HTML sheets, edge and wheel navigation. */
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
    // Only the first cover must be ready for interaction. Load remaining
    // images progressively so opening never blocks for all diary pages.
    await new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=resolve;
      image.onerror=()=>reject(new Error('Не загрузилась обложка'));
      image.src=urls[0];
    });
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
    // Clicking transparent space outside the VISIBLE pages puts the book away.
    // Closed front cover occupies the right half; closed rear cover the left.
    function outsideVisibleBook(event) {
      const rect=host.getBoundingClientRect();
      const x=event.clientX, y=event.clientY;
      if(y<rect.top || y>rect.bottom || x<rect.left || x>rect.right) return true;
      const page=flip.getCurrentPageIndex();
      const middle=rect.left+rect.width/2;
      if(page===0 && x<middle) return true;
      if(page>=urls.length-1 && x>middle) return true;
      return false;
    }
    document.addEventListener('pointerdown',event=>{
      if(event.button!==0 || !outsideVisibleBook(event))return;
      event.preventDefault();event.stopPropagation();
      window.parent.postMessage({type:'agnes:return-to-shelf'},location.origin);
    },true);
    // Only reveal the book after images and the page-flip engine are ready.
    window.parent.postMessage({type:'agnes:viewer-ready'},location.origin);
    // Real recordings: cover transitions use the closing sound; inner pages use paper.
    const paperAudio = new Audio('sounds/page-turn.mp3?v=37');
    // Shelf pickup/put-away uses the former cover recording in library.js.
    paperAudio.preload = 'auto';
    paperAudio.volume = 0.8;
    function playSound(isClosing) {
      const audio = paperAudio;
      try {
        audio.pause();
        audio.currentTime = 0;
        const playing = audio.play();
        if (playing) playing.catch(e => console.warn('Sound unavailable:', e));
      } catch(e) { console.warn('Sound unavailable:', e); }
    }
    let busy = false;
    let unlock;
    const turn = direction => {
      if (busy) return;
      const i = flip.getCurrentPageIndex();
      if (direction > 0 && i >= urls.length - 1) return;
      if (direction < 0 && i <= 0) return;
      busy = true;
      // Closing the book occurs when turning onto the back cover,
      // or turning backward from the first inner spread onto the front cover.
      // In two-page mode the last open spread starts at N-3;
      // flipping from it closes the back cover at N-1.
      const coverTransition = (direction > 0 && (i === 0 || i >= urls.length - 3)) ||
                              (direction < 0 && (i <= 2 || i >= urls.length - 1));
      playSound(coverTransition);
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
