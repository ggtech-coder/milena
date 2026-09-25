(() => {
"use strict";
const services=[
{id:"manicure",name:"Manicure",description:"Cuidado completo das unhas das mãos, com esmaltação em gel ou tradicional.",priceCents:3500,durationMinutes:45},
{id:"pedicure",name:"Pedicure",description:"Cuidado e acabamento para os pés, com hidratação inclusa.",priceCents:4500,durationMinutes:60},
{id:"mani-pedi",name:"Manicure + Pedicure",description:"Combo completo para mãos e pés em um único horário.",priceCents:7500,durationMinutes:100},
{id:"nail-art",name:"Unhas decoradas",description:"Nail art autoral — francesinha, glitter, aplicações e desenhos.",priceCents:6000,durationMinutes:80},
{id:"cilios",name:"Extensão de Cílios",description:"Alongamento fio a fio, com acabamento delicado e natural.",priceCents:12000,durationMinutes:120}
];
const $=id=>document.getElementById(id), state={selectedService:null,selectedDate:null,selectedTime:null,paymentMethod:"pix"};
const fmt=c=>(c/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function alert(msg,type="info"){$("bkAlert").innerHTML=`<div class="alert alert-${type}">${msg}</div>`}
function step(n){document.querySelectorAll(".bk-step").forEach(x=>x.classList.toggle("active",x.dataset.step==n));document.querySelectorAll(".booking-steps-indicator .dot").forEach(x=>x.classList.toggle("active",+x.dataset.dot<=n));if(n>1)$("agendamento").scrollIntoView({behavior:"smooth"});}
function loadServices(){$("servicesGrid").innerHTML=services.map(s=>`<div class="service-row" data-id="${s.id}"><div><h3>${esc(s.name)}</h3><p class="desc">${esc(s.description)}</p></div><span class="price">${fmt(s.priceCents)}</span><span class="duration">${s.durationMinutes} min</span><span class="pick">✓</span></div>`).join("");document.querySelectorAll(".service-row").forEach(c=>c.onclick=()=>select(c.dataset.id))}
function select(id){state.selectedService=services.find(s=>s.id===id);document.querySelectorAll(".service-row").forEach(c=>c.classList.toggle("selected",c.dataset.id===id));let s=state.selectedService;$("selectedServiceSummary").innerHTML=`<div><span>${esc(s.name)}</span><span>${fmt(s.priceCents)}</span></div><div><span>Duração</span><span>${s.durationMinutes} min</span></div>`;$("toStep2").disabled=false;$("agendamento").scrollIntoView({behavior:"smooth"})}
function slots(){let a=[];for(let h=9;h<18;h++)for(let m of [0,30])if(!(h===17&&m===30))a.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);return a}
function loadSlots(){$("timeSlots").innerHTML=slots().map(t=>`<div class="time-slot" data-time="${t}">${t}</div>`).join("");document.querySelectorAll(".time-slot").forEach(x=>x.onclick=()=>{document.querySelectorAll(".time-slot").forEach(y=>y.classList.remove("selected"));x.classList.add("selected");state.selectedTime=x.dataset.time;$("toStep4").disabled=false})}
function summary(){let s=state.selectedService;$("orderSummary").innerHTML=`<div><span>Serviço</span><span>${esc(s.name)}</span></div><div><span>Data</span><span>${new Date(state.selectedDate+"T12:00:00").toLocaleDateString("pt-BR")}</span></div><div><span>Horário</span><span>${state.selectedTime}</span></div><div class="total"><strong>Total</strong><strong>${fmt(s.priceCents)}</strong></div>`}
document.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>step(+b.dataset.back));
$("toStep2").onclick=()=>step(2);
let d=$("dateInput");d.min=new Date().toISOString().slice(0,10);d.onchange=()=>{state.selectedDate=d.value;$("toStep3").disabled=!d.value};
$("toStep3").onclick=()=>{step(3);loadSlots()};$("toStep4").onclick=()=>{step(4);summary()};
document.querySelectorAll(".pm-option").forEach(o=>o.onclick=()=>{document.querySelectorAll(".pm-option").forEach(x=>x.classList.remove("selected"));o.classList.add("selected");state.paymentMethod=o.dataset.method;$("cardFields").style.display=state.paymentMethod==="card"?"block":"none"});
$("submitBooking").onclick=()=>{let n=$("custName").value.trim(),p=$("custPhone").value.trim(),e=$("custEmail").value.trim();if(!n||!p||!e)return alert("Preencha nome, telefone e e-mail para continuar.","error");step(5);$("paymentArea").innerHTML=`<div class="confirmation-box"><div class="check">✓</div><h3>Agendamento de demonstração criado!</h3><p style="opacity:.7">O frontend está funcionando. O pagamento é simulado nesta versão.</p><div class="summary-box" style="text-align:left"><div><span>Cliente</span><span>${esc(n)}</span></div><div><span>Serviço</span><span>${esc(state.selectedService.name)}</span></div><div><span>Data</span><span>${new Date(state.selectedDate+"T12:00:00").toLocaleDateString("pt-BR")}</span></div><div><span>Horário</span><span>${state.selectedTime}</span></div><div><span>Valor</span><span>${fmt(state.selectedService.priceCents)}</span></div><div><span>Pagamento</span><span>${state.paymentMethod==="pix"?"Pix":"Cartão"}</span></div></div><button class="btn btn-primary" onclick="location.reload()">Novo agendamento</button></div>`};
loadServices();
})();
