document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const focusInput = document.querySelector('.log-form input[type="text"]');
  const minutesInput = document.querySelector('.log-form input[type="number"]');
  const addButton = document.querySelector('.log-form .btn');
  const logsList = document.querySelector('.logs-list');
  const summary = document.querySelector('.summary');

  const authBtn = document.getElementById('auth-btn');
  const goalsListEl = document.querySelector('.goals-list');
  const addGoalBtn = document.querySelector('.add-goal');
  const newGoalInput = document.querySelector('.new-goal');
  const gearListEl = document.querySelector('.gear-list');
  const addGearBtn = document.querySelector('.add-gear');
  const newGearInput = document.querySelector('.new-gear');
  const routineList = document.querySelectorAll('.routine-list li');

  // Storage keys
  const USERS_KEY = 'guitarUsers';
  const CURRENT_KEY = 'guitarCurrentUser';

  // --- storage helpers ---
  function loadUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('Failed to load users', e);
      return {};
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function setCurrentUser(username) {
    if (username) localStorage.setItem(CURRENT_KEY, username);
    else localStorage.removeItem(CURRENT_KEY);
    updateAuthUI();
    renderAll();
  }

  function getCurrentUser() {
    const username = localStorage.getItem(CURRENT_KEY);
    if (!username) return null;
    const users = loadUsers();
    return users[username] || null;
  }

  function createUser(username, password) {
    const users = loadUsers();
    if (users[username]) return false;
    users[username] = {
      password: btoa(password), // simple encoding; not secure for production
      data: {
        logs: [],
        goals: ["Play a full song from memory", "Master palm muting technique"],
        gear: ["Fender Stratocaster — .010"],
        routines: [false, false, false, false]
      }
    };
    saveUsers(users);
    return true;
  }

  function authenticate(username, password) {
    const users = loadUsers();
    const u = users[username];
    if (!u) return false;
    return u.password === btoa(password);
  }

  // --- UI: auth modal (create dynamically) ---
  let modal = null;
  function openAuthModal() {
    if (modal) modal.style.display = 'flex';
    else buildAuthModal();
  }

  function closeAuthModal() {
    if (modal) modal.style.display = 'none';
  }

  function buildAuthModal() {
    modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.innerHTML = `
      <div class="panel">
        <button class="close">×</button>
        <h3>Sign in / Sign up</h3>
        <input class="auth-user" placeholder="Username">
        <input class="auth-pass" placeholder="Password" type="password">
        <div style="margin-top:8px;display:flex;gap:8px;">
          <button class="btn small sign-in">Sign in</button>
          <button class="btn small sign-up">Sign up</button>
        </div>
        <p style="font-size:0.85rem;margin-top:8px;color:#9a9a9a">Note: this demo stores account data locally in your browser (not secure). Useful for personalization only.</p>
      </div>`;
    document.body.appendChild(modal);
    modal.style.display = 'flex';

    modal.querySelector('.close').addEventListener('click', closeAuthModal);
    modal.querySelector('.sign-up').addEventListener('click', () => {
      const u = modal.querySelector('.auth-user').value.trim();
      const p = modal.querySelector('.auth-pass').value;
      if (!u || !p) return alert('Fill username and password');
      const ok = createUser(u, p);
      if (!ok) return alert('User already exists');
      setCurrentUser(u);
      closeAuthModal();
      alert('Account created and signed in');
    });
    modal.querySelector('.sign-in').addEventListener('click', () => {
      const u = modal.querySelector('.auth-user').value.trim();
      const p = modal.querySelector('.auth-pass').value;
      if (!u || !p) return alert('Fill username and password');
      if (!authenticate(u, p)) return alert('Invalid credentials');
      setCurrentUser(u);
      closeAuthModal();
    });
  }

  function updateAuthUI() {
    const username = localStorage.getItem(CURRENT_KEY);
    if (username) {
      authBtn.textContent = `Log out (${username})`;
      authBtn.onclick = () => { if (confirm('Log out?')) setCurrentUser(null); };
    } else {
      authBtn.textContent = 'Log in';
      authBtn.onclick = openAuthModal;
    }
  }

  // --- per-user helpers ---
  function getUserData() {
    const username = localStorage.getItem(CURRENT_KEY);
    if (!username) return null;
    const users = loadUsers();
    return users[username] ? users[username].data : null;
  }

  function saveUserData(data) {
    const username = localStorage.getItem(CURRENT_KEY);
    if (!username) return;
    const users = loadUsers();
    if (!users[username]) users[username] = { password: btoa(''), data };
    else users[username].data = data;
    saveUsers(users);
  }

  // --- render functions ---
  function formatDate(ts) { return new Date(ts).toLocaleString(); }

  function renderLogs() {
    const data = getUserData();
    const logs = data ? (data.logs || []) : [];
    logsList.innerHTML = '';
    if (!logs.length) {
      logsList.innerHTML = '<li class="empty">No sessions yet. Add one after logging in.</li>';
      summary.textContent = '';
      return;
    }
    let total = 0;
    logs.slice().sort((a,b) => b.ts - a.ts).forEach(log => {
      total += Number(log.minutes) || 0;
      const li = document.createElement('li');
      li.className = 'log-item';
      li.dataset.id = log.id;
      const left = document.createElement('div'); left.className='log-left'; left.innerHTML = `<strong>${escapeHtml(log.focus||'Untitled')}</strong> — ${escapeHtml(log.minutes)} min`;
      const right = document.createElement('div'); right.className='log-right'; right.innerHTML = `<small>${formatDate(log.ts)}</small> <button class="delete-btn">Delete</button>`;
      li.appendChild(left); li.appendChild(right); logsList.appendChild(li);
    });
    summary.textContent = `Total practice time: ${total} minutes`;
  }

  function renderGoals() {
    const data = getUserData();
    const goals = data ? (data.goals || []) : [];
    goalsListEl.innerHTML = '';
    goals.forEach((g, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(g)}</span> <button class="remove">Remove</button>`;
      li.querySelector('.remove').addEventListener('click', () => {
        if (!ensureLoggedIn()) return;
        // schedule deletion with undo
        scheduleDelete('goal', { value: g }, () => {
          const d = getUserData(); if (!d) return; const idx = (d.goals||[]).indexOf(g); if (idx !== -1) { d.goals.splice(idx,1); saveUserData(d); }
          renderGoals(); renderProgress();
        }, `Goal removed: ${g}`);
      });
      goalsListEl.appendChild(li);
    });
  }

  function renderGear() {
    const data = getUserData();
    const gear = data ? (data.gear || []) : [];
    gearListEl.innerHTML = '';
    gear.forEach((g,i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(g)}</span> <button class="remove">Remove</button>`;
      li.querySelector('.remove').addEventListener('click', () => {
        if (!ensureLoggedIn()) return;
        scheduleDelete('gear', { value: g }, () => {
          const d = getUserData(); if (!d) return; const idx = (d.gear||[]).indexOf(g); if (idx !== -1) { d.gear.splice(idx,1); saveUserData(d); }
          renderGear();
        }, `Gear removed: ${g}`);
      });
      gearListEl.appendChild(li);
    });
  }

  function renderRoutines() {
    const data = getUserData();
    const state = data ? (data.routines || [false, false, false, false]) : [false, false, false, false];
    routineList.forEach(li => {
      const idx = Number(li.dataset.index);
      const cb = li.querySelector('input[type=checkbox]');
      cb.checked = !!state[idx];
      if (cb.checked) li.classList.add('completed'); else li.classList.remove('completed');
    });
  }

  function renderProgress() {
    const data = getUserData();
    const logs = data ? (data.logs || []) : [];
    const days = 14;
    const dayMs = 24 * 60 * 60 * 1000;
    const today = new Date();
    today.setHours(0,0,0,0);

    const map = {};
    logs.forEach(l => {
      const d = new Date(l.ts);
      d.setHours(0,0,0,0);
      const key = d.toISOString().slice(0,10);
      map[key] = (map[key] || 0) + Number(l.minutes || 0);
    });

    const labels = [];
    const values = [];
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(today.getTime() - i * dayMs);
      const key = dt.toISOString().slice(0,10);
      labels.push(dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      values.push(map[key] || 0);
    }

    const canvas = document.getElementById('progressChart');
    const placeholder = document.querySelector('.chart-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    if (window.Chart && canvas) {
      const ctx = canvas.getContext('2d');
      if (window._progressChart) try { window._progressChart.destroy(); } catch(e){}
      window._progressChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Minutes',
            data: values,
            backgroundColor: 'rgba(255,138,0,0.9)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } }
        }
      });
    } else if (placeholder) {
      // fallback textual summary
      placeholder.style.display = 'block';
      placeholder.innerHTML = '<pre style="text-align:left;white-space:pre-wrap">' + labels.map((l,i)=>`${l}: ${values[i]} min`).join('\n') + '</pre>';
    }
  }

  // --- undo / toast delete functionality ---
  function scheduleDelete(kind, meta, commitFn, label) {
    if (!ensureLoggedIn()) return;
    const container = document.getElementById('toast-container');
    if (!container) return commitFn();

    const toast = document.createElement('div');
    toast.className = 'toast';
    const msg = document.createElement('div'); msg.className = 'msg'; msg.textContent = label || 'Item removed';
    const undo = document.createElement('button'); undo.className = 'undo'; undo.textContent = 'Undo';
    const close = document.createElement('button'); close.className = 'close-toast'; close.innerHTML = '&times;';
    toast.appendChild(msg); toast.appendChild(undo); toast.appendChild(close);
    container.appendChild(toast);

    let done = false;
    const timeout = setTimeout(() => {
      if (done) return; done = true; try { commitFn(); } catch(e){ console.error(e); }
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 4000);

    undo.addEventListener('click', () => {
      if (done) return; done = true; clearTimeout(timeout); if (toast.parentNode) toast.parentNode.removeChild(toast); renderAll();
    });
    close.addEventListener('click', () => { if (!done) { clearTimeout(timeout); done = true; } if (toast.parentNode) toast.parentNode.removeChild(toast); });
  }

  function renderAll() {
    updateAuthUI();
    renderLogs();
    renderGoals();
    renderGear();
    renderRoutines();
    renderProgress();
  }

  // --- actions ---
  function ensureLoggedIn() {
    if (!getCurrentUser()) { openAuthModal(); return false; }
    return true;
  }

  function addLogForCurrent(focus, minutes) {
    if (!ensureLoggedIn()) return;
    const d = getUserData();
    const entry = { id: Date.now().toString(), ts: Date.now(), focus: focus.trim(), minutes: Number(minutes) || 0 };
    d.logs = d.logs || []; d.logs.push(entry); saveUserData(d); renderLogs();
    renderProgress();
  }

  function deleteLogForCurrent(id) {
    if (!ensureLoggedIn()) return;
    const d = getUserData(); d.logs = (d.logs||[]).filter(l => l.id !== id); saveUserData(d); renderLogs();
    renderProgress();
  }

  // --- helpers ---
  function escapeHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }

  // --- event listeners ---
  addButton.addEventListener('click', () => {
    const focus = focusInput.value || '';
    const minutes = minutesInput.value || '';
    if (!focus.trim()) { focusInput.focus(); return; }
    if (!minutes || Number(minutes) <= 0) { minutesInput.focus(); return; }
    addLogForCurrent(focus, minutes);
    focusInput.value = ''; minutesInput.value = ''; focusInput.focus();
  });

  logsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
      const li = e.target.closest('.log-item'); if (!li) return; const id = li.dataset.id;
      scheduleDelete('log', { id }, () => { deleteLogForCurrent(id); }, 'Session removed');
    }
  });

  addGoalBtn.addEventListener('click', () => {
    if (!ensureLoggedIn()) return;
    const v = newGoalInput.value.trim(); if (!v) return; const d = getUserData(); d.goals = d.goals || []; d.goals.push(v); saveUserData(d); newGoalInput.value = ''; renderGoals();
  });

  addGearBtn.addEventListener('click', () => {
    if (!ensureLoggedIn()) return;
    const v = newGearInput.value.trim(); if (!v) return; const d = getUserData(); d.gear = d.gear || []; d.gear.push(v); saveUserData(d); newGearInput.value = ''; renderGear();
  });

  routineList.forEach(li => {
    const cb = li.querySelector('input[type=checkbox]');
    cb.addEventListener('change', () => {
      if (!ensureLoggedIn()) { cb.checked = !cb.checked; return; }
      const idx = Number(li.dataset.index); const d = getUserData(); d.routines = d.routines || [false, false, false, false]; d.routines[idx] = !!cb.checked; saveUserData(d); if (cb.checked) li.classList.add('completed'); else li.classList.remove('completed');
    });
  });

  // initialize auth UI and render
  updateAuthUI();
  renderAll();
});
