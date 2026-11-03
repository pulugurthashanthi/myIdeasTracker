// Syncs the board to Firestore for the one shared Google account.
// The page's own script keeps `state`, `persist` and the render functions as globals.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,doc,onSnapshot,setDoc} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const ALLOWED='adityashanthi24@gmail.com';
const app=initializeApp({
  apiKey:'AIzaSyAEu3OYj3XMAuafx_x0PBIBXRrf2wpMP48',
  authDomain:'ideastracker-aea9d.firebaseapp.com',
  projectId:'ideastracker-aea9d',
  storageBucket:'ideastracker-aea9d.firebasestorage.app',
  messagingSenderId:'978960490419',
  appId:'1:978960490419:web:2fc98a3d9a3ea98ea2f5c6'
});
const auth=getAuth(app),db=getFirestore(app),board=doc(db,'boards','main');

// Small status bar at the top: sign-in button, sync state, errors.
const bar=document.createElement('div');
bar.style.cssText='position:sticky;top:0;z-index:50;display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 12px;background:#f3f1ea;border-bottom:1px solid #ddd;font:14px system-ui,sans-serif';
document.body.prepend(bar);
function showBar(text,button,onClick){
  bar.innerHTML='';
  const t=document.createElement('span');t.textContent=text;bar.append(t);
  if(button){const b=document.createElement('button');b.className='btn';b.textContent=button;b.onclick=onClick;bar.append(b)}
}

let unsubscribe=null;
function signIn(){signInWithPopup(auth,new GoogleAuthProvider()).catch(e=>showBar('Sign-in failed: '+e.code,'Try again',signIn))}

onAuthStateChanged(auth,user=>{
  if(unsubscribe){unsubscribe();unsubscribe=null}
  window.cloudSave=null;
  if(isShared)return; // old #project= links stay read-only and local
  if(!user){showBar('Not synced. Sign in to share with Aditya and Shanthi.','Sign in with Google',signIn);return}
  if(user.email!==ALLOWED){showBar('This account ('+user.email+') is not allowed.','Sign out',()=>signOut(auth));return}
  showBar('Syncing…','Sign out',()=>signOut(auth));
  window.cloudSave=s=>setDoc(board,{state:JSON.parse(JSON.stringify(s)),savedAt:Date.now()})
    .catch(e=>showBar('Save failed: '+e.code,'Reload',()=>location.reload()));
  unsubscribe=onSnapshot(board,snap=>{
    if(snap.metadata.hasPendingWrites)return; // our own save echoing back
    if(!snap.exists()){window.cloudSave(state);return} // first sign-in: upload this phone's board
    state=snap.data().state;
    localStorage.setItem(KEY,JSON.stringify(state));
    renderHome();
    if(!document.querySelector('#projectDetail').hidden)renderKanban();
    showBar('Synced ✓ '+new Date().toLocaleTimeString(),'Sign out',()=>signOut(auth));
  },e=>showBar('Sync error: '+e.code,'Reload',()=>location.reload()));
});
