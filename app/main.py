import logging
from typing import Optional
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException
from sqlalchemy import select, delete
from app.database import engine
from contextlib import asynccontextmanager
import uvicorn
import os
from app.models import ticket_sale_info, ticket_canceled  # models.py에 정의되어 있어야 함
from app.models import ticket_sale_done
import shutil
from app.config import SEAT_IMAGE_FOLDER
from fastapi.responses import FileResponse
from app.database import check_db_connection, engine
from app.tickets import load_ticket_cache, get_cached_tickets
from app.models import tickets_table
import json
from fastapi.middleware.cors import CORSMiddleware
import datetime
from app.tickets import serialize_ticket



logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

UPLOAD_DIR = "uploaded_images"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("🚀 FastAPI 서버 시작!")
    check_db_connection()
    load_ticket_cache()
    yield
    logging.info("🛑 FastAPI 서버 종료!")

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://59.13.119.90:8000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

app.mount("/static", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")



@app.get("/")
async def read_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/api/tickets")
def get_tickets(refresh: bool = False):
    logging.info("📢 /tickets API 호출됨 (refresh=%s)", refresh)
    if refresh:
        load_ticket_cache()
        logging.info("DB에서 최신 티켓 정보를 불러옴")
    tickets_data = get_cached_tickets()
    logging.info("📜 반환 데이터: %s", json.dumps(tickets_data, indent=2, ensure_ascii=False)[:500])
    return {"tickets": tickets_data}

@app.get("/seat-image/{image_name}")
def get_seat_image(image_name: str):
    image_path = os.path.join(SEAT_IMAGE_FOLDER, image_name)
    print("Serving image from:", image_path)
    if os.path.exists(image_path):
        return FileResponse(image_path)
    else:
        return {"error": "Image not found"}


@app.post("/api/tickets")
async def add_ticket(
        reservation_number: str = Form(...),
        purchase_source: str = Form(...),
        buyer: str = Form(...),
        purchase_date: str = Form(...),
        product_use_date: str = Form(...),
        product_name: str = Form(...),  # 추가된 필드
        payment_amount: int = Form(...),
        seat_detail: str = Form(...),
        ticket_count: int = Form(...),
        payment_method: str = Form(...),
        card_company: str = Form(None),
        card_number: str = Form(None),
        card_approval_number: str = Form(None),
        seat_image: UploadFile = File(None)
):
    import datetime, os, shutil, re
    logging.info("📝 add_ticket 호출됨. 예약번호: %s", reservation_number)

    # 구매일 파싱
    logging.info("📝 Raw purchase_date: %s", purchase_date)
    try:
        purchase_date_dt = datetime.datetime.strptime(purchase_date.strip(), "%Y.%m.%d")
        logging.info("✅ purchase_date 파싱 성공: %s", purchase_date_dt)
    except Exception as e:
        logging.error("❌ purchase_date 파싱 실패: %s", e)
        purchase_date_dt = datetime.datetime.now()
        logging.info("🔄 purchase_date fallback: %s", purchase_date_dt)

    # 제품 사용일 파싱 (요일 정보 제거)
    logging.info("📝 Raw product_use_date: %s", product_use_date)
    product_use_date = product_use_date.strip()
    product_use_date = re.sub(r'\([^)]+\)', '', product_use_date).strip()
    logging.info("📝 정제된 product_use_date: %s", product_use_date)
    try:
        product_use_date_dt = datetime.datetime.strptime(product_use_date, "%Y.%m.%d %H:%M")
        logging.info("✅ product_use_date 파싱 성공 (custom): %s", product_use_date_dt)
    except Exception as e:
        logging.error("❌ product_use_date 파싱 실패 (custom): %s", e)
        try:
            product_use_date_dt = datetime.datetime.fromisoformat(product_use_date)
            logging.info("✅ product_use_date 파싱 성공 (fromisoformat): %s", product_use_date_dt)
        except Exception as e2:
            logging.error("❌ product_use_date fromisoformat 파싱 실패: %s", e2)
            product_use_date_dt = purchase_date_dt
            logging.info("🔄 product_use_date fallback: %s", product_use_date_dt)

    # product_name는 폼에서 전달받은 값 사용
    logging.info("📝 Received product_name: %s", product_name)

    image_filename = ""
    if seat_image:
        try:
            filename = seat_image.filename
            ext = os.path.splitext(filename)[1]
            image_filename = f"ticket_{reservation_number}{ext}"
            os.makedirs(SEAT_IMAGE_FOLDER, exist_ok=True)
            full_path = os.path.join(SEAT_IMAGE_FOLDER, image_filename)
            with open(full_path, "wb") as buffer:
                shutil.copyfileobj(seat_image.file, buffer)
            logging.info("✅ 이미지 업로드 성공: %s", image_filename)
        except Exception as e:
            logging.error("❌ 이미지 업로드 실패: %s", e)
            image_filename = ""
    else:
        logging.info("ℹ️ 이미지 파일이 전송되지 않았습니다.")

    try:
        with engine.begin() as connection:
            connection.execute(
                tickets_table.insert().values(
                    reservation_number=reservation_number,
                    purchase_source=purchase_source,
                    buyer=buyer,
                    purchase_date=purchase_date_dt,
                    payment_amount=payment_amount,
                    payment_method=payment_method,
                    card_company=card_company,
                    card_number=card_number,
                    card_approval_number=card_approval_number,
                    product_use_date=product_use_date_dt,
                    product_name=product_name,
                    purchase_quantity=ticket_count,
                    remaining_quantity=ticket_count,
                    seat_detail=seat_detail,
                    seat_image_name=image_filename
                )
            )
        logging.info("✅ DB에 티켓 정보 저장 성공: 예약번호 %s", reservation_number)
    except Exception as e:
        logging.error("❌ DB 저장 중 오류 발생: %s", e)
        raise e

    return {"message": "티켓이 추가되었습니다!"}


@app.patch("/api/tickets/{reservation_number}")
async def update_ticket(
        reservation_number: str,
        purchase_source: str = Form(...),
        buyer: str = Form(...),
        purchase_date: str = Form(...),
        product_use_date: str = Form(...),  # 제품 사용일 추가
        product_name: str = Form(...),  # 제품 이름 추가
        payment_amount: int = Form(...),
        payment_method: str = Form(...),
        card_company: str = Form(None),
        card_number: str = Form(None),
        card_approval_number: str = Form(None),
        seat_detail: str = Form(...),
        ticket_count: int = Form(...),
        seat_image: UploadFile = File(None)
):
    import datetime, os, shutil, re
    logging.info("📝 Raw purchase_date: '%s'", purchase_date)
    try:
        # ISO 형식(예: "2025-03-18T00:00:00") 파싱 시도
        purchase_date_dt = datetime.datetime.fromisoformat(purchase_date.strip())
        logging.info("✅ purchase_date fromisoformat 성공: %s", purchase_date_dt)
    except Exception as e:
        try:
            # "%Y.%m.%d" 형식으로 파싱 시도
            purchase_date_dt = datetime.datetime.strptime(purchase_date.strip(), "%Y.%m.%d")
            logging.info("✅ purchase_date strptime 성공: %s", purchase_date_dt)
        except Exception as e2:
            logging.error("❌ purchase_date 파싱 실패: %s", e2)
            raise HTTPException(status_code=400, detail="Invalid purchase_date format")

    # 제품 사용일 파싱 (예: "2025.03.26(수) 18:30")
    logging.info("📝 Raw product_use_date: '%s'", product_use_date)
    cleaned_use_date = product_use_date.strip()
    cleaned_use_date = re.sub(r'\([^)]+\)', '', cleaned_use_date).strip()
    logging.info("📝 Cleaned product_use_date: '%s'", cleaned_use_date)
    try:
        product_use_date_dt = datetime.datetime.strptime(cleaned_use_date, "%Y.%m.%d %H:%M")
        logging.info("✅ product_use_date 파싱 성공: %s", product_use_date_dt)
    except Exception as e:
        logging.error("❌ product_use_date 파싱 실패: %s", e)
        try:
            product_use_date_dt = datetime.datetime.fromisoformat(cleaned_use_date)
            logging.info("✅ product_use_date 파싱 성공 (fromisoformat): %s", product_use_date_dt)
        except Exception as e2:
            logging.error("❌ product_use_date fromisoformat 파싱 실패: %s", e2)
            product_use_date_dt = purchase_date_dt
            logging.info("🔄 product_use_date fallback: %s", product_use_date_dt)

    # 제품 이름는 폼에서 전달받은 값을 사용
    logging.info("📝 Received product_name: '%s'", product_name)

    image_filename = None
    # 파일이 선택되었고 파일명이 비어있지 않은 경우에만 처리
    if seat_image and seat_image.filename:
        try:
            original_filename = seat_image.filename
            ext = os.path.splitext(original_filename)[1]
            image_filename = f"ticket_{reservation_number}{ext}"
            os.makedirs(SEAT_IMAGE_FOLDER, exist_ok=True)
            full_path = os.path.join(SEAT_IMAGE_FOLDER, image_filename)
            with open(full_path, "wb") as buffer:
                shutil.copyfileobj(seat_image.file, buffer)
            logging.info("✅ 이미지 저장 성공: %s", image_filename)
        except Exception as e:
            logging.error("❌ 이미지 저장 실패: %s", e)
            image_filename = None

    try:
        with engine.begin() as connection:
            update_values = {
                "purchase_source": purchase_source,
                "buyer": buyer,
                "purchase_date": purchase_date_dt,
                "payment_amount": payment_amount,
                "payment_method": payment_method,
                "card_company": card_company,
                "card_number": card_number,
                "card_approval_number": card_approval_number,
                "product_use_date": product_use_date_dt,  # 수정된 제품 사용일 적용
                "product_name": product_name,  # 수정된 제품 이름 적용
                "purchase_quantity": ticket_count,
                "seat_detail": seat_detail,
            }
            if image_filename is not None:
                update_values["seat_image_name"] = image_filename

            update_query = tickets_table.update().where(
                tickets_table.c.reservation_number == reservation_number
            ).values(**update_values)
            connection.execute(update_query)
        logging.info("티켓 수정 성공: %s", reservation_number)
    except Exception as e:
        logging.error("티켓 수정 중 오류 발생: %s", e)
        raise HTTPException(status_code=500, detail="티켓 수정 실패")

    return {"message": "티켓이 수정되었습니다!"}

@app.get("/api/tickets/by-prodnum")
def get_ticket_by_prodnum(prodnum: str = Query(...)):
    with engine.connect() as connection:
        # 1. ticket_sale_info 테이블에서 prodnum으로 판매 등록 정보를 찾기
        sale_info_record = connection.execute(
            select(ticket_sale_info).where(ticket_sale_info.c.prodnum == prodnum)
        ).fetchone()
        if not sale_info_record:
            raise HTTPException(status_code=404, detail="판매 등록 정보가 없습니다.")

        # 2. 해당 판매 등록 정보에서 예약번호 추출
        reservation_number = sale_info_record.reservation_number

        # 3. ticket 테이블에서 해당 예약번호로 티켓 조회
        ticket_record = connection.execute(
            select(tickets_table).where(tickets_table.c.reservation_number == reservation_number)
        ).fetchone()
        if not ticket_record:
            raise HTTPException(status_code=404, detail="티켓 정보를 찾을 수 없습니다.")

        # 4. 티켓 정보를 직렬화하여 반환
        return {"ticket": serialize_ticket(ticket_record)}

@app.delete("/api/tickets/{reservation_number}")
async def delete_ticket(reservation_number: str):
    logging.info("Deleting ticket: %s", reservation_number)
    try:
        with engine.begin() as connection:
            delete_query = tickets_table.delete().where(tickets_table.c.reservation_number == reservation_number)
            result = connection.execute(delete_query)
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="티켓을 찾을 수 없습니다.")
        logging.info("티켓 삭제 성공: %s", reservation_number)
    except Exception as e:
        logging.error("티켓 삭제 중 오류 발생: %s", e)
        raise HTTPException(status_code=500, detail="티켓 삭제 실패")
    return {"message": "티켓이 삭제되었습니다!"}

