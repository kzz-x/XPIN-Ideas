/** Upload every original texture, sharing a small main-thread budget between
 * paints. A single driver upload cannot be preempted; it ends that batch if
 * expensive. The final yield also separates uploads from shader compilation. */
export async function warmTextures(renderer,textures,{onUploaded=()=>{},budgetMs=3,maxPerPaint=4,now=()=>performance.now(),nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve))}={}){
  const list=[...textures];let started=now(),batch=0,completed=0;
  for(const texture of list){
    renderer.initTexture(texture);onUploaded(++completed,list.length);batch++;
    if(batch>=maxPerPaint||now()-started>=budgetMs||completed===list.length){
      await nextFrame();started=now();batch=0;
    }
  }
  return completed;
}
