const storageKey = "printflow-team-state";
const sessionKey = "printflow-team-session";

const initialData = {
  users: [
    { id: "u1", name: "Μαρία", role: "Υπεύθυνη Παραγγελιών", pin: "1111", status: "online" },
    { id: "u2", name: "Ανδρέας", role: "Γραφιστικό Τμήμα", pin: "2222", status: "online" },
    { id: "u3", name: "Ελένη", role: "Παραγωγή", pin: "3333", status: "busy" },
  ],
  messages: [
    {
      id: crypto.randomUUID(),
      userId: "u1",
      body: "Η μακέτα για το Cafe Bloom είναι έτοιμη για έλεγχο στις 11:30.",
      createdAt: "2026-04-24T08:40",
    },
    {
      id: crypto.randomUUID(),
      userId: "u2",
      body: "Θα έχω τα δείγματα χαρτιού στο γραφείο υποδοχής πριν το μεσημέρι.",
      createdAt: "2026-04-24T09:05",
    },
    {
      id: crypto.randomUUID(),
      userId: "u3",
      body: "Η παραλαβή για Bakery House μεταφέρθηκε στις 12:15. Το έχω σημειώσει.",
      createdAt: "2026-04-24T09:20",
    },
  ],
  appointments: [
    {
      id: crypto.randomUUID(),
      clientName: "Cafe Bloom",
      phone: "99 123456",
      ownerId: "u1",
      service: "Έλεγχος μακέτας",
      date: "2026-04-24",
      time: "11:30",
      notes: "Να υπάρχουν μαζί 2 εναλλακτικά χαρτιά για menu.",
    },
    {
      id: crypto.randomUUID(),
      clientName: "Bakery House",
      phone: "96 778899",
      ownerId: "u3",
      service: "Παραλαβή έντυπου υλικού",
      date: "2026-04-24",
      time: "12:15",
      notes: "Παράδοση flyers και επιβεβαίωση ποσότητας.",
    },
    {
      id: crypto.randomUUID(),
      clientName: "Studio Nova",
      phone: "97 456123",
      ownerId: "u2",
      service: "Συνάντηση νέας παραγγελίας",
      date: "2026-04-25",
      time: "10:00",
      notes: "Συζήτηση για εταιρικούς φακέλους και κάρτες.",
    },
  ],
};

const state = loadState();
let currentUserId = loadSession();
let deferredPrompt = null;

const elements = {
  loginScreen: document.querySelector("#loginScreen"),
  mainScreen: document.querySelector("#mainScreen"),
  loginForm: document.querySelector("#loginForm"),
  userSelect: document.querySelector("#userSelect"),
  pinInput: document.querySelector("#pinInput"),
  logoutButton: document.querySelector("#logoutButton"),
  installButton: document.querySelector("#installButton"),
  tabLinks: document.querySelectorAll(".tab-link"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  welcomeTitle: document.querySelector("#welcomeTitle"),
  todayLabel: document.querySelector("#todayLabel"),
  heroSummary: document.querySelector("#heroSummary"),
  nextAppointment: document.querySelector("#nextAppointment"),
  nextAppointmentMeta: document.querySelector("#nextAppointmentMeta"),
  onlineCount: document.querySelector("#onlineCount"),
  appointmentsCount: document.querySelector("#appointmentsCount"),
  notificationsCount: document.querySelector("#notificationsCount"),
  messageForm: document.querySelector("#messageForm"),
  messagesList: document.querySelector("#messagesList"),
  appointmentForm: document.querySelector("#appointmentForm"),
  appointmentOwner: document.querySelector("#appointmentOwner"),
  appointmentsList: document.querySelector("#appointmentsList"),
  teamList: document.querySelector("#teamList"),
  activityList: document.querySelector("#activityList"),
};

hydrateUserOptions();
bindEvents();
registerServiceWorker();
renderApp();

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.logoutButton.addEventListener("click", handleLogout);
  elements.messageForm.addEventListener("submit", handleMessageSubmit);
  elements.appointmentForm.addEventListener("submit", handleAppointmentSubmit);

  elements.tabLinks.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    elements.installButton.hidden = false;
  });

  elements.installButton.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    elements.installButton.hidden = true;
  });
}

function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(elements.loginForm);
  const userId = String(formData.get("user"));
  const pin = String(formData.get("pin")).trim();
  const user = state.users.find((item) => item.id === userId);

  if (!user || user.pin !== pin) {
    alert("Λάθος PIN. Δοκίμασε ένα από τα demo στοιχεία.");
    return;
  }

  currentUserId = user.id;
  localStorage.setItem(sessionKey, currentUserId);
  elements.loginForm.reset();
  renderApp();
}

function handleLogout() {
  currentUserId = "";
  localStorage.removeItem(sessionKey);
  renderApp();
}

