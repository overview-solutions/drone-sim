// Presentation only: nested blocks preserve actual object containment and primitive types.
export function objectCard(label:string,value:unknown,depth=0):HTMLElement{
 const block=document.createElement('details');block.className='object-block depth-'+Math.min(depth,3);block.open=depth<2;
 const title=document.createElement('summary');const isArray=Array.isArray(value),isObject=value!==null&&typeof value==='object';
 title.textContent=label+' · '+(isArray?`array [${value.length}]`:isObject?'object':value===null?'null':typeof value);block.append(title);
 const content=document.createElement('div');content.className='object-fields';block.append(content);
 if(isObject){for(const [key,item] of Object.entries(value as object)){if(item!==null&&typeof item==='object')content.append(objectCard(key,item,depth+1));else{const field=document.createElement('div');field.className='object-value '+typeof item;const name=document.createElement('span'),val=document.createElement('strong');name.textContent=key;val.textContent=String(item);field.append(name,val);content.append(field);}}}else content.textContent=String(value);
 return block;
}
