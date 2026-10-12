// Password popup shown before the tool opens.
(function(){
  var HASH='0a2d4fc574b549fc20c997a52a99773c566ec400a11b34e40b362d0022141297', KEY='ho-unlocked';
  try{ if(localStorage.getItem(KEY)===HASH) return; }catch(e){}
  var css='#ho-gate{position:fixed;inset:0;z-index:2147483647;background:#0f172a;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Arial,Helvetica,sans-serif}'+
    '#ho-gate form{background:#fff;padding:28px 26px;width:100%;max-width:360px;border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.4)}'+
    '#ho-gate h1{font:600 20px Georgia,serif;margin:0 0 6px;color:#0f172a}#ho-gate p{margin:0 0 16px;color:#475569;font-size:14px}'+
    '#ho-gate input{width:100%;box-sizing:border-box;padding:10px 12px;font-size:15px;border:1px solid #cbd5e1;border-radius:6px}'+
    '#ho-gate button{margin-top:12px;width:100%;padding:10px;font-size:15px;border:0;border-radius:6px;background:#1d4ed8;color:#fff;cursor:pointer}'+
    '#ho-gate .err{color:#b91c1c;margin:10px 0 0;display:none}';
  function show(){
    var s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);
    var g=document.createElement('div'); g.id='ho-gate';
    g.innerHTML='<form><h1>Health Outcomes &amp; Financing Explorer</h1><p>This tool is password protected.</p>'+
      '<input type="password" placeholder="Password" autofocus required autocomplete="current-password">'+
      '<button type="submit">Open</button><p class="err">Incorrect password. Please try again.</p></form>';
    document.body.appendChild(g); document.documentElement.style.overflow='hidden';
    var inp=g.querySelector('input'); inp.focus();
    g.querySelector('form').addEventListener('submit',function(ev){
      ev.preventDefault();
      crypto.subtle.digest('SHA-256',new TextEncoder().encode(inp.value)).then(function(buf){
        var hex=Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0')}).join('');
        if(hex===HASH){ try{localStorage.setItem(KEY,HASH)}catch(e){} g.remove(); document.documentElement.style.overflow=''; }
        else { g.querySelector('.err').style.display='block'; inp.value=''; inp.focus(); }
      });
    });
  }
  if(document.body) show(); else document.addEventListener('DOMContentLoaded',show);
})();
