const express = require('express');
const mysql = require('mysql2');
const app = express();
const path = require('path');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // your user
  password: 'Bombay@1504', // your password
  database: 'final' // your database
});

  db.connect((err) => {
    if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  console.log('Connected to database.');
});

// Get all employees
app.get('/employees', (req, res) => {
  db.query('SELECT * FROM employee', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Get one employee with manager(s)
app.get('/employees/:id', (req, res) => {
  const empId = req.params.id;
  const empQuery = 'SELECT * FROM employee WHERE id = ?';
  const mgrQuery = `
    SELECT m.id, m.name, m.email, m.position
    FROM employee_manager em
    JOIN employee m ON em.manager_id = m.id
    WHERE em.employee_id = ?
  `;
  db.query(empQuery, [empId], (err, empResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (empResults.length === 0) return res.status(404).json({ error: 'Employee not found' });
    db.query(mgrQuery, [empId], (err, mgrResults) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...empResults[0], managers: mgrResults });
    });
  });
});

// Create new employee (with optional manager_ids array)
app.post('/employees', (req, res) => {
  const { name, email, position, manager_ids } = req.body;
  db.query(
    'INSERT INTO employee (name, email, position) VALUES (?, ?, ?)',
    [name, email, position],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      const empId = result.insertId;
      if (manager_ids && manager_ids.length > 0) {
        if (manager_ids.includes(empId)) {
          db.query('DELETE FROM employee WHERE id = ?', [empId], () => {
            return res.status(400).json({ error: "An employee cannot be their own manager." });
          });
        } else {
          const values = manager_ids.map(mid => [empId, mid]);
          db.query('INSERT INTO employee_manager (employee_id, manager_id) VALUES ?', [values], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            getManagers(empId, (err, managers) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ id: empId, name, email, position, managers });
            });
          });
        }
      } else {
        res.json({ id: empId, name, email, position, managers: [] });
      }
    }
  );
});

// Update employee and their managers
app.put('/employees/:id', (req, res) => {
  const empId = parseInt(req.params.id, 10);
  const { name, email, position, manager_ids } = req.body;

  // Step 1: Get current employee data
  db.query('SELECT * FROM employee WHERE id = ?', [empId], (err, empResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (empResults.length === 0) return res.status(404).json({ error: 'Employee not found' });

    const current = empResults[0];

    // Step 2: Merge incoming fields with existing data
    const newName = name !== undefined ? name : current.name;
    const newEmail = email !== undefined ? email : current.email;
    const newPosition = position !== undefined ? position : current.position;

    // Step 3: Validate manager_ids if present
    if (manager_ids && manager_ids.includes(empId)) {
      return res.status(400).json({ error: "An employee cannot be their own manager." });
    }

    // Step 4: Get old manager IDs before update
    getManagerIds(empId, (err, oldManagerIds) => {
      if (err) return res.status(500).json({ error: err.message });

      // Step 5: Update employee
      db.query(
        'UPDATE employee SET name=?, email=?, position=? WHERE id=?',
        [newName, newEmail, newPosition, empId],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });

          // Step 6: If manager_ids is present, update managers and audit
          if (manager_ids !== undefined) {
            db.query('DELETE FROM employee_manager WHERE employee_id=?', [empId], (err) => {
              if (err) return res.status(500).json({ error: err.message });
              if (manager_ids.length > 0) {
                const values = manager_ids.map(mid => [empId, mid]);
                db.query('INSERT INTO employee_manager (employee_id, manager_id) VALUES ?', [values], (err) => {
                  if (err) return res.status(500).json({ error: err.message });
                  getManagerIds(empId, (err, newManagerIds) => {
                    if (err) return res.status(500).json({ error: err.message });
                    db.query(
                      `INSERT INTO employee_audit 
                      (id, name_before, email_before, position_before, manager_id_before, 
                       name_after, email_after, position_after, manager_id_after, 
                       audit_timestamp, action_type, changed_by)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
                      [
                        empId, current.name, current.email, current.position, oldManagerIds.join(','),
                        newName, newEmail, newPosition, newManagerIds.join(','),
                        'MANAGER_CHANGE', 'api_user'
                      ],
                      (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ id: empId, name: newName, email: newEmail, position: newPosition, manager_ids });
                      }
                    );
                  });
                });
              } else {
                db.query(
                  `INSERT INTO employee_audit 
                  (id, name_before, email_before, position_before, manager_id_before, 
                   name_after, email_after, position_after, manager_id_after, 
                   audit_timestamp, action_type, changed_by)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
                  [
                    empId, current.name, current.email, current.position, oldManagerIds.join(','),
                    newName, newEmail, newPosition, '',
                    'MANAGER_CHANGE', 'api_user'
                  ],
                  (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ id: empId, name: newName, email: newEmail, position: newPosition, manager_ids: [] });
                  }
                );
              }
            });
          } else {
            // If only employee fields changed, no manager change audit
            res.json({ id: empId, name: newName, email: newEmail, position: newPosition });
          }
        }
      );
    });
  });
});

// Delete employee and clean up junction table
app.delete('/employees/:id', (req, res) => {
  const empId = req.params.id;
  db.query('DELETE FROM employee_manager WHERE employee_id=? OR manager_id=?', [empId, empId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.query('DELETE FROM employee WHERE id=?', [empId], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Employee not found' });
      res.json({ success: true });
    });
  });
});

// Get all employees managed by a manager, including manager's details
app.get('/managers/:id/employees', (req, res) => {
  const mgrId = req.params.id;
  // Query to get manager details
  const managerQuery = 'SELECT id, name, email, position FROM employee WHERE id = ?';
  // Query to get employees managed by this manager
  const employeesQuery = `
    SELECT e.id, e.name, e.email, e.position
    FROM employee_manager em
    JOIN employee e ON em.employee_id = e.id
    WHERE em.manager_id = ?
  `;

  db.query(managerQuery, [mgrId], (err, managerResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (managerResults.length === 0) return res.status(404).json({ error: 'Manager not found' });

    db.query(employeesQuery, [mgrId], (err, employeeResults) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        manager: managerResults[0],
        employees: employeeResults
      });
    });
  });
});

// Get all employee-manager relationships
app.get('/employee_manager', (req, res) => {
  db.query('SELECT employee_id, manager_id FROM employee_manager', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

function getManagerIds(empId, callback) {
  db.query('SELECT manager_id FROM employee_manager WHERE employee_id = ?', [empId], (err, results) => {
    if (err) return callback(err);
    callback(null, results.map(r => r.manager_id));
  });
}

// Helper to get all managers for an employee
function getManagers(empId, callback) {
  db.query('SELECT m.id, m.name, m.email, m.position FROM employee_manager em JOIN employee m ON em.manager_id = m.id WHERE em.employee_id = ?', [empId], (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
}

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});