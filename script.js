const pageData = {
    title: "Estacionamento USC",
    statusBadge: "Status: Majoritariamente Livre",
    statusText: "Taxa de vagas não ocupadas: 60%",
    availableSpots: 9,
    occupancyRate: "40%",
    occupancyVariation: "-3.3% vs última hora",
    activeAlert: "D2 - Manutenção de sensor",
    lastSync: "14:22:05 UTC",
    activeSensors: "2.841 / 2.842"
};

const parkingLots = [
    { code: "A1", status: "free", text: "Livre" },
    { code: "A2", status: "occupied", text: "Ocupado" },
    { code: "A3", status: "free", text: "Livre" },
    { code: "A4", status: "free", text: "Livre" },
    { code: "B1", status: "occupied", text: "Ocupado" },
    { code: "B2", status: "occupied", text: "Ocupado" },
    { code: "B3", status: "free", text: "Livre" },
    { code: "B4", status: "free", text: "Livre" },
    { code: "C1", status: "free", text: "Livre" },
    { code: "C2", status: "occupied", text: "Ocupado" },
    { code: "D1", status: "free", text: "Livre" },
    { code: "D2", status: "occupied", text: "Ocupado" },
    { code: "E1", status: "free", text: "Livre" },
    { code: "E2", status: "free", text: "Livre" },
    { code: "F1", status: "occupied", text: "Ocupado" }
];

const graphBars = [
    { height: "20%", active: false },
    { height: "40%", active: false },
    { height: "35%", active: false },
    { height: "25%", active: false },
    { height: "70%", active: false },
    { height: "95%", active: true },
    { height: "55%", active: false }
];

const itemsPerPage = 10;
let currentPage = 1;

document.addEventListener("DOMContentLoaded", function () {
    initialize();
});

function initialize() {
    fillHeaderData();
    fillSummaryData();
    fillGraphsData();
    fillFooterData();
    fillParkingLotsData();
    fillPaginationData();
}

function fillHeaderData() {
    document.getElementById("parking-title").textContent = pageData.title;
    document.getElementById("status-badge").textContent = pageData.statusBadge;
    document.getElementById("status-text").textContent = pageData.statusText;
    document.getElementById("available-spots").textContent = pageData.availableSpots;
}

function fillSummaryData() {
    document.getElementById("occupancy-rate").textContent = pageData.occupancyRate;
    document.getElementById("occupancy-variation").textContent = pageData.occupancyVariation;
    document.getElementById("active-alert").textContent = pageData.activeAlert;
}

function fillGraphsData() {
    const chartBars = document.getElementById("chart-bars");
    chartBars.innerHTML = "";

    graphBars.forEach(function (item) {
        const bar = document.createElement("div");
        bar.classList.add("bar");

        if (item.active) {
            bar.classList.add("active");
        }

        bar.style.height = item.height;
        chartBars.appendChild(bar);
    });
}

function fillParkingLotsData() {
    const parkingGrid = document.getElementById("parking-grid");
    parkingGrid.innerHTML = "";

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = parkingLots.slice(startIndex, endIndex);

    currentItems.forEach(function (item) {
        const parkingCard = document.createElement("div");
        parkingCard.classList.add("parking-card");
        parkingCard.classList.add(item.status);

        parkingCard.innerHTML = `
            <div class="parking-dot"></div>
            <div class="spot-code">${item.code}</div>
            <div class="spot-status">${item.text}</div>
        `;

        parkingGrid.appendChild(parkingCard);
    });
}

function fillPaginationData() {
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";

    const totalPages = Math.ceil(parkingLots.length / itemsPerPage);

    const previousButton = createPageButton("<", currentPage - 1, currentPage === 1);
    pagination.appendChild(previousButton);

    for (let page = 1; page <= totalPages; page++) {
        const pageButton = createPageButton(page, page, false);

        if (page === currentPage) {
            pageButton.classList.add("active");
        }

        pagination.appendChild(pageButton);
    }

    const nextButton = createPageButton(">", currentPage + 1, currentPage === totalPages);
    pagination.appendChild(nextButton);
}

function createPageButton(text, page, disabled) {
    const button = document.createElement("button");
    button.classList.add("page-button");
    button.textContent = text;

    if (disabled) {
        button.disabled = true;
    } else {
        button.addEventListener("click", function () {
            changePage(page);
        });
    }

    return button;
}

function changePage(page) {
    const totalPages = Math.ceil(parkingLots.length / itemsPerPage);

    if (page < 1 || page > totalPages) {
        return;
    }

    currentPage = page;
    fillParkingLotsData();
    fillPaginationData();
}

function fillFooterData() {
    document.getElementById("last-sync").textContent = pageData.lastSync;
    document.getElementById("active-sensors").textContent = pageData.activeSensors;
}