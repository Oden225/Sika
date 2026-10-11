// Saisie du code de vérification « en paquet de cartes » (skill auth-otp-deck,
// repris tel quel : seuls les textes et la fonction verify sont fournis par l'appelant).

export function createOtpDeck(root,opts){
  const o=Object.assign({length:6,minLoading:900,verify:async()=>false,onSuccess:()=>{},onResend:()=>{},resendDelay:30,texts:{}},opts);
  const T=Object.assign({title:'Entrez votre code',checking:'Vérification du code',checkingSub:'Un instant, nous confirmons.',
    ok:'Vérifié',okSub:'Ouverture de votre session…',bad:'Code incorrect',badSub:'Vérifiez le code puis réessayez.',
    netErr:'Connexion impossible. Vérifiez le réseau puis réessayez.'},o.texts);
  const $=s=>root.querySelector(s);
  const input=$('.otp-input'), deck=$('.otp-deck'), title=$('.otp-title'), sub=$('.otp-sub'), foot=$('.otp-foot'), done=$('.otp-done'), live=$('[aria-live]'), resendBtn=$('.otp-resend');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D=ms=>reduce?1:ms;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  let n=o.length, cells=[], state='idle', focused=false, timer=null, errTimer=null, errShown=false;
  // efface toute trace d'une erreur précédente (bordures rouges, trait rouge)
  const clearErr=()=>{clearTimeout(errTimer); cells.forEach(c=>c.classList.remove('err','bad'));};

  // anime depuis l'état affiché actuel vers `to`, puis fige le résultat dans le style
  const go=(el,to,opt={})=>{
    // uniquement nos animations : figer une transition CSS (ex. bordure rouge) l'écrirait en dur dans le style
    el.getAnimations().filter(a=>!(a instanceof CSSTransition)&&!(a instanceof CSSAnimation)).forEach(a=>{try{a.commitStyles()}catch(e){} a.cancel();});
    const cs=getComputedStyle(el), from={}; for(const k in to) from[k]=cs[k];
    const a=el.animate([from,to],Object.assign({fill:'forwards',easing:'cubic-bezier(.2,.8,.2,1)'},opt,{duration:D(opt.duration||300)}));
    return a.finished.then(()=>{try{a.commitStyles()}catch(e){} a.cancel();}).catch(()=>{});
  };
  const swapText=async(el,html,color)=>{await go(el,{opacity:0,transform:'translateY(-6px)'},{duration:140,easing:'ease-in'});
    el.innerHTML=html; el.style.color=color||''; el.style.transform='translateY(6px)'; await go(el,{opacity:1,transform:'translateY(0px)'},{duration:220});};

  function build(len){
    clearTimeout(errTimer); errShown=false; n=len; input.maxLength=n; input.value=''; state='idle';
    deck.style.setProperty('--n',n);
    deck.innerHTML=Array.from({length:n},()=>'<div class="cell"><span class="dg"></span><i class="caret"></i></div>').join('');
    cells=[...deck.children];
    const top=cells[n-1];
    top.insertAdjacentHTML('beforeend','<svg class="check" viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>'+Array.from({length:14},()=>'<i class="spark"></i>').join(''));
    title.textContent=T.title; title.style.cssText=''; sub.innerHTML=typeof T.sub==='function'?T.sub(n):(T.sub||''); sub.style.cssText='';
    done.style.display='none'; foot.style.cssText=''; input.readOnly=false;
    render();
  }

  function render(){
    const v=input.value.replace(/\D/g,'').slice(0,n);
    if(v!==input.value) input.value=v;
    cells.forEach((c,i)=>{
      const dg=c.firstChild, ch=v[i]||'';
      if(dg.textContent!==ch){dg.textContent=ch; if(ch) dg.animate([{transform:'translateY(6px) scale(.4)',opacity:0,filter:'blur(4px)'},{transform:'translateY(-1px) scale(1.12)',opacity:1,filter:'blur(0)',offset:.65},{transform:'none',opacity:1}],{duration:D(260),easing:'ease-out'});}
      c.classList.toggle('active',state==='idle'&&focused&&i===Math.min(v.length,n-1));
    });
    if(state==='idle'&&v.length>0&&cells.some(c=>c.classList.contains('err'))) clearErr();   // on retape : le rouge disparaît
    if(state==='idle'&&v.length>0&&errShown){errShown=false; swapText(title,T.title); swapText(sub,typeof T.sub==='function'?T.sub(n):(T.sub||''));}
    if(state==='idle'&&v.length===n) submit(v);
  }

  async function submit(code){
    clearErr(); state='checking'; input.readOnly=true; input.blur(); render();
    live.textContent=T.checking;
    const pitch=cells[1].offsetLeft-cells[0].offsetLeft, mid=(n-1)/2;
    cells.forEach((c,i)=>c.style.zIndex=i);
    // 1. éventail
    await Promise.all(cells.map((c,i)=>{const d=i-mid;
      return go(c,{transform:`translate(${-d*pitch*.18}px,${d*d*3-12}px) rotate(${d*(28/n)}deg)`},{duration:420,delay:D(i*25),easing:'cubic-bezier(.34,1.56,.64,1)'});}));
    await wait(D(220));
    // 2. empilement en paquet, chiffres masqués
    cells.forEach(c=>go(c.firstChild,{opacity:0},{duration:200}));
    swapText(title,T.checking); swapText(sub,T.checkingSub);
    go(foot,{opacity:.35},{duration:200});
    await Promise.all(cells.map((c,i)=>{const d=i-mid;
      return go(c,{transform:`translate(${-d*pitch+(i-(n-1))*-1.2}px,${(n-1-i)*-1.5}px) rotate(${(i-(n-1))*-2.2}deg)`},{duration:460,easing:'cubic-bezier(.65,0,.35,1)'});}));
    // 3. attente : trait lumineux autour de la carte du dessus
    const top=cells[n-1]; top.classList.add('tracing');
    // verify renvoie true (bon code), false (mauvais code) ou un texte d'erreur (réseau, code expiré…)
    let res=false;
    try{ [res]=await Promise.all([Promise.resolve(o.verify(code)),wait(reduce?0:o.minLoading)]); }catch(e){ res=T.netErr; }
    res===true?success(top):fail(top,typeof res==='string'?res:T.badSub);
  }

  async function success(top){
    state='ok'; live.textContent=T.ok; clearErr();
    top.classList.remove('tracing'); top.classList.add('ok');
    await wait(D(420));
    // éclats
    [...top.querySelectorAll('.spark')].forEach((s,k)=>{const ang=k/14*Math.PI*2+(k%2)*.2, r=46+(k%3)*12;
      s.animate([{opacity:1,transform:'translate(0,0) scale(1)'},{opacity:0,transform:`translate(${Math.cos(ang)*r}px,${Math.sin(ang)*r}px) scale(.2)`}],{duration:D(620),easing:'cubic-bezier(.2,.8,.2,1)'});});
    top.animate([{transform:getComputedStyle(top).transform},{transform:getComputedStyle(top).transform+' scale(1.08)'},{transform:getComputedStyle(top).transform}],{duration:D(380),easing:'ease-out'});
    const chk=top.querySelector('.check'); chk.style.opacity=1;
    go(chk.firstChild,{strokeDashoffset:'0'},{duration:360,delay:D(120)});
    swapText(title,T.ok,'var(--ok)'); swapText(sub,T.okSub);
    await go(foot,{opacity:0},{duration:150}); foot.style.display='none';
    done.style.display='flex'; done.style.opacity=0; done.style.transform='translateY(8px)';
    await go(done,{opacity:1,transform:'translateY(0px)'},{duration:320,delay:D(250)});
    done.querySelector('button').focus({preventScroll:true});
  }

  async function fail(top,msg){
    state='bad'; errShown=true; live.textContent=T.bad+'. '+msg;
    top.classList.add('bad'); navigator.vibrate?.(60);
    swapText(title,T.bad,'var(--err)'); swapText(sub,msg);
    await deck.animate([0,-9,9,-7,7,-4,4,0].map(x=>({transform:`translateX(${x}px)`})),{duration:D(440),easing:'ease-out'}).finished.catch(()=>{});
    await wait(D(250));
    top.classList.remove('tracing','bad');
    // retour en ligne, chiffres effacés, bordures rouges un instant
    input.value=''; cells.forEach(c=>{c.firstChild.textContent='';c.firstChild.style.opacity='';c.classList.add('err');});
    await Promise.all(cells.map((c,i)=>go(c,{transform:'none'},{duration:420,delay:D((n-1-i)*30),easing:'cubic-bezier(.34,1.4,.64,1)'})));
    go(foot,{opacity:1},{duration:200});
    state='idle'; input.readOnly=false; input.focus({preventScroll:true}); render();
    errTimer=setTimeout(clearErr,D(900));
  }

  function startResendTimer(){
    let s=o.resendDelay; resendBtn.disabled=true; resendBtn.textContent=`Renvoyer dans ${s} s`;
    clearInterval(timer); timer=setInterval(()=>{s--; if(s<=0){clearInterval(timer);resendBtn.disabled=false;resendBtn.textContent='Renvoyer';} else resendBtn.textContent=`Renvoyer dans ${s} s`;},1000);
  }
  resendBtn.addEventListener('click',()=>{o.onResend(); live.textContent='Nouveau code envoyé'; startResendTimer();});
  input.addEventListener('input',render);
  input.addEventListener('focus',()=>{focused=true; const L=input.value.length; input.setSelectionRange(L,L); render();});
  input.addEventListener('blur',()=>{focused=false; render();});
  done.querySelector('button').addEventListener('click',()=>o.onSuccess());
  build(n);
  return {reset:len=>build(len||n), focus:()=>input.focus()};
}
