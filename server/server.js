const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const frontendDir = path.join(__dirname, '../Front-end');
const casesFilePath = path.join(__dirname, 'case.json');

function loadCases() {
  try {
    const savedCases = JSON.parse(fs.readFileSync(casesFilePath, 'utf8'));
    if (!Array.isArray(savedCases)) {
      throw new Error('case.json must contain a JSON array of cases.');
    }
    return savedCases;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    fs.writeFileSync(casesFilePath, '[]\n', 'utf8');
    return [];
  }
}

function saveCases() {
  const temporaryPath = `${casesFilePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(cases, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, casesFilePath);
}

let cases = loadCases();

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Court management system API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/cases', (req, res) => {
  res.json({
    success: true,
    count: cases.length,
    data: cases
  });
});

app.get('/api/cases/:id', (req, res) => {
  const caseItem = cases.find((item) => item.id === req.params.id);

  if (!caseItem) {
    return res.status(404).json({
      success: false,
      message: 'Case not found'
    });
  }

  return res.json({
    success: true,
    data: caseItem
  });
});

app.patch('/api/cases/:id/status', (req, res) => {
  const allowedStatuses = ['Pending', 'Hearing', 'Review', 'Mention', 'Closed'];
  const { status } = req.body;

  if (typeof status !== 'string' || !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Status must be one of: ${allowedStatuses.join(', ')}`
    });
  }

  const caseItem = cases.find((item) => item.id === req.params.id);
  if (!caseItem) {
    return res.status(404).json({
      success: false,
      message: 'Case not found'
    });
  }

  const previousStatus = caseItem.status;
  caseItem.status = status;
  try {
    saveCases();
  } catch (error) {
    caseItem.status = previousStatus;
    console.error('Failed to save case status:', error);
    return res.status(500).json({
      success: false,
      message: 'Case status could not be saved.'
    });
  }

  return res.json({
    success: true,
    message: 'Case status updated successfully',
    data: caseItem
  });
});

app.post('/api/cases', (req, res) => {
  const { client, category, judge, status, court, nextCourtDate, nextCourtTime } = req.body;

  if (!client || !category || !judge || !status || !court) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required case fields'
    });
  }

  if (Boolean(nextCourtDate) !== Boolean(nextCourtTime)) {
    return res.status(400).json({
      success: false,
      message: 'Provide both the next court date and time, or leave both blank.'
    });
  }

  const parsedNextCourtDate = nextCourtDate && new Date(`${nextCourtDate}T00:00:00.000Z`);
  if (nextCourtDate && (
    !/^\d{4}-\d{2}-\d{2}$/.test(nextCourtDate) ||
    Number.isNaN(parsedNextCourtDate.getTime()) ||
    parsedNextCourtDate.toISOString().slice(0, 10) !== nextCourtDate
  )) {
    return res.status(400).json({
      success: false,
      message: 'Provide a valid next court date.'
    });
  }

  if (nextCourtTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(nextCourtTime)) {
    return res.status(400).json({
      success: false,
      message: 'Provide a valid next court time.'
    });
  }

  const newCase = {
    id: `CASE-${Date.now()}`,
    client,
    category,
    judge,
    status,
    court,
    registeredAt: new Date().toISOString(),
    nextCourtDate: nextCourtDate || null,
    nextCourtTime: nextCourtTime || null
  };

  cases.push(newCase);
  try {
    saveCases();
  } catch (error) {
    cases.pop();
    console.error('Failed to save new case:', error);
    return res.status(500).json({
      success: false,
      message: 'Case could not be saved. Check the server file permissions.'
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Case created successfully',
    data: newCase
  });
});

app.use(express.static(frontendDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(frontendDir, 'new.html'));
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`Court management server running on http://localhost:${PORT}`);
});

module.exports = app;
