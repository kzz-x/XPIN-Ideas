export function createBubbleEmphasis(element,{reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches,onCue=()=>{}}={}){
 let pending=false,visible=false,animation=null,pulses=0;
 return{announce(){pending=true;},update(show){
  if(show&&(pending||!visible)){
   pending=false;pulses++;animation?.cancel();
   animation=element.animate(reduced()?[{borderColor:'#def4ff'},{borderColor:'#506273'}]:[
    {transform:'scale(.97)',borderColor:'#e2f4ff',boxShadow:'0 0 0 0 #ceeaff80'},
    {transform:'scale(1.025)',borderColor:'#e2f4ff',boxShadow:'0 0 0 7px #ceeaff22',offset:.35},
    {transform:'scale(1)',borderColor:'#506273',boxShadow:'0 0 0 13px #ceeaff00'}
   ],{duration:reduced()?350:850,easing:'cubic-bezier(.18,.8,.2,1)'});onCue();
  }visible=!!show;
 },snapshot:()=>({pending,visible,pulses})};
}
