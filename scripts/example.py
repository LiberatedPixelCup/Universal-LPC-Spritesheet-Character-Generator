from image_processor import SpriteLayerer
import sys

def main():
    if len(sys.argv) != 2:
        print("Usage: python example.py <config_file>")
        print("Example: python example.py config.json")
        sys.exit(1)

    config_file = sys.argv[1]
    
    # Initialize the sprite layerer and process the config file
    layerer = SpriteLayerer()
    layerer.process_config(config_file)

if __name__ == "__main__":
    main()