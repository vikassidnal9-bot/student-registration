// frontend/src/App.jsx

import { useState, useEffect } from "react";
import "./App.css";

const API_URL = "http://localhost:5000";

function App() {
  const [habitName, setHabitName] = useState("");
  const [habits, setHabits] = useState([]);
  const [checkinsByHabit, setCheckinsByHabit] = useState({});
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  async function refreshAll() {
    try {
      const habitsRes = await fetch(`${API_URL}/habits`);
      const habitsData = await habitsRes.json();

      setHabits(habitsData);

      const checkins = {};

      await Promise.all(
        habitsData.map(async (habit) => {
          try {
            const res = await fetch(`${API_URL}/habits/${habit.id}/checkins`);
            const dates = await res.json();
            checkins[habit.id] = dates;
          } catch (err) {
            console.error(err);
          }
        })
      );

      setCheckinsByHabit(checkins);
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function addHabit() {
    const name = habitName.trim();

    if (!name) return;

    try {
      await fetch(`${API_URL}/habits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      setHabitName("");
      refreshAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function checkIn(id) {
    try {
      await fetch(`${API_URL}/habits/${id}/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      refreshAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteHabit(id) {
    try {
      await fetch(`${API_URL}/habits/${id}`, {
        method: "DELETE",
      });

      refreshAll();
    } catch (err) {
      console.error(err);
    }
  }

  function last7Days() {
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      days.push({
        date: d.toISOString().slice(0, 10),
        day: d.getDate(),
      });
    }

    return days;
  }

  return (
    <div className="container">
      <h1>🔥 Habit Tracker</h1>

      <div className="new-habit-card">
        <div className="input-row">
          <input
            type="text"
            placeholder="e.g. Drink 2L water"
            value={habitName}
            onChange={(e) => setHabitName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addHabit();
              }
            }}
          />

          <button onClick={addHabit}>Add Habit</button>
        </div>
      </div>

      {loading ? (
        <p>Loading your habits...</p>
      ) : habits.length === 0 ? (
        <p>No habits yet. Add one above to get started!</p>
      ) : (
        habits.map((habit) => {
          const dates = checkinsByHabit[habit.id] || [];
          const checkedToday = dates.includes(today);

          return (
            <div className="habit-card" key={habit.id}>
              <h3>{habit.name}</h3>

              {habit.streak > 0 ? (
                <p className="streak">
                  🔥 {habit.streak} day streak
                </p>
              ) : (
                <p>No streak yet — check in today!</p>
              )}

              <button
                className="check-btn"
                disabled={checkedToday}
                onClick={() => checkIn(habit.id)}
              >
                {checkedToday ? "✅ Checked in today" : "Check In"}
              </button>

              <div className="history">
                {last7Days().map((day) => (
                  <div
                    key={day.date}
                    className={
                      dates.includes(day.date)
                        ? "history-box done"
                        : "history-box"
                    }
                  >
                    {day.day}
                  </div>
                ))}
              </div>

              <button
                className="delete-btn"
                onClick={() => deleteHabit(habit.id)}
              >
                Delete Habit
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

export default App;