@app.post("/api/sale_info")
async def register_sale_info(
        reservation_number: str = Form(...),
        prodnum: str = Form(...),
        ticket_grade: str = Form(...),
        ticket_floor: str = Form(...),
        ticket_area: str = Form(...),
        product_category: str = Form(...),
        product_datetime: str = Form(...),
        product_description: str = Form(...),
        price: int = Form(...),
        quantity: int = Form(...)
):
    import datetime
    dt_formats = ["%Y.%m.%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"]
    product_datetime_dt = None
    for fmt in dt_formats:
        try:
            product_datetime_dt = datetime.datetime.strptime(product_datetime.strip(), fmt)
            logging.info("✅ product_datetime 변환 성공 (format %s): %s", fmt, product_datetime_dt)
            break
        except Exception as e:
            logging.info("제품 일시 변환 시도 실패 (format %s): %s", fmt, e)
    if product_datetime_dt is None:
        logging.error("❌ 모든 포맷으로 제품 일시 변환 실패, 현재시간 사용")
        product_datetime_dt = datetime.datetime.now()
        logging.info("🔄 product_datetime fallback: %s", product_datetime_dt)

    try:
        with engine.begin() as connection:
            connection.execute(
                ticket_sale_info.insert().values(
                    reservation_number=reservation_number,
                    prodnum=prodnum,
                    ticket_grade=ticket_grade,
                    ticket_floor=ticket_floor,
                    ticket_area=ticket_area,
                    product_category=product_category,
                    product_datetime=product_datetime_dt,
                    product_description=product_description,
                    price=price,
                    quantity=quantity
                )
            )
        logging.info("판매 등록 정보 저장 성공: 예매번호 %s, 제품번호 %s", reservation_number, prodnum)
        return {"message": "판매 등록 정보가 저장되었습니다!"}
    except Exception as e:
        logging.error("판매 등록 정보 저장 중 오류 발생: %s", e)
        raise HTTPException(status_code=500, detail="판매 등록 정보 저장 실패")


