from __future__ import annotations

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp

from .api.container import ApiContainer
from .api.routes.lothar_collatz import router as lothar_collatz_router


class FastApiAppFactory:
    @staticmethod
    def build() -> ASGIApp:
        settings = ApiContainer.settings()
        fastapi_app = FastAPI(
            title='LotharCollatz API',
            version='0.2.0',
        )
        fastapi_app.include_router(lothar_collatz_router)
        return CORSMiddleware(
            app=fastapi_app,
            allow_origins=list(settings.cors_origins),
            allow_credentials=True,
            allow_methods=['*'],
            allow_headers=['*'],
        )


app = FastApiAppFactory.build()
