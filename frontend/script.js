// 확대 이미지 모달 관련
const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
function openImageModal(imgSrc) {
  modalImage.src = imgSrc;
  imageModal.style.display = "block";
}
function closeImageModal() {
  imageModal.style.display = "none";
}

// 티켓 목록 불러오기 및 렌더링
async function fetchTickets(refresh = false) {
  try {
    let url = "http://localhost:8000/tickets";
    if (refresh) {
      url += "?refresh=1";
    }
    console.log("Fetching tickets from:", url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const data = await response.json();
    console.log("Tickets received:", data);

    const tableBody = document.getElementById("ticketTableBody");
    tableBody.innerHTML = "";

    if (!data.tickets || data.tickets.length === 0) {
      tableBody.innerHTML = "<tr><td colspan='15'>티켓 정보가 없습니다.</td></tr>";
      return;
    }

    data.tickets.forEach(ticket => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${ticket.reservation_number}</td>
        <td>${ticket.purchase_source}</td>
        <td>${ticket.buyer}</td>
        <td>${ticket.purchase_date ? ticket.purchase_date.replace("T", " ") : ""}</td>
        <td>${ticket.payment_amount ? ticket.payment_amount.toLocaleString() + " 원" : ""}</td>
        <td>${ticket.payment_method || ""}</td>
        <td>${ticket.card_company || ""}</td>
        <td>${ticket.card_number || ""}</td>
        <td>${ticket.card_approval_number || ""}</td>
        <td>${ticket.product_use_date ? ticket.product_use_date.replace("T", " ") : ""}</td>
        <td>${ticket.product_name || ""}</td>
        <td>${ticket.purchase_quantity || ""}</td>
        <td>${ticket.seat_detail}</td>
        <td>${
          ticket.seat_image_url
            ? `<img src="${ticket.seat_image_url}" class="seat-image" onclick="openImageModal('${ticket.seat_image_url}')">`
            : "없음"
        }</td>
        <td>
          <button onclick='openEditTicketModal(${JSON.stringify(ticket)})'>수정</button>
          <button onclick="deleteTicket('${ticket.reservation_number}')">삭제</button>
          <button onclick="openSaleHistoryModal('${ticket.reservation_number}')">판매 내역</button>
          <button onclick='openSaleInfoModalFromTicket(${JSON.stringify(ticket)})'>판매 등록</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    const tableBody = document.getElementById("ticketTableBody");
    tableBody.innerHTML = "<tr><td colspan='15'>티켓 목록을 불러오는 중 오류가 발생했습니다.</td></tr>";
  }
}

document.getElementById("refreshBtn").addEventListener("click", () => {
  fetchTickets(true);
});

// 티켓 추가 모달 처리
const addTicketModal = document.getElementById("addTicketModal");
const addTicketForm = document.getElementById("addTicketForm");
const openModalBtn = document.getElementById("openModalBtn");
function openAddTicketModal() {
  addTicketModal.style.display = "block";
}
function closeAddTicketModal() {
  addTicketModal.style.display = "none";
  pastedImageFile = null;
  document.getElementById("pastedImagePreview").innerHTML = "";
}
openModalBtn.addEventListener("click", openAddTicketModal);
window.addEventListener("click", function(event) {
  if (event.target === addTicketModal) closeAddTicketModal();
});
let pastedImageFile = null;
window.addEventListener("paste", function(event) {
  if (addTicketModal.style.display === "block") {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        pastedImageFile = item.getAsFile();
        const reader = new FileReader();
        reader.onload = function(e) {
          document.getElementById("pastedImagePreview").innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 200px;">`;
        };
        reader.readAsDataURL(pastedImageFile);
      }
    }
  }
});
addTicketForm.addEventListener("submit", async function(event) {
  event.preventDefault();
  const formData = new FormData(addTicketForm);
  if (document.getElementById("seatImageInput").files.length === 0 && pastedImageFile) {
    formData.append("seat_image", pastedImageFile, "pasted_image.png");
  }
  try {
    const response = await fetch("http://localhost:8000/tickets", {
      method: "POST",
      body: formData
    });
    if (!response.ok) throw new Error("Failed to add ticket");
    alert("티켓이 추가되었습니다!");
    closeAddTicketModal();
    fetchTickets();
  } catch (error) {
    console.error("Error adding ticket:", error);
    alert("티켓 추가에 실패했습니다.");
  }
});

