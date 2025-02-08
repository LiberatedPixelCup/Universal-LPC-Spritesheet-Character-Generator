from image_processor import SpriteLayerer

def main():
    # Initialize the sprite layerer
    layerer = SpriteLayerer()

    # Example 1: Process a single variant and sex
    layerer.layer_images(
        definition_name="arms_armour",
        variant="steel",
        sex="male",
        output_path="output/arms_armour_steel_male.png"
    )

    # Example 2: Batch process multiple variants and sexes
    layerer.batch_process(
        definition_name="arms_armour",
        output_dir="output",
        variants=["steel", "gold"],  # Only process steel and gold variants
        sexes=["male", "female"]     # Only process male and female
    )

if __name__ == "__main__":
    main()