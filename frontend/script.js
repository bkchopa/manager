document.addEventListener("DOMContentLoaded", function() {
  "use strict";

  // 모달 및 폼 요소들
  const imageModal = document.getElementById("imageModal");
  const modalImage = document.getElementById("modalImage");

  const addTicketModal = document.getElementById("addTicketModal");
  const editTicketModal = document.getElementById("editTicketModal");
  const saleInfoModal = document.getElementById("saleInfoModal");
  const saleHistoryModal = document.getElementById("saleHistoryModal");
  const saleDoneModal = document.getElementById("saleDoneModal");
  const saleInfoFormModal = document.getElementById("saleInfoFormModal"); // 판매 등록 정보 입력 모달

  const addTicketForm = document.getElementById("addTicketForm");
  const editTicketForm = document.getElementById("editTicketForm");
  const saleInfoForm = document.getElementById("saleInfoForm");
  const saleDoneForm = document.getElementById("saleDoneForm");

  const saleHistoryBody = document.getElementById("saleHistoryBody");

  const rawElementInputDone = document.getElementById("rawElementInputDone");
  const patchElementBtnDone = document.getElementById("patchElementBtnDone");

  // 신규: 판매 등록 정보의 raw HTML 입력 필드와 패치 버튼
  const rawElementInputSaleInfo = document.getElementById("rawElementInputSaleInfo");
  const patchElementBtnSaleInfo = document.getElementById("patchElementBtnSaleInfo");

  // 전역 변수: 판매 완료 update 모드 여부
  let currentSaleDoneOrderNum = null;

  // -------------------------------
  // 함수 선언부
  // -------------------------------

  // 티켓 목록 불러오기
  async function fetchTickets(refresh = false) {
    try {
      let url = "http://localhost:8000/tickets";
      if (refresh) url += "?refresh=1";
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
            <button onclick="openSaleInfoModal('${ticket.reservation_number}')">판매 등록 정보</button>
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

  // 이미지 모달
  function openImageModal(imgSrc) {
    modalImage.src = imgSrc;
    imageModal.style.display = "block";
  }
  function closeImageModal() {
    imageModal.style.display = "none";
  }

  // 티켓 추가 모달
  function openAddTicketModal() {
    addTicketModal.style.display = "block";
  }
  function closeAddTicketModal() {
    addTicketModal.style.display = "none";
    pastedImageFile = null;
    document.getElementById("pastedImagePreview").innerHTML = "";
  }
  document.getElementById("openModalBtn").addEventListener("click", openAddTicketModal);
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
            document.getElementById("pastedImagePreview").innerHTML = `<img src="${e.target.result}" style="max-width:100%; max-height:200px;">`;
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

  // 티켓 수정 모달
  function openEditTicketModal(ticket) {
    editTicketModal.style.display = "block";
    editTicketForm.elements["reservation_number"].value = ticket.reservation_number;
    editTicketForm.elements["purchase_source"].value = ticket.purchase_source;
    editTicketForm.elements["buyer"].value = ticket.buyer;
    editTicketForm.elements["purchase_date"].value = ticket.purchase_date ? ticket.purchase_date.slice(0,16) : "";
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
            document.getElementById("editPastedImagePreview").innerHTML = `<img src="${e.target.result}" style="max-width:100%; max-height:200px;">`;
          };
          reader.readAsDataURL(pastedEditImageFile);
        }
      }
    }
  });
  editTicketForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    const formData = new FormData(editTicketForm);
    if (document.getElementById("editSeatImageInput").files.length === 0 && pastedEditImageFile) {
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

  // 판매 등록 정보 모달 처리 (ticket_sale_info 조회/목록)
  async function openSaleInfoModal(reservationNumber) {
    try {
      const response = await fetch(`http://localhost:8000/sale_info?reservation_number=${reservationNumber}`);
      if (!response.ok) throw new Error(`GET /sale_info failed: ${response.status}`);
      const data = await response.json();
      console.log("sale_info data:", data);
      const saleInfoTableBody = document.getElementById("saleInfoTableBody");
      saleInfoTableBody.innerHTML = "";
      if (!data.sale_info || data.sale_info.length === 0) {
        saleInfoTableBody.innerHTML = `<tr><td colspan="12">판매 등록 정보가 없습니다.</td></tr>`;
      } else {
        data.sale_info.forEach(item => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${item.reservation_number}</td>
            <td>${item.prodnum}</td>
            <td>${item.ticket_grade}</td>
            <td>${item.ticket_floor}</td>
            <td>${item.ticket_area}</td>
            <td>${item.product_category}</td>
            <td>${item.product_datetime}</td>
            <td>${item.product_description}</td>
            <td>${item.price}</td>
            <td>${item.quantity || ""}</td>
            <td>
              <button onclick='openSaleHistoryModal("${item.prodnum}")'>판매 완료 정보</button>
            </td>
            <td>
              <button onclick="deleteSaleInfo('${item.prodnum}')">삭제</button>
            </td>
          `;
          saleInfoTableBody.appendChild(row);
        });
      }
      saleInfoModal.style.display = "block";
    } catch (error) {
      console.error("Error fetching sale_info:", error);
      alert("판매 등록 정보를 불러오는 중 오류가 발생했습니다.");
    }
  }

  async function deleteSaleInfo(prodnum) {
    if (confirm("해당 판매 등록 정보를 삭제하시겠습니까?")) {
      try {
        const response = await fetch(`http://localhost:8000/sale_info/${prodnum}`, { method: "DELETE" });
        if (!response.ok) throw new Error("삭제 실패");
        alert("판매 등록 정보가 삭제되었습니다!");
        fetchTickets();
      } catch (error) {
        console.error("Error deleting sale info:", error);
        alert("판매 등록 정보 삭제에 실패했습니다.");
      }
    }
  }

  function closeSaleInfoModal() {
    saleInfoModal.style.display = "none";
  }

  saleInfoForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    const formData = new FormData(saleInfoForm);
    try {
      const response = await fetch("http://localhost:8000/sale_info", { method: "POST", body: formData });
      if (!response.ok) throw new Error("판매 등록 실패");
      alert("판매 등록 정보가 등록되었습니다!");
      closeSaleInfoModal();
      fetchTickets(true);
    } catch (error) {
      console.error("Error registering sale info:", error);
      alert("판매 등록에 실패했습니다.");
    }
  });

  // 판매 등록 정보 추가(신규) 모달 열기
  function openSaleInfoForm() {
    saleInfoForm.reset();
    currentSaleDoneOrderNum = null;
    saleInfoFormModal.style.display = "block";
  }
  function closeSaleInfoFormModal() {
    saleInfoFormModal.style.display = "none";
  }
  window.openSaleInfoForm = openSaleInfoForm;
  window.closeSaleInfoFormModal = closeSaleInfoFormModal;

  // 판매 등록 정보 raw HTML 패치 (추가)
  patchElementBtnSaleInfo.addEventListener("click", function() {
    const rawHtml = rawElementInputSaleInfo.value;
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
    // 예매번호는 이미 입력되어 있으므로 여기서는 추출하지 않습니다.
    const ticket_grade = trElement.getAttribute("data-ticketgrade") || "";
    const ticket_floor = trElement.getAttribute("data-ticketfloor") || "";
    const ticket_area = trElement.getAttribute("data-ticketarea") || "";
    let product_category = "";
    const categoryTag = trElement.querySelector(".tbProductInfo em.bPath");
    if (categoryTag) product_category = categoryTag.textContent.trim();
    let product_description = "";
    const descTag = trElement.querySelector(".tbProductInfo p");
    if (descTag) product_description = descTag.textContent.trim();
    let product_datetime = "";
    const datetimeTag = trElement.querySelector(".tbProductInfo i");
    if (datetimeTag) product_datetime = datetimeTag.textContent.trim();
    let price = 0;
    const priceEl = trElement.querySelector("span.bePrice01 em, span.bePrice02 em");
    if (priceEl) price = parseInt(priceEl.textContent.replace(/,/g, ''));
    let quantity = 0;
    const quantityEl = trElement.querySelector("span.bePrice05");
    if (quantityEl) {
      const qtyMatch = quantityEl.textContent.match(/X(\d+)/);
      if (qtyMatch) quantity = parseInt(qtyMatch[1]);
    }
    // 할당 (예매번호는 그대로 남겨두고, 나머지 필드만 업데이트)
    saleInfoForm.elements["ticket_grade"].value = ticket_grade;
    saleInfoForm.elements["ticket_floor"].value = ticket_floor;
    saleInfoForm.elements["ticket_area"].value = ticket_area;
    saleInfoForm.elements["product_category"].value = product_category;
    saleInfoForm.elements["product_datetime"].value = product_datetime;
    saleInfoForm.elements["product_description"].value = product_description;
    saleInfoForm.elements["price"].value = price;
    saleInfoForm.elements["quantity"].value = quantity;
  });

  // 판매 완료 모달 처리 (ticket_sale_done 등록/수정)
  patchElementBtnDone.addEventListener("click", function() {
    console.log("판매 완료 요소 패치 버튼 클릭됨");
    const rawHtml = rawElementInputDone.value;
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
    // 수정된 부분: data-ordnum은 주문번호(order_num)로 사용하고, productDetail 링크에서 추출한 값은 제품번호(prodnum)
    const order_num = trElement.getAttribute("data-ordnum") || "";
    let prodnum = "";
    const productLink = trElement.querySelector(".tbProductInfo a");
    if (productLink) {
      const match = productLink.getAttribute("href").match(/productDetail\('(\d+)'\)/);
      if (match) prodnum = match[1];
    }
    console.log("추출된 주문번호 (order_num):", order_num);
    console.log("추출된 제품번호 (prodnum):", prodnum);
    let order_date = "";
    const orderInfoDiv = trElement.querySelector(".orderInfo");
    if (orderInfoDiv) {
      const emTag = orderInfoDiv.querySelector("em");
      if (emTag) order_date = emTag.textContent.trim();
    }
    console.log("추출된 주문일자:", order_date);
    let buyer_name = "";
    let buyer_contact = "";
    const pinLayer = trElement.querySelector(".pin_popup_layer2");
    if (pinLayer) {
      const nameDd = pinLayer.querySelector("dl:nth-of-type(1) dd");
      buyer_name = nameDd ? nameDd.textContent.trim() : "";
      const contactDd = pinLayer.querySelector("dl:nth-of-type(2) dd.txt_phone");
      if (contactDd) {
        const contactText = contactDd.textContent;
        buyer_contact = contactText ? contactText.replace(/[^\d\-]/g, "").trim() : "";
      }
    }
    console.log("추출된 구매자 이름:", buyer_name);
    console.log("추출된 구매자 연락처:", buyer_contact);
    let product_category = "";
    const categoryTag = trElement.querySelector(".tbProductInfo em.bPath");
    if (categoryTag) product_category = categoryTag.textContent.trim();
    console.log("추출된 상품 카테고리:", product_category);
    let product_description = "";
    const descTag = trElement.querySelector(".tbProductInfo p");
    if (descTag) product_description = descTag.textContent.trim();
    console.log("추출된 상품 설명:", product_description);
    let product_datetime = "";
    const datetimeTag = trElement.querySelector(".tbProductInfo i");
    if (datetimeTag) product_datetime = datetimeTag.textContent.trim();
    console.log("추출된 상품 일시:", product_datetime);
    let unit_price = 0;
    const priceEl = trElement.querySelector("span.bePrice02 em");
    if (priceEl) unit_price = parseInt(priceEl.textContent.replace(/,/g, ''));
    console.log("추출된 단일 가격:", unit_price);
    const deal_status = "판매완료";
    const remark = "";

    saleDoneForm.elements["order_num"].value = order_num;
    saleDoneForm.elements["prodnum"].value = prodnum;
    saleDoneForm.elements["order_date"].value = order_date;
    saleDoneForm.elements["buyer_name"].value = buyer_name;
    saleDoneForm.elements["buyer_contact"].value = buyer_contact;
    saleDoneForm.elements["product_category"].value = product_category;
    saleDoneForm.elements["product_description"].value = product_description;
    saleDoneForm.elements["product_datetime"].value = product_datetime;
    saleDoneForm.elements["unit_price"].value = unit_price;
    saleDoneForm.elements["deal_status"].value = deal_status;
    saleDoneForm.elements["remark"].value = remark;

    currentSaleDoneOrderNum = null;
  });

  function openSaleDoneModalFromSaleInfo(saleInfoRecord) {
    closeSaleHistoryModal();
    saleDoneModal.style.display = "block";
    saleDoneForm.elements["prodnum"].value = saleInfoRecord.prodnum;
    saleDoneForm.elements["order_num"].value = saleInfoRecord.order_num || "";
    saleDoneForm.elements["order_date"].value = new Date().toISOString();
    saleDoneForm.elements["buyer_name"].value = "";
    saleDoneForm.elements["buyer_contact"].value = "";
    saleDoneForm.elements["product_category"].value = saleInfoRecord.product_category;
    saleDoneForm.elements["product_description"].value = saleInfoRecord.product_description;
    saleDoneForm.elements["product_datetime"].value = saleInfoRecord.product_datetime;
    saleDoneForm.elements["unit_price"].value = saleInfoRecord.price;
    saleDoneForm.elements["deal_status"].value = "판매완료";
    saleDoneForm.elements["remark"].value = "";

    currentSaleDoneOrderNum = saleInfoRecord.order_num || null;
  }

  saleDoneForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    const formData = new FormData(saleDoneForm);
    try {
      let response;
      if (currentSaleDoneOrderNum) {
        response = await fetch(`http://localhost:8000/sale_done/${currentSaleDoneOrderNum}`, { method: "PUT", body: formData });
      } else {
        response = await fetch("http://localhost:8000/sale_done", { method: "POST", body: formData });
      }
      if (!response.ok) throw new Error("판매 완료 등록 실패");
      alert("판매 완료 정보가 저장되었습니다!");
      closeSaleDoneModal();
    } catch (error) {
      console.error("Error registering sale done info:", error);
      alert("판매 완료 등록에 실패했습니다.");
    }
  });

  function closeSaleDoneModal() {
    saleDoneModal.style.display = "none";
  }

  async function deleteSaleDone(order_num) {
    if (confirm("해당 판매 완료 정보를 삭제하시겠습니까?")) {
      try {
        const response = await fetch(`http://localhost:8000/sale_done/${order_num}`, { method: "DELETE" });
        if (!response.ok) throw new Error("삭제 실패");
        alert("판매 완료 정보가 삭제되었습니다!");
        openSaleHistoryModal(saleInfoForm.elements["reservation_number"].value);
      } catch (error) {
        console.error("Error deleting sale done info:", error);
        alert("판매 완료 정보 삭제에 실패했습니다.");
      }
    }
  }

  async function openSaleHistoryModal(prodnum) {
    console.log("openSaleHistoryModal - prodnum:", prodnum);
    try {
      const response = await fetch(`http://localhost:8000/sale_done_list?prodnum=${prodnum}`);
      if (!response.ok) throw new Error(`GET /sale_done_list failed: ${response.status}`);
      const data = await response.json();
      console.log("sale_done data:", data);
      const saleHistoryBody = document.getElementById("saleHistoryBody");
      saleHistoryBody.innerHTML = "";
      if (!data.sale_done || data.sale_done.length === 0) {
        saleHistoryBody.innerHTML = `<tr><td colspan="14">판매 완료 정보가 없습니다.</td></tr>`;
      } else {
        data.sale_done.forEach(item => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${item.reservation_number || ""}</td>
            <td>${item.prodnum}</td>
            <td>${item.order_num}</td>
            <td>${item.ticket_grade}</td>
            <td>${item.ticket_floor}</td>
            <td>${item.ticket_area}</td>
            <td>${item.product_category}</td>
            <td>${item.product_datetime}</td>
            <td>${item.product_description}</td>
            <td>${item.unit_price}</td>
            <td>${item.quantity || ""}</td>
            <td>${item.deal_status}</td>
            <td>${item.remark || ""}</td>
            <td>
              <button onclick='openSaleDoneModalFromSaleInfo(${JSON.stringify(item)})'>수정/판매 완료 처리</button>
              <button onclick="deleteSaleDone('${item.order_num}')">판매 완료 취소</button>
            </td>
          `;
          saleHistoryBody.appendChild(row);
        });
      }
      saleHistoryModal.style.display = "block";
    } catch (error) {
      console.error("Error fetching sale_done info:", error);
      alert("판매 완료 정보를 불러오는 중 오류가 발생했습니다.");
    }
  }

  function closeSaleHistoryModal() {
    saleHistoryModal.style.display = "none";
  }

  // 판매 등록 정보 모달 열기 (티켓 행의 "판매 등록 정보" 버튼)
  async function openSaleInfoModal(reservationNumber) {
    try {
      const response = await fetch(`http://localhost:8000/sale_info?reservation_number=${reservationNumber}`);
      if (!response.ok) throw new Error(`GET /sale_info failed: ${response.status}`);
      const data = await response.json();
      console.log("sale_info data:", data);
      const saleInfoTableBody = document.getElementById("saleInfoTableBody");
      saleInfoTableBody.innerHTML = "";
      if (!data.sale_info || data.sale_info.length === 0) {
        saleInfoTableBody.innerHTML = `<tr><td colspan="12">판매 등록 정보가 없습니다.</td></tr>`;
      } else {
        data.sale_info.forEach(item => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${item.reservation_number}</td>
            <td>${item.prodnum}</td>
            <td>${item.ticket_grade}</td>
            <td>${item.ticket_floor}</td>
            <td>${item.ticket_area}</td>
            <td>${item.product_category}</td>
            <td>${item.product_datetime}</td>
            <td>${item.product_description}</td>
            <td>${item.price}</td>
            <td>${item.quantity || ""}</td>
            <td>
              <button onclick='openSaleHistoryModal("${item.prodnum}")'>판매 완료 정보</button>
            </td>
            <td>
              <button onclick="deleteSaleInfo('${item.prodnum}')">삭제</button>
            </td>
          `;
          saleInfoTableBody.appendChild(row);
        });
      }
      saleInfoModal.style.display = "block";
    } catch (error) {
      console.error("Error fetching sale_info:", error);
      alert("판매 등록 정보를 불러오는 중 오류가 발생했습니다.");
    }
  }

  async function deleteSaleInfo(prodnum) {
    if (confirm("해당 판매 등록 정보를 삭제하시겠습니까?")) {
      try {
        const response = await fetch(`http://localhost:8000/sale_info/${prodnum}`, { method: "DELETE" });
        if (!response.ok) throw new Error("삭제 실패");
        alert("판매 등록 정보가 삭제되었습니다!");
        fetchTickets();
      } catch (error) {
        console.error("Error deleting sale info:", error);
        alert("판매 등록 정보 삭제에 실패했습니다.");
      }
    }
  }

  function openSaleInfoModalFromTicket(ticket) {
    saleInfoModal.style.display = "block";
    saleInfoForm.elements["reservation_number"].value = ticket.reservation_number || "";
    saleInfoForm.elements["ticket_grade"].value = "";
    saleInfoForm.elements["ticket_floor"].value = "";
    saleInfoForm.elements["ticket_area"].value = "";
    saleInfoForm.elements["product_category"].value = "";
    saleInfoForm.elements["product_datetime"].value = "";
    saleInfoForm.elements["product_description"].value = "";
    saleInfoForm.elements["price"].value = "";
    saleInfoForm.elements["quantity"].value = "";
    saleInfoForm.elements["prodnum"].value = "";
  }

  // 초기 로드
  fetchTickets();

  // 전역 노출 (inline onclick에서 사용)
  window.openSaleHistoryModal = openSaleHistoryModal;
  window.closeSaleHistoryModal = closeSaleHistoryModal;
  window.openSaleInfoModal = openSaleInfoModal;
  window.openSaleInfoModalFromTicket = openSaleInfoModalFromTicket;
  window.openEditTicketModal = openEditTicketModal;
  window.openSaleDoneModalFromSaleInfo = openSaleDoneModalFromSaleInfo;
  window.deleteSaleDone = deleteSaleDone;
  window.openImageModal = openImageModal;
  window.closeAddTicketModal = closeAddTicketModal;
  window.closeEditTicketModal = closeEditTicketModal;
  window.closeSaleInfoModal = closeSaleInfoModal;
  window.closeSaleDoneModal = closeSaleDoneModal;
  window.openSaleInfoForm = openSaleInfoForm;
  window.closeSaleInfoFormModal = closeSaleInfoFormModal;
});