// 티켓 수정 모달 처리
const editTicketModal = document.getElementById("editTicketModal");
const editTicketForm = document.getElementById("editTicketForm");
const editSeatImageInput = document.getElementById("editSeatImageInput");
function openEditTicketModal(ticket) {
  editTicketModal.style.display = "block";
  editTicketForm.elements["reservation_number"].value = ticket.reservation_number;
  editTicketForm.elements["purchase_source"].value = ticket.purchase_source;
  editTicketForm.elements["buyer"].value = ticket.buyer;
  editTicketForm.elements["purchase_date"].value = ticket.purchase_date
    ? ticket.purchase_date.slice(0, 16)
    : "";
  editTicketForm.elements["payment_amount"].value = ticket.payment_amount;
  editTicketForm.elements["payment_method"].value = ticket.payment_method || "";
  editTicketForm.elements["card_company"].value = ticket.card_company || "";
  editTicketForm.elements["card_number"].value = ticket.card_number || "";
  editTicketForm.elements["card_approval_number"].value = ticket.card_approval_number || "";
  editTicketForm.elements["seat_detail"].value = ticket.seat_detail;
  editTicketForm.elements["ticket_count"].value = ticket.purchase_quantity;
  document.getElementById("editPastedImagePreview").innerHTML = "";
}
function closeEditTicketModal() {
  editTicketModal.style.display = "none";
  pastedEditImageFile = null;
  document.getElementById("editPastedImagePreview").innerHTML = "";
}
window.addEventListener("click", function(event) {
  if (event.target === editTicketModal) closeEditTicketModal();
});
let pastedEditImageFile = null;
window.addEventListener("paste", function(event) {
  if (editTicketModal.style.display === "block") {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        pastedEditImageFile = item.getAsFile();
        const reader = new FileReader();
        reader.onload = function(e) {
          document.getElementById("editPastedImagePreview").innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 200px;">`;
        };
        reader.readAsDataURL(pastedEditImageFile);
      }
    }
  }
});
editTicketForm.addEventListener("submit", async function(event) {
  event.preventDefault();
  const formData = new FormData(editTicketForm);
  if (editSeatImageInput.files.length === 0 && pastedEditImageFile) {
    formData.append("seat_image", pastedEditImageFile, "pasted_image.png");
  }
  const reservation_number = editTicketForm.elements["reservation_number"].value;
  try {
    const response = await fetch(`http://localhost:8000/tickets/${reservation_number}`, {
      method: "PATCH",
      body: formData
    });
    if (!response.ok) throw new Error("Failed to update ticket");
    alert("티켓이 수정되었습니다!");
    closeEditTicketModal();
    fetchTickets();
  } catch (error) {
    console.error("Error updating ticket:", error);
    alert("티켓 수정에 실패했습니다.");
  }
});

// 판매 등록 모달 처리
const saleInfoModal = document.getElementById("saleInfoModal");
const saleInfoForm = document.getElementById("saleInfoForm");
const rawElementInput = document.getElementById("rawElementInput");
const patchElementBtn = document.getElementById("patchElementBtn");

patchElementBtn.addEventListener("click", function() {
  console.log("요소 패치 버튼 클릭됨");
  const rawHtml = rawElementInput.value;
  if (!rawHtml) {
    alert("먼저 HTML 요소값을 붙여넣으세요.");
    return;
  }
  const parser = new DOMParser();
  const wrappedHtml = `<table>${rawHtml}</table>`;
  const doc = parser.parseFromString(wrappedHtml, "text/html");
  const trElement = doc.querySelector("tr");
  if (!trElement) {
    alert("유효한 tr 요소가 없습니다.");
    return;
  }

  // 주문번호: <div class="orderInfo"><a>...</a></div>
  const orderInfoLink = trElement.querySelector(".orderInfo a");
  const order_number = orderInfoLink ? orderInfoLink.textContent.trim() : "";
  console.log("추출된 주문번호:", order_number);

  // 상품정보: <em class="bPath">와 <p> 태그의 내용을 합침
  const emTag = trElement.querySelector(".tbProductInfo1 em.bPath");
  const pTag = trElement.querySelector(".tbProductInfo1 p");
  const emText = emTag ? emTag.textContent.trim() : "";
  const pText = pTag ? pTag.textContent.trim() : "";
  const product_info = (emText + " " + pText).trim();
  console.log("추출된 상품정보:", product_info);

  // 상품일시: <i> 태그의 내용 그대로
  const iTag = trElement.querySelector(".tbProductInfo1 i");
  const product_datetime = iTag ? iTag.textContent.trim() : "";
  console.log("추출된 상품일시:", product_datetime);

  // 가격
  const priceEl = trElement.querySelector("span.bePrice01 em");
  const price = priceEl ? parseInt(priceEl.textContent.replace(/,/g, '')) : 0;
  console.log("추출된 가격:", price);

  // 수량
  const qtyEl = trElement.querySelector("td.bgG span.colorG em.fntW");
  const quantity = qtyEl ? parseInt(qtyEl.textContent.trim()) : 0;
  console.log("추출된 수량:", quantity);

  // 티켓 등급, 위치, 구역 (data- 속성)
  const ticket_grade = trElement.getAttribute("data-ticketgrade") || "";
  const ticket_floor = trElement.getAttribute("data-ticketfloor") || "";
  const ticket_area = trElement.getAttribute("data-ticketarea") || "";
  console.log("추출된 티켓 등급:", ticket_grade);
  console.log("추출된 티켓 위치:", ticket_floor);
  console.log("추출된 티켓 구역:", ticket_area);

  // 제품번호 (prodnum)
  let prodnum = "";
  const prodLink = trElement.querySelector(".tbProductInfo1 a");
  if (prodLink) {
    const match = prodLink.getAttribute("href").match(/detail\('(\d+)'\)/);
    if (match) prodnum = match[1];
  }
  console.log("추출된 제품번호:", prodnum);

  // 폼에 채우기
  saleInfoForm.elements["order_number"].value = order_number;
  saleInfoForm.elements["product_info"].value = product_info;
  saleInfoForm.elements["product_datetime"].value = product_datetime;
  saleInfoForm.elements["price"].value = price;
  saleInfoForm.elements["quantity"].value = quantity;
  saleInfoForm.elements["prodnum"].value = prodnum;
  saleInfoForm.elements["ticket_grade"].value = ticket_grade;
  saleInfoForm.elements["ticket_floor"].value = ticket_floor;
  saleInfoForm.elements["ticket_area"].value = ticket_area;
});

