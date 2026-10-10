/* Add books here later: each book has its own spine image, cover and viewer config. */
const BOOKS=[
 {id:'maggie',title:'Book of Maggie',image:'assets/maggie-spine.webp',cover:'books/maggie/cover.webp',config:'books/maggie/book.json'},
 {id:'tommy',title:'Book of Tommy',image:'assets/tommy-spine.webp',cover:'books/tommy/cover.webp',config:'books/tommy/book.json'}
];
const library=document.getElementById('library');
const shelf=document.getElementById('shelf');
const opened=document.getElementById('opened');

const flight=document.getElementById('flight');
const flightSpine=document.getElementById('flight-spine');
const flightCover=document.getElementById('flight-cover');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let active=null,transitioning=false;
// Optional fullscreen: request during the original pointer gesture.
// If the embed denies fullscreen, the existing inline viewer still works.
let fullscreenRequested=false;
function requestBookFullscreen(){
  if(!library.requestFullscreen || document.fullscreenElement)return;
  try{
    const p=library.requestFullscreen({navigationUI:'hide'});
    fullscreenRequested=true;
    if(p?.catch)p.catch(err=>{
      fullscreenRequested=false;
      console.info('Fullscreen unavailable in this embed; using normal viewer.',err);
    });
  }catch(err){
    fullscreenRequested=false;
    console.info('Fullscreen unavailable; using normal viewer.',err);
  }
}
function leaveBookFullscreen(){
  if(document.fullscreenElement===library){
    const p=document.exitFullscreen();
    p?.catch?.(err=>console.warn('Fullscreen exit:',err));
  }
}
document.addEventListener('fullscreenchange',()=>{
  // Esc exits fullscreen directly. Restore the shelf instead of leaving a
  // small, already-open book inside the shelf-sized embed.
  if(!document.fullscreenElement && active && !transitioning && fullscreenRequested){
    fullscreenRequested=false;
    closeBook();
  }else if(!document.fullscreenElement)fullscreenRequested=false;
});


const DURATION=690;
// The former cover-open/close recording now belongs to shelf pickup/put-away.
const shelfSound=new Audio('sounds/book-closing.mp3?v=30');
const paperSound=new Audio('sounds/page-turn.mp3?v=71');
paperSound.preload='auto';paperSound.volume=.8;
shelfSound.preload='auto';shelfSound.volume=0.7;
function playShelfSound(){
  try {shelfSound.pause();shelfSound.currentTime=0;
    const result=shelfSound.play();result?.catch(()=>{});
  } catch(e) {console.warn('Shelf sound unavailable',e);}
}
const AudioContextType=window.AudioContext||window.webkitAudioContext;
let pageAudioContext=null,pageAudioBuffer=null;
const pageSoundBytes=fetch('sounds/page-turn.mp3?v=71',{cache:'no-store'})
  .then(r=>{if(!r.ok)throw Error('Page audio HTTP '+r.status);return r.arrayBuffer();})
  .catch(e=>{console.error('Page audio fetch:',e);return null;});