@app.put("/api/sale_info/{prodnum}")
async def update_sale_info(
    prodnum: str,
    reservation_number: str = Form(...),
    ticket_grade: str = Form(...),
    ticket_floor: str = Form(...),
    ticket_area: str = Form(...),
    product_category: str = Form(...),
    product_datetime: str = Form(...),
    product_description: str = Form(...),
    price: int = Form(...),
    quantity: int = Form(...)
):
    import datetime
    try:
        # "2025.04.19 18:00" 형식의 문자열로 파싱
        product_datetime_dt = datetime.datetime.strptime(product_datetime.strip(), "%Y.%m.%d %H:%M")
        logging.info("✅ product_datetime 파싱 성공: %s", product_datetime_dt)
    except Exception as e:
        logging.error("❌ product_datetime 파싱 실패: %s", e)
        product_datetime_dt = datetime.datetime.now()

    try:
        with engine.begin() as connection:
            update_query = ticket_sale_info.update().where(ticket_sale_info.c.prodnum == prodnum).values(
                reservation_number=reservation_number,
                ticket_grade=ticket_grade,
                ticket_floor=ticket_floor,
                ticket_area=ticket_area,
                product_category=product_category,
                product_datetime=product_datetime_dt,
                product_description=product_description,
                price=price,
                quantity=quantity
            )
            result = connection.execute(update_query)
            if result.rowcount == 0:
                # 레코드가 없으므로 새로 insert 실행
                connection.execute(
                    ticket_sale_info.insert().values(
                        reservation_number=reservation_number,
                        prodnum=prodnum,
                        ticket_grade=ticket_grade,
                        ticket_floor=ticket_floor,
                        ticket_area=ticket_area,
                        product_category=product_category,
                        product_datetime=product_datetime_dt,
                        product_description=product_description,
                        price=price,
                        quantity=quantity
                    )
                )
                logging.info("업데이트 대상 레코드가 없어서 신규 판매 등록 정보를 삽입했습니다. (prodnum: %s)", prodnum)
        logging.info("판매 등록 정보 업데이트 성공: prodnum %s", prodnum)
        return {"message": "판매 등록 정보가 업데이트되었습니다!"}
    except Exception as e:
        logging.error("판매 등록 정보 업데이트 중 오류 발생: %s", e)
        raise HTTPException(status_code=500, detail="판매 등록 정보 업데이트 실패")

