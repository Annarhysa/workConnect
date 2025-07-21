let employees = [];
let currentUser = null;
let employeeManagerRelations = [];

// Fetch all employees for dropdowns and hierarchy
async function fetchEmployees() {
  const res = await fetch('/employees');
  employees = await res.json();
  await fetchEmployeeManagers();
  populateManagerDropdowns();
}

// Get all employee-manager relationships
async function fetchEmployeeManagers() {
  const res = await fetch('/employee_manager');
  employeeManagerRelations = await res.json();
}

// Populate manager dropdowns, excluding the current user
function populateManagerDropdowns() {
  const filterManagers = (excludeId) =>
    employees.filter(emp => emp.id !== excludeId)
      .map(emp => `<option value="${emp.id}">${emp.name} (${emp.email})</option>`);
  // For signup, exclude no one (since user doesn't exist yet)
  document.getElementById('signup-manager').innerHTML = filterManagers(null).join('');
  // For update, exclude current user
  document.getElementById('update-manager').innerHTML = filterManagers(currentUser ? currentUser.id : null).join('');
}

// Entry navigation
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
  document.getElementById('post-login-section').classList.add('hidden');
  document.getElementById('hierarchy-section').classList.add('hidden');
  document.getElementById('update-section').classList.add('hidden');
  document.getElementById('entry-section').classList.remove('hidden');
}

// After login/signup, show post-login options
function afterLoginOrSignup() {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('signup-section').classList.add('hidden');
  document.getElementById('entry-section').classList.add('hidden');
  document.getElementById('update-section').classList.add('hidden');
  document.getElementById('hierarchy-section').classList.add('hidden');
  document.getElementById('post-login-section').classList.remove('hidden');
  document.getElementById('welcome-user').textContent = currentUser.name;
}

// Login logic
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
  fetchEmployees().then(afterLoginOrSignup);
}

// Signup logic
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
    afterLoginOrSignup();
  } else {
    document.getElementById('signup-error').textContent = 'Error: ' + (await addRes.json()).error;
  }
}

function showUpdatePage() {
  document.getElementById('post-login-section').classList.add('hidden');
  document.getElementById('update-section').classList.remove('hidden');
  document.getElementById('hierarchy-section').classList.add('hidden');
  document.getElementById('current-user').textContent = `${currentUser.name} (${currentUser.email})`;
  const [firstName, ...lastNameParts] = currentUser.name.split(' ');
  document.getElementById('update-firstname').value = firstName;
  document.getElementById('update-lastname').value = lastNameParts.join(' ');
  document.getElementById('update-email').value = currentUser.email;
  document.getElementById('update-position').value = currentUser.position;
  populateManagerDropdowns();
  // Pre-select current managers
  const updateManagerSelect = document.getElementById('update-manager');
  Array.from(updateManagerSelect.options).forEach(opt => {
    opt.selected = employeeManagerRelations
      .filter(rel => rel.employee_id === currentUser.id)
      .some(rel => rel.manager_id == opt.value);
  });
  // Show current managers using employeeManagerRelations
  const managerIds = employeeManagerRelations
    .filter(rel => rel.employee_id === currentUser.id)
    .map(rel => rel.manager_id);
  const managerNames = managerIds.length
    ? managerIds.map(id => {
        const m = employees.find(e => e.id === id);
        return m ? m.name : '';
      }).filter(Boolean).join(', ')
    : '';
  document.getElementById('current-managers').textContent =
    managerNames ? `Your current manager(s): ${managerNames}` : 'No manager assigned.';
  document.getElementById('update-success').textContent = '';
}

async function updateUser(event) {
  event.preventDefault();
  const firstName = document.getElementById('update-firstname').value.trim();
  const lastName = document.getElementById('update-lastname').value.trim();
  const name = firstName + ' ' + lastName;
  const email = document.getElementById('update-email').value;
  const position = document.getElementById('update-position').value;
  // Collect manager_ids from the select element
  const manager_ids = Array.from(document.getElementById('update-manager').selectedOptions).map(opt => parseInt(opt.value, 10));
  const body = { name, email, position, manager_ids };
  const res = await fetch(`/employees/${currentUser.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (res.ok) {
    await fetchEmployees();
    const user = employees.find(emp => emp.id == currentUser.id);
    currentUser = user;
    showUpdatePage();
    document.getElementById('update-success').textContent = 'Update successful!';
    setTimeout(() => {
      document.getElementById('update-success').textContent = '';
    }, 3000);
  } else {
    showUpdatePage();
    document.getElementById('update-success').textContent = 'Error: ' + (await res.json()).error;
  }
}

// Show hierarchy section
function showHierarchy() {
  document.getElementById('post-login-section').classList.add('hidden');
  document.getElementById('hierarchy-section').classList.remove('hidden');
  document.getElementById('update-section').classList.add('hidden');
  renderHierarchy();
}

// Back to post-login options
function backToPostLogin() {
  document.getElementById('hierarchy-section').classList.add('hidden');
  document.getElementById('update-section').classList.add('hidden');
  document.getElementById('post-login-section').classList.remove('hidden');
}

// Render a simple org chart as a nested list
function renderHierarchy() {
  const tbody = document.querySelector('#hierarchy-table tbody');
  tbody.innerHTML = employees.map(emp => {
    const managerIds = employeeManagerRelations
      .filter(rel => rel.employee_id === emp.id)
      .map(rel => rel.manager_id);
    const managerNames = managerIds.length
      ? managerIds.map(id => {
          const m = employees.find(e => e.id === id);
          return m ? m.name : '';
        }).filter(Boolean).join(', ')
      : '—';
    return `<tr>
      <td><strong>${emp.name}</strong></td>
      <td>${emp.position}</td>
      <td>${managerNames}</td>
    </tr>`;
  }).join('');
}

function logout() {
  currentUser = null;
  backToEntry();
}

fetchEmployees();