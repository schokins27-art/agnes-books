/* Add books here later: each book has its own spine image, cover and viewer config. */
const BOOKS=[
 {id:'maggie',title:'Book of Maggie',image:'assets/maggie-spine.webp',cover:'books/maggie/cover.webp',config:'books/maggie/book.json'},
 {id:'tommy',title:'Book of Tommy',image:'assets/tommy-spine.webp',cover:'books/tommy/cover.webp',config:'books/tommy/book.json'}
];
const library=document.getElementById('library');
const shelf=document.getElementById('shelf');
const opened=document.getElementById('opened');
const frame=document.getElementById('book-frame');
const flight=document.getElementById('flight');
const flightSpine=document.getElementById('flight-spine');
const flightCover=document.getElementById('flight-cover');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let active=null,transitioning=false,readyResolve=null;
let viewerSession=0;
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
async function openBook(book){
  if(active||transitioning)return;
  active=book;transitioning=true;viewerGeometry=null;viewerPage='front';viewerCoverRect=null;
  playShelfSound();
  // Immediately remove the shelf image and start the pickup animation.
  shelf.hidden=true;
  opened.hidden=false; // The iframe must be unhidden before revealing the viewer.
  let didResolve=false;
  const ready=new Promise(resolve=>{
    readyResolve=()=>{if(!didResolve){didResolve=true;resolve();}};
  });
  frame.src='viewer.html?book='+encodeURIComponent(book.config)+'&v=77&session='+(++viewerSession);
  frame.onerror=()=>console.error('Не удалось загрузить просмотрщик книги');
  // Flight and loading happen at the same time, not one after another.
  const animation=fly('out',book);
  // Wait for actual PageFlip initialization; a fixed 400 ms wait could
  // expose a blank iframe and accumulate broken sessions.
  const loaded=await Promise.race([ready.then(()=>true),delay(8000).then(()=>false)]);
  await animation;
  readyResolve=null;
  if(!loaded){
    console.error('Book viewer did not initialize in time');
    clearFlight();library.classList.remove('is-open');
    frame.removeAttribute('src');opened.hidden=true;shelf.hidden=false;
    active=null;transitioning=false;
    return;
  }
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
  frame.removeAttribute('src');
  opened.hidden=true;
  shelf.hidden=false;
  active=null;transitioning=false;
}
for(const book of BOOKS){
  const button=document.createElement('button');button.className='spine';button.type='button';
  button.title='Открыть: '+book.title;button.setAttribute('aria-label','Открыть: '+book.title);
  const img=document.createElement('img');img.src=book.image;img.alt=book.title;img.draggable=false;
  button.append(img);
  // Pixel-accurate clicks: transparent areas of the upper book do not
  // steal clicks from the lower book.
  const hitCanvas=document.createElement('canvas');const hitCtx=hitCanvas.getContext('2d',{willReadFrequently:true});
  img.addEventListener('load',()=>{hitCanvas.width=img.naturalWidth;hitCanvas.height=img.naturalHeight;hitCtx.drawImage(img,0,0);});
  // Use the standard click event: embedded boards may forward a click
  // without forwarding the original pointerdown event.
  button.addEventListener('click',e=>{
    if(e.button !== 0 && e.detail !== 0)return;
    const rect=img.getBoundingClientRect();
    if(!rect.width || !rect.height)return;
    const x=Math.floor((e.clientX-rect.left)/rect.width*hitCanvas.width);
    const y=Math.floor((e.clientY-rect.top)/rect.height*hitCanvas.height);
    // Keyboard activation (Enter/Space) has detail=0 and no reliable pointer coordinates.
    if(e.detail===0){openBook(book);return;}
    if(!hitCanvas.width||!hitCanvas.height){openBook(book);return;}
    if(x<0||y<0||x>=hitCanvas.width||y>=hitCanvas.height)return;
    let alpha=255;
    try{alpha=hitCtx.getImageData(x,y,1,1).data[3];}
    catch(err){console.warn('Spine alpha lookup unavailable',err);}
    if(alpha<35){
      // A transparent part of Tommy's image may sit over Maggie's visible spine.
      for(const other of [...shelf.querySelectorAll('.spine')].reverse()){
        if(other===button)continue;
        const otherImg=other.querySelector('img');
        const r=otherImg.getBoundingClientRect();
        if(e.clientX<r.left||e.clientX>=r.right||e.clientY<r.top||e.clientY>=r.bottom)continue;
        const canvas=other._hitCanvas;
        if(!canvas?.width||!canvas?.height)continue;
        const px=Math.floor((e.clientX-r.left)/r.width*canvas.width);
        const py=Math.floor((e.clientY-r.top)/r.height*canvas.height);
        if(px<0||py<0||px>=canvas.width||py>=canvas.height)continue;
        try{
          if(other._hitCtx.getImageData(px,py,1,1).data[3]>=35){
            e.preventDefault();openBook(BOOKS.find(b=>b.id===other.dataset.book));return;
          }
        }catch(err){console.warn('Lower spine alpha lookup unavailable',err);}
      }
      return;
    }
    e.preventDefault();openBook(book);
  });
  button.dataset.book=book.id;button._hitCanvas=hitCanvas;button._hitCtx=hitCtx;
  shelf.append(button);
  preload(book.cover);
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
  if(event.data?.type==='agnes:viewer-ready'){readyResolve?.();readyResolve=null;}
  // Page-turn audio is played directly by the viewer during wheel/click.
  if(event.data?.type==='agnes:viewer-error')console.error('Book viewer:',event.data.message);
  if(event.data?.type==='agnes:geometry'){viewerGeometry=event.data.geometry;layoutOutsideZones();}
  if(event.data?.type==='agnes:page-state'){viewerPage=event.data.state;viewerTurning=false;layoutOutsideZones();}
  if(event.data?.type==='agnes:turn-start'){viewerTurning=true;layoutOutsideZones();}

  if(event.data?.type==='agnes:return-to-shelf')closeBook();
});
// The embedded viewer is an iframe. Transparent pixels in an iframe still
// capture clicks, and tldraw cannot forward board clicks into this iframe.
// Four hit regions on the parent document explicitly cover the empty margins.
let viewerGeometry=null;
let viewerPage='front';
let viewerTurning=false;
let viewerCoverRect=null;
const outsideZones=[];
for(let i=0;i<4;i++){
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
  // Never place a parent overlay on either page. The viewer itself
  // handles empty halves when a cover is closed.
  const regions=[
    [0,0,width,Math.max(0,y)],
    [0,y,Math.max(0,x),Math.max(0,safeBookH)],
    [x+safeBookW,y,Math.max(0,width-x-safeBookW),Math.max(0,safeBookH)],
    [0,y+safeBookH,width,Math.max(0,height-y-safeBookH)]
  ];
  outsideZones.forEach((zone,i)=>{
    const [left,top,w,h]=regions[i];
    Object.assign(zone.style,{left:left+'px',top:top+'px',width:w+'px',height:h+'px'});
  });
}
// tldraw can deliver clicks to the library iframe but not to the nested
// viewer iframe. An invisible interaction layer in the library document
// forwards click and wheel events to the viewer without moving the books.
const pageInputLayer=document.createElement('div');
pageInputLayer.setAttribute('aria-label','Листать книгу: нажмите на край страницы');
Object.assign(pageInputLayer.style,{
  position:'absolute',inset:'0',zIndex:'3',background:'transparent',
  cursor:'pointer',touchAction:'manipulation'
});
opened.appendChild(pageInputLayer);
pageInputLayer.addEventListener('click',e=>{
  if(!active||transitioning)return;
  const width=opened.clientWidth,height=opened.clientHeight;
  const pageW=Math.max(100,Math.floor(Math.min(width*.46,height*.86*720/1020)));
  const bookW=viewerGeometry?.width??pageW*2;
  const bookH=viewerGeometry?.height??Math.round(pageW*1020/720);
  const left=(width-bookW)/2,top=(height-bookH)/2;
  const x=e.clientX-opened.getBoundingClientRect().left;
  const y=e.clientY-opened.getBoundingClientRect().top;
  if(x<left||x>left+bookW||y<top||y>top+bookH)return;
  frame.contentWindow?.postMessage({type:'agnes:input-click',x:(x-left)/bookW},location.origin);
});
let forwardedWheel=0;
pageInputLayer.addEventListener('wheel',e=>{
  if(!active||transitioning)return;
  e.preventDefault();e.stopPropagation();
  forwardedWheel+=e.deltaY;
  if(Math.abs(forwardedWheel)>=45){
    frame.contentWindow?.postMessage({type:'agnes:input-wheel',delta:forwardedWheel},location.origin);
    forwardedWheel=0;
  }
},{passive:false});
window.addEventListener('resize',layoutOutsideZones);
new ResizeObserver(layoutOutsideZones).observe(opened);
layoutOutsideZones();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active&&!transitioning){e.preventDefault();closeBook();}});
