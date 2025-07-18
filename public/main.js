let employees = [];
let currentUser = null;

async function fetchEmployees() {
  const res = await fetch('/employees');
  employees = await res.json();
  populateManagerDropdowns();
}

function populateManagerDropdowns() {
  const managerOptions = employees.map(emp =>
    `<option value="${emp.id}">${emp.name} (${emp.email})</option>`
  );
  document.getElementById('signup-manager').innerHTML = managerOptions.join('');
  document.getElementById('update-manager').innerHTML = managerOptions.join('');
}

function showLogin() {
  document.getElementById('entry-section').classList.add('hidden');
  document.getElementById('login-section').classList.remove('hidden');
  document.getElementById('login-error').textContent = '';
}
function showSignup() {
  document.getElementById('entry-section').classList.add('hidden');
  document.getElementById('signup-section').classList.remove('hidden');
  document.getElementById('signup-error').textContent = '';
  fetchEmployees();
}
function backToEntry() {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('signup-section').classList.add('hidden');
  document.getElementById('entry-section').classList.remove('hidden');
}

async function login(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const res = await fetch('/employees');
  const allEmployees = await res.json();
  const user = allEmployees.find(emp => emp.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    document.getElementById('login-error').textContent = 'Email not found. Please sign up.';
    return;
  }
  currentUser = user;
  showUpdatePage();
}

async function signup(event) {
  event.preventDefault();
  const firstName = document.getElementById('signup-firstname').value.trim();
  const lastName = document.getElementById('signup-lastname').value.trim();
  const name = firstName + ' ' + lastName;
  const email = document.getElementById('signup-email').value.trim();
  const position = document.getElementById('signup-position').value;
  const manager_ids = Array.from(document.getElementById('signup-manager').selectedOptions).map(opt => parseInt(opt.value));
  const res = await fetch('/employees');
  const allEmployees = await res.json();
  if (allEmployees.some(emp => emp.email.toLowerCase() === email.toLowerCase())) {
    document.getElementById('signup-error').textContent = 'Email already exists. Please login.';
    return;
  }
  const body = { name, email, position, manager_ids };
  const addRes = await fetch('/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (addRes.ok) {
    await fetchEmployees();
    const user = employees.find(emp => emp.email.toLowerCase() === email.toLowerCase());
    currentUser = user;
    showUpdatePage();
  } else {
    document.getElementById('signup-error').textContent = 'Error: ' + (await addRes.json()).error;
  }
}

function showUpdatePage() {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('signup-section').classList.add('hidden');
  document.getElementById('entry-section').classList.add('hidden');
  document.getElementById('update-section').classList.remove('hidden');
  document.getElementById('current-user').textContent = `${currentUser.name} (${currentUser.email})`;
  const [firstName, ...lastNameParts] = currentUser.name.split(' ');
  document.getElementById('update-firstname').value = firstName;
  document.getElementById('update-lastname').value = lastNameParts.join(' ');
  document.getElementById('update-email').value = currentUser.email;
  document.getElementById('update-position').value = currentUser.position;
  fetchEmployees().then(() => {
    const updateManagerSelect = document.getElementById('update-manager');
    Array.from(updateManagerSelect.options).forEach(opt => {
      opt.selected = currentUser.managers && currentUser.managers.some(m => m.id == opt.value);
    });
  });
  document.getElementById('update-success').textContent = '';
}

async function updateUser(event) {
  event.preventDefault();
  const firstName = document.getElementById('update-firstname').value.trim();
  const lastName = document.getElementById('update-lastname').value.trim();
  const name = firstName + ' ' + lastName;
  const email = document.getElementById('update-email').value;
  const position = document.getElementById('update-position').value;
  const manager_ids = Array.from(document.getElementById('update-manager').selectedOptions).map(opt => parseInt(opt.value));
  const body = { name, email, position, manager_ids };
  const res = await fetch(`/employees/${currentUser.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (res.ok) {
    document.getElementById('update-success').textContent = 'Update successful!';
    await fetchEmployees();
    const user = employees.find(emp => emp.id == currentUser.id);
    currentUser = user;
  } else {
    document.getElementById('update-success').textContent = 'Error: ' + (await res.json()).error;
  }
}

function logout() {
  currentUser = null;
  document.getElementById('update-section').classList.add('hidden');
  document.getElementById('entry-section').classList.remove('hidden');
}

fetchEmployees(); 