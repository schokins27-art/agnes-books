/* Universal book viewer. Set ?book=books/tommy/book.json in the embed URL. */
(async function () {
  const params = new URLSearchParams(location.search);
  const configPath = params.get('book') || 'books/tommy/book.json';
  const bookEl = document.getElementById('book');
  const single = document.getElementById('singleImage');
  const left = document.getElementById('leftImage');
  const right = document.getElementById('rightImage');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const error = document.getElementById('error');
  try {
    const response = await fetch(configPath);
    if (!response.ok) throw new Error('Не найден book.json (' + response.status + ')');
    const config = await response.json();
    const base = new URL('.', new URL(configPath, location.href));
    const url = name => name ? new URL(name, base).href : '';
    const pages = config.pages || [];
    if (!config.cover || !pages.length) throw new Error('Укажите cover и pages в book.json');
    const states = [{type:'cover',image:config.cover}];
    for (let i=0;i<pages.length;i+=2) states.push({type:'spread',left:pages[i],right:pages[i+1]||null});
    if (config.back) states.push({type:'back',image:config.back});
    let current = config.startClosed === false ? 1 : 0;
    current = Math.min(current, states.length-1);
    function render(){
      const state=states[current];
      bookEl.classList.toggle('closed',state.type!=='spread');
      if(state.type==='spread'){
        left.src=url(state.left); left.style.visibility='visible';
        if(state.right){right.src=url(state.right);right.style.visibility='visible'}
        else {right.removeAttribute('src');right.style.visibility='hidden'}
      }else{single.src=url(state.image);single.alt=state.type==='cover'?'Обложка':'Задняя обложка'}
      prev.disabled=current===0;next.disabled=current===states.length-1;
    }
    prev.addEventListener('click',()=>{if(current>0){current--;render()}});
    next.addEventListener('click',()=>{if(current<states.length-1){current++;render()}});
    document.addEventListener('keydown',event=>{
      if(event.key==='ArrowLeft')prev.click();
      if(event.key==='ArrowRight')next.click();
    });
    let startX=null;
    bookEl.addEventListener('touchstart',e=>{startX=e.touches[0]?.clientX??null},{passive:true});
    bookEl.addEventListener('touchend',e=>{if(startX===null)return;const delta=e.changedTouches[0].clientX-startX;if(Math.abs(delta)>50)(delta<0?next:prev).click();startX=null},{passive:true});
    render();
  } catch(e){error.hidden=false;error.textContent='Не удалось загрузить книгу: '+e.message;console.error(e)}
})();
