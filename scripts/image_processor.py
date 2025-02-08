import json
import os
from pathlib import Path
from PIL import Image
from typing import Dict, List, Optional, Union

class SpriteLayerer:
    def __init__(self, sheet_definitions_path: str = "sheet_definitions"):
        self.sheet_definitions_path = sheet_definitions_path
        self.default_animations = [
            "spellcast",
            "thrust",
            "walk",
            "slash",
            "shoot",
            "hurt",
            "watering",
        ]
        self.supported_sexes = ["male", "female", "teen", "child", "muscular", "pregnant"]

    def load_definition(self, json_path: str) -> Dict:
        """Load and parse a JSON definition file."""
        with open(json_path, "r") as f:
            return json.load(f)

    def get_required_sexes(self, definition: Dict) -> List[str]:
        """Get list of required sexes from the definition."""
        required_sexes = []
        for sex in self.supported_sexes:
            if definition["layer_1"].get(sex):
                required_sexes.append(sex)
        return required_sexes

    def get_animations(self, definition: Dict) -> List[str]:
        """Get list of supported animations from the definition."""
        return definition.get("animations", self.default_animations)

    def get_image_paths(self, base_path: str, variant: str, animations: List[str]) -> List[str]:
        """
        Construct full image paths for all animations from base path and variant.
        Returns a list of paths in the order of animations.
        """
        base_path = os.path.join("spritesheets", base_path)
        return [os.path.join(base_path, anim, f"{variant}.png") for anim in animations]

    def layer_images(
        self,
        definition_name: str,
        variant: str,
        sex: str,
        output_path: str,
        template_params: Optional[Dict] = None
    ) -> None:
        """
        Layer images according to the definition and variant.
        
        Args:
            definition_name: Name of the JSON definition file (without .json)
            variant: Variant name from the definition's variants list
            sex: One of the supported sexes
            output_path: Where to save the final layered image
            template_params: Optional parameters for template substitution
        """
        json_path = os.path.join(self.sheet_definitions_path, f"{definition_name}.json")
        definition = self.load_definition(json_path)

        if sex not in self.get_required_sexes(definition):
            raise ValueError(f"Sex '{sex}' not supported in definition {definition_name}")

        if variant not in definition["variants"]:
            raise ValueError(f"Variant '{variant}' not found in definition {definition_name}")

        # Create a new transparent image - size will be set when processing first layer
        final_image = Image.new("RGBA", (1, 1), (0, 0, 0, 0))

        # Layer each defined layer
        for layer_idx in range(1, 10):  # Support up to 9 layers
            layer_key = f"layer_{layer_idx}"
            if layer_key not in definition:
                break

            layer_def = definition[layer_key]
            base_path = layer_def[sex]
            
            if not base_path:
                continue

            # Handle template substitution if needed
            if template_params and definition.get("template"):
                for key, value in template_params.items():
                    base_path = base_path.replace(f"${{{key}}}", value)

            # Handle path replacements if specified
            if definition.get("replace_in_path"):
                for old, new in definition["replace_in_path"].items():
                    base_path = base_path.replace(old, new)

            # Get paths for all animations
            animations = self.get_animations(definition)
            image_paths = self.get_image_paths(base_path, variant, animations)
            
            # Create a composite image from all animations
            animation_images = []
            for path in image_paths:
                try:
                    img = Image.open(path)
                    if img.mode != "RGBA":
                        img = img.convert("RGBA")
                    animation_images.append(img)
                except FileNotFoundError:
                    print(f"Warning: Image not found at {path}")
                    continue
            
            if not animation_images:
                print(f"Warning: No images found for {base_path} {variant}")
                continue
            
            # Calculate the total width and height for all animations
            total_width = sum(img.width for img in animation_images)
            max_height = max(img.height for img in animation_images)
            
            # Create a new image to hold all animations
            combined = Image.new("RGBA", (total_width, max_height), (0, 0, 0, 0))
            
            # Paste each animation image
            x_offset = 0
            for img in animation_images:
                combined.paste(img, (x_offset, 0), img)
                x_offset += img.width
            
            # Composite the combined layer onto the final image
            if final_image.size != combined.size:
                final_image = Image.new("RGBA", combined.size, (0, 0, 0, 0))
            final_image = Image.alpha_composite(final_image, combined)

        # Save the final layered image
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        final_image.save(output_path)

    def batch_process(
        self,
        definition_name: str,
        output_dir: str,
        variants: Optional[List[str]] = None,
        sexes: Optional[List[str]] = None,
        template_params: Optional[Dict] = None
    ) -> None:
        """
        Process multiple variants and sexes in batch.
        
        Args:
            definition_name: Name of the JSON definition file (without .json)
            output_dir: Directory to save the layered images
            variants: Optional list of variants to process (default: all from definition)
            sexes: Optional list of sexes to process (default: all supported)
            template_params: Optional parameters for template substitution
        """
        json_path = os.path.join(self.sheet_definitions_path, f"{definition_name}.json")
        definition = self.load_definition(json_path)

        variants_to_process = variants or definition["variants"]
        sexes_to_process = sexes or self.get_required_sexes(definition)

        for variant in variants_to_process:
            for sex in sexes_to_process:
                output_name = f"{definition_name}_{variant}_{sex}.png"
                output_path = os.path.join(output_dir, output_name)
                
                try:
                    self.layer_images(
                        definition_name,
                        variant,
                        sex,
                        output_path,
                        template_params
                    )
                    print(f"Generated {output_path}")
                except (ValueError, FileNotFoundError) as e:
                    print(f"Error processing {output_name}: {str(e)}")

    def process_config(self, config_path: str) -> None:
        """
        Process sprites based on a configuration file.
        
        Args:
            config_path: Path to the JSON configuration file
        """
        with open(config_path, 'r') as f:
            config = json.load(f)

        # Update sheet definitions path if specified
        if "sheet_definitions_path" in config:
            self.sheet_definitions_path = config["sheet_definitions_path"]

        # Create output directory
        output_dir = config.get("output_dir", "output")
        os.makedirs(output_dir, exist_ok=True)

        # Process individual sprites
        for sprite in config.get("sprites", []):
            try:
                output_path = os.path.join(output_dir, sprite["output_name"])
                self.layer_images(
                    sprite["definition_name"],
                    sprite["variant"],
                    sprite["sex"],
                    output_path,
                    sprite.get("template_params")
                )
                print(f"Generated {output_path}")
            except (KeyError, ValueError, FileNotFoundError) as e:
                print(f"Error processing sprite {sprite.get('output_name', 'unknown')}: {str(e)}")

        # Process batch jobs
        for job in config.get("batch_jobs", []):
            try:
                self.batch_process(
                    job["definition_name"],
                    output_dir,
                    job.get("variants"),
                    job.get("sexes"),
                    job.get("template_params")
                )
            except (KeyError, ValueError, FileNotFoundError) as e:
                print(f"Error processing batch job for {job.get('definition_name', 'unknown')}: {str(e)}")