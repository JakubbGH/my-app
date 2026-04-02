let database = [];

// Auto-run on load
window.onload = () => { loadData(); };

async function loadData() {
    const statusLabel = document.getElementById("syncStatus");
    statusLabel.innerText = "Syncing...";
    try {
        const cacheBuster = new Date().getTime();
        const response = await fetch(`./database.json?t=${cacheBuster}`);
        if (!response.ok) throw new Error("File not found");
        
        database = await response.json();
        
        const bSelect = document.getElementById("buildingSelect");
        bSelect.innerHTML = "";
        database.forEach(item => {
            bSelect.add(new Option(item.building, item.building));
        });

        statusLabel.innerText = "PLOW Loaded: " + new Date().toLocaleTimeString();
        statusLabel.style.color = "green";
    } catch (error) {
        statusLabel.innerText = "Load Failed";
        statusLabel.style.color = "red";
        console.error(error);
    }
}

function loadBuildingToTable() {
    const bValue = document.getElementById("buildingSelect").value;
    const match = database.find(d => d.building === bValue);
    const tbody = document.querySelector("#ecsTable tbody");

    if (!match || !match.ecs_list) {
        alert("No ECS data found for this building.");
        return;
    }

    // Loop through all ECS codes in the selected building
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
    XLSX.writeFile(wb, `PLOW_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
}
