function l(s){if(!s)return{text:null,json:null,raw:s};const i=[];s.output&&i.push(s.output),s.outputs&&i.push(s.outputs),s.choices&&i.push(s.choices),s.output_text&&i.push(s.output_text),typeof s=="string"&&i.push(s);let t="";for(const e of i)if(e){if(typeof e=="string"){t+=(t?`
`:"")+e;continue}if(Array.isArray(e)){for(const n of e)n&&(typeof n=="string"?t+=(t?`
`:"")+n:n.text?t+=(t?`
`:"")+n.text:n.content?typeof n.content=="string"?t+=(t?`
`:"")+n.content:Array.isArray(n.content)&&(t+=(t?`
`:"")+n.content.map(o=>(o==null?void 0:o.text)||(o==null?void 0:o.content)||"").join(" ")):n.message&&n.message.content&&(typeof n.message.content=="string"?t+=(t?`
`:"")+n.message.content:Array.isArray(n.message.content)&&(t+=(t?`
`:"")+n.message.content.map(o=>(o==null?void 0:o.text)||(o==null?void 0:o.content)||"").join(" "))));continue}e.message&&e.message.content&&(typeof e.message.content=="string"?t+=(t?`
`:"")+e.message.content:Array.isArray(e.message.content)&&(t+=(t?`
`:"")+e.message.content.map(n=>(n==null?void 0:n.text)||(n==null?void 0:n.content)||"").join(" "))),e.content&&typeof e.content=="string"&&(t+=(t?`
`:"")+e.content),e.text&&typeof e.text=="string"&&(t+=(t?`
`:"")+e.text)}let c=null;if(t){const e=(()=>{const n=t.indexOf("{");if(n===-1)return null;const o=t.slice(n);try{return JSON.parse(o)}catch{const f=o.lastIndexOf("}");if(f>0){const r=o.slice(0,f+1);try{return JSON.parse(r)}catch{return null}}return null}})();e&&(c=e)}return{text:t||null,json:c,raw:s}}export{l as extractOpenAIResponse};
