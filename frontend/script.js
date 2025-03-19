

document.addEventListener("DOMContentLoaded", function() {

  const SERVER_URL = "http://localhost:8000";
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
  let currentReservationNumber = "";

   // 전역 변수: 전체 티켓 데이터를 저장 및 정렬 순서 관리
  let ticketDataList = [];
  const sortOrders = {}; // 각 컬럼별 정렬 상태를 저장 (예: { reservation_number: 'asc', ... })

  // 날짜 및 숫자 등 타입에 따른 비교 함수
  function compareValues(a, b, order, column) {
    // 빈 값은 ""로 처리
    a = (a !== undefined && a !== null) ? a : "";
    b = (b !== undefined && b !== null) ? b : "";

    // 날짜 컬럼 처리 (ISO 포맷인 경우)
    if (column === "purchase_date" || column === "product_use_date") {
      const dateA = new Date(a);
      const dateB = new Date(b);
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return order === 'asc' ? dateA - dateB : dateB - dateA;
      }
    }
    // 숫자형 비교: 두 값 모두 숫자로 변환 가능한 경우
    if (!isNaN(a) && !isNaN(b)) {
      return order === 'asc' ? a - b : b - a;
    }
    // 기본: 문자열 비교 (대소문자 구분 없이)
    const aStr = a.toString().toLowerCase();
    const bStr = b.toString().toLowerCase();
    return order === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  }

  // 티켓 목록 렌더링 함수
  function renderTickets(tickets) {
      const tableBody = document.getElementById("ticketTableBody");
      tableBody.innerHTML = "";
      if (!tickets || tickets.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='16'>티켓 정보가 없습니다.</td></tr>";
        return;
      }
      tickets.forEach(ticket => {
        const row = document.createElement("tr");
        // 기존에는 remaining_quantity가 0이면 바로 sold-out 클래스를 추가했지만…
        // 여기서는 그냥 기본적으로 렌더링 후 나중에 색상 업데이트
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
          <td>${ticket.remaining_quantity || 0}</td>
          <td>${ticket.seat_detail}</td>
          <td>${
            ticket.seat_image_url
              ? `<img src="${ticket.seat_image_url}" class="seat-image" onclick="openImageModal('${ticket.seat_image_url}')">`
              : "없음"
          }</td>
          <td>
            <button onclick='openEditTicketModal(${JSON.stringify(ticket)})'>수정</button>
            <button onclick="deleteTicket('${ticket.reservation_number}')">삭제</button>
            <button onclick='openSaleInfoModal(${JSON.stringify(ticket.reservation_number)})'>판매 등록 정보</button>
          </td>
        `;
        tableBody.appendChild(row);

        // 만약 남은 티켓이 0이면, 추가 fetch로 색상을 업데이트
        if (ticket.remaining_quantity === 0) {
          updateTicketRowColor(row, ticket.reservation_number);
        }
      });
    }

    async function updateTicketRowColor(rowElement, reservation_number) {
      try {
        const response = await fetch(`${SERVER_URL}/sale_done_list?reservation_number=${reservation_number}`);
        if (!response.ok) {
          console.error("Failed to fetch sale_done_list");
          return;
        }
        const data = await response.json();
        // sale_done 정보가 있으면 검사, 없으면 건드리지 않음.
        if (data.sale_done && data.sale_done.length > 0) {
          const allCompleted = data.sale_done.every(item => item.deal_status === "판매완료");
          // 기존 sold-out 클래스를 제거하고, 모두 완료되었으면 green, 아니면 yellow
          rowElement.classList.remove("sold-out");
          if (allCompleted) {
            rowElement.classList.add("sold-out-green");
          } else {
            rowElement.classList.add("sold-out-yellow");
          }
        }
      } catch (err) {
        console.error("Error updating row color:", err);
      }
    }


   async function fetchTickets(refresh = false) {
    try {
      let url = "${SERVER_URL}/tickets";
      if (refresh) url += "?refresh=1";
      console.log("Fetching tickets from:", url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();
      console.log("Tickets received:", data);
      ticketDataList = data.tickets;
      renderTickets(ticketDataList);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      const tableBody = document.getElementById("ticketTableBody");
      tableBody.innerHTML = "<tr><td colspan='16'>티켓 목록을 불러오는 중 오류가 발생했습니다.</td></tr>";
    }
  }

  // 정렬 이벤트 리스너 추가: 모든 sortable th에 대해 처리
    function addSortingEventListeners() {
      const sortableHeaders = document.querySelectorAll("th.sortable");
      sortableHeaders.forEach(header => {
        header.style.cursor = "pointer";
        header.addEventListener("click", function() {
          const column = this.getAttribute("data-column");
          // 정렬 순서 토글 (초기값은 asc)
          sortOrders[column] = sortOrders[column] === 'asc' ? 'desc' : 'asc';
          // 전체 티켓 데이터를 정렬 (ticketDataList는 전역 배열)
          ticketDataList.sort((a, b) => compareValues(a[column], b[column], sortOrders[column], column));
          // 필터 조건(검색, 판매가능 조건)도 적용해서 렌더링
          applyFilters();
        });
      });
    }
  // -------------------------------
  // 함수 선언부
  // -------------------------------



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
      const response = await fetch("${SERVER_URL}/tickets", { method: "POST", body: formData });
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
      // 예약번호는 hidden 필드로 처리
      editTicketForm.elements["reservation_number"].value = ticket.reservation_number;
      editTicketForm.elements["purchase_source"].value = ticket.purchase_source;
      editTicketForm.elements["buyer"].value = ticket.buyer;
      // 구매일은 문자열 그대로 할당 (예: "2025.03.18")
      editTicketForm.elements["purchase_date"].value = ticket.purchase_date || "";
      editTicketForm.elements["payment_amount"].value = ticket.payment_amount;
      editTicketForm.elements["payment_method"].value = ticket.payment_method || "";
      editTicketForm.elements["card_company"].value = ticket.card_company || "";
      editTicketForm.elements["card_number"].value = ticket.card_number || "";
      editTicketForm.elements["card_approval_number"].value = ticket.card_approval_number || "";

      // 새로 추가한 필드: 제품 사용일과 제품 이름 (텍스트 필드)
      editTicketForm.elements["product_use_date"].value = ticket.product_use_date || "";
      editTicketForm.elements["product_name"].value = ticket.product_name || "";

      editTicketForm.elements["seat_detail"].value = ticket.seat_detail || "";
      // 티켓 수와 남은 티켓은 그대로 채워넣음
      editTicketForm.elements["ticket_count"].value = ticket.purchase_quantity || "";
      editTicketForm.elements["remaining_quantity"].value = ticket.remaining_quantity || ticket.purchase_quantity;

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
      const response = await fetch(`${SERVER_URL}/tickets/${reservation_number}`, { method: "PATCH", body: formData });
      if (!response.ok) throw new Error("Failed to update ticket");
      alert("티켓이 수정되었습니다!");
      closeEditTicketModal();
      fetchTickets();
    } catch (error) {
      console.error("Error updating ticket:", error);
      alert("티켓 수정에 실패했습니다.");
    }
  });

  function closeSaleInfoModal() {
    saleInfoModal.style.display = "none";
  }

    saleInfoForm.addEventListener("submit", async function(event) {
      event.preventDefault();
      const formData = new FormData(saleInfoForm);
      const prodnum = formData.get("prodnum");
      try {
        let response;
        if (prodnum) {
          // prodnum이 있으면 업데이트 (PUT)
          response = await fetch(`${SERVER_URL}/sale_info/${prodnum}`, {
            method: "PUT",
            body: formData
          });
        } else {
          // 없으면 신규 등록 (POST)
          response = await fetch("${SERVER_URL}/sale_info", {
            method: "POST",
            body: formData
          });
        }
        if (!response.ok) throw new Error(prodnum ? "판매 등록 업데이트 실패" : "판매 등록 실패");
        alert(prodnum ? "판매 등록 정보가 업데이트되었습니다!" : "판매 등록 정보가 등록되었습니다!");
        closeSaleInfoModal();
        fetchTickets(true);
      } catch (error) {
        console.error("Error in sale info form submission:", error);
        alert(prodnum ? "판매 등록 정보 업데이트에 실패했습니다." : "판매 등록 정보 등록에 실패했습니다.");
      }
    });


  // 판매 등록 정보 추가(신규) 모달 열기
    function openSaleInfoForm() {
      saleInfoForm.reset();
      // 전역 변수에 저장된 예약번호를 재할당
      saleInfoForm.elements["reservation_number"].value = currentReservationNumber;
      currentSaleDoneOrderNum = null;
      saleInfoFormModal.style.display = "block";
    }
  function closeSaleInfoFormModal() {
    saleInfoFormModal.style.display = "none";
  }
  window.openSaleInfoForm = openSaleInfoForm;
  window.closeSaleInfoFormModal = closeSaleInfoFormModal;


    function extractSaleDoneData(htmlString) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, "text/html");

      // 주문번호: <span class="prd-number"><span class="label">주문번호</span><p>202503161131125D7C</p></span>
      const orderNumEl = doc.querySelector("span.prd-number p");
      const order_num = orderNumEl ? orderNumEl.textContent.trim() : "";

      // 상품번호: <div class="prd-number"><span class="label">상품번호</span><p>5578978446528</p></div>
      const prodnumEl = doc.querySelector("div.prd-number p");
      const prodnum = prodnumEl ? prodnumEl.textContent.trim() : "";

      // 주문일자: 주문번호의 앞 8자리 ("20250316")를 "2025-03-16"로 변환
      let order_date = "";
      if (order_num.length >= 8) {
        const datePart = order_num.slice(0, 8);
        order_date = datePart.slice(0,4) + "-" + datePart.slice(4,6) + "-" + datePart.slice(6,8);
      }

      // 경기 일시 (product_datetime): <div class="prd-day"><span class="date">2025.03.16 13:00</span></div>
      const datetimeEl = doc.querySelector("div.prd-day span.date");
      let product_datetime = datetimeEl ? datetimeEl.textContent.trim() : "";
      // (필요 시 날짜 포맷 변경 가능)

      // 구매자 정보: 이름과 안심번호는 buyer 정보 영역에 있음
      let buyer_name = "";
      let buyer_contact = "";
      const buyerDlEls = doc.querySelectorAll("div.item-area div.item dl");
      buyerDlEls.forEach(dl => {
        const dt = dl.querySelector("dt");
        const dd = dl.querySelector("dd");
        if (dt && dd) {
          const label = dt.textContent.trim();
          if (label === "이름") {
            buyer_name = dd.textContent.trim();
          } else if (label === "안심번호") {
            buyer_contact = dd.textContent.trim();
          }
        }
      });

      // 상품 카테고리: <div class="prd-category"> 내부의 span들을 모두 합치기
      const categoryEls = doc.querySelectorAll("div.prd-category span");
      const product_category = Array.from(categoryEls)
        .map(el => el.textContent.trim())
        .filter(text => text.length > 0)
        .join(" / ");

      // 상품 상세 정보 (product_description): <div class="cont-my-file"> 내의 p 태그
      const descEl = doc.querySelector("div.cont-my-file .text-defult p");
      const product_description = descEl ? descEl.textContent.trim() : "";

      // 단일 가격 (unit_price): <span class="price">20,000원<em>(60FP 적립)</em></span>
      const priceEl = doc.querySelector("div.form-box span.price");
      let unit_price = 0;
      if (priceEl) {
        // 첫 번째 텍스트 노드에 가격 정보가 있을 가능성이 높습니다.
        let priceText = priceEl.childNodes[0] ? priceEl.childNodes[0].textContent.trim() : "";
        priceText = priceText.replace(/[,원]/g, ""); // 콤마와 '원' 제거
        unit_price = parseInt(priceText, 10) || 0;
      }

      // 거래 상태 (deal_status): 활성화된 단계 표시 (progress-step li.on)
      const activeStepEl = doc.querySelector("div.progress-step li.on span");
      const deal_status = activeStepEl ? activeStepEl.textContent.trim() : "판매완료";

      // remark: 추가 정보가 없다면 빈 문자열로 처리
      const remark = "";

      return {
        order_num,
        prodnum,
        order_date,
        buyer_name,
        buyer_contact,
        product_category,
        product_description,
        product_datetime,
        unit_price,
        deal_status,
        remark
      };
    }


  // 판매 완료 모달 처리 (ticket_sale_done 등록/수정)
  patchElementBtnDone.addEventListener("click", function() {
          const rawHtml = rawElementInputDone.value;
          if (!rawHtml) {
            alert("먼저 HTML 요소값을 붙여넣으세요.");
            return;
          }

          // 기존의 patchElementBtnDone 로직 삭제
          // 대신 새 함수 호출
          const saleDoneData = extractSaleDoneData(rawHtml);

          // 추출된 데이터를 판매 완료 폼에 채워줍니다.
          saleDoneForm.elements["order_num"].value = saleDoneData.order_num;
          saleDoneForm.elements["prodnum"].value = saleDoneData.prodnum;
          saleDoneForm.elements["order_date"].value = saleDoneData.order_date;
          saleDoneForm.elements["buyer_name"].value = saleDoneData.buyer_name;
          saleDoneForm.elements["buyer_contact"].value = saleDoneData.buyer_contact;
          saleDoneForm.elements["product_category"].value = saleDoneData.product_category;
          saleDoneForm.elements["product_description"].value = saleDoneData.product_description;
          saleDoneForm.elements["product_datetime"].value = saleDoneData.product_datetime;
          saleDoneForm.elements["unit_price"].value = saleDoneData.unit_price;
          saleDoneForm.elements["deal_status"].value = saleDoneData.deal_status;
          saleDoneForm.elements["remark"].value = saleDoneData.remark;
        });


  function extractSaleInfoData(htmlString, reservation_number) {
      const parser = new DOMParser();
      // raw HTML이 단일 <tr>라면 <table>으로 감싸서 파싱
      const wrappedHtml = `<table>${htmlString}</table>`;
      const doc = parser.parseFromString(wrappedHtml, "text/html");

      console.log("---- extractSaleInfoData 시작 ----");
      console.log("reservation_number (외부):", reservation_number);

      // 상품번호: td.td-check-prd 영역의 <a> 태그에서 추출 ("5589124868887")
      const prodnumEl = doc.querySelector("td.td-check-prd a");
      const prodnum = prodnumEl ? prodnumEl.textContent.trim() : "";
      console.log("prodnum:", prodnum);

      // 티켓 등급: div.prd-title.type-sm의 첫 번째 span ("지정석 S")
      const ticketGradeEl = doc.querySelector("div.prd-title.type-sm span");
      const ticket_grade = ticketGradeEl ? ticketGradeEl.textContent.trim() : "";
      console.log("ticket_grade:", ticket_grade);

      // 티켓 위치와 티켓 구역: div.prd-title.type-md의 첫 두 개 span ("G구역", "17열")
      const prdTitleMdEls = doc.querySelectorAll("div.prd-title.type-md span");
      let ticket_floor = "", ticket_area = "";
      if (prdTitleMdEls.length >= 2) {
        ticket_floor = prdTitleMdEls[0].textContent.trim();
        ticket_area = prdTitleMdEls[1].textContent.trim();
      }
      console.log("ticket_floor:", ticket_floor);
      console.log("ticket_area:", ticket_area);

      // 상품 카테고리: div.prd-category 내의 모든 span을 " / "로 연결
      const categoryEls = doc.querySelectorAll("div.prd-category span");
      const product_category = Array.from(categoryEls)
        .map(el => el.textContent.trim())
        .join(" / ");
      console.log("product_category:", product_category);

      // 공연(상품) 일시: div.prd-day 내의 span.date ("2025.04.19 18:00")
      const datetimeEl = doc.querySelector("div.prd-day span.date");
      const product_datetime = datetimeEl ? datetimeEl.textContent.trim() : "";
      console.log("product_datetime:", product_datetime);

      // 상품 설명: div.prd-title.type-md와 div.prd-title.type-sm의 텍스트를 합침
      const prdTitleMdText = Array.from(doc.querySelectorAll("div.prd-title.type-md span"))
        .map(el => el.textContent.trim())
        .join(" ");
      const prdTitleSmText = Array.from(doc.querySelectorAll("div.prd-title.type-sm span"))
        .map(el => el.textContent.trim())
        .join(" ");
      const product_description = (prdTitleMdText + " " + prdTitleSmText).trim();
      console.log("product_description:", product_description);

      // 가격: td.td-full 내의 p.my-text-md.align-rt에서 추출 ("420,000원")
      let price = 0;
      const priceP = doc.querySelector("td.td-full p.my-text-md.align-rt");
      if (priceP) {
        let priceText = priceP.textContent.trim();
        console.log("원래 priceText:", priceText);
        // 콤마, 공백, '원' 제거 → "420000"
        priceText = priceText.replace(/[,원\s]/g, "");
        console.log("정제된 priceText:", priceText);
        price = parseInt(priceText, 10) || 0;
      }
      console.log("price:", price);

      // 수량: td.td-full 내의 p.my-text-xs.align-lt의 세 번째 span에서 추출 ("2매")
      let quantity = 1;
      const qtySpans = doc.querySelectorAll("td.td-full p.my-text-xs.align-lt span");
      if (qtySpans.length >= 3) {
        let qtyText = qtySpans[2].textContent.trim();
        console.log("원래 qtyText:", qtyText);
        qtyText = qtyText.replace(/[^\d]/g, ""); // 숫자만 남김 → "2"
        console.log("정제된 qtyText:", qtyText);
        quantity = parseInt(qtyText, 10) || 1;
      }
      console.log("quantity:", quantity);
      console.log("---- extractSaleInfoData 종료 ----");

      return {
        reservation_number, // 외부에서 받은 값 (예: "test1234")
        prodnum,
        ticket_grade,
        ticket_floor,
        ticket_area,
        product_category,
        product_datetime,
        product_description,
        price,
        quantity
      };
    }







    patchElementBtnSaleInfo.addEventListener("click", function() {
      const rawHtml = rawElementInputSaleInfo.value;
      if (!rawHtml) {
        alert("먼저 HTML 요소값을 붙여넣으세요.");
        return;
      }
      // 폼에 이미 채워진 예약번호를 사용합니다.
      const reservation_number = saleInfoForm.elements["reservation_number"].value;
      const saleInfoData = extractSaleInfoData(rawHtml, reservation_number);
      console.log("추출된 saleInfoData:", saleInfoData);

      // 추출된 데이터를 각 폼 필드에 할당
      saleInfoForm.elements["prodnum"].value = saleInfoData.prodnum;
      saleInfoForm.elements["ticket_grade"].value = saleInfoData.ticket_grade;
      saleInfoForm.elements["ticket_floor"].value = saleInfoData.ticket_floor;
      saleInfoForm.elements["ticket_area"].value = saleInfoData.ticket_area;
      saleInfoForm.elements["product_category"].value = saleInfoData.product_category;
      saleInfoForm.elements["product_datetime"].value = saleInfoData.product_datetime;
      saleInfoForm.elements["product_description"].value = saleInfoData.product_description;
      saleInfoForm.elements["price"].value = saleInfoData.price;
      saleInfoForm.elements["quantity"].value = saleInfoData.quantity;
    });






  function openSaleDoneModalFromSaleInfo(saleInfoRecord) {
      closeSaleHistoryModal();
      saleDoneModal.style.display = "block";

      // 기존 데이터로 모든 필드를 채워줍니다.
      saleDoneForm.elements["prodnum"].value = saleInfoRecord.prodnum || "";
      saleDoneForm.elements["order_num"].value = saleInfoRecord.order_num || "";
      saleDoneForm.elements["order_date"].value = saleInfoRecord.order_date || "";
      saleDoneForm.elements["buyer_name"].value = saleInfoRecord.buyer_name || "";
      saleDoneForm.elements["buyer_contact"].value = saleInfoRecord.buyer_contact || "";
      saleDoneForm.elements["product_category"].value = saleInfoRecord.product_category || "";
      saleDoneForm.elements["product_description"].value = saleInfoRecord.product_description || "";
      saleDoneForm.elements["product_datetime"].value = saleInfoRecord.product_datetime || "";
      saleDoneForm.elements["unit_price"].value = saleInfoRecord.unit_price || "";
      saleDoneForm.elements["deal_status"].value = saleInfoRecord.deal_status || "";
      saleDoneForm.elements["remark"].value = saleInfoRecord.remark || "";

      // 현재 수정 대상 주문번호를 저장 (업데이트 시 사용)
      currentSaleDoneOrderNum = saleInfoRecord.order_num || null;
    }

  saleDoneForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    const formData = new FormData(saleDoneForm);
    try {
      let response;
      if (currentSaleDoneOrderNum) {
        response = await fetch(`${SERVER_URL}/sale_done/${currentSaleDoneOrderNum}`, { method: "PUT", body: formData });
      } else {
        response = await fetch("${SERVER_URL}/sale_done", { method: "POST", body: formData });
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
        const response = await fetch(`${SERVER_URL}/sale_done/${order_num}`, { method: "DELETE" });
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
        // 1) 기존에 판매 등록 모달을 닫는 코드를 제거
        // saleInfoModal.style.display = "none";  // 제거!

        // 2) saleHistoryModal을 열 때 z-index가 더 높도록 설정
        saleHistoryModal.style.zIndex = "3000";
        saleHistoryModal.style.display = "block";

        const response = await fetch(`${SERVER_URL}/sale_done_list?prodnum=${prodnum}`);
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
              <td>${item.order_date || ""}</td>         <!-- 주문일자 -->
              <td>${item.buyer_name || ""}</td>         <!-- 구매자 이름 -->
              <td>${item.buyer_contact || ""}</td>      <!-- 구매자 연락처 -->
              <td>${item.ticket_grade || ""}</td>
              <td>${item.ticket_floor || ""}</td>
              <td>${item.ticket_area || ""}</td>
              <td>${item.product_category || ""}</td>
              <td>${item.product_datetime || ""}</td>
              <td>${item.product_description || ""}</td>
              <td>${item.unit_price || ""}</td>
              <td>${item.quantity || ""}</td>
              <td>${item.deal_status || ""}</td>
              <td>${item.remark || ""}</td>
              <td>
                <button onclick='openSaleDoneModalFromSaleInfo(${JSON.stringify(item)})'>수정/판매 완료 처리</button>
                <button onclick="deleteSaleDone('${item.order_num}')">판매 완료 취소</button>
              </td>
            `;
            saleHistoryBody.appendChild(row);
          });
        }
      } catch (error) {
        console.error("Error fetching sale_done info:", error);
        alert("판매 완료 정보를 불러오는 중 오류가 발생했습니다.");
      }
    }



  function closeSaleHistoryModal() {
    saleHistoryModal.style.display = "none";
  }

    // 전역 변수: 현재 선택된 예약번호


   async function openSaleInfoModal(reservationNumber) {
      try {
        // 예약번호를 폼에 채워두고 전역 변수에 저장
        saleInfoForm.elements["reservation_number"].value = reservationNumber;
        currentReservationNumber = reservationNumber;
        console.log("openSaleInfoModal 호출됨, 전달된 reservationNumber:", reservationNumber);
        console.log("currentReservationNumber에 저장된 값:", currentReservationNumber);

        // 판매 등록 정보 불러오기
        const response = await fetch(`${SERVER_URL}/sale_info?reservation_number=${reservationNumber}`);
        if (!response.ok) throw new Error(`GET /sale_info failed: ${response.status}`);
        const data = await response.json();

        // 판매 완료 정보도 예약번호 기준으로 불러오기
        const responseDone = await fetch(`${SERVER_URL}/sale_done_list?reservation_number=${reservationNumber}`);
        let saleDoneByProdnum = {};
        if (responseDone.ok) {
          const dataDone = await responseDone.json();
          if (dataDone.sale_done && dataDone.sale_done.length > 0) {
            dataDone.sale_done.forEach(item => {
              if (!saleDoneByProdnum[item.prodnum]) {
                saleDoneByProdnum[item.prodnum] = [];
              }
              saleDoneByProdnum[item.prodnum].push(item);
            });
          }
        } else {
          console.error(`GET /sale_done_list failed: ${responseDone.status}`);
        }

        const saleInfoTableBody = document.getElementById("saleInfoTableBody");
        saleInfoTableBody.innerHTML = "";

        if (!data.sale_info || data.sale_info.length === 0) {
          saleInfoTableBody.innerHTML = `<tr><td colspan="12">판매 등록 정보가 없습니다.</td></tr>`;
        } else {
          data.sale_info.forEach(item => {
            // 기본적으로 색상은 없음
            let rowClass = "";
            // 만약 해당 prodnum의 판매 완료 정보가 존재하면 색상 결정
            if (saleDoneByProdnum[item.prodnum]) {
              const saleDoneArray = saleDoneByProdnum[item.prodnum];
              // 모두 deal_status가 "판매완료"인지 검사
              const allCompleted = saleDoneArray.every(done => done.deal_status === "판매완료");
              rowClass = allCompleted ? "sold-out-green" : "sold-out-yellow";
            }
            const row = document.createElement("tr");
            row.className = rowClass;
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
                <button onclick='openSaleHistoryModal(${JSON.stringify(item.prodnum)})'>판매 완료 정보</button>
              </td>
              <td>
                <button onclick='openSaleInfoEditForm(${JSON.stringify(item)})'>수정</button>
                <button onclick='deleteSaleInfo(${JSON.stringify(item.prodnum)})'>삭제</button>
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
          const response = await fetch(`${SERVER_URL}/sale_info/${prodnum}`, { method: "DELETE" });
          if (!response.ok) throw new Error("삭제 실패");
          alert("판매 등록 정보가 삭제되었습니다!");
          fetchTickets();  // 또는 필요한 경우, 관련 모달도 새로고침
        } catch (error) {
          console.error("Error deleting sale info:", error);
          alert("판매 등록 정보 삭제에 실패했습니다.");
        }
      }
    }

      // 티켓링크(제휴) 사이트의 HTML에서 티켓 등록에 필요한 데이터를 추출하는 함수
    function extractTicketLinkData(htmlString) {
     const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, "text/html");
      const ticketData = {};

      // 예매정보 테이블에서 데이터 추출
      const reserveInfoTable = doc.querySelector(".bx_table.tbl_reserve_info table");
      if (reserveInfoTable) {
        const rows = reserveInfoTable.querySelectorAll("tbody tr");
        rows.forEach(row => {
          const ths = row.querySelectorAll("th");
          const tds = row.querySelectorAll("td");
          ths.forEach((th, idx) => {
            const headerText = th.textContent.trim();
            if (headerText === "티켓명") {
              // <dl class="bx_league"> 내부의 <dd>들을 조합
              const td = tds[idx];
              const dl = td.querySelector("dl.bx_league");
              if (dl) {
                const ddElements = dl.querySelectorAll("dd");
                const parts = [];
                ddElements.forEach(dd => {
                  const text = dd.textContent.replace(/<br\s*\/?>/gi, "").trim();
                  if (text) {
                    parts.push(text);
                  }
                });
                ticketData.product_name = parts.join(" / ");
              } else {
                // <dl>이 없으면 td의 텍스트 사용
                ticketData.product_name = td.textContent.trim();
              }
            } else if (headerText === "예매자") {
              ticketData.buyer = tds[idx].textContent.trim();
            } else if (headerText === "관람일시") {
              ticketData.product_use_date = tds[idx].textContent.trim();
            } else if (headerText === "예매일") {
              ticketData.purchase_date = tds[idx].textContent.trim();
            } else if (headerText === "예매채널") {
              ticketData.purchase_source = tds[idx].textContent.trim();
            }
          });
        });
      }

      // 2. 결제정보 테이블에서 총 결제금액과 결제 방식 추출
      const paymentInfoTable = doc.querySelector(".bx_table.tbl_payment_info table");
      if (paymentInfoTable) {
        // 총 결제금액
        const tfoot = paymentInfoTable.querySelector("tfoot");
        if (tfoot) {
          const rows = tfoot.querySelectorAll("tr");
          rows.forEach(row => {
            const th = row.querySelector("th");
            if (th && th.textContent.trim() === "총 결제금액") {
              const span = row.querySelector("span.color_point");
              if (span) {
                let amountText = span.textContent.trim();
                amountText = amountText.replace(/[,원\s]/g, "");
                ticketData.payment_amount = parseInt(amountText, 10);
              }
            }
          });
        }
        // 결제 방식 추출: 결제정보 테이블의 tfoot 내 ul > li (예: "신용카드 84,000원")
        const li = paymentInfoTable.querySelector("tfoot ul li");
        if (li) {
          const text = li.textContent.trim();
          // 결제 방식은 숫자 나오기 전까지의 텍스트
          const match = text.match(/^[^\d]+/);
          if (match) {
            ticketData.payment_method = match[0].trim();
          } else {
            ticketData.payment_method = "";
          }
        }
      }
        const seatInfoTable = doc.querySelector(".bx_table.tbl_seat_info table");
        let seatDetails = [];
        let ticketCount = 0;
        let reservationNumber = "";
        if (seatInfoTable) {
          const rows = seatInfoTable.querySelectorAll("tbody tr");
          ticketCount = rows.length;
          rows.forEach(row => {
            const cells = row.querySelectorAll("td");
            if (cells.length >= 5) {
              if (!reservationNumber) {
                reservationNumber = cells[1].textContent.trim();
              }
              const seatText = cells[4].textContent.trim();
              if (seatText) {
                seatDetails.push(seatText);
              }
            }
          });
        }
        // 만약 티켓 수가 0이면 기본값으로 1을 사용 (원하는 기본값으로 수정 가능)
        if (!ticketCount || ticketCount === 0) {
          ticketCount = 1;
        }

        ticketData.reservation_number = reservationNumber;
        ticketData.purchase_quantity = ticketCount;
        ticketData.remaining_quantity = ticketCount; // 남은 티켓 수를 티켓 수와 동일하게 설정
        ticketData.seat_detail = seatDetails.join(", ");
      // 3. 좌석정보 테이블에서 티켓 수, 예매번호, 좌석 상세 추출


      return ticketData;
    }

    document.getElementById("patchElementBtnTicket").addEventListener("click", function() {
      const rawHtml = document.getElementById("rawElementInputTicket").value;
      if (!rawHtml) {
        alert("먼저 HTML 요소를 붙여넣으세요.");
        return;
      }
      const ticketData = extractTicketLinkData(rawHtml);
      console.log("추출된 티켓 데이터:", ticketData);

      const form = document.getElementById("addTicketForm");
      form.elements["reservation_number"].value = ticketData.reservation_number || "";
      form.elements["purchase_source"].value = ticketData.purchase_source || "";
      form.elements["buyer"].value = ticketData.buyer || "";
      form.elements["purchase_date"].value = ticketData.purchase_date || "";
      form.elements["payment_amount"].value = ticketData.payment_amount || "";
      form.elements["payment_method"].value = ticketData.payment_method || "";
      form.elements["product_use_date"].value = ticketData.product_use_date || "";
      // 여기서 제품 이름를 채워 넣습니다.
      form.elements["product_name"].value = ticketData.product_name || "";
      form.elements["ticket_count"].value = ticketData.purchase_quantity || "";
      form.elements["remaining_quantity"].value = ticketData.remaining_quantity || "";
      form.elements["seat_detail"].value = ticketData.seat_detail || "";
    });

    // HTML 요소에서 티켓 데이터를 추출하는 함수 (티링 버튼 전용)
    function extractTiringData(htmlString) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, "text/html");
      const ticketData = {};

      // 1. reservation_number: "티켓 예매내역" 테이블에서 첫 번째 예약번호 추출
      // (예: <div class="basic_tbl basic_tbl_v3"> 내부의 <label class="ng-binding">1481398558</label>)
      let reservationElem = doc.querySelector("div.basic_tbl.basic_tbl_v3 table tbody label.ng-binding");
      ticketData.reservation_number = reservationElem ? reservationElem.textContent.trim() : "";

      // 2. purchase_source: "예매채널" 행의 값 (예: "PC웹")
      let purchaseSource = "";
      Array.from(doc.querySelectorAll("th")).forEach(th => {
        if (th.textContent.trim() === "예매채널") {
          const td = th.nextElementSibling;
          if (td) {
            purchaseSource = td.textContent.trim();
          }
        }
      });
      ticketData.purchase_source = purchaseSource;

      // 3. buyer: "예매자" 행의 값 (예: "이선범")
      let buyer = "";
      Array.from(doc.querySelectorAll("th")).forEach(th => {
        if (th.textContent.trim() === "예매자") {
          const td = th.nextElementSibling;
          if (td) {
            buyer = td.textContent.trim();
          }
        }
      });
      ticketData.buyer = buyer;

      // 4. purchase_date: "예매일" 행의 값 (예: "2025.03.15")
      let purchaseDate = "";
      Array.from(doc.querySelectorAll("th")).forEach(th => {
        if (th.textContent.trim() === "예매일") {
          const td = th.nextElementSibling;
          if (td) {
            purchaseDate = td.textContent.trim();
          }
        }
      });
      ticketData.purchase_date = purchaseDate;

      // 5. payment_amount: "결제정보" 영역의 총 결제금액
      let paymentAmountElem = doc.querySelector("div.basic_tbl_v4 table tfoot tr.final.final_option span.number.ng-binding");
      if (paymentAmountElem) {
        const amountText = paymentAmountElem.textContent.replace(/[,원\s]/g, "");
        ticketData.payment_amount = parseInt(amountText, 10) || 0;
      } else {
        ticketData.payment_amount = 0;
      }

      // 6. payment_method: "결제상세정보" 영역에서 결제수단 추출 (예: "신용카드 간편결제")
      let paymentMethodElem = doc.querySelector("div.basic_tbl_v4 table tfoot ul.final_list li");
      if (paymentMethodElem) {
        let text = paymentMethodElem.textContent.trim();
        let match = text.match(/^[^\d]+/);
        ticketData.payment_method = match ? match[0].trim() : "";
      } else {
        ticketData.payment_method = "";
      }

      // 7. product_use_date: "관람일시" 행의 값에서 괄호 안의 요일 제거
      let productUseDate = "";
      Array.from(doc.querySelectorAll("th")).forEach(th => {
        if (th.textContent.trim() === "관람일시") {
          const td = th.nextElementSibling;
          if (td) {
            // 정규표현식으로 괄호 및 그 안의 내용을 제거
            productUseDate = td.textContent.replace(/\([^)]*\)/, "").trim();
          }
        }
      });
      ticketData.product_use_date = productUseDate;

      // 8. product_name: "티켓명" 행의 값에서 티켓명을 추출
      // (예: [2025 신한 SOL Bank KBO 리그] 삼성 라이온즈 vs 키움히어로즈)
      let productName = "";
      // 찾을 때 "티켓명"이라는 헤더를 기준으로 같은 행의 td를 가져옴
      const ticketNameHeader = Array.from(doc.querySelectorAll("th")).find(th => th.textContent.trim() === "티켓명");
      if (ticketNameHeader) {
        const productNameCell = ticketNameHeader.nextElementSibling;
        if (productNameCell) {
          // innerText로 여러 줄을 합쳐서 가져옴 (줄바꿈 제거)
          productName = productNameCell.innerText.replace(/\s+/g, " ").trim();
        }
      }
      ticketData.product_name = productName;

      // 9. purchase_quantity 및 remaining_quantity: "예매한 티켓정보"에서 좌석정보 <p> 태그의 개수
      const seatDetailElems = doc.querySelectorAll("div.basic_tbl_v4 table tbody tr:not(.line) p.ng-binding");
      const purchase_quantity = seatDetailElems ? seatDetailElems.length : 0;
      ticketData.purchase_quantity = purchase_quantity;
      ticketData.remaining_quantity = purchase_quantity;

      // 10. seat_detail: 각 좌석정보 <p>의 텍스트들을 쉼표로 연결
      const seatDetails = [];
      seatDetailElems.forEach(p => {
        seatDetails.push(p.textContent.trim());
      });
      ticketData.seat_detail = seatDetails.join(", ");

      // 11. 카드 관련 필드: HTML에 값이 없으므로 빈 문자열로 처리
      ticketData.card_company = "";
      ticketData.card_number = "";
      ticketData.card_approval_number = "";

      // 12. seat_image_name: 제공되지 않으므로 빈 문자열
      ticketData.seat_image_name = "";

      return ticketData;
    }

    // 티링 버튼 클릭 시 추출한 데이터를 티켓 추가 폼에 채워넣기
    // (티링 버튼의 id를 "patchElementBtnTiring", HTML 입력 textarea의 id를 "rawElementInputTicket"라고 가정)
    document.getElementById("patchElementBtnTiring").addEventListener("click", function() {
      const rawHtml = document.getElementById("rawElementInputTicket").value;
      if (!rawHtml) {
        alert("먼저 HTML 요소를 붙여넣으세요.");
        return;
      }
      const ticketData = extractTiringData(rawHtml);
      console.log("티링으로 추출된 데이터:", ticketData);

      const form = document.getElementById("addTicketForm");
      form.elements["reservation_number"].value = ticketData.reservation_number || "";
      form.elements["purchase_source"].value = ticketData.purchase_source || "";
      form.elements["buyer"].value = ticketData.buyer || "";
      form.elements["purchase_date"].value = ticketData.purchase_date || "";
      form.elements["payment_amount"].value = ticketData.payment_amount || "";
      form.elements["payment_method"].value = ticketData.payment_method || "";
      form.elements["product_use_date"].value = ticketData.product_use_date || "";
      form.elements["product_name"].value = ticketData.product_name || "";
      form.elements["ticket_count"].value = ticketData.purchase_quantity || "";
      form.elements["remaining_quantity"].value = ticketData.remaining_quantity || "";
      form.elements["seat_detail"].value = ticketData.seat_detail || "";
    });


    async function deleteTicket(reservation_number) {
      if (confirm("해당 티켓과 관련된 판매 등록 정보 및 판매 완료 정보까지 모두 삭제하시겠습니까?")) {
        try {
          // 1. 해당 티켓의 판매 등록 정보 조회
          let saleInfoResponse = await fetch(`${SERVER_URL}/sale_info?reservation_number=${reservation_number}`);
          if (!saleInfoResponse.ok) {
            throw new Error("판매 등록 정보 조회에 실패했습니다.");
          }
          let saleInfoData = await saleInfoResponse.json();

          // 2. 조회된 판매 등록 정보가 있으면, 각 prodnum에 대해 DELETE 요청 실행
          if (saleInfoData.sale_info && saleInfoData.sale_info.length > 0) {
            for (const info of saleInfoData.sale_info) {
              let deleteSaleInfoResponse = await fetch(`${SERVER_URL}/sale_info/${info.prodnum}`, {
                method: "DELETE"
              });
              if (!deleteSaleInfoResponse.ok) {
                throw new Error(`판매 등록 정보 삭제 실패: prodnum ${info.prodnum}`);
              }
            }
          }

          // 3. 티켓 삭제
          const response = await fetch(`${SERVER_URL}/tickets/${reservation_number}`, {
            method: "DELETE"
          });
          if (!response.ok) {
            throw new Error("티켓 삭제 실패");
          }
          alert("티켓과 관련된 판매 등록 및 판매 완료 정보가 모두 삭제되었습니다!");
          fetchTickets();
        } catch (error) {
          console.error("Error deleting ticket and related info:", error);
          alert("티켓 삭제에 실패했습니다.");
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

function openSaleInfoEditForm(saleInfoRecord) {
      saleInfoForm.reset();
      // 기존 폼 필드에 값을 채워넣음
      saleInfoForm.elements["reservation_number"].value = saleInfoRecord.reservation_number || "";
      saleInfoForm.elements["ticket_grade"].value = saleInfoRecord.ticket_grade || "";
      saleInfoForm.elements["ticket_floor"].value = saleInfoRecord.ticket_floor || "";
      saleInfoForm.elements["ticket_area"].value = saleInfoRecord.ticket_area || "";
      saleInfoForm.elements["product_category"].value = saleInfoRecord.product_category || "";
      saleInfoForm.elements["product_datetime"].value = saleInfoRecord.product_datetime || "";
      saleInfoForm.elements["product_description"].value = saleInfoRecord.product_description || "";
      saleInfoForm.elements["price"].value = saleInfoRecord.price || "";
      saleInfoForm.elements["quantity"].value = saleInfoRecord.quantity || "";
      // hidden 필드 prodnum를 채워 넣어 수정 여부 판단
      saleInfoForm.elements["prodnum"].value = saleInfoRecord.prodnum || "";

      saleInfoFormModal.style.display = "block";
    }

   function openSaleDoneFormModal() {
      // 폼 초기화 (필요한 경우 reset() 사용)
      saleDoneForm.reset();
      currentSaleDoneOrderNum = null;
      saleDoneModal.style.zIndex = "4000";  // 최상단에 오도록 강제 지정
      saleDoneModal.style.display = "block";
    }

    function applyFilters() {
      const searchText = document.getElementById("seatSearch").value.trim().toLowerCase();
      const availableOnly = document.getElementById("availableOnly").checked;
      let filtered = ticketDataList;

      // 좌석 상세 검색 필터 적용
      if (searchText) {
        filtered = filtered.filter(ticket =>
          ticket.seat_detail && ticket.seat_detail.toLowerCase().includes(searchText)
        );
      }

      // 판매 가능한 상품만 보기: 제품 사용일이 현재 시간보다 미래인 티켓만 필터링
      if (availableOnly) {
        const now = new Date();
        filtered = filtered.filter(ticket => {
          if (!ticket.product_use_date) return false;
          // 만약 product_use_date에 "T"가 없으면, 공백을 "T"로 교체 (예: "2025-03-26 18:30:00" → "2025-03-26T18:30:00")
          let dateStr = ticket.product_use_date;
          if (dateStr.indexOf("T") === -1) {
            dateStr = dateStr.replace(" ", "T");
          }
          const useDate = new Date(dateStr);
          return useDate > now;
        });
      }

      renderTickets(filtered);
    }

    // 기존 검색창 이벤트를 위 applyFilters 함수로 대체
    document.getElementById("seatSearch").addEventListener("input", applyFilters);
    // 체크박스 상태 변화 시에도 필터 적용
    document.getElementById("availableOnly").addEventListener("change", applyFilters);

    // fetchTickets 함수에서 데이터를 받아온 후에도 전체 데이터를 ticketDataList에 저장하고 applyFilters를 호출합니다.
    async function fetchTickets(refresh = false) {
      try {
        let url = "${SERVER_URL}/tickets";
        if (refresh) url += "?refresh=1";
        console.log("Fetching tickets from:", url);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        console.log("Tickets received:", data);
        ticketDataList = data.tickets;
        // 기존 renderTickets 대신 applyFilters 호출하여 필터가 적용된 결과로 렌더링
        applyFilters();
      } catch (error) {
        console.error("Error fetching tickets:", error);
        const tableBody = document.getElementById("ticketTableBody");
        tableBody.innerHTML = "<tr><td colspan='16'>티켓 목록을 불러오는 중 오류가 발생했습니다.</td></tr>";
      }
    }


     // 정렬 이벤트 등록
  addSortingEventListeners();

  document.getElementById("refreshBtn").addEventListener("click", function() {
      fetchTickets(true);
  });

  document.getElementById("seatSearch").addEventListener("input", function() {
      const searchText = this.value.trim().toLowerCase();
      // ticketDataList는 전체 티켓 데이터를 저장하는 전역 변수
      const filteredTickets = ticketDataList.filter(ticket => {
        return ticket.seat_detail && ticket.seat_detail.toLowerCase().includes(searchText);
      });
      renderTickets(filteredTickets);
    });
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
  window.openSaleDoneFormModal = openSaleDoneFormModal;
  window.deleteSaleInfo = deleteSaleInfo;
  window.deleteTicket = deleteTicket;
  window.openSaleInfoEditForm = openSaleInfoEditForm;
});
