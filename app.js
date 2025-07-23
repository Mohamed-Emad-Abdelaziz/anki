/***** app.js – النسخة المنيعة ضد الأخطاء *****/
const $S  = id => document.getElementById(id);
const subjectSelect  = $S('subject-select');
const chapterSelect  = $S('chapter-select');
const statusEl       = $S('status');
const cardsContainer = $S('cards-container');

let subjects   = {};       // {subject:{chapters:Set()}}
let statusLock = false;    // يمنع العبث بـ #status أثناء تحميل الكروت

/* ---------- دالّة مساعدة: تنظيف القيمة ---------- */
function tidy(x){ return (x ?? '').toString().trim(); }

/* ---------- تحديث قائمة منسدلة ---------- */
function updateDropdown(selectEl, items){
  selectEl.innerHTML = '';
  items.forEach(item=>{
    const opt = document.createElement('option');
    opt.value = opt.textContent = item;
    selectEl.appendChild(opt);
  });
}

/* ---------- كتابة حالة (مع احترام القفل) ---------- */
const setStatus = msg => { if(!statusLock) statusEl.textContent = msg; };

/* ========== مزامنة أولية من Sheets ========== */
async function syncFromSheets(){
  try{
    setStatus('Syncing…');
    const res   = await fetch(GOOGLE_SCRIPT_URL);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const cards = await res.json();

    subjects = {};
    cards.forEach(card=>{
      const s = tidy(card.subject);
      const c = tidy(card.chapter);
      if(!s || !c) return;                    // تجاهل الصفوف الناقصة
      if(!subjects[s]) subjects[s] = {chapters:new Set()};
      subjects[s].chapters.add(c);
    });

    updateDropdown(subjectSelect, Object.keys(subjects));
    subjectSelect.dispatchEvent(new Event('change'));
    setStatus(`Loaded ${cards.length} total card(s)`);
  }catch(err){
    console.error(err);
    setStatus('❌ '+err.message);
  }
}
window.addEventListener('DOMContentLoaded', syncFromSheets);

/* ---------- إضافة مادة ---------- */
$S('add-subject-btn').onclick = ()=>{
  const name = tidy($S('new-subject').value);
  if(!name) return;
  if(!subjects[name]) subjects[name] = {chapters:new Set()};
  updateDropdown(subjectSelect, Object.keys(subjects));
  $S('new-subject').value='';
  subjectSelect.value = name;
  subjectSelect.dispatchEvent(new Event('change'));
};
subjectSelect.onchange = ()=>{
  const list = subjects[subjectSelect.value]?.chapters || new Set();
  updateDropdown(chapterSelect, [...list]);
};

/* ---------- إضافة فصل ---------- */
$S('add-chapter-btn').onclick = ()=>{
  const name = tidy($S('new-chapter').value);
  const subj = tidy(subjectSelect.value);
  if(!name || !subj) return alert('Select a subject first');
  subjects[subj].chapters.add(name);
  updateDropdown(chapterSelect, [...subjects[subj].chapters]);
  $S('new-chapter').value='';
  chapterSelect.value = name;
};

/* ---------- حفظ بطاقة ---------- */
$S('save-card-btn').onclick = async ()=>{
  const subj  = tidy(subjectSelect.value);
  const chap  = tidy(chapterSelect.value);
  const front = tidy($S('front').value);
  const back  = tidy($S('back').value);
  if(!subj || !chap || !front || !back) return alert('Fill all fields');

  const payload = {subject:subj, chapter:chap, front, back};
  try{
    setStatus('Saving…');
    const res = await fetch(GOOGLE_SCRIPT_URL,{
      method :'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body   :JSON.stringify(payload)
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    setStatus('✅ Saved!');
    $S('front').value=''; $S('back').value='';
    await syncFromSheets();              // تحدّث القوائم فورًا
  }catch(err){
    console.error(err);
    setStatus('❌ '+err.message);
  }
};

/* ---------- عرض البطاقات ---------- */
$S('view-cards-btn').onclick = async ()=>{
  const subj = tidy(subjectSelect.value);
  const chap = tidy(chapterSelect.value);
  if(!subj || !chap) return alert('اختر مادة ثم فصل');

  statusLock=true; setStatus('Loading…');
  try{
    const url = `${GOOGLE_SCRIPT_URL}?subject=${encodeURIComponent(subj)}&chapter=${encodeURIComponent(chap)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const cards = await res.json();

    cardsContainer.innerHTML='';
    cards.forEach(card=>{
      const el = document.createElement('div');
      el.className='card';
      el.innerHTML=`
        <div class="inner">
          <div class="face front">${card.front}</div>
          <div class="face back">${card.back}</div>
        </div>`;
      el.onclick = ()=>el.classList.toggle('flipped');
      cardsContainer.appendChild(el);
    });
    setStatus(`${cards.length} card(s) loaded`);
  }catch(err){
    console.error(err);
    setStatus('❌ '+err.message);
  }finally{
    statusLock=false;
  }
};
