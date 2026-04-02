let database = [];

// Run automatically when the script loads
console.log("app.js loaded. Initializing...");
loadData();

async function loadData() {
    const statusLabel = document.getElementById("syncStatus");
    statusLabel.innerText = "Syncing...";

    try {
        // Use timestamp to prevent GitHub from showing old cached data
        const response = await fetch(`./database.json?t=${new Date().getTime()}`);
        
        if (!response.ok) throw new Error("File not found on GitHub");

        const data = await response.json();
        console.log("Data loaded successfully:", data);

        database = data;
        renderBuildingDropdown();

        statusLabel.innerText = "Synced: " + new Date().toLocaleTimeString();
        statusLabel.style.color = "green";
    } catch (error) {
        console.error("Fetch Error:", error);
        statusLabel.innerText = "Sync Failed!";
        statusLabel.style.color = "red";
        alert("Failure: database.json could not be loaded. Check F12 Console.");
    }
}

function renderBuildingDropdown() {
    const bSelect = document.getElementById("buildingSelect");
    bSelect.innerHTML = ""; 
    
    database.forEach(item => {
        let opt = new Option(item.building, item.building);
        bSelect.add(opt);
    });

    updateEcsDropdown();
}

function updateEcsDropdown() {
    const bValue = document.getElementById("buildingSelect").value;
    const eSelect = document.getElementById("ecsSelect");
    const match = database.find(d => d.building === bValue);
    
    eSelect.innerHTML = ""; 
    if (match && match.ecs_list) {
        match.ecs_list.forEach(ecs => {
            eSelect.add(new Option(ecs, ecs));
        });
    }
}

function addRow() {
    const b = document.getElementById("buildingSelect").value;
    const e = document.getElementById("ecsSelect").value;
    const tbody = document.querySelector("#ecsTable tbody");
    
    const row = tbody.insertRow();
    row.innerHTML = `
        <td>${b}</td>
        <td>${e}</td>
        <td>
            <select style="width:100%">
                <option>1HAND_POS</option>
                <option>2PREP_ALMT</option>
                <option>3WELDING</option>
                <option>4PUNCH</option>
            </select>
        </td>
        <td><button onclick="this.parentElement.parentElement.remove()" style="background:red; color:white; border:none; padding:5px; width:100%;">DEL</button></td>
    `;
}

function exportExcel() {
    const rows = document.querySelectorAll("#ecsTable tbody tr");
    if(rows.length === 0) return alert("Table is empty!");

    const data = Array.from(rows).map(tr => ({
        "Building": tr.cells[0].innerText,
        "ECS": tr.cells[1].innerText,
        "Validation": tr.cells[2].querySelector("select").value
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Collection");
    XLSX.writeFile(wb, "Data_Export.xlsx");
}
