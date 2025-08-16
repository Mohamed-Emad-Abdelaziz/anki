/***** app.js – نص + صور (قوي ومضمون) *****/
const $S  = id => document.getElementById(id);
const subjectSelect  = $S('subject-select');
const chapterSelect  = $S('chapter-select');
const statusEl       = $S('status');
const cardsContainer = $S('cards-container');

const addSubjectBtn  = $S('add-subject-btn');
const addChapterBtn  = $S('add-chapter-btn');

const frontEl = $S('front');
const backEl  = $S('back');
const saveCardBtn = $S('save-card-btn');

const imgFileEl   = $S('img-file');
const imgDefEl    = $S('img-def');
const saveImageBtn = $S('save-image-btn');

const viewCardsBtn  = $S('view-cards-btn');
const viewImagesBtn = $S('view-images-btn');

let subjects   = {};       // {subject:{chapters:Set()}}
let statusLock = false;

const tidy = x => (x ?? '').toString().trim();
const setStatus = msg => { if(!statusLock) statusEl.textContent = msg; };

function updateDropdown(selectEl, items){
  selectEl.innerHTML = '';
  items.forEach(item=>{
    const opt = document.createElement('option');
    opt.value = opt.textContent = item;
    selectEl.appendChild(opt);
  });
}
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function withParams(base, params = {}) {
  const u = new URL(base);
  Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, v));
  return u.toString();
}

/* ======== مزامنة المواد والفصول من السيرفر (Cards + Images) ======== */
async function syncFromSheets(){
  try{
    setStatus('Syncing…');
    const res = await fetch(withParams(GOOGLE_SCRIPT_URL, { type:'subjects' }));
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const { subjects: list, counts } = await res.json();

    subjects = {};
    list.forEach(item=>{
      subjects[item.name] = { chapters: new Set(item.chapters) };
    });

    updateDropdown(subjectSelect, Object.keys(subjects));
    subjectSelect.dispatchEvent(new Event('change'));
    setStatus(`Loaded subjects • cards:${counts.cards} • images:${counts.images}`);
  }catch(err){
    console.error(err);
    setStatus('❌ '+err.message);
  }
}
window.addEventListener('DOMContentLoaded', syncFromSheets);

