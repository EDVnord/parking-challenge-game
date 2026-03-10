from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, friends, leaderboard, payment, room_manager

app = FastAPI(title="Король парковки — API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(friends.router)
app.include_router(leaderboard.router)
app.include_router(payment.router)
app.include_router(room_manager.router)

@app.get("/")
def root():
    return {"status": "ok", "game": "Король парковки"}
