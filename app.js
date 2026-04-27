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
        adminSection.style.display = user.email === ADMIN_EMAIL ? "block" : "none";

        loadBuildingsFromCloud();
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

/* -------------------------------------------------------
   BUILDING LOAD
------------------------------------------------------- */

async function loadBuildingsFromCloud() {
    const status = document.getElementById("syncStatus");
    const bSelect = document.getElementById("buildingSelect");
    const oppBuildingSelect = document.getElementById("oppBuildingSelect");

    status.innerText = "Syncing...";
    status.style.background = "#fff3cd";
    status.style.color = "#664d03";

    try {
        const snap = await db.collection("buildings")
            .orderBy("building")
            .get();

        bSelect.innerHTML = "";
        oppBuildingSelect.innerHTML = "";

        if (snap.empty) {
            bSelect.innerHTML = `<option value="">Empty</option>`;
            oppBuildingSelect.innerHTML = `<option value="">Empty</option>`;
        } else {
            bSelect.innerHTML = `<option value="">Select building...</option>`;
            oppBuildingSelect.innerHTML = `<option value="">Select building...</option>`;

            snap.forEach(doc => {
                const data = doc.data();
                const building = data.building || doc.id;

                bSelect.add(new Option(building, building));
                oppBuildingSelect.add(new Option(building, building));
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

/* -------------------------------------------------------
   NORMAL BUILDING → ROOM → ECS FLOW
------------------------------------------------------- */

async function loadRoomsForBuilding() {
    const building = document.getElementById("buildingSelect").value;
    const roomPicker = document.getElementById("roomPicker");
    const roomSelect = document.getElementById("roomSelect");
    const ecsSelect = document.getElementById("ecsCodeSelect");

    if (!building) {
        return alert("Please select a building.");
    }

    roomSelect.innerHTML = `<option value="">Loading rooms...</option>`;
    ecsSelect.innerHTML = `<option value="">Select ECS...</option>`;

    try {
        const rooms = await getRoomsForBuilding(building);

        roomSelect.innerHTML = `<option value="">Select room...</option>`;

        rooms.forEach(roomId => {
            roomSelect.add(new Option(roomId, roomId));
        });

        if (rooms.length === 0) {
            roomPicker.style.display = "none";
            return alert("No rooms found for this building.");
        }

        roomPicker.style.display = "block";
    } catch (e) {
        alert("Room load error: " + e.message);
        console.error(e);
        roomSelect.innerHTML = `<option value="">Error loading rooms</option>`;
    }
}

async function loadEcsForRoom() {
    const building = document.getElementById("buildingSelect").value;
    const roomId = document.getElementById("roomSelect").value;
    const ecsSelect = document.getElementById("ecsCodeSelect");

    ecsSelect.innerHTML = `<option value="">Loading ECS...</option>`;

    if (!building || !roomId) {
        ecsSelect.innerHTML = `<option value="">Select ECS...</option>`;
        return;
    }

    try {
        const ecsItems = await getEcsForBuildingRoom(building, roomId);

        ecsSelect.innerHTML = `<option value="">Select ECS...</option>`;

        ecsItems.forEach(item => {
            const label = `${item.ecs_code} - ${item.commodity}`;
            const option = new Option(label, item.id);

            option.dataset.roomId = item.room_id;
            option.dataset.ecsCode = item.ecs_code;
            option.dataset.commodity = item.commodity;

            ecsSelect.add(option);
        });

        if (ecsItems.length === 0) {
            ecsSelect.innerHTML = `<option value="">No ECS found</option>`;
        }
    } catch (e) {
        alert("ECS load error: " + e.message);
        console.error(e);
        ecsSelect.innerHTML = `<option value="">Error loading ECS</option>`;
    }
}

function addSelectedEcsCode() {
    const building = document.getElementById("buildingSelect").value;
    const ecsSelect = document.getElementById("ecsCodeSelect");
    const option = ecsSelect.selectedOptions[0];

    if (!building) {
        return alert("Please select a building.");
    }

    if (!option || !option.value) {
        return alert("Please select an ECS code.");
    }

    const roomId = option.dataset.roomId;
    const ecsCode = option.dataset.ecsCode;
    const commodity = option.dataset.commodity;

    if (isDuplicateReportRow(building, roomId, ecsCode)) {
        return alert("This item is already in your report.");
    }

    addReportRow(building, roomId, ecsCode, commodity);
}

/* -------------------------------------------------------
   OPPORTUNISTIC BUILDING → ROOM → ECS FLOW
------------------------------------------------------- */

function toggleOpportunisticPicker() {
    const picker = document.getElementById("opportunisticPicker");
    picker.style.display = picker.style.display === "block" ? "none" : "block";
}

async function loadOpportunisticRooms() {
    const building = document.getElementById("oppBuildingSelect").value;
    const roomSelect = document.getElementById("oppRoomSelect");
    const ecsSelect = document.getElementById("oppEcsSelect");

    roomSelect.innerHTML = `<option value="">Loading rooms...</option>`;
    ecsSelect.innerHTML = `<option value="">Select ECS...</option>`;

    if (!building) {
        roomSelect.innerHTML = `<option value="">Select room...</option>`;
        return;
    }

    try {
        const rooms = await getRoomsForBuilding(building);

        roomSelect.innerHTML = `<option value="">Select room...</option>`;

        rooms.forEach(roomId => {
            roomSelect.add(new Option(roomId, roomId));
        });

        if (rooms.length === 0) {
            roomSelect.innerHTML = `<option value="">No rooms found</option>`;
        }
    } catch (e) {
        alert("Room load error: " + e.message);
        console.error(e);
        roomSelect.innerHTML = `<option value="">Error loading rooms</option>`;
    }
}

async function loadOpportunisticEcs() {
    const building = document.getElementById("oppBuildingSelect").value;
    const roomId = document.getElementById("oppRoomSelect").value;
    const ecsSelect = document.getElementById("oppEcsSelect");

    ecsSelect.innerHTML = `<option value="">Loading ECS...</option>`;

    if (!building || !roomId) {
        ecsSelect.innerHTML = `<option value="">Select ECS...</option>`;
        return;
    }

    try {
        const ecsItems = await getEcsForBuildingRoom(building, roomId);

        ecsSelect.innerHTML = `<option value="">Select ECS...</option>`;

        ecsItems.forEach(item => {
            const label = `${item.ecs_code} - ${item.commodity}`;
            const option = new Option(label, item.id);

            option.dataset.building = item.building;
            option.dataset.roomId = item.room_id;
            option.dataset.ecsCode = item.ecs_code;
            option.dataset.commodity = item.commodity;

            ecsSelect.add(option);
        });

        if (ecsItems.length === 0) {
            ecsSelect.innerHTML = `<option value="">No ECS found</option>`;
        }
    } catch (e) {
        alert("ECS load error: " + e.message);
        console.error(e);
        ecsSelect.innerHTML = `<option value="">Error loading ECS</option>`;
    }
}

function addSelectedOpportunisticEntry() {
    const building = document.getElementById("oppBuildingSelect").value;
    const roomId = document.getElementById("oppRoomSelect").value;
    const ecsSelect = document.getElementById("oppEcsSelect");
    const option = ecsSelect.selectedOptions[0];

    if (!building) {
        return alert("Please select a building.");
    }

    if (!roomId) {
        return alert("Please select a room.");
    }

    if (!option || !option.value) {
        return alert("Please select an ECS code.");
    }

    const ecsCode = option.dataset.ecsCode;
    const commodity = option.dataset.commodity;

    if (isDuplicateReportRow(building, roomId, ecsCode)) {
        return alert("This item is already in your report.");
    }

    addReportRow(building, roomId, ecsCode, commodity);

    window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth"
    });
}

/* -------------------------------------------------------
   FIRESTORE QUERY HELPERS
------------------------------------------------------- */

async function getRoomsForBuilding(building) {
    const snap = await db.collection("ecs_master")
        .where("building", "==", building)
        .orderBy("room_id")
        .get();

    const rooms = new Set();

    snap.forEach(doc => {
        const data = doc.data();
        if (data.room_id) rooms.add(data.room_id);
    });

    return [...rooms].sort();
}

async function getEcsForBuildingRoom(building, roomId) {
    const snap = await db.collection("ecs_master")
        .where("building", "==", building)
        .where("room_id", "==", roomId)
        .orderBy("ecs_code")
        .get();

    const items = [];

    snap.forEach(doc => {
        const data = doc.data();

        items.push({
            id: doc.id,
            building: data.building,
            room_id: data.room_id,
            ecs_code: data.ecs_code,
            commodity: data.commodity
        });
    });

    return items;
}

/* -------------------------------------------------------
   REPORT TABLE
------------------------------------------------------- */

function addReportRow(building, roomId, ecsCode, commodity) {
    const tbody = document.querySelector("#ecsTable tbody");
    const row = tbody.insertRow();

    const cleanCommodity = normalizeCommodity(commodity);
    const statuses = GATE_STATUSES_BY_COMMODITY[cleanCommodity] || [];

    const statusOptions = statuses
        .map(status => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`)
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

function isDuplicateReportRow(building, roomId, ecsCode) {
    const tbody = document.querySelector("#ecsTable tbody");

    return Array.from(tbody.rows).some(row =>
        row.cells[0].innerText.toUpperCase() === String(building).toUpperCase() &&
        row.cells[1].innerText.toUpperCase() === String(roomId).toUpperCase() &&
        row.cells[2].innerText.toUpperCase() === String(ecsCode).toUpperCase()
    );
}

function clearCurrentReport() {
    if (!confirm("Clear the current report table?")) return;
    document.querySelector("#ecsTable tbody").innerHTML = "";
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

/* -------------------------------------------------------
   CSV UPLOAD
------------------------------------------------------- */

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
            const rows = parseCSV(e.target.result);

            if (rows.length < 2) {
                return alert("CSV file is empty.");
            }

            const headers = rows[0].map(h => h.trim().toUpperCase());

            const buildingIndex = findHeader(headers, ["BUILDING", "BUILDING NAME"]);
            const roomIndex = findHeader(headers, ["ROOM ID", "ROOM", "ROOM_ID", "ROOMID"]);
            const ecsIndex = findHeader(headers, ["ECS CODE", "ECS", "ECS_CODE", "ECSCODE"]);
            const commodityIndex = findHeader(headers, ["COMMODITY", "COMMODITY CODE"]);

            if (
                buildingIndex === -1 ||
                roomIndex === -1 ||
                ecsIndex === -1 ||
                commodityIndex === -1
            ) {
                return alert("CSV must contain Building, Room ID, ECS Code, and Commodity columns.");
            }

            btn.disabled = true;
            btn.innerText = "UPLOADING...";

            const buildingSet = new Set();
            const ecsRows = [];

            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i];

                const building = cleanCell(cols[buildingIndex]);
                const roomId = cleanCell(cols[roomIndex]);
                const ecsCode = cleanCell(cols[ecsIndex]);
                const commodity = normalizeCommodity(cols[commodityIndex]);

                if (!building || !roomId || !ecsCode || !commodity) continue;

                if (!GATE_STATUSES_BY_COMMODITY[commodity]) {
                    console.warn(`Skipping row ${i + 1}: invalid commodity ${commodity}`);
                    continue;
                }

                buildingSet.add(building);

                ecsRows.push({
                    building,
                    room_id: roomId,
                    ecs_code: ecsCode,
                    commodity
                });
            }

            if (ecsRows.length === 0) {
                return alert("No valid rows found in CSV.");
            }

            await uploadLargeCsvToFirestore([...buildingSet], ecsRows);

            alert(`Upload complete. ${ecsRows.length} ECS entries saved.`);

            document.getElementById("csvFileInput").value = "";
            btn.style.display = "none";

            await loadBuildingsFromCloud();
        } catch (err) {
            alert("CSV Error: " + err.message);
            console.error(err);
        } finally {
            btn.disabled = false;
            btn.innerText = "UPLOAD CSV TO DATABASE";
        }
    };

    reader.readAsText(file);
}

async function uploadLargeCsvToFirestore(buildings, ecsRows) {
    const MAX_BATCH_SIZE = 450;
    let batch = db.batch();
    let operationCount = 0;

    for (const building of buildings) {
        const buildingRef = db.collection("buildings").doc(safeDocId(building));

        batch.set(buildingRef, {
            building,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        operationCount++;

        if (operationCount >= MAX_BATCH_SIZE) {
            await batch.commit();
            batch = db.batch();
            operationCount = 0;
        }
    }

    const seenDocIds = new Set();

    for (const item of ecsRows) {
        const docId = safeDocId(`${item.building}_${item.room_id}_${item.ecs_code}`);

        if (seenDocIds.has(docId)) continue;
        seenDocIds.add(docId);

        const ecsRef = db.collection("ecs_master").doc(docId);

        batch.set(ecsRef, {
            building: item.building,
            room_id: item.room_id,
            ecs_code: item.ecs_code,
            commodity: item.commodity,
            search_key: `${item.building}|${item.room_id}|${item.ecs_code}`,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        operationCount++;

        if (operationCount >= MAX_BATCH_SIZE) {
            await batch.commit();
            batch = db.batch();
            operationCount = 0;
        }
    }

    if (operationCount > 0) {
        await batch.commit();
    }
}

/* -------------------------------------------------------
   EXPORT / DELETE
------------------------------------------------------- */

async function exportAllReports() {
    try {
        const snap = await db.collection("reports").get();

        if (snap.empty) {
            return alert("No reports available.");
        }

        let csv = "Building,Room ID,ECS Code,Commodity,Status,User,Time\n";

        snap.forEach(doc => {
            const r = doc.data();
            const time = r.timestamp ? r.timestamp.toDate().toLocaleString() : "N/A";

            if (r.data && Array.isArray(r.data)) {
                r.data.forEach(i => {
                    csv += `"${csvEscape(i.building)}","${csvEscape(i.room_id)}","${csvEscape(i.ecs_code)}","${csvEscape(i.commodity)}","${csvEscape(i.status)}","${csvEscape(r.user)}","${csvEscape(time)}"\n`;
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
        console.error(e);
    }
}

async function clearAllReports() {
    if (!confirm("Delete all report history? This cannot be undone.")) return;

    try {
        await deleteCollectionInBatches("reports");
        alert("Report history cleared.");
    } catch (e) {
        alert("Clear reports error: " + e.message);
        console.error(e);
    }
}

async function wipeMasterList() {
    if (!confirm("Wipe master building, room, and ECS list? This cannot be undone.")) return;

    try {
        await deleteCollectionInBatches("ecs_master");
        await deleteCollectionInBatches("buildings");

        document.getElementById("buildingSelect").innerHTML = `<option value="">Empty</option>`;
        document.getElementById("oppBuildingSelect").innerHTML = `<option value="">Empty</option>`;

        document.getElementById("roomSelect").innerHTML = `<option value="">Select room...</option>`;
        document.getElementById("ecsCodeSelect").innerHTML = `<option value="">Select ECS...</option>`;

        document.getElementById("oppRoomSelect").innerHTML = `<option value="">Select room...</option>`;
        document.getElementById("oppEcsSelect").innerHTML = `<option value="">Select ECS...</option>`;

        document.getElementById("roomPicker").style.display = "none";
        document.getElementById("opportunisticPicker").style.display = "none";

        alert("Master list wiped.");
    } catch (e) {
        alert("Wipe error: " + e.message);
        console.error(e);
    }
}

async function deleteCollectionInBatches(collectionName) {
    const MAX_BATCH_SIZE = 450;

    while (true) {
        const snap = await db.collection(collectionName)
            .limit(MAX_BATCH_SIZE)
            .get();

        if (snap.empty) break;

        const batch = db.batch();

        snap.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
    }
}

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

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

            if (char === "\r" && nextChar === "\n") i++;
        } else {
            currentValue += char;
        }
    }

    if (currentValue || currentRow.length > 0) {
        currentRow.push(currentValue);
        rows.push(currentRow);
    }

    return rows.filter(row => row.some(cell => String(cell).trim() !== ""));
}

function findHeader(headers, possibleNames) {
    return headers.findIndex(h => possibleNames.includes(h));
}

function cleanCell(value) {
    return String(value ?? "").trim();
}

function normalizeCommodity(value) {
    const clean = String(value || "").trim().toUpperCase();

    if (clean === "CLAMP VALVE") return "CLAMPVALVE";
    if (clean === "CLAMP_VALVE") return "CLAMPVALVE";
    if (clean === "CLAMP-VALVE") return "CLAMPVALVE";

    return clean;
}

function safeDocId(value) {
    return String(value)
        .trim()
        .replace(/[\/\\#?\[\]]/g, "_");
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