/* ---------- إضافة مادة ---------- */
addSubjectBtn.onclick = ()=>{
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
addChapterBtn.onclick = ()=>{
  const name = tidy($S('new-chapter').value);
  const subj = tidy(subjectSelect.value);
  if(!name || !subj) return alert('Select a subject first');
  subjects[subj].chapters.add(name);
  updateDropdown(chapterSelect, [...subjects[subj].chapters]);
  $S('new-chapter').value='';
  chapterSelect.value = name;
};

/* ---------- حفظ بطاقة نصية ---------- */
saveCardBtn.onclick = async ()=>{
  const subj  = tidy(subjectSelect.value);
  const chap  = tidy(chapterSelect.value);
  const front = tidy(frontEl.value);
  const back  = tidy(backEl.value);
  if(!subj || !chap || !front || !back) return alert('Fill all fields');

  const payload = {subject:subj, chapter:chap, front, back};
  try{
    setStatus('Saving…');
    const res = await fetch(GOOGLE_SCRIPT_URL,{
      method :'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'}, // بدون preflight
      body   :JSON.stringify(payload)
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    setStatus('✅ Text card saved!');
    frontEl.value=''; backEl.value='';
    await syncFromSheets();
  }catch(err){
    console.error(err);
    setStatus('❌ '+err.message);
  }
};

/* ---------- رفع صورة (مسار Base64 مضمون) ---------- */
function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const m = s.match(/^data:(.+?);base64,(.+)$/);
      if(!m) return reject(new Error('Bad data URL'));
      resolve({ mime:m[1], base64:m[2] });
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

saveImageBtn.onclick = async ()=>{
  const subj   = tidy(subjectSelect.value);
  const chap   = tidy(chapterSelect.value);
  const def    = tidy(imgDefEl.value);
  const file   = imgFileEl.files?.[0];
  if(!subj || !chap) return alert('اختر مادة ثم فصل');
  if(!file) return alert('اختَر صورة');
  if(file.size > 8*1024*1024) return alert('يفضل صورة أقل من 8MB');

  try{
    setStatus('Uploading…');
    const { mime, base64 } = await fileToBase64(file);
    const payload = {
      type:'image64', subject:subj, chapter:chap, definition:def,
      fileName:file.name, mimeType:mime, data:base64
    };
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const out = await res.json();
    if(!out.ok) throw new Error(out.error||'Upload failed');

    setStatus('✅ Image uploaded!');
    imgFileEl.value=''; imgDefEl.value='';
    await syncFromSheets();
  }catch(err){
    console.error(err);
    setStatus('❌ '+err.message);
  }
};

/* ---------- روابط بديلة للصورة (Fallback) ---------- */
function imageUrlCandidates(it){
  const out = [];
  if (it.thumb) out.push(it.thumb);
  if (it.src)   out.push(it.src);
  if (it.id){
    out.push(`https://drive.google.com/thumbnail?id=${it.id}&sz=w1000`);
    out.push(`https://drive.google.com/uc?export=view&id=${it.id}`);
    out.push(`https://lh3.googleusercontent.com/d/${it.id}`);
  }
  return [...new Set(out.filter(Boolean))];
}

/* ---------- عرض الكروت النصية ---------- */
viewCardsBtn.onclick = async ()=>{
  const subj = tidy(subjectSelect.value);
  const chap = tidy(chapterSelect.value);
  if(!subj || !chap) return alert('اختر مادة ثم فصل');

  statusLock=true; setStatus('Loading text cards…');
  try{
    const url = withParams(GOOGLE_SCRIPT_URL, { type:'cards', subject:subj, chapter:chap });
    const res = await fetch(url);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const cards = await res.json();

    cardsContainer.innerHTML='';
    cards.forEach(card=>{
      const el = document.createElement('div');
      el.className='card';
      el.innerHTML = `
        <div class="inner">
          <div class="face front">${escapeHtml(card.front)}</div>
          <div class="face back">${escapeHtml(card.back)}</div>
        </div>`;
      el.onclick = ()=>el.classList.toggle('flipped');
      cardsContainer.appendChild(el);
    });
    setStatus(`${cards.length} text card(s) loaded`);
  }catch(err){
    console.error(err);
    setStatus('❌ '+err.message);
  }finally{ statusLock=false; }
};

/* ---------- عرض بطاقات الصور ---------- */
viewImagesBtn.onclick = async ()=>{
  const subj = tidy(subjectSelect.value);
  const chap = tidy(chapterSelect.value);
  if(!subj || !chap) return alert('اختر مادة ثم فصل');

  statusLock=true; setStatus('Loading image cards…');
  try{
    const url = withParams(GOOGLE_SCRIPT_URL, { type:'images', subject:subj, chapter:chap });
    const res = await fetch(url);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const imgs = await res.json();

    cardsContainer.innerHTML='';
    imgs.forEach(it=>{
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        <div class="inner">
          <div class="face front image">
            <img alt="${escapeHtml(it.definition||'Image')}" loading="lazy">
          </div>
          <div class="face back">${escapeHtml(it.definition||'')}</div>
        </div>`;

      const img = el.querySelector('img');
      const candidates = imageUrlCandidates(it);
      let i = 0;
      const tryNext = () => {
        if (i < candidates.length) img.src = candidates[i++]; else {
          el.querySelector('.face.front.image').innerHTML =
            `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;opacity:.7">Image not available</div>`;
        }
      };
      img.onerror = tryNext;
      tryNext();

      el.title = it.name || '';
      el.onclick   = ()=>el.classList.toggle('flipped');
      el.ondblclick= ()=> window.open(img.src,'_blank');
      cardsContainer.appendChild(el);
    });
    setStatus(`${imgs.length} image card(s) loaded`);
  }catch(err){
    console.error(err);
    setStatus('❌ '+err.message);
  }finally{ statusLock=false; }
};
