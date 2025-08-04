document.addEventListener('DOMContentLoaded', () => {
    const jobNameInput = document.getElementById('job-name');
    const startStopBtn = document.getElementById('start-stop-btn');
    const timerDisplay = document.getElementById('timer-display');
    const jobCompletionForm = document.querySelector('.job-completion-form');
    const moneyEarnedInput = document.getElementById('money-earned');
    const costsInput = document.getElementById('costs');
    const additionalInfoInput = document.getElementById('additional-info');
    const saveSessionBtn = document.getElementById('save-session-btn');
    const pastSessionsBody = document.getElementById('past-sessions-body');
    const jobAveragesBody = document.getElementById('job-averages-body');
    const clearAllDataBtn = document.getElementById('clear-all-data-btn');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const toastContainer = document.getElementById('toast-container');

    // --- Configuration ---
    const DISCORD_WEBHOOK_URL = 'https://canary.discord.com/api/webhooks/1397207859736871023/GTqiATLLENEU-u4diuZIWNIwg703o8NmiOlBb5kiXaAEM9aMj0h8FmVzegIdhbgqMdw5'; // !!! REPLACE THIS WITH YOUR ACTUAL DISCORD WEBHOOK URL !!!
    const TOAST_DURATION = 3000; // milliseconds

    // --- State Variables ---
    let isTracking = false;
    let startTime = 0;
    let timerInterval = null;
    let currentJobName = '';

    // --- Data Storage ---
    // Structure for allJobSessions: [{ id, jobName, startTime, endTime, durationMs, money, costs, additionalInfo, timestamp }]
    let allJobSessions = [];
    // Keys for localStorage
    const LS_SESSIONS_KEY = 'fivemJobSessions';
    const LS_THEME_KEY = 'fivemTrackerTheme';
    const LS_ACTIVE_JOB_KEY = 'fivemActiveJob'; // To resume timer on refresh

    // --- Utility Functions ---

    function formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return [hours, minutes, seconds]
            .map(unit => unit < 10 ? '0' + unit : unit)
            .join(':');
    }

    function msToHours(ms) {
        return ms / (1000 * 60 * 60);
    }

    function calculateMoneyPerHour(money, durationMs) {
        if (durationMs === 0) return 0;
        return (money / msToHours(durationMs)).toFixed(2);
    }

    function generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    // --- Toast Notification Function ---
    function showToast(message, type = 'default') {
        const toast = document.createElement('div');
        toast.classList.add('toast-message', type);
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Force reflow to enable transition
        void toast.offsetWidth;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            }, { once: true });
        }, TOAST_DURATION);
    }

    // --- Local Storage Functions ---

    function loadSessions() {
        const storedSessions = localStorage.getItem(LS_SESSIONS_KEY);
        if (storedSessions) {
            allJobSessions = JSON.parse(storedSessions);
        } else {
            allJobSessions = [];
        }
    }

    function saveSessions() {
        localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(allJobSessions));
    }

    function saveActiveJobState() {
        if (isTracking) {
            const activeJobState = {
                jobName: currentJobName,
                startTime: startTime,
                timestamp: Date.now() // To know when it was saved/last checked
            };
            localStorage.setItem(LS_ACTIVE_JOB_KEY, JSON.stringify(activeJobState));
        } else {
            localStorage.removeItem(LS_ACTIVE_JOB_KEY);
        }
    }

    function clearActiveJobState() {
        localStorage.removeItem(LS_ACTIVE_JOB_KEY);
    }

    // --- Rendering Functions ---

    function renderPastSessions() {
        pastSessionsBody.innerHTML = ''; // Clear existing rows
        if (allJobSessions.length === 0) {
            pastSessionsBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No job sessions recorded yet.</td></tr>';
            return;
        }

        // Sort by timestamp descending (newest first)
        const sortedSessions = [...allJobSessions].sort((a, b) => b.timestamp - a.timestamp);

        sortedSessions.forEach(session => {
            const row = pastSessionsBody.insertRow();
            const netProfit = session.money - session.costs;
            const moneyPerHour = calculateMoneyPerHour(netProfit, session.durationMs);
            const sessionDate = new Date(session.timestamp).toLocaleString();

            row.innerHTML = `
                <td>${session.jobName}</td>
                <td>${formatTime(session.durationMs)}</td>
                <td>$${session.money.toLocaleString()}</td>
                <td>$${session.costs.toLocaleString()}</td>
                <td>$${netProfit.toLocaleString()}</td>
                <td>$${moneyPerHour}</td>
                <td>${sessionDate}</td>
                <td>${session.additionalInfo ? `<span title="${session.additionalInfo}">Yes</span>` : 'No'}</td>
                <td><button class="btn btn-small danger-btn delete-session-btn" data-id="${session.id}">Delete</button></td>
            `;
        });
        addDeleteSessionListeners();
    }

    function renderJobAverages() {
        jobAveragesBody.innerHTML = ''; // Clear existing rows

        if (allJobSessions.length === 0) {
            jobAveragesBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No job averages available yet.</td></tr>';
            return;
        }

        const jobData = {}; // { jobName: { totalDuration, totalMoney, totalCosts, count } }

        allJobSessions.forEach(session => {
            if (!jobData[session.jobName]) {
                jobData[session.jobName] = {
                    totalDuration: 0,
                    totalMoney: 0,
                    totalCosts: 0,
                    count: 0
                };
            }
            jobData[session.jobName].totalDuration += session.durationMs;
            jobData[session.jobName].totalMoney += session.money;
            jobData[session.jobName].totalCosts += session.costs;
            jobData[session.jobName].count++;
        });

        for (const jobName in jobData) {
            const data = jobData[jobName];
            const avgDurationMs = data.totalDuration / data.count;
            const avgMoney = data.totalMoney / data.count;
            const avgCosts = data.totalCosts / data.count;
            const avgNet = avgMoney - avgCosts;
            const avgMoneyPerHour = calculateMoneyPerHour(avgNet, avgDurationMs);

            const row = jobAveragesBody.insertRow();
            row.innerHTML = `
                <td>${jobName}</td>
                <td>${formatTime(avgDurationMs)}</td>
                <td>$${avgMoney.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>$${avgCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>$${avgNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>$${avgMoneyPerHour}</td>
                <td>${data.count}</td>
            `;
        }
    }

    function updateAllViews() {
        renderPastSessions();
        renderJobAverages();
    }

    // --- Timer Control Functions ---

    function startTimerDisplay() {
        timerInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            timerDisplay.textContent = formatTime(elapsed);
        }, 1000);
    }

    function stopTimerDisplay() {
        clearInterval(timerInterval);
        timerInterval = null; // Clear interval ID
    }

    // --- Event Listeners ---

    startStopBtn.addEventListener('click', () => {
        if (!isTracking) {
            // Start Tracking
            const jobName = jobNameInput.value.trim();
            if (!jobName) {
                showToast('Please enter a Job Name to start tracking!', 'error');
                jobNameInput.focus();
                return;
            }

            currentJobName = jobName;
            startTime = Date.now();
            isTracking = true;
            saveActiveJobState(); // Save state immediately
            startStopBtn.textContent = 'Stop Job';
            startStopBtn.classList.remove('primary-btn');
            startStopBtn.classList.add('danger-btn');
            jobNameInput.disabled = true;
            jobCompletionForm.style.display = 'none'; // Hide completion form while tracking
            showToast(`Started tracking "${currentJobName}"`, 'success');

            startTimerDisplay();

        } else {
            // Stop Tracking
            stopTimerDisplay();
            isTracking = false;
            clearActiveJobState(); // Clear active job state
            startStopBtn.textContent = 'Start Job';
            startStopBtn.classList.remove('danger-btn');
            startStopBtn.classList.add('primary-btn');
            jobNameInput.disabled = false;
            jobCompletionForm.style.display = 'block'; // Show completion form
            // Ensure inputs are reset to 0 or empty for convenience
            moneyEarnedInput.value = 0;
            costsInput.value = 0;
            additionalInfoInput.value = '';

            // The timer display will show the final duration until a new job starts
            // or the session is saved.
            showToast(`Stopped tracking "${currentJobName}". Fill details to save.`, 'default');
        }
    });

    saveSessionBtn.addEventListener('click', () => {
        if (startTime === 0) {
            showToast('No active job session to save. Please start a job first.', 'error');
            return;
        }

        const endTime = Date.now();
        const durationMs = endTime - startTime;
        const money = parseFloat(moneyEarnedInput.value) || 0; // Ensures it's a number, defaults to 0
        const costs = parseFloat(costsInput.value) || 0;     // Ensures it's a number, defaults to 0
        const additionalInfo = additionalInfoInput.value.trim();

        const newSession = {
            id: generateUniqueId(),
            jobName: currentJobName,
            startTime: startTime,
            endTime: endTime,
            durationMs: durationMs,
            money: money,
            costs: costs,
            additionalInfo: additionalInfo,
            timestamp: Date.now() // For sorting and tracking when it was saved
        };

        allJobSessions.push(newSession);
        saveSessions();
        updateAllViews();
        showToast('Job session saved successfully!', 'success');

        // Optionally send to Discord
        sendToDiscord(newSession);

        // Reset for next job
        jobCompletionForm.style.display = 'none';
        jobNameInput.value = '';
        timerDisplay.textContent = '00:00:00';
        startTime = 0;
        currentJobName = '';
    });

    clearAllDataBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear ALL recorded job data? This cannot be undone.')) {
            localStorage.removeItem(LS_SESSIONS_KEY);
            allJobSessions = [];
            updateAllViews();
            showToast('All job data cleared!', 'success');
            // Also clear any active job state if it was there
            clearActiveJobState();
            // Reset UI if a timer was somehow active during clear
            stopTimerDisplay();
            isTracking = false;
            startStopBtn.textContent = 'Start Job';
            startStopBtn.classList.remove('danger-btn');
            startStopBtn.classList.add('primary-btn');
            jobNameInput.disabled = false;
            jobNameInput.value = '';
            timerDisplay.textContent = '00:00:00';
            jobCompletionForm.style.display = 'none';
        }
    });

    function addDeleteSessionListeners() {
        document.querySelectorAll('.delete-session-btn').forEach(button => {
            button.onclick = (event) => {
                const sessionIdToDelete = event.target.dataset.id;
                if (confirm('Are you sure you want to delete this specific job session?')) {
                    allJobSessions = allJobSessions.filter(session => session.id !== sessionIdToDelete);
                    saveSessions();
                    updateAllViews();
                    showToast('Job session deleted!', 'default');
                }
            };
        });
    }

    // --- Discord Webhook Function ---

    async function sendToDiscord(session) {
        if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL === 'YOUR_DISCORD_WEBHOOK_URL_HERE') {
            console.warn('Discord Webhook URL is not configured. Skipping Discord notification.');
            showToast('Discord Webhook URL is not configured. Please open script.js and set DISCORD_WEBHOOK_URL.', 'error');
            return;
        }

        const netProfit = session.money - session.costs;
        const moneyPerHour = calculateMoneyPerHour(netProfit, session.durationMs);

        const payload = {
            embeds: [{
                title: `📊 New FiveM Job Session Recorded: ${session.jobName}`,
                color: 6950293, // A nice purple color for Discord embeds
                fields: [
                    { name: '💰 Money Earned', value: `$${session.money.toLocaleString()}`, inline: true },
                    { name: '💸 Costs', value: `$${session.costs.toLocaleString()}`, inline: true },
                    { name: '📈 Net Profit', value: `$${netProfit.toLocaleString()}`, inline: true },
                    { name: '⏱️ Duration', value: formatTime(session.durationMs), inline: true },
                    { name: '💵 Avg. M/Hr (Session)', value: `$${moneyPerHour}`, inline: true },
                    { name: '🗓️ Date', value: new Date(session.timestamp).toLocaleDateString(), inline: true }
                ],
                footer: {
                    // !!! CUSTOMIZE THIS !!! Your Name/Community for the Discord embed footer
                    text: 'FiveM Job Tracker by Your Name/Community'
                },
                timestamp: new Date(session.timestamp).toISOString()
            }]
        };

        if (session.additionalInfo) {
            // Add description field if additional info exists
            payload.embeds[0].description = `**Additional Info:**\n${session.additionalInfo}`;
        }

        try {
            const response = await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                console.log('Discord webhook sent successfully!');
                showToast('Job session sent to Discord!', 'success');
            } else {
                console.error('Failed to send Discord webhook:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('Error response:', errorText);
                showToast(`Failed to send to Discord: ${response.statusText}. Check console.`, 'error');
            }
        } catch (error) {
            console.error('Error sending Discord webhook:', error);
            showToast('An error occurred while sending to Discord. Check console for details.', 'error');
        }
    }


    // --- Dark Mode Logic ---
    function setDarkMode(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
            localStorage.setItem(LS_THEME_KEY, 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem(LS_THEME_KEY, 'light');
        }
    }

    // Check saved theme preference
    const savedTheme = localStorage.getItem(LS_THEME_KEY);
    if (savedTheme === 'light') {
        darkModeToggle.checked = false;
        setDarkMode(false);
    } else { // Default to dark if no preference or 'dark'
        darkModeToggle.checked = true;
        setDarkMode(true);
    }

    darkModeToggle.addEventListener('change', (event) => {
        setDarkMode(event.target.checked);
    });


    // --- Initialization and Resume Job Logic ---
    function initialize() {
        loadSessions();
        updateAllViews();

        const activeJobState = localStorage.getItem(LS_ACTIVE_JOB_KEY);
        if (activeJobState) {
            const { jobName, startTime: savedStartTime } = JSON.parse(activeJobState);

            // Optional: Prompt user to resume
            if (confirm(`A job "${jobName}" was active when you last left. Do you want to resume it?`)) {
                currentJobName = jobName;
                startTime = savedStartTime;
                isTracking = true;
                jobNameInput.value = jobName;
                jobNameInput.disabled = true;
                startStopBtn.textContent = 'Stop Job';
                startStopBtn.classList.remove('primary-btn');
                startStopBtn.classList.add('danger-btn');
                jobCompletionForm.style.display = 'none'; // Hide completion form
                startTimerDisplay();
                showToast(`Resumed tracking "${currentJobName}".`, 'default');
            } else {
                // If user doesn't want to resume, clear the saved state
                clearActiveJobState();
                showToast('Previous active job discarded.', 'default');
            }
        }
    }

    initialize();
});
