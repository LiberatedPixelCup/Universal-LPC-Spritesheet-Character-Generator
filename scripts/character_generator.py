import os
from pathlib import Path
from PIL import Image
from typing import Dict, List, Optional, Union
import json

class CharacterGenerator:
    def __init__(self, spritesheets_path: str = "spritesheets"):
        self.spritesheets_path = spritesheets_path
        self.animations = [
            "spellcast",
            "thrust",
            "walk",
            "slash",
            "shoot",
            "hurt"
        ]
        self.supported_sexes = ["male", "female", "teen", "child", "muscular", "pregnant"]
        
    def get_component_path(self, component_type: str, style: str, sex: str, variant: str) -> str:
        """Get the base path for a component."""
        return os.path.join(self.spritesheets_path, component_type, style, sex)
        
    def load_animation_frames(self, base_path: str, variant: str) -> List[Image.Image]:
        """Load all animation frames for a component."""
        frames = []
        
        # Try loading individual animation frames
        for anim in self.animations:
            frame_path = os.path.join(base_path, anim, f"{variant}.png")
            if os.path.exists(frame_path):
                try:
                    img = Image.open(frame_path)
                    if img.mode != "RGBA":
                        img = img.convert("RGBA")
                    frames.append(img)
                except Exception as e:
                    print(f"Warning: Failed to load {frame_path}: {str(e)}")
                    continue
                    
        # If no individual frames found, try loading the combined animation file
        if not frames:
            combined_path = os.path.join(base_path, f"{variant}.png")
            if os.path.exists(combined_path):
                try:
                    frames = [Image.open(combined_path)]
                except Exception as e:
                    print(f"Warning: Failed to load {combined_path}: {str(e)}")
                    
        return frames

    def create_character(
        self,
        output_path: str,
        sex: str = "male",
        body_variant: str = "light",
        components: Dict[str, Dict[str, str]] = None
    ) -> None:
        """
        Create a character by layering different components.
        
        Args:
            output_path: Where to save the final character image
            sex: One of the supported sex types
            body_variant: Variant for the base body (e.g., "light", "dark", "orc")
            components: Dictionary of components to layer, e.g.:
                {
                    "hair": {"style": "long", "variant": "black"},
                    "eyes": {"style": "normal", "variant": "blue"},
                    "torso": {"style": "clothes_shirt", "variant": "white"}
                }
        """
        if sex not in self.supported_sexes:
            raise ValueError(f"Unsupported sex type: {sex}")
            
        # Start with the body base
        body_path = self.get_component_path("body", "bodies", sex, body_variant)
        body_frames = self.load_animation_frames(body_path, body_variant)
        
        if not body_frames:
            raise ValueError(f"Could not load body frames for {sex} {body_variant}")
            
        # Calculate the total width and height for all animations
        total_width = sum(img.width for img in body_frames)
        max_height = max(img.height for img in body_frames)
        
        # Create the base image
        final_image = Image.new("RGBA", (total_width, max_height), (0, 0, 0, 0))
        
        # Place body frames
        x_offset = 0
        for frame in body_frames:
            final_image.paste(frame, (x_offset, 0), frame)
            x_offset += frame.width
            
        # Layer each additional component
        if components:
            for component_type, details in components.items():
                style = details.get("style")
                variant = details.get("variant")
                if not style or not variant:
                    continue
                    
                comp_path = self.get_component_path(component_type, style, sex, variant)
                comp_frames = self.load_animation_frames(comp_path, variant)
                
                if not comp_frames:
                    print(f"Warning: No frames found for {component_type} {style} {variant}")
                    continue
                    
                # Layer each frame at the corresponding position
                x_offset = 0
                for frame in comp_frames:
                    # Create a temporary image for this section
                    section = Image.new("RGBA", (frame.width, max_height), (0, 0, 0, 0))
                    section.paste(frame, (0, 0), frame)
                    
                    # Extract the section from the final image
                    final_section = final_image.crop((x_offset, 0, x_offset + frame.width, max_height))
                    
                    # Composite the new frame over the existing one
                    final_section = Image.alpha_composite(final_section, section)
                    
                    # Paste back into the final image
                    final_image.paste(final_section, (x_offset, 0))
                    x_offset += frame.width
        
        # Save the final character
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        final_image.save(output_path)

    def process_config(self, config_path: str) -> None:
        """
        Process character configurations from a JSON file.
        
        Config format:
        {
            "output_dir": "output",
            "characters": [
                {
                    "name": "warrior",
                    "sex": "male",
                    "body_variant": "light",
                    "components": {
                        "hair": {"style": "long", "variant": "black"},
                        "eyes": {"style": "normal", "variant": "blue"},
                        "torso": {"style": "clothes_shirt", "variant": "white"}
                    }
                }
            ]
        }
        """
        with open(config_path, 'r') as f:
            config = json.load(f)
            
        output_dir = config.get("output_dir", "output")
        os.makedirs(output_dir, exist_ok=True)
        
        for char in config.get("characters", []):
            try:
                name = char.get("name", "character")
                output_path = os.path.join(output_dir, f"{name}.png")
                
                self.create_character(
                    output_path=output_path,
                    sex=char.get("sex", "male"),
                    body_variant=char.get("body_variant", "light"),
                    components=char.get("components", {})
                )
                print(f"Generated character: {output_path}")
            except Exception as e:
                print(f"Error generating character {char.get('name', 'unknown')}: {str(e)}")