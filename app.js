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

const GATE_STATUSES_BY_COMMODITY = {
    SUPPORT: ["1ENDS_CUT", "2PREP_TACK", "3WELDING"],
    EQUIP: ["1_INT_PREP", "2_1ST_INST", "3_2ND_INST", "4_ALIGN", "5_FINAL"],
    PCON: ["1CUT_PREP", "2BOLT_ALMT"],
    CLAMPVALVE: ["1HAND_POS", "2INSTALL"],
    CABLE: ["Install"],
    INLINE: ["1HAND_POS", "2INSTALL"],
    DUCT: ["1HAND_POS", "2INST_DUCT", "3LEAK_TEST"],
    PIPE: ["1HAND_POS", "2PREP_ALMT", "3WELDING", "4PUNCH"]
};

auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

auth.onAuthStateChanged((user) => {
    const loginOverlay = document.getElementById("loginOverlay");
    const mainApp = document.getElementById("mainApp");
    const adminSection = document.getElementById("adminSection");

    if (user) {
        loginOverlay.style.display = "none";
        mainApp.style.display = "block";

        if (user.email === ADMIN_EMAIL) {
            adminSection.style.display = "block";
        } else {
            adminSection.style.display = "none";
        }

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
    const err = document.getElementById("loginError");

    err.style.display = "none";
    err.innerText = "";

    if (!email || !pass) {
        err.style.display = "block";
        err.innerText = "Please enter both email and password.";
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        err.style.display = "block";
        err.innerText = "Error: " + e.message;
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
    } catch (e) {
        alert("Logout error: " + e.message);
    }
}

async function loadDataFromCloud() {
    const status = document.getElementById("syncStatus");

    status.innerText = "Syncing...";
    status.style.background = "#fff3cd";
    status.style.color = "#664d03";

    try {
        const snap = await db.collection("buildings").get();

        database = snap.docs.map(doc => ({
            building: doc.id,
            ecs_list: doc.data().ecs_list || []
        }));

        const bSelect = document.getElementById("buildingSelect");
        bSelect.innerHTML = "";

        if (database.length === 0) {
            bSelect.innerHTML = "<option>Empty</option>";
        } else {
            database
                .sort((a, b) => a.building.localeCompare(b.building))
                .forEach(item => {
                    bSelect.add(new Option(item.building, item.building));
                });
        }

        status.innerText = "Cloud Active";
        status.style.background = "#d4edda";
        status.style.color = "#155724";
    } catch (e) {
        status.innerText = "Offline";
        status.style.background = "#f8d7da";
        status.style.color = "#842029";
        console.error(e);
    }
}

function loadBuildingToTable() {
    const bValue = document.getElementById("buildingSelect").value;
    const ecsPicker = document.getElementById("ecsPicker");
    const ecsSelect = document.getElementById("ecsCodeSelect");

    if (!bValue || bValue === "Loading..." || bValue === "Empty") {
        return alert("Please select a valid building.");
    }

    const match = database.find(d => d.building === bValue);

    if (!match || !Array.isArray(match.ecs_list) || match.ecs_list.length === 0) {
        ecsSelect.innerHTML = "";
        ecsPicker.style.display = "none";
        return alert("No ECS codes found for this building.");
    }

    ecsSelect.innerHTML = "";

    match.ecs_list
        .sort((a, b) => {
            const roomA = getRoomIdFromItem(a);
            const roomB = getRoomIdFromItem(b);
            const codeA = getEcsCodeFromItem(a);
            const codeB = getEcsCodeFromItem(b);

            const roomCompare = String(roomA).localeCompare(String(roomB));
            if (roomCompare !== 0) return roomCompare;

            return String(codeA).localeCompare(String(codeB));
        })
        .forEach(item => {
            const roomId = getRoomIdFromItem(item);
            const ecsCode = getEcsCodeFromItem(item);
            const commodity = normalizeCommodity(getCommodityFromItem(item));

            const optionLabel = `${roomId} - ${ecsCode} - ${commodity}`;

            const option = new Option(optionLabel, ecsCode);
            option.dataset.roomId = roomId;
            option.dataset.ecsCode = ecsCode;
            option.dataset.commodity = commodity;

            ecsSelect.add(option);
        });

    ecsPicker.style.display = "block";
}

function addSelectedEcsCodes() {
    const bValue = document.getElementById("buildingSelect").value;
    const ecsSelect = document.getElementById("ecsCodeSelect");
    const selectedOptions = Array.from(ecsSelect.selectedOptions);

    if (!bValue || bValue === "Loading..." || bValue === "Empty") {
        return alert("Please select a valid building.");
    }

    if (selectedOptions.length === 0) {
        return alert("Please select at least one ECS code.");
    }

    let addedCount = 0;
    let duplicateCount = 0;

    selectedOptions.forEach(option => {
        const roomId = option.dataset.roomId || "";
        const ecsCode = option.dataset.ecsCode || option.value;
        const commodity = normalizeCommodity(option.dataset.commodity);

        if (isDuplicateReportRow(bValue, roomId, ecsCode)) {
            duplicateCount++;
            return;
        }

        addReportRow(bValue, roomId, ecsCode, commodity);
        addedCount++;
    });

    if (addedCount === 0 && duplicateCount > 0) {
        alert("Selected ECS codes are already in your report.");
    }

    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function addReportRow(building, roomId, ecsCode, commodity) {
    const tbody = document.querySelector("#ecsTable tbody");
    const row = tbody.insertRow();

    const cleanCommodity = normalizeCommodity(commodity);
    const statuses = GATE_STATUSES_BY_COMMODITY[cleanCommodity] || [];

    const statusOptions = statuses
        .map(status => `<option>${escapeHtml(status)}</option>`)
        .join("");

    row.innerHTML = `
        <td style="font-weight:bold">${escapeHtml(building)}</td>
        <td>${escapeHtml(roomId)}</td>
        <td>${escapeHtml(ecsCode)}</td>
        <td>${escapeHtml(cleanCommodity)}</td>
        <td>
            <select style="width:100%;">
                ${statusOptions}
            </select>
        </td>
        <td>
            <button class="del-btn" onclick="this.parentElement.parentElement.remove()">DELETE</button>
        </td>
    `;
}

function addOpportunisticEntry() {
    const bName = prompt("Enter Building Name:");
    if (!bName) return;

    const roomId = prompt("Enter Room ID:");
    if (!roomId) return;

    const ecsCode = prompt("Enter ECS Code:");
    if (!ecsCode) return;

    const commodity = prompt(
        "Enter Commodity:\nSUPPORT, EQUIP, PCON, CLAMPVALVE, CABLE, INLINE, DUCT, PIPE"
    );

    if (!commodity) return;

    const cleanBuilding = bName.trim().toUpperCase();
    const cleanRoomId = roomId.trim().toUpperCase();
    const cleanEcs = ecsCode.trim().toUpperCase();
    const cleanCommodity = normalizeCommodity(commodity);

    if (!GATE_STATUSES_BY_COMMODITY[cleanCommodity]) {
        return alert("Invalid commodity entered.");
    }

    if (isDuplicateReportRow(cleanBuilding, cleanRoomId, cleanEcs)) {
        return alert("This item is already in your report.");
    }

    addReportRow(cleanBuilding, cleanRoomId, cleanEcs, cleanCommodity);

    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

async function saveToCloud() {
    const rows = document.querySelectorAll("#ecsTable tbody tr");
    const btn = document.getElementById("mainSaveBtn");

    if (rows.length === 0) {
        return alert("Table is empty.");
    }

    const reportData = Array.from(rows).map(tr => ({
        building: tr.cells[0].innerText,
        room_id: tr.cells[1].innerText,
        ecs_code: tr.cells[2].innerText,
        commodity: tr.cells[3].innerText,
        status: tr.cells[4].querySelector("select").value
    }));

    try {
        btn.disabled = true;
        btn.innerText = "SAVING REPORT...";

        const reportID = `${reportData[0].building.replace(/\s+/g, "_")}_${Date.now()}`;

        await db.collection("reports").doc(reportID).set({
            data: reportData,
            user: auth.currentUser.email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Success: Report saved.");
        document.querySelector("#ecsTable tbody").innerHTML = "";
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "SAVE REPORT";
    }
}

function clearCurrentReport() {
    if (!confirm("Clear the current report table?")) return;
    document.querySelector("#ecsTable tbody").innerHTML = "";
}

function selectAllVisibleEcsCodes() {
    const ecsSelect = document.getElementById("ecsCodeSelect");

    Array.from(ecsSelect.options).forEach(option => {
        option.selected = true;
    });
}

function clearSelectedEcsCodes() {
    const ecsSelect = document.getElementById("ecsCodeSelect");

    Array.from(ecsSelect.options).forEach(option => {
        option.selected = false;
    });
}

function isDuplicateReportRow(building, roomId, ecsCode) {
    const tbody = document.querySelector("#ecsTable tbody");

    return Array.from(tbody.rows).some(row =>
        row.cells[0].innerText.toUpperCase() === String(building).toUpperCase() &&
        row.cells[1].innerText.toUpperCase() === String(roomId).toUpperCase() &&
        row.cells[2].innerText.toUpperCase() === String(ecsCode).toUpperCase()
    );
}

function getRoomIdFromItem(item) {
    if (typeof item === "string") return "";
    return item.room_id || item.roomId || item.room || "";
}

function getEcsCodeFromItem(item) {
    if (typeof item === "string") return item;
    return item.code || item.ecs_code || item.ecsCode || item.ecs || "";
}

function getCommodityFromItem(item) {
    if (typeof item === "string") return "PIPE";
    return item.commodity || "PIPE";
}

function normalizeCommodity(value) {
    const clean = String(value || "").trim().toUpperCase();

    if (clean === "CLAMP VALVE") return "CLAMPVALVE";
    if (clean === "CLAMP_VALVE") return "CLAMPVALVE";
    if (clean === "CLAMP-VALVE") return "CLAMPVALVE";

    return clean || "PIPE";
}

document.getElementById("csvFileInput").addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
        document.getElementById("uploadCsvBtn").style.display = "inline-block";
    }
});

async function processCSV() {
    const btn = document.getElementById("uploadCsvBtn");
    const file = document.getElementById("csvFileInput").files[0];

    if (!file) {
        return alert("Please select a CSV file first.");
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const text = e.target.result;
            const rows = parseCSV(text);

            if (rows.length < 2) {
                return alert("CSV file is empty.");
            }

            const headers = rows[0].map(h => h.trim().toUpperCase());

            const buildingIndex = headers.findIndex(h =>
                h === "BUILDING" ||
                h === "BUILDING NAME"
            );

            const roomIndex = headers.findIndex(h =>
                h === "ROOM ID" ||
                h === "ROOM" ||
                h === "ROOM_ID" ||
                h === "ROOMID"
            );

            const ecsIndex = headers.findIndex(h =>
                h === "ECS" ||
                h === "ECS CODE" ||
                h === "ECS_CODE" ||
                h === "ECSCODE"
            );

            const commodityIndex = headers.findIndex(h =>
                h === "COMMODITY" ||
                h === "COMMODITY CODE"
            );

            if (
                buildingIndex === -1 ||
                roomIndex === -1 ||
                ecsIndex === -1 ||
                commodityIndex === -1
            ) {
                return alert("CSV must contain Building, Room ID, ECS Code, and Commodity columns.");
            }

            const grouped = {};

            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i];

                const building = cols[buildingIndex]?.trim();
                const roomId = cols[roomIndex]?.trim();
                const ecsCode = cols[ecsIndex]?.trim();
                const commodity = normalizeCommodity(cols[commodityIndex]);

                if (!building || !roomId || !ecsCode || !commodity) continue;

                if (!GATE_STATUSES_BY_COMMODITY[commodity]) {
                    console.warn(`Skipping ${ecsCode}: invalid commodity ${commodity}`);
                    continue;
                }

                if (!grouped[building]) {
                    grouped[building] = [];
                }

                const alreadyExists = grouped[building].some(item =>
                    String(item.room_id).toUpperCase() === String(roomId).toUpperCase() &&
                    String(item.code).toUpperCase() === String(ecsCode).toUpperCase()
                );

                if (!alreadyExists) {
                    grouped[building].push({
                        room_id: roomId,
                        code: ecsCode,
                        commodity: commodity
                    });
                }
            }

            const buildingNames = Object.keys(grouped);

            if (buildingNames.length === 0) {
                return alert("No valid rows found in CSV.");
            }

            btn.disabled = true;
            btn.innerText = "UPLOADING...";

            const batch = db.batch();

            buildingNames.forEach(building => {
                batch.set(db.collection("buildings").doc(building), {
                    ecs_list: grouped[building]
                });
            });

            await batch.commit();

            alert("Database updated.");
            loadDataFromCloud();

            btn.style.display = "none";
            btn.disabled = false;
            btn.innerText = "UPLOAD CSV TO DATABASE";

            document.getElementById("csvFileInput").value = "";
        } catch (err) {
            alert("CSV Error: " + err.message);
            console.error(err);

            btn.disabled = false;
            btn.innerText = "UPLOAD CSV TO DATABASE";
        }
    };

    reader.readAsText(file);
}

