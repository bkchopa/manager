import logging
from fastapi import FastAPI, UploadFile, File, Form
from contextlib import asynccontextmanager
import uvicorn
import os
import shutil
from app.config import SEAT_IMAGE_FOLDER
from fastapi.responses import FileResponse
from app.database import check_db_connection, engine  # ✅ DB 연결 확인 로그 추가
from app.tickets import load_ticket_cache, get_cached_tickets
from app.models import tickets_table
import json
from fastapi.middleware.cors import CORSMiddleware

# ✅ 로깅 설정 (로그 포맷과 레벨 설정)
logging.basicConfig(
    level=logging.INFO,  # 로그 레벨 (INFO 이상만 출력)
    format="%(asctime)s - %(levelname)s - %(message)s",  # 로그 포맷 설정
    datefmt="%Y-%m-%d %H:%M:%S"
)

UPLOAD_DIR = "uploaded_images"
os.makedirs(UPLOAD_DIR, exist_ok=True)  # 폴더 없으면 생성

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI 서버의 Lifecycle 이벤트 핸들러 (서버 시작 시 실행)
    """
    logging.info("🚀 FastAPI 서버 시작!")  # ✅ FastAPI 서버 시작 로그 추가
    check_db_connection()  # ✅ DB 연결 확인 로그 출력
    load_ticket_cache()  # ✅ 서버 시작 시 캐시 로드
    yield  # 서버 종료 시 정리할 작업 추가 가능
    logging.info("🛑 FastAPI 서버 종료!")  # ✅ FastAPI 서버 종료 로그 추가

# FastAPI 인스턴스 생성
app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ✅ 모든 도메인에서 API 요청 허용 (보안상 필요하면 특정 도메인만 허용)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/tickets")
def get_tickets():
    """
    캐싱된 티켓 정보를 반환하는 API
    """
    logging.info("📢 /tickets API 호출됨")

    tickets_data = get_cached_tickets()  # ✅ JSON 변환된 데이터 가져오기
    logging.info(f"📜 반환 데이터: {json.dumps(tickets_data, indent=2, ensure_ascii=False)[:500]}...")

    return {"tickets": tickets_data}

@app.get("/seat-image/{image_name}")
def get_seat_image(image_name: str):
    """
    좌석 이미지 파일을 반환하는 API
    """
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
    seat_image: UploadFile = File(None)  # 이미지 파일 업로드 가능
):
    image_filename = None
    if seat_image:
        image_filename = f"{reservation_number}_{seat_image.filename}"
        with open(os.path.join(UPLOAD_DIR, image_filename), "wb") as buffer:
            shutil.copyfileobj(seat_image.file, buffer)

    with engine.connect() as connection:
        connection.execute(tickets_table.insert().values(
            reservation_number=reservation_number,
            purchase_source=purchase_source,
            buyer=buyer,
            purchase_date=purchase_date,
            payment_amount=payment_amount,
            seat_detail=seat_detail,
            seat_image_name=image_filename
        ))

    return {"message": "티켓이 추가되었습니다!"}

if __name__ == "__main__":
    logging.info("🔄 Uvicorn 서버 실행 중...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)