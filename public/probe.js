(function(){
  var c=0; var started=Date.now();
  function send(type){ try{ parent.postMessage({type, c, ts:Date.now(), started }, '*'); }catch(e){} }
  send('PIM_STATIC_EXTERNAL_EARLY');
  var id = setInterval(function(){ c++; send('PIM_STATIC_EXTERNAL_STATUS'); if(c>=10) clearInterval(id); }, 1000);
})();