@app.get("/api/sale_info")
def get_sale_info(reservation_number: str = Query(...)):
    try:
        with engine.connect() as connection:
            query = select(ticket_sale_info).where(
                ticket_sale_info.c.reservation_number == reservation_number
            )
            results = connection.execute(query).fetchall()

        sale_info_list = []
        for row in results:
            sale_info_list.append({
                "reservation_number": row.reservation_number,
                "prodnum": row.prodnum,
                "ticket_grade": row.ticket_grade,
                "ticket_floor": row.ticket_floor,
                "ticket_area": row.ticket_area,
                "product_category": row.product_category,
                "product_datetime": row.product_datetime.isoformat(),
                "product_description": row.product_description,
                "price": row.price,
                "quantity": row.quantity
            })
        return {"sale_info": sale_info_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GET 엔드포인트를 "/sale_done_list"로 분리 (GET 방식)
@app.get("/api/sale_done_list")
def get_sale_done_list(reservation_number: Optional[str] = None, prodnum: Optional[str] = None):
    try:
        with engine.connect() as connection:
            j = ticket_sale_done.join(ticket_sale_info, ticket_sale_done.c.prodnum == ticket_sale_info.c.prodnum)
            query = select(
                ticket_sale_done.c.prodnum,
                ticket_sale_done.c.order_num,
                # 누락된 컬럼 추가
                ticket_sale_done.c.order_date,
                ticket_sale_done.c.buyer_name,
                ticket_sale_done.c.buyer_contact,

                ticket_sale_info.c.reservation_number,
                ticket_sale_info.c.ticket_grade,
                ticket_sale_info.c.ticket_floor,
                ticket_sale_info.c.ticket_area,

                ticket_sale_done.c.product_category,
                ticket_sale_done.c.product_datetime,
                ticket_sale_done.c.product_description,
                ticket_sale_done.c.unit_price,

                ticket_sale_info.c.quantity,
                ticket_sale_done.c.deal_status,
                ticket_sale_done.c.remark
            ).select_from(j)

            if prodnum:
                query = query.where(ticket_sale_done.c.prodnum == prodnum)
            elif reservation_number:
                query = query.where(ticket_sale_info.c.reservation_number == reservation_number)

            results = connection.execute(query).fetchall()
            sale_done_list = []
            for row in results:
                sale_done_list.append({
                    "prodnum": row.prodnum,
                    "order_num": row.order_num,
                    "order_date": row.order_date.isoformat() if row.order_date else None,
                    "buyer_name": row.buyer_name,
                    "buyer_contact": row.buyer_contact,

                    "reservation_number": row.reservation_number,
                    "ticket_grade": row.ticket_grade,
                    "ticket_floor": row.ticket_floor,
                    "ticket_area": row.ticket_area,

                    "product_category": row.product_category,
                    "product_datetime": row.product_datetime.isoformat() if row.product_datetime else None,
                    "product_description": row.product_description,
                    "unit_price": row.unit_price,
                    "quantity": row.quantity,
                    "deal_status": row.deal_status,
                    "remark": row.remark
                })
        return {"sale_done": sale_done_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/sale_done")
async def register_sale_done(
        prodnum: str = Form(...),
        order_num: str = Form(...),
        order_date: str = Form(...),
        buyer_name: str = Form(...),
        buyer_contact: str = Form(...),
        product_category: str = Form(...),
        product_description: str = Form(...),
        product_datetime: str = Form(...),
        unit_price: int = Form(...),
        deal_status: str = Form(...),
        remark: str = Form("")
):
    try:
        order_date_dt = datetime.datetime.fromisoformat(order_date)
    except Exception as e:
        order_date_dt = datetime.datetime.now()
    try:
        product_datetime_dt = datetime.datetime.fromisoformat(product_datetime)
    except Exception as e:
        product_datetime_dt = datetime.datetime.now()

    try:
        with engine.begin() as connection:
            # 1. 판매 완료 정보 삽입
            connection.execute(
                ticket_sale_done.insert().values(
                    prodnum=prodnum,
                    order_num=order_num,
                    order_date=order_date_dt,
                    buyer_name=buyer_name,
                    buyer_contact=buyer_contact,
                    product_category=product_category,
                    product_description=product_description,
                    product_datetime=product_datetime_dt,
                    unit_price=unit_price,
                    deal_status=deal_status,
                    remark=remark
                )
            )
            # 2. sale_info 테이블에서 prodnum으로 판매 등록 정보 수량과 예약번호 조회
            sale_info_row = connection.execute(
                select(ticket_sale_info.c.quantity, ticket_sale_info.c.reservation_number).where(ticket_sale_info.c.prodnum == prodnum)
            ).fetchone()
            if sale_info_row:
                sale_quantity = sale_info_row.quantity  # 판매 등록 정보에 입력된 티켓 수량
                reservation_number = sale_info_row.reservation_number
                # 3. ticket 테이블에서 해당 예약번호의 remaining_quantity 업데이트
                connection.execute(
                    tickets_table.update().where(tickets_table.c.reservation_number == reservation_number)
                    .values(remaining_quantity = tickets_table.c.remaining_quantity - sale_quantity)
                )
        logging.info("판매 완료 정보 저장 성공: 주문번호 %s", order_num)
        return {"message": "판매 완료 정보가 등록되었습니다!"}
    except Exception as e:
        logging.error("판매 완료 등록 오류: %s", e)
        raise HTTPException(status_code=500, detail="판매 완료 등록 실패")


@app.put("/api/sale_done/{order_num}")
async def update_sale_done(order_num: str,
                             buyer_name: str = Form(...),
                             buyer_contact: str = Form(...),
                             product_category: str = Form(...),
                             product_description: str = Form(...),
                             product_datetime: str = Form(...),
                             unit_price: int = Form(...),
                             deal_status: str = Form(...),
                             remark: str = Form("")):
    try:
        product_datetime_dt = datetime.datetime.fromisoformat(product_datetime)
    except Exception as e:
        logging.error("product_datetime 변환 실패: %s", e)
        product_datetime_dt = datetime.datetime.now()
    try:
        with engine.begin() as connection:
            update_query = ticket_sale_done.update().where(ticket_sale_done.c.order_num == order_num).values(
                buyer_name=buyer_name,
                buyer_contact=buyer_contact,
                product_category=product_category,
                product_description=product_description,
                product_datetime=product_datetime_dt,
                unit_price=unit_price,
                deal_status=deal_status,
                remark=remark
            )
            result = connection.execute(update_query)
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="판매 완료 정보를 찾을 수 없습니다.")
        return {"message": "판매 완료 정보가 업데이트되었습니다!"}
    except Exception as e:
        logging.error("판매 완료 정보 업데이트 중 오류 발생: %s", e)
        raise HTTPException(status_code=500, detail="판매 완료 정보 업데이트 실패")

@app.delete("/api/sale_done/{order_num}")
def delete_sale_done(order_num: str):
    try:
        with engine.begin() as connection:
            # 1. sale_done에서 삭제할 row를 조회 (prodnum 필요)
            sale_done_data = connection.execute(
                select(ticket_sale_done.c.prodnum)
                .where(ticket_sale_done.c.order_num == order_num)
            ).fetchone()
            if not sale_done_data:
                raise HTTPException(status_code=404, detail="판매 완료 정보를 찾을 수 없습니다.")

            prodnum = sale_done_data.prodnum

            # 2. prodnum으로 sale_info에서 수량(quantity)와 예약번호(reservation_number) 조회
            sale_info_data = connection.execute(
                select(ticket_sale_info.c.quantity, ticket_sale_info.c.reservation_number)
                .where(ticket_sale_info.c.prodnum == prodnum)
            ).fetchone()
            if not sale_info_data:
                raise HTTPException(status_code=404, detail="판매 등록 정보를 찾을 수 없습니다.")

            sale_quantity = sale_info_data.quantity
            reservation_number = sale_info_data.reservation_number

            # 3. ticket 테이블에서 해당 예약번호의 remaining_quantity를 업데이트 (판매 수량만큼 더하기)
            connection.execute(
                tickets_table.update()
                .where(tickets_table.c.reservation_number == reservation_number)
                .values(remaining_quantity = tickets_table.c.remaining_quantity + sale_quantity)
            )

            # 4. sale_done row 삭제
            delete_query = ticket_sale_done.delete().where(ticket_sale_done.c.order_num == order_num)
            result = connection.execute(delete_query)
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="판매 완료 정보를 찾을 수 없습니다.")

        return {"message": "판매 완료 정보가 삭제되었습니다!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from sqlalchemy import select, func

@app.delete("/api/sale_info/{prodnum}")
def delete_sale_info(prodnum: str):
    try:
        with engine.begin() as connection:
            # 1. prodnum에 해당하는 판매 등록 정보(sale_info) 행 조회
            sale_info_data = connection.execute(
                select(ticket_sale_info.c.quantity, ticket_sale_info.c.reservation_number)
                .where(ticket_sale_info.c.prodnum == prodnum)
            ).fetchone()
            if not sale_info_data:
                raise HTTPException(status_code=404, detail="판매 등록 정보를 찾을 수 없습니다.")
            sale_quantity = sale_info_data.quantity
            reservation_number = sale_info_data.reservation_number

            # 2. 해당 prodnum에 연결된 판매 완료 정보(sale_done) 건수 조회
            sale_done_count = connection.execute(
                select(func.count()).select_from(ticket_sale_done)
                .where(ticket_sale_done.c.prodnum == prodnum)
            ).scalar()

            # 3. 해당 prodnum에 연결된 판매 완료 정보(sale_done) 삭제
            connection.execute(
                ticket_sale_done.delete().where(ticket_sale_done.c.prodnum == prodnum)
            )

            # 4. 판매 완료 정보가 있었다면, 티켓 테이블 업데이트: 해당 예약번호의 remaining_quantity를 sale_info의 수량만큼 증가
            if sale_done_count > 0:
                connection.execute(
                    tickets_table.update().where(tickets_table.c.reservation_number == reservation_number)
                    .values(remaining_quantity = tickets_table.c.remaining_quantity + sale_quantity)
                )

            # 5. 판매 등록 정보 삭제
            delete_query = ticket_sale_info.delete().where(ticket_sale_info.c.prodnum == prodnum)
            result = connection.execute(delete_query)
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="판매 등록 정보를 찾을 수 없습니다.")
        return {"message": "판매 등록 정보와 연결된 판매 완료 정보가 삭제되었으며, 관련 티켓의 남은 수가 복구되었습니다!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/cancel_ticket/{reservation_number}")