function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentValue = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"' && insideQuotes && nextChar === '"') {
            currentValue += '"';
            i++;
        } else if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
            currentRow.push(currentValue);
            currentValue = "";
        } else if ((char === "\n" || char === "\r") && !insideQuotes) {
            if (currentValue || currentRow.length > 0) {
                currentRow.push(currentValue);
                rows.push(currentRow);
                currentRow = [];
                currentValue = "";
            }

            if (char === "\r" && nextChar === "\n") {
                i++;
            }
        } else {
            currentValue += char;
        }
    }

    if (currentValue || currentRow.length > 0) {
        currentRow.push(currentValue);
        rows.push(currentRow);
    }

    return rows.filter(row =>
        row.some(cell => String(cell).trim() !== "")
    );
}

async function exportAllReports() {
    try {
        const snap = await db.collection("reports").get();

        if (snap.empty) {
            return alert("No reports available.");
        }

        let csv = "Building,Room ID,ECS,Commodity,Status,User,Time\n";

        snap.forEach(doc => {
            const r = doc.data();
            const time = r.timestamp ? r.timestamp.toDate().toLocaleString() : "N/A";

            if (r.data && Array.isArray(r.data)) {
                r.data.forEach(i => {
                    csv += `"${csvEscape(i.building)}","${csvEscape(i.room_id || "")}","${csvEscape(i.ecs_code)}","${csvEscape(i.commodity || "")}","${csvEscape(i.status)}","${csvEscape(r.user)}","${csvEscape(time)}"\n`;
                });
            }
        });

        const blob = new Blob([csv], { type: "text/csv" });
        const link = document.createElement("a");

        link.href = URL.createObjectURL(blob);
        link.download = `Export_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();

        URL.revokeObjectURL(link.href);
    } catch (e) {
        alert("Export error: " + e.message);
    }
}

async function clearAllReports() {
    if (!confirm("Delete all report history? This cannot be undone.")) return;

    try {
        const snap = await db.collection("reports").get();

        if (snap.empty) {
            return alert("No reports to delete.");
        }

        const batch = db.batch();
        snap.forEach(d => batch.delete(d.ref));

        await batch.commit();

        alert("Report history cleared.");
    } catch (e) {
        alert("Error: " + e.message);
    }
}

async function wipeAllBuildings() {
    if (!confirm("Wipe master building list? This cannot be undone.")) return;

    try {
        const snap = await db.collection("buildings").get();

        if (snap.empty) {
            return alert("No buildings to wipe.");
        }

        const batch = db.batch();
        snap.forEach(d => batch.delete(d.ref));

        await batch.commit();

        alert("Master list wiped.");

        database = [];
        document.getElementById("buildingSelect").innerHTML = "<option>Empty</option>";
        document.getElementById("ecsCodeSelect").innerHTML = "";
        document.getElementById("ecsPicker").style.display = "none";
    } catch (e) {
        alert("Error: " + e.message);
    }
}

function csvEscape(value) {
    return String(value ?? "").replace(/"/g, '""');
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
