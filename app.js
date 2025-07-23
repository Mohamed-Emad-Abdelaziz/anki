/*****  app.js  *****/
const subjectSelect  = document.getElementById('subject-select');
const chapterSelect  = document.getElementById('chapter-select');
const statusEl       = document.getElementById('status');
const cardsContainer = document.getElementById('cards-container');

let subjects = {};   // { subject: { chapters:Set() } }

/* ---------- Helpers ---------- */
function updateDropdown(selectEl, items){
  selectEl.innerHTML = '';
  items.forEach(item=>{
    const opt = document.createElement('option');
    opt.textContent = item;
    opt.value = item;
    selectEl.appendChild(opt);
  });
}

/* ========= NEW: load lists from Sheets on page load ========= */
async function loadSubjectsFromSheets(){
  try{
    statusEl.textContent = 'Syncing…';
    const res   = await fetch(GOOGLE_SCRIPT_URL);   // GET كل البطاقات
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const cards = await res.json();

    // إعادة بناء هيكل subjects ← chapters
    subjects = {};
    cards.forEach(card=>{
      if(!subjects[card.subject]) subjects[card.subject] = {chapters:new Set()};
      subjects[card.subject].chapters.add(card.chapter);
    });

    updateDropdown(subjectSelect, Object.keys(subjects));
    subjectSelect.dispatchEvent(new Event('change'));
    statusEl.textContent = `Loaded ${cards.length} card(s)`;
  }catch(err){
    console.error(err);
    statusEl.textContent = '❌ '+err.message;
  }
}

/* —— استدعِ المزامنة أول ما الـ DOM يجهز —— */
window.addEventListener('DOMContentLoaded', loadSubjectsFromSheets);

/* ---------- Subjects ---------- */
document.getElementById('add-subject-btn').onclick = ()=>{
  const name = document.getElementById('new-subject').value.trim();
  if(!name) return;
  if(!subjects[name]) subjects[name] = {chapters:new Set()};
  updateDropdown(subjectSelect, Object.keys(subjects));
  document.getElementById('new-subject').value='';
  subjectSelect.value = name;
  subjectSelect.dispatchEvent(new Event('change'));
};
subjectSelect.onchange = ()=>{
  const chapList = subjects[subjectSelect.value]?.chapters || new Set();
  updateDropdown(chapterSelect, [...chapList]);
};

/* ---------- Chapters ---------- */
document.getElementById('add-chapter-btn').onclick = ()=>{
  const name = document.getElementById('new-chapter').value.trim();
  const subj = subjectSelect.value;
  if(!name || !subj) return alert('Select a subject first');
  subjects[subj].chapters.add(name);
  updateDropdown(chapterSelect, [...subjects[subj].chapters]);
  document.getElementById('new-chapter').value='';
  chapterSelect.value = name;
};

/* ---------- Save Card ---------- */
document.getElementById('save-card-btn').onclick = async ()=>{
  const subj  = subjectSelect.value;
  const chap  = chapterSelect.value;
  const front = document.getElementById('front').value.trim();
  const back  = document.getElementById('back').value.trim();
  if(!subj || !chap || !front || !back) return alert('Fill all fields');

  const payload = {subject:subj, chapter:chap, front, back};
  try{
    statusEl.textContent='Saving…';
    const res = await fetch(GOOGLE_SCRIPT_URL,{
      method : 'POST',
      headers: {'Content-Type':'text/plain;charset=utf-8'},
      body   : JSON.stringify(payload)
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    statusEl.textContent='✅ Saved!';
    document.getElementById('front').value='';
    document.getElementById('back').value ='';

    /* NEW: أعد المزامنة عشان القوائم تتحدث فورًا */
    loadSubjectsFromSheets();
  }catch(err){
    console.error(err);
    statusEl.textContent='❌ '+err.message;
  }
};

/* ---------- View Cards ---------- */
document.getElementById('view-cards-btn').onclick = async ()=>{
  const subj = subjectSelect.value;
  const chap = chapterSelect.value;
  if(!subj || !chap) return alert('اختر مادة ثم فصل');

  statusEl.textContent='Loading…';
  try{
    const url  = `${GOOGLE_SCRIPT_URL}?subject=${encodeURIComponent(subj)}&chapter=${encodeURIComponent(chap)}`;
    const res  = await fetch(url);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const cards = await res.json();

    cardsContainer.innerHTML='';
    cards.forEach(card=>{
      const cardEl = document.createElement('div');
      cardEl.className='card';
      cardEl.innerHTML=`
        <div class="inner">
          <div class="face front">${card.front}</div>
          <div class="face back">${card.back}</div>
        </div>`;
      cardEl.onclick = ()=>cardEl.classList.toggle('flipped');
      cardsContainer.appendChild(cardEl);
    });
    statusEl.textContent=`${cards.length} card(s) loaded`;
  }catch(err){
    console.error(err);
    statusEl.textContent='❌ '+err.message;
  }
};
