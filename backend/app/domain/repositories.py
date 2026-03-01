from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from .lothar_collatz import LotharCollatzGeneration


class LotharCollatzRepository(ABC):
    @abstractmethod
    def save(self, generation: LotharCollatzGeneration) -> None:
        raise NotImplementedError

    @abstractmethod
    def load_by_limit(self, limit: int) -> Optional[LotharCollatzGeneration]:
        raise NotImplementedError

