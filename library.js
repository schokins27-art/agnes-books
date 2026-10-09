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
const shelfSound=new Audio('sounds/book-closing.mp3?v=10');
shelfSound.preload='auto';shelfSound.volume=0.7;
function playShelfSound(){
  try {shelfSound.pause();shelfSound.currentTime=0;
    const result=shelfSound.play();result?.catch(()=>{});
  } catch(e) {console.warn('Shelf sound unavailable',e);}
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function preload(src){const img=new Image();img.src=src;return img.decode?.().catch(()=>{})||Promise.resolve();}
async function fly(direction,book){
  if(reducedMotion.matches)return;
  flightSpine.src=book.image;flightCover.src=book.cover;
  flight.hidden=false;
  flight.className='';
  void flight.offsetWidth;
  flight.classList.add(direction==='out'?'flight-out':'flight-back');
  await delay(DURATION);
  flight.hidden=true;flight.className='';
}
async function openBook(book){
  if(active||transitioning)return;
  active=book;transitioning=true;
  playShelfSound();
  // Prepare the actual book behind the animation. Do not reveal it before ready.
  opened.hidden=false;
  const ready=new Promise(resolve=>{readyResolve=resolve;});
  frame.src='viewer.html?book='+encodeURIComponent(book.config);
  await Promise.race([ready,delay(10000)]);
  // The original shelf book is hidden BEFORE the flight begins: never two books.
  shelf.hidden=true;
  await fly('out',book);
  library.classList.add('is-open');
  transitioning=false;
}
async function closeBook(){
  if(!active||transitioning)return;
  transitioning=true;
  playShelfSound();
  const book=active;
  library.classList.remove('is-open');
  await fly('back',book);
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
  if(event.data?.type==='agnes:return-to-shelf')closeBook();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active&&!transitioning){e.preventDefault();closeBook();}});
