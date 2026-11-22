/* UzakMasa v15 yukleyici: gorunum + cift dokunus korumasi, sonra ana kod */
(function(){
  var m=document.querySelector('meta[name=viewport]'); if(m) m.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  var l=document.createElement('link'); l.rel='stylesheet'; l.href='/style2.css?v=15'; document.head.appendChild(l);
  var l3=document.createElement('link'); l3.rel='stylesheet'; l3.href='/style3.css?v=16'; document.head.appendChild(l3);
  (function(){
    var stop=function(e){e.preventDefault()};
    ['gesturestart','gesturechange','gestureend','dblclick'].forEach(function(n){document.addEventListener(n,stop,{passive:false})});
    var last=0;
    document.addEventListener('touchend',function(e){
      var now=Date.now(); if(now-last<350 && e.target.tagName!=='INPUT' && e.target.tagName!=='TEXTAREA') e.preventDefault(); last=now;
    },{passive:false});
    document.addEventListener('touchmove',function(e){ if(e.touches.length>1 && !(e.target.closest && e.target.closest('#vwrap'))) e.preventDefault(); },{passive:false});
  })();
  var s=document.createElement('script'); s.src='/app-core.js?v=18'; s.async=false; document.body.appendChild(s);
  var t=document.createElement('script'); t.src='/term-fix.js?v=151'; t.async=false; document.body.appendChild(t);
  var u=document.createElement('script'); u.src='/ui.js?v=17'; u.async=false; document.body.appendChild(u);
})();
