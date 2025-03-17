import logging
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException
from sqlalchemy import select, delete
from app.database import engine
from contextlib import asynccontextmanager
import uvicorn
import os
from app.models import ticket_sale_info  # models.py에 정의되어 있어야 함
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
from fastapi.staticfiles import StaticFiles




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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/tickets")
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
    if os.path.exists(image_path):
        return FileResponse(image_path)
    else:
        return {"error": "Image not found"}

@app.post("/tickets")
async def add_ticket(
        reservation_number: str = Form(...),
        purchase_source: str = Form(...),
        buyer: str = Form(...),
        purchase_date: str = Form(...),
        payment_amount: int = Form(...),
        seat_detail: str = Form(...),
        ticket_count: int = Form(...),
        payment_method: str = Form(...),
        card_company: str = Form(None),
        card_number: str = Form(None),
        card_approval_number: str = Form(None),
        seat_image: UploadFile = File(None)
):
    import datetime, os, shutil
    logging.info("📝 add_ticket 호출됨. 예약번호: %s", reservation_number)
    try:
        purchase_date_dt = datetime.datetime.fromisoformat(purchase_date)
        logging.info("📝 purchase_date 변환 성공: %s", purchase_date_dt)
    except Exception as e:
        logging.error("❌ purchase_date 변환 실패: %s", e)
        purchase_date_dt = datetime.datetime.now()

    product_use_date = purchase_date_dt
    product_name = "티켓"

    image_filename = ""
    if seat_image:
        try:
            original_filename = seat_image.filename
            if original_filename == "":
                logging.error("❌ 업로드된 이미지의 파일명이 비어 있습니다.")
            ext = os.path.splitext(original_filename)[1]
            if ext == "":
                logging.error("❌ 파일 확장자가 없습니다. 파일명: %s", original_filename)
            image_filename = f"ticket_{reservation_number}{ext}"
            os.makedirs(SEAT_IMAGE_FOLDER, exist_ok=True)
            full_path = os.path.join(SEAT_IMAGE_FOLDER, image_filename)
            with open(full_path, "wb") as buffer:
                shutil.copyfileobj(seat_image.file, buffer)
            logging.info("📝 이미지 업로드 성공: %s", image_filename)
        except Exception as e:
            logging.error("❌ 이미지 업로드 실패: %s", e)
            image_filename = ""
    else:
        logging.info("📝 이미지 파일이 전송되지 않았습니다.")

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
                    product_use_date=product_use_date,
                    product_name=product_name,
                    purchase_quantity=ticket_count,
                    seat_detail=seat_detail,
                    seat_image_name=image_filename
                )
            )
        logging.info("📝 DB에 티켓 정보 저장 성공: 예약번호 %s", reservation_number)
    except Exception as e:
        logging.error("❌ DB 저장 중 오류 발생: %s", e)
        raise e

    return {"message": "티켓이 추가되었습니다!"}

@app.patch("/tickets/{reservation_number}")
async def update_ticket(
        reservation_number: str,
        purchase_source: str = Form(...),
        buyer: str = Form(...),
        purchase_date: str = Form(...),
        payment_amount: int = Form(...),
        payment_method: str = Form(...),
        card_company: str = Form(None),
        card_number: str = Form(None),
        card_approval_number: str = Form(None),
        seat_detail: str = Form(...),
        ticket_count: int = Form(...),
        seat_image: UploadFile = File(None)
):
    import datetime, os, shutil
    logging.info("Updating ticket: %s", reservation_number)
    try:
        purchase_date_dt = datetime.datetime.fromisoformat(purchase_date)
        logging.info("purchase_date 변환 성공: %s", purchase_date_dt)
    except Exception as e:
        logging.error("purchase_date 변환 실패: %s", e)
        purchase_date_dt = datetime.datetime.now()

    product_use_date = purchase_date_dt
    product_name = "티켓"

    image_filename = None
    if seat_image:
        try:
            original_filename = seat_image.filename
            ext = os.path.splitext(original_filename)[1]
            image_filename = f"ticket_{reservation_number}{ext}"
            os.makedirs(SEAT_IMAGE_FOLDER, exist_ok=True)
            full_path = os.path.join(SEAT_IMAGE_FOLDER, image_filename)
            with open(full_path, "wb") as buffer:
                shutil.copyfileobj(seat_image.file, buffer)
            logging.info("이미지 저장 성공: %s", image_filename)
        except Exception as e:
            logging.error("이미지 저장 실패: %s", e)
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
                "product_use_date": product_use_date,
                "product_name": product_name,
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

@app.delete("/tickets/{reservation_number}")
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

@app.post("/sale_info")
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
    try:
        product_datetime_dt = datetime.datetime.fromisoformat(product_datetime)
        logging.info("product_datetime 변환 성공: %s", product_datetime_dt)
    except Exception as e:
        logging.error("product_datetime 변환 실패: %s", e)
        product_datetime_dt = datetime.datetime.now()

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

@app.get("/sale_info")
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
@app.get("/sale_done_list")
def get_sale_done_list(reservation_number: Optional[str] = None, prodnum: Optional[str] = None):
    try:
        with engine.connect() as connection:
            query = select(ticket_sale_done)
            if prodnum:
                query = query.where(ticket_sale_done.c.prodnum == prodnum)
            elif reservation_number:
                query = query.where(ticket_sale_done.c.reservation_number == reservation_number)
            results = connection.execute(query).fetchall()
            sale_done_list = []
            for row in results:
                sale_done_list.append({
                    # "reservation_number": row.reservation_number,  # 제거 (해당 컬럼 없음)
                    "prodnum": row.prodnum,
                    "order_num": row.order_num,
                    "ticket_grade": row.ticket_grade,
                    "ticket_floor": row.ticket_floor,
                    "ticket_area": row.ticket_area,
                    "product_category": row.product_category,
                    "product_datetime": row.product_datetime.isoformat() if row.product_datetime else None,
                    "product_description": row.product_description,
                    "unit_price": row.unit_price,
                    "deal_status": row.deal_status,
                    "remark": row.remark
                })
        return {"sale_done": sale_done_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sale_done")
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
        logging.info("판매 완료 정보 저장 성공: 주문번호 %s", order_num)
        return {"message": "판매 완료 정보가 등록되었습니다!"}
    except Exception as e:
        logging.error("판매 완료 등록 오류: %s", e)
        raise HTTPException(status_code=500, detail="판매 완료 등록 실패")

@app.put("/sale_done/{order_num}")
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

@app.delete("/sale_done/{prodnum}")
def delete_sale_done(prodnum: str):
    try:
        with engine.begin() as connection:
            delete_query = delete(ticket_sale_done).where(ticket_sale_done.c.prodnum == prodnum)
            result = connection.execute(delete_query)
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="판매 완료 정보를 찾을 수 없습니다.")
        return {"message": "판매 완료 정보가 삭제되었습니다!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    logging.info("🔄 Uvicorn 서버 실행 중...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
