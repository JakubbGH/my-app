let database = [];

// Initialize on load
window.onload = () => { loadData(); };

// Paste the Config you copied from the Firebase Console here:
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-app.firebaseapp.com",
    projectId: "your-app",
    storageBucket: "your-app.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

async function checkLogin() {
    const email = document.getElementById("username").value; // Firebase needs an email format
    const pass = document.getElementById("password").value;
    const errorMsg = document.getElementById("loginError");

    try {
        // This is the secure "Handshake" with Google's servers
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, pass);
        
        // Success!
        console.log("Logged in as:", userCredential.user.email);
        document.getElementById("loginOverlay").style.display = "none";
        document.getElementById("mainApp").style.display = "block";
        loadData(); // Your existing function to load database.json
    } catch (error) {
        // Failure
        console.error("Login failed:", error.message);
        errorMsg.style.display = "block";
        errorMsg.innerText = "Access Denied: " + error.message;
    }
}

async function loadData() {
    const statusLabel = document.getElementById("syncStatus");
    statusLabel.innerText = "Syncing...";
    try {
        // Cache-buster ensures GitHub serves the absolute newest file
        const t = new Date().getTime();
        const response = await fetch(`./database.json?t=${t}`);
        
        if (!response.ok) throw new Error("File not found");
        
        database = await response.json();
        
        const bSelect = document.getElementById("buildingSelect");
        bSelect.innerHTML = "";
        database.forEach(item => {
            bSelect.add(new Option(item.building, item.building));
        });

        statusLabel.innerText = "PLOW Active: " + new Date().toLocaleTimeString();
        statusLabel.style.color = "green";
        console.log("PLOW Data Synced:", database);
    } catch (error) {
        statusLabel.innerText = "LOAD ERROR";
        statusLabel.style.color = "red";
        alert("CRITICAL: database.json could not be loaded. Check file name and JSON syntax.");
    }
}

function loadBuildingToTable() {
    const bValue = document.getElementById("buildingSelect").value.trim();
    const tbody = document.querySelector("#ecsTable tbody");
    const existingRows = tbody.getElementsByTagName("tr");

    // --- DUPLICATE PREVENTION LOOP ---
    for (let i = 0; i < existingRows.length; i++) {
        let currentCellVal = existingRows[i].cells[0].innerText.trim();
        if (currentCellVal.toLowerCase() === bValue.toLowerCase()) {
            alert(`Duplicate Blocked: ${bValue} is already in the list.`);
            return; // Hard stop
        }
    }

    // Find the building in our local database
    const match = database.find(d => d.building.trim().toLowerCase() === bValue.toLowerCase());

    if (!match || !match.ecs_list) {
        alert("Error: No data found for this selection.");
        return;
    }

    // Add all ECS codes from that building
    match.ecs_list.forEach(ecs => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight:bold;">${bValue}</td>
            <td>${ecs}</td>
            <td>
                <select style="width:100%; padding:8px; border-radius:4px;">
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

function exportExcel() {
    const rows = document.querySelectorAll("#ecsTable tbody tr");
    if (rows.length === 0) return alert("Table is empty.");

    const exportData = Array.from(rows).map(tr => ({
        "Building": tr.cells[0].innerText,
        "ECS Code": tr.cells[1].innerText,
        "Validation": tr.cells[2].querySelector("select").value
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Collection");
    
    const fileDate = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `PLOW_Data_${fileDate}.xlsx`);
}
