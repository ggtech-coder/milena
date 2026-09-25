(() => {
  const state = {
    services: [],
    selectedService: null,
    selectedDate: null,
    selectedTime: null,
    paymentMethod: "pix",
    appointmentId: null,
    paymentId: null,
    pollTimer: null,
    expiresAt: null,
  };

  const fmtBRL = (cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const el = (id) => document.getElementById(id);
  const alertBox = el("bkAlert");

  function showAlert(msg, type = "error") {
    alertBox.innerHTML = `<div class="alert alert-${type === "error" ? "error" : "info"}">${msg}</div>`;
  }
  function clearAlert() { alertBox.innerHTML = ""; }

  // ---------- Passos ----------
  function goToStep(n) {
    document.querySelectorAll(".bk-step").forEach((s) => s.classList.toggle("active", s.dataset.step === String(n)));
    document.querySelectorAll(".booking-steps-indicator .dot").forEach((d) => d.classList.toggle("active", Number(d.dataset.dot) <= n));
    clearAlert();
  }
  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(Number(btn.dataset.back)));
  });

  // ---------- Carrega serviços ----------
  async function loadServices() {
    const grid = el("servicesGrid");
    try {
      const snap = await db.collection("services").where("active", "==", true).orderBy("order", "asc").get();
      state.services = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (state.services.length === 0) {
        grid.innerHTML = `<p style="text-align:center;color:var(--gray)">Nenhum serviço cadastrado ainda.</p>`;
        return;
      }
      grid.innerHTML = state.services.map((s) => `
        <div class="service-card" data-id="${s.id}">
          <h3>${s.name}</h3>
          <p class="desc">${s.description || ""}</p>
          <div class="meta">
            <span class="price">${fmtBRL(s.priceCents)}</span>
            <span class="duration">${s.durationMinutes} min</span>
          </div>
        </div>`).join("");

      grid.querySelectorAll(".service-card").forEach((card) => {
        card.addEventListener("click", () => selectService(card.dataset.id));
      });
    } catch (err) {
      console.error(err);
      grid.innerHTML = `<p style="text-align:center;color:var(--danger)">Não foi possível carregar os serviços.</p>`;
    }
  }

  function selectService(id) {
    state.selectedService = state.services.find((s) => s.id === id);
    document.querySelectorAll(".service-card").forEach((c) => c.classList.toggle("selected", c.dataset.id === id));

    el("selectedServiceSummary").innerHTML = `
      <div><span>${state.selectedService.name}</span><span>${fmtBRL(state.selectedService.priceCents)}</span></div>
      <div><span>Duração</span><span>${state.selectedService.durationMinutes} min</span></div>`;
    el("toStep2").disabled = false;
    document.getElementById("agendamento").scrollIntoView({ behavior: "smooth" });
  }

  el("toStep2").addEventListener("click", () => goToStep(2));

  // ---------- Data ----------
  const dateInput = el("dateInput");
  const todayISO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10); // horário de Brasília aproximado
  dateInput.min = todayISO;
  dateInput.addEventListener("change", () => {
    state.selectedDate = dateInput.value;
    el("toStep3").disabled = !state.selectedDate;
  });

  el("toStep3").addEventListener("click", async () => {
    goToStep(3);
    await loadTimeSlots();
  });

  // ---------- Horários ----------
  async function loadTimeSlots() {
    const wrap = el("timeSlots");
    wrap.innerHTML = `<div class="spinner" style="border-top-color:var(--burnt-rose)"></div>`;
    el("toStep4").disabled = true;
    try {
      const getAvailability = functions.httpsCallable("getAvailability");
      const res = await getAvailability({ date: state.selectedDate, serviceId: state.selectedService.id });
      const slots = res.data.slots || [];
      if (slots.length === 0) {
        wrap.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--gray)">Nenhum horário disponível nesta data. Tente outro dia.</p>`;
        return;
      }
      wrap.innerHTML = slots.map((t) => `<div class="time-slot" data-time="${t}">${t}</div>`).join("");
      wrap.querySelectorAll(".time-slot").forEach((slot) => {
        slot.addEventListener("click", () => {
          wrap.querySelectorAll(".time-slot").forEach((s) => s.classList.remove("selected"));
          slot.classList.add("selected");
          state.selectedTime = slot.dataset.time;
          el("toStep4").disabled = false;
        });
      });
    } catch (err) {
      console.error(err);
      wrap.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--danger)">Erro ao buscar horários. Tente novamente.</p>`;
    }
  }

  el("toStep4").addEventListener("click", () => {
    goToStep(4);
    renderOrderSummary();
  });

  function renderOrderSummary() {
    el("orderSummary").innerHTML = `
      <div><span>${state.selectedService.name}</span><span>${fmtBRL(state.selectedService.priceCents)}</span></div>
      <div><span>Data</span><span>${formatDateBR(state.selectedDate)}</span></div>
      <div><span>Horário</span><span>${state.selectedTime}</span></div>
      <div class="total"><span>Total</span><span>${fmtBRL(state.selectedService.priceCents)}</span></div>`;
  }

  function formatDateBR(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  // ---------- Forma de pagamento ----------
  document.querySelectorAll(".pm-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".pm-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      state.paymentMethod = opt.dataset.method;
      el("cardFields").style.display = state.paymentMethod === "card" ? "block" : "none";
    });
  });

  // ---------- Enviar agendamento ----------
  el("submitBooking").addEventListener("click", async () => {
    clearAlert();
    const name = el("custName").value.trim();
    const phone = el("custPhone").value.trim();
    const email = el("custEmail").value.trim();

    if (!name || !phone || !email) {
      showAlert("Preencha nome, telefone e e-mail para continuar.");
      return;
    }

    const btn = el("submitBooking");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Processando...`;

    try {
      const createBooking = functions.httpsCallable("createBooking");
      const payload = {
        serviceId: state.selectedService.id,
        date: state.selectedDate,
        startTime: state.selectedTime,
        customer: { name, phone, email },
        paymentMethod: state.paymentMethod,
      };
      // OBS: para cartão, o token deve ser gerado pelo Mercado Pago Bricks
      // no navegador (nunca envie número de cartão ao seu backend). Ver
      // documentação do Checkout Bricks para plugar aqui o cardToken.
      const res = await createBooking(payload);
      state.appointmentId = res.data.appointmentId;
      state.paymentId = res.data.paymentId;
      state.expiresAt = res.data.expiresAt;

      goToStep(5);
      renderPaymentArea(res.data);
      startStatusPolling();
    } catch (err) {
      console.error(err);
      const msg = (err && err.message) || "";
      if (msg.includes("SLOT_TAKEN")) {
        showAlert("Este horário acabou de ser reservado. Escolha outro horário.");
        goToStep(3);
        loadTimeSlots();
      } else {
        showAlert("Não foi possível concluir o agendamento. Tente novamente.");
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = "Pagar e agendar";
    }
  });

  function renderPaymentArea(data) {
    const area = el("paymentArea");
    if (state.paymentMethod === "pix" && data.pix) {
      area.innerHTML = `
        <div class="pix-box">
          <h3>Pague com Pix para confirmar</h3>
          <img src="data:image/png;base64,${data.pix.qrCodeBase64}" alt="QR Code Pix">
          <p>Ou copie o código abaixo:</p>
          <div class="pix-code">${data.pix.qrCode}</div>
          <button class="btn btn-outline" id="copyPixBtn">Copiar código Pix</button>
          <div class="timer" id="expireTimer"></div>
          <p style="color:var(--gray);font-size:13px">Assim que o pagamento for identificado, a confirmação aparece aqui automaticamente.</p>
        </div>`;
      el("copyPixBtn").addEventListener("click", () => {
        navigator.clipboard.writeText(data.pix.qrCode);
        el("copyPixBtn").textContent = "Copiado!";
      });
      startExpireCountdown(data.expiresAt);
    } else {
      area.innerHTML = `
        <div class="pix-box">
          <h3>Processando pagamento...</h3>
          <div class="spinner" style="border-top-color:var(--burnt-rose);margin:20px auto"></div>
          <p style="color:var(--gray);font-size:13px">Aguarde a confirmação do seu cartão.</p>
        </div>`;
    }
  }

  function startExpireCountdown(expiresAtISO) {
    if (!expiresAtISO) return;
    const target = new Date(expiresAtISO).getTime();
    const timerEl = el("expireTimer");
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        if (timerEl) timerEl.textContent = "Tempo esgotado. Reinicie o agendamento.";
        clearInterval(interval);
        clearInterval(state.pollTimer);
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (timerEl) timerEl.textContent = `Reserva válida por mais ${m}:${String(s).padStart(2, "0")}`;
    };
    tick();
    const interval = setInterval(tick, 1000);
  }

  function startStatusPolling() {
    // Consulta pontual (não realtime) para economizar leituras do Firestore.
    // O appointment não é legível pelo cliente (regra de segurança), então
    // usamos uma function pública dedicada para checar status.
    state.pollTimer = setInterval(async () => {
      try {
        const checkStatus = functions.httpsCallable("checkAppointmentStatus");
        const res = await checkStatus({ appointmentId: state.appointmentId });
        if (res.data.status === "CONFIRMED") {
          clearInterval(state.pollTimer);
          renderConfirmation(res.data);
        } else if (["CANCELLED", "EXPIRED"].includes(res.data.status)) {
          clearInterval(state.pollTimer);
          el("paymentArea").innerHTML = `<div class="alert alert-error">Pagamento não concluído. Reinicie o agendamento.</div>`;
        }
      } catch (err) {
        console.error(err);
      }
    }, 5000);
  }

  function renderConfirmation(data) {
    el("paymentArea").innerHTML = `
      <div class="confirmation-box">
        <div class="check">✓</div>
        <h3>Agendamento confirmado!</h3>
        <div class="summary-box" style="text-align:left">
          <div><span>Cliente</span><span>${el("custName").value}</span></div>
          <div><span>Serviço</span><span>${state.selectedService.name}</span></div>
          <div><span>Data</span><span>${formatDateBR(state.selectedDate)}</span></div>
          <div><span>Horário</span><span>${state.selectedTime}</span></div>
          <div><span>Valor</span><span>${fmtBRL(state.selectedService.priceCents)}</span></div>
          <div><span>Código</span><span>${state.appointmentId.slice(0, 8).toUpperCase()}</span></div>
        </div>
        <p style="color:var(--gray);font-size:13px">Guarde este código. Em caso de dúvida, entre em contato pelo WhatsApp informado no site.</p>
      </div>`;
  }

  loadServices();
})();