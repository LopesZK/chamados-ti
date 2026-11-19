// public/js/firebase-rbac.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCVsTXQLhPZMWFs2UaQ_f-lO9FAjF_VrVk",
  authDomain: "chamados-ti-rbac-571a2.firebaseapp.com",
  projectId: "chamados-ti-rbac-571a2",
  storageBucket: "chamados-ti-rbac-571a2.firebasestorage.app",
  messagingSenderId: "1052412916427",
  appId: "1:1052412916427:web:ddf6771b839c9d5c92a14e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Proteção imediata de rota e carregamento do perfil RBAC
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  const userRef = doc(db, "usuarios", user.uid);
  let snap = await getDoc(userRef);

  if (!snap.exists()) {
    const inicial = {
      uid: user.uid,
      nome: user.displayName || user.email.split("@")[0],
      email: user.email,
      perfil: "user"
    };
    await setDoc(userRef, inicial);
    snap = await getDoc(userRef);
  }

  const perfilData = snap.data();
  window.usuarioFirebase = user;
  window.perfilRBAC = perfilData;

  aplicarInterfaceRBAC(user, perfilData);
});

function aplicarInterfaceRBAC(user, perfilData) {
  const { perfil, nome, email } = perfilData;

  // 1. Preenche dados do usuário no cabeçalho
  const boxUsuario = document.getElementById("firebase-user-box");
  if (boxUsuario) {
    boxUsuario.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; flex-wrap:wrap; padding:0.75rem 1rem; margin-bottom:1rem; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px;">
        <div>
          <strong style="font-size:0.9rem;">${nome}</strong>
          <span class="badge" style="margin-left:0.5rem; text-transform:uppercase;">${perfil}</span>
          <div class="muted" style="font-size:0.8rem;">${email}</div>
        </div>
        <div style="display:flex; gap:0.5rem; align-items:center;">
          ${perfil === "admin" ? `<button type="button" id="btn-abrir-gestao-usuarios" class="btn btn-secondary">Gestão de Usuários (Admin)</button>` : ""}
          <button type="button" id="btn-firebase-logout" class="btn btn-danger">Sair</button>
        </div>
      </div>
    `;

    document.getElementById("btn-firebase-logout").addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "/login.html";
    });

    const btnGestao = document.getElementById("btn-abrir-gestao-usuarios");
    if (btnGestao) {
      btnGestao.addEventListener("click", abrirPainelUsuariosAdmin);
    }
  }

  // 2. Controle da Sidebar conforme perfil
  const navTech = document.getElementById("nav-technicians");
  const navCat = document.getElementById("nav-categories");
  if (perfil === "user") {
    if (navTech) navTech.style.display = "none";
    if (navCat) navCat.style.display = "none";
  }

  // 3. Regras na tela de Detalhes do Chamado (/tickets/:id)
  const btnDelete = document.getElementById("ticket-delete");
  const quickForm = document.getElementById("quick-form");
  if (btnDelete && perfil !== "admin") {
    btnDelete.closest("form").style.display = "none";
  }
  if (quickForm && perfil === "user") {
    quickForm.closest("section").style.display = "none";
  }

  // 4. Sincroniza abertura de novo chamado com o Firestore
  const formNovoChamado = document.getElementById("ticket-form");
  if (formNovoChamado) {
    const campoSolicitante = document.getElementById("solicitante");
    const campoEmail = document.getElementById("emailSolicitante");
    const campoTecnico = document.getElementById("technicianId");

    if (campoSolicitante && !campoSolicitante.value) campoSolicitante.value = nome;
    if (campoEmail && !campoEmail.value) campoEmail.value = email;

    if (perfil === "user") {
      if (campoTecnico) campoTecnico.closest(".field").style.display = "none";
      if (campoSolicitante) campoSolicitante.readOnly = true;
      if (campoEmail) campoEmail.readOnly = true;
    }

    formNovoChamado.addEventListener("submit", async () => {
      try {
        const titulo = document.getElementById("titulo")?.value || "Chamado TI";
        const descricao = document.getElementById("descricao")?.value || "";
        const prioChecked = formNovoChamado.querySelector('input[name="prioridade"]:checked');
        const prioridade = prioChecked ? prioChecked.value : "media";

        await addDoc(collection(db, "chamados"), {
          titulo,
          descricao,
          prioridade,
          autorUid: user.uid,
          autorNome: nome,
          autorEmail: email,
          status: "Aberto",
          tecnicoResponsavel: null,
          parecerTecnico: "",
          criadoEm: serverTimestamp()
        });
      } catch (err) {
        console.error("Erro ao registrar chamado no Firestore:", err);
      }
    });
  }

  // 5. Renderiza painel do Firestore na tela de Chamados (/tickets) e Dashboard (/)
  const path = window.location.pathname;
  if (path === "/" || path.startsWith("/tickets")) {
    renderizarChamadosFirestore(user, perfilData);
  }
}

// Listagem de chamados do Firestore com filtro RBAC
async function renderizarChamadosFirestore(user, perfilData) {
  const mainEl = document.querySelector("main.main");
  if (!mainEl) return;

  if (document.getElementById("firestore-tickets-section")) return;

  const section = document.createElement("section");
  section.id = "firestore-tickets-section";
  section.className = "card";
  section.style.marginTop = "1.5rem";

  const isUser = perfilData.perfil === "user";
  const isTechOrAdmin = perfilData.perfil === "tecnico" || perfilData.perfil === "admin";
  const isAdmin = perfilData.perfil === "admin";

  section.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
      <div>
        <h2 class="form-section" style="margin:0;">Chamados na Nuvem (Firebase Firestore · Perfil: ${perfilData.perfil.toUpperCase()})</h2>
        <p class="subtitle" style="margin:0.25rem 0 0;">
          ${isUser ? "Exibindo apenas os chamados abertos por você." : "Exibindo todos os chamados registrados no sistema."}
        </p>
      </div>
      <button type="button" id="btn-novo-chamado-cloud" class="btn btn-primary">+ Abrir Chamado no Firestore</button>
    </div>

    <form id="form-cloud-ticket" class="hidden" style="margin-bottom:1.5rem; padding:1rem; background:rgba(255,255,255,0.03); border-radius:10px; border:1px solid rgba(255,255,255,0.08);">
      <div class="field">
        <label>Título do Chamado</label>
        <input type="text" id="cloud-titulo" required placeholder="Ex: Sem acesso à rede / Impressora offline">
      </div>
      <div class="field">
        <label>Prioridade</label>
        <select id="cloud-prioridade">
          <option value="Baixa">Baixa</option>
          <option value="Média" selected>Média</option>
          <option value="Alta">Alta</option>
        </select>
      </div>
      <div class="field">
        <label>Descrição</label>
        <textarea id="cloud-descricao" rows="2" required placeholder="Descreva o problema..."></textarea>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button type="submit" class="btn btn-primary">Salvar Chamado</button>
        <button type="button" id="btn-cancelar-cloud" class="btn btn-secondary">Cancelar</button>
      </div>
    </form>

    <div style="overflow-x:auto;">
      <table class="table" style="width:100%;">
        <thead>
          <tr>
            <th>Título / Descrição</th>
            <th>Solicitante</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th>Técnico / Parecer</th>
            ${isTechOrAdmin ? "<th>Ações</th>" : ""}
          </tr>
        </thead>
        <tbody id="tbody-firestore-chamados">
          <tr><td colspan="6">Carregando chamados do Firebase...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  mainEl.appendChild(section);

  const formCloud = document.getElementById("form-cloud-ticket");
  document.getElementById("btn-novo-chamado-cloud").addEventListener("click", () => {
    formCloud.classList.toggle("hidden");
  });
  document.getElementById("btn-cancelar-cloud").addEventListener("click", () => {
    formCloud.classList.add("hidden");
  });

  formCloud.addEventListener("submit", async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "chamados"), {
      titulo: document.getElementById("cloud-titulo").value.trim(),
      prioridade: document.getElementById("cloud-prioridade").value,
      descricao: document.getElementById("cloud-descricao").value.trim(),
      autorUid: user.uid,
      autorNome: perfilData.nome,
      autorEmail: user.email,
      status: "Aberto",
      tecnicoResponsavel: null,
      parecerTecnico: "",
      criadoEm: serverTimestamp()
    });
    formCloud.reset();
    formCloud.classList.add("hidden");
    carregarListaFirestore();
  });

  async function carregarListaFirestore() {
    const tbody = document.getElementById("tbody-firestore-chamados");
    const colRef = collection(db, "chamados");
    const q = isUser ? query(colRef, where("autorUid", "==", user.uid)) : query(colRef);
    const snap = await getDocs(q);

    tbody.innerHTML = "";
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Nenhum chamado encontrado no Firestore para este perfil.</td></tr>`;
      return;
    }

    snap.forEach((docSnap) => {
      const c = docSnap.data();
      const id = docSnap.id;
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td><strong>${c.titulo}</strong><br><small class="muted">${c.descricao}</small></td>
        <td>${c.autorNome}<br><small class="muted">${c.autorEmail}</small></td>
        <td><span class="badge">${c.prioridade}</span></td>
        <td>
          ${
            isTechOrAdmin
              ? `<select class="fs-status" data-id="${id}">
                  <option value="Aberto" ${c.status === "Aberto" ? "selected" : ""}>Aberto</option>
                  <option value="Em Atendimento" ${c.status === "Em Atendimento" ? "selected" : ""}>Em Atendimento</option>
                  <option value="Resolvido" ${c.status === "Resolvido" ? "selected" : ""}>Resolvido</option>
                </select>`
              : `<strong>${c.status}</strong>`
          }
        </td>
        <td>
          <small class="muted">Técnico: ${c.tecnicoResponsavel || "Não atribuído"}</small><br>
          ${
            isTechOrAdmin
              ? `<input type="text" class="fs-parecer" data-id="${id}" value="${c.parecerTecnico || ""}" placeholder="Parecer técnico..." style="margin-top:4px;">`
              : `<small>${c.parecerTecnico || "—"}</small>`
          }
        </td>
        ${
          isTechOrAdmin
            ? `<td>
                <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                  <button type="button" class="btn btn-primary btn-fs-salvar" data-id="${id}">Salvar</button>
                  ${isAdmin ? `<button type="button" class="btn btn-danger btn-fs-excluir" data-id="${id}">Excluir</button>` : ""}
                </div>
              </td>`
            : ""
        }
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll(".btn-fs-salvar").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const novoStatus = document.querySelector(`.fs-status[data-id="${id}"]`).value;
        const novoParecer = document.querySelector(`.fs-parecer[data-id="${id}"]`).value;

        await updateDoc(doc(db, "chamados", id), {
          status: novoStatus,
          parecerTecnico: novoParecer,
          tecnicoResponsavel: perfilData.nome
        });
        alert("Chamado atualizado!");
        carregarListaFirestore();
      });
    });

    document.querySelectorAll(".btn-fs-excluir").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (confirm("Deseja realmente excluir este chamado?")) {
          await deleteDoc(doc(db, "chamados", id));
          carregarListaFirestore();
        }
      });
    });
  }

  carregarListaFirestore();
}

