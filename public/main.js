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
  const signupManager = document.getElementById('signup-manager');
  if (signupManager) {
    signupManager.innerHTML = employees.map(emp =>
      `<option value="${emp.id}">${emp.name} (${emp.email})</option>`
    ).join('');
  }
  // No update-manager select anymore!
}

// Entry navigation
function showLogin() {
  document.getElementById('entry-section').classList.add('hidden');
  document.getElementById('login-section').classList.remove('hidden');
  document.getElementById('login-error').textContent = '';
  showGlobalNav(false);
}
function showSignup() {
  document.getElementById('entry-section').classList.add('hidden');
  document.getElementById('signup-section').classList.remove('hidden');
  document.getElementById('signup-error').textContent = '';
  fetchEmployees();
  showGlobalNav(false);
}
function backToEntry() {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('signup-section').classList.add('hidden');
  document.getElementById('post-login-section').classList.add('hidden');
  document.getElementById('hierarchy-section').classList.add('hidden');
  document.getElementById('update-section').classList.add('hidden');
  document.getElementById('entry-section').classList.remove('hidden');
  showGlobalNav(false);
}

// On initial page load, hide the global nav
showGlobalNav(false);

// After login/signup, show post-login options
function afterLoginOrSignup() {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('signup-section').classList.add('hidden');
  document.getElementById('entry-section').classList.add('hidden');
  document.getElementById('update-section').classList.add('hidden');
  document.getElementById('hierarchy-section').classList.add('hidden');
  document.getElementById('post-login-section').classList.remove('hidden');
  document.getElementById('welcome-user').textContent = currentUser.name;
  showGlobalNav(true);
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
  console.log('Logging in as', user);
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

function renderManagerCheckboxes(containerId, selectedIds = []) {
  if (!currentUser) return; // Don't render if not logged in
  const container = document.getElementById(containerId);
  container.innerHTML = employees
    .filter(emp => emp.id !== currentUser.id)
    .map(emp => {
      const checked = selectedIds.includes(emp.id) ? 'checked' : '';
      return `<label style="display:block; margin-bottom:4px;">
        <input type="checkbox" value="${emp.id}" ${checked}> ${emp.name} (${emp.email})
      </label>`;
    }).join('');
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
  // Get current manager IDs
  const managerIds = employeeManagerRelations
    .filter(rel => rel.employee_id === currentUser.id)
    .map(rel => rel.manager_id);
  renderManagerCheckboxes('update-manager-checkboxes', managerIds);
  // Show current managers
  const managerNames = managerIds.length
    ? managerIds.map(id => {
        const m = employees.find(e => e.id === id);
        return m ? m.name : '';
      }).filter(Boolean).join(', ')
    : '';
  document.getElementById('current-managers').textContent =
    managerNames ? `Your current manager(s): ${managerNames}` : 'No manager assigned.';
  document.getElementById('update-success').textContent = '';
  showGlobalNav(true);
}

async function updateUser(event) {
  event.preventDefault();
  const firstName = document.getElementById('update-firstname').value.trim();
  const lastName = document.getElementById('update-lastname').value.trim();
  const name = firstName + ' ' + lastName;
  const email = document.getElementById('update-email').value;
  const position = document.getElementById('update-position').value;
  // Collect checked manager IDs from checkboxes
  const manager_ids = Array.from(document.querySelectorAll('#update-manager-checkboxes input[type="checkbox"]:checked'))
    .map(cb => parseInt(cb.value, 10));
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
  showGlobalNav(true);
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

function backNav() {
  if (!document.getElementById('post-login-section').classList.contains('hidden')) {
    backToEntry();
  } else if (!document.getElementById('update-section').classList.contains('hidden') ||
             !document.getElementById('hierarchy-section').classList.contains('hidden')) {
    backToPostLogin();
  } else {
    backToEntry();
  }
}

function showGlobalNav(show) {
  document.getElementById('global-nav').style.display = show ? 'flex' : 'none';
}

fetchEmployees();