function openSaleInfoModalFromTicket(ticket) {
  saleInfoModal.style.display = "block";
  saleInfoForm.elements["reservation_number"].value = ticket.reservation_number || "";
  // 주문번호, 상품정보 등은 빈 상태로 두어 요소 패치로 채울 수 있도록 함.
  saleInfoForm.elements["order_number"].value = "";
  saleInfoForm.elements["product_info"].value = "";
  saleInfoForm.elements["product_datetime"].value = "";
  saleInfoForm.elements["price"].value = "";
  saleInfoForm.elements["quantity"].value = "";
  saleInfoForm.elements["prodnum"].value = "";
  saleInfoForm.elements["ticket_grade"].value = "";
  saleInfoForm.elements["ticket_floor"].value = "";
  saleInfoForm.elements["ticket_area"].value = "";
}

function closeSaleInfoModal() {
  saleInfoModal.style.display = "none";
}

window.addEventListener("click", function(event) {
  if (event.target === saleInfoModal) {
    closeSaleInfoModal();
  }
});

saleInfoForm.addEventListener("submit", async function(event) {
  event.preventDefault();
  const formData = new FormData(saleInfoForm);
  try {
    const response = await fetch("http://localhost:8000/sale_info", {
      method: "POST",
      body: formData
    });
    if (!response.ok) throw new Error("판매 등록 실패");
    alert("판매 정보가 등록되었습니다!");
    closeSaleInfoModal();
    fetchTickets(true);
  } catch (error) {
    console.error("Error registering sale info:", error);
    alert("판매 등록에 실패했습니다.");
  }
});

// 판매 내역 모달 처리
const saleHistoryModal = document.getElementById("saleHistoryModal");
const saleHistoryBody = document.getElementById("saleHistoryBody");

async function openSaleHistoryModal(reservationNumber) {
  console.log("openSaleHistoryModal - reservationNumber:", reservationNumber);
  try {
    const response = await fetch(`http://localhost:8000/sale_info?reservation_number=${reservationNumber}`);
    if (!response.ok) {
      throw new Error(`GET /sale_info failed: ${response.status}`);
    }
    const data = await response.json();
    console.log("sale_info data:", data);

    saleHistoryBody.innerHTML = "";
    if (!data.sale_info || data.sale_info.length === 0) {
      saleHistoryBody.innerHTML = `<tr><td colspan="9">판매 등록 정보가 없습니다.</td></tr>`;
    } else {
      data.sale_info.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${item.prodnum}</td>
          <td>${item.ticket_grade}</td>
          <td>${item.ticket_floor}</td>
          <td>${item.ticket_area}</td>
          <td>${item.product_category}</td>
          <td>${item.product_datetime}</td>
          <td>${item.product_description}</td>
          <td>${item.price}</td>
          <td>${item.quantity}</td>
        `;
        saleHistoryBody.appendChild(row);
      });
    }
    saleHistoryModal.style.display = "block";
  } catch (error) {
    console.error("Error fetching sale_info:", error);
    alert("판매 내역을 불러오는 중 오류가 발생했습니다.");
  }
}

function closeSaleHistoryModal() {
  saleHistoryModal.style.display = "none";
}
window.addEventListener("click", function(event) {
  if (event.target === saleHistoryModal) {
    closeSaleHistoryModal();
  }
});

// 페이지 로드 시 티켓 목록 불러오기
window.onload = function() {
  fetchTickets();
};
