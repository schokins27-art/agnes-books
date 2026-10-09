/* Add new books to this list; each has a shelf image, front cover and viewer configuration. */
const BOOKS=[{id:'tommy',title:'Book of Tommy',image:'assets/book-of-tommy-spine.webp',cover:'books/tommy/cover.webp',config:'books/tommy/book.json'}];
const library=document.getElementById('library');
const shelf=document.getElementById('shelf');
const opened=document.getElementById('opened');
const frame=document.getElementById('book-frame');
const flight=document.getElementById('flight');
const flyingCover=document.getElementById('flying-cover');
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let active=null,transitioning=false,animationTimer=null;
const motionTime=()=>reducedMotion.matches?0:1250;
function animateFlight(direction,book,done){
  clearTimeout(animationTimer);
  flyingCover.src=book.cover;
  flight.hidden=false;
  flight.className='';
  void flight.offsetWidth;
  flight.className=direction==='out'?'is-lifting':'is-returning';
  animationTimer=setTimeout(()=>{flight.className='';flight.hidden=true;done();},motionTime());
}
function openBook(book){
  if(active||transitioning)return;
  transitioning=true;active=book;
  library.classList.add('is-transitioning');
  frame.onload=()=>{
    frame.onload=null;
    animateFlight('out',book,()=>{
      shelf.hidden=true;
      library.classList.add('is-open');
      library.classList.remove('is-transitioning');
      transitioning=false;
    });
  };
  frame.src='viewer.html?book='+encodeURIComponent(book.config);
}
function closeBook(){
  if(!active||transitioning)return;
  transitioning=true;
  const book=active;
  library.classList.add('is-transitioning');
  library.classList.remove('is-open');
  shelf.hidden=false;
  animateFlight('back',book,()=>{
    frame.src='about:blank';
    active=null;
    transitioning=false;
    library.classList.remove('is-transitioning');
  });
}
for(const book of BOOKS){
  const button=document.createElement('button');button.className='spine';button.type='button';
  button.title='Открыть: '+book.title;button.setAttribute('aria-label','Открыть: '+book.title);
  const img=document.createElement('img');img.src=book.image;img.alt=book.title;img.draggable=false;
  button.append(img);button.addEventListener('click',()=>openBook(book));shelf.append(button);
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
  if(event.data?.type==='agnes:return-to-shelf')closeBook();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active&&!transitioning){e.preventDefault();closeBook();}});
