// backend/index.js

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();

app.use(cors());
app.use(express.json());

const db = new Database('data.db');

// Create the habits table if it does not already exist.
db.prepare(`
CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
)
`).run();

// Create the checkins table if it does not already exist.
db.prepare(`
CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    UNIQUE(habit_id, date)
)
`).run();

function todayString() {
    return new Date().toISOString().slice(0, 10);
}

function addDays(dateString, days) {
    const d = new Date(dateString + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

// Counts consecutive daily check-ins starting from today if checked in today,
// otherwise from yesterday if today is missing, otherwise the streak is zero.
function calculateStreak(habitId) {
    const rows = db.prepare(`
        SELECT date
        FROM checkins
        WHERE habit_id = ?
        ORDER BY date DESC
    `).all(habitId);

    const dates = new Set(rows.map(r => r.date));

    const today = todayString();

    let current;

    if (dates.has(today)) {
        current = today;
    } else {
        const yesterday = addDays(today, -1);
        if (dates.has(yesterday)) {
            current = yesterday;
        } else {
            return 0;
        }
    }

    let streak = 0;

    while (dates.has(current)) {
        streak++;
        current = addDays(current, -1);
    }

    return streak;
}

// Create a brand new habit.
app.post('/habits', (req, res) => {
    const name = (req.body.name || '').trim();

    if (!name) {
        return res.status(400).json({
            error: 'name is required'
        });
    }

    const created_at = new Date().toISOString();

    const result = db.prepare(`
        INSERT INTO habits (name, created_at)
        VALUES (?, ?)
    `).run(name, created_at);

    const habit = db.prepare(`
        SELECT *
        FROM habits
        WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
        ...habit,
        streak: 0
    });
});

// Return every habit together with its current streak.
app.get('/habits', (req, res) => {
    const habits = db.prepare(`
        SELECT *
        FROM habits
        ORDER BY created_at ASC
    `).all();

    const response = habits.map(habit => ({
        ...habit,
        streak: calculateStreak(habit.id)
    }));

    res.status(200).json(response);
});

// Record a check-in for a habit for a specific date or today.
app.post('/habits/:id/checkin', (req, res) => {
    const id = Number(req.params.id);

    const habit = db.prepare(`
        SELECT *
        FROM habits
        WHERE id = ?
    `).get(id);

    if (!habit) {
        return res.status(404).json({
            error: 'Habit not found'
        });
    }

    const date = req.body.date || todayString();
    const checked_at = new Date().toISOString();

    try {
        const result = db.prepare(`
            INSERT INTO checkins (habit_id, date, checked_at)
            VALUES (?, ?, ?)
        `).run(id, date, checked_at);

        const checkin = db.prepare(`
            SELECT *
            FROM checkins
            WHERE id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
            ...checkin,
            streak: calculateStreak(id)
        });

    } catch (err) {
        if (
            err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
            err.code === 'SQLITE_CONSTRAINT'
        ) {
            return res.status(409).json({
                error: 'Already checked in for this date'
            });
        }

        console.error(err);

        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// Return every check-in date for a habit.
app.get('/habits/:id/checkins', (req, res) => {
    const id = Number(req.params.id);

    const habit = db.prepare(`
        SELECT *
        FROM habits
        WHERE id = ?
    `).get(id);

    if (!habit) {
        return res.status(404).json({
            error: 'Habit not found'
        });
    }

    const dates = db.prepare(`
        SELECT date
        FROM checkins
        WHERE habit_id = ?
        ORDER BY date DESC
    `).all(id);

    res.status(200).json(dates.map(d => d.date));
});

// Remove a specific check-in from a habit.
app.delete('/habits/:id/checkin/:date', (req, res) => {
    const id = Number(req.params.id);
    const date = req.params.date;

    db.prepare(`
        DELETE FROM checkins
        WHERE habit_id = ?
        AND date = ?
    `).run(id, date);

    res.status(200).json({
        message: 'Checkin removed'
    });
});

// Delete a habit together with all of its check-in history.
app.delete('/habits/:id', (req, res) => {
    const id = Number(req.params.id);

    db.prepare(`
        DELETE FROM checkins
        WHERE habit_id = ?
    `).run(id);

    db.prepare(`
        DELETE FROM habits
        WHERE id = ?
    `).run(id);

    res.status(200).json({
        message: `Habit ${id} and its checkins deleted`
    });
});

app.listen(5000, () => {
    console.log("Server running on http://localhost:5000");
});