// Syncs boards to Firestore. Each project board is its own document, shared with the
// Gmail addresses in its `members` list. Anyone can sign in with Google and sees only
// the boards they own or that were shared with them.
// The page's own script keeps `state`, `persist` and the render functions as globals.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,doc,collection,query,where,onSnapshot,getDoc,setDoc,updateDoc,deleteDoc,arrayUnion,arrayRemove,serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const LEGACY_OWNER='adityashanthi24@gmail.com'; // owner of the old single board, boards/main
const app=initializeApp({
  apiKey:'AIzaSyAEu3OYj3XMAuafx_x0PBIBXRrf2wpMP48',
  authDomain:'ideastracker-aea9d.firebaseapp.com',
  projectId:'ideastracker-aea9d',
  storageBucket:'ideastracker-aea9d.firebasestorage.app',
  messagingSenderId:'978960490419',
  appId:'1:978960490419:web:2fc98a3d9a3ea98ea2f5c6'
});
const auth=getAuth(app),db=getFirestore(app);

// Small status bar at the top: sign-in button, sync state, errors.
const bar=document.createElement('div');
bar.style.cssText='position:sticky;top:0;z-index:50;display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 12px;background:#f3f5f7;border-bottom:1px solid #ddd;font:14px system-ui,sans-serif;color:#27312b';
document.body.prepend(bar);
function showBar(text,button,onClick){
  const lower=text.toLowerCase();
  bar.style.background=lower.startsWith('synced')?'#dff3e5':(lower.includes('error')||lower.includes('failed'))?'#fde2e1':'#f1f3f6';
  bar.innerHTML='';
  const t=document.createElement('span');t.textContent=text;bar.append(t);
  if(button){const b=document.createElement('button');b.className='btn';b.textContent=button;b.onclick=onClick;bar.append(b)}
}
const fail=what=>e=>showBar(what+' failed: '+e.code,'Reload',()=>location.reload());

let unsubscribe=null,email='',uid='';
// id -> {owner, members, key}; key is the last content we saw or saved, to skip unchanged boards.
let known=new Map(),lastOrder='',userOrder=[];

function signIn(){signInWithPopup(auth,new GoogleAuthProvider()).catch(e=>showBar('Sign-in failed: '+e.code,'Try again',signIn))}
const boardRef=id=>doc(db,'boards',id);
const cardsOf=(s,id)=>s.ideas.filter(i=>i.topicId===id).map(({topicId,...c})=>c);
const keyOf=(s,t)=>JSON.stringify({title:t.title,collapsed:!!t.collapsed,cards:cardsOf(s,t.id)});

function save(s){
  for(const t of s.topics){
    const key=keyOf(s,t),k=known.get(t.id);
    if(k&&k.key===key)continue;
    const data=JSON.parse(key);
    if(k){k.key=key;updateDoc(boardRef(t.id),data).catch(fail('Save'))}
    else{
      known.set(t.id,{owner:email,members:[email],key});
      setDoc(boardRef(t.id),{...data,owner:email,members:[email],createdAt:serverTimestamp()}).catch(fail('Save'));
    }
  }
  const ids=new Set(s.topics.map(t=>t.id));
  for(const [id,k] of known){
    if(ids.has(id))continue;
    known.delete(id);
    // The owner deletes the board; anyone else just leaves it.
    (k.owner===email?deleteDoc(boardRef(id)):updateDoc(boardRef(id),{members:arrayRemove(email)})).catch(fail('Remove'));
  }
  const order=s.topics.map(t=>t.id).join();
  if(order!==lastOrder){lastOrder=order;userOrder=s.topics.map(t=>t.id);setDoc(doc(db,'users',uid),{order:userOrder}).catch(fail('Save'))}
}

async function firstUpload(){
  // First sign-in with no boards yet: bring over the old single board, or this phone's boards.
  if(email===LEGACY_OWNER){
    const old=await getDoc(boardRef('main')).catch(()=>null);
    if(old&&old.exists()&&old.data().state){state=old.data().state;localStorage.setItem(KEY,JSON.stringify(state))}
  }
  save(state);
}