// Painel de Gestão de Usuários (Exclusivo Admin)
async function abrirPainelUsuariosAdmin() {
  const mainEl = document.querySelector("main.main");
  if (!mainEl) return;

  let painel = document.getElementById("admin-users-panel");
  if (!painel) {
    painel = document.createElement("section");
    painel.id = "admin-users-panel";
    painel.className = "card";
    painel.style.marginBottom = "1.5rem";
    mainEl.prepend(painel);
  }

  painel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
      <h2 class="form-section" style="margin:0;">Gestão de Usuários e Perfis (Admin)</h2>
      <button type="button" id="fechar-admin-panel" class="btn btn-secondary">Fechar</button>
    </div>
    <table class="table" style="width:100%;">
      <thead>
        <tr>
          <th>Nome</th>
          <th>E-mail</th>
          <th>Perfil Atual</th>
          <th>Alterar Perfil</th>
        </tr>
      </thead>
      <tbody id="tbody-admin-usuarios">
        <tr><td colspan="4">Carregando usuários...</td></tr>
      </tbody>
    </table>
  `;

  document.getElementById("fechar-admin-panel").addEventListener("click", () => {
    painel.remove();
  });

  const snap = await getDocs(collection(db, "usuarios"));
  const tbody = document.getElementById("tbody-admin-usuarios");
  tbody.innerHTML = "";

  snap.forEach((docSnap) => {
    const u = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.nome}</td>
      <td>${u.email}</td>
      <td><span class="badge" style="text-transform:uppercase;">${u.perfil}</span></td>
      <td>
        <select class="select-role-admin" data-uid="${u.uid}">
          <option value="user" ${u.perfil === "user" ? "selected" : ""}>user</option>
          <option value="tecnico" ${u.perfil === "tecnico" ? "selected" : ""}>tecnico</option>
          <option value="admin" ${u.perfil === "admin" ? "selected" : ""}>admin</option>
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".select-role-admin").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const uid = sel.getAttribute("data-uid");
      const novoPerfil = sel.value;
      await updateDoc(doc(db, "usuarios", uid), { perfil: novoPerfil });
      alert(`Perfil atualizado para "${novoPerfil}" com sucesso!`);
      abrirPainelUsuariosAdmin();
    });
  });
}