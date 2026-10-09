/* Reusable flipbook: configure books/tommy/book.json or ?book=books/eric/book.json */
(async () => {
 const $=id=>document.getElementById(id), book=$('book'), single=$('singleImage'),left=$('leftImage'),right=$('rightImage'),prev=$('prev'),next=$('next'),error=$('error');
 try {
  const path=new URLSearchParams(location.search).get('book')||'books/tommy/book.json';
  const r=await fetch(path);if(!r.ok)throw Error('Не найден файл '+path);
  const c=await r.json(),base=new URL('.',new URL(path,location.href)),src=p=>p?new URL(p,base).href:'';
  const states=[{type:'cover',image:c.cover}];for(let i=0;i<c.pages.length;i+=2)states.push({type:'spread',left:c.pages[i],right:c.pages[i+1]||null});if(c.back)states.push({type:'back',image:c.back});
  let index=c.startClosed===false?1:0,busy=false;
  function draw(){const s=states[index];book.classList.toggle('closed',s.type!=='spread');if(s.type==='spread'){left.src=src(s.left);right.src=src(s.right);right.style.visibility=s.right?'visible':'hidden'}else{single.src=src(s.image)}prev.disabled=index===0;next.disabled=index===states.length-1;}
  function turn(direction){if(busy||index+direction<0||index+direction>=states.length)return;busy=true;const old=states[index],upcoming=states[index+direction];
   if(old.type!=='spread'||upcoming.type!=='spread'){book.classList.add('soft-turn');setTimeout(()=>{index+=direction;draw()},175);setTimeout(()=>{book.classList.remove('soft-turn');busy=false},430);return;}
   const outgoing=direction>0?right:left, incoming=direction>0?left:right;
   const clone=outgoing.cloneNode(true);clone.className='turning-page '+(direction>0?'forward':'backward');book.querySelector('.spread').appendChild(clone);
   // update underlying spread halfway through animation
   setTimeout(()=>{index+=direction;draw()},290);
   setTimeout(()=>{clone.remove();busy=false},660);
  }
  prev.onclick=()=>turn(-1);next.onclick=()=>turn(1);
  document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')turn(1);if(e.key==='ArrowLeft')turn(-1)});
  let start=null;book.addEventListener('pointerdown',e=>start=e.clientX);book.addEventListener('pointerup',e=>{if(start!==null&&Math.abs(e.clientX-start)>55)turn(e.clientX<start?1:-1);start=null});
  draw();
 }catch(e){error.hidden=false;error.textContent=e.message;console.error(e)}
})();
