(function(){
"use strict";
var $=function(s){return document.querySelector(s)};
var PAGE=document.body.dataset.page||"",PID=document.body.dataset.id||"";
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function norm(s){return String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()}
var toastT;
function toast(msg){var t=$("#toast");if(!t)return;t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true},2200)}
function copyText(txt,ok){try{navigator.clipboard.writeText(txt).then(function(){toast(ok)},function(){toast("Copie refusée par le navigateur")})}catch(e){toast("Copie impossible ici")}}
var store={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
function on(sel,fn){var el=$(sel);if(el)fn(el)}
var CH={};CHAPTERS.forEach(function(c,i){c.idx=i;CH[c.id]=c});
var DLINK={"Salem":"/dossiers/salem/","Tituba":"/dossiers/salem/#tituba","Marie Laveau":"/dossiers/vaudou/#louisiane"};
function imgHTML(key,cls){var I=window.IMG||{},im=I[key];if(!im)return"";return'<figure class="'+(cls||"plate")+'"><img src="'+im.src2+'" srcset="'+im.src2+' 700w, '+im.src+' '+im.w+'w" sizes="(max-width: 760px) 100vw, 700px" width="'+im.w+'" height="'+im.h+'" loading="lazy" decoding="async" alt="'+esc(im.cap)+'"><figcaption>'+esc(im.cap)+' <a href="'+im.page+'" target="_blank" rel="noopener">Domaine public, Wikimedia Commons</a></figcaption></figure>'}
var PLACE=window.IMGPLACE||{hist:{},fig:{}};
var LVL=["","Novice","Initiée","Adepte"];
function stars(n){return "✦".repeat(n)+"✧".repeat(3-n)}
var ORDER=SPELLS.slice().sort(function(a,b){return CH[a.ch].idx-CH[b.ch].idx});
function spellUrl(s){return "/sorts/"+s.slug+"/"}
function byId(arr,id){return arr.filter(function(x){return x.id===id})[0]}

/* ================= LUNE ================= */
var SYN=29.530588853,REF=Date.UTC(2000,0,6,18,14)/864e5;
function moonAge(d){return((d.getTime()/864e5-REF)%SYN+SYN)%SYN}
function moonPath(p,r,cx,cy){var k=Math.cos(2*Math.PI*p),rx=Math.abs(k)*r,top=cx+","+(cy-r),bot=cx+","+(cy+r);
  if(p<0.5)return"M"+top+" A"+r+","+r+" 0 0 1 "+bot+" A"+rx+","+r+" 0 0 "+(k>0?0:1)+" "+top+"Z";
  return"M"+top+" A"+r+","+r+" 0 0 0 "+bot+" A"+rx+","+r+" 0 0 "+(k>0?1:0)+" "+top+"Z"}
var mgid=0;
function moonSVG(p,tex){var id="mg"+(mgid++),s='<defs><radialGradient id="'+id+'" cx="40%" cy="38%" r="70%"><stop offset="0" stop-color="#f4ecd8"/><stop offset="1" stop-color="#cdbf9f"/></radialGradient></defs><circle cx="50" cy="50" r="50" fill="#221d2e" stroke="#3a3249"/>';
  var lit=(1-Math.cos(2*Math.PI*p))/2;
  if(lit>0.995)s+='<circle cx="50" cy="50" r="50" fill="url(#'+id+')"/>';else if(lit>0.005)s+='<path d="'+moonPath(p,50,50,50)+'" fill="url(#'+id+')"/>';
  if(tex)[[36,34,7],[62,58,9],[44,70,5],[68,30,4],[28,56,4]].forEach(function(c){s+='<circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+c[2]+'" fill="#1d1928" opacity=".13"/>'});
  return s}
var PH=[
 {n:"Nouvelle lune",max:1.85,k:"nouvelle",a:"Temps du repos et des graines. Écris tes intentions pour le cycle qui commence."},
 {n:"Premier croissant",max:7.38,k:"croissante",a:"L’énergie monte : moment idéal pour les sorts d’attraction, de chance et de nouveaux projets."},
 {n:"Premier quartier",max:9.23,k:"croissante",a:"Temps de l’effort et des décisions. Sorts de courage et de persévérance."},
 {n:"Lune gibbeuse croissante",max:12.92,k:"croissante",a:"On peaufine et on nourrit. Renforce ce que tu as commencé à la nouvelle lune."},
 {n:"Pleine lune",max:16.62,k:"pleine",a:"Le sommet du cycle. Charge tes pierres et ton eau, fais les rituels de gratitude et de divination."},
 {n:"Lune gibbeuse décroissante",max:20.3,k:"décroissante",a:"Temps du partage et de la reconnaissance. Commence à trier."},
 {n:"Dernier quartier",max:24,k:"décroissante",a:"On tranche et on lâche prise. Moment des sorts de coupure et de bannissement."},
 {n:"Dernier croissant",max:27.68,k:"décroissante",a:"Nettoyage, purification de la maison, repos avant le renouveau."},
 {n:"Nouvelle lune",max:99,k:"nouvelle",a:"Temps du repos et des graines. Écris tes intentions pour le cycle qui commence."}];
function phaseOf(a){for(var i=0;i<PH.length;i++)if(a<PH[i].max)return PH[i];return PH[0]}
function doyAngle(m,d,y){var yr=y||new Date().getFullYear(),t=Date.UTC(yr,m,d),ref=Date.UTC(yr,11,21);if(t<ref)ref=Date.UTC(yr-1,11,21);return(t-ref)/864e5/365.2425*360}
function nextSabbat(){var now=new Date(),deg=doyAngle(now.getMonth(),now.getDate(),now.getFullYear()),best=null,bd=1e9;
  SAB.forEach(function(sb){var d=doyAngle(sb.m,sb.d)-deg;if(d<0)d+=360;if(d<bd){bd=d;best=sb}});return{sb:best,days:Math.round(bd/360*365.2425)}}

function renderMoon(){
  var now=new Date(),age=moonAge(now),p=age/SYN,ph=phaseOf(age),lit=Math.round((1-Math.cos(2*Math.PI*p))/2*100),toFull=((SYN/2-age)+SYN)%SYN;
  $("#moon-svg").innerHTML=moonSVG(p,true);
  $("#moon-name").textContent=ph.n;
  $("#moon-meta").textContent=lit+" % éclairée · âge "+age.toFixed(1)+" j · pleine lune dans "+Math.round(toFull)+" j";
  $("#moon-advice").innerHTML="<b>Ce soir dans le grimoire.</b> "+ph.a;
  $("#moon-date").textContent=now.toLocaleDateString("fr-FR",{day:"numeric",month:"long"});
  var pool=SPELLS.filter(function(s){return norm(s.moon).indexOf(norm(ph.k))>-1}),seed=now.getDate()+now.getMonth()*31,picks=[];
  for(var i=0;i<pool.length&&picks.length<3;i++){var c=pool[(seed+i*7)%pool.length];if(picks.indexOf(c)<0)picks.push(c)}
  $("#tonight").innerHTML=picks.map(function(s){return'<a href="'+spellUrl(s)+'">'+esc(s.n)+'<span>'+CH[s.ch].n+'</span></a>'}).join("");
}

/* ================= FEUILLES DU LIVRE ================= */
var ORN='<svg class="orn" viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="#8c2f2a" stroke-width="1.6"><circle cx="60" cy="60" r="20"/><path d="M36 42A20 20 0 1 0 36 78A15 18 0 1 1 36 42Z"/><path d="M84 42A20 20 0 1 1 84 78A15 18 0 1 0 84 42Z"/><circle cx="60" cy="60" r="50" stroke-dasharray="2 5"/><path d="M60 45l4.2 10.5h11l-9 6.6 3.5 10.9-9.7-6.8-9.7 6.8 3.5-10.9-9-6.6h11z"/></g></svg>';
function spreadSpell(s,o){
  o=o||{};var c=CH[s.ch],pl=o.folio||(ORDER.indexOf(s)+1)*2+1,T=o.h1?"h1":"h3";
  var L='<div class="page left"><div class="rh"><span>Livre des Ombres</span><span>Chapitre '+c.r+' · '+esc(c.n)+'</span></div>'
   +(o.first?'<div class="chap-intro"><b>Chapitre '+c.r+' — '+esc(c.n)+'</b>'+esc(c.i)+'</div>':'')
   +'<'+T+'>'+esc(s.n)+'</'+T+'><p class="sub">'+esc(s.sub)+'</p>'
   +(s.m?'<p class="marg">'+esc(s.m)+'</p>':'')
   +'<div class="meta4"><div><span>Lune</span><b>'+esc(s.moon)+'</b></div><div><span>Jour</span><b>'+esc(s.day)+'</b></div><div><span>Durée</span><b>'+esc(s.dur)+'</b></div><div><span>Niveau</span><b><i class="lvl" aria-hidden="true">'+stars(s.lvl)+'</i> '+LVL[s.lvl]+'</b></div></div>'
   +'<h2 class="h5">Il te faut</h2><ul class="ing">'+s.ing.map(function(x){return"<li>"+esc(x)+"</li>"}).join("")+'</ul>'
   +'<h2 class="h5">Histoire &amp; tradition</h2><p class="note">'+esc(s.note)+'</p><span class="folio">'+pl+'</span></div>';
  var R='<div class="page right"><div class="rh"><span>'+esc(s.n)+'</span><span>'+stars(s.lvl)+'</span></div>'
   +'<h2 class="h5" style="margin-top:0">Le rituel</h2><ol class="rite">'+s.steps.map(function(x){return"<li><span>"+esc(x)+"</span></li>"}).join("")+'</ol>'
   +'<h2 class="h5">Incantation</h2><p class="incant">'+esc(s.inc)+'</p>'
   +(s.var&&s.var.length?'<h2 class="h5">Variantes</h2><ul class="var">'+s.var.map(function(x){return"<li>"+esc(x)+"</li>"}).join("")+'</ul>':'')
   +'<h2 class="h5">Après le sort</h2><p class="after">'+esc(s.after)+'</p>'
   +(s.warn?'<p class="warnink"><b>Attention.</b> '+esc(s.warn)+'</p>':'')
   +'<div class="page-actions"><button class="inkbtn" type="button" data-copy="'+s.id+'">Copier ce sort</button>'
   +(o.solo?'<button class="inkbtn" type="button" data-print>Imprimer pour mon Livre des Ombres</button><a class="inkbtn" href="/livre-des-ombres/#sort-'+s.id+'">Ouvrir dans le livre</a>':'<a class="inkbtn" href="'+spellUrl(s)+'">Page du sort</a><button class="inkbtn" type="button" data-p="0">Table des sortilèges</button>')
   +'</div><span class="folio">'+(pl+1)+'</span></div>';
  return L+R;
}
function copySpell(id){var s=byId(SPELLS,id);if(!s)return;
  copyText(s.n.toUpperCase()+"\n"+s.sub+"\nLune : "+s.moon+" · Jour : "+s.day+" · Durée : "+s.dur+"\n\nIL TE FAUT\n- "+s.ing.join("\n- ")+"\n\nLE RITUEL\n"+s.steps.map(function(x,n){return(n+1)+". "+x}).join("\n")+"\n\nINCANTATION\n"+s.inc+"\n\nAPRÈS LE SORT\n"+s.after+"\n\n— Le Grimoire de Minuit · grimoire.endam-digital.com"+spellUrl(s),"Sort copié")}
document.addEventListener("click",function(e){var c=e.target.closest("[data-copy]");if(c)copySpell(c.dataset.copy)});

/* ================= LIVRE (feuilleter) ================= */
function initBook(){
  var book={list:ORDER.slice(),i:0,view:"book"};
  function filterBook(){
    var q=norm($("#q").value.trim()),fm=$("#f-moon").value,fl=$("#f-lvl").value;
    book.list=ORDER.filter(function(s){
      if(fl&&String(s.lvl)!==fl)return false;
      if(fm&&norm(s.moon).indexOf(norm(fm))<0&&norm(s.moon).indexOf("toutes")<0)return false;
      if(q){var hay=norm([s.n,s.sub,s.ing.join(" "),s.note,s.inc,CH[s.ch].n,s.moon,s.day].join(" "));if(hay.indexOf(q)<0)return false}
      return true});
    $("#bookcount").textContent=book.list.length+" sort"+(book.list.length>1?"s":"");
    book.i=0;render(0);renderIdx();
  }
  function front(){
    var owner=store.get("gm-owner")||"",groups={};book.list.forEach(function(s,k){(groups[s.ch]=groups[s.ch]||[]).push([s,k])});
    var toc=CHAPTERS.filter(function(c){return groups[c.id]}).map(function(c){return'<div><h6>'+c.r+'. '+esc(c.n)+'</h6>'+groups[c.id].map(function(x){return'<button type="button" data-p="'+(x[1]+1)+'">'+esc(x[0].n)+'<span>'+((x[1]+1)*2+1)+'</span></button>'}).join("")+'</div>'}).join("")||'<p>Aucun sort ne correspond à ta recherche.</p>';
    return'<div class="page left"><div class="front">'+ORN+'<p class="label" style="color:var(--sepia-3)">Grimoire de Minuit</p><h3>Livre des Ombres</h3><p class="sub">Sorts, charmes et enchantements<br>recueillis et mis en ordre</p><p class="own">Ce livre appartient à<br><input id="owner" type="text" value="'+esc(owner)+'" placeholder="ton nom de sorcière" maxlength="30" aria-label="Nom du propriétaire du livre"></p></div><span class="folio">i</span></div>'
     +'<div class="page right"><div class="rh"><span>Table des sortilèges</span><span>'+book.list.length+' sorts</span></div><div class="toc">'+toc+'</div><span class="folio">ii</span></div>';
  }
  function render(dir){
    var sp=$("#spread"),i=book.i;if(i>book.list.length)i=book.i=book.list.length;
    if(i===0)sp.innerHTML=front();else{var k=i-1,s=book.list[k];sp.innerHTML=spreadSpell(s,{first:k===0||book.list[k-1].ch!==s.ch,folio:(k+1)*2+1})}
    sp.classList.remove("turnR","turnL");if(dir){void sp.offsetWidth;sp.classList.add(dir>0?"turnR":"turnL")}
    $("#prev").disabled=i===0;$("#next").disabled=i>=book.list.length;
    $("#pos").textContent=i===0?"Pages i–ii · Table des sortilèges":"Pages "+(i*2+1)+"–"+(i*2+2)+" · Sort "+i+" sur "+book.list.length;
    var cur=i>0?book.list[i-1].ch:null;
    document.querySelectorAll("#tabs button").forEach(function(b){b.setAttribute("aria-current",b.dataset.ch===cur?"true":"false");b.disabled=!book.list.some(function(s){return s.ch===b.dataset.ch});b.style.opacity=b.disabled?".25":""});
    on("#owner",function(ow){ow.addEventListener("input",function(){store.set("gm-owner",ow.value)})});
  }
  function go(i,scroll){var dir=i>book.i?1:-1;book.i=Math.max(0,Math.min(i,book.list.length));if(book.view!=="book")setView("book");render(dir);if(scroll)$("#book").scrollIntoView({behavior:"smooth",block:"start"})}
  function goSpell(id){var k=book.list.findIndex(function(s){return s.id===id});if(k<0){$("#q").value="";$("#f-moon").value="";$("#f-lvl").value="";filterBook();k=book.list.findIndex(function(s){return s.id===id})}if(k>-1)go(k+1,true)}
  function setView(v){book.view=v;$("#bookview").hidden=v!=="book";$("#idxview").hidden=v!=="idx";$("#v-book").setAttribute("aria-pressed",v==="book");$("#v-idx").setAttribute("aria-pressed",v==="idx")}
  function renderIdx(){var groups={};book.list.forEach(function(s){(groups[s.ch]=groups[s.ch]||[]).push(s)});
    var h=CHAPTERS.filter(function(c){return groups[c.id]}).map(function(c){return'<div class="idx-ch"><h4><i>'+c.r+'</i>'+esc(c.n)+'</h4><div class="idx-grid">'+groups[c.id].map(function(s){return'<button class="idx-card" type="button" data-go="'+s.id+'"><b>'+esc(s.n)+'</b><span>'+esc(s.sub)+'</span><em>'+stars(s.lvl)+' · '+esc(s.moon)+' · '+esc(s.dur)+'</em></button>'}).join("")+'</div></div>'}).join("");
    $("#idxview").innerHTML='<div class="idx">'+(h||'<p class="empty">Aucun sort ne correspond. Essaie un autre mot, par exemple « romarin » ou « lune ».</p>')+'</div>'}
  $("#tabs").innerHTML=CHAPTERS.map(function(c){return'<button type="button" data-ch="'+c.id+'" style="background:'+c.c+'" title="Chapitre '+c.r+' : '+esc(c.n)+'" aria-label="Chapitre '+c.r+' : '+esc(c.n)+'">'+c.r+'</button>'}).join("");
  $("#tabs").onclick=function(e){var b=e.target.closest("button");if(!b)return;var k=book.list.findIndex(function(s){return s.ch===b.dataset.ch});if(k>-1)go(k+1)};
  $("#prev").onclick=function(){go(book.i-1)};$("#next").onclick=function(){go(book.i+1)};
  $("#book").onkeydown=function(e){if(e.target.tagName==="INPUT")return;if(e.key==="ArrowRight"){go(book.i+1);e.preventDefault()}if(e.key==="ArrowLeft"){go(book.i-1);e.preventDefault()}};
  document.addEventListener("click",function(e){var p=e.target.closest("[data-p]");if(p){go(+p.dataset.p);return}var g=e.target.closest("[data-go]");if(g)goSpell(g.dataset.go)});
  ["#q","#f-moon","#f-lvl"].forEach(function(s){$(s).oninput=filterBook});
  $("#v-book").onclick=function(){setView("book")};$("#v-idx").onclick=function(){setView("idx")};
  $("#bookcount").textContent=SPELLS.length+" sorts";render(0);renderIdx();
  var h=(location.hash||"").replace("#","");if(h.indexOf("sort-")===0)setTimeout(function(){goSpell(h.slice(5))},50);
}

/* ================= GÉNÉRATEUR & SIGIL ================= */
function initForge(){
  var gs={i:"protection",f:"bougie"};
  function chips(el,obj,key){el.innerHTML="";Object.keys(obj).forEach(function(k){var b=document.createElement("button");b.type="button";b.textContent=obj[k].n;b.dataset.k=k;b.setAttribute("aria-pressed",gs[key]===k?"true":"false");b.onclick=function(){gs[key]=k;el.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-pressed",x.dataset.k===k?"true":"false")});gen()};el.appendChild(b)})}
  function data(){var i=INT[gs.i],f=FORM[gs.f],name=($("#f-name").value||"").trim();return{i:i,f:f,name:name,verse:i.v+(name?"\nAinsi le veut "+name+", ainsi soit-il.":"\nAinsi soit-il.")}}
  function gen(){var o=data(),i=o.i,f=o.f;
    $("#recipe").innerHTML='<span class="seal" aria-hidden="true">'+esc(i.n.charAt(0))+'</span><p class="label">Sort de '+esc(f.n.toLowerCase())+'</p><h3 class="rt">'+esc(i.n)+'</h3><p class="for">'+(o.name?"pour "+esc(o.name):"à personnaliser avec ton prénom")+'</p>'
    +'<div class="rgrid"><div><span class="label">Lune</span><span>'+i.moon+'</span></div><div><span class="label">Jour</span><span>'+i.day+'</span></div><div><span class="label">Bougie</span><span><i class="swatch" style="background:'+i.col[1]+'"></i>'+i.col[0]+'</span></div><div><span class="label">Herbes</span><span>'+i.herbs+'</span></div><div><span class="label">Pierre</span><span>'+i.stone+'</span></div><div><span class="label">Geste</span><span>'+esc(f.n.toLowerCase())+'</span></div></div>'
    +'<ol>'+f.steps(i).map(function(s){return"<li>"+s+"</li>"}).join("")+'</ol><p class="verse">'+esc(o.verse)+'</p>'}
  chips($("#chips-int"),INT,"i");chips($("#chips-form"),FORM,"f");$("#f-name").oninput=gen;gen();
  $("#copy-spell").onclick=function(){var o=data(),i=o.i;copyText("SORT : "+i.n+" ("+o.f.n+")\nLune : "+i.moon+" · Jour : "+i.day+" · Bougie : "+i.col[0]+"\nHerbes : "+i.herbs+" · Pierre : "+i.stone+"\n\n"+o.f.steps(i).map(function(s,n){return(n+1)+". "+s}).join("\n")+"\n\n"+o.verse,"Sort copié")};
  function sig(){
    var up=norm($("#sig-in").value).toUpperCase().replace(/[^A-Z]/g,""),cons=up.replace(/[AEIOUY]/g,""),seen={},red="";
    for(var i=0;i<cons.length;i++)if(!seen[cons[i]]){seen[cons[i]]=1;red+=cons[i]}
    $("#sig-steps").innerHTML='<div><span>Intention</span><b>'+esc(up||"—")+'</b></div><div><span>Sans voyelles</span><b>'+esc(cons||"—")+'</b></div><div><span>Sans doublons</span><b>'+esc(red||"—")+'</b></div>';
    var A="ABCDEFGHIJKLMNOPQRSTUVWXYZ",s='<circle cx="200" cy="200" r="150" fill="none" stroke="rgba(90,66,48,.25)"/><circle cx="200" cy="200" r="178" fill="none" stroke="rgba(90,66,48,.25)"/>';
    function pt(ch){var a=A.indexOf(ch)/26*2*Math.PI-Math.PI/2;return[200+150*Math.cos(a),200+150*Math.sin(a)]}
    for(var j=0;j<26;j++){var a=j/26*2*Math.PI-Math.PI/2;s+='<text x="'+(200+166*Math.cos(a)).toFixed(1)+'" y="'+(200+166*Math.sin(a)).toFixed(1)+'" font-family="IBM Plex Mono, monospace" font-size="11" fill="'+(red.indexOf(A[j])>-1?"#8c2f2a":"rgba(90,66,48,.45)")+'" text-anchor="middle" dominant-baseline="middle">'+A[j]+'</text>'}
    if(red.length>=2){var pts=red.split("").map(pt);
      s+='<polyline points="'+pts.map(function(p){return p[0].toFixed(1)+","+p[1].toFixed(1)}).join(" ")+'" fill="none" stroke="#2e2116" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="'+pts[0][0].toFixed(1)+'" cy="'+pts[0][1].toFixed(1)+'" r="7" fill="none" stroke="#2e2116" stroke-width="3"/>';
      var e=pts[pts.length-1],b=pts[pts.length-2],dx=e[0]-b[0],dy=e[1]-b[1],L=Math.hypot(dx,dy)||1,nx=-dy/L*11,ny=dx/L*11;
      s+='<line x1="'+(e[0]+nx).toFixed(1)+'" y1="'+(e[1]+ny).toFixed(1)+'" x2="'+(e[0]-nx).toFixed(1)+'" y2="'+(e[1]-ny).toFixed(1)+'" stroke="#2e2116" stroke-width="3.2" stroke-linecap="round"/>'}
    else s+='<text x="200" y="205" text-anchor="middle" font-family="IM Fell English, Georgia, serif" font-style="italic" font-size="18" fill="#5a4230">Écris une intention plus longue</text>';
    $("#sig-svg").innerHTML=s}
  $("#sig-in").oninput=sig;sig();
}

/* ================= RITUELS, SABBATS ================= */
function ritualHTML(r,h1){var T=h1?"h1":"h2";
  return'<div class="ritual"><div><'+T+' class="rt40">'+esc(r.n)+'</'+T+'><div class="meta-line"><span>Durée <b>'+esc(r.dur)+'</b></span><span>Lune <b>'+esc(r.moon)+'</b></span><span>Niveau <b>'+esc(r.lvl)+'</b></span></div><p class="intro">'+esc(r.intro)+'</p><div class="kit"><p class="label">Il te faut</p><ul>'+r.kit.map(function(k){return"<li>"+esc(k)+"</li>"}).join("")+'</ul></div></div><ol class="steps">'+r.steps.map(function(s){return'<li><div><h3 class="st">'+esc(s[0])+'</h3><p>'+esc(s[1])+'</p>'+(s[2]?'<p class="say">« '+esc(s[2])+' »</p>':'')+'</div></li>'}).join("")+'</ol></div>'}
function sabHTML(sb,h1){var T=h1?"h1":"h2";
  return'<p class="label">Sabbat</p><'+T+' class="rt46">'+esc(sb.n)+'</'+T+'><p class="when">'+esc(sb.when)+'</p><p class="alias">'+esc(sb.alias)+'</p><div class="txt">'+sb.t.map(function(p){return"<p>"+esc(p)+"</p>"}).join("")+'</div>'
   +'<div class="corr"><div><span class="label">Couleurs</span>'+esc(sb.cols)+'</div><div><span class="label">Herbes</span>'+esc(sb.herbs)+'</div><div><span class="label">Pierres</span>'+esc(sb.stones)+'</div><div><span class="label">À table</span>'+esc(sb.food)+'</div><div><span class="label">Divinités</span>'+esc(sb.gods)+'</div><div><span class="label">Symboles</span>'+esc(sb.sym)+'</div></div>'
   +'<div class="two"><div><h3 class="t4">Célébrer '+esc(sb.n)+'</h3><ol>'+sb.rit.map(function(r){return"<li>"+esc(r)+"</li>"}).join("")+'</ol></div><div class="cook"><p class="label" style="color:var(--sepia-3)">Recette de saison</p><h3 class="t4" style="margin:4px 0 6px">'+esc(sb.rec[0])+'</h3><p>'+esc(sb.rec[1])+'</p></div></div>'
   +(h1?'':'<p class="more"><a class="btn small" href="/sabbats/'+sb.slug+'/">Lire la page de '+esc(sb.n)+' →</a></p>')
   +(h1&&sb.more?moreHTML(sb):'')}
function daysTo(m,d){var now=new Date(),t=new Date(now.getFullYear(),m,d),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());if(t<today)t=new Date(now.getFullYear()+1,m,d);return Math.round((t-today)/864e5)}
function moreHTML(sb){var M=sb.more,n=daysTo(sb.m,sb.d),lk=function(id){var s=byId(SPELLS,id);return s?' <a href="'+spellUrl(s)+'">'+esc(s.n)+' →</a>':''};
  return'<div class="countdown"><span class="label">Compte à rebours</span><b id="cd">'+(n===0?"C’est ce soir":"J – "+n)+'</b><span>'+(n===0?"La nuit de "+esc(sb.n)+" commence au coucher du soleil.":n+" jour"+(n>1?"s":"")+" avant la nuit de "+esc(sb.n)+", le 31 octobre.")+'</span></div>'
  +imgHTML(PLACE.samhain)+'<h2 class="sub t30">La nuit du 31, heure par heure</h2><ol class="timeline night">'+M.night.map(function(x){return'<li><span class="yr">'+esc(x[0])+'</span><div><p>'+esc(x[1])+lk(x[2])+'</p></div></li>'}).join("")+'</ol>'
  +'<h2 class="sub t30">Les sorts de Samhain</h2><div class="linkgrid">'+SPELLS.filter(function(s){return s.ch==="samhain"}).concat(SPELLS.filter(function(s){return s.id==="pelure"})).map(function(s){return'<a class="lcard" href="'+spellUrl(s)+'"><b>'+esc(s.n)+'</b><span>'+esc(s.sub)+'</span><em>'+stars(s.lvl)+' · '+esc(s.dur)+'</em></a>'}).join("")+'</div>'
  +'<h2 class="sub t30">De Samhain à Halloween</h2><div class="hist">'+M.history.map(function(h){return'<div><h3 class="t21">'+esc(h[0])+'</h3><p>'+esc(h[1])+'</p></div>'}).join("")+'</div>'
  +'<h2 class="sub t30">À table pour Samhain</h2><div class="recs">'+M.recipes.map(function(r){return'<article class="rec"><p class="label">Recette</p><h3 class="t24">'+esc(r[0])+'</h3><p style="font-size:15px">'+esc(r[1])+'</p>'+(r[2]?'<p style="margin-top:8px"><a style="color:var(--redink)" href="'+spellUrl(byId(SPELLS,r[2]))+'">Voir la recette →</a></p>':'')+'</article>'}).join("")+'</div>'}
function initWheel(){
  var wheel=$("#wheel"),s='<circle cx="200" cy="200" r="168" fill="none" stroke="#3a3249"/><circle cx="200" cy="200" r="120" fill="none" stroke="#3a3249" stroke-dasharray="2 5"/><circle cx="200" cy="200" r="74" fill="#1d1928" stroke="#3a3249"/>';
  SAB.forEach(function(sb){var a=doyAngle(sb.m,sb.d)*Math.PI/180;s+='<line x1="'+(200+74*Math.sin(a)).toFixed(1)+'" y1="'+(200-74*Math.cos(a)).toFixed(1)+'" x2="'+(200+168*Math.sin(a)).toFixed(1)+'" y2="'+(200-168*Math.cos(a)).toFixed(1)+'" stroke="#3a3249"/>'});
  [["HIVER",45],["PRINTEMPS",135],["ÉTÉ",225],["AUTOMNE",315]].forEach(function(l){var a=l[1]*Math.PI/180;s+='<text x="'+(200+97*Math.sin(a)).toFixed(1)+'" y="'+(200-97*Math.cos(a)).toFixed(1)+'" fill="#8a8095" font-family="IBM Plex Mono, monospace" font-size="9" letter-spacing="1.5" text-anchor="middle" dominant-baseline="middle">'+l[0]+'</text>'});
  var now=new Date(),ta=doyAngle(now.getMonth(),now.getDate(),now.getFullYear())*Math.PI/180;
  s+='<line x1="'+(200+74*Math.sin(ta)).toFixed(1)+'" y1="'+(200-74*Math.cos(ta)).toFixed(1)+'" x2="'+(200+186*Math.sin(ta)).toFixed(1)+'" y2="'+(200-186*Math.cos(ta)).toFixed(1)+'" stroke="#d9a95b" stroke-width="2.5" stroke-linecap="round"/>';
  $("#wheel-svg").innerHTML=s;$("#today-label").textContent=now.toLocaleDateString("fr-FR",{day:"numeric",month:"long"});
  wheel.querySelectorAll(".sab").forEach(function(b){b.remove()});
  SAB.forEach(function(sb){var a=doyAngle(sb.m,sb.d)*Math.PI/180,b=document.createElement("button");b.type="button";b.className="sab";b.textContent=sb.n;b.id="sab-"+sb.id;b.style.left=(50+42*Math.sin(a))+"%";b.style.top=(50-42*Math.cos(a))+"%";b.onclick=function(){show(sb.id)};wheel.appendChild(b)});
  function show(id){var sb=byId(SAB,id);document.querySelectorAll(".sab").forEach(function(b){b.setAttribute("aria-pressed",b.id==="sab-"+id?"true":"false")});$("#sab-detail").innerHTML=sabHTML(sb,false)}
  show(nextSabbat().sb.id);
}

/* ================= DIVINATION ================= */
function cardArt(num){var n=(num%5)+5,pts=[];for(var i=0;i<n*2;i++){var a=i/(n*2)*2*Math.PI-Math.PI/2,r=i%2?17:38;pts.push((50+r*Math.cos(a)).toFixed(1)+","+(50+r*Math.sin(a)).toFixed(1))}
  return'<svg class="art" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="#8c2f2a" stroke-width="1.2" stroke-dasharray="1 3"/><polygon points="'+pts.join(" ")+'" fill="rgba(140,47,42,.12)" stroke="#2e2116" stroke-width="1.4"/><circle cx="50" cy="50" r="7" fill="#8c2f2a"/></svg>'}
var TIMG=window.TAROTIMG||{};
function draw(){var idx=[],pos=["Le passé","Le présent","L’avenir"];while(idx.length<3){var k=Math.floor(Math.random()*22);if(idx.indexOf(k)<0)idx.push(k)}
  $("#tarot").innerHTML=idx.map(function(k,j){var c=TAROT[k],rev=Math.random()<0.3;return'<div class="tcard"><p class="pos">'+pos[j]+'</p>'+(TIMG[k]?'<div class="tface hasimg'+(rev?" rev":"")+'"><img src="'+TIMG[k]+'" width="240" height="440" alt="'+esc(c[1])+', tarot de Marseille"></div>':'<div class="tface'+(rev?" rev":"")+'"><span class="num">'+c[0]+'</span>'+cardArt(k)+'<span class="nm">'+esc(c[1])+'</span></div>')+'<p class="tread"><b>'+esc(c[1])+(rev?" (renversée)":"")+'</b><br>'+esc(rev?c[3]:c[2])+'</p></div>'}).join("")}

/* ================= RENDUS PAR PAGE ================= */
var R={
 home:function(){
  renderMoon();
  $("#hero-count").innerHTML='<span><b>'+SPELLS.length+'</b>sorts</span><span><b>'+CHAPTERS.length+'</b>chapitres</span><span><b>'+RIT.length+'</b>rituels</span><span><b>8</b>sabbats</span><span><b>'+RECIPES.length+'</b>recettes</span>';
  var cs=CHAPTERS.filter(function(c){return c.id==="samhain"}).concat(CHAPTERS.filter(function(c){return c.id!=="samhain"}));
  $("#chapcards").innerHTML=cs.map(function(c){var n=SPELLS.filter(function(s){return s.ch===c.id}).length,se=c.id==="samhain";return'<a class="chapcard'+(se?' season':'')+'" href="'+(se?'/sabbats/samhain/':'/sorts/#'+c.id)+'"><i style="background:'+c.c+'">'+c.r+'</i><span><b>'+esc(c.n)+'</b><span>'+(se?'De saison · '+n+' sorts pour la nuit du 31 octobre':n+' sorts')+'</span></span></a>'}).join("");
  var ns=nextSabbat();$("#sabteaser").innerHTML='<div><p class="label">Prochain sabbat</p><h3>'+esc(ns.sb.n)+'</h3></div><p>'+esc(ns.sb.when)+(ns.days>0?" · dans "+ns.days+" jour"+(ns.days>1?"s":""):" · aujourd’hui")+'. '+esc(ns.sb.t[0])+'</p><a class="btn" href="/sabbats/'+ns.sb.slug+'/">Préparer '+esc(ns.sb.n)+'</a>';
 },
 livre:initBook,
 sorts:function(){
  $("#spell-index").innerHTML=CHAPTERS.map(function(c){return'<div class="idx-ch" id="'+c.id+'"><h2 class="t26"><i>'+c.r+'</i>'+esc(c.n)+'</h2><p class="subintro" style="margin:0 0 16px">'+esc(c.i)+'</p><div class="linkgrid">'+ORDER.filter(function(s){return s.ch===c.id}).map(function(s){return'<a class="lcard" href="'+spellUrl(s)+'"><b>'+esc(s.n)+'</b><span>'+esc(s.sub)+'</span><em>'+stars(s.lvl)+' · '+esc(s.moon)+' · '+esc(s.dur)+'</em></a>'}).join("")+'</div></div>'}).join("");
 },
 sort:function(){
  var s=byId(SPELLS,PID),k=ORDER.indexOf(s),c=CH[s.ch];
  $("#spread").innerHTML=spreadSpell(s,{h1:true,solo:true,first:true});
  var pv=ORDER[k-1],nx=ORDER[k+1];
  $("#prevnext").innerHTML=(pv?'<a href="'+spellUrl(pv)+'"><span>← Sort précédent</span><b>'+esc(pv.n)+'</b></a>':'<span></span>')+(nx?'<a class="nx" href="'+spellUrl(nx)+'"><span>Sort suivant →</span><b>'+esc(nx.n)+'</b></a>':'');
  $("#related-t").textContent="Autres sorts du chapitre « "+c.n+" »";
  $("#related").innerHTML=ORDER.filter(function(x){return x.ch===s.ch&&x!==s}).map(function(x){return'<a class="lcard" href="'+spellUrl(x)+'"><b>'+esc(x.n)+'</b><span>'+esc(x.sub)+'</span><em>'+stars(x.lvl)+' · '+esc(x.moon)+'</em></a>'}).join("");
 },
 atelier:initForge,
 rituels:function(){$("#rit-index").innerHTML=RIT.map(function(r){return'<a class="lcard" href="/rituels/'+r.slug+'/"><b>'+esc(r.n)+'</b><span>'+esc(r.intro.split(". ")[0])+'.</span><em>'+esc(r.dur)+' · '+esc(r.moon)+' · '+esc(r.lvl)+'</em></a>'}).join("")},
 rituel:function(){var r=byId(RIT,PID),k=RIT.indexOf(r),pv=RIT[k-1],nx=RIT[k+1];
  $("#rit-panel").innerHTML=ritualHTML(r,true);
  $("#prevnext").innerHTML=(pv?'<a href="/rituels/'+pv.slug+'/"><span>← Rituel précédent</span><b>'+esc(pv.n)+'</b></a>':'<span></span>')+(nx?'<a class="nx" href="/rituels/'+nx.slug+'/"><span>Rituel suivant →</span><b>'+esc(nx.n)+'</b></a>':'')},
 sabbats:function(){initWheel();$("#sabrow").innerHTML=SAB.map(function(sb){return'<a href="/sabbats/'+sb.slug+'/">'+esc(sb.n)+'</a>'}).join("")},
 sabbat:function(){var sb=byId(SAB,PID);$("#sab-detail").innerHTML=sabHTML(sb,true);$("#sabrow").innerHTML=SAB.map(function(x){return'<a href="/sabbats/'+x.slug+'/"'+(x===sb?' aria-current="page"':'')+'>'+esc(x.n)+'</a>'}).join("")},
 outils:function(){$("#tools").innerHTML=TOOLS.map(function(t){return'<article class="card"><p class="label">'+esc(t.e)+'</p><h2 class="t25">'+esc(t.n)+'</h2><p>'+esc(t.t)+'</p><p class="alt">'+esc(t.a)+'</p></article>'}).join("")},
 recettes:function(){$("#recs").innerHTML=RECIPES.map(function(r){return'<article class="rec"><p class="label">'+esc(r.c)+'</p><h2 class="t24">'+esc(r.n)+'</h2><dl><div><dt>Ingrédients</dt><dd>'+esc(r.ing)+'</dd></div><div><dt>Préparation</dt><dd>'+esc(r.m)+'</dd></div><div><dt>Usages</dt><dd>'+esc(r.u)+'</dd></div></dl></article>'}).join("")},
 divination:function(){
  $("#draw").onclick=draw;draw();
  $("#arcana").innerHTML=TAROT.map(function(c,n){return'<div><i>'+(TIMG[n]?'<img src="'+TIMG[n]+'" width="44" height="81" loading="lazy" alt="">':c[0])+'</i><span><b>'+esc(c[1])+'</b><br>'+esc(c[2])+'<small>Renversée : '+esc(c[3])+'</small></span></div>'}).join("");
  $("#candle").innerHTML=CANDLE.map(function(c){return"<tr><td>"+esc(c[0])+"</td><td>"+esc(c[1])+"</td></tr>"}).join("");
  $("#symbols").innerHTML=SYMBOLS.map(function(s){return"<div><b>"+esc(s[0])+"</b>"+esc(s[1])+"</div>"}).join("")},
 correspondances:function(){
  $("#days").innerHTML=DAYS.map(function(d){return"<tr><td>"+d[0]+"</td><td>"+d[1]+" "+d[2]+"</td><td>"+d[3]+"</td><td>"+d[4]+"</td><td>"+d[5]+"</td></tr>"}).join("");
  $("#elements").innerHTML=ELEMENTS.map(function(d){return"<tr>"+d.map(function(x){return"<td>"+esc(x)+"</td>"}).join("")+"</tr>"}).join("");
  $("#colors").innerHTML=COLORS.map(function(c){return'<div class="sw"><i style="background:'+c[1]+'"></i><span><b>'+c[0]+'</b>'+esc(c[2])+'</span></div>'}).join("");
  function il(n){var L=window.INGLINK||{},k=L[norm(n)];return k?'<a href="/ingredients/'+k+'/">'+esc(n)+'</a>':esc(n)}
  $("#herbs").innerHTML=HERBS.map(function(h){return"<dt>"+il(h[0])+"</dt><dd>"+esc(h[1])+"</dd>"}).join("");
  $("#stones").innerHTML=STONES.map(function(h){return"<dt>"+il(h[0])+"</dt><dd>"+esc(h[1])+"</dd>"}).join("");
  $("#phases").innerHTML=[[0.02,"Nouvelle lune","Intentions, commencements, silence"],[0.14,"Premier croissant","Attirer, faire grandir, oser"],[0.25,"Premier quartier","Décider, persévérer, agir"],[0.37,"Gibbeuse croissante","Peaufiner, nourrir, patienter"],[0.5,"Pleine lune","Charger, remercier, deviner"],[0.63,"Gibbeuse décroissante","Partager, transmettre, trier"],[0.75,"Dernier quartier","Couper, bannir, pardonner"],[0.87,"Dernier croissant","Purifier, se reposer, lâcher"]].map(function(l){return'<div class="phase"><svg viewBox="-2 -2 104 104" aria-hidden="true">'+moonSVG(l[0],false)+'</svg><h3 class="t18">'+l[1]+'</h3><p>'+l[2]+'</p></div>'}).join("");
  $("#moons").innerHTML=MOONS.map(function(m){return'<div><span class="label">'+m[0]+'</span><b>'+esc(m[1])+'</b><span>'+esc(m[2])+'</span></div>'}).join("")},
 histoire:function(){$("#eras").innerHTML=ERAS.map(function(e){return'<div class="era"><div class="era-h"><h2 class="t32">'+esc(e.n)+'</h2><span>'+esc(e.d)+'</span></div><ol class="timeline">'+e.items.map(function(it){return'<li><span class="yr">'+esc(it[0])+'</span><div><h3 class="t21">'+esc(it[1])+'</h3><p>'+esc(it[2])+(DLINK[it[1]]?' <a href="'+DLINK[it[1]]+'">Lire le dossier →</a>':'')+'</p>'+(PLACE.hist[it[1]]?imgHTML(PLACE.hist[it[1]],"plate hist-fig"):'')+'</div></li>'}).join("")+'</ol></div>'}).join("")},
 figures:function(){
  var G=[["","Toutes"],["mythe","Mythes & légendes"],["histoire","Accusées & devineresses"],["renouveau","Le renouveau"]],cur="";
  function render(){$("#figs").innerHTML=FIGURES.filter(function(f){return!cur||f.g===cur}).map(function(f){var im=(window.IMG||{})[PLACE.fig[f.n]];return'<article class="card">'+(im?'<div class="cardimg"><img src="'+im.src2+'" width="'+im.w+'" height="'+im.h+'" loading="lazy" alt="'+esc(im.cap)+'" title="'+esc(im.cap)+'"></div>':'')+'<p class="label">'+esc(f.o)+'</p><h2 class="t25">'+esc(f.n)+'</h2><p>'+esc(f.t)+'</p><p class="k">'+esc(f.k)+'</p>'+(DLINK[f.n]?'<p class="k"><a href="'+DLINK[f.n]+'">Lire le dossier →</a></p>':'')+'</article>'}).join("");document.querySelectorAll("#fig-tabs button").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.g===cur?"true":"false")})}
  $("#fig-tabs").innerHTML=G.map(function(g){return'<button type="button" data-g="'+g[0]+'">'+g[1]+'</button>'}).join("");
  $("#fig-tabs").onclick=function(e){var b=e.target.closest("button");if(!b)return;cur=b.dataset.g;render()};render()},
 glossaire:function(){$("#gloss").innerHTML=GLOSS.slice().sort(function(a,b){return a[0].localeCompare(b[0],"fr")}).map(function(g){return"<div><dt>"+esc(g[0])+"</dt><dd>"+esc(g[1])+"</dd></div>"}).join("")},
 apropos:function(){$("#sources-list").innerHTML=SOURCES.map(function(s){return'<li><a href="'+s[1]+'" target="_blank" rel="noopener">'+esc(s[0])+'</a> — '+esc(s[2])+'</li>'}).join("")}
};
if(R[PAGE])R[PAGE]();
})();
