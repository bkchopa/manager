// ✅ 확대 이미지 모달 관련 요소 가져오기
const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");

// ✅ 이미지 클릭 시 모달 창 띄우기
function openImageModal(imgSrc) {
  modalImage.src = imgSrc;
  imageModal.style.display = "block";
}

// ✅ 모달 창 닫기
function closeImageModal() {
  imageModal.style.display = "none";
}

// ✅ 티켓 목록 불러오기 및 이미지 클릭 이벤트 추가
async function fetchTickets() {
  try {
    console.log("🔄 티켓 데이터를 불러옵니다...");

    const response = await fetch("http://localhost:8000/tickets");
    if (!response.ok) {
      throw new Error(`HTTP 오류! 상태 코드: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ 받은 데이터:", data);

    const tableBody = document.getElementById("ticketTableBody");
    tableBody.innerHTML = "";

    if (data.tickets.length === 0) {
      console.warn("⚠️ API에서 티켓 데이터가 비어 있습니다!");
    }

    data.tickets.forEach(ticket => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${ticket.reservation_number}</td>
        <td>${ticket.purchase_source}</td>
        <td>${ticket.buyer}</td>
        <td>${ticket.purchase_date.replace("T", " ")}</td>
        <td>${ticket.payment_amount.toLocaleString()} 원</td>
        <td>${ticket.seat_detail}</td>
        <td>
          ${ticket.seat_image_url ? `<img src="${ticket.seat_image_url}" class="seat-image" onclick="openImageModal('${ticket.seat_image_url}')">` : "없음"}
        </td>
      `;

      tableBody.appendChild(row);
    });

  } catch (error) {
    console.error("❌ 티켓 데이터를 불러오는 중 오류 발생:", error);
  }
}

// ★ 티켓 추가 모달 관련 요소 가져오기
const addTicketModal = document.getElementById("addTicketModal");
const addTicketForm = document.getElementById("addTicketForm");
const openModalBtn = document.getElementById("openModalBtn");
const seatImageInput = document.getElementById("seatImageInput");

// ★ 모달 열기 함수
function openAddTicketModal() {
  addTicketModal.style.display = "block";
}

// ★ 모달 닫기 함수
function closeAddTicketModal() {
  addTicketModal.style.display = "none";
  // 붙여넣은 이미지 초기화
  pastedImageFile = null;
  document.getElementById("pastedImagePreview").innerHTML = "";
}

// 티켓 추가 버튼에 클릭 이벤트 추가
openModalBtn.addEventListener("click", openAddTicketModal);

// ★ 모달 외부 클릭 시 닫기 처리
window.addEventListener("click", function(event) {
  if (event.target === addTicketModal) {
    closeAddTicketModal();
  }
});

// ★ 클립보드에서 이미지 붙여넣기 처리
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

// ★ 티켓 추가 폼 제출 이벤트 핸들러
addTicketForm.addEventListener("submit", async function(event) {
  event.preventDefault();
  const formData = new FormData(addTicketForm);
  // 파일 입력이 비어있고 클립보드로 붙여넣은 이미지가 있으면 추가
  if (seatImageInput.files.length === 0 && pastedImageFile) {
    formData.append("seat_image", pastedImageFile, "pasted_image.png");
  }
  try {
    const response = await fetch("http://localhost:8000/tickets", {
      method: "POST",
      body: formData
    });
    if (!response.ok) {
      throw new Error("티켓 추가 실패");
    }
    alert("티켓이 추가되었습니다!");
    closeAddTicketModal();
    fetchTickets();  // 티켓 목록 새로고침
  } catch (error) {
    console.error("티켓 추가 중 오류 발생:", error);
    alert("티켓 추가에 실패했습니다.");
  }
});

// ✅ 페이지 로드 시 실행
window.onload = function() {
  fetchTickets();
};