function handleMessageSubmit(event) {
  event.preventDefault();
  if (!currentUserId) return;

  const formData = new FormData(elements.messageForm);
  const body = String(formData.get("message")).trim();
  if (!body) return;

  state.messages.unshift({
    id: crypto.randomUUID(),
    userId: currentUserId,
    body,
    createdAt: currentLocalDateTime(),
  });

  persistState();
  elements.messageForm.reset();
  renderMessages();
  renderTeam();
  renderSummary();
}

function handleAppointmentSubmit(event) {
  event.preventDefault();
  const formData = new FormData(elements.appointmentForm);

  state.appointments.unshift({
    id: crypto.randomUUID(),
    clientName: String(formData.get("clientName")).trim(),
    phone: String(formData.get("phone")).trim(),
    ownerId: String(formData.get("owner")),
    service: String(formData.get("service")),
    date: String(formData.get("date")),
    time: String(formData.get("time")),
    notes: String(formData.get("notes")).trim(),
  });

  persistState();
  elements.appointmentForm.reset();
  setAppointmentDefaults();
  renderAppointments();
  renderTeam();
  renderSummary();
}

function renderApp() {
  const loggedIn = Boolean(currentUserId && findUser(currentUserId));
  elements.loginScreen.classList.toggle("active", !loggedIn);
  elements.mainScreen.classList.toggle("active", loggedIn);

  if (!loggedIn) {
    elements.userSelect.value = state.users[0]?.id || "";
    return;
  }

  hydrateOwnerOptions();
  setAppointmentDefaults();
  setActiveTab("chat");
  renderSummary();
  renderMessages();
  renderAppointments();
  renderTeam();
}

function renderSummary() {
  const currentUser = findUser(currentUserId);
  const today = currentLocalDate();
  const todaysAppointments = state.appointments.filter((item) => item.date === today);
  const nextAppointment = [...state.appointments]
    .filter((item) => `${item.date}T${item.time}` >= currentLocalDateTime())
    .sort(byDateTime)[0];
  const onlineUsers = state.users.filter((item) => item.status === "online").length;
  const activeActivities = state.messages.slice(0, 4).length + todaysAppointments.length;

  elements.welcomeTitle.textContent = `Γεια σου, ${currentUser.name}`;
  elements.todayLabel.textContent = formatDisplayDate(today);
  elements.heroSummary.textContent = `${todaysAppointments.length} ραντεβού και ${
    state.messages.length
  } εσωτερικές ενημερώσεις διαθέσιμες τώρα.`;
  elements.onlineCount.textContent = `${onlineUsers} online`;
  elements.appointmentsCount.textContent = `${todaysAppointments.length} σήμερα`;
  elements.notificationsCount.textContent = `${activeActivities} κινήσεις`;

  if (nextAppointment) {
    const owner = findUser(nextAppointment.ownerId);
    elements.nextAppointment.textContent = `${nextAppointment.time} • ${nextAppointment.clientName}`;
    elements.nextAppointmentMeta.textContent = `${nextAppointment.service} με ${
      owner?.name || "Ομάδα"
    }`;
  } else {
    elements.nextAppointment.textContent = "Δεν υπάρχει επόμενο ραντεβού";
    elements.nextAppointmentMeta.textContent = "Πρόσθεσε νέο ραντεβού για να εμφανιστεί εδώ.";
  }
}

function renderMessages() {
  elements.messagesList.innerHTML = "";

  if (!state.messages.length) {
    elements.messagesList.append(createEmptyState("Δεν υπάρχουν ακόμη μηνύματα."));
    return;
  }

  const template = document.querySelector("#messageTemplate");

  [...state.messages]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .forEach((message) => {
      const user = findUser(message.userId);
      const fragment = template.content.cloneNode(true);

      fragment.querySelector(".avatar-chip").textContent = initials(user?.name || "Ο");
      fragment.querySelector(".message-author").textContent = user?.name || "Ομάδα";
      fragment.querySelector(".message-role").textContent = user?.role || "";
      fragment.querySelector(".message-time").textContent = formatTime(message.createdAt);
      fragment.querySelector(".message-body").textContent = message.body;

      elements.messagesList.append(fragment);
    });
}

