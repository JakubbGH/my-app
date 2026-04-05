// --- 1. FIREBASE INITIALIZATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDBkF2EJxgk4buiqUak-ZCLfKcPzpX7gsw",
    authDomain: "ecs-tool.firebaseapp.com",
    projectId: "ecs-tool",
    storageBucket: "ecs-tool.firebasestorage.app",
    messagingSenderId: "796028644982",
    appId: "1:796028644982:web:d6953c3ce305734d7a3957"
};

const ADMIN_EMAIL = "admin@ecs-tool.com";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let database = [];

// FORCES LOGOUT ON TAB CLOSE
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

// --- 2. AUTH LISTENER ---
auth.onAuthStateChanged((user) => {
    const loginOverlay = document.getElementById("loginOverlay");
    const mainApp = document.getElementById("mainApp");
    const adminSection = document.getElementById("adminSection");

    if (user) {
        loginOverlay.style.display = "none";
        mainApp.style.display = "block";
        if (user.email === ADMIN_EMAIL) adminSection.style.display = "block";
        loadDataFromCloud();
    } else {
        loginOverlay.style.display = "flex";
        mainApp.style.display = "none";
        adminSection.style.display = "none";
    }
});

async function handleLogin() {
    const email = document.getElementById("emailInput").value.trim();
    const pass = document.getElementById("passInput").value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        const err = document.getElementById("loginError");
        err.style.display = "block";
        err.innerText = "Error: " + e.message;
    }
}

// --- 3. DATA LOADING ---
async function loadDataFromCloud() {
    const status = document.getElementById("syncStatus");
    status.innerText = "Syncing...";
    try {
        const snap = await db.collection("buildings").get();
        database = snap.docs.map(doc => ({ 
            building: doc.id, 
            ecs_list: doc.data().ecs_list || [] 
        }));
        
        const bSelect = document.getElementById("buildingSelect");
        bSelect.innerHTML = "";
        database.sort((a, b) => a.building.localeCompare(b.building))
                .forEach(item => bSelect.add(new Option(item.building, item.building)));
        
        status.innerText = "Cloud Active";
        status.style.background = "#d4edda";
    } catch (e) { 
        status.innerText = "Offline"; 
        status.style.background = "#f8d7da";
    }
}

// --- 4. TABLE LOGIC (Duplicate Check) ---
function loadBuildingToTable() {
    const bValue = document.getElementById("buildingSelect").value;
    const tbody = document.querySelector("#ecsTable tbody");
    if (!bValue || bValue === "Loading...") return;

    // Duplicate Check
    const isAlreadyLoaded = Array.from(tbody.rows).some(row => row.cells[0].innerText === bValue);
    if (isAlreadyLoaded) return alert(`⚠️ Building ${bValue} is already in the table.`);

    const match = database.find(d => d.building === bValue);
    if (match) {
        match.ecs_list.forEach(ecs => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td style="font-weight:bold">${bValue}</td>
                <td>${ecs}</td>
                <td><select style="width:100%; padding:5px; border-radius:4px; border:1px solid #ccc;">
                    <option>1HAND_POS</option><option>2PREP_ALMT</option><option>3WELDING</option><option>4PUNCH</option>
                </select></td>
                <td><button class="del-btn" onclick="this.parentElement.parentElement.remove()">DEL</button></td>
            `;
        });
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
}

// --- 5. SUBMIT TO CLOUD ---
async function saveToCloud() {
    const rows = document.querySelectorAll("#ecsTable tbody tr");
    const btn = document.getElementById("mainSaveBtn");
    if (rows.length === 0) return alert("❌ Table is empty.");

    const reportData = Array.from(rows).map(tr => ({
        building: tr.cells[0].innerText,
        ecs_code: tr.cells[1].innerText,
        status: tr.cells[2].querySelector("select").value
    }));

    try {
        btn.disabled = true;
        btn.innerText = "⏳ SYNCING...";
        const reportID = `${reportData[0].building}_${Date.now()}`;
        await db.collection("reports").doc(reportID).set({
            data: reportData,
            user: auth.currentUser.email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("✅ SUCCESS: Data saved to cloud.");
        document.querySelector("#ecsTable tbody").innerHTML = "";
    } catch (e) { 
        alert("⚠️ Cloud Error: " + e.message); 
    }
    btn.disabled = false;
    btn.innerText = "SAVE REPORT";
}

// --- 6. ADMIN: CSV IMPORT ---
document.getElementById('csvFileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) document.getElementById('uploadCsvBtn').style.display = 'block';
});

async function processCSV() {
    const btn = document.getElementById('uploadCsvBtn');
    const file = document.getElementById('csvFileInput').files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const rows = e.target.result.split('\n').filter(r => r.trim() !== '');
            const batch = db.batch();
            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i].split(',');
                if (cols.length < 2) continue;
                const codes = cols[1].replace(/"/g, '').split(';').map(s => s.trim());
                batch.set(db.collection("buildings").doc(cols[0].trim()), { ecs_list: codes });
            }
            await batch.commit();
            alert("✅ Building list updated!");
            loadDataFromCloud();
            btn.style.display = 'none';
        } catch (err) { alert("CSV Error: " + err.message); }
    };
    reader.readAsText(file);
}

// --- 7. ADMIN: EXPORT WITH SAFETY CHECK ---
async function exportAllReports() {
    try {
        const snap = await db.collection("reports").get();
        if (snap.empty) return alert("No reports in cloud.");

        let csv = "Building,ECS,Status,User,Time\n";
        snap.forEach(doc => {
            const r = doc.data();
            const time = r.timestamp ? r.timestamp.toDate().toLocaleString() : "";
            // Check if data is an array before looping
            if (r.data && Array.isArray(r.data)) {
                r.data.forEach(i => csv += `"${i.building}","${i.ecs_code}","${i.status}","${r.user}","${time}"\n`);
            }
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `ECS_Export_${Date.now()}.csv`;
        link.click();
    } catch (e) { alert("Export Error: " + e.message); }
}

// --- 8. ADMIN: WIPE FUNCTIONS ---
async function clearAllReports() {
    if (!confirm("⚠️ DELETE ALL REPORT HISTORY? This cannot be undone.")) return;
    try {
        const snap = await db.collection("reports").get();
        const batch = db.batch();
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        alert("✅ Report history cleared.");
    } catch (e) { alert(e.message); }
}

async function wipeAllBuildings() {
    if (!confirm("⚠️ WIPE MASTER BUILDING LIST? Technicians will have nothing to load.")) return;
    try {
        const snap = await db.collection("buildings").get();
        const batch = db.batch();
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        alert("✅ Master list wiped.");
        database = [];
        document.getElementById("buildingSelect").innerHTML = "<option>Empty</option>";
    } catch (e) { alert(e.message); }
}