def cancel_ticket(reservation_number: str):
    try:
        with engine.begin() as connection:
            # ticket 테이블에서 해당 티켓 조회
            query = tickets_table.select().where(tickets_table.c.reservation_number == reservation_number)
            result = connection.execute(query)
            ticket = result.fetchone()
            if not ticket:
                raise HTTPException(status_code=404, detail="티켓을 찾을 수 없습니다.")

            # 예매취소 수수료 계산:
            # cancel_fee = (payment_amount - (purchase_quantity * 1000)) // 10 + (purchase_quantity * 1000)
            cancel_fee = (ticket.payment_amount - (ticket.purchase_quantity * 1000)) // 10 + (
                        ticket.purchase_quantity * 1000)

            # ticket_canceled 테이블에 데이터 삽입
            ins_stmt = ticket_canceled.insert().values(
                reservation_number=ticket.reservation_number,
                purchase_source=ticket.purchase_source,
                buyer=ticket.buyer,
                purchase_date=ticket.purchase_date,
                payment_amount=ticket.payment_amount,
                payment_method=ticket.payment_method,
                card_company=ticket.card_company,
                card_number=ticket.card_number,
                card_approval_number=ticket.card_approval_number,
                product_use_date=ticket.product_use_date,
                product_name=ticket.product_name,
                purchase_quantity=ticket.purchase_quantity,
                remaining_quantity=ticket.remaining_quantity,
                seat_detail=ticket.seat_detail,
                seat_image_name=ticket.seat_image_name,
                cancel_fee=cancel_fee
            )
            connection.execute(ins_stmt)

            # ticket 테이블에서 해당 티켓 삭제
            del_stmt = tickets_table.delete().where(tickets_table.c.reservation_number == reservation_number)
            connection.execute(del_stmt)

        return {"message": "티켓 예매취소가 완료되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    logging.info("🔄 Uvicorn 서버 실행 중...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
