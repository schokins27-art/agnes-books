/* Add books here. Each book has its own spine image and viewer configuration. */
const BOOKS = [
  {id:'tommy', title:'Book of Tommy', image:'assets/book-of-tommy-spine.webp', config:'books/tommy/book.json'}
];
const library = document.getElementById('library');
const shelf = document.getElementById('shelf');
const opened = document.getElementById('opened');
const frame = document.getElementById('book-frame');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let active = null;
let transitionTimer = null;
let transitionToken = 0;
const duration = () => reducedMotion.matches ? 0 : 850;
function clearPending() { clearTimeout(transitionTimer); transitionToken++; }
function openBook(book) {
  if (active) return;
  clearPending();
  const token = transitionToken;
  active = book.id;
  // Keep shelf visible until the book viewer is ready, avoiding an empty flash.
  frame.onload = () => {
    if (token !== transitionToken || !active) return;
    opened.hidden = false;
    // Commit starting styles before triggering the lift and crossfade.
    void opened.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== transitionToken || !active) return;
      library.className = 'is-opening';
      transitionTimer = setTimeout(() => {
        if (token !== transitionToken) return;
        library.className = 'is-open';
        shelf.hidden = true;
      }, duration());
    }));
  };
  frame.src = 'viewer.html?book=' + encodeURIComponent(book.config);
}
function closeBook() {
  if (!active) return;
  clearPending();
  const token = transitionToken;
  frame.onload = null;
  shelf.hidden = false;
  library.className = 'is-open';
  void shelf.offsetWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (token !== transitionToken) return;
    library.className = 'is-closing';
    transitionTimer = setTimeout(() => {
      if (token !== transitionToken) return;
      frame.src = 'about:blank';
      opened.hidden = true;
      library.className = '';
      active = null;
    }, duration());
  }));
}
for (const book of BOOKS) {
  const button = document.createElement('button');
  button.className = 'spine';
  button.type = 'button';
  button.title = 'Открыть: ' + book.title;
  button.setAttribute('aria-label','Открыть: ' + book.title);
  const img = document.createElement('img');
  img.src = book.image;
  img.alt = book.title;
  img.draggable = false;
  button.append(img);
  button.addEventListener('click',() => openBook(book));
  shelf.append(button);
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  if (event.data?.type === 'agnes:return-to-shelf' && active) closeBook();
});
document.addEventListener('keydown',e => {
  if (e.key === 'Escape' && active) {e.preventDefault();closeBook();}
});
