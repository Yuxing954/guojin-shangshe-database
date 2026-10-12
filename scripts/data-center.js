(function(){
  'use strict';
  const browse=document.getElementById('center-browse'),notes=document.getElementById('center-notes');
  const browseLink=document.getElementById('center-browse-link'),notesLink=document.getElementById('center-notes-link');
  let lastModule='#dutyfree';
  function render(){
    const hash=location.hash,showNotes=hash!==''&&hash!=='#browse';
    if(showNotes)lastModule=hash;
    browse.hidden=showNotes;notes.hidden=!showNotes;notesLink.href=lastModule;
    browseLink.toggleAttribute('aria-current',!showNotes);notesLink.toggleAttribute('aria-current',showNotes);
    if(!showNotes)browseLink.setAttribute('aria-current','page');else notesLink.setAttribute('aria-current','page');
  }
  addEventListener('hashchange',render);render();
})();
