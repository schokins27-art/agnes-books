/* Add new books here. Each book has its own viewer configuration and spine image. */
const BOOKS = [
  {id:'tommy', title:'Book of Tommy', image:'assets/book-of-tommy-spine.webp', config:'books/tommy/book.json'}
];
const shelf = document.getElementById('shelf');
const opened = document.getElementById('opened');
const frame = document.getElementById('book-frame');
const back = document.getElementById('back-to-shelf');
let active = null;
function openBook(book) {
  active = book.id;
  shelf.hidden = true;
  opened.hidden = false;
  frame.src = 'viewer.html?book=' + encodeURIComponent(book.config);
  back.focus({preventScroll:true});
}
function closeBook() {
  if (!active) return;
  active = null;
  frame.src = 'about:blank';
  opened.hidden = true;
  shelf.hidden = false;
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
back.addEventListener('click',closeBook);
document.addEventListener('keydown',e => {
  if (e.key === 'Escape' && active) {e.preventDefault();closeBook();}
});
