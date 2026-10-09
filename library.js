/* Add books here later: each book has its own spine image, cover and viewer config. */
const BOOKS=[{id:'tommy',title:'Book of Tommy',image:'assets/book-of-tommy-spine.webp',cover:'books/tommy/cover.webp',config:'books/tommy/book.json'}];
const library=document.getElementById('library');
const shelf=document.getElementById('shelf');
const opened=document.getElementById('opened');
const frame=document.getElementById('book-frame');
const flight=document.getElementById('flight');
const flightSpine=document.getElementById('flight-spine');
const flightCover=document.getElementById('flight-cover');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let active=null,transitioning=false,readyResolve=null;
const DURATION=690;
// The former cover-open/close recording now belongs to shelf pickup/put-away.
const shelfSound=new Audio('sounds/book-closing.mp3?v=30');
const paperSound=new Audio('sounds/page-turn.mp3?v=52');
paperSound.preload='auto';paperSound.volume=.8;
shelfSound.preload='auto';shelfSound.volume=0.7;
function playShelfSound(){
  try {shelfSound.pause();shelfSound.currentTime=0;
    const result=shelfSound.play();result?.catch(()=>{});
  } catch(e) {console.warn('Shelf sound unavailable',e);}
}
// Decode the sound using one persistent context created on the shelf click.
let paperContext=null,paperBuffer=null,paperLoad=null;
function unlockPaperSound(){
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  if(!paperContext)paperContext=new AC();
  paperContext.resume().catch(e=>console.warn('Audio resume:',e));
  if(!paperLoad)paperLoad=fetch('sounds/page-turn.mp3?v=64',{cache:'no-store'})
    .then(r=>{if(!r.ok)throw Error('Page sound HTTP '+r.status);return r.arrayBuffer();})
    .then(bytes=>paperContext.decodeAudioData(bytes))
    .then(buffer=>{paperBuffer=buffer;})
    .catch(e=>console.error('Page sound decode:',e));
}
function playPaperSound(){
  if(paperContext&&paperBuffer){
    const source=paperContext.createBufferSource();
    const gain=paperContext.createGain();gain.gain.value=.85;
    source.buffer=paperBuffer;source.connect(gain);gain.connect(paperContext.destination);
    source.start();return;
  }
  paperSound.pause();paperSound.currentTime=0;
  paperSound.play().catch(e=>console.warn('Page sound fallback:',e));
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
async function openBook(book){
  if(active||transitioning)return;
  active=book;transitioning=true;viewerGeometry=null;viewerPage='front';
  unlockPaperSound();
  playShelfSound();
  // Immediately remove the shelf image and start the pickup animation.
  shelf.hidden=true;
  opened.hidden=false; // The iframe must be unhidden before revealing the viewer.
  let didResolve=false;
  const ready=new Promise(resolve=>{
    readyResolve=()=>{if(!didResolve){didResolve=true;resolve();}};
  });
  frame.src='viewer.html?book='+encodeURIComponent(book.config);
  frame.onerror=()=>console.error('Не удалось загрузить просмотрщик книги');
  // Flight and loading happen at the same time, not one after another.
  const animation=fly('out',book);
  // Never leave the user stuck behind the animated cover if the embedded
  // viewer is slow or fails to send its readiness event.
  await animation;
  await Promise.race([ready,delay(400)]);
  readyResolve=null;
  library.classList.add('is-open');
  clearFlight();
  transitioning=false;
}
async function closeBook(){
  if(!active||transitioning)return;
  transitioning=true;
  playShelfSound();
  const book=active;
  library.classList.remove('is-open');
  await fly('back',book);
  clearFlight();
  frame.src='about:blank';
  opened.hidden=true;
  shelf.hidden=false;
  active=null;transitioning=false;
}
for(const book of BOOKS){
  const button=document.createElement('button');button.className='spine';button.type='button';
  button.title='Открыть: '+book.title;button.setAttribute('aria-label','Открыть: '+book.title);
  const img=document.createElement('img');img.src=book.image;img.alt=book.title;img.draggable=false;
  button.append(img);button.addEventListener('click',()=>openBook(book));shelf.append(button);
  preload(book.cover);
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
  if(event.data?.type==='agnes:viewer-ready'){readyResolve?.();readyResolve=null;}
  if(event.data?.type==='agnes:page-turn')playPaperSound();
  if(event.data?.type==='agnes:viewer-error')console.error('Book viewer:',event.data.message);
  if(event.data?.type==='agnes:geometry'){viewerGeometry=event.data.geometry;layoutOutsideZones();}
  if(event.data?.type==='agnes:page-state'){viewerPage=event.data.state;layoutOutsideZones();}
  if(event.data?.type==='agnes:return-to-shelf')closeBook();
});
// The embedded viewer is an iframe. Transparent pixels in an iframe still
// capture clicks, and tldraw cannot forward board clicks into this iframe.
// Four hit regions on the parent document explicitly cover the empty margins.
let viewerGeometry=null;
let viewerPage='front';
const outsideZones=[];
for(let i=0;i<5;i++){
  const zone=document.createElement('div');
  zone.className='outside-book-zone';
  zone.setAttribute('aria-label','Убрать книгу на полку');
  zone.addEventListener('pointerdown',e=>{
    if(e.button!==0 || !active || transitioning)return;
    e.preventDefault();e.stopPropagation();closeBook();
  });
  opened.appendChild(zone);
  outsideZones.push(zone);
}
function layoutOutsideZones(){
  const width=opened.clientWidth, height=opened.clientHeight;
  if(!width||!height)return;
  // Match the viewer's exact fixed PageFlip size in script.js.
  const pageW=Math.max(100,Math.floor(Math.min(width*.46,height*.86*720/1020)));
  const bookW=viewerGeometry?.width??pageW*2;
  const bookH=viewerGeometry?.height??Math.round(pageW*1020/720);
  const safe=4;
  const x=(width-bookW)/2-safe,y=(height-bookH)/2-safe;
  const safeBookW=bookW+2*safe,safeBookH=bookH+2*safe;
  const regions=[
    [0,0,width,Math.max(0,y)],
    [0,y,Math.max(0,x),Math.max(0,safeBookH)],
    [x+safeBookW,y,Math.max(0,width-x-safeBookW),Math.max(0,safeBookH)],
    [0,y+safeBookH,width,Math.max(0,height-y-safeBookH)],
    // On the closed back cover, the left half is the cover itself.
    // The blank RIGHT half must return the book to the shelf.
    viewerPage==='back' ? [x+safe+bookW/2,y+safe,bookW/2-safe,bookH] : [0,0,0,0]
  ];
  outsideZones.forEach((zone,i)=>{
    const [left,top,w,h]=regions[i];
    Object.assign(zone.style,{left:left+'px',top:top+'px',width:w+'px',height:h+'px'});
  });
}
window.addEventListener('resize',layoutOutsideZones);
new ResizeObserver(layoutOutsideZones).observe(opened);
layoutOutsideZones();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active&&!transitioning){e.preventDefault();closeBook();}});
