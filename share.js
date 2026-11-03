// Share dialog: the board owner adds or removes people by Gmail address.
// Uses window.cloudShare from cloud.js. Loaded after the main script, so it can wrap
// renderHome and replace shareProject (old #project= links only use readSharedProject).
(function(){
  const css=document.createElement('style');
  css.textContent=`
.people-badge{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;background:#ffffffcc;border:1px solid #0000001a;font-size:12px;font-weight:600;color:#3b4740;white-space:nowrap}
.member-list{list-style:none;margin:10px 0;padding:0;display:grid;gap:6px}
.member-list li{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:10px;background:#f4f6f8;word-break:break-all}
.member-list .role{font-size:12px;font-weight:600;color:#6b5bd2}
.member-list button{min-width:40px;min-height:40px;border:0;border-radius:10px;background:#fde2e1;color:#9b2c2c;font-size:18px;cursor:pointer}
.share-add{display:flex;gap:8px;margin-top:8px}
.share-add input{flex:1;min-height:40px}
.share-add button{min-height:40px}
.share-error{color:#b42318;font-size:13px;min-height:18px;margin:6px 0 0}`;
  document.head.append(css);

  const shade=document.createElement('div');
  shade.className='shade';shade.id='shareShade';
  shade.innerHTML=`<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="shareTitle">
<h2 id="shareTitle">Share</h2><p class="help" id="shareNote"></p>
<ul class="member-list" id="shareMembers"></ul>
<div id="shareAddRow"><label for="shareEmail">Add by Gmail</label>
<div class="share-add"><input id="shareEmail" type="email" inputmode="email" autocomplete="off" placeholder="name@gmail.com"><button class="btn primary" id="shareAddBtn">Add</button></div></div>
<p class="share-error" id="shareError" role="alert"></p>
<div style="display:flex;justify-content:space-between;gap:8px;margin-top:8px"><button class="btn" id="shareCopy">Copy board link</button><button class="btn" id="shareClose">Close</button></div></section>`;
  document.body.append(shade);
  const $$=s=>shade.querySelector(s);
  let topicId='';

  const cs=()=>window.cloudShare;
  const info=id=>cs()&&cs().info(id);

  function fill(){
    const t=state.topics.find(x=>x.id===topicId);
    if(!t){close();return}
    $$('#shareTitle').textContent='Share “'+t.title+'”';
    const i=info(topicId),list=$$('#shareMembers');
    list.innerHTML='';
    if(!i){
      $$('#shareNote').textContent='Sign in with Google at the top of the page to share boards.';
      $$('#shareAddRow').hidden=true;return;
    }
    const owner=cs().isOwner(topicId);
    $$('#shareNote').textContent=owner?'People below can see and edit this board.':'Shared with you by '+i.owner+'.';
    $$('#shareAddRow').hidden=!owner;
    [i.owner,...i.members.filter(m=>m!==i.owner)].forEach(m=>{
      const li=document.createElement('li'),name=document.createElement('span');
      name.textContent=m+(m===cs().me()?' (you)':'');li.append(name);
      if(m===i.owner){const r=document.createElement('span');r.className='role';r.textContent='Owner';li.append(r)}
      else if(owner){
        const b=document.createElement('button');b.textContent='×';b.title='Remove '+m;b.setAttribute('aria-label','Remove '+m);
        b.onclick=()=>run(cs().remove(topicId,m));li.append(b);
      }
      list.append(li);
    });
  }
  function run(p){
    $$('#shareError').textContent='';
    return p.then(()=>{fill();return true},e=>{$$('#shareError').textContent=e.message||e.code||'Something went wrong';return false});
  }
  function open(id){topicId=id;$$('#shareError').textContent='';$$('#shareEmail').value='';fill();shade.classList.add('show')}
  function close(){shade.classList.remove('show');topicId=''}

  $$('#shareAddBtn').onclick=()=>run(cs().add(topicId,$$('#shareEmail').value)).then(ok=>{if(ok)$$('#shareEmail').value=''});
  $$('#shareEmail').onkeydown=e=>{if(e.key==='Enter')$$('#shareAddBtn').click()};
  // The link opens this board after they sign in with the Gmail they were added with.
  $$('#shareCopy').onclick=async()=>{
    // Board ids are t + a timestamp; base 36 makes the link about half as long.
    const code=/^t\d+$/.test(topicId)?Number(topicId.slice(1)).toString(36):'~'+encodeURIComponent(topicId);
    const url=location.origin+location.pathname+'#b='+code;
    try{await navigator.clipboard.writeText(url);toast('Link copied. They sign in with the Gmail you added.')}
    catch{window.prompt('Copy this link:',url)}
  };
  $$('#shareClose').onclick=close;
  shade.onclick=e=>{if(e.target===shade)close()};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});

  function badge(n){const b=document.createElement('span');b.className='people-badge';b.title=n+' people';b.textContent='👥 '+n;return b}
  function addBadges(){
    document.querySelectorAll('#topicView [data-topic]').forEach(col=>{
      const n=info(col.dataset.topic)?.members.length||0;
      if(n>1)col.querySelector('.coltitle')?.after(badge(n));
    });
    document.querySelectorAll('#progressView [data-project]').forEach(tile=>{
      const n=info(tile.dataset.project)?.members.length||0;
      if(n>1)tile.querySelector('h2')?.after(badge(n));
    });
  }

  const baseRender=renderHome;
  renderHome=function(){baseRender();addBadges();if(topicId)fill()};
  shareProject=open;
  document.querySelectorAll('#shareProjectBtn').forEach(b=>b.onclick=()=>open(selectedTopic));
})();
