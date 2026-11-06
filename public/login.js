const form=document.querySelector('#login-form'),error=document.querySelector('#login-error');
document.querySelector('#toggle-password').addEventListener('click',event=>{
  const password=document.querySelector('#password'),visible=password.type==='password';
  password.type=visible?'text':'password';event.currentTarget.textContent=visible?'Ocultar':'Mostrar';
  event.currentTarget.setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha');
});
fetch('/api/auth/me',{cache:'no-store'}).then(async response=>{
  if(response.ok){const {user}=await response.json();location.replace('/painel.html#'+(user.role==='admin'?'overview':'visits'));}
}).catch(()=>{});
form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='Entrando…';error.classList.remove('visible');
  try{
    const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.username.value,password:form.password.value})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível entrar.');
    form.password.value='';location.replace('/painel.html#'+(result.user.role==='admin'?'overview':'visits'));
  }catch(problem){error.textContent=problem instanceof TypeError?'Não foi possível conectar. Tente novamente.':problem.message;error.classList.add('visible');button.disabled=false;button.innerHTML='Entrar <span aria-hidden="true">→</span>';}
});
