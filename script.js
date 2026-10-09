/* Real page flipping with StPageFlip. Each image is ONE page, never a full spread. */
(async()=>{
 const $=id=>document.getElementById(id), el=$('flipbook'),prev=$('prev'),next=$('next'),error=$('error');
 try{
  if(!window.St || !St.PageFlip)throw Error('Не загрузилась библиотека перелистывания. Проверь подключение к интернету.');
  const path=new URLSearchParams(location.search).get('book')||'books/tommy/book.json';
  const res=await fetch(path,{cache:'no-cache'});if(!res.ok)throw Error('Не найден '+path);
  const cfg=await res.json();const base=new URL('.',new URL(path,location.href));
  const files=[cfg.cover,...cfg.pages,cfg.back].filter(Boolean);
  if(files.length%2!==0)throw Error('Для книги с двумя обложками нужно чётное число страниц.');
  const preload=files.map(f=>{const img=new Image();img.src=new URL(f,base).href;return img.decode().catch(()=>{});});
  await Promise.all(preload);
  files.forEach((f,i)=>{const page=document.createElement('div');page.className='page'+((i===0||i===files.length-1)?' hard':'');
   if(i===0||i===files.length-1)page.dataset.density='hard';
   const img=document.createElement('img');img.src=new URL(f,base).href;img.alt=i===0?'Передняя обложка':i===files.length-1?'Задняя обложка':'Страница '+i;img.draggable=false;
   page.append(img);el.append(page);
  });
  const flip=new St.PageFlip(el,{width:900,height:1275,size:'stretch',minWidth:230,maxWidth:900,minHeight:325,maxHeight:1275,showCover:true,drawShadow:true,maxShadowOpacity:0.45,flippingTime:1100,usePortrait:false,startPage:0,autoSize:true,mobileScrollSupport:false,clickEventForward:false,swipeDistance:35,showPageCorners:false,disableFlipByClick:true});
  flip.loadFromHTML(el.querySelectorAll('.page'));
  const sync=()=>{const i=flip.getCurrentPageIndex();prev.disabled=i===0;next.disabled=i===files.length-1};
  flip.on('flip',sync);flip.on('init',sync);sync();
  prev.onclick=()=>flip.flipPrev('bottom');next.onclick=()=>flip.flipNext('bottom');
  el.addEventListener('click',e=>{if(e.target.closest('.page') && flip.getCurrentPageIndex()===0)flip.flipNext('bottom')});
  document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')flip.flipNext('bottom');if(e.key==='ArrowLeft')flip.flipPrev('bottom')});
 }catch(e){error.hidden=false;error.textContent=e.message;console.error(e)}
})();