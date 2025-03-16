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

// 티켓 목록 가져오기
async function fetchTickets(refresh = false) {
  try {
    let url = "http://localhost:8000/tickets";
    if (refresh) {
      url += "?refresh=1";
    }
    console.log("Fetching tickets from:", url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    const data = await response.json();
    console.log("Tickets received:", data);
    const tableBody = document.getElementById("ticketTableBody");
    tableBody.innerHTML = "";
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
        <td>
          ${ticket.seat_image_url ? `<img src="${ticket.seat_image_url}" class="seat-image" onclick="openImageModal('${ticket.seat_image_url}')">` : "없음"}
        </td>
        <td>
          <button onclick='openEditTicketModal(${JSON.stringify(ticket)})'>수정</button>
          <button onclick="deleteTicket('${ticket.reservation_number}')">삭제</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
  }
}

document.getElementById("refreshBtn").addEventListener("click", () => {
  fetchTickets(true);
});


// 티켓 추가 모달 처리
const addTicketModal = document.getElementById("addTicketModal");
const addTicketForm = document.getElementById("addTicketForm");
const openModalBtn = document.getElementById("openModalBtn");
const seatImageInput = document.getElementById("seatImageInput");
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
  if (seatImageInput.files.length === 0 && pastedImageFile) {
    formData.append("seat_image", pastedImageFile, "pasted_image.png");
  }
  try {
    const response = await fetch("http://localhost:8000/tickets", { method: "POST", body: formData });
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
  // 폼 필드에 기존 데이터 채우기
  editTicketForm.elements["reservation_number"].value = ticket.reservation_number;
  editTicketForm.elements["purchase_source"].value = ticket.purchase_source;
  editTicketForm.elements["buyer"].value = ticket.buyer;
  editTicketForm.elements["purchase_date"].value = ticket.purchase_date.slice(0,16);
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
    const response = await fetch(`http://localhost:8000/tickets/${reservation_number}`, { method: "PATCH", body: formData });
    if (!response.ok) throw new Error("Failed to update ticket");
    alert("티켓이 수정되었습니다!");
    closeEditTicketModal();
    fetchTickets();
  } catch (error) {
    console.error("Error updating ticket:", error);
    alert("티켓 수정에 실패했습니다.");
  }
});

// 티켓 삭제 처리
async function deleteTicket(reservation_number) {
  if (!confirm("정말 이 티켓을 삭제하시겠습니까?")) return;
  try {
    const response = await fetch(`http://localhost:8000/tickets/${reservation_number}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to delete ticket");
    alert("티켓이 삭제되었습니다!");
    fetchTickets();
  } catch (error) {
    console.error("Error deleting ticket:", error);
    alert("티켓 삭제에 실패했습니다.");
  }
}

// 페이지 로드 시 티켓 목록 불러오기
window.onload = function() {
  fetchTickets();
};
