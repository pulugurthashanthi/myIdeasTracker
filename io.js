// Paste/import and per-board export, in one plain-text format:
//   Board title            (first line, when importing as a new board)
//   Category:              (a line ending in ":" starts a card; the lines under it are its details)
//   - point
//                          (a blank line also starts a new card)
// Text with no blank lines and no "Category:" lines keeps the old rule: one card per line,
// "title | details". Loaded after the main script, so it wraps openForm and the Save button.
(function(){
  const NEW='__new';

  function parseCards(lines){
    const blocky=lines.some(l=>!l.trim())||lines.some(l=>/:\s*$/.test(l.trim()));
    if(!blocky)return lines.map(l=>l.trim()).filter(Boolean).map(l=>{const [t,...r]=l.split('|');return{title:t.trim(),description:r.join('\n').trim()}});
    const cards=[];let cur=null;
    for(const raw of lines){
      const l=raw.trim();
      if(!l){cur=null;continue}
      if(/:\s*$/.test(l)||!cur){cur={title:l.replace(/^[-•*]\s*/,'').replace(/:\s*$/,''),description:[]};cards.push(cur);continue}
      cur.description.push(l);
    }
    return cards.map(c=>({title:c.title||'Untitled card',description:c.description.join('\n')}));
  }

  function doImport(){
    const lines=$('#importText').value.split(/\r?\n/);
    let topicId=$('#importTopic').value;
    if(topicId===NEW){
      while(lines.length&&!lines[0].trim())lines.shift();
      const title=(lines.shift()||'').trim();
      if(!title)return;
      topicId='t'+Date.now();
      state.topics.push({id:topicId,title});
    }
    const cards=parseCards(lines).map((c,n)=>({id:'i'+Date.now()+n+Math.random().toString(36).slice(2,6),title:c.title,description:c.description,topicId,status:'planned',completedAt:null,updates:[]}));
    state.ideas.unshift(...cards);
    persist();renderHome();closeForm();
    toast(`${cards.length} card${cards.length===1?'':'s'} imported`);
    openProject(topicId);
  }

  const baseOpenForm=openForm;
  openForm=function(mode,topicId){
    baseOpenForm(mode,topicId);
    if(mode!=='import')return;
    const sel=$('#importTopic'),opt=document.createElement('option');
    opt.value=NEW;opt.textContent='＋ New board (first line is its title)';
    sel.prepend(opt);sel.value=NEW;
    $('#importForm .help').textContent='First line: board title. A line ending in ":" starts a card, and the lines under it become its details. A blank line also starts a new card.';
    $('#importText').placeholder='Vedic Bells\nFeedback:\n- alarm too quiet\n- add Hora\nUI:\n- bigger buttons';
  };

  const baseSave=$('#saveBtn').onclick;
  $('#saveBtn').onclick=()=>{if(formMode==='import')doImport();else baseSave()};

  // Export just the open board, in the same format, so it can be imported again.
  const exp=document.createElement('button');
  exp.className='btn';exp.id='exportBoardBtn';exp.textContent='⇩ Export';
  $('#shareProjectBtn').before(exp);
  exp.onclick=()=>{
    const t=state.topics.find(x=>x.id===selectedTopic);
    if(!t)return;
    const cards=state.ideas.filter(i=>i.topicId===t.id);
    const text=[t.title,'',...cards.flatMap(c=>[c.title+':',...(c.description||'').split('\n').filter(Boolean),''])].join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));
    a.download=t.title.replace(/[^\w\- ]+/g,'').trim()+'.txt';
    a.click();URL.revokeObjectURL(a.href);
    toast('Board exported');
  };
})();