function unlockPaperSound(){
  if(!AudioContextType)return;
  if(!pageAudioContext)pageAudioContext=new AudioContextType();
  // This runs directly inside the shelf button click, while user activation is live.
  pageAudioContext.resume().catch(e=>console.warn('Audio resume:',e));
  pageSoundBytes.then(bytes=>bytes&&pageAudioContext.decodeAudioData(bytes))
    .then(buffer=>{if(buffer)pageAudioBuffer=buffer;})
    .catch(e=>console.error('Page audio decode:',e));
}
function playPaperSound(){
  if(pageAudioContext&&pageAudioBuffer){
    if(pageAudioContext.state==='suspended')pageAudioContext.resume().catch(()=>{});
    const node=pageAudioContext.createBufferSource();
    const gain=pageAudioContext.createGain();gain.gain.value=1;
    node.buffer=pageAudioBuffer;node.connect(gain);gain.connect(pageAudioContext.destination);
    node.start(0);
  }else{
    paperSound.pause();paperSound.currentTime=0;
    paperSound.play().catch(e=>console.warn('Page audio fallback:',e));
  }
}

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function preload(src){const img=new Image();img.src=src;return img.decode?.().catch(()=>{})||Promise.resolve();}
async function fly(direction,book){
  if(reducedMotion.matches)return;
  flightSpine.src=book.image;flightCover.src=book.cover;
  // Closed front cover is the RIGHT page of the two-page PageFlip layout.
  // Match the flight destination to that exact half, not the frame centre.
  const pageWidth=Math.max(100,Math.floor(Math.min(opened.clientWidth*.46,opened.clientHeight*.86*720/1020)));
  library.style.setProperty('--cover-destination-x',`${pageWidth/2}px`);
  flight.hidden=false;
  flight.className='';
  void flight.offsetWidth;
  flight.classList.add(direction==='out'?'flight-out':'flight-back');
  await delay(DURATION);
  // Keep the last animated frame visible until the actual viewer is ready.
}
function clearFlight(){flight.hidden=true;flight.className='';}
let flip=null, bookSheets=[], bookCount=0, busy=false, unlockTimer=null, queuedTurn=0;
let host=document.getElementById('flipbook');
const viewer=document.getElementById('viewer');
const error=document.getElementById('error');
async function createViewer(book){
  if(!window.St?.PageFlip)throw Error('Не загрузилась библиотека перелистывания PageFlip.');
  const response=await fetch(book.config,{cache:'no-store'});
  if(!response.ok)throw Error('Не найден файл книги: '+book.config);
  const cfg=await response.json();
  const names=[cfg.cover,...(cfg.pages||[]),cfg.back].filter(Boolean);
  if(names.length<4||names.length%2!==0)throw Error('Нужно чётное количество изображений, включая обложки.');
  const base=new URL('.',new URL(book.config,location.href));
  const urls=names.map(name=>new URL(name,base).href);
  await new Promise((resolve,reject)=>{
    const im=new Image();im.onload=resolve;im.onerror=()=>reject(Error('Не загрузилась обложка'));im.src=urls[0];
  });
  const w=Math.max(100,Math.floor(Math.min(opened.clientWidth*.46,opened.clientHeight*.86*720/1020)));
  const h=Math.round(w*1020/720);
  host.style.width=(w*2)+'px';host.style.height=h+'px';
  host.replaceChildren();
  bookSheets=urls.map((url,i)=>{
    const sheet=document.createElement('div');
    sheet.className='book-sheet'+((i===0||i===urls.length-1)?' book-cover':'');
    if(i===0||i===urls.length-1)sheet.dataset.density='hard';
    const img=document.createElement('img');img.decoding='sync';img.loading='eager';img.src=url;
    img.alt=i===0?'Передняя обложка':i===urls.length-1?'Задняя обложка':`Страница ${i}`;
    img.draggable=false;sheet.append(img);host.append(sheet);return sheet;
  });
  flip=new St.PageFlip(host,{
    width:w,height:h,size:'fixed',showCover:true,usePortrait:false,autoSize:false,
    drawShadow:true,maxShadowOpacity:.34,flippingTime:1050,mobileScrollSupport:false,
    showPageCorners:false,disableFlipByClick:true,startPage:0
  });
  flip.loadFromHTML(bookSheets);
  bookCount=urls.length;
  // Unlock on actual animation completion; do not silently lose a fast click.
  flip.on('changeState',e=>{
    if(e.data==='read'){
      clearTimeout(unlockTimer);unlockTimer=null;
      busy=false;
      if(queuedTurn && active && !transitioning){
        const direction=queuedTurn;queuedTurn=0;
        requestAnimationFrame(()=>turnPage(direction));
      }
    }
  });
}
function clearViewer(){
  clearTimeout(unlockTimer);unlockTimer=null;busy=false;queuedTurn=0;
  // PageFlip.destroy() changes its container DOM. Never reuse that container:
  // after the first book is closed, a second PageFlip can render into a detached node.
  if(flip){try{flip.destroy();}catch(e){console.warn('PageFlip cleanup:',e);}flip=null;}
  const fresh=document.createElement('div');
  fresh.id='flipbook';
  fresh.setAttribute('aria-label','Интерактивная книга');
  // Replace all leftover PageFlip wrappers, even if the old host was removed.
  for(const child of [...viewer.children]){
    if(child!==error)child.remove();
  }
  viewer.insertBefore(fresh,error);
  host=fresh;
  bookSheets=[];bookCount=0;
}
async function openBook(book){
  if(active||transitioning)return;
  active=book;transitioning=true;playShelfSound();unlockPaperSound();
  shelf.hidden=true;opened.hidden=false;error.hidden=true;
  // Ensure every opening starts from a pristine viewer after previous destroy.
  if(!viewer.contains(host))clearViewer();
  // Wait briefly for fullscreen sizing, so PageFlip uses the final large
  // viewport dimensions instead of the small shelf iframe dimensions.
  if(fullscreenRequested){
    await Promise.race([
      new Promise(resolve=>{
        if(document.fullscreenElement===library)return resolve();
        const onChange=()=>{document.removeEventListener('fullscreenchange',onChange);resolve();};
        document.addEventListener('fullscreenchange',onChange,{once:true});
        setTimeout(()=>{document.removeEventListener('fullscreenchange',onChange);resolve();},500);
      }),
      delay(550)
    ]);
  }
  const animation=fly('out',book);
  let loaded=false;
  try{await createViewer(book);loaded=true;}
  catch(e){error.hidden=false;error.textContent=e.message;console.error('Book viewer:',e);}
  await animation;
  clearFlight();
  if(!loaded){
    clearViewer();opened.hidden=true;shelf.hidden=false;active=null;transitioning=false;leaveBookFullscreen();return;
  }
  library.classList.add('is-open');transitioning=false;
}
async function closeBook(){
  if(!active||transitioning)return;
  transitioning=true;playShelfSound();
  const book=active;
  library.classList.remove('is-open');
  await fly('back',book);
  clearFlight();clearViewer();opened.hidden=true;shelf.hidden=false;
  active=null;transitioning=false;
  leaveBookFullscreen();
}
function turnPage(direction){
  if(!active||transitioning||!flip)return;
  if(busy){queuedTurn=direction;return;}
  const i=flip.getCurrentPageIndex();
  if(direction>0&&i>=bookCount-2)return;
  if(direction<0&&i<=0)return;
  busy=true;queuedTurn=0;playPaperSound();
  try{
    if(direction>0)flip.flipNext('bottom');else flip.flipPrev('bottom');
  }catch(err){busy=false;console.warn('Page turn:',err);return;}
  clearTimeout(unlockTimer);
  // Fallback if the library does not emit the completion event.
  unlockTimer=setTimeout(()=>{
    busy=false;unlockTimer=null;
    if(queuedTurn && active && !transitioning){
      const next=queuedTurn;queuedTurn=0;turnPage(next);
    }
  },1250);
}
function visibleBookHit(x,y){
  const r=host.getBoundingClientRect();
  if(x<r.left||x>r.right||y<r.top||y>r.bottom)return 'outside';
  const index=flip.getCurrentPageIndex();
  const half=(x-r.left)/r.width;
  if(index===0){return half<.45?'outside':'next';}
  if(index>=bookCount-2){return half>.55?'outside':'prev';}
  if(half<=.30)return 'prev';
  if(half>=.70)return 'next';
  return 'center';
}
function interactWithPage(e){
  if(!active||transitioning||!flip)return;
  const action=visibleBookHit(e.clientX,e.clientY);
  if(action==='outside'){e.preventDefault();closeBook();}
  else if(action==='next'||action==='prev'){e.preventDefault();turnPage(action==='next'?1:-1);}
}
// One window means the board's click reaches the actual viewer.
let lastPointer=0;
opened.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  lastPointer=Date.now();interactWithPage(e);
},true);
opened.addEventListener('click',e=>{
  if(Date.now()-lastPointer<550)return;
  interactWithPage(e);
},true);
let wheelSum=0;
opened.addEventListener('wheel',e=>{
  if(!active||transitioning)return;
  e.preventDefault();e.stopPropagation();
  wheelSum+=e.deltaY;
  if(Math.abs(wheelSum)>=45){const dir=Math.sign(wheelSum);wheelSum=0;turnPage(dir);}
},{passive:false});
document.addEventListener('keydown',e=>{
  if(!active||transitioning)return;
  if(e.key==='Escape')closeBook();
  else if(e.key==='ArrowRight')turnPage(1);
  else if(e.key==='ArrowLeft')turnPage(-1);
});
for(const book of BOOKS){
  const button=document.createElement('button');button.className='spine';button.type='button';
  button.title='Открыть: '+book.title;button.setAttribute('aria-label','Открыть: '+book.title);
  const img=document.createElement('img');img.src=book.image;img.alt=book.title;img.draggable=false;
  button.append(img);
  button.dataset.book=book.id;
  let handledAt=0;
  function activate(e){
    if(e.type==='pointerdown' && e.button!==0)return;
    if(e.type==='click' && Date.now()-handledAt<500)return;
    if(active||transitioning)return;
    handledAt=Date.now();
    e.preventDefault();e.stopPropagation();
    // Fullscreen API must be called before any await or animation.
    requestBookFullscreen();
    openBook(book);
  }
  button.addEventListener('pointerdown',activate);
  button.addEventListener('click',activate);
  shelf.append(button);
  preload(book.cover);
}