function renderAppointments() {
  elements.appointmentsList.innerHTML = "";

  if (!state.appointments.length) {
    elements.appointmentsList.append(createEmptyState("Δεν υπάρχουν καταχωρημένα ραντεβού."));
    return;
  }

  const template = document.querySelector("#appointmentTemplate");

  [...state.appointments]
    .sort(byDateTime)
    .forEach((appointment) => {
      const owner = findUser(appointment.ownerId);
      const fragment = template.content.cloneNode(true);

      fragment.querySelector(".appointment-client").textContent = appointment.clientName;
      fragment.querySelector(
        ".appointment-service"
      ).textContent = `${appointment.service} • ${appointment.phone}`;
      fragment.querySelector(".appointment-notes").textContent =
        appointment.notes || "Χωρίς επιπλέον σημείωση.";
      fragment.querySelector(".appointment-date").textContent = `${formatShortDate(
        appointment.date
      )} • ${appointment.time}`;
      fragment.querySelector(".list-owner").textContent = owner
        ? `Υπεύθυνος: ${owner.name}`
        : "Χωρίς υπεύθυνο";

      elements.appointmentsList.append(fragment);
    });
}

function renderTeam() {
  elements.teamList.innerHTML = "";
  elements.activityList.innerHTML = "";

  const teamTemplate = document.querySelector("#teamTemplate");
  state.users.forEach((user) => {
    const fragment = teamTemplate.content.cloneNode(true);
    fragment.querySelector(".avatar-chip").textContent = initials(user.name);
    fragment.querySelector(".team-name").textContent = user.name;
    fragment.querySelector(".team-role").textContent = user.role;
    fragment.querySelector(".team-status").textContent =
      user.status === "online" ? "Online" : "Σε δουλειά";
    elements.teamList.append(fragment);
  });

  const activityTemplate = document.querySelector("#activityTemplate");
  const recentActivities = buildRecentActivity();
  recentActivities.forEach((activity) => {
    const fragment = activityTemplate.content.cloneNode(true);
    fragment.querySelector(".activity-title").textContent = activity.title;
    fragment.querySelector(".activity-body").textContent = activity.body;
    elements.activityList.append(fragment);
  });
}

function buildRecentActivity() {
  const latestMessage = [...state.messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const nextAppointment = [...state.appointments]
    .filter((item) => `${item.date}T${item.time}` >= currentLocalDateTime())
    .sort(byDateTime)[0];
  const result = [];

  if (latestMessage) {
    const author = findUser(latestMessage.userId);
    result.push({
      title: `Τελευταίο μήνυμα από ${author?.name || "ομάδα"}`,
      body: latestMessage.body,
    });
  }

  if (nextAppointment) {
    const owner = findUser(nextAppointment.ownerId);
    result.push({
      title: `Επόμενο ραντεβού: ${nextAppointment.clientName}`,
      body: `${formatDisplayDate(nextAppointment.date)} στις ${nextAppointment.time} με υπεύθυνο ${
        owner?.name || "ομάδα"
      }.`,
    });
  }

  result.push({
    title: "Stand-alone mobile demo",
    body: "Το app αποθηκεύει στοιχεία τοπικά στη συσκευή. Για κοινή χρήση από όλους χρειάζεται backend.",
  });

  return result;
}

function hydrateUserOptions() {
  elements.userSelect.innerHTML = state.users
    .map((user) => `<option value="${user.id}">${user.name} • ${user.role}</option>`)
    .join("");
}

function hydrateOwnerOptions() {
  elements.appointmentOwner.innerHTML = state.users
    .map((user) => `<option value="${user.id}">${user.name}</option>`)
    .join("");

  elements.appointmentOwner.value = currentUserId;
}

function setAppointmentDefaults() {
  elements.appointmentForm.elements.date.value = currentLocalDate();
  elements.appointmentForm.elements.time.value = "10:00";
  elements.appointmentOwner.value = currentUserId;
}

function setActiveTab(tabName) {
  elements.tabLinks.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  elements.tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;

  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return structuredClone(initialData);
    const parsed = JSON.parse(raw);

    return {
      users: Array.isArray(parsed.users) ? parsed.users : structuredClone(initialData.users),
      messages: Array.isArray(parsed.messages)
        ? parsed.messages
        : structuredClone(initialData.messages),
      appointments: Array.isArray(parsed.appointments)
        ? parsed.appointments
        : structuredClone(initialData.appointments),
    };
  } catch {
    return structuredClone(initialData);
  }
}

function persistState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadSession() {
  return localStorage.getItem(sessionKey) || "";
}

function findUser(userId) {
  return state.users.find((item) => item.id === userId);
}

function currentLocalDate() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localNow.toISOString().slice(0, 10);
}

function currentLocalDateTime() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localNow.toISOString().slice(0, 16);
}

function formatDisplayDate(dateString) {
  return new Intl.DateTimeFormat("el-GR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}

function formatShortDate(dateString) {
  return new Intl.DateTimeFormat("el-GR", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateString}T00:00:00`));
}

function formatTime(dateTimeString) {
  return new Intl.DateTimeFormat("el-GR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateTimeString));
}

function byDateTime(a, b) {
  return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function createEmptyState(message) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.textContent = message;
  return element;
}
