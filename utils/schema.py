from pydantic import BaseModel, Field, RootModel
from typing import List, Dict

class Elements(BaseModel):
    npc: List[str] = []
    items: List[str] = []
    monsters: List[str] = []

class Metadata(BaseModel):
    name: str
    description: str = ""
    image: str = ""
    music: str = ""
    notes: str = ""
    tags: List[str] = []
    sub: List[str] = []
    elements: Elements = Field(default_factory=Elements)
    show_on_vis: bool = False

    @classmethod
    def default(cls, name: str, description: str = "") -> "Metadata":
        return cls(name=name, description=description)

class CampaignState(RootModel[Dict[str, Metadata]]):
    def get(self, path: str) -> Metadata:
        if path not in self.root:
            raise KeyError(f"{path} not found")
        return self.root[path]

    def set(self, path: str, meta: Metadata):
        self.root[path] = meta