// --- 1. CONFIGURATION ---
// Replace these with the keys from your Firebase Console (Project Settings)
const firebaseConfig = {
    apiKey: "AIzaSyDBkF2EJxgk4buiqUak-ZCLfKcPzpX7gsw",
    authDomain: "ecs-tool.firebaseapp.com",
    projectId: "ecs-tool",
    storageBucket: "ecs-tool.firebasestorage.app",
    messagingSenderId: "796028644982",
    appId: "1:796028644982:web:d6953c3ce305734d7a3957"
};

// Initialize Firebase Services
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let database = []; // Will hold building data pulled from Cloud

// --- 2. LOGIN LOGIC ---
async function handleLogin() {
    const email = document.getElementById("emailInput").value;
    const pass = document.getElementById("passInput").value;
    const errorMsg = document.getElementById("loginError");

    try {
        // Securely authenticate with Firebase
        await auth.signInWithEmailAndPassword(email, pass);
        
        // Hide login, show app
        document.getElementById("loginOverlay").style.display = "none";
        document.getElementById("mainApp").style.display = "block";
        
        // Trigger the Cloud Data pull
        loadDataFromCloud();
    } catch (error) {
        errorMsg.style.display = "block";
        errorMsg.innerText = "Login Failed: " + error.message;
    }
}

// --- 3. CLOUD DATA FETCH ---
async function loadDataFromCloud() {
    const statusLabel = document.getElementById("syncStatus");
    statusLabel.innerText = "Syncing from Cloud...";
    
    try {
        // Fetch the 'buildings' collection from Firestore
        const snapshot = await db.collection("buildings").get();
        
        database = []; // Clear current list
        
        snapshot.forEach(doc => {
            // doc.id is the Building Name (e.g., B101)
            // doc.data().ecs_list is the Array of codes
            database.push({
                building: doc.id,
                ecs_list: doc.data().ecs_list || []
            });
        });

        // Populate the dropdown
        const bSelect = document.getElementById("buildingSelect");
        bSelect.innerHTML = "";
        database.sort((a, b) => a.building.localeCompare(b.building)); // Sort A-Z
        
        database.forEach(item => {
            bSelect.add(new Option(item.building, item.building));
        });

        statusLabel.innerText = "Cloud Active: " + new Date().toLocaleTimeString();
        statusLabel.style.color = "green";
    } catch (error) {
        console.error("Cloud Error:", error);
        statusLabel.innerText = "DATABASE LOCKED";
        statusLabel.style.color = "red";
        alert("Permission Denied: You do not have access to the database.");
    }
}

// --- 4. TABLE LOGIC ---
function loadBuildingToTable() {
    const bValue = document.getElementById("buildingSelect").value.trim();
    const tbody = document.querySelector("#ecsTable tbody");
    const existingRows = tbody.getElementsByTagName("tr");

    // Duplicate Check: Scan table for existing building name
    for (let i = 0; i < existingRows.length; i++) {
        if (existingRows[i].cells[0].innerText.trim() === bValue) {
            alert(`Duplicate: ${bValue} is already in the table.`);
            return;
        }
    }

    const match = database.find(d => d.building === bValue);
    if (!match) return;

    match.ecs_list.forEach(ecs => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight:bold;">${bValue}</td>
            <td>${ecs}</td>
            <td>
                <select style="width:100%; padding:8px;">
                    <option>1HAND_POS</option>
                    <option>2PREP_ALMT</option>
                    <option>3WELDING</option>
                    <option>4PUNCH</option>
                </select>
            </td>
            <td>
                <button class="del-btn" onclick="this.parentElement.parentElement.remove()">DEL</button>
            </td>
        `;
    });
}

// --- 5. EXCEL EXPORT ---
function exportExcel() {
    const rows = document.querySelectorAll("#ecsTable tbody tr");
    if (rows.length === 0) return alert("No data to save.");

    const exportData = Array.from(rows).map(tr => ({
        "Building": tr.cells[0].innerText,
        "ECS Code": tr.cells[1].innerText,
        "Validation": tr.cells[2].querySelector("select").value
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FieldReport");
    XLSX.writeFile(wb, `MEH_Validation_${new Date().toISOString().split('T')[0]}.xlsx`);
}