function applySnapshot(snap){
  const docs=snap.docs.map(d=>({id:d.id,...d.data()}));
  const rank=id=>{const n=userOrder.indexOf(id);return n<0?1e9:n};
  docs.sort((a,b)=>rank(a.id)-rank(b.id)||(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
  const next={
    topics:docs.map(d=>({id:d.id,title:d.title||'Untitled',collapsed:!!d.collapsed,owner:d.owner,members:d.members||[]})),
    ideas:docs.flatMap(d=>(d.cards||[]).map(c=>({...c,topicId:d.id,status:c.status||'planned',updates:c.updates||[]})))
  };
  known=new Map(next.topics.map(t=>[t.id,{owner:t.owner,members:t.members,key:keyOf(next,t)}]));
  lastOrder=next.topics.map(t=>t.id).join();
  state=next;
  localStorage.setItem(KEY,JSON.stringify(state));
  if(selectedTopic&&!state.topics.some(t=>t.id===selectedTopic))document.querySelector('#backBtn').click();
  renderHome();
  if(!document.querySelector('#projectDetail').hidden)renderKanban();
  showBar('Synced ✓ '+email,'Sign out',()=>signOut(auth));
  openLinkedBoard();
}

// #b=CODE (short, from share.js) or #board=ID; CODE is the base-36 timestamp of a t123 id,
// or ~ followed by any other id.
function linkedBoardId(){
  let m=location.hash.match(/^#board=([^&]+)$/);
  if(m)return decodeURIComponent(m[1]);
  m=location.hash.match(/^#b=(~?)([^&]+)$/);
  if(!m)return '';
  return m[1]?decodeURIComponent(m[2]):'t'+parseInt(m[2],36);
}

// A board link opens that board once it has synced.
function openLinkedBoard(){
  const id=linkedBoardId();
  if(!id)return;
  if(!state.topics.some(t=>t.id===id)){showBar('This board is not shared with '+email+'. Ask the owner to add this Gmail.','Sign out',()=>signOut(auth));return}
  history.replaceState(null,'',location.pathname);
  openProject(id);
}

// Sharing, for the share screen in index.html.
window.cloudShare={
  me:()=>email,
  info:id=>known.get(id)||null, // {owner, members} or null when not synced
  isOwner:id=>known.get(id)?.owner===email,
  add(id,mail){
    mail=String(mail||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))return Promise.reject(new Error('Enter a valid email address'));
    return updateDoc(boardRef(id),{members:arrayUnion(mail)});
  },
  remove:(id,mail)=>updateDoc(boardRef(id),{members:arrayRemove(String(mail).toLowerCase())})
};

onAuthStateChanged(auth,async user=>{
  if(unsubscribe){unsubscribe();unsubscribe=null}
  window.cloudSave=null;known=new Map();lastOrder='';userOrder=[];
  // Old #project= links are read-only snapshots; send people to the live tracker to sign in.
  if(isShared){showBar('This is an old read-only link. Open the tracker and sign in to see boards shared with you.','Open tracker',()=>{location.href=location.origin+location.pathname});return}
  if(!user){email=uid='';showBar(/^#b(oard)?=/.test(location.hash)?'Sign in with Google to open this shared board.':'Not synced. Sign in to sync and share boards.','Sign in with Google',signIn);return}
  email=user.email.toLowerCase();uid=user.uid;
  showBar('Syncing…','Sign out',()=>signOut(auth));
  const prefs=await getDoc(doc(db,'users',uid)).catch(()=>null);
  userOrder=prefs&&prefs.exists()?prefs.data().order||[]:[];
  let first=true;
  unsubscribe=onSnapshot(query(collection(db,'boards'),where('members','array-contains',email)),snap=>{
    if(snap.metadata.hasPendingWrites)return; // our own save echoing back
    if(first){first=false;if(snap.empty){firstUpload().then(()=>{window.cloudSave=save});return}}
    applySnapshot(snap);
    window.cloudSave=save;
  },e=>showBar('Sync error: '+e.code,'Reload',()=>location.reload()));
